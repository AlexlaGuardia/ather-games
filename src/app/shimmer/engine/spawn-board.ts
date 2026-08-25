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

/**
 * The Home Plot never re-deals — but not because it is protected. It is the opposite.
 *
 * The first cut exempted it as "always full", reasoning that canon seeds the START circle with a
 * specific pond and crystal pair and a starter should not watch their own garden empty out. Alex
 * reversed it, and the reversal is right: a home plot that refills itself is a farm you never have
 * to leave, which quietly defeats a world that re-deals at all. So the plot keeps its canon starter
 * nodes when you arrive and **you strip them permanently** — see `strippedKeys`. Canon says what is
 * standing there at START, not that it grows back.
 *
 * The line this draws is the useful part: HOME is where you grow things (planting soil is exempt
 * below and crops are yours), WILD is where you gather them.
 */
const STATIC_ZONES = new Set<string>(['garden'])

/** Planting targets never re-deal — a soil plot vanishing under a growing crop would destroy state
 *  the player put there by hand. The board deals what you FIND, never what you PLANTED. */
const STATIC_TYPES = new Set<NodeType>(['ather_soil'])

// ── What fills a slot ───────────────────────────────────────────────────────
// Alex, 2026-07-30: "what if each spawn is a category — a prospecting spawner has 40% chance for a
// common, 20% uncommon, 15% rare, 5% epic, leaving 20% to not spawn."
//
// The first cut bound a TIER to a location forever: that clearing is a goldwood, and the only
// question each window was whether it was up. This rolls what fills it instead, so the same clearing
// is a goldwood this window and something better the next — which turns a re-deal from a change in
// the count into a reason to walk back out and look.
//
// ★ THE BAND IS PER ZONE, AND IT IS INFERRED FROM WHAT THE ZONE AUTHORS.
// A single global rarity table would let the starter garden roll an epic, and a level-1 player
// standing in front of an ather crystal they cannot touch is the exact failure the entry-tier
// guarantee exists to prevent — seeing the resource you are locked out of reads as a bug, not as
// luck. So a slot rolls only among the tiers its own zone actually authored for that skill. Two
// things fall out: progression stays geographic (a zone can never out-roll its own authoring), and
// there is no second table to drift from the placements — the map editor stays the one control
// surface. Want rares in a zone? Author one there, and the band widens.
//
// Weights apply to the zone's band from the bottom up, so rarity is RELATIVE to where you stand:
// the Threshold's "common" is an element crystal, the garden's is a goldwood.
export const TIER_WEIGHTS = [40, 20, 15, 5]   // common · uncommon · rare · epic
export const NOTHING_WEIGHT = 20              // ...and the chance the slot simply stays empty this window

/** A location that came up in this window, with how it relates to the windows either side. */
export interface DealtNode extends NodePlacement {
  /** Zone-local slot identity (`slotKey`), carried through the world remap so persistence — the
   *  Home Plot strip set — never keys on a coordinate the layout is free to move. */
  key: string
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
 * `?fadetest=1` — drives every node through the leaving/arriving curve on a short loop, so the
 * dissolve can be judged in seconds instead of by standing in a clearing at the right minute.
 * Same reasoning as `?hour=`: a look that takes 32 minutes to come around does not get looked at.
 * Purely a render-side override — the board itself is untouched, so nothing about what exists in
 * the world changes while it is on.
 */
export const FADE_TEST_MS = 12_000
export const isFadeTest: boolean = (() => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('fadetest') === '1'
})()

/** The sawtooth `?fadetest=1` runs on: a slow dim to nothing, then a snap back to full. */
export function fadeTestAlpha(nowMs: number = Date.now()): number {
  return 1 - ((nowMs % FADE_TEST_MS) / FADE_TEST_MS)
}

/**
 * Which deal window we are in, and when it opened/closes.
 *
 * ★ When `?hour=` pins the sky, the board pins with it. `day-cycle` promises that every consumer of
 * the clock inherits the pin, and a frozen world whose resources kept re-dealing on wall time would
 * break exactly that promise during the art pass it exists for. A pinned hour is a still frame, so
 * it gets one board — use `?window=` to step the deal.
 */
