import { useState } from 'react'
import { formatCurrency } from '../../lib/format'
import { MESSAGE_COST, type Priority } from '../../lib/types'

interface MessageComposerProps {
  sending: boolean
  onSend: (content: string, priority: Priority) => void
  onTyping: () => void
}

export function MessageComposer({
  sending,
  onSend,
  onTyping,
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')

  const trimmed = content.trim()
  const canSend = trimmed.length > 0 && !sending

  function submit() {
    if (!canSend) return
    onSend(trimmed, priority)
    setContent('')
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="composer-priority">
        <label className={priority === 'normal' ? 'active' : ''}>
          <input
            type="radio"
            name="priority"
            value="normal"
            checked={priority === 'normal'}
            onChange={() => setPriority('normal')}
          />
          Normal
          <span className="priority-cost">
            {formatCurrency(MESSAGE_COST.normal)}
          </span>
        </label>
        <label className={priority === 'urgent' ? 'active' : ''}>
          <input
            type="radio"
            name="priority"
            value="urgent"
            checked={priority === 'urgent'}
            onChange={() => setPriority('urgent')}
          />
          Urgente
          <span className="priority-cost">
            {formatCurrency(MESSAGE_COST.urgent)}
          </span>
        </label>
      </div>

      <div className="composer-row">
        <textarea
          className="composer-input"
          placeholder="Digite uma mensagem…"
          rows={1}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            onTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button
          type="submit"
          className="btn-primary composer-send"
          disabled={!canSend}
        >
          {sending ? '…' : 'Enviar'}
        </button>
      </div>
    </form>
  )
}
