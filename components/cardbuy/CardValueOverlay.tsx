import { formatGBP } from "@/lib/mock/mock-offer";

type Props = {
  offerGbp: number;
  belowMin: boolean;
};

export function CardValueOverlay({ offerGbp, belowMin }: Props) {
  if (belowMin) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center z-10"
      >
        <div className="relative -rotate-[8deg] border-[3px] border-warn rounded-sm bg-yellow/85 px-2.5 py-1.5 shadow-[3px_3px_0_0_rgba(0,0,0,0.18)]">
          <div className="absolute inset-[2px] border-2 border-warn/70 rounded-sm pointer-events-none" />
          <div className="font-display uppercase text-warn text-[10px] tracking-[0.1em] leading-[1.05] text-center">
            Not<br />Buying
          </div>
        </div>
      </div>
    );
  }

  if (offerGbp <= 0) return null;

  return (
    <span className="absolute bottom-1 right-1 pop-card rounded-sm bg-yellow px-2 py-0.5 font-display text-[11px] tracking-wider tabular-nums text-ink z-10">
      {formatGBP(offerGbp)}
    </span>
  );
}
