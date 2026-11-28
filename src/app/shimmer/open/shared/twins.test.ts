// M152 s1: the DB2 Twins model (gun-kit-twins.ts) and their sim numbers (twins-sim.ts). Run: npx tsx src/app/shimmer/open/shared/twins.test.ts
import { TWINS, twinsModel, TW_HALF, TW_BARRELS } from './gun-kit-twins'
import { trisOf, modelGeometry } from './gun-kit-geo'
import { TWINS_GUN, TWINS_REACH, TWINS_SHELL, TWINS_RELOAD, twinsBarrel, paper, shellAt, ttk, newcomerPair, withTwins } from './twins-sim'
import { RANGE_GUNS, stepGun, pairHand, type GunState, type Muzzle, type Round } from './gunplay'
import { M151, SHAMBLER, newCombat, stepTrigger, stepCombat, type Terrain } from '../ather/combat'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }
const L = TWINS.left, R = TWINS.right

// (1) the model: a matched pair, mirror images, every part inside a sidearm's size
ok(L.parts.length === R.parts.length && L.parts.length >= 40 && L.parts.length <= 140, `part count ${L.parts.length} (40..140), both guns the same`)
ok(L.parts.every(p => R.parts.some(q => p.c === q.c && p.shape === q.shape && Math.abs(p.o[0] + q.o[0]) < 1e-9 && p.o[1] === q.o[1] && p.o[2] === q.o[2] && p.s.every((v, k) => v === q.s[k]))), 'the right gun is the left gun mirrored across x')
for (const side of ['left', 'right'] as const) {
  const m = twinsModel(side), tris = trisOf(m), calls = modelGeometry(m).size
  ok(tris > 500 && tris < 6000, `${side}: ${tris} tris (a sidearm, under the family's long guns)`)
  ok(calls <= 6, `${side}: ${calls} draw calls (one per colour)`)
  const zs = m.parts.map(p => p.o[2]), ys = m.parts.map(p => p.o[1])
  ok(Math.min(...zs) > -0.25 && Math.max(...zs) < 0.13 && Math.min(...ys) > -0.14 && Math.max(...ys) < 0.04, `${side}: fits a sawn-off sidearm (about 0.37 m long)`)
  ok(m.optic === undefined && !m.parts.some(p => p.c === 'glass' || p.c === 'dot' || p.c === 'lens'), `${side}: no sight of any kind (M152: no sights)`)
}
// two barrels each, OVER AND UNDER (M150 family pass 11-28: the locked card stacks them), with two bores at the sawn end
const barrels = (g: typeof L) => g.parts.filter(p => p.shape === 'cyl' && p.axis === 'z' && p.c === 'iron' && Math.abs(p.s[0] - TW_BARRELS.d) < 1e-9)
const bores = (g: typeof L) => g.parts.filter(p => p.shape === 'cyl' && p.axis === 'z' && p.c === 'slot')
ok(barrels(L).length === 2 && barrels(R).length === 2 && bores(L).length === 2, 'two barrels and two bores on each gun')
ok([L, R].every(g => { const b = barrels(g); return b[0].o[0] === b[1].o[0] && Math.abs(b[0].o[1] - b[1].o[1]) >= TW_BARRELS.d }), 'the barrels stack over and under (same x, a barrel apart in y), as the locked card draws them')
ok([L, R].every(g => g.parts.filter(p => p.c === 'bronze' && p.shape === 'cyl' && p.axis === 'z').length === 2), 'a bronze band on each barrel')
// (2) ONE core in two halves: each gun a half, its split face flush with the gun's INNER side, the halves facing each other
const xs = (g: typeof L) => g.core.filter(p => p.c === 'core').map(p => [p.o[0] - p.s[0] / 2, p.o[0] + p.s[0] / 2])
ok(L.core.filter(p => p.c === 'core').length === 1 && R.core.filter(p => p.c === 'core').length === 1, 'one crystal half in each gun')
ok(Math.abs(xs(L)[0][1] - TW_HALF) < 1e-9 && Math.abs(xs(R)[0][0] + TW_HALF) < 1e-9, 'split faces flush with the inner sides (left +x, right -x)')
ok(xs(L)[0][0] > 0 && xs(R)[0][1] < 0, 'each half sits on its inner half of the gun (they face each other when held)')
ok(L.core.every(p => L.parts.includes(p)) && R.core.every(p => R.parts.includes(p)), 'the halves are part of each model')
// (3) the rune slots: LEFT = rune 1 (fires first, the birth-rune match), RIGHT = rune 2; each on its half's outer face
ok(L.rune === 1 && L.runeSlot.rune === 1 && R.rune === 2 && R.runeSlot.rune === 2, 'left holds rune 1, right rune 2')
ok(L.runeSlot.normal[0] === -1 && R.runeSlot.normal[0] === 1, 'each rune face looks outward (the visible face)')
ok([L, R].every(g => g.parts.some(p => p.c === 'etch' && p.o[0] === g.runeSlot.o[0] && p.o[1] === g.runeSlot.o[1])), 'each rune face is cut in the model')
ok(twinsBarrel(0) === 'left' && twinsBarrel(1) === 'right' && twinsBarrel(2) === 'left' && twinsBarrel(3) === 'right', 'rounds alternate, LEFT first')

