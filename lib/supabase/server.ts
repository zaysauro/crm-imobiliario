import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client for Route Handlers / Server Components.
 *
 * There is intentionally no Next.js middleware in this project.
 * Authentication is handled by the browser Supabase client and the
 * authenticated session cookie is read here when a server route needs it.
 *
 * The public Supabase configuration also has the same safe fallback used by
 * the browser client. This keeps server routes working when the Vercel
 * deployment is missing the NEXT_PUBLIC_* variables, while the service-role
 * key remains required only by privileged server operations.
 */
export async function createServerSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://lqjignvvtcwkflslfmpy.supabase.co'

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_azTH4kh4dSyk6yQ9uc5y2Q_wxkd_Azg'

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components may not allow cookie writes.
          // Route Handlers can write cookies when the response supports it.
        }
      },
    },
  })
}
