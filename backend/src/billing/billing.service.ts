import { Injectable } from '@nestjs/common'
import { Client, Priority, Prisma } from '@prisma/client'
import { ChargeResult } from './strategies/billing-strategy.interface'
import { PostpaidStrategy } from './strategies/postpaid.strategy'
import { PrepaidStrategy } from './strategies/prepaid.strategy'

const COST_NORMAL = new Prisma.Decimal('0.25')
const COST_URGENT = new Prisma.Decimal('0.50')

@Injectable()
export class BillingService {
  constructor(
    private readonly prepaid: PrepaidStrategy,
    private readonly postpaid: PostpaidStrategy,
  ) {}

  getCost(priority: Priority): Prisma.Decimal {
    return priority === Priority.urgent ? COST_URGENT : COST_NORMAL
  }

  async charge(
    client: Client,
    priority: Priority,
    tx: Prisma.TransactionClient,
  ): Promise<ChargeResult> {
    const cost = this.getCost(priority)
    const strategy =
      client.planType === 'prepaid' ? this.prepaid : this.postpaid
    return strategy.charge(client, cost, tx)
  }
}
