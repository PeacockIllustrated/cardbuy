/**
 * Pure mapping engine — given a set's local catalogue entries + the
 * matching TCGCSV products, produce a `cardId → productId` mapping
 * with explicit confidence + a full issue report.
 *
 * No IO, no fetches. Fully deterministic: same inputs → same output.
 * The preview page calls this once per set; a future seed-builder
 * script will call it across all sets and write a JSON seed.
 *
 * Matching strategy (in order of preference):
 *   1. Exact — same Number AND normalised name matches.
 *   2. Number-only — same Number but name diverges (flagged, needs
 *      human review before we trust it).
 *   3. Name-fuzzy — name matches after normalisation but the Number
 *      is different or missing (e.g. promo reprints under new numbers).
 *   4. Unmatched — none of the above.
 *
 * Anything in the TCGCSV product list that doesn't match a local
 * card ends up in `orphanProducts` — typically error variants,
 * foreign-language printings, or cards from sets we haven't ingested
 * yet.
 */

import type { Card } from "@/lib/types/card";
import type { TcgProduct } from "./tcgcsv";

export type MatchConfidence = "exact" | "number-only" | "name-fuzzy";

export type MatchedRow = {
  cardId: string;
  cardName: string;
  cardNumber: string;
  rarity: string | undefined;
  productId: number;
  productName: string;
  productNumber: string | null;
  productRarity: string | null;
  confidence: MatchConfidence;
  notes: string[];
};

export type AmbiguousRow = {
  cardId: string;
  cardName: string;
  cardNumber: string;
  candidates: Array<{
    productId: number;
    productName: string;
    productNumber: string | null;
  }>;
  reason: string;
};

export type UnmatchedRow = {
  cardId: string;
  cardName: string;
  cardNumber: string;
  rarity: string | undefined;
  reason: string;
};

export type OrphanProduct = {
  productId: number;
  productName: string;
  productNumber: string | null;
  reason: string;
};

export type MappingResult = {
  setId: string;
  matched: MatchedRow[];
  ambiguous: AmbiguousRow[];
  unmatched: UnmatchedRow[];
  orphans: OrphanProduct[];
};

// ----------------------------------------------------------------
// Normalisation helpers
// ----------------------------------------------------------------

/**
 * Collapse a card name into a comparable token. Strips parentheticals
 * ("(Holofoil)", "(Black Dot Error)"), punctuation, diacritics, and
 * trailing edition markers that TCGplayer sometimes appends.
 *
 * The set + number carries the identity; name is a secondary check,
 * not a primary key — so this is allowed to be aggressive.
 */
export function normaliseName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // diacritics
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // parentheticals
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/-\s*(1st edition|unlimited|shadowless|holo).*/i, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract the "Number" field from a TCGCSV product's extendedData. */
export function productNumber(p: TcgProduct): string | null {
  return p.extendedData.find((x) => x.name === "Number")?.value ?? null;
}

export function productRarity(p: TcgProduct): string | null {
  return p.extendedData.find((x) => x.name === "Rarity")?.value ?? null;
}

/**
 * Reduce any card-number variant to a canonical integer string when
 * possible. TCGCSV returns "4" or "4/102"; pokemontcg.io returns "4";
 * we want "4" from both.
 */
export function canonNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const slashIdx = trimmed.indexOf("/");
  const head = slashIdx === -1 ? trimmed : trimmed.slice(0, slashIdx);
  const asInt = parseInt(head, 10);
  if (Number.isFinite(asInt)) return String(asInt);
  // Non-numeric (e.g. "SH1" for secret holos) — keep raw, lowercased.
  return head.toLowerCase();
}

// ----------------------------------------------------------------
// Matching
// ----------------------------------------------------------------

/**
 * Build a mapping for a single set. `setId` is purely informational —
 * the caller is responsible for passing matched local cards + TCGCSV
 * products for the same set.
 */
