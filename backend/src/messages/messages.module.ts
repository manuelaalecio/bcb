import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { BillingModule } from '../billing/billing.module'
import { AuthGuard } from '../common/guards/auth.guard'
import { QueueModule } from '../queue/queue.module'
import { MessagesController } from './messages.controller'
import { MessagesService } from './messages.service'

@Module({
  imports: [AuthModule, BillingModule, QueueModule],
  controllers: [MessagesController],
  providers: [MessagesService, AuthGuard],
})
export class MessagesModule {}
