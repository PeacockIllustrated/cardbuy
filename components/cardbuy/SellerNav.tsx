import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/_actions/auth";

export async function SellerNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "seller" | "admin" | null = null;
  if (user) {
    const { data } = await supabase
      .from("lewis_users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = ((data as { role?: "seller" | "admin" } | null)?.role ?? "seller");
  }

  return (
    <header className="border-b-[3px] border-ink bg-paper-strong sticky top-0 z-30">
      <div className="max-w-[1300px] mx-auto px-3 md:px-4 py-2.5 md:py-3 flex items-center justify-between gap-2 md:gap-6">
        <Link href="/" className="flex items-baseline gap-2 shrink-0">
          <span className="font-display text-[18px] md:text-[24px] tracking-tight leading-none">
            cardbuy
          </span>
          <span className="hidden sm:inline-block bg-pink text-ink border-2 border-ink px-1.5 py-0.5 text-[9px] font-display tracking-wider rotate-[-2deg]">
            BETA
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 md:gap-1 font-display text-[11px] md:text-[12px] tracking-wider min-w-0">
          <NavLink href="/shop" tone="pink">Shop</NavLink>
          <NavLink href="/packs" tone="yellow">Sell</NavLink>
          <NavLink href="/binder" tone="teal" hideOnNarrow>Binder</NavLink>
          <NavLink href="/submission" tone="teal" hideOnNarrow>
            <span className="md:hidden">Cart</span>
            <span className="hidden md:inline">My&nbsp;sub</span>
          </NavLink>
          <NavLink href="/shop/cart" tone="pink">Basket</NavLink>

          {user ? (
            <div className="hidden sm:flex items-center gap-2 shrink-0 ml-1 md:ml-2 pl-2 md:pl-3 border-l-2 border-ink/15">
              <Link
                href="/settings"
                className="font-display text-[10px] text-muted tabular-nums truncate max-w-[140px] hover:text-ink"
                title={user.email ?? ""}
              >
                {user.email}
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="font-display text-[10px] tracking-wider text-ink underline underline-offset-4 decoration-2 hover:text-pink"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex shrink-0 ml-1 md:ml-2 px-2 py-1 border-2 border-ink rounded-sm bg-yellow text-ink font-display text-[10px] md:text-[11px] tracking-wider hover:bg-pink"
            >
              Sign in
            </Link>
          )}

          {role === "admin" ? (
            <Link
              href="/admin"
              className="hidden md:inline-flex shrink-0 ml-1 md:ml-2 px-2 py-1 text-[11px] text-muted hover:text-ink"
            >
              Admin
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  tone,
  hideOnNarrow,
}: {
  href: string;
  children: React.ReactNode;
  tone: "pink" | "teal" | "yellow";
  hideOnNarrow?: boolean;
}) {
  const hover =
    tone === "pink"
      ? "hover:bg-pink"
      : tone === "teal"
        ? "hover:bg-teal"
        : "hover:bg-yellow";
  return (
    <Link
      href={href}
      className={`shrink-0 px-2 md:px-3 py-1.5 border-2 border-transparent hover:border-ink transition-colors duration-100 ${hover} ${hideOnNarrow ? "hidden sm:inline-flex" : ""}`}
    >
      {children}
    </Link>
  );
}
