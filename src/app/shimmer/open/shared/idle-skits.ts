// BETA M126 s2 (play, 2026-11-24): IDLE SKITS. Alex 11-24: "they should join in on the idle skits where the player has been
// idle and the camera starts moving on its own". When the idle camera starts (shared/idle-mode.ts) each follower leaves
// its formation slot (shared/follow-formation.ts) for a small moment of its own, and on any input they go back:
//  · the Mana'mal ROAMS (M91, Alex 11-22 "walks around, naps"): wander on a 3-6 m ring round the keeper / sit / nap, over
//    and over (idle-mode's idleFollowStep); the nap is the lie-down,
//  · a spirit SNIFFS ROUND: a few metres out from her slot, nose down, then another spot,
//  · two spirits out = they PLAY: round and round one spot, chasing each other's tail.
// A spirit's skit is only a moved SLOT: her own follow gait (ather/spirit-trot.ts) walks to it as to the formation. The
// Mana'mal's is M91's own step at M91's walk (roamStep below only adds walls); slotStep walks it home. The idle camera also turns
// to frame one follower now and then (skitAim, read by idle-mode's idleCamStep through the walker).
// No skits while Hollows are near (combat-layer calls noteHollowNear) or in a fight (idle-mode never idles then).
//
// Pure planning up top (the test drives it); a tiny live store at the bottom ticked by whichever follower draws first.

import { isIdle, idleFollowStart, idleFollowStep, pickWanderGoal, type IdleFollowState, type IdlePhase } from './idle-mode'
import { formationMembers, formationSlot, formationPos, sharedBlocked, lineClear, headingTo, type Blocked, type MemberKind, type Slot, type Vec, type Keeper } from './follow-formation'

export type SkitKind = 'roam' | 'sniff' | 'play'
export type SkitAct = 'lie' | 'sniff'
export type Skit = { kind: SkitKind; mate?: string }
/** `roam` = the Mana'mal's own step this frame: it stands exactly there (phase, speed for its body) */
export type SkitSlot = Slot & { act?: SkitAct; roam?: { phase: IdlePhase; speed: number } }
export const SKIT = {
  roamPass: 1,        // m: a wander never passes nearer the keeper than this
  sniffMin: 1.8,      // m from her slot a sniff spot is at least
  sniffMax: 3.0,      // m at most
  sniffKeep: 1.6,     // m: never nearer the keeper than this
  sniffFar: 5.5,      // m: never further from the keeper than this
  sniffHold: [4.5, 7.5] as [number, number],   // s at one spot before the next
  playOut: 3.4,       // m from the keeper: the centre the two play round
  playR: 1.1,         // m: the ring they run
  playW: 1.0,         // rad/s round the ring (about 1.1 m/s: a brisk chase)
  playSwap: [5, 9] as [number, number],        // s before they turn and run the other way
  hollowHold: 3,      // s after the last Hollow seen near before skits may start
  hollowR: 18,        // m: a Hollow within this = no skits (combat-layer measures it)
} as const
const span = (r: readonly [number, number], rand: () => number) => r[0] + (r[1] - r[0]) * rand()

/** WHO does WHAT: the Mana'mal roams; two spirits (picked at random) play together; every other spirit sniffs. */
export function pickSkits(members: readonly { id: string; kind: MemberKind }[], rand: () => number): Record<string, Skit> {
  const out: Record<string, Skit> = {}
  const spirits = members.filter(m => m.kind === 'spirit').map(m => m.id)
  for (let i = spirits.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [spirits[i], spirits[j]] = [spirits[j], spirits[i]] }
  for (const m of members) if (m.kind === 'manamal') out[m.id] = { kind: 'roam' }
  if (spirits.length >= 2) { out[spirits[0]] = { kind: 'play', mate: spirits[1] }; out[spirits[1]] = { kind: 'play', mate: spirits[0] } }
  for (const id of spirits.slice(spirits.length >= 2 ? 2 : 0)) out[id] = { kind: 'sniff' }
  return out
}

const freeAt = (p: Vec, b?: Blocked) => !b || !b(p.x, p.z)
/** a sniff spot: sniffMin..sniffMax from her slot, kept sniffKeep..sniffFar from the keeper, free and reachable straight from
 *  the slot. null = nowhere fits (she stays in her slot). */
