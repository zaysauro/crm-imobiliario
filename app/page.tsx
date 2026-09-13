'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../supabase-client'

type Lead = {
  id: string
  nome: string
  telefone: string | null
  origem: string | null
  status: string
}

const statusLabel: Record<string, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  visita: 'Visita',
  proposta: 'Proposta',
  ganho: 'Ganho',
  perdido: 'Perdido',
}

function statusTone(status: string) {
  if (status === 'ganho' || status === 'visita') return 'green'
  if (status === 'perdido') return 'red'
  if (status === 'em_atendimento' || status === 'proposta') return 'amber'
  return 'blue'
}

function whatsapp(phone: string | null) {
  if (!phone) return '#'
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${normalized}`
}

export default function Home() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [leads, setLeads] = useState<Lead[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      setEmail(user.email ?? '')
      const { data, error } = await supabase
        .from('leads')
        .select('id, nome, telefone, origem, status')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) setError('Não foi possível carregar os leads.')
      else setLeads(data ?? [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const count = (status: string) => leads.filter((lead) => lead.status === status).length

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">CRM <span>Cadena</span></div>
        <nav className="nav">
          <a className="active" href="#">Dashboard</a>
          <a href="#leads">Leads</a>
          <a href="#">Atendimentos</a>
          <a href="#">Imóveis</a>
          <a href="#">Visitas</a>
          <a href="#">Propostas</a>
          <a href="#">Relatórios</a>
          <a href="#">Configurações</a>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <strong>CRM Cadena</strong>
          <div className="topbar-user">
            <span>{email}</span>
            <button className="btn" onClick={logout}>Sair</button>
          </div>
        </header>

        <div className="page">
          <div className="eyebrow">Visão geral</div>
          <h1>Dashboard</h1>
          <p className="sub">Acompanhe seus leads e atendimentos em um só lugar.</p>

          <section className="grid">
            <div className="card"><div className="metric-label">Leads visíveis</div><div className="metric">{leads.length}</div></div>
            <div className="card"><div className="metric-label">Novos</div><div className="metric">{count('novo')}</div></div>
            <div className="card"><div className="metric-label">Visitas</div><div className="metric">{count('visita')}</div></div>
            <div className="card"><div className="metric-label">Propostas</div><div className="metric">{count('proposta')}</div></div>
          </section>

          <section className="card" id="leads">
            <div className="toolbar">
              <h2 className="section-title">Últimos leads</h2>
              <button className="btn primary" onClick={() => alert('Cadastro de lead entra na próxima etapa.')}>+ Novo lead</button>
            </div>
            {error && <div className="form-error">{error}</div>}
            {loading ? <div className="empty">Carregando leads...</div> : leads.length === 0 ? <div className="empty">Nenhum lead cadastrado ainda.</div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cliente</th><th>Telefone</th><th>Origem</th><th>Status</th><th>Ações</th></tr></thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td><strong>{lead.nome}</strong></td>
                        <td>{lead.telefone ?? '—'}</td>
                        <td>{lead.origem ?? '—'}</td>
                        <td><span className={`status ${statusTone(lead.status)}`}>{statusLabel[lead.status] ?? lead.status}</span></td>
                        <td><div className="actions">{lead.telefone && <a className="btn whatsapp" href={whatsapp(lead.telefone)} target="_blank" rel="noreferrer">WhatsApp</a>}<button className="btn">Ver</button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
