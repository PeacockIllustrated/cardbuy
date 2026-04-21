import { redirect } from "next/navigation";
import { Annotation } from "@/components/wireframe/Annotation";
import { createClient } from "@/lib/supabase/server";
import { getMyConsent } from "@/app/_actions/consent";
import { ConsentToggles } from "./ConsentToggles";
import { DeleteAccountForm } from "./DeleteAccountForm";
import type { ConsentSnapshot } from "@/app/_actions/consent";

/**
 * `/settings` · Phase 6 · Slice C1.
 *
 * Granular marketing-consent toggles + right-to-erasure. Signed-out
 * users are redirected to login. Consent changes land via
 * `app/_actions/consent.ts`. Transactional email (service_emails) is
 * essential and therefore not user-editable.
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const consent = (await getMyConsent()) ?? defaultConsent();

  return (
    <main className="max-w-[720px] mx-auto px-4 py-8 md:py-12 flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Annotation>ACCOUNT</Annotation>
        <h1 className="font-display text-[32px] md:text-[40px] leading-[0.95] tracking-tight">
          Settings
        </h1>
        <p className="text-[12px] text-secondary">
          Signed in as <span className="text-ink">{user.email}</span>
        </p>
      </header>

      {/* Marketing consent */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-[16px] tracking-wider text-ink">
            Email &amp; messaging
          </h2>
          <p className="text-[12px] text-secondary mt-1">
            We contact you about your submissions and shop orders regardless
            of these toggles — that&rsquo;s transactional mail and essential
            to the service. Everything below is optional.
          </p>
        </div>
        <ConsentToggles initial={consent} />
      </section>

      {/* Privacy + data */}
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-[16px] tracking-wider text-ink">
          Privacy
        </h2>
        <p className="text-[12px] text-secondary">
          See our{" "}
          <a
            href="/privacy"
            className="underline decoration-2 underline-offset-2 hover:text-pink"
          >
            Privacy Policy
          </a>{" "}
          for what we store and why. You can export or delete your data
          below.
        </p>
        {consent.privacy_policy_accepted_at ? (
          <p className="text-[11px] text-muted font-display tracking-wider">
            Reviewed{" "}
            {new Date(consent.privacy_policy_accepted_at).toLocaleDateString(
              "en-GB",
            )}
          </p>
        ) : (
          <p className="text-[11px] text-warn font-display tracking-wider">
            Not yet reviewed — change any toggle above to confirm you&rsquo;ve
            read the policy.
          </p>
        )}
      </section>

      {/* Delete account */}
      <section className="pop-card rounded-md bg-paper border-warn/60 p-4 flex flex-col gap-3">
        <h2 className="font-display text-[16px] tracking-wider text-warn">
          Delete account
        </h2>
        <p className="text-[12px] text-secondary">
          Permanently removes your profile, binder, wishlist, and
          submissions. Cannot be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}

function defaultConsent(): ConsentSnapshot {
  return {
    consent_service_emails: true,
    consent_marketing_buylist: false,
    consent_marketing_shop: false,
    consent_aggregate_data: false,
    consent_updated_at: null,
    privacy_policy_accepted_at: null,
  };
}
