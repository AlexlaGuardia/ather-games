// npx tsx src/app/shimmer/open/ather/combat-skin.test.ts
// M59 THE MANA SKIN: a field's shell (Threshold 20, Overpressure 60) is worn by the keeper standing in it; every blow drains
// it before health, it pops ONCE at 0 and the field goes with it; the EMP (stripSkin) pops it outright.
import { newCombat, spawnHollow, stepCombat, hurtKeeper, applyNetHurt, skinOf, stripSkin, SHAMBLER, type Terrain, type CombatEvent } from './combat'
import { runCast, stepFields } from './combat-casts'
import { castForMove } from '../../play3d/cast'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const T: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain
const eye = { x: 0, y: 1.6, z: 0 }
const fwd = (d: number) => { const l = Math.hypot(1.6, d); return { x: 0, y: -1.6 / l, z: -d / l } }
/** a combat with the given field cast; the keeper's feet put inside it (or at `feet`) by one quiet step */
function withField(move: string, feet?: { x: number; z: number }) {
  const c = newCombat(1)
  runCast(c, T, eye, fwd(4), castForMove(move))
  const f = c.fields![0], at = feet ?? { x: f.x, z: f.z }
  stepCombat(c, T, { x: at.x, y: 0, z: at.z }, 0.001)
  return { c, f }
}
const kinds = (es: CombatEvent[]) => es.map(e => e.kind)

// Threshold carries a 20 skin; standing in it, skinOf reports it
{ const { c, f } = withField('threshold')
  ok(f.shell === 20 && f.shellMax === 20, `threshold: field carries its 20 shell (${f.shell}/${f.shellMax})`)
  const s = skinOf(c); ok(s.skin === 20 && s.skinMax === 20, `skinOf inside = 20/20 (${JSON.stringify(s)})`) }
// Overpressure (castRange 0, under the keeper) carries 60
{ const { c } = withField('overpressure'); ok(skinOf(c).skin === 60, `overpressure: 60 skin (${skinOf(c).skin})`) }
// standing OUTSIDE the disc: no skin, the blow lands on health
{ const { c } = withField('threshold', { x: 40, z: 40 }); c.events = []
  ok(skinOf(c).skin === 0, 'outside: no skin')
  hurtKeeper(c, 14); ok(c.keeper.hp === 86 && kinds(c.events).join() === 'hurt', `outside: health takes it (${c.keeper.hp}, ${kinds(c.events)})`) }
// a field with no shell (Healing Grove) grants nothing
{ const { c } = withField('healing-grove'); ok(skinOf(c).skin === 0 && c.fields![0].shell === undefined, 'grove: no skin') }

// DAMAGE ORDER: skin first, health untouched until the pop, the spill goes to health, the pop fires exactly once
{ const { c, f } = withField('threshold'); c.events = []
  hurtKeeper(c, 14)
  ok(c.keeper.hp === 100 && f.shell === 6, `blow 1: skin 20 -> 6, health untouched (hp ${c.keeper.hp}, shell ${f.shell})`)
  ok(kinds(c.events).join() === 'skin' && (c.events[0] as { absorbed: number }).absorbed === 14, `blow 1 events: one skin tick of 14 (${JSON.stringify(c.events)})`)
  ok(c.keeper.sinceHurt > 0, 'a blow the skin swallows whole does not restart the regen delay')
  c.events = []; hurtKeeper(c, 14)
  ok(f.shell === 0 && c.keeper.hp === 92, `blow 2: skin takes 6 and pops, 8 spills to health (hp ${c.keeper.hp})`)
  ok(kinds(c.events).join() === 'skin,skin-pop,hurt', `blow 2 events in order skin, skin-pop, hurt (${kinds(c.events)})`)
  ok(f.popped === true && f.until <= (c.clock ?? 0), 'popped: the field is gone with its skin')
  c.events = []; hurtKeeper(c, 14)
  ok(c.keeper.hp === 78 && !kinds(c.events).includes('skin-pop') && !kinds(c.events).includes('skin'), `blow 3: no second pop, straight to health (${kinds(c.events)})`)
  ok(skinOf(c).skin === 0, 'after the pop: skinOf 0')
  stepFields(c, T, { x: f.x, z: f.z }); ok((c.fields ?? []).length === 0, 'the popped field is swept on the next field step') }
