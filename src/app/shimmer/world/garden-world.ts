// Garden World — the Shimmer Garden composed as ONE continuous map (realm policy: preload).
// Stitches the hand-painted surface zones onto a single global grid, mortared with cloud
// borders, with corridors carved where the old zone-warps sat. The per-zone grids/heights
// stay the authored source of truth (editors keep working); this module derives the world.
//
// Placement is NOT guessed: every overworld warp sits on a zone edge and names its landing
// tile on the neighbour's opposite edge, so the warp graph IS the layout. BFS from `garden`
// places each zone GAP tiles apart; the cloud band fills the gap; each stitched warp pair
// becomes a walkable corridor punched through the band (the warp tiles themselves turn into
// floor, so no teleport remains). Warps into non-surface zones (interiors, caverns, holds)
// survive as real doors. LAYOUT_TWEAKS nudges placements — map placement is Alex's eye.

import { ZONES, type Zone, type Warp } from './zones'
import { getHeightGrid, setLiveHeights } from './heightmaps'
import { ZONE_NODES, type NodePlacement } from './node-placements'
import { SOLID } from './tiles'

// The Garden continent = the canon surface loop (shimmer-geography.md). Underground
// (Voranyx Caverns 1F/2F), houses (Gregory's), and the hold arenas stay warp-realms.
// route-mycelial-spirit / route-spirit-moonwell are EXCLUDED: orphaned zones (exits but
// no entrances anywhere in the warp graph) — never wired in; superseded by real geography.
export const SURFACE_ZONES: string[] = [
  'garden', 'route-garden-mycelial', 'mycelial-path', 'wooded-trail', 'twilight-thicket',
  'spirit-meadow', 'moonwell-glade', 'route-moonwell-garden', 'mana-springs', 'route-2',
  'gloview-village', 'route-3', 'the-outfields', 'the-threshold',
]

const GAP = 6         // tiles between placed zone rects — the cloud band lives here
const CLOUD_BAND = 3  // cloud walls extend this far out from each zone's rect
const VOID = -1, WALL_ID = 34, WARP_ID = 14, FLOOR_ID = 97

// Hand nudges applied AFTER the solve, per zone: [dx, dy]. Alex's placement pass edits here.
export const LAYOUT_TWEAKS: Record<string, [number, number]> = {}

// Seeds for surface components the BFS can't reach on the surface: the eastern arm
// (mana-springs → … → the-threshold) is canonically entered THROUGH the Voranyx Caverns
// (underground), so its surface placement is a map-design choice, anchored to a placed zone.
// Mana Springs goes south-east of Moonwell — "the eastern hub; the ascent begins".
const COMPONENT_SEEDS: Record<string, { anchor: string; dx: number; dy: number }> = {
  'mana-springs': { anchor: 'moonwell-glade', dx: 20, dy: 62 },
  // Ather Winds is entered THROUGH Brack Hold (the hold holds the door — canon). Its
  // surface spot sits past the Outfields at the continent's southern frontier.
  'the-threshold': { anchor: 'the-outfields', dx: 6, dy: 36 },
}

export interface Placement { zone: Zone; ox: number; oy: number; rows: number; cols: number }

const dims = (z: Zone) => ({ rows: z.grid.length, cols: z.grid[0].length })

// Which edge of its zone a warp tile sits on (null = interior door, e.g. a house).
function edgeOf(z: Zone, w: Warp): 'n' | 's' | 'e' | 'w' | null {
  const { rows, cols } = dims(z)
  if (w.fromX === 0) return 'w'
  if (w.fromX === cols - 1) return 'e'
  if (w.fromY === 0) return 'n'
  if (w.fromY === rows - 1) return 's'
  return null
}

export interface LayoutResult { placements: Map<string, Placement>; issues: string[] }

