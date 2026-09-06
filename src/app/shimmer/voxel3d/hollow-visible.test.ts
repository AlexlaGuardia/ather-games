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

// ── 2. ⛔ OVERRULED 2026-09-06 — THE BODY CARRIES NO LIGHT AT ALL ───────────────────────────────
// ★★★ THE SECTION HEADER ABOVE USED TO READ "SO THE BODY MUST CARRY ITS OWN FLOOR OF LIGHT", and
// the argument is kept rather than deleted because the wrong reading is the useful artifact. It
// reasoned: section 1 proves a Hollow may only exist where there is least light to render it by,
// therefore it must light itself. Sound, and canon rules the conclusion out anyway (/magii,
// athernyx `3aef03e`): emissive is barred at EVERY value including a neutral grey one, because the
// bar is on GENERATION, not on hue. Being hard to see with nothing to borrow is the DANGER READ,
// not a defect. Findability is specular's job.
//
// ⚠⚠ AND THE CONSEQUENCE SECTION 1 PROVES IS NOT RESOLVED BY THAT RULING, SO IT IS WRITTEN HERE
// RATHER THAN QUIETLY DROPPED. Specular borrows from the surroundings, and a Hollow spawns exactly
// where there is nothing to borrow from. Alex reported an invisible Hollow at night TWICE. Nothing
// in this tree measures night visibility — both asserts this section used to make were range checks
// on a CONSTANT, not measurements of whether anything can be seen — so "0 is invisible" rests on
// his eye, which is the strongest evidence available and the only evidence available.
// ⚠ ASKED OF THE SHIPPED MATERIALS, NOT OF A SOURCE FILE. This section used to grep VoxelWorld.tsx,
// and when the look moved to `hollow-look.ts` it went red against code that was fine — a guard
// asserting a retired LOCATION rather than a retired rule. Building the real materials cannot go
// stale that way: wherever the factory lives, this is what a Hollow is made of.
{
  const mats = createHollowMat(HOLLOW_LOOK)
  for (const f of ['warden', 'stalker', 'caster'] as const) {
    ok(mats[f].emissiveIntensity === 0,
       `⛔ ${f} generates no light of its own (emissiveIntensity ${mats[f].emissiveIntensity}) — canon 3aef03e`)
    // ⚠ THE SELF-LIGHT MUST BE THE BODY'S OWN COLOUR. A white or tinted one shifts the hue as the
    // scene light drops, so a Hollow would change colour with the hour — and the grey is the whole
    // read of the thing.
    ok(mats[f].emissive.getHex() === mats[f].color.getHex(),
       `${f}'s self-light is its own hue, never a tint that drifts as the light drops`)
  }
  for (const m of Object.values(mats)) m.dispose()
}

// ── 3. NOT A BAND — A RULING ────────────────────────────────────────────────────────────────────
// ⚠ THIS WAS `> 0 && < 0.5`, AND A RANGE CANNOT EXPRESS "NONE". The shipped 0.15 sat inside it
// reading green while it violated the brief, in TWO files that each thought they were the guard
// (`hollow-look.test.ts` carried the same band). One rule in two places is one rule nobody owns.
{
  ok(Number.isFinite(HOLLOW_LOOK.selfLight), `the self-light dial is a real number (${HOLLOW_LOOK.selfLight})`)
  ok(HOLLOW_LOOK.selfLight === 0,
     `⛔ the shipped Hollow generates nothing (selfLight ${HOLLOW_LOOK.selfLight}) — canon 3aef03e`)
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
