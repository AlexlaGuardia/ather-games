// SIGNED LINES, WORD FOR WORD (BETA M73, the opening chain): Kael's invite (athernyx CANON/game/kael-invite-script.md › MAIN,
// with the "For Jin" item name + description) and Morel's Dig ping, nudge and gate hint (morel-dig-ping-script.md §1-§3, MAIN
// ping; alts NOT taken and must not ship). Parses the canon files and diffs against what the game ships.
// Needs /root/athernyx; elsewhere it says SKIP.   npx tsx src/app/shimmer/open/business/signed-lines-m73.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { KAEL_INVITE_NAME, KAEL_INVITE_BLURB, KAEL_INVITE_TEXT } from '../shared/kael-invite-lines'
import { MOREL_PING, MOREL_NUDGE, MOREL_DIG_HINT } from '../shared/morel-lines'
import { CHAIN_LINES } from '../shared/opening-chain-store'
import { itemDef } from '../shared/inventory'
import { KAEL_INVITE, KAEL_PAGE } from '../shared/opening-chain'
import { KAEL_PAGE_NAME, KAEL_PAGE_BLURB, KAEL_PAGE_TEXT } from '../shared/kael-page-lines'
import { VEYRA_UNIT1, VEYRA_PICK } from '../shared/veyra-lines'

const INVITE = '/root/athernyx/CANON/game/kael-invite-script.md'
const PING = '/root/athernyx/CANON/game/morel-dig-ping-script.md'
const PAGE = '/root/athernyx/CANON/game/kael-journal-page-script.md'
const CHAIN = '/root/athernyx/CANON/game/ather-opening-chain-script.md'
if (![INVITE, PING, PAGE, CHAIN].every(existsSync)) { console.log('SKIP: athernyx canon not on this machine'); process.exit(0) }
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

// (C) M73 s3, Kael's journal page: the "## MAIN (62 words) — SIGNED" block, same shape as the invite (alts must not ship)
const pg = readFileSync(PAGE, 'utf8')
ok(/^\*\*SIGNED[^\n]*MAIN ships as written/m.test(pg), 'journal page script is SIGNED (main)')
const pmain = pg.split(/^## /m).find(x => /^MAIN \(\d+ words\) — SIGNED/.test(x)) ?? ''
const pparas = pmain.split('\n').filter(l => l.startsWith('>')).map(l => l.replace(/^>\s?/, '').trim()).filter(Boolean)
ok(pparas.length === KAEL_PAGE_TEXT.length && pparas.length === 3, `page paragraphs: game ${KAEL_PAGE_TEXT.length} vs canon ${pparas.length}`)
pparas.forEach((x, k) => ok(KAEL_PAGE_TEXT[k] === x, `page para ${k}: game "${KAEL_PAGE_TEXT[k]}" vs canon "${x}"`))
const palts = pg.split(/^## /m).filter(x => /^ALT [AB]/.test(x)).flatMap(x => x.split('\n').filter(l => l.startsWith('>')).map(l => l.replace(/^>\s?/, '').trim()).filter(Boolean))
ok(palts.length >= 6 && palts.every(a => !KAEL_PAGE_TEXT.includes(a)), `no page alt ships (${palts.length} alt paragraphs)`)
const pname = pg.match(/Item name: `([^`]+)`/)?.[1], pblurb = pg.match(/Description line \(inventory\): \*([^*]+)\*/)?.[1]
ok(KAEL_PAGE_NAME === pname && KAEL_PAGE_BLURB === pblurb, `page name/blurb: game "${KAEL_PAGE_NAME}"/"${KAEL_PAGE_BLURB}" vs canon "${pname}"/"${pblurb}"`)
ok(itemDef(KAEL_PAGE).name === pname && itemDef(KAEL_PAGE).blurb === pblurb, 'the bag shows the page under its signed name + blurb')

// (D) M73 s3, Veyra Unit 1 v2: the "## Unit 1 (v2, 2026-11-22)" section up to its counts. Her lines in script order, the
// [SCENE] boxes in order, the two choices; the offered ALT last line must not ship.
const ch = readFileSync(CHAIN, 'utf8')
const v2 = ch.slice(ch.indexOf('## Unit 1 (v2, 2026-11-22)'), ch.indexOf('## Unit 1 (v2) — counts'))
ok(v2.length > 200 && /SIGNED \(for now\)/.test(v2), 'Veyra Unit 1 v2 found and SIGNED (for now)')
const vl = [...v2.matchAll(/^VEYRA: (.+)$/gm)].map(m => m[1].trim())
const order = ['open', 'kaels', 'asked1', 'asked2', 'where1', 'where2', 'send', 'bark'] as const
ok(vl.length === order.length, `Veyra lines: canon ${vl.length} vs game ${order.length}`)
order.forEach((k, i) => ok(VEYRA_UNIT1[k].line === vl[i], `Veyra ${k}: game "${VEYRA_UNIT1[k].line}" vs canon "${vl[i]}"`))
const sc = [...v2.matchAll(/^\[SCENE: (.+)\]$/gm)].map(m => m[1].trim())
const gsc = order.map(k => VEYRA_UNIT1[k].scene).filter(Boolean)
ok(JSON.stringify(sc) === JSON.stringify(gsc), `Veyra scene boxes word for word, in order (${sc.length} vs ${gsc.length})`)
const chs = [...v2.slice(v2.indexOf('[trigger:')).matchAll(/^> (?!\*\*)(.+)$/gm)].map(m => m[1].trim())
ok(JSON.stringify(chs) === JSON.stringify([VEYRA_PICK.asked, VEYRA_PICK.where]), `Veyra's choices word for word: ${JSON.stringify(chs)}`)
const valt = v2.match(/ALT \(last line[^)]*\):\*\* VEYRA: (.+)$/m)?.[1]?.trim()
ok(!!valt && Object.values(VEYRA_UNIT1).every(b => b.line !== valt), `the ALT last line does not ship ("${valt}")`)
ok(/station:veyra-1:send[^\n]*Sets the ship-repair objective flag/.test(v2), 'the send trigger is the one that sets the ship-repair flag')

console.log(`${n - fails}/${n} signed-line asserts${fails ? ` · ${fails} FAILED` : ' · word for word'}`)
process.exit(fails ? 1 : 0)
