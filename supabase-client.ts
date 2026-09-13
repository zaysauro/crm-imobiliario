import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente Supabase exclusivo para Client Components/browser.
 * O cliente de servidor fica em lib/supabase/server.ts e usa cookies.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Configuração do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel.'
    )
  }

  return createBrowserClient(url, key)
}
