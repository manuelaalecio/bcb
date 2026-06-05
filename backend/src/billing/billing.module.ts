import { Module } from '@nestjs/common'
import { BillingService } from './billing.service'
import { PostpaidStrategy } from './strategies/postpaid.strategy'
import { PrepaidStrategy } from './strategies/prepaid.strategy'

@Module({
  providers: [BillingService, PrepaidStrategy, PostpaidStrategy],
  exports: [BillingService],
})
export class BillingModule {}
