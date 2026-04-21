"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCardById } from "@/lib/fixtures/cards";
import type {
  GradingCompany,
  Grade,
  ItemCondition,
  ItemVariant,
  LewisListing,
  LewisOrder,
  LewisOrderItem,
  LewisUser,
  ListingStatus,
  ShopOrderStatus,
} from "@/lib/supabase/types";

/* ─────────────────────────────────────────────────────────────────
 * Phase 7 · Admin-facing shop actions.
 *
 * Authorisation comes from RLS (`lewis_listings: admin all`,
 * `lewis_orders: admin all`) + the middleware `/admin/*` gate. Every
 * call still rides on the signed-in user — no service-role key here.
 *
 * Slice B2 (shop-order → binder auto-add) lands in
 * `updateOrderStatus` — see `addShopOrderToBinder` at the bottom.
 * ───────────────────────────────────────────────────────────────── */

/* ─── Listings ──────────────────────────────────────────────────── */

export type AdminListingRow = LewisListing & {
  card_name: string;
  set_name: string;
  qty_available: number;
};

export async function listAdminListings(
  statusFilter?: ListingStatus | "all",
): Promise<AdminListingRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("lewis_listings")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (statusFilter && statusFilter !== "all") {
    q = q.eq("status", statusFilter);
  }
  const { data, error } = await q;
  if (error) throw new Error(`Failed to load listings: ${error.message}`);
  const rows = (data ?? []) as LewisListing[];

  return rows.map((l) => {
    const card = getCardById(l.card_id);
    return {
      ...l,
      card_name: card?.name ?? l.card_id,
      set_name: SET_NAMES[l.card_id.split("-")[0]] ?? l.card_id.split("-")[0],
      qty_available: l.qty_in_stock - l.qty_reserved,
    };
  });
}

export type CreateListingInput = {
  cardId: string;
  variant: ItemVariant;
  condition?: ItemCondition;
  gradingCompany?: GradingCompany;
  grade?: Grade;
  priceGbp: number;
  costBasisGbp: number;
  qtyInStock: number;
  isFeatured?: boolean;
  featuredPriority?: number | null;
  conditionNotes?: string | null;
};

export async function createListing(
  input: CreateListingInput,
): Promise<{ listingId: string }> {
  const supabase = await createClient();

  // Shape validation matches the DB check constraint.
  if (input.variant === "raw") {
    if (!input.condition) throw new Error("Raw listings need a condition.");
    if (input.gradingCompany || input.grade) {
      throw new Error("Raw listings can't have grading fields.");
    }
  } else {
    if (!input.gradingCompany || !input.grade) {
      throw new Error("Graded listings need company + grade.");
    }
    if (input.condition) {
      throw new Error("Graded listings can't have a raw condition.");
    }
  }

  // Generate an SKU. Pattern mirrors the mock: {CARD_ID}-{variant}-{nn}
  // where nn is a monotonically increasing counter we derive from the
  // current max for this card_id to avoid collisions on re-creation.
  const { count } = await supabase
    .from("lewis_listings")
    .select("id", { count: "exact", head: true })
    .eq("card_id", input.cardId);
  const seq = (count ?? 0) + 1;
  const variantSuffix =
    input.variant === "raw"
      ? input.condition
      : `${input.gradingCompany}${input.grade}`;
  const sku = `${input.cardId.toUpperCase()}-${variantSuffix}-${String(seq).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("lewis_listings")
    .insert({
      card_id: input.cardId,
      sku,
      variant: input.variant,
      condition: input.condition ?? null,
      grading_company: input.gradingCompany ?? null,
      grade: input.grade ?? null,
      price_gbp: input.priceGbp,
      cost_basis_gbp: input.costBasisGbp,
      qty_in_stock: input.qtyInStock,
      qty_reserved: 0,
      status: "active",
      is_featured: input.isFeatured ?? false,
      featured_priority: input.featuredPriority ?? null,
      condition_notes: input.conditionNotes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create listing: ${error?.message ?? "unknown"}`);
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/shop");
  return { listingId: data.id };
}

export type UpdateListingInput = {
  priceGbp?: number;
  costBasisGbp?: number;
  qtyInStock?: number;
  status?: ListingStatus;
  isFeatured?: boolean;
  featuredPriority?: number | null;
  conditionNotes?: string | null;
};

export async function updateListing(
  listingId: string,
  patch: UpdateListingInput,
): Promise<void> {
  const supabase = await createClient();
  const update: Partial<LewisListing> = {};
  if (patch.priceGbp !== undefined) update.price_gbp = patch.priceGbp;
  if (patch.costBasisGbp !== undefined) update.cost_basis_gbp = patch.costBasisGbp;
  if (patch.qtyInStock !== undefined) update.qty_in_stock = patch.qtyInStock;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.isFeatured !== undefined) update.is_featured = patch.isFeatured;
  if (patch.featuredPriority !== undefined)
    update.featured_priority = patch.featuredPriority;
  if (patch.conditionNotes !== undefined)
    update.condition_notes = patch.conditionNotes;

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("lewis_listings")
    .update(update)
    .eq("id", listingId);
  if (error) throw new Error(`Failed to update listing: ${error.message}`);

  revalidatePath("/admin/inventory");
  revalidatePath("/shop");
}

/* ─── Orders ────────────────────────────────────────────────────── */

export type AdminOrderRow = LewisOrder & {
  item_count: number;
};