/**
 * ★ The pin fixes WHICH board is dealt, not WHEN we are — split out so the oracle can reach it.
 *
 * The first cut returned the pinned window's own start/end, which put those timestamps decades in
 * the past, and everything that measures position INSIDE a window read off them: the HUD counted
 * down from a boundary long gone and sat on RENEWING forever, and every leaving node computed a
 * negative remainder and rendered at alpha 0 — invisible, in the one mode built for looking at
 * them. Only the browser showed it, because outside one there is no pin to take. Hence this seam.
 */
export function windowAt(nowMs: number, pin: number | null): DealWindow {
  const live = Math.floor(nowMs / WINDOW_MS)
  const index = pin ?? live
  return { index, startMs: live * WINDOW_MS, endMs: (live + 1) * WINDOW_MS }
}

export function currentWindow(nowMs: number = Date.now()): DealWindow {
  if (pinnedWindow !== null) return windowAt(nowMs, pinnedWindow)
  if (isTimePinned()) {
    // The pinned hour's own window, held still: floor(progress * RESETS_PER_DAY) is which half of
    // the frozen day we are standing in.
    const idx = Math.floor(dayProgress(nowMs) * RESETS_PER_DAY)
    // ★ Delegate to windowAt so start/end are WALL-CLOCK relative, not epoch-anchored. Returning
    // idx*WINDOW_MS put the boundary decades in the past (idx is 0 or 1), so every leaving node
    // computed a negative remainder and rendered at alpha 0 — invisible, in the exact `?hour=` mode
    // built for looking at them. Same bug windowAt was carved out to fix for the pinnedWindow path;
    // this branch was never updated with it. (Fixed 2026-08-25.)
    return windowAt(nowMs, idx)
  }
  const index = Math.floor(nowMs / WINDOW_MS)
  return { index, startMs: index * WINDOW_MS, endMs: (index + 1) * WINDOW_MS }
}

/**
 * The tiers a zone authored for one skill, lowest first. This IS the zone's rarity band — see the
 * note on TIER_WEIGHTS. Derived from the placements every time rather than cached, because the
 * editor can rewrite them live and a stale band would deal nodes the zone no longer contains.
 */
function bandFor(placements: NodePlacement[], skill: SkillId): NodeType[] {
  const tiers = new Map<NodeType, number>()
  for (const p of placements) {
    if (NODE_DEFS[p.type].skill !== skill) continue
    tiers.set(p.type, NODE_DEFS[p.type].minLevel)
  }
  return [...tiers.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).map(([t]) => t)
}

