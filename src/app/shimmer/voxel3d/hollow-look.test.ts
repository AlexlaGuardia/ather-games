// The Hollow look's seam. Run: npx tsx src/app/shimmer/voxel3d/hollow-look.test.ts
//
// ★★★ THIS FILE IS THE PRICE OF A DEV PAGE. `dev/grey` exists so a look can be judged instead of
// calculated — I sized a self-light value from arithmetic against the night rig, never saw it, and
// Alex's verdict was "looking terrible". But a preview only helps if it shows what SHIPS, and
// `dev/ring`'s header already states the rule: a preview that re-derives can be perfectly correct
// while the game is wrong. So the guard here is not about the numbers, it is about the SEAM.

import { readFileSync } from 'node:fs'
import { codeOnly, strip } from '../testing/guard'
import { HOLLOW_LOOK, createHollowGeo, createHollowMat, applyHollowLook, goopSurface, goopRoughness,
         setHollowBorrow, BORROW, type HollowLook } from './hollow-look'
import { skyEnvironment, borrowedSky, NIGHT_BORROW } from './sky-env'
import { SKY } from './sky-palette'

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

  // ★★ THE SEAM MOVED ONE HOP AND IS STILL A SEAM (2026-09-06, sprites lane). These two lines used
  // to read `createHollowMat()` and `createHollowGeo()` straight out of `VoxelWorld`, and they went
  // red on the commit that gave the world a MODELLED body — correctly. The world no longer builds a
  // primitive at all; it builds `createHollowMeshBody`, and THAT module clones `createHollowMat`.
  // ⚠ The claim being guarded never changed: the world and the page must draw from one source. So
  // the assert follows the source rather than being deleted, and it now has to hold at BOTH ends —
  // the world reaching the body factory, and the body factory reaching the look factory. Dropping
  // the second half would leave a guard that passes while `hollow-mesh` invents its own grey.
  const meshMod = codeOnly(readFileSync(new URL('./hollow-mesh.ts', import.meta.url), 'utf8'))
  ok(/createHollowMeshBody\(/.test(world), 'the world builds the MODELLED body, not a primitive')
  ok(/createHollowMat\(\)/.test(meshMod), 'and that body clones its materials from the shared factory')
  ok(!/new THREE\.MeshStandardMaterial|setHex|new THREE\.Color/.test(meshMod),
     '★ and invents no colour of its own — the emissive question is canon\'s and is still open')
  ok(!/IcosahedronGeometry|ConeGeometry\(0\.38/.test(world),
     '★ and holds NO inline copy of the silhouettes — that copy is what made the look unjudgeable')
  // ⚠ `createHollowGeo` KEEPS A CONSUMER, and this asserts it rather than assuming it. The world was
  // its main caller; if `/shimmer/dev/grey` ever stops calling it too, it becomes an exported
  // primitive nobody draws — the unwired-module shape this line of work has now hit four times.
  ok(/createHollowGeo\(\)/.test(page),
     '⚠ the three flat silhouettes still have a consumer — the grey bench judges the LOOK against them')
  ok(!/MeshLambertMaterial\(\{ color: 0x3f423d/.test(world), 'nor of the greys')

  ok(/createHollowMat\(look\)/.test(page), 'the page builds from the same factory, varying the dials')
  ok(/applyHollowLook\(/.test(page), 'and re-points them in place rather than reallocating')
  ok(/HOLLOW_LOOK\.colour/.test(page), 'starting from the SHIPPED values, so load == what the game draws')
  // ⚠ DERIVED, NEVER RESTATED. This listed the three greys as literals — so the day anyone retuned
  // HOLLOW_LOOK.colour the assert would have gone on guarding three colours that no longer ship,
  // green by asking about a world that had stopped existing (the 2026-09-05 disarmed-guard shape).
  for (const f of FORMS) {
    const hex = `0x${HOLLOW_LOOK.colour[f].toString(16)}`
    ok(!page.includes(hex), `⚠ the page restates no colour of its own (${f} ${hex})`)
  }

  // ⚠ THE CLOCK. The rig reads dayProgress(), so a page-local hour would light the scene by a rule
  // the world does not have — and setTimePin is MODULE state, so leaving it pinned darkens the app.
  ok(/setTimePin\(hour \* 24\)/.test(page), 'the page pins the clock through the shipped mechanism')
  ok(/return \(\) => setTimePin\(null\)/.test(page), '★ and RELEASES it on unmount — a dev tool must not leave the game at midnight')
  ok(/<VoxelDayNight \/>/.test(page), 'and lights the scene with the real rig, not a hand-lit approximation')
}

// ── 4b. AND THE RULE IS THE RULE, NOT THE FILE IT WAS FIRST WRITTEN ABOUT ───────────────────────
// ★★★ THE BENCH THIS GUARD DID NOT NAME IS THE ONE EVERY LOOK CALL WAS MADE ON. Block 4 asserts
// `dev/grey` mounts the shipped rig, and `dev/grey` always did. `dev/hollow` — added later, made
// the DEFAULT Hollow bench, and the page Alex judged the ghost, the solid texture and "it still
// looks the same" on — hand-lit itself with six local values, and every one was darker than the
// world: hemi 0.8 vs 1.5, sun 0.9 vs 1.5, a near-black hemi ground against #3b3a4a, plus cast
// shadows the world does not draw. Roughly 55% of the world's daylight.
//
// ⚠⚠ IT MANUFACTURED A FINDING. Row #1047 — "the Hollow reads too DARK in daylight" — named two
// causes and called it Alex's: lift the creature's grey, or lift the room. It was the ROOM, and
// lifting the grey would have brightened the creature to compensate for an under-lit bench and
// then shipped it too light in a world nearly twice as bright. A fix that moves the needle for
// the wrong reason is invisible from inside the result.
//
// So this block asserts the RULE across every Hollow bench, not the file the rule was found in.
{
  const benches = ['../dev/grey/page.tsx', '../dev/hollow/page.tsx'] as const
  for (const rel of benches) {
    const src = codeOnly(readFileSync(new URL(rel, import.meta.url), 'utf8'))
    ok(/<VoxelDayNight \/>/.test(src), `${rel} lights itself with the SHIPPED rig`)
    // ⚠ The ban is on the AMBIENT/SUN rig only. A bench may still hang a local prop lamp — the
    // tended plot's warm pointLight is the whole point of that half of dev/hollow.
    ok(!/<hemisphereLight/.test(src), `★ ${rel} builds no hemisphere of its own`)
    ok(!/<directionalLight/.test(src), `★ ${rel} builds no sun of its own`)
    ok(/setTimePin\(/.test(src), `${rel} moves the WORLD's clock, not a page-local hour`)
    ok(/return \(\) => setTimePin\(null\)/.test(src),
       `★ ${rel} releases the pin on unmount — a dev tool must not leave the game at midnight`)
  }
}

// ── 5. THE SHIPPED DIALS ARE IN A BAND THAT MEANS SOMETHING ─────────────────────────────────────
// ⚠ Not a look ruling — a range. Alex rules the value; this only refuses the two ends that are
// definitionally wrong.
{
  // ⛔ NOT A BAND ANY MORE. This was `>= 0 && < 0.5` — a range that permitted the exact value canon
  // barred, and the build sat at 0.15 inside it for weeks reading green. Ruled 2026-09-06 (/magii,
  // athernyx `3aef03e`): emissive is barred at EVERY value including a neutral grey one, because
  // the bar is on GENERATION, not on hue. A range cannot express "none"; only the equality can.
  ok(HOLLOW_LOOK.selfLight === 0,
     `⛔ the shipped Hollow generates no light of its own (selfLight ${HOLLOW_LOOK.selfLight})`)
  for (const f of FORMS) {
    ok(HOLLOW_LOOK.opacity[f] > 0.2, `${f} is a body, not a rumour`)
    ok(HOLLOW_LOOK.opacity[f] <= 1, `${f}'s opacity is a fraction`)
  }
}

// ── ★★★ THE SURFACE CAN EXPRESS THE BRIEF, AND IT IS ONE TEXTURE FOR THE WHOLE GAME ─────────────
// The material was a `MeshLambertMaterial` until 2026-09-05, which has NO SPECULAR TERM — so the
// brief's central claim (*"specular high, and tinted entirely by the environment... a matte Hollow
// would be the drift"*) could not be expressed even in principle, and every look call made against
// it was a call about a shadow puppet. ⚠ This suite passed 43/0 across that whole change: it
// asserted the SEAM (dials reach the mesh) and never that the material could carry the look. Both
// are worth having and neither substitutes for the other.
{
  const mats = createHollowMat(HOLLOW_LOOK)
  for (const f of FORMS) {
    const m = mats[f]
    ok(typeof m.roughness === 'number' && typeof m.metalness === 'number',
      `★★ ${f} has a specular response at all — the brief's "wet, never matte" needs one to exist`)
    ok(m.roughness < 0.5, `★ ${f} reads WET rather than matte (roughness ${m.roughness})`)
    ok(m.metalness < 0.35,
      `★ ${f} stays a dielectric — a metal reads as POLISHED, and a Hollow owns nothing (metalness ${m.metalness})`)
    // ★★★ THE ASSERT THAT WAS MISSING, AND IT IS THE WHOLE OF THE 2026-09-08 DEFECT. Until then
    // this block checked `envMapIntensity > 1` and nothing checked that there was an ENVIRONMENT to
    // apply it to — and there was not, anywhere in the game. A material's borrow strength is a
    // ratio; asserting the ratio while the operand is null is asserting nothing. `envMap` is the
    // operand, so it is what gets asserted first.
    ok(m.envMap !== null && m.envMap !== undefined,
      `★★★ ${f} HAS a room to borrow — canon: "specular tinted entirely by the environment". Without an envMap that sentence multiplies zero and the body reads as a black cutout in full daylight.`)
    ok(m.envMap === skyEnvironment(),
      `★★ ${f} borrows the SHIPPED sky, not a per-call build — one texture and one PMREM for the app`)
    ok(m.envMapIntensity === BORROW,
      `★ ${f} borrows at the calibrated strength (envMapIntensity ${m.envMapIntensity}, BORROW ${BORROW})`)
    ok(m.normalMap !== null, `★★ ${f} has a SURFACE — flat shading is what made it read as a shadow puppet`)
    // ⚠⚠ THIS ASSERT USED TO READ `m.normalMap === m.roughnessMap` AND IT ENCODED THE BUG. The
    // intent was "roughness comes from the same FIELD as the normal"; what it checked was the same
    // TEXTURE, and three reads roughness from channel G — which on a normal map is the Y slope, not
    // the height. The guard could only ever pass while the material was wrong. A guard that asserts
    // an IDENTITY when the claim is about a DERIVATION is the hand-kept-mirror shape (2026-08-22)
    // pointed at a texture.
    ok(m.roughnessMap !== null && m.roughnessMap !== m.normalMap,
      `★★★ ${f} takes roughness from its OWN texture — three samples roughness from .g, so packing the height into a normal map's alpha writes it into a channel nothing reads`)
    ok(m.roughnessMap === goopRoughness(), `★ ${f} uses the shared roughness field`)
  }

  // ⚠⚠ ONE TEXTURE, SHARED. A texture per body is the allocation class that got this page blocked
  // from WebGL on 2026-08-06 — same family as a material per body, and less obvious because a
  // texture is created by a helper rather than by a `new` the reader can see.
  ok(new Set(FORMS.map(f => mats[f].normalMap)).size === 1, '★★ all three forms share ONE surface texture')
  ok(mats.warden.normalMap === goopSurface(), 'and it is the shared one, not a per-call build')
  ok(createHollowMat(HOLLOW_LOOK).warden.normalMap === goopSurface(),
    '★★ a SECOND createHollowMat reuses it too — the singleton survives repeated construction')

  // ★ AND THE SURFACE IS DETERMINISTIC. A look call is made from a picture; if the lumps differed
  // between two builds, "does this read right" would be a statement about one screenshot and not
  // about the game. Seeded value noise, asserted by content rather than by reading the source.
  const a = goopSurface().image.data as Uint8Array
  const sum = a.reduce((t: number, v: number) => (t + v) % 1000003, 0)
  // ⚠ PINNED, AND `|| true` WAS THE FIRST VERSION OF THIS LINE — an assert with no input that
  // makes it fire is decoration, and it went green while saying nothing (PATTERNS 2026-08-22).
  // A deliberate retune of the noise SHOULD fail here: updating the number is the moment someone
  // states that the surface changed, instead of it drifting under a look call made last week.
  ok(sum === 32084, `the goop surface is byte-identical to the pinned one (got ${sum}, want 32084)`)
  ok(a.length === 256 * 256 * 4 && a.some(v => v !== a[0]),
    '★ the surface has real content — an all-one-value map is a normal map that does nothing')
  for (const f of FORMS) mats[f].dispose()
}

/* ═══ THE ROOM IT BORROWS (2026-09-08) ═══════════════════════════════════════════════════════════
 *
 * Everything here exists because the previous version of this file asserted the borrow STRENGTH
 * and never asked whether there was anything to borrow. See `sky-env.ts` for the measurement.
 */
{
  // ── 1. THE ROUGHNESS MAP, READ THE WAY THREE READS IT ────────────────────────────────────────
  // ★★★ THE ONLY CHANNEL THAT MATTERS IS G. `roughnessmap_fragment.glsl.js`: `roughnessFactor *=
  // texelRoughness.g`. Asserting "there is a roughness map" is satisfied by the broken version too
  // — the broken version HAD one, pointed at a normal map whose G is the Y slope. So this reads G.
  const r = goopRoughness().image.data as Uint8Array
  const g: number[] = []
  for (let i = 0; i < r.length; i += 4) g.push(r[i + 1])
  const lo = Math.min(...g), hi = Math.max(...g)
  ok(hi - lo > 20,
    `★★★ the roughness map VARIES in G, the channel three samples (spread ${hi - lo}/255) — a flat G is a uniform roughness and the highlight slides over the body like plastic`)
  // ⚠ AND IT STAYS IN A BAND AROUND 1.0. `roughnessFactor` is a MULTIPLIER on 0.34, so a raw
  // 0..255 height would take the pits to a mirror and the peaks to full matte. Asserting only that
  // it varies would pass a map that does exactly that.
  ok(lo >= 0.60 * 255 && hi <= 1.0 * 255 && lo > 0,
    `★★ the roughness band never reaches 0 (mirror) or beyond 1 (chalk) — G runs ${lo}..${hi} of 255`)
  // ★ AND IT IS GREY. three would read G alone, but a coloured roughness map is a map somebody
  // meant as something else; keeping R=G=B means a later reader cannot pick the wrong channel.
  let grey = true
  for (let i = 0; i < r.length && grey; i += 4) grey = r[i] === r[i + 1] && r[i + 1] === r[i + 2]
  ok(grey, '★ the roughness map is greyscale — R=G=B, so no channel convention can defeat it again')
  ok(goopRoughness() === goopRoughness(), '★★ one shared roughness texture, not one per call')

  // ── 2. THE SKY ENVIRONMENT IS A SKY ──────────────────────────────────────────────────────────
  const env = skyEnvironment()
  const d = env.image.data as Uint8Array
  const W = env.image.width, H = env.image.height
  const rowLum = (y: number) => {
    const i = (y * W) * 4
    return d[i] + d[i + 1] + d[i + 2]
  }
  ok(rowLum(0) > rowLum(H - 1) + 60,
    `★★ the environment has an UP — zenith clearly brighter than the ground half (${rowLum(0)} vs ${rowLum(H - 1)}). A near-uniform environment is an ambient light with extra steps, and it re-creates exactly the flat fill a hemisphere light already gave us. ⚠ The margin is the point: a bare \`>\` is satisfied by a one-count difference, which is a gradient nothing can see.`)
  // ★★ THE ASSERT WITH TEETH: the top must agree with the DOME'S OWN CURVE, not merely be brighter.
  // Canon requires a Hollow to borrow the room and *"never carry a hue the scene did not already
  // have"*, which is only true while these two are built from one palette. Reconstruct the dome's
  // `mix(horizon, zenith, pow(up, 0.6))` at a row and compare.
  const hexOf = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const zen = hexOf(SKY.day.zenith)
  ok(Math.abs(d[0] - zen[0]) < 14 && Math.abs(d[1] - zen[1]) < 14 && Math.abs(d[2] - zen[2]) < 14,
    `★★ the top of the environment IS the palette's zenith (${d[0]},${d[1]},${d[2]} vs ${zen})`)

  // ⚠⚠⚠ AND THAT ASSERT ALONE IS A MIRROR OF ITS OWN SOURCE — IT SURVIVED THE MUTATION THAT
  // MATTERS. Changing `SKY.day.zenith` moved the environment AND the expected value together, so
  // the sweep printed 102/0 on a repainted sky. The claim canon actually needs is that the
  // environment agrees with **the dome the player is looking at**, and the dome is a GLSL string in
  // another file. So the two things that can silently disagree are asserted against that file:
  //   (a) the dome reads its palette from `sky-palette`, so there is one zenith and not two, and
  //   (b) the horizon→zenith curve exponent is the same number in both.
  // ★ This is the difference between comparing VALUES and comparing DERIVATIONS (PATTERNS 08-22):
  // a value check goes green the moment both copies are wrong in the same way.
  const domeSrc = readFileSync(new URL('day-night.tsx', import.meta.url), 'utf8')
  // ⚠ `strip`, NOT `codeOnly`. `codeOnly` blanks STRING LITERALS as well as comments — correct for
  // "does this file DO x", wrong here, because a module specifier IS a string literal and the whole
  // claim is about which module. Comments still go, so documenting this line cannot satisfy it.
  ok(/from '\.\/sky-palette'/.test(strip(domeSrc)),
    "★★★ the dome takes its palette from `sky-palette` — the environment and the visible sky must be ONE set of numbers, or a Hollow borrows a hue the scene does not have and canon's central line about the surface stops being true with nothing to catch it")
  // ⚠⚠ AND THE IMPORT ALONE IS NOT THE CLAIM — THIS EXACT MUTATION SURVIVED THE FIRST VERSION.
  // Declaring a LOCAL `SKY` beside a surviving `import { DAY, NIGHT } from './sky-palette'` leaves
  // the specifier in the file and the guard green, with two zeniths in the build. The claim is that
  // the palette is not REDECLARED here, so that is what gets asserted.
  for (const name of ['SKY', 'DAY', 'NIGHT']) {
    ok(!new RegExp(`(const|let|var)\\s+${name}\\s*=`).test(strip(domeSrc)),
      `★★★ the dome does not redeclare \`${name}\` — a local copy beside the import is two palettes wearing one name, and the sky the player sees would drift from the sky a Hollow reflects with every assert still green`)
  }

  const domePow = domeSrc.match(/pow\(\s*up\s*,\s*([0-9.]+)\s*\)/)
  const envSrc = readFileSync(new URL('sky-env.ts', import.meta.url), 'utf8')
  const envPow = envSrc.match(/Math\.pow\(\s*up\s*,\s*([0-9.]+)\s*\)/)
  ok(domePow !== null && envPow !== null,
    `★★ both curves are still readable (dome ${domePow?.[1] ?? 'MISSING'}, env ${envPow?.[1] ?? 'MISSING'}) — ⚠ a regex that stops matching reports "no drift" and "I could not look" with the same green, so a missing match is a FAILURE here, never a skip`)
  ok(domePow !== null && envPow !== null && domePow[1] === envPow[1],
    `★★★ the environment uses the DOME'S horizon→zenith curve (dome pow ${domePow?.[1]}, env pow ${envPow?.[1]}) — the same expression, not a similar-looking gradient`)
  let anyBlack = false
  for (let y = 0; y < H; y++) if (rowLum(y) === 0) anyBlack = true
  ok(!anyBlack, '★ no fully black row — a black band in an environment reads as a hole in the world on a curved body')

  // ── 3. THE HOUR IS THE BORROW, AND IT IS APPLIED TO LIVE MATERIALS ──────────────────────────
  ok(borrowedSky(1) === 1, 'noon borrows the whole room')
  // ⚠⚠ THE FIRST VERSION OF THIS WAS `borrowedSky(0) === NIGHT_BORROW` AND IT SURVIVED THE
  // MUTATION IT EXISTS TO CATCH. Setting `NIGHT_BORROW = 0` left it green, because it compared the
  // function to the very constant the function uses — the two moved together, which is the
  // hand-kept-mirror shape (2026-08-22) with a one-line radius. The claim is not "the floor equals
  // the constant", it is "there IS a floor and it is a trace" — so it is asserted as a BAND with
  // literals in it, from both sides (2026-09-06: a bound checked from one side is a comment).
  ok(borrowedSky(0) > 0.04,
    `★★★ midnight keeps a TRACE (${borrowedSky(0)}), never zero — canon's word is "near-matte", and a flat cutout is the unlit-renderer fail state the rig refuses everywhere else`)
  ok(borrowedSky(0) < 0.3,
    `★★ and the trace is a TRACE (${borrowedSky(0)}) — a Hollow that keeps borrowing at midnight is a lit thing in the dark, which is the read the spawn layer exists to deny`)
  ok(borrowedSky(0) === NIGHT_BORROW, 'and the floor is the named constant, not a second copy of it')
  ok(borrowedSky(0.5) < 0.5,
    '★ and the curve is not linear — daylight spends most of its range in the twilight band, so a linear borrow would keep a Hollow glossy well after the sun has gone')
  const live = createHollowMat(HOLLOW_LOOK)
  setHollowBorrow(1)
  ok(live.warden.envMapIntensity === BORROW,
    `★★★ setHollowBorrow REACHES a material the factory already returned — the tick walks a registry the producer keeps, because hollow-body and hollow-mesh each hold their own set and a tick that knew about one would light half the Hollows by a different clock`)
  setHollowBorrow(0)
  ok(Math.abs(live.warden.envMapIntensity - BORROW * NIGHT_BORROW) < 1e-6,
    `★★ and midnight actually lands on the trace (${live.warden.envMapIntensity})`)
  // ★★★ A MATERIAL BUILT AFTER THE TICK INHERITS THE HOUR. This is the spawn case and nothing else
  // covers it: `setHollowBorrow` early-outs on an unchanged hour, so a body created at midnight
  // would keep the noon default forever and burn a daylight sky into the dark. Found by asking what
  // the early-out costs, not by a failing picture — a Hollow only exists at night, so this would
  // have been THE shipping path.
  setHollowBorrow(0)
  const born = createHollowMat(HOLLOW_LOOK)
  ok(Math.abs(born.stalker.envMapIntensity - BORROW * NIGHT_BORROW) < 1e-6,
    `★★★ a Hollow built at midnight borrows midnight (${born.stalker.envMapIntensity}, want ${BORROW * NIGHT_BORROW}) — not the noon default it was constructed with`)
  for (const f of FORMS) born[f].dispose()

  setHollowBorrow(1)
  for (const f of FORMS) live[f].dispose()

  // ── 4. BOTH FRAME UPDATERS TICK IT ───────────────────────────────────────────────────────────
  // ⚠ A STATEMENT, NOT A MENTION. The 2026-09-06 world sweep found three source asserts satisfied
  // by the name appearing anywhere in the file — an import line counts, a comment counts. These
  // anchor on the call with its argument.
  const CALL = /setHollowBorrow\(daylight\(dayProgress\(\)\)\)/
  for (const mod of ['hollow-mesh.ts', 'hollow-body.ts']) {
    const src = codeOnly(readFileSync(new URL(mod, import.meta.url), 'utf8'))
    ok(CALL.test(src),
      `★★★ ${mod} ticks the borrow every frame — the world and the bench each run exactly one of these two, so a tick in only one lights the bench by a different rule than the game and manufactures the next "reads too dark" finding`)
  }
}

console.log(`hollow-look: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
