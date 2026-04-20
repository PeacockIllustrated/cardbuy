"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  series: string[];
};

/**
 * Sticky in-page nav for /packs. Clicking a chip smooth-scrolls to
 * the matching series section (`#series-<slug>`). On scroll, the
 * visible section's chip gets a pink highlight so the reader always
 * knows where they are in the 17-series stack.
 */
export function PacksChipNav({ series }: Props) {
  const [active, setActive] = useState<string>(series[0]);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sections = series
      .map((s) => document.getElementById(`series-${slug(s)}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top that's still visible.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]?.target.id) {
          const id = visible[0].target.id.replace(/^series-/, "");
          const s = series.find((x) => slug(x) === id);
          if (s) setActive(s);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [series]);

  // Keep the active chip scrolled into view inside the horizontal bar.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const el = bar.querySelector<HTMLAnchorElement>(
      `[data-series="${active}"]`,
    );
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [active]);

  return (
    <div className="sticky top-[53px] md:top-[57px] z-20 bg-paper border-b-[3px] border-ink">
      <div
        ref={barRef}
        className="max-w-[1300px] mx-auto px-3 md:px-4 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none"
      >
        {series.map((s) => {
          const isActive = s === active;
          return (
            <a
              key={s}
              href={`#series-${slug(s)}`}
              data-series={s}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(`series-${slug(s)}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActive(s);
                }
              }}
              className={`shrink-0 font-display text-[10px] md:text-[11px] tracking-[0.15em] uppercase px-2.5 py-1.5 border-2 transition-colors rounded-sm ${
                isActive
                  ? "bg-pink border-ink text-ink"
                  : "bg-paper-strong border-ink text-ink hover:bg-yellow"
              }`}
            >
              {s}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
