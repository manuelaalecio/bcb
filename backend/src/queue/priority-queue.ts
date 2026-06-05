import { Priority } from '@prisma/client'

/**
 * Fila com prioridade em memória, sem dependências externas (Redis/BullMQ).
 *
 * Mantém dois buckets FIFO: urgentes e normais. O `dequeue` esvazia primeiro
 * os urgentes (mantendo a ordem de chegada), depois os normais.
 */
export class PriorityQueue<T> {
  private readonly urgent: T[] = []
  private readonly normal: T[] = []

  enqueue(item: T, priority: Priority): void {
    if (priority === Priority.urgent) {
      this.urgent.push(item)
    } else {
      this.normal.push(item)
    }
  }

  dequeue(): T | undefined {
    return this.urgent.shift() ?? this.normal.shift()
  }

  peek(): T | undefined {
    return this.urgent[0] ?? this.normal[0]
  }

  size(): number {
    return this.urgent.length + this.normal.length
  }

  isEmpty(): boolean {
    return this.size() === 0
  }
}
