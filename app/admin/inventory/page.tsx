import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  MOCK_LISTINGS,
  FEATURED_SLOT_COUNT,
} from "@/lib/mock/mock-listings";
import { InventoryEditor } from "./InventoryEditor";

/**
 * Server component — loads MOCK_LISTINGS (which reaches into the
 * server-only card fixtures) and passes the plain data to the client
 * editor below. Keeps the server-only boundary honest.
 */
export default function AdminInventoryPage() {
  const activeCount = MOCK_LISTINGS.filter((l) => l.status === "active").length;
  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto flex flex-col gap-6">
      <AdminPageHeader
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Sell side" },
          { label: "Inventory" },
        ]}
        title="Inventory & listings"
        kicker={{ label: "SELL", tone: "pink" }}
        subtitle="Every physical stock unit on the shopfront — set prices, toggle featured, flag sold."
        actions={
          <span className="font-display text-[11px] tracking-wider tabular-nums text-muted">
            {activeCount} active · {MOCK_LISTINGS.length} total
          </span>
        }
      />

      <InventoryEditor
        initial={MOCK_LISTINGS}
        featuredSlotCount={FEATURED_SLOT_COUNT}
      />
    </div>
  );
}
