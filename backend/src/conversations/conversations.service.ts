import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(clientId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { clientId },
      orderBy: { lastMessageTime: 'desc' },
    })

    return conversations.map((c) => ({
      id: c.id,
      recipientId: c.recipientId,
      recipientName: c.recipientName,
      lastMessageContent: c.lastMessageContent ?? '',
      lastMessageTime: c.lastMessageTime?.toISOString() ?? '',
      unreadCount: c.unreadCount,
    }))
  }

  async findMessages(conversationId: string, clientId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    })

    if (!conversation || conversation.clientId !== clientId) {
      throw new NotFoundException('Conversa não encontrada.')
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })

    return messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      content: m.content,
      sentBy: { id: m.senderId, type: m.senderType },
      timestamp: m.createdAt.toISOString(),
      priority: m.priority,
      status: m.status,
      cost: Number(m.cost),
    }))
  }
}
