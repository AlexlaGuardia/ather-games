// BETA M112 s1: the Burrfolk's stall; M159: sold for dewls. npx tsx src/app/shimmer/open/ather/burrfolk.test.ts
import { readFileSync } from 'node:fs'
import { burrfolkOf, buyWare, BURR_KIND, WARES, BURRFOLK_BARKS, BURR_LABEL, BURR_RESERVED, stallSpot, stallStock, isBurr, type WareKey } from './burrfolk'
import { folkOf, CANON_POOL } from './settlement-folk'
import { folkSpots } from './folk-spots'
import { folkTalk, ASK, type FolkTalkActs, type FolkTalkState } from './folk-talk'
import { freshTrust } from './settlement-folk'
import { newInv, give, countOf, itemDef, SLOTS, type Inv } from '../shared/inventory'
import { dewls } from './dewl'
import type { Settlement } from './network'
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const bag = (o: Record<string, number>): Inv => Object.entries(o).reduce((i, [id, k]) => give(i, id, k).inv, { ...newInv(0), slots: Array(SLOTS).fill(null) } as Inv)

// ── the SIGNED barks, word for word against the canon file (batch 11-23b › D5) ──
const lines = readFileSync('/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-23b.md', 'utf8')
ok(/✅ SIGNED 2026-11-23/.test(lines), 'the batch is signed')
const b25 = readFileSync('/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-25b.md', 'utf8')
ok(/^\*\*✅ SIGNED 2026-11-25/.test(b25), 'batch 25b is signed')
for (const [k, line] of Object.entries(BURRFOLK_BARKS)) {
  const row = new RegExp(`\\|\\s*\\d\\s*\\|\\s*\`burrfolk:${k}\`[^|]*\\|\\s*(.+?)\\s*\\|`).exec(lines)
  if (k === 'stall') { ok(new RegExp(`\\| \`burrfolk:stall\`[^|]*\\|[^|]*\\| \\*\\*(.+?)\\*\\* \\|`).exec(b25)?.[1] === line, 'stall = signed 25b B'); continue }
  ok(!!row && row[1] === line, `bark ${k} is the signed text (${row?.[1]})`)
}

// ── the wares are canon's trades table (shimmer-folds-settlements.md › Trades) ──
const spec = readFileSync('/root/athernyx/CANON/game/shimmer-folds-settlements.md', 'utf8')
ok(/THE BURRFOLK[^\n]*RULED 2026-11-23/.test(spec), 'canon: the Burrfolk are ruled')
for (const [k, r] of Object.entries(WARES)) {
  const row = new RegExp(`\\|\\s*\\*\\*${r.trade}\\*\\*\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|`).exec(spec)
  const out = row?.[2]
  ok(!!row && itemDef(r.product.id).name === out, `${k}: ${out} (canon) = ${itemDef(r.product.id).name}`)
}

// ── a stall in every settlement; names from the pool, unique among every living speaker, never reserved ──
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as { season: number; settlements: Settlement[] }
const bs = net.settlements.map(s => burrfolkOf(s, net.season)!)
ok(bs.length >= 2 && bs.every(Boolean), `a Burrfolk in every settlement (${bs.length})`)
ok(bs.every(b => b.stock.length >= 1 && b.stock.every(k => k in WARES)), 'every stall has at least one canon row')
ok(new Set(bs.map(b => b.stock.join())).size >= 2, 'wares vary by settlement')
ok(bs.every((b, i) => b.stock[0] === stallStock(net.settlements[i], folkOf(net.settlements[i], net.season))[0]), 'stock is deterministic')
for (let season = 1; season <= 40; season++) {
  const ss = net.settlements.map(s => ({ ...s, id: s.id.replace(/^s\d+-/, `s${season}-`) }))
  const folkNames = ss.flatMap(s => folkOf(s, season).map(f => f.name)), burrNames = ss.map(s => burrfolkOf(s, season)!.name)
  const personal = burrNames.filter(x => x !== BURR_KIND), all = [...folkNames, ...personal]
  if (season === 1 || new Set(all).size !== all.length || personal.some(x => BURR_RESERVED.has(x) || !CANON_POOL.includes(x)))
    ok(new Set(all).size === all.length && personal.every(x => !BURR_RESERVED.has(x) && CANON_POOL.includes(x)), `season ${season}: Burrfolk names are pooled, unreserved and unique (${burrNames.join(', ')})`)
  if (season === 1) ok(personal.length === burrNames.length, 'season 1: every stall-keeper has a personal name')
}
ok(burrfolkOf({ id: 'moonwell', name: 'Moonwell Glade', x: 0, z: 0 }, 1) === null, 'no generic stall in the Glade (Gleaner is s2)')
// the stall stands clear of the folk and of the well
for (const s of net.settlements) {
  const p = stallSpot(s), spots = folkSpots(s, folkOf(s, net.season).map(f => f.id))
  ok(spots.every(f => Math.hypot(f.x - p.x, f.z - p.z) > 2) && Math.hypot(p.x - s.x, p.z - s.z) < 20, `${s.id}: stall clear of the folk, inside the green`)
}

