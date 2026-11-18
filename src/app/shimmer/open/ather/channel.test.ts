// Run: npx tsx src/app/shimmer/open/ather/channel.test.ts
// Gathering by channel (ather/channel.ts). The pins: a node's chips add up to EXACTLY its old one-shot roll (no economy
// change), every chip drops something, extras land with the last chip, mana totals the old cost, a stopped node keeps its
// progress and the SAME roll (walking off cannot re-roll), and a finished node is forgotten.
import { splitDrops, chipsFor, chipGapMs, CHIP_GAP_MS, beginWork, takeChip, workOf, _resetWork, CHIPS_BY_TIER } from './channel'
import { prunePlan, prune, _resetForestry } from './forestry'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const total = (xs: { id: string; n: number }[][]) => { const t: Record<string, number> = {}; for (const c of xs) for (const s of c) t[s.id] = (t[s.id] ?? 0) + s.n; return t }

const plan = [{ id: 'goldwood_log', n: 4 }, { id: 'goldwood_sapling', n: 1 }, { id: 'mast', n: 1 }]
const ch = splitDrops(plan, 3)
ok(JSON.stringify(total(ch)) === JSON.stringify({ goldwood_log: 4, goldwood_sapling: 1, mast: 1 }), 'split: the chips do not add up to the roll')
ok(ch.every(c => c.some(s => s.id === 'goldwood_log')), 'split: a chip dropped nothing')
ok(ch[2].some(s => s.id === 'goldwood_sapling') && ch[2].some(s => s.id === 'mast') && !ch[0].some(s => s.id === 'mast'), 'split: an extra came before the last chip')
ok(splitDrops([{ id: 'x', n: 2 }], 3)[2].length === 0 && total(splitDrops([{ id: 'x', n: 2 }], 3)).x === 2, 'split: fewer units than chips lost or invented one')
ok(CHIPS_BY_TIER.every((n, i) => n >= 3 && n <= 5 && (i === 0 || n >= CHIPS_BY_TIER[i - 1])) && chipsFor(1) === 3 && chipsFor(4) === 5 && chipsFor(9) === 5, 'chips: not 3..5 rising with tier')
ok(chipGapMs() === CHIP_GAP_MS && chipGapMs(0.8) < CHIP_GAP_MS, 'gap: a better focus is not quicker')

// the same roll as a one-shot prune (seeded): the channel only deals it out
const seq = (xs: number[]) => { let i = 0; return () => xs[i++ % xs.length] }
_resetForestry()
const viaPlan = prunePlan('goldwood', seq([0.9, 0.01, 0.2])), viaPrune = prune('goldwood', 'old-way', seq([0.9, 0.01, 0.2]))
ok(viaPrune.ok && JSON.stringify(viaPrune.drops) === JSON.stringify(viaPlan), 'economy: a channel plan is not the old prune roll')

// work: kept per node, same roll on return, forgotten when done; mana totals the old cost
_resetWork()
let rolls = 0
const mk = () => { rolls++; return { drops: [{ id: 'goldwood_log', n: 3 }], extra: 'perk' } }
const w = beginWork('tree', 't1', mk, 1, 5)
ok(w.chips.length === 3 && Math.abs(w.manaPerChip * w.chips.length - 5) < 1e-9 && w.extra === 'perk', 'work: wrong chips, mana share or extra')
const c1 = takeChip(w)
ok(c1.drops[0].n === 1 && !c1.last && workOf('t1')?.done === 1, 'work: the first chip')
const again = beginWork('tree', 't1', mk, 1, 5)
ok(again === w && rolls === 1, 'work: stopping and coming back re-rolled the node')
takeChip(w); const c3 = takeChip(w)
ok(c3.last && !workOf('t1'), 'work: a finished node is still kept')
beginWork('tree', 't1', mk, 1, 5)
ok(rolls === 2, 'work: a regrown node did not roll fresh')
if (fails.length) { console.error(`channel: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`channel: ${pass}/0`)
