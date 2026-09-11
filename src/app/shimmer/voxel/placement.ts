// A PLACEMENT ROW — "this blueprint stands here" — and what makes one valid.
//
// ★ PURE CORE. No react/three/DOM/fs, no imports from outside this folder. The worktable's
// "place in world" button, the `/shimmer/save-placement` route and `placed.test.ts` all judge a row
// through here, so there is exactly one definition of what may stand where. Same discipline as
// `blueprintProblems`: the route refuses on the way in, the guard refuses on the way out, and a file
// hand-edited in the repo is refused on read rather than standing as a subtly wrong building.
//
// ── ★ TWO KINDS OF PROBLEM, SPLIT ON PURPOSE ──────────────────────────────────────────────────
// `placementProblems` is SHAPE: ids, integers, a blueprint that exists. It needs nothing but the row
// and the list of blueprint ids, so the worktable can run it before it even asks the server.
// `placementSiteProblems` is GROUND: the pad's span, the story road, the water, Greg, the spawn. It
// needs the height field and the road, which are passed IN — this file does not know the world
// seed, and must not, or the worktable could not run half of it on a fixture.
import type { Stamp } from './stamps'
import { stampBox, stampPadSpan, STAMP_PAD_SPAN } from './stamps'

/** One row of `data/blueprints/placed.table.json`. */
export interface PlacementRow {
  /** Unique across the table — the gen-key prefix for the stamp's pieces. */
  id: string
  /** The blueprint's file id (`data/blueprints/<blueprint>.json`). */
  blueprint: string
  x: number
  z: number
  rot: 0 | 1 | 2 | 3
  sink?: number
}

export const SAFE_PLACEMENT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/

export function placementProblems(row: unknown, blueprintIds: ReadonlySet<string>): string[] {
  const p: string[] = []
  if (typeof row !== 'object' || row === null) return ['not an object']
  const r = row as Partial<PlacementRow>
  if (typeof r.id !== 'string' || !SAFE_PLACEMENT_ID.test(r.id)) p.push(`id must match ${SAFE_PLACEMENT_ID} (got ${JSON.stringify(r.id)})`)
  if (typeof r.blueprint !== 'string' || !blueprintIds.has(r.blueprint)) p.push(`no blueprint '${String(r.blueprint)}' on disk`)
  if (!Number.isInteger(r.x) || !Number.isInteger(r.z)) p.push('x and z must be integer world columns')
  if (![0, 1, 2, 3].includes(r.rot as number)) p.push(`rot must be 0-3 (got ${JSON.stringify(r.rot)})`)
  if (r.sink !== undefined && !(Number.isInteger(r.sink) && (r.sink as number) >= 0 && (r.sink as number) <= 4)) p.push('sink must be an integer 0-4')
  return p
}

/** The keeper's fixed neighbours near spawn a building must not stand on. */
export interface SiteContext {
  surfaceAt: (x: number, z: number) => number
  roadAt: (x: number, z: number) => boolean
  seaLevel: number
  /** Cells nothing may cover, with a name each — Greg, the spawn column. */
  reserved?: { x: number; z: number; name: string }[]
}

/** What is wrong with the GROUND under a stamp. Empty = it may stand. One-block margin all round. */
export function placementSiteProblems(s: Stamp, ctx: SiteContext): string[] {
  const p: string[] = []
  const span = stampPadSpan(s, ctx.surfaceAt)
  if (span > STAMP_PAD_SPAN) p.push(`the pad steps ${span} blocks across the footprint (limit ${STAMP_PAD_SPAN}) — find flatter ground`)
  const box = stampBox(s)
  let road = false, water = false
  const hits: string[] = []
  for (let dz = -1; dz <= box.d; dz++) {
    for (let dx = -1; dx <= box.w; dx++) {
      const x = s.x + dx, z = s.z + dz
      if (ctx.roadAt(x, z)) road = true
      if (ctx.surfaceAt(x, z) <= ctx.seaLevel) water = true
      for (const r of ctx.reserved ?? []) if (r.x === x && r.z === z && !hits.includes(r.name)) hits.push(r.name)
    }
  }
  if (road) p.push('it would stand on the story road')
  if (water) p.push('part of the footprint is under water')
  for (const h of hits) p.push(`it would stand on ${h}`)
  return p
}
