// BETA M112 s1: the Burrfolk's stall + barter. npx tsx src/app/shimmer/open/ather/burrfolk.test.ts
import { readFileSync } from 'node:fs'
import { burrfolkOf, barter, BURR_KIND, BARTER, BURRFOLK_BARKS, BURR_LABEL, BURR_RESERVED, stallSpot, stallStock, isBurr, type BarterKey } from './burrfolk'
import { folkOf, CANON_POOL } from './settlement-folk'
import { folkSpots } from './folk-spots'
import { folkTalk, ASK, type FolkTalkActs, type FolkTalkState } from './folk-talk'
import { freshTrust } from './settlement-folk'
import { newInv, give, countOf, itemDef, SLOTS, type Inv } from '../shared/inventory'
import type { Settlement } from './network'
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const bag = (o: Record<string, number>): Inv => Object.entries(o).reduce((i, [id, k]) => give(i, id, k).inv, { ...newInv(0), slots: Array(SLOTS).fill(null) } as Inv)

// ── the SIGNED barks, word for word against the canon file (batch 11-23b › D5) ──
const lines = readFileSync('/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-23b.md', 'utf8')
ok(/✅ SIGNED 2026-11-23/.test(lines), 'the batch is signed')
for (const [k, line] of Object.entries(BURRFOLK_BARKS)) {
  const row = new RegExp(`\\|\\s*\\d\\s*\\|\\s*\`burrfolk:${k}\`[^|]*\\|\\s*(.+?)\\s*\\|`).exec(lines)
  ok(!!row && row[1] === line, `bark ${k} is the signed text (${row?.[1]})`)
}

// ── the barter rows are canon's trades table (shimmer-folds-settlements.md › Trades) ──
const spec = readFileSync('/root/athernyx/CANON/game/shimmer-folds-settlements.md', 'utf8')
ok(/THE BURRFOLK[^\n]*RULED 2026-11-23/.test(spec), 'canon: the Burrfolk are ruled')
for (const [k, r] of Object.entries(BARTER)) {
  const row = new RegExp(`\\|\\s*\\*\\*${r.trade}\\*\\*\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|`).exec(spec)
  const want = row?.[1].replace(/\s*\(.*\)$/, ''), out = row?.[2]
  ok(!!row && itemDef(r.want.id).name.startsWith(want!) && itemDef(r.product.id).name === out, `${k}: ${want} -> ${out} (canon) = ${itemDef(r.want.id).name} -> ${itemDef(r.product.id).name}`)
}

// ── a stall in every settlement; names from the pool, unique among every living speaker, never reserved ──
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as { season: number; settlements: Settlement[] }
const bs = net.settlements.map(s => burrfolkOf(s, net.season)!)
ok(bs.length >= 2 && bs.every(Boolean), `a Burrfolk in every settlement (${bs.length})`)
ok(bs.every(b => b.stock.length >= 1 && b.stock.every(k => k in BARTER)), 'every stall has at least one canon row')
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

// ── barter: exact swaps, refused when short or full, no coin ──
for (const k of Object.keys(BARTER) as BarterKey[]) {
  const { want: w, product: p } = BARTER[k]
  const r0 = barter(bag({ [w.id]: w.n - 1 }), k)
  ok(!r0.ok && r0.why === 'short', `${k}: short = refused`)
  const start = bag({ [w.id]: w.n + 1 }), r1 = barter(start, k)
  ok(r1.ok && countOf(r1.inv, w.id) === 1 && countOf(r1.inv, p.id) === p.n + countOf(start, p.id), `${k}: ${w.n} ${w.id} -> ${p.n} ${p.id}`)
  ok(countOf(start, w.id) === w.n + 1, `${k}: the old bag is untouched`)
  const full = bag({ [w.id]: w.n + 1 }); full.slots = full.slots.map((x, i) => x ?? { id: `junk${i}`, n: 1 })
  const rf = barter(full, k); ok(!rf.ok && rf.why === 'full', `${k}: no room = refused`)
}
ok(!Object.values(BARTER).some(r => /mark/i.test(r.want.id + r.product.id)), 'no row trades Marks')

// ── the talk: greet -> stall -> swaps; never a room ask (a Burrfolk never follows) ──
const s0 = net.settlements[0], folk = folkOf(s0, net.season), b = burrfolkOf(s0, net.season, folk)!
ok(isBurr(b.id) && !folk.some(f => f.id === b.id), 'the Burrfolk is not one of the folk (no recruit path)')
const calls: string[] = [], said: FolkTalkState[] = []
const act: FolkTalkActs = { go: st => said.push(st), give: () => calls.push('give'), recruit: () => calls.push('recruit'), bye: () => calls.push('bye'), barter: k => calls.push(`barter:${k}`) }
const ctx = { folk, home: folk, trust: freshTrust(), have: () => 0, room: 9, burr: b }
const hello = folkTalk(ctx, { fid: b.id, screen: 'hello' }, act)
ok(hello.line === BURRFOLK_BARKS.greet, 'greet = signed bark 1')
ok(!hello.options.some(o => o.label === ASK.room || o.label === ASK.needs || o.label === ASK.inspect), 'no room ask / needs / card at the stall')
hello.options.find(o => o.label === BURR_LABEL.look)!.pick()
ok(said.at(-1)?.screen === 'stall', 'Have a look opens the stall')
const stall = folkTalk(ctx, { fid: b.id, screen: 'stall' }, act)
ok(stall.line === BURRFOLK_BARKS.stall, 'stall = signed bark 2')
ok(stall.options.filter(o => o.label.startsWith('Swap')).length === b.stock.length, 'one swap per stock row')
ok(!stall.options.some(o => o.label === ASK.room), 'no room ask on the stall screen')
for (const o of stall.options) if (o.label.startsWith('Swap')) o.pick()
ok(calls.filter(c => c.startsWith('barter:')).length === b.stock.length && !calls.includes('recruit'), 'swaps call barter, never recruit')
console.log(fails ? `FAIL ${fails}/${n}` : `PASS ${n}/${n}`); process.exit(fails ? 1 : 0)
