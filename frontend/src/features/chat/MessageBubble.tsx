import { formatCurrency, formatTime } from '../../lib/format'
import type { Message, MessageStatus } from '../../lib/types'

const STATUS_LABEL: Record<MessageStatus, string> = {
  queued: 'Na fila',
  processing: 'Processando',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falhou',
}

function StatusTicks({ status }: { status: MessageStatus }) {
  if (status === 'failed') {
    return (
      <span className="ticks ticks-failed" title={STATUS_LABEL.failed}>
        ⚠
      </span>
    )
  }
  if (status === 'queued' || status === 'processing') {
    return (
      <span className="ticks" title={STATUS_LABEL[status]}>
        🕐
      </span>
    )
  }
  const read = status === 'read'
  const double = status === 'delivered' || read
  return (
    <span
      className={`ticks${read ? ' ticks-read' : ''}`}
      title={STATUS_LABEL[status]}
    >
      {double ? '✓✓' : '✓'}
    </span>
  )
}

export function MessageBubble({ message }: { message: Message }) {
  const mine = message.sentBy.type === 'client'

  return (
    <div className={`bubble-row ${mine ? 'mine' : 'theirs'}`}>
      <div className="bubble">
        {message.priority === 'urgent' && (
          <span className="badge-urgent">Urgente</span>
        )}
        <p className="bubble-content">{message.content}</p>
        <div className="bubble-meta">
          {message.cost > 0 && (
            <span className="bubble-cost">{formatCurrency(message.cost)}</span>
          )}
          <span className="bubble-time">{formatTime(message.timestamp)}</span>
          {mine && <StatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  )
}
