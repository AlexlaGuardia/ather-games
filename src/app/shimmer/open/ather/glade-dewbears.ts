// GREG'S SEVEN YOUNG DEWBEARS (BETA M182; RULED athernyx bcdceeb, characters/gregory.md › Party): Blue (glade-blue.tsx, at
// the bench) + SEVEN YOUNG wild meadow Dewbears who chose to stay. Childlike chaos, zero personal space, each its own swarm
// colour (only Blue is dew-blue), unnamed, none travel. PURE (no three, no react): where they roam, how they choose what to
// do, how they crowd a keeper. The drawing is glade-dewbears.tsx.
//
// Placement (Jin's call): a garden disc in FRONT of Greg's bench (bench frame: +z = the way he faces, toward the green),
// the side a newborn opens their eyes on (NEWBORN_GAP 5 m), kept off the pond, his home, the bench and Blue by `ok(x, z)`.
// They are not solids: crowding a keeper never blocks them (the walker has no boxes for them).

/** how many young ones (canon: eight in his garden, Blue the eighth) */
export const YOUNG_N = 7
/** a young one's height as a share of Blue's (an elder at GROWN height; the wild swarm is "shin-high, ~0.35 m") */
export const YOUNG_SCALE = 0.64
/** their own swarm colours (a look call, 🟨 for Alex): soft hues, none near Blue's dew-blue (blue-look.ts BLUE_COLOR.deep) */
export const YOUNG_TINTS = ['#f2a7b8', '#f5c47a', '#b9e08a', '#c6a6ee', '#f59a7a', '#f3e58c', '#e7a0d8'] as const
/** the garden in Greg's bench frame: centre + radius (m) */
export const GARDEN = { x: 0, z: 3.2, r: 3.3 } as const
/** a keeper this close to a young one (and near the garden) is crowded; past LEAVE from the garden they let go */
export const CROWD_FROM = 5, CROWD_LEAVE = 8
/** zero personal space: the ring they press into around a keeper (m), and how close two young ones may stand */
export const CROWD_R = 0.55, APART = 0.32
export const SPEED = { wander: 0.8, run: 1.9, tumble: 1.3 } as const
export const TUMBLE_S = 0.9
/** frame cost: no animation past ANIM_FAR or off screen, half rate past ANIM_HALF, hull off past HULL_FAR, not drawn past DRAW_FAR */
export const ANIM_FAR = 40, ANIM_HALF = 20, HULL_FAR = 25, DRAW_FAR = 60

export type Mode = 'idle' | 'wander' | 'run' | 'tumble' | 'sit' | 'lie' | 'crowd'
export interface Young { i: number; x: number; z: number; yaw: number; mode: Mode; t: number; tx: number; tz: number; roll: number; moved: number }
export interface Frame { x: number; z: number; yaw: number }
export interface Ctx { keeper: { x: number; z: number } | null; rnd: () => number; ok: (x: number, z: number) => boolean; bench: Frame; others: readonly Young[] }

/** bench frame -> world (the frame faces +z at yaw 0, as glade-greg.tsx's group) */
export function toWorld(f: Frame, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw)
  return { x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c }
}
export const gardenCentre = (f: Frame) => toWorld(f, GARDEN.x, GARDEN.z)

