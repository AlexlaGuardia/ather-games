// ── BETA M85 s2: THE SCATTER BRUSH (World Builder, Place mode, K) ──
// Small stuff painted by the handful: flowers, small rocks, grass, reeds, the low bushes. A scattered piece is an ordinary piece of the
// layer's `props` list (builder-props.ts: same draft, autosave, undo, Publish, same game draw), told apart by its id (`s` + a count):
// it never blocks (cleanProp drops a toggle), it has its own cap (SCATTER_MAX, apart from the placed pieces' PROPS_MAX), and only the
// brush adds or erases it. It stands on the ground like any piece (scenery.ts sceneryPlaced), so it follows every terrain edit.
// DRAW COST: the game and Fly draw props as one InstancedMesh per kind and material (scenery-view.tsx), so N scattered pieces of k
// kinds cost k draw calls (a filler kind = 1, a bush glb = its parts), not N.
// PURE (no imports but builder-props): the brush math. scatter-brush.test.ts.
import { SCALE_MAX, SCALE_MIN, SCATTER_MAX, SCATTER_PREFIX, cleanProp, isScatter, type Prop } from './builder-props'
export { SCATTER_MAX, SCATTER_PREFIX, isScatter }
/** what the brush paints (all non-solid kinds of the existing kit; scenery.ts holds their look and size) */
export const SCATTER_KINDS = ['filler:flowers-white', 'filler:flowers-yellow', 'filler:flowers-violet', 'filler:grass-tall', 'filler:rock-small', 'filler:reeds', 'bush:bloom-bush', 'bush:moonberry-bush'] as const
export const SCATTER_DEFAULT_MIX: readonly string[] = ['filler:flowers-white', 'filler:flowers-yellow', 'filler:flowers-violet', 'filler:grass-tall']
/** radius (m) and density (pieces per square metre) dials */
export const RADIUS_MIN = 1, RADIUS_MAX = 12, RADIUS_STEP = 0.5
export const DENSITY_STEPS = [0.1, 0.25, 0.5, 1, 1.5, 2, 3] as const
/** size jitter: a piece's scale is 1 +- this */
export const SIZE_JITTER = 0.3

export const clampRadius = (r: number) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(r / RADIUS_STEP) * RADIUS_STEP))
export const scatterCount = (ps: readonly Prop[]) => ps.reduce((n, p) => n + (isScatter(p) ? 1 : 0), 0)
/** how many pieces a full brush holds: density x the disc's area */
export const targetCount = (radius: number, density: number) => Math.max(0, Math.round(density * Math.PI * radius * radius))
const inside = (p: Pick<Prop, 'x' | 'z'>, x: number, z: number, r: number) => (p.x - x) ** 2 + (p.z - z) ** 2 <= r * r

/** a small seeded random (mulberry32): the same seed paints the same handful (tests, and a dab is repeatable) */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export function newScatterId(ps: readonly Pick<Prop, 'id'>[]): string {
  let n = 0
  for (const p of ps) { if (!isScatter(p)) continue; const v = parseInt(p.id.slice(1), 36); if (Number.isFinite(v) && v > n) n = v }
  return `${SCATTER_PREFIX}${(n + 1).toString(36)}`
}

export interface Dab { x: number; z: number; radius: number; density: number; kinds: readonly string[]; seed: number; /** may a piece stand here (on the land, not in a void); absent = anywhere */ ok?: (x: number, z: number) => boolean }
/** PAINT: the brush tops the disc up to its density. Scattered pieces already inside count, so dabbing the same spot again adds nothing
 *  and a drag lays an even carpet. Each new one: a uniform point in the disc, a kind from the mix, any turn, size 1 +- SIZE_JITTER.
 *  Returns the list with them (the same array when nothing was added: full, no kinds, or no room). */
export function paintScatter(ps: readonly Prop[], d: Dab): Prop[] {
  const r = clampRadius(d.radius), have = ps.reduce((n, p) => n + (isScatter(p) && inside(p, d.x, d.z, r) ? 1 : 0), 0)
  const room = SCATTER_MAX - scatterCount(ps), want = Math.min(room, targetCount(r, d.density) - have)
  if (want <= 0 || !d.kinds.length) return ps as Prop[]
  const rand = rng(d.seed), out = [...ps]
  let next = parseInt(newScatterId(ps).slice(1), 36)
  for (let i = 0, tries = 0; i < want && tries < want * 4; tries++) {
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * r, x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr
    const k = d.kinds[Math.floor(rand() * d.kinds.length) % d.kinds.length], q = rand() * 4, s = Math.min(SCALE_MAX, Math.max(SCALE_MIN, 1 + (rand() * 2 - 1) * SIZE_JITTER))
    if (d.ok && !d.ok(x, z)) continue
    const c = cleanProp({ id: `${SCATTER_PREFIX}${(next++).toString(36)}`, k, x, z, q, s }); if (!c) continue
    out.push(c); i++
  }
  return out.length === ps.length ? ps as Prop[] : out
}
/** ERASE: every scattered piece inside the disc goes; placed pieces (and anything outside) stay. Same array when nothing was there. */
export function eraseScatter(ps: readonly Prop[], x: number, z: number, radius: number): Prop[] {
  const r = clampRadius(radius), out = ps.filter(p => !(isScatter(p) && inside(p, x, z, r)))
  return out.length === ps.length ? ps as Prop[] : out
}
/** the draw's grouping: one batch (one InstancedMesh per material) per kind, whatever the count. scenery-view.tsx SceneryView groups
 *  the same way; this is its count for the HUD and the tests. */
export function byKind<T extends Pick<Prop, 'k'>>(items: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const i of items) { const a = m.get(i.k); if (a) a.push(i); else m.set(i.k, [i]) }
  return m
}
