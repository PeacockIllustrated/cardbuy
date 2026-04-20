/**
 * Per-type particle recipes. Each one produces pop-art stylised
 * elemental visuals — chunky vector shapes with thick ink outlines
 * and brand-palette fills, not realistic textures.
 *
 * Covers Gen-1 TCG energy (Fire / Water / Grass / Lightning / Psychic
 * / Fighting). Anything else falls back to the generic sparkle recipe.
 *
 * All particles share a single canvas instance owned by
 * `ParticleField`. Recipes stay pure (no React, no DOM) so the render
 * loop can process them in a tight RAF.
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

/** Gen-1 TCG energy types driven by this system. */
export type ElementalType =
  | "Fire"
  | "Water"
  | "Grass"
  | "Lightning"
  | "Psychic"
  | "Fighting";

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

/** Alpha envelope: fade in first 15%, hold, fade out last 30%. */
function alphaEnvelope(t: number): number {
  if (t < 0.15) return t / 0.15;
  if (t > 0.7) return Math.max(0, (1 - t) / 0.3);
  return 1;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ── Fire ──────────────────────────────────────────────────
// Chunky upward flame teardrops, yellow tips + pink cores, rising
// from the bottom with a horizontal flicker. Matches Charizard's
// Ember / Fire Spin vibe in the TCG without photoreal gradients.
const fire: Recipe = {
  spawnRate: 38,
  maxParticles: 30,
  create: (w, h) => ({
    x: w * 0.2 + Math.random() * w * 0.6,
    y: h + 6,
    vx: rand(-18, 18),
    vy: rand(-80, -48),
    age: 0,
    life: rand(0.7, 1.1),
    size: rand(7, 12),
    rotation: rand(-0.2, 0.2),
    vr: rand(-0.8, 0.8),
    fill: Math.random() < 0.55 ? COLORS.yellow : COLORS.pink,
    data: { a: Math.random() * Math.PI * 2 },
  }),
  update: (p, dt) => {
    p.x += p.vx * dt + Math.sin((p.age + (p.data.a ?? 0)) * 12) * dt * 8;
    p.y += p.vy * dt;
    p.vy -= 40 * dt;
    p.vx *= Math.pow(0.45, dt);
    p.rotation += p.vr * dt;
    p.size *= Math.pow(0.92, dt);
  },
  draw: (ctx, p) => {
    const a = alphaEnvelope(p.age / p.life);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    const s = p.size;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.quadraticCurveTo(-s * 1.1, s * 0.2, -s * 0.55, -s * 0.35);
    ctx.quadraticCurveTo(-s * 0.25, -s * 1.2, 0, -s * 1.55);
    ctx.quadraticCurveTo(s * 0.25, -s * 1.2, s * 0.55, -s * 0.35);
    ctx.quadraticCurveTo(s * 1.1, s * 0.2, 0, s * 0.9);
    ctx.closePath();
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    ctx.restore();
  },
};

// ── Water ─────────────────────────────────────────────────
// Teardrops falling from the top with a gentle horizontal sway.
// Teal + paper so they read on the pink section backdrop. Echoes
// Blastoise's Hydro Pump / Water Gun stream but stylised as beads.
const water: Recipe = {
  spawnRate: 30,
  maxParticles: 26,
  create: (w) => ({
    x: rand(w * 0.1, w * 0.9),
    y: -6,
    vx: rand(-10, 10),
    vy: rand(60, 100),
    age: 0,
    life: rand(0.9, 1.3),
    size: rand(6, 10),
    rotation: 0,
    vr: 0,
    fill: Math.random() < 0.65 ? COLORS.teal : COLORS.paper,
    data: { a: Math.random() * Math.PI * 2 },
  }),
  update: (p, dt) => {
    p.x += p.vx * dt + Math.sin((p.age + (p.data.a ?? 0)) * 4) * dt * 10;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
  },
  draw: (ctx, p) => {
    const a = alphaEnvelope(p.age / p.life);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    const s = p.size;
    // Teardrop: pointed top, round-bellied bottom (falling direction).
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.3);
    ctx.bezierCurveTo(s * 0.9, -s * 0.5, s * 0.9, s * 0.6, 0, s * 0.9);
    ctx.bezierCurveTo(-s * 0.9, s * 0.6, -s * 0.9, -s * 0.5, 0, -s * 1.3);
    ctx.closePath();
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    ctx.restore();
  },
};

// ── Grass ─────────────────────────────────────────────────
// Leaves spiralling upward with free rotation. Teal-dominant with
// yellow accents. Echoes Venusaur's Solar Beam / Vine Whip reveal.
const grass: Recipe = {
  spawnRate: 18,
  maxParticles: 20,
  create: (w, h) => ({
    x: rand(w * 0.1, w * 0.9),
    y: h + 8,
    vx: rand(-15, 15),
    vy: rand(-50, -28),
    age: 0,
    life: rand(1.3, 1.9),
    size: rand(8, 14),
    rotation: rand(0, Math.PI * 2),
    vr: rand(-1.4, 1.4),
    fill: Math.random() < 0.7 ? COLORS.teal : COLORS.yellow,
    data: { a: rand(0, Math.PI * 2) },
  }),
  update: (p, dt) => {
    p.x += p.vx * dt + Math.sin((p.age + (p.data.a ?? 0)) * 3) * dt * 15;
    p.y += p.vy * dt;
    p.vy -= 5 * dt;
    p.rotation += p.vr * dt;
  },
  draw: (ctx, p) => {
    const a = alphaEnvelope(p.age / p.life);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    const s = p.size;
    // Leaf: pointed oval.
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.2);
    ctx.bezierCurveTo(s * 0.75, -s * 0.8, s * 0.75, s * 0.8, 0, s * 1.2);
    ctx.bezierCurveTo(-s * 0.75, s * 0.8, -s * 0.75, -s * 0.8, 0, -s * 1.2);
    ctx.closePath();
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    // Central spine.
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.05);
    ctx.lineTo(0, s * 1.05);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  },
};

