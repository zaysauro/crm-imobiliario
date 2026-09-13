import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_ROUTES = new Set(['/login'])

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const pathname = request.nextUrl.pathname
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Sem as credenciais do Supabase, não é possível validar uma sessão.
  // Mantemos apenas a tela de login acessível para não expor o CRM.
  if (!supabaseUrl || !supabaseKey) {
    return PUBLIC_ROUTES.has(pathname)
      ? response
      : NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, _headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (PUBLIC_ROUTES.has(pathname)) {
    if (user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
