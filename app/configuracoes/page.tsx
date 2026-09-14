'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '../../components/app-shell'
import { createClient } from '../../supabase-client'

type SlaSettings = {
  initial_contact_grace_minutes: number
  max_inactivity_days: number
  max_followup_days: number
  enabled: boolean
}

export default function ConfiguracoesPage() {
  const router = useRouter()
  const [role, setRole] = useState('corretor')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [slaSaving, setSlaSaving] = useState(false)
  const [sla, setSla] = useState<SlaSettings>({ initial_contact_grace_minutes: 60, max_inactivity_days: 3, max_followup_days: 3, enabled: true })

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setEmail(user.email ?? '')
      const { data: p } = await supabase.from('profiles').select('nome,role').eq('id', user.id).maybeSingle()
      setName(p?.nome ?? '')
      setRole(p?.role ?? 'corretor')
      if (p?.role === 'admin' || p?.role === 'gerente') {
        const { data: settings } = await supabase.from('lead_sla_settings').select('initial_contact_grace_minutes,max_inactivity_days,max_followup_days,enabled').eq('id', true).maybeSingle()
        if (settings) setSla(settings as SlaSettings)
      }
    })()
  }, [router])

  async function save() {
    setSaving(true); setMessage(''); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error } = await supabase.from('profiles').update({ nome: name.trim() }).eq('id', user.id)
    if (error) setError(error.message); else setMessage('Perfil atualizado.')
    setSaving(false)
  }

  async function saveSla() {
    setSlaSaving(true); setMessage(''); setError('')
    const supabase = createClient()
    const payload = { id: true, initial_contact_grace_minutes: Math.max(0, Math.round(Number(sla.initial_contact_grace_minutes))), max_inactivity_days: Math.max(0.01, Number(sla.max_inactivity_days)), max_followup_days: Math.max(0.01, Number(sla.max_followup_days)), enabled: sla.enabled }
    const { error } = await supabase.from('lead_sla_settings').upsert(payload)
    if (error) setError(error.message); else setMessage('Regras de SLA atualizadas. Os novos prazos passam a valer para a próxima verificação automática.')
    setSlaSaving(false)
  }

  const canManage = role === 'admin' || role === 'gerente'

  return <AppShell role={role} email={email}><div className="page"><div className="eyebrow">Preferências</div><h1>Configurações</h1><p className="sub">Dados do usuário e regras operacionais do CRM.</p>{message && <div className="form-success">{message}</div>}{error && <div className="form-error">{error}</div>}
    <section className="card"><h2 className="section-title">Meu perfil</h2><div className="lead-form"><label>Nome<input value={name} onChange={e => setName(e.target.value)} /></label><label>E-mail<input value={email} disabled /></label><label>Função<input value={role} disabled /></label><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Salvar perfil'}</button></div></section>
    {canManage && <section className="card"><div className="eyebrow">Gestão comercial</div><h2 className="section-title">Validade e SLA dos leads</h2><p className="sub">Essas regras evitam que leads quentes fiquem parados na carteira. A verificação automática roda a cada minuto.</p><div className="lead-form"><label className="check-row"><input type="checkbox" checked={sla.enabled} onChange={e => setSla({ ...sla, enabled: e.target.checked })} /> Ativar rotação automática por SLA</label><label>Carência para o primeiro contato (minutos)<input type="number" min="0" step="1" value={sla.initial_contact_grace_minutes} onChange={e => setSla({ ...sla, initial_contact_grace_minutes: Number(e.target.value) })} /><small className="sub">Ex.: 60 = o corretor tem 1 hora para registrar uma ligação, WhatsApp ou visita.</small></label><label>Máximo sem novo atendimento (dias)<input type="number" min="0.01" step="0.5" value={sla.max_inactivity_days} onChange={e => setSla({ ...sla, max_inactivity_days: Number(e.target.value) })} /><small className="sub">Depois do primeiro contato, esse prazo reinicia a cada novo contato real.</small></label><label>Máximo para um follow-up (dias)<input type="number" min="0.01" step="0.5" value={sla.max_followup_days} onChange={e => setSla({ ...sla, max_followup_days: Number(e.target.value) })} /><small className="sub">Corretores não poderão criar follow-ups além deste prazo. Gerente/admin podem excepcionalmente criar um prazo maior.</small></label><button className="btn primary" disabled={slaSaving} onClick={saveSla}>{slaSaving ? 'Salvando...' : 'Salvar regras de SLA'}</button></div><div className="card" style={{ marginTop: 16 }}><strong>Como funciona</strong><ul><li>Lead novo atribuído → começa a contar a carência de primeiro contato.</li><li>Sem contato dentro do prazo → sai automaticamente da carteira e vai para o próximo corretor em ordem alfabética.</li><li>Após contato → o prazo de inatividade é reiniciado.</li><li>Leads ganhos ou perdidos não entram na rotação automática.</li></ul></div></section>}
    <section className="card"><h2 className="section-title">Notificações</h2><p className="sub">Follow-ups vencidos serão destacados assim que você abrir o CRM. A regra de SLA também é processada automaticamente em segundo plano.</p></section>
  </div></AppShell>
}
