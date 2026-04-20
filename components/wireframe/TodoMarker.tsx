import type { ReactNode } from "react";

type TodoMarkerProps = {
  phase: 2 | 3 | 4 | 5;
  children: ReactNode;
  className?: string;
};

/**
 * No-op in production. Historically rendered a yellow dev chip flagging
 * work deferred to a later phase; kept as a component so call sites can
 * stay in place while the badges are hidden from end users.
 */
export function TodoMarker(_props: TodoMarkerProps) {
  return null;
}
