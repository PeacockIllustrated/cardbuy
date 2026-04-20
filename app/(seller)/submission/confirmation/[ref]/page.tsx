import { notFound } from "next/navigation";
import Link from "next/link";
import { Annotation } from "@/components/wireframe/Annotation";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
import { getSubmissionByReference } from "@/app/_actions/submission";
import { formatGBP } from "@/lib/mock/mock-offer";

type Params = Promise<{ ref: string }>;

export default async function ConfirmationPage({
  params,
}: {
  params: Params;
}) {
  const { ref } = await params;
  const result = await getSubmissionByReference(ref);
  if (!result) notFound();

  const { submission, items } = result;
  const totalCards = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="max-w-[900px] mx-auto px-4 py-10 flex flex-col gap-8">
      <header className="pop-block bg-yellow rounded-lg p-6 flex flex-col gap-3">
        <span className="bg-ink text-paper-strong w-fit px-2 py-1 font-display text-[10px] tracking-wider">
          Submission logged
        </span>
        <h1 className="font-display text-[32px] md:text-[40px] leading-[0.95] tracking-tight break-all">
          {submission.reference}
        </h1>
        <p className="text-[14px]">
          Thanks — your submission is logged with a total offer of{" "}
          <strong className="font-display tabular-nums">
            {formatGBP(Number(submission.total_offered ?? 0))}
          </strong>{" "}
          across <strong className="font-display">{totalCards}</strong> cards.
          Quote this reference in any emails.
        </p>
      </header>

      <section className="pop-card rounded-md p-5 flex flex-col gap-2">
        <Annotation>SHIP YOUR CARDS TO</Annotation>
        <address className="not-italic font-display text-[15px] leading-[1.6] tracking-tight">
          Peacock Solutions
          <br />
          [address line 1 TBC]
          <br />
          [address line 2 TBC]
          <br />
          [city TBC]
          <br />
          [postcode TBC]
          <br />
          United Kingdom
        </address>
        <TodoMarker phase={2}>real shipping address from admin config</TodoMarker>
      </section>

      <section className="flex flex-col gap-3">
        <Annotation>WHAT HAPPENS NEXT · 4 steps</Annotation>
        <ol className="flex flex-col gap-3 text-[14px] list-decimal pl-5">
          <li>Pack your cards in penny sleeves + toploaders + a padded mailer.</li>
          <li>Post via Royal Mail Tracked. Keep your receipt until we mark received.</li>
          <li>
            We verify each card&apos;s condition on arrival. If a card is graded
            differently to your declaration, we revise the offer and you can
            accept or request return.
          </li>
          <li>We pay via PayPal within 48h of approval.</li>
        </ol>
      </section>

      <section className="pop-card rounded-md p-4 flex flex-col gap-2">
        <Annotation>STATUS</Annotation>
        <div className="font-display text-[18px] tracking-tight uppercase">
          {statusLabel(submission.status)}
        </div>
        <div className="text-[12px] text-muted">
          We&apos;ll email you when the parcel is received.{" "}
          <TodoMarker phase={4}>transactional email</TodoMarker>
        </div>
      </section>

      <footer className="text-[12px] text-muted">
        Questions? Email{" "}
        <span className="underline">[support@cardbuy.tbc]</span> and quote{" "}
        {submission.reference}.{" "}
        <Link href="/packs" className="underline underline-offset-4 decoration-2">
          Build another submission →
        </Link>
      </footer>
    </div>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Awaiting cards";
    case "awaiting_cards":
      return "Awaiting cards";
    case "received":
      return "Received";
    case "under_review":
      return "Under review";
    case "offer_revised":
      return "Offer revised";
    case "approved":
      return "Approved";
    case "paid":
      return "Paid";
    case "rejected":
      return "Rejected";
    case "returned":
      return "Returned";
    case "cancelled":
      return "Cancelled";
    default:
      return s;
  }
}
