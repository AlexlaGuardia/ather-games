// M126 s2: IDLE SKITS (idle-skits.ts). Run: npx tsx src/app/shimmer/open/shared/idle-skits.test.ts
// The skit picker (who does what), the spots (sniff / play ring / lie) against walls, the idle camera's framing glance, the
// live store (on with idle, off on input, off with Hollows near), and the REAL trot: two playing spirits and a sniffer leave
// their formation slots while idle and are back inside ~2 s of input.
import { pickSkits, pickSniffSpot, pickPlayCentre, playPoint, startSkits, skitSlot, noteHollowNear, skitAim, _resetSkits, SKIT, type SkitInput } from './idle-skits'
import { idleCamStep, idleCamFresh, IDLE_AFTER, IDLE_FOLLOW, FRAME, framesFollower, tickIdleCam, noteInput, _resetIdle, type View } from './idle-mode'
import { makeFormation, joinFormation, leaveFormation, tickFormation, formationSlot, reportFormationPos, lineClear, type Member, type Keeper, type Vec } from './follow-formation'
import { makeTrot, type SpiritNav } from '../ather/spirit-trot'
import { SPIRIT_MODELS } from '../ather/spirit-models'
import { bodyRadius } from '../ather/obstacles'
import { GROWN } from '../../sprites/creature-size'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z)

// 1. THE PICKER
{ const four = [{ id: 'mm', kind: 'manamal' as const }, { id: 'a', kind: 'spirit' as const }, { id: 'b', kind: 'spirit' as const }, { id: 'c', kind: 'spirit' as const }]
  for (let i = 0; i < 40; i++) {
    const p = pickSkits(four, rand), kinds = Object.values(p).map(s => s.kind)
    ok(p.mm?.kind === 'roam', 'picker: the Mana\'mal roams')
    ok(kinds.filter(k => k === 'play').length === 2 && kinds.filter(k => k === 'sniff').length === 1, `picker: 3 spirits = one pair plays, one sniffs (${kinds})`)
    const pl = Object.entries(p).filter(([, s]) => s.kind === 'play')
    ok(pl.length === 2 && pl[0][1].mate === pl[1][0] && pl[1][1].mate === pl[0][0], 'picker: the pair are each other\'s mate')
  }
  const seen = new Set<string>(); for (let i = 0; i < 60; i++) { const p = pickSkits(four, rand); seen.add(Object.keys(p).filter(id => p[id].kind === 'sniff')[0]) }
  ok(seen.size === 3, `picker: who sniffs is not always the same spirit (${[...seen]})`)
  const two = pickSkits([{ id: 'a', kind: 'spirit' }, { id: 'b', kind: 'spirit' }], rand)
  ok(two.a.kind === 'play' && two.b.kind === 'play', 'picker: two spirits out = they play')
  const one = pickSkits([{ id: 'mm', kind: 'manamal' }, { id: 'a', kind: 'spirit' }], rand)
  ok(one.a.kind === 'sniff' && one.mm.kind === 'roam', 'picker: one spirit sniffs')
  ok(Object.keys(pickSkits([], rand)).length === 0, 'picker: nobody out = no skits') }

