import Link from "next/link";
import { Annotation } from "@/components/wireframe/Annotation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { listAdminDemand } from "@/app/_actions/admin";
import { formatGBP } from "@/lib/mock/mock-offer";

/**
 * `/admin/demand` · Phase 6 · Slice B1.
 *
 * Aggregates every `lewis_wishlist_entries` row by card_id so Lewis can
 * see which cards have latent buyer demand. Cross-user visibility comes
 * from the `lewis_wishlist_entries: admin read` RLS policy shipped in
 * migration 0006. Middleware role-gates the `/admin/*` tree.
 *
 * The in-stock join still uses mock listings — swap for a real
 * `lewis_listings` read when shop persistence lands (Phase 7).
 */
export default async function AdminDemandPage() {
  const rows = await listAdminDemand();

  const totalWishes = rows.reduce((s, r) => s + r.wishlist_count, 0);
  const uniqueCards = rows.length;
  const actionable = rows.filter((r) => r.current_in_stock > 0).length;

  return (
    <div className="px-4 py-6 max-w-[1200px] mx-auto flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Annotation>ADMIN · DEMAND</Annotation>
        <h1 className="font-display text-[26px] tracking-tight uppercase">
          Wishlist Demand
        </h1>
        <p className="text-[12px] text-secondary max-w-[62ch]">
          Every wishlist row across the user base, grouped by card. Use
          this to prioritise sourcing, ping sellers, or spot which
          in-stock cards have latent buyers.
        </p>
      </header>

      {/* Topline stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBlock label="Unique cards" value={uniqueCards.toString()} />
        <StatBlock label="Total wishes" value={totalWishes.toString()} />
        <StatBlock
          label="In stock + wished"
          value={actionable.toString()}
          tone="teal"
        />
        <StatBlock
          label="Missed demand"
          value={(uniqueCards - actionable).toString()}
          tone="pink"
        />
      </div>

      {rows.length === 0 ? (
        <div className="pop-card rounded-md p-8 text-center text-secondary">
          <p className="font-display text-[13px] text-ink mb-2">
            No wishlist entries yet
          </p>
          <p className="text-[12px]">
            Users start filling these in when they hit a missing slot in
            their binder or click &ldquo;Add to wishlist&rdquo; on a card
            detail page.
          </p>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Card</TH>
              <TH className="text-right">Wishes</TH>
              <TH className="text-right">Avg target</TH>
              <TH className="text-right">Range</TH>
              <TH className="text-right">In stock</TH>
              <TH className="text-right">Lowest listed</TH>
              <TH>Signal</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const signal = classifyDemand(r);
              return (
                <TR key={r.card_id}>
                  <TD>
                    <Link
                      href={`/admin/demand/${r.card_id}`}
                      className="flex flex-col gap-0.5 hover:text-pink"
                    >
                      <span className="font-display text-[12px] tracking-wider">
                        {r.card_name}
                      </span>
                      <span className="text-[10px] text-muted">
                        {r.set_name}
                        {r.dex_number ? ` · #${r.dex_number}` : ""}
                      </span>
                    </Link>
                  </TD>
                  <TD className="text-right font-display tabular-nums">
                    {r.wishlist_count}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {r.avg_target_gbp !== null
                      ? formatGBP(r.avg_target_gbp)
                      : "—"}
                  </TD>
                  <TD className="text-right text-[11px] text-muted tabular-nums">
                    {r.min_target_gbp !== null && r.max_target_gbp !== null
                      ? r.min_target_gbp === r.max_target_gbp
                        ? formatGBP(r.min_target_gbp)
                        : `${formatGBP(r.min_target_gbp)}–${formatGBP(
                            r.max_target_gbp,
                          )}`
                      : `${r.targets_set}/${r.wishlist_count} set`}
                  </TD>
                  <TD className="text-right font-display tabular-nums">
                    {r.current_in_stock > 0 ? r.current_in_stock : "—"}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {r.lowest_listed_gbp !== null
                      ? formatGBP(r.lowest_listed_gbp)
                      : "—"}
                  </TD>
                  <TD>
                    <SignalBadge tone={signal.tone}>
                      {signal.label}
                    </SignalBadge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <p className="text-[10px] text-muted font-display tracking-wider">
        In-stock counts currently read from mock listings. Real data lands
        when shop persistence ships (Phase 7).
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Signal classification
 *
 * Quick visual cue — what should Lewis do about this row?
 *   • "Convert"  → in stock AND at least one target price meets lowest listed
 *   • "List it"  → no stock; target price exists, it's sourcing-worth
 *   • "Surface"  → in stock, no target prices; DM-worthy
 *   • "Watch"    → low demand (1 wish), no stock, no targets
 * ───────────────────────────────────────────────────────────────── */
function classifyDemand(row: {
  wishlist_count: number;
  current_in_stock: number;
  targets_set: number;
  max_target_gbp: number | null;
  lowest_listed_gbp: number | null;
}): { label: string; tone: "teal" | "pink" | "yellow" | "muted" } {
  const hasStock = row.current_in_stock > 0;
  const hasTarget = row.targets_set > 0;
  const targetMet =
    hasStock &&
    hasTarget &&
    row.max_target_gbp !== null &&
    row.lowest_listed_gbp !== null &&
    row.max_target_gbp >= row.lowest_listed_gbp;

  if (targetMet) return { label: "Convert", tone: "teal" };
  if (hasStock) return { label: "Surface", tone: "yellow" };
  if (hasTarget) return { label: "List it", tone: "pink" };
  return { label: "Watch", tone: "muted" };
}

function StatBlock({
  label,
  value,
  tone = "paper",
}: {
  label: string;
  value: string;
  tone?: "paper" | "pink" | "teal";
}) {
  const bg =
    tone === "pink"
      ? "bg-pink"
      : tone === "teal"
        ? "bg-teal"
        : "bg-paper-strong";
  return (
    <div className={`pop-card rounded-md p-3 ${bg}`}>
      <div className="font-display text-[9px] tracking-[0.2em] text-ink/60 uppercase">
        {label}
      </div>
      <div className="font-display text-[24px] leading-none tabular-nums text-ink mt-1">
        {value}
      </div>
    </div>
  );
}

function SignalBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "teal" | "pink" | "yellow" | "muted";
}) {
  const bg =
    tone === "teal"
      ? "bg-teal"
      : tone === "pink"
        ? "bg-pink"
        : tone === "yellow"
          ? "bg-yellow"
          : "bg-paper";
  const textColor = tone === "muted" ? "text-muted" : "text-ink";
  return (
    <span
      className={`border-2 border-ink rounded-sm px-1.5 py-0.5 font-display text-[9px] tracking-wider ${bg} ${textColor}`}
    >
      {children}
    </span>
  );
}
