'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../supabase-client'

type Lead = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  origem: string | null
  status: string
  observacoes: string | null
  responsavel_id: string | null
  created_at: string
}

type Profile = { id: string; nome: string; email: string; role: string }

type Activity = { id: string; tipo: string; descricao: string; created_at: string; user_id: string }

const statusLabel: Record<string, string> = {
  novo: 'Novo', em_atendimento: 'Em atendimento', visita: 'Visita', proposta: 'Proposta', ganho: 'Ganho', perdido: 'Perdido',
}
const activityLabel: Record<string, string> = { ligacao: 'Ligação', whatsapp: 'WhatsApp', observacao: 'Observação', visita: 'Visita', status_alterado: 'Status alterado' }

function statusTone(status: string) {
  if (status === 'ganho' || status === 'visita') return 'green'
  if (status === 'perdido') return 'red'
  if (status === 'em_atendimento' || status === 'proposta') return 'amber'
  return 'blue'
}
function whatsapp(phone: string | null) {
  if (!phone) return '#'
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`
}

export default function Home() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [leads, setLeads] = useState<Lead[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('corretor')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', origem: '', status: 'novo', observacoes: '' })
  const [activityType, setActivityType] = useState('observacao')
  const [activityText, setActivityText] = useState('')
  const [activities, setActivities] = useState<Activity[]>([])
  const [transferTo, setTransferTo] = useState('')
  const [transferReason, setTransferReason] = useState('')

  async function loadLeads() {
    const { data, error } = await supabase.from('leads').select('id, nome, telefone, email, origem, status, observacoes, responsavel_id, created_at').order('created_at', { ascending: false }).limit(200)
    if (error) setError('Não foi possível carregar os leads.')
    else setLeads(data ?? [])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setEmail(user.email ?? '')
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setRole(profile?.role ?? 'corretor')
      const { data: people } = await supabase.from('profiles').select('id, nome, email, role').order('nome')
      setProfiles((people ?? []) as Profile[])
      await loadLeads()
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); router.refresh() }

  async function openLead(lead: Lead) {
    setSelected(lead); setActivityText(''); setError('')
    const { data } = await supabase.from('activities').select('id, tipo, descricao, created_at, user_id').eq('lead_id', lead.id).order('created_at', { ascending: false })
    setActivities((data ?? []) as Activity[])
  }

  function startNew() { setSelected(null); setForm({ nome: '', telefone: '', email: '', origem: '', status: 'novo', observacoes: '' }); setShowForm(true); setError('') }
  function startEdit() { if (!selected) return; setForm({ nome: selected.nome, telefone: selected.telefone ?? '', email: selected.email ?? '', origem: selected.origem ?? '', status: selected.status, observacoes: selected.observacoes ?? '' }); setShowForm(true) }

  async function saveLead(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (!form.nome.trim()) { setError('Informe o nome do lead.'); setSaving(false); return }
    if (selected) {
      const { error } = await supabase.from('leads').update({ nome: form.nome.trim(), telefone: form.telefone.trim() || null, email: form.email.trim() || null, origem: form.origem.trim() || null, status: form.status, observacoes: form.observacoes.trim() || null }).eq('id', selected.id)
      if (error) setError(error.message); else { setShowForm(false); await loadLeads(); const updated = (await supabase.from('leads').select('id, nome, telefone, email, origem, status, observacoes, responsavel_id, created_at').eq('id', selected.id).single()).data; if (updated) await openLead(updated as Lead) }
    } else {
      const { data, error } = await supabase.from('leads').insert({ nome: form.nome.trim(), telefone: form.telefone.trim() || null, email: form.email.trim() || null, origem: form.origem.trim() || null, status: form.status, observacoes: form.observacoes.trim() || null, criado_por: user.id, responsavel_id: user.id }).select('id, nome, telefone, email, origem, status, observacoes, responsavel_id, created_at').single()
      if (error) setError(error.message); else { setShowForm(false); await loadLeads(); if (data) await openLead(data as Lead) }
    }
    setSaving(false)
  }

  async function deleteLead() {
    if (!selected) return
    const reason = window.prompt('Motivo da exclusão:', 'Lead duplicado')
    if (!reason) return
    setSaving(true); setError('')
    const { error } = await supabase.rpc('soft_delete_lead', { p_lead_id: selected.id, p_reason: reason })
    if (error) setError(error.message); else { setSelected(null); await loadLeads() }
    setSaving(false)
  }

  async function transferLead() {
    if (!selected || !transferTo) return
    setSaving(true); setError('')
    const { error } = await supabase.rpc('transfer_lead', { p_lead_id: selected.id, p_to_user_id: transferTo, p_reason: transferReason || 'Transferência manual' })
    if (error) setError(error.message); else { setShowTransfer(false); setTransferReason(''); await loadLeads(); const updated = (await supabase.from('leads').select('id, nome, telefone, email, origem, status, observacoes, responsavel_id, created_at').eq('id', selected.id).single()).data; if (updated) setSelected(updated as Lead) }
    setSaving(false)
  }

  async function addActivity(event: FormEvent) {
    event.preventDefault(); if (!selected || !activityText.trim()) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('activities').insert({ lead_id: selected.id, user_id: user.id, tipo: activityType, descricao: activityText.trim() })
    if (error) setError(error.message); else { setActivityText(''); const { data } = await supabase.from('activities').select('id, tipo, descricao, created_at, user_id').eq('lead_id', selected.id).order('created_at', { ascending: false }); setActivities((data ?? []) as Activity[]) }
    setSaving(false)
  }

  const visible = leads.filter((lead) => { const term = search.toLowerCase().trim(); const matchesText = !term || lead.nome.toLowerCase().includes(term) || (lead.telefone ?? '').includes(term) || (lead.email ?? '').toLowerCase().includes(term); return (statusFilter === 'todos' || lead.status === statusFilter) && matchesText })
  const count = (status: string) => leads.filter((lead) => lead.status === status).length
  const canManage = role === 'admin' || role === 'gerente'
  const personName = (id: string | null) => profiles.find((p) => p.id === id)?.nome ?? 'Sem responsável'

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">CRM <span>Cadena</span></div>
        <nav className="nav">
          <a className="active" href="#">Dashboard</a><a href="#leads">Leads</a><a href="#">Atendimentos</a><a href="#">Imóveis</a><a href="#">Visitas</a><a href="#">Propostas</a><a href="#">Relatórios</a><a href="#">Configurações</a>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar"><strong>CRM Cadena</strong><div className="topbar-user"><span>{email} · {role}</span><button className="btn" onClick={logout}>Sair</button></div></header>
        <div className="page">
          <div className="eyebrow">Visão geral</div><h1>Dashboard</h1><p className="sub">Acompanhe seus leads e atendimentos em um só lugar.</p>
          <section className="grid"><div className="card"><div className="metric-label">Leads visíveis</div><div className="metric">{leads.length}</div></div><div className="card"><div className="metric-label">Novos</div><div className="metric">{count('novo')}</div></div><div className="card"><div className="metric-label">Visitas</div><div className="metric">{count('visita')}</div></div><div className="card"><div className="metric-label">Propostas</div><div className="metric">{count('proposta')}</div></div></section>
          <section className="card" id="leads">
            <div className="toolbar"><div><h2 className="section-title">Leads</h2><div className="sub">Base comercial da Cadena</div></div><button className="btn primary" onClick={startNew}>+ Novo lead</button></div>
            <div className="lead-filters"><input placeholder="Buscar por nome, telefone ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="todos">Todos os status</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            {error && <div className="form-error">{error}</div>}
            {loading ? <div className="empty">Carregando leads...</div> : visible.length === 0 ? <div className="empty">Nenhum lead encontrado.</div> : <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Origem</th><th>Responsável</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visible.map((lead) => <tr key={lead.id}><td><strong>{lead.nome}</strong></td><td>{lead.telefone ?? '—'}</td><td>{lead.origem ?? '—'}</td><td>{personName(lead.responsavel_id)}</td><td><span className={`status ${statusTone(lead.status)}`}>{statusLabel[lead.status] ?? lead.status}</span></td><td><div className="actions">{lead.telefone && <a className="btn whatsapp" href={whatsapp(lead.telefone)} target="_blank" rel="noreferrer">WhatsApp</a>}<button className="btn" onClick={() => openLead(lead)}>Ver</button></div></td></tr>)}</tbody></table></div>}
          </section>
        </div>
      </main>

      {(selected || showForm) && <div className="modal-backdrop" onMouseDown={() => !saving && (setSelected(null), setShowForm(false), setShowTransfer(false))}><div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        {showForm ? <><div className="modal-header"><div><div className="eyebrow">{selected ? 'Editar lead' : 'Novo lead'}</div><h2>{selected ? selected.nome : 'Cadastrar lead'}</h2></div><button className="icon-btn" onClick={() => setShowForm(false)}>×</button></div><form className="lead-form" onSubmit={saveLead}><label>Nome *<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus /></label><div className="form-grid"><label>Telefone<input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></label><label>E-mail<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Origem<input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} placeholder="Meta Ads, indicação..." /></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></div><label>Observações<textarea rows={5} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></label><div className="modal-actions"><button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar lead'}</button></div></form></> : <><div className="modal-header"><div><div className="eyebrow">Lead</div><h2>{selected?.nome}</h2><div className="sub">{selected?.telefone ?? 'Sem telefone'} · {selected?.email ?? 'Sem e-mail'}</div></div><button className="icon-btn" onClick={() => setSelected(null)}>×</button></div><div className="lead-detail"><div className="detail-row"><span>Status</span><span className={`status ${statusTone(selected?.status ?? 'novo')}`}>{statusLabel[selected?.status ?? 'novo']}</span></div><div className="detail-row"><span>Origem</span><strong>{selected?.origem ?? '—'}</strong></div><div className="detail-row"><span>Responsável</span><strong>{personName(selected?.responsavel_id ?? null)}</strong></div>{selected?.observacoes && <div className="detail-notes">{selected.observacoes}</div>}</div><div className="modal-actions"><button className="btn" onClick={startEdit}>Editar</button>{canManage && <><button className="btn" onClick={() => setShowTransfer(true)}>Transferir</button><button className="btn danger" onClick={deleteLead} disabled={saving}>Excluir</button></>}</div><hr /><h3>Histórico de atendimento</h3><form className="activity-form" onSubmit={addActivity}><select value={activityType} onChange={(e) => setActivityType(e.target.value)}>{Object.entries(activityLabel).filter(([v]) => v !== 'status_alterado').map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><textarea rows={3} placeholder="Descreva o atendimento..." value={activityText} onChange={(e) => setActivityText(e.target.value)} /><button className="btn primary" disabled={saving || !activityText.trim()}>{saving ? 'Salvando...' : 'Registrar atendimento'}</button></form><div className="timeline">{activities.length === 0 ? <div className="empty">Nenhum atendimento registrado.</div> : activities.map((a) => <div className="timeline-item" key={a.id}><div><strong>{activityLabel[a.tipo] ?? a.tipo}</strong><span>{new Date(a.created_at).toLocaleString('pt-BR')}</span></div><p>{a.descricao}</p></div>)}</div></>}
        {showTransfer && <div className="transfer-box"><h3>Transferir lead</h3><label>Novo responsável<select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}><option value="">Selecione um corretor</option>{profiles.filter((p) => p.role === 'corretor' && p.id !== selected?.responsavel_id).map((p) => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}</select></label><label>Motivo<input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Ex.: redistribuição de carteira" /></label><div className="modal-actions"><button className="btn" onClick={() => setShowTransfer(false)}>Cancelar</button><button className="btn primary" onClick={transferLead} disabled={saving || !transferTo}>{saving ? 'Transferindo...' : 'Confirmar transferência'}</button></div></div>}
      </div></div>}
    </div>
  )
}
