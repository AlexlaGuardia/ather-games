// The spawn board — which resources are standing in the world RIGHT NOW.
//
// Alex, 2026-07-30: "resources and moglins both work more like spawners than like fixed placements.
// Each area gets authored spawn LOCATIONS, each location has a chance to spawn, and every so often
// the world resets — cleans the map and places a new set. Resources fade out over their last ~3
// minutes so the despawn is telegraphed."
//
// ── The one decision everything else rests on: the board is DERIVED, never stored ──
// A board is a pure function of (worldSeed, windowIndex, the authored locations). Nothing is rolled
// at spawn time and nothing is persisted. Four things fall out of that, and each one is a bug we
// would otherwise have to fix later:
//   • the world re-deals while the tab is closed — you come back to a different clearing, as you should
//   • two people standing in the same field see the SAME board, with nothing synced between them
//   • no save migration, no drift, nothing to reconcile when a placement moves in the editor
//   • an art/feel pass can look at any window instantly (`?window=`) instead of waiting out the clock
// `Math.random()` at spawn time would have forked the world per client and killed the multiplayer
// layer before it was written. This is the same trade `day-cycle.ts` makes, for the same reason.
//
// ── Locations are the AUTHORED placements, not a new layer ──
// `world/node-placements.ts` is already Alex's hand-placed set, tuned in the map editor for tiles you
// can actually stand on and reach. Rather than invent a second authoring surface, every authored
// placement becomes a *possibility*: the editor keeps working exactly as it does, and the board
// breathes over the top of it. A location is a maybe, so two visits to the same clearing differ.
//
// ── Keys are LOGICAL (zone-local), never world coords ──
// In world mode the continent remaps every zone into one coordinate space. Keying the deal on world
// coords would re-shuffle the entire board the moment a district shifts by a tile. Same reasoning as
// the moglin spawner cooldown keys: deal in logical space, remap afterwards.

import { CYCLE_MS, dayProgress, isTimePinned } from './day-cycle'
import { NODE_DEFS, type NodeType } from '../world/resources'
import type { NodePlacement } from '../world/node-placements'
import type { SkillId } from './skills'

/** How many times a day the world re-deals. 2 → midnight and noon, the two moments `day-cycle`
 *  puts on exact progress 0.0 and 0.5. With a 64-minute day that is a fresh board every 32 real
 *  minutes. Alex's phrasing was "every hour of live game time" — a game hour is 2.7 real minutes,
 *  which re-deals the world under your feet mid-harvest, so this reads it as the boundaries the
 *  clock was actually built to land on. THE pacing dial for this feature. */
export const RESETS_PER_DAY = 2

/** One deal window, in real milliseconds. */
export const WINDOW_MS = CYCLE_MS / RESETS_PER_DAY

/** How long a doomed node spends visibly leaving. Telegraphed, per Alex — a node that is about to
 *  go dim first, so you never walk up to a clearing that empties in your face. */
export const FADE_OUT_MS = 3 * 60_000

/** How long a new node takes to rise in at a boundary. Short: arriving is a moment, leaving is a
 *  warning, and they should not read as the same event played backwards. */
export const GROW_IN_MS = 2_500

/** Fixed, not per-save. The garden is shared: the board is the same for everyone, like the hour. */
export const WORLD_SEED = 0x5EEDFA11

/** The Home Plot never re-deals. It is the plot you tend — canon seeds it with a specific pond and
 *  crystal pair (`shimmer-skilling.md`, START home circle) and a starter watching their own garden
 *  empty out is the opposite of what the zone is for. Wild ground breathes; home stays put. */
const STATIC_ZONES = new Set<string>(['garden'])

/** Planting targets never re-deal — a soil plot vanishing under a growing crop would destroy state
 *  the player put there by hand. The board deals what you FIND, never what you PLANTED. */
const STATIC_TYPES = new Set<NodeType>(['ather_soil'])

/** Chance a given location is dealt in. Higher tiers are scarcer on purpose: the common wood and
 *  shards are nearly always up so a route still reads as a route, while an ather crystal being
 *  standing this window is a find. These are feel dials — expect them to move after Alex plays it. */
const DEFAULT_SPAWN_CHANCE = 0.65
const SPAWN_CHANCE: Partial<Record<NodeType, number>> = {
  goldwood: 0.85, raw_mana_node: 0.85, small_pond: 0.8,
  shimmeroak: 0.7, element_crystal_node: 0.7, stream: 0.7,
  starwillow: 0.55, pure_core_node: 0.55, lake: 0.6,
  dawnwood: 0.4, ather_crystal_node: 0.4,
}

