import { createClient } from "@/lib/supabase/server";

/**
 * Diagnostic page — NOT under /admin, so the admin middleware doesn't
 * redirect you. Visit while signed in to see exactly what the admin
 * gate would see. Safe to delete once the admin flow is verified.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthDebugPage() {
  const supabase = await createClient();

  // 1. What the middleware sees from getUser()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // 2. Try the same lewis_users read the middleware does.
  let profileRow: unknown = null;
  let profileError: string | null = null;
  if (user) {
    const { data, error } = await supabase
      .from("lewis_users")
      .select("id, email, role, created_at")
      .eq("id", user.id)
      .maybeSingle();
    profileRow = data;
    profileError = error?.message ?? null;
  }

  // 3. And the widest-possible lewis_users read (RLS-gated; if your own
  //    row is missing from this list, RLS is blocking the read).
  const { data: allVisible, error: listError } = await supabase
    .from("lewis_users")
    .select("id, email, role")
    .order("created_at", { ascending: false })
    .limit(10);

  const role = (profileRow as { role?: string } | null)?.role ?? null;
  const gateWouldPass = role === "admin";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>auth-debug</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        What the <code>/admin/*</code> gate would see right now.
      </p>

      <section style={box}>
        <h2 style={h2}>1 · auth.getUser()</h2>
        {userError ? (
          <pre style={err}>getUser error: {userError.message}</pre>
        ) : !user ? (
          <pre style={err}>NOT SIGNED IN</pre>
        ) : (
          <pre style={ok}>
{`id:     ${user.id}
email:  ${user.email ?? "(no email)"}
aud:    ${user.aud}
role:   ${user.role ?? "(no supabase role)"}`}
          </pre>
        )}
      </section>

      <section style={box}>
        <h2 style={h2}>2 · lewis_users where id = auth.uid()</h2>
        {!user ? (
          <pre style={err}>skipped (not signed in)</pre>
        ) : profileError ? (
          <pre style={err}>query error: {profileError}</pre>
        ) : !profileRow ? (
          <pre style={err}>
{`NO ROW FOUND for id ${user.id}

Causes:
- The insert trigger on auth.users didn't fire (look in lewis_users
  for any row with this email).
- RLS "lewis_users: self read" policy is missing or broken
  (auth.uid() = id should match).
- You're signed into a different Supabase project than you ran the
  UPDATE against.`}
          </pre>
        ) : (
          <pre style={ok}>{JSON.stringify(profileRow, null, 2)}</pre>
        )}
      </section>

      <section style={box}>
        <h2 style={h2}>3 · Admin gate verdict</h2>
        <pre style={gateWouldPass ? ok : err}>
          role = {JSON.stringify(role)}
          {"\n"}
          {gateWouldPass
            ? "PASS · /admin/* would be reachable"
            : "FAIL · middleware redirects to /?error=admin_required"}
        </pre>
      </section>

      <section style={box}>
        <h2 style={h2}>4 · lewis_users (top 10 rows you can read)</h2>
        {listError ? (
          <pre style={err}>list error: {listError.message}</pre>
        ) : !allVisible || allVisible.length === 0 ? (
          <pre style={err}>
{`RLS returned zero rows.

If your own row is missing here, the "lewis_users: self read" policy
is not matching. Check it in the Supabase dashboard.`}
          </pre>
        ) : (
          <pre style={ok}>{JSON.stringify(allVisible, null, 2)}</pre>
        )}
      </section>

      <p style={{ color: "#888", fontSize: 12 }}>
        Delete <code>app/auth-debug/page.tsx</code> once admin access is verified.
      </p>
    </div>
  );
}

const box: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 6,
  padding: "12px 16px",
  marginBottom: 16,
  background: "#fafafa",
};
const h2: React.CSSProperties = { fontSize: 14, margin: "0 0 6px 0", color: "#333" };
const ok: React.CSSProperties = {
  background: "#e8f5e9",
  border: "1px solid #c8e6c9",
  padding: 10,
  borderRadius: 4,
  fontSize: 12,
  overflow: "auto",
  whiteSpace: "pre-wrap",
  margin: 0,
};
const err: React.CSSProperties = {
  background: "#ffebee",
  border: "1px solid #ffcdd2",
  padding: 10,
  borderRadius: 4,
  fontSize: 12,
  overflow: "auto",
  whiteSpace: "pre-wrap",
  margin: 0,
};
