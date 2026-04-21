import Link from "next/link";
import { notFound } from "next/navigation";
import { Annotation } from "@/components/wireframe/Annotation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { getDemandDrilldown } from "@/app/_actions/admin";
import { formatGBP } from "@/lib/mock/mock-offer";

/**
 * `/admin/demand/[cardId]` · Phase 6 Slice C2.
 *
 * Drill into a single wishlisted card — who wants it, at what price,
 * and what we currently have in stock that could satisfy each target.
 * Lewis can then message the top bidder directly, or list new stock.
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ cardId: string }>;

export default async function DemandDrilldownPage({
  params,
}: {
  params: Params;
}) {
  const { cardId } = await params;
  const data = await getDemandDrilldown(cardId);
  if (!data) notFound();

  // For each wisher, compute the cheapest active listing that meets
  // their target — that's the "match right now" signal.
  const matchFor = (target: number | null) => {
    if (target === null) return null;
    const hit = data.active_listings.find((l) => l.price_gbp <= target);
    return hit ?? null;
  };

  return (
    <div className="px-4 py-6 max-w-[1100px] mx-auto flex flex-col gap-6">
      <nav className="text-[12px] font-display tracking-wider text-muted">
        <Link href="/admin/demand" className="hover:text-pink">
          ← Demand
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <Annotation>ADMIN · DEMAND · CARD</Annotation>
        <h1 className="font-display text-[26px] tracking-tight uppercase">
          {data.card_name}
        </h1>
        <p className="text-[12px] text-secondary">
          {data.set_name}
          {data.dex_number ? ` · #${data.dex_number}` : ""} ·{" "}
          <Link
            href={`/card/${data.card_id}`}
            className="underline decoration-2 underline-offset-2 hover:text-pink"
          >
            view card page
          </Link>{" "}
          ·{" "}
          <Link
            href={`/admin/sourcing?card=${data.card_id}`}
            className="underline decoration-2 underline-offset-2 hover:text-pink"
          >
            who owns it →
          </Link>
        </p>
      </header>

      {/* Current active listings */}
      <section className="flex flex-col gap-2">
        <Annotation>IN STOCK NOW</Annotation>
        {data.active_listings.length === 0 ? (
          <div className="pop-card rounded-md p-4 text-center text-secondary text-[13px]">
            No active listings. Source one to satisfy the demand below.
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Variant</TH>
                <TH className="text-right">Price</TH>
                <TH className="text-right">Qty</TH>
              </TR>
            </THead>
            <TBody>
              {data.active_listings.map((l) => (
                <TR key={l.id}>
                  <TD className="font-mono text-[11px]">{l.sku}</TD>
                  <TD>{l.label}</TD>
                  <TD className="text-right tabular-nums">
                    {formatGBP(l.price_gbp)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {l.qty_available}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      {/* Wishlist holders */}
      <section className="flex flex-col gap-2">
        <Annotation>WHO WANTS IT ({data.wishers.length})</Annotation>
        {data.wishers.length === 0 ? (
          <div className="pop-card rounded-md p-4 text-center text-secondary text-[13px]">
            No wishlist entries for this card.
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Buyer</TH>
                <TH className="text-right">Target</TH>
                <TH>Match</TH>
                <TH>Wished</TH>
              </TR>
            </THead>
            <TBody>
              {data.wishers.map((w) => {
                const match = matchFor(w.target_price_gbp);
                return (
                  <TR key={w.user_id}>
                    <TD>
                      <div className="text-[12px]">
                        {w.user_name ?? "—"}
                      </div>
                      <div className="text-[11px] text-muted">
                        {w.user_email}
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {w.target_price_gbp !== null
                        ? formatGBP(w.target_price_gbp)
                        : (
                          <span className="text-muted italic">
                            no target set
                          </span>
                        )}
                    </TD>
                    <TD>
                      {match ? (
                        <span className="border-2 border-ink rounded-sm px-1.5 py-0.5 font-display text-[10px] tracking-wider bg-teal">
                          MATCH · {formatGBP(match.price_gbp)}
                        </span>
                      ) : w.target_price_gbp === null ? (
                        <span className="font-display text-[10px] text-muted">
                          —
                        </span>
                      ) : (
                        <span className="border-2 border-ink rounded-sm px-1.5 py-0.5 font-display text-[10px] tracking-wider bg-pink">
                          Over target
                        </span>
                      )}
                    </TD>
                    <TD className="text-[11px] text-muted tabular-nums">
                      {new Date(w.created_at)
                        .toISOString()
                        .slice(0, 10)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </section>

      <p className="text-[10px] text-muted font-display tracking-wider">
        Automated email dispatch arrives with Phase 8 — for now, reach
        out manually and mark any deals done.
      </p>
    </div>
  );
}
