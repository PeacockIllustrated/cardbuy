import { NextResponse, type NextRequest } from "next/server";
import { runFxSync } from "@/lib/sync/sync-fx";

/**
 * Daily USD→GBP / USD→EUR sync against open.er-api.com.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` header. Vercel Cron
 * auto-includes this when `CRON_SECRET` is set in project env. Same
 * header works for manual admin invocations.
 *
 * Short timeout: the fetch is a single HTTP call + one DB update.
 */

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function unauthorised() {
  return NextResponse.json({ error: "unauthorised" }, { status: 401 });
}

function checkAuth(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const got = request.headers.get("authorization");
  return got === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorised();
  const result = await runFxSync();
  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorised();
  const result = await runFxSync();
  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}
