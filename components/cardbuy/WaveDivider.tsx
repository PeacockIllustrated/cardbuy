/**
 * Aqua TCG wave motif — a full-bleed decorative crest used at section
 * seams (header base, hero→content, footer top). Purpose-built path,
 * not lifted from the logo (the logo is a mark, not a tileable strip).
 *
 * The path fills everything BELOW the crest, so the band reads as the
 * `fill` colour rising into whatever sits above it. `flip` mirrors it
 * vertically for a top-edge crest (e.g. the footer).
 *
 * Decorative only — `aria-hidden`, no pointer surface.
 */
export function WaveDivider({
  fill = "var(--color-ocean)",
  height = 24,
  flip = false,
  className = "",
}: {
  fill?: string;
  height?: number;
  flip?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`w-full overflow-hidden leading-[0] pointer-events-none ${flip ? "rotate-180" : ""} ${className}`.trim()}
      style={{ height }}
    >
      <svg
        viewBox="0 0 1200 40"
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
      >
        <path
          d="M0,18 C150,38 280,2 440,16 C600,30 740,40 900,22 C1040,6 1140,14 1200,20 L1200,40 L0,40 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