// ── a sale: dewls only, exact, refused when short or full (nothing changes) ──
const ks = Object.keys(WARES) as WareKey[], prices = ks.map(k => WARES[k].price as number)
ok(Math.min(...prices) === 15 && Math.max(...prices) <= 100, `prices 15 to 100, cheapest 15 (${prices})`)
for (const k of ks) {
  const { price, product: p } = WARES[k]
  const r0 = buyWare(bag({ dewl: price - 1 }), k); ok(!r0.ok && r0.why === 'short', `${k}: one dewl short = refused`)
  const r1 = buyWare(bag({ dewl: price }), k); ok(r1.ok && countOf(r1.inv, 'dewl') === 0 && countOf(r1.inv, p.id) === p.n, `${k}: the exact balance buys it`)
  const start = bag({ dewl: price + 1 }), r2 = buyWare(start, k); ok(r2.ok && countOf(r2.inv, 'dewl') === 1 && countOf(start, 'dewl') === price + 1, `${k}: the change stays, the old bag is untouched`)
  const full = bag({ dewl: price + 1 }); full.slots = full.slots.map((x, i) => x ?? { id: `junk${i}`, n: 1 })
  const rf = buyWare(full, k); ok(price > 99 ? rf.ok : !rf.ok && rf.why === 'full', `${k}: no room = refused (over 99 always empties a slot of dewls)`)
  const tight = bag({ dewl: price }); tight.slots = tight.slots.map((x, i) => x ?? { id: `junk${i}`, n: 1 })
  ok(buyWare(tight, k).ok, `${k}: a full bag whose last dewls pay has the room they leave`)
  const goods = buyWare(bag({ goldwood_log: 20, goldwood_plank: 20, raw_mana_shard: 20, starwillow_branch: 20 }), k)
  ok(!goods.ok && goods.why === 'short', `${k}: goods buy nothing (no item swaps)`)
}
const main = (id: string) => new RegExp(`\\| \`BURR_LABEL.${id}\`[^|]*\\|[^|]*\\| \\*\\*(.+?)\\*\\* \\|`).exec(b25)?.[1]
const fill = (t: string | undefined, k: WareKey) => t?.replace('{ITEM}', itemDef(WARES[k].product.id).name).replace('{N}', String(WARES[k].price))
for (const k of ks) { ok(BURR_LABEL.swap(k) === fill(main('swap'), k), `${k}: ${BURR_LABEL.swap(k)} = signed`); ok(BURR_LABEL.short(k) === fill(main('short'), k), `${k}: ${BURR_LABEL.short(k)} = signed`) }
ok(dewls(1) === '1 dewl' && dewls(2) === '2 dewls' && dewls(0) === '0 dewls', 'one dewl is singular')
ok(!Object.values(WARES).some(r => /mark/i.test(r.product.id)), 'no row sells Marks')

// ── the talk: greet -> stall -> wares; never a room ask (a Burrfolk never follows) ──
const s0 = net.settlements[0], folk = folkOf(s0, net.season), b = burrfolkOf(s0, net.season, folk)!
ok(isBurr(b.id) && !folk.some(f => f.id === b.id), 'the Burrfolk is not one of the folk (no recruit path)')
const calls: string[] = [], said: FolkTalkState[] = []
const act: FolkTalkActs = { go: st => said.push(st), give: () => calls.push('give'), recruit: () => calls.push('recruit'), bye: () => calls.push('bye'), buy: k => calls.push(`buy:${k}`) }
const ctx = { folk, home: folk, trust: freshTrust(), have: () => 0, room: 9, burr: b }
const hello = folkTalk(ctx, { fid: b.id, screen: 'hello' }, act)
ok(hello.line === BURRFOLK_BARKS.greet, 'greet = signed bark 1')
ok(!hello.options.some(o => o.label === ASK.room || o.label === ASK.needs || o.label === ASK.inspect), 'no room ask / needs / card at the stall')
hello.options.find(o => o.label === BURR_LABEL.look)!.pick()
ok(said.at(-1)?.screen === 'stall', 'Have a look opens the stall')
const stall = folkTalk(ctx, { fid: b.id, screen: 'stall' }, act)
ok(stall.line === BURRFOLK_BARKS.stall, 'stall = signed bark 2')
ok(stall.options.filter(o => o.label.includes(' · ')).length === b.stock.length, 'one ware per stock row')
ok(!stall.options.some(o => o.label === ASK.room), 'no room ask on the stall screen')
for (const o of stall.options) if (o.label.includes(' · ')) o.pick()
ok(calls.filter(c => c.startsWith('buy:')).length === b.stock.length && !calls.includes('recruit'), 'wares call buy, never recruit')
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n}/${n}`); process.exit(fails ? 1 : 0)
