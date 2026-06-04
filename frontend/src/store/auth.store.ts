import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Client {
  id: string
  name: string
  documentId: string
  documentType: string
  planType: string
}

interface AuthState {
  token: string | null
  client: Client | null
  setAuth: (token: string, client: Client) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      client: null,
      setAuth: (token, client) => set({ token, client }),
      logout: () => set({ token: null, client: null }),
    }),
    { name: 'bcb-auth' },
  ),
)
