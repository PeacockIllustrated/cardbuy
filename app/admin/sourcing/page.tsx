import Link from "next/link";
import { Annotation } from "@/components/wireframe/Annotation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { listHoldersOfCard } from "@/app/_actions/admin";
import { searchCards } from "@/lib/fixtures/cards";

/**
 * `/admin/sourcing?card=<id>` · Phase 6 Slice C2.
 *
 * "Someone wants what you have." Lewis picks a card (usually because
 * he has a buyer), this view lists every user whose binder has it so
 * he can message them an enhanced buyback offer.
 *
 * Cross-user visibility rides on the `lewis_binder_entries: admin read`
 * RLS policy already shipped in migration 0006.
 */
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ card?: string; q?: string }>;

export default async function AdminSourcingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const cardId = sp.card;
  const query = sp.q ?? "";

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1200px] mx-auto flex flex-col gap-6">
      <AdminPageHeader
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Sell side" },
          { label: "Sourcing" },
        ]}
        title="Who owns this card?"
        kicker={{ label: "CROSS-BINDER", tone: "pink" }}
        subtitle="Cards live in user binders — use this view when you have a buyer and need to source. Reach out to holders with an enhanced buyback offer."
      />

      <form
        action="/admin/sourcing"
        method="GET"
        className="pop-card rounded-md p-3 flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1">
          <span className="font-display text-[10px] tracking-[0.25em] text-muted">
            Search catalogue
          </span>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="e.g. Charizard"
            className="font-display text-[12px] bg-paper-strong border-2 border-ink rounded-sm px-2 py-1.5"
          />
        </label>
        <button
          type="submit"
          className="pop-block rounded-sm bg-yellow px-3 py-1.5 font-display text-[11px] tracking-wider text-ink self-start"
        >
          Search
        </button>
      </form>

      {query && !cardId ? (
        <SearchResults query={query} />
      ) : cardId ? (
        <HoldersView cardId={cardId} />
      ) : (
        <div className="pop-card rounded-md p-6 text-center text-secondary text-[13px]">
          Search for a card above, or click any row on{" "}
          <Link
            href="/admin/demand"
            className="underline decoration-2 underline-offset-2 hover:text-pink"
          >
            Demand
          </Link>{" "}
          to see holders.
        </div>
      )}
    </div>
  );
}

function SearchResults({ query }: { query: string }) {
  const results = searchCards(query).slice(0, 20);
  if (results.length === 0) {
    return (
      <div className="pop-card rounded-md p-6 text-center text-secondary text-[13px]">
        No cards match &ldquo;{query}&rdquo;.
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <Annotation>CARD RESULTS ({results.length})</Annotation>
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Set</TH>
            <TH>#</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {results.map((c) => {
            const setId = c.id.split("-")[0];
            return (
              <TR key={c.id}>
                <TD>{c.name}</TD>
                <TD className="text-[11px] text-muted">{setId}</TD>
                <TD className="text-[11px] tabular-nums">{c.number}</TD>
                <TD>
                  <Link
                    href={`/admin/sourcing?card=${c.id}`}
                    className="pop-block rounded-sm bg-paper-strong px-2 py-1 font-display text-[10px] tracking-wider text-ink"
                  >
                    See holders →
                  </Link>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </section>
  );
}

async function HoldersView({ cardId }: { cardId: string }) {
  const { card_name, set_name, holders } = await listHoldersOfCard(cardId);

  const totalCopies = holders.reduce((s, h) => s + h.quantity, 0);

  return (
    <>
      <section className="flex flex-col gap-1">
        <Annotation>SELECTED CARD</Annotation>
        <div className="font-display text-[18px] tracking-wider text-ink">
          {card_name}
        </div>
        <div className="text-[11px] text-muted">
          {set_name} ·{" "}
          <Link
            href={`/admin/demand/${cardId}`}
            className="underline decoration-2 underline-offset-2 hover:text-pink"
          >
            demand drilldown →
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Annotation>HOLDERS ({holders.length})</Annotation>
          <span className="font-display text-[10px] tracking-wider text-muted tabular-nums">
            {totalCopies} copies total
          </span>
        </div>
        {holders.length === 0 ? (
          <div className="pop-card rounded-md p-6 text-center text-secondary text-[13px]">
            No users hold this card yet.
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Holder</TH>
                <TH>Variant</TH>
                <TH>Qty</TH>
                <TH>Grail</TH>
                <TH>Source</TH>
                <TH>Acquired</TH>
              </TR>
            </THead>
            <TBody>
              {holders.map((h) => (
                <TR key={`${h.user_id}-${h.variant}-${h.grade ?? h.condition}`}>
                  <TD>
                    <div className="text-[12px]">{h.user_name ?? "—"}</div>
                    <div className="text-[11px] text-muted">
                      {h.user_email}
                    </div>
                  </TD>
                  <TD className="text-[11px]">
                    {h.variant === "raw"
                      ? `Raw · ${h.condition}`
                      : `${h.grading_company} ${h.grade}`}
                  </TD>
                  <TD className="tabular-nums">{h.quantity}</TD>
                  <TD>
                    {h.is_grail ? (
                      <span className="border-2 border-ink rounded-sm px-1.5 py-0.5 font-display text-[10px] bg-yellow">
                        ★ Grail
                      </span>
                    ) : null}
                  </TD>
                  <TD className="text-[11px] font-display tracking-wider text-muted">
                    {h.source}
                  </TD>
                  <TD className="text-[11px] text-muted tabular-nums">
                    {new Date(h.acquired_at).toISOString().slice(0, 10)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </>
  );
}
