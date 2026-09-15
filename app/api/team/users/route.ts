import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: profile, error: profileReadError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileReadError) {
      return NextResponse.json({ error: `Não foi possível verificar sua permissão: ${profileReadError.message}` }, { status: 500 })
    }
    if (!profile || !['admin', 'gerente'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão para criar usuários.' }, { status: 403 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !url) {
      return NextResponse.json({ error: 'O servidor está sem SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL nas variáveis da Vercel.' }, { status: 503 })
    }

    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const nome = String(body.nome ?? '').trim()
    const role = String(body.role ?? 'corretor')

    if (!email || password.length < 8 || !nome || !['corretor', 'gerente'].includes(role)) {
      return NextResponse.json({ error: 'Nome, e-mail, senha de 8+ caracteres e função válida são obrigatórios.' }, { status: 400 })
    }
    if (profile.role === 'gerente' && role === 'gerente') {
      return NextResponse.json({ error: 'Gerente não pode criar outro gerente.' }, { status: 403 })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome }
    })

    if (error || !data.user) {
      return NextResponse.json({ error: `Supabase não criou o usuário: ${error?.message ?? 'resposta sem usuário.'}` }, { status: 400 })
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ nome, email, role })
      .eq('id', data.user.id)

    if (profileError) {
      // O usuário Auth já existe neste ponto. Retornamos o erro real para facilitar diagnóstico.
      return NextResponse.json({
        error: `Usuário criado no Auth, mas não foi possível configurar o perfil: ${profileError.message}`,
        authUserId: data.user.id
      }, { status: 500 })
    }

    return NextResponse.json({ id: data.user.id, nome, email, role })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Erro interno ao criar usuário: ${message}` }, { status: 500 })
  }
}
