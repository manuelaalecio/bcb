import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger'
import { Priority } from '@prisma/client'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class SendMessageDto {
  @ApiPropertyOptional({
    example: 'uuid-da-conversa',
    description: 'Conversa existente. Omita para iniciar uma nova.',
  })
  @IsOptional()
  @IsString()
  conversationId?: string

  @ApiPropertyOptional({
    example: 'recipient-uuid',
    description: 'Obrigatório ao iniciar uma nova conversa.',
  })
  @IsOptional()
  @IsString()
  recipientId?: string

  @ApiPropertyOptional({
    example: 'João Silva',
    description: 'Obrigatório ao iniciar uma nova conversa.',
  })
  @IsOptional()
  @IsString()
  recipientName?: string

  @ApiProperty({ example: 'Olá, tudo bem?' })
  @IsString()
  @IsNotEmpty()
  content!: string

  @ApiProperty({ enum: Priority, example: Priority.normal })
  @IsEnum(Priority)
  priority!: Priority
}
