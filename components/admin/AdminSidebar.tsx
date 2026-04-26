"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type AdminNavCounts = {
  awaitingCards: number;
  toPack: number;
  pendingPayment: number;
};

type NavItem = {
  href: string;
  label: string;
  glyph: string;
  tone: "pink" | "teal" | "yellow" | "paper";
  badge?: number;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

function buildSections(counts: AdminNavCounts): NavSection[] {
  return [
    {
      title: "Overview",
      items: [
        { href: "/admin", label: "Dashboard", glyph: "▦", tone: "paper" },
      ],
    },
    {
      title: "Buy side",
      items: [
        {
          href: "/admin/submissions",
          label: "Submissions",
          glyph: "↓",
          tone: "yellow",
          badge: counts.awaitingCards,
        },
        { href: "/admin/pricing", label: "Pricing", glyph: "%", tone: "yellow" },
      ],
    },
    {
      title: "Sell side",
      items: [
        { href: "/admin/inventory", label: "Inventory", glyph: "▤", tone: "pink" },
        {
          href: "/admin/orders",
          label: "Orders",
          glyph: "↑",
          tone: "pink",
          badge: counts.toPack + counts.pendingPayment,
        },
        { href: "/admin/demand", label: "Demand", glyph: "◎", tone: "pink" },
        { href: "/admin/sourcing", label: "Sourcing", glyph: "⌕", tone: "pink" },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { href: "/admin/cards", label: "Cards", glyph: "▥", tone: "teal" },
        { href: "/admin/sync", label: "Sync", glyph: "↻", tone: "teal" },
      ],
    },
    {
      title: "People",
      items: [
        { href: "/admin/users", label: "Users", glyph: "◉", tone: "teal" },
      ],
    },
  ];
}

function toneBgClass(tone: NavItem["tone"]): string {
  switch (tone) {
    case "pink":
      return "bg-pink";
    case "teal":
      return "bg-teal";
    case "yellow":
      return "bg-yellow";
    default:
      return "bg-paper-strong";
  }
}

function toneHoverClass(tone: NavItem["tone"]): string {
  switch (tone) {
    case "pink":
      return "hover:bg-pink/15";
    case "teal":
      return "hover:bg-teal/15";
    case "yellow":
      return "hover:bg-yellow/20";
    default:
      return "hover:bg-paper-strong/10";
  }
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ counts }: { counts: AdminNavCounts }) {
  const pathname = usePathname() ?? "/admin";
  const sections = buildSections(counts);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 border-b-[3px] border-ink bg-ink text-paper-strong">
        <div className="flex items-center justify-between px-3 py-2.5 gap-3">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="font-display text-[18px] tracking-tight leading-none text-paper-strong">
              cardbuy
            </span>
            <span className="bg-pink text-ink border-2 border-paper-strong px-1.5 py-0.5 text-[9px] font-display tracking-wider">
              ADMIN
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
            aria-label="Toggle admin navigation"
            className="font-display text-[11px] tracking-wider bg-paper-strong text-ink px-3 py-1.5 border-2 border-paper-strong rounded-sm"
          >
            {drawerOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="absolute top-0 left-0 bottom-0 w-[260px] bg-ink text-paper-strong overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarInner
              sections={sections}
              pathname={pathname}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col shrink-0 w-[240px] sticky top-0 h-screen border-r-[3px] border-ink bg-ink text-paper-strong overflow-y-auto z-30">
        <SidebarInner sections={sections} pathname={pathname} />
      </aside>
    </>
  );
}

function SidebarInner({
  sections,
  pathname,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b-2 border-paper-strong/20 hidden lg:flex items-baseline gap-2">
        <Link href="/admin" onClick={onNavigate} className="flex items-baseline gap-2">
          <span className="font-display text-[20px] tracking-tight leading-none">
            cardbuy
          </span>
          <span className="bg-pink text-ink border-2 border-paper-strong px-1.5 py-0.5 text-[9px] font-display tracking-wider">
            ADMIN
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3 flex flex-col gap-3">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <span className="px-3 pt-1 pb-1 font-display text-[9px] tracking-[0.25em] text-paper-strong/45">
              {section.title}
            </span>
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const hover = toneHoverClass(item.tone);
              const activeBg = toneBgClass(item.tone);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-sm font-display text-[12px] tracking-wider transition-colors duration-100 ${
                    active
                      ? `${activeBg} text-ink border-2 border-paper-strong`
                      : `text-paper-strong border-2 border-transparent ${hover}`
                  }`}
                >
                  <span
                    className={`w-5 text-center text-[13px] leading-none ${
                      active ? "text-ink" : "text-paper-strong/70"
                    }`}
                    aria-hidden
                  >
                    {item.glyph}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span
                      className={`min-w-[22px] text-center px-1.5 py-0.5 text-[10px] font-display tracking-wider tabular-nums border-2 rounded-sm ${
                        active
                          ? "border-ink bg-paper-strong text-ink"
                          : "border-paper-strong bg-pink text-ink"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t-2 border-paper-strong/20 px-3 py-3 flex flex-col gap-1">
        <Link
          href="/"
          onClick={onNavigate}
          className="font-display text-[11px] tracking-wider text-paper-strong/70 hover:text-paper-strong px-2 py-1.5"
        >
          ↩ Seller view
        </Link>
      </div>
    </div>
  );
}
