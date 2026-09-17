'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import CalendarShell from '../../components/calendario/CalendarShell'
import { createClient } from '../../supabase-client'
import './calendario.css'

export default function CalendarioPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email?: string }>()
  const [profile, setProfile] = useState<any>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.replace('/login')
        return
      }
      setUser({ id: u.id, email: u.email })
      const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle()
      setProfile(p)
      setLoading(false)
    })()
  }, [router])

  if (loading || !user) {
    return <div className="cal-page-loading">Carregando calendário…</div>
  }

  return (
    <CalendarShell
      userId={user.id}
      role={profile?.role ?? 'corretor'}
      userName={profile?.nome ?? profile?.name ?? ''}
      userEmail={user.email ?? ''}
    />
  )
}
