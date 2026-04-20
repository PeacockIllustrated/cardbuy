import type { MockSubmission, MockSubmissionItem } from "./types";
import { getMockCardById } from "@/lib/fixtures/mock-adapter";

/**
 * Phase 1 mock submissions. Card IDs now reference the real first-gen
 * catalogue (base1-*, base2-*…) so clicking through a submission lands
 * on a real `/card/[id]` page. Offer amounts are still hand-picked.
 */

function item(
  partial: Omit<MockSubmissionItem, "id" | "offered_amount_total" | "card_name" | "set_name"> & {
    offered_amount_per: number;
  }
): MockSubmissionItem {
  const card = getMockCardById(partial.card_id);
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    card_name: card?.name ?? partial.card_id,
    set_name: card?.set_name ?? "",
    ...partial,
    offered_amount_total: +(partial.offered_amount_per * partial.quantity).toFixed(2),
  };
}

// base1-4  Charizard          (Rare Holo)
// base1-2  Blastoise          (Rare Holo)
// base1-15 Venusaur           (Rare Holo)
// base1-58 Pikachu            (Common)
// base1-13 Mewtwo             (Rare Holo)
// base2-6  Pinsir             (Rare Holo · Jungle)
// base3-1  Aerodactyl         (Rare Holo · Fossil)
// base3-13 Zapdos             (Rare Holo · Fossil)
// base5-4  Dark Charizard     (Rare Holo · Team Rocket)
// basep-1  Pikachu (Ivy)      (Promo)

const sub1Items: MockSubmissionItem[] = [
  item({ card_id: "base1-4",  variant: "raw",    condition: "NM", quantity: 1, offered_amount_per: 184.0 }),
  item({ card_id: "base1-2",  variant: "raw",    condition: "LP", quantity: 1, offered_amount_per: 62.4 }),
];

const sub2Items: MockSubmissionItem[] = [
  item({ card_id: "base1-4",  variant: "graded", grading_company: "PSA", grade: "9", quantity: 1, offered_amount_per: 482.0 }),
];

const sub3Items: MockSubmissionItem[] = [
  item({ card_id: "base1-58", variant: "raw",    condition: "NM", quantity: 4, offered_amount_per: 3.6 }),
  item({ card_id: "base2-6",  variant: "raw",    condition: "MP", quantity: 1, offered_amount_per: 22.3 }),
  item({ card_id: "base3-1",  variant: "raw",    condition: "NM", quantity: 1, offered_amount_per: 71.0 }),
];

const sub4Items: MockSubmissionItem[] = [
  item({ card_id: "base1-15", variant: "graded", grading_company: "PSA", grade: "10", quantity: 1, offered_amount_per: 632.0 }),
];

const sub5Items: MockSubmissionItem[] = [
  item({ card_id: "base5-4",  variant: "raw",    condition: "NM", quantity: 1, offered_amount_per: 63.0 }),
];

function totalOf(items: MockSubmissionItem[]) {
  return +items.reduce((s, i) => s + i.offered_amount_total, 0).toFixed(2);
}

export const MOCK_SUBMISSIONS: MockSubmission[] = [
  {
    id: "sub-1",
    reference: "CB-2026-000041",
    seller_name: "Alex Carter",
    seller_email: "alex@example.com",
    status: "awaiting_cards",
    payout_method: "paypal",
    shipping_method: "royal_mail_tracked",
    total_offered: totalOf(sub1Items),
    total_paid: null,
    submitted_at: "2026-04-18T14:22:00.000Z",
    items: sub1Items,
  },
  {
    id: "sub-2",
    reference: "CB-2026-000040",
    seller_name: "Priya Shah",
    seller_email: "priya@example.com",
    status: "received",
    payout_method: "store_credit",
    shipping_method: "royal_mail_tracked",
    total_offered: totalOf(sub2Items),
    total_paid: null,
    submitted_at: "2026-04-16T09:01:00.000Z",
    items: sub2Items,
  },
  {
    id: "sub-3",
    reference: "CB-2026-000039",
    seller_name: "Tom Whitfield",
    seller_email: "tom@example.com",
    status: "under_review",
    payout_method: "paypal",
    shipping_method: "send_yourself",
    total_offered: totalOf(sub3Items),
    total_paid: null,
    submitted_at: "2026-04-14T18:48:00.000Z",
    items: sub3Items,
  },
  {
    id: "sub-4",
    reference: "CB-2026-000038",
    seller_name: "Jodie Lin",
    seller_email: "jodie@example.com",
    status: "paid",
    payout_method: "paypal",
    shipping_method: "royal_mail_tracked",
    total_offered: totalOf(sub4Items),
    total_paid: totalOf(sub4Items),
    submitted_at: "2026-04-09T11:12:00.000Z",
    items: sub4Items,
  },
  {
    id: "sub-5",
    reference: "CB-2026-000037",
    seller_name: "Marcus Bell",
    seller_email: "marcus@example.com",
    status: "rejected",
    payout_method: "paypal",
    shipping_method: "royal_mail_tracked",
    total_offered: totalOf(sub5Items),
    total_paid: null,
    submitted_at: "2026-04-04T22:35:00.000Z",
    items: sub5Items,
  },
];

export const SUBMISSION_STATUS_LABELS: Record<MockSubmission["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  awaiting_cards: "Awaiting cards",
  received: "Received",
  under_review: "Under review",
  offer_revised: "Offer revised",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
  returned: "Returned",
  cancelled: "Cancelled",
};
