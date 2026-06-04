import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

type DocumentType = 'CPF' | 'CNPJ'
type PlanType = 'prepaid' | 'postpaid'

export function RegisterPage() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('CNPJ')
  const [documentId, setDocumentId] = useState('')
  const [planType, setPlanType] = useState<PlanType>('prepaid')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/clients', { name, documentId, documentType, planType })
      navigate('/', { state: { registered: true } })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Falha ao cadastrar'
      setError(typeof msg === 'string' ? msg : 'Falha ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>BCB</h1>
          <p>Big Chat Brasil</p>
        </div>

        <h2>Criar conta</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="name">Nome da empresa</label>
            <input
              id="name"
              type="text"
              placeholder="Empresa Exemplo Ltda"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="documentType">Tipo de documento</label>
            <select
              id="documentType"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            >
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="documentId">
              {documentType === 'CPF' ? 'CPF (somente números)' : 'CNPJ (somente números)'}
            </label>
            <input
              id="documentId"
              type="text"
              placeholder={documentType === 'CPF' ? '00000000000' : '00000000000000'}
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value.replace(/\D/g, ''))}
              maxLength={documentType === 'CPF' ? 11 : 14}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="planType">Plano</label>
            <select
              id="planType"
              value={planType}
              onChange={(e) => setPlanType(e.target.value as PlanType)}
            >
              <option value="prepaid">Pré-pago</option>
              <option value="postpaid">Pós-pago</option>
            </select>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Cadastrando…' : 'Criar conta'}
          </button>
        </form>

        <p className="auth-footer">
          Já tem conta?{' '}
          <Link to="/">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
