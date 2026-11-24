// M126 s1: THE FOLLOWER FORMATION (follow-formation.ts). Run: npx tsx src/app/shimmer/open/shared/follow-formation.test.ts
// Pure geometry (no page): the arc's spacing by body size, behind the keeper's facing, its lag, the stopped fan + outward
// faces, single file through a doorway in a wall, the fallback that never reaches through a wall; then the real spirit trot
// (ather/spirit-trot.ts) walking three spirits to their slots through that doorway, checked against the wall every step.
import { arcSlots, assignSlots, fileSlots, forwardOf, makeFormation, nearestFree, lineClear, slotStep, homeStep, BACK, FORM, type SlotWalker, type Member, type Keeper, type Vec } from './follow-formation'
import { makeTrot, type SpiritNav } from '../ather/spirit-trot'
import { SPIRIT_MODELS } from '../ather/spirit-models'
import { bodyRadius } from '../ather/obstacles'
import { GROWN } from '../../sprites/creature-size'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z)

const rFox = bodyRadius(GROWN.fox), rAxo = bodyRadius(GROWN.axolotl), rOwl = bodyRadius(GROWN.owl)
const team = (blocked?: (x: number, z: number) => boolean): Member[] => [
  { id: 's1', kind: 'spirit', r: rFox, blocked }, { id: 'mm', kind: 'manamal', r: 0.3 },
  { id: 's2', kind: 'spirit', r: rAxo, blocked }, { id: 's3', kind: 'spirit', r: rOwl, blocked },
]
/** no two bodies (keeper included) closer than their radii (+ `slack`) */
function spaced(slots: Record<string, Vec>, ms: Member[], k: Vec, slack = 0): string | null {
  const all = [...ms.map(m => ({ id: m.id, r: m.r, p: slots[m.id] })), { id: 'keeper', r: FORM.keeperR, p: k }]
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (dist(all[i].p, all[j].p) < all[i].r + all[j].r + slack) return `${all[i].id}-${all[j].id} ${dist(all[i].p, all[j].p).toFixed(2)} < ${(all[i].r + all[j].r + slack).toFixed(2)}`
  return null
}
/** how far behind the keeper's facing a point sits (+ = behind) */
const behind = (k: Keeper, yaw: number, p: Vec) => { const f = forwardOf(yaw); return -((p.x - k.x) * f.x + (p.z - k.z) * f.z) }
const side = (k: Keeper, yaw: number, p: Vec) => { const f = forwardOf(yaw); return (p.x - k.x) * -f.z + (p.z - k.z) * f.x }

