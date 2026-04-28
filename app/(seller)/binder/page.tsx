import { redirect } from "next/navigation";
import {
  BinderPanel,
  type BinderOwnedEntry,
  type BinderShelfEntry,
  type BinderShopListing,
  type BinderSlotPayload,
} from "@/components/cardbuy/binder/BinderPanel";
import { MOCK_LISTINGS } from "@/lib/mock/mock-listings";
import { getCardById } from "@/lib/fixtures/cards";
import { summarisePacks } from "@/lib/binder/packs";
import { NATIONAL_DEX } from "@/lib/fixtures/pokedex";
import { createClient } from "@/lib/supabase/server";
import type {
  LewisBinderEntry,
  LewisWishlistEntry,
} from "@/lib/supabase/types";
import type { MockListing } from "@/lib/mock/types";

/**
 * `/binder` · the logged-in user's Pokédex binder (Slice A).
 *
 * Signed-out users are redirected to /login. Signed-in users get a Gen-1
 * dex-ordered binder populated from `lewis_binder_entries` +
 * `lewis_wishlist_entries`. Shop listings shown on missing slots still
 * come from mock listings (pricing engine is Phase 3).
 */
export const dynamic = "force-dynamic";

type SearchParams = { p?: string };

const SLOTS_PER_PAGE = 9;

