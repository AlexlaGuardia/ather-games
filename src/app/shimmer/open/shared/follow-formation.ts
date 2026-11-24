// BETA M126 s1 (play, 2026-11-24): FOLLOWER FORMATION. Alex 11-24: "specific positions around the player so they arent
// stacked". Before this every follower settled at one shared slot (spirit-trot FOLLOW.slot, 1.7 m on whatever side it
// already stood) and the Mana'mal kept its own 4.2 m trail, so three spirits and a Mana'mal piled up on one spot.
//
// ONE slot assigner for everyone who walks with the keeper (the Mana'mal: shared/companion-follower.tsx; following
// spirits: ather/spirit-model.tsx -> spirit-trot follow). Pure but for a tiny module-level store (the members and the
// formation's own state), no three, no React. M127 (spirits in fights, the 10 m tether) builds on `assignSlots` /
// `formationSlot`; nothing here knows about fights.
//
//  · The Mana'mal sits at HEEL: behind and to the right.
//  · Up to FOLLOW_MAX spirits form a loose ARC behind (left / back / right), spaced by their body radius (obstacles.ts
//    bodyRadius of the grown row, the same size the spirit models draw at) so no two bodies overlap.
//  · The arc turns with the keeper through a LAGGED facing (FORM.lagK), so it swings round like company, not a grid.
//  · Stopped (FORM.stopAfter s still): the arc fans out a touch (FORM.fan) and each faces outward.
//  · Tight space: any slot its member's `blocked` refuses, or a slot behind a wall from the keeper = SINGLE FILE along the
//    keeper's own trail (where the keeper walked is where they can walk), held FORM.fileHold s after the space opens.
//  · A file slot that is still blocked falls back to the nearest free point that a straight line reaches, never a point
//    on the far side of a wall.
//
// Headings use the trot's convention: atan2(dx, dz). The keeper's yaw is the camera's: forward = (-sin yaw, -cos yaw).

export type Vec = { x: number; z: number }
export type Keeper = { x: number; z: number; yaw: number }
export type Blocked = (x: number, z: number) => boolean
export type MemberKind = 'manamal' | 'spirit'
export type Member = { id: string; kind: MemberKind; r: number; blocked?: Blocked }
export type Slot = { x: number; z: number; face: number }
export type Layout = 'arc' | 'file'
export type Assigned = { layout: Layout; slots: Record<string, Slot> }

export const FORM = {
  keeperR: 0.35,    // m: the keeper's own body (nobody's slot comes nearer than this + their radius)
  heelBack: 1.0,    // m behind the keeper: the Mana'mal's heel slot
  heelSide: 0.75,   // m to the keeper's right
  arcR: 2.3,        // m from the keeper: the spirits' arc
  gap: 0.3,         // m kept clear between two bodies on top of their radii
  arcMinStep: 0.7,  // rad between two arc neighbours at least (a loose arc, ~40 degrees)
  fan: 1.18,        // stopped: the arc's radius and spread x this
  lagK: 3,          // 1/s: how fast the formation's facing catches the keeper's (the lag that reads as walking)
  moveOn: 0.5,      // m/s: the keeper is walking past this
  stopAfter: 0.5,   // s under moveOn before the stopped fan
  fileFirst: 0.9,   // m along the trail before the first in single file (plus their radius)
  fileHold: 1.0,    // s single file is kept after the space opens again
  crumb: 0.2,       // m between trail crumbs
  trailMax: 80,     // crumbs kept (16 m)
  sample: 0.2,      // m between samples on a line-of-reach test
  teleport: 8,      // m in one tick = a jump (travel / tp): the trail and facing restart
} as const

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
export const forwardOf = (yaw: number): Vec => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) })
export const rightOf = (yaw: number): Vec => { const f = forwardOf(yaw); return { x: -f.z, z: f.x } }
export const headingTo = (a: Vec, b: Vec) => Math.atan2(b.x - a.x, b.z - a.z)

/** true = a straight line a -> b crosses nothing `blocked` (samples every FORM.sample m, both ends included) */
export function lineClear(a: Vec, b: Vec, blocked: Blocked | undefined): boolean {
  if (!blocked) return true
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / FORM.sample))
  for (let i = 1; i <= n; i++) { const t = i / n; if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false }
  return true
}

