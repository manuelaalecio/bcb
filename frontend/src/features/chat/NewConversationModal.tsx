import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/toast/useToast'
import { conversationsKey } from '../../hooks/useConversations'
import { useSendMessage } from '../../hooks/useSendMessage'
import { apiErrorMessage } from '../../lib/error'
import { formatCurrency } from '../../lib/format'
import { MESSAGE_COST, type Conversation, type Priority } from '../../lib/types'

const schema = z.object({
  recipientId: z.string().min(1, 'Informe o ID do destinatário'),
  recipientName: z.string().min(1, 'Informe o nome do destinatário'),
  content: z.string().min(1, 'Digite a primeira mensagem'),
  priority: z.enum(['normal', 'urgent']),
})

type FormData = z.infer<typeof schema>

export function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (conversationId: string) => void
}) {
  const sendMessage = useSendMessage()
  const queryClient = useQueryClient()
  const { show } = useToast()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'normal' },
  })

  const priority = watch('priority') as Priority

  async function onSubmit(data: FormData) {
    try {
      await sendMessage.mutateAsync({
        recipientId: data.recipientId,
        recipientName: data.recipientName,
        content: data.content,
        priority: data.priority,
      })
      const conversations = await queryClient.fetchQuery<Conversation[]>({
        queryKey: conversationsKey,
      })
      const created = conversations.find(
        (c) => c.recipientId === data.recipientId,
      )
      show('Conversa iniciada!', 'success')
      onClose()
      if (created) onCreated(created.id)
    } catch (err) {
      show(apiErrorMessage(err), 'error')
    }
  }

  return (
    <Modal title="Nova conversa" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="field">
          <label htmlFor="recipientName">Nome do destinatário</label>
          <input
            id="recipientName"
            type="text"
            {...register('recipientName')}
          />
          {errors.recipientName && (
            <span className="field-error">{errors.recipientName.message}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="recipientId">ID do destinatário</label>
          <input id="recipientId" type="text" {...register('recipientId')} />
          {errors.recipientId && (
            <span className="field-error">{errors.recipientId.message}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="content">Mensagem</label>
          <textarea id="content" rows={3} {...register('content')} />
          {errors.content && (
            <span className="field-error">{errors.content.message}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="priority">Prioridade</label>
          <select id="priority" {...register('priority')}>
            <option value="normal">
              Normal — {formatCurrency(MESSAGE_COST.normal)}
            </option>
            <option value="urgent">
              Urgente — {formatCurrency(MESSAGE_COST.urgent)}
            </option>
          </select>
        </div>

        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting
            ? 'Enviando…'
            : `Enviar (${formatCurrency(MESSAGE_COST[priority])})`}
        </button>
      </form>
    </Modal>
  )
}
