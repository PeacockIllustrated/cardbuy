"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth server actions — password-based sign in / sign up, plus
 * password reset via email link.
 *
 * Errors round-trip via query params to the relevant page so we don't
 * need client-side state in the form. Every redirect target is inside
 * this app (never user-controlled).
 */

function validPassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 72) return "Password must be under 72 characters";
  return null;
}

/**
 * Sign in with email + password. On success redirects to `next`
 * (default `/submission`). On failure bounces back to /login with an
 * error message.
 */
export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/submission");

  if (!email || !password) {
    redirect("/login?error=missing_fields");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/login?mode=signin&error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`,
    );
  }

  revalidatePath("/", "layout");
  redirect(next);
}

/**
 * Sign up with email + password. If Supabase is configured to require
 * email confirmation (default), the user lands on the "check your
 * email" state. If confirmation is off, they're signed in immediately.
 */
export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const next = String(formData.get("next") ?? "/submission");

  if (!email || !password) {
    redirect("/login?mode=signup&error=missing_fields");
  }
  if (password !== passwordConfirm) {
    redirect(
      `/login?mode=signup&error=${encodeURIComponent("Passwords don't match")}&email=${encodeURIComponent(email)}`,
    );
  }
  const pwErr = validPassword(password);
  if (pwErr) {
    redirect(
      `/login?mode=signup&error=${encodeURIComponent(pwErr)}&email=${encodeURIComponent(email)}`,
    );
  }

  const h = await headers();
  const origin =
    h.get("origin") ??
    (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(
      `/login?mode=signup&error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`,
    );
  }

  // If confirmation email is required, session is null and we show a
  // "check your email" state. If confirmation is disabled in Supabase,
  // a session is returned and we can go straight to `next`.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  redirect(
    `/login?mode=signup_sent&email=${encodeURIComponent(email)}`,
  );
}

/**
 * Send a password-reset email. The link points at `/auth/reset` which
 * exchanges the code for a session and renders the "new password" form.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/login?mode=forgot&error=missing_email");
  }

  const h = await headers();
  const origin =
    h.get("origin") ??
    (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset`,
  });

  if (error) {
    redirect(
      `/login?mode=forgot&error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`,
    );
  }

  redirect(`/login?mode=forgot_sent&email=${encodeURIComponent(email)}`);
}

/**
 * Update the signed-in user's password. Called from /auth/reset after
 * the recovery link has established a session via exchangeCodeForSession.
 */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (password !== passwordConfirm) {
    redirect(
      `/auth/reset?error=${encodeURIComponent("Passwords don't match")}`,
    );
  }
  const pwErr = validPassword(password);
  if (pwErr) {
    redirect(`/auth/reset?error=${encodeURIComponent(pwErr)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/auth/reset?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/submission?pw=updated");
}

/**
 * Server-side sign-out. Invalidates the session everywhere (local +
 * global cookie) then redirects to the homepage.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