// (4) the numbers (the shape Alex asked for), reproducible
const p = paper('twins'), roar = paper('roar'), rep = paper('repeater')
ok(TWINS_GUN.clip === 4 && TWINS_GUN.fireCd === 0.2 && TWINS_GUN.slot === 'SIDEARM', 'four rounds, 0.2 s apart, a sidearm')
ok(TWINS_GUN.reloadTime > roar.dumpSecs * 0 + 2.5 && TWINS_GUN.reloadTime > 2 * (RANGE_GUNS.find(g => g.id === 'repeater')!.reloadTime), 'a LONG reload (over 2.5 s, over twice the Repeater)')
ok(p.burst06 > 2 * roar.burst06 && p.burst06 > 4 * rep.burst06, `one-dump power: ${p.burst06} in 0.6 s vs Roar ${roar.burst06}, Repeater ${rep.burst06}`)
// M245 s2 (meaning MOVED: Alex 11-27 RETIRED the M152 'low sustained' ceiling, Twins 99/s vs Roar 82.3 at M245): the NEW design is
// "each hand has a double barrel so each hand alternates firing four shots at close with a slow reload". So: a clip of 2 barrels x
// 2 hands = 4, the 99 shell, a SLOW reload of both guns (2.6-3.0 s; 2.8), and the sustained rate IS that clip over that cycle.
ok(TWINS_GUN.clip === TW_BARRELS.n * 2 && TWINS_GUN.clip === 4 && TWINS_GUN.pair === true, 'a clip of FOUR (2 barrels x 2 hands), a pair')
ok(p.shell === TWINS_SHELL && TWINS_SHELL === 99 && TWINS_GUN.pellets === 8, `99 a shell, every pellet on (8 x ${TWINS_GUN.damage})`)
ok(TWINS_RELOAD >= 2.6 && TWINS_RELOAD <= 3.0 && TWINS_GUN.reloadTime === TWINS_RELOAD, `a SLOW reload of both guns: ${TWINS_RELOAD} s (2.6-3.0)`)
ok(Math.abs(p.sustained - 4 * 99 / (4 * 0.2 + TWINS_RELOAD)) < 1e-9, `sustained = the four-shot clip over its cycle: ${p.sustained.toFixed(1)}/s (Roar ${roar.sustained.toFixed(1)}, Repeater ${rep.sustained.toFixed(1)})`)
// the Ather's trigger (combat.ts): held, FOUR rounds leave L, R, L, R, then the gun reloads (no fifth until the reload is done)
{ const FLAT: Terrain = { heightAt: () => -50, walkable: () => true }, eye = { x: 0, y: 0, z: 0 }, aim = { x: 0, y: 0, z: -1 }
  const c = newCombat(5); c.gun = TWINS_GUN; c.keeper.ammo = TWINS_GUN.clip; c.mana = { cur: 1000 }
  const hands: { t: number; h?: string }[] = []; let reloadAt = -1
  const dt = 1 / 120
  for (let i = 0; i < Math.round(4 / dt); i++) {
    const t = i * dt; stepTrigger(c, eye, aim, false, true, dt)
    for (const e of c.events) if (e.kind === 'fired') hands.push({ t, h: e.hand })
    if (reloadAt < 0 && c.keeper.reloading > 0) reloadAt = t
    c.events.length = 0; stepCombat(c, FLAT, eye, dt)
  }
  const first4 = hands.slice(0, 4)
  ok(first4.map(x => x.h).join(',') === 'left,right,left,right', `Ather: the four rounds alternate hands, LEFT first (${first4.map(x => x.h).join(',')})`)
  ok(Math.abs(first4[3].t - 0.6) < 0.02 && reloadAt >= 0 && Math.abs(reloadAt - first4[3].t) < 0.02, `Ather: the reload starts on the 4th round (${first4[3]?.t.toFixed(2)} s, reload at ${reloadAt.toFixed(2)})`)
  ok(hands.length >= 5 && Math.abs(hands[4].t - first4[3].t - TWINS_RELOAD) < 0.05 && hands[4].h === 'left', `Ather: held, the 5th round leaves a reload later (${hands[4] ? (hands[4].t - first4[3].t).toFixed(2) : '-'} s), from the LEFT again`)
  // a single gun's 'fired' names no hand
  const r = newCombat(5); r.gun = RANGE_GUNS.find(g => g.id === 'repeater')!; r.keeper.ammo = r.gun.clip
  stepTrigger(r, eye, aim, false, true, dt); ok(r.events.some(e => e.kind === 'fired' && e.hand === undefined), 'a single gun\'s shot names no hand') }
