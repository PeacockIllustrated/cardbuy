import type { ReactNode } from "react";

type Props = {
  /** Small eyebrow label above the section title. */
  eyebrow?: string;
  /** Bolder title — optional (omit for an unlabeled card). */
  title?: string;
  /** Right-hand cluster — e.g. "View all →" or action buttons. */
  actions?: ReactNode;
  children: ReactNode;
  /** Drop the inner padding if a table should go edge-to-edge. */
  padded?: boolean;
  className?: string;
};

/**
 * Consistent labeled container for admin sections. Wraps any content
 * in a pop-card with a header row (eyebrow + title + actions).
 */
export function SectionCard({
  eyebrow,
  title,
  actions,
  children,
  padded = true,
  className = "",
}: Props) {
  const hasHeader = eyebrow || title || actions;
  return (
    <section
      className={`pop-card rounded-md flex flex-col ${padded ? "p-4" : ""} ${className}`}
    >
      {hasHeader ? (
        <div
          className={`flex items-end justify-between gap-3 flex-wrap ${
            padded ? "" : "px-4 pt-4"
          } ${children ? (padded ? "mb-3" : "mb-2") : ""}`}
        >
          <div className="flex flex-col gap-0.5">
            {eyebrow ? (
              <span className="font-display text-[10px] tracking-[0.22em] uppercase text-muted">
                {eyebrow}
              </span>
            ) : null}
            {title ? (
              <h2 className="font-display text-[16px] tracking-tight leading-none">
                {title}
              </h2>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