// a wall along x = 1 (thick 0.4), no door
const WALL = (x: number, _z: number) => Math.abs(x - 1) < 0.2
// 2. THE SPOTS
{ const k = { x: 0, z: 0 }, anchor = { x: 0, z: 2.3 }
  for (let i = 0; i < 50; i++) {
    const p = pickSniffSpot(anchor, k, WALL, rand)
    ok(!!p, 'sniff: a spot is found with room on one side')
    if (!p) continue
    const da = dist(p, anchor), dk = dist(p, k)
    ok(da >= SKIT.sniffMin - 1e-9 && da <= SKIT.sniffMax + 1e-9, `sniff: ${SKIT.sniffMin}..${SKIT.sniffMax} m from her slot (${da.toFixed(2)})`)
    ok(dk >= SKIT.sniffKeep && dk <= SKIT.sniffFar, `sniff: kept off the keeper and near (${dk.toFixed(2)})`)
    ok(p.x < 1 - 0.2, `sniff: never on the far side of the wall (x ${p.x.toFixed(2)})`)
  }
  ok(pickSniffSpot(anchor, k, () => true, rand) === null, 'sniff: walled in = no spot')
  const c = pickPlayCentre({ x: 0.5, z: 2.3 }, { x: 1.5, z: 2.3 }, k, WALL)
  ok(!!c && c.x + SKIT.playR < 0.8 || (!!c && c.x - SKIT.playR > 1.2), `play: the ring never crosses the wall (${c && c.x.toFixed(2)})`)
  ok(!!c && lineClear(k, c, WALL), 'play: the ring\'s centre is reached straight from the keeper')
  ok(pickPlayCentre({ x: 0, z: 2 }, { x: 0, z: 2 }, k, () => true) === null, 'play: walled in = no ring')
  const c0 = { x: 0, z: 0 }; let minGap = 9
  for (let t = 0; t < 10; t += 0.1) minGap = Math.min(minGap, dist(playPoint(c0, 0, t, 1), playPoint(c0, Math.PI, t, 1)))
  ok(Math.abs(minGap - 2 * SKIT.playR) < 1e-6, `play: the pair stay half a turn apart on the ring (${minGap.toFixed(2)})`) }

// 3. ONE IDLE'S SKITS: a pair with no room to play sniff instead
{ const k = { x: 0, z: 0 }
  const ms: SkitInput[] = [{ id: 'mm', kind: 'manamal', slot: { x: 0.75, z: 1 } }, { id: 'a', kind: 'spirit', slot: { x: -1, z: 2 } }, { id: 'b', kind: 'spirit', slot: { x: 1, z: 2 } }]
  const r = startSkits(ms, k, rand); r.step({ ...k, yaw: 0 }, 0.016)
  ok(dist(r.slot('mm')!, { x: 0.75, z: 1 }) < 1e-6, 'roam: starts where it stands, no jump')
  ok(r.plan().a.kind === 'play' && r.plan().b.kind === 'play', 'skits: room = the pair plays')
  const sa = r.slot('a')!, sb = r.slot('b')!
  ok(dist(sa, sb) > 2 * SKIT.playR - 0.05, 'skits: the playing pair run opposite each other')
  const walled = startSkits(ms.map(m => ({ ...m, blocked: (x: number, z: number) => Math.hypot(x, z) > 2.4 })), k, rand)
  ok(walled.plan().a.kind === 'sniff' && walled.plan().b.kind === 'sniff', `skits: no room for a ring = they sniff instead (${walled.plan().a.kind})`) }

// 3b. THE MANA'MAL'S ROAM (M91): wander / sit / nap over and over, resting on the 3-6 m ring, at M91's walk, never a jump,
//     never in a wall, never through the keeper; napping = the lie-down act
{ const k = { x: 0, z: 0, yaw: 0 }, mm = { x: 0.75, z: 1 }
  const r = startSkits([{ id: 'mm', kind: 'manamal', slot: mm, blocked: WALL }], k, rand)
  const phases = new Set<string>(), rests: Vec[] = []
  let last: Vec = mm, vMax = 0, inWall = 0, near = 9, left = false, prevPhase = 'sit', badAct = 0, dIn = false
  for (let i = 0; i < 60 * 300; i++) { r.step(k, 1 / 60); const s = r.slot('mm')!, d = dist(s, k)
    phases.add(s.roam!.phase); vMax = Math.max(vMax, dist(s, last) * 60); if (WALL(s.x, s.z)) inWall++; if ((s.act === 'lie') !== (s.roam!.phase === 'nap')) badAct++
    if (d >= 3) left = true; if (left) near = Math.min(near, d)
    if (prevPhase === 'wander' && s.roam!.phase === 'sit') rests.push({ x: s.x, z: s.z }); prevPhase = s.roam!.phase; last = { x: s.x, z: s.z }; dIn = true }
  ok(dIn && phases.size === 3, `roam: wander, sit and nap all happen (${[...phases]})`)
  ok(rests.length >= 5 && rests.every(p => dist(p, k) >= 2.8 && dist(p, k) <= 6.2), `roam: rests on the 3-6 m ring (${rests.map(p => dist(p, k).toFixed(1))})`)
  ok(vMax <= IDLE_FOLLOW.WALK + 0.01, `roam: M91's walk, no jumps (${vMax.toFixed(2)} m/s)`)
  ok(inWall === 0, `roam: never in the wall (${inWall})`)
  ok(near >= SKIT.roamPass - 0.05, `roam: never through the keeper (${near.toFixed(2)})`)
  { const o = startSkits([{ id: 'mm', kind: 'manamal', slot: { x: 0, z: 4 } }], k, rand); let n = 9   // open ground: chords could cross anywhere
    for (let i = 0; i < 60 * 900; i++) { o.step(k, 1 / 60); n = Math.min(n, dist(o.slot('mm')!, k)) }
    ok(n >= SKIT.roamPass - 0.05, `roam: open ground, never through the keeper (${n.toFixed(2)})`) }
  ok(badAct === 0, 'roam: lying exactly while it naps') }

