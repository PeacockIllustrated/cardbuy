// Auto-resolve pokemontcg.io set IDs → TCGCSV group names.
// Reads pokemon-tcg-data/sets.json, fetches TCGCSV groups, matches by
// normalized name + a handful of known prefix variants. Writes:
//   - scripts/.out/aliases.json  (resolved alias map)
//   - scripts/.out/residue.json  (unresolved locals + unused tcgcsv groups)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.join("scripts", ".out");
mkdirSync(OUT_DIR, { recursive: true });

const TCGCSV = "https://tcgcsv.com/tcgplayer/3/groups";

// Hardcoded overrides for locals whose TCGCSV name can't be reached by
// heuristic. These were identified by inspecting the residue report.
// Empty array = intentionally unmapped (TCGCSV has no equivalent group).
const MANUAL_OVERRIDES = {
  basep: ["WoTC Promo"],
  sv1: ["SV01: Scarlet & Violet Base Set"],
  ecard1: ["Expedition"],
  np: ["Nintendo Promos"],
  dpp: ["Diamond and Pearl Promos"],
  hgss1: ["HeartGold SoulSilver"],
  hsp: ["HGSS Promos"],
  bwp: ["Black and White Promos"],
  xyp: ["XY Promos"],
  xy1: ["XY Base Set"],
  sm1: ["SM Base Set"],
  smp: ["SM Promos"],
  swshp: ["SWSH: Sword & Shield Promo Cards"],
  svp: ["SV: Scarlet & Violet Promo Cards"],
  sv3pt5: ["SV: Scarlet & Violet 151"],
  bp: ["Best of Promos"],
  // mcd21, fut20 — no TCGCSV equivalent; will remain mock.
};

function norm(s) {
  return s
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/é/g, "e")
    .replace(/&/g, "and")
    .replace(/[:\-—–]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Heuristic: try to find a TCGCSV group whose normalized name contains
// the local normalized name as a whole-word substring. Returns the
// shortest such group name (prefers the most specific match) or null
// if none / ambiguous.
function containsMatch(localNorm, groups) {
  if (localNorm.length < 4) return null;
  const tokens = localNorm.split(" ");
  const hits = [];
  for (const g of groups) {
    const gn = norm(g.name);
    // must contain every token in order, whole-word
    const re = new RegExp(`\\b${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\b.*\\b")}\\b`);
    if (re.test(gn)) hits.push(g);
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => norm(a.name).length - norm(b.name).length);
  return hits[0];
}

// Strip common TCGCSV / pokemontcg.io prefix conventions so names can
// meet in the middle. Returns an array of candidate forms.
function candidates(name) {
  const out = new Set([name]);
  // e.g. "SV: Scarlet & Violet" → "Scarlet & Violet"
  const colon = name.match(/^[A-Z0-9]{1,6}:\s*(.+)$/);
  if (colon) out.add(colon[1]);
  // e.g. "Sword & Shield—Rebel Clash" → "Rebel Clash"
  const emdash = name.split(/[—–-]/).map((s) => s.trim()).filter(Boolean);
  if (emdash.length > 1) out.add(emdash[emdash.length - 1]);
  // add SV/SWSH/SM/XY/BW/HGSS prefix-stripped versions already covered
  // extra: add with "Pokémon " prefix removed
  if (name.toLowerCase().startsWith("pokémon ")) out.add(name.slice(8));
  return [...out];
}

async function main() {
  const setsRaw = JSON.parse(readFileSync("pokemon-tcg-data/sets.json", "utf8"));
  const sets = setsRaw.data;

  console.log(`local sets: ${sets.length}`);
  console.log(`fetching TCGCSV groups…`);
  const res = await fetch(TCGCSV, {
    headers: { "User-Agent": "lewis-pokemon-platform/0.1 (alias-resolve)" },
  });
  const body = await res.json();
  if (!body.success) throw new Error("tcgcsv error");
  const groups = body.results; // {groupId, name, abbreviation, ...}
  console.log(`tcgcsv groups: ${groups.length}`);

  // Index groups by normalized name (and abbreviation).
  const byNorm = new Map();
  for (const g of groups) {
    byNorm.set(norm(g.name), g);
  }

  const aliases = {};
  const resolved = [];
  const unresolved = [];
  const usedGroupIds = new Set();

  for (const s of sets) {
    // Manual override wins before any heuristic.
    if (MANUAL_OVERRIDES[s.id]) {
      const names = MANUAL_OVERRIDES[s.id];
      const g = groups.find((g) => names.includes(g.name));
      if (g) {
        aliases[s.id] = [g.name];
        usedGroupIds.add(g.groupId);
        resolved.push({
          id: s.id,
          localName: s.name,
          tcgcsvName: g.name,
          groupId: g.groupId,
          via: "manual-override",
        });
        continue;
      }
    }
    const cands = candidates(s.name);
    let hit = null;
    let matchedAlias = null;
    for (const c of cands) {
      const g = byNorm.get(norm(c));
      if (g) {
        hit = g;
        matchedAlias = c;
        break;
      }
    }
    // Fallback: whole-word substring match against group names.
    let via = matchedAlias === s.name ? "exact" : `stripped:"${matchedAlias}"`;
    if (!hit) {
      const local = norm(s.name);
      const sub = containsMatch(local, groups);
      if (sub) {
        hit = sub;
        via = `contains:"${sub.name}"`;
      }
    }
    // McDonald's: local "Collection YYYY" ↔ tcgcsv "Promos YYYY"
    if (!hit && /^mcd\d+$/i.test(s.id)) {
      const yr = s.name.match(/\d{4}/)?.[0];
      if (yr) {
        const g = groups.find((g) =>
          /mcdonald/i.test(g.name) && g.name.includes(yr),
        );
        if (g) {
          hit = g;
          via = `mcd:${yr}`;
        }
      }
    }

    if (hit) {
      aliases[s.id] = [hit.name];
      usedGroupIds.add(hit.groupId);
      resolved.push({
        id: s.id,
        localName: s.name,
        tcgcsvName: hit.name,
        groupId: hit.groupId,
        via,
      });
    } else {
      unresolved.push({
        id: s.id,
        localName: s.name,
        series: s.series,
        releaseDate: s.releaseDate,
        candidatesTried: cands,
      });
    }
  }

  const unusedGroups = groups
    .filter((g) => !usedGroupIds.has(g.groupId))
    .map((g) => ({ groupId: g.groupId, name: g.name }));

  writeFileSync(
    path.join(OUT_DIR, "aliases.json"),
    JSON.stringify(aliases, null, 2),
  );
  writeFileSync(
    path.join(OUT_DIR, "resolved.json"),
    JSON.stringify(resolved, null, 2),
  );
  writeFileSync(
    path.join(OUT_DIR, "residue.json"),
    JSON.stringify({ unresolved, unusedGroups }, null, 2),
  );

  console.log(`\nresolved:   ${resolved.length}/${sets.length}`);
  console.log(`unresolved: ${unresolved.length}`);
  console.log(`unused tcgcsv groups: ${unusedGroups.length}`);
  console.log(`\noutputs in ${OUT_DIR}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
