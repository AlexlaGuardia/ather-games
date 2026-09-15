// The five folk of Moonwell Glade — who they are, and where each stands in their own building.
//
// ★ HOST SIDE, PURE. No three/react here: the roster and the site math. The meshes are built by
// `greg.ts` (`createFigure`), the aim test and the dialogue live in VoxelWorld.tsx.
//
// ── WHO ─────────────────────────────────────────────────────────────────────────────────────
// Canon (`shimmer-storyline.md`, the Glade cast; `shimmer-quests-mainmap.md` › Beat 0½): Hazel the
// carpenter, Sax the stonemason, Yarrow the apothecary, Fennel the cook, Mallow who keeps the shop.
// Their words are Magii's (`folk-lines.ts`). Their LOOK is not settled — the figures are Greg's
// placeholder body in a trade colour each, and "Greg's mesh tinted until art" is on the sheet.
//
// ── WHERE ───────────────────────────────────────────────────────────────────────────────────
// Each stands INSIDE their stamped building (`data/blueprints/placed.table.json`), on a floor cell
// beside the station that is their trade: Hazel over the sawmill, Sax by the stonecutter, Yarrow at
// the cauldron, Fennel between the hearth and the pot, Mallow behind the counter. The cell is given
// in the BLUEPRINT's own frame and rotated with the stamp, so moving or turning a building in the
// table moves its folk with it, and `folk.test.ts` proves every cell is open floor in its blueprint
// (air at y=1 and y=2, solid at y=0) — a folk standing in a wall is the frame-map trap in a coat.

import type { Rotation } from '../voxel/pieces'
import { rotateLocal, stampFloor, type Stamp } from '../voxel/stamps'
import { blueprintCells } from '../voxel/blueprints'

export const FOLK_IDS = ['hazel', 'sax', 'yarrow', 'fennel', 'mallow'] as const
export type FolkId = (typeof FOLK_IDS)[number]

export interface FolkDef {
  id: FolkId
  name: string
  /** The placement row (`placed.table.json` id) they live in. */
  placement: string
  /** Standing cell in the blueprint's frame, y=1 (the first walkable layer). */
  lx: number
  lz: number
  /** Which way they face, in the blueprint's frame, as `rotateCell` turns +x: 0=+x 1=+z 2=−x 3=−z. */
  face: Rotation
  /** Placeholder trade colours — robe, then skin. Art is Alex's call. */
  robe: number
  skin: number
}

export const FOLK: readonly FolkDef[] = [
  { id: 'hazel',  name: 'Hazel',  placement: 'glade-hazel-carpentry',   lx: 4, lz: 4, face: 2, robe: 0x9a6b2f, skin: 0xd9a066 },
  { id: 'sax',    name: 'Sax',    placement: 'glade-sax-stonery',       lx: 9, lz: 3, face: 2, robe: 0x6f7378, skin: 0xc8905a },
  { id: 'yarrow', name: 'Yarrow', placement: 'glade-yarrow-apothecary', lx: 2, lz: 3, face: 2, robe: 0x4f6b4a, skin: 0xe0b07a },
  { id: 'fennel', name: 'Fennel', placement: 'glade-fennel-kitchen',    lx: 4, lz: 4, face: 1, robe: 0xb8553a, skin: 0xd9a066 },
  { id: 'mallow', name: 'Mallow', placement: 'glade-mallow-shop',       lx: 2, lz: 5, face: 3, robe: 0x7a4f8a, skin: 0xd9a066 },
]

export const folkDef = (id: FolkId): FolkDef => FOLK.find(f => f.id === id)!

/** Where a folk stands in the world: the CENTRE of their cell, feet on the floor, and their yaw. */
export interface FolkSite {
  id: FolkId
  cx: number
  y: number
  cz: number
  yaw: number
}

/** Quarter turns → radians about +y, the way `piece-mesh` turns a rotated piece. */
const yawOf = (rot: Rotation) => -rot * Math.PI / 2

/**
 * Resolve every folk against the stamps that are actually placed. A folk whose building is not in
 * the table is skipped, not invented somewhere — the row is the authority for where things stand.
 */
export function folkSites(stamps: readonly Stamp[], surfaceAt: (x: number, z: number) => number): FolkSite[] {
  const out: FolkSite[] = []
  for (const f of FOLK) {
    const s = stamps.find(st => st.id === f.placement)
    if (!s) continue
    const r = rotateLocal(f.lx, f.lz, s.bp, s.rot)
    const floor = stampFloor(s, surfaceAt)
    out.push({ id: f.id, cx: s.x + r.x + 0.5, y: floor + 1, cz: s.z + r.z + 0.5, yaw: yawOf(((f.face + s.rot) & 3) as Rotation) })
  }
  return out
}

/**
 * The first cell of material `mat` in a placed building, as a world block centre — Hazel's sawmill
 * for the guide trail. Null if the building is not placed or has no such block.
 */
export function stationCellOf(stamps: readonly Stamp[], placement: string, mat: number): { x: number; z: number } | null {
  const s = stamps.find(st => st.id === placement)
  if (!s) return null
  for (const c of blueprintCells(s.bp)) {
    if (c.m !== mat) continue
    const r = rotateLocal(c.x, c.z, s.bp, s.rot)
    return { x: s.x + r.x + 0.5, z: s.z + r.z + 0.5 }
  }
  return null
}
