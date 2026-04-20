import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Input, Field } from "@/components/ui/Form";
import { updatePassword } from "@/app/_actions/auth";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ error?: string }>;

export const metadata = {
  title: "Set a new password · cardbuy",
};

/**
 * Password-reset landing page. Supabase's email link redirects here
 * with a recovery code; the `/auth/callback` handler exchanges it
 * for a session before bouncing back to this URL. This page then
 * shows the "new password" form.
 *
 * If no session exists when this page renders, the link is stale or
 * never clicked — send them back to /login?mode=forgot.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?mode=forgot&error=reset_link_expired");
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-[480px] mx-auto px-5 py-12 md:py-20 flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <span className="font-display text-[10px] tracking-[0.25em] bg-ink text-paper-strong px-2 py-1 w-fit rounded-sm">
            NEW PASSWORD
          </span>
          <h1 className="font-display text-[32px] md:text-[40px] leading-[0.9] tracking-tight">
            Set a new password.
          </h1>
          <p className="text-[13.5px] text-secondary">
            Signed in as <strong>{user.email}</strong>. Choose a new
            password to finish resetting.
          </p>
        </header>

        {sp.error ? (
          <div className="pop-card rounded-md p-4 bg-warn text-paper-strong border-warn">
            <span className="font-display text-[11px] tracking-wider">
              ERROR
            </span>
            <p className="text-[13px] mt-1">{sp.error}</p>
          </div>
        ) : null}

        <form
          action={updatePassword}
          className="pop-card rounded-md p-5 flex flex-col gap-4"
        >
          <Field label="New password" hint="At least 8 characters.">
            <Input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              name="password_confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            Update password →
          </Button>
          <Link
            href="/"
            className="font-display text-[11px] tracking-wider underline underline-offset-4 decoration-2 text-muted hover:text-pink self-start"
          >
            ← cancel
          </Link>
        </form>
      </div>
    </main>
  );
}
