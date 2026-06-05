import { Injectable, UnprocessableEntityException } from '@nestjs/common'
import { Client, Prisma } from '@prisma/client'
import { BillingStrategy, ChargeResult } from './billing-strategy.interface'

@Injectable()
export class PostpaidStrategy implements BillingStrategy {
  async charge(
    client: Client,
    cost: Prisma.Decimal,
    tx: Prisma.TransactionClient,
  ): Promise<ChargeResult> {
    const usageAfter = client.monthlyUsage.add(cost)

    if (usageAfter.gt(client.monthlyLimit)) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'LimitExceeded',
        message: 'Limite mensal excedido para enviar a mensagem.',
      })
    }

    await tx.client.update({
      where: { id: client.id },
      data: { monthlyUsage: usageAfter },
    })

    return { cost, balanceAfter: usageAfter, transactionType: 'usage' }
  }
}