/** a small seeded random (mulberry32), so a page's bears start the same */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/** a random point in the garden that `ok` accepts (falls back to the centre) */
export function gardenPoint(f: Frame, rnd: () => number, ok: (x: number, z: number) => boolean): { x: number; z: number } {
  for (let k = 0; k < 12; k++) {
    const a = rnd() * Math.PI * 2, r = GARDEN.r * Math.sqrt(rnd()), p = toWorld(f, GARDEN.x + Math.cos(a) * r, GARDEN.z + Math.sin(a) * r)
    if (ok(p.x, p.z)) return p
  }
  return gardenCentre(f)
}
/** where they start: spread round the garden, each its own spot */
export function youngStart(f: Frame, ok: (x: number, z: number) => boolean, seed = 182): Young[] {
  const rnd = seeded(seed)
  return Array.from({ length: YOUNG_N }, (_, i) => {
    const p = gardenPoint(f, rnd, ok)
    return { i, x: p.x, z: p.z, yaw: rnd() * Math.PI * 2, mode: (['idle', 'sit', 'lie'] as const)[i % 3], t: 0.5 + rnd() * 3, tx: p.x, tz: p.z, roll: 0, moved: 0 }
  })
}
/** the slot young one i takes round a keeper (spread so they ring them, not stack) */
export const crowdSlot = (k: { x: number; z: number }, i: number, r = CROWD_R) => { const a = (i / YOUNG_N) * Math.PI * 2 + 0.4; return { x: k.x + Math.sin(a) * r, z: k.z + Math.cos(a) * r } }
/** what a young one picks next when its timer runs out (weights: wander 40, run 10, idle 18, tumble 12, sit 12, lie 8) */
export function pickMode(r: number): Exclude<Mode, 'crowd'> {
  const w: [Exclude<Mode, 'crowd'>, number][] = [['wander', 40], ['run', 10], ['idle', 18], ['tumble', 12], ['sit', 12], ['lie', 8]]
  let x = r * 100
  for (const [m, n] of w) { if (x < n) return m; x -= n }
  return 'idle'
}
/** the clip the rig plays for a mode (spirit-rig RigClip) */
export function clipOf(b: Young): 'idle' | 'walk' | 'run' | 'sit' | 'lie' {
  if (b.mode === 'sit' || b.mode === 'lie') return b.mode
  if (b.moved < 1e-4) return 'idle'
  return b.mode === 'wander' ? 'walk' : 'run'
}
const turnTo = (yaw: number, want: number, max: number) => { let d = ((want - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; d = Math.max(-max, Math.min(max, d)); return yaw + d }

/** one young one, one frame (mutates b; b.moved = metres covered this frame) */
export function stepYoung(b: Young, dt: number, c: Ctx): Young {
  const g = gardenCentre(c.bench), k = c.keeper
  const kd = k ? Math.hypot(k.x - b.x, k.z - b.z) : Infinity, kg = k ? Math.hypot(k.x - g.x, k.z - g.z) : Infinity
  b.moved = 0
  // crowd: a keeper near (and near the garden) pulls them in; they let go when the keeper leaves the garden
  if (k && b.mode !== 'crowd' && b.mode !== 'tumble' && kd < CROWD_FROM && kg < GARDEN.r + CROWD_FROM) { b.mode = 'crowd'; b.roll = 0 }
  if (b.mode === 'crowd' && (!k || kg > GARDEN.r + CROWD_LEAVE)) { b.mode = 'wander'; const p = gardenPoint(c.bench, c.rnd, c.ok); b.tx = p.x; b.tz = p.z; b.t = 4 }
  if (b.mode === 'crowd' && k) {
    const s = crowdSlot(k, b.i); if (c.ok(s.x, s.z)) { b.tx = s.x; b.tz = s.z }
  } else {
    b.t -= dt
    if (b.t <= 0) {
      b.mode = pickMode(c.rnd()); b.roll = 0
      b.t = b.mode === 'tumble' ? TUMBLE_S : b.mode === 'lie' ? 4 + c.rnd() * 5 : b.mode === 'sit' ? 3 + c.rnd() * 4 : b.mode === 'idle' ? 1 + c.rnd() * 2.5 : 6
      if (b.mode === 'wander' || b.mode === 'run') { const p = gardenPoint(c.bench, c.rnd, c.ok); b.tx = p.x; b.tz = p.z }
      if (b.mode === 'tumble') { b.tx = b.x + Math.sin(b.yaw) * SPEED.tumble * TUMBLE_S; b.tz = b.z + Math.cos(b.yaw) * SPEED.tumble * TUMBLE_S; if (!c.ok(b.tx, b.tz)) { b.mode = 'idle'; b.tx = b.x; b.tz = b.z } }
    }
  }
  if (b.mode === 'tumble') b.roll = Math.min(Math.PI * 2, b.roll + (Math.PI * 2 * dt) / TUMBLE_S)
  const moving = b.mode === 'wander' || b.mode === 'run' || b.mode === 'tumble' || b.mode === 'crowd'
  if (moving) {
    const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz)
    const sp = b.mode === 'wander' ? SPEED.wander : b.mode === 'tumble' ? SPEED.tumble : SPEED.run
    if (d > 0.06) {
      const st = Math.min(d, sp * dt), nx = b.x + (dx / d) * st, nz = b.z + (dz / d) * st
      if (c.ok(nx, nz) || !c.ok(b.x, b.z)) { b.x = nx; b.z = nz; b.moved = st }
      else if (b.mode !== 'crowd') b.t = 0   // walked to an edge: choose again
      if (b.mode !== 'tumble') b.yaw = turnTo(b.yaw, Math.atan2(dx, dz), 8 * dt)
    } else if (b.mode === 'crowd' && k) b.yaw = turnTo(b.yaw, Math.atan2(k.x - b.x, k.z - b.z), 6 * dt)   // pressed in: look up at them
    else if (b.mode === 'wander' || b.mode === 'run') b.t = Math.min(b.t, 0.3 + c.rnd())   // got there
  }
  // two young ones never stand inside each other (a keeper they may press right up to)
  for (const o of c.others) {
    if (o === b) continue
    const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz)
    if (d < APART && d > 1e-6) { const push = (APART - d) / 2, nx = b.x + (dx / d) * push, nz = b.z + (dz / d) * push; if (c.ok(nx, nz)) { b.x = nx; b.z = nz } }
  }
  return b
}
/** the frame-cost tier for a young one `d` m from the camera, `seen` = inside the view */
export function lod(d: number, seen: boolean): { draw: boolean; hull: boolean; anim: 0 | 1 | 2 } {
  if (d > DRAW_FAR) return { draw: false, hull: false, anim: 0 }
  return { draw: true, hull: d <= HULL_FAR, anim: !seen || d > ANIM_FAR ? 0 : d > ANIM_HALF ? 2 : 1 }
}
/** a Dewbear plate tone, made neutral (light grey ramp) so a per-bear material colour tints it; belly white, darks kept.
 *  In the glb's own sRGB 0..1 (blue-look.ts reads the same tones). */
export function youngTone(r: number, g: number, b: number): [number, number, number] {
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b)
  if (lo > 0.88) return [1, 1, 1]
  if (hi < 0.3 || r > b + 0.02 || hi - lo < 0.08) return [r, g, b]
  const LO = (0x6f + 0xaf + 0xc2) / 765, HI = (0xa9 + 0xdb + 0xe1) / 765
  const t = Math.min(1, Math.max(0, ((r + g + b) / 3 - LO) / (HI - LO))), v = 0.8 + 0.2 * t
  return [v, v, v]
}
