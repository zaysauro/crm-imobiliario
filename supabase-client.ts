import { createBrowserClient } from '@supabase/ssr'

const BUILD_URL = 'https://placeholder.supabase.co'
const BUILD_KEY = 'build-placeholder-key'

export function createClient() {
  const isBrowser = typeof window !== 'undefined'

  // NEXT_PUBLIC_* é incorporado ao bundle do navegador durante o build.
  // Aceitamos também o nome antigo ANON_KEY para evitar quebra caso a Vercel
  // ainda tenha a variável configurada com esse nome.
  const url = isBrowser
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL || BUILD_URL)
    : BUILD_URL

  const key = isBrowser
    ? (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || BUILD_KEY)
    : BUILD_KEY

  return createBrowserClient(url, key)
}
