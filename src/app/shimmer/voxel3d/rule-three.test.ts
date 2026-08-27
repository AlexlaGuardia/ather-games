// Rule 3, as a guard. Run: npx tsx src/app/shimmer/voxel3d/rule-three.test.ts
//
// ★★★ CANON RULED THIS ON 2026-08-26 AND THE BUILD VIOLATED IT FOR A DAY WITHOUT ANYTHING GOING RED.
// `game/shimmer-geography.md:752`: *"A PERSON MAY NOT INJURE YOU. AN ABSENCE MAY EMPTY YOU… only the
// greying reaches a keeper's own light, and even then it DRAINS rather than wounds."* The ruling
// bans a vocabulary outright — **one word breaks Rule 3 with the mechanic completely unchanged** —
// and `VoxelWorld` went on saying "you are hurt" until 2026-08-27.
//
// ⚠ THE DRIFT GATE CANNOT SEE THIS CLASS AT ALL. `npm run canon` diffs NAMES AND ROSTERS; its own
// footer says so, and says retired-vocab is judged narrowly against a list. A phrase that is
// forbidden by a RULING rather than listed as a retired noun passes it cleanly. So this is the
// vocabulary half, written where the words actually ship.
//
// ★ AND IT IS A BAN ON WORDS, NOT ON MECHANICS. The Hollow still empties you, the send-back still
// happens, `damage()` is still the function that runs. What changed is what the world SAYS, which
// is the whole point of the ruling: the moral line is drawn in the telling.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { noComments } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SHIMMER = new URL('..', import.meta.url).pathname
const walk = (dir: string, out: string[] = []): string[] => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

/**
 * Every string the world SAYS to the keeper.
 *
 * ⚠ SCOPED TO PLAYER-FACING TEXT, NOT TO THE FILE. The ruling forbids a vocabulary in what the
 * world tells you; it does not forbid `damage()` from existing — that function is how a Hollow
 * empties you and canon explicitly keeps the Hollow's health bar. A guard that banned the token
 * everywhere would be demanding a mechanic change the ruling never asked for, and would be argued
 * away within a week. This reads `onSay(…)` and `toast(…)` calls only.
 */
function spokenLines(src: string): string[] {
  const out: string[] = []
  // ⚠ Comments stripped first: this file's own explanation of the ban contains the banned words,
  // and so does the comment beside the fixed line. Third time today that a negative assert would
  // have been defeated by prose about the thing it forbids.
  const code = noComments(src)
  for (const m of code.matchAll(/\b(?:onSay|setToast|setBanner)\(([\s\S]{0,400}?)\)\s*(?:$|[;,\n])/gm)) {
    for (const lit of m[1].matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) out.push(lit[1] ?? lit[2] ?? '')
  }
  return out
}

// ── 1. ★★ THE INSTRUMENT CAN SEE ITS SUBJECT ────────────────────────────────────────────────────
// An empty scan passes every ban vacuously. Asked first, because that is the failure this repo
// keeps finding: a measurement window nothing lands in can only ever return one answer.
{
  const world = readFileSync(join(SHIMMER, 'voxel3d/VoxelWorld.tsx'), 'utf8')
  const said = spokenLines(world)
  ok(said.length > 20, `the extractor actually finds spoken lines (${said.length})`)
  ok(said.some(l => /collar/i.test(l)), 'including the collar lines, so it reaches the encounter text')
  ok(said.some(l => /glade/i.test(l)), 'and the send-back lines, which is where the ruling bites hardest')
  // ★ And it must not be fooled by prose: this very file talks about "you are hurt".
  ok(!spokenLines("// onSay('you are hurt')").length, 'a commented-out line is not something the world says')
}

// ── 2. ★★★ THE BAN ─────────────────────────────────────────────────────────────────────────────
// Every word here is from the ruling. A keeper is emptied, drained, put out — never wounded.
{
  const BANNED = /\b(hurt|wounded?|injur\w*|bleed\w*|blood\w*)\b/i
  const offenders: string[] = []
  for (const f of walk(SHIMMER)) {
    for (const line of spokenLines(readFileSync(f, 'utf8'))) {
      if (BANNED.test(line)) offenders.push(`${f.slice(SHIMMER.length)}: "${line}"`)
    }
  }
  ok(offenders.length === 0,
     `nothing the world says to a keeper uses the banned vocabulary (${offenders.length}): ${offenders.slice(0, 3).join(' · ')}`)
}

// ── 3. ★ THE MECHANIC IS UNTOUCHED, WHICH IS THE OTHER HALF OF THE RULING ───────────────────────
// "One word breaks Rule 3 with the mechanic completely unchanged" cuts both ways: the fix is words,
// and a future reader must not mistake this guard for a demand that the Hollow stop emptying you.
{
  const world = noComments(readFileSync(join(SHIMMER, 'voxel3d/VoxelWorld.tsx'), 'utf8'))
  ok(/damage\(vitals\.current/.test(world),
     'the Hollow still empties a keeper through damage() — canon gives the Hollow a health bar on purpose')
  ok(/pressure\(vitals\.current/.test(world),
     '★ and a collared Moglin still uses PRESSURE, never damage — "a build that ever hands a Moglin damage has crossed the line"')
}

console.log(`rule-three: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