export function buildMapping(
  setId: string,
  localCards: Card[],
  tcgProducts: TcgProduct[],
): MappingResult {
  // Index products by canonical number + by normalised name for quick lookup.
  const byNumber = new Map<string, TcgProduct[]>();
  const byName = new Map<string, TcgProduct[]>();
  for (const p of tcgProducts) {
    const n = canonNumber(productNumber(p));
    if (n != null) {
      const list = byNumber.get(n) ?? [];
      list.push(p);
      byNumber.set(n, list);
    }
    const nm = normaliseName(p.cleanName || p.name);
    if (nm) {
      const list = byName.get(nm) ?? [];
      list.push(p);
      byName.set(nm, list);
    }
  }

  // Track which products we matched so we can compute orphans after.
  const usedProductIds = new Set<number>();

  const matched: MatchedRow[] = [];
  const ambiguous: AmbiguousRow[] = [];
  const unmatched: UnmatchedRow[] = [];

  for (const card of localCards) {
    const cardN = canonNumber(card.number);
    const cardNm = normaliseName(card.name);

    // Primary: by-number lookup (usually exactly one product per number,
    // but error variants / foreign prints can produce multiples).
    const numMatches = cardN != null ? byNumber.get(cardN) ?? [] : [];

    if (numMatches.length === 1) {
      const p = numMatches[0];
      const pNm = normaliseName(p.cleanName || p.name);
      const nameOK = pNm === cardNm || pNm.includes(cardNm) || cardNm.includes(pNm);
      matched.push({
        cardId: card.id,
        cardName: card.name,
        cardNumber: card.number,
        rarity: card.rarity,
        productId: p.productId,
        productName: p.cleanName || p.name,
        productNumber: productNumber(p),
        productRarity: productRarity(p),
        confidence: nameOK ? "exact" : "number-only",
        notes: nameOK
          ? []
          : [`name "${card.name}" vs TCG "${p.cleanName || p.name}"`],
      });
      usedProductIds.add(p.productId);
      continue;
    }

    if (numMatches.length > 1) {
      // Multiple products share this number. Try to disambiguate on name.
      const nameNarrowed = numMatches.filter((p) => {
        const pNm = normaliseName(p.cleanName || p.name);
        return pNm === cardNm;
      });
      if (nameNarrowed.length === 1) {
        const p = nameNarrowed[0];
        matched.push({
          cardId: card.id,
          cardName: card.name,
          cardNumber: card.number,
          rarity: card.rarity,
          productId: p.productId,
          productName: p.cleanName || p.name,
          productNumber: productNumber(p),
          productRarity: productRarity(p),
          confidence: "exact",
          notes: [
            `disambiguated from ${numMatches.length} candidates sharing #${card.number}`,
          ],
        });
        usedProductIds.add(p.productId);
        continue;
      }
      ambiguous.push({
        cardId: card.id,
        cardName: card.name,
        cardNumber: card.number,
        candidates: numMatches.map((p) => ({
          productId: p.productId,
          productName: p.cleanName || p.name,
          productNumber: productNumber(p),
        })),
        reason: `${numMatches.length} products share number #${card.number}; name did not narrow`,
      });
      continue;
    }

    // Fallback: name-only lookup.
    const nameMatches = byName.get(cardNm) ?? [];
    if (nameMatches.length === 1) {
      const p = nameMatches[0];
      matched.push({
        cardId: card.id,
        cardName: card.name,
        cardNumber: card.number,
        rarity: card.rarity,
        productId: p.productId,
        productName: p.cleanName || p.name,
        productNumber: productNumber(p),
        productRarity: productRarity(p),
        confidence: "name-fuzzy",
        notes: [
          `no TCG product with Number="${card.number}"; matched on name only`,
        ],
      });
      usedProductIds.add(p.productId);
      continue;
    }

    unmatched.push({
      cardId: card.id,
      cardName: card.name,
      cardNumber: card.number,
      rarity: card.rarity,
      reason:
        nameMatches.length > 1
          ? `${nameMatches.length} name-only candidates; needs manual pick`
          : `no TCG product matched by number or name`,
    });
  }

  // Orphans: TCG products with no local card pointing at them.
  const orphans: OrphanProduct[] = [];
  for (const p of tcgProducts) {
    if (usedProductIds.has(p.productId)) continue;
    orphans.push({
      productId: p.productId,
      productName: p.cleanName || p.name,
      productNumber: productNumber(p),
      reason: /error|misprint|black dot|mis-?cut/i.test(p.name)
        ? "error / variant print"
        : /energy|sealed|deck|booster|binder|box/i.test(p.name)
          ? "sealed or accessory product"
          : "unmatched — may be a parallel / reprint not in local catalogue",
    });
  }

  return { setId, matched, ambiguous, unmatched, orphans };
}
