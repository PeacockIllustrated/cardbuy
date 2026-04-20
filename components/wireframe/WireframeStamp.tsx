/**
 * Persistent top-right "pre-launch" badge. Brand-styled in Phase 5 but
 * still essential — auth + real prices + payments are still mocked.
 */
export function WireframeStamp() {
  return (
    <div
      className="fixed bottom-3 right-3 z-50 pop-block bg-pink text-ink font-display text-[10px] px-2.5 py-1 rotate-[-2deg] select-none"
      aria-hidden="true"
    >
      PRE-LAUNCH · v0
    </div>
  );
}
