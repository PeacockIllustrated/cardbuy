"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_LABELS: Array<[RegExp, string]> = [
  [/^\/$/, "home"],
  [/^\/search/, "buylist search"],
  [/^\/card\/[^/]+$/, "buylist offer"],
  [/^\/submission$/, "submission cart"],
  [/^\/submission\/submit$/, "submission checkout"],
  [/^\/submission\/confirmation\/[^/]+$/, "submission receipt"],
  [/^\/shop$/, "shop"],
  [/^\/shop\/cart$/, "basket"],
  [/^\/shop\/checkout$/, "checkout"],
  [/^\/shop\/order\/[^/]+$/, "order receipt"],
  [/^\/shop\/[^/]+$/, "listing"],
  [/^\/admin$/, "admin dashboard"],
  [/^\/admin\/submissions$/, "admin submissions"],
  [/^\/admin\/submissions\/[^/]+$/, "admin submission"],
  [/^\/admin\/orders$/, "admin orders"],
  [/^\/admin\/inventory$/, "admin inventory"],
  [/^\/admin\/pricing$/, "admin pricing"],
  [/^\/admin\/cards$/, "admin catalogue"],
];

function labelFor(pathname: string): string {
  for (const [pattern, label] of ROUTE_LABELS) {
    if (pattern.test(pathname)) return label;
  }
  return pathname;
}

export function PageFooter() {
  const pathname = usePathname();
  const label = labelFor(pathname);
  return (
    <footer className="border-t-[3px] border-ink bg-ink text-paper-strong mt-12">
      <div className="max-w-[1300px] mx-auto px-4 py-6 flex flex-col md:flex-row gap-6 md:gap-12 items-start md:items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[20px] tracking-tight">cardbuy</span>
          <span className="text-[11px] text-paper-strong/60">
            buy &amp; sell pokémon cards · {label}
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
