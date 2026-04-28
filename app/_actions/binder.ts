"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCardsBySet, getSetById } from "@/lib/fixtures/cards";
import { summarisePacks } from "@/lib/binder/packs";
import type {
  BinderPackSummary,
  PackCardEntry,
  PackDetailPayload,
} from "@/lib/binder/packs";
import type {
  GradingCompany,
  Grade,
  ItemCondition,
  ItemVariant,
  LewisBinderEntry,
  LewisWishlistEntry,
} from "@/lib/supabase/types";

/* ─────────────────────────────────────────────────────────────────
 * Phase 6 · Binder server actions (Slice A).
 *
 * Brief: PHASE6_BINDER.md. Mirrors 0006_phase6_binder.sql.
 *
 * Conventions:
 *   • Every action calls supabase.auth.getUser() and redirects to
 *     /login if absent (mirrors submission.ts).
 *   • No input-validation library — manual narrowing.
 *   • RLS enforces ownership on every write; we still double-check
 *     ownership on delete/update paths to surface clean errors.
 *   • revalidatePath('/binder') on every mutation. Card-detail
 *     mutations also revalidate the originating card page.
 * ───────────────────────────────────────────────────────────────── */

/* ─── reads ─────────────────────────────────────────────────────── */

export async function getMyBinderEntries(): Promise<LewisBinderEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lewis_binder_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load binder: ${error.message}`);
  return data ?? [];
}

export async function getMyWishlistEntries(): Promise<LewisWishlistEntry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lewis_wishlist_entries")
    .select("*")
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to load wishlist: ${error.message}`);
  return data ?? [];
}

/** Compact query used by per-card chips on the card detail page —
 *  returns everything the user has for a single card in one trip. */
