// ── A worn shell looks worn and fractured — the tier ladder, the cracks, and the host that maps them ──
// Run: npx tsx src/app/shimmer/voxel3d/shell-wear.test.ts
//
// Alex, 2026-09-02: "make a worn shell look worn and fractured." Before this a Threshold at 2 hp was
// pixel-identical to one at 20; the say-line was the only tell, and a say-line is the least reliable
// evidence a mechanic runs (the melee-payment mutation proved it the same evening). The picture is
// derived from `shellWear` and mapped through SHARED tiers, so this file can assert it without a GPU.

import { readFileSync } from 'node:fs'
import { spawnField, absorbShotAtVolume, shellWear, FIELD_HEIGHT } from '../engine/field-effects'
import { SHELL_TIERS, wearTier, tierOpacity, cracksForTier, crackSegments, CRACK_LIFT, CRACK_SEGMENTS } from './shell-cracks'
import { noComments, codeOnly } from '../testing/guard'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }
const GROUND = 60
const shell = (hp: number) => spawnField([], { moveId: 'threshold', x: 0, y: GROUND, z: 0, radius: 2.4, height: FIELD_HEIGHT,
  secs: 5, dps: 0, hps: 0, stopsShots: true, hp }, 0)

console.log('\n── A. wear is derived from the spawned hp, never from a second number ──')
{
  const f = shell(20)
  chk('a shell remembers what it was cast with (hpMax)', f[0].hpMax === 20)
  chk('as cast, wear is 0', shellWear(f[0]) === 0)
  const r1 = absorbShotAtVolume(f, 0, GROUND + 1, 0, 9)
  chk('after one 9-round on a 20 door, wear is 0.45', Math.abs(shellWear(r1.fields[0]) - 0.45) < 1e-9, `${shellWear(r1.fields[0])}`)
  const r2 = absorbShotAtVolume(r1.fields, 0, GROUND + 1, 0, 9)
  chk('after two, 0.9', Math.abs(shellWear(r2.fields[0]) - 0.9) < 1e-9)
  const wall = spawnField([], { moveId: 'firewall', x: 0, y: GROUND, z: 0, radius: 3, height: FIELD_HEIGHT, secs: 6, dps: 12, hps: 0, stopsShots: true, hp: 0 }, 0)
  chk('★ unbreakable cover is never worn — it has no body to wear', shellWear(wall[0]) === 0 && wall[0].hpMax === 0)
}

console.log('\n── B. the tier ladder ──')
{
  chk('tier 0 is exactly wear 0', wearTier(0) === 0)
  chk('★ the FIRST blow shows: any wear > 0 is at least tier 1', wearTier(0.001) === 1 && wearTier(0.05) === 1)
  chk('wear 0.45 (one round on a 20 door) is tier 2', wearTier(0.45) === 2)
  chk('wear 0.9 (two rounds) is the top tier', wearTier(0.9) === SHELL_TIERS - 1)
  chk('wear 1 is the top tier, never past it', wearTier(1) === SHELL_TIERS - 1 && wearTier(1.5) === SHELL_TIERS - 1)
  let mono = true, prev = -1
  for (let w = 0; w <= 1.0001; w += 0.01) { const t = wearTier(w); if (t < prev) mono = false; prev = t }
  chk('the ladder is monotonic over a sweep', mono)
  chk('★ a worn shell is a THINNER shell — opacity falls with tier, and never to nothing',
    tierOpacity(0, 0.17) === 0.17 && tierOpacity(SHELL_TIERS - 1, 0.17) < tierOpacity(1, 0.17) && tierOpacity(SHELL_TIERS - 1, 0.17) > 0.05)
}

console.log('\n── C. the cracks ──')
{
  chk('tier 0 has no cracks', cracksForTier(0) === 0 && crackSegments(0).length === 0)
  let more = true
  for (let t = 1; t < SHELL_TIERS; t++) if (!(cracksForTier(t) > cracksForTier(t - 1) && crackSegments(t).length > crackSegments(t - 1).length)) more = false
  chk('★ every tier is more fractured than the one before', more)
  const top = crackSegments(SHELL_TIERS - 1, 7)
  chk('a crack is line SEGMENTS: two xyz vertices each', top.length % 6 === 0 && top.length / 6 >= cracksForTier(SHELL_TIERS - 1) * CRACK_SEGMENTS)
  let onSurface = true, inHeight = true, fromRim = 0
  for (let i = 0; i < top.length; i += 3) {
    const r = Math.hypot(top[i], top[i + 2])
    if (Math.abs(r - CRACK_LIFT) > 1e-6) onSurface = false
    if (top[i + 1] > 0.5 + 1e-9 || top[i + 1] < -0.5 - 1e-9) inHeight = false
    if (Math.abs(top[i + 1] - 0.5) < 1e-9) fromRim++
  }
  // ⚠ Found by mutation: comparing against the constant passes whatever the constant is. The lift
  // must be pinned OUTSIDE the body, as a number, or the assert is a tautology.
  chk('★ every vertex sits at the lift radius', onSurface)
  chk('★ ...and the lift is strictly OUTSIDE the unit body, and only a hair (no z-fight, no halo)', CRACK_LIFT > 1.0 && CRACK_LIFT <= 1.05)
  chk('every vertex is within the unit slab\'s height', inHeight)
  chk('cracks start at the rim and run DOWN (a struck shell cracks from the edge)', fromRim >= cracksForTier(SHELL_TIERS - 1))
  const a = crackSegments(2, 11), b = crackSegments(2, 11), c = crackSegments(2, 12)
  chk('deterministic: the same shell cracks the same way every frame', a.length === b.length && a.every((v, i) => v === b[i]))
  chk('...and two shells crack differently', c.length !== a.length || !a.every((v, i) => v === c[i]))
}

console.log('\n── D. the host maps wear through SHARED tiers, and constructs nothing per frame ──')
{
  const src = readFileSync('src/app/shimmer/voxel3d/VoxelWorld.tsx', 'utf8')
  const nc = noComments(src), code = codeOnly(src)
  const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) || []).length
  chk('the loop reads wear from the engine (shellWear), once', count(code, /const wear = shellWear\(fd\)/) === 1)
  chk('the tier is the pure ladder, not a hand-rolled threshold', count(code, /const tier = wearTier\(wear\)/) === 1)
  chk('★ the body is pointed at a SHARED tier material (a swap, not a mutation)', count(code, /mesh\.material = shellMats\[tier\]/) === 1)
  chk('★ the cracks are pointed at a SHARED tier geometry', count(code, /cracks\.geometry = crackGeos\[tier\]/) === 1)
  chk('the crack lines follow the body exactly', count(code, /cracks\.scale\.copy\(mesh\.scale\)/) === 1 && count(code, /cracks\.position\.copy\(mesh\.position\)/) === 1)
  chk('the crack lines are retired with their field', count(code, /crackMeshes\.current\.delete\(id\)/) === 1)
  chk('the tier resources are built once, in useMemo', /const shellMats = useMemo\(/.test(code) && /const crackGeos = useMemo\(/.test(code) && /const crackMat = useMemo\(/.test(code))
  chk('a worn shell shivers: the pulse rate and amplitude read wear', /\* \(1 \+ wear \* 1\.5\)/.test(nc) && /\+ wear \* 0\.04/.test(nc))
  chk('★ no per-mesh opacity write anywhere in the field loop (that would be material state)', !/mesh\.material\.opacity\s*=/.test(code))
}

console.log(`\nshell-wear: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
