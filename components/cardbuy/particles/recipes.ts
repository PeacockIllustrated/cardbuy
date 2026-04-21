/**
 * Per-type particle recipes.
 *
 * Every elemental type now uses the same leafy upward-spiral motion
 * that Grass originally had (spawns along the bottom, drifts up with a
 * sinusoidal sway, rotates freely, fades out around 1.5s). The only
 * thing that varies per type is the sprite rendered on each particle —
 * a vendored Pokémon TCG energy icon from `public/icons/types/*.svg`
 * (partywhale/pokemon-type-icons, MIT).
 *
 * The old per-type hand-drawn shapes (flame, teardrop, zigzag, orb,
 * star) have been retired — the real icons are more recognisable and
 * the unified motion gives every listing tile the same rhythmic feel
 * with only the pictogram identifying the type.
 *
 * Sprites are lazy-loaded once per page via a module-level `Image`
 * cache — first-hover of any given type triggers a ~instant fetch.
 * Canvas draw() short-circuits until the image is decoded.
 */

/** Brand palette — mirrors CSS vars in `app/globals.css`. Canvas can't
 *  read `var(--color-…)` at draw time so we inline the hex. */
export const COLORS = {
  ink: "#0a0a0a",
  paper: "#ffffff",
  pink: "#ff4eb8",
  teal: "#27d3c4",
  yellow: "#ffe600",
} as const;

/** TCG energy types driven by this system. Expand as new sprite SVGs
 *  land in `public/icons/types/`. */
export type ElementalType =
  | "Fire"
  | "Water"
  | "Grass"
  | "Lightning"
  | "Psychic"
  | "Fighting"
  | "Colorless";

/** State carried per-live-particle. `data` holds recipe-specific scalars
 *  (phase seeds, pulse offsets, etc.) so the shape stays stable. */
export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  rotation: number;
  vr: number;
  fill: string;
  data: { a?: number; b?: number; c?: number };
};

export type Recipe = {
  /** Particles spawned per second while the field is active. */
  spawnRate: number;
  /** Hard cap on live particles to keep frame budget predictable. */
  maxParticles: number;
  create: (w: number, h: number) => Particle;
  update: (p: Particle, dt: number, w: number, h: number) => void;
  draw: (ctx: CanvasRenderingContext2D, p: Particle) => void;
};

/** Public path → browser downloads these on first use. Keep filenames
 *  in lock-step with `public/icons/types/README.md`. */
const SPRITE_PATHS: Record<ElementalType, string> = {
  Fire: "/icons/types/fire.svg",
  Water: "/icons/types/water.svg",
  Grass: "/icons/types/grass.svg",
  Lightning: "/icons/types/lightning.svg",
  Psychic: "/icons/types/psychic.svg",
  Fighting: "/icons/types/fighting.svg",
  Colorless: "/icons/types/colorless.svg",
};

/** Lazy per-page sprite cache. Created on first access to each type,
 *  reused across every particle and every tile thereafter. */
const spriteCache = new Map<ElementalType, HTMLImageElement>();

function getSprite(type: ElementalType): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  let img = spriteCache.get(type);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = SPRITE_PATHS[type];
    spriteCache.set(type, img);
  }
  return img;
}

/** Alpha envelope: fade in first 15%, hold, fade out last 30%. */
function alphaEnvelope(t: number): number {
  if (t < 0.15) return t / 0.15;
  if (t > 0.7) return Math.max(0, (1 - t) / 0.3);
  return 1;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** The one motion profile all types share — derived from the original
 *  Grass recipe. Particles spawn along the bottom, drift up with a
 *  horizontal sway, rotate freely, and fade. */
function createParticle(w: number, h: number): Particle {
  return {
    x: rand(w * 0.1, w * 0.9),
    y: h + 8,
    vx: rand(-15, 15),
    vy: rand(-50, -28),
    age: 0,
    life: rand(1.3, 1.9),
    // Larger than the original leaf shape — SVG sprites read smaller
    // at the same "radius" because the pictogram only fills ~60% of
    // the disc, so bump to compensate.
    size: rand(11, 17),
    rotation: rand(0, Math.PI * 2),
    vr: rand(-1.4, 1.4),
    fill: "",
    data: { a: rand(0, Math.PI * 2) },
  };
}

function updateParticle(p: Particle, dt: number): void {
  p.x += p.vx * dt + Math.sin((p.age + (p.data.a ?? 0)) * 3) * dt * 15;
  p.y += p.vy * dt;
  p.vy -= 5 * dt;
  p.rotation += p.vr * dt;
}

/** Build a recipe that renders the given type's vendored sprite with
 *  the unified leaf motion. Sprites are decoded once; each draw is a
 *  single translated/rotated `drawImage` call. */
function buildRecipe(type: ElementalType): Recipe {
  return {
    spawnRate: 18,
    maxParticles: 20,
    create: createParticle,
    update: updateParticle,
    draw: (ctx, p) => {
      const img = getSprite(type);
      // Skip until the SVG has decoded. drawImage would throw on an
      // incomplete image — this short-circuits cleanly.
      if (!img || !img.complete || img.naturalWidth === 0) return;

      const a = alphaEnvelope(p.age / p.life);
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      const s = p.size;
      // Pop-art ink ring surround — sits tight against the disc so
      // every type sprite reads with the brand's chunky-outline feel
      // regardless of its own colour palette.
      ctx.beginPath();
      ctx.arc(0, 0, s + 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.drawImage(img, -s, -s, s * 2, s * 2);
      ctx.restore();
    },
  };
}

export const RECIPES: Record<ElementalType | "default", Recipe> = {
  Fire: buildRecipe("Fire"),
  Water: buildRecipe("Water"),
  Grass: buildRecipe("Grass"),
  Lightning: buildRecipe("Lightning"),
  Psychic: buildRecipe("Psychic"),
  Fighting: buildRecipe("Fighting"),
  Colorless: buildRecipe("Colorless"),
  default: buildRecipe("Colorless"),
};

/** Narrow an arbitrary string (from `Card.types[0]`) into the recipe
 *  keyspace. Anything else returns null and callers skip rendering the
 *  particle field entirely. */
export function resolveElementalType(
  raw: string | null | undefined,
): ElementalType | null {
  switch (raw) {
    case "Fire":
    case "Water":
    case "Grass":
    case "Lightning":
    case "Psychic":
    case "Fighting":
    case "Colorless":
      return raw;
    default:
      return null;
  }
}
