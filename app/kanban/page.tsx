'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../supabase-client'

type Lead = { id: string; nome: string; telefone: string | null; origem: string | null; status: string; responsavel_id: string | null }
type Profile = { id: string; nome: string; role: string }

const columns = [
  { id: 'novo', label: 'Novo' },
  { id: 'em_atendimento', label: 'Em atendimento' },
  { id: 'visita', label: 'Visita' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'ganho', label: 'Ganho' },
  { id: 'perdido', label: 'Perdido' },
]

export default function KanbanPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [leads, setLeads] = useState<Lead[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [role, setRole] = useState('corretor')
  const [dragged, setDragged] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    setRole(profile?.role ?? 'corretor')
    const { data: people } = await supabase.from('profiles').select('id, nome, role').order('nome')
    setProfiles((people ?? []) as Profile[])
    const { data, error } = await supabase.from('leads').select('id, nome, telefone, origem, status, responsavel_id').order('created_at', { ascending: false }).limit(500)
    if (error) setError(error.message); else setLeads((data ?? []) as Lead[])
  }
  useEffect(() => { load() }, [])

  async function moveLead(id: string, status: string) {
    const lead = leads.find((item) => item.id === id)
    if (!lead || lead.status === status) return
    setSaving(true); setError('')
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (error) setError(error.message)
    else {
      await supabase.from('activities').insert({ lead_id: id, user_id: (await supabase.auth.getUser()).data.user?.id, tipo: 'status_alterado', descricao: `Status alterado de ${lead.status} para ${status}.` })
      setLeads((items) => items.map((item) => item.id === id ? { ...item, status } : item))
    }
    setDragged(null); setSaving(false)
  }

  const personName = (id: string | null) => profiles.find((p) => p.id === id)?.nome ?? 'Sem responsável'
  const canManage = role === 'admin' || role === 'gerente'

  return <div className="shell"><aside className="sidebar"><div className="brand">CRM <span>Cadena</span></div><nav className="nav"><a href="/">Dashboard</a><a href="/#leads">Leads</a><a href="/followups">Follow-ups</a><a className="active" href="/kanban">Kanban</a><a href="#">Atendimentos</a><a href="#">Imóveis</a><a href="#">Visitas</a><a href="#">Propostas</a><a href="#">Relatórios</a><a href="#">Configurações</a></nav></aside><main className="main"><header className="topbar"><strong>CRM Cadena</strong><button className="btn" onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}>Sair</button></header><div className="page"><div className="eyebrow">Funil comercial</div><h1>Kanban</h1><p className="sub">Arraste os leads entre as etapas do funil para atualizar o atendimento.</p>{error && <div className="form-error">{error}</div>}<div className="kanban-board">{columns.map((column) => { const items = leads.filter((lead) => lead.status === column.id); return <section className="kanban-column" key={column.id} onDragOver={(e) => e.preventDefault()} onDrop={() => dragged && moveLead(dragged, column.id)}><div className="kanban-header"><h2>{column.label}</h2><span>{items.length}</span></div><div className="kanban-cards">{items.map((lead) => <article className="kanban-card" key={lead.id} draggable={!saving} onDragStart={() => setDragged(lead.id)} onDragEnd={() => setDragged(null)}><div className="eyebrow">{lead.origem ?? 'Origem não informada'}</div><h3>{lead.nome}</h3><div className="sub">{lead.telefone ?? 'Sem telefone'}</div><div className="kanban-footer"><span>{personName(lead.responsavel_id)}</span><a href={`/#lead-${lead.id}`} onClick={() => router.push('/#leads')}>Ver lead</a></div></article>)}</div></section>})}</div>{canManage && <div className="sub" style={{ marginTop: 16 }}>Gestores podem acompanhar e reorganizar o funil. A alteração de status fica registrada no histórico do lead.</div>}</div></main></div>
}
