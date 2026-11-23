// ── M108: THE DESTINATION MAP (build name "space maps"), the gate Franky opens. Pure data, no React. ──────────────────
// Canon: athernyx game/ather-rework-2026-11.md § 7⅞ + CANON_GAPS › "Repairing Kael's ship" ([RULED-AFK] b44556e, a2a7784).
// Alex 11-23: "the ship is just a gate to space maps": NO flight system. Boarding Kael's ship (FRANKY, at his tie-down in his
// shipyard above Rune Hold, business/shipyard-plots.ts › DOCKED_SHIPS) opens a list of destinations; selecting one shows that
// world with its landing zones; picking a zone takes the keeper there through the existing travel path (?at= + the load
// screen). Players read "destination map"; "space maps" is the build's name.
//
// The list (§ 7⅞ "At first it holds three", strings word for word, invent none):
//   the Starforge  ·  Athernyx  ·  Hask (moon of Orrun): unidentified signal
// What exists on this side today:
//   Athernyx  = the waking continent; its landing zones are the PITSTOPS the keeper holds (pitstops.ts: Rune Hold always,
//               plus every city visited), the same doors the Hallway lists. A city not visited is not a landing zone yet.
//   the Starforge = no map on this side (the Crucible lives only in the play3d station stack, owner-only): "not yet".
//   Hask      = the wreck is unbuilt: "not yet".
// Zone names come from the game's own data (continent.json place names); an unbuilt world shows ONE unnamed "not yet"
// point, so no landing-zone name is invented here.
import { pitstopsUnlocked, type PlaceLike } from './pitstops'

export type DestId = 'starforge' | 'athernyx' | 'hask'
export interface Destination { id: DestId; label: string }
/** the list, in canon's order, labels word for word (§ 7⅞) */
export const DESTINATIONS: readonly Destination[] = [
  { id: 'starforge', label: 'the Starforge' },
  { id: 'athernyx', label: 'Athernyx' },
  { id: 'hask', label: 'Hask (moon of Orrun): unidentified signal' },
]

/** a landing zone on a world's picture: u, v in 0..1 across the picture disc. `href` null = "not yet" (does nothing). */
export interface LandingZone { id: string; name: string | null; u: number; v: number; href: string | null }

/** the URL that sets the keeper down at pitstop `id` (continent/page.tsx › ?at=, the Hallway's door). Keeps the page's
 *  other flags (an owner testing ?ship=gate keeps it after the trip). */
export function zoneHref(id: string, search = ''): string {
  const q = new URLSearchParams(search); q.set('at', id)
  return `/shimmer/open/continent?${q.toString()}`
}

/** the landing zones of destination `d`. Athernyx: the unlocked pitstops placed by their continent coords on the disc. */
export function landingZones(d: DestId, places: readonly PlaceLike[], visited?: Set<string>, search = ''): LandingZone[] {
  if (d !== 'athernyx') return [{ id: `${d}:not-yet`, name: null, u: 0.5, v: 0.5, href: null }]
  const all = places.filter(p => !!p.name)
  if (!all.length) return []
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const p of all) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z) }
  const span = Math.max(x1 - x0, z1 - z0, 1), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
  // inside the disc: the continent's square bounds fit a 0.62-wide box round the middle (a circle of r 0.44 holds it)
  const at = (x: number, z: number) => ({ u: 0.5 + ((x - cx) / span) * 0.62, v: 0.5 + ((z - cz) / span) * 0.62 })
  return pitstopsUnlocked(places, visited).map(p => ({ id: p.id, name: p.name, ...at(p.x, p.z), href: zoneHref(p.id, search) }))
}

// ── THE REPAIR GATE ───────────────────────────────────────────────────────────────────────────────────────────────────
// Canon: the destination map opens once Franky's repair stage 1 (the cell housing, Kael's ledger) is done. The flag read
// today is M73's SHIP-REPAIR FLAG (shared/opening-chain-store.ts › getShipRepairFlag: Veyra sent the keeper to get the ship
// running; hub 11-23), passed in by the page as `repaired`. TODO(M108 repair stage 1): when the ledger line -> Hollis's order
// -> Marks + material -> side-quest part ships, `repaired` becomes "stage 1 done", not "the repair was asked for".

/** the owner-only build flag: ?ship=gate, AND the viewer is the owner (the gate ?spirits=3d uses, /api/owner) */
export const SHIP_GATE_PARAM = 'ship', SHIP_GATE_VALUE = 'gate'
export const shipGateFlag = (search: string) => new URLSearchParams(search).get(SHIP_GATE_PARAM) === SHIP_GATE_VALUE

/** Does boarding Franky open the destination map? While the shell is owner-only the whole gate needs the flag + owner.
 *  SHIP_GATE_OWNER_OVERRIDE: the flag also BYPASSES the repair flag, so the owner can test before the chain is played. When
 *  the shell goes public: drop flag/owner and the override, and require `repaired`. */
export const SHIP_GATE_OWNER_OVERRIDE = true
export function shipGateOpen(o: { flag: boolean; owner: boolean; repaired: boolean }): boolean {
  if (!o.flag || !o.owner) return false
  return SHIP_GATE_OWNER_OVERRIDE || o.repaired
}
