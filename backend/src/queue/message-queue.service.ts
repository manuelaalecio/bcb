import { Injectable } from '@nestjs/common'
import { Priority } from '@prisma/client'
import { PriorityQueue } from './priority-queue'

@Injectable()
export class MessageQueueService {
  private readonly queue = new PriorityQueue<string>()

  enqueue(messageId: string, priority: Priority): void {
    this.queue.enqueue(messageId, priority)
  }

  dequeue(): string | undefined {
    return this.queue.dequeue()
  }

  size(): number {
    return this.queue.size()
  }

  isEmpty(): boolean {
    return this.queue.isEmpty()
  }
}