export function pickSniffSpot(anchor: Vec, k: Vec, blocked: Blocked | undefined, rand: () => number): Vec | null {
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2, r = SKIT.sniffMin + (SKIT.sniffMax - SKIT.sniffMin) * rand()
    const p = { x: anchor.x + Math.cos(a) * r, z: anchor.z + Math.sin(a) * r }, dk = Math.hypot(p.x - k.x, p.z - k.z)
    if (dk < SKIT.sniffKeep || dk > SKIT.sniffFar) continue
    if (freeAt(p, blocked) && lineClear(anchor, p, blocked)) return p
  }
  return null
}
/** the play ring's centre: playOut from the keeper on the pair's side, the whole ring free and reached straight from the
 *  keeper; tries round the keeper if that side is walled. null = no room (they sniff instead). */
export function pickPlayCentre(a: Vec, b: Vec, k: Vec, blocked: Blocked | undefined): Vec | null {
  const mx = (a.x + b.x) / 2 - k.x, mz = (a.z + b.z) / 2 - k.z, base = Math.atan2(mz, mx)
  for (let i = 0; i < 12; i++) {
    const ang = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 6)
    const c = { x: k.x + Math.cos(ang) * SKIT.playOut, z: k.z + Math.sin(ang) * SKIT.playOut }
    let ok = lineClear(k, c, blocked)
    for (let j = 0; j < 8 && ok; j++) { const p = { x: c.x + Math.cos(j * Math.PI / 4) * SKIT.playR, z: c.z + Math.sin(j * Math.PI / 4) * SKIT.playR }; ok = freeAt(p, blocked) && lineClear(c, p, blocked) }
    if (ok) return c
  }
  return null
}
/** a play slot at time t: on the ring, the pair half a turn apart (so each chases the other), running way `dir` */
export function playPoint(c: Vec, phase: number, t: number, dir: number): Vec {
  const a = phase + dir * SKIT.playW * t
  return { x: c.x + Math.cos(a) * SKIT.playR, z: c.z + Math.sin(a) * SKIT.playR }
}

/** nearest the straight walk a -> b comes to p */
function pathGap(a: Vec, b: Vec, p: Vec): number {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz, u = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0
  return Math.hypot(a.x + dx * u - p.x, a.z + dz * u - p.z)
}
/** M91's wander / sit / nap, kept off walls and the keeper: a new wander goal must be reached straight on free ground
 *  (else another point of the ring; none = it sits a little longer) */
export function roamStep(s: IdleFollowState, k: Vec, dt: number, blocked: Blocked | undefined, rand: () => number): IdleFollowState {
  const n = idleFollowStep(s, k.x, k.z, dt, rand)
  if (n.phase !== 'wander' || s.phase === 'wander') return n
  const keep = Math.min(SKIT.roamPass, Math.hypot(n.x - k.x, n.z - k.z) - 0.05)
  let g = { x: n.goalX, z: n.goalZ }
  for (let i = 0; i < 16; i++) {
    if (lineClear(n, g, blocked) && pathGap(n, g, k) >= keep) return { ...n, goalX: g.x, goalZ: g.z }
    g = pickWanderGoal(k.x, k.z, rand)
  }
  return { ...n, phase: 'sit', t: 2 }
}