// ── Lightning ─────────────────────────────────────────────
// Brief zigzag bolts flashing top-to-bottom. Fast lifetime, yellow
// fills with ink outlines. Mirrors Zapdos' Thunderbolt strike energy.
const lightning: Recipe = {
  spawnRate: 10,
  maxParticles: 8,
  create: (w) => ({
    x: rand(w * 0.1, w * 0.9),
    y: -5,
    vx: rand(-40, 40),
    vy: rand(180, 260),
    age: 0,
    life: rand(0.35, 0.55),
    size: rand(14, 20),
    rotation: rand(-0.3, 0.3),
    vr: 0,
    fill: COLORS.yellow,
    data: {},
  }),
  update: (p, dt) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  },
  draw: (ctx, p) => {
    const t = p.age / p.life;
    // Strobe-like envelope — snap in, hold, snap out.
    const a = t < 0.1 ? t / 0.1 : t > 0.7 ? (1 - t) / 0.3 : 1;
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    const s = p.size;
    // Thick-Z zigzag bolt.
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s);
    ctx.lineTo(s * 0.15, -s * 0.25);
    ctx.lineTo(-s * 0.15, -s * 0.1);
    ctx.lineTo(s * 0.3, s);
    ctx.lineTo(-s * 0.05, s * 0.25);
    ctx.lineTo(s * 0.15, s * 0.1);
    ctx.closePath();
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    ctx.restore();
  },
};

// ── Psychic ───────────────────────────────────────────────
// Pulsing orbs with a contrasting inner core. Drift upward slowly.
// Pink + paper. Echoes Mewtwo / Alakazam's Psybeam halo.
const psychic: Recipe = {
  spawnRate: 16,
  maxParticles: 18,
  create: (w, h) => ({
    x: rand(w * 0.15, w * 0.85),
    y: h + 10,
    vx: rand(-12, 12),
    vy: rand(-45, -25),
    age: 0,
    life: rand(1.4, 1.9),
    size: rand(6, 10),
    rotation: 0,
    vr: 0,
    fill: Math.random() < 0.6 ? COLORS.pink : COLORS.paper,
    data: { a: rand(0, Math.PI * 2) },
  }),
  update: (p, dt) => {
    p.x += p.vx * dt + Math.sin((p.age + (p.data.a ?? 0)) * 2) * dt * 10;
    p.y += p.vy * dt;
  },
  draw: (ctx, p) => {
    const a = alphaEnvelope(p.age / p.life);
    if (a <= 0) return;
    const pulse = 1 + 0.25 * Math.sin(p.age * 8);
    const s = p.size * pulse;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    // Outer orb.
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    // Inner core — opposite of the outer fill for contrast.
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = p.fill === COLORS.pink ? COLORS.paper : COLORS.pink;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    ctx.restore();
  },
};

// ── Fighting ──────────────────────────────────────────────
// Burst stars radiating outward from the card centre. Short life,
// grow over time. Echoes Hitmonlee / Machamp's impact lines.
const fighting: Recipe = {
  spawnRate: 22,
  maxParticles: 14,
  create: (w, h) => {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(80, 140);
    return {
      x: w * 0.5,
      y: h * 0.55,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: rand(0.5, 0.8),
      size: rand(6, 10),
      rotation: angle,
      vr: rand(-2, 2),
      fill: Math.random() < 0.5 ? COLORS.yellow : COLORS.pink,
      data: {},
    };
  },
  update: (p, dt) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.3, dt);
    p.vy *= Math.pow(0.3, dt);
    p.rotation += p.vr * dt;
    p.size *= Math.pow(1.2, dt);
  },
  draw: (ctx, p) => {
    const a = alphaEnvelope(p.age / p.life);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    const s = p.size;
    // 4-point impact star.
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.35, -s * 0.35);
    ctx.lineTo(s, 0);
    ctx.lineTo(s * 0.35, s * 0.35);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.35, s * 0.35);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s * 0.35, -s * 0.35);
    ctx.closePath();
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    ctx.restore();
  },
};

// ── Default fallback ──────────────────────────────────────
// Neutral sparkles for Colourless / unknown types.
const defaultRecipe: Recipe = {
  spawnRate: 14,
  maxParticles: 14,
  create: (w, h) => ({
    x: rand(0, w),
    y: rand(0, h),
    vx: rand(-8, 8),
    vy: rand(-8, 8),
    age: 0,
    life: rand(0.9, 1.4),
    size: rand(3, 6),
    rotation: rand(0, Math.PI * 2),
    vr: rand(-0.5, 0.5),
    fill: COLORS.yellow,
    data: {},
  }),
  update: (p, dt) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rotation += p.vr * dt;
  },
  draw: (ctx, p) => {
    const a = alphaEnvelope(p.age / p.life);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    const s = p.size;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.3, -s * 0.3);
    ctx.lineTo(s, 0);
    ctx.lineTo(s * 0.3, s * 0.3);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.3, s * 0.3);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s * 0.3, -s * 0.3);
    ctx.closePath();
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    ctx.restore();
  },
};

export const RECIPES: Record<ElementalType | "default", Recipe> = {
  Fire: fire,
  Water: water,
  Grass: grass,
  Lightning: lightning,
  Psychic: psychic,
  Fighting: fighting,
  default: defaultRecipe,
};

/** Narrow an arbitrary string (from `Card.types[0]`) into the recipe
 *  keyspace. Anything else returns null and callers can skip rendering
 *  the particle field entirely. */
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
      return raw;
    default:
      return null;
  }
}
