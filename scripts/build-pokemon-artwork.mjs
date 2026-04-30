// Build Pokémon coloured species artwork for the regions binder's
// owned-slot grid tile and (potentially) other surfaces that want a
// recognisable species image divorced from any specific TCG print.
//
// Pulls the same Sugimori official-artwork PNGs from PokeAPI/sprites
// that scripts/build-silhouettes.mjs uses, but skips the alpha-mask
// transform — the output is the colour image itself, just resized to
// 240×240 and written under public/pokemon-artwork/{dexNumber}.png.
//
// Resizing is done with `fit: "contain"` so the original aspect ratio
// is preserved on a transparent background; the binder grid tile is
// roughly card-shaped (5/7) and contains the artwork without distortion.
//
// Re-running is cheap — files already on disk are skipped, so a
// partial run can be resumed safely. Use FORCE=1 to overwrite.
//
// Usage:
//   node scripts/build-pokemon-artwork.mjs
//
// Optional env vars:
//   START   first dex number to fetch (default 1)
//   END     last dex number to fetch  (default 1025)
//   SIZE    output square size in px  (default 240)
//   FORCE   if "1", re-download + regenerate even if file exists

import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const START = Number(process.env.START ?? 1);
const END = Number(process.env.END ?? 1025);
const SIZE = Number(process.env.SIZE ?? 240);
const FORCE = process.env.FORCE === "1";

const OUT_DIR = path.join("public", "pokemon-artwork");
mkdirSync(OUT_DIR, { recursive: true });

const SPRITE_URL = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

// Polite delay between requests so we don't hammer githubusercontent.
const DELAY_MS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPng(id) {
  const res = await fetch(SPRITE_URL(id));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} for #${id}`);
  return Buffer.from(await res.arrayBuffer());
}

async function makeThumbnail(pngBuffer) {
  return sharp(pngBuffer)
    .ensureAlpha()
    .resize(SIZE, SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

let downloaded = 0;
let skipped = 0;
let missing = 0;
let failed = 0;

for (let id = START; id <= END; id++) {
  const outPath = path.join(OUT_DIR, `${id}.png`);
  if (!FORCE && existsSync(outPath)) {
    skipped++;
    continue;
  }

  try {
    const src = await fetchPng(id);
    if (!src) {
      missing++;
      if (id % 25 === 0 || missing <= 3) {
        console.log(`#${id} — no artwork on PokeAPI (skipped)`);
      }
      continue;
    }
    const thumb = await makeThumbnail(src);
    writeFileSync(outPath, thumb);
    downloaded++;
    if (downloaded % 25 === 0) {
      console.log(`  …${downloaded} artworks built (last: #${id})`);
    }
    await sleep(DELAY_MS);
  } catch (err) {
    failed++;
    console.error(`#${id} failed:`, err.message);
  }
}

console.log("\n— done —");
console.log(`  built:   ${downloaded}`);
console.log(`  skipped: ${skipped} (already on disk)`);
console.log(`  missing: ${missing} (no upstream artwork)`);
console.log(`  failed:  ${failed}`);
console.log(`\noutput dir: ${OUT_DIR}`);
