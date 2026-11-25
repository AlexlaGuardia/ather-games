// SIGNED LINES, WORD FOR WORD: athernyx CANON/game/shimmer-lines-batch-2026-11-23c.md (Alex, b3dc505, MAIN ships everywhere).
// Parses the batch's three tables and diffs every MAIN cell against the build: A Planter Box saplings (M113), B spirit
// planter HUD (M106), C Gleaner's barter panel (M112). The alts must not ship.
// Needs /root/athernyx; elsewhere it says SKIP.   npx tsx src/app/shimmer/open/ather/lines-batch-23c.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { BLOOMED_SPIRIT_LINE, planterBoxHint } from './planter-lines'
import { WARES, BURR_LABEL, type WareKey } from './burrfolk'
import { itemDef } from '../shared/inventory'

const BATCH = '/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-23c.md'
if (!existsSync(BATCH)) { console.log('SKIP: athernyx canon not on this machine'); process.exit(0) }
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const doc = readFileSync(BATCH, 'utf8')
ok(/SIGNED 2026-11-23 by Alex[^\n]*MAIN ships everywhere/.test(doc), 'batch 11-23c is SIGNED (MAIN)')

/** rows of the table in section `from`: key -> { main, alt } with the markup and the *(kept...)* notes stripped */
const table = (from: string, to: string) => {
  const a = doc.indexOf(from), b = doc.indexOf(to, a + 1), s = doc.slice(a, b < 0 ? undefined : b)
  const clean = (c: string) => c.replace(/\*\([^)]*\)\*/g, '').replace(/\*\*/g, '').replace(/`/g, '').trim()
  const rows = new Map<string, { main: string; alt: string }>()
  for (const l of s.split('\n')) {
    const c = l.split('|').slice(1, -1).map(x => x.trim())
    if (c.length !== 4 || c[0] === 'key' || /^-+$/.test(c[0])) continue
    rows.set(clean(c[0]), { main: clean(c[2]), alt: clean(c[3]) })
  }
  return rows
}
const A = table('## A.', '## B.'), B = table('## B.', '## C.'), C = table('## C.', '## Counts')
ok(A.size === 7 && B.size === 4 && C.size === 5, `table rows A ${A.size}/7 B ${B.size}/4 C ${C.size}/5`)
const src = ['workshop.tsx', 'melee-view.tsx', 'planter-box-view.tsx', 'burrfolk.ts', 'planter-lines.ts', 'use-folk-talk.tsx']
  .map(f => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).join('\n')

// ── B: the two changed lines, from the module the HUD reads ──
const bloom = B.get('bloomed spirit')!, hint = B.get('planter_box hint')!
ok(BLOOMED_SPIRIT_LINE === bloom.main, `bloomed spirit: game "${BLOOMED_SPIRIT_LINE}" vs canon "${bloom.main}"`)
ok(planterBoxHint('Spirit Planter', '<recipe>') === hint.main, `planter_box hint: game "${planterBoxHint('Spirit Planter', '<recipe>')}" vs canon "${hint.main}"`)
ok(/hudSay\(BLOOMED_SPIRIT_LINE/.test(readFileSync(new URL('./workshop.tsx', import.meta.url), 'utf8')), 'workshop PiecePanel says the signed bloomed line')
ok(/hudSay\(BLOOMED_SPIRIT_LINE/.test(readFileSync(new URL('./melee-view.tsx', import.meta.url), 'utf8')), 'melee-view says the signed bloomed line')
ok(/planterBoxHint\(FURNITURE\.spirit_planter\.name/.test(src), 'the planter_box hint renders through planterBoxHint')
// B kept: the lift / set-down lines
for (const k of ['lift, seed in the soil', 'set back down']) ok(src.includes(B.get(k)!.main), `B kept "${k}": "${B.get(k)!.main}" in the build`)

// ── C: the stall's labels (swap + short = batch 11-25b now: burrfolk.test.ts) ──
const k0 = Object.keys(WARES)[0] as WareKey, p = WARES[k0].product
const nm = (id: string) => itemDef(id).name
ok(BURR_LABEL.look === C.get('panel open / title')!.main, `title: "${BURR_LABEL.look}"`)
ok(BURR_LABEL.done(k0) === C.get('bag count tag')!.main.replace('X', nm(p.id)), `bag tag: "${BURR_LABEL.done(k0)}"`)
ok(BURR_LABEL.full(k0) === C.get('bag full')!.main.replace('X', nm(p.id)), `bag full: "${BURR_LABEL.full(k0)}" vs canon "${C.get('bag full')!.main}"`)

// ── A: all kept; each MAIN is in the build ──
const aKept: Record<string, string> = { 'plant prompt': 'Plant a sapling', 'empty slot': 'A sapling would grow here.', 'planted toast': 'Planted.',
  'lift (pick up the box)': 'Its sapling goes with it.', 'set back down': 'its sapling is back in, still growing', 'done readout': 'fully grown',
  'growing readout': 'growing, stage ${s + 1} of ${SAPLING_STAGES}' }
for (const [k, built] of Object.entries(aKept)) {
  const m = A.get(k)?.main ?? ''
  ok(!!m && m.replace(/<Sapling> · /, '').replace('N of 4', 'N').toLowerCase() === built.replace('${s + 1} of ${SAPLING_STAGES}', 'N').toLowerCase(), `A "${k}": canon "${m}" matches the built form "${built}"`)
  ok(src.includes(built), `A "${k}": "${built}" in the build`)
}

// ── no alt ships ──
for (const [sec, rows] of [['A', A], ['B', B], ['C', C]] as const)
  for (const [k, r] of rows) if (r.alt && r.alt !== r.main && !/^<|\(kept\)/.test(r.alt) && !/X|Y/.test(r.alt)) ok(!src.includes(r.alt), `${sec} alt "${k}" not shipped: "${r.alt}"`)
ok(!src.includes('No room in your bag for the'), 'C: the old bag-full wording is gone')
ok(!src.includes('not here:') && !src.includes('It stays.'), 'B: the old hint / stays wording is gone')

console.log(`${n - fails}/${n} pass`)
process.exit(fails ? 1 : 0)
