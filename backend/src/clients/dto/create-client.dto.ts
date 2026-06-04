import { ApiProperty } from '@nestjs/swagger'
import { DocumentType, PlanType } from '@prisma/client'
import { IsEnum, IsString } from 'class-validator'

export class CreateClientDto {
  @ApiProperty({ example: 'Empresa Exemplo Ltda' })
  @IsString()
  name!: string

  @ApiProperty({ example: '12345678000190' })
  @IsString()
  documentId!: string

  @ApiProperty({ enum: DocumentType, example: DocumentType.CNPJ })
  @IsEnum(DocumentType)
  documentType!: DocumentType

  @ApiProperty({ enum: PlanType, example: PlanType.prepaid })
  @IsEnum(PlanType)
  planType!: PlanType
}