// 1. the arc, any facing, walking and stopped: spaced by body size, behind, Mana'mal at heel right, spirits left/back/right
for (const yaw of [0, 0.7, Math.PI / 2, 2.4, Math.PI, -1.2]) for (const stopped of [false, true]) {
  const k = { x: 3, z: -2, yaw }, ms = team(), s = arcSlots(k, yaw, ms, stopped), tag = `arc yaw ${yaw.toFixed(2)} ${stopped ? 'stopped' : 'walking'}`
  const bad = spaced(s, ms, k, FORM.gap - 0.01); ok(!bad, `${tag}: bodies apart by their radii + gap (${bad})`)
  ok(['s1', 's2', 's3', 'mm'].every(id => behind(k, yaw, s[id]) > 0.5), `${tag}: every slot behind the keeper's facing`)
  // M126 s3 (moved from "at heel, nearer than the arc"): 3-4 m out, behind and to one side, outside the arc
  ok(dist(s.mm, k) >= 3 && dist(s.mm, k) <= 4 && side(k, yaw, s.mm) > 1.5 && behind(k, yaw, s.mm) > 1.5 && ['s1', 's2', 's3'].every(id => dist(s.mm, k) > dist(s[id], k)), `${tag}: the Mana'mal 3-4 m out, behind and off to one side, outside the arc (${dist(s.mm, k).toFixed(2)})`)
  const L = arcSlots(k, yaw, ms, stopped, -1); ok(side(k, yaw, L.mm) < -1.5 && !spaced(L, ms, k, FORM.gap - 0.01), `${tag}: the other side mirrors, spaced`)
  ok(side(k, yaw, s.s1) < -0.5 && Math.abs(side(k, yaw, s.s2)) < 0.3 && side(k, yaw, s.s3) > 0.5, `${tag}: spirits left / back / right`)
  const outward = ['s1', 's2', 's3'].every(id => Math.abs(Math.atan2(Math.sin(s[id].face - Math.atan2(s[id].x - k.x, s[id].z - k.z)), Math.cos(s[id].face - Math.atan2(s[id].x - k.x, s[id].z - k.z)))) < 1e-6)
  ok(stopped ? outward : ['s1', 's2', 's3', 'mm'].every(id => Math.abs(s[id].face - Math.atan2(forwardOf(yaw).x, forwardOf(yaw).z)) < 1e-6), `${tag}: ${stopped ? 'face outward' : 'face the way the keeper walks'}`)
}
{ const k = { x: 0, z: 0, yaw: 0.3 }, a = arcSlots(k, 0.3, team(), false), b = arcSlots(k, 0.3, team(), true)
  ok(dist(b.s2, k) > dist(a.s2, k) * 1.1 && dist(b.s1, b.s3) > dist(a.s1, a.s3) * 1.1, `stopped: the arc fans out (back ${dist(a.s2, k).toFixed(2)} -> ${dist(b.s2, k).toFixed(2)}, span ${dist(a.s1, a.s3).toFixed(2)} -> ${dist(b.s1, b.s3).toFixed(2)})`) }
// bigger bodies spread wider: three spirits twice the size stay apart
{ const big: Member[] = [1, 2, 3].map(i => ({ id: `b${i}`, kind: 'spirit', r: 0.9 })), k = { x: 0, z: 0, yaw: 1 }, s = arcSlots(k, 1, big, false)
  ok(!spaced(s, big, k, FORM.gap - 0.01), `arc: three 0.9 m bodies are spread by size (${spaced(s, big, k, FORM.gap - 0.01)})`) }
{ const big: Member[] = [{ id: 'mm', kind: 'manamal', r: 0.3 }, ...[1, 2, 3].map(i => ({ id: `b${i}`, kind: 'spirit' as const, r: 1.3 }))], k = { x: 0, z: 0, yaw: 1 }
  for (const st of [false, true]) { const s = arcSlots(k, 1, big, st); ok(!spaced(s, big, k, FORM.gap - 0.01), `big spirits push the Mana'mal out, not under them (${spaced(s, big, k, FORM.gap - 0.01)})`) } }
// s3: a refused side = the other side (kept while it is free), both refused = single file
{ const k = { x: 0, z: 0, yaw: 0 }, east = (x: number, _z: number) => x > 2.2, both = (x: number, _z: number) => Math.abs(x) > 2.2
  const ms = (b: (x: number, z: number) => boolean): Member[] => [{ id: 'mm', kind: 'manamal', r: 0.3, blocked: b }, { id: 'a', kind: 'spirit', r: 0.4, blocked: b }]
  const a = assignSlots(k, 0, ms(east)); ok(a.layout === 'arc' && a.slots.mm.x < -2, `right refused: the left (${a.layout} ${a.slots.mm.x.toFixed(2)})`)
  ok(assignSlots(k, 0, ms(both)).layout === 'file', 'both sides refused: single file')
  let b = east; const f = makeFormation(() => ms((x, z) => b(x, z))); f.tick(k, 1 / 60); b = () => false; f.tick(k, 1 / 60)
  ok(f.last().slots.mm.x < -2, 'the side it took is kept when the other opens') }
// one spirit = straight behind
{ const k = { x: 0, z: 0, yaw: 0 }, s = arcSlots(k, 0, [{ id: 'a', kind: 'spirit', r: rFox }], false); ok(Math.abs(side(k, 0, s.a)) < 1e-6 && behind(k, 0, s.a) > 2, 'one spirit: straight behind') }

