'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../supabase-client'

type Lead = { id: string; nome: string; telefone: string | null; origem: string | null; status: string; responsavel_id: string | null }
type Profile = { id: string; nome: string }
const stages = [['novo','Novo'],['em_atendimento','Em atendimento'],['visita','Visita'],['proposta','Proposta'],['ganho','Ganho'],['perdido','Perdido']] as const

export default function DashboardMiniKanban() {
  const supabase = useMemo(() => createClient(), [])
  const [leads, setLeads] = useState<Lead[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [dragged, setDragged] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: people } = await supabase.from('profiles').select('id,nome').order('nome')
    const { data } = await supabase.from('leads').select('id,nome,telefone,origem,status,responsavel_id').is('deleted_at', null).order('created_at', { ascending: false }).limit(500)
    setProfiles((people ?? []) as Profile[])
    setLeads((data ?? []) as Lead[])
  }
  useEffect(() => { load() }, [])

  async function move(id: string, status: string) {
    const lead = leads.find(l => l.id === id)
    if (!lead || lead.status === status) return
    setSaving(true)
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('activities').insert({ lead_id: id, user_id: user.id, tipo: 'status_alterado', descricao: `Status alterado de ${lead.status} para ${status}.` })
      setLeads(xs => xs.map(x => x.id === id ? { ...x, status } : x))
    }
    setDragged(null); setSaving(false)
  }
  const person = (id: string | null) => profiles.find(p => p.id === id)?.nome ?? 'Sem responsável'

  return <section className="card dashboard-mini-kanban">
    <div className="toolbar"><div><h2 className="section-title">Pipeline de leads</h2><div className="sub">Arraste os próprios leads entre as etapas. A alteração já é salva no CRM.</div></div><a className="btn" href="/kanban">Kanban completo</a></div>
    <div className="mini-kanban-board">
      {stages.map(([id, label]) => {
        const items = leads.filter(l => l.status === id)
        return <section className="mini-kanban-column" key={id} onDragOver={e => e.preventDefault()} onDrop={() => dragged && move(dragged, id)}>
          <div className="mini-kanban-header"><strong>{label}</strong><span>{items.length}</span></div>
          <div className="mini-kanban-cards">
            {items.slice(0, 8).map(lead => <article className="mini-kanban-card" key={lead.id} draggable={!saving} onDragStart={() => setDragged(lead.id)} onDragEnd={() => setDragged(null)}>
              <strong>{lead.nome}</strong>
              <span>{lead.telefone ?? 'Sem telefone'}</span>
              <small>{person(lead.responsavel_id)}{lead.origem ? ` · ${lead.origem}` : ''}</small>
            </article>)}
            {items.length > 8 && <small className="mini-more">+ {items.length - 8} outros leads</small>}
            {!items.length && <div className="mini-empty">Nenhum lead</div>}
          </div>
        </section>
      })}
    </div>
  </section>
}
