'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '../../components/app-shell'
import { createClient } from '../../supabase-client'

type Lead = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  origem: string | null
  status: string
  observacoes: string | null
  responsavel_id: string | null
  criado_por: string | null
  created_at: string
  deleted_at: string | null
  deletion_reason: string | null
}
type Audit = {
  id: string
  lead_id: string
  actor_id: string | null
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}
type Profile = { id: string; nome: string; email: string; role: string }

const actionLabel: Record<string, string> = {
  criado: 'Lead criado',
  responsavel_alterado: 'Responsável alterado',
  status_alterado: 'Status alterado',
  campo_alterado: 'Campo alterado',
  excluido: 'Lead enviado para a lixeira',
  restaurado: 'Lead restaurado',
  exclusao_fisica: 'Exclusão física',
}
const statusLabel: Record<string, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  visita: 'Visita',
  proposta: 'Proposta',
  ganho: 'Ganho',
  perdido: 'Perdido',
}
const formatDate = (v: string) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function AuditoriaPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [role, setRole] = useState('corretor')
  const [leads, setLeads] = useState<Lead[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tab, setTab] = useState<'carteiras' | 'lixeira' | 'historico'>('carteiras')
  const [search, setSearch] = useState('')
  const [brokerFilter, setBrokerFilter] = useState('todos')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [restoreLead, setRestoreLead] = useState<Lead | null>(null)
  const [restoreTo, setRestoreTo] = useState('')
  const [restoreReason, setRestoreReason] = useState('Lead reativado pela gestão')
  const [transferTo, setTransferTo] = useState('')
  const [transferReason, setTransferReason] = useState('Transferência pela gestão')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const currentRole = p?.role ?? 'corretor'
    setRole(currentRole)

    const [{ data: allLeads }, { data: a }, { data: people }] = await Promise.all([
      supabase.from('leads').select('id,nome,telefone,email,origem,status,observacoes,responsavel_id,criado_por,created_at,deleted_at,deletion_reason').order('created_at', { ascending: false }).limit(1000),
      supabase.from('lead_audit_log').select('id,lead_id,actor_id,action,field_name,old_value,new_value,created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('profiles').select('id,nome,email,role').order('nome'),
    ])
    setLeads((allLeads ?? []) as Lead[])
    setAudit((a ?? []) as Audit[])
    setProfiles((people ?? []) as Profile[])
  }

  useEffect(() => { load() }, [])

  const brokers = profiles.filter(p => p.role === 'corretor')
  const activeLeads = leads.filter(l => !l.deleted_at)
  const deleted = leads.filter(l => !!l.deleted_at)
  const filteredActive = activeLeads.filter(l => {
    const term = search.toLowerCase().trim()
    const matchesText = !term || l.nome.toLowerCase().includes(term) || (l.telefone ?? '').includes(term) || (l.email ?? '').toLowerCase().includes(term)
    const matchesBroker = brokerFilter === 'todos' || l.responsavel_id === brokerFilter
    return matchesText && matchesBroker
  })

  const personName = (id: string | null) => profiles.find(p => p.id === id)?.nome ?? 'Sem responsável'
  const leadFor = (id: string) => leads.find(l => l.id === id)

  async function transferLead(lead: Lead) {
    if (!transferTo) return
    setSaving(true); setError('')
    const { error: rpcError } = await supabase.rpc('transfer_lead', {
      p_lead_id: lead.id,
      p_to_user_id: transferTo,
      p_reason: transferReason || 'Transferência pela gestão',
    })
    if (rpcError) setError(rpcError.message)
    else { setTransferTo(''); setTransferReason('Transferência pela gestão'); setSelected(null); await load() }
    setSaving(false)
  }

  async function restore() {
    if (!restoreLead || !restoreTo) return
    setSaving(true); setError('')
    const { error: rpcError } = await supabase.rpc('admin_restore_lead', {
      p_lead_id: restoreLead.id,
      p_to_user_id: restoreTo,
      p_reason: restoreReason || 'Lead reativado pela gestão',
    })
    if (rpcError) setError(rpcError.message)
    else { setRestoreLead(null); setRestoreTo(''); setRestoreReason('Lead reativado pela gestão'); await load() }
    setSaving(false)
  }

  if (role !== 'admin' && role !== 'gerente') return <AppShell role={role}><div className="page"><section className="card"><strong>Acesso restrito</strong><p className="sub">A auditoria é exclusiva para gerente e administrador.</p></section></div></AppShell>

  return <AppShell role={role}>
    <div className="page">
      <div className="eyebrow">Controle e rastreabilidade</div>
      <h1>Auditoria</h1>
      <p className="sub">Gerencie as carteiras, recupere leads removidos e consulte tudo o que aconteceu com a base comercial.</p>
      {error && <div className="form-error">{error}</div>}

      <div className="toolbar">
        <div className="actions">
          <button className={`btn ${tab === 'carteiras' ? 'primary' : ''}`} onClick={() => setTab('carteiras')}>Carteiras ({activeLeads.length})</button>
          <button className={`btn ${tab === 'lixeira' ? 'primary' : ''}`} onClick={() => setTab('lixeira')}>Lixeira ({deleted.length})</button>
          <button className={`btn ${tab === 'historico' ? 'primary' : ''}`} onClick={() => setTab('historico')}>Histórico ({audit.length})</button>
        </div>
      </div>

      {tab === 'carteiras' && <section className="card">
        <div className="toolbar">
          <div><h2 className="section-title">Carteiras dos corretores</h2><div className="sub">Gerente e administrador podem visualizar e transferir qualquer lead ativo.</div></div>
        </div>
        <div className="lead-filters">
          <input placeholder="Buscar por nome, telefone ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
          <select value={brokerFilter} onChange={e => setBrokerFilter(e.target.value)}>
            <option value="todos">Todos os corretores</option>
            {brokers.map(p => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}
          </select>
        </div>
        {filteredActive.length === 0 ? <div className="empty">Nenhum lead encontrado.</div> : <div className="table-wrap"><table><thead><tr><th>Lead</th><th>Telefone</th><th>Origem</th><th>Responsável</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {filteredActive.map(lead => <tr key={lead.id}>
            <td><strong>{lead.nome}</strong><div className="sub">{lead.email ?? 'Sem e-mail'}</div></td>
            <td>{lead.telefone ?? '—'}</td>
            <td>{lead.origem ?? '—'}</td>
            <td><strong>{personName(lead.responsavel_id)}</strong></td>
            <td>{statusLabel[lead.status] ?? lead.status}</td>
            <td><div className="actions"><button className="btn" onClick={() => { setSelected(lead); setTransferTo(''); setError('') }}>Ver</button><button className="btn" onClick={() => { setSelected(lead); setTransferTo(''); setError('') }}>Enviar</button></div></td>
          </tr>)}
        </tbody></table></div>}
      </section>}

      {tab === 'lixeira' && <section className="card">
        <div className="toolbar"><div><h2 className="section-title">Leads removidos</h2><div className="sub">Consulte os dados antes de decidir para qual corretor o lead deve voltar.</div></div></div>
        {deleted.length === 0 ? <div className="empty">A lixeira está vazia.</div> : <div className="table-wrap"><table><thead><tr><th>Lead</th><th>Responsável anterior</th><th>Excluído em</th><th>Motivo</th><th>Ação</th></tr></thead><tbody>
          {deleted.map(l => <tr key={l.id}>
            <td><strong>{l.nome}</strong><div className="sub">{l.telefone ?? 'Sem telefone'} · {l.email ?? 'Sem e-mail'}<br />Origem: {l.origem ?? '—'} · Status: {statusLabel[l.status] ?? l.status}</div></td>
            <td>{personName(l.responsavel_id)}</td><td>{l.deleted_at ? formatDate(l.deleted_at) : '—'}</td><td>{l.deletion_reason ?? '—'}</td>
            <td><button className="btn" onClick={() => { setRestoreLead(l); setRestoreTo(''); setError('') }}>Reativar</button></td>
          </tr>)}
        </tbody></table></div>}
      </section>}

      {tab === 'historico' && <section className="card">
        <div className="toolbar"><div><h2 className="section-title">Histórico</h2><div className="sub">Cada evento mostra o lead envolvido e permite abrir os dados disponíveis para a gestão.</div></div></div>
        {audit.length === 0 ? <div className="empty">Nenhuma alteração registrada.</div> : <div className="timeline">{audit.map(i => {
          const lead = leadFor(i.lead_id)
          return <article className="timeline-item" key={i.id}>
            <div><strong>{actionLabel[i.action] ?? i.action}</strong><span>{formatDate(i.created_at)}</span></div>
            <p>Por <strong>{personName(i.actor_id)}</strong>{i.field_name ? ` · campo: ${i.field_name}` : ''}{i.old_value || i.new_value ? ` · ${i.old_value ?? '—'} → ${i.new_value ?? '—'}` : ''}</p>
            {lead && <div className="audit-lead-preview"><strong>{lead.nome}</strong><span>{lead.telefone ?? 'Sem telefone'} · {lead.email ?? 'Sem e-mail'}</span><span>Responsável: {personName(lead.responsavel_id)} · {statusLabel[lead.status] ?? lead.status}</span>{lead.origem && <span>Origem: {lead.origem}</span>}{lead.observacoes && <span>Obs.: {lead.observacoes}</span>}<div className="actions"><button className="btn" onClick={() => setSelected(lead)}>Ver detalhes</button>{!lead.deleted_at && <button className="btn" onClick={() => { setSelected(lead); setTransferTo('') }}>Enviar para outro corretor</button>}{lead.deleted_at && <button className="btn" onClick={() => { setRestoreLead(lead); setRestoreTo('') }}>Reativar na carteira</button>}</div></div>}
          </article>
        })}</div>}
      </section>}
    </div>

    {selected && <div className="modal-backdrop" onMouseDown={() => !saving && setSelected(null)}><div className="modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-header"><div><div className="eyebrow">Lead</div><h2>{selected.nome}</h2><div className="sub">{selected.telefone ?? 'Sem telefone'} · {selected.email ?? 'Sem e-mail'}</div></div><button className="icon-btn" onClick={() => setSelected(null)}>×</button></div>
      <div className="lead-detail"><div className="detail-row"><span>Status</span><strong>{statusLabel[selected.status] ?? selected.status}</strong></div><div className="detail-row"><span>Responsável</span><strong>{personName(selected.responsavel_id)}</strong></div><div className="detail-row"><span>Origem</span><strong>{selected.origem ?? '—'}</strong></div><div className="detail-row"><span>Criado em</span><strong>{formatDate(selected.created_at)}</strong></div>{selected.deleted_at && <div className="detail-row"><span>Excluído em</span><strong>{formatDate(selected.deleted_at)}</strong></div>}{selected.deletion_reason && <div className="detail-row"><span>Motivo da exclusão</span><strong>{selected.deletion_reason}</strong></div>}{selected.observacoes && <div className="detail-notes">{selected.observacoes}</div>}</div>
      <div className="transfer-box"><h3>Enviar para outro corretor</h3><label>Novo responsável<select value={transferTo} onChange={e => setTransferTo(e.target.value)}><option value="">Selecione um corretor</option>{brokers.filter(p => p.id !== selected.responsavel_id).map(p => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}</select></label><label>Motivo<input value={transferReason} onChange={e => setTransferReason(e.target.value)} /></label><div className="modal-actions"><button className="btn" onClick={() => setSelected(null)}>Cancelar</button><button className="btn primary" disabled={saving || !transferTo} onClick={() => transferLead(selected)}>{saving ? 'Enviando...' : 'Enviar lead'}</button></div></div>
    </div></div>}

    {restoreLead && <div className="modal-backdrop" onMouseDown={() => !saving && setRestoreLead(null)}><div className="modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-header"><div><div className="eyebrow">Reativar lead</div><h2>{restoreLead.nome}</h2><div className="sub">O lead voltará imediatamente para a carteira do corretor escolhido.</div></div><button className="icon-btn" onClick={() => setRestoreLead(null)}>×</button></div>
      <div className="lead-detail"><div className="detail-row"><span>Telefone</span><strong>{restoreLead.telefone ?? '—'}</strong></div><div className="detail-row"><span>E-mail</span><strong>{restoreLead.email ?? '—'}</strong></div><div className="detail-row"><span>Responsável anterior</span><strong>{personName(restoreLead.responsavel_id)}</strong></div><div className="detail-row"><span>Motivo da exclusão</span><strong>{restoreLead.deletion_reason ?? '—'}</strong></div></div>
      <label>Novo responsável<select value={restoreTo} onChange={e => setRestoreTo(e.target.value)}><option value="">Selecione um corretor</option>{brokers.map(p => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}</select></label><label>Observação da reativação<input value={restoreReason} onChange={e => setRestoreReason(e.target.value)} /></label>
      <div className="modal-actions"><button className="btn" onClick={() => setRestoreLead(null)}>Cancelar</button><button className="btn primary" disabled={saving || !restoreTo} onClick={restore}>{saving ? 'Reativando...' : 'Reativar e enviar'}</button></div>
    </div></div>}
  </AppShell>
}
