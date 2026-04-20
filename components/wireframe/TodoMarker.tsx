import type { ReactNode } from "react";

type TodoMarkerProps = {
  phase: 2 | 3 | 4 | 5;
  children: ReactNode;
  className?: string;
};

/**
 * Yellow tape chip — flags work that lands in a future phase.
 * Inline-only; doesn't disrupt layout flow.
 */
export function TodoMarker({ phase, children, className = "" }: TodoMarkerProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 bg-yellow text-ink border-2 border-ink px-2 py-0.5 text-[11px] font-display tracking-wider ${className}`.trim()}
    >
      <span className="opacity-70">P{phase}</span>
      <span>{children}</span>
    </span>
  );
}