// an exact-size blow pops with no spill
{ const { c } = withField('threshold'); c.events = []
  hurtKeeper(c, 20); ok(c.keeper.hp === 100 && kinds(c.events).join() === 'skin,skin-pop', `exact blow: pop, no hurt (${kinds(c.events)})`) }
// the frame's defence applies BEFORE the skin (Large takes 0.9)
{ const { c, f } = withField('overpressure'); c.keeper.takes = 0.9; c.events = []
  hurtKeeper(c, 20); ok(f.shell === 42, `frame first: 20 x 0.9 = 18 off the skin (shell ${f.shell})`) }
// the guest path (applyNetHurt) goes through the skin too
{ const { c, f } = withField('threshold'); applyNetHurt(c, 14); ok(f.shell === 6 && c.keeper.hp === 100, `net hurt drains the skin (${f.shell}, ${c.keeper.hp})`) }
// a real Shambler lunge, through stepCombat, lands on the skin
{ const { c, f } = withField('overpressure'); const h = spawnHollow(c, T, f.x, f.z - 0.8); h.state = 'lunge'; h.lx = 0; h.lz = 1; h.hitThisLunge = false
  stepCombat(c, T, { x: f.x, y: 0, z: f.z }, 0.016)
  ok(f.shell === 60 - SHAMBLER.damage && c.keeper.hp === 100, `lunge: skin ${f.shell}, hp ${c.keeper.hp}`) }
// expiry is QUIET: the field running out is not a pop
{ const { c, f } = withField('threshold'); c.events = []; const evs: string[] = []
  for (let i = 0; i < 140; i++) { stepFields(c, T, { x: f.x, z: f.z }); stepCombat(c, T, { x: f.x, y: 0, z: f.z }, 0.05); evs.push(...kinds(c.events)) }
  ok((c.fields ?? []).length === 0 && !evs.includes('skin-pop') && skinOf(c).skin === 0, `expiry: gone quietly (${(c.fields ?? []).length} fields, pop ${evs.includes('skin-pop')})`) }
// THE EMP: stripSkin pops it outright, once; nothing to strip = false
{ const { c, f } = withField('overpressure'); c.events = []
  ok(stripSkin(c) === true && f.shell === 0 && kinds(c.events).join() === 'skin-pop', `EMP: strips and pops (${kinds(c.events)})`)
  c.events = []; ok(stripSkin(c) === false && c.events.length === 0, 'EMP again: nothing left, no second pop')
  hurtKeeper(c, 10); ok(c.keeper.hp === 90, 'after the EMP: blows reach health') }
// overlapping skins: the fuller one takes the blow
{ const c = newCombat(1); runCast(c, T, eye, fwd(0.5), castForMove('threshold')); runCast(c, T, eye, fwd(0.5), castForMove('overpressure'))
  const [th, op] = c.fields!; stepCombat(c, T, { x: op.x, y: 0, z: op.z }, 0.001)
  const inBoth = Math.hypot(th.x - op.x, th.z - op.z) <= th.r
  hurtKeeper(c, 10); ok(inBoth && op.shell === 50 && th.shell === 20, `overlap: the 60 takes it, the 20 waits (op ${op.shell}, th ${th.shell}, both ${inBoth})`) }
// a downed keeper takes nothing, skin included
{ const { c, f } = withField('threshold'); c.keeper.hp = 0; hurtKeeper(c, 14); ok(f.shell === 20, 'downed: skin untouched') }

console.log(`combat-skin: ${pass} passed, ${fail} failed`); if (fail) process.exit(1)
