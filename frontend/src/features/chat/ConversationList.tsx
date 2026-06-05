import { Spinner } from '../../components/Spinner'
import { useConversations } from '../../hooks/useConversations'
import { ConversationItem } from './ConversationItem'

interface ConversationListProps {
  activeId: string | null
  onSelect: (id: string) => void
  onNewConversation: () => void
}

export function ConversationList({
  activeId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const { data: conversations, isLoading, isError } = useConversations()

  return (
    <div className="conversation-list">
      <div className="conversation-list-head">
        <h2>Conversas</h2>
        <button type="button" className="btn-ghost" onClick={onNewConversation}>
          + Nova
        </button>
      </div>

      <div className="conversation-scroll">
        {isLoading && <Spinner label="Carregando conversas…" />}
        {isError && (
          <p className="list-state error">Erro ao carregar conversas.</p>
        )}
        {conversations?.length === 0 && (
          <p className="list-state">Nenhuma conversa ainda.</p>
        )}
        {conversations?.map((c) => (
          <ConversationItem
            key={c.id}
            conversation={c}
            active={c.id === activeId}
            onSelect={() => onSelect(c.id)}
          />
        ))}
      </div>
    </div>
  )
}
