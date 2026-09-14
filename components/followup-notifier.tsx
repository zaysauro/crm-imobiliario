'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../supabase-client'

type Due = { id: string; title: string; due_at: string; lead_id: string }

export default function FollowupNotifier() {
  const [notice, setNotice] = useState<Due[]>([])

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setInterval> | undefined
    let mounted = true

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase.from('lead_followups').select('id,title,due_at,lead_id').eq('assigned_to', user.id).eq('status', 'pendente').lte('due_at', new Date().toISOString()).order('due_at', { ascending: true }).limit(20)
      const due = (data ?? []) as Due[]
      if (!mounted) return
      setNotice(due)
      const key = `cadena-followups-${user.id}`
      let sent: string[] = []
      try { sent = JSON.parse(localStorage.getItem(key) || '[]') } catch {}
      const fresh = due.filter(x => !sent.includes(x.id))
      if (fresh.length && 'Notification' in window && Notification.permission === 'granted') fresh.slice(0, 3).forEach(x => new Notification('Follow-up vencido · CRM Cadena', { body: x.title }))
      if (fresh.length) localStorage.setItem(key, JSON.stringify([...sent, ...fresh.map(x => x.id)].slice(-100)))
    }

    const { data: listener } = supabase.auth.onAuthStateChange(() => { setTimeout(check, 0) })
    check()
    timer = setInterval(check, 30000)
    return () => { mounted = false; if (timer) clearInterval(timer); listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (notice.length && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
  }, [notice.length])

  if (!notice.length) return null
  return <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, maxWidth: 380 }}><div className="card" style={{ boxShadow: '0 18px 50px rgba(0,0,0,.18)', border: '1px solid #e6e9ef' }}><strong>Follow-ups pendentes</strong><p className="sub" style={{ marginTop: 6 }}>{notice.length === 1 ? 'Um follow-up venceu.' : `${notice.length} follow-ups venceram.`}</p><div style={{ display: 'grid', gap: 6, marginTop: 10 }}>{notice.slice(0, 3).map(x => <div key={x.id} className="detail-row"><span>{x.title}</span><strong>{new Date(x.due_at).toLocaleString('pt-BR')}</strong></div>)}</div><a className="btn primary" style={{ display: 'inline-block', marginTop: 12 }} href="/followups">Abrir agenda</a></div></div>
}
