// npx tsx src/app/shimmer/open/ather/lines-batch-24c.test.ts
// ★ Lark batch 11-24c, SIGNED by Alex: the spirit bed's words (M124), MAIN, word for word against the canon file. Magii #17237
// wins over the file where they differ: row 8 is '8 spirit beds already stand in this garden.' No alt and no placeholder ships.
import { existsSync, readFileSync } from 'node:fs'
import { BED_UI, BLOOMED_SPIRIT_LINE, planterBoxHint } from './planter-lines'
import { FURNITURE, BEDS_MAX } from './furniture'
import { BED_RECORD_MAX } from './spirit-seeds'
const BATCH = '/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-24c.md'
if (!existsSync(BATCH)) { console.log('SKIP: athernyx canon not on this machine'); process.exit(0) }
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const canon = readFileSync(BATCH, 'utf8')
ok(/✅ SIGNED 2026-11-24 by Alex[^\n]*MAIN ships everywhere/.test(canon), 'the batch is signed (MAIN)')
const A = canon.slice(canon.indexOf('## A.'), canon.indexOf('## B.')), B = canon.slice(canon.indexOf('## B.'), canon.indexOf('## C.')), C = canon.slice(canon.indexOf('## C.'))
const bold = (c: string) => /\*\*([^*]+)\*\*/.exec(c)?.[1] ?? null
const rows = new Map(A.split('\n').filter(l => /^\| \d/.test(l)).map(l => { const c = l.split('|').map(x => x.trim()); return [Number(c[1]), { main: bold(c[4]), alt: c[5].replace(/\*\([^)]*\)\*|~~/g, '').trim() }] }))
ok(rows.size === 8, `8 rows in A (${rows.size})`)
const is = (n: number, game: string) => ok(rows.get(n)?.main === game, `A${n}: game "${game}" vs canon "${rows.get(n)?.main}"`)
is(1, BED_UI.title); is(1, FURNITURE.spirit_planter.name); is(2, BED_UI.full); is(3, BED_UI.featured); is(4, BED_UI.roaming)
is(5, BED_UI.ask); is(6, BED_UI.record); is(7, BED_UI.group(3)); is(8, BED_UI.capped)
ok(BED_UI.capped === '8 spirit beds already stand in this garden.' && BED_UI.capped.startsWith(`${BEDS_MAX} `), 'A8: Magii #17237, the number kept, and it is BEDS_MAX')
ok(BEDS_MAX === 8 && BED_RECORD_MAX === 28, 'canon (CANON_GAPS Spirit beds point 5): 8 beds, 28 blooms')
const hint = bold(B.split('\n').find(l => l.startsWith('| `planter_box` hint')) ?? '')
ok(hint !== null && hint.replace(/`/g, '').replace('<recipe>', '') === planterBoxHint(FURNITURE.spirit_planter.name, ''), `B: game "${planterBoxHint(FURNITURE.spirit_planter.name, '<recipe>')}" vs canon "${hint}"`)
ok(C.includes(`| record = 1 | **${BLOOMED_SPIRIT_LINE}**`), 'C: the signed bloomed line, unchanged')
// the panels speak them: no inline copy, placeholder or alt left in the build
const read = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')
const panel = read('spirit-panels.tsx'), roster = read('spirit-roster.tsx'), rooms = read('rooms.ts'), all = panel + roster + rooms + read('planter-lines.ts') + read('workshop.tsx')
for (const k of ['title', 'full', 'featured', 'roaming', 'ask', 'record']) ok(panel.includes(`BED_UI.${k}}`) || panel.includes(`BED_UI.${k} `), `the bed panel says BED_UI.${k}`)
ok(roster.includes('BED_UI.group(n)'), 'the roster says BED_UI.group'); ok(rooms.includes('why: BED_UI.capped'), 'the cap says BED_UI.capped')
for (const old of ['Featured. It stays near this bed.', 'Out in the garden.', '>Feature<', 'here it stays', 'It bloomed here']) ok(!all.includes(old), `gone: "${old}"`)
for (const [n, r] of rows) if (r.alt && r.alt !== 'none') ok(!all.includes(r.alt), `A${n} alt not shipped: "${r.alt}"`)
console.log(`lines-batch-24c: ${pass}/${pass + fail}`)
if (fail) process.exit(1)
