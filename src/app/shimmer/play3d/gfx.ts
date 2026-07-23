'use client'
// Graphics quality settings — the knobs that decide whether play3d fits the player's GPU.
//
// WHY THIS EXISTS (2026-07-23): Alex hit lag spikes in-game AND in his terminal at the same time.
// Root cause was not the server (load 0.17) or the network (15ms) — it was the client box's
// Intel UHD 630 sitting at 96-98% on the 3D engine. Windows composites the desktop on that same
// GPU, so a saturated game starves every other window too; that is why one bug had two faces.
//
// The scene was asking for a discrete-GPU budget: MSAA + a 2048² shadow map re-rendered every
// frame across 14 castShadow sites. Those are the two expensive things on an integrated GPU,
// which shares system RAM bandwidth instead of having its own.
//
// These are LOOK decisions, not perf decisions, so they are a player-facing toggle rather than a
// number I picked. The defaults below reproduce the shipped look EXACTLY — turning nothing on
// changes nothing — so the panel is a comparison instrument, not a silent downgrade.

export type ShadowQuality = 'off' | 'low' | 'high'

export type GfxSettings = {
  /** MSAA. A WebGL CONTEXT flag — cannot change without recreating the canvas (see gfxKey). */
  antialias: boolean
  /** Directional-light shadow map: off | 1024² | 2048². Quartering the map quarters the pass. */
  shadows: ShadowQuality
  /** Let the renderer drop resolution while the GPU is drowning, and recover when it is not. */
  adaptiveDpr: boolean
}

// Defaults = today's shipped look. Do not "helpfully" lower these; the whole point is that the
// baseline is untouched until the player rules on the trade.
export const GFX_DEFAULTS: GfxSettings = { antialias: true, shadows: 'high', adaptiveDpr: false }

export const SHADOW_MAP_SIZE: Record<ShadowQuality, number | null> = { off: null, low: 1024, high: 2048 }

const KEY = 'ather:gfx:shimmer'

export function loadGfx(): GfxSettings {
  if (typeof window === 'undefined') return GFX_DEFAULTS
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return GFX_DEFAULTS
    const p = JSON.parse(raw) as Partial<GfxSettings>
    return {
      antialias: typeof p.antialias === 'boolean' ? p.antialias : GFX_DEFAULTS.antialias,
      // allowlist, never a denylist — an unrecognised value falls back to the shipped look
      // rather than silently becoming 'off' and making the game look broken after a schema change.
      shadows: p.shadows === 'off' || p.shadows === 'low' || p.shadows === 'high' ? p.shadows : GFX_DEFAULTS.shadows,
      adaptiveDpr: typeof p.adaptiveDpr === 'boolean' ? p.adaptiveDpr : GFX_DEFAULTS.adaptiveDpr,
    }
  } catch { return GFX_DEFAULTS }
}

export function storeGfx(s: GfxSettings): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode — settings just don't persist */ }
}

/**
 * The canvas identity. `antialias` is baked into the WebGL context at creation, and three.js
 * cannot flip it on a live context — so changing it must REMOUNT the Canvas. `shadows` rides the
 * same key on purpose: toggling shadowMap.enabled underneath live materials needs every shader
 * recompiled, and a clean remount is correct where a half-applied shader state is a guessing game.
 *
 * Safe to remount: posRef/camYaw live in the PAGE component behind an `if (!posRef.current)`
 * guard (Shimmer3D.tsx), so the player keeps their position and facing. The one real cost is
 * pointer lock releasing with the old canvas element — the panel says so.
 */
export function gfxKey(s: GfxSettings): string {
  return `${s.antialias ? 'aa' : 'noaa'}-${s.shadows}`
}

/**
 * Resolution ceiling. R3F's default dpr is [1, 2], which renders up to 2x the pixels — pure waste
 * on this art style, and on a high-DPI phone it is the difference between playable and not.
 * NOTE for the desktop case: Alex's display runs 100% scaling (AppliedDPI 96), so devicePixelRatio
 * is already 1.0 and this ceiling is a no-op there. It protects high-DPI clients, NOT that box —
 * on the UHD 630 the wins are MSAA, shadows, and adaptiveDpr dropping BELOW 1.0.
 */
export function dprCeiling(): number {
  if (typeof window === 'undefined') return 1
  return Math.min(window.devicePixelRatio || 1, 1.5)
}

/** Adaptive floor. 0.6 renders ~36% of the pixels — a real rescue, still readable. */
export const DPR_FLOOR = 0.6
