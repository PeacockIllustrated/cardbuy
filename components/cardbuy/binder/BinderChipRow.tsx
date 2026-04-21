"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addBinderEntry,
  removeBinderEntry,
  toggleWishlist,
} from "@/app/_actions/binder";
import { GradedCardScanner } from "@/components/cardbuy/binder/GradedCardScanner";
import type {
  GradingCompany,
  Grade,
  ItemCondition,
  LewisBinderEntry,
} from "@/lib/supabase/types";

/* ─────────────────────────────────────────────────────────────────
 * BinderChipRow — one-tap "I own this" / "I want this" controls on
 * the card detail page. The actual add flow lives in an inline
 * drawer so the chip row itself stays compact.
 *
 * Signed-out visitors see the chips but any click routes to
 * /login?next=/card/[id] — no fake preview behaviour.
 * ───────────────────────────────────────────────────────────────── */

const CONDITIONS: ItemCondition[] = ["NM", "LP", "MP", "HP", "DMG"];
const GRADING_COMPANIES: GradingCompany[] = ["PSA", "CGC", "BGS", "SGC", "ACE"];
const GRADES: Grade[] = ["10", "9.5", "9", "8.5", "8", "7"];

type Props = {
  cardId: string;
  cardName: string;
  isAuthenticated: boolean;
  initialEntries: LewisBinderEntry[];
  initialOnWishlist: boolean;
};

