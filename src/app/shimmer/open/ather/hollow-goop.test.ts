// ather/hollow-goop.ts: no light of its own; what it borrows is the ground under it, greyer toward the drain.
import { BIOME } from './wilds'
import { biomeGround, greyAt, greyStep, borrowedGround, goopMaterial, groundEnv, releaseGroundEnvs, groundEnvCount, GREY_NEAR, GREY_FAR, GREY_STEPS, DRAIN } from './hollow-goop'

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
  // M130: rows run from straight down (row 0, v = 0 in three's equirectUv) to straight up; scripts/m130-reflection-check.mts renders it
  const low = row(0), top = row(31), dl = (c.image.data as Uint8Array)
  ok(a.flipY === false, 'no flipY on top of the row order')
  ok(low[1] > low[0] && low[1] > low[2], `the good-ground env's lower half is that ground's green (${low})`)
  ok(top[2] > top[1] && top[1] > top[0], `its upper half is the sky's blue (${top})`)
  ok(Math.abs(dl[0] - dl[1]) < 8, 'the drained env\'s lower half is grey') }

// M34 heap: leaving the Wilds frees every cached env (texture + its PMREM copy via the dispose event) and empties the cache
{ let disposed = 0; a.addEventListener('dispose', () => disposed++); c.addEventListener('dispose', () => disposed++)
  const had = groundEnvCount(), freed = releaseGroundEnvs()
  ok(had >= 2 && freed === had && groundEnvCount() === 0, `release frees all ${had} cached envs, count is 0 after (${groundEnvCount()})`)
  ok(disposed === 2, `each released env fires dispose (three drops its GPU + PMREM copies on it): ${disposed}`)
  ok(groundEnv('#9cc46a') !== a && groundEnvCount() === 1, 'the next Wilds visit builds a fresh one') }

ok(biomeGround(BIOME.woods) !== biomeGround(BIOME.rock) && /^#[0-9a-f]{6}$/.test(biomeGround(BIOME.woods)), 'each biome borrows its own painted colour')
console.log(`hollow-goop: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
