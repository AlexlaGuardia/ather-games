'use client'

/**
 * THE VESSEL ART — one drawing of a casting vessel for every host (the Gear rack, the dev bench).
 *
 * ★ PROMOTED 2026-09-09 from `dev/panel/vessel-card.tsx` (the item-first proposal) on Alex's word
 * ("yea that looks good lets continue") after he judged both renders on the bench. The proposal's
 * header said the component would move into hub's lane the moment he called it; this is that move.
 * Everything below is the render + overlay contract exactly as judged: the Cycles render for the
 * vessel's TIER and SEAT COUNT carries the object (`tools/render/vessel_{bracelet,glove}.py`), and
 * the written letters are drawn OVER the render's own voids — so the empty seat is the mesh's, and
 * the art and the model can never disagree about what empty looks like.
 *
 * ⛔ Built against the locked brief `CANON/design-briefs/shimmer-casting-vessels.md`: no metal, no
 * socket/bezel/rim (a stroke around a seat is a rim), the inventory state is DORMANT (no glow along
 * the structure — a lit seat is the stone under sap, not a channelling line).
 *
 * ★ SEAT POSITIONS ARE PROJECTED, NOT EYEBALLED. `tools/render/vessel_seat_probe.py` runs each
 * render's own camera and prints every seat centre in the render's 512px space; both tables are
 * pasted from it and checked against the pixels. Re-run the probe if a SEAT layout, the ring radius
 * or a camera moves — nothing here can notice on its own.
 *  · bracelet: identical across tiers to 0.2px (the seat sits on the ring; the tier only changes the
 *    strand). The arc is NOT symmetric about the front seat: the camera is off-axis on purpose.
 *  · glove: tier-independent (every tier's pad sits at the same Z0). ⚠ Off-axis camera: world x leaks
 *    into image y, so a pair level in the model is NOT level on screen (that is why the two-seat layout
 *    was re-cut along the knuckle line — a level-on-screen pair read as eyes).
 */

import { VESSEL_CAP, type Vessel } from './gems'
import { type VesselTier } from './vessels'
import { RUNES } from './birth/runes.data'
import { mint } from './tokens'

const BRACELET_PNG_SEATS: Record<1 | 2 | 3, readonly (readonly [number, number])[]> = {
  1: [[194.9, 423.0]],
  2: [[141.2, 392.5], [256.1, 433.6]],
  3: [[111.5, 361.1], [194.9, 423.0], [299.3, 428.4]],
}
/** a seat's radius in the bracelet render's 512px space (SEAT_R 0.086 under ortho_scale 2.35) */
const BRACELET_PNG_SEAT_R = 17.6

const GLOVE_PNG_SEATS: Record<1 | 2 | 3, readonly (readonly [number, number])[]> = {
  1: [[271.2, 215.7]],
  2: [[257.5, 203.8], [296.1, 233.6]],   // layout C (Alex, 2026-09-09): the pair rides the knuckle line
  3: [[230.5, 211.4], [273.6, 210.0], [303.7, 239.9]],
}
/** a seat's radius in the glove render's 512px space (r 0.085 under ortho_scale 3.25) */
const GLOVE_PNG_SEAT_R = 12.4

const NOUN: Record<Vessel, 'bracelet' | 'glove'> = { bracelet: 'bracelet', focus: 'glove' }

/**
 * How many seats to DRAW. Tier 0 is Greg's pair, always cut for one letter (`FLOOR_SEATS`), so it has
 * exactly one frame; every other tier has a frame per count INCLUDING zero — an uncut vessel
 * (`move: null`, "cut it for a word you hold…") is a raw braid / a bare pad with no seat in it, and
 * drawing it with a void would report a seat the vessel does not have.
 * ⛔ No default. A `cap = VESSEL_CAP` fallback is what once drew three seats into every vessel; a
 * caller that cannot say how many seats a vessel has does not know enough to draw it.
 */
export const drawnSeats = (tier: VesselTier, seats: number): number =>
  tier === 0 ? 1 : Math.min(VESSEL_CAP, Math.max(0, seats))

/** the render for a vessel's tier and seat count — the file `tools/render/vessel_*.py` wrote */
export const vesselRender = (kind: Vessel, tier: VesselTier, seats: number): string =>
  `/models/props/vessels/${NOUN[kind]}-t${tier}-s${drawnSeats(tier, seats)}.png`

// a rune with no canon glow falls back to the pale mint the panels use for "white" — never a raw literal (tokens guard)
const glowOf = (id: string | undefined) => (id ? RUNES.find(r => r.id === id)?.glow ?? mint.pale : null)

/**
 * One WRITTEN seat, over the render's void. ⚠ NO STROKE. A ring around a seat is a bezel, and the
 * brief bars it by name. The stone reads as sealed under sap — a soft, slightly off-centre pool —
 * not as a jewel clamped in a setting. The EMPTY state is never drawn here: it is the render's own.
 */
function LitSeat({ cx, cy, r, gem }: { cx: number; cy: number; r: number; gem: string }) {
  const c = glowOf(gem) ?? mint.pale
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={c} opacity={0.92} />
      <circle cx={cx - r * 0.28} cy={cy - r * 0.3} r={r * 0.34} fill={mint.text} opacity={0.28} />
    </g>
  )
}

/**
 * The vessel, drawn: render + written letters. `seats` is the WORD's number (through `seatCount`),
 * never the cap; `gems` are the letters seated so far, in seat order.
 */
export function VesselArt({ kind, tier, seats, gems, size = 88, dim = false }: {
  kind: Vessel; tier: VesselTier; seats: number; gems: readonly string[]; size?: number
  /** nothing worn: the uncut vessel, faded — a place for one, not one */
  dim?: boolean
}) {
  const n = drawnSeats(tier, seats)
  const table = kind === 'bracelet' ? BRACELET_PNG_SEATS : GLOVE_PNG_SEATS
  const r = (kind === 'bracelet' ? BRACELET_PNG_SEAT_R : GLOVE_PNG_SEAT_R) * 0.9
  const pts = n ? table[n as 1 | 2 | 3] : []
  return (
    <div className={`relative shrink-0 ${dim ? 'opacity-40' : ''}`} style={{ width: size, height: size }} aria-label={NOUN[kind]}>
      <img src={vesselRender(kind, tier, seats)} alt="" width={size} height={size} draggable={false} />
      {/* only WRITTEN seats are drawn — the empty seat is the render's own void, so the two can never disagree */}
      <svg viewBox="0 0 512 512" className="absolute inset-0 h-full w-full" aria-hidden>
        {pts.map(([x, y], i) => (gems[i] ? <LitSeat key={i} cx={x} cy={y} r={r} gem={gems[i]} /> : null))}
      </svg>
    </div>
  )
}
