import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client for Server Components, Route Handlers,
 * and Server Actions. Reads/writes session cookies via next/headers.
 *
 * Server Components may only *read* cookies — the no-op setAll path
 * covers that case so the middleware-refreshed session stays usable
 * without trying to mutate the response from a read-only context.
 *
 * Runtime typing: we don't pass the `Database` generic because
 * supabase-js v2.103's inference fights our hand-written schema (every
 * table resolves to `never`). Callers cast results explicitly using
 * the `LewisFoo` types from `./types`. Phase 2b will swap in
 * `supabase gen types`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — cookie mutation isn't
            // allowed there. The middleware session refresh handles it.
          }
        },
      },
    },
  );
}
