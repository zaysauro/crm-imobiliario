import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During a Vercel build the public env vars may not be available yet.
  // Do not throw here: callers must only create/use the client at runtime.
  if (!url || !key) {
    return null
  }

  return createBrowserClient(url, key)
}
