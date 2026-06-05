import { formatTime } from '../../lib/format'
import type { Conversation } from '../../lib/types'

interface ConversationItemProps {
  conversation: Conversation
  active: boolean
  onSelect: () => void
}

export function ConversationItem({
  conversation,
  active,
  onSelect,
}: ConversationItemProps) {
  const initial = conversation.recipientName.charAt(0).toUpperCase()

  return (
    <button
      type="button"
      className={`conversation-item${active ? ' active' : ''}`}
      onClick={onSelect}
    >
      <span className="avatar" aria-hidden>
        {initial}
      </span>
      <span className="conversation-body">
        <span className="conversation-top">
          <span className="conversation-name">
            {conversation.recipientName}
          </span>
          <span className="conversation-time">
            {formatTime(conversation.lastMessageTime)}
          </span>
        </span>
        <span className="conversation-bottom">
          <span className="conversation-preview">
            {conversation.lastMessageContent ?? 'Nenhuma mensagem ainda'}
          </span>
          {conversation.unreadCount > 0 && (
            <span className="unread-badge">{conversation.unreadCount}</span>
          )}
        </span>
      </span>
    </button>
  )
}
