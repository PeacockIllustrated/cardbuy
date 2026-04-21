"use client";

import { useState } from "react";

export function PaymentsComingSoonModal({
  reference,
  buyerEmail,
}: {
  reference: string;
  buyerEmail: string;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Payments coming soon"
      className="fixed inset-0 z-[100] bg-ink/70 flex items-center justify-center p-4"
    >
      <div className="pop-static bg-paper-strong rounded-md w-full max-w-[480px] flex flex-col gap-3 p-5">
        <div className="font-display text-[10px] tracking-[0.25em] text-muted">
          Payments coming soon
        </div>
        <h2 className="font-display text-[22px] leading-tight tracking-tight">
          Your order is in 🎉
        </h2>
        <p className="text-[13px] leading-snug text-secondary">
          Stripe payment capture isn&rsquo;t live yet — we&rsquo;re
          finishing the integration. Your order ({" "}
          <strong className="font-display">{reference}</strong>) is now on
          Lewis&rsquo;s dashboard. When we launch real payments, we&rsquo;ll
          email <strong>{buyerEmail}</strong> so you can complete the
          purchase.
        </p>
        <p className="text-[12px] text-secondary">
          Your items are held while Lewis reviews. If you&rsquo;d prefer to
          cancel, hit reply on our confirmation email.
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="pop-block rounded-sm bg-teal px-3 py-2 font-display text-[12px] tracking-wider text-ink self-end"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
