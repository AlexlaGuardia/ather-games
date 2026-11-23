// SIGNED LINES, WORD FOR WORD (BETA M108 s1): Kael's ledger page one (the open line + margin + the keeper's entries) and Hollis,
// Unit 3 (athernyx CANON/game/ather-opening-chain-script.md, SIGNED 11-15). Needs /root/athernyx; elsewhere SKIP.
//   npx tsx src/app/shimmer/open/business/signed-lines-m108.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { LEDGER_CELL_LINE, LEDGER_CELL_MARGIN, ENTRY_TAKE_PAGE, ENTRY_EARN_MARKS, HOLLIS_FIRST, HOLLIS_QUOTE, HOLLIS_BARK } from '../shared/hollis-lines'
const CHAIN = '/root/athernyx/CANON/game/ather-opening-chain-script.md'
if (!existsSync(CHAIN)) { console.log('SKIP: athernyx canon not on this machine'); process.exit(0) }
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const src = readFileSync(CHAIN, 'utf8')
ok(/STATUS: APPROVED 2026-11-15/.test(src), 'the chain script is APPROVED')
const u3 = src.split(/^## /m).find(s => /^Unit 3 — The manatech shopkeeper/.test(s)) ?? ''
ok(!!u3, 'Unit 3 found')
const lines = [...u3.matchAll(/^SHOPKEEPER: (.+)$/gm)].map(m => m[1].trim())
const scenes = [...u3.matchAll(/^\[SCENE: (.+)\]$/gm)].map(m => m[1].trim())
const game = [...HOLLIS_FIRST.map(b => b.line), ...HOLLIS_QUOTE.map(b => b.line), HOLLIS_BARK.short, HOLLIS_BARK.materials, HOLLIS_BARK.ambient]
ok(lines.length === game.length, `Hollis lines: game ${game.length} vs canon ${lines.length}`)
lines.forEach((l, k) => ok(game[k] === l, `Hollis ${k}: game "${game[k]}" vs canon "${l}"`))
const gs = HOLLIS_FIRST.filter(b => b.scene).map(b => b.scene)
ok(JSON.stringify(gs) === JSON.stringify(scenes), `scenes: ${JSON.stringify(gs)} vs ${JSON.stringify(scenes)}`)
ok(src.includes(`- **${LEDGER_CELL_LINE}** — *margin:* ${LEDGER_CELL_MARGIN}`), 'ledger open line + margin word for word')
ok(src.includes(`\n- ${ENTRY_TAKE_PAGE}\n`), 'first entry word for word')
ok(src.includes(`\n- ${ENTRY_EARN_MARKS}\n`), 'second entry word for word')
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n}/${n}`); process.exit(fails ? 1 : 0)
