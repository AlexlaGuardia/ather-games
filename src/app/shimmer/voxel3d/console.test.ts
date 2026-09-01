/**
 * THE CONSOLE — the first harness cover any console verb has ever had.
 *
 * ★ WHY IT DID NOT EXIST. `CONSOLE_CMDS` lived inside `VoxelWorld.tsx`, an 8964-line component no
 * test can import, so `/space`, `/brew`, `/goto`, `/give`, `/waymark` — every verb, and every OWNER
 * GATE on them — shipped on review alone. ⚠ A cheat command whose gate is checked by nobody reads
 * perfectly in a diff and is a live cheat in prod. The registry moved to a pure module for exactly
 * this file's sake; nothing about the commands changed.
 *
 * ★ THE CONTEXT IS A STUB, WHICH IS THE POINT. Commands touch the world only through `ConsoleCtx`
 * callbacks, so the whole surface is reachable with no GPU, no DOM and no React — and a stub that
 * RECORDS its calls lets an assert ask what a command actually did, not merely what it returned.
 *
 * Run: `npx tsx src/app/shimmer/voxel3d/console.test.ts`
 */
import { readFileSync } from 'node:fs'
import { CONSOLE_CMDS, runConsoleLine, suggestionsFor, type ConsoleCtx } from './console'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const calls: string[] = []

/**
 * A recording context.
 *
 * ⚠⚠ MY FIRST VERSION WAS A HAND-LISTED STUB AND IT WENT STALE ON THE FIRST RUN — `/foes` called a
 * method I had not written and the suite CRASHED, which is neither a pass nor a fail. A stub that
 * enumerates `ConsoleCtx` is a mirror of a type it does not own: it agrees until someone adds a
 * callback, and the day it stops agreeing it takes the whole file down rather than one assert.
 *
 * ★ SO IT IS A PROXY. Every callback answers, every call is RECORDED, and adding a verb to the
 * console can never break this file. Recording is what lets an assert ask *what the command did*
 * rather than what it returned — the difference between checking a refusal message and checking
 * that the world was never touched.
 */
const ctx = (isOwner: boolean): ConsoleCtx => new Proxy({}, {
  get(_t, prop: string) {
    if (prop === 'isOwner') return isOwner
    if (prop === 'radius') return () => 8
    if (prop === 'pos') return () => ({ x: 0, z: 0 })
    return (...args: unknown[]) => {
      calls.push(`${prop}:${args.map(a => String(a ?? '')).join(',')}`)
      return `${prop} ok`
    }
  },
}) as ConsoleCtx

// ── 1. the registry is a registry ─────────────────────────────────────────────────────────────
{
  const names = CONSOLE_CMDS.map(c => c.name)
  ok(new Set(names).size === names.length, `every command name is unique (${names.length})`)
  for (const c of CONSOLE_CMDS) {
    ok(!!c.name && !!c.usage && !!c.help, `${c.name}: has a name, a usage and a help line`)
    ok(c.usage.startsWith(c.name), `${c.name}: usage line leads with its own verb (${c.usage})`)
  }
}

// ── 2. ★★ THE OWNER GATE, WHICH NOTHING HAS EVER CHECKED ──────────────────────────────────────
// ⚠ A cheat verb reachable by any player is invisible: it does not throw, it does not log, and it
// looks exactly like a working command. This is the assert the extraction was for.
for (const c of CONSOLE_CMDS.filter(c => c.owner)) {
  const r = runConsoleLine(`/${c.name}`, ctx(false))
  ok(r.err === true && /only/.test(r.text), `/${c.name} is refused to a non-owner (${r.text})`)
  ok(runConsoleLine(`/${c.name}`, ctx(true)).err !== true, `/${c.name} is reachable by the owner`)
}

// ── 3. ★★★ /waymark IS VIEW-GRADE BARE AND OWNER-GATED ONLY ON `reach` ────────────────────────
// The split is deliberate and load-bearing: bare `/waymark` is the ONLY thing that explains why a
// socket on the Gate Station is dark, so gating the whole verb would make the station mute again —
// the exact defect canon spent 2026-08-24 removing. ⚠ And it is checked INSIDE the row rather than
// with `owner: true`, so a refactor that "tidies" it into a whole-command gate would delete the
// view half from /help for everyone and read as a cleanup rather than a regression.
{
  const w = CONSOLE_CMDS.find(c => c.name === 'waymark')!
  ok(!w.owner, '/waymark is not a whole-command owner gate — the view half must stay public')
  calls.length = 0
  const view = runConsoleLine('/waymark', ctx(false))
  ok(view.err !== true && calls.includes('waymark:'), 'a non-owner can READ the passages they hold')
  calls.length = 0
  const cheat = runConsoleLine('/waymark reach 3', ctx(false))
  ok(cheat.err !== true, 'the row answers rather than erroring — it is a refusal, not an unknown verb')
  ok(!calls.some(c => c.startsWith('waymark:reach')), '★ a non-owner CANNOT bind passages — the ctx was never asked')
  ok(/owner/.test(cheat.text), `and it says so (${cheat.text})`)
  calls.length = 0
  runConsoleLine('/waymark reach 3', ctx(true))
  ok(calls.includes('waymark:reach 3'), 'the owner does reach the seeding path, with the argument intact')
}