// BFS the warp graph out from `garden`, converting each edge-warp into a relative offset:
// the warp's landing tile on the neighbour's opposite edge pins the cross-axis alignment.
export function solveGardenLayout(): LayoutResult {
  const surface = new Set(SURFACE_ZONES)
  const byId = new Map(ZONES.map(z => [z.id, z]))
  const placements = new Map<string, Placement>()
  const issues: string[] = []

  const garden = byId.get('garden')!
  placements.set('garden', { zone: garden, ox: 0, oy: 0, ...dims(garden) })
  const queue = ['garden']

  // After the queue drains, seed any still-unplaced component (reachable only via an
  // interior realm, e.g. through the caverns) and keep flooding from there.
  const reseed = () => {
    for (const [id, s] of Object.entries(COMPONENT_SEEDS)) {
      const anchor = placements.get(s.anchor)
      const z = byId.get(id)
      if (!anchor || !z || placements.has(id)) continue
      placements.set(id, { zone: z, ox: anchor.ox + s.dx, oy: anchor.oy + s.dy, ...dims(z) })
      queue.push(id)
    }
  }

  while (queue.length || (reseed(), queue.length)) {
    const id = queue.shift()!
    const p = placements.get(id)!
    for (const w of p.zone.warps) {
      if (!surface.has(w.toZone)) continue
      const edge = edgeOf(p.zone, w)
      if (!edge) { issues.push(`${id}: non-edge warp to surface zone ${w.toZone} at (${w.fromX},${w.fromY})`); continue }
      const nz = byId.get(w.toZone)
      if (!nz) { issues.push(`${id}: warp to unknown zone ${w.toZone}`); continue }
      const nd = dims(nz)
      let ox: number, oy: number
      if (edge === 'w') { ox = p.ox - GAP - nd.cols; oy = p.oy + w.fromY - w.toY }
      else if (edge === 'e') { ox = p.ox + p.cols + GAP; oy = p.oy + w.fromY - w.toY }
      else if (edge === 'n') { oy = p.oy - GAP - nd.rows; ox = p.ox + w.fromX - w.toX }
      else { oy = p.oy + p.rows + GAP; ox = p.ox + w.fromX - w.toX }
      const existing = placements.get(w.toZone)
      if (existing) {
        // Loop-closure check only — the corridor router absorbs the mismatch.
        const dx = Math.abs(existing.ox - ox), dy = Math.abs(existing.oy - oy)
        if (dx + dy > 0) issues.push(`loop mismatch ${id}→${w.toZone}: off by (${dx},${dy})`)
        continue
      }
      placements.set(w.toZone, { zone: nz, ox, oy, ...nd })
      queue.push(w.toZone)
    }
  }

  for (const id of SURFACE_ZONES) if (!placements.has(id)) issues.push(`unreachable surface zone: ${id}`)

  for (const [id, [dx, dy]] of Object.entries(LAYOUT_TWEAKS)) {
    const p = placements.get(id)
    if (p) { p.ox += dx; p.oy += dy }
  }

  // Overlap report (zones only; cloud bands merging is fine and intended).
  const list = [...placements.values()]
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]
    if (a.ox < b.ox + b.cols && b.ox < a.ox + a.cols && a.oy < b.oy + b.rows && b.oy < a.oy + a.rows)
      issues.push(`OVERLAP: ${a.zone.id} × ${b.zone.id}`)
  }
  return { placements, issues }
}

export interface GardenWorld {
  grid: number[][]
  heights: number[][]
  rows: number; cols: number
  placements: Map<string, Placement>
  /** doors that remain real warps (into interiors/caverns/holds), with world-space from-coords */
  doorWarps: (Warp & { worldX: number; worldY: number })[]
  playerStart: { tileX: number; tileY: number }
  issues: string[]
  zoneAt(x: number, y: number): string | null
  toWorld(zoneId: string, x: number, y: number): { x: number; y: number } | null
}

