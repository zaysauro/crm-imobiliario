'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '../../supabase-client'

type Row = Record<string, unknown>
type Preview = { row: number; nome: string; telefone: string; email: string; origem: string; status: 'novo' | 'duplicado' | 'invalido'; motivo?: string; raw: Row }
type Profile = { id: string; nome: string; email: string; role: string }
type Lead = { id: string; nome: string; telefone: string | null; email: string | null }

const clean = (value: unknown) => String(value ?? '').trim()
const normalizedPhone = (value: string) => clean(value).replace(/\D/g, '')
const normalizedEmail = (value: string) => clean(value).toLowerCase()
function findValue(row: Row, names: string[]) { const keys = Object.keys(row); const key = keys.find((item) => names.includes(item.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))); return key ? clean(row[key]) : '' }

export default function ImportacaoPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('corretor')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [rows, setRows] = useState<Preview[]>([])
  const [fileName, setFileName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([])
  const [strategy, setStrategy] = useState<'none' | 'round_robin' | 'quantidade'>('round_robin')
  const [quantity, setQuantity] = useState(10)

  useEffect(() => { (async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.replace('/login'); return } setUserId(user.id); const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(); setRole(profile?.role ?? 'corretor'); const { data } = await supabase.from('profiles').select('id, nome, email, role').eq('role', 'corretor').order('nome'); setProfiles((data ?? []) as Profile[]) })() }, [])

  async function parseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setProcessing(true); setError(''); setMessage(''); setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' })
      const { data: existing } = await supabase.from('leads').select('id, nome, telefone, email').is('deleted_at', null).limit(5000)
      const phones = new Set((existing ?? []).map((lead: Lead) => normalizedPhone(lead.telefone ?? '')).filter(Boolean))
      const emails = new Set((existing ?? []).map((lead: Lead) => normalizedEmail(lead.email ?? '')).filter(Boolean))
      const seenPhones = new Set<string>(); const seenEmails = new Set<string>()
      const preview: Preview[] = data.map((raw, index) => {
        const nome = findValue(raw, ['nome', 'name', 'cliente', 'lead'])
        const telefone = findValue(raw, ['telefone', 'phone', 'celular', 'whatsapp', 'fone'])
        const email = findValue(raw, ['email', 'e-mail', 'e_mail'])
        const origem = findValue(raw, ['origem', 'source', 'campanha', 'campaign'])
        const phone = normalizedPhone(telefone); const mail = normalizedEmail(email)
        if (!nome) return { row: index + 2, nome, telefone, email, origem, status: 'invalido', motivo: 'Nome ausente', raw }
        if (telefone && phone.length < 10) return { row: index + 2, nome, telefone, email, origem, status: 'invalido', motivo: 'Telefone inválido', raw }
        if ((phone && (phones.has(phone) || seenPhones.has(phone))) || (mail && (emails.has(mail) || seenEmails.has(mail)))) return { row: index + 2, nome, telefone, email, origem, status: 'duplicado', motivo: 'Telefone ou e-mail já cadastrado', raw }
        if (phone) seenPhones.add(phone); if (mail) seenEmails.add(mail)
        return { row: index + 2, nome, telefone, email, origem, status: 'novo', raw }
      })
      setRows(preview)
      setMessage(`${preview.filter((row) => row.status === 'novo').length} novos · ${preview.filter((row) => row.status === 'duplicado').length} duplicados · ${preview.filter((row) => row.status === 'invalido').length} inválidos`)
    } catch { setError('Não foi possível ler a planilha. Use CSV, XLS ou XLSX.') }
    setProcessing(false)
  }

  function toggleBroker(id: string) { setSelectedBrokers((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]) }

  async function importRows() {
    if (!userId || role === 'corretor') { setError('Somente gerente ou administrador pode importar leads.'); return }
    const valid = rows.filter((row) => row.status === 'novo')
    if (!valid.length) { setError('Não há leads novos para importar.'); return }
    setProcessing(true); setError(''); setMessage('Importando...')
    const { data: batch, error: batchError } = await supabase.from('lead_imports').insert({ uploaded_by: userId, file_name: fileName, file_type: fileName.toLowerCase().endsWith('.csv') ? 'csv' : fileName.toLowerCase().endsWith('.xls') ? 'xls' : 'xlsx', total_rows: rows.length, imported_rows: 0, duplicate_rows: rows.filter((r) => r.status === 'duplicado').length, invalid_rows: rows.filter((r) => r.status === 'invalido').length, status: 'processando' }).select('id').single()
    if (batchError || !batch) { setError(batchError?.message ?? 'Falha ao criar histórico da importação.'); setProcessing(false); return }
    const importedIds: string[] = []; let imported = 0
    for (const row of valid) {
      const { data: lead, error: leadError } = await supabase.from('leads').insert({ nome: row.nome, telefone: row.telefone || null, email: row.email || null, origem: row.origem || null, status: 'novo', criado_por: userId }).select('id').single()
      if (leadError || !lead) continue
      imported++; importedIds.push(lead.id)
      await supabase.from('lead_import_rows').insert({ import_id: batch.id, row_number: row.row, raw_data: row.raw, row_status: 'importado', lead_id: lead.id })
    }
    for (const row of rows.filter((r) => r.status !== 'novo')) await supabase.from('lead_import_rows').insert({ import_id: batch.id, row_number: row.row, raw_data: row.raw, row_status: row.status === 'duplicado' ? 'duplicado' : 'invalido', error_message: row.motivo })
    if (strategy !== 'none' && selectedBrokers.length && importedIds.length) {
      const { data: distribution } = await supabase.from('lead_distribution_batches').insert({ created_by: userId, strategy, total_leads: importedIds.length, notes: `Importação ${fileName}` }).select('id').single()
      if (distribution) {
        const assignments: { lead_id: string; from_user_id: string | null; to_user_id: string; batch_id: string }[] = []
        importedIds.forEach((leadId, index) => { const broker = strategy === 'quantidade' ? selectedBrokers[Math.floor(index / Math.max(1, quantity)) % selectedBrokers.length] : selectedBrokers[index % selectedBrokers.length]; assignments.push({ lead_id: leadId, from_user_id: null, to_user_id: broker, batch_id: distribution.id }) })
        await supabase.from('lead_distribution_items').insert(assignments)
        for (const item of assignments) await supabase.from('leads').update({ responsavel_id: item.to_user_id }).eq('id', item.lead_id)
      }
    }
    await supabase.from('lead_imports').update({ imported_rows: imported, status: imported === valid.length ? 'concluido' : 'concluido_com_erros', completed_at: new Date().toISOString() }).eq('id', batch.id)
    setMessage(`Importação concluída: ${imported} leads adicionados. ${valid.length - imported} falharam.`)
    setRows([]); setFileName('')
    setProcessing(false)
  }

  const canImport = role === 'admin' || role === 'gerente'
  return <div className="shell"><aside className="sidebar"><div className="brand">CRM <span>Cadena</span></div><nav className="nav"><a href="/">Dashboard</a><a href="/#leads">Leads</a><a href="/importacao" className="active">Importar</a><a href="/followups">Follow-ups</a><a href="/kanban">Kanban</a><a href="#">Atendimentos</a><a href="#">Imóveis</a><a href="#">Visitas</a><a href="#">Propostas</a><a href="#">Relatórios</a></nav></aside><main className="main"><header className="topbar"><strong>CRM Cadena</strong><button className="btn" onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}>Sair</button></header><div className="page"><div className="eyebrow">Entrada de leads</div><h1>Importar leads</h1><p className="sub">Envie uma planilha, revise os dados e distribua os novos leads para a equipe.</p>{!canImport ? <div className="card"><strong>Acesso restrito</strong><p className="sub">A importação é exclusiva para gerente e administrador.</p></div> : <><section className="card"><div className="toolbar"><div><h2 className="section-title">1. Selecionar planilha</h2><div className="sub">Aceita CSV, XLS e XLSX. A primeira linha deve conter os nomes das colunas.</div></div><label className="btn primary">{processing ? 'Lendo...' : 'Selecionar arquivo'}<input type="file" accept=".csv,.xls,.xlsx" onChange={parseFile} disabled={processing} hidden /></label></div>{fileName && <div className="sub">Arquivo: <strong>{fileName}</strong></div>}</section>{rows.length > 0 && <><section className="card"><div className="toolbar"><div><h2 className="section-title">2. Conferir importação</h2><div className="sub">Duplicados e inválidos não serão importados.</div></div><button className="btn primary" disabled={processing} onClick={importRows}>Importar {rows.filter((r) => r.status === 'novo').length} novos</button></div>{message && <div className="sub" style={{ marginBottom: 14 }}>{message}</div>}<div className="table-wrap"><table><thead><tr><th>Linha</th><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Origem</th><th>Situação</th></tr></thead><tbody>{rows.slice(0, 300).map((row) => <tr key={row.row}><td>{row.row}</td><td><strong>{row.nome || '—'}</strong></td><td>{row.telefone || '—'}</td><td>{row.email || '—'}</td><td>{row.origem || '—'}</td><td><span className={`status ${row.status === 'novo' ? 'green' : row.status === 'duplicado' ? 'amber' : 'red'}`}>{row.status === 'novo' ? 'Novo' : row.status === 'duplicado' ? 'Duplicado' : `Inválido · ${row.motivo}`}</span></td></tr>)}</tbody></table></div></section><section className="card"><h2 className="section-title">3. Distribuir automaticamente</h2><p className="sub">Opcional. Os leads importados podem ser distribuídos entre os corretores selecionados.</p><div className="lead-form" style={{ marginTop: 16 }}><label>Estratégia<select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}><option value="round_robin">Rodízio (round robin)</option><option value="quantidade">Quantidade por corretor</option><option value="none">Não distribuir agora</option></select></label>{strategy === 'quantidade' && <label>Leads por corretor<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></label>}<div><strong style={{ fontSize: 13 }}>Corretores</strong><div className="broker-list">{profiles.map((profile) => <label className="broker-option" key={profile.id}><input type="checkbox" checked={selectedBrokers.includes(profile.id)} onChange={() => toggleBroker(profile.id)} />{profile.nome}</label>)}</div></div></div></section></>}</>}</div></main></div>
}
