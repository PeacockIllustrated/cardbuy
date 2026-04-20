import { Annotation } from "@/components/wireframe/Annotation";
import { TodoMarker } from "@/components/wireframe/TodoMarker";
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
  return (
    <div className="px-4 py-6 max-w-[1400px] mx-auto flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Annotation>ADMIN · INVENTORY</Annotation>
        <h1 className="font-display text-[26px] tracking-tight uppercase">
          Inventory &amp; listings
        </h1>
      </header>

      <InventoryEditor
        initial={MOCK_LISTINGS}
        featuredSlotCount={FEATURED_SLOT_COUNT}
      />

      <TodoMarker phase={2}>
        persist edits to Supabase; auto-set sold_out when qty hits 0
      </TodoMarker>
    </div>
  );
}
