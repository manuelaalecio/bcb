import { Client, Prisma } from '@prisma/client'

export type TransactionType = 'debit' | 'usage'

export interface ChargeResult {
  cost: Prisma.Decimal
  balanceAfter: Prisma.Decimal
  transactionType: TransactionType
}

export interface BillingStrategy {
  charge(
    client: Client,
    cost: Prisma.Decimal,
    tx: Prisma.TransactionClient,
  ): Promise<ChargeResult>
}
