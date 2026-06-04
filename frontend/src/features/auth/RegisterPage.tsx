import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api } from '../../lib/api'

const schema = z
  .object({
    name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    documentType: z.enum(['CPF', 'CNPJ']),
    documentId: z.string(),
    planType: z.enum(['prepaid', 'postpaid']),
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

export function RegisterPage() {
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentType: 'CNPJ',
      documentId: '',
      planType: 'prepaid',
    },
  })

  const documentType = watch('documentType')

  async function onSubmit(data: FormData) {
    try {
      await api.post('/clients', data)
      navigate('/', { state: { registered: true } })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Falha ao cadastrar'
      throw new Error(typeof msg === 'string' ? msg : 'Falha ao cadastrar')
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

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <div className="field">
            <label htmlFor="name">Nome da empresa</label>
            <input
              id="name"
              type="text"
              placeholder="Empresa Exemplo Ltda"
              {...register('name')}
            />
            {errors.name && (
              <span className="field-error">{errors.name.message}</span>
            )}
          </div>

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
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
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

          <div className="field">
            <label htmlFor="planType">Plano</label>
            <select id="planType" {...register('planType')}>
              <option value="prepaid">Pré-pago</option>
              <option value="postpaid">Pós-pago</option>
            </select>
          </div>

          {errors.root && <p className="auth-error">{errors.root.message}</p>}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Cadastrando…' : 'Criar conta'}
          </button>
        </form>

        <p className="auth-footer">
          Já tem conta? <Link to="/">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