// 4. THE IDLE CAMERA frames a follower on the 2nd, 5th ... glance, turning the short way, and gives the view back exactly
{ ok(!framesFollower(0) && framesFollower(1) && !framesFollower(2) && framesFollower(4), 'camera: frames on glance 2, 5, ...')
  const view: View = { yaw: 3.0, pitch: 0.05 }, aimYaw = -3.0   // the follower is 0.28 rad round the short way (across +-pi)
  let st = idleCamFresh(), asked = 0
  const aim = () => { asked++; return aimYaw }
  const tick = (secs: number, s = 0) => { for (let i = 0; i < secs * 60; i++) { const r = idleCamStep(st, 1 / 60, s, false, view, rand, aim); st = r.state; if (r.apply) { view.yaw = r.apply.yaw; view.pitch = r.apply.pitch } } }
  tick(IDLE_AFTER + 0.1)
  let framedAt = -1
  for (let i = 0; i < 60 * 20 && framedAt < 0; i++) { tick(1 / 60); if (st.n === 2 && asked === 1) framedAt = i }
  ok(asked === 1, `camera: asked for a follower once by the 2nd glance (${asked})`)
  tick(FRAME.hold[0] - 0.2)
  const dy = Math.atan2(Math.sin(view.yaw - aimYaw), Math.cos(view.yaw - aimYaw))
  ok(Math.abs(dy) < 0.08, `camera: turned to frame the follower (off by ${dy.toFixed(3)} rad)`)
  ok(Math.abs(st.off.yaw) < 0.5, `camera: turned the short way round (${st.off.yaw.toFixed(2)})`)
  ok(Math.abs(view.pitch - FRAME.pitch) < 0.05, `camera: looks a touch down at it (${view.pitch.toFixed(2)})`)
  tick(1 / 60, 1)
  ok(view.yaw === 3.0 && view.pitch === 0.05 && !st.idle, 'camera: input gives the exact view back')
  // no follower to frame = a plain glance, never stuck
  let st2 = idleCamFresh(); for (let i = 0; i < 60 * (IDLE_AFTER + 20); i++) st2 = idleCamStep(st2, 1 / 60, 0, false, { yaw: 0, pitch: 0 }, rand, () => null).state
  ok(st2.idle && st2.n >= 4, `camera: with nobody to frame it keeps glancing (${st2.n})`) }

