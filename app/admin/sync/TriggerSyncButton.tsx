"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Form";
import { triggerPriceSync } from "@/app/_actions/prices";

type Result = Awaited<ReturnType<typeof triggerPriceSync>>;

export function TriggerSyncButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function go() {
    setResult(null);
    startTransition(async () => {
      const r = await triggerPriceSync();
      setResult(r);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 items-center flex-wrap">
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={go}
        >
          {pending
            ? "Syncing prices… this takes ~20s"
            : "Run sync now →"}
        </Button>
        <span className="text-[11px] text-muted font-display tracking-wider">
          Hits TCGCSV for all 215 sets · upserts{" "}
          <code className="font-mono">lewis_cards</code> +{" "}
          <code className="font-mono">lewis_card_prices</code>.
        </span>
      </div>

      {result && result.ok ? (
        <div
          className={`pop-card rounded-md p-4 flex flex-col gap-1 text-[12px] ${
            result.status === "success"
              ? "bg-teal/20"
              : result.status === "partial"
                ? "bg-yellow/20"
                : "bg-warn/10"
          }`}
        >
          <span className="font-display text-[11px] tracking-wider uppercase">
            Run {result.status} · {(result.durationMs / 1000).toFixed(1)}s
          </span>
          <div className="font-mono text-[11px] tabular-nums text-secondary">
            {result.setsProcessed} sets · {result.cardsUpserted} cards ·{" "}
            {result.pricesUpserted} prices
          </div>
        </div>
      ) : null}

      {result && !result.ok ? (
        <div className="bg-warn/10 border-2 border-warn text-warn rounded-md px-3 py-2 text-[12px]">
          {result.error}
        </div>
      ) : null}
    </div>
  );
}
