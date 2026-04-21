"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus } from "@/app/_actions/admin-shop";
import type { ShopOrderStatus } from "@/lib/supabase/types";

/**
 * Admin status-transition controls. The "Mark delivered" button is the
 * Slice B2 trigger — when it's clicked and the order has
 * `add_to_binder_opt_in = true`, the server action auto-creates binder
 * entries for the buyer.
 */

const NEXT_STEPS: Record<ShopOrderStatus, ShopOrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["packing", "cancelled"],
  packing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  refunded: [],
  cancelled: [],
};

const LABELS: Record<ShopOrderStatus, string> = {
  pending_payment: "Mark paid",
  paid: "Start packing",
  packing: "Mark shipped",
  shipped: "Mark delivered",
  delivered: "Refund",
  refunded: "",
  cancelled: "",
};

const TONES: Record<ShopOrderStatus, string> = {
  pending_payment: "bg-yellow",
  paid: "bg-yellow",
  packing: "bg-teal",
  shipped: "bg-teal",
  delivered: "bg-pink",
  refunded: "bg-paper-strong",
  cancelled: "bg-paper-strong",
};

export function OrderStatusControls({
  orderId,
  currentStatus,
  currentTracking,
  addToBinderOptIn,
  binderEntriesCreatedAt,
}: {
  orderId: string;
  currentStatus: ShopOrderStatus;
  currentTracking: string | null;
  addToBinderOptIn: boolean;
  binderEntriesCreatedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState(currentTracking ?? "");

  const allowed = NEXT_STEPS[currentStatus];

  const handleTransition = (target: ShopOrderStatus) => {
    if (pending) return;
    setError(null);
    start(async () => {
      try {
        await updateOrderStatus(orderId, target, {
          trackingNumber:
            target === "shipped" ? trackingInput || undefined : undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update status.");
      }
    });
  };

  return (
    <section className="pop-card rounded-md p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-display text-[10px] tracking-[0.25em] text-muted">
          Transition
        </div>
        {pending ? (
          <span className="font-display text-[10px] tracking-wider text-muted">
            Saving…
          </span>
        ) : null}
      </div>

      {currentStatus === "packing" || currentStatus === "paid" ? (
        <label className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
            Tracking
          </span>
          <input
            type="text"
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
            placeholder="RM tracking number"
            className="font-mono text-[12px] bg-paper-strong border-2 border-ink rounded-sm px-2 py-1 flex-1 min-w-[200px]"
          />
        </label>
      ) : null}

      <div className="flex gap-2 flex-wrap">
        {allowed.length === 0 ? (
          <span className="text-[12px] text-muted">
            This order is in a terminal state.
          </span>
        ) : (
          allowed.map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => handleTransition(target)}
              disabled={pending}
              className={`pop-block rounded-sm px-3 py-1.5 font-display text-[11px] tracking-wider text-ink disabled:opacity-50 ${
                target === "cancelled" ? "bg-paper-strong" : TONES[target]
              }`}
            >
              {target === "cancelled" ? "Cancel order" : LABELS[currentStatus]}
              {target === "cancelled" || target === LABELS[currentStatus]
                ? ""
                : ` · ${target}`}
            </button>
          ))
        )}
      </div>

      {currentStatus === "shipped" && addToBinderOptIn ? (
        <p className="text-[11px] text-teal font-display tracking-wider">
          On delivered, we&rsquo;ll auto-add these items to the buyer&rsquo;s
          binder.
        </p>
      ) : null}
      {binderEntriesCreatedAt ? (
        <p className="text-[11px] text-muted">
          Binder entries created at {fmtDate(binderEntriesCreatedAt)}
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="text-[11px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-2 py-1"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}

function fmtDate(v: string): string {
  return new Date(v).toISOString().slice(0, 16).replace("T", " ");
}
