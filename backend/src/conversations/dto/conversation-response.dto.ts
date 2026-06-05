import { ApiProperty } from '@nestjs/swagger'

export class ConversationResponseDto {
  @ApiProperty({ example: 'uuid-da-conversa' })
  id!: string

  @ApiProperty({ example: 'recipient-uuid' })
  recipientId!: string

  @ApiProperty({ example: 'João Silva' })
  recipientName!: string

  @ApiProperty({ example: 'Olá, tudo bem?' })
  lastMessageContent!: string

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  lastMessageTime!: string

  @ApiProperty({ example: 3 })
  unreadCount!: number
}
