import { ApiProperty } from '@nestjs/swagger'
import { DocumentType } from '@prisma/client'
import { IsEnum, IsString } from 'class-validator'

export class AuthRequestDto {
  @ApiProperty({ example: '12345678000190' })
  @IsString()
  documentId!: string

  @ApiProperty({ enum: DocumentType, example: DocumentType.CNPJ })
  @IsEnum(DocumentType)
  documentType!: DocumentType
}