// 2. the lag (s4: the keeper WALKS on after the turn; a turn stood still is 2b): a 180 degree turn swings the slots round over time, not at once
{ const ms = team(), f = makeFormation(() => ms), k: Keeper = { x: 0, z: 0, yaw: 0 }
  for (let i = 0; i < 60; i++) f.tick(k, 1 / 60)
  const before = f.last().slots.s2; k.yaw = Math.PI
  const off = (p: Vec) => ({ x: p.x - k.x, z: p.z - k.z }), b0 = off(before)
  let t0 = b0; for (let i = 0; i < 60 && f.state().lagYaw === 0; i++) { t0 = off(f.last().slots.s2); k.z += 3 / 60; f.tick(k, 1 / 60) }
  const just = off(f.last().slots.s2)
  ok(f.state().lagYaw !== 0 && dist(t0, just) < 0.1 * 2 * Math.hypot(b0.x, b0.z), `lag: one frame into the swing the back slot has moved under a tenth of it (${dist(t0, just).toFixed(2)} m)`)
  for (let i = 0; i < 180; i++) { k.z += 3 / 60; f.tick(k, 1 / 60) }
  ok(behind(k, Math.PI, f.last().slots.s2) > 2, `lag: 3 s on, the arc is behind the new facing (${behind(k, Math.PI, f.last().slots.s2).toFixed(2)})`)
  // walking vs stopped from the keeper's speed
  for (let i = 0; i < 30; i++) { k.z += 3 / 60; f.tick(k, 1 / 60) }
  ok(!f.state().stopped, 'walking at 3 m/s: not stopped')
  for (let i = 0; i < 60; i++) f.tick(k, 1 / 60)
  ok(f.state().stopped, 'standing 1 s: stopped (the fan)') }

// 3. a wall along z = 0 from x -10..10 with a 2 m doorway at x -1..1 (thickness 0.2); bodies padded by their radius
const WALL = (x: number, z: number, r: number) => Math.abs(z) < 0.1 + r && (x < -1 + r || x > 1 - r) && Math.abs(x) < 10 + r
const wallFor = (r: number) => (x: number, z: number) => WALL(x, z, r)
const doorTeam = (): Member[] => [
  { id: 'mm', kind: 'manamal', r: 0.3, blocked: wallFor(0.3) },
  { id: 's1', kind: 'spirit', r: rFox, blocked: wallFor(rFox) }, { id: 's2', kind: 'spirit', r: rAxo, blocked: wallFor(rAxo) }, { id: 's3', kind: 'spirit', r: rOwl, blocked: wallFor(rOwl) },
]
{ // open ground far from the wall: the arc
  const ms = doorTeam(), a = assignSlots({ x: 0, z: -6, yaw: Math.PI }, Math.PI, ms)
  ok(a.layout === 'arc', `open ground: the arc (${a.layout})`)
  // in the doorway, walking +z (yaw pi = forward +z), trail back through the door: single file, every slot free and reachable
  const trail = Array.from({ length: 40 }, (_, i) => ({ x: 0, z: 0.2 - i * 0.2 }))
  const k = { x: 0, z: 0.4, yaw: Math.PI }, b = assignSlots(k, Math.PI, ms, { trail })
  ok(b.layout === 'file', `in the doorway: single file (${b.layout})`)
  ok(ms.every(m => !m.blocked!(b.slots[m.id].x, b.slots[m.id].z)), 'single file: every slot free')
  const lineUp = ms.map(m => b.slots[m.id].z)
  ok(lineUp.every((z, i) => i === 0 || z < lineUp[i - 1]) && ms.every(m => Math.abs(b.slots[m.id].x) < 0.05), `single file: one behind the other on the trail (z ${lineUp.map(z => z.toFixed(2)).join(', ')})`)
  ok(!spaced(b.slots, ms, k, FORM.gap - 0.01), `single file: spaced by body (${spaced(b.slots, ms, k, FORM.gap - 0.01)})`)
  ok(ms[0].id === 'mm' && b.slots.mm.z > b.slots.s1.z, 'single file: the Mana\'mal first')
  // no slot is ever on the far side of the wall from the keeper's trail point before it
  let prev: Vec = k; ok(ms.every(m => { const c = lineClear(prev, b.slots[m.id], m.blocked); prev = b.slots[m.id]; return c }), 'single file: each slot reached in a straight line from the one ahead')
  // a keeper beside the wall facing along it: the arc's wall-side slots would be behind the wall -> single file too
  const c = assignSlots({ x: 5, z: 0.7, yaw: Math.PI / 2 }, Math.PI / 2, ms, { trail: Array.from({ length: 30 }, (_, i) => ({ x: 5 + i * 0.2, z: 0.7 })) })
  ok(c.layout === 'file' && ms.every(m => c.slots[m.id].z > 0.1 + m.r - 1e-6), `along a wall: single file on the keeper's side (${c.layout}; z ${ms.map(m => c.slots[m.id].z.toFixed(2)).join(', ')})`)
}
// the fallback: a slot inside the wall -> the nearest free point a straight line reaches; never the far side
{ const bl = wallFor(0.4), p = nearestFree({ x: 3, z: 0 }, { x: 3, z: 2 }, bl)
  ok(!!p && !bl(p.x, p.z) && p.z > 0, `fallback: a slot in the wall goes to the keeper's side (${p && `${p.x.toFixed(2)},${p.z.toFixed(2)}`})`)
  const q = nearestFree({ x: 3, z: -0.8 }, { x: 3, z: 2 }, bl)
  ok(!!q && q.z > 0 && !bl(q.x, q.z), `fallback: a free slot behind a wall is not taken; the near side is (${q && `${q.x.toFixed(2)},${q.z.toFixed(2)}`})`) }
