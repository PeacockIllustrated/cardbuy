"use client";

import { useMemo, useSyncExternalStore } from "react";

/* ─────────────────────────────────────────────────────────────────
 * Minimal localStorage-backed cart. Client-only — cart persistence
 * across devices is deliberately out of scope for Phase 7 (see brief).
 *
 * Stored shape:
 *   localStorage['cardbuy:cart'] = JSON.stringify(CartLine[])
 * Cross-tab sync via the 'storage' window event.
 * ───────────────────────────────────────────────────────────────── */

export type CartLine = {
  listingId: string;
  qty: number;
};

const STORAGE_KEY = "cardbuy:cart";
const EVENT_NAME = "cardbuy:cart-update";

function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return parsed.filter(
      (l) =>
        typeof l?.listingId === "string" &&
        typeof l?.qty === "number" &&
        l.qty >= 1,
    );
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function addToCart(listingId: string, qty = 1) {
  const cart = readCart();
  const existing = cart.find((l) => l.listingId === listingId);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ listingId, qty });
  }
  writeCart(cart);
}

export function setCartQty(listingId: string, qty: number) {
  const cart = readCart();
  if (qty < 1) return removeFromCart(listingId);
  const line = cart.find((l) => l.listingId === listingId);
  if (!line) return;
  line.qty = qty;
  writeCart(cart);
}

export function removeFromCart(listingId: string) {
  writeCart(readCart().filter((l) => l.listingId !== listingId));
}

export function clearCart() {
  writeCart([]);
}

/* ── External-store interface for useSyncExternalStore ───────────
 * The snapshot is the same JSON string localStorage already holds,
 * so concurrent tabs / in-page mutations both broadcast via
 * `EVENT_NAME` and the hook re-reads on demand.
 */

function subscribe(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT_NAME, callback as EventListener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT_NAME, callback as EventListener);
  };
}

// Raw snapshot string for stable identity across renders. Parsed into
// CartLine[] by the consumer.
function getSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
}

function getServerSnapshot(): string {
  return "[]";
}

export function useCart(): {
  lines: CartLine[];
  totalQty: number;
  hydrated: boolean;
} {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Parse once per snapshot — useMemo keyed on `raw` keeps the array
  // reference stable across renders that don't actually change the
  // cart, so consumers that depend on `lines` identity don't churn.
  const lines = useMemo<CartLine[]>(() => {
    try {
      const parsed = JSON.parse(raw) as CartLine[];
      return Array.isArray(parsed)
        ? parsed.filter(
            (l) =>
              typeof l?.listingId === "string" &&
              typeof l?.qty === "number" &&
              l.qty >= 1,
          )
        : [];
    } catch {
      return [];
    }
  }, [raw]);
  // Hydrated once the server snapshot has been replaced by the real one.
  const hydrated = typeof window !== "undefined";
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  return { lines, totalQty, hydrated };
}
