import { Annotation } from "@/components/wireframe/Annotation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { listAdminUsers } from "@/app/_actions/admin";
import { formatGBP } from "@/lib/mock/mock-offer";

export const metadata = {
  title: "Users · cardbuy admin",
};

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminUsersPage() {
  const users = await listAdminUsers();
  const admins = users.filter((u) => u.role === "admin");
  const sellers = users.filter((u) => u.role === "seller");
  const totalCommitted = users.reduce((s, u) => s + u.total_offered, 0);

  return (
    <div className="px-4 py-6 max-w-[1300px] mx-auto flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Annotation>ADMIN · USERS</Annotation>
        <h1 className="font-display text-[26px] tracking-tight uppercase">
          Users
        </h1>
        <p className="text-[12px] text-muted">
          Read-only view of{" "}
          <code className="font-mono">lewis_users</code> with submission
          totals from <code className="font-mono">lewis_submissions</code>.
          Role management lands in Phase 2b.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Users · total" value={users.length} />
        <Stat label="Sellers" value={sellers.length} />
        <Stat label="Admins" value={admins.length} />
        <Stat label="£ lifetime committed" value={formatGBP(totalCommitted)} />
      </section>

      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH className="text-right">Submissions</TH>
            <TH className="text-right">Lifetime £</TH>
            <TH>Last submission</TH>
            <TH>Joined</TH>
          </TR>
        </THead>
        <TBody>
          {users.length === 0 ? (
            <TR>
              <TD className="text-center text-secondary py-6">
                No users yet. The first sign-up creates a row here.
              </TD>
            </TR>
          ) : (
            users.map((u) => (
              <TR key={u.id}>
                <TD>
                  <div className="font-display text-[13px] tracking-tight">
                    {u.full_name ?? "—"}
                  </div>
                  {u.postcode ? (
                    <div className="text-[11px] text-muted">
                      {u.postcode}, {u.country ?? "GB"}
                    </div>
                  ) : null}
                </TD>
                <TD className="text-[12px] break-all">{u.email}</TD>
                <TD>
                  <span
                    className={`border-2 border-ink px-1.5 py-0.5 font-display text-[9px] tracking-wider rounded-sm ${
                      u.role === "admin"
                        ? "bg-pink text-ink"
                        : "bg-paper-strong text-ink"
                    }`}
                  >
                    {u.role.toUpperCase()}
                  </span>
                </TD>
                <TD className="text-right tabular-nums font-display">
                  {u.submission_count}
                </TD>
                <TD className="text-right tabular-nums font-display">
                  {formatGBP(u.total_offered)}
                </TD>
                <TD className="text-[11px] text-muted tabular-nums font-mono">
                  {formatDateTime(u.latest_submission_at)}
                </TD>
                <TD className="text-[11px] text-muted tabular-nums font-mono">
                  {formatDate(u.created_at)}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <p className="text-[11px] text-muted font-display tracking-wider">
        Role changes run through Supabase SQL editor for now:{" "}
        <code className="font-mono bg-paper-strong border border-ink px-1 py-0.5 rounded-sm">
          update lewis_users set role = &apos;admin&apos; where email = &apos;…&apos;;
        </code>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-2 border-ink rounded-md p-3 bg-paper-strong">
      <div className="text-[10px] font-display uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="font-display text-[22px] leading-tight tracking-tight tabular-nums mt-1 text-ink">
        {value}
      </div>
    </div>
  );
}
