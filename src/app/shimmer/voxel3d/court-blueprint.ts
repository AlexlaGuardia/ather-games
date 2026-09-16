// The gate station as a STRUCTURE — a blueprint Alex builds on the worktable, stamped on the plot.
//
// ★★ WHY (Alex, 2026-09-16): *"add the homeplot gate station to the dev structure worktable so i can
// finish that build… this is how the player is to fast travel to and from moonwell glade and
// runehold, not to mention the ather wilds checkpoints they will be able to set up later."*
// `crossings.ts` lays the court from arithmetic — dais, hub, tower, frames — and every judgement on
// its look was made from ASCII until `dev/court` gave it a camera. The worktable exists so a human
// can author a structure as DATA and the world stamps it. This file is the seam between the two:
// the station's LOOK is the blueprint `gate_station` (Alex's), and the station's MEANING — where
// the keeper stands to cross, which cell lights when a way is earned — is the layout frozen here.
//
// ── ★ THE LAYOUT TRAVELS WITH THE FILE (corrected the same day) ─────────────────────────────────
// The four socket cells and four lamp cells are the starter's (`scripts/gen-station-starter.mts`
// dumped today's arc court at tier 0 into the blueprint's own frame) and they live IN the
// blueprint (`BlueprintDef.station`), where `makeBlueprint` shifts them by the same offset it
// shifts the blocks. The first cut froze them here and refused any save whose min corner moved;
// Alex trimmed a dais edge and could not save. A socket is a place the game reads, and it is
// measured against the structure's corner — so it belongs with the structure, not in code. The
// worktable draws them as ghosts so the frames get built AROUND them; they do not move by clicking.
// `STATION_LAYOUT` below is the starter's layout, kept as the fallback for a file that has none.
//
// ⚠ ROTATION SNAPS TO A QUARTER TURN. A stamp turns in 90° steps (`rotateLocal`); the court's
// bearing is ~0.04–0.07 rad on every tier (`courtAnchor`, seed 1337) because `thresholdBearing` is
// 0 for every keeper, so the snap is exact in practice and the starter's frames face the threshold
// the way the arc's did. If a plot ever carries a threshold at another bearing, the whole station
// turns with it as one piece — sockets, lamps and stone together, by construction.
//
// ★ PURE. Reads the blueprint index and the stamp math; touches no Column, no DOM.

import { BLUEPRINT_FILES } from '../data/blueprints/index.generated'
import { rotateLocal, type Stamp } from '../voxel/stamps'
import { blueprintCells, type BlueprintCell, type BlueprintDef, type StationLayout } from '../voxel/blueprints'
import type { Rotation } from '../voxel/pieces'
import type { CourtAnchor, SocketKind } from './crossings'

export const STATION_BP_ID = 'gate_station'

/** The station's blueprint, if Alex has saved one. `null` = the arc court (`crossings.ts`) stands instead. */
export const stationBlueprint = (): BlueprintDef | null => BLUEPRINT_FILES[STATION_BP_ID] ?? null

export interface StationSocket { index: number; kind: SocketKind; x: number; z: number }

/**
 * The layout, in the blueprint's own frame (local cells, y up from the blueprint's bottom row).
 * `anchor` is where `courtAnchor` sits inside the box; `floor` is the local row of `courtLevel`
 * (the dais top the keeper stands on). Generated 2026-09-16 from the tier-0 arc court, seed 1337.
 */
export const STATION_LAYOUT: StationLayout = {
  anchor: { x: 13, z: 10 },
  floor: 1,
  sockets: [
    { index: 0, kind: 'gate', x: 7, z: 18 },
    { index: 1, kind: 'passage', x: 3, z: 11 },
    { index: 2, kind: 'passage', x: 14, z: 20 },
    { index: 3, kind: 'passage', x: 5, z: 4 },
  ],
  /** The one cell per socket that carries its light — the middle of the lintel course. */
  lamps: [
    { index: 0, x: 7, y: 8, z: 18 },
    { index: 1, x: 3, y: 6, z: 11 },
    { index: 2, x: 14, y: 6, z: 20 },
    { index: 3, x: 5, y: 6, z: 4 },
  ],
}

