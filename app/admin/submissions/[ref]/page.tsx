import Link from "next/link";
import { notFound } from "next/navigation";
import { Annotation } from "@/components/wireframe/Annotation";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import {
  SubmissionReview,
  type ConditionOfferMap,
} from "@/components/cardbuy/SubmissionReview";
import { getAdminSubmission } from "@/app/_actions/admin";
import { getMarginConfig } from "@/app/_actions/margins";
import { getMockCardById } from "@/lib/fixtures/mock-adapter";
import { computeMockOffer } from "@/lib/mock/mock-offer";
import type {
  Condition,
  MockSubmission,
  MockSubmissionItem,
  SubmissionStatus,
} from "@/lib/mock/types";

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Awaiting cards",
  awaiting_cards: "Awaiting cards",
  received: "Received",
  under_review: "Under review",
  offer_revised: "Offered",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
  returned: "Returned",
  cancelled: "Cancelled",
};

type Params = Promise<{ ref: string }>;

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Params;
}) {
  const { ref } = await params;
  const [result, marginConfig] = await Promise.all([
    getAdminSubmission(ref),
    getMarginConfig(),
  ]);
  if (!result) notFound();

  const { submission, items, seller } = result;

  // Adapt the DB rows into the MockSubmission shape that SubmissionReview
  // expects. Phase 2b will refactor SubmissionReview to take the real
  // types directly; for now this adapter keeps the component logic
  // untouched.
  const adaptedItems: MockSubmissionItem[] = items.map((it) => {
    const card = getMockCardById(it.card_id);
    return {
      id: it.id,
      card_id: it.card_id,
      card_name: card?.name ?? it.card_id,
      set_name: card?.set_name ?? "",
      variant: it.variant,
      condition: it.condition ?? undefined,
      grading_company: it.grading_company ?? undefined,
      grade: it.grade as MockSubmissionItem["grade"],
      quantity: it.quantity,
      offered_amount_per: Number(it.offered_amount_per),
      offered_amount_total: Number(it.offered_amount_total),
    };
  });

  const adaptedSubmission: MockSubmission = {
    id: submission.id,
    reference: submission.reference,
    seller_name: seller.full_name ?? seller.email,
    seller_email: seller.email,
    status: submission.status as SubmissionStatus,
    payout_method: submission.payout_method ?? "paypal",
    shipping_method:
      (submission.shipping_method as MockSubmission["shipping_method"]) ??
      "royal_mail_tracked",
    total_offered: Number(submission.total_offered ?? 0),
    total_paid: submission.total_paid ? Number(submission.total_paid) : null,
    submitted_at:
      submission.submitted_at ?? submission.created_at,
    items: adaptedItems,
  };

  // Precompute per-condition offers server-side so the client review
  // component can recalculate downgrades without bundling the server-only
  // card fixture.
  const offerByCondition: ConditionOfferMap = {};
  for (const item of adaptedItems) {
    if (item.variant !== "raw") continue;
    const card = getMockCardById(item.card_id);
    if (!card) continue;
    const perCondition: Partial<Record<Condition, number>> = {};
    for (const c of CONDITIONS) {
      perCondition[c] = computeMockOffer(
        card,
        { variant: "raw", condition: c },
        marginConfig,
      ).offerGbp;
    }
    offerByCondition[item.id] = perCondition;
  }

  return (
    <div className="px-4 py-6 max-w-[1200px] mx-auto flex flex-col gap-6">
      <nav className="text-[12px] text-muted font-display tracking-wider">
        <Link
          href="/admin/submissions"
          className="underline underline-offset-4 decoration-2 hover:text-pink"
        >
          ← back to queue
        </Link>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Metadata column */}
        <aside className="pop-card rounded-md p-4 flex flex-col gap-3 h-fit">
          <Annotation>SUBMISSION META</Annotation>
          <h1 className="font-mono text-[18px] break-all tabular-nums">
            {submission.reference}
          </h1>
          <dl className="text-[12px] flex flex-col gap-2">
            <div>
              <dt className="text-muted font-display uppercase tracking-wider text-[10px]">
                Seller
              </dt>
              <dd className="font-display">{seller.full_name ?? "—"}</dd>
              <dd className="text-muted break-all">{seller.email}</dd>
              {seller.postcode ? (
                <dd className="text-muted">
                  {seller.postcode}, {seller.country ?? "GB"}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-muted font-display uppercase tracking-wider text-[10px]">
                Status
              </dt>
              <dd className="font-display tracking-tight uppercase">
                {STATUS_LABELS[submission.status] ?? submission.status}
              </dd>
            </div>
            <div>
              <dt className="text-muted font-display uppercase tracking-wider text-[10px]">
                Payout
              </dt>
              <dd>
                {submission.payout_method === "paypal"
                  ? "PayPal cash"
                  : submission.payout_method === "store_credit"
                    ? "Store credit"
                    : "—"}
              </dd>
              {seller.paypal_email ? (
                <dd className="text-muted break-all">{seller.paypal_email}</dd>
              ) : null}
            </div>
            <div>
              <dt className="text-muted font-display uppercase tracking-wider text-[10px]">
                Shipping
              </dt>
              <dd>
                {submission.shipping_method === "royal_mail_tracked"
                  ? "Royal Mail Tracked"
                  : "Self-posted"}
              </dd>
            </div>
            <div>
              <dt className="text-muted font-display uppercase tracking-wider text-[10px]">
                Submitted
              </dt>
              <dd className="tabular-nums font-mono text-[11px]">
                {submission.submitted_at
                  ? new Date(submission.submitted_at)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")
                  : "—"}
              </dd>
            </div>
          </dl>
          <TodoMarker phase={4}>tracking number, parcel-arrival webhook</TodoMarker>
        </aside>

        {/* Cards + verification + summary */}
        <div className="flex flex-col gap-4">
          <SubmissionReview
            submission={adaptedSubmission}
            offerByCondition={offerByCondition}
          />
          <p className="text-[11px] text-muted font-display tracking-wider">
            Live data · <code className="font-mono">lewis_submissions</code> +
            <code className="font-mono ml-1">lewis_submission_items</code>.
            Verification UI is still local-state —{" "}
            <TodoMarker phase={4}>persist revised offers</TodoMarker>.
          </p>
        </div>
      </div>
    </div>
  );
}
