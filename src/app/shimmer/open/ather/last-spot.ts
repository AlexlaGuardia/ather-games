// ── WHERE YOU WERE (Alex 11-19: "if im exploring in the ather wilds and the page refreshes i should still be in the same
// spot"). While the keeper is out in the Wilds the page saves the spot (tile + world x/z + facing) every few seconds and as
// the page hides; going home clears it. On load, a keeper with a saved Wilds spot is set back down there instead of on the
// plot, unless the address names a waymark (the Hallway wins), the keeper was just born (Moonwell wins), or ?home=1 asks
// for home (an escape hatch, and what checks that expect the plot use). Garden-keyed like every other save. PURE but for
// the storage calls, which never throw.
import { gardenKey } from '@/lib/keeper-local'

export const SPOT_KEY = 'open.lastspot.v1'
export interface Spot { v: 1; zone: 'wilds'; tile: string; x: number; z: number; yaw: number; at: number }
/** a spot worth saving / trusting: finite numbers, a tile name, on the continent's 1 km tiles (|x|,|z| within reason) */
export function validSpot(s: unknown): s is Spot {
  const p = s as Spot
  return !!p && p.v === 1 && p.zone === 'wilds' && typeof p.tile === 'string' && p.tile.length > 0 &&
    [p.x, p.z, p.yaw, p.at].every(Number.isFinite) && Math.abs(p.x) < 50_000 && Math.abs(p.z) < 50_000
}
export const makeSpot = (tile: string, x: number, z: number, yaw: number, now = Date.now()): Spot => ({ v: 1, zone: 'wilds', tile, x, z, yaw, at: now })
export function saveSpot(s: Spot) { try { if (validSpot(s)) localStorage.setItem(gardenKey(SPOT_KEY), JSON.stringify(s)) } catch { /* private window */ } }
export function clearSpot() { try { localStorage.removeItem(gardenKey(SPOT_KEY)) } catch { /* private window */ } }
export function loadSpot(): Spot | null { try { const v = JSON.parse(localStorage.getItem(gardenKey(SPOT_KEY)) ?? 'null'); return validSpot(v) ? v : null } catch { return null } }
/** what a fresh load should do: resume the saved spot, or not (and why not) */
export function resumeFrom(search: string, spot: Spot | null, tileKnown: (name: string) => boolean): Spot | null {
  const q = new URLSearchParams(search)
  if (q.get('waymark') || q.get('home') === '1') return null
  if (!spot || !tileKnown(spot.tile)) return null
  return spot
}
