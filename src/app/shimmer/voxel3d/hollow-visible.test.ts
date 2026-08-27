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
import { codeOnly } from '../testing/guard'
import { HOLLOW_LOOK, createHollowMat } from './hollow-look'
import { spawnDark, packLight, dayFactor } from '../voxel/light'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

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
// ⚠ ASKED OF THE SHIPPED MATERIALS, NOT OF A SOURCE FILE. This section used to grep VoxelWorld.tsx,
// and when the look moved to `hollow-look.ts` it went red against code that was fine — a guard
// asserting a retired LOCATION rather than a retired rule. Building the real materials cannot go
// stale that way: wherever the factory lives, this is what a Hollow is made of.
{
  const mats = createHollowMat(HOLLOW_LOOK)
  for (const f of ['warden', 'stalker', 'caster'] as const) {
    ok(mats[f].emissiveIntensity > 0,
       `${f} carries its own light — without it, it can only ever be as bright as the dark it stands in`)
    // ⚠ THE SELF-LIGHT MUST BE THE BODY'S OWN COLOUR. A white or tinted one shifts the hue as the
    // scene light drops, so a Hollow would change colour with the hour — and the grey is the whole
    // read of the thing.
    ok(mats[f].emissive.getHex() === mats[f].color.getHex(),
       `${f}'s self-light is its own hue, never a tint that drifts as the light drops`)
  }
  for (const m of Object.values(mats)) m.dispose()
}

// ── 3. THE DIAL IS IN THE BAND WHERE IT MEANS SOMETHING ─────────────────────────────────────────
// ⚠ Not a look ruling — a range check. Zero is the shipped-invisible behaviour and high is a
// lantern, which is the opposite of what a Hollow is. Alex rules the value inside this band, on
// `/shimmer/dev/grey`, which exists precisely so the number comes from a picture and not from me.
{
  ok(Number.isFinite(HOLLOW_LOOK.selfLight), `the self-light dial is a real number (${HOLLOW_LOOK.selfLight})`)
  ok(HOLLOW_LOOK.selfLight > 0, '★ above zero — zero IS the bug, and it is the value that looks like nobody chose it')
  ok(HOLLOW_LOOK.selfLight < 0.5, 'and well under a half, or the grey starts to read as a light source')
}

// ── 4. ★★ AND THE PROMISE THE LOOK MAKES IS STILL WRITTEN DOWN ──────────────────────────────────
// The whole argument of this file is that a stated contract was not being met. If someone rewrites
// the look and drops the promise, this should be revisited deliberately rather than quietly
// outliving its reason.
{
  const look = readFileSync(new URL('./hollow-look.ts', import.meta.url), 'utf8')
  ok(/holds a silhouette/.test(look), '"a smear of grey that holds a silhouette" is still the stated intent')
  ok(!/holds a silhouette/.test(codeOnly(look)), 'and it lives in prose, where a contract belongs')
  // ⚠ The darkness rule is the other half and it is asserted in section 1 from `spawnDark` itself,
  // so if that rule is ever relaxed this file's argument changes with it rather than rotting.
}

console.log(`hollow-visible: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
