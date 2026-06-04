import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateCreditDto } from './dto/update-credit.dto'

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
    const existing = await this.prisma.client.findUnique({ where: { documentId: dto.documentId } })
    if (existing) {
      throw new ConflictException('Já existe um cliente com este documento.')
    }

    const client = await this.prisma.client.create({ data: dto })
    return this.toResponse(client)
  }

  async addCredit(id: string, dto: UpdateCreditDto) {
    const client = await this.prisma.client.findUnique({ where: { id } })
    if (!client) throw new NotFoundException('Cliente não encontrado.')

    const amount = new Prisma.Decimal(dto.amount)

    const updated = await this.prisma.client.update({
      where: { id },
      data:
        client.planType === 'prepaid'
          ? { balance: { increment: amount } }
          : { monthlyLimit: { increment: amount } },
    })

    return this.toResponse(updated)
  }

  private toResponse(client: {
    id: string
    name: string
    documentId: string
    documentType: string
    planType: string
    balance: Prisma.Decimal
    monthlyLimit: Prisma.Decimal
    monthlyUsage: Prisma.Decimal
    active: boolean
    createdAt: Date
  }) {
    return {
      id: client.id,
      name: client.name,
      documentId: client.documentId,
      documentType: client.documentType,
      planType: client.planType,
      active: client.active,
      balance: Number(client.balance),
      monthlyLimit: Number(client.monthlyLimit),
      monthlyUsage: Number(client.monthlyUsage),
      createdAt: client.createdAt,
    }
  }
}
