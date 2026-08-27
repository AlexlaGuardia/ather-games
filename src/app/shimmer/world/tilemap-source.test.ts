/**
 * THE EDITOR'S LOADER, AGAINST THE MODULE'S OWN EXPORT.
 *
 * ★ TWO DERIVATIONS OF ONE FACT, WHICH IS THE ONLY REASON THIS CATCHES ANYTHING. `tilemap.ts` is
 * read twice — once as TEXT by the loader the map editor uses, once as a MODULE by the game — and
 * they must agree cell for cell. Anything that compares the loader against a fixture, or against a
 * remembered row count, is a mirror of the thing it is checking and will go stale with it.
 *
 * ⚠ THIS FILE EXISTS BECAUSE THE LOADER WAS WRONG TWICE AND NEVER LOOKED WRONG. First it returned
 * `[]` for every zone (it read the `[` in `number[][]` as the array), and the editor's
 * `if (data.grid?.length)` treated that as "nothing saved" and used the bundled copy — so a loader
 * that had never once worked read as a loader that was working. Then the fix for that revealed it
 * dropped row 0 and shifted every map up one. **A map is a wall of digits; being off by a row looks
 * exactly like a map.** Neither failure could be seen by looking at the output.
 *
 * Run: `npx tsx src/app/shimmer/world/tilemap-source.test.ts`
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import * as TILEMAP from './tilemap'
import { parseZoneGrid, zoneConstName } from './tilemap-source'

let pass = 0
const fails: string[] = []
const ok = (cond: boolean, msg: string) => { if (cond) pass++; else fails.push(msg) }

const SRC = readFileSync(join(process.cwd(), 'src/app/shimmer/world/tilemap.ts'), 'utf-8')

// Every literal grid the module exports, whatever it is called. Discovered, not listed — a
// hand-kept list of zone names is the thing still naming a map that was renamed last month.
const grids = Object.entries(TILEMAP).filter(
  ([, v]) => Array.isArray(v) && v.length > 0 && Array.isArray((v as unknown[])[0]),
) as [string, number[][]][]

ok(grids.length >= 20, `the module still exports grids to check (${grids.length})`)

/**
 * ★★ THE EXEMPTION DERIVES ITSELF. Two grids (`VETCH_HOLD`, `BRACK_HOLD`) are built by
 * `createStubMap(...)`, so there is no literal to read and `null` is the CORRECT answer — but a
 * hand-kept list of "these two are allowed to be null" is precisely the exemption that outlives its
 * reason and quietly excuses a real failure later. Ask the SOURCE instead: the day one of these is
 * written out as a literal, it stops being exempt on its own and gets asserted like every other.
 */
const isComputed = (name: string): boolean => {
  const at = SRC.indexOf(`export const ${name}`)
  return at !== -1 && SRC.substring(at, SRC.indexOf('[', SRC.indexOf('=', at))).includes('createStubMap')
}
ok(grids.filter(g => isComputed(g[0])).length < grids.length / 2,
  'most grids are still literals — if this flips, this whole file is exempting itself')

let identical = 0
let literals = 0
for (const [name, real] of grids) {
  const parsed = parseZoneGrid(SRC, name)
  if (isComputed(name)) {
    ok(parsed === null, `${name}: a computed grid reads as null, never as a partial or empty grid`)
    continue
  }
  literals++
  if (parsed === null) { fails.push(`${name}: loader returned null for a literal grid the module exports`); continue }
  // ★ Dimensions asserted SEPARATELY from contents, because "99 rows" and "the wrong tiles" are
  // different defects and a single deep-equal reports them as one indistinguishable red.
  const dimsOk = parsed.length === real.length && parsed.every((r, i) => r.length === real[i].length)
  ok(dimsOk, `${name}: ${real.length}x${real[0].length} read back as ${parsed.length}x${parsed[0]?.length ?? 0}`)
  if (!dimsOk) continue
  const same = JSON.stringify(parsed) === JSON.stringify(real)
  ok(same, `${name}: contents differ from the module's export`)
  if (same) identical++
  // The row-0 defect specifically, named so a regression says what it is rather than "contents differ".
  ok(JSON.stringify(parsed[0]) === JSON.stringify(real[0]), `${name}: row 0 survives (the .slice(1) bug)`)
}
ok(identical === literals, `every LITERAL grid round-trips byte-identical (${identical}/${literals})`)

// ── the refusals, which must stay refusals and must stay DISTINCT from an empty grid ─────────
ok(parseZoneGrid(SRC, 'NO_SUCH_ZONE_ANYWHERE') === null, 'an absent const is null, not []')
ok(parseZoneGrid('export const X = createStubMap(4, 4)', 'X') === null, 'a stub map is null — nothing literal to read')
ok(parseZoneGrid('export const X: number[][] = [\n  [1, 2],\n', 'X') === null, 'an unterminated array is null, not a partial grid')
// ⚠ THE ONE THAT WOULD HAVE CAUGHT BUG 1 ON ITS OWN. The type annotation must not be mistaken for
// the value, so this asserts the ANNOTATED form specifically rather than a convenient bare one.
{
  const g = parseZoneGrid('export const X: number[][] = [\n  [7, 8, 9],\n  [1, 2, 3],\n]', 'X')
  ok(JSON.stringify(g) === '[[7,8,9],[1,2,3]]', `an annotated declaration reads its VALUE, not its type — got ${JSON.stringify(g)}`)
}
ok(zoneConstName('rune-hold') === 'RUNE_HOLD', 'zone id maps to const name')

console.log(`tilemap source loader: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
