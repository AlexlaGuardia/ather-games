// EXTRA GROUND + SOLIDS FOR THE WALKER (M49 s2, 2026-11-21, world). Things the town plan does not know about (the keeper's
// shipyard yard: its built deck, the ramp at its gate, the fence on its rim, the pieces placed in it) register here, and
// on-foot.ts › footWorld reads them on every ask. A registry, not props: the walker's world is built once per region in the
// Driver, while what stands in a yard changes whenever the keeper sets or lifts a piece.
// ★ PURE (no three, no react). A source registers under a key and must unregister when it leaves the scene.
import { bodyHits, type OBox } from './foot-solids'

export interface FootExtra {
  /** raised ground at (x, z), or -Infinity where this source adds nothing */
  ground?: (x: number, z: number) => number
  /** solid boxes (read on every ask: keep the array current, swap it rather than mutate it mid-tick) */
  boxes?: () => readonly OBox[]
}
const extras = new Map<string, FootExtra>()
export function setFootExtra(key: string, e: FootExtra | null) { if (e) extras.set(key, e); else extras.delete(key) }

export function extraGround(x: number, z: number): number {
  let g = -Infinity
  for (const e of extras.values()) if (e.ground) g = Math.max(g, e.ground(x, z))
  return g
}
export function extraHit(x: number, z: number, feetY: number): boolean {
  for (const e of extras.values()) if (e.boxes) for (const b of e.boxes()) if (bodyHits(b, x, z, feetY)) return true
  return false
}