// ── Per-map spawn dials (the world pivot: "each map can have its own spawn rate") ───────
// Lives in each region file's `spawn` block; absent/empty = exactly today's behavior.
//   abundance — LITERAL fill share per slot per window (0.05–1). The legacy fill secretly
//               varies with band size (one-tier zone: 40/(40+20)=67%; full band: 80%); when
//               this dial is set the engine solves the nothing-weight per band so the number
//               you dialed is the number you get, regardless of what the zone authors.
//   richness  — geometric tier tilt (0.25–4): weight[i] × richness^i. >1 favors rare tiers,
//               <1 keeps a starter map humble. The entry-tier guarantee is untouched.
//   resets    — re-deals per day for THIS map (1|2|4|8, all divide the 64-min day cleanly:
//               64/32/16/8 real minutes). Burrows stay on the global clock on purpose —
//               patrol pressure should not speed up because berries do.
export interface ZoneSpawnConfig { abundance?: number; richness?: number; resets?: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The tilted weights + nothing-weight a config produces for a band. ONE source of truth —
 *  the editor's band readout imports this, so the display can never drift from the roll. */
export function bandWeights(band: NodeType[], cfg?: ZoneSpawnConfig): { weights: number[]; nothing: number } {
  const r = clamp(cfg?.richness ?? 1, 0.25, 4)
  const weights = band.map((_, i) => TIER_WEIGHTS[Math.min(i, TIER_WEIGHTS.length - 1)] * Math.pow(r, i))
  const W = weights.reduce((a, b) => a + b, 0)
  const nothing = cfg?.abundance !== undefined
    ? W * (1 - clamp(cfg.abundance, 0.05, 1)) / clamp(cfg.abundance, 0.05, 1)
    : NOTHING_WEIGHT
  return { weights, nothing }
}

/** The share of windows a slot of this band comes up filled under a config. */
export function bandFill(band: NodeType[], cfg?: ZoneSpawnConfig): number {
  const { weights, nothing } = bandWeights(band, cfg)
  const W = weights.reduce((a, b) => a + b, 0)
  return W / (W + nothing)
}

/** Re-deals per day for a zone under a config (validated; default = the global cadence). */
export function zoneResets(cfg?: ZoneSpawnConfig): number {
  return cfg?.resets !== undefined && [1, 2, 4, 8].includes(cfg.resets) ? cfg.resets : RESETS_PER_DAY
}

/** This zone's deal window NOW — currentWindow generalized to a per-map cadence. A zone on
 *  the default cadence gets byte-identical windows to currentWindow, pins included. */
export function zoneWindow(nowMs: number, cfg?: ZoneSpawnConfig): DealWindow {
  const wm = CYCLE_MS / zoneResets(cfg)
  if (pinnedWindow !== null) {
    const live = Math.floor(nowMs / wm)
    return { index: pinnedWindow, startMs: live * wm, endMs: (live + 1) * wm }
  }
  if (isTimePinned()) {
    const idx = Math.floor(dayProgress(nowMs) * zoneResets(cfg))
    return { index: idx, startMs: idx * wm, endMs: (idx + 1) * wm }
  }
  const index = Math.floor(nowMs / wm)
  return { index, startMs: index * wm, endMs: (index + 1) * wm }
}

/** Real ms until this zone's next re-deal. */
export function msUntilZoneReset(nowMs: number, cfg?: ZoneSpawnConfig): number {
  return zoneWindow(nowMs, cfg).endMs - nowMs
}

/** Roll one slot: which tier from the band fills it, or null for "nothing this window". */
function rollSlot(band: NodeType[], roll: number, cfg?: ZoneSpawnConfig): NodeType | null {
  const { weights, nothing } = bandWeights(band, cfg)
  const total = weights.reduce((a, b) => a + b, 0) + nothing
  let acc = roll * total
  for (let i = 0; i < band.length; i++) {
    acc -= weights[i]
    if (acc < 0) return band[i]
  }
  return null
}

/** The raw roll for one window — no neighbour comparison, no guarantee pass. Internal. */
function rawDeal(zoneId: string, placements: NodePlacement[], windowIndex: number, seed: number, cfg?: ZoneSpawnConfig): NodePlacement[] {
  // The Home Plot does not re-deal at all: what is standing there is what you have not stripped yet.
  if (STATIC_ZONES.has(zoneId)) return placements.map(p => ({ ...p }))
  const out: NodePlacement[] = []
  for (const p of placements) {
    if (STATIC_TYPES.has(p.type)) { out.push({ ...p }); continue }
    const filled = rollSlot(bandFor(placements, NODE_DEFS[p.type].skill), hash01(rollKey(seed, windowIndex, zoneId, p)), cfg)
    // The slot keeps its authored identity (tile + skill); only WHAT grew there this window changes.
    if (filled) out.push({ ...p, type: filled })
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
  const out = [...dealt]

  for (const skill of new Set(placements.map(skillOf))) {
    const entryType = bandFor(placements, skill)[0]
    if (!entryType || dealt.some(p => p.type === entryType)) continue

    // Any slot of that skill can hold the entry tier now, so the guarantee picks a SLOT and fills
    // it with the entry type — rather than resurrecting one specific authored placement, which
    // under a tier roll would have pinned the same tile every time the zone came up short.
    const slots = placements.filter(p => skillOf(p) === skill)
    let best = slots[0], bestRoll = -1
    for (const p of slots) {
      const r = hash01(`guarantee|${rollKey(seed, windowIndex, zoneId, p)}`)
      if (r > bestRoll) { bestRoll = r; best = p }
    }
    // ★ best's slot may ALREADY carry a node this window — rawDeal can have filled it with a higher
    // tier. Pushing unconditionally stacked a SECOND node on the same tile (two overlapping nodes
    // sharing one slotKey, ~1 deal in 4 for a 2-slot 2-tier zone). Override the tile instead, which
    // also gives the nicer outcome: the entry node here, the higher node on the OTHER slot.
    // (Fixed 2026-08-25.)
    const bi = out.findIndex(p => p.tileX === best.tileX && p.tileY === best.tileY)
    if (bi >= 0) out[bi] = { ...best, type: entryType }
    else out.push({ ...best, type: entryType })
  }
  return out
}

/** Every slot that could carry a skill's entry tier — the set the guarantee draws from. Exported so
 *  the oracle can tell a legitimately-always-standing entry node from a roll that is stuck. */
export function entrySlots(placements: NodePlacement[], skill: SkillId): NodePlacement[] {
  return placements.filter(p => NODE_DEFS[p.type].skill === skill)
}

/** The tiers a zone can deal for a skill, lowest first. Exported for the oracle's ceiling assert. */
export function zoneBand(placements: NodePlacement[], skill: SkillId): NodeType[] {
  return bandFor(placements, skill)
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
  strippedKeys?: ReadonlySet<string>, cfg?: ZoneSpawnConfig,
): DealtNode[] {
  // Zone-qualified, so a strip in the Home Plot can never take out a wild slot that happens to sit
  // at the same skill and tile — in world mode every zone is dealt against the same strip set.
  const live = strippedKeys?.size
    ? placements.filter(p => !strippedKeys.has(slotKey(zoneId, p)))
    : placements
  const now = rawDeal(zoneId, live, windowIndex, seed, cfg)
  const prev = new Set(rawDeal(zoneId, live, windowIndex - 1, seed, cfg).map(tileKey))
  const next = new Set(rawDeal(zoneId, live, windowIndex + 1, seed, cfg).map(tileKey))
  return now.map(p => ({
    ...p,
    key: slotKey(zoneId, p),
    leaving: !next.has(tileKey(p)),
    arriving: !prev.has(tileKey(p)),
  }))
}

/**
 * What is standing here, this window. TYPE is part of it on purpose: when a slot rolls a different
 * tier than it held last window, the old node genuinely leaves (dimming out over its three minutes)
 * and the new one rises in its place. Keying on the tile alone would have popped a goldwood into a
 * shimmeroak at the boundary with no transition at all.
 */
export const tileKey = (p: NodePlacement) => `${p.type}@${p.tileX},${p.tileY}`

/**
 * WHERE a slot is, independent of what grew in it — the durable identity, and the one the Home
 * Plot's strip set is keyed on. It has to survive both a re-roll (which changes the type) and a
 * layout nudge in the editor (which is why the board deals in logical space before the world remap;
 * a world-coord key would orphan every strip the moment a district moved a tile).
 */
export const slotKey = (zoneId: string, p: NodePlacement) => `${zoneId}|${NODE_DEFS[p.type].skill}@${p.tileX},${p.tileY}`

/**
 * How present a node is, 0..1 — drives its render. 1 for anything standing normally.
 * Arriving nodes rise over GROW_IN_MS; leaving nodes go out over the window's last FADE_OUT_MS.
 * A node that is neither is 1 for the whole window and never touches the fade path at all.
 */
// Takes the two tags rather than a whole DealtNode: the renderer holds ResourceNodes (which carry
// the tags but not the board's slot identity), and widening a cast to force them together would
// have been a lie about what this function actually reads.
export function nodeAlpha(node: { leaving?: boolean; arriving?: boolean }, nowMs: number, win: DealWindow = currentWindow(nowMs)): number {
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
