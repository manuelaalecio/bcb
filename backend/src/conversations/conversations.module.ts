import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AuthGuard } from '../common/guards/auth.guard'
import { ConversationsController } from './conversations.controller'
import { ConversationsService } from './conversations.service'

@Module({
  imports: [AuthModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, AuthGuard],
})
export class ConversationsModule {}