// a narrow 1 m door walked off-centre: the keeper's trail is too near the jamb for a grown body -> each file slot moves to
// the nearest free point (never into the wall, never through it)
{ const NAR = (x: number, z: number, r: number) => Math.abs(z) < 0.1 + r && (x < -0.5 + r || x > 0.5 - r) && Math.abs(x) < 10 + r
  const ms: Member[] = [{ id: 'f', kind: 'spirit', r: rFox, blocked: (x, z) => NAR(x, z, rFox) }, { id: 'g', kind: 'spirit', r: rFox, blocked: (x, z) => NAR(x, z, rFox) }]
  const trail = Array.from({ length: 30 }, (_, i) => ({ x: 0.3, z: 0.8 - i * 0.2 })), a = assignSlots({ x: 0.3, z: 1, yaw: Math.PI }, Math.PI, ms, { trail, forceFile: true })
  ok(ms.every(m => !m.blocked!(a.slots[m.id].x, a.slots[m.id].z)), `narrow door: file slots on the jamb move to free ground (${ms.map(m => `${a.slots[m.id].x.toFixed(2)},${a.slots[m.id].z.toFixed(2)}`).join(' ')})`) }
// the file's order = who stood nearest the keeper when it formed (nobody overtakes in a doorway)
{ const ms = doorTeam(), trail = Array.from({ length: 40 }, (_, i) => ({ x: 0, z: 0.2 - i * 0.2 })), k = { x: 0, z: 0.4, yaw: Math.PI }
  const a = assignSlots(k, Math.PI, ms, { trail, lead: ['s3', 's1'] })
  ok(a.slots.s3.z > a.slots.s1.z && a.slots.s1.z > a.slots.mm.z && a.slots.mm.z > a.slots.s2.z, `file lead: s3, s1 first, then the rest in order (z ${['s3', 's1', 'mm', 's2'].map(id => a.slots[id].z.toFixed(2)).join(', ')})`)
  const near: Record<string, Vec> = { s2: { x: 0, z: -1 }, mm: { x: 0.5, z: -2 }, s1: { x: -0.5, z: -2.5 }, s3: { x: 0, z: -3.2 } }
  const f = makeFormation(() => ms, id => near[id]); let b = f.tick({ x: 0, z: -3, yaw: Math.PI }, 1 / 60)
  for (let i = 0; i < 20; i++) b = f.tick({ x: 0, z: 0.4, yaw: Math.PI }, 1 / 60)
  ok(b.layout === 'file' && b.slots.s2.z > b.slots.mm.z && b.slots.mm.z > b.slots.s1.z && b.slots.s1.z > b.slots.s3.z, `file lead from where they stand: s2, mm, s1, s3 (${b.layout}; z ${['s2', 'mm', 's1', 's3'].map(id => b.slots[id].z.toFixed(2)).join(', ')})`) }
