import { createBrowserClient } from '@supabase/ssr'

// O CRM é uma aplicação autenticada e suas páginas são Client Components.
// Durante o build do Next.js, alguns Client Components ainda podem ser
// pré-renderizados no servidor. Nesse momento as variáveis NEXT_PUBLIC_* podem
// não estar disponíveis no runtime do servidor. Usamos valores não-funcionais
// apenas para permitir a pré-renderização; no navegador, o cliente usa as
// variáveis reais da Vercel.
export function createClient() {
  const isBrowser = typeof window !== 'undefined'
  const url = isBrowser
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : 'https://placeholder.supabase.co'
  const key = isBrowser
    ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    : 'build-placeholder-key'

  if (!url || !key) {
    throw new Error('Configuração do Supabase ausente. Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel.')
  }

  return createBrowserClient(url, key)
}
