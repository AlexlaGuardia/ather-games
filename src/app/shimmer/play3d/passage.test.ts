/**
 * The Passage's shelves — the week, the tray, the counter, the bench. Run: `npx tsx src/app/shimmer/play3d/passage.test.ts`
 */
import { readFileSync, existsSync } from 'node:fs'
import {
  WEEK, MARKET_DAY, TEACHING_DAY, SELL_PRICES, TRAY_SIZE, GEM_PRICE_LANE, GEM_PRICE_OFF,
  weekdayOf, daysUntil, gemTrayFor, gemPrice, buyGem, sell, teacherFor, takeLesson, TEACHABLE,
} from './passage'
import { EMPTY_LETTERS } from './gems'
import { EMPTY_BOOK } from './scroll-market'
import { RUNES, ELEMENTS, runesOf } from './birth/runes.data'
import { laneRunes } from './cast'
import { createInventory, addItems, countItem } from '../engine/inventory'
import { BLOCKS } from '../voxel/registry'
import { noComments } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] },
}

// ── A. the week is canon's, in canon's order, read from the calendar file ───────────────────
{
  const cal = readFileSync('/root/athernyx/CANON/world/calendar.md', 'utf8')
  const rows = cal.split('\n').map(l => l.match(/^\|\s*\*\*([A-Za-z']+day)\*\*/)?.[1]).filter((x): x is string => !!x)
  ok(rows.length === 5, `the calendar names five days (${rows.join(', ')})`)
  ok(JSON.stringify(rows) === JSON.stringify([...WEEK]), '★ WEEK is the calendar\'s five days in its order — not restated from memory')
  ok(/E'xday[^\n]*Market day/.test(cal) && /Coomday[^\n]*Focus/.test(cal), 'market day is E\'xday and focus day is Coomday, in canon')
  ok(MARKET_DAY === "E'xday" && TEACHING_DAY === 'Coomday', 'and the build binds those two')
  ok(weekdayOf(0) === 'Solday' && weekdayOf(2) === "E'xday" && weekdayOf(7) === "E'xday" && weekdayOf(-1) === 'Floday', 'weekday cycles mod 5, negative-safe')
  ok(daysUntil(2, "E'xday") === 0 && daysUntil(3, "E'xday") === 4 && daysUntil(0, 'Coomday') === 1, 'days-until counts forward, 0 on the day')
}

// ── B. the tray: six runes, never a lost state, deterministic, priced by lane ───────────────
{
  const t1 = gemTrayFor(3), t2 = gemTrayFor(3), t3 = gemTrayFor(4)
  ok(t1.length === TRAY_SIZE && new Set(t1).size === TRAY_SIZE, 'six distinct runes')
  ok(JSON.stringify(t1) === JSON.stringify(t2) && JSON.stringify(t1) !== JSON.stringify(t3), 'the same cycle stocks the same tray; the next turns it')
  const lost = new Set(RUNES.filter(r => r.lostState).map(r => r.id))
  let anyLost = false
  for (let c = 0; c < 60; c++) if (gemTrayFor(c).some(r => lost.has(r))) anyLost = true
  ok(!anyLost, '★ a lost state never reaches the tray (60 cycles)')
  const birth = 'tempest'
  const on = [...laneRunes(birth, 'element')].find(r => r !== birth)!, off = RUNES.find(r => !laneRunes(birth, 'element').has(r.id) && !laneRunes(birth, 'state').has(r.id))!.id
  ok(gemPrice(on, birth) === GEM_PRICE_LANE && gemPrice(off, birth) === GEM_PRICE_OFF && gemPrice(on, null) === GEM_PRICE_OFF, 'lane price on your lanes, specialized off them, and everything is specialized to a keeper with no birth')
  const tray = [on, off]
  ok(buyGem(EMPTY_LETTERS, 100, on, tray, birth, 'Solday').why === 'not-today', 'the merchants only ride on market day')
  ok(buyGem(EMPTY_LETTERS, 100, 'nope', tray, birth, MARKET_DAY).why === 'not-stocked', 'not on the tray → not stocked')
  ok(buyGem(EMPTY_LETTERS, 10, on, tray, birth, MARKET_DAY).why === 'too-dear', 'too dear leaves the letters and the Marks')
  const r = buyGem(EMPTY_LETTERS, 100, off, tray, birth, MARKET_DAY)
  ok(r.ok && r.marks === 40 && r.letters.bag[off] === 1, '★ an off-lane gem can be BOUGHT (the merchant does not care that you cannot seat it) — 60 Marks, one gem in the bag')
}

// ── C. the counter: the whole ladder, every item a real seam drop, only on market day ──────
{
  const drops = new Set(BLOCKS.flatMap(b => (b.drops ?? []).map(d => d.itemId)))
  const notDropped = Object.keys(SELL_PRICES).filter(id => !drops.has(id))
  ok(notDropped.length === 0, `★ every runestone the counter buys is dropped by a seam${notDropped.length ? ` — not: ${notDropped.join(', ')}` : ''}`)
  ok(SELL_PRICES.raw_mana_shard! < SELL_PRICES.storm_crystal! && SELL_PRICES.storm_crystal! < SELL_PRICES.pure_mana_core! && SELL_PRICES.pure_mana_core! < SELL_PRICES.ather_crystal!, 'the ladder pays more each rung')
  ok(SELL_PRICES.storm_crystal! < GEM_PRICE_LANE, '★ a crystal sells for LESS than the gem it would imbue into — imbuing stays the better road for a rune you hold')
  const inv = createInventory(); addItems(inv, 'storm_crystal', 3)
  ok(sell(inv, 'storm_crystal', 2, 'Solday').why === 'not-today' && countItem(inv, 'storm_crystal') === 3, 'no buying off market day, nothing taken')
  const s1 = sell(inv, 'storm_crystal', 2, MARKET_DAY)
  ok(s1.ok && s1.marks === 24 && s1.sold === 2 && countItem(inv, 'storm_crystal') === 1, 'two crystals → 24 Marks, exactly two taken')
  ok(sell(inv, 'storm_crystal', 5, MARKET_DAY).sold === 1 && countItem(inv, 'storm_crystal') === 0, 'selling more than you carry sells what you carry')
  ok(sell(inv, 'storm_crystal', 1, MARKET_DAY).why === 'nothing-to-sell', 'and then nothing')
  ok(sell(inv, 'goldwood_plank', 1, MARKET_DAY).why === 'not-for-sale', 'the counter buys runestones, not planks')
}

// ── D. the bench: one word a Coomday, free if readable, never an ultimate ───────────────────
{
  ok(TEACHABLE.every(m => m.tier !== 'ultimate'), '★ no teacher ever gives an ultimate — earned, never taught')
  const m1 = teacherFor(5), m2 = teacherFor(5), m3 = teacherFor(6)
  ok(m1.id === m2.id, 'the same cycle holds the same master')
  ok(m1.id !== m3.id || TEACHABLE.length === 1, 'the bench turns with the cycle')
  ok(takeLesson(EMPTY_BOOK, m1.runes, m1, 'Solday').why === 'not-today', 'the masters hold on Coomday only')
  const l = takeLesson(EMPTY_BOOK, m1.runes, m1, TEACHING_DAY)
  ok(l.ok && l.book.learned.includes(m1.id), `the word is given free to a keeper who can read it (${m1.name})`)
  ok(takeLesson(l.book, m1.runes, m1, TEACHING_DAY).why === 'already-known', 'and not twice')
  const other = RUNES.find(r => !m1.runes.includes(r.id))!.id
  ok(takeLesson(EMPTY_BOOK, [other], m1, TEACHING_DAY).why === 'unreadable', '★ a word in a rune you do not hold does not take — the Lane Law at the bench')
}

// ── E. the host: the dev door is owner-gated, the panel is mounted beside brew, no Earth weekday ships ─
{
  const src = noComments(readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8'))
  const at = src.indexOf('market: (day) =>')
  ok(at >= 0, 'VoxelWorld has the market op')
  const op = src.slice(at, src.indexOf('\n    },\n', at))
  ok(/isOwner\) return/.test(op) && /setMarketOpen\(true\)/.test(op) && /setConsoleOpen\(false\)/.test(op), 'owner-gated; closes the console and opens the panel (the brew handoff)')
  ok(/<PassagePanel /.test(src) && /marketOpen &&/.test(src), 'the panel is mounted behind marketOpen')
  const panel = noComments(readFileSync(new URL('./PassagePanel.tsx', import.meta.url), 'utf8'))
  const earth = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].filter(d => new RegExp(d, 'i').test(panel + src.slice(at, at + 2000)))
  ok(earth.length === 0, `★ no Earth weekday in the panel or the op (${earth.join(', ') || 'none'})`)
  ok(/addMarks\(/.test(panel) && /spendMarks\(/.test(panel), 'the panel both earns and spends Marks — a counter without a sell side is a shop nobody can pay at')
  // ★ THE REAL HOST: the tile Passage's trader opens the four shelves, not a rack-only panel.
  const tile = noComments(readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8'))
  const mount = tile.indexOf('{rackOpen !== null && (')
  const mountEnd = tile.indexOf('/>', mount)
  ok(mount >= 0 && mountEnd > mount, 'Shimmer3D still mounts a panel behind rackOpen (the trader\'s onDone)')
  const m = tile.slice(mount, mountEnd)
  ok(/<PassagePanel/.test(m) && /items=\{invRef\}/.test(m) && /keeperBook\(/.test(m) && /applyLoadout\(\)/.test(m), 'the trader mounts PassagePanel with the tile bag, and onChange re-reads the book and re-resolves')
  ok(!/<PassageRack/.test(tile) && !existsSync(new URL('./PassageRack.tsx', import.meta.url)), 'the rack-only panel is retired — one Passage, not two')
  ok(/unreadable|you do not carry this/.test(panel) && /canRead\(/.test(panel), 'the unreadable row is DRAWN and named (the rack\'s canon note survived the retirement)')
}

console.log(`passage: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