export default async function BinderPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/binder");

  // Profile — display name used in the header. Falls back to email local-part.
  const { data: profile } = await supabase
    .from("lewis_users")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const displayName =
    profile?.full_name ??
    profile?.email?.split("@")[0] ??
    user.email?.split("@")[0] ??
    "Collector";

  // Read the user's binder + wishlist in parallel.
  const [binderRes, wishlistRes] = await Promise.all([
    supabase
      .from("lewis_binder_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("lewis_wishlist_entries")
      .select("*")
      .eq("user_id", user.id),
  ]);
  if (binderRes.error) {
    throw new Error(`Failed to load binder: ${binderRes.error.message}`);
  }
  if (wishlistRes.error) {
    throw new Error(`Failed to load wishlist: ${wishlistRes.error.message}`);
  }
  const binderEntries: LewisBinderEntry[] = binderRes.data ?? [];
  const wishlistEntries: LewisWishlistEntry[] = wishlistRes.data ?? [];

  // Group binder entries into two buckets:
  //   • ownedByDex — Pokémon cards with a national-dex slot
  //   • shelfEntries — Trainer / Energy / anything without a dex slot,
  //     destined for the side shelf peeking out of the binder
  const ownedByDex = new Map<number, LewisBinderEntry[]>();
  const shelfEntries: BinderShelfEntry[] = [];
  for (const e of binderEntries) {
    const card = getCardById(e.card_id);
    const dex = card?.nationalPokedexNumbers?.[0];
    const isPokemon = card?.supertype === "Pokémon";
    if (isPokemon && dex) {
      const list = ownedByDex.get(dex) ?? [];
      list.push(e);
      ownedByDex.set(dex, list);
    } else if (card) {
      shelfEntries.push({
        id: e.id,
        cardId: e.card_id,
        cardName: card.name,
        supertype: card.supertype ?? "Pokémon",
        subtypes: card.subtypes ?? [],
        setName: setNameFromId(card.id),
        rarity: card.rarity ?? null,
        imageSmall: card.images.small ?? null,
        variant: e.variant,
        condition: e.condition ?? undefined,
        grading_company: e.grading_company ?? undefined,
        grade: e.grade ?? undefined,
        quantity: e.quantity,
      });
    }
  }
  // Stable sort for the shelf — Energy first (they're usually the
  // bulk), then Trainer, alphabetical within each group.
  shelfEntries.sort((a, b) => {
    const aw = a.supertype === "Energy" ? 0 : 1;
    const bw = b.supertype === "Energy" ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return a.cardName.localeCompare(b.cardName);
  });

  // Wishlist: lookup by card_id. Binder missing-slot UI reads the
  // dex-registry's sampleCardId when deciding whether to show ON/OFF.
  const wishlistByCardId = new Map<string, LewisWishlistEntry>();
  for (const w of wishlistEntries) {
    wishlistByCardId.set(w.card_id, w);
  }

  // Group shop listings by national-dex number so each slot knows the
  // "on sale now" list for lead-gen. Still mock data in Slice A.
  const listingsByDex = new Map<number, MockListing[]>();
  for (const l of MOCK_LISTINGS) {
    const card = getCardById(l.card_id);
    const dex = card?.nationalPokedexNumbers?.[0];
    if (!dex) continue;
    const list = listingsByDex.get(dex) ?? [];
    list.push(l);
    listingsByDex.set(dex, list);
  }

  // Lowest active listed price per dex. Seeds the wishlist target-price
  // suggestion. Phase 3's pricing engine replaces this wholesale.
  const marketByDex = new Map<number, number>();
  for (const [dex, ls] of listingsByDex) {
    marketByDex.set(dex, Math.min(...ls.map((l) => l.price_gbp)));
  }

  // Pack summaries for the alternative "Packs" view. Re-uses the
  // entries we just loaded — no extra round-trip — and groups them
  // by set_id with progress numbers attached.
  const packs = summarisePacks(
    binderEntries.map((e) => ({ card_id: e.card_id, quantity: e.quantity })),
  );

  const totalSlots = NATIONAL_DEX.length;
  const totalOwned = NATIONAL_DEX.filter((d) => ownedByDex.has(d.number)).length;

  const totalPages = Math.ceil(totalSlots / SLOTS_PER_PAGE);
  const rawPage = parseInt(params.p ?? "1", 10) || 1;
  const initialPageIndex = Math.min(
    Math.max(0, rawPage - 1),
    totalPages - 1,
  );

  // Build slot payloads for the full generation — client handles pagination.
  const allSlots: BinderSlotPayload[] = NATIONAL_DEX.map((dex) => {
    const entries = ownedByDex.get(dex.number) ?? [];
    const listings = listingsByDex.get(dex.number) ?? [];
    const shopListings: BinderShopListing[] = listings
      .filter((l) => l.status === "active" && l.qty_in_stock - l.qty_reserved > 0)
      .sort((a, b) => a.price_gbp - b.price_gbp)
      .map<BinderShopListing>((l) => ({
        id: l.id,
        cardName: l.card_name,
        setName: l.set_name,
        variantLabel:
          l.variant === "raw"
            ? `Raw · ${l.condition}`
            : `${l.grading_company} ${l.grade}`,
        priceGbp: l.price_gbp,
        imageSmall: l.image_url,
        rarity: l.rarity,
        qtyInStock: l.qty_in_stock - l.qty_reserved,
        href: `/shop/${l.id}`,
      }));
    const marketValueGbp = marketByDex.get(dex.number) ?? null;

    // Wishlist canonical card for this dex slot = the dex-registry's
    // sample card. Missing-slot wishlist toggle operates on that id.
    const wishlistCardId = dex.sampleCardId;
    const wishlistEntry = wishlistCardId
      ? wishlistByCardId.get(wishlistCardId)
      : undefined;

    // Canonical silhouette image — the small artwork of the
    // dex-registry's sample card. Missing slots render this behind
    // a ghost filter so the user can see the shape of what they're
    // chasing.
    const silhouetteImage = dex.sampleCardId
      ? (getCardById(dex.sampleCardId)?.images.small ?? null)
      : null;

    const base = {
      dexNumber: dex.number,
      dexName: dex.name,
      types: dex.types,
      shopListings,
      marketValueGbp,
      wishlistCardId: wishlistCardId ?? null,
      onWishlist: wishlistEntry !== undefined,
      wishlistTargetGbp:
        wishlistEntry?.target_price_gbp !== undefined &&
        wishlistEntry.target_price_gbp !== null
          ? Number(wishlistEntry.target_price_gbp)
          : null,
      silhouetteImage,
    };

    if (entries.length === 0) {
      return { ...base, owned: null };
    }

    // Representative owned card = the first entry's card. If unresolvable,
    // fall back to the dex registry's sample card.
    const rep =
      getCardById(entries[0].card_id) ??
      (dex.sampleCardId ? getCardById(dex.sampleCardId) : undefined);
    if (!rep) {
      return { ...base, owned: null };
    }

    const ownedEntries: BinderOwnedEntry[] = entries.map((e) => {
      const card = getCardById(e.card_id);
      return {
        id: e.id,
        variant: e.variant,
        condition: e.condition ?? undefined,
        grading_company: e.grading_company ?? undefined,
        grade: e.grade ?? undefined,
        quantity: e.quantity,
        is_grail: e.is_grail,
        note: e.note ?? undefined,
        acquired_at: e.acquired_at,
        setName: card ? setNameFromId(card.id) : e.card_id.split("-")[0],
        cardId: e.card_id,
      };
    });

    return {
      ...base,
      owned: {
        card: {
          id: rep.id,
          name: rep.name,
          imageSmall: rep.images.small ?? null,
          setName: setNameFromId(rep.id),
          rarity: rep.rarity ?? null,
          cardNumber: rep.number,
          hp: rep.hp ?? null,
          types: rep.types ?? [],
          flavorText: rep.flavorText ?? null,
        },
        entries: ownedEntries,
      },
    };
  });

  // Portfolio total — sum of the lowest active listing price per owned
  // card. Cheap Slice-A proxy; Phase 3 swaps in the pricing engine.
  let totalPortfolioGbp = 0;
  for (const e of binderEntries) {
    const card = getCardById(e.card_id);
    const dex = card?.nationalPokedexNumbers?.[0];
    if (!dex) continue;
    const market = marketByDex.get(dex);
    if (market !== undefined) totalPortfolioGbp += market * e.quantity;
  }
  totalPortfolioGbp = Math.round(totalPortfolioGbp);

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-10">
      <PortfolioHeader
        displayName={displayName}
        totalPortfolioGbp={totalPortfolioGbp}
      />
      <div className="mt-7 md:mt-8">
        <BinderPanel
          allSlots={allSlots}
          totalOwned={totalOwned}
          totalSlots={totalSlots}
          initialPageIndex={initialPageIndex}
          userDisplayName={displayName}
          shelfEntries={shelfEntries}
          packs={packs}
        />
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Sub-sections
 * ───────────────────────────────────────────────────────────────── */

function PortfolioHeader({
  displayName,
  totalPortfolioGbp,
}: {
  displayName: string;
  totalPortfolioGbp: number;
}) {
  const totalFmt = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(totalPortfolioGbp);

  return (
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b-[3px] border-ink">
      <div>
        <div className="font-display text-[10px] tracking-[0.25em] text-muted">
          {displayName}&rsquo;s collection
        </div>
        <h1 className="font-display text-[32px] md:text-[44px] leading-[0.95] tracking-tight text-ink">
          My&nbsp;Binder
        </h1>
      </div>
      <div className="flex items-end gap-3">
        <div className="text-right">
          <div className="font-display text-[10px] tracking-[0.2em] text-muted">
            Portfolio · est.
          </div>
          <div className="font-display text-[36px] md:text-[44px] leading-[0.95] tabular-nums text-ink">
            {totalFmt}
          </div>
        </div>
      </div>
    </header>
  );
}

function setNameFromId(cardId: string): string {
  const setId = cardId.split("-")[0];
  return SET_NAMES[setId] ?? setId;
}

const SET_NAMES: Record<string, string> = {
  base1: "Base Set",
  base2: "Jungle",
  base3: "Fossil",
  base4: "Base Set 2",
  base5: "Team Rocket",
  basep: "Wizards Black Star Promos",
};
