/**
 * Phase 3 Slice B · visible source indicator for the buylist offer.
 *
 * Three states:
 *   live    — a row exists in lewis_card_prices; we're using real
 *             TCGplayer market data. Shows variant + freshness.
 *   mock    — sync hasn't produced a price row for this card yet;
 *             the offer is computed from mock baselines.
 *   unmapped (admin-only) — the card isn't in lewis_card_tcg_map so
 *             no sync run will ever produce a price until someone
 *             commits a mapping for its set.
 */

export type PriceSourceStatus = "live" | "mock";

type Props = {
  status: PriceSourceStatus;
  variant?: string | null;
  marketUsd?: number | null;
  sourceUpdatedAt?: string | null;
  /** Admin-visible chip shown when the card has no entry in
   *  lewis_card_tcg_map. Points the operator at /admin/pricing/mapping-preview. */
  adminUnmappedHint?: boolean;
};

export function PriceSourceChip({
  status,
  variant,
  marketUsd,
  sourceUpdatedAt,
  adminUnmappedHint,
}: Props) {
  if (status === "live") {
    return (
      <div className="pop-card rounded-sm bg-teal/30 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-display text-[9px] tracking-[0.25em] bg-ink text-paper-strong px-1.5 py-0.5 rounded-sm">
            LIVE
          </span>
          <span className="font-display text-[11px] tracking-wider text-ink">
            TCGplayer
          </span>
          {variant ? (
            <span className="text-[11px] text-secondary">· {variant}</span>
          ) : null}
          {marketUsd !== null && marketUsd !== undefined ? (
            <span className="font-mono text-[11px] text-secondary tabular-nums">
              · ${marketUsd.toFixed(2)}
            </span>
          ) : null}
        </div>
        <span className="text-[10px] text-muted font-display tracking-wider">
          {formatFreshness(sourceUpdatedAt)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`pop-card rounded-sm px-3 py-2 flex items-center justify-between gap-3 flex-wrap ${
        adminUnmappedHint ? "bg-warn/10" : "bg-yellow/20"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-display text-[9px] tracking-[0.25em] bg-paper-strong border-2 border-ink text-ink px-1.5 py-0.5 rounded-sm">
          MOCK
        </span>
        <span className="text-[11px] text-secondary">
          {adminUnmappedHint
            ? "Card not yet mapped — run /admin/pricing/mapping-preview to fix"
            : "No live sync row yet — offer uses mock baseline"}
        </span>
      </div>
    </div>
  );
}

function formatFreshness(iso: string | null | undefined): string {
  if (!iso) return "freshness unknown";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "freshness unknown";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
