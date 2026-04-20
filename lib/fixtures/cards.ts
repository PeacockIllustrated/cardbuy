/**
 * Phase 1 fixture loader for the pokemontcg.io snapshot in
 * `pokemon-tcg-data/`. Server-only: uses `node:fs` at module init and
 * caches the flattened list for the lifetime of the process.
 *
 * Set metadata (name, series, release date, logo/symbol URLs) is read
 * from `pokemon-tcg-data/sets.json` — the upstream v2 sets index.
 *
 * Phase 2 will replace these helpers with Supabase queries of the same
 * shape (getAllCards / getCardById / getCardsBySet / searchCards).
 */

import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Card, CardSet } from "@/lib/types/card";

export const LAST_SYNCED = "2022-10-10";

const DATA_DIR = path.join(process.cwd(), "pokemon-tcg-data");
const SETS_FILE = path.join(DATA_DIR, "sets.json");

interface RawSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  images?: { symbol?: string; logo?: string };
}

function loadSets(): CardSet[] {
  const raw = JSON.parse(readFileSync(SETS_FILE, "utf8")) as { data: RawSet[] };
  return raw.data.map((s) => ({
    id: s.id,
    name: s.name,
    series: s.series,
    releaseYear: Number(s.releaseDate.slice(0, 4)),
    releaseDate: s.releaseDate,
    printedTotal: s.printedTotal,
    total: s.total,
    logoUrl: s.images?.logo,
    symbolUrl: s.images?.symbol,
  }));
}

export const CARD_SETS: CardSet[] = loadSets();

const SETS_BY_ID: Record<string, CardSet> = Object.fromEntries(
  CARD_SETS.map((s) => [s.id, s]),
);

function setFilesOnDisk(): Set<string> {
  return new Set(
    readdirSync(DATA_DIR)
      .filter((f) => f.endsWith(".json") && f !== "sets.json")
      .map((f) => f.replace(/\.json$/, "")),
  );
}

function loadAll(): Card[] {
  const present = setFilesOnDisk();
  const all: Card[] = [];
  for (const set of CARD_SETS) {
    if (!present.has(set.id)) continue;
    const file = path.join(DATA_DIR, `${set.id}.json`);
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Card[];
    all.push(...parsed);
  }
  return all;
}

const ALL_CARDS: Card[] = loadAll();

const CARDS_BY_ID: Map<string, Card> = new Map(
  ALL_CARDS.map((c) => [c.id, c]),
);

const CARD_COUNT_BY_SET: Map<string, number> = ALL_CARDS.reduce((m, c) => {
  const sid = setIdOf(c);
  m.set(sid, (m.get(sid) ?? 0) + 1);
  return m;
}, new Map<string, number>());

export function getAllCards(): Card[] {
  return ALL_CARDS;
}

export function getCardById(id: string): Card | undefined {
  return CARDS_BY_ID.get(id);
}

export function getCardsBySet(setId: string): Card[] {
  return ALL_CARDS.filter((c) => setIdOf(c) === setId);
}

export function searchCards(query: string): Card[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_CARDS;
  return ALL_CARDS.filter((c) => c.name.toLowerCase().includes(q));
}

export function setIdOf(card: Card): string {
  const idx = card.id.indexOf("-");
  return idx === -1 ? card.id : card.id.slice(0, idx);
}

export function setOf(card: Card): CardSet | undefined {
  return SETS_BY_ID[setIdOf(card)];
}

export function getSetById(id: string): CardSet | undefined {
  return SETS_BY_ID[id];
}

export function getAllSets(): CardSet[] {
  return CARD_SETS;
}

export function getCardCount(setId: string): number {
  return CARD_COUNT_BY_SET.get(setId) ?? 0;
}

export function getSetsGroupedBySeries(): { series: string; sets: CardSet[] }[] {
  const groups = new Map<string, CardSet[]>();
  for (const s of CARD_SETS) {
    const list = groups.get(s.series) ?? [];
    list.push(s);
    groups.set(s.series, list);
  }
  const ordered: { series: string; sets: CardSet[] }[] = [];
  for (const [series, sets] of groups) {
    sets.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
    ordered.push({ series, sets });
  }
  ordered.sort(
    (a, b) =>
      a.sets[0].releaseDate.localeCompare(b.sets[0].releaseDate),
  );
  return ordered;
}