// ── 4. dispatch ──────────────────────────────────────────────────────────────────────────────
{
  ok(runConsoleLine('/nosuchverb', ctx(true)).err === true, 'an unknown verb is an error, not a silence')
  ok(runConsoleLine('', ctx(true)).text === '', 'an empty line does nothing')
  ok(runConsoleLine('/HELP', ctx(false)).err !== true, 'verbs are case-insensitive')
}

// ── 5. the suggestion strip does not leak owner verbs ────────────────────────────────────────
// ⚠ TAB-COMPLETION IS A DISCLOSURE SURFACE. A player who cannot RUN /space should not learn it
// exists by pressing tab — and this is the half a manual test never thinks to check.
{
  const ownerNames = CONSOLE_CMDS.filter(c => c.owner).map(c => c.name)
  const asPlayer = suggestionsFor('/', ctx(false)).options
  const leaked = ownerNames.filter(n => asPlayer.includes(n))
  ok(leaked.length === 0, `no owner verb is offered to a player${leaked.length ? ` — leaked: ${leaked.join(', ')}` : ''}`)
  ok(suggestionsFor('/', ctx(true)).options.length > asPlayer.length, 'the owner is offered more than a player')
  ok(asPlayer.includes('waymark'), 'and /waymark IS offered to a player, because its view half is theirs')
}

// ── 6. ★ A VERB NAME IS SHIPPED VOCABULARY THE MOMENT IT TAB-COMPLETES ───────────────────────
// The world lane nearly shipped `/gate` for in-Ather travel, which canon retired on 2026-08-15 in
// favour of `passage`/`waymark`. A console verb is a public noun and wants the gate canon's nouns get.
//
// ⚠⚠ THE RETIRED LIST IS READ FROM CANON, NOT RESTATED — AND MY FIRST VERSION RESTATED IT, WHICH
// TRIPPED THE CANON GATE ON MY OWN COMMIT. It hard-coded the three retired nouns as a literal array,
// which put all three into the build; `canon-drift`'s retired-vocab gate counts occurrences in
// source, so **a file whose job is to guard against a word counted as a use of it.** Same shape as
// the adoption counter that read 24 because a guard's asserts named the classes it counted. ★ A more
// thorough test would have made the false positive WORSE.
//
// ⚠ AND THE COMMENT EXPLAINING THAT MISTAKE TRIPPED IT A SECOND TIME, because prose naming the nouns
// is still the nouns. This paragraph is therefore written without them — deliberately, and not as a
// dodge: the gate counts prose ON PURPOSE, since a retired noun living in a comment is precisely what
// the next person copies into code.
//
// Reading canon fixes both halves at once: the source holds no retired noun, and the list cannot go
// stale the way a hand-kept mirror does. ⚠ An unreadable table FAILS rather than passing empty —
// "no retired verb" and "I could not check" must not share an exit code.
{
  const table = readFileSync('/root/athernyx/CANON/game/shimmer-geography.md', 'utf8')
    .split('RETIRED VOCABULARY')[1]?.split('### Boundary')[0] ?? ''
  const retired = table.split('\n')
    .map(l => l.match(/^\|\s*\*+([^*|]+)\*+/)?.[1]?.trim().toLowerCase())
    .filter((t): t is string => !!t)
  ok(retired.length > 0, 'canon\'s RETIRED VOCABULARY table is readable — otherwise this check did not run')
  const bad = CONSOLE_CMDS.map(c => c.name).filter(n => retired.includes(n))
  ok(bad.length === 0, `no verb is named with retired canon vocabulary${bad.length ? ` — ${bad.join(', ')}` : ''}`)
}

// ── 7. ★ /ctxlost CALLS THE VERB, AND WARNS IN THE HELP LINE (focus #938) ────────────────────
// The owner gate is covered above for free — section 2 sweeps every `owner: true` row. What that
// cannot see is whether the command DOES anything: a row whose `run` returned a string and touched
// nothing would pass the gate check, the registry check and the suggestion check.
//
// ⚠ THE HELP LINE IS ASSERTED BECAUSE IT IS THE ONLY WARNING THAT ARRIVES IN TIME. This is the one
// verb in the registry that ends the session — the reply telling you the tab is spent is read AFTER
// the context is gone, so the suggestion strip is where the sentence has to be. `ctxlost-wiring`
// guards what it does to the GPU; this guards what the keeper is told before they run it.
{
  calls.length = 0
  const r = runConsoleLine('/ctxlost', ctx(true))
  ok(calls.includes('ctxLost:'), `/ctxlost actually calls ctxLost (recorded: ${calls.join(' ') || 'nothing'})`)
  ok(r.err !== true, '/ctxlost does not report an error to the owner')
  const row = CONSOLE_CMDS.find(c => c.name === 'ctxlost')
  ok(!!row?.owner, '/ctxlost is owner-gated — it destroys the page it is run on')
  ok(!!row && /tab/i.test(row.help), `/ctxlost warns in its HELP line that the tab is spent (${row?.help ?? 'no row'})`)
}

console.log(`console: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
