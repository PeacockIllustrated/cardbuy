"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type {
  Condition,
  Grade,
  GradingCompany,
  MockCard,
  MockMarginConfig,
} from "@/lib/mock/types";
import { computeMockOffer, formatGBP } from "@/lib/mock/mock-offer";
import { Button, Field, Select } from "@/components/ui/Form";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import { addSubmissionItem } from "@/app/_actions/submission";

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];
const COMPANIES: GradingCompany[] = ["PSA", "CGC", "BGS", "SGC", "ACE"];
const GRADES: Grade[] = ["10", "9.5", "9", "8.5", "8", "7"];

type Props = {
  card: MockCard;
  config: MockMarginConfig;
  /** Current auth state — drives the CTA label and action target. */
  isAuthenticated: boolean;
  /** Initial selection, driven by `?prefill_*` query params (used by the
   *  binder's "Sell this card" action so the picker lands pre-configured). */
  prefill?: {
    variant?: "raw" | "graded";
    condition?: Condition;
    company?: GradingCompany;
    grade?: Grade;
  };
};

export function OfferBuilder({
  card,
  config,
  isAuthenticated,
  prefill,
}: Props) {
  const hasGraded = Object.keys(card.graded_prices).length > 0;
  const [variant, setVariant] = useState<"raw" | "graded">(
    prefill?.variant ?? "raw",
  );
  const [condition, setCondition] = useState<Condition>(
    prefill?.condition ?? "NM",
  );
  const [company, setCompany] = useState<GradingCompany>(
    prefill?.company ??
      ((Object.keys(card.graded_prices)[0] as GradingCompany) ?? "PSA"),
  );
  const [grade, setGrade] = useState<Grade>(prefill?.grade ?? "10");
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offer = useMemo(
    () =>
      computeMockOffer(
        card,
        variant === "raw"
          ? { variant: "raw", condition }
          : { variant: "graded", company, grade },
        config,
      ),
    [card, config, variant, condition, company, grade],
  );

  function handleAdd() {
    setError(null);
    setAdded(false);
    startTransition(async () => {
      try {
        await addSubmissionItem({
          cardId: card.id,
          variant,
          condition: variant === "raw" ? condition : undefined,
          gradingCompany: variant === "graded" ? company : undefined,
          grade: variant === "graded" ? grade : undefined,
          quantity: qty,
          offeredAmountPer: offer.offerGbp,
          offerBreakdown: {
            baselineGbp: offer.baselineGbp,
            multiplierLabel: offer.multiplierLabel,
            marginLabel: offer.marginLabel,
            saleCount: offer.saleCount,
            lowConfidence: offer.lowConfidence,
            variant,
            condition: variant === "raw" ? condition : null,
            gradingCompany: variant === "graded" ? company : null,
            grade: variant === "graded" ? grade : null,
          },
        });
        setAdded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add");
      }
    });
  }

  return (
    <div className="pop-card rounded-lg p-5 flex flex-col gap-5">
      {/* Variant tabs */}
      <div
        role="tablist"
        className="flex border-[3px] border-ink rounded-md w-fit overflow-hidden"
      >
        <button
          role="tab"
          aria-selected={variant === "raw"}
          onClick={() => setVariant("raw")}
          className={`px-4 py-2 font-display text-[12px] tracking-wider transition-colors ${
            variant === "raw"
              ? "bg-ink text-paper-strong"
              : "bg-paper-strong text-ink hover:bg-yellow"
          }`}
        >
          Raw
        </button>
        <button
          role="tab"
          aria-selected={variant === "graded"}
          onClick={() => setVariant("graded")}
          disabled={!hasGraded}
          title={hasGraded ? undefined : "No graded sales for this card"}
          className={`px-4 py-2 font-display text-[12px] tracking-wider border-l-[3px] border-ink transition-colors ${
            variant === "graded"
              ? "bg-ink text-paper-strong"
              : "bg-paper-strong text-ink hover:bg-yellow"
          } disabled:text-muted disabled:cursor-not-allowed disabled:hover:bg-paper-strong`}
        >
          Graded
        </button>
      </div>

      {variant === "raw" ? (
        <Field label="Condition">
          <Select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {labelFor(c)}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grading company">
            <Select
              value={company}
              onChange={(e) => setCompany(e.target.value as GradingCompany)}
            >
              {COMPANIES.map((c) => (
                <option key={c} value={c} disabled={!card.graded_prices[c]}>
                  {c}
                  {card.graded_prices[c] ? "" : " (no data)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grade">
            <Select
              value={grade}
              onChange={(e) => setGrade(e.target.value as Grade)}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <Field label="Quantity">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setQty(Math.max(1, qty - 1))}
          >
            −
          </Button>
          <span className="font-display text-[18px] min-w-12 text-center tabular-nums">
            {qty}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setQty(qty + 1)}
          >
            +
          </Button>
        </div>
      </Field>

      {/* Offer headline */}
      <div className="border-t-[3px] border-ink pt-5 flex flex-col gap-3">
        <div className="relative bg-yellow border-[3px] border-ink rounded-md p-4 flex flex-col gap-1 overflow-hidden">
          <span className="font-display text-[10px] tracking-wider text-ink/70">
            {offer.belowMin ? "Value" : "Our offer"}
          </span>
          <div className="font-display text-[44px] leading-none tabular-nums">
            {formatGBP(offer.offerGbp * qty)}
          </div>
          <div className="text-[11px] text-secondary leading-snug">
            Market baseline {formatGBP(offer.baselineGbp)} ·{" "}
            {offer.multiplierLabel} · {offer.marginLabel} ={" "}
            {formatGBP(offer.offerGbp)} per card
          </div>

          {offer.belowMin ? (
            <div
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-[-8deg]"
            >
              <div className="relative border-[4px] border-warn text-warn px-3 py-2 rounded-sm bg-yellow/80 shadow-[3px_3px_0_0_rgba(0,0,0,0.15)]">
                <div className="absolute inset-[3px] border-2 border-warn/70 rounded-sm pointer-events-none" />
                <div className="font-display uppercase text-[12px] tracking-[0.08em] leading-tight text-center">
                  Sorry<br />
                  under buy<br />
                  threshold
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {offer.belowMin ? (
          <div className="text-[11px] text-muted leading-snug">
            Below our minimum buy price of {formatGBP(config.min_buy_price)} —
            we can&apos;t buy this card right now, but the market value is
            shown for reference.
          </div>
        ) : null}

        <div className="text-[11px] text-muted">
          Based on {offer.saleCount} recent sales ·{" "}
          {offer.lowConfidence
            ? "low confidence — manual review"
            : "high confidence"}
        </div>
        <TodoMarker phase={3}>real pricing engine</TodoMarker>
      </div>

      {error ? (
        <div className="bg-warn/10 border-2 border-warn text-warn rounded-md px-3 py-2 text-[12px]">
          {error}
        </div>
      ) : null}

      {added ? (
        <div className="bg-teal/20 border-2 border-ink rounded-md px-3 py-3 flex items-center justify-between gap-3">
          <span className="font-display text-[13px] tracking-tight">
            Added to submission ✓
          </span>
          <Link
            href="/submission"
            className="font-display text-[11px] tracking-wider underline underline-offset-4 decoration-2 hover:text-pink"
          >
            View submission →
          </Link>
        </div>
      ) : isAuthenticated ? (
        <Button
          size="lg"
          disabled={offer.belowMin || pending}
          className="w-full"
          onClick={handleAdd}
        >
          {pending ? "Adding…" : "Add to submission →"}
        </Button>
      ) : (
        <Link
          href={`/login?next=/card/${card.id}`}
          className="block"
        >
          <Button size="lg" className="w-full" disabled={offer.belowMin}>
            Sign in to add →
          </Button>
        </Link>
      )}
    </div>
  );
}

function labelFor(c: Condition): string {
  switch (c) {
    case "NM":
      return "Near Mint (NM)";
    case "LP":
      return "Lightly Played (LP)";
    case "MP":
      return "Moderately Played (MP)";
    case "HP":
      return "Heavily Played (HP)";
    case "DMG":
      return "Damaged (DMG)";
  }
}
