"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Reads session from the cookies that
 * the middleware keeps refreshed. Safe to call many times — the
 * factory dedupes under the hood.
 *
 * See `./server.ts` for the reason we don't pass the Database generic.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
