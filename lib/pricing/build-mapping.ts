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
 *
 * Apostrophes are stripped tightly (no space) so "Farfetch'd" matches
 * TCGplayer's "Farfetchd". Trailing bare digits are also stripped —
 * TCGplayer sometimes suffixes cards sharing a name with their
 * number ("Rockets Sneak Attack 16", "Rockets Sneak Attack 72").
 */
export function normaliseName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // diacritics
    .toLowerCase()
    .replace(/['\u2018\u2019\u02BC`]/g, "") // apostrophes / smart quotes — tight (no space)
    .replace(/\([^)]*\)/g, " ") // parentheticals
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/-\s*(1st edition|unlimited|shadowless|holo).*/i, "")
    .replace(/[^a-z0-9 ]+/g, " ") // remaining punctuation → space
    .replace(/\s+\d+\s*$/, "") // trailing bare number ("rockets sneak attack 16")
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
 * Classic Levenshtein edit distance. Iterative two-row implementation;
 * O(|a|·|b|) time, O(min(|a|,|b|)) space. Used by `namesCompatible`
 * to accept tiny catalogue spelling variances (Impostor ↔ Imposter)
 * as matches when the card number already agrees.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Keep the shorter string on the inner loop — tiny memory win.
  if (a.length > b.length) [a, b] = [b, a];
  let prev = new Array<number>(a.length + 1);
  let curr = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;
  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1, // insertion
        prev[i] + 1, // deletion
        prev[i - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[a.length];
}

/**
 * Fuzzy-match threshold for edit distance. Scales ~1 per 10 chars
 * so short names stay strict (1 typo max) and long names tolerate
 * a little more drift (e.g. "Impostor Professor Oak" ↔ "Imposter
 * Professor Oak" = 22 chars, edit distance 1, threshold 2 → pass).
 */
export function fuzzyThreshold(len: number): number {
  return Math.max(1, Math.floor(len / 10));
}

/**
 * Are these two normalised names close enough to be the same card?
 *
 * Identity > substring-containment > bounded edit distance. The
 * fuzzy tier catches real-world catalogue drift between pokemontcg.io
 * and TCGplayer — misspellings present on the physical card that one
 * source copied faithfully and the other corrected. Because fuzzy is
 * only checked after card Number has already matched, a false
 * positive would require two adjacent-numbered cards to have near-
 * identical names — extremely rare.
 */
export function namesCompatible(a: string, b: string): { ok: boolean; distance: number } {
  if (a === b) return { ok: true, distance: 0 };
  if (!a || !b) return { ok: false, distance: Math.max(a.length, b.length) };
  if (a.includes(b) || b.includes(a)) return { ok: true, distance: 0 };
  const distance = levenshtein(a, b);
  const threshold = fuzzyThreshold(Math.max(a.length, b.length));
  return { ok: distance <= threshold, distance };
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
      const cmp = namesCompatible(pNm, cardNm);
      const notes: string[] = [];
      if (cmp.ok && cmp.distance > 0) {
        notes.push(
          `fuzzy name match · edit distance ${cmp.distance} · "${card.name}" ≈ "${p.cleanName || p.name}"`,
        );
      } else if (!cmp.ok) {
        notes.push(
          `name "${card.name}" vs TCG "${p.cleanName || p.name}" · edit distance ${cmp.distance}`,
        );
      }
      matched.push({
        cardId: card.id,
        cardName: card.name,
        cardNumber: card.number,
        rarity: card.rarity,
        productId: p.productId,
        productName: p.cleanName || p.name,
        productNumber: productNumber(p),
        productRarity: productRarity(p),
        confidence: cmp.ok ? "exact" : "number-only",
        notes,
      });
      usedProductIds.add(p.productId);
      continue;
    }

    if (numMatches.length > 1) {
      // Multiple products share this number. Try to disambiguate on name.
      const nameNarrowed = numMatches.filter((p) => {
        const pNm = normaliseName(p.cleanName || p.name);
        return namesCompatible(pNm, cardNm).ok;
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