// file past the trail's end: straight on behind
{ const s = fileSlots({ x: 0, z: 0, yaw: 0 }, 0, [{ id: 'a', kind: 'spirit', r: 0.4 }, { id: 'b', kind: 'spirit', r: 0.4 }], [])
  ok(s.a.z > 1 && s.b.z > s.a.z && Math.abs(s.a.x) < 1e-9, `file with no trail: straight behind (${s.a.z.toFixed(2)}, ${s.b.z.toFixed(2)})`) }
// the single-file hold: after the doorway the arc comes back only after FORM.fileHold
{ const ms = doorTeam(), f = makeFormation(() => ms), k: Keeper = { x: 0, z: -3, yaw: Math.PI }
  const layouts: string[] = []
  for (let i = 0; i < 600; i++) { k.z += 2 / 60; const a = f.tick(k, 1 / 60); layouts.push(a.layout) }
  const first = layouts.indexOf('file'), back = layouts.indexOf('arc', first)
  ok(first > 0 && back > first, `walking through the door: arc -> file -> arc (file at ${first}, arc back at ${back})`)
  ok(back - layouts.lastIndexOf('file', back) === 1 && layouts.slice(first, back).every(l => l === 'file'), 'the file holds without flicker') }

// 2b. s4 TURN IN PLACE: stopped, the keeper turns right round (slow, quick, right after the stop, at 60 and 8 fps): no slot
//     moves. A step under FORM.turnStep while turned: the slots only come along. Walk on: they swing, no snap, and settle.
for (const fps of [60, 8]) for (const wait of [2, 0]) for (const spin of [0.4, 3]) {
  const ms = team(), f = makeFormation(() => ms), k: Keeper = { x: 0, z: 0, yaw: 0 }, n = (s: number) => Math.round(s * fps), tag = `turn in place ${fps} fps, ${wait} s after the stop, ${spin} s spin`
  const walk = (s: number) => { for (let i = 0; i < n(s); i++) { const d = forwardOf(k.yaw); k.x += d.x * 4.2 / fps; k.z += d.z * 4.2 / fps; f.tick(k, 1 / fps) } }
  walk(2); for (let i = 0; i < n(wait); i++) f.tick(k, 1 / fps)
  const y0 = f.state().lagYaw
  for (let i = 1; i <= n(spin); i++) { k.yaw = Math.PI * i / n(spin); f.tick(k, 1 / fps) }
  for (let i = 0; i < n(3); i++) f.tick(k, 1 / fps)
  ok(Math.abs(f.state().lagYaw - y0) < 1e-6 && y0 === 0, `${tag}: the facing holds (${f.state().lagYaw.toFixed(3)})`)
  const s = { ...f.last().slots }; k.yaw = -2.2; for (let i = 0; i < n(3); i++) f.tick(k, 1 / fps)
  ok(Object.keys(s).length === 4 && ms.every(m => dist(s[m.id], f.last().slots[m.id]) < 1e-6), `${tag}: no slot moves`)
  for (let i = 0; i < n(0.12); i++) { const d = forwardOf(k.yaw); k.x += d.x * 4.2 / fps; k.z += d.z * 4.2 / fps; f.tick(k, 1 / fps) }
  for (let i = 0; i < n(2); i++) f.tick(k, 1 / fps)
  ok(f.state().lagYaw === 0, `${tag}: a small step does not swing it`)
  let snap = 0, last = f.state().lagYaw; const D = 1 / fps
  for (let i = 0; i < n(2.5); i++) { const d = forwardOf(k.yaw); k.x += d.x * 4.2 / fps; k.z += d.z * 4.2 / fps; f.tick(k, D); const L = f.state().lagYaw; snap = Math.max(snap, Math.abs(Math.atan2(Math.sin(L - last), Math.cos(L - last)))); last = L }
  ok(Math.abs(last - -2.2) < (fps === 60 ? 0.01 : 0.02) + 0.02 && snap <= 2.2 * (1 - Math.exp(-Math.min(0.1, D) * FORM.lagK)) + 1e-6, `${tag}: walks on = it swings round, no snap (${last.toFixed(2)}, largest step ${snap.toFixed(2)})`)
}
// s4: a walk cut short right after the turn still finishes its swing (the arc is behind the way they last walked)
{ const ms = team(), f = makeFormation(() => ms), k: Keeper = { x: 0, z: 0, yaw: 0 }
  for (let i = 0; i < 60; i++) { k.z -= 3 / 60; f.tick(k, 1 / 60) }
  k.yaw = Math.PI; for (let i = 0; i < 18; i++) { k.z += 3 / 60; f.tick(k, 1 / 60) }
  for (let i = 0; i < 180; i++) f.tick(k, 1 / 60)
  ok(behind(k, Math.PI, f.last().slots.s2) > 2, `a short walk the other way: the arc ends behind it (${behind(k, Math.PI, f.last().slots.s2).toFixed(2)})`) }

