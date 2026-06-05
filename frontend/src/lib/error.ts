import { AxiosError } from 'axios'

interface ApiErrorBody {
  statusCode?: number
  error?: string
  message?: string | string[]
}

export function apiErrorMessage(
  err: unknown,
  fallback = 'Algo deu errado',
): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as ApiErrorBody | undefined
    const msg = body?.message
    if (Array.isArray(msg)) return msg[0] ?? fallback
    if (typeof msg === 'string') return msg
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
