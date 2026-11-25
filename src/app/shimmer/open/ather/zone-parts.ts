// ── BETA M84 s3: PUBLISHED ZONE BUILDS IN THE GAME (pure; zone-parts.test.ts) ──
// Alex 11-23: build out each house on a Creative-mode zone, then publish. The live layer the builder writes on Publish (world/
// builder.ts planPublish: the draft, zones included) already carries each zone (builder-zones.ts Zone) with its build (ZonePiece[],
// ZONE-LOCAL). This file turns that into the game's terms:
//   · zoneParts: every part in WORLD coords (zone.x0 + x, zone.z0 + z), standing on the ground under it, or on a floor slab of the
//     SAME zone (rooms.ts slabLift over the zone's own parts, the player's rule). Drawn by the same PieceBody as a player's build.
//   · zonePartBoxes: the walker's boxes, the player's rule (rooms.ts pieceBoxes: solid parts only, a turned wall panel as a chain).
//   · withZoneParts: a terrain Shape whose solids() also returns those boxes (the dynamic-solids.ts withPieces pattern).
// The parts belong to the MAP, not to the keeper: they are never in the keeper's Works, so E pickup (nearWork) and the melee ray
// (the keeper's own pieces) never see them. Nothing to break, nothing to pick up. Only Publish changes them.
// The tag (M114) rides along in the layer; zone-tags.ts gives each tagged zone its E point (M114 s2).
import { FURNITURE } from './furniture'
import { slabLift, onePieceBoxes, type Works, type Piece } from './rooms'
import { CREATIVE_OPEN } from './build-catalog'
import { cleanZones, type Zone } from '../../world/builder-zones'
import type { Box, Shape } from '../terrain-world'

/** one published part in world coords; `y` = the floor it stands on */
export interface ZonePart { key: string; zone: string; item: string; x: number; z: number; q: number; y: number }

/** the published zones out of a live layer's JSON (junk-proof: builder-zones cleanZones), only those with a build or (M114 s2) a tag */
export const publishedZones = (j: unknown): Zone[] => cleanZones(j).filter(z => z.build?.length || z.tag)

const worksOf = (ps: readonly { id: string; item: string; x: number; z: number; q: number }[]): Works =>
  ({ v: 1, rooms: [], chests: [], pieces: ps.map(p => ({ id: p.id, item: p.item, x: p.x, z: p.z, q: p.q, placedAt: 0 }) as Piece) })

/** every zone's parts in world coords. `ground` = the map's ground (NaN off the land: the part is dropped, never drawn in the void). */
export function zoneParts(zones: readonly Zone[], ground: (x: number, z: number) => number): ZonePart[] {
  const out: ZonePart[] = []
  for (const z of zones) {
    const ws = (z.build ?? []).filter(p => FURNITURE[p.item]).map(p => ({ id: p.id, item: p.item, x: z.x0 + p.x, z: z.z0 + p.z, q: p.q }))
    const w = worksOf(ws)
    for (const p of ws) {
      const g = ground(p.x, p.z); if (!Number.isFinite(g)) continue
      out.push({ key: `${z.id}:${p.id}`, zone: z.id, item: p.item, x: p.x, z: p.z, q: p.q, y: g + (FURNITURE[p.item].slab ? 0 : slabLift(w, p.x, p.z)) })
    }
  }
  return out
}

/** the walker's boxes: solid parts only (you walk through a stool), a turned panel as a chain of thin boxes (rooms.ts pieceBoxes) */
export function zonePartBoxes(parts: readonly ZonePart[]): Box[] {
  return parts.flatMap(p => onePieceBoxes({ ...p, open: CREATIVE_OPEN }, p.y))   // M169 s2: a cut piece blocks by its parts; a zone's door stands open (no E in a zone)
}

/** `shape` with the boxes added to its solids() (same box query: only those meeting the asked box) */
export function withZoneParts<S extends Shape>(shape: S, boxes: readonly Box[]): S {
  if (!boxes.length) return shape
  return {
    ...shape,
    solids(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
      const base = shape.solids(x0, y0, z0, x1, y1, z1)
      const hit = boxes.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0 && b.y0 <= y1 && b.y1 >= y0)
      return hit.length ? [...base, ...hit] : base
    },
  }
}
