'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '../../components/app-shell'
import { createClient } from '../../supabase-client'

export default function ConfiguracoesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [role, setRole] = useState('corretor')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      setEmail(user.email ?? '')

      const { data: p } = await supabase
        .from('profiles')
        .select('nome,role')
        .eq('id', user.id)
        .maybeSingle()

      setName(p?.nome ?? '')
      setRole(p?.role ?? 'corretor')
    })()
  }, [router, supabase])

  async function save() {
    setSaving(true)
    setMessage('')
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ nome: name.trim() })
      .eq('id', user.id)

    if (error) setError(error.message)
    else setMessage('Perfil atualizado.')

    setSaving(false)
  }

  return (
    <AppShell role={role} email={email}>
      <div className="page">
        <div className="eyebrow">Preferências</div>
        <h1>Configurações</h1>
        <p className="sub">Dados do usuário e preferências básicas do CRM.</p>

        {message && <div className="form-success">{message}</div>}
        {error && <div className="form-error">{error}</div>}

        <section className="card">
          <h2 className="section-title">Meu perfil</h2>
          <div className="lead-form">
            <label>
              Nome
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              E-mail
              <input value={email} disabled />
            </label>
            <label>
              Função
              <input value={role} disabled />
            </label>
            <button
              className="btn primary"
              disabled={saving}
              onClick={save}
            >
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Notificações</h2>
          <p className="sub">
            Follow-ups vencidos serão destacados assim que você abrir o CRM.
            Quando o navegador permitir notificações, o sistema também poderá
            alertar no momento do vencimento enquanto o CRM estiver aberto.
          </p>
        </section>
      </div>
    </AppShell>
  )
}
