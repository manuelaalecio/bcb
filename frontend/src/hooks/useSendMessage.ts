import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth.store'
import { conversationsKey } from './useConversations'
import { messagesKey } from './useMessages'
import type {
  Message,
  SendMessagePayload,
  SendMessageResponse,
} from '../lib/types'

interface MutationContext {
  tempId?: string
  conversationId?: string
}

/**
 * Sends a message with an optimistic update: the message shows up as `queued`
 * right away, gets reconciled with the server id/cost on success, and is rolled
 * back on failure (e.g. 422 insufficient balance).
 */
export function useSendMessage() {
  const queryClient = useQueryClient()
  const client = useAuthStore((s) => s.client)
  const updateClient = useAuthStore((s) => s.updateClient)

  return useMutation<
    SendMessageResponse,
    unknown,
    SendMessagePayload,
    MutationContext
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post<SendMessageResponse>('/messages', payload)
      return data
    },

    onMutate: async (payload) => {
      // Optimistic insert only works for an existing conversation.
      if (!payload.conversationId || !client) return {}
      const key = messagesKey(payload.conversationId)
      await queryClient.cancelQueries({ queryKey: key })

      const tempId = `temp-${crypto.randomUUID()}`
      const optimistic: Message = {
        id: tempId,
        conversationId: payload.conversationId,
        content: payload.content,
        sentBy: { id: client.id, type: 'client' },
        timestamp: new Date().toISOString(),
        priority: payload.priority,
        status: 'queued',
        cost: 0,
      }

      queryClient.setQueryData<Message[]>(key, (old) => [
        ...(old ?? []),
        optimistic,
      ])

      return { tempId, conversationId: payload.conversationId }
    },

    onSuccess: (res, _payload, context) => {
      // Reconcile the optimistic message with the real id/cost.
      if (context?.conversationId && context.tempId) {
        const key = messagesKey(context.conversationId)
        queryClient.setQueryData<Message[]>(key, (old) =>
          (old ?? []).map((m) =>
            m.id === context.tempId
              ? { ...m, id: res.id, status: res.status, cost: res.cost }
              : m,
          ),
        )
      }

      // Reflect updated billing state after the charge.
      if (typeof res.currentBalance === 'number') {
        // Prepaid: server returns the exact new balance.
        updateClient({ balance: res.currentBalance })
      } else if (client?.planType === 'postpaid') {
        // Postpaid: server doesn't return currentUsage, so increment locally.
        updateClient({ monthlyUsage: (client.monthlyUsage ?? 0) + res.cost })
      }

      queryClient.invalidateQueries({ queryKey: conversationsKey })
    },

    onError: (_err, _payload, context) => {
      // Roll back the optimistic message.
      if (context?.conversationId && context.tempId) {
        const key = messagesKey(context.conversationId)
        queryClient.setQueryData<Message[]>(key, (old) =>
          (old ?? []).filter((m) => m.id !== context.tempId),
        )
      }
    },
  })
}
