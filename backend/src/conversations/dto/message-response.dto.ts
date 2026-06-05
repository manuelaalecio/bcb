import { ApiProperty } from '@nestjs/swagger'
import { MessageStatus, Priority, SenderType } from '@prisma/client'

export class SentByDto {
  @ApiProperty({ example: 'uuid-do-remetente' })
  id!: string

  @ApiProperty({ enum: SenderType, example: SenderType.client })
  type!: SenderType
}

export class MessageResponseDto {
  @ApiProperty({ example: 'uuid-da-mensagem' })
  id!: string

  @ApiProperty({ example: 'uuid-da-conversa' })
  conversationId!: string

  @ApiProperty({ example: 'Olá, tudo bem?' })
  content!: string

  @ApiProperty({ type: SentByDto })
  sentBy!: SentByDto

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  timestamp!: string

  @ApiProperty({ enum: Priority, example: Priority.normal })
  priority!: Priority

  @ApiProperty({ enum: MessageStatus, example: MessageStatus.sent })
  status!: MessageStatus

  @ApiProperty({ example: 0.25 })
  cost!: number
}
