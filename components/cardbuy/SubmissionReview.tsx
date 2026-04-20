"use client";

import { useMemo, useState } from "react";
import type { Condition, MockSubmission } from "@/lib/mock/types";
import { formatGBP } from "@/lib/mock/mock-offer";
import { Annotation } from "@/components/wireframe/Annotation";
import { Button, Select } from "@/components/ui/Form";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

/**
 * `offerByCondition[itemId]` — every possible per-unit offer for a raw
 * item, pre-computed server-side so this client component can recalc on
 * condition downgrade without pulling the server-only fixture into the
 * browser bundle.
 */
export type ConditionOfferMap = Record<string, Partial<Record<Condition, number>>>;

export function SubmissionReview({
  submission,
  offerByCondition,
}: {
  submission: MockSubmission;
  offerByCondition: ConditionOfferMap;
}) {
  const [verifiedConditions, setVerifiedConditions] = useState<Record<string, Condition | "">>(
    Object.fromEntries(submission.items.map((i) => [i.id, ""]))
  );

  const lines = useMemo(() => {
    return submission.items.map((item) => {
      const verified = verifiedConditions[item.id];
      let revisedPer = item.offered_amount_per;

      if (verified && item.variant === "raw") {
        const fromMap = offerByCondition[item.id]?.[verified];
        if (typeof fromMap === "number") revisedPer = fromMap;
      }

      return {
        ...item,
        verified,
        revisedPer,
        revisedTotal: +(revisedPer * item.quantity).toFixed(2),
      };
    });
  }, [submission.items, verifiedConditions, offerByCondition]);

  const adjustedTotal = lines.reduce((s, l) => s + l.revisedTotal, 0);
  const delta = adjustedTotal - submission.total_offered;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6 items-start">
      <div className="flex flex-col gap-3">
        <Annotation>CARDS · verify on arrival</Annotation>
        <Table>
          <THead>
            <TR>
              <TH>Card</TH>
              <TH>Declared</TH>
              <TH>Verified condition</TH>
              <TH>Qty</TH>
              <TH className="text-right">Per (revised)</TH>
              <TH className="text-right">Line (revised)</TH>
            </TR>
          </THead>
          <TBody>
            {lines.map((l) => (
              <TR key={l.id}>
                <TD>
                  <div className="text-[13px]">{l.card_name}</div>
                  <div className="text-[11px] text-muted">{l.set_name}</div>
                </TD>
                <TD>
                  {l.variant === "raw"
                    ? `Raw · ${l.condition}`
                    : `Graded · ${l.grading_company} ${l.grade}`}
                </TD>
                <TD>
                  {l.variant === "raw" ? (
                    <Select
                      value={l.verified ?? ""}
                      onChange={(e) =>
                        setVerifiedConditions((prev) => ({
                          ...prev,
                          [l.id]: e.target.value as Condition | "",
                        }))
                      }
                    >
                      <option value="">— as declared —</option>
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="text-[11px] text-muted">[graded · no downgrade]</span>
                  )}
                </TD>
                <TD>{l.quantity}</TD>
                <TD className="text-right">
                  {formatGBP(l.revisedPer)}
                  {l.revisedPer !== l.offered_amount_per ? (
                    <div className="text-[11px] text-warn">
                      was {formatGBP(l.offered_amount_per)}
                    </div>
                  ) : null}
                </TD>
                <TD className="text-right">{formatGBP(l.revisedTotal)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary">[Mark received]</Button>
          <Button size="sm" variant="secondary">[Mark under review]</Button>
          <Button size="sm" variant="secondary">[Offer revised]</Button>
          <Button size="sm">[Approve & pay]</Button>
          <Button size="sm" variant="danger">[Reject & return]</Button>
        </div>
      </div>

      <aside className="border border-ink p-4 flex flex-col gap-3 sticky top-2">
        <Annotation>RUNNING ADJUSTED TOTAL</Annotation>
        <div className="flex justify-between text-[12px]">
          <span className="text-secondary">Original</span>
          <span>{formatGBP(submission.total_offered)}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-secondary">Adjusted</span>
          <span>{formatGBP(adjustedTotal)}</span>
        </div>
        <div className="border-t border-rule pt-3 flex justify-between items-baseline">
          <span className="text-[11px] uppercase tracking-wider text-secondary">
            Delta
          </span>
          <span
            className={`text-[20px] ${delta < 0 ? "text-warn" : delta > 0 ? "text-ink" : "text-muted"}`}
          >
            {delta >= 0 ? "+" : ""}
            {formatGBP(delta)}
          </span>
        </div>
      </aside>
    </div>
  );
}
