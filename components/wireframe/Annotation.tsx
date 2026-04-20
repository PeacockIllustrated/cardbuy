import type { ReactNode } from "react";

type AnnotationProps = {
  children: ReactNode;
  inline?: boolean;
  className?: string;
};

/**
 * Section eyebrow label. Styled as a small display-font caps line — kept
 * on admin pages where the IA labels still help Lewis; mostly removed
 * from customer-facing pages in Phase 5 polish.
 */
export function Annotation({ children, inline, className = "" }: AnnotationProps) {
  const base = "font-display text-[10px] tracking-[0.12em] text-secondary";
  const layout = inline ? "inline" : "block";
  return (
    <span className={`${base} ${layout} ${className}`.trim()}>{children}</span>
  );
}
