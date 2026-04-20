import { NextResponse, type NextRequest } from "next/server";
import { runPriceSync } from "@/lib/sync/sync-prices";

/**
 * Nightly TCGCSV → Supabase price sync.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` header.
 * Vercel Cron auto-includes that when CRON_SECRET is set in the
 * project's environment variables. Same header works for manual
 * invocation from the admin "Run sync now" button.
 *
 * Returns the SyncResult JSON so admin tooling can inspect.
 *
 * Vercel function settings:
 *   • runtime nodejs (default) — needs node:fs for the fixture loader
 *   • maxDuration 300 (5 minutes) — comfortable headroom for 215
 *     groups × 2 fetches at PARALLELISM 8 (~16s real)
 */

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function unauthorised() {
  return NextResponse.json({ error: "unauthorised" }, { status: 401 });
}

function checkAuth(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Without a secret configured we refuse to run — better safe.
    return false;
  }
  const got = request.headers.get("authorization");
  return got === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorised();
  const result = await runPriceSync();
  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}

// Allow POST too — admin "Run sync now" button uses POST so the
// browser doesn't pre-fetch the URL on hover.
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorised();
  const result = await runPriceSync();
  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}
