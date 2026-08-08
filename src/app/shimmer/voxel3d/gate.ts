// Moonwell Glade's tutorial gate — a ceremonial stone arch, sealed until the tutorial quest closes.
//
// ★ PURE MATH. No three, no react, no DOM — same shape as hollows.ts: this file decides WHERE the
// arch sits and WHICH cells belong to its frame vs. its doorway. VoxelWorld.tsx is the only thing
// that actually calls setVoxel — this file never touches a Column.
//
// ★ PHASE 1 IS CEREMONIAL ONLY. No enclosure wall around the glade yet — that is the glade
// dressing pass's job (a ring of something, still Alex's call on look). Wiring a wall in here would
// be scope creep on a mechanics-first pass; the arch alone is enough to gate the exit.

import { ZONE_ANCHORS } from '../voxel/zones'

const GLADE = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!

/** Distance from the glade's centre the gate sits, toward the garden (0,0) — "roughly the glade
 *  radius" per the brief. GLADE.rx/rz average ~320; 300 lands just inside the tended edge, not out
 *  past it. */
const GATE_DIST = 300

const gdx = -GLADE.x, gdz = -GLADE.z
const glen = Math.hypot(gdx, gdz) || 1

/** World XZ of the gate's centre column — on the straight line from the glade's heart toward the
 *  garden origin, at GATE_DIST out. Derived from the zone anchor rather than hardcoded so the gate
 *  never drifts out of sync with the glade if its anchor ever moves. */
export const GATE_X = Math.round(GLADE.x + (gdx / glen) * GATE_DIST)
export const GATE_Z = Math.round(GLADE.z + (gdz / glen) * GATE_DIST)

/**
 * Snap the arch to whichever axis the garden-ward direction dominates — a voxel arch reads as
 * built, not organic, and every other structure in this world (pieces, doorways) is axis-aligned
 * too. The glade sits mostly north of the garden (|gdz| > |gdx|), so the arch spans X and is one
 * block thick in Z, facing the direction of travel toward home.
 */
export const GATE_SPANS_X = Math.abs(gdz) >= Math.abs(gdx)

export interface GateCell {
  x: number; y: number; z: number
  /** True for the 3×3 interior — sealed with stone until the quest closes, then cleared to AIR.
   *  False for the jambs and lintel — permanent, never touched after the first build. */
  doorway: boolean
}

/**
 * Every cell the arch occupies: a 5-wide × 4-high frame, one block thick, with a 3×3 doorway hole
 * centred in it (leaves a 1-block jamb on each side and a 1-block lintel on top).
 */
export function gateCells(baseY: number): GateCell[] {
  const cells: GateCell[] = []
  for (let h = -2; h <= 2; h++) {          // span offset across the 5-wide axis
    for (let y = 0; y <= 3; y++) {         // 0..3 = 4 high
      const doorway = h >= -1 && h <= 1 && y <= 2   // 3 wide × 3 high interior
      const x = GATE_SPANS_X ? GATE_X + h : GATE_X
      const z = GATE_SPANS_X ? GATE_Z : GATE_Z + h
      cells.push({ x, y: baseY + y, z, doorway })
    }
  }
  return cells
}
