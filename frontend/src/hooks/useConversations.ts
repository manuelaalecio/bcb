import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Conversation } from '../lib/types'

export const conversationsKey = ['conversations'] as const

export function useConversations() {
  return useQuery({
    queryKey: conversationsKey,
    queryFn: async () => {
      const { data } = await api.get<Conversation[]>('/conversations')
      return data
    },
  })
}
