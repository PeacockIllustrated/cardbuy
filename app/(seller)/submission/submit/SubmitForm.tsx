"use client";

import { useState, useTransition } from "react";
import { Annotation } from "@/components/wireframe/Annotation";
import { Button, Input, Select, Field } from "@/components/ui/Form";
import { submitSubmission } from "@/app/_actions/submission";
import type { LewisUser, PayoutMethod } from "@/lib/supabase/types";

type Props = {
  profile: LewisUser | null;
  defaultEmail: string;
};

export function SubmitForm({ profile, defaultEmail }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payout, setPayout] = useState<PayoutMethod>(
    (profile?.paypal_email ? "paypal" : "paypal") as PayoutMethod,
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const input = {
      fullName: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim() || undefined,
      postcode: String(form.get("postcode") ?? "").trim(),
      country: String(form.get("country") ?? "GB"),
      paypalEmail: String(form.get("paypal_email") ?? "").trim() || undefined,
      payoutMethod: payout,
      shippingMethod: String(form.get("shipping") ?? "royal_mail_tracked") as
        | "royal_mail_tracked"
        | "send_yourself",
      termsAccepted: form.get("terms") === "on",
    };
    startTransition(async () => {
      try {
        await submitSubmission(input);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6 pop-card rounded-md p-5"
    >
      <section className="flex flex-col gap-3">
        <Annotation>SELLER DETAILS</Annotation>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Full name">
            <Input
              name="name"
              required
              defaultValue={profile?.full_name ?? ""}
            />
          </Field>
          <Field label="Email">
            <Input
              name="email"
              type="email"
              required
              defaultValue={profile?.email ?? defaultEmail}
              readOnly
            />
          </Field>
          <Field label="Phone">
            <Input
              name="phone"
              type="tel"
              defaultValue={profile?.phone ?? ""}
            />
          </Field>
          <Field label="Postcode">
            <Input
              name="postcode"
              required
              defaultValue={profile?.postcode ?? ""}
            />
          </Field>
          <Field label="Country">
            <Select name="country" defaultValue={profile?.country ?? "GB"}>
              <option value="GB">United Kingdom</option>
              <option value="IE">Ireland</option>
              <option value="OTHER">Other (contact us)</option>
            </Select>
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Annotation>PAYOUT CHOICE</Annotation>
        <div className="flex border-[3px] border-ink w-fit rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setPayout("paypal")}
            className={`px-3 py-1.5 font-display text-[11px] tracking-wider uppercase ${
              payout === "paypal"
                ? "bg-ink text-paper-strong"
                : "bg-paper-strong text-ink hover:bg-yellow"
            }`}
          >
            PayPal cash
          </button>
          <button
            type="button"
            onClick={() => setPayout("store_credit")}
            className={`px-3 py-1.5 font-display text-[11px] tracking-wider uppercase border-l-[3px] border-ink ${
              payout === "store_credit"
                ? "bg-ink text-paper-strong"
                : "bg-paper-strong text-ink hover:bg-yellow"
            }`}
          >
            Store credit +20%
          </button>
        </div>
        {payout === "paypal" ? (
          <Field
            label="PayPal email"
            hint="Goes to the address in your PayPal Receive settings."
          >
            <Input
              name="paypal_email"
              type="email"
              defaultValue={profile?.paypal_email ?? profile?.email ?? ""}
              required
            />
          </Field>
        ) : (
          <p className="text-[11px] text-muted">
            Store credit boosts every line by 20%.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <Annotation>SHIPPING</Annotation>
        <div className="flex flex-col gap-2 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="shipping"
              defaultChecked
              value="royal_mail_tracked"
            />
            Royal Mail Tracked (recommended)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="shipping" value="send_yourself" />
            Send yourself (your own postage / courier)
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Annotation>TERMS</Annotation>
        <label className="flex items-start gap-2 text-[12px]">
          <input type="checkbox" name="terms" required />
          <span>
            I agree to the{" "}
            <a href="#" className="underline underline-offset-4 decoration-2">
              cardbuy seller terms
            </a>{" "}
            and confirm the cards I am sending match the conditions
            declared.
          </span>
        </label>
      </section>

      {error ? (
        <div className="bg-warn/10 border-2 border-warn text-warn rounded-md px-3 py-2 text-[12px]">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Submitting…" : "Confirm & get shipping instructions →"}
      </Button>
    </form>
  );
}
