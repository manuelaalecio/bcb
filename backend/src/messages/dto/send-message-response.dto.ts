import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SendMessageResponseDto {
  @ApiProperty({ example: 'uuid-da-mensagem' })
  id!: string

  @ApiProperty({ example: 'queued' })
  status!: 'queued'

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  timestamp!: string

  @ApiProperty({ example: '2024-01-15T10:30:05.000Z' })
  estimatedDelivery!: string

  @ApiProperty({ example: 0.25 })
  cost!: number

  @ApiPropertyOptional({
    example: 49.75,
    description: 'Saldo restante (apenas para clientes pré-pago).',
  })
  currentBalance?: number
}
