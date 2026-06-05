import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { MessageStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ChatGateway } from '../realtime/chat.gateway'
import { MessageQueueService } from './message-queue.service'

const TICK_INTERVAL_MS = 1000
const DELIVERED_DELAY_MS = 2000
const READ_DELAY_MS = 4000

/**
 * Consome a fila a cada tick. Ao pegar uma mensagem, avança
 * `processing → sent` no banco emitindo cada passo via WebSocket. O "outro lado"
 * (destinatário) é simulado: `delivered` e `read` são agendados por timers.
 */
@Injectable()
export class MessageWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageWorker.name)
  private timer?: ReturnType<typeof setInterval>

  constructor(
    private readonly queue: MessageQueueService,
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick()
    }, TICK_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async tick(): Promise<void> {
    const messageId = this.queue.dequeue()
    if (!messageId) return

    try {
      await this.advance(messageId, MessageStatus.processing)
      await this.advance(messageId, MessageStatus.sent)

      setTimeout(() => {
        void this.advance(messageId, MessageStatus.delivered)
      }, DELIVERED_DELAY_MS)

      setTimeout(() => {
        void this.advance(messageId, MessageStatus.read)
      }, READ_DELAY_MS)
    } catch (error) {
      this.logger.error(`Falha ao processar mensagem ${messageId}`, error)
      await this.advance(messageId, MessageStatus.failed).catch(() => undefined)
    }
  }

  private async advance(
    messageId: string,
    status: MessageStatus,
  ): Promise<void> {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { status },
    })

    this.gateway.emitMessageStatus({
      messageId: message.id,
      conversationId: message.conversationId,
      status,
    })
  }
}
