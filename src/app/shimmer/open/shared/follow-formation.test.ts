// M126 s1: THE FOLLOWER FORMATION (follow-formation.ts). Run: npx tsx src/app/shimmer/open/shared/follow-formation.test.ts
// Pure geometry (no page): the arc's spacing by body size, behind the keeper's facing, its lag, the stopped fan + outward
// faces, single file through a doorway in a wall, the fallback that never reaches through a wall; then the real spirit trot
// (ather/spirit-trot.ts) walking three spirits to their slots through that doorway, checked against the wall every step.
import { arcSlots, assignSlots, fileSlots, forwardOf, makeFormation, nearestFree, lineClear, slotStep, FORM, type Member, type Keeper, type Vec } from './follow-formation'
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
  ok(side(k, yaw, s.mm) > 0.3 && behind(k, yaw, s.mm) < behind(k, yaw, s.s2), `${tag}: the Mana'mal at heel, to the right, nearer than the arc`)
  ok(side(k, yaw, s.s1) < -0.5 && Math.abs(side(k, yaw, s.s2)) < 0.3 && side(k, yaw, s.s3) > 0.5, `${tag}: spirits left / back / right`)
  const outward = ['s1', 's2', 's3'].every(id => Math.abs(Math.atan2(Math.sin(s[id].face - Math.atan2(s[id].x - k.x, s[id].z - k.z)), Math.cos(s[id].face - Math.atan2(s[id].x - k.x, s[id].z - k.z)))) < 1e-6)
  ok(stopped ? outward : ['s1', 's2', 's3', 'mm'].every(id => Math.abs(s[id].face - Math.atan2(forwardOf(yaw).x, forwardOf(yaw).z)) < 1e-6), `${tag}: ${stopped ? 'face outward' : 'face the way the keeper walks'}`)
}
{ const k = { x: 0, z: 0, yaw: 0.3 }, a = arcSlots(k, 0.3, team(), false), b = arcSlots(k, 0.3, team(), true)
  ok(dist(b.s2, k) > dist(a.s2, k) * 1.1 && dist(b.s1, b.s3) > dist(a.s1, a.s3) * 1.1, `stopped: the arc fans out (back ${dist(a.s2, k).toFixed(2)} -> ${dist(b.s2, k).toFixed(2)}, span ${dist(a.s1, a.s3).toFixed(2)} -> ${dist(b.s1, b.s3).toFixed(2)})`) }
// bigger bodies spread wider: three spirits twice the size stay apart
{ const big: Member[] = [1, 2, 3].map(i => ({ id: `b${i}`, kind: 'spirit', r: 0.9 })), k = { x: 0, z: 0, yaw: 1 }, s = arcSlots(k, 1, big, false)
  ok(!spaced(s, big, k, FORM.gap - 0.01), `arc: three 0.9 m bodies are spread by size (${spaced(s, big, k, FORM.gap - 0.01)})`) }
// one spirit = straight behind
{ const k = { x: 0, z: 0, yaw: 0 }, s = arcSlots(k, 0, [{ id: 'a', kind: 'spirit', r: rFox }], false); ok(Math.abs(side(k, 0, s.a)) < 1e-6 && behind(k, 0, s.a) > 2, 'one spirit: straight behind') }

// 2. the lag: a 180 degree turn swings the slots round over time, not at once
{ const ms = team(), f = makeFormation(() => ms), k: Keeper = { x: 0, z: 0, yaw: 0 }
  for (let i = 0; i < 60; i++) f.tick(k, 1 / 60)
  const before = f.last().slots.s2; k.yaw = Math.PI; f.tick(k, 1 / 60); const just = f.last().slots.s2
  ok(dist(before, just) < 0.1 * 2 * dist(before, k), `lag: one frame after a 180 the back slot has moved under a tenth of its swing (${dist(before, just).toFixed(2)} m)`)
  for (let i = 0; i < 180; i++) f.tick(k, 1 / 60)
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

// 4. the Mana'mal's slot walk never steps into a wall
{ let s = { x: 2, z: -0.8, speed: 0, moving: false }, inWall = 0
  for (let i = 0; i < 300; i++) { s = slotStep(s, { x: 2, z: 1.5 }, 0, 1 / 60, wallFor(0.3)); if (WALL(s.x, s.z, 0.3)) inWall++ }
  ok(inWall === 0 && s.z < 0, `slotStep: a slot on the far side of a wall is not walked through (z ${s.z.toFixed(2)}, ${inWall} in the wall)`) }

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