/** The layout this blueprint carries — its own, or the starter's for a file saved without one. */
export const layoutOf = (bp: BlueprintDef): StationLayout => bp.station ?? STATION_LAYOUT

/** Quarter-turn nearest a bearing (+x = 0, +z = π/2): the stamp's `rot`. */
export const stationRot = (bearing: number): Rotation =>
  ((Math.round(bearing / (Math.PI / 2)) % 4) + 4) % 4 as Rotation

export interface StationStamp extends Stamp {
  /** World y of the blueprint's bottom row. */
  floorY: number
}

/**
 * Where the station stands for this anchor: the stamp whose rotated `anchor` cell lands ON the
 * court anchor, with the blueprint's `floor` row at `level`. Derived, never stored — same rule as
 * every other court fact.
 */
export function stationStamp(bp: BlueprintDef, a: CourtAnchor, level: number): StationStamp {
  const rot = stationRot(a.bearing)
  const lay = layoutOf(bp)
  const r = rotateLocal(lay.anchor.x, lay.anchor.z, bp, rot)
  return { id: STATION_BP_ID, bp, x: a.x - r.x, z: a.z - r.z, rot, floorY: level - lay.floor }
}

/** Every world cell the station lays. */
export function stationCells(s: StationStamp): BlueprintCell[] {
  return blueprintCells(s.bp).map(c => {
    const r = rotateLocal(c.x, c.z, s.bp, s.rot)
    return { x: s.x + r.x, y: s.floorY + c.y, z: s.z + r.z, m: c.m }
  })
}

/** The four sockets, in world cells — the crossing volumes. Index order is the arc's (0 = the gate). */
export function stationSockets(s: StationStamp): StationSocket[] {
  return layoutOf(s.bp).sockets.map(sk => {
    const r = rotateLocal(sk.x, sk.z, s.bp, s.rot)
    return { index: sk.index, kind: sk.kind, x: s.x + r.x, z: s.z + r.z }
  })
}

/**
 * ── ★ WHAT EACH SOCKET IS (Alex, 2026-09-16: "wire up the gates to moonwell and runehold") ─────
 * Index 0 is the one GATE — the crossing out to Rune Hold square, Greg's gift, lit from the first
 * minute. Index 1 is MOONWELL — Greg's fold back to the glade, garden to garden, a passage the
 * keeper has earned by standing there on day one, so it is lit from the first minute too. Every
 * socket after that is a WAYMARK slot: lit once the keeper has planted that many marks out in the
 * Wilds (the checkpoints), dark until then. ⚠ Canon's 08-24 station table has no Moonwell row and
 * CANON_GAPS carries the question; Alex placed it here on the day, which is the world-owner's call.
 */
export type SocketWay = { to: 'runehold' } | { to: 'moonwell' } | { to: 'mark'; slot: number }
export const socketWay = (index: number): SocketWay =>
  index === 0 ? { to: 'runehold' } : index === 1 ? { to: 'moonwell' } : { to: 'mark', slot: index - 2 }
/** Lit = the way is earned: the gate and Moonwell always, a mark slot once that mark is held. */
export const socketLitBy = (index: number, marksHeld: number): boolean => index <= 1 || marksHeld >= index - 1

/** The lamp cell of each socket, in world cells, with the material the blueprint holds there (its DARK state). */
export function stationLamps(s: StationStamp): { index: number; x: number; y: number; z: number; dark: number }[] {
  const cells = blueprintCells(s.bp)
  return layoutOf(s.bp).lamps.map(l => {
    const r = rotateLocal(l.x, l.z, s.bp, s.rot)
    const here = cells.find(c => c.x === l.x && c.y === l.y && c.z === l.z)
    return { index: l.index, x: s.x + r.x, y: s.floorY + l.y, z: s.z + r.z, dark: here?.m ?? 0 }
  })
}
