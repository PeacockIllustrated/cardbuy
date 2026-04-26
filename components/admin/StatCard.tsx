import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "paper" | "pink" | "teal" | "yellow" | "warn" | "ink";

type Props = {
  label: string;
  value: string | number;
  /** Optional secondary line under the value (e.g. "of 128"). */
  sub?: ReactNode;
  /** Background tone. Defaults to paper. */
  tone?: Tone;
  /** If provided, the whole card becomes a link — keeps routes obvious. */
  href?: string;
};

const TONE_BG: Record<Tone, string> = {
  paper: "bg-paper-strong",
  pink: "bg-pink",
  teal: "bg-teal",
  yellow: "bg-yellow",
  warn: "bg-warn text-paper-strong",
  ink: "bg-ink text-paper-strong",
};

/**
 * Shared KPI tile for admin pages. Replaces the three ad-hoc
 * Stat/StatBlock/Tile implementations that were scattered across
 * dashboard, orders, users, sync, etc.
 */
export function StatCard({ label, value, sub, tone = "paper", href }: Props) {
  const valueText = tone === "warn" || tone === "ink" ? "" : "text-ink";
  const labelText =
    tone === "warn" || tone === "ink" ? "text-paper-strong/70" : "text-ink/60";

  const body = (
    <div
      className={`pop-card rounded-md p-3 flex flex-col gap-1 transition-shadow ${TONE_BG[tone]} ${
        href ? "hover:shadow-[5px_5px_0_0_var(--color-ink)]" : ""
      }`}
    >
      <div
        className={`font-display text-[9px] tracking-[0.22em] uppercase ${labelText}`}
      >
        {label}
      </div>
      <div
        className={`font-display text-[24px] leading-none tabular-nums ${valueText}`}
      >
        {value}
      </div>
      {sub ? (
        <div
          className={`text-[11px] tabular-nums ${
            tone === "warn" || tone === "ink"
              ? "text-paper-strong/70"
              : "text-muted"
          }`}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
