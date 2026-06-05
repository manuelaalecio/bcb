import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Message } from '../lib/types'

export const messagesKey = (conversationId: string) =>
  ['messages', conversationId] as const

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: messagesKey(conversationId ?? ''),
    enabled: !!conversationId,
    queryFn: async () => {
      const { data } = await api.get<Message[]>(
        `/conversations/${conversationId}/messages`,
      )
      return data
    },
  })
}