// 4. the Mana'mal's slot walk never steps into a wall
{ let s = { x: 2, z: -0.8, speed: 0, moving: false }, inWall = 0
  for (let i = 0; i < 300; i++) { s = slotStep(s, { x: 2, z: 1.5 }, 0, 1 / 60, wallFor(0.3)); if (WALL(s.x, s.z, 0.3)) inWall++ }
  ok(inWall === 0 && s.z < 0, `slotStep: a slot on the far side of a wall is not walked through (z ${s.z.toFixed(2)}, ${inWall} in the wall)`) }

// 4b. s3: small steps leave it where it is; a walk brings it along without stop-start; a stop settles it on its slot; it
//     goes round the keeper
{ const k: Keeper = { x: 0, z: 0, yaw: 0 }, ms: Member[] = [{ id: 'mm', kind: 'manamal', r: 0.3 }], f = makeFormation(() => ms)
  let s: SlotWalker = { x: 0, z: 0, speed: 0, moving: false }, kv = 0, nearK = 9
  f.tick(k, 1 / 60); s = { ...s, x: f.last().slots.mm.x, z: f.last().slots.mm.z }
  const run = (sec: number, v: number, each?: () => void) => { for (let i = 0; i < sec * 60; i++) { k.z -= v / 60; f.tick(k, 1 / 60); kv += (Math.abs(v) - kv) / 12; s = slotStep(s, f.last().slots.mm, kv, 1 / 60, undefined, FORM.heelOff, { x: k.x, z: k.z, r: 0.65 }); nearK = Math.min(nearK, dist(s, k)); each?.() } }
  const at0 = { ...s }
  let mv = 0; const see = () => { mv = Math.max(mv, dist(s, at0)) }
  for (const [t, v] of [[0.5, 2], [1, 0], [0.5, -2], [1, 0], [0.6, -2], [1, 0], [0.6, 2], [1, 0]]) run(t, v, see)
  ok(mv < 1e-6, `small steps (1-1.2 m either way) do not move it (${mv.toFixed(3)} m)`)
  let halts = 0; run(1.5, 3); run(6, 3, () => { if (s.speed < 1.5) halts++ })
  ok(halts === 0 && dist(s, k) < 5, `a long walk: no stop-start (${halts} halted frames; ${dist(s, k).toFixed(2)} m)`)
  run(4, 0); ok(!s.moving && dist(s, f.last().slots.mm) < 0.13 && dist(s, k) > 3 && dist(s, k) < 4, `a stop: settled on its slot (${dist(s, k).toFixed(2)} m out)`)
  { const p0 = { ...s }; k.yaw = Math.PI; run(3, 0); ok(dist(s, p0) < 1e-6, `s4: a 180 on the spot leaves it where it is (${dist(s, p0).toFixed(3)})`) }
  nearK = 9; run(1.2, -2); run(6, 0)   // s4: it comes round once the keeper walks on the new way
  ok(nearK > 0.64 && !s.moving && dist(s, f.last().slots.mm) < 0.13 && behind(k, Math.PI, s) > 1.5, `a 180 and a walk: it comes round, never through the keeper (${nearK.toFixed(2)}; behind ${behind(k, Math.PI, s).toFixed(2)})`)
  // straight across the keeper: round them
  let w: SlotWalker = { x: 0, z: 3, speed: 0, moving: false }, mn = 9
  for (let i = 0; i < 400; i++) { w = slotStep(w, { x: 0, z: -3 }, 0, 1 / 60, undefined, 0.3, { x: 0, z: 0, r: 0.65 }); mn = Math.min(mn, Math.hypot(w.x, w.z)) }
  ok(mn >= 0.64 && dist(w, { x: 0, z: -3 }) < 0.13, `a slot straight across the keeper: round them (${mn.toFixed(2)})`) }

