"use client";

import { useState, useTransition } from "react";
import { triggerFxSync } from "@/app/_actions/prices";

/**
 * Admin-only manual trigger for the FX sync. The nightly cron at
 * 02:00 UTC handles the usual case; this is for "we just changed the
 * manual-override toggle and want fresh numbers now" moments.
 */
export function FxSyncButton({
  lastUpdatedAt,
  manualOverride,
}: {
  lastUpdatedAt: string | null;
  manualOverride: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<null | {
    ok: boolean;
    text: string;
  }>(null);

  const handleClick = () => {
    setResult(null);
    start(async () => {
      const res = await triggerFxSync();
      if (!res.ok) {
        setResult({ ok: false, text: res.error });
        return;
      }
      if (res.status === "skipped") {
        setResult({
          ok: true,
          text: `Skipped — ${res.reason ?? "manual override active"}`,
        });
        return;
      }
      if (res.status === "failed") {
        setResult({
          ok: false,
          text: `Failed — ${res.reason ?? "see sync log"}`,
        });
        return;
      }
      setResult({
        ok: true,
        text: `USD→GBP ${res.usdGbp?.toFixed(4) ?? "?"}${
          res.usdEur ? ` · USD→EUR ${res.usdEur.toFixed(4)}` : ""
        }`,
      });
    });
  };

  return (
    <div className="pop-card rounded-md bg-paper-strong px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="font-display text-[10px] tracking-[0.25em] text-muted">
          FX rate
        </div>
        <div className="text-[11px] text-secondary">
          {lastUpdatedAt
            ? `Last refreshed ${new Date(lastUpdatedAt).toISOString().slice(0, 16).replace("T", " ")} UTC`
            : "Never refreshed — click Run FX sync to fetch current rates."}
          {manualOverride ? (
            <>
              {" · "}
              <span className="text-warn">
                manual override ON
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
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
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="pop-block rounded-sm bg-yellow px-3 py-1.5 font-display text-[11px] tracking-wider text-ink disabled:opacity-50"
          title="Fetch current USD rates from open.er-api.com"
        >
          {pending ? "Fetching…" : "Run FX sync"}
        </button>
      </div>
    </div>
  );
}
