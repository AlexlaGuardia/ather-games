// ── The unbuilt roster's PREMISES — headless oracle ─────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/play3d/unbuilt-premise.test.ts
//
// ★★★ WHY THIS FILE EXISTS, AND IT IS THE MOST EXPENSIVE LESSON THIS REPO HAS PAID FOR TWICE.
// `cast.ts`'s honesty rule says a canon move the sim cannot run is `archetype: 'unbuilt'` WITH a
// reason. That rule is good and it has one hole: **the reason is PROSE, and prose cannot be
// checked.** On 2026-08-31 Tremor Sense was found sitting unbuilt behind `why: 'needs a perception
// layer — enemy positions surfaced to the HUD'`, months after the world grew real bodies with
// positions. The sentence was accurate the day it was written. **It expired silently, and the
// better written it was, the longer it was believed.**
//
// Auditing the other twelve the same afternoon found two more of exactly that shape (`waymark`
// naming a file that now exists, `overpressure` naming a shield bank that now exists) and one
// mis-filed (`bind-mastery`, whose reason is CANON's and was living in build prose). Three in one
// sweep is not bad luck; it is what an unchecked list does over time.
//
// So: an unbuilt move must be blocked for a reason that can EXPIRE OUT LOUD.
//
// ── THE TWO CLASSES, AND THEY BEHAVE COMPLETELY DIFFERENTLY ─────────────────────────────────────
//   · CANON-BLOCKED — the move declares `needs` in `keeper-moves.ts`, transcribed from canon (a
//     second mage, manatech, a craft rather than magic). These are STABLE: they expire only when
//     canon changes its mind, which is a ruling, not a drift. No probe, and none is wanted.
//   · BUILD-BLOCKED — the reason names a HOOK THE SIM OWES. **This is the class that rots**, so
//     each one must carry a probe: a place to look and a pattern whose ABSENCE is the blocker. The
//     day the hook lands, this file goes red and says *re-read this move* instead of letting the
//     sentence go on being true-looking.
//
// ⚠ ASSERT C IS THE ONE THAT MATTERS. The two sets must together be EXACTLY the unbuilt roster, so
// a newly unbuilt move goes red until somebody classifies it. It is a worklist with a red light on
// it, not an exemption list — the same shape as `tokens.test.ts` assert B, and for the same reason:
// **an exemption is a silent promise that somebody is watching that corner, and it outlives the
// reason it was written.**

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { castForMove } from './cast'
import { KEEPER_MOVES } from './keeper-moves'

const ROOT = join(process.cwd(), 'src/app/shimmer')
let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

/**
 * A build-blocked move's premise: WHERE the missing hook would appear, and WHAT it would look like.
 *
 * ⚠ THE PATTERN DESCRIBES THE HOOK'S ARRIVAL, NOT THE MOVE'S NAME. A probe searching for
 * "flame-cloak" would stay quiet forever and prove nothing — the move is exactly what does not
 * exist. It has to watch the CAPABILITY, in the file that would gain it.
 */
interface Premise { file: string; arrives: RegExp; hook: string }

const BUILD_BLOCKED: Record<string, Premise> = {
  'heat-mirage': {
    file: 'engine/statuses.ts',
    // Every status today is applied to a TARGET id. A self-centred one is a status the CASTER wears
    // that changes how others resolve against them.
    arrives: /\bself\b.*(status|mirage)|misaim|misAim/i,
    hook: 'a self-centred status — one the caster wears that makes enemies mis-aim at THEM',
  },
  'ember-trail': {
    file: 'engine/field-effects.ts',
    arrives: /alongPath|trail|spawnFieldAt\w*Path/i,
    hook: "fields spawned along the caster's PATH rather than at a single aim point",
  },
  'flame-barrage': {
    file: 'engine/cast-dispatch.ts',
    // One press, several independently tracked rounds. `placed` is a single spec today.
    arrives: /volley|barrage|projectiles:\s*\d|placedMany/i,
    hook: 'one cast that emits several independently tracked projectiles',
  },
  gate: {
    file: 'voxel/waymark.ts',
    // The file exists (that is why `waymark`'s own reason was corrected), but a TWO-POINT bind —
    // an anchor pair you warp between on a cast — is a different thing from a named place.
    arrives: /anchorPair|twoPoint|bindPair|gateBetween/i,
    hook: 'a two-point bind: an anchor PAIR a cast can warp between',
  },
  meltbore: {
    file: 'engine/cast-dispatch.ts',
    arrives: /sustained|channel(ing)?\b|heldCast/i,
    hook: 'a sustained/held cast the sim can run over time',
  },
  overpressure: {
    file: 'engine/vitals.ts',
    // The shield bank and its damage ORDER already exist. What is missing is the feedback: absorbed
    // damage returning INTO the shield pool.
    arrives: /absorb\w*\s*(=>|:)?[^\n]*shield\s*\+=|shield\s*\+=\s*absorb/i,
    hook: 'absorbed damage fed BACK into the shield pool, so the layer mends out of what it stops',
  },
  waymark: {
    file: 'engine/cast-dispatch.ts',
    // Its surviving reason is a DESIGN one: a place-binding is not a slot you press. The premise
    // that would overturn it is the dispatcher gaining a non-combat, place-binding archetype.
    arrives: /'place-bind'|placeBind|'binding'/,
    hook: 'a place-binding archetype in the dispatcher — the thing its design reason says it is not',
  },
}

