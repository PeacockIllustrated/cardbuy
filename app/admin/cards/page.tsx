import Link from "next/link";
import { Annotation } from "@/components/wireframe/Annotation";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { CardImage } from "@/components/cardbuy/CardImage";
import { MOCK_MARGIN_CONFIG } from "@/lib/mock/mock-margin-config";
import { formatGBP } from "@/lib/mock/mock-offer";
import { getMockCardById } from "@/lib/fixtures/mock-adapter";
import {
  getAllCards,
  CARD_SETS,
  setIdOf,
  getSetsGroupedBySeries,
  LAST_SYNCED,
} from "@/lib/fixtures/cards";

type SearchParams = Promise<{
  set?: string;
  rarity?: string;
  supertype?: string;
  page?: string;
}>;

const PAGE_SIZE = 50;

const ALL = getAllCards();
const RARITIES = Array.from(
  new Set(ALL.map((c) => c.rarity ?? "Promo")),
).sort();
const SUPERTYPES = Array.from(new Set(ALL.map((c) => c.supertype))).sort();
const SERIES_GROUPS = getSetsGroupedBySeries();

function qs(sp: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) usp.set(k, v);
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  let rows = ALL;
  if (sp.set) rows = rows.filter((c) => setIdOf(c) === sp.set);
  if (sp.rarity) rows = rows.filter((c) => (c.rarity ?? "Promo") === sp.rarity);
  if (sp.supertype) rows = rows.filter((c) => c.supertype === sp.supertype);

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const activeSet = sp.set ? CARD_SETS.find((s) => s.id === sp.set) : undefined;
  const hasFilter = Boolean(sp.set || sp.rarity || sp.supertype);

  // Summary stats across the active filter
  const totalConfidence = rows.reduce((sum, c) => {
    const m = getMockCardById(c.id);
    return sum + (m?.sale_count_30d ?? 0);
  }, 0);
  const avgConfidence = rows.length ? Math.round(totalConfidence / rows.length) : 0;

  return (
    <div className="px-5 md:px-4 py-6 max-w-[1300px] mx-auto flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Annotation>ADMIN · CARD CATALOGUE</Annotation>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-[32px] md:text-[40px] leading-none tracking-tight">
            Cards
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="pop-card rounded-sm px-3 py-1.5 text-[11px] font-display tracking-wider">
              {ALL.length.toLocaleString()} total
            </span>
            <span className="pop-card rounded-sm px-3 py-1.5 text-[11px] font-display tracking-wider">
              {rows.length.toLocaleString()} in view
            </span>
            <span className="pop-card rounded-sm px-3 py-1.5 text-[11px] font-display tracking-wider">
              AVG {avgConfidence} SALES / 30D
            </span>
            <span className="pop-card rounded-sm px-3 py-1.5 text-[11px] font-display tracking-wider bg-teal">
              LAST SYNCED {LAST_SYNCED}
            </span>
          </div>
        </div>
      </header>

      {/* Filter row — compact, one line on desktop. Set + rarity are
          dropdowns (172 sets would dominate the page as chips). The
          active set is shown as a breadcrumb-style chip that clears
          the filter when clicked. */}
      <form
        action="/admin/cards"
        method="GET"
        className="pop-card rounded-md p-3 flex flex-col md:flex-row md:items-end gap-3 flex-wrap"
      >
        <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="font-display text-[10px] tracking-[0.2em] uppercase text-muted">
            Pack
          </span>
          <select
            name="set"
            defaultValue={sp.set ?? ""}
            className="border-2 border-ink rounded-sm bg-paper-strong px-2 py-1.5 font-display text-[12px] tracking-wider"
          >
            <option value="">All packs ({ALL.length.toLocaleString()})</option>
            {SERIES_GROUPS.map((g) => (
              <optgroup key={g.series} label={g.series}>
                {g.sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.releaseYear})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 min-w-[160px]">
          <span className="font-display text-[10px] tracking-[0.2em] uppercase text-muted">
            Card type
          </span>
          <select
            name="supertype"
            defaultValue={sp.supertype ?? ""}
            className="border-2 border-ink rounded-sm bg-paper-strong px-2 py-1.5 font-display text-[12px] tracking-wider"
          >
            <option value="">All types</option>
            {SUPERTYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 min-w-[160px]">
          <span className="font-display text-[10px] tracking-[0.2em] uppercase text-muted">
            Rarity
          </span>
          <select
            name="rarity"
            defaultValue={sp.rarity ?? ""}
            className="border-2 border-ink rounded-sm bg-paper-strong px-2 py-1.5 font-display text-[12px] tracking-wider"
          >
            <option value="">Any rarity</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2 items-end">
          <button
            type="submit"
            className="pop-block rounded-md bg-ink text-paper-strong px-3 py-2 font-display text-[11px] tracking-wider uppercase"
          >
            Apply
          </button>
          {hasFilter ? (
            <Link
              href="/admin/cards"
              className="border-2 border-ink rounded-md bg-paper-strong text-ink px-3 py-2 font-display text-[11px] tracking-wider uppercase hover:bg-yellow"
            >
              Clear
            </Link>
          ) : null}
        </div>

        {activeSet ? (
          <div className="w-full flex flex-wrap items-center gap-2 pt-1 border-t-2 border-ink/10 md:border-t-0 md:pt-0 md:ml-auto">
            <span className="font-display text-[10px] tracking-[0.2em] uppercase text-muted">
              Active
            </span>
            <span className="inline-flex items-center gap-2 bg-pink text-ink border-2 border-ink rounded-md px-2 py-1 font-display text-[11px] tracking-wider">
              {activeSet.symbolUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeSet.symbolUrl}
                  alt=""
                  className="w-4 h-4 object-contain"
                />
              ) : null}
              {activeSet.name.toUpperCase()} · {activeSet.releaseYear}
            </span>
          </div>
        ) : null}
      </form>

      <Table>
        <THead>
          <TR>
            <TH className="w-[60px]">Art</TH>
            <TH>Card</TH>
            <TH>Set</TH>
            <TH>Rarity</TH>
            <TH>Type</TH>
            <TH className="text-right">Raw NM (USD)</TH>
            <TH className="text-right">Raw NM (GBP)</TH>
            <TH>Confidence</TH>
            <TH>Last synced</TH>
          </TR>
        </THead>
        <TBody>
          {paged.map((card) => {
            const mock = getMockCardById(card.id);
            const usd = mock?.raw_prices.NM?.market ?? 0;
            const gbp = usd * MOCK_MARGIN_CONFIG.fx_rate_usd_gbp;
            const lowConf = (mock?.sale_count_30d ?? 0) < MOCK_MARGIN_CONFIG.confidence_threshold;
            return (
              <TR key={card.id}>
                <TD className="align-middle">
                  <Link href={`/card/${card.id}`} className="block w-[44px]">
                    <CardImage
                      src={card.images.small}
                      alt={card.name}
                      size="sm"
                      hideBadge
                      rarity={card.rarity}
                      className="!w-[44px]"
                    />
                  </Link>
                </TD>
                <TD>
                  <Link
                    href={`/card/${card.id}`}
                    className="font-display tracking-tight text-[13px] hover:text-pink"
                  >
                    {card.name}
                  </Link>
                  <div className="text-[11px] text-muted">#{card.number}</div>
                </TD>
                <TD className="text-[12px]">
                  {CARD_SETS.find((s) => s.id === setIdOf(card))?.name ?? setIdOf(card)}
                </TD>
                <TD className="text-[12px]">{card.rarity ?? "—"}</TD>
                <TD className="text-[12px]">
                  {card.types?.join(", ") ?? card.supertype}
                </TD>
                <TD className="text-right tabular-nums">${usd.toFixed(2)}</TD>
                <TD className="text-right tabular-nums">{formatGBP(gbp)}</TD>
                <TD className="text-[12px]">
                  {mock?.sale_count_30d ?? 0} / 30d{" "}
                  {lowConf ? (
                    <span className="text-warn text-[10px] font-display tracking-wider">
                      [LOW]
                    </span>
                  ) : null}
                </TD>
                <TD className="text-muted text-[11px] tabular-nums">{LAST_SYNCED}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      {/* Pagination */}
      <div className="border-t-2 border-ink/20 pt-4 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[11px] text-muted font-display tracking-wider">
          Showing {(currentPage - 1) * PAGE_SIZE + 1}–
          {Math.min(currentPage * PAGE_SIZE, rows.length)} of {rows.length.toLocaleString()}
        </span>
        <div className="flex gap-2">
          <Link
            href={`/admin/cards${qs({ ...sp, page: String(Math.max(1, currentPage - 1)) })}`}
            aria-disabled={currentPage <= 1}
            className={`border-2 border-ink rounded-sm px-3 py-1.5 font-display text-[11px] tracking-wider ${
              currentPage <= 1 ? "text-muted border-rule pointer-events-none" : "hover:bg-yellow"
            }`}
          >
            ← PREV
          </Link>
          <span className="self-center text-[11px] font-display tracking-wider text-muted">
            PAGE {currentPage} / {pageCount}
          </span>
          <Link
            href={`/admin/cards${qs({ ...sp, page: String(Math.min(pageCount, currentPage + 1)) })}`}
            aria-disabled={currentPage >= pageCount}
            className={`border-2 border-ink rounded-sm px-3 py-1.5 font-display text-[11px] tracking-wider ${
              currentPage >= pageCount ? "text-muted border-rule pointer-events-none" : "hover:bg-yellow"
            }`}
          >
            NEXT →
          </Link>
        </div>
      </div>
    </div>
  );
}
