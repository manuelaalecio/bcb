import { useEffect, useRef } from 'react'
import { Spinner } from '../../components/Spinner'
import { useToast } from '../../components/toast/useToast'
import { useChatSocket } from '../../hooks/useChatSocket'
import { useMessages } from '../../hooks/useMessages'
import { useSendMessage } from '../../hooks/useSendMessage'
import { apiErrorMessage } from '../../lib/error'
import type { Conversation, Priority } from '../../lib/types'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'
import { PresenceBadge } from './PresenceBadge'
import { TypingIndicator } from './TypingIndicator'

export function ChatPanel({
  conversation,
  onBack,
}: {
  conversation: Conversation | null
  onBack: () => void
}) {
  const conversationId = conversation?.id ?? null
  const { data: messages, isLoading } = useMessages(conversationId)
  const { isRecipientTyping, isRecipientOnline, emitTyping } =
    useChatSocket(conversationId)
  const sendMessage = useSendMessage()
  const { show } = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, isRecipientTyping])

  if (!conversation) {
    return (
      <div className="chat-panel empty">
        <p>Selecione uma conversa para começar.</p>
      </div>
    )
  }

  function handleSend(content: string, priority: Priority) {
    if (!conversation) return
    sendMessage.mutate(
      { conversationId: conversation.id, content, priority },
      {
        onError: (err) => show(apiErrorMessage(err), 'error'),
      },
    )
  }

  return (
    <div className="chat-panel">
      <header className="chat-panel-head">
        <button
          type="button"
          className="back-btn"
          onClick={onBack}
          aria-label="Voltar"
        >
          ‹
        </button>
        <span className="avatar" aria-hidden>
          {conversation.recipientName.charAt(0).toUpperCase()}
        </span>
        <div className="chat-panel-title">
          <span className="chat-panel-name">{conversation.recipientName}</span>
          <PresenceBadge online={isRecipientOnline} />
        </div>
      </header>

      <div className="messages-scroll" ref={scrollRef}>
        {isLoading && <Spinner label="Carregando mensagens…" />}
        {messages?.length === 0 && !isLoading && (
          <p className="list-state">Envie a primeira mensagem.</p>
        )}
        {messages?.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isRecipientTyping && <TypingIndicator />}
      </div>

      <MessageComposer
        sending={sendMessage.isPending}
        onSend={handleSend}
        onTyping={emitTyping}
      />
    </div>
  )
}
