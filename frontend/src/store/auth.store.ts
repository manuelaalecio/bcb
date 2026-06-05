import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Client } from '../lib/types'

interface AuthState {
  token: string | null
  client: Client | null
  setAuth: (token: string, client: Client) => void
  updateClient: (partial: Partial<Client>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      client: null,
      setAuth: (token, client) => set({ token, client }),
      updateClient: (partial) =>
        set((state) =>
          state.client ? { client: { ...state.client, ...partial } } : state,
        ),
      logout: () => set({ token: null, client: null }),
    }),
    { name: 'bcb-auth' },
  ),
)