export async function getCardBinderStatus(cardId: string): Promise<{
  entries: LewisBinderEntry[];
  onWishlist: boolean;
  wishlistTarget: number | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { entries: [], onWishlist: false, wishlistTarget: null };

  const [binderRes, wishlistRes] = await Promise.all([
    supabase
      .from("lewis_binder_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("card_id", cardId),
    supabase
      .from("lewis_wishlist_entries")
      .select("target_price_gbp")
      .eq("user_id", user.id)
      .eq("card_id", cardId)
      .maybeSingle(),
  ]);

  if (binderRes.error)
    throw new Error(`Binder lookup failed: ${binderRes.error.message}`);
  if (wishlistRes.error)
    throw new Error(`Wishlist lookup failed: ${wishlistRes.error.message}`);

  return {
    entries: binderRes.data ?? [],
    onWishlist: wishlistRes.data !== null,
    wishlistTarget:
      wishlistRes.data?.target_price_gbp !== undefined &&
      wishlistRes.data.target_price_gbp !== null
        ? Number(wishlistRes.data.target_price_gbp)
        : null,
  };
}

/* ─── packs view ────────────────────────────────────────────────── */

export type {
  BinderPackSummary,
  PackCardEntry,
  PackDetailPayload,
} from "@/lib/binder/packs";

/**
 * Build a summary of every pack the signed-in user owns at least one
 * card from. Sorted newest-first by release date.
 */
export async function getMyPackSummaries(): Promise<BinderPackSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lewis_binder_entries")
    .select("card_id, quantity")
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to load pack summaries: ${error.message}`);

  return summarisePacks(data ?? []);
}

/**
 * Fetch every card in `setId` along with the signed-in user's
 * ownership status. Powers the click-to-expand pack detail in the
 * binder's Packs view.
 */
export async function getPackCardsForUser(
  setId: string,
): Promise<PackDetailPayload> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/binder");

  const set = getSetById(setId);
  if (!set) throw new Error(`Unknown pack: ${setId}`);

  const { data: entries, error } = await supabase
    .from("lewis_binder_entries")
    .select("card_id, quantity, variant")
    .eq("user_id", user.id);
  if (error)
    throw new Error(`Failed to load entries for pack: ${error.message}`);

  const ownedByCard = new Map<
    string,
    { quantity: number; variants: Set<ItemVariant> }
  >();
  for (const e of entries ?? []) {
    const slot = ownedByCard.get(e.card_id) ?? {
      quantity: 0,
      variants: new Set<ItemVariant>(),
    };
    slot.quantity += e.quantity;
    slot.variants.add(e.variant);
    ownedByCard.set(e.card_id, slot);
  }

  const cards: PackCardEntry[] = getCardsBySet(setId).map((c) => {
    const slot = ownedByCard.get(c.id);
    return {
      id: c.id,
      name: c.name,
      number: c.number,
      imageSmall: c.images.small ?? null,
      rarity: c.rarity ?? null,
      supertype: c.supertype,
      owned: slot !== undefined,
      quantity: slot?.quantity ?? 0,
      variants: slot ? Array.from(slot.variants) : [],
    };
  });

  cards.sort((a, b) => {
    const na = parseInt(a.number, 10);
    const nb = parseInt(b.number, 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.number.localeCompare(b.number);
  });

  return {
    setId: set.id,
    setName: set.name,
    series: set.series,
    releaseYear: set.releaseYear,
    printedTotal: set.printedTotal,
    cards,
  };
}

/* ─── writes ────────────────────────────────────────────────────── */

export type AddBinderEntryInput = {
  cardId: string;
  variant: ItemVariant;
  condition?: ItemCondition;
  gradingCompany?: GradingCompany;
  grade?: Grade;
  quantity?: number;
  note?: string;
};

/**
 * Add (or increment) a binder entry. If the tuple
 * (user, card, variant, condition, grading_company, grade) already
 * exists, the quantity is incremented by `input.quantity ?? 1` rather
 * than duplicating the row — matches the dedup key on the table.
 *
 * Caller is responsible for any UI confirmation (e.g. the "you already
 * have a PSA 9 of this card, add another?" prompt for graded dupes).
 */
export async function addBinderEntry(
  input: AddBinderEntryInput,
): Promise<{ entryId: string; created: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/card/${input.cardId}`);

  const qty = Math.max(1, Math.floor(input.quantity ?? 1));

  // Validate the row shape against the DB check constraint up front so
  // the error surfaces cleanly rather than as a pg error string.
  if (input.variant === "raw") {
    if (!input.condition) throw new Error("Raw cards require a condition.");
    if (input.gradingCompany || input.grade) {
      throw new Error("Raw cards cannot have grading fields.");
    }
  } else {
    if (!input.gradingCompany || !input.grade) {
      throw new Error("Graded cards require grading company and grade.");
    }
    if (input.condition) {
      throw new Error("Graded cards cannot have a raw condition.");
    }
  }

  // Look for an existing tuple. Supabase doesn't expose an "ON CONFLICT
  // DO UPDATE quantity = quantity + EXCLUDED.quantity" shortcut from
  // the JS client, so we do the read/increment ourselves. RLS keeps it
  // per-user; no race with other users. A same-user race (two tabs
  // inserting simultaneously) would collide on the unique constraint —
  // we retry once on conflict.
  const tupleFilter = {
    user_id: user.id,
    card_id: input.cardId,
    variant: input.variant,
    condition: input.condition ?? null,
    grading_company: input.gradingCompany ?? null,
    grade: input.grade ?? null,
  };

  const { data: existing, error: lookupErr } = await supabase
    .from("lewis_binder_entries")
    .select("id, quantity")
    .match(tupleFilter)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`Binder lookup failed: ${lookupErr.message}`);
  }

  if (existing) {
    const { error: updErr } = await supabase
      .from("lewis_binder_entries")
      .update({
        quantity: existing.quantity + qty,
        ...(input.note !== undefined ? { note: input.note } : {}),
      })
      .eq("id", existing.id);
    if (updErr) throw new Error(`Failed to increment: ${updErr.message}`);

    revalidatePath("/binder");
    revalidatePath(`/card/${input.cardId}`);
    return { entryId: existing.id, created: false };
  }

  const { data: created, error: insErr } = await supabase
    .from("lewis_binder_entries")
    .insert({
      ...tupleFilter,
      quantity: qty,
      is_grail: false,
      note: input.note ?? null,
    })
    .select("id")
    .single();
  if (insErr || !created) {
    throw new Error(`Failed to add entry: ${insErr?.message ?? "unknown"}`);
  }

  revalidatePath("/binder");
  revalidatePath(`/card/${input.cardId}`);
  return { entryId: created.id, created: true };
}

export async function removeBinderEntry(entryId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/binder");

  // RLS would reject a cross-user delete anyway, but this surfaces the
  // 404 case explicitly rather than pretending success on 0 rows.
  const { data: existing, error: lookupErr } = await supabase
    .from("lewis_binder_entries")
    .select("id, card_id")
    .eq("id", entryId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr || !existing) throw new Error("Entry not found.");

  const { error } = await supabase
    .from("lewis_binder_entries")
    .delete()
    .eq("id", entryId);
  if (error) throw new Error(`Failed to remove entry: ${error.message}`);

  revalidatePath("/binder");
  revalidatePath(`/card/${existing.card_id}`);
}

export type UpdateBinderEntryInput = {
  quantity?: number;
  note?: string | null;
  condition?: ItemCondition; // raw only
  gradingCompany?: GradingCompany; // graded only
  grade?: Grade; // graded only
};

