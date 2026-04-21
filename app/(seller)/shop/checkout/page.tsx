import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "./CheckoutForm";
import type { LewisUser } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ShopCheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shop/checkout");

  const { data: profile } = await supabase
    .from("lewis_users")
    .select("full_name, email, postcode, country")
    .eq("id", user.id)
    .maybeSingle<
      Pick<LewisUser, "full_name" | "email" | "postcode" | "country">
    >();

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="bg-pink text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider">
          Buying from us
        </span>
        <h1 className="font-display text-[32px] leading-none tracking-tight">
          Checkout
        </h1>
      </header>
      <CheckoutForm
        defaultName={profile?.full_name ?? ""}
        defaultEmail={profile?.email ?? user.email ?? ""}
        defaultPostcode={profile?.postcode ?? ""}
        defaultCountry={profile?.country ?? "GB"}
      />
    </div>
  );
}
