'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../supabase-client'

type Profile = { id: string; nome: string; email: string }

export default function LeadRoulette({ role }: { role: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [brokers, setBrokers] = useState<Profile[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = role === 'admin' || role === 'gerente'

  async function load() {
    if (!canManage) return
    const [{ data: people }, { count }] = await Promise.all([
      supabase.from('profiles').select('id,nome,email').eq('role', 'corretor').order('nome'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).is('responsavel_id', null).is('deleted_at', null),
    ])
    const list = (people ?? []) as Profile[]
    setBrokers(list)
    setSelected(current => current.filter(id => list.some(p => p.id === id)))
    setPending(count ?? 0)
  }

  useEffect(() => {
    load()
  }, [canManage])

  function toggle(id: string) {
    setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  }

  function openRoulette() {
    setError('')
    setMessage('')
    setOpen(true)
  }

  async function distribute() {
    if (!selected.length) {
      setError('Selecione pelo menos um corretor.')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')

    const { data: pendingLeads, error: pendingError } = await supabase
      .from('leads')
      .select('id')
      .is('responsavel_id', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (pendingError) {
      setError(pendingError.message)
      setLoading(false)
      return
    }

    const leadsToDistribute = pendingLeads ?? []
    if (!leadsToDistribute.length) {
      setMessage('Não há leads pendentes para distribuir.')
      setLoading(false)
      return
    }

    let distributed = 0
    for (let i = 0; i < leadsToDistribute.length; i++) {
      const brokerId = selected[i % selected.length]
      const leadId = leadsToDistribute[i].id
      const { error: updateError } = await supabase
        .from('leads')
        .update({ responsavel_id: brokerId })
        .eq('id', leadId)
        .is('responsavel_id', null)

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      distributed += 1
    }

    const total = distributed
    setMessage(
      total > 0
        ? String(total) + ' lead' + (total === 1 ? '' : 's') + ' distribuído' + (total === 1 ? '' : 's') + ' com sucesso.'
        : 'Não há leads pendentes para distribuir.'
    )

    await load()
    setLoading(false)
    if (total > 0) setOpen(false)
  }

  if (!canManage) return null

  return <>
    <button type="button" className="btn primary" onClick={openRoulette}>
      🎯 Distribuir leads
      {pending > 0 && <span style={{ marginLeft: 7, opacity: .9 }}>({pending} pendentes)</span>}
    </button>

    {open && <div className="modal-backdrop" onMouseDown={() => !loading && setOpen(false)}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="eyebrow">Distribuição automática</div>
            <h2>🎯 Roleta de leads</h2>
            <p className="sub">
              {pending} lead{pending === 1 ? '' : 's'} sem responsável será{pending === 1 ? '' : 'ão'} distribuído{pending === 1 ? '' : 's'} entre os corretores selecionados.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} disabled={loading}>×</button>
        </div>

        {message && <div className="form-success">{message}</div>}
        {error && <div className="form-error">{error}</div>}

        <div className="lead-roulette-list">
          <div className="lead-roulette-heading">
            <strong>Corretores participantes</strong>
            <button type="button" className="btn" onClick={() => setSelected(brokers.map(p => p.id))} disabled={!brokers.length || loading}>
              Selecionar todos
            </button>
          </div>

          {brokers.length === 0
            ? <div className="empty">Nenhum corretor cadastrado.</div>
            : brokers.map(person => (
              <label className="lead-roulette-option" key={person.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(person.id)}
                  onChange={() => toggle(person.id)}
                  disabled={loading}
                />
                <span>
                  <strong>{person.nome || person.email}</strong>
                  <small>{person.email}</small>
                </span>
              </label>
            ))
          }
        </div>

        <p className="sub">
          A roleta usa rodízio pela ordem dos corretores selecionados. Os leads entram imediatamente na carteira e cada corretor recebe uma notificação.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => setOpen(false)} disabled={loading}>Cancelar</button>
          <button type="button" className="btn primary" onClick={distribute} disabled={loading || !selected.length || !pending}>
            {loading ? 'Distribuindo...' : 'Iniciar roleta'}
          </button>
        </div>
      </div>
    </div>}
  </>
}
