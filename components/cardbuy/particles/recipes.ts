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

/** Per-type brand-accent colour. Exported for React components that
 *  want to tint things (e.g. the starburst drop-shadow behind a
 *  featured tile) to match whichever particle set is active for that
 *  card. Pink/teal/yellow mapping keeps the accents on-brand while
 *  still differentiating types. */
export const TYPE_GLOW_HEX: Record<ElementalType, string> = {
  Fire: COLORS.pink,
  Water: COLORS.teal,
  Grass: COLORS.teal,
  Lightning: COLORS.yellow,
  Psychic: COLORS.pink,
  Fighting: COLORS.yellow,
  Colorless: COLORS.paper,
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

/** Alpha envelope: fade in first 15%, hold, fade out last 45%.
 *  Longer fade-out than the old spec so particles approaching the
 *  canvas edge are already well on their way to zero alpha by the
 *  time they clip — no visible edge cut-off. */
function alphaEnvelope(t: number): number {
  if (t < 0.15) return t / 0.15;
  if (t > 0.55) return Math.max(0, (1 - t) / 0.45);
  return 1;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Approximate rectangle of the card within the particle canvas.
 *  The particle canvas in `ListingCard` is sized LARGER than the
 *  burst well (via negative insets) so particles can spill out of
 *  the tile and fade freely — that means the card-image rect covers
 *  a smaller fraction of the canvas than it did of the well.
 *
 *  Numbers are fractions of the canvas width/height. */
const CARD_RECT = {
  cxFrac: 0.5,
  cyFrac: 0.5,
  halfWFrac: 0.25,
  halfHFrac: 0.33,
} as const;

/** Single motion profile shared across every type. Particles spawn on
 *  one of the four card-rect edges and shoot outward; a light drag on
 *  each frame softens them toward end-of-life so the fade-out lines
 *  up visually with them slowing down. */
function createParticle(w: number, h: number): Particle {
  const cx = w * CARD_RECT.cxFrac;
  const cy = h * CARD_RECT.cyFrac;
  const halfW = w * CARD_RECT.halfWFrac;
  const halfH = h * CARD_RECT.halfHFrac;

  const speed = rand(32, 68);
  // 4 sides, equal weight — top, right, bottom, left.
  const side = Math.floor(Math.random() * 4);
  let x: number;
  let y: number;
  let vx: number;
  let vy: number;
  switch (side) {
    case 0: // TOP — fire upward
      x = cx + rand(-halfW, halfW);
      y = cy - halfH;
      vx = rand(-16, 16);
      vy = -speed;
      break;
    case 1: // RIGHT — fire rightward
      x = cx + halfW;
      y = cy + rand(-halfH, halfH);
      vx = speed;
      vy = rand(-14, 14);
      break;
    case 2: // BOTTOM — fire downward
      x = cx + rand(-halfW, halfW);
      y = cy + halfH;
      vx = rand(-16, 16);
      vy = speed;
      break;
    default: // LEFT — fire leftward
      x = cx - halfW;
      y = cy + rand(-halfH, halfH);
      vx = -speed;
      vy = rand(-14, 14);
      break;
  }

  return {
    x,
    y,
    vx,
    vy,
    age: 0,
    life: rand(1.3, 1.9),
    // Slightly smaller than last pass — the glow halo visually bumps
    // the footprint, so shrinking the sprite keeps the overall bloom
    // in check.
    size: rand(9, 14),
    rotation: rand(0, Math.PI * 2),
    vr: rand(-1.0, 1.0),
    fill: "",
    data: { a: rand(0, Math.PI * 2) },
  };
}

function updateParticle(p: Particle, dt: number): void {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rotation += p.vr * dt;
  // Exponential drag — velocities decay toward zero so the trailing
  // portion of each life slows visibly, giving the fade-out a
  // physically-natural "settle" feel instead of linear drift. Light
  // value so the slower base speeds still drift meaningfully instead
  // of parking near the card.
  const drag = Math.pow(0.85, dt);
  p.vx *= drag;
  p.vy *= drag;
}

/** Build a recipe that renders the given type's vendored sprite with
 *  the unified leaf motion. Sprites are decoded once; each draw is a
 *  single translated/rotated `drawImage` call. */
function buildRecipe(type: ElementalType): Recipe {
  return {
    // Tuned for the card-perimeter emission pattern: enough bursts to
    // feel energetic from every side without frame-budget concern.
    spawnRate: 22,
    maxParticles: 22,
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

      ctx.drawImage(img, -s, -s, s * 2, s * 2);

      // Pop-art ink ring surround — cleanly defines the sprite's edge.
      ctx.beginPath();
      ctx.arc(0, 0, s + 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
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
