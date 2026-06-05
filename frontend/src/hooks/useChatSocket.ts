import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '../lib/socket'
import { conversationsKey } from './useConversations'
import { messagesKey } from './useMessages'
import type {
  Message,
  MessageStatusEvent,
  PresenceEvent,
  TypingEvent,
} from '../lib/types'

/**
 * Wires the open conversation to the `/chat` socket: joins its room, applies
 * incoming `message:status` updates to the React Query cache, and exposes the
 * recipient's typing/presence state plus a debounced `emitTyping`.
 */
export function useChatSocket(conversationId: string | null) {
  const queryClient = useQueryClient()
  // Tracks which conversation has an active "typing" signal, so switching
  // conversations naturally clears the indicator without a setState-in-effect.
  const [typingConversationId, setTypingConversationId] = useState<
    string | null
  >(null)
  const [isRecipientOnline, setIsRecipientOnline] = useState(false)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!conversationId) return

    socket.emit('join', { conversationId })

    const onStatus = (event: MessageStatusEvent) => {
      if (event.conversationId !== conversationId) return
      queryClient.setQueryData<Message[]>(
        messagesKey(conversationId),
        (old) =>
          old?.map((m) =>
            m.id === event.messageId ? { ...m, status: event.status } : m,
          ) ?? old,
      )
      // Last-message preview / unread counts may have shifted.
      queryClient.invalidateQueries({ queryKey: conversationsKey })
    }

    const onTyping = (event: TypingEvent) => {
      if (event.conversationId !== conversationId) return
      setTypingConversationId(event.isTyping ? conversationId : null)
    }

    const onPresence = (event: PresenceEvent) => {
      setIsRecipientOnline(event.online)
    }

    socket.on('message:status', onStatus)
    socket.on('typing', onTyping)
    socket.on('presence', onPresence)

    return () => {
      socket.off('message:status', onStatus)
      socket.off('typing', onTyping)
      socket.off('presence', onPresence)
    }
  }, [conversationId, queryClient])

  const emitTyping = useCallback(() => {
    if (!conversationId) return
    socket.emit('typing', { conversationId, isTyping: true })
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing', { conversationId, isTyping: false })
    }, 1500)
  }, [conversationId])

  const isRecipientTyping = typingConversationId === conversationId
  return { isRecipientTyping, isRecipientOnline, emitTyping }
}
