// SIGNED LINES, WORD FOR WORD (BETA M73, the opening chain): Kael's invite (athernyx CANON/game/kael-invite-script.md › MAIN,
// with the "For Jin" item name + description) and Morel's Dig ping, nudge and gate hint (morel-dig-ping-script.md §1-§3, MAIN
// ping; alts NOT taken and must not ship). Parses the canon files and diffs against what the game ships.
// Needs /root/athernyx; elsewhere it says SKIP.   npx tsx src/app/shimmer/open/business/signed-lines-m73.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { KAEL_INVITE_NAME, KAEL_INVITE_BLURB, KAEL_INVITE_TEXT } from '../shared/kael-invite-lines'
import { MOREL_PING, MOREL_NUDGE, MOREL_DIG_HINT } from '../shared/morel-lines'
import { CHAIN_LINES } from '../shared/opening-chain-store'
import { itemDef } from '../shared/inventory'
import { KAEL_INVITE } from '../shared/opening-chain'

const INVITE = '/root/athernyx/CANON/game/kael-invite-script.md'
const PING = '/root/athernyx/CANON/game/morel-dig-ping-script.md'
if (!existsSync(INVITE) || !existsSync(PING)) { console.log('SKIP: athernyx canon not on this machine'); process.exit(0) }
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }

// (A) the invite: the "## MAIN — SIGNED" block's "> " lines, paragraphs split on the bare ">" lines
const inv = readFileSync(INVITE, 'utf8')
ok(/^\*\*SIGNED/m.test(inv), 'invite script is SIGNED')
const main = inv.split(/^## /m).find(s => /^MAIN — SIGNED/.test(s)) ?? ''
const paras = main.split('\n').filter(l => l.startsWith('>')).map(l => l.replace(/^>\s?/, '').trim()).filter(Boolean)   // one line per paragraph in the script
ok(paras.length === KAEL_INVITE_TEXT.length, `invite paragraphs: game ${KAEL_INVITE_TEXT.length} vs canon ${paras.length}`)
paras.forEach((p, k) => ok(KAEL_INVITE_TEXT[k] === p, `invite para ${k}: game "${KAEL_INVITE_TEXT[k]}" vs canon "${p}"`))
const name = inv.match(/Item name: `([^`]+)`/)?.[1], blurb = inv.match(/Description line \(inventory\): \*([^*]+)\*/)?.[1]
ok(KAEL_INVITE_NAME === name, `item name: game "${KAEL_INVITE_NAME}" vs canon "${name}"`)
ok(KAEL_INVITE_BLURB === blurb, `item blurb: game "${KAEL_INVITE_BLURB}" vs canon "${blurb}"`)
ok(itemDef(KAEL_INVITE).name === name && itemDef(KAEL_INVITE).blurb === blurb, 'the bag shows the invite under its signed name + blurb')

// (B) Morel: table rows "| `KEY` | trigger | line |" (the alts carry "(alt A)" in the key cell and must not ship)
const ping = readFileSync(PING, 'utf8')
ok(/PING SIGNED[^\n]*the MAIN ping ships/.test(ping) && /§2 nudge and §3 gate hint SIGNED/.test(ping), 'ping, nudge, hint are SIGNED')
const row = new Map<string, string>(), alts: string[] = []
for (const m of ping.matchAll(/^\| `([A-Za-z_.]+)`( \(alt [AB]\))? \|[^|]*\| (.+?) \|$/gm)) { if (m[2]) alts.push(m[3].trim()); else row.set(m[1], m[3].trim()) }
const game: Record<string, string> = { 'MOREL_PING.unreadNote': MOREL_PING.unreadNote, 'MOREL_NUDGE.unreadNote': MOREL_NUDGE.unreadNote, 'MOREL_HINT.digFlip': MOREL_DIG_HINT.digFlip }
for (const [k, g] of Object.entries(game)) ok(row.get(k) === g, `${k}: game "${g}" vs canon "${row.get(k)}"`)
ok(row.size === 3 && alts.length === 2, `3 signed rows + 2 alts parsed (got ${row.size} + ${alts.length})`)
ok(alts.every(a => !Object.values(CHAIN_LINES).includes(a)), 'no ping alt ships')
ok(CHAIN_LINES.ping === MOREL_PING.unreadNote && CHAIN_LINES.nudge === MOREL_NUDGE.unreadNote && CHAIN_LINES.hint === MOREL_DIG_HINT.digFlip, 'the chain says the signed lines')

console.log(`${n - fails}/${n} signed-line asserts${fails ? ` · ${fails} FAILED` : ' · word for word'}`)
process.exit(fails ? 1 : 0)
