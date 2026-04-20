"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Form";
import { TR, TD } from "@/components/ui/Table";
import { CardImage } from "@/components/cardbuy/CardImage";
import { formatGBP } from "@/lib/mock/mock-offer";
import {
  removeSubmissionItem,
  updateSubmissionItemQuantity,
} from "@/app/_actions/submission";
import type { LewisSubmissionItem } from "@/lib/supabase/types";

type Props = {
  item: LewisSubmissionItem;
  cardName: string;
  setName: string;
  rarity: string | null;
  imageUrl: string | null;
};

export function SubmissionItemRow({
  item,
  cardName,
  setName,
  rarity,
  imageUrl,
}: Props) {
  const [pending, startTransition] = useTransition();

  function setQty(q: number) {
    startTransition(async () => {
      await updateSubmissionItemQuantity(item.id, q);
    });
  }

  function remove() {
    startTransition(async () => {
      await removeSubmissionItem(item.id);
    });
  }

  return (
    <TR>
      <TD>
        <div className="flex gap-3 items-start">
          <Link href={`/card/${item.card_id}`} className="shrink-0">
            <CardImage
              src={imageUrl}
              alt={cardName}
              size="sm"
              rarity={rarity}
              hideBadge
              static
            />
          </Link>
          <div className="flex flex-col gap-0.5 min-w-0">
            <Link
              href={`/card/${item.card_id}`}
              className="font-display text-[13px] leading-tight tracking-tight line-clamp-2 hover:text-pink"
            >
              {cardName}
            </Link>
            <span className="text-[11px] text-muted truncate">{setName}</span>
          </div>
        </div>
      </TD>
      <TD>
        <span className="font-display text-[11px] tracking-wider uppercase">
          {item.variant === "raw"
            ? `Raw · ${item.condition}`
            : `Graded · ${item.grading_company} ${item.grade}`}
        </span>
      </TD>
      <TD>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setQty(item.quantity - 1)}
          >
            −
          </Button>
          <span className="font-display text-[14px] min-w-8 text-center tabular-nums">
            {item.quantity}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setQty(item.quantity + 1)}
          >
            +
          </Button>
        </div>
      </TD>
      <TD className="text-right tabular-nums">
        {formatGBP(Number(item.offered_amount_per))}
      </TD>
      <TD className="text-right tabular-nums font-display">
        {formatGBP(Number(item.offered_amount_total))}
      </TD>
      <TD>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={remove}
        >
          Remove
        </Button>
      </TD>
    </TR>
  );
}
