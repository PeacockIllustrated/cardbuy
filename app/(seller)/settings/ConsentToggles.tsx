"use client";

import { useState, useTransition } from "react";
import {
  updateConsent,
  type ConsentField,
  type ConsentSnapshot,
} from "@/app/_actions/consent";

type ToggleRow = {
  field: ConsentField;
  title: string;
  description: string;
};

const TOGGLES: ToggleRow[] = [
  {
    field: "consent_marketing_buylist",
    title: "Buylist offers",
    description:
      "Targeted buyback offers when we're actively sourcing a card you own. Low volume, high relevance.",
  },
  {
    field: "consent_marketing_shop",
    title: "Shop alerts",
    description:
      "Ping me when a card on my wishlist arrives in stock, or when I'm near a master set. At most one email per fortnight per card.",
  },
  {
    field: "consent_aggregate_data",
    title: "Anonymous pricing data",
    description:
      "Let us include your collection's anonymised composition in the pricing intelligence models. Nothing that identifies you or your holdings leaves this use.",
  },
];

export function ConsentToggles({ initial }: { initial: ConsentSnapshot }) {
  const [state, setState] = useState({
    consent_marketing_buylist: initial.consent_marketing_buylist,
    consent_marketing_shop: initial.consent_marketing_shop,
    consent_aggregate_data: initial.consent_aggregate_data,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (field: ConsentField) => {
    setError(null);
    const next = !state[field];
    setState((s) => ({ ...s, [field]: next }));
    start(async () => {
      try {
        await updateConsent(field, next);
      } catch (e) {
        setState((s) => ({ ...s, [field]: !next }));
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {TOGGLES.map((t) => {
        const on = state[t.field];
        return (
          <button
            key={t.field}
            type="button"
            onClick={() => handleToggle(t.field)}
            disabled={pending}
            aria-pressed={on}
            className={`pop-block rounded-sm text-left px-4 py-3 flex items-start gap-3 disabled:opacity-70 ${
              on ? "bg-teal" : "bg-paper-strong"
            }`}
          >
            <span
              className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 border-2 border-ink rounded-sm font-display text-[12px] ${
                on ? "bg-ink text-paper-strong" : "bg-paper-strong"
              }`}
              aria-hidden
            >
              {on ? "✓" : ""}
            </span>
            <span className="flex flex-col gap-1 min-w-0">
              <span className="font-display text-[12px] tracking-wider text-ink flex items-center gap-2">
                {t.title}
                <span className="font-display text-[9px] tracking-[0.2em] text-ink/60">
                  {on ? "ON" : "OFF"}
                </span>
              </span>
              <span className="text-[11px] text-ink/80 leading-snug">
                {t.description}
              </span>
            </span>
          </button>
        );
      })}

      {/* Transactional — fixed ON, informational row. */}
      <div
        className="pop-card rounded-sm bg-paper px-4 py-3 flex items-start gap-3"
        aria-disabled
      >
        <span
          className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 border-2 border-ink rounded-sm font-display text-[12px] bg-ink text-paper-strong"
          aria-hidden
        >
          ✓
        </span>
        <span className="flex flex-col gap-1 min-w-0">
          <span className="font-display text-[12px] tracking-wider text-ink flex items-center gap-2">
            Service emails
            <span className="font-display text-[9px] tracking-[0.2em] text-ink/60">
              REQUIRED
            </span>
          </span>
          <span className="text-[11px] text-secondary leading-snug">
            Submission + order confirmations, shipping updates, payout
            notifications. Cannot be disabled without deleting your account.
          </span>
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          className="text-[11px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-2 py-1"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
