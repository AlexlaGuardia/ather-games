// ── BUILD PREFS: snap size + turn step for setting furniture and Keepstones (BETA M98 s1; Alex 11-23: "select between
// gridsnapping settings or freehand.. select the angles of rotation from 90 to 15") ─────────────────────────────────────
// A piece's turn stays `q` = quarter turns, as every save already holds it. A finer step makes q FRACTIONAL on a 1/6 lattice
// (15 deg = 1/6 q; 30 = 2/6; 45 = 3/6), so every renderer that turns by `-q * PI / 2` needs no change and an old save reads
// identically (its q is a whole number). Rooms keep whole quarter turns until M97 makes them shells.
// Footprints at a fine angle are turned rectangles: `quad` gives the four corners, `quadsHit` the exact (SAT) overlap, and
// `quadBounds` the axis box the walker and the melee ray use (slightly fat at 45 deg, which is fine for furniture).
// PURE: no three, no react.

export const SNAPS = [1, 0.5, 0.25, 0] as const          // metres; 0 = freehand
export type Snap = (typeof SNAPS)[number]
export const TURN_STEPS = [90, 45, 30, 15] as const       // degrees
export type TurnStep = (typeof TURN_STEPS)[number]
export interface BuildPrefs { snap: Snap; step: TurnStep }
export const DEFAULT_PREFS: BuildPrefs = { snap: 0.25, step: 90 }   // = how pieces set before M98 (a quarter metre, quarter turns)

export const snapLabel = (s: Snap) => (s === 0 ? 'Free' : `${s} m`)
export const nextSnap = (s: Snap): Snap => SNAPS[(SNAPS.indexOf(s) + 1) % SNAPS.length]
export const nextStep = (s: TurnStep): TurnStep => TURN_STEPS[(TURN_STEPS.indexOf(s) + 1) % TURN_STEPS.length]

/** a coordinate on the snap grid (freehand passes it through) */
export const snapTo = (v: number, s: Snap) => (s === 0 ? v : Math.round(v / s) * s)

/** q on the 1/6 lattice, in [0, 4): kills float drift so 6 turns of 15 deg land back on exactly 1 */
export const normQ = (q: number) => { const k = Math.round(q * 6); return (((k % 24) + 24) % 24) / 6 }
/** one turn by the step */
export const turnQ = (q: number, step: TurnStep) => normQ(q + step / 90)
export const isWholeQ = (q: number) => Number.isInteger(normQ(q))

export type Rect = { x0: number; x1: number; z0: number; z1: number }
export type Quad = [number, number][]
/** the footprint (w across, d deep) centred on (x, z), turned by q quarter turns, as the four corners (as rooms.toWorld turns) */
export function quad(x: number, z: number, w: number, d: number, q: number): Quad {
  const a = (normQ(q) * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), hw = w / 2, hd = d / 2
  return ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as const).map(([lx, lz]) => [x + lx * c - lz * s, z + lx * s + lz * c] as [number, number])
}
/** the axis box round a turned footprint. A whole q gives the exact old rectangle (no float dust from cos(PI/2)). */
export function quadBounds(x: number, z: number, w: number, d: number, q: number): Rect {
  const n = normQ(q)
  if (Number.isInteger(n)) { const [hw, hd] = n % 2 ? [d / 2, w / 2] : [w / 2, d / 2]; return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd } }
  const p = quad(x, z, w, d, n), xs = p.map(v => v[0]), zs = p.map(v => v[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
}
export const rectQuad = (r: Rect): Quad => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]]

/** do two convex quads overlap by more than `-pad` (pad > 0 = also refuse within pad metres)? Separating-axis test. */
export function quadsHit(a: Quad, b: Quad, pad = 0): boolean {
  for (const poly of [a, b]) for (let i = 0; i < 4; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % 4], ax = -(z1 - z0), az = x1 - x0, len = Math.hypot(ax, az)
    if (!len) continue
    const nx = ax / len, nz = az / len
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity
    for (const [x, z] of a) { const t = x * nx + z * nz; amin = Math.min(amin, t); amax = Math.max(amax, t) }
    for (const [x, z] of b) { const t = x * nx + z * nz; bmin = Math.min(bmin, t); bmax = Math.max(bmax, t) }
    if (amax + pad <= bmin || bmax + pad <= amin) return false
  }
  return true
}

// ── persisted per viewer (a UI preference, not save data): survives reloads, never blocks when storage is off ──────
export const PREFS_KEY = 'open.build.prefs.v1'
export function adoptPrefs(v: unknown): BuildPrefs {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<BuildPrefs>
  return {
    snap: (SNAPS as readonly number[]).includes(o.snap as number) ? (o.snap as Snap) : DEFAULT_PREFS.snap,
    step: (TURN_STEPS as readonly number[]).includes(o.step as number) ? (o.step as TurnStep) : DEFAULT_PREFS.step,
  }
}
let prefs: BuildPrefs | null = null
const subs = new Set<() => void>()
export function getPrefs(): BuildPrefs {
  if (prefs) return prefs
  try { prefs = adoptPrefs(JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null')) } catch { prefs = { ...DEFAULT_PREFS } }
  return prefs
}
export function setPrefs(p: BuildPrefs) {
  prefs = adoptPrefs(p)
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* storage off: the pref lives for this visit */ }
  subs.forEach(f => f())
}
export const subscribePrefs = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
