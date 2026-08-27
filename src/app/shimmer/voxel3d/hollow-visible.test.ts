// A Hollow must be SEEN. Run: npx tsx src/app/shimmer/voxel3d/hollow-visible.test.ts
//
// ★★★ ALEX REPORTED THIS TWICE. "attacked by invisible enemies" was answered with SOUND, which was
// the right fix for a stalker behind you and no fix at all for one in front. Then: "the hollows are
// still invisible." PATTERNS says it plainly — a repeated complaint after a fix is evidence the fix
// MISSED, not evidence it was handled.
//
// ⚠⚠ AND IT WAS NOT A BUG IN EITHER RULE. Two correct rules composed into invisible by construction:
//   1. `spawnDark` refuses ANY block light and requires night skylight, so a Hollow exists ONLY
//      where the game is at its darkest. That is canon — "tended light holds grey off".
//   2. The material had no `emissive`, so its brightness was bounded by what lit it — which rule 1
//      guarantees is almost nothing.
// This file guards the seam between them, because neither module can see the other and no assert
// anywhere owned the sentence the material itself makes: "a smear of grey that HOLDS A SILHOUETTE".

import { readFileSync } from 'node:fs'
import { codeOnly, noComments } from '../testing/guard'
import { spawnDark, packLight, dayFactor } from '../voxel/light'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SRC = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')

// ── 1. ★★ RULE ONE, RESTATED FROM THE SHIPPED FUNCTION: A HOLLOW LIVES IN THE DARK ──────────────
// Not quoted from a comment — asked of `spawnDark`, so if the darkness requirement is ever relaxed
// this section changes with it and the argument below stops applying.
{
  const midnight = dayFactor(0)
  ok(spawnDark(packLight(0, 0), midnight) === true, 'pitch dark, no block light: a Hollow may form')
  ok(spawnDark(packLight(0, 1), midnight) === false,
     '★ ONE unit of block light forbids it outright — a torch is an absolute veto, not a penalty')
  ok(spawnDark(packLight(15, 0), dayFactor(0.5)) === false, 'and daylight forbids it too')
  // ⚠ THE WHOLE ARGUMENT RESTS ON THIS: the places a Hollow may exist are exactly the places with
  // the least light to render it by. Nothing else in the tree states that out loud.
}

// ── 2. ★★★ SO THE BODY MUST CARRY ITS OWN FLOOR OF LIGHT ────────────────────────────────────────
{
  const code = codeOnly(SRC)
  const mats = code.match(/warden: new THREE\.MeshLambertMaterial\(\{[^}]*\}\)/)?.[0] ?? ''
  ok(mats !== '', 'the warden material is findable')

  for (const form of ['warden', 'stalker', 'caster']) {
    const m = code.match(new RegExp(`${form}: new THREE\\.MeshLambertMaterial\\(\\{[^}]*\\}\\)`))?.[0] ?? ''
    ok(/emissive:/.test(m), `${form} has an emissive term — without one it can only be as bright as the dark it stands in`)
    ok(/emissiveIntensity: HOLLOW_SELF_LIGHT/.test(m),
       `${form} takes it from the ONE named constant, so the look is one number to move, not three`)
    // ⚠ THE EMISSIVE MUST BE THE BODY'S OWN COLOUR. A white or a tinted one shifts the hue as the
    // light drops, so a Hollow would change colour with the time of day — and canon's grey is the
    // whole read of the thing.
    const colour = m.match(/color: (0x[0-9a-f]+)/)?.[1]
    const emis = m.match(/emissive: (0x[0-9a-f]+)/)?.[1]
    ok(!!colour && colour === emis, `${form}'s self-light is its OWN hue (${colour} vs ${emis}) — never a tint that shifts as light drops`)
  }
}

// ── 3. THE CONSTANT IS IN THE BAND WHERE IT MEANS SOMETHING ─────────────────────────────────────
// ⚠ Not a look ruling — a range check. Zero is the shipped-invisible behaviour and high is a
// lantern, which is the opposite of what a Hollow is. Alex rules the value inside this band.
{
  const v = Number(codeOnly(SRC).match(/const HOLLOW_SELF_LIGHT = ([\d.]+)/)?.[1] ?? NaN)
  ok(Number.isFinite(v), `HOLLOW_SELF_LIGHT is a real number (${v})`)
  ok(v > 0, '★ above zero — zero IS the bug, and it is the value that looks like nobody chose it')
  ok(v < 0.5, 'and well under a half, or the grey starts to read as a light source')
}

// ── 4. ★ THE MATERIALS ARE STILL SHARED, NOT PER-BODY ───────────────────────────────────────────
// Adding a field to a material is exactly when someone inlines it into the spawn. A material per
// Hollow is a shader program per Hollow, which is what got this page blocked from WebGL on 08-06.
{
  const code = codeOnly(SRC)
  const spawn = code.slice(code.indexOf('const mesh = new THREE.Mesh(hollowGeo['), code.indexOf('const mesh = new THREE.Mesh(hollowGeo[') + 200)
  ok(/hollowMat\[form\]/.test(spawn), 'the spawn reaches for the shared material by form')
  ok(!/new THREE\.MeshLambertMaterial/.test(spawn), 'and does not build one per body')
  // ⚠ NO COUNT ASSERT HERE ON PURPOSE, AND I WROTE ONE FIRST. \`<= 6\` against a real 8 is a
  // ceiling with no author and no expiry — the shape PATTERNS warns about — and the tempting fix
  // when it goes red is to nudge the number, which measures nothing. The rule that actually
  // matters is structural and is asserted above: the SPAWN reaches for a shared material and does
  // not build one. A file-wide tally cannot tell a legitimate new material from a leak.
}

// ── 5. ⚠ AND THE SENTENCE THE MATERIAL MAKES IS STILL THERE ─────────────────────────────────────
// The comment is the contract this whole file exists to enforce. If someone rewrites the look and
// drops the promise, the guard below should be revisited rather than silently outliving its reason.
{
  ok(/holds a silhouette/.test(noComments(SRC)) === false, 'the promise lives in a comment, as prose')
  ok(/holds a silhouette/.test(SRC), '★ and it is still there — "a smear of grey that holds a silhouette"')
}

console.log(`hollow-visible: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
