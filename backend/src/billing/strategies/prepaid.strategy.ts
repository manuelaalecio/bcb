import { Injectable, UnprocessableEntityException } from '@nestjs/common'
import { Client, Prisma } from '@prisma/client'
import { BillingStrategy, ChargeResult } from './billing-strategy.interface'

@Injectable()
export class PrepaidStrategy implements BillingStrategy {
  async charge(
    client: Client,
    cost: Prisma.Decimal,
    tx: Prisma.TransactionClient,
  ): Promise<ChargeResult> {
    if (client.balance.lt(cost)) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'InsufficientBalance',
        message: 'Saldo insuficiente para enviar a mensagem.',
      })
    }

    const balanceAfter = client.balance.sub(cost)

    await tx.client.update({
      where: { id: client.id },
      data: { balance: balanceAfter },
    })

    return { cost, balanceAfter, transactionType: 'debit' }
  }
}
