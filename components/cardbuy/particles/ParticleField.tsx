"use client";

import { useEffect, useRef } from "react";
import {
  RECIPES,
  type ElementalType,
  type Particle,
} from "./recipes";

type Props = {
  /** Pokémon TCG elemental type driving the particle recipe. When
   *  null/undefined the component renders nothing. */
  type: ElementalType | null | undefined;
  /** Spawn new particles while true. Flipping to false lets existing
   *  particles fade out naturally — the canvas isn't cleared abruptly. */
  active: boolean;
  className?: string;
};

/**
 * Canvas-backed per-element particle system.
 *
 * One canvas per listing card; a single requestAnimationFrame loop
 * spawns, updates, and draws particles according to the selected
 * recipe. The RAF keeps ticking while mounted — the extra cost of
 * running a near-empty loop beats the complexity of pausing and
 * resuming cleanly across React re-renders.
 *
 * Hidden for users with `prefers-reduced-motion: reduce`.
 */
export function ParticleField({ type, active, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!type) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const recipe = RECIPES[type] ?? RECIPES.default;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const sizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    sizeCanvas();
    const ro = new ResizeObserver(sizeCanvas);
    ro.observe(canvas);

    const particles: Particle[] = [];
    let spawnAccum = 0;
    let last = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (activeRef.current) {
        spawnAccum += dt * recipe.spawnRate;
        while (
          spawnAccum >= 1 &&
          particles.length < recipe.maxParticles
        ) {
          spawnAccum -= 1;
          particles.push(recipe.create(width, height));
        }
      } else {
        spawnAccum = 0;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          particles.splice(i, 1);
          continue;
        }
        recipe.update(p, dt, width, height);
        recipe.draw(ctx, p);
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [type]);

  if (!type) return null;
  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
