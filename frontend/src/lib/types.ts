export type DocumentType = 'CPF' | 'CNPJ'
export type PlanType = 'prepaid' | 'postpaid'
export type Priority = 'normal' | 'urgent'
export type SenderType = 'client' | 'user'

export type MessageStatus =
  | 'queued'
  | 'processing'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'

export interface Client {
  id: string
  name: string
  documentId: string
  documentType: DocumentType
  planType: PlanType
  active?: boolean
  /** prepaid: available balance */
  balance?: number
  /** postpaid: monthly limit */
  limit?: number
  /** postpaid: current month usage */
  monthlyUsage?: number
}

export interface AuthResponse {
  token: string
  client: Client
}

export interface Conversation {
  id: string
  recipientId: string
  recipientName: string
  lastMessageContent: string | null
  lastMessageTime: string | null
  unreadCount: number
}

export interface Message {
  id: string
  conversationId: string
  content: string
  sentBy: {
    id: string
    type: SenderType
  }
  timestamp: string
  priority: Priority
  status: MessageStatus
  cost: number
}

export interface SendMessagePayload {
  conversationId?: string
  recipientId?: string
  recipientName?: string
  content: string
  priority: Priority
}

export interface SendMessageResponse {
  id: string
  status: 'queued'
  timestamp: string
  estimatedDelivery: string
  cost: number
  /** prepaid only */
  currentBalance?: number
}

/** server → client */
export interface MessageStatusEvent {
  messageId: string
  conversationId: string
  status: MessageStatus
}

/** bidirectional */
export interface TypingEvent {
  conversationId: string
  isTyping: boolean
}

/** server → client */
export interface PresenceEvent {
  recipientId: string
  online: boolean
}

export const MESSAGE_COST: Record<Priority, number> = {
  normal: 0.25,
  urgent: 0.5,
}
