"use client";

import { useState, useTransition } from "react";
import { commitMappingsForSet } from "@/app/_actions/prices";

/**
 * Per-set commit button on the mapping-preview page. Runs the same
 * deterministic mapper server-side and UPSERTs rows into
 * `lewis_card_tcg_map`. Rows already flagged `source='manual-override'`
 * are preserved.
 */
export function CommitMappingButton({
  setId,
  matchedCount,
  disabled,
}: {
  setId: string;
  matchedCount: number;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<null | {
    ok: boolean;
    text: string;
  }>(null);

  const handleClick = () => {
    if (pending) return;
    setResult(null);
    start(async () => {
      const res = await commitMappingsForSet(setId);
      if (res.ok) {
        setResult({
          ok: true,
          text:
            res.writtenCount === 0
              ? `No changes (${res.skippedManualOverrides} manual-override rows preserved)`
              : `Committed ${res.writtenCount} of ${res.matchedTotal}${
                  res.skippedManualOverrides > 0
                    ? ` · ${res.skippedManualOverrides} manual kept`
                    : ""
                }`,
        });
      } else {
        setResult({ ok: false, text: res.error });
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending || matchedCount === 0}
        className="pop-block rounded-sm bg-teal px-3 py-1 font-display text-[11px] tracking-wider text-ink disabled:opacity-40 disabled:cursor-not-allowed"
        title={
          matchedCount === 0
            ? "Nothing to commit"
            : `Upsert ${matchedCount} rows into lewis_card_tcg_map`
        }
      >
        {pending ? "Committing…" : "Commit →"}
      </button>
      {result ? (
        <span
          role="status"
          className={`font-display text-[10px] tracking-wider ${
            result.ok ? "text-teal" : "text-warn"
          }`}
        >
          {result.text}
        </span>
      ) : null}
    </div>
  );
}
