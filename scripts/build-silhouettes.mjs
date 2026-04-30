// Build Pokémon species silhouettes for the binder's "missing slot" art.
//
// Pulls official Sugimori artwork PNGs from PokeAPI/sprites (a public
// GitHub repo of Pokémon assets), turns each one into a solid black
// silhouette using its alpha channel, and writes the results to
// public/silhouettes/{dexNumber}.png.
//
// One-shot script. Re-running is cheap — files that already exist on
// disk are skipped, so a partial run can be resumed safely.
//
// Usage:
//   pnpm add -D sharp
//   node scripts/build-silhouettes.mjs
//
// Optional env vars:
//   START   first dex number to fetch (default 1)
//   END     last dex number to fetch  (default 1025)
//   FORCE   if set to "1", re-download + regenerate even if file exists

import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const START = Number(process.env.START ?? 1);
const END = Number(process.env.END ?? 1025);
const FORCE = process.env.FORCE === "1";

const OUT_DIR = path.join("public", "silhouettes");
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

async function makeSilhouette(pngBuffer) {
  // Strategy: keep the source image's alpha channel as a mask, replace
  // its RGB with solid black. We do this by:
  //   1. extracting the source alpha as a raw 1-channel buffer (with
  //      a low threshold to harden the soft anti-aliased edge);
  //   2. building a 3-channel pure-black canvas at the same size;
  //   3. joining the alpha buffer as the 4th channel.
  // The result is a transparent PNG whose only opaque pixels are the
  // exact shape of the Pokémon, painted black.
  const meta = await sharp(pngBuffer).metadata();
  const width = meta.width ?? 475;
  const height = meta.height ?? 475;

  const alphaRaw = await sharp(pngBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .threshold(8) // anything <8/255 alpha → fully transparent
    .raw()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .joinChannel(alphaRaw, { raw: { width, height, channels: 1 } })
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
    const silhouette = await makeSilhouette(src);
    writeFileSync(outPath, silhouette);
    downloaded++;
    if (downloaded % 25 === 0) {
      console.log(`  …${downloaded} silhouettes built (last: #${id})`);
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
