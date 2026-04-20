import Link from "next/link";
import { DevBanner } from "@/components/wireframe/DevBanner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="px-3 md:px-4 pt-3">
        <DevBanner />
      </div>
      <header className="border-b-[3px] border-ink bg-ink text-paper-strong sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-3 md:px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <Link href="/admin" className="flex items-baseline gap-2 shrink-0">
            <span className="font-display text-[18px] md:text-[22px] tracking-tight leading-none text-paper-strong">
              cardbuy
            </span>
            <span className="bg-pink text-ink border-2 border-paper-strong px-1.5 py-0.5 text-[9px] font-display tracking-wider">
              ADMIN
            </span>
          </Link>

          {/* Desktop nav (lg+) */}
          <nav className="hidden lg:flex items-center gap-1 flex-wrap font-display text-[11px] tracking-wider">
            <AdminLink href="/admin">Dashboard</AdminLink>
            <Divider />
            <Group label="Buy">
              <AdminLink href="/admin/submissions" tone="yellow">Submissions</AdminLink>
              <AdminLink href="/admin/pricing" tone="yellow">Pricing</AdminLink>
            </Group>
            <Divider />
            <Group label="Sell">
              <AdminLink href="/admin/inventory" tone="pink">Inventory</AdminLink>
              <AdminLink href="/admin/orders" tone="pink">Orders</AdminLink>
            </Group>
            <Divider />
            <AdminLink href="/admin/cards" tone="teal">Catalogue</AdminLink>
            <AdminLink href="/admin/sync" tone="teal">Sync</AdminLink>
            <Divider />
            <AdminLink href="/admin/users" tone="teal">Users</AdminLink>
            <Link
              href="/"
              className="ml-3 px-2 py-1 text-[11px] text-paper-strong/70 hover:text-paper-strong"
            >
              ↩ Seller view
            </Link>
          </nav>

          {/* Mobile/tablet disclosure (lg- hidden) */}
          <details className="lg:hidden relative">
            <summary className="cursor-pointer list-none font-display text-[11px] tracking-wider bg-paper-strong text-ink px-3 py-1.5 border-2 border-paper-strong rounded">
              Menu
            </summary>
            <div className="absolute right-0 mt-2 w-[240px] bg-ink border-[3px] border-paper-strong rounded-md p-2 flex flex-col gap-0.5 shadow-[4px_4px_0_0_rgba(255,255,255,0.4)] z-40">
              <MobileLink href="/admin">Dashboard</MobileLink>
              <MobileSection>Buy</MobileSection>
              <MobileLink href="/admin/submissions" tone="yellow">Submissions</MobileLink>
              <MobileLink href="/admin/pricing" tone="yellow">Pricing</MobileLink>
              <MobileSection>Sell</MobileSection>
              <MobileLink href="/admin/inventory" tone="pink">Inventory</MobileLink>
              <MobileLink href="/admin/orders" tone="pink">Orders</MobileLink>
              <MobileSection>Catalogue</MobileSection>
              <MobileLink href="/admin/cards" tone="teal">Cards</MobileLink>
              <MobileLink href="/admin/sync" tone="teal">Sync</MobileLink>
              <MobileSection>People</MobileSection>
              <MobileLink href="/admin/users" tone="teal">Users</MobileLink>
              <hr className="border-paper-strong/30 my-1" />
              <MobileLink href="/">↩ Seller view</MobileLink>
            </div>
          </details>
        </div>
      </header>
      {children}
    </>
  );
}

function AdminLink({
  href,
  tone,
  children,
}: {
  href: string;
  tone?: "pink" | "teal" | "yellow";
  children: React.ReactNode;
}) {
  const hover =
    tone === "pink"
      ? "hover:bg-pink hover:text-ink"
      : tone === "teal"
        ? "hover:bg-teal hover:text-ink"
        : tone === "yellow"
          ? "hover:bg-yellow hover:text-ink"
          : "hover:bg-paper-strong hover:text-ink";
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 border-2 border-transparent transition-colors duration-100 ${hover}`}
    >
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  tone,
  children,
}: {
  href: string;
  tone?: "pink" | "teal" | "yellow";
  children: React.ReactNode;
}) {
  const hover =
    tone === "pink"
      ? "hover:bg-pink hover:text-ink"
      : tone === "teal"
        ? "hover:bg-teal hover:text-ink"
        : tone === "yellow"
          ? "hover:bg-yellow hover:text-ink"
          : "hover:bg-paper-strong hover:text-ink";
  return (
    <Link
      href={href}
      className={`block px-3 py-2 font-display text-[12px] tracking-wider rounded transition-colors duration-100 ${hover}`}
    >
      {children}
    </Link>
  );
}

function MobileSection({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 pt-2 pb-1 font-display text-[9px] tracking-widest text-paper-strong/50 uppercase">
      {children}
    </span>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-paper-strong/40 text-[10px] mr-1">{label}:</span>
      {children}
    </span>
  );
}

function Divider() {
  return <span className="text-paper-strong/30">·</span>;
}
