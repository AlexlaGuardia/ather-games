// Zone system — connected map sections with warp transitions
// Each zone is its own tilemap grid with named warps linking zones together

export interface Warp {
  fromX: number       // tile position in this zone
  fromY: number
  toZone: string      // target zone id
  toX: number         // tile to place player in target zone
  toY: number
  direction?: 'up' | 'down' | 'left' | 'right' // player faces this direction on arrival
  requiredFlag?: string // warp only works when this flag is set (e.g., 'tutorialComplete')
  ownerOnly?: boolean // dev/test gate — only fires for the site owner (onWarp gates it), invisible to players
  gate?: string       // set by expandGate: the label of the Gate this warp was derived from
}

/**
 * A GATE — a named, multi-tile door (2026-08-05).
 *
 * A `Warp` is one tile. Everything real is wider than one tile, so a door has always been
 * "some warps that happen to sit next to each other" — a convention held together by whoever
 * edited them last. That cost us: the pair could drift apart, half a door could keep an
 * `ownerOnly` the other half lost, and the 3D world drew one green EXIT pillar PER TILE, so a
 * two-tile door rendered as two identical signs shouting the same word.
 *
 * A Gate is the door itself: one anchor, one footprint, ONE name. It expands into `size*size`
 * warps at module load (`expandGate`), so every consumer downstream — `checkWarp`, `performWarp`,
 * the editors, the oracle — keeps working on warps and knows nothing about this. The gate is the
 * authoring unit; warps stay the runtime unit.
 *
 * `label` is what the player reads over the door, and it is DATA on purpose: a name is the part
 * most likely to be canon-sensitive, and a name in a data field is a one-line edit rather than a
 * hunt through render code.
 */
export interface Gate {
  x: number           // top-left tile of the footprint
  y: number
  size?: number       // footprint is size x size. Default 2 — the standard 2x2 door.
  toZone: string
  toX: number         // where you land. MUST NOT be inside another gate's footprint, or you
  toY: number         // bounce straight back — see the oracle's instant-re-warp check.
  label: string       // the big nametag over the door
  direction?: 'up' | 'down' | 'left' | 'right'
  requiredFlag?: string
  ownerOnly?: boolean
}

/** Expand a gate into the warps its footprint covers. One gate in, size² warps out. */
export function expandGate(g: Gate): Warp[] {
  const size = g.size ?? 2
  const out: Warp[] = []
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      out.push({
        fromX: g.x + dx, fromY: g.y + dy,
        // Every tile of the door lands you on the SAME square. Offsetting the landing per tile
        // (the obvious-looking alternative) would make which corner you touched decide where you
        // come out, and one of those corners is usually a wall on the far side.
        toZone: g.toZone, toX: g.toX, toY: g.toY,
        direction: g.direction,
        requiredFlag: g.requiredFlag,
        ownerOnly: g.ownerOnly,
        gate: g.label,
      })
    }
  }
  return out
}

// Elemental theme of a zone — drives spirit-condensation affinity (see SPIRIT_CONDENSE.md).
// Leveling a spirit in a zone feeds that zone's element into its affinity vector.
export type ZoneElement = 'mana' | 'water' | 'earth' | 'storm'

export interface Zone {
  id: string
  name: string
  grid: number[][]
  /**
   * Named multi-tile doors. Authored here; EXPANDED into `warps` at module load, so `warps` is
   * still the single runtime truth and nothing downstream has to learn a second concept.
   * Prefer a gate over hand-written warp pairs for anything a player is meant to see and name.
   */
  gates?: Gate[]
  warps: Warp[]
  playerStart?: { tileX: number; tileY: number } // default spawn point for this zone
  element?: ZoneElement // cultivation element (undefined = dev/throwaway zone, no affinity)
  // Which side of the Ather this zone sits on. 'ather' (default) = spirit world: spirits/turn-based
  // battles work, weapons are holstered. 'outside' = the physical world (the Crucible battle-royale
  // + its firing range): weapons work, spirits are put away. This one flag drives both combat modes.
  realm?: 'ather' | 'outside'
  /**
   * Outside-the-Ather but NOT a combat zone (a town, a station concourse).
   *
   * `realm: 'outside'` was doing two jobs at once: "the Lucernyx's aegis doesn't reach here"
   * (so spirits don't work) AND "draw your weapon" (so the firing range + gun benches mount).
   * Those came apart the moment the mortal side grew a TOWN — Rune Hold is outside the Ather,
   * so spirits stay dormant, but nobody walks into a market with a manabox drawn.
   *
   * `peaceful` splits the second job off: the realm still governs spirits/banking, this governs
   * whether the place is armed. Weapons stay holstered and the Crucible props don't mount.
   */
  peaceful?: boolean
}

