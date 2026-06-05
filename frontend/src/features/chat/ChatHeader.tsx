import { formatCurrency } from '../../lib/format'
import type { Client } from '../../lib/types'

interface ChatHeaderProps {
  client: Client
  onAddCredit: () => void
  onLogout: () => void
}

export function ChatHeader({ client, onAddCredit, onLogout }: ChatHeaderProps) {
  const isPrepaid = client.planType === 'prepaid'

  return (
    <header className="app-header">
      <div className="app-header-id">
        <span className="app-brand">BCB</span>
        <span className="app-client-name">{client.name}</span>
      </div>

      <div className="app-header-billing">
        <span className="plan-tag">{isPrepaid ? 'Pré-pago' : 'Pós-pago'}</span>
        {isPrepaid ? (
          <span className="balance">
            Saldo <strong>{formatCurrency(client.balance)}</strong>
          </span>
        ) : (
          <span className="balance">
            Uso{' '}
            <strong>
              {formatCurrency(client.monthlyUsage)} /{' '}
              {formatCurrency(client.limit)}
            </strong>
          </span>
        )}
        <button type="button" className="btn-ghost" onClick={onAddCredit}>
          {isPrepaid ? '+ Crédito' : '+ Limite'}
        </button>
        <button type="button" className="btn-ghost" onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  )
}