export function composeGardenWorld(): GardenWorld {
  const { placements, issues } = solveGardenLayout()

  // Normalize offsets so the world grid starts at MARGIN.
  const M = CLOUD_BAND + 2
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of placements.values()) {
    minX = Math.min(minX, p.ox); minY = Math.min(minY, p.oy)
    maxX = Math.max(maxX, p.ox + p.cols); maxY = Math.max(maxY, p.oy + p.rows)
  }
  for (const p of placements.values()) { p.ox += M - minX; p.oy += M - minY }
  const cols = (maxX - minX) + M * 2, rows = (maxY - minY) + M * 2

  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(VOID))
  const heights: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))

  // 1 — blit each zone's tiles + heights at its placement.
  for (const p of placements.values()) {
    const zh = getHeightGrid(p.zone.id, p.rows, p.cols)
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
      grid[p.oy + r][p.ox + c] = p.zone.grid[r][c]
      heights[p.oy + r][p.ox + c] = zh[r][c]
    }
  }

  // 2 — cloud mortar: band of cloud-wall around each zone rect, only over empty sky.
  for (const p of placements.values()) {
    for (let r = p.oy - CLOUD_BAND; r < p.oy + p.rows + CLOUD_BAND; r++)
      for (let c = p.ox - CLOUD_BAND; c < p.ox + p.cols + CLOUD_BAND; c++) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue
        if (r >= p.oy && r < p.oy + p.rows && c >= p.ox && c < p.ox + p.cols) continue
        if (grid[r][c] === VOID) grid[r][c] = WALL_ID
      }
  }

  // 3 — carve corridors through the mortar for every stitched (surface↔surface) warp pair,
  // and demote those warp tiles to floor. Interior-door warps survive with world coords.
  const surface = new Set(SURFACE_ZONES)
  const doorWarps: GardenWorld['doorWarps'] = []
  const carved = new Set<string>()

  const carve = (x: number, y: number, tile: number, h: number) => {
    if (y < 0 || x < 0 || y >= rows || x >= cols) return
    grid[y][x] = tile
    heights[y][x] = h
    // flank with cloud so corridors read as cut passages, not floating paths
    for (const [fx, fy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const)
      if (fy >= 0 && fx >= 0 && fy < rows && fx < cols && grid[fy][fx] === VOID) grid[fy][fx] = WALL_ID
  }

  for (const p of placements.values()) {
    for (const w of p.zone.warps) {
      const wx = p.ox + w.fromX, wy = p.oy + w.fromY
      if (!surface.has(w.toZone)) {
        doorWarps.push({ ...w, worldX: wx, worldY: wy })
        // A door must be SEEN: some zones author the warp entry without painting the warp
        // tile (Sorrel Hold's mouth) — force the gold tile in the composed view only.
        if ((grid[wy][wx] & 0xFF) !== WARP_ID) grid[wy][wx] = WARP_ID
        continue
      }
      const q = placements.get(w.toZone)
      if (!q || !edgeOf(p.zone, w)) continue
      // Demote this warp tile to the walkable tile just inside the zone (sample inward).
      const edge = edgeOf(p.zone, w)!
      const inward = edge === 'w' ? [w.fromX + 1, w.fromY] : edge === 'e' ? [w.fromX - 1, w.fromY]
        : edge === 'n' ? [w.fromX, w.fromY + 1] : [w.fromX, w.fromY - 1]
      const sample = p.zone.grid[inward[1]]?.[inward[0]]
      const floorTile = sample != null && sample !== VOID && !SOLID[sample & 0xFF] ? sample : FLOOR_ID
      grid[wy][wx] = floorTile

      // Carve once per warp tile, from this tile to the landing tile in the neighbour.
      const key = [p.zone.id, w.toZone].sort().join('|') + `@${Math.min(wx, q.ox + w.toX)},${Math.min(wy, q.oy + w.toY)}`
      if (carved.has(key)) continue
      carved.add(key)
      const tx = q.ox + w.toX, ty = q.oy + w.toY
      const h0 = heights[wy][wx], h1 = heights[ty]?.[tx] ?? 0
      // Manhattan L-path: major axis first (out through the band), then the cross leg.
      const path: [number, number][] = []
      let cx = wx, cy = wy
      const stepMajorX = edge === 'w' || edge === 'e'
      while (stepMajorX ? cx !== tx : cy !== ty) { stepMajorX ? (cx += Math.sign(tx - cx)) : (cy += Math.sign(ty - cy)); path.push([cx, cy]) }
      while (stepMajorX ? cy !== ty : cx !== tx) { stepMajorX ? (cy += Math.sign(ty - cy)) : (cx += Math.sign(tx - cx)); path.push([cx, cy]) }
      path.forEach(([x, y], i) => {
        const inZone = zoneAtRaw(x, y) != null
        if (!inZone || grid[y][x] === VOID || grid[y][x] === WALL_ID || (grid[y][x] & 0xFF) === WARP_ID)
          carve(x, y, floorTile, Math.round(h0 + (h1 - h0) * ((i + 1) / (path.length + 1))))
      })
    }
  }

  function zoneAtRaw(x: number, y: number): string | null {
    for (const p of placements.values())
      if (x >= p.ox && x < p.ox + p.cols && y >= p.oy && y < p.oy + p.rows) return p.zone.id
    return null
  }

  const g = placements.get('garden')!
  const gs = g.zone.playerStart ?? { tileX: 1, tileY: 1 }
  return {
    grid, heights, rows, cols, placements, doorWarps, issues,
    playerStart: { tileX: g.ox + gs.tileX, tileY: g.oy + gs.tileY },
    zoneAt: zoneAtRaw,
    toWorld: (zoneId, x, y) => {
      const p = placements.get(zoneId)
      return p ? { x: p.ox + x, y: p.oy + y } : null
    },
  }
}