// Check if player is standing on a warp tile (respects flag requirements)
export function checkWarp(zones: Zone[], currentZoneId: string, tileX: number, tileY: number, flags?: Record<string, boolean>): Warp | null {
  const zone = zones.find(z => z.id === currentZoneId)
  if (!zone) return null
  return zone.warps.find(w => {
    if (w.fromX !== tileX || w.fromY !== tileY) return false
    if (w.requiredFlag && !flags?.[w.requiredFlag]) return false
    return true
  }) ?? null
}

/**
 * Zone ids that no longer exist, and what they became.
 *
 * `spirit-corner` (2026-08-05): the shop was folded into the Rune Hold map as a storefront, per
 * `world/rune-hold.md` § The Hub. Alex authored the town outward FROM the old room, so its tiles
 * sit unmoved in the new map's north-west corner — an old (x,y) means the same square it always
 * did and only the id changes. That is why this table carries no offset: add one the day a fold
 * moves tiles, and until then a bare rename is the honest migration.
 *
 * Kept because a saved position, a bookmarked `?zone=`, or a party member's broadcast can still
 * name the dead id. Resolving it costs one lookup; NOT resolving it hands `getZone` a null and
 * strands the player on a black screen.
 */
export const LEGACY_ZONE_ALIASES: Record<string, string> = {
  'spirit-corner': 'rune-hold',
}

/** Resolve a possibly-retired zone id to the live one. Unknown ids pass through untouched. */
export function resolveZoneId(id: string): string {
  return LEGACY_ZONE_ALIASES[id] ?? id
}

// Get zone by id
export function getZone(zones: Zone[], id: string): Zone | null {
  const wanted = resolveZoneId(id)
  return zones.find(z => z.id === wanted) ?? null
}

// ---- Shimmer zones ----
// Garden (home) → west → Tutorial (Mycelial Path) → south → Moonwell Glade (Gregory's home)
// Garden → east → Moonwell Glade (shortcut, blocked until tutorialComplete)
// Moonwell Glade → east → Spore Hollow (post-tutorial)

import { GARDEN, MYCELIAL_PATH, MOONWELL_GLADE, SPORE_HOLLOW, VORANYX_DEEP, TWILIGHT_THICKET, WOODED_TRAIL, THE_THRESHOLD, MANA_SPRINGS, ROUTE_2, ROUTE_3, THE_OUTFIELDS, GLOVIEW_VILLAGE, SPIRIT_MEADOW, MOONWELL_GLADE_GREGORY_S_HOME, CRUCIBLE, RUNE_HOLD, SORREL_HOLD, BRACK_HOLD, TEST_SANDBOX,
  ROUTE_GARDEN_MYCELIAL, ROUTE_MYCELIAL_SPIRIT, ROUTE_SPIRIT_MOONWELL, ROUTE_MOONWELL_GARDEN } from './tilemap'
