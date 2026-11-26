// ── BETA M208 slice 2: FOUR LANDING SPOTS ON THE GREEN (Alex 11-26: "design it for four players .. four landing zones so if
// the players are grouped up they dont land on each other") ──────────────────────────────────────────────────────────────
// No new zones. The Green's four paths come in along the gate's axes, one from each quarter of the cluster. A keeper lands
// on the side of the gate facing their OWN plot:
//   · at home (every view has its own plot at ne) that is plot.ts HOME_LANDING, as slice 1 put it (solo keepers included);
//   · a cluster mate visiting another member's plot lands on the side facing THEIR plot in the host's frame (the host tells
//     the guest its seat in the visit snapshot: cluster id + quarter);
//   · any other guest (chordmate, not in the host's cluster) lands on one of four FREE spots between the paths (never a
//     member's spot), picked from its own id so two such guests usually stand apart.
// Pure: no React, no storage. green-landing.test.ts.
import { GATE, GATE_FACE, HOME_LANDING, LANDING_OFF, onGreen } from './plot'
import { QV, relQuarter, type Quarter } from './cluster'

export interface Spot { x: number; z: number; yaw: number }
/** Who sits where in a cluster: the host's (sent in the visit snapshot) or the guest's own. */
export interface Seat { cluster: string; quarter: Quarter }

const facingGate = (p: { x: number; z: number }): Spot => ({ ...p, yaw: Math.atan2(-(GATE.x - p.x), -(GATE.z - p.z)) })
/** nw's path mouth holds the Chordstone (plot.ts CHORDSTONE, side +3.4): its spot steps off the stone's line to the gate. */
export const NW_STEP = -2
/** The four spots in the gate's frame (side, face): ne = out of the ring's face (HOME_LANDING), nw = the Chordstone's side. */
export const AXIS: Record<Quarter, [number, number]> = { ne: [0, LANDING_OFF], nw: [LANDING_OFF, NW_STEP], sw: [0, -LANDING_OFF], se: [-LANDING_OFF, 0] }
/** The spot on the Green facing the plot at `where` in this view's frame. ne is exactly HOME_LANDING. */
export function quarterLanding(where: Quarter): Spot {
  if (where === 'ne') return { ...HOME_LANDING }
  const [side, face] = AXIS[where]
  return facingGate(onGreen(side, face))
}
export const QUARTER_SPOTS: Record<Quarter, Spot> = { ne: quarterLanding('ne'), nw: quarterLanding('nw'), sw: quarterLanding('sw'), se: quarterLanding('se') }
/** The free spots, between the paths (inside the lamps at plot.ts GREEN_LAMP_R 8): nobody's own side. */
export const FREE_R = 6.5
export const FREE_SPOTS: Spot[] = [45, 135, 225, 315].map(a => { const r = (a * Math.PI) / 180; return facingGate(onGreen(Math.cos(r) * FREE_R, Math.sin(r) * FREE_R)) })

const QUARTERS = Object.keys(QV) as Quarter[]
/** A seat off the wire (the host's snapshot is a peer's data): checked, or null. */
export function cleanSeat(x: unknown): Seat | null {
  if (!x || typeof x !== 'object') return null
  const s = x as { cluster?: unknown; quarter?: unknown }
  if (typeof s.cluster !== 'string' || !s.cluster || s.cluster.length > 80) return null
  if (typeof s.quarter !== 'string' || !QUARTERS.includes(s.quarter as Quarter)) return null
  return { cluster: s.cluster, quarter: s.quarter as Quarter }
}
function hash(id: string): number { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
/** A free spot for a guest who is not in the host's cluster, from its own id. */
export const freeLanding = (id: string): Spot => ({ ...FREE_SPOTS[hash(id) % FREE_SPOTS.length] })

/** Where a GUEST lands on the host's Green. Same cluster (and a different seat) = the side facing the guest's own plot in the
 *  host's frame; otherwise (no seat known yet, another cluster, none) a free spot. */
export function guestLanding(hostSeat: unknown, mine: Seat | null, myId: string): Spot {
  const host = cleanSeat(hostSeat)
  if (host && mine && host.cluster === mine.cluster && host.quarter !== mine.quarter) return quarterLanding(relQuarter(host.quarter, mine.quarter))
  return freeLanding(myId)
}