/** A location that came up in this window, with how it relates to the windows either side. */
export interface DealtNode extends NodePlacement {
  /** dealt now, NOT dealt next window → spends its last FADE_OUT_MS going out. */
  leaving: boolean
  /** dealt now, NOT dealt last window → rises in over GROW_IN_MS at the boundary. */
  arriving: boolean
}

export interface DealWindow {
  index: number
  startMs: number
  endMs: number
}

// ── the roll ────────────────────────────────────────────────────────────────
// FNV-1a over the key, then a murmur3 finalizer for avalanche. A plain FNV without the finalizer
// leaves neighbouring tiles correlated, which shows up in-world as whole rows of nodes appearing
// and vanishing together. The oracle checks distribution and independence, not just determinism.
function hash01(key: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15; h = Math.imul(h, 2246822507)
  h ^= h >>> 13; h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const rollKey = (seed: number, window: number, zoneId: string, p: NodePlacement) =>
  `${seed}|${window}|${zoneId}|${p.type}|${p.tileX},${p.tileY}`

// ── dev override ────────────────────────────────────────────────────────────
// `?window=7` pins the board the way `?hour=` pins the sky. Without it, looking at a re-deal means
// waiting up to 32 minutes for one, which makes the fade impossible to judge. Read once at module
// load, never written, so it cannot leak into normal play.
const pinnedWindow: number | null = (() => {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('window')
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? Math.floor(n) : null
})()

export const isBoardPinned = pinnedWindow !== null

/**
 * Which deal window we are in, and when it opened/closes.
 *
 * ★ When `?hour=` pins the sky, the board pins with it. `day-cycle` promises that every consumer of
 * the clock inherits the pin, and a frozen world whose resources kept re-dealing on wall time would
 * break exactly that promise during the art pass it exists for. A pinned hour is a still frame, so
 * it gets one board — use `?window=` to step the deal.
 */
export function currentWindow(nowMs: number = Date.now()): DealWindow {
  if (pinnedWindow !== null) {
    return { index: pinnedWindow, startMs: pinnedWindow * WINDOW_MS, endMs: (pinnedWindow + 1) * WINDOW_MS }
  }
  if (isTimePinned) {
    // The pinned hour's own window, held still: floor(progress * RESETS_PER_DAY) is which half of
    // the frozen day we are standing in.
    const idx = Math.floor(dayProgress(nowMs) * RESETS_PER_DAY)
    return { index: idx, startMs: idx * WINDOW_MS, endMs: (idx + 1) * WINDOW_MS }
  }
  const index = Math.floor(nowMs / WINDOW_MS)
  return { index, startMs: index * WINDOW_MS, endMs: (index + 1) * WINDOW_MS }
}

/** The raw roll for one window — no neighbour comparison, no guarantee pass. Internal. */
function rawDeal(zoneId: string, placements: NodePlacement[], windowIndex: number, seed: number): NodePlacement[] {
  if (STATIC_ZONES.has(zoneId)) return placements.map(p => ({ ...p }))
  const out: NodePlacement[] = []
  for (const p of placements) {
    if (STATIC_TYPES.has(p.type)) { out.push({ ...p }); continue }
    const chance = SPAWN_CHANCE[p.type] ?? DEFAULT_SPAWN_CHANCE
    if (hash01(rollKey(seed, windowIndex, zoneId, p)) < chance) out.push({ ...p })
  }
  return withEntryGuarantee(zoneId, placements, out, windowIndex, seed)
}

/**
 * ★ A zone must never stop serving a skill AT THE LEVEL IT AUTHORED IT FOR.
 *
 * The first cut of this guaranteed a skill was *present* — if a zone authored fishing and the roll
 * dropped every pond, one pond came back. The oracle found the hole a level down, 193 times in 300
 * windows: Mycelial Path deals a shimmeroak (level 4) and no goldwood (level 1), so forestry is
 * "present" and the guarantee never fires, while a level-1 player standing in a visible grove has
 * nothing they can actually chop. A guarantee you cannot cash is not a guarantee. Being able to SEE
 * the resource you are locked out of is worse than the zone being empty — it reads as a bug.
 *
 * So the floor is the zone's ENTRY tier per skill: whatever the lowest authored level for that
 * skill is, one of those is always standing. Everything above it breathes freely, which is where
 * the interest lives anyway — whether the ather crystal is up this window is a reason to go look.
 *
 * Which entry node comes back is broken by hash, so a zone with several rotates instead of wearing
 * a path to the same tree. A zone with exactly one entry node keeps that one every window, by
 * necessity — that is the guarantee doing its job, not a stuck roll.
 */
function withEntryGuarantee(
  zoneId: string, placements: NodePlacement[], dealt: NodePlacement[], windowIndex: number, seed: number,
): NodePlacement[] {
  const skillOf = (p: NodePlacement): SkillId => NODE_DEFS[p.type].skill
  const levelOf = (p: NodePlacement) => NODE_DEFS[p.type].minLevel
  const out = [...dealt]

  for (const skill of new Set(placements.map(skillOf))) {
    const candidates = placements.filter(p => skillOf(p) === skill)
    const entryLevel = Math.min(...candidates.map(levelOf))
    if (dealt.some(p => skillOf(p) === skill && levelOf(p) === entryLevel)) continue

    const entry = candidates.filter(p => levelOf(p) === entryLevel)
    let best = entry[0], bestRoll = -1
    for (const p of entry) {
      const r = hash01(`guarantee|${rollKey(seed, windowIndex, zoneId, p)}`)
      if (r > bestRoll) { bestRoll = r; best = p }
    }
    out.push({ ...best })
  }
  return out
}

/** The zone's entry-tier locations for each skill — the set the guarantee draws from. Exported so
 *  the oracle can tell a legitimately-always-standing entry node from a roll that is stuck. */
export function entryLocations(placements: NodePlacement[]): NodePlacement[] {
  const skillOf = (p: NodePlacement): SkillId => NODE_DEFS[p.type].skill
  const levelOf = (p: NodePlacement) => NODE_DEFS[p.type].minLevel
  const out: NodePlacement[] = []
  for (const skill of new Set(placements.map(skillOf))) {
    const candidates = placements.filter(p => skillOf(p) === skill)
    const entryLevel = Math.min(...candidates.map(levelOf))
    out.push(...candidates.filter(p => levelOf(p) === entryLevel))
  }
  return out
}

/**
 * The board for one zone in one window, tagged with what is arriving and what is leaving.
 *
 * Arriving/leaving are read off the neighbouring deals rather than remembered, which is what makes
 * a node that survives a boundary sit perfectly still: it is in both deals, so it is neither. A
 * remembered flag would have made every node flicker at every reset.
 */
export function dealZone(
  zoneId: string, placements: NodePlacement[], windowIndex: number, seed: number = WORLD_SEED,
): DealtNode[] {
  const now = rawDeal(zoneId, placements, windowIndex, seed)
  const prev = new Set(rawDeal(zoneId, placements, windowIndex - 1, seed).map(tileKey))
  const next = new Set(rawDeal(zoneId, placements, windowIndex + 1, seed).map(tileKey))
  return now.map(p => ({
    ...p,
    leaving: !next.has(tileKey(p)),
    arriving: !prev.has(tileKey(p)),
  }))
}

/** Identity of a location within its zone. Type is part of it: two node types authored on one tile
 *  are two different possibilities, not one. */
export const tileKey = (p: NodePlacement) => `${p.type}@${p.tileX},${p.tileY}`

/**
 * How present a node is, 0..1 — drives its render. 1 for anything standing normally.
 * Arriving nodes rise over GROW_IN_MS; leaving nodes go out over the window's last FADE_OUT_MS.
 * A node that is neither is 1 for the whole window and never touches the fade path at all.
 */
export function nodeAlpha(node: DealtNode, nowMs: number, win: DealWindow = currentWindow(nowMs)): number {
  if (node.arriving) {
    const since = nowMs - win.startMs
    if (since < GROW_IN_MS) return clamp01(since / GROW_IN_MS)
  }
  if (node.leaving) {
    const left = win.endMs - nowMs
    if (left < FADE_OUT_MS) return clamp01(left / FADE_OUT_MS)
  }
  return 1
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Real ms until the next re-deal — for the HUD, so a fade is legible as "the world is about to
 *  turn over" rather than "that tree is glitching". */
export function msUntilReset(nowMs: number = Date.now()): number {
  return currentWindow(nowMs).endMs - nowMs
}
