/**
 * THE BODY CASTS IN PLAY3D — Thunder Step, Updraft, Overcharge and Gate on the tile walker (2026-09-28).
 * Run: `npx tsx src/app/shimmer/play3d/body-cast.test.ts`
 */
import { readFileSync } from 'node:fs'
import { launchVy, blinkLand, flatAim, sightClear, GATE_MIN_REACH } from './body-cast'
import { castForMove } from './cast'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

// A. the launch: a floor on vertical speed, never an addition and never a cut
ok(launchVy(13.5, 0) === 13.5, 'from the ground, the whole lift')
ok(launchVy(13.5, -9) === 13.5, '★ mid-fall, the fall is cancelled: the whole lift, not lift minus the fall')
ok(launchVy(4.2, 10) === 10, '★ already rising faster: never cut (Overcharge off an Updraft keeps the climb)')
ok(launchVy(4.2, 10) !== 14.2, 'and never stacked into the skybox')
ok(launchVy(0, -3) === -3, 'a launch with no lift leaves the fall alone')

// B. the blink: aimed at the destination, searched back toward the caster
const open = () => true
const far = blinkLand(0, 0, 12, 0, open)
ok(!!far && far.x === 12 && far.dist === 12, 'open ground: it goes exactly as far as the reticle says')
const wallAt8 = (x: number) => x < 7.5
const short = blinkLand(0, 0, 12, 0, wallAt8)
ok(!!short && short.x < 7.5 && short.x >= 6, '★ a wall at 8: she lands at the last standable cut short of it, not at the first step')
ok(blinkLand(0, 0, 12, 0, () => false) === null, 'nothing on the line holds her: null, and the host says so')
const aim = flatAim(0, -3, 5, 5, 12)
ok(Math.abs(aim.x - 5) < 1e-9 && Math.abs(aim.z - -7) < 1e-9, 'the aim is FLAT and walks the full range, whatever the forward length')

// C. the Gate's sight line (RULED 09-28: both ends in the caster's sight)
const flat = () => 0
ok(sightClear(0, 1.6, 0, 12, 1.6, 0, flat), 'open ground: seen')
const wall = (cx: number) => (cx === 6 ? 3 : 0)
ok(!sightClear(0, 1.6, 0, 12, 1.6, 0, wall), '★ a wall taller than the eye line between them: not seen')
const lowWall = (cx: number) => (cx === 6 ? 1 : 0)
ok(sightClear(0, 1.6, 0, 12, 1.6, 0, lowWall), 'a waist-high wall does not hide the far end')
ok(!sightClear(0, 1.6, 0, 12, 1.6, 0, (cx) => (cx === 4 ? Infinity : 0)), 'a solid tile or the world edge always blocks')
ok(GATE_MIN_REACH > 1, 'the far end must be somewhere else')

// D. the specs this path runs
for (const id of ['thunder-step', 'updraft', 'overcharge']) ok(castForMove(id).archetype === 'impulse', `${id} is an impulse`)
ok(castForMove('thunder-step').motion === 'blink' && castForMove('thunder-step').castRange > 0, 'Thunder Step blinks and has a reach')
ok(castForMove('updraft').impulseUp > castForMove('updraft').impulseFwd, 'Updraft is vertical')
ok(castForMove('overcharge').impulseFwd > castForMove('overcharge').impulseUp, 'Overcharge is horizontal')

// E. the host: play3d dispatches them to the walker, and the walker applies them before its velocity pass
const p3 = readFileSync('src/app/shimmer/play3d/Shimmer3D.tsx', 'utf8')
ok(p3.includes("case 'impulse': {") && p3.includes("case 'gate': {"), '★★ play3d runs impulse and gate (no longer "not in this world yet")')
const applyAt = p3.indexOf('const bc = bodyCastRef?.current')
const velAt = p3.indexOf('// ── HORIZONTAL VELOCITY')
ok(applyAt > 0 && velAt > applyAt, '★ the body cast lands BEFORE the velocity pass (after it, the next pass overwrites the launch)')
ok(p3.includes('the far end must be in sight') && p3.includes('refund: { slot: bc.slot, mana: bc.manaCost }'), '★ a blind or groundless strike refunds and says why')
ok(p3.includes('stepSpiral(sp, p.x, p.y, p.z') && p3.includes('pool.current = Math.max(0, pool.current - st.drain)'), 'the spiral bills the pool and steps the body through')
ok(p3.includes('useEffect(() => { spiralRef.current = null; bodyCastRef.current = null }, [zone.id])'), '★ it never leaves the zone')
ok(p3.includes("spec.archetype === 'gate' && spiralRef.current?.moveId === moveId"), 'a re-press lets the spiral go, before the cooldown gate')
ok(p3.includes('— no room to step'), 'a blink that found no room says so')

console.log(`body-cast: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
