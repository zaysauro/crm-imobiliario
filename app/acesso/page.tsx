'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../supabase-client'

export default function AcessoPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace('/')
        return
      }

      const { error: signInError } = await supabase.auth.signInAnonymously()
      if (signInError) {
        setError(signInError.message)
        return
      }

      router.replace('/')
      router.refresh()
    })()
  }, [router])

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand login-brand">CRM <span>Cadena</span></div>
        <div className="eyebrow">Acesso rápido</div>
        <h1>Abrindo o CRM...</h1>
        <p className="sub">Preparando uma sessão temporária para acessar o sistema sem formulário de login.</p>
        {error && (
          <div className="form-error">
            Não foi possível criar a sessão automática. No Supabase, habilite <strong>Anonymous Sign-Ins</strong> em Authentication → Providers → Anonymous.
            <br /><br />Detalhe: {error}
          </div>
        )}
      </section>
    </main>
  )
}
