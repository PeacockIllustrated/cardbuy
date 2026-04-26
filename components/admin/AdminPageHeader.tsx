import Link from "next/link";
import type { ReactNode } from "react";

export type Crumb = {
  label: string;
  href?: string;
};

type Props = {
  /** Eyebrow breadcrumb trail. First item usually "Admin". */
  crumbs?: Crumb[];
  /** Big page title (will be uppercased via font-display). */
  title: string;
  /** Optional colored tone for a small pill to the right of the title. */
  kicker?: {
    label: string;
    tone: "pink" | "teal" | "yellow" | "paper";
  };
  /** Optional subtitle / explanation under the title. */
  subtitle?: ReactNode;
  /** Right-hand cluster (buttons, sync links, count chips). */
  actions?: ReactNode;
};

const TONE_BG: Record<NonNullable<Props["kicker"]>["tone"], string> = {
  pink: "bg-pink",
  teal: "bg-teal",
  yellow: "bg-yellow",
  paper: "bg-paper-strong",
};

/**
 * Shared header for every /admin/* page. Gives the portal a consistent
 * "you are here" strip: crumbs → title → subtitle · actions.
 */
export function AdminPageHeader({ crumbs, title, kicker, subtitle, actions }: Props) {
  return (
    <header className="flex flex-col gap-3 border-b-2 border-ink/15 pb-4">
      {crumbs && crumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 font-display text-[10px] tracking-[0.2em] text-muted uppercase"
        >
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {c.href && !isLast ? (
                  <Link href={c.href} className="hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-ink" : ""}>{c.label}</span>
                )}
                {!isLast ? <span aria-hidden className="text-muted/60">/</span> : null}
              </span>
            );
          })}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-[26px] md:text-[30px] leading-none tracking-tight">
            {title}
          </h1>
          {kicker ? (
            <span
              className={`border-2 border-ink rounded-sm px-2 py-1 font-display text-[10px] tracking-wider ${TONE_BG[kicker.tone]} text-ink`}
            >
              {kicker.label}
            </span>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {subtitle ? (
        <div className="text-[12px] text-secondary max-w-[72ch]">{subtitle}</div>
      ) : null}
    </header>
  );
}
