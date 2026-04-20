import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the Supabase session fresh on every request AND gates
 * `/admin/*` behind `lewis_users.role = 'admin'`.
 *
 * Session refresh follows the pattern in the `@supabase/ssr` docs:
 * mirror the request's cookies, let Supabase rotate them, then copy
 * any new ones onto the response.
 *
 * Admin gate:
 *   • Unauthenticated on /admin/* → redirect to /login?next=<path>
 *   • Signed-in but not admin on /admin/* → redirect to /?error=admin_required
 *   • Admin → pass through
 *
 * The role check only runs on admin paths so normal traffic doesn't
 * pay for an extra DB query.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: `getUser()` validates the JWT against Supabase. Never
  // rely on `getSession()` between the middleware and server code — it
  // can be stale / forged.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate /admin/*
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
      return NextResponse.redirect(redirectUrl);
    }

    const { data: profile } = await supabase
      .from("lewis_users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profile as { role?: string } | null)?.role;
    if (role !== "admin") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "?error=admin_required";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
