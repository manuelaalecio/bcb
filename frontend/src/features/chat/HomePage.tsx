import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { connectSocket, disconnectSocket } from '../../lib/socket'
import { useConversations } from '../../hooks/useConversations'
import { useAuthStore } from '../../store/auth.store'
import { AddCreditModal } from './AddCreditModal'
import { ChatHeader } from './ChatHeader'
import { ChatPanel } from './ChatPanel'
import { ConversationList } from './ConversationList'
import { NewConversationModal } from './NewConversationModal'

export function HomePage() {
  const token = useAuthStore((s) => s.token)
  const client = useAuthStore((s) => s.client)
  const logout = useAuthStore((s) => s.logout)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [showAddCredit, setShowAddCredit] = useState(false)

  const { data: conversations } = useConversations()
  const selected = conversations?.find((c) => c.id === selectedId) ?? null

  useEffect(() => {
    connectSocket()
    return () => disconnectSocket()
  }, [])

  if (!token || !client) return <Navigate to="/" replace />

  function handleLogout() {
    disconnectSocket()
    logout()
  }

  return (
    <div className="app-shell">
      <ChatHeader
        client={client}
        onAddCredit={() => setShowAddCredit(true)}
        onLogout={handleLogout}
      />

      <div className={`chat-layout${selectedId ? ' show-panel' : ''}`}>
        <aside className="sidebar">
          <ConversationList
            activeId={selectedId}
            onSelect={setSelectedId}
            onNewConversation={() => setShowNewConversation(true)}
          />
        </aside>
        <main className="main-panel">
          <ChatPanel
            conversation={selected}
            onBack={() => setSelectedId(null)}
          />
        </main>
      </div>

      {showNewConversation && (
        <NewConversationModal
          onClose={() => setShowNewConversation(false)}
          onCreated={(id) => setSelectedId(id)}
        />
      )}
      {showAddCredit && (
        <AddCreditModal
          client={client}
          onClose={() => setShowAddCredit(false)}
        />
      )}
    </div>
  )
}
