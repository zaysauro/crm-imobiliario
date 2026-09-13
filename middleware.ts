import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_ROUTES = new Set(['/login', '/acesso'])

export async function middleware(request: NextRequest) {
  // TEMPORARY DEVELOPMENT BYPASS:
  // Allows all routes to be viewed without authentication while the CRM is being tested.
  // Remove these two lines to restore the authentication middleware below.
  const response = NextResponse.next({ request })
  return response

  const pathname = request.nextUrl.pathname
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return PUBLIC_ROUTES.has(pathname)
      ? response
      : NextResponse.redirect(new URL('/acesso', request.url))
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (PUBLIC_ROUTES.has(pathname)) {
    if (user && (pathname === '/login' || pathname === '/acesso')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  if (!user) {
    return NextResponse.redirect(new URL('/acesso', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