/** the nearest free point to `p` that a straight line from `from` reaches (rings out to 1.6 m), or null */
export function nearestFree(p: Vec, from: Vec, blocked: Blocked | undefined): Vec | null {
  if (!blocked || (!blocked(p.x, p.z) && lineClear(from, p, blocked))) return { x: p.x, z: p.z }
  for (let r = 0.2; r <= 1.6 + 1e-9; r += 0.2) {
    let best: Vec | null = null, bd = Infinity
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, c = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r }
      if (blocked(c.x, c.z) || !lineClear(from, c, blocked)) continue
      const dd = Math.hypot(c.x - from.x, c.z - from.z); if (dd < bd) { bd = dd; best = c }   // of a ring: the one nearer the keeper's line
    }
    if (best) return best
  }
  return null
}

const order = (ms: readonly Member[]) => [...ms.filter(m => m.kind === 'manamal'), ...ms.filter(m => m.kind === 'spirit')]
/** single file's order: `lead` (ids, first = nearest the keeper when the file formed) so nobody overtakes in a doorway;
 *  members not in it follow in the usual order (Mana'mal first) */
const fileOrder = (ms: readonly Member[], lead?: readonly string[]) => {
  const o = order(ms); if (!lead?.length) return o
  const at = (m: Member) => { const i = lead.indexOf(m.id); return i < 0 ? lead.length + o.indexOf(m) : i }
  return [...o].sort((a, b) => at(a) - at(b))
}

/** The arc: Mana'mal(s) at heel, spirits on an arc behind spaced by body size. Pure geometry, no blocking. */
export function arcSlots(k: Keeper, yaw: number, members: readonly Member[], stopped: boolean): Record<string, Slot> {
  const f = forwardOf(yaw), rt = rightOf(yaw), fan = stopped ? FORM.fan : 1, out: Record<string, Slot> = {}
  const walkFace = Math.atan2(f.x, f.z)
  const at = (back: number, side: number) => ({ x: k.x - f.x * back + rt.x * side, z: k.z - f.z * back + rt.z * side })
  const face = (p: Vec) => (stopped ? headingTo(k, p) : walkFace)
  let h = 0
  for (const m of members) if (m.kind === 'manamal') {
    // a second Mana'mal (none today: one walks at a time) takes the other heel
    const p = at(Math.max(FORM.heelBack, FORM.keeperR + m.r + 0.3) * fan, (h++ % 2 ? -1 : 1) * FORM.heelSide * fan); out[m.id] = { ...p, face: face(p) }
  }
  const sp = members.filter(m => m.kind === 'spirit'); if (!sp.length) return out
  const R = Math.max(FORM.arcR, FORM.keeperR + Math.max(...sp.map(m => m.r)) + 1) * fan
  const steps = sp.slice(1).map((m, i) => Math.max(FORM.arcMinStep, 2 * Math.asin(Math.min(1, (sp[i].r + m.r + FORM.gap) / (2 * R)))) * fan)
  let a = -steps.reduce((s, x) => s + x, 0) / 2   // negative = the keeper's left; one spirit sits straight behind
  sp.forEach((m, i) => { if (i) a += steps[i - 1]; const p = at(R * Math.cos(a), R * Math.sin(a)); out[m.id] = { ...p, face: face(p) } })
  return out
}

/** Single file along the trail (newest crumb first; the keeper's own spot leads), each a body plus a gap behind the last. */
export function fileSlots(k: Keeper, yaw: number, members: readonly Member[], trail: readonly Vec[], lead?: readonly string[]): Record<string, Slot> {
  const pts: Vec[] = [{ x: k.x, z: k.z }, ...trail.filter((c, i) => i > 0 || Math.hypot(c.x - k.x, c.z - k.z) > 1e-6)]
  const b = forwardOf(yaw)
  /** the point s metres back along the trail; past its end, straight on behind */
  const along = (s: number): { p: Vec; face: number } => {
    let left = s
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], c = pts[i], d = Math.hypot(c.x - a.x, c.z - a.z)
      if (d >= left && d > 1e-6) { const t = left / d, p = { x: a.x + (c.x - a.x) * t, z: a.z + (c.z - a.z) * t }; return { p, face: headingTo(c, a) } }
      left -= d
    }
    const e = pts[pts.length - 1], pr = pts.length > 1 ? pts[pts.length - 2] : null
    const dir = pr ? (() => { const dx = e.x - pr.x, dz = e.z - pr.z, n = Math.hypot(dx, dz) || 1; return { x: dx / n, z: dz / n } })() : { x: -b.x, z: -b.z }
    const p = { x: e.x + dir.x * left, z: e.z + dir.z * left }
    return { p, face: Math.atan2(-dir.x, -dir.z) }
  }
  const out: Record<string, Slot> = {}
  let s = 0, prevR: number = FORM.keeperR
  fileOrder(members, lead).forEach((m, i) => {
    s += i === 0 ? FORM.fileFirst + m.r : prevR + m.r + FORM.gap
    prevR = m.r
    const { p, face } = along(s); out[m.id] = { ...p, face }
  })
  return out
}