export function BinderChipRow({
  cardId,
  cardName,
  isAuthenticated,
  initialEntries,
  initialOnWishlist,
}: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [copiesOpen, setCopiesOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [onWishlist, setOnWishlist] = useState(initialOnWishlist);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalCopies = initialEntries.reduce((a, e) => a + e.quantity, 0);

  const gotoLogin = () => {
    router.push(`/login?next=/card/${cardId}`);
  };

  const handleOwnClick = () => {
    setError(null);
    if (!isAuthenticated) return gotoLogin();
    if (totalCopies > 0) {
      setCopiesOpen((v) => !v);
      setAddOpen(false);
    } else {
      setAddOpen((v) => !v);
      setCopiesOpen(false);
    }
  };

  const handleWishlistClick = () => {
    setError(null);
    if (!isAuthenticated) return gotoLogin();
    const next = !onWishlist;
    setOnWishlist(next);
    start(async () => {
      try {
        await toggleWishlist(cardId);
      } catch (e) {
        setOnWishlist(!next);
        setError(e instanceof Error ? e.message : "Failed to update wishlist");
      }
    });
  };

  return (
    <div className="pop-card rounded-md bg-paper-strong p-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleOwnClick}
          disabled={pending}
          className={`pop-block rounded-sm px-3 py-1.5 font-display text-[11px] tracking-wider text-ink flex items-center gap-2 disabled:opacity-50 ${
            totalCopies > 0 ? "bg-teal" : "bg-paper-strong"
          }`}
        >
          <span className="text-[13px] leading-none">
            {totalCopies > 0 ? "✓" : "+"}
          </span>
          <span>
            {totalCopies > 0
              ? `In your binder · ×${totalCopies}`
              : "Add to binder"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleWishlistClick}
          disabled={pending}
          className={`pop-block rounded-sm px-3 py-1.5 font-display text-[11px] tracking-wider text-ink flex items-center gap-2 disabled:opacity-50 ${
            onWishlist ? "bg-yellow" : "bg-paper-strong"
          }`}
        >
          <span className="text-[13px] leading-none">★</span>
          <span>
            {onWishlist ? "On your wishlist" : "Add to wishlist"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) return gotoLogin();
            setScannerOpen(true);
          }}
          disabled={pending}
          className="pop-block rounded-sm bg-pink px-3 py-1.5 font-display text-[11px] tracking-wider text-ink flex items-center gap-2 disabled:opacity-50"
          title="Scan a graded slab with your camera"
        >
          <span className="text-[13px] leading-none">◉</span>
          <span>Scan graded</span>
        </button>
      </div>

      {/* Inline add drawer */}
      {addOpen && isAuthenticated ? (
        <AddDrawer
          cardId={cardId}
          cardName={cardName}
          existingEntries={initialEntries}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {/* Inline copies drawer */}
      {copiesOpen && isAuthenticated && totalCopies > 0 ? (
        <CopiesDrawer
          entries={initialEntries}
          onAddAnother={() => {
            setCopiesOpen(false);
            setAddOpen(true);
          }}
        />
      ) : null}

      {error ? (
        <div
          role="alert"
          className="text-[11px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-2 py-1"
        >
          {error}
        </div>
      ) : null}

      {scannerOpen && isAuthenticated ? (
        <GradedCardScanner
          cardId={cardId}
          cardName={cardName}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Add drawer — shared shape with BinderPanel's AddEntryForm but lives
 * here so the card-detail page can collapse without loading the full
 * binder component tree.
 * ───────────────────────────────────────────────────────────────── */

function AddDrawer({
  cardId,
  cardName,
  existingEntries,
  onClose,
}: {
  cardId: string;
  cardName: string;
  existingEntries: LewisBinderEntry[];
  onClose: () => void;
}) {
  const [variant, setVariant] = useState<"raw" | "graded">("raw");
  const [condition, setCondition] = useState<ItemCondition>("NM");
  const [gradingCompany, setGradingCompany] = useState<GradingCompany>("PSA");
  const [grade, setGrade] = useState<Grade>("9");
  const [quantity, setQuantity] = useState(1);
  const [confirmDupe, setConfirmDupe] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dupeExists =
    variant === "graded" &&
    existingEntries.some(
      (e) =>
        e.variant === "graded" &&
        e.grading_company === gradingCompany &&
        e.grade === grade,
    );

  const handleSubmit = () => {
    if (dupeExists && !confirmDupe) {
      setConfirmDupe(true);
      return;
    }
    setError(null);
    start(async () => {
      try {
        await addBinderEntry({
          cardId,
          variant,
          condition: variant === "raw" ? condition : undefined,
          gradingCompany: variant === "graded" ? gradingCompany : undefined,
          grade: variant === "graded" ? grade : undefined,
          quantity,
        });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add");
      }
    });
  };

  return (
    <div className="pop-static rounded-sm bg-paper p-3 flex flex-col gap-2.5">
      <div className="font-display text-[10px] tracking-[0.25em] text-muted">
        Add {cardName}
      </div>

      <div className="flex items-center gap-2">
        <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
          Variant
        </span>
        <div className="flex gap-1">
          {(["raw", "graded"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setVariant(v);
                setConfirmDupe(false);
              }}
              className={`border-2 border-ink rounded-sm px-2 py-0.5 font-display text-[10px] tracking-wider ${
                variant === v ? "bg-yellow" : "bg-paper-strong"
              }`}
            >
              {v === "raw" ? "Raw" : "Graded"}
            </button>
          ))}
        </div>
      </div>

      {variant === "raw" ? (
        <label className="flex items-center gap-2">
          <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
            Condition
          </span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as ItemCondition)}
            className="font-display text-[11px] tracking-wider bg-paper-strong border-2 border-ink rounded-sm px-2 py-1"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
            Grade
          </span>
          <select
            value={gradingCompany}
            onChange={(e) => {
              setGradingCompany(e.target.value as GradingCompany);
              setConfirmDupe(false);
            }}
            className="font-display text-[11px] tracking-wider bg-paper-strong border-2 border-ink rounded-sm px-2 py-1"
          >
            {GRADING_COMPANIES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value as Grade);
              setConfirmDupe(false);
            }}
            className="font-display text-[11px] tracking-wider bg-paper-strong border-2 border-ink rounded-sm px-2 py-1"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2">
        <span className="font-display text-[10px] tracking-[0.2em] text-muted shrink-0">
          Qty
        </span>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))
          }
          className="w-16 font-display text-[12px] tabular-nums bg-paper-strong border-2 border-ink rounded-sm px-2 py-1"
        />
      </label>

      {dupeExists && confirmDupe ? (
        <div className="text-[11px] text-ink bg-yellow border-2 border-ink rounded-sm px-2 py-1.5">
          You already have a {gradingCompany} {grade} copy. Click{" "}
          <strong>Add</strong> again to confirm.
        </div>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="pop-block rounded-sm bg-teal px-3 py-1 font-display text-[11px] tracking-wider text-ink disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="pop-card rounded-sm bg-paper-strong px-3 py-1 font-display text-[11px] tracking-wider text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="text-[11px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-2 py-1"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Copies drawer — lists all entries for this card, with per-entry
 * Remove, plus a "Add another copy" shortcut.
 * ───────────────────────────────────────────────────────────────── */

function CopiesDrawer({
  entries,
  onAddAnother,
}: {
  entries: LewisBinderEntry[];
  onAddAnother: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRemove = (entryId: string) => {
    setError(null);
    start(async () => {
      try {
        await removeBinderEntry(entryId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  };

  return (
    <div className="pop-static rounded-sm bg-paper p-3 flex flex-col gap-2">
      <div className="font-display text-[10px] tracking-[0.25em] text-muted">
        Your copies
      </div>
      <ul className="flex flex-col gap-1.5">
        {entries.map((e) => (
          <li
            key={e.id}
            className="pop-card rounded-sm bg-paper-strong px-2.5 py-1.5 flex items-center gap-2"
          >
            {e.is_grail ? (
              <span
                className="w-5 h-5 grid place-items-center rounded-full bg-yellow border-2 border-ink font-display text-[10px] shrink-0"
                title="Grail"
              >
                ★
              </span>
            ) : null}
            <span className="font-display text-[10px] tracking-wider text-ink">
              {e.variant === "graded"
                ? `${e.grading_company} ${e.grade}`
                : e.condition}
            </span>
            {e.quantity > 1 ? (
              <span className="ml-auto font-display text-[10px] tabular-nums text-teal">
                ×{e.quantity}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => handleRemove(e.id)}
              disabled={pending}
              className="ml-auto font-display text-[9px] tracking-wider text-ink/50 hover:text-warn underline underline-offset-2 decoration-1 disabled:opacity-40"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAddAnother}
        className="pop-block rounded-sm bg-paper-strong px-3 py-1 font-display text-[11px] tracking-wider text-ink self-start"
      >
        + Add another copy
      </button>
      {error ? (
        <div
          role="alert"
          className="text-[11px] text-warn bg-warn/10 border-2 border-warn rounded-sm px-2 py-1"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
