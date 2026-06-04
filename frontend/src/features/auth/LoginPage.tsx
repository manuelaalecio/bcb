import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'

type DocumentType = 'CPF' | 'CNPJ'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [documentType, setDocumentType] = useState<DocumentType>('CPF')
  const [documentId, setDocumentId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth', { documentId, documentType })
      setAuth(data.token, data.client)
      navigate('/chat')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Falha ao autenticar'
      setError(typeof msg === 'string' ? msg : 'Falha ao autenticar')
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

        <h2>Entrar</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="documentType">Tipo de documento</label>
            <select
              id="documentType"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            >
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
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

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="auth-footer">
          Não tem conta?{' '}
          <Link to="/register">Cadastre-se</Link>
        </p>
      </div>
    </div>
  )
}
