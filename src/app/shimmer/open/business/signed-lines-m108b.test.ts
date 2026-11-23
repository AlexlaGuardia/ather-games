// SIGNED LINES, WORD FOR WORD (BETA M108, batch 11-23b › B + C): the cell housing's labels (MAIN column) and Kael's ledger
// after the fit (MAIN, the open line trimmed to the seed by Alex). athernyx CANON/game/shimmer-lines-batch-2026-11-23b.md,
// SIGNED 11-23. A (party, sprites lane) and D (Gleaner / Burrfolk) are not wired here. Needs /root/athernyx; elsewhere SKIP.
//   npx tsx src/app/shimmer/open/business/signed-lines-m108b.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { LABEL, CELL_HOUSING, LEDGER_FITTED_MARGIN, LEDGER_CHARGE_LINE, LEDGER_CHARGE_MARGIN } from '../shared/ship-repair'
import { itemDef } from '../shared/inventory'
const BATCH = '/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-23b.md'
if (!existsSync(BATCH)) { console.log('SKIP: athernyx canon not on this machine'); process.exit(0) }
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const src = readFileSync(BATCH, 'utf8')
ok(/^\*\*✅ SIGNED 2026-11-23 by Alex/m.test(src), 'the batch is SIGNED')
const sec = (h: RegExp) => src.split(/^## /m).find(s => h.test(s)) ?? ''
// B · the table's MAIN column, "*(kept)*" stripped
const B = sec(/^B\. Cell housing/)
ok(!!B, 'section B found')
const main: Record<string, string> = {}
for (const m of B.matchAll(/^\| ([^|]+?) \| [^|]*? \| ([^|]+?) \| [^|]*?\|$/gm)) main[m[1].trim()] = m[2].replace(/\s*\*\(kept\)\*\s*$/, '').trim()
const item = itemDef(CELL_HOUSING)
const wired: [string, string][] = [
  ['item name', item.name], ['item blurb', item.blurb ?? ''], ['bag tag', LABEL.made], ['prompt', LABEL.fitPrompt],
  ['blocked', LABEL.notReady], ['ledger line', LABEL.fitEntry], ['bag full', LABEL.bagFull], ['shop row', LABEL.price],
  ['pay', LABEL.pay], ['leave', LABEL.leave],
]
ok(Object.keys(main).length === wired.length + 1 /* the header row */, `B: ${Object.keys(main).length - 1} rows in canon, ${wired.length} wired`)
for (const [k, g] of wired) ok(main[k] === g, `B ${k}: game "${g}" vs canon MAIN "${main[k]}"`)
// C · Kael's ledger after the fit: the struck line's margin, the open line (trimmed to the seed, per the signing) + margin, the entry
const C = sec(/^C\. Kael's ledger/)
const cMain = C.split(/\*\*In Kael's hand \(MAIN/)[1]?.split(/\*\*ALT/)[0] ?? ''
ok(!!cMain, 'section C MAIN found')
const struck = cMain.match(/^- ~~Cell housing\.[^~]*~~ — \*margin:\* (.+)$/m)?.[1].trim()
ok(struck === LEDGER_FITTED_MARGIN, `C struck line margin: game "${LEDGER_FITTED_MARGIN}" vs canon "${struck}"`)
const open = cMain.match(/^- \*\*(.+?)\*\* (?:~~[^~]*~~ )?— \*margin:\* (.+)$/m)
ok(open?.[1] === LEDGER_CHARGE_LINE, `C open line: game "${LEDGER_CHARGE_LINE}" vs canon "${open?.[1]}"`)
ok(open?.[2].trim() === LEDGER_CHARGE_MARGIN, `C open margin: game "${LEDGER_CHARGE_MARGIN}" vs canon "${open?.[2]}"`)
ok(src.includes(`ledger open line **trimmed to the seed**: *"${LEDGER_CHARGE_LINE}"*`), 'C: the signing trims the open line to exactly this seed')
const entry = cMain.split(/\*\*Keeper's entry beneath[^*]*\*\*/)[1]?.match(/^- (.+)$/m)?.[1].trim()
ok(entry === LABEL.chargeEntry, `C keeper's entry: game "${LABEL.chargeEntry}" vs canon "${entry}"`)
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n}/${n}`); process.exit(fails ? 1 : 0)
