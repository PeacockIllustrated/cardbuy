"use client";

import { useState, useTransition } from "react";
import { deleteMyAccount } from "@/app/_actions/consent";

/**
 * Two-step delete confirmation. The user must type the exact phrase
 * "DELETE MY ACCOUNT" into the input before the button enables — the
 * server action rejects any other value as a belt-and-braces check.
 */
const CONFIRM_PHRASE = "DELETE MY ACCOUNT";

export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const armed = value === CONFIRM_PHRASE;

  const handleDelete = () => {
    setError(null);
    start(async () => {
      try {
        await deleteMyAccount(value);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Deletion failed.");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pop-block rounded-sm bg-paper-strong px-3 py-1.5 font-display text-[11px] tracking-wider text-warn self-start"
      >
        Delete my account
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-ink">
        Type{" "}
        <code className="bg-ink text-paper-strong font-mono text-[11px] px-1.5 py-0.5">
          {CONFIRM_PHRASE}
        </code>{" "}
        below to confirm.
      </p>
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={CONFIRM_PHRASE}
        className="border-2 border-ink rounded-sm bg-paper-strong px-3 py-2 font-mono text-[12px] tracking-wider focus:outline-none focus:border-warn"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!armed || pending}
          className="pop-block rounded-sm bg-warn text-paper-strong px-3 py-1.5 font-display text-[11px] tracking-wider disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValue("");
            setError(null);
          }}
          disabled={pending}
          className="pop-card rounded-sm bg-paper-strong px-3 py-1.5 font-display text-[11px] tracking-wider text-ink disabled:opacity-50"
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
