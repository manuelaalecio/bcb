import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsPositive } from 'class-validator'

export class UpdateCreditDto {
  @ApiProperty({
    example: 50.0,
    description: 'Valor a adicionar ao saldo (pré-pago) ou limite (pós-pago)',
  })
  @IsNumber()
  @IsPositive()
  amount!: number
}