// 4c. s3b: home off a skit from 6 m out, at any side and frame rate (the live page ran at 8 fps): in its place (0.65 m) inside
//     1.8 REAL seconds; the usual gait stepped with its 0.05 s frame cap is what was too slow
{ const slot = { x: 2.8, z: 2.1 }, kb = { x: 0, z: 0, r: 0.65 }
  for (const fps of [60, 30, 8, 4]) for (let a = 0; a < 8; a++) {
    let w = { x: Math.cos(a * Math.PI / 4) * 6, z: Math.sin(a * Math.PI / 4) * 6, speed: 0, moving: false, back: BACK.hold as number }, t = 0, mn = 9
    while (t < 5 && dist(w, slot) >= 0.65) { w = homeStep(w, slot, 0, 1 / fps, undefined, kb); t += 1 / fps; mn = Math.min(mn, Math.hypot(w.x, w.z)) }
    ok(t <= 1.8 && mn >= 0.64, `home from 6 m at ${a * 45} deg, ${fps} fps: ${t.toFixed(2)} s (nearest the keeper ${mn.toFixed(2)})`) }
  let w = { x: 2, z: -0.8, speed: 0, moving: false, back: 1.5 }, inWall = 0
  for (let i = 0; i < 30; i++) { w = homeStep(w, { x: 2, z: 1.5 }, 0, 0.25, wallFor(0.3)); if (WALL(w.x, w.z, 0.3)) inWall++ }
  ok(inWall === 0 && w.z < 0, `home at 4 fps: never through a wall (z ${w.z.toFixed(2)})`)
  const secs = (hurry: boolean) => { let v = { x: -6, z: 0, speed: 0, moving: false, back: BACK.hold as number }, t = 0; while (t < 5 && dist(v, slot) >= 0.65) { v = hurry ? homeStep(v, slot, 0, 1 / 60, undefined, kb) : { ...slotStep(v, slot, 0, 1 / 60, undefined, 0.3, kb), back: 1 }; t += 1 / 60 } return t }
  ok(secs(true) < secs(false), `home: quicker than its usual gait (${secs(true).toFixed(2)} s, usual ${secs(false).toFixed(2)})`)
  w = { x: 2.8, z: 2.1, speed: 0, moving: false, back: BACK.hold }; for (let i = 0; i < 100; i++) w = homeStep(w, slot, 0, 1 / 60)
  ok(w.back <= 0, 'home: after its hold in place, back to the usual gait') }
