import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['admin', 'gerente'].includes(profile.role)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) return NextResponse.json({ error: 'Configure SUPABASE_SERVICE_ROLE_KEY na Vercel para habilitar a criação de usuários.' }, { status: 503 })
  const body = await request.json()
  const email = String(body.email ?? '').trim().toLowerCase(); const password = String(body.password ?? ''); const nome = String(body.nome ?? '').trim(); const role = String(body.role ?? 'corretor')
  if (!email || password.length < 8 || !nome || !['corretor','gerente'].includes(role)) return NextResponse.json({ error: 'Nome, e-mail, senha de 8+ caracteres e função válida são obrigatórios.' }, { status: 400 })
  if (profile.role === 'gerente' && role === 'gerente') return NextResponse.json({ error: 'Gerente não pode criar outro gerente.' }, { status: 403 })
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome } })
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? 'Não foi possível criar o usuário.' }, { status: 400 })
  const { error: profileError } = await admin.from('profiles').update({ nome, email, role }).eq('id', data.user.id)
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  return NextResponse.json({ id: data.user.id, nome, email, role })
}
