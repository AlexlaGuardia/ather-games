// ather/hollow-goop.ts: no light of its own; what it borrows is the ground under it, greyer toward the drain.
import { BIOME } from './wilds'
import { biomeGround, greyAt, greyStep, borrowedGround, goopMaterial, groundEnv, GREY_NEAR, GREY_FAR, GREY_STEPS, DRAIN } from './hollow-goop'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const nodes = [{ x: 0, z: 0 }, { x: 500, z: 0 }]
ok(greyAt(0, 0, nodes) === 1 && greyAt(GREY_NEAR - 1, 0, nodes) === 1, 'at the sump: fully drained')
ok(greyAt(GREY_FAR + 1, 0, nodes) === 0 && greyAt(250, 0, nodes) === 0, 'far from any node: good ground')
ok(greyAt(35, 0, nodes) > 0 && greyAt(35, 0, nodes) < 1 && greyAt(20, 0, nodes) > greyAt(40, 0, nodes), 'between: greyer the nearer')
ok(greyAt(495, 0, nodes) === 1, 'the NEAREST node counts')
ok(greyAt(0, 0, []) === 0, 'no infected nodes: nothing drained')
ok(greyStep(0) === 0 && greyStep(1) === GREY_STEPS && greyStep(0.5) === GREY_STEPS / 2, 'grey quantizes to its env steps')
ok(borrowedGround('#9cc46a', 0) === '#9cc46a', 'step 0 borrows the biome colour itself')
ok(borrowedGround('#9cc46a', GREY_STEPS) === DRAIN, 'the last step is the drain grey')
const m = goopMaterial()
ok(m.emissive.getHex() === 0 && m.emissiveIntensity >= 0 && !m.emissiveMap, 'the goop owns NO light (emissive black, no map)')
ok(m.roughness < 0.3 && m.metalness === 0, 'wet (low roughness), not metal')
ok(m.color.r < 0.02 && m.color.g < 0.02 && m.color.b < 0.02, 'diffuse dead dark')
const a = groundEnv('#9cc46a'), b = groundEnv('#9cc46a'), c = groundEnv(DRAIN)
ok(a === b && a !== c, 'envs are cached per ground colour')
{ const d = a.image.data as Uint8Array, row = (y: number) => [d[(y * 64) * 4], d[(y * 64) * 4 + 1], d[(y * 64) * 4 + 2]]
  const low = row(31), dl = (c.image.data as Uint8Array)
  ok(low[1] > low[0] && low[1] > low[2], `the good-ground env's lower half is that ground's green (${low})`)
  ok(Math.abs(dl[31 * 64 * 4] - dl[31 * 64 * 4 + 1]) < 8, 'the drained env\'s lower half is grey') }

ok(biomeGround(BIOME.woods) !== biomeGround(BIOME.rock) && /^#[0-9a-f]{6}$/.test(biomeGround(BIOME.woods)), 'each biome borrows its own painted colour')
console.log(`hollow-goop: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
