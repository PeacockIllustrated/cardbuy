"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PageFooter() {
  const pathname = usePathname() ?? "";
  // Admin is its own self-contained portal — no marketing footer.
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="border-t-[3px] border-ink bg-ink text-paper-strong mt-12">
      <div className="max-w-[1300px] mx-auto px-4 py-6 flex flex-col md:flex-row gap-6 md:gap-12 items-start md:items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[20px] tracking-tight">cardbuy</span>
          <span className="text-[11px] text-paper-strong/60">
            buy &amp; sell pokémon cards
          </span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 font-display text-[11px] tracking-wider">
          <Link href="/shop" className="hover:text-pink">Shop</Link>
          <Link href="/search" className="hover:text-yellow">Sell to us</Link>
          <Link href="#" className="hover:text-teal">Shipping &amp; returns</Link>
          <Link href="#" className="hover:text-teal">Terms</Link>
          <Link href="#" className="hover:text-teal">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
