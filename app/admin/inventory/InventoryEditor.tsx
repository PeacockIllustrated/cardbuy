"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import { Button, Input, Select } from "@/components/ui/Form";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import type { ListingStatus, MockListing } from "@/lib/mock/types";
import { formatGBP } from "@/lib/mock/mock-offer";

type Tab = "active" | "hidden" | "sold_out" | "featured";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "active", label: "Active" },
  { key: "featured", label: "Featured" },
  { key: "hidden", label: "Hidden" },
  { key: "sold_out", label: "Sold out" },
];

function marginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

type Props = {
  initial: MockListing[];
  featuredSlotCount: number;
};

export function InventoryEditor({ initial, featuredSlotCount }: Props) {
  const [rows, setRows] = useState<MockListing[]>(initial);
  const [tab, setTab] = useState<Tab>("active");

  const filtered = useMemo(() => {
    if (tab === "featured") return rows.filter((r) => r.is_featured);
    return rows.filter((r) => r.status === (tab as ListingStatus));
  }, [rows, tab]);

  const featuredCount = rows.filter((r) => r.is_featured).length;
  const activeCount = rows.filter((r) => r.status === "active").length;
  const totalStockValue = rows
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + r.price_gbp * r.qty_in_stock, 0);
  const lowStockCount = rows.filter(
    (r) => r.status === "active" && r.qty_in_stock <= 1,
  ).length;

  function update(id: string, patch: Partial<MockListing>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function toggleFeatured(listing: MockListing) {
    if (listing.is_featured) {
      update(listing.id, { is_featured: false, featured_priority: null });
      return;
    }
    if (featuredCount >= featuredSlotCount) {
      alert(
        `All ${featuredSlotCount} featured slots are full. Unfeature another listing first.`,
      );
      return;
    }
    update(listing.id, {
      is_featured: true,
      featured_priority: featuredCount + 1,
    });
  }

  return (
    <>
      {/* Stats strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InvStat label="Active listings" value={activeCount} />
        <InvStat
          label="Featured slots"
          value={`${featuredCount} / ${featuredSlotCount}`}
        />
        <InvStat label="Total stock value" value={formatGBP(totalStockValue)} />
        <InvStat
          label="Low-stock alerts"
          value={lowStockCount}
          accent={lowStockCount > 0 ? "warn" : undefined}
        />
      </section>

      {/* Tabs + add */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <nav className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-2 rounded-sm px-2.5 py-1 font-display text-[11px] tracking-wider uppercase transition-colors ${
                tab === t.key
                  ? "border-ink bg-ink text-paper-strong"
                  : "border-ink bg-paper-strong text-ink hover:bg-yellow"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <TodoMarker phase={2}>add new listing form</TodoMarker>
          <Button size="sm" disabled>+ Add listing</Button>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>SKU</TH>
            <TH>Card</TH>
            <TH>Variant</TH>
            <TH>Stock</TH>
            <TH className="text-right">Price (£)</TH>
            <TH className="text-right">Cost</TH>
            <TH>Margin</TH>
            <TH>Status</TH>
            <TH>Featured</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {filtered.length === 0 ? (
            <TR>
              <TD className="text-center text-secondary py-6">
                No listings in this view.
              </TD>
            </TR>
          ) : (
            filtered.map((l) => {
              const margin = marginPct(l.price_gbp, l.cost_basis_gbp);
              return (
                <TR key={l.id}>
                  <TD className="font-mono text-[11px] tabular-nums">{l.sku}</TD>
                  <TD>
                    <Link
                      href={`/shop/${l.id}`}
                      className="font-display text-[13px] tracking-tight underline underline-offset-4 decoration-2 hover:text-pink"
                    >
                      {l.card_name}
                    </Link>
                    <div className="text-[11px] text-muted">{l.set_name}</div>
                  </TD>
                  <TD className="text-[12px] font-display tracking-wider uppercase">
                    {l.variant === "raw"
                      ? `Raw · ${l.condition}`
                      : `${l.grading_company} ${l.grade}`}
                  </TD>
                  <TD>
                    <Input
                      type="number"
                      min={0}
                      value={l.qty_in_stock}
                      onChange={(e) =>
                        update(l.id, { qty_in_stock: Number(e.target.value) })
                      }
                      className="w-16"
                    />
                  </TD>
                  <TD>
                    <Input
                      type="number"
                      step={0.01}
                      min={0}
                      value={l.price_gbp}
                      onChange={(e) =>
                        update(l.id, { price_gbp: Number(e.target.value) })
                      }
                      className="w-24 text-right tabular-nums"
                    />
                  </TD>
                  <TD className="text-right text-muted tabular-nums">
                    {formatGBP(l.cost_basis_gbp)}
                  </TD>
                  <TD>
                    <span
                      className={`font-display tabular-nums ${
                        margin < 20
                          ? "text-warn"
                          : margin >= 35
                            ? "text-ink"
                            : "text-secondary"
                      }`}
                    >
                      {margin.toFixed(1)}%
                    </span>
                  </TD>
                  <TD>
                    <Select
                      value={l.status}
                      onChange={(e) =>
                        update(l.id, {
                          status: e.target.value as ListingStatus,
                        })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="hidden">Hidden</option>
                      <option value="sold_out">Sold out</option>
                    </Select>
                  </TD>
                  <TD>
                    <label className="flex items-center gap-2 text-[12px] font-display tracking-wider">
                      <input
                        type="checkbox"
                        checked={l.is_featured}
                        onChange={() => toggleFeatured(l)}
                      />
                      {l.featured_priority ? `#${l.featured_priority}` : ""}
                    </label>
                  </TD>
                  <TD>
                    <Button size="sm" variant="ghost">
                      Edit
                    </Button>
                  </TD>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
    </>
  );
}

function InvStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "warn";
}) {
  return (
    <div className="border-2 border-ink rounded-md p-3 bg-paper-strong">
      <div className="text-[10px] font-display uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`font-display text-[22px] leading-tight tracking-tight tabular-nums mt-1 ${
          accent === "warn" ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
