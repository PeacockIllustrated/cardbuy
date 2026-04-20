"use client";

import { useState } from "react";
import { Annotation } from "@/components/wireframe/Annotation";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import { Button, Input, Field } from "@/components/ui/Form";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { MOCK_MARGIN_CONFIG } from "@/lib/mock/mock-margin-config";
import type {
  Condition,
  Grade,
  GradingCompany,
  MockMarginConfig,
} from "@/lib/mock/types";

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

export default function AdminPricingPage() {
  const [config, setConfig] = useState<MockMarginConfig>(MOCK_MARGIN_CONFIG);
  const [dirty, setDirty] = useState(false);

  function update<K extends keyof MockMarginConfig>(k: K, v: MockMarginConfig[K]) {
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

  function updateSetOverride(idx: number, patch: Partial<MockMarginConfig["set_overrides"][number]>) {
    setConfig((c) => ({
      ...c,
      set_overrides: c.set_overrides.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));
    setDirty(true);
  }

  function updateRarityOverride(idx: number, patch: Partial<MockMarginConfig["rarity_overrides"][number]>) {
    setConfig((c) => ({
      ...c,
      rarity_overrides: c.rarity_overrides.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));
    setDirty(true);
  }

  return (
    <div className="px-4 py-6 max-w-[1200px] mx-auto flex flex-col gap-6">
      {/* Save bar */}
      <div className="border border-ink px-3 py-2 flex items-center justify-between sticky top-2 bg-paper z-10">
        <div className="flex flex-col">
          <Annotation>PRICING CONFIG · Lewis&apos;s control panel</Annotation>
          <span className="text-[11px] text-muted">
            {dirty ? "Unsaved changes" : "No changes"}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            variant="ghost"
            disabled={!dirty}
            onClick={() => {
              setConfig(MOCK_MARGIN_CONFIG);
              setDirty(false);
            }}
          >
            Revert
          </Button>
          <Button
            size="sm"
            disabled={!dirty}
            onClick={() => setDirty(false)}
          >
            [Save changes — recalculates all open offers]
          </Button>
        </div>
      </div>

      <TodoMarker phase={3}>hook to offer engine — recalc all open offers on save</TodoMarker>

      {/* Globals */}
      <section className="border border-rule p-4 flex flex-col gap-4">
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
                onChange={(e) => update("global_margin", Number(e.target.value) / 100)}
                className="flex-1 accent-black"
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={Math.round(config.global_margin * 100)}
                onChange={(e) => update("global_margin", Number(e.target.value) / 100)}
                className="w-20"
              />
            </div>
          </Field>

          <Field
            label="USD → GBP FX rate"
            hint={
              <span>
                Last auto-refresh: {new Date(config.fx_rate_updated_at).toISOString().slice(0, 16).replace("T", " ")}{" "}
                {config.fx_manual_override ? "· manual override ON" : "· cron"}
              </span>
            }
          >
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                step={0.0001}
                value={config.fx_rate_usd_gbp}
                onChange={(e) => update("fx_rate_usd_gbp", Number(e.target.value))}
                className="w-28"
              />
              <label className="text-[11px] flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={config.fx_manual_override}
                  onChange={(e) => update("fx_manual_override", e.target.checked)}
                />
                manual override
              </label>
            </div>
          </Field>

          <Field label="Minimum buy price (£)">
            <Input
              type="number"
              step={0.01}
              value={config.min_buy_price}
              onChange={(e) => update("min_buy_price", Number(e.target.value))}
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
              onChange={(e) => update("confidence_threshold", Number(e.target.value))}
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
                    onChange={(e) => updateCondition(c, Number(e.target.value))}
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
          {(Object.keys(config.grade_multipliers) as GradingCompany[]).map((company) => (
            <div key={company} className="border border-rule p-3 flex flex-col gap-2">
              <div className="text-[12px] uppercase tracking-wider">{company}</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(config.grade_multipliers[company] ?? {}).map(
                  ([grade, value]) => (
                    <label key={grade} className="flex flex-col text-[11px] w-20">
                      <span className="text-secondary">{grade}</span>
                      <Input
                        type="number"
                        step={0.01}
                        min={0}
                        max={1.5}
                        value={value}
                        onChange={(e) =>
                          updateGrade(company, grade as Grade, Number(e.target.value))
                        }
                      />
                    </label>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Set overrides */}
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
              <TR key={o.set_id}>
                <TD>{o.set_name} <span className="text-muted">({o.set_id})</span></TD>
                <TD>
                  <Input
                    type="number"
                    step={0.01}
                    min={0}
                    max={1.5}
                    value={o.margin}
                    onChange={(e) => updateSetOverride(i, { margin: Number(e.target.value) })}
                    className="w-24"
                  />
                </TD>
                <TD>
                  <input
                    type="checkbox"
                    checked={o.active}
                    onChange={(e) => updateSetOverride(i, { active: e.target.checked })}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <TodoMarker phase={2}>add/remove rows, search sets</TodoMarker>
      </section>

      {/* Rarity overrides */}
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
              <TR key={o.rarity}>
                <TD>{o.rarity}</TD>
                <TD>
                  <Input
                    type="number"
                    step={0.01}
                    min={0}
                    max={1.5}
                    value={o.margin}
                    onChange={(e) => updateRarityOverride(i, { margin: Number(e.target.value) })}
                    className="w-24"
                  />
                </TD>
                <TD>
                  <input
                    type="checkbox"
                    checked={o.active}
                    onChange={(e) => updateRarityOverride(i, { active: e.target.checked })}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