// 5. THE LIVE STORE + THE REAL TROT: Mana'mal + three spirits; idle -> they leave their slots; input -> back within ~2 s
{ _resetIdle(); _resetSkits()
  const sps = ['fox', 'axolotl', 'owl'] as const, k: Keeper = { x: 0, z: 0, yaw: 0 }
  const blocked = (x: number, z: number) => Math.abs(x) > 14 || Math.abs(z) > 14
  const ms: Member[] = sps.map((sp, i) => ({ id: `s${i}`, kind: 'spirit', r: bodyRadius(GROWN[sp]), blocked }))
  joinFormation({ id: 'mm', kind: 'manamal', r: 0.3 }); ms.forEach(m => joinFormation(m))
  let now = 1000
  const target = (id: string) => () => { tickFormation(k, now); return { x: k.x, z: k.z, yaw: k.yaw, slot: skitSlot(id, k, now) ?? formationSlot(id) } }
  const trots = ms.map((m, i) => { const nav: SpiritNav = { home: { x: -6 + i, z: -8 }, rMin: 0.2, rMax: 0.8, blocked }
    const tr = makeTrot(nav, 5 + i * 13, SPIRIT_MODELS[sps[i]]?.trot); tr.follow(target(m.id)); return tr })
  const look: View = { yaw: 0, pitch: 0 }
  let maxOff: Record<string, number> = {}, framed = 0
  const step = (secs: number) => { for (let i = 0; i < secs * 60; i++) { now += 1000 / 60
    tickIdleCam(1 / 60, look, false, rand, () => { const a = skitAim(k.x, k.z); if (a !== null) framed++; return a }); k.yaw = look.yaw   // the keeper's yaw IS the camera's
    trots.forEach((t, j) => { const p = t.step(1 / 60); reportFormationPos(ms[j].id, p.x, p.z); const sl = formationSlot(ms[j].id); if (sl) maxOff[ms[j].id] = Math.max(maxOff[ms[j].id] ?? 0, dist(p, sl)) }) } }
  step(8)   // into their places
  ok(skitSlot('s0', k, now) === null, 'store: not idle = no skit')
  const slot0 = Object.fromEntries(['mm', 's0', 's1', 's2'].map(id => [id, { ...formationSlot(id)! }])); let swung = 0
  maxOff = {}
  for (let i = 0; i < (IDLE_AFTER - 8 + 20) * 4; i++) { step(1 / 4); swung = Math.max(swung, Math.abs(k.yaw)) }
  ok(Object.values(maxOff).filter(v => v > 1.5).length >= 2, `trot: idle = spirits leave their slots (${Object.entries(maxOff).map(([a, v]) => a + ' ' + v.toFixed(1)).join(', ')})`)
  ok(framed >= 1, `camera: framed a follower while idle (${framed})`)
  ok(Math.max(...Object.keys(slot0).map(id => dist(slot0[id], formationSlot(id)!))) < 0.4, `store: the slots hold while the idle camera turns (${Object.keys(slot0).map(id => dist(slot0[id], formationSlot(id)!).toFixed(2)).join(', ')}; yaw swung ${swung.toFixed(2)})`)
  ok(swung > 0.5, 'store: (the idle camera really turned)')
  const mm = skitSlot('mm', k, now)
  ok(!!mm?.roam, 'store: the Mana\'mal\'s skit is to roam')
  noteInput()
  step(1 / 60)
  ok(skitSlot('s0', k, now) === null && skitSlot('mm', k, now) === null, 'store: input = skits off at once')
  step(2)
  const back = trots.map((t, j) => dist(t.pose(), formationSlot(ms[j].id)!))
  ok(back.every(d => d < 0.65), `trot: back in their slots ~2 s after input (${back.map(d => d.toFixed(2)).join(', ')})`)
  // Hollows near: no skits even when idle
  step(IDLE_AFTER + 2)
  ok(skitSlot('s0', k, now) !== null, 'store: idle again = skits again')
  noteHollowNear(now); now += 1
  ok(skitSlot('s0', k, now) === null, 'store: a Hollow near = no skits')
  ms.forEach(m => leaveFormation(m.id)); leaveFormation('mm') }

console.log(`idle-skits: ${pass} pass, ${fails.length} fail`)
for (const m of fails) console.log('  FAIL ' + m)
if (fails.length) process.exit(1)