// the bench / range trigger (gunplay stepGun): the same four, the muzzle names the hand
{ const g: GunState = { gun: TWINS_GUN, ammo: 4, reloading: 0, sinceShot: 99, bloom: 0, wasDown: false, burstLeft: 0, burstT: 0 } as GunState
  const out: Round[] = [], mz: Muzzle[] = []; let rl = -1
  for (let i = 0; i < 600; i++) { mz.push(...stepGun(g, 1 / 120, true, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, () => 0.5, out)); if (rl < 0 && g.reloading > 0) rl = i / 120 }
  ok(mz.slice(0, 4).map(m => m.hand).join(',') === 'left,right,left,right' && out.length >= 32, `bench: four muzzles L,R,L,R (${mz.slice(0, 4).map(m => m.hand).join(',')}), 8 pellets each`)
  ok(rl > 0 && Math.abs(g.gun.reloadTime - TWINS_RELOAD) < 1e-9 && mz.length === 8, `bench: then the ${TWINS_RELOAD} s reload (${mz.length} muzzles in 5 s = two clips)`)
  ok(pairHand(4) === 'left' && pairHand(5) === 'right', 'pairHand: the hand of the n-th round') }
ok(Math.abs(p.reach - TWINS_REACH) < 1e-9 && TWINS_REACH < 9, 'spent before 9 m')
const near = shellAt('twins', 2, 60), mid = shellAt('twins', 5, 60), far = shellAt('twins', 8, 60), gone = shellAt('twins', 10, 30)
ok(near > 0.95 * p.shell && mid < 0.6 * near && far < 0.25 * near && gone === 0, `falloff: 2 m ${near.toFixed(1)}, 5 m ${mid.toFixed(1)}, 8 m ${far.toFixed(1)}, 10 m ${gone}`)
ok(shellAt('twins', 5, 60) === mid, 'the sim is deterministic (same seeds, same number)')
ok(ttk('twins', 2, 100, 20) < ttk('roar', 2, 100, 20), 'point blank the Twins kill a keeper faster than the Roar')
// M245 s2: on today's shambler (150 hp since M245; this read the pre-M245 45, which the 2.8 s reload put at 2.9x), same 3x bar
{ const a = ttk('twins', 8, SHAMBLER.hp, 20), b = ttk('repeater', 8, SHAMBLER.hp, 20); ok(a > 3 * b, `at 8 m they are far slower than the starter on a shambler (${a.toFixed(2)} vs ${b.toFixed(2)} s)`) }
// (5) the 6% rule as carried (Repeater + Twins), and the sim puts the rack back
const pair = newcomerPair(100)
ok(pair.champ.died <= 6 && pair.pack.died === 0, `6% rule: ${pair.champ.died}/100 champion deaths with the Twins as the sidearm`)
ok(!RANGE_GUNS.some(g => g.id === 'twins') && !M151.hold.includes('twins'), 'the game rack is untouched after the sim (the Twins are not wired)')
ok(withTwins(() => RANGE_GUNS.some(g => g.id === 'twins')), 'withTwins racks them for the sim only')

console.log(`twins: ${pass}/${fails.length}`); for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
