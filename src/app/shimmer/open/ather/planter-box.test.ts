// M113 s1: the Planter Box grows a sapling. Run: npx tsx src/app/shimmer/open/ather/planter-box.test.ts
import { SAPLING_IDS, SAPLING_STAGES, STAGE_MS, plantBox, stageOf, nextStageAt, saplingsOnPlot, takeSapling, carryBox, settleBox, parseBoxes, BOX_KEY, type Boxes } from './planter-box'
import { liftPiece } from './piece-lift'
import { breakTarget } from './melee'
import { freshWorks, type Works } from './rooms'
import { GAME_DAY_MS } from './nodes'
import { GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'
import { newInv, give, countOf } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// the saplings are the item table's, none added
ok(JSON.stringify([...SAPLING_IDS].sort()) === JSON.stringify(['dawnwood_sapling', 'goldwood_sapling', 'shimmeroak_sapling', 'starwillow_sapling']), `sapling ids = the four in inventory.ts (${SAPLING_IDS})`)
ok(!SAPLING_IDS.some(id => id.startsWith('mana_seed')), 'no Mana Seed is a sapling (they stay Spirit-Planter-only)')
ok(GARDEN_KEY_SPECS.some(k => k.base === BOX_KEY), 'the box save is a registered garden key')

// plant + stages over game days
const t0 = 50 * GAME_DAY_MS + 777
const b1 = plantBox({}, 'pb1', 'goldwood_sapling', t0)!
ok(!!b1 && b1.pb1.sapling === 'goldwood_sapling' && b1.pb1.at === t0, 'a sapling plants')
ok(plantBox(b1, 'pb1', 'starwillow_sapling', t0) === null, 'a box holds one sapling')
ok(plantBox({}, 'pb1', 'mana_seed_owl', t0) === null, 'a Mana Seed does not plant in a box')
ok(plantBox({}, 'pb1', 'goldwood_log', t0) === null, 'a log does not plant in a box')
ok(STAGE_MS === GAME_DAY_MS, 'one stage per game day (the M106 clock)')
ok(stageOf(b1.pb1, t0) === 0 && stageOf(b1.pb1, t0 + STAGE_MS - 1) === 0, 'stage 0 through the first game day')
ok(stageOf(b1.pb1, t0 + STAGE_MS) === 1 && stageOf(b1.pb1, t0 + 2 * STAGE_MS + 5) === 2, 'a stage per game day')
ok(stageOf(b1.pb1, t0 + 99 * STAGE_MS) === SAPLING_STAGES - 1, 'capped at fully grown')
ok(stageOf(b1.pb1, t0 - 5000) === 0, 'a clock behind never goes negative')
ok(nextStageAt(b1.pb1, t0) === t0 + STAGE_MS && nextStageAt(b1.pb1, t0 + 99 * STAGE_MS) === null, 'next stage time')

// bag + bank listing; take from the bag first, else the bank
const inv = give(newInv(), 'goldwood_sapling', 1).inv
const bank = { v: 1 as const, stacks: [{ id: 'goldwood_sapling', n: 2 }, { id: 'starwillow_sapling', n: 1 }, { id: 'mana_seed_owl', n: 1 }] }
const list = saplingsOnPlot(inv, bank)
ok(JSON.stringify(list) === JSON.stringify([{ id: 'goldwood_sapling', bag: 1, bank: 2 }, { id: 'starwillow_sapling', bag: 0, bank: 1 }]), `lists bag + bank (${JSON.stringify(list)})`)
const tk = takeSapling(inv, bank, 'goldwood_sapling')!
ok(tk.from === 'bag' && countOf(tk.inv, 'goldwood_sapling') === 0 && tk.bank === bank, 'takes from the bag first')
const tb = takeSapling(newInv(), bank, 'starwillow_sapling')!
ok(tb.from === 'bank' && tb.bank.stacks.every(s => s.id !== 'starwillow_sapling'), 'a bank-only sapling comes from the bank')
ok(takeSapling(newInv(), { v: 1, stacks: [] }, 'goldwood_sapling') === null, 'none anywhere = null')

// carry + settle
const c = carryBox(b1, 'pb1')
ok(!c.pb1 && JSON.stringify(c['carried:pb1']) === JSON.stringify(b1.pb1), 'carry keeps sapling + planting time')
ok(carryBox({}, 'pb1') !== null && Object.keys(carryBox({}, 'pb1')).length === 0, 'an empty box carries nothing')
const s = settleBox(c, 'pb2')
ok(JSON.stringify(s) === JSON.stringify({ pb2: b1.pb1 }), 'the next box set down takes it back')
const two: Boxes = { 'carried:a': { sapling: 'goldwood_sapling', at: 5 }, 'carried:b': { sapling: 'dawnwood_sapling', at: 2 } }
ok(settleBox(two, 'x').x?.sapling === 'dawnwood_sapling', 'the oldest carried settles first')
ok(settleBox({}, 'x').x === undefined, 'nothing carried = nothing')
ok(settleBox(b1, 'pb1') === b1, 'a box that holds one already is unchanged')

// both pickup paths carry it (piece-lift: E 'Pick up' + the third melee hit)
const w: Works = { ...freshWorks(), pieces: [{ id: 'pb1', item: 'planter_box', x: 0, z: -1.5, q: 0, placedAt: 1 }, { id: 's1', item: 'goldwood_stool', x: 3, z: -1.5, q: 0, placedAt: 1 }] }
for (const [name, r] of [['E pick up', liftPiece(w, 'pb1', newInv(), {}, b1)], ['melee', breakTarget(w, { kind: 'piece', id: 'pb1' }, newInv(), {}, b1)]] as const) {
  ok(!!r && typeof r === 'object', `${name}: the box comes up`)
  if (!r || typeof r !== 'object') continue
  ok(countOf(r.inv, 'planter_box') === 1 && !r.works.pieces.some(p => p.id === 'pb1'), `${name}: the box is in the bag`)
  ok(!r.boxes.pb1 && JSON.stringify(r.boxes['carried:pb1']) === JSON.stringify(b1.pb1), `${name}: the sapling rides along unchanged`)
  const back = settleBox(r.boxes, 'pb9')
  ok(!!back.pb9 && stageOf(back.pb9, t0 + 2 * STAGE_MS) === 2, `${name}: re-placed, same stage`)
}
const stool = liftPiece(w, 's1', newInv(), {}, b1)
ok(typeof stool === 'object' && stool.boxes === b1, 'another piece leaves the boxes untouched')
let full = newInv(); for (let i = 0; i < 40; i++) full = give(full, `crop:ather_wheat:${'DCBAS'[i % 5]}`, 99).inv
const fr = liftPiece(w, 'pb1', full, {}, b1)
ok(fr === 'full', `a full bag lifts nothing (${typeof fr === 'string' ? fr : 'lifted'})`)

// parse
ok(JSON.stringify(parseBoxes({ a: { sapling: 'goldwood_sapling', at: 3 }, b: { sapling: 'mana_seed_owl', at: 3 }, c: { sapling: 'goldwood_sapling' }, d: null })) === JSON.stringify({ a: { sapling: 'goldwood_sapling', at: 3 } }), 'parse keeps only good rows')
ok(JSON.stringify(parseBoxes(null)) === '{}' && JSON.stringify(parseBoxes([1])) === '{}', 'parse junk = empty')

console.log(`planter-box: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