/** THE ASSIGNER (pure). The arc, unless a member's blocked test refuses its slot or the slot is behind a wall from the
 *  keeper (or `forceFile`): then single file, each file slot moved to the nearest free point it can reach. */
export function assignSlots(k: Keeper, yaw: number, members: readonly Member[], o: { stopped?: boolean; trail?: readonly Vec[]; forceFile?: boolean; lead?: readonly string[] } = {}): Assigned {
  if (!members.length) return { layout: 'arc', slots: {} }
  const ms = order(members)
  if (!o.forceFile) {
    const arc = arcSlots(k, yaw, ms, !!o.stopped)
    const tight = ms.some(m => m.blocked && (m.blocked(arc[m.id].x, arc[m.id].z) || !lineClear(k, arc[m.id], m.blocked)))
    if (!tight) return { layout: 'arc', slots: arc }
  }
  const file = fileSlots(k, yaw, ms, o.trail ?? [], o.lead)
  let prev: Vec = { x: k.x, z: k.z }
  for (const m of fileOrder(ms, o.lead)) {
    const s = file[m.id], p = nearestFree(s, prev, m.blocked) ?? prev
    file[m.id] = { x: p.x, z: p.z, face: s.face }; prev = p
  }
  return { layout: 'file', slots: file }
}

// ── the live formation: the lagged facing, walking/stopped, the trail, single file's hold ────────────────────────────
export type Formation = {
  tick: (k: Keeper, dt: number) => Assigned
  state: () => { layout: Layout; lagYaw: number; speed: number; stopped: boolean; trail: number }
  last: () => Assigned
}
export function makeFormation(members: () => readonly Member[], where?: (id: string) => Vec | undefined): Formation {
  let lead: string[] = []
  let lagYaw = NaN, prev: Vec | null = null, speed = 0, still = 0, trail: Vec[] = [], fileLeft = 0, last: Assigned = { layout: 'arc', slots: {} }
  return {
    tick(k, dt) {
      dt = Math.max(0, Math.min(0.1, dt))
      const jump = !prev || Math.hypot(k.x - prev.x, k.z - prev.z) > FORM.teleport
      if (jump || !Number.isFinite(lagYaw)) { lagYaw = k.yaw; trail = []; speed = 0; still = 0; fileLeft = 0 }
      else {
        const v = dt > 1e-4 ? Math.hypot(k.x - prev!.x, k.z - prev!.z) / dt : speed
        speed += (v - speed) * (1 - Math.exp(-dt * 6))
        lagYaw = wrap(lagYaw + wrap(k.yaw - lagYaw) * (1 - Math.exp(-dt * FORM.lagK)))
      }
      prev = { x: k.x, z: k.z }
      still = speed < FORM.moveOn ? still + dt : 0
      if (!trail.length || Math.hypot(k.x - trail[0].x, k.z - trail[0].z) >= FORM.crumb) { trail.unshift({ x: k.x, z: k.z }); if (trail.length > FORM.trailMax) trail.length = FORM.trailMax }
      const ms = members(), stopped = still > FORM.stopAfter
      // entering single file: the order is who stands nearest the keeper NOW (kept until the arc is back), so no one overtakes
      const formLead = () => { if (fileLeft > 0 && lead.length) return; const d = (m: Member) => { const p = where?.(m.id); return p ? Math.hypot(p.x - k.x, p.z - k.z) : Infinity }
        lead = [...ms].sort((a, b) => d(a) - d(b)).filter(m => Number.isFinite(d(m))).map(m => m.id) }
      let a = assignSlots(k, lagYaw, ms, { stopped, trail })
      if (a.layout === 'file') { formLead(); a = assignSlots(k, lagYaw, ms, { stopped, trail, forceFile: true, lead }); fileLeft = FORM.fileHold }
      else if (fileLeft > 0) { fileLeft -= dt; a = assignSlots(k, lagYaw, ms, { stopped, trail, forceFile: true, lead }) }
      else lead = []
      last = a
      return a
    },
    state: () => ({ layout: last.layout, lagYaw, speed, stopped: still > FORM.stopAfter, trail: trail.length }),
    last: () => last,
  }
}

