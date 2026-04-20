import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Input, Field } from "@/components/ui/Form";
import {
  signInWithPassword,
  signUpWithPassword,
  requestPasswordReset,
} from "@/app/_actions/auth";
import { createClient } from "@/lib/supabase/server";

type Mode = "signin" | "signup" | "signup_sent" | "forgot" | "forgot_sent";

type SearchParams = Promise<{
  mode?: string;
  error?: string;
  email?: string;
  next?: string;
}>;

export const metadata = {
  title: "Sign in · cardbuy",
};

function resolveMode(raw?: string): Mode {
  switch (raw) {
    case "signup":
    case "signup_sent":
    case "forgot":
    case "forgot_sent":
    case "signin":
      return raw;
    default:
      return "signin";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  // Already signed in? Bounce straight through.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(sp.next ?? "/submission");
  }

  const mode = resolveMode(sp.mode);
  const email = sp.email ?? "";
  const error = sp.error ?? null;

  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-[560px] mx-auto px-5 py-10 md:py-16 flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <span className="font-display text-[10px] tracking-[0.25em] bg-ink text-paper-strong px-2 py-1 w-fit rounded-sm">
            {mode === "signup" || mode === "signup_sent"
              ? "CREATE ACCOUNT"
              : mode === "forgot" || mode === "forgot_sent"
                ? "RESET PASSWORD"
                : "SIGN IN"}
          </span>
          <h1 className="font-display text-[32px] md:text-[44px] leading-[0.9] tracking-tight">
            {mode === "signup"
              ? "Create your cardbuy account."
              : mode === "signup_sent"
                ? "Check your email."
                : mode === "forgot"
                  ? "Forgot your password?"
                  : mode === "forgot_sent"
                    ? "Check your email."
                    : "Welcome back."}
          </h1>
          <p className="text-[13.5px] text-secondary max-w-[54ch]">
            {mode === "signup"
              ? "Sellers need an account so we can track your submissions and pay you out. Email and a password — nothing else."
              : mode === "signup_sent"
                ? `We sent a confirmation link to ${email || "your inbox"}. Open it to finish creating your account, then sign in.`
                : mode === "forgot"
                  ? "Enter your email and we'll send a password-reset link."
                  : mode === "forgot_sent"
                    ? `If an account exists for ${email || "that email"}, we've sent a password-reset link. Check your inbox.`
                    : "Sign in to see your submissions, quotes, and payouts."}
          </p>
        </header>

        {/* Mode tabs — hidden on the 'sent' confirmation screens. */}
        {mode === "signin" || mode === "signup" || mode === "forgot" ? (
          <div className="flex border-[3px] border-ink rounded-md overflow-hidden">
            <TabLink
              href={`/login${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`}
              active={mode === "signin"}
            >
              Sign in
            </TabLink>
            <TabLink
              href={`/login?mode=signup${sp.next ? `&next=${encodeURIComponent(sp.next)}` : ""}`}
              active={mode === "signup"}
            >
              Create account
            </TabLink>
            <TabLink
              href="/login?mode=forgot"
              active={mode === "forgot"}
              right
            >
              Forgot
            </TabLink>
          </div>
        ) : null}

        {error ? (
          <div className="pop-card rounded-md p-4 bg-warn text-paper-strong border-warn">
            <span className="font-display text-[11px] tracking-wider">
              ERROR
            </span>
            <p className="text-[13px] mt-1">{error}</p>
          </div>
        ) : null}

        {mode === "signin" ? (
          <form
            action={signInWithPassword}
            className="pop-card rounded-md p-5 flex flex-col gap-4"
          >
            {sp.next ? (
              <input type="hidden" name="next" value={sp.next} />
            ) : null}
            <Field label="Email">
              <Input
                name="email"
                type="email"
                required
                defaultValue={email}
                autoComplete="email"
                autoFocus
              />
            </Field>
            <Field label="Password">
              <Input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                minLength={8}
              />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              Sign in →
            </Button>
            <div className="flex items-center justify-between text-[11px] font-display tracking-wider">
              <Link
                href="/login?mode=signup"
                className="underline underline-offset-4 decoration-2 text-muted hover:text-pink"
              >
                New here? Create an account
              </Link>
              <Link
                href="/login?mode=forgot"
                className="underline underline-offset-4 decoration-2 text-muted hover:text-pink"
              >
                Forgot password
              </Link>
            </div>
          </form>
        ) : mode === "signup" ? (
          <form
            action={signUpWithPassword}
            className="pop-card rounded-md p-5 flex flex-col gap-4"
          >
            {sp.next ? (
              <input type="hidden" name="next" value={sp.next} />
            ) : null}
            <Field label="Full name (optional)">
              <Input
                name="full_name"
                type="text"
                autoComplete="name"
                placeholder="Jane Seller"
              />
            </Field>
            <Field label="Email">
              <Input
                name="email"
                type="email"
                required
                defaultValue={email}
                autoComplete="email"
              />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <Input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm password">
              <Input
                name="password_confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              Create account →
            </Button>
            <p className="text-[11px] text-muted">
              By creating an account you agree to the{" "}
              <Link href="#" className="underline underline-offset-4">
                cardbuy terms
              </Link>
              .
            </p>
            <Link
              href="/login"
              className="font-display text-[11px] tracking-wider underline underline-offset-4 decoration-2 text-muted hover:text-pink self-start"
            >
              ← already have an account? sign in
            </Link>
          </form>
        ) : mode === "forgot" ? (
          <form
            action={requestPasswordReset}
            className="pop-card rounded-md p-5 flex flex-col gap-4"
          >
            <Field label="Email">
              <Input
                name="email"
                type="email"
                required
                defaultValue={email}
                autoComplete="email"
                autoFocus
              />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              Email me a reset link →
            </Button>
            <Link
              href="/login"
              className="font-display text-[11px] tracking-wider underline underline-offset-4 decoration-2 text-muted hover:text-pink self-start"
            >
              ← back to sign in
            </Link>
          </form>
        ) : (
          // signup_sent / forgot_sent
          <div className="pop-card rounded-md p-5 flex flex-col gap-3">
            <span className="font-display text-[11px] tracking-wider bg-yellow text-ink border-2 border-ink px-2 py-1 w-fit rounded-sm">
              EMAIL ON THE WAY
            </span>
            <p className="text-[13px] text-secondary">
              {mode === "signup_sent"
                ? "Click the link in the email to verify your address, then come back here to sign in."
                : "Click the link in the email to set a new password."}
            </p>
            <Link
              href="/login"
              className="font-display text-[11px] tracking-wider underline underline-offset-4 decoration-2 text-muted hover:text-pink self-start"
            >
              ← back to sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function TabLink({
  href,
  active,
  right,
  children,
}: {
  href: string;
  active: boolean;
  right?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex-1 text-center px-3 py-2 font-display text-[11px] tracking-wider uppercase transition-colors ${
        right ? "border-l-[3px] border-ink" : ""
      } ${
        active
          ? "bg-ink text-paper-strong"
          : "bg-paper-strong text-ink hover:bg-yellow"
      } ${
        !active && !right ? "border-r-[3px] border-ink" : ""
      }`}
    >
      {children}
    </Link>
  );
}
