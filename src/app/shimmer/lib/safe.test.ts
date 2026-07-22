// Input guards for the dev save routes — run: npx tsx src/app/shimmer/lib/safe.test.ts
//
// These guards exist because save-map/save-sprite/save-npc interpolate request payload
// into tracked TypeScript source. The properties that matter:
//   1. an id that names a FILE can't escape its directory
//   2. free text, once escaped, round-trips through a single-quoted TS literal
//   3. a grid is validated without spreading it as call arguments (RangeError at ~125k)
import {
  BadRequest, safeId, safeIdOpt, safeTsFile, safeInt, safeNum,
  safeEnum, safeColors, safeText, escText, gridMax, lookup, isSafeId,
} from './safe'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

/** Assert fn throws BadRequest (not TypeError, not silence). */
function rejects(name: string, fn: () => unknown) {
  try {
    const v = fn()
    chk(name, false, `expected BadRequest, returned ${JSON.stringify(v)}`)
  } catch (e) {
    chk(name, e instanceof BadRequest, `threw ${(e as Error).name}: ${(e as Error).message}`)
  }
}

/** Assert fn returns without throwing. */
function accepts(name: string, fn: () => unknown) {
  try { fn(); chk(name, true) } catch (e) { chk(name, false, `threw ${(e as Error).message}`) }
}

// ── safeId: the workhorse. Anything it passes gets spliced into source verbatim. ──
accepts('safeId accepts a plain id', () => safeId('mycelial-path', 'x'))
accepts('safeId accepts underscores and digits', () => safeId('water_bear_2', 'x'))
rejects('safeId rejects a single quote', () => safeId("evil'", 'x'))
rejects('safeId rejects a path separator', () => safeId('../../world/npcs', 'x'))
rejects('safeId rejects a dot', () => safeId('a.b', 'x'))
rejects('safeId rejects a template interpolation', () => safeId('${x}', 'x'))
rejects('safeId rejects the empty string', () => safeId('', 'x'))
rejects('safeId rejects a non-string', () => safeId(42, 'x'))
rejects('safeId rejects over-long input', () => safeId('a'.repeat(65), 'x'))
chk('isSafeId agrees with safeId', isSafeId('ok-1') && !isSafeId('no/'))

chk('safeIdOpt passes undefined through', safeIdOpt(undefined, 'x') === undefined)
chk('safeIdOpt treats empty string as absent', safeIdOpt('', 'x') === undefined)
rejects('safeIdOpt still rejects a bad id', () => safeIdOpt('a/b', 'x'))

// ── safeTsFile: this is the arbitrary-file-read guard on save-npc's spriteFile ──
accepts('safeTsFile accepts a bare sprite file', () => safeTsFile('fox.ts', 'x'))
rejects('safeTsFile rejects traversal', () => safeTsFile('../../../.env', 'x'))
rejects('safeTsFile rejects a nested path', () => safeTsFile('sub/fox.ts', 'x'))
rejects('safeTsFile rejects a non-.ts extension', () => safeTsFile('fox.json', 'x'))
rejects('safeTsFile rejects a double extension', () => safeTsFile('fox.ts.bak', 'x'))

// ── numbers: a NaN used to reach source as the literal `NaN` ──
accepts('safeInt accepts an in-range integer', () => safeInt(5, 'x', 0, 10))
rejects('safeInt rejects a numeric string', () => safeInt('5', 'x'))
rejects('safeInt rejects NaN', () => safeInt(NaN, 'x'))
rejects('safeInt rejects Infinity', () => safeInt(Infinity, 'x'))
rejects('safeInt rejects a float', () => safeInt(1.5, 'x'))
rejects('safeInt rejects below min', () => safeInt(-1, 'x', 0, 10))
rejects('safeInt rejects above max', () => safeInt(11, 'x', 0, 10))
accepts('safeNum accepts a float', () => safeNum(0.25, 'x', 0, 1))
rejects('safeNum rejects NaN', () => safeNum(NaN, 'x'))

// ── enums ──
accepts('safeEnum accepts a member', () => safeEnum('npc', ['player', 'npc'] as const, 'x'))
rejects('safeEnum rejects a non-member', () => safeEnum("npc' as any; //", ['player', 'npc'] as const, 'x'))

// ── colours: a palette entry lands inside '${c}' ──
accepts('safeColors accepts hex colours', () => safeColors(['#fff', '#3a4a6a'], 'x'))
rejects('safeColors rejects a quote-escape', () => safeColors(["#fff'"], 'x'))
rejects('safeColors rejects a bare word', () => safeColors(['red'], 'x'))
rejects('safeColors rejects an empty palette', () => safeColors([], 'x'))

// ── lookup: a bare MAP[key] answers truthily for inherited keys ──
const FILES: Record<string, string> = { fox: 'fox.ts' }
chk('lookup finds an own key', lookup(FILES, 'fox') === 'fox.ts')
chk('lookup misses `constructor`', lookup(FILES, 'constructor') === undefined)
chk('lookup misses `toString`', lookup(FILES, 'toString') === undefined)
chk('a bare index would NOT miss `constructor`', Boolean(FILES['constructor' as string]))

// ── escText: the round-trip property. Escaped text must parse back to itself. ──
const nasty = [
  "it's fine",
  'back\\slash',
  "quote ' and backslash \\ together",
  'line\nbreak',
  'carriage\rreturn',
  '${injected}',
  "'; process.exit(1); '",
  'trailing backslash \\',
]
for (const s of nasty) {
  const literal = `'${escText(s, 'x')}'`
  let round: unknown
  try {
    round = (0, eval)(literal)
  } catch (e) {
    chk(`escText round-trips ${JSON.stringify(s)}`, false, `literal did not parse: ${literal}`)
    continue
  }
  chk(`escText round-trips ${JSON.stringify(s)}`, round === s, `got ${JSON.stringify(round)}`)
}
rejects('escText rejects a non-string', () => escText(null, 'x'))
rejects('escText rejects over-long text', () => escText('a'.repeat(2001), 'x', 2000))
chk('safeText leaves text untouched', safeText("it's", 'x') === "it's")

// ── gridMax: validates cells AND survives a grid that would blow the arg limit ──
chk('gridMax finds the max', gridMax([[1, 2], [9, 3]], 'x') === 9)
chk('gridMax of all-zero is 0', gridMax([[0, 0]], 'x') === 0)
chk('gridMax allows VOID (-1) cells', gridMax([[-1, 4]], 'x') === 4)
rejects('gridMax rejects below -1', () => gridMax([[-2]], 'x'))
rejects('gridMax rejects a NaN cell', () => gridMax([[1, NaN]], 'x'))
rejects('gridMax rejects a string cell', () => gridMax([['1' as unknown as number]], 'x'))
rejects('gridMax rejects a non-array row', () => gridMax([42 as unknown as number[]], 'x'))

// The bug this replaced: `Math.max(...grid.flat())` throws RangeError past the
// engine's argument limit. 200k cells is a 450x450 map — well inside "authorable".
const bigGrid = Array.from({ length: 450 }, () => Array.from({ length: 450 }, () => 7))
accepts('gridMax handles a 450x450 grid', () => gridMax(bigGrid, 'x'))
chk('gridMax is correct on the big grid', gridMax(bigGrid, 'x') === 7)
let spreadThrew = false
try { Math.max(...bigGrid.flat()) } catch { spreadThrew = true }
chk('...and the old spread form really does throw on it', spreadThrew)

console.log(`\n${ok} passed, ${bad} failed`)
if (bad > 0) process.exit(1)
