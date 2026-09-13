'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../supabase-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand login-brand">CRM <span>T3</span></div>
        <div className="eyebrow">Acesso restrito</div>
        <h1>Entrar no CRM</h1>
        <p className="sub">Use seu e-mail e senha para acessar seus atendimentos.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email" />
          </label>
          <label>
            Senha
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" required autoComplete="current-password" />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="btn primary login-button" disabled={loading} type="submit">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
