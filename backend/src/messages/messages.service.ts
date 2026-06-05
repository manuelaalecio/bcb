import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Client, MessageStatus, SenderType } from '@prisma/client'
import { BillingService } from '../billing/billing.service'
import { PrismaService } from '../prisma/prisma.service'
import { MessageQueueService } from '../queue/message-queue.service'
import { SendMessageDto } from './dto/send-message.dto'
import { SendMessageResponseDto } from './dto/send-message-response.dto'

const ESTIMATED_DELIVERY_MS = 5000

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly queue: MessageQueueService,
  ) {}

  async send(
    client: Client,
    dto: SendMessageDto,
  ): Promise<SendMessageResponseDto> {
    const conversationId = await this.resolveConversationId(client, dto)

    const { message, balanceAfter } = await this.prisma.$transaction(
      async (tx) => {
        const charge = await this.billing.charge(client, dto.priority, tx)

        const created = await tx.message.create({
          data: {
            conversationId,
            content: dto.content,
            senderId: client.id,
            senderType: SenderType.client,
            priority: dto.priority,
            status: MessageStatus.queued,
            cost: charge.cost,
          },
        })

        await tx.transaction.create({
          data: {
            clientId: client.id,
            messageId: created.id,
            amount: charge.cost,
            type: charge.transactionType,
            balanceAfter: charge.balanceAfter,
          },
        })

        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageContent: created.content,
            lastMessageTime: created.createdAt,
          },
        })

        return { message: created, balanceAfter: charge.balanceAfter }
      },
    )

    this.queue.enqueue(message.id, message.priority)

    const response: SendMessageResponseDto = {
      id: message.id,
      status: 'queued',
      timestamp: message.createdAt.toISOString(),
      estimatedDelivery: new Date(
        message.createdAt.getTime() + ESTIMATED_DELIVERY_MS,
      ).toISOString(),
      cost: Number(message.cost),
    }

    if (client.planType === 'prepaid') {
      response.currentBalance = Number(balanceAfter)
    }

    return response
  }

  /**
   * Usa a conversa informada (validando a posse) ou cria uma nova a partir do
   * destinatário. Iniciar uma conversa exige `recipientId` + `recipientName`.
   */
  private async resolveConversationId(
    client: Client,
    dto: SendMessageDto,
  ): Promise<string> {
    if (dto.conversationId) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: dto.conversationId },
      })
      if (!conversation || conversation.clientId !== client.id) {
        throw new NotFoundException('Conversa não encontrada.')
      }
      return conversation.id
    }

    if (!dto.recipientId || !dto.recipientName) {
      throw new BadRequestException(
        'Para iniciar uma conversa, informe recipientId e recipientName.',
      )
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        clientId: client.id,
        recipientId: dto.recipientId,
        recipientName: dto.recipientName,
      },
    })
    return conversation.id
  }
}
