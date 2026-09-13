'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../supabase-client'

type Lead = { id: string; nome: string; telefone: string | null }
type Followup = { id: string; lead_id: string; assigned_to: string; title: string; notes: string | null; due_at: string; status: 'pendente' | 'concluido' | 'cancelado'; created_at: string }

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function FollowupsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [followups, setFollowups] = useState<Followup[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ lead_id: '', title: '', notes: '', due_at: '' })

  const leadName = (id: string) => leads.find((lead) => lead.id === id)?.nome ?? 'Lead'

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    setUserId(user.id)
    const [{ data: followupData, error: followupError }, { data: leadData }] = await Promise.all([
      supabase.from('lead_followups').select('id, lead_id, assigned_to, title, notes, due_at, status, created_at').eq('assigned_to', user.id).order('due_at', { ascending: true }),
      supabase.from('leads').select('id, nome, telefone').is('deleted_at', null).order('nome').limit(1000),
    ])
    if (followupError) setError('Não foi possível carregar os follow-ups. Verifique as permissões do banco.')
    setFollowups((followupData ?? []) as Followup[])
    setLeads((leadData ?? []) as Lead[])
  }

  useEffect(() => { load() }, [])

  function openNew() {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    tomorrow.setMinutes(0, 0, 0)
    const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setForm({ lead_id: leads[0]?.id ?? '', title: 'Retornar contato', notes: '', due_at: local })
    setError('')
    setShowForm(true)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!userId || !form.lead_id || !form.title.trim() || !form.due_at) return
    setSaving(true); setError('')
    const { error } = await supabase.from('lead_followups').insert({ lead_id: form.lead_id, assigned_to: userId, created_by: userId, title: form.title.trim(), notes: form.notes.trim() || null, due_at: new Date(form.due_at).toISOString() })
    if (error) setError(error.message)
    else { setShowForm(false); await load() }
    setSaving(false)
  }

  async function changeStatus(id: string, status: 'concluido' | 'cancelado' | 'pendente') {
    setSaving(true); setError('')
    const payload = status === 'concluido' ? { status, completed_at: new Date().toISOString(), completed_by: userId } : { status, completed_at: null, completed_by: null }
    const { error } = await supabase.from('lead_followups').update(payload).eq('id', id)
    if (error) setError(error.message); else await load()
    setSaving(false)
  }

  const pending = followups.filter((item) => item.status === 'pendente')
  const overdue = pending.filter((item) => new Date(item.due_at).getTime() < Date.now())
  const completed = followups.filter((item) => item.status === 'concluido')

  return <div className="shell">
    <aside className="sidebar"><div className="brand">CRM <span>Cadena</span></div><nav className="nav"><a href="/">Dashboard</a><a href="/#leads">Leads</a><a className="active" href="/followups">Follow-ups</a><a href="/kanban">Kanban</a><a href="#">Atendimentos</a><a href="#">Imóveis</a><a href="#">Visitas</a><a href="#">Propostas</a><a href="#">Relatórios</a><a href="#">Configurações</a></nav></aside>
    <main className="main"><header className="topbar"><strong>CRM Cadena</strong><button className="btn" onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}>Sair</button></header>
      <div className="page"><div className="eyebrow">Agenda comercial</div><h1>Follow-ups</h1><p className="sub">Organize os próximos contatos e evite deixar leads sem retorno.</p>
        <section className="grid"><div className="card"><div className="metric-label">Pendentes</div><div className="metric">{pending.length}</div></div><div className="card"><div className="metric-label">Atrasados</div><div className="metric">{overdue.length}</div></div><div className="card"><div className="metric-label">Concluídos</div><div className="metric">{completed.length}</div></div></section>
        <section className="card"><div className="toolbar"><div><h2 className="section-title">Minha agenda</h2><div className="sub">Follow-ups atribuídos a você</div></div><button className="btn primary" onClick={openNew}>+ Novo follow-up</button></div>{error && <div className="form-error">{error}</div>}
          {followups.length === 0 ? <div className="empty">Nenhum follow-up cadastrado.</div> : <div className="followup-list">{followups.map((item) => <article className={`followup-item ${item.status}`} key={item.id}><div><div className="eyebrow">{item.status === 'pendente' && new Date(item.due_at) < new Date() ? 'ATRASADO' : item.status.toUpperCase()}</div><h3>{item.title}</h3><strong>{leadName(item.lead_id)}</strong><div className="sub">{formatDate(item.due_at)}</div>{item.notes && <p>{item.notes}</p>}</div><div className="actions">{item.status === 'pendente' ? <><button className="btn" disabled={saving} onClick={() => changeStatus(item.id, 'concluido')}>Concluir</button><button className="btn" disabled={saving} onClick={() => changeStatus(item.id, 'cancelado')}>Cancelar</button></> : item.status === 'concluido' ? <button className="btn" disabled={saving} onClick={() => changeStatus(item.id, 'pendente')}>Reabrir</button> : null}</div></article>)}</div>}
        </section>
      </div>
    </main>
    {showForm && <div className="modal-backdrop" onMouseDown={() => !saving && setShowForm(false)}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-header"><div><div className="eyebrow">Agenda</div><h2>Novo follow-up</h2></div><button className="icon-btn" onClick={() => setShowForm(false)}>×</button></div><form className="lead-form" onSubmit={save}><label>Lead *<select value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })}>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.nome}</option>)}</select></label><label>Título *<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>Data e hora *<input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></label><label>Observações<textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex.: confirmar documentação, retornar sobre proposta..." /></label><div className="modal-actions"><button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn primary" disabled={saving}>{saving ? 'Salvando...' : 'Criar follow-up'}</button></div></form></div></div>}
  </div>
}
