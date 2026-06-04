import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'

const schema = z
  .object({
    documentType: z.enum(['CPF', 'CNPJ']),
    documentId: z.string(),
  })
  .superRefine(({ documentType, documentId }, ctx) => {
    const digits = documentId.replace(/\D/g, '')
    const expected = documentType === 'CPF' ? 11 : 14
    if (digits.length !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentId'],
        message: `${documentType} deve ter ${expected} dígitos`,
      })
    }
  })

type FormData = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { documentType: 'CPF', documentId: '' },
  })

  const documentType = watch('documentType')

  async function onSubmit(data: FormData) {
    try {
      const { data: res } = await api.post('/auth', data)
      setAuth(res.token, res.client)
      navigate('/chat')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Falha ao autenticar'
      throw new Error(typeof msg === 'string' ? msg : 'Falha ao autenticar')
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

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <div className="field">
            <label htmlFor="documentType">Tipo de documento</label>
            <select
              id="documentType"
              {...register('documentType')}
              onChange={(e) => {
                setValue('documentType', e.target.value as 'CPF' | 'CNPJ')
                setValue('documentId', '')
              }}
            >
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="documentId">
              {documentType === 'CPF'
                ? 'CPF (somente números)'
                : 'CNPJ (somente números)'}
            </label>
            <input
              id="documentId"
              type="text"
              placeholder={
                documentType === 'CPF' ? '00000000000' : '00000000000000'
              }
              maxLength={documentType === 'CPF' ? 11 : 14}
              {...register('documentId', {
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\D/g, '')
                },
              })}
            />
            {errors.documentId && (
              <span className="field-error">{errors.documentId.message}</span>
            )}
          </div>

          {errors.root && <p className="auth-error">{errors.root.message}</p>}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="auth-footer">
          Não tem conta? <Link to="/register">Cadastre-se</Link>
        </p>
      </div>
    </div>
  )
}
