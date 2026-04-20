import type { ReactNode } from "react";

type GridOverlayProps = {
  /** Pixel size of one grid cell. */
  size?: number;
  /** Aspect ratio "WxH" for empty zones, e.g. "16/9". */
  aspect?: string;
  /** Optional label rendered centred over the grid. */
  label?: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Dashed-grid background for content-TBD zones.
 * Use when the layout slot exists but the content design is deferred.
 */
export function GridOverlay({
  size = 16,
  aspect,
  label,
  children,
  className = "",
}: GridOverlayProps) {
  const dash = `repeating-linear-gradient(0deg, transparent 0 ${size - 1}px, #e5e5e5 ${
    size - 1
  }px ${size}px), repeating-linear-gradient(90deg, transparent 0 ${
    size - 1
  }px, #e5e5e5 ${size - 1}px ${size}px)`;

  return (
    <div
      className={`relative border border-rule flex items-center justify-center text-muted text-[11px] uppercase tracking-wider ${className}`.trim()}
      style={{ backgroundImage: dash, aspectRatio: aspect }}
    >
      {label ? <span>[{label}]</span> : null}
      {children}
    </div>
  );
}