// ── one idle's skits, planned when it starts and stepped every frame ─────────────────────────────────────────────────
type Live = { roam?: IdleFollowState; skit: Skit; anchor: Vec; goal: Vec | null; hold: number; phase: number; centre?: Vec }
export type SkitRun = { step: (k: Keeper, dt: number) => void; slot: (id: string) => SkitSlot | null; plan: () => Record<string, Skit>; ids: () => string[] }
export type SkitInput = { id: string; kind: MemberKind; blocked?: Blocked; slot: Vec | null; pos?: Vec }
export function startSkits(members: readonly SkitInput[], k: Vec, rand: () => number): SkitRun {
  const plan = pickSkits(members, rand), live = new Map<string, Live>(), by = new Map(members.map(m => [m.id, m]))
  let t = 0, dir = 1, swap = span(SKIT.playSwap, rand), playT = 0
  for (const m of members) live.set(m.id, { skit: plan[m.id], anchor: m.slot ?? { x: k.x, z: k.z }, goal: null, hold: 0, phase: 0 })
  // the pair: a shared centre, half a turn apart (no room = both sniff)
  for (const m of members) {
    const L = live.get(m.id)!; if (L.skit.kind !== 'play' || L.centre) continue
    const M = live.get(L.skit.mate!)!, c = pickPlayCentre(L.anchor, M.anchor, k, m.blocked ?? by.get(L.skit.mate!)?.blocked)
    if (!c) { const mate = L.skit.mate!; L.skit = plan[m.id] = { kind: 'sniff' }; M.skit = plan[mate] = { kind: 'sniff' }; continue }
    L.centre = c; M.centre = c; L.phase = Math.atan2(L.anchor.z - c.z, L.anchor.x - c.x); M.phase = L.phase + Math.PI
  }
  for (const [id, L] of live) {
    if (L.skit.kind === 'roam') { const p = by.get(id)?.pos ?? L.anchor; L.roam = idleFollowStart(p.x, p.z) }
  }
  return {
    step(kp, dt) {
      t += dt; playT += dt
      if (playT > swap) { playT = 0; dir = -dir; swap = span(SKIT.playSwap, rand) }
      for (const [id, L] of live) {
        if (L.roam) L.roam = roamStep(L.roam, kp, dt, by.get(id)?.blocked, rand)
        if (L.skit.kind !== 'sniff') continue
        L.hold -= dt
        if (L.hold <= 0 || !L.goal) { L.goal = pickSniffSpot(L.anchor, kp, by.get(id)?.blocked, rand) ?? L.goal; L.hold = span(SKIT.sniffHold, rand) }
      }
    },
    slot(id) {
      const L = live.get(id); if (!L) return null
      if (L.skit.kind === 'play' && L.centre) {
        // the slot runs a little AHEAD of her on the ring, so she keeps after it (the follow gait stops 0.45 m short)
        const p = playPoint(L.centre, L.phase, t + 0.5, dir), q = playPoint(L.centre, L.phase, t + 0.6, dir)
        return { x: p.x, z: p.z, face: headingTo(p, q) }
      }
      if (L.roam) { const r = L.roam, at = { x: r.x, z: r.z }; return { ...at, face: r.phase === 'wander' ? headingTo(at, { x: r.goalX, z: r.goalZ }) : headingTo(k, at), act: r.phase === 'nap' ? 'lie' : undefined, roam: { phase: r.phase, speed: r.speed } } }
      if (!L.goal) return null
      return { x: L.goal.x, z: L.goal.z, face: headingTo(L.anchor, L.goal), act: 'sniff' }
    },
    plan: () => plan,
    ids: () => [...live.keys()],
  }
}

// ── the live store: one per page ───────────────────────────────────────────────────────────────────────────────────
let run: SkitRun | null = null, tickedAt = -1, hollowUntil = -1, aimN = 0, framed = 0
const lying = new Map<string, number>()
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
/** combat-layer: a Hollow stands within SKIT.hollowR of the keeper this frame (no skits while they are about) */
export function noteHollowNear(now = nowMs()) { hollowUntil = now + SKIT.hollowHold * 1000; run = null }
export const skitsOn = () => !!run
/** Step the skits (the first call in a frame does it) and read this follower's skit slot. null = its formation slot. */
export function skitSlot(id: string, k: Keeper, now = nowMs()): SkitSlot | null {
  if (tickedAt < 0 || now - tickedAt >= 4) {
    const dt = tickedAt < 0 ? 0 : Math.min(0.1, (now - tickedAt) / 1000)
    tickedAt = now
    if (!isIdle() || now < hollowUntil) run = null
    else {
      if (!run) run = startSkits(formationMembers().map(m => ({ id: m.id, kind: m.kind, blocked: m.blocked ?? (m.kind === 'manamal' ? sharedBlocked(k) : undefined), pos: formationPos(m.id), slot: formationSlot(m.id) ?? formationPos(m.id) ?? null })), k, Math.random)
      run.step(k, dt)
    }
    probe(k)
  }
  return run?.slot(id) ?? null
}
/** the Mana'mal reports how far down it lies (0..1), for the check */
export function reportLying(id: string, v: number) { lying.set(id, v) }
/** the idle camera asks: the yaw (camera convention: yaw 0 looks down -z) from the keeper to the next follower to frame */
export function skitAim(kx: number, kz: number): number | null {
  if (!run) return null
  const ids = run.ids(); if (!ids.length) return null
  const id = ids[aimN++ % ids.length], p = formationPos(id); if (!p) return null
  framed++
  return Math.atan2(-(p.x - kx), -(p.z - kz))
}
function probe(k: Keeper) {
  if (typeof window === 'undefined') return
  const r = run;
  (window as unknown as { __skits?: unknown }).__skits = {
    on: !!r, idle: isIdle(), hollowHeld: nowMs() < hollowUntil, framed, keeper: { x: k.x, z: k.z }, plan: r?.plan() ?? {}, lying: Object.fromEntries(lying),
    slots: r ? Object.fromEntries(r.ids().map(id => [id, r.slot(id)])) : {},
  }
}
/** Test hook. */
export function _resetSkits() { run = null; tickedAt = -1; hollowUntil = -1; aimN = 0; framed = 0; lying.clear() }
