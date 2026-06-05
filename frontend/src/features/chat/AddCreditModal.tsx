import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/toast/useToast'
import { api } from '../../lib/api'
import { apiErrorMessage } from '../../lib/error'
import type { Client } from '../../lib/types'
import { useAuthStore } from '../../store/auth.store'

const schema = z.object({
  amount: z
    .number({ message: 'Informe um valor válido' })
    .positive('Informe um valor maior que zero'),
})

type FormData = z.infer<typeof schema>

interface CreditResponse {
  balance: number
  monthlyLimit: number
  monthlyUsage: number
}

export function AddCreditModal({
  client,
  onClose,
}: {
  client: Client
  onClose: () => void
}) {
  const updateClient = useAuthStore((s) => s.updateClient)
  const { show } = useToast()
  const isPrepaid = client.planType === 'prepaid'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    try {
      const { data: res } = await api.patch<CreditResponse>(
        `/clients/${client.id}/credit`,
        { amount: data.amount },
      )
      updateClient({
        balance: res.balance,
        limit: res.monthlyLimit,
        monthlyUsage: res.monthlyUsage,
      })
      show(isPrepaid ? 'Crédito adicionado!' : 'Limite atualizado!', 'success')
      onClose()
    } catch (err) {
      show(apiErrorMessage(err), 'error')
    }
  }

  return (
    <Modal
      title={isPrepaid ? 'Adicionar crédito' : 'Aumentar limite'}
      onClose={onClose}
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="field">
          <label htmlFor="amount">Valor (R$)</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="50.00"
            {...register('amount', { valueAsNumber: true })}
          />
          {errors.amount && (
            <span className="field-error">{errors.amount.message}</span>
          )}
        </div>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}
