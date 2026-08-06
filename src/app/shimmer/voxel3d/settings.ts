// Render settings — persisted, typed, and cheap to change.
//
// ★ EVERY SETTING HERE IS A UNIFORM, NEVER A MATERIAL SWITCH. Changing look by swapping in a second
// material would build a second shader program, and one program per style is the same shape as the
// per-object material that got this page BLOCKED from WebGL today. Both shading paths are compiled
// into ONE program and selected by a uniform, so toggling is instant and allocates nothing.
//
// Host-side by design (localStorage), so it lives outside `voxel/` — the pure core has no opinion
// about how the world is drawn.

export type RenderStyle = 'natural' | 'cartoon'

export interface VoxelSettings {
  style: RenderStyle
  /** 0..1 — how hard the lighting is banded. 0 is a smooth ramp, 1 is fully stepped. */
  toon: number
  /** 0..1 — dark line at block boundaries. Derived in-shader from world position, no extra pass. */
  outline: number
  /** 0..1 — fixed brightness per face direction (top bright, sides mid, bottom dark). */
  faceShading: number
  /** 0..1 — lifts shadows off black and tints them, which is what stops caves reading as murk. */
  shadowLift: number
  /** Tile size for the texture array. Ruled 64 by Alex 2026-08-06. */
  tileSize: 32 | 64
}

/**
 * ★ THE CARTOON PRESET IS A STARTING POINT, NOT A LOOK CALL. Look is Alex's; these are the values
 * that make the levers visible enough to judge. Every one is exposed in the settings panel so the
 * judgement can be made by moving sliders on the real world rather than by reading a description.
 */
export const PRESETS: Record<RenderStyle, Omit<VoxelSettings, 'style' | 'tileSize'>> = {
  natural: { toon: 0, outline: 0, faceShading: 0.35, shadowLift: 0.15 },
  cartoon: { toon: 0.85, outline: 0.6, faceShading: 0.9, shadowLift: 0.5 },
}

export const DEFAULT_SETTINGS: VoxelSettings = {
  style: 'cartoon',
  ...PRESETS.cartoon,
  // Ruled 2026-08-06 (Alex): 64 over the spike's 32 recommendation. Texel parity holds to ~11
  // blocks rather than ~22, and a tile is 4x the pixels to hand-paint. Look is his call.
  tileSize: 64,
}

const KEY = 'shimmer.voxel.settings.v1'

export function loadSettings(): VoxelSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    // Merge over defaults rather than trusting the stored shape — a setting added later must not
    // arrive as undefined and silently become 0 in a uniform.
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: VoxelSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: run unpersisted */ }
}

/** Apply a style preset without discarding the settings that are not part of the preset. */
export const withStyle = (s: VoxelSettings, style: RenderStyle): VoxelSettings =>
  ({ ...s, style, ...PRESETS[style] })