// 4d. s3b: the idle camera turning the keeper's yaw does not swing the formation; input off idle = the slots are where they were
{ const k: Keeper = { x: 0, z: 0, yaw: 0 }, f = makeFormation(() => [{ id: 'mm', kind: 'manamal', r: 0.3 }])
  f.tick(k, 1 / 60); const s0 = f.last().slots.mm; k.yaw = 2.5
  for (let i = 0; i < 120; i++) f.tick(k, 1 / 60, true)
  ok(dist(f.last().slots.mm, s0) < 1e-6, `idle: the slots hold still (${dist(f.last().slots.mm, s0).toFixed(2)})`)
  const rel = (p: Vec) => ({ x: p.x - k.x, z: p.z - k.z }), r0 = rel(s0)
  for (let i = 0; i < 120; i++) { const d = forwardOf(k.yaw); k.x += d.x * 3 / 60; k.z += d.z * 3 / 60; f.tick(k, 1 / 60) }
  ok(dist(rel(f.last().slots.mm), r0) > 2, 'not idle, walking: the slots turn with the keeper') }

// 5. THE REAL TROT: three spirits follow a keeper who walks up to the door, turns 180, walks back, stops, then walks
//    through the doorway. Each spirit's own nav = the wall padded by her radius. At rest: no two closer than their radii;
//    through the door: no step in the wall, and they pass one at a time.
{ const ms = doorTeam().filter(m => m.kind === 'spirit'), sps = ['fox', 'axolotl', 'owl'] as const
  const f = makeFormation(() => ms), k: Keeper = { x: 0, z: -4, yaw: 0 }
  const trots = ms.map((m, i) => { const nav: SpiritNav = { home: { x: -6 + i, z: -8 }, rMin: 0.2, rMax: 0.8, blocked: (x, z) => m.blocked!(x, z) || Math.abs(x) > 12 || Math.abs(z) > 12 }
    const tr = makeTrot(nav, 11 + i * 7, SPIRIT_MODELS[sps[i]]?.trot); tr.follow(() => ({ x: k.x, z: k.z, yaw: k.yaw, slot: f.last().slots[m.id] })); return tr })
  let inWall = 0, maxInDoor = 0
  const step = (n: number, move?: () => void) => { for (let i = 0; i < n; i++) { move?.(); f.tick(k, 1 / 60); let inDoor = 0
    trots.forEach((t, j) => { const p = t.step(1 / 60); if (WALL(p.x, p.z, ms[j].r - 0.05)) inWall++; if (Math.abs(p.z) < 0.5 + ms[j].r && Math.abs(p.x) < 1.5) inDoor++ }); maxInDoor = Math.max(maxInDoor, inDoor) } }
  const restCheck = (tag: string) => { const pos: Record<string, Vec> = {}; trots.forEach((t, j) => { const p = t.pose(); pos[ms[j].id] = p })
    const bad = spaced(pos, ms, k); ok(!bad, `trot ${tag}: at rest no two closer than their radii (${bad})`)
    ok(ms.every(m => behind(k, f.state().lagYaw, pos[m.id]) > 0.3), `trot ${tag}: all behind the keeper (${ms.map(m => behind(k, f.state().lagYaw, pos[m.id]).toFixed(2)).join(', ')})`) }
  step(60 * 8)                                              // they come to their places
  restCheck('start')
  step(60 * 1, () => { k.z -= 2 / 60 })                       // walk away from the wall (facing -z) to z -6
  k.yaw = Math.PI; step(60 * 1.5, () => { k.z += 2 / 60 })   // turn 180 (now facing +z) and walk back to z -3
  step(60 * 6); restCheck('after the turn + stop')
  step(60 * 3.5, () => { k.z += 2 / 60 })                    // walk on through the doorway to z +4
  step(60 * 8); restCheck('through the door, stopped')
  ok(inWall === 0, `trot: no spirit ever stood in the wall (${inWall})`)
  ok(trots.every(t => t.pose().z > 0.3), `trot: all three came through the doorway (z ${trots.map(t => t.pose().z.toFixed(2)).join(', ')})`)
  ok(maxInDoor <= 2, `trot: at most two in the doorway at once (single file; max ${maxInDoor})`) }

console.log(`follow-formation: ${pass} pass, ${fails.length} fail`)
for (const m of fails) console.log('  FAIL ' + m)
if (fails.length) process.exit(1)