// ── The live world realm ────────────────────────────────────────────────────────────────
// The composed continent registers as a synthetic Zone so every existing consumer
// (getZone, checkWarp, save/load validation, the dev zone dropdown) picks it up for free.
// Compose is lazy + cached: first access pays ~10ms once, then it's a lookup.

export const WORLD_ZONE_ID = 'garden-world'

let cachedWorld: GardenWorld | null = null
export function getGardenWorld(): GardenWorld {
  if (!cachedWorld) cachedWorld = composeGardenWorld()
  return cachedWorld
}

/** Overlay the live on-disk world data (from /shimmer/world-data) onto the compiled sources,
 *  then invalidate any prior compose so the continent rebuilds from the fresh data. Call
 *  BEFORE the game mounts (the play3d page boot does). Missing/failed pieces fall back to
 *  the compiled data per zone — a partial payload is always safe. */
export function applyLiveWorldData(data: {
  grids?: Record<string, number[][]>
  nodes?: Record<string, { type: string; tileX: number; tileY: number }[]>
  heights?: Record<string, number[][]>
}) {
  for (const z of ZONES) {
    if (z.id === WORLD_ZONE_ID) continue
    const g = data.grids?.[z.id]
    if (Array.isArray(g) && g.length > 1 && Array.isArray(g[0])) z.grid = g
    const n = data.nodes?.[z.id]
    if (Array.isArray(n)) ZONE_NODES[z.id] = n as NodePlacement[]
  }
  if (data.heights) setLiveHeights(data.heights)
  // recompose from the fresh data on next access; drop the stale synthetic zone
  cachedWorld = null
  const i = ZONES.findIndex(z => z.id === WORLD_ZONE_ID)
  if (i !== -1) ZONES.splice(i, 1)
}

export const isStitched = (zoneId: string) => SURFACE_ZONES.includes(zoneId)

/** world coords → logical zone + local coords (null in the cloud mortar / corridors) */
export function fromWorld(x: number, y: number): { zoneId: string; x: number; y: number } | null {
  const id = getGardenWorld().zoneAt(x, y)
  if (!id) return null
  const p = getGardenWorld().placements.get(id)!
  return { zoneId: id, x: x - p.ox, y: y - p.oy }
}

/** Push the composed world into ZONES (idempotent). Spawn = Moonwell Glade's spot in the
 *  world (matches the old START_ZONE flow: find Gregory first). */
export function registerGardenWorld(): Zone {
  const existing = ZONES.find(z => z.id === WORLD_ZONE_ID)
  if (existing) return existing
  const w = getGardenWorld()
  const moonwell = ZONES.find(z => z.id === 'moonwell-glade')
  const spawn = moonwell?.playerStart
    ? w.toWorld('moonwell-glade', moonwell.playerStart.tileX, moonwell.playerStart.tileY)
    : null
  const zone: Zone = {
    id: WORLD_ZONE_ID,
    name: 'The Shimmer Garden',
    grid: w.grid,
    playerStart: spawn ? { tileX: spawn.x, tileY: spawn.y } : w.playerStart,
    warps: w.doorWarps.map(d => ({
      fromX: d.worldX, fromY: d.worldY, toZone: d.toZone, toX: d.toX, toY: d.toY,
      direction: d.direction, requiredFlag: d.requiredFlag,
    })),
  }
  ZONES.push(zone)
  return zone
}
