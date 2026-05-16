"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { WaveDivider } from "@/components/cardbuy/WaveDivider";

export function PageFooter() {
  const pathname = usePathname() ?? "";
  // Admin is its own self-contained portal — no marketing footer.
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="bg-ink text-paper-strong mt-12">
      <WaveDivider fill="var(--color-ink)" height={32} />
      <div className="max-w-[1300px] mx-auto px-4 pb-6 flex flex-col md:flex-row gap-6 md:gap-12 items-start md:items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/aqua-tcg.svg"
            alt=""
            width={28}
            height={30}
            className="w-[28px] h-[30px]"
          />
          <span className="font-display text-[20px] tracking-tight text-sun">
            Aqua&nbsp;TCG
          </span>
          <span className="text-[11px] text-paper-strong/60">
            buy &amp; sell pokémon cards
          </span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 font-display text-[11px] tracking-wider">
          <Link href="/shop" className="hover:text-ocean">Shop</Link>
          <Link href="/search" className="hover:text-sun">Sell to us</Link>
          <Link href="#" className="hover:text-wave">Shipping &amp; returns</Link>
          <Link href="#" className="hover:text-wave">Terms</Link>
          <Link href="#" className="hover:text-wave">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
