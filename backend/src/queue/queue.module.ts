import { Module } from '@nestjs/common'
import { RealtimeModule } from '../realtime/realtime.module'
import { MessageQueueService } from './message-queue.service'
import { MessageWorker } from './message.worker'

@Module({
  imports: [RealtimeModule],
  providers: [MessageQueueService, MessageWorker],
  exports: [MessageQueueService],
})
export class QueueModule {}
