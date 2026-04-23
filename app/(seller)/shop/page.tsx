import { Button, Field, Input, Select } from "@/components/ui/Form";
import { ListingCard } from "@/components/cardbuy/ListingCard";
import { FeaturedRail } from "@/components/cardbuy/shop/FeaturedRail";
import { listListings } from "@/app/_actions/shop";
import { adaptListing } from "@/lib/shop/adapter";
import type { MockListing } from "@/lib/mock/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  set?: string;
  rarity?: string;
  variant?: "raw" | "graded";
  cond?: string;
  pmin?: string;
  pmax?: string;
  in_stock?: string;
  sort?: "featured" | "newest" | "price_asc" | "price_desc";
}>;

function applyFilters(
  rows: MockListing[],
  sp: Awaited<SearchParams>,
): MockListing[] {
  let out = rows.filter((l) => l.status === "active");
  if (sp.set) out = out.filter((l) => l.set_name === sp.set);
  if (sp.rarity) out = out.filter((l) => l.rarity === sp.rarity);
  if (sp.variant) out = out.filter((l) => l.variant === sp.variant);
  if (sp.cond && sp.variant !== "graded")
    out = out.filter((l) => l.condition === sp.cond);
  if (sp.pmin) out = out.filter((l) => l.price_gbp >= Number(sp.pmin));
  if (sp.pmax) out = out.filter((l) => l.price_gbp <= Number(sp.pmax));
  if (sp.in_stock === "1")
    out = out.filter((l) => l.qty_in_stock - l.qty_reserved > 0);

  switch (sp.sort) {
    case "newest":
      out = [...out].sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    case "price_asc":
      out = [...out].sort((a, b) => a.price_gbp - b.price_gbp);
      break;
    case "price_desc":
      out = [...out].sort((a, b) => b.price_gbp - a.price_gbp);
      break;
    default:
      out = [...out].sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return (a.featured_priority ?? 99) - (b.featured_priority ?? 99);
      });
  }
  return out;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const raw = await listListings();
  const listings = raw.map(adaptListing);

  const setNames = Array.from(new Set(listings.map((l) => l.set_name)));
  const rarities = Array.from(new Set(listings.map((l) => l.rarity)));

  const featured = listings
    .filter((l) => l.is_featured && l.qty_in_stock - l.qty_reserved > 0)
    .sort(
      (a, b) => (a.featured_priority ?? 99) - (b.featured_priority ?? 99),
    )
    .slice(0, 10);

  const results = applyFilters(listings, sp);

  return (
    <div className="max-w-[1300px] mx-auto px-4 py-8 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="bg-pink text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider">
          The shop
        </span>
        <h1 className="font-display text-[36px] md:text-[44px] leading-none tracking-tight">
          Browse Lewis&apos;s picks
        </h1>
        <p className="text-secondary text-[14px] max-w-[60ch]">
          Hand-picked Pokémon cards — raw and graded. Free Royal Mail
          Tracked over £250. UK dispatch within one working day.
        </p>
      </header>

      {featured.length > 0 ? <FeaturedRail featured={featured} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <aside className="pop-card rounded-md h-fit overflow-hidden">
          <details className="md:contents">
            <summary className="md:hidden cursor-pointer list-none px-4 py-3 flex items-center justify-between border-b-2 border-ink font-display text-[14px] tracking-wider hover:bg-yellow/30">
              <span>Filters</span>
              <span className="text-[11px] text-muted">tap to toggle</span>
            </summary>
            <div className="p-4 flex flex-col gap-4">
              <h2 className="hidden md:block font-display text-[14px] tracking-wider">
                Filters
              </h2>
              <form action="/shop" method="GET" className="flex flex-col gap-3">
                <Field label="Set">
                  <Select name="set" defaultValue={sp.set ?? ""}>
                    <option value="">All sets</option>
                    {setNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Rarity">
                  <Select name="rarity" defaultValue={sp.rarity ?? ""}>
                    <option value="">Any rarity</option>
                    {rarities.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Variant">
                  <Select name="variant" defaultValue={sp.variant ?? ""}>
                    <option value="">Raw or graded</option>
                    <option value="raw">Raw only</option>
                    <option value="graded">Graded only</option>
                  </Select>
                </Field>
                <Field label="Condition (raw)">
                  <Select name="cond" defaultValue={sp.cond ?? ""}>
                    <option value="">Any</option>
                    <option value="NM">NM</option>
                    <option value="LP">LP</option>
                    <option value="MP">MP</option>
                    <option value="HP">HP</option>
                    <option value="DMG">DMG</option>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Min £">
                    <Input
                      name="pmin"
                      type="number"
                      defaultValue={sp.pmin ?? ""}
                      className="w-full"
                    />
                  </Field>
                  <Field label="Max £">
                    <Input
                      name="pmax"
                      type="number"
                      defaultValue={sp.pmax ?? ""}
                      className="w-full"
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    name="in_stock"
                    value="1"
                    defaultChecked={sp.in_stock === "1"}
                  />
                  In stock only
                </label>
                <Field label="Sort">
                  <Select name="sort" defaultValue={sp.sort ?? "featured"}>
                    <option value="featured">Featured first</option>
                    <option value="newest">Newest</option>
                    <option value="price_asc">Price ↑</option>
                    <option value="price_desc">Price ↓</option>
                  </Select>
                </Field>
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  Apply filters
                </Button>
              </form>
            </div>
          </details>
        </aside>

        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[16px] tracking-wider">
              {results.length} of {listings.length} listings
            </h2>
          </div>

          {results.length === 0 ? (
            <div className="pop-card rounded-md p-12 text-center flex flex-col gap-2 items-center">
              <span className="font-display text-[18px]">No matches</span>
              <span className="text-[13px] text-secondary">
                Try a broader filter or clear them all.
              </span>
            </div>
          ) : (
            <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {results.map((l) => (
                <li key={l.id}>
                  <ListingCard listing={l} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