export async function updateBinderEntry(
  entryId: string,
  patch: UpdateBinderEntryInput,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/binder");

  const { data: existing, error: lookupErr } = await supabase
    .from("lewis_binder_entries")
    .select("id, card_id, variant")
    .eq("id", entryId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr || !existing) throw new Error("Entry not found.");

  const update: Partial<LewisBinderEntry> = {};
  if (patch.quantity !== undefined) {
    if (patch.quantity < 1) {
      // Treat a quantity of 0 as "remove this entry" — matches the
      // submission-item update convention.
      await removeBinderEntry(entryId);
      return;
    }
    update.quantity = Math.floor(patch.quantity);
  }
  if (patch.note !== undefined) update.note = patch.note;

  // Condition / grade edits must match the row's variant. Shape check
  // mirrors the DB constraint so bad input errors cleanly on the JS
  // side rather than as a raw pg message.
  if (existing.variant === "raw") {
    if (patch.condition !== undefined) update.condition = patch.condition;
    if (patch.gradingCompany !== undefined || patch.grade !== undefined) {
      throw new Error("Cannot set grading fields on a raw entry.");
    }
  } else {
    if (patch.gradingCompany !== undefined)
      update.grading_company = patch.gradingCompany;
    if (patch.grade !== undefined) update.grade = patch.grade;
    if (patch.condition !== undefined) {
      throw new Error("Cannot set condition on a graded entry.");
    }
  }

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("lewis_binder_entries")
    .update(update)
    .eq("id", entryId);
  if (error) throw new Error(`Failed to update entry: ${error.message}`);

  revalidatePath("/binder");
  revalidatePath(`/card/${existing.card_id}`);
}

/**
 * Flip is_grail on an entry. If `makeGrail = true`, we unset any
 * existing grail for this user first — enforces the partial unique
 * index `(user_id) where is_grail = true` atomically from the client's
 * perspective (two UPDATEs, both scoped to the user).
 */
export async function setGrail(
  entryId: string,
  makeGrail: boolean,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/binder");

  const { data: existing, error: lookupErr } = await supabase
    .from("lewis_binder_entries")
    .select("id, card_id, is_grail")
    .eq("id", entryId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr || !existing) throw new Error("Entry not found.");

  if (existing.is_grail === makeGrail) return;

  if (makeGrail) {
    const { error: clearErr } = await supabase
      .from("lewis_binder_entries")
      .update({ is_grail: false })
      .eq("user_id", user.id)
      .eq("is_grail", true);
    if (clearErr)
      throw new Error(`Failed to clear prior grail: ${clearErr.message}`);
  }

  const { error } = await supabase
    .from("lewis_binder_entries")
    .update({ is_grail: makeGrail })
    .eq("id", entryId);
  if (error) throw new Error(`Failed to set grail: ${error.message}`);

  revalidatePath("/binder");
  revalidatePath(`/card/${existing.card_id}`);
}

/* ─── wishlist ──────────────────────────────────────────────────── */

export async function toggleWishlist(
  cardId: string,
): Promise<{ onWishlist: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/card/${cardId}`);

  const { data: existing, error: lookupErr } = await supabase
    .from("lewis_wishlist_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("card_id", cardId)
    .maybeSingle();
  if (lookupErr) throw new Error(`Wishlist lookup failed: ${lookupErr.message}`);

  if (existing) {
    const { error } = await supabase
      .from("lewis_wishlist_entries")
      .delete()
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to remove from wishlist: ${error.message}`);
    revalidatePath("/binder");
    revalidatePath(`/card/${cardId}`);
    return { onWishlist: false };
  }

  const { error } = await supabase
    .from("lewis_wishlist_entries")
    .insert({ user_id: user.id, card_id: cardId });
  if (error) throw new Error(`Failed to add to wishlist: ${error.message}`);

  revalidatePath("/binder");
  revalidatePath(`/card/${cardId}`);
  return { onWishlist: true };
}

/**
 * Set or clear the target-price on a wishlist entry. Creates the
 * entry if it doesn't exist (upsert semantics) so the missing-slot
 * panel can set a target without requiring the user to click
 * "Add to wishlist" first.
 */
export async function setWishlistTarget(
  cardId: string,
  targetGbp: number | null,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/card/${cardId}`);

  if (targetGbp !== null && (isNaN(targetGbp) || targetGbp < 0)) {
    throw new Error("Target price must be a non-negative number or null.");
  }

  const rounded = targetGbp === null ? null : Math.round(targetGbp * 100) / 100;

  const { error } = await supabase.from("lewis_wishlist_entries").upsert(
    {
      user_id: user.id,
      card_id: cardId,
      target_price_gbp: rounded,
    },
    { onConflict: "user_id,card_id" },
  );
  if (error) throw new Error(`Failed to set target: ${error.message}`);

  revalidatePath("/binder");
  revalidatePath(`/card/${cardId}`);
}