export async function listAdminOrders(
  statusFilter?: ShopOrderStatus | "all",
): Promise<AdminOrderRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("lewis_orders")
    .select("*")
    .order("placed_at", { ascending: false });
  if (statusFilter && statusFilter !== "all") {
    q = q.eq("status", statusFilter);
  }
  const { data, error } = await q;
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  const orders = (data ?? []) as LewisOrder[];
  if (orders.length === 0) return [];

  const { data: items } = await supabase
    .from("lewis_order_items")
    .select("order_id, qty")
    .in(
      "order_id",
      orders.map((o) => o.id),
    );
  const rows = (items as { order_id: string; qty: number }[] | null) ?? [];
  const countBy = new Map<string, number>();
  for (const i of rows) {
    countBy.set(i.order_id, (countBy.get(i.order_id) ?? 0) + i.qty);
  }

  return orders.map((o) => ({ ...o, item_count: countBy.get(o.id) ?? 0 }));
}

export async function getAdminOrder(reference: string): Promise<
  | {
      order: LewisOrder;
      items: LewisOrderItem[];
      buyer: Pick<LewisUser, "id" | "email" | "full_name"> | null;
    }
  | null
> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("lewis_orders")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (!order) return null;

  const typed = order as LewisOrder;

  const [{ data: items }, buyerRow] = await Promise.all([
    supabase
      .from("lewis_order_items")
      .select("*")
      .eq("order_id", typed.id)
      .order("created_at", { ascending: true }),
    typed.buyer_id
      ? supabase
          .from("lewis_users")
          .select("id, email, full_name")
          .eq("id", typed.buyer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    order: typed,
    items: (items ?? []) as LewisOrderItem[],
    buyer:
      (buyerRow.data as Pick<LewisUser, "id" | "email" | "full_name"> | null) ??
      null,
  };
}

/**
 * The big one. Admin-driven state-machine transition. Handles the
 * timestamp stamping for paid/shipped/delivered/cancelled, and fires
 * the Slice B2 binder auto-add when the transition is → delivered.
 *
 * Cancellation stock release runs in a DB trigger
 * (`lewis_release_on_cancel`) — we don't need to touch listings here.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: ShopOrderStatus,
  opts?: { trackingNumber?: string; internalNote?: string },
): Promise<void> {
  const supabase = await createClient();

  const { data: existing, error: lookupErr } = await supabase
    .from("lewis_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (lookupErr || !existing) throw new Error("Order not found.");
  const order = existing as LewisOrder;

  if (order.status === newStatus) return;

  const patch: Partial<LewisOrder> = { status: newStatus };
  const now = new Date().toISOString();

  if (newStatus === "paid") patch.paid_at = order.paid_at ?? now;
  if (newStatus === "shipped") patch.shipped_at = order.shipped_at ?? now;
  if (newStatus === "delivered") patch.delivered_at = order.delivered_at ?? now;
  if (newStatus === "cancelled") patch.cancelled_at = order.cancelled_at ?? now;

  if (opts?.trackingNumber !== undefined) {
    patch.tracking_number = opts.trackingNumber;
  }
  if (opts?.internalNote !== undefined) {
    patch.notes_internal = opts.internalNote;
  }

  const { error } = await supabase
    .from("lewis_orders")
    .update(patch)
    .eq("id", orderId);
  if (error) throw new Error(`Failed to update order: ${error.message}`);

  // Slice B2 · shop-order → binder auto-add. Only runs on transition
  // into 'delivered', only if the buyer opted in, and only once per
  // order (idempotent via `binder_entries_created_at`).
  if (
    newStatus === "delivered" &&
    order.add_to_binder_opt_in &&
    !order.binder_entries_created_at &&
    order.buyer_id
  ) {
    await autoAddOrderToBinder(orderId, order.buyer_id);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.reference}`);
  revalidatePath(`/shop/order/${order.reference}`);
  if (newStatus === "delivered") revalidatePath("/binder");
}

async function autoAddOrderToBinder(
  orderId: string,
  buyerId: string,
): Promise<void> {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("lewis_order_items")
    .select("*")
    .eq("order_id", orderId);
  const rows = (items ?? []) as LewisOrderItem[];

  for (const item of rows) {
    const tupleFilter = {
      user_id: buyerId,
      card_id: item.card_id,
      variant: item.variant,
      condition: item.condition,
      grading_company: item.grading_company,
      grade: item.grade,
    };

    const { data: existing } = await supabase
      .from("lewis_binder_entries")
      .select("id, quantity")
      .match(tupleFilter)
      .maybeSingle();

    if (existing) {
      // Increment quantity; keep existing source if one was already
      // set (prior manual add wins provenance-wise).
      await supabase
        .from("lewis_binder_entries")
        .update({
          quantity: existing.quantity + item.qty,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("lewis_binder_entries").insert({
        ...tupleFilter,
        quantity: item.qty,
        is_grail: false,
        source: "shop_order",
        source_order_id: orderId,
      });
    }
  }

  // Mark the order so we don't re-run if the admin toggles delivered
  // off and back on.
  await supabase
    .from("lewis_orders")
    .update({ binder_entries_created_at: new Date().toISOString() })
    .eq("id", orderId);
}

const SET_NAMES: Record<string, string> = {
  base1: "Base Set",
  base2: "Jungle",
  base3: "Fossil",
  base4: "Base Set 2",
  base5: "Team Rocket",
  basep: "Wizards Black Star Promos",
};
