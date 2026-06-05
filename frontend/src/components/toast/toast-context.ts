import { createContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
}

export interface ToastContextValue {
  show: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
