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
  /**
   * Load/view ring radius in COLUMNS (16 blocks each). 6 = the shipped baseline (96 blocks, which
   * is also where the Hollows' despawn line sits — it derives from this now). Cost scales with the
   * SQUARE of this number: columns to generate, meshes to draw, light fields to cache. The slider's
   * bounds are the tested-sane range, not a suggestion — see the World section of SettingsPanel.
   */
  viewRadius: number
}

export const VIEW_RADIUS_MIN = 4
export const VIEW_RADIUS_MAX = 12

/**
 * ★ THE CARTOON PRESET IS A STARTING POINT, NOT A LOOK CALL. Look is Alex's; these are the values
 * that make the levers visible enough to judge. Every one is exposed in the settings panel so the
 * judgement can be made by moving sliders on the real world rather than by reading a description.
 */
export const PRESETS: Record<RenderStyle, Omit<VoxelSettings, 'style' | 'tileSize' | 'viewRadius'>> = {
  natural: { toon: 0, outline: 0, faceShading: 0.35, shadowLift: 0.15 },
  cartoon: { toon: 0.85, outline: 0.6, faceShading: 0.9, shadowLift: 0.5 },
}

export const DEFAULT_SETTINGS: VoxelSettings = {
  style: 'cartoon',
  ...PRESETS.cartoon,
  // Ruled 2026-08-06 (Alex): 64 over the spike's 32 recommendation. Texel parity holds to ~11
  // blocks rather than ~22, and a tile is 4x the pixels to hand-paint. Look is his call.
  tileSize: 64,
  viewRadius: 6,
}

const KEY = 'shimmer.voxel.settings.v1'

export function loadSettings(): VoxelSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    // Merge over defaults rather than trusting the stored shape — a setting added later must not
    // arrive as undefined and silently become 0 in a uniform.
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    // viewRadius drives loop bounds and eviction, not a uniform — a stored garbage value here is
    // an infinite want-ring, so it clamps on the way in rather than trusting the merge.
    s.viewRadius = Math.max(VIEW_RADIUS_MIN, Math.min(VIEW_RADIUS_MAX, Math.round(Number(s.viewRadius) || DEFAULT_SETTINGS.viewRadius)))
    return s
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