// ── A. every premise points somewhere real ─────────────────────────────────────────────────────
// ⚠ A probe aimed at a file that has been moved or renamed matches nothing forever, and reads
// EXACTLY like "still blocked". That is this repo's blind-instrument bug, and it would make this
// whole file decoration without ever going red. So the file is asserted to exist first.
const sources: Record<string, string> = {}
for (const [id, p] of Object.entries(BUILD_BLOCKED)) {
  const full = join(ROOT, p.file)
  const there = existsSync(full)
  chk(`premise for '${id}' points at a file that exists`, there, p.file)
  if (there) sources[id] = readFileSync(full, 'utf8')
}

// ── B. the blocker is still there — and this is the assert that expires ────────────────────────
for (const [id, p] of Object.entries(BUILD_BLOCKED)) {
  const src = sources[id]
  if (src === undefined) continue
  const arrived = p.arrives.test(src)
  chk(
    `'${id}' is still genuinely build-blocked`,
    !arrived,
    arrived
      ? `★ THE HOOK HAS ARRIVED — ${p.file} now has: ${p.hook}. `
        + `This move's reason has expired. Re-read it: either BUILD it, or rewrite \`why\` to name `
        + `what is actually still missing. Do NOT widen this probe to make the red go away.`
      : '',
  )
}

// ── C. the two classes together are EXACTLY the unbuilt roster ─────────────────────────────────
// The worklist that cannot go quietly stale. A new unbuilt move is red until classified.
{
  const unbuilt = KEEPER_MOVES.filter((m) => castForMove(m.id).archetype === 'unbuilt').map((m) => m.id)
  const canonBlocked = KEEPER_MOVES.filter((m) => m.needs && castForMove(m.id).archetype === 'unbuilt').map((m) => m.id)
  const classified = new Set([...canonBlocked, ...Object.keys(BUILD_BLOCKED)])

  const unclassified = unbuilt.filter((id) => !classified.has(id))
  chk('C: every unbuilt move is classified — canon-blocked (has `needs`) or build-blocked (has a premise)',
    unclassified.length === 0,
    unclassified.length
      ? `${unclassified.join(', ')} — give it a canon \`needs\` in keeper-moves.ts, or a premise here.`
      : '')

  const ghosts = Object.keys(BUILD_BLOCKED).filter((id) => !unbuilt.includes(id))
  chk('C: no premise names a move that is no longer unbuilt — delete it when the move ships',
    ghosts.length === 0, ghosts.join())

  // ⚠ A move may not be in BOTH classes. Canon-blocked means the world lacks a THING canon requires;
  // build-blocked means we owe a hook. Filing one as both hides which of the two is actually true,
  // and the wrong half is the half that gets worked on.
  const both = canonBlocked.filter((id) => id in BUILD_BLOCKED)
  chk('C: no move is filed as both canon-blocked and build-blocked', both.length === 0, both.join())

  chk('the roster is non-empty, or every assert above is vacuous', unbuilt.length > 0)
}

// ── D. the canon-blocked half says WHAT canon requires, in the field a guard can read ──────────
// `bind-mastery` sat with its canon requirement written into `cast.ts` prose until 2026-08-31,
// which made it look like a hook we owed rather than a world canon has not given us.
{
  const canonBlocked = KEEPER_MOVES.filter((m) => m.needs && castForMove(m.id).archetype === 'unbuilt')
  chk('every canon-blocked move states its requirement in `needs`, not only in build prose',
    canonBlocked.every((m) => (m.needs ?? '').trim().length > 0))
  chk('...and there is at least one, or D is decoration', canonBlocked.length > 0)
}

console.log(`\nunbuilt-premise oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
