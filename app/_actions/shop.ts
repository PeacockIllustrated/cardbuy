"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCardById } from "@/lib/fixtures/cards";
import type {
  LewisListing,
  LewisOrder,
  LewisOrderItem,
  PaymentMethod,
  ShippingAddress,
  ShippingMethodOption,
} from "@/lib/supabase/types";

/* ─────────────────────────────────────────────────────────────────
 * Phase 7 · Shop public server actions.
 *
 * Reads ride on RLS (`lewis_listings: public read active` +
 * `lewis_orders: buyer read own`). Writes go exclusively through the
 * `lewis_create_order` SQL RPC which is the only place stock
 * reservation happens atomically.
 * ───────────────────────────────────────────────────────────────── */

const SHIPPING_COSTS: Record<ShippingMethodOption, number> = {
  royal_mail_tracked: 4.95,
  royal_mail_special: 9.95,
};

/* ─── reads ─────────────────────────────────────────────────────── */

export async function listListings(opts?: {
  featured?: boolean;
  inStockOnly?: boolean;
}): Promise<LewisListing[]> {
  const supabase = await createClient();
  let q = supabase.from("lewis_listings").select("*").eq("status", "active");
  if (opts?.featured) q = q.eq("is_featured", true);
  q = q.order("is_featured", { ascending: false }).order(
    "featured_priority",
    { ascending: true, nullsFirst: false },
  );
  const { data, error } = await q;
  if (error) throw new Error(`Failed to load listings: ${error.message}`);
  const rows = (data ?? []) as LewisListing[];
  if (opts?.inStockOnly) {
    return rows.filter((l) => l.qty_in_stock - l.qty_reserved > 0);
  }
  return rows;
}

export type EnrichedListing = LewisListing & {
  card_name: string;
  set_name: string;
  image_small: string | null;
};

function enrich(l: LewisListing): EnrichedListing {
  const card = getCardById(l.card_id);
  return {
    ...l,
    card_name: card?.name ?? l.card_id,
    set_name: SET_NAMES[l.card_id.split("-")[0]] ?? l.card_id.split("-")[0],
    image_small: card?.images.small ?? null,
  };
}

export async function getListingsByIds(
  ids: string[],
): Promise<EnrichedListing[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lewis_listings")
    .select("*")
    .in("id", ids);
  if (error) throw new Error(`Failed to load listings: ${error.message}`);
  return ((data ?? []) as LewisListing[]).map(enrich);
}

export async function getListing(id: string): Promise<LewisListing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lewis_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load listing: ${error.message}`);
  return (data as LewisListing | null) ?? null;
}

export async function getMyOrders(): Promise<LewisOrder[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lewis_orders")
    .select("*")
    .eq("buyer_id", user.id)
    .order("placed_at", { ascending: false });
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return (data ?? []) as LewisOrder[];
}

export async function getOrderByReference(reference: string): Promise<
  | {
      order: LewisOrder;
      items: LewisOrderItem[];
    }
  | null
> {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("lewis_orders")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw new Error(`Failed to load order: ${error.message}`);
  if (!order) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("lewis_order_items")
    .select("*")
    .eq("order_id", (order as LewisOrder).id)
    .order("created_at", { ascending: true });
  if (itemsErr) throw new Error(`Failed to load items: ${itemsErr.message}`);

  return {
    order: order as LewisOrder,
    items: (items ?? []) as LewisOrderItem[],
  };
}

/* ─── writes ────────────────────────────────────────────────────── */

export type CreateOrderInput = {
  cart: Array<{ listingId: string; qty: number }>;
  buyerName: string;
  buyerEmail: string;
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethodOption;
  addToBinderOptIn: boolean;
  notes?: string;
};

export type CreateOrderResult = {
  orderId: string;
  reference: string;
};

/**
 * Creates a new order via the `lewis_create_order` RPC. Atomic:
 * either every line reserves stock and the row lands, or nothing
 * does. Payment is stubbed — the order starts at `pending_payment`
 * with `payment_method='stub'` until real Stripe lands (Phase 8).
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shop/checkout");

  if (input.cart.length === 0) throw new Error("Cart is empty.");
  for (const line of input.cart) {
    if (!line.listingId || line.qty < 1) {
      throw new Error("Invalid cart line.");
    }
  }

  const shipping = SHIPPING_COSTS[input.shippingMethod];

  const { data, error } = await supabase.rpc("lewis_create_order", {
    p_buyer_id: user.id,
    p_buyer_email: input.buyerEmail,
    p_buyer_name: input.buyerName,
    p_cart: input.cart.map((l) => ({
      listing_id: l.listingId,
      qty: l.qty,
    })),
    p_shipping_address: input.shippingAddress,
    p_shipping_method: input.shippingMethod,
    p_shipping_gbp: shipping,
    p_payment_method: "stub",
    p_add_to_binder_opt_in: input.addToBinderOptIn,
    p_notes_buyer: input.notes ?? null,
  });

  if (error) {
    if (error.message.includes("OUT_OF_STOCK")) {
      throw new Error(
        "Someone else grabbed one of these cards — please refresh your cart.",
      );
    }
    if (error.message.includes("LISTING_NOT_FOUND")) {
      throw new Error("A listing in your cart is no longer available.");
    }
    if (error.message.includes("LISTING_INACTIVE")) {
      throw new Error("A listing in your cart is no longer active.");
    }
    if (error.message.includes("EMPTY_CART")) {
      throw new Error("Cart is empty.");
    }
    throw new Error(`Failed to place order: ${error.message}`);
  }

  const rows = (data as Array<{ id: string; reference: string }> | null) ?? [];
  const result = rows[0];
  if (!result) throw new Error("Order creation returned no row.");

  // Backfill the card/set name snapshots the RPC couldn't compute
  // (the fixture lives in JS, not in Postgres). This lets receipts
  // render nicely without every query re-joining the fixture.
  await backfillItemNames(result.id);

  revalidatePath("/shop");
  revalidatePath("/shop/cart");
  revalidatePath(`/shop/order/${result.reference}`);

  return { orderId: result.id, reference: result.reference };
}

async function backfillItemNames(orderId: string): Promise<void> {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("lewis_order_items")
    .select("id, card_id")
    .eq("order_id", orderId);
  const rows = (items as { id: string; card_id: string }[] | null) ?? [];
  for (const row of rows) {
    const card = getCardById(row.card_id);
    if (!card) continue;
    await supabase
      .from("lewis_order_items")
      .update({
        card_name: card.name,
        set_name: SET_NAMES[row.card_id.split("-")[0]] ?? row.card_id.split("-")[0],
      })
      .eq("id", row.id);
  }
}

const SET_NAMES: Record<string, string> = {
  base1: "Base Set",
  base2: "Jungle",
  base3: "Fossil",
  base4: "Base Set 2",
  base5: "Team Rocket",
  basep: "Wizards Black Star Promos",
};
