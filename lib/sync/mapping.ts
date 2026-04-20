import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { TcgcsvGroup } from "./tcgcsv";

/**
 * Maps TCGCSV's `groupId` (TCGplayer set id) to our pokemontcg.io
 * set id. The natural join key is the official PTCGO abbreviation —
 * pokemontcg.io's sets.json carries `ptcgoCode` and TCGCSV's groups
 * carry `abbreviation`. Where both exist and match, we have a
 * confident link.
 *
 * Falls back to fuzzy name matching for sets without an abbreviation
 * (mostly older promos and Asian-only releases).
 */

interface PokemontcgIoSet {
  id: string;
  name: string;
  series: string;
  ptcgoCode?: string;
  releaseDate: string;
  printedTotal: number;
}

interface SetsFile {
  data: PokemontcgIoSet[];
}

const SETS_FILE = path.join(
  process.cwd(),
  "pokemon-tcg-data",
  "sets.json",
);

let setsCache: PokemontcgIoSet[] | null = null;

function loadSets(): PokemontcgIoSet[] {
  if (setsCache) return setsCache;
  const raw = JSON.parse(readFileSync(SETS_FILE, "utf8")) as SetsFile;
  setsCache = raw.data;
  return setsCache;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export type SetLink = {
  /** pokemontcg.io set id (e.g. 'base1') */
  id: string;
  /** Set name (for logs). */
  name: string;
  /** Why we matched — useful for low-confidence flags. */
  matchedBy: "abbreviation" | "name";
};

/**
 * Resolve a TCGCSV group to a pokemontcg.io set, if possible.
 * Returns null when no confident match exists; the sync logs these
 * for manual review.
 */
export function mapGroupToSet(group: TcgcsvGroup): SetLink | null {
  const sets = loadSets();

  // 1. Exact PTCGO abbreviation match (high confidence).
  if (group.abbreviation) {
    const byAbbr = sets.find(
      (s) => s.ptcgoCode?.toUpperCase() === group.abbreviation.toUpperCase(),
    );
    if (byAbbr) {
      return { id: byAbbr.id, name: byAbbr.name, matchedBy: "abbreviation" };
    }
  }

  // 2. Exact normalized-name match.
  const normGroup = normalize(group.name);
  const byName = sets.find((s) => normalize(s.name) === normGroup);
  if (byName) {
    return { id: byName.id, name: byName.name, matchedBy: "name" };
  }

  // 3. Strip TCGCSV's set prefix conventions ("ME04: Chaos Rising" →
  //    "Chaos Rising") and try again. PokemonTCG.io tends not to use
  //    the era code in set names.
  const stripped = group.name.replace(/^[A-Z0-9]+:\s*/, "");
  if (stripped !== group.name) {
    const normStripped = normalize(stripped);
    const byStripped = sets.find((s) => normalize(s.name) === normStripped);
    if (byStripped) {
      return {
        id: byStripped.id,
        name: byStripped.name,
        matchedBy: "name",
      };
    }
  }

  return null;
}

/**
 * Resolve a TCGplayer card (TCGCSV product) to a pokemontcg.io card id.
 * Composite key: set_id + numeric card number. Some sets use alphanumeric
 * numbers (TG12, SV98) — we match those literally.
 */
export function resolveCardId(
  setId: string,
  cardNumber: string | null,
): string | null {
  if (!cardNumber) return null;
  // pokemontcg.io card ids are `{setId}-{number}` with leading zeros
  // stripped (e.g. base1-1, sv5-25, swsh12pt5gg-tg30).
  return `${setId}-${cardNumber.toLowerCase()}`;
}
