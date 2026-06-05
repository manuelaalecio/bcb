import { io, type Socket } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const socket: Socket = io(`${API_URL}/chat`, {
  autoConnect: false,
  transports: ['websocket'],
})

export function connectSocket(): void {
  if (!socket.connected) socket.connect()
}

export function disconnectSocket(): void {
  if (socket.connected) socket.disconnect()
}
