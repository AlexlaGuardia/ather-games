// The Hollow look's seam. Run: npx tsx src/app/shimmer/voxel3d/hollow-look.test.ts
//
// ★★★ THIS FILE IS THE PRICE OF A DEV PAGE. `dev/grey` exists so a look can be judged instead of
// calculated — I sized a self-light value from arithmetic against the night rig, never saw it, and
// Alex's verdict was "looking terrible". But a preview only helps if it shows what SHIPS, and
// `dev/ring`'s header already states the rule: a preview that re-derives can be perfectly correct
// while the game is wrong. So the guard here is not about the numbers, it is about the SEAM.

import { readFileSync } from 'node:fs'
import { codeOnly } from '../testing/guard'
import { HOLLOW_LOOK, createHollowGeo, createHollowMat, applyHollowLook, type HollowLook } from './hollow-look'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const FORMS = ['warden', 'stalker', 'caster'] as const

// ── 1. ★★ THE MATERIALS ARE BUILT FROM THE DIALS, NOT FROM LITERALS ─────────────────────────────
// If a colour were hard-coded in the factory, the slider would move a number the mesh never reads —
// a page that responds to nothing, or worse, responds to some things and not others.
{
  const mats = createHollowMat(HOLLOW_LOOK)
  for (const f of FORMS) {
    ok(mats[f].color.getHex() === HOLLOW_LOOK.colour[f], `${f} takes its colour from the dials`)
    ok(mats[f].emissive.getHex() === HOLLOW_LOOK.colour[f], `${f}'s self-light is its OWN hue, never a tint`)
    ok(mats[f].emissiveIntensity === HOLLOW_LOOK.selfLight, `${f} takes the self-light from the dials`)
    ok(mats[f].opacity === HOLLOW_LOOK.opacity[f], `${f} takes its opacity from the dials`)
  }

  // A DIFFERENT look must produce different materials, or section 1 is passing on coincidence.
  const other: HollowLook = { selfLight: 0.42, colour: { warden: 0x112233, stalker: 0x445566, caster: 0x778899 }, opacity: { warden: 0.5, stalker: 0.4, caster: 0.3 } }
  const m2 = createHollowMat(other)
  ok(m2.warden.color.getHex() === 0x112233 && m2.warden.emissiveIntensity === 0.42,
     '★ a different set of dials builds different materials — the factory is not returning constants')
  for (const m of [...Object.values(mats), ...Object.values(m2)]) m.dispose()
}

// ── 2. ★★ applyHollowLook MUTATES IN PLACE, because a slider must not allocate ──────────────────
// Rebuilding on every drag is a shader program per frame — the allocation that got this page
// blocked from WebGL on 2026-08-06.
{
  const mats = createHollowMat(HOLLOW_LOOK)
  const before = mats.stalker
  applyHollowLook(mats, { selfLight: 0.33, colour: { warden: 0x010203, stalker: 0x040506, caster: 0x070809 }, opacity: { warden: 0.1, stalker: 0.2, caster: 0.3 } })
  ok(mats.stalker === before, 'the SAME material object is still there — nothing was reallocated')
  ok(mats.stalker.emissiveIntensity === 0.33, 'and it carries the new self-light')
  ok(mats.stalker.color.getHex() === 0x040506, 'and the new colour')
  ok(mats.stalker.emissive.getHex() === 0x040506, 'with the emissive following the colour, still no tint')
  ok(mats.stalker.opacity === 0.2, 'and the new opacity')
  for (const m of Object.values(mats)) m.dispose()
}

// ── 3. THE GEOMETRIES ARE THE THREE SILHOUETTES, AND EACH BUILD IS A FRESH SET ──────────────────
// Shared per WORLD, never per body — but two callers (the world and the dev page) must not be
// handed the same objects, or one page's dispose kills the other's meshes.
{
  const a = createHollowGeo(), b = createHollowGeo()
  for (const f of FORMS) ok(a[f] !== b[f], `${f}'s geometry is per-caller, so one dispose cannot blank the other`)
  ok(a.warden.type === 'IcosahedronGeometry', 'the warden is squat and wide')
  ok(a.stalker.type === 'ConeGeometry', 'the stalker is thin and tall')
  ok(a.caster.type === 'OctahedronGeometry', 'the caster is small and hovering')
  for (const g of [...Object.values(a), ...Object.values(b)]) g.dispose()
}

// ── 4. ★★★ THE SEAM: THE WORLD AND THE PAGE BUILD FROM THE SAME SOURCE ──────────────────────────
// Sections 1-3 are green with `VoxelWorld` still holding its own inline copy of the materials — the
// state that made this look unjudgeable in the first place.
{
  const world = codeOnly(readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8'))
  const page = codeOnly(readFileSync(new URL('../dev/grey/page.tsx', import.meta.url), 'utf8'))

  ok(/createHollowMat\(\)/.test(world), 'the world builds its materials from the shared factory')
  ok(/createHollowGeo\(\)/.test(world), 'and its geometries')
  ok(!/IcosahedronGeometry|ConeGeometry\(0\.38/.test(world),
     '★ and holds NO inline copy of the silhouettes — that copy is what made the look unjudgeable')
  ok(!/MeshLambertMaterial\(\{ color: 0x3f423d/.test(world), 'nor of the greys')

  ok(/createHollowMat\(look\)/.test(page), 'the page builds from the same factory, varying the dials')
  ok(/applyHollowLook\(/.test(page), 'and re-points them in place rather than reallocating')
  ok(/HOLLOW_LOOK\.colour/.test(page), 'starting from the SHIPPED values, so load == what the game draws')
  ok(!/0x3f423d|0x4a4d47|0x474f58/.test(page), '⚠ and the page restates no colour of its own')

  // ⚠ THE CLOCK. The rig reads dayProgress(), so a page-local hour would light the scene by a rule
  // the world does not have — and setTimePin is MODULE state, so leaving it pinned darkens the app.
  ok(/setTimePin\(hour \* 24\)/.test(page), 'the page pins the clock through the shipped mechanism')
  ok(/return \(\) => setTimePin\(null\)/.test(page), '★ and RELEASES it on unmount — a dev tool must not leave the game at midnight')
  ok(/<VoxelDayNight \/>/.test(page), 'and lights the scene with the real rig, not a hand-lit approximation')
}

// ── 5. THE SHIPPED DIALS ARE IN A BAND THAT MEANS SOMETHING ─────────────────────────────────────
// ⚠ Not a look ruling — a range. Alex rules the value; this only refuses the two ends that are
// definitionally wrong.
{
  ok(HOLLOW_LOOK.selfLight >= 0, 'self-light is not negative')
  ok(HOLLOW_LOOK.selfLight < 0.5, 'and under a half, past which the grey reads as a light source')
  for (const f of FORMS) {
    ok(HOLLOW_LOOK.opacity[f] > 0.2, `${f} is a body, not a rumour`)
    ok(HOLLOW_LOOK.opacity[f] <= 1, `${f}'s opacity is a fraction`)
  }
}

console.log(`hollow-look: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
