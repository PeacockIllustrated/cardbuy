"use client";

import { useState, useTransition } from "react";
import { Annotation } from "@/components/wireframe/Annotation";
import { Button, Input, Field } from "@/components/ui/Form";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { updateMarginConfig } from "@/app/_actions/margins";
import type {
  Condition,
  Grade,
  GradingCompany,
  MockMarginConfig,
} from "@/lib/mock/types";

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

type Props = {
  initial: MockMarginConfig;
  /** Last write timestamp from the DB row (for the "last saved" line). */
  lastSavedAt: string | null;
  /** Optional: pre-seeded EUR rate from the same row (we extended schema). */
  initialFxEurGbp?: number;
};

export function PricingForm({ initial, lastSavedAt, initialFxEurGbp }: Props) {
  const [config, setConfig] = useState<MockMarginConfig>(initial);
  const [fxEurGbp, setFxEurGbp] = useState<number>(initialFxEurGbp ?? 0.85);
  const [changeNote, setChangeNote] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(lastSavedAt);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof MockMarginConfig>(
    k: K,
    v: MockMarginConfig[K],
  ) {
    setConfig((c) => ({ ...c, [k]: v }));
    setDirty(true);
  }

  function updateCondition(cond: Condition, v: number) {
    setConfig((c) => ({
      ...c,
      condition_multipliers: { ...c.condition_multipliers, [cond]: v },
    }));
    setDirty(true);
  }

  function updateGrade(company: GradingCompany, grade: Grade, v: number) {
    setConfig((c) => ({
      ...c,
      grade_multipliers: {
        ...c.grade_multipliers,
        [company]: { ...c.grade_multipliers[company], [grade]: v },
      },
    }));
    setDirty(true);
  }

  function updateSetOverride(
    idx: number,
    patch: Partial<MockMarginConfig["set_overrides"][number]>,
  ) {
    setConfig((c) => ({
      ...c,
      set_overrides: c.set_overrides.map((o, i) =>
        i === idx ? { ...o, ...patch } : o,
      ),
    }));
    setDirty(true);
  }

  function updateRarityOverride(
    idx: number,
    patch: Partial<MockMarginConfig["rarity_overrides"][number]>,
  ) {
    setConfig((c) => ({
      ...c,
      rarity_overrides: c.rarity_overrides.map((o, i) =>
        i === idx ? { ...o, ...patch } : o,
      ),
    }));
    setDirty(true);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateMarginConfig({
        global_margin: config.global_margin,
        min_buy_price: config.min_buy_price,
        confidence_threshold: config.confidence_threshold,
        condition_multipliers: config.condition_multipliers,
        grade_multipliers: config.grade_multipliers as Record<
          string,
          Record<string, number>
        >,
        set_overrides: config.set_overrides,
        rarity_overrides: config.rarity_overrides,
        fx_rate_usd_gbp: config.fx_rate_usd_gbp,
        fx_rate_eur_gbp: fxEurGbp,
        fx_manual_override: config.fx_manual_override,
        change_note: changeNote.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Save failed");
        return;
      }
      setDirty(false);
      setSavedAt(new Date().toISOString());
      setChangeNote("");
    });
  }

  function revert() {
    setConfig(initial);
    setFxEurGbp(initialFxEurGbp ?? 0.85);
    setChangeNote("");
    setDirty(false);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sticky save bar */}
      <div className="pop-card rounded-md px-3 py-2 flex items-center justify-between sticky top-2 bg-paper-strong z-10 gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <Annotation>PRICING CONFIG · Lewis&apos;s control panel</Annotation>
          <span
            className={`text-[11px] font-display tracking-wider tabular-nums ${
              dirty ? "text-warn" : "text-muted"
            }`}
          >
            {dirty
              ? "Unsaved changes"
              : savedAt
                ? `Saved ${new Date(savedAt).toISOString().slice(0, 16).replace("T", " ")}`
                : "No changes"}
          </span>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <Field label="Change note (optional)">
            <Input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="e.g. lowered margin for Apr promo"
              className="w-[260px]"
            />
          </Field>
          <Button
            size="sm"
            variant="ghost"
            disabled={!dirty || pending}
            onClick={revert}
          >
            Revert
          </Button>
          <Button size="sm" disabled={!dirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="bg-warn/10 border-2 border-warn text-warn rounded-md px-3 py-2 text-[12px]">
          {error}
        </div>
      ) : null}

      {/* Globals */}
      <section className="pop-card rounded-md p-4 flex flex-col gap-4">
        <Annotation>GLOBAL CONTROLS</Annotation>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label={`Global buy margin (${Math.round(config.global_margin * 100)}%)`}
            hint="Pay this fraction of market baseline by default."
          >
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(config.global_margin * 100)}
                onChange={(e) =>
                  update("global_margin", Number(e.target.value) / 100)
                }
                className="flex-1 accent-black"
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={Math.round(config.global_margin * 100)}
                onChange={(e) =>
                  update("global_margin", Number(e.target.value) / 100)
                }
                className="w-20"
              />
            </div>
          </Field>

          <Field
            label="Minimum buy price (£)"
            hint="Cards quoted below this get a 'too low' badge."
          >
            <Input
              type="number"
              step={0.01}
              value={config.min_buy_price}
              onChange={(e) =>
                update("min_buy_price", Number(e.target.value))
              }
              className="w-28"
            />
          </Field>

          <Field
            label="Low-confidence sale count threshold"
            hint="Cards with fewer 30-day sales than this are flagged for manual review."
          >
            <Input
              type="number"
              step={1}
              value={config.confidence_threshold}
              onChange={(e) =>
                update("confidence_threshold", Number(e.target.value))
              }
              className="w-28"
            />
          </Field>

          <Field
            label="Manual FX override"
            hint="If on, the FX values below are used as-is. If off, they get refreshed by the nightly cron (Phase 2b.2)."
          >
            <label className="text-[12px] flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.fx_manual_override}
                onChange={(e) => update("fx_manual_override", e.target.checked)}
              />
              manual override on
            </label>
          </Field>

          <Field label="USD → GBP">
            <Input
              type="number"
              step={0.0001}
              value={config.fx_rate_usd_gbp}
              onChange={(e) =>
                update("fx_rate_usd_gbp", Number(e.target.value))
              }
              className="w-28"
            />
          </Field>

          <Field label="EUR → GBP (Cardmarket)">
            <Input
              type="number"
              step={0.0001}
              value={fxEurGbp}
              onChange={(e) => {
                setFxEurGbp(Number(e.target.value));
                setDirty(true);
              }}
              className="w-28"
            />
          </Field>
        </div>
      </section>

      {/* Condition multipliers */}
      <section className="flex flex-col gap-2">
        <Annotation>CONDITION MULTIPLIERS</Annotation>
        <Table>
          <THead>
            <TR>
              {CONDITIONS.map((c) => (
                <TH key={c}>{c}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            <TR>
              {CONDITIONS.map((c) => (
                <TD key={c}>
                  <Input
                    type="number"
                    step={0.01}
                    min={0}
                    max={1.5}
                    value={config.condition_multipliers[c]}
                    onChange={(e) =>
                      updateCondition(c, Number(e.target.value))
                    }
                    className="w-20"
                  />
                </TD>
              ))}
            </TR>
          </TBody>
        </Table>
      </section>

      {/* Grade multipliers */}
      <section className="flex flex-col gap-2">
        <Annotation>GRADE MULTIPLIERS</Annotation>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(config.grade_multipliers) as GradingCompany[]).map(
            (company) => (
              <div
                key={company}
                className="border-2 border-ink rounded-md p-3 flex flex-col gap-2 bg-paper-strong"
              >
                <div className="font-display text-[12px] uppercase tracking-wider">
                  {company}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(config.grade_multipliers[company] ?? {}).map(
                    ([grade, value]) => (
                      <label
                        key={grade}
                        className="flex flex-col text-[11px] w-20"
                      >
                        <span className="text-secondary font-display tracking-wider">
                          {grade}
                        </span>
                        <Input
                          type="number"
                          step={0.01}
                          min={0}
                          max={1.5}
                          value={value}
                          onChange={(e) =>
                            updateGrade(
                              company,
                              grade as Grade,
                              Number(e.target.value),
                            )
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {/* Set overrides */}
      {config.set_overrides.length > 0 ? (
        <section className="flex flex-col gap-2">
          <Annotation>PER-SET OVERRIDES</Annotation>
          <Table>
            <THead>
              <TR>
                <TH>Set</TH>
                <TH>Override margin</TH>
                <TH>Active</TH>
              </TR>
            </THead>
            <TBody>
              {config.set_overrides.map((o, i) => (
                <TR key={`${o.set_id}-${i}`}>
                  <TD>
                    {o.set_name}{" "}
                    <span className="text-muted">({o.set_id})</span>
                  </TD>
                  <TD>
                    <Input
                      type="number"
                      step={0.01}
                      min={0}
                      max={1.5}
                      value={o.margin}
                      onChange={(e) =>
                        updateSetOverride(i, { margin: Number(e.target.value) })
                      }
                      className="w-24"
                    />
                  </TD>
                  <TD>
                    <input
                      type="checkbox"
                      checked={o.active}
                      onChange={(e) =>
                        updateSetOverride(i, { active: e.target.checked })
                      }
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      ) : null}

      {/* Rarity overrides */}
      {config.rarity_overrides.length > 0 ? (
        <section className="flex flex-col gap-2">
          <Annotation>PER-RARITY OVERRIDES</Annotation>
          <Table>
            <THead>
              <TR>
                <TH>Rarity</TH>
                <TH>Override margin</TH>
                <TH>Active</TH>
              </TR>
            </THead>
            <TBody>
              {config.rarity_overrides.map((o, i) => (
                <TR key={`${o.rarity}-${i}`}>
                  <TD>{o.rarity}</TD>
                  <TD>
                    <Input
                      type="number"
                      step={0.01}
                      min={0}
                      max={1.5}
                      value={o.margin}
                      onChange={(e) =>
                        updateRarityOverride(i, {
                          margin: Number(e.target.value),
                        })
                      }
                      className="w-24"
                    />
                  </TD>
                  <TD>
                    <input
                      type="checkbox"
                      checked={o.active}
                      onChange={(e) =>
                        updateRarityOverride(i, { active: e.target.checked })
                      }
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      ) : null}

      <p className="text-[11px] text-muted font-display tracking-wider">
        Live data ·{" "}
        <code className="font-mono">lewis_admin_margins</code>. Every save
        snapshots the previous version into{" "}
        <code className="font-mono">lewis_admin_margins_history</code> via
        trigger.
      </p>
    </div>
  );
}