// ── the one live formation every follower reads ─────────────────────────────────────────────────────────────────────
const roster = new Map<string, Member>()
const pos = new Map<string, Vec>()
const live = makeFormation(() => [...roster.values()], id => pos.get(id))
let tickedAt = -1
export function joinFormation(m: Member) { roster.set(m.id, m) }
export function leaveFormation(id: string) { roster.delete(id); pos.delete(id); delete live.last().slots[id] }
export const inFormation = (id: string) => roster.has(id)
/** Step the formation from where the keeper stands. Every follower calls it each frame; the first call in a frame (4 ms)
 *  does the work, so whoever draws first (a spirit or the Mana'mal) drives it and no page needs wiring. */
export function tickFormation(k: Keeper, now = typeof performance !== 'undefined' ? performance.now() : Date.now()): Assigned {
  if (tickedAt >= 0 && now - tickedAt < 4) return live.last()
  const dt = tickedAt < 0 ? 0 : (now - tickedAt) / 1000
  tickedAt = now
  const a = live.tick(k, dt)
  if (typeof window !== 'undefined') {   // read-only probe for scripts/m126-formation-check.mts
    const st = live.state(); (window as unknown as { __formation?: unknown }).__formation = {
      ...st, keeper: { x: k.x, z: k.z, yaw: k.yaw }, slots: a.slots, members: [...roster.values()].map(m => ({ id: m.id, kind: m.kind, r: m.r })),
      pos: Object.fromEntries(pos),
    }
  }
  return a
}
export const formationSlot = (id: string): Slot | null => live.last().slots[id] ?? null
/** where a member really stands this frame (the probe reads it; M127 can too) */
export function reportFormationPos(id: string, x: number, z: number) { if (roster.has(id)) pos.set(id, { x, z }) }
/** a blocked test any member can lean on: the first spirit's (the garden's), but only where the keeper stands on ground it
 *  allows (off the plot a spirit's nav refuses everything, and that must not freeze the Mana'mal) */
export function sharedBlocked(k: Vec): Blocked | undefined {
  for (const m of roster.values()) if (m.blocked && !m.blocked(k.x, k.z)) return m.blocked
  return undefined
}

/** The Mana'mal's walk to its slot: sets off past `off` m, settles within 0.12, a catch-up gait over the keeper's own pace;
 *  every step lands free (tries headings either side), so it never walks through a wall. */
export type SlotWalker = { x: number; z: number; speed: number; moving: boolean }
export function slotStep(s: SlotWalker, slot: Vec, keeperSpeed: number, dt: number, blocked?: Blocked, off = 0.6): SlotWalker {
  const dx = slot.x - s.x, dz = slot.z - s.z, d = Math.hypot(dx, dz)
  let moving = s.moving
  if (!moving && d > off) moving = true
  if (moving && d < 0.12) moving = false
  const want = moving ? Math.min(9, 1.2 + keeperSpeed + d * 2.4) : 0
  const speed = s.speed + (want - s.speed) * Math.min(1, dt * 6)
  if (speed < 1e-3 || d < 1e-4) return { x: s.x, z: s.z, speed, moving }
  const stp = Math.min(d, speed * dt), h0 = Math.atan2(dx, dz)
  for (let i = 0; i < 9; i++) {
    const h = h0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.4, nx = s.x + Math.sin(h) * stp, nz = s.z + Math.cos(h) * stp
    if (!blocked || !blocked(nx, nz)) return { x: nx, z: nz, speed, moving }
  }
  return { x: s.x, z: s.z, speed: 0, moving }
}