export const ZONES: Zone[] = [
  {
    id: 'garden',            // keep id stable (referenced widely); display = the player's own plot
    name: 'Home Plot',
    grid: GARDEN, // 32x32, redesigned in the editor by Alex
    playerStart: { tileX: 30, tileY: 9 },
    warps: [
      // ── NORTH GATE (14-15,1) → OUT of the Ather, into Rune Hold — RESTORED 2026-08-03 to its
      // original tiles, re-pointed 2026-08-05 when the Spirit Corner folded into the town.
      // This is the CANON route across: `world/rune-hold.md` has Shimmer reached "through a
      // permanent gate", and the 07-22 build note built it as Home Plot north gate ⇄ Spirit
      // Corner interior. It was relocated into Greg's owner-only test hub by 0e1e31b while the
      // crossing beyond it was an unruled canon gap — which left the whole mortal-side arc
      // reachable only by the owner. The gap RULED 2026-08-03 and the street door opened, so the
      // player-facing half has to come back or the open door leads out of a room no one can enter.
      // The test-hub gate stays as well; it is dev scaffolding and costs nothing.
      // The LANDING TILES ARE UNCHANGED (7-8,10): the Spirit Corner's old room is now the
      // shop-floor in Rune Hold's north-west corner, at the same coordinates it always had, so
      // this gate still opens onto Greg's floor — it just no longer crosses a zone boundary to
      // get there. The return side lives on `rune-hold` and targets this zone; when the player
      // crossed from the region world, performWarp migrates that landing to r-home-plot.
      // ⚠ TODO(gate-placement): these are the ORIGINAL provisional tiles, not a new call — the
      // spot is Alex's eye (2D MapEditor). The tile is NOT painted as a warp tile, so the door
      // works but shows no gold marker yet; the editor's warp brush paints it.
      //
      // ⚠ TEMPORARILY `ownerOnly` (2026-08-05) — a BUILD hold, not a canon one. The 08-03 ruling
      // opened this door and nothing has changed that. But Rune Hold's gates are being
      // repositioned and its `gates` array is empty right now, so the town has no way out: a
      // player walking through would be stuck in a place with no door. Better a door that is
      // briefly shut than a room you cannot leave. Take this off the moment Greg's gate is
      // placed — the oracle's dead-end check fails until then and passes the instant it is safe.
      { fromX: 14, fromY: 1, toZone: 'rune-hold', toX: 7, toY: 10, direction: 'up', ownerOnly: true },
      { fromX: 15, fromY: 1, toZone: 'rune-hold', toX: 8, toY: 10, direction: 'up', ownerOnly: true },
      // LEFT door (0,11-12, placed in the editor) → Route 1 (leads to Mycelial Path)
      { fromX: 0, fromY: 11, toZone: 'route-garden-mycelial', toX: 58, toY: 7, direction: 'left' }, // arrive at Route 1's E door
      { fromX: 0, fromY: 12, toZone: 'route-garden-mycelial', toX: 58, toY: 8, direction: 'left' },
      // RIGHT door (31,9-10) → Moonwell Pass (its west door interior)
      { fromX: 31, fromY: 9, toZone: 'route-moonwell-garden', toX: 1, toY: 28, direction: 'right' },
      { fromX: 31, fromY: 10, toZone: 'route-moonwell-garden', toX: 1, toY: 29, direction: 'right' },
    ],
  },
  {
    id: 'mycelial-path',
    name: 'Mycelial Path',
    element: 'earth',
    grid: MYCELIAL_PATH, // 50x30, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 1, tileY: 7 },
    warps: [
      // R door (29,14-15, placed in the editor) → Route 1 (Home Plot)
      { fromX: 29, fromY: 14, toZone: 'route-garden-mycelial', toX: 1, toY: 13, direction: 'right' }, // arrive at Route 1's W door
      { fromX: 29, fromY: 15, toZone: 'route-garden-mycelial', toX: 1, toY: 14, direction: 'right' },
      // L door (0,7-8) → Wooded Trail (its E door)
      { fromX: 0, fromY: 7, toZone: 'wooded-trail', toX: 48, toY: 11, direction: 'left' },
      { fromX: 0, fromY: 8, toZone: 'wooded-trail', toX: 48, toY: 12, direction: 'left' },
      // N door (15-16,0) → Spirit Meadows (its south-left door)
      { fromX: 15, fromY: 0, toZone: 'spirit-meadow', toX: 10, toY: 38, direction: 'up' },
      { fromX: 16, fromY: 0, toZone: 'spirit-meadow', toX: 11, toY: 38, direction: 'up' },
      // S door (8-9,49) → Voranyx Caverns 1st Floor (its N door) — closes the loop Alex flagged
      { fromX: 8, fromY: 49, toZone: 'spore-hollow', toX: 15, toY: 1, direction: 'down' },
      { fromX: 9, fromY: 49, toZone: 'spore-hollow', toX: 16, toY: 1, direction: 'down' },
    ],
  },
  {
    id: 'moonwell-glade',
    name: 'Moonwell Glade',
    element: 'water',
    grid: MOONWELL_GLADE,
    playerStart: { tileX: 1, tileY: 8 },
    warps: [
      // LEFT (rows 8-9) → Moonwell Pass (enter its east opening)
      { fromX: 0, fromY: 8, toZone: 'route-moonwell-garden', toX: 36, toY: 17, direction: 'left' },
      { fromX: 0, fromY: 9, toZone: 'route-moonwell-garden', toX: 36, toY: 18, direction: 'left' },
      // Greg's house door (cols 22-23, row 17 — placed in the editor) → his home interior.
      // Redesigned interior (30x28): door is the bottom vestibule (warp tiles 14-15,22); arrive on
      // the entry floor just above it (14-15,21), facing up into the house.
      { fromX: 22, fromY: 17, toZone: 'moonwell-glade-gregory-s-home', toX: 14, toY: 21, direction: 'up' },
      { fromX: 23, fromY: 17, toZone: 'moonwell-glade-gregory-s-home', toX: 15, toY: 21, direction: 'up' },
    ],
  },
  {
    id: 'spore-hollow',      // Voranyx Caverns — 1st Floor (id kept as spore-hollow)
    name: 'Voranyx Caverns',
    element: 'earth',
    grid: SPORE_HOLLOW, // 60x32, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 15, tileY: 1 },
    warps: [
      // N door (15-16,0) → Mycelial Path (its S door) — two-way now (Alex added the return door)
      { fromX: 15, fromY: 0, toZone: 'mycelial-path', toX: 8, toY: 48, direction: 'up' },
      { fromX: 16, fromY: 0, toZone: 'mycelial-path', toX: 9, toY: 48, direction: 'up' },
      // S door (23-24,59) → Mana Springs (its N door)
      { fromX: 23, fromY: 59, toZone: 'mana-springs', toX: 30, toY: 1, direction: 'down' },
      { fromX: 24, fromY: 59, toZone: 'mana-springs', toX: 31, toY: 1, direction: 'down' },
      // E door (31,17-18) → 2nd Floor's E door (east wall)
      { fromX: 31, fromY: 17, toZone: 'voranyx-deep', toX: 30, toY: 15, direction: 'left' },
      { fromX: 31, fromY: 18, toZone: 'voranyx-deep', toX: 30, toY: 16, direction: 'left' },
      // W door (0,49-50) → 2nd Floor's W door (west wall)
      { fromX: 0, fromY: 49, toZone: 'voranyx-deep', toX: 1, toY: 34, direction: 'right' },
      { fromX: 0, fromY: 50, toZone: 'voranyx-deep', toX: 1, toY: 35, direction: 'right' },
    ],
  },
  {
    id: 'voranyx-deep',
    name: 'Voranyx Caverns — 2nd Floor',
    element: 'earth',
    grid: VORANYX_DEEP, // 60x32, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 30, tileY: 15 },
    warps: [
      // E door (31,15-16) → 1st Floor's E door (east wall)
      { fromX: 31, fromY: 15, toZone: 'spore-hollow', toX: 30, toY: 17, direction: 'left' },
      { fromX: 31, fromY: 16, toZone: 'spore-hollow', toX: 30, toY: 18, direction: 'left' },
      // W door (0,34-35) → 1st Floor's W door (west wall)
      { fromX: 0, fromY: 34, toZone: 'spore-hollow', toX: 1, toY: 49, direction: 'right' },
      { fromX: 0, fromY: 35, toZone: 'spore-hollow', toX: 1, toY: 50, direction: 'right' },
      // S door (28-29,59) = passage to The Silt — LOCKED + unreachable by design in v1 (no warp).
    ],
  },
  // --- New zones (song-inspired, placeholder grids) ---
  {
    id: 'twilight-thicket',
    name: 'Twilight Thicket',
    element: 'earth', // future Shimmeroak Thicket (wood/forestry)
    grid: TWILIGHT_THICKET, // 100x80, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 78, tileY: 51 },
    warps: [
      // E door (79,51-52, placed in the editor) — the only door → Wooded Trail (its W door)
      { fromX: 79, fromY: 51, toZone: 'wooded-trail', toX: 1, toY: 11, direction: 'right' },
      { fromX: 79, fromY: 52, toZone: 'wooded-trail', toX: 1, toY: 12, direction: 'right' },
    ],
  },
  {
    id: 'wooded-trail',
    name: 'Wooded Trail',
    element: 'earth', // wooded/forestry pocket between Mycelial Path and Twilight Thicket
    grid: WOODED_TRAIL, // 30x50, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 48, tileY: 11 },
    warps: [
      // E door (49,11-12, placed in the editor) → Mycelial Path (its L door)
      { fromX: 49, fromY: 11, toZone: 'mycelial-path', toX: 1, toY: 7, direction: 'right' },
      { fromX: 49, fromY: 12, toZone: 'mycelial-path', toX: 1, toY: 8, direction: 'right' },
      // W door (0,11-12) → Twilight Thicket (its E door)
      { fromX: 0, fromY: 11, toZone: 'twilight-thicket', toX: 78, toY: 51, direction: 'left' },
      { fromX: 0, fromY: 12, toZone: 'twilight-thicket', toX: 78, toY: 52, direction: 'left' },
    ],
  },
  {
    id: 'the-threshold',     // retheme → Ather Winds (the sealed gate to the Wilds; seeds ride in from here)
    name: 'Ather Winds',
    element: 'storm', // frontier edge — the sealed door to the Wilds expansion
    grid: THE_THRESHOLD,
    playerStart: { tileX: 9, tileY: 1 },
    warps: [
      // North entry back to Brack Hold
      { fromX: 9, fromY: 0, toZone: 'brack-hold', toX: 19, toY: 28, direction: 'up' },
      { fromX: 10, fromY: 0, toZone: 'brack-hold', toX: 20, toY: 28, direction: 'up' },
    ],
  },
  {
    id: 'mana-springs',
    name: 'Mana Springs',
    element: 'earth', // mining / ore
    grid: MANA_SPRINGS, // 100x100, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 30, tileY: 1 },
    warps: [
      // N door (30-31,0) → Voranyx Caverns 1st Floor (its S door)
      { fromX: 30, fromY: 0, toZone: 'spore-hollow', toX: 23, toY: 58, direction: 'up' },
      { fromX: 31, fromY: 0, toZone: 'spore-hollow', toX: 24, toY: 58, direction: 'up' },
      // W door (0,76-77) → Route Two (its right opening)
      { fromX: 0, fromY: 76, toZone: 'route-2', toX: 28, toY: 13, direction: 'left' },
      { fromX: 0, fromY: 77, toZone: 'route-2', toX: 28, toY: 14, direction: 'left' },
    ],
  },
  {
    id: 'route-2',
    name: 'Route Two',
    grid: ROUTE_2,
    playerStart: { tileX: 28, tileY: 13 },
    warps: [
      // RIGHT (rows 13-14) → back to Mana Springs (its W door)
      { fromX: 29, fromY: 13, toZone: 'mana-springs', toX: 1, toY: 76, direction: 'right' },
      { fromX: 29, fromY: 14, toZone: 'mana-springs', toX: 1, toY: 77, direction: 'right' },
      // LEFT (rows 2-3) → Gloview Village (arrive at its right opening, rows 11-12)
      { fromX: 0, fromY: 2, toZone: 'gloview-village', toX: 32, toY: 11, direction: 'left' },
      { fromX: 0, fromY: 3, toZone: 'gloview-village', toX: 32, toY: 12, direction: 'left' },
    ],
  },
  {
    id: 'gloview-village',
    name: 'Gloview Village',
    grid: GLOVIEW_VILLAGE,
    playerStart: { tileX: 32, tileY: 11 },
    warps: [
      // RIGHT (rows 11-12) → back to Route 2 (its left opening, rows 2-3)
      { fromX: 33, fromY: 11, toZone: 'route-2', toX: 1, toY: 2, direction: 'right' },
      { fromX: 33, fromY: 12, toZone: 'route-2', toX: 1, toY: 3, direction: 'right' },
      // BOTTOM-LEFT (cols 2-3) → Route 3 (arrive at its north opening)
      { fromX: 2, fromY: 21, toZone: 'route-3', toX: 10, toY: 1, direction: 'down' },
      { fromX: 3, fromY: 21, toZone: 'route-3', toX: 11, toY: 1, direction: 'down' },
      // SORREL compound door (gap in the pen's left wall) → the sorrel-hold arena.
      // Ungated for now; the Thistle progression-gate gets added in the F2P gating pass.
      { fromX: 20, fromY: 6, toZone: 'sorrel-hold', toX: 1, toY: 14, direction: 'right' },
      { fromX: 20, fromY: 7, toZone: 'sorrel-hold', toX: 1, toY: 15, direction: 'right' },
    ],
  },
  {
    id: 'route-3',
    name: 'Route Three',
    grid: ROUTE_3,
    playerStart: { tileX: 10, tileY: 1 },
    warps: [
      // TOP → back up to Gloview Village (its bottom-left opening, cols 2-3)
      { fromX: 10, fromY: 0, toZone: 'gloview-village', toX: 2, toY: 20, direction: 'up' },
      { fromX: 11, fromY: 0, toZone: 'gloview-village', toX: 3, toY: 20, direction: 'up' },
      // BOTTOM-RIGHT (cols 18-19) → The Outfields (arrive at its north opening, cols 6-7)
      { fromX: 18, fromY: 27, toZone: 'the-outfields', toX: 6, toY: 1, direction: 'down' },
      { fromX: 19, fromY: 27, toZone: 'the-outfields', toX: 7, toY: 1, direction: 'down' },
    ],
  },
  {
    id: 'the-outfields',
    name: 'The Outfields',
    element: 'earth',
    grid: THE_OUTFIELDS,
    playerStart: { tileX: 6, tileY: 1 },
    warps: [
      // NORTH (cols 6-7) → back up to Route 3 (its bottom opening, cols 18-19)
      { fromX: 6, fromY: 0, toZone: 'route-3', toX: 18, toY: 26, direction: 'up' },
      { fromX: 7, fromY: 0, toZone: 'route-3', toX: 19, toY: 26, direction: 'up' },
    ],
  },
  {
    id: 'spirit-meadow',
    name: 'Spirit Meadows',
    element: 'mana',
    grid: SPIRIT_MEADOW, // 40x80, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 10, tileY: 38 },
    warps: [
      // SOUTH-LEFT door (10-11,39, placed in the editor) → Mycelial Path (its N door)
      { fromX: 10, fromY: 39, toZone: 'mycelial-path', toX: 15, toY: 1, direction: 'down' },
      { fromX: 11, fromY: 39, toZone: 'mycelial-path', toX: 16, toY: 1, direction: 'down' },
      // SOUTH-RIGHT door (69-70,39) → Moonwell Pass (its north door interior)
      { fromX: 69, fromY: 39, toZone: 'route-moonwell-garden', toX: 14, toY: 1, direction: 'down' },
      { fromX: 70, fromY: 39, toZone: 'route-moonwell-garden', toX: 15, toY: 1, direction: 'down' },
    ],
  },
  {
    id: 'sorrel-hold',
    name: 'Sorrel Hold',
    element: 'earth',
    grid: SORREL_HOLD,
    playerStart: { tileX: 2, tileY: 14 },
    warps: [
      // Return west to Gloview Village (back to the Sorrel compound door)
      { fromX: 0, fromY: 14, toZone: 'gloview-village', toX: 19, toY: 6, direction: 'left' },
      { fromX: 0, fromY: 15, toZone: 'gloview-village', toX: 19, toY: 7, direction: 'left' },
      // Forward east to Brack Hold (gated: need defeated_sorrel)
      { fromX: 39, fromY: 14, toZone: 'brack-hold', toX: 1, toY: 14, direction: 'right', requiredFlag: 'defeated_sorrel' },
      { fromX: 39, fromY: 15, toZone: 'brack-hold', toX: 1, toY: 15, direction: 'right', requiredFlag: 'defeated_sorrel' },
    ],
  },
  {
    id: 'brack-hold',
    name: 'Brack Hold',
    element: 'storm',
    grid: BRACK_HOLD,
    playerStart: { tileX: 2, tileY: 14 },
    warps: [
      // Return west to Sorrel Hold (open)
      { fromX: 0, fromY: 14, toZone: 'sorrel-hold', toX: 38, toY: 14, direction: 'left' },
      { fromX: 0, fromY: 15, toZone: 'sorrel-hold', toX: 38, toY: 15, direction: 'left' },
      // Forward south to Ather Winds (gated: need defeated_brack)
      { fromX: 19, fromY: 29, toZone: 'the-threshold', toX: 9, toY: 1, direction: 'down', requiredFlag: 'defeated_brack' },
      { fromX: 20, fromY: 29, toZone: 'the-threshold', toX: 10, toY: 1, direction: 'down', requiredFlag: 'defeated_brack' },
    ],
  },
  {
    // ── RUNE HOLD — the town, mortal side, Year 1672 ───────────────────────────────────────
    // Canon: `world/rune-hold.md` § The Hub (ruled 2026-07-12) — the town IS the front door, an
    // outdoor town whose destinations are storefronts: 🍺 Kindled Mug (the games) · ✧ Spirit
    // Corner (Greg's gate back into Shimmer) · 📖 Eyuun's Bookstore (the tales) · 🏪 The Passage
    // (the underground market, where Marks are spent) · 📌 Notice Board (news). Register = the
    // warm "became a hub" form, NOT the Year-600 occupation (that stays the novel's story).
    //
    // ── THE SPIRIT CORNER FOLDED IN (2026-08-05, Alex's map + call) ────────────────────────
    // It used to be its own 16x12 zone with a "street door" warp out to a separate Rune Hold.
    // That was an approximation of canon, and canon is plainer than the build was: the Hub table
    // rules the Spirit Corner as a STOREFRONT ON THE SQUARE — "Gregory's gate — the Ather Bubble"
    // — not a room you load into on the way. So the town is now ONE seamless 100x100 map that
    // CONTAINS the shop floor, and only the things canon calls a crossing keep a load screen:
    //   · Greg's gate (7-8,11), inside the shop → back into the Ather. Canon: "a permanent gate."
    //   · the station gate (49-50,81) → the Crucible.
    //   · [later] The Passage — the underground market. Its stairs are a crossing too.
    // Shops that are just shops (the Mug, the Bookstore, the Notice Board) are WALKED INTO on
    // this grid. No warp, no zone, no loading screen — that is the whole point of the fold.
    //
    // ★ THE OLD SPIRIT-CORNER COORDINATES SURVIVED THE FOLD. Alex authored outward from the old
    // room, so its tiles sit unmoved in this map's north-west corner and every landing that used
    // to name `spirit-corner` still lands on the same square — the gate home is still (7-8,11),
    // Greg's floor is still (7,9). That is why this is a re-point and not a re-placement, and why
    // `LEGACY_ZONE_ALIASES` can carry an old save across by swapping the id alone.
    //
    // `realm: 'outside'` because it is off the Ather (spirits dormant); `peaceful` because it is a
    // town, not an arena — see the flag's note above. Both now also cover the shop floor, which is
    // correct and is the fold's one real behaviour change: the aegis boundary is the GATE, so
    // spirits go dormant when you step into the town, not when you step out of the building.
    id: 'rune-hold',
    name: 'Rune Hold',
    grid: RUNE_HOLD,
    realm: 'outside',
    peaceful: true,
    playerStart: { tileX: 7, tileY: 9 },
    // ── THE TOWN'S DOORS ────────────────────────────────────────────────────────────────────
    // Empty ON PURPOSE (2026-08-05). Alex erased both gates' tiles in the editor to reposition
    // them, and gate DATA follows the map: a door he deleted must not keep firing just because a
    // code array still remembers it. That was the whole "it won't let me remove the old gates"
    // report — gates render from data, so the tiles went and the doors stayed.
    //
    // ⚠ WHILE THIS IS EMPTY THE TOWN HAS NO WAY OUT, which is why the Home Plot's north gate is
    // owner-gated just above (see its note). Place Greg's gate first with the editor's Gate brush
    // — it is the return leg and the canon "permanent gate" — then take that flag off. The oracle
    // fails loudly on any reachable zone with no player-usable exit, so it will tell you the
    // moment the town is safe to open again rather than leaving it to memory.
    gates: [],
    warps: [],
  },
  {
    // The Crucible (battle-royale) — OUTSIDE the Ather, so weapons work here and spirits don't.
    // We start with a firing range: open space to feel the first weapon. Reached from the station
    // gate in Rune Hold (canon: the mortal side, by ship), plus an owner-only shortcut in Greg's
    // test hub.
    id: 'crucible',
    name: 'The Crucible — Firing Range',
    grid: CRUCIBLE,
    realm: 'outside',
    playerStart: { tileX: 7, tileY: 13 },
    warps: [
      // exit → back out to Rune Hold, one tile north of the station gate so you don't re-warp.
      // Re-pointed 2026-08-05 (was Greg's living room, the pre-town parent). The owner-only
      // shortcut into here from the test hub still works; it just returns you to the town now,
      // which is where the Crucible actually hangs.
      // (single tile — the range's doorway is one tile wide at (7,14); (8,14) is wall.)
      // Lands at (49,79): one tile NORTH of the station gate's 2x2 footprint (49-50, 80-81).
      // (79, not 80 — 80 became part of the gate when it went 2x2, and landing inside a gate is
      // an instant re-warp. The oracle asserts this rather than trusting the comment.)
      { fromX: 7, fromY: 14, toZone: 'rune-hold', toX: 49, toY: 79, direction: 'up' },
    ],
  },
  {
    id: 'moonwell-glade-gregory-s-home',
    name: "Moonwell Glade (Gregory's Home)",
    element: 'water',
    grid: MOONWELL_GLADE_GREGORY_S_HOME,
    playerStart: { tileX: 14, tileY: 21 },
    warps: [
      // Exit = the bottom vestibule door tiles (14-15,22) → back out to the Glade, just south of
      // Greg's house door (22-23,17).
      { fromX: 14, fromY: 22, toZone: 'moonwell-glade', toX: 22, toY: 18, direction: 'down' },
      { fromX: 15, fromY: 22, toZone: 'moonwell-glade', toX: 23, toY: 18, direction: 'down' },
      // ── TEST HUB (owner-only, invisible to players; markers render only for the owner) ──
      // Crucible gate (left) → the practice arena; Rune Hold gate (right) → the town, landing on
      // Greg's shop floor. The Folds gate goes here later. Both are SHORTCUTS IN only — each
      // returns you through the canon route (the Crucible now exits to Rune Hold's station gate,
      // the town exits through Greg's gate to the Home Plot), which is correct: a dev door should
      // drop you into the real graph, not build a private loop back to itself.
      //
      // ✅ REACHABILITY, closed 2026-08-05 (was: this owner-only warp is the ONLY route to the
      // mortal side). The Home Plot's north gate (14-15,1) is restored and player-facing, and the
      // Spirit Corner is no longer a separate room to be stranded behind — it is the north-west
      // corner of the Rune Hold map. A player walks: Home Plot → Greg's gate → the town.
      { fromX: 10, fromY: 7, toZone: 'crucible', toX: 7, toY: 13, direction: 'up', ownerOnly: true },
      { fromX: 16, fromY: 7, toZone: 'rune-hold', toX: 7, toY: 9, direction: 'up', ownerOnly: true },
    ],
  },
  {
    id: 'test-sandbox',
    name: 'test_sandbox',
    grid: TEST_SANDBOX,
    playerStart: { tileX: 5, tileY: 5 },
    warps: [],
  },
  // --- Flat-terrain demo (throwaway) — reach via ?zone=flat-terrain-demo ---
  // --- F2P scale-test world (hub + 3 large + 4 medium) — reach via ?zone=fp-garden ---
  // --- Garden-chain route zones (baked from garden-chain.ts, 2026-06-24) ---
  // Grids + warps + spawns are now static; edit here or via Map Editor (saves stick).
  {
    id: 'route-garden-mycelial',
    name: 'Route One',     // Home Plot ↔ Mycelial Path
    grid: ROUTE_GARDEN_MYCELIAL, // 50x60, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 58, tileY: 7 },
    warps: [
      // E door (59,7-8, placed in the editor) → Home Plot (its left door)
      { fromX: 59, fromY: 7, toZone: 'garden', toX: 1, toY: 11, direction: 'right' },
      { fromX: 59, fromY: 8, toZone: 'garden', toX: 1, toY: 12, direction: 'right' },
      // W door (0,13-14) → Mycelial Path (its R door)
      { fromX: 0, fromY: 13, toZone: 'mycelial-path', toX: 28, toY: 14, direction: 'left' },
      { fromX: 0, fromY: 14, toZone: 'mycelial-path', toX: 28, toY: 15, direction: 'left' },
    ],
  },
  {
    id: 'route-mycelial-spirit',
    name: 'Mycelial Path–Spirit Meadow',
    grid: ROUTE_MYCELIAL_SPIRIT,
    playerStart: { tileX: 2, tileY: 5 },
    warps: [
      { fromX: 0, fromY: 4, toZone: 'mycelial-path', toX: 10, toY: 1, direction: 'down' }, // arrive at Mycelial NORTH
      { fromX: 0, fromY: 5, toZone: 'mycelial-path', toX: 10, toY: 1, direction: 'down' },
      { fromX: 29, fromY: 4, toZone: 'spirit-meadow', toX: 10, toY: 38, direction: 'up' }, // arrive at Spirit Meadow's south-left door
      { fromX: 29, fromY: 5, toZone: 'spirit-meadow', toX: 11, toY: 38, direction: 'up' },
    ],
  },
  {
    id: 'route-spirit-moonwell',
    name: 'Spirit Meadow–Moonwell Glade',
    grid: ROUTE_SPIRIT_MOONWELL,
    playerStart: { tileX: 2, tileY: 5 },
    warps: [
      { fromX: 0, fromY: 4, toZone: 'spirit-meadow', toX: 20, toY: 8, direction: 'left' },
      { fromX: 0, fromY: 5, toZone: 'spirit-meadow', toX: 20, toY: 8, direction: 'left' },
      { fromX: 29, fromY: 4, toZone: 'moonwell-glade', toX: 1, toY: 8, direction: 'right' },
      { fromX: 29, fromY: 5, toZone: 'moonwell-glade', toX: 1, toY: 8, direction: 'right' },
    ],
  },
  {
    id: 'route-moonwell-garden',
    name: 'Moonwell Pass',     // 3-way hub (W→Home Plot, N→Spirit Meadows, E→Moonwell Glade)
    grid: ROUTE_MOONWELL_GARDEN, // 52x38, redesigned in the editor by Alex (with encounter mist)
    playerStart: { tileX: 14, tileY: 1 },
    warps: [
      // WEST door (0,28-29 — placed in the editor) → Home Plot
      { fromX: 0, fromY: 28, toZone: 'garden', toX: 30, toY: 9, direction: 'left' }, // arrive at Home Plot's right door
      { fromX: 0, fromY: 29, toZone: 'garden', toX: 30, toY: 10, direction: 'left' },
      // EAST door (37,17-18) → Moonwell Glade (its west opening)
      { fromX: 37, fromY: 17, toZone: 'moonwell-glade', toX: 1, toY: 8, direction: 'right' },
      { fromX: 37, fromY: 18, toZone: 'moonwell-glade', toX: 1, toY: 9, direction: 'right' },
      // NORTH door (14-15,0) → Spirit Meadows
      { fromX: 14, fromY: 0, toZone: 'spirit-meadow', toX: 69, toY: 38, direction: 'up' }, // arrive at Spirit Meadow's south-right door
      { fromX: 15, fromY: 0, toZone: 'spirit-meadow', toX: 70, toY: 38, direction: 'up' },
    ],
  },
]

/**
 * Expand every zone's gates into its warps, ONCE, at module load.
 *
 * This is why nothing downstream had to change when gates arrived: `checkWarp`, `performWarp`,
 * the 2D editor's warp list, the region build script and the oracle all still read `warps`, and
 * they cannot tell a gate-derived warp from a hand-written one except by the `gate` field they
 * are free to ignore.
 *
 * Mutating in place (rather than building a new array) is deliberate: `ALL_ZONES` and the region
 * tables hold references to these same objects, so an expansion that returned copies would leave
 * half the app reading un-expanded zones — a door that works in one screen and not the next.
 */
for (const z of ZONES) {
  if (z.gates?.length) z.warps.push(...z.gates.flatMap(expandGate))
}

export const START_ZONE = 'garden'
