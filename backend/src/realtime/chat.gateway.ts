import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { MessageStatus } from '@prisma/client'
import { Server, Socket } from 'socket.io'

interface MessageStatusPayload {
  messageId: string
  conversationId: string
  status: MessageStatus
}

interface JoinPayload {
  conversationId: string
}

interface TypingPayload {
  conversationId: string
  isTyping: boolean
}

@WebSocketGateway({ namespace: '/chat', cors: { origin: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server

  handleConnection(client: Socket): void {
    client.broadcast.emit('presence', { recipientId: client.id, online: true })
  }

  handleDisconnect(client: Socket): void {
    client.broadcast.emit('presence', { recipientId: client.id, online: false })
  }

  /** Cliente entra na sala da conversa aberta para receber os updates dela. */
  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() payload: JoinPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    void client.join(this.room(payload.conversationId))
  }

  /** Repassa o indicador de digitação aos demais participantes da sala. */
  @SubscribeMessage('typing')
  handleTyping(@MessageBody() payload: TypingPayload): void {
    this.server.to(this.room(payload.conversationId)).emit('typing', payload)
  }

  /** Chamado pelo worker para empurrar o avanço de status (os ticks). */
  emitMessageStatus(payload: MessageStatusPayload): void {
    this.server
      .to(this.room(payload.conversationId))
      .emit('message:status', payload)
  }

  private room(conversationId: string): string {
    return `conversation:${conversationId}`
  }
}
