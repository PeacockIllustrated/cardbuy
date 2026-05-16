/**
 * Small coloured chip rendering an energy type. Pokémon TCG cards have
 * ~11 canonical types; we map each to one of the three brand accents
 * (ocean / wave / sun) plus paper/ink so the chips read on-brand.
 *
 * Used for type badges on `/card/[id]` and for attack energy-cost pips.
 */

const TYPE_ACCENT: Record<string, string> = {
  Fire:       "bg-ocean text-ink",
  Fighting:   "bg-ocean text-ink",
  Dragon:     "bg-ocean text-ink",
  Water:      "bg-wave text-ink",
  Psychic:    "bg-wave text-ink",
  Ice:        "bg-wave text-ink",
  Lightning:  "bg-sun text-ink",
  Grass:      "bg-sun text-ink",
  Fairy:      "bg-sun text-ink",
  Darkness:   "bg-ink text-paper-strong",
  Metal:      "bg-ink text-paper-strong",
  Colorless:  "bg-paper-strong text-ink",
};

function accentFor(type: string): string {
  return TYPE_ACCENT[type] ?? "bg-paper-strong text-ink";
}

type Props = {
  type: string;
  size?: "sm" | "md";
  className?: string;
};

export function EnergyChip({ type, size = "sm", className = "" }: Props) {
  const dims = size === "md"
    ? "h-7 min-w-7 px-2 text-[11px]"
    : "h-5 min-w-5 px-1.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center justify-center border-2 border-ink rounded-full font-display tracking-wider ${dims} ${accentFor(type)} ${className}`.trim()}
      title={type}
    >
      {type.slice(0, 3).toUpperCase()}
    </span>
  );
}

export function EnergyCostRow({ cost }: { cost?: string[] }) {
  if (!cost || cost.length === 0) {
    return <span className="text-[10px] text-muted font-display tracking-wider">FREE</span>;
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {cost.map((t, i) => (
        <EnergyChip key={`${t}-${i}`} type={t} />
      ))}
    </span>
  );
}
