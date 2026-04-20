type ImagePlaceholderProps = {
  w: number;
  h: number;
  /** Override the default "Card art" label. */
  label?: string;
  /** Force a specific accent. Otherwise rotates by hash of label+dims. */
  accent?: "pink" | "teal" | "yellow" | "paper-strong";
  className?: string;
};

const ACCENTS = ["pink", "teal", "yellow"] as const;

function pickAccent(seed: string): (typeof ACCENTS)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

const ACCENT_BG: Record<NonNullable<ImagePlaceholderProps["accent"]>, string> = {
  pink: "bg-pink",
  teal: "bg-teal",
  yellow: "bg-yellow",
  "paper-strong": "bg-paper-strong",
};

/**
 * Card-art well: chunky ink-outlined accent block standing in for a real
 * card image. Phase 1 forbade real card imagery (copyright); Phase 5 keeps
 * the placeholder but dresses it as a deliberate brand element.
 */
export function ImagePlaceholder({
  w,
  h,
  label = "Card art",
  accent,
  className = "",
}: ImagePlaceholderProps) {
  const chosen = accent ?? pickAccent(`${label}-${w}-${h}`);
  return (
    <div
      className={`relative flex items-center justify-center border-[3px] border-ink rounded-md overflow-hidden ${ACCENT_BG[chosen]} ${className}`.trim()}
      style={{ width: w, height: h, maxWidth: "100%" }}
      role="img"
      aria-label={`${label} placeholder ${w} by ${h}`}
    >
      {/* Inner white well so the silhouette looks like a card sleeve */}
      <div className="absolute inset-2 bg-paper-strong border-2 border-ink rounded-sm flex items-center justify-center">
        <span className="font-display text-[11px] tracking-wider text-ink/70 px-1 text-center leading-tight">
          {label}
        </span>
      </div>
    </div>
  );
}
