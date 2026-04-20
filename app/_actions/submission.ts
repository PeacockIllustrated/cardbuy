"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  GradingCompany,
  ItemCondition,
  ItemVariant,
  LewisSubmission,
  LewisSubmissionItem,
  PayoutMethod,
} from "@/lib/supabase/types";

/**
 * One seller · one active draft. Grab it (or create it). Everything in
 * this module is gated on an authenticated session; if there's no user,
 * return `null` and let the caller redirect to `/login`.
 */
async function getOrCreateDraft(): Promise<LewisSubmission | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("lewis_submissions")
    .select("*")
    .eq("seller_id", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("lewis_submissions")
    .insert({ seller_id: user.id, status: "draft" })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create draft: ${error.message}`);
  return created;
}

export async function getDraftSubmission(): Promise<{
  submission: LewisSubmission;
  items: LewisSubmissionItem[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: submission } = await supabase
    .from("lewis_submissions")
    .select("*")
    .eq("seller_id", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!submission) return null;

  const { data: items } = await supabase
    .from("lewis_submission_items")
    .select("*")
    .eq("submission_id", submission.id)
    .order("created_at", { ascending: true });

  return { submission, items: items ?? [] };
}

async function recomputeTotal(submissionId: string): Promise<number> {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("lewis_submission_items")
    .select("offered_amount_total")
    .eq("submission_id", submissionId);
  const total = (items ?? []).reduce(
    (s, i) => s + Number(i.offered_amount_total ?? 0),
    0,
  );
  const rounded = Math.round(total * 100) / 100;
  await supabase
    .from("lewis_submissions")
    .update({ total_offered: rounded })
    .eq("id", submissionId);
  return rounded;
}

export type AddItemInput = {
  cardId: string;
  variant: ItemVariant;
  condition?: ItemCondition;
  gradingCompany?: GradingCompany;
  grade?: string;
  quantity: number;
  offeredAmountPer: number;
  offerBreakdown?: Record<string, unknown>;
};

export async function addSubmissionItem(input: AddItemInput) {
  const supabase = await createClient();
  const draft = await getOrCreateDraft();
  if (!draft) redirect(`/login?next=/card/${input.cardId}`);

  const total = +(input.offeredAmountPer * input.quantity).toFixed(2);

  const { error } = await supabase.from("lewis_submission_items").insert({
    submission_id: draft.id,
    card_id: input.cardId,
    variant: input.variant,
    condition: input.condition ?? null,
    grading_company: input.gradingCompany ?? null,
    grade: input.grade ?? null,
    quantity: input.quantity,
    offered_amount_per: input.offeredAmountPer,
    offered_amount_total: total,
    offer_breakdown: input.offerBreakdown ?? {},
  });

  if (error) throw new Error(`Failed to add item: ${error.message}`);

  await recomputeTotal(draft.id);
  revalidatePath("/submission");
  revalidatePath(`/card/${input.cardId}`);
}

export async function removeSubmissionItem(itemId: string) {
  const supabase = await createClient();
  const { data: item, error: lookupErr } = await supabase
    .from("lewis_submission_items")
    .select("submission_id")
    .eq("id", itemId)
    .maybeSingle();
  if (lookupErr || !item) return;

  const { error } = await supabase
    .from("lewis_submission_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(`Failed to remove item: ${error.message}`);

  await recomputeTotal(item.submission_id);
  revalidatePath("/submission");
}

export async function updateSubmissionItemQuantity(
  itemId: string,
  quantity: number,
) {
  if (quantity < 1) return removeSubmissionItem(itemId);

  const supabase = await createClient();
  const { data: item, error: lookupErr } = await supabase
    .from("lewis_submission_items")
    .select("submission_id, offered_amount_per")
    .eq("id", itemId)
    .maybeSingle();
  if (lookupErr || !item) return;

  const total = +(Number(item.offered_amount_per) * quantity).toFixed(2);
  const { error } = await supabase
    .from("lewis_submission_items")
    .update({ quantity, offered_amount_total: total })
    .eq("id", itemId);
  if (error) throw new Error(`Failed to update qty: ${error.message}`);

  await recomputeTotal(item.submission_id);
  revalidatePath("/submission");
}

export async function setPayoutMethod(method: PayoutMethod) {
  const supabase = await createClient();
  const draft = await getOrCreateDraft();
  if (!draft) redirect("/login?next=/submission");
  const { error } = await supabase
    .from("lewis_submissions")
    .update({ payout_method: method })
    .eq("id", draft.id);
  if (error) throw new Error(`Failed to set payout: ${error.message}`);
  revalidatePath("/submission");
}

export type SubmitInput = {
  fullName: string;
  email: string;
  phone?: string;
  postcode: string;
  country: string;
  paypalEmail?: string;
  payoutMethod: PayoutMethod;
  shippingMethod: "royal_mail_tracked" | "send_yourself";
  termsAccepted: boolean;
};

/**
 * Flip the current draft to `submitted`, snapshot the seller's
 * contact/payout fields onto their `lewis_users` row, and redirect
 * to the confirmation page.
 */
export async function submitSubmission(input: SubmitInput) {
  if (!input.termsAccepted) {
    throw new Error("Terms must be accepted to submit.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/submission/submit");

  const draft = await getOrCreateDraft();
  if (!draft) redirect("/login?next=/submission/submit");

  // Snapshot user profile for future submissions.
  await supabase
    .from("lewis_users")
    .update({
      full_name: input.fullName,
      phone: input.phone ?? null,
      postcode: input.postcode,
      country: input.country,
      paypal_email:
        input.payoutMethod === "paypal" ? (input.paypalEmail ?? null) : null,
    })
    .eq("id", user.id);

  const { data: submitted, error } = await supabase
    .from("lewis_submissions")
    .update({
      status: "submitted",
      payout_method: input.payoutMethod,
      payout_target:
        input.payoutMethod === "paypal" ? (input.paypalEmail ?? null) : null,
      shipping_method: input.shippingMethod,
      terms_accepted_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })
    .eq("id", draft.id)
    .select("reference")
    .single();

  if (error || !submitted) {
    throw new Error(`Failed to submit: ${error?.message ?? "unknown"}`);
  }

  revalidatePath("/submission");
  redirect(`/submission/confirmation/${submitted.reference}`);
}

export async function getSubmissionByReference(reference: string): Promise<
  | {
      submission: LewisSubmission;
      items: LewisSubmissionItem[];
    }
  | null
> {
  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("lewis_submissions")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (!submission) return null;

  const { data: items } = await supabase
    .from("lewis_submission_items")
    .select("*")
    .eq("submission_id", submission.id)
    .order("created_at", { ascending: true });

  return { submission, items: items ?? [] };
}
