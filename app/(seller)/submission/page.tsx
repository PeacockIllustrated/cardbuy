import Link from "next/link";
import { Annotation } from "@/components/wireframe/Annotation";
import { Button } from "@/components/ui/Form";
import { Table, THead, TBody, TR, TH } from "@/components/ui/Table";
import { getDraftSubmission } from "@/app/_actions/submission";
import { getCardById, setOf } from "@/lib/fixtures/cards";
import { formatGBP } from "@/lib/mock/mock-offer";
import { createClient } from "@/lib/supabase/server";
import { SubmissionItemRow } from "./SubmissionItemRow";

export default async function SubmissionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-12 flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="bg-yellow text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider rounded-sm">
            Selling to us
          </span>
          <h1 className="font-display text-[36px] leading-none tracking-tight">
            Your submission
          </h1>
        </header>
        <div className="pop-card rounded-md p-8 text-center flex flex-col gap-3 items-center">
          <span className="font-display text-[22px]">Sign in to build your submission</span>
          <p className="text-[13px] text-secondary max-w-[42ch]">
            We save your draft to your account so you can add cards from
            any device and come back to it later.
          </p>
          <Link href="/login?next=/submission" className="inline-block mt-2">
            <Button size="lg">Sign in →</Button>
          </Link>
        </div>
      </div>
    );
  }

  const draft = await getDraftSubmission();
  const items = draft?.items ?? [];
  const totalCards = items.reduce((s, i) => s + i.quantity, 0);
  const totalOffered = draft?.submission.total_offered ?? 0;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="bg-yellow text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider rounded-sm">
          Selling to us
        </span>
        <h1 className="font-display text-[36px] leading-none tracking-tight">
          Your submission
        </h1>
        {draft ? (
          <p className="text-[12px] text-muted font-display tracking-wider tabular-nums">
            Draft {draft.submission.reference}
          </p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="pop-card rounded-md p-10 text-center flex flex-col gap-3 items-center">
          <span className="font-display text-[22px]">
            Your submission is empty
          </span>
          <p className="text-[13px] text-secondary max-w-[42ch]">
            Pick a pack and tap the cards you want to sell. We&apos;ll
            quote every card in GBP on the spot.
          </p>
          <Link href="/packs" className="inline-block mt-2">
            <Button size="lg">Browse packs →</Button>
          </Link>
        </div>
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Card</TH>
                <TH>Variant</TH>
                <TH>Qty</TH>
                <TH className="text-right">Per</TH>
                <TH className="text-right">Line total</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {items.map((item) => {
                const card = getCardById(item.card_id);
                const set = card ? setOf(card) : undefined;
                return (
                  <SubmissionItemRow
                    key={item.id}
                    item={item}
                    cardName={card?.name ?? item.card_id}
                    setName={set?.name ?? "—"}
                    rarity={card?.rarity ?? null}
                    imageUrl={card?.images.small ?? null}
                  />
                );
              })}
            </TBody>
          </Table>

          <section className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">
            <div className="pop-card rounded-md p-4 flex flex-col gap-2">
              <Annotation>NEXT STEP</Annotation>
              <p className="text-[13px] text-secondary">
                When you&apos;re done adding cards, head to the submit
                page to enter your details and get shipping instructions.
              </p>
            </div>

            <div className="pop-block bg-paper-strong rounded-md p-4 flex flex-col gap-3">
              <Annotation>SUMMARY</Annotation>
              <div className="flex justify-between text-[13px] tabular-nums">
                <span className="text-secondary">Cards</span>
                <span className="font-display">{totalCards}</span>
              </div>
              <div className="flex justify-between text-[13px] tabular-nums">
                <span className="text-secondary">Lines</span>
                <span className="font-display">{items.length}</span>
              </div>
              <div className="border-t-[3px] border-ink pt-3 flex justify-between items-baseline">
                <span className="text-[10px] font-display uppercase tracking-wider text-secondary">
                  Total offer
                </span>
                <span className="font-display text-[28px] tabular-nums leading-none">
                  {formatGBP(Number(totalOffered))}
                </span>
              </div>
              <Link href="/submission/submit" className="block">
                <Button size="lg" className="w-full">
                  Continue to submit →
                </Button>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
