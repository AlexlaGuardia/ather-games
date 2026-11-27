// BETA M237 s1: SETTLEMENTS IN THE WORLD BUILDER. settlement-edits.ts (the owner layer + the merge over the baked network),
// builder.ts (draft / publish carry it), settlement-lots.ts (the home count caps the lots), settlement-folk (the trade focus).
// Run: npx tsx src/app/shimmer/open/ather/settlement-edits.test.ts
import { readFileSync } from 'fs'
import { SETTLEMENT_GATHERS, CONTESTS, type Network } from './network'
import { cleanSettlementEdits, applySettlementEdits, addSettlementEdit, moveSettlementEdit, removeSettlementEdit, patchEdit, settlementEditsCanon, nextAddedId, addedName, removedIds, FOCUS_BIOMES, TENT_CONTESTS, HOMES_MAX, SETTLEMENT_NAME_POOL, type SettlementEdits, type EditedSettlement } from './settlement-edits'
import { cleanLayer, sameLayer, layerSize, planPublish, emptyIndex, EMPTY_LAYER } from '../../world/builder'
import { settlementLots, MAX_LOTS } from './settlement-lots'
import { folkOf } from './settlement-folk'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const bake = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const byId = (n: Network, id: string) => n.settlements.find(s => s.id === id) as EditedSettlement | undefined

// ── the options match the game's own tables ──
ok(JSON.stringify([...FOCUS_BIOMES].sort()) === JSON.stringify(Object.keys(SETTLEMENT_GATHERS).sort()), 'focus options = SETTLEMENT_GATHERS biomes')
ok(JSON.stringify(TENT_CONTESTS) === JSON.stringify(CONTESTS), 'tent contests = network CONTESTS')
ok(HOMES_MAX === MAX_LOTS, 'HOMES_MAX = MAX_LOTS')
const bakeSrc = readFileSync('scripts/bake-wilds-network.mts', 'utf8')
ok(SETTLEMENT_NAME_POOL.HEADS.every(h => bakeSrc.includes(`'${h}'`)) && SETTLEMENT_NAME_POOL.TAILS.every(t => bakeSrc.includes(`'${t}'`)), 'the name pool is the bake\'s own')

// ── no edits = the bake, the same object ──
ok(applySettlementEdits(bake, []) === bake && applySettlementEdits(bake, undefined) === bake, 'no edits: the very same network')

// ── OVERRIDE: move + focus + homes + tent on a baked one ──
const s0 = bake.settlements.find(s => s.id === 's1-0')!
let E: SettlementEdits = []
E = moveSettlementEdit(E, 's1-0', s0.x + 120.4, s0.z - 80.6)
E = patchEdit(E, 's1-0', { focus: 'rock', homes: 2, tent: { contest: 'clash', level: 'difficult' } })
const m1 = applySettlementEdits(bake, E), e0 = byId(m1, 's1-0')!
ok(e0.x === s0.x + 120 && e0.z === s0.z - 81, `move: s1-0 at (${e0.x}, ${e0.z})`)
ok(e0.biome === 'rock' && e0.bakedBiome === s0.biome, `focus overrides the biome (${s0.biome} -> ${e0.biome})`)
ok(e0.homes === 2 && e0.tent?.contest === 'clash' && e0.tent.level === 'difficult', 'homes + tent ride on the merged settlement')
ok(e0.moved === true && e0.pads === undefined && !!s0.pads?.length, 'a moved settlement drops its baked pads (they stood at the old spot)')
ok(m1.settlements.length === bake.settlements.length && m1.paths === bake.paths, 'others + paths untouched')
ok(bake.settlements.find(s => s.id === 's1-0')!.x === s0.x, 'the bake object is never mutated')
ok(byId(m1, 's1-1') === bake.settlements.find(s => s.id === 's1-1'), 'an unedited settlement is the same object')
// the focus reaches the folk: their trades come from the focus biome
ok(JSON.stringify(folkOf(e0, 1).map(f => f.profession)) === JSON.stringify(folkOf({ ...s0, biome: 'rock' }, 1).map(f => f.profession)), 'folk trades follow the focus')
// homes caps the lots
const lotsBake = settlementLots(s0, 1), lotsEd = settlementLots(e0, 1)
ok(lotsBake.length > 2 && lotsEd.length === 2, `homes 2: ${lotsEd.length} lots (bake ${lotsBake.length})`)
ok(settlementLots({ ...e0, homes: 0 }, 1).length === 0, 'homes 0: no lots')

// ── ADD ──
const a = addSettlementEdit(E, bake, -700.2, 900.7); E = a.edits
ok(a.id === 's1-x-11' && a.id === nextAddedId(E.filter(e => e.id !== a.id), bake), `added id ${a.id}`)
const m2 = applySettlementEdits(bake, E), ad = byId(m2, a.id)!
ok(!!ad && ad.x === -700 && ad.z === 901 && ad.biome === 'meadow' && ad.added === true, 'an added settlement stands at its spot, meadow by default')
ok(!!ad && !bake.settlements.some(s => s.name === ad.name) && /^[A-Z][a-z]+[a-z]+$/.test(ad.name), `its name is a fresh pool name (${ad?.name})`)
ok(addSettlementEdit(E, bake, 0, 0).id === 's1-x-12', 'the next add takes the next id')
E = patchEdit(E, a.id, { focus: 'shore', homes: 4, tent: { contest: 'dash' } })
const ad2 = byId(applySettlementEdits(bake, E), a.id)!
ok(ad2.biome === 'shore' && ad2.homes === 4 && ad2.tent?.contest === 'dash' && ad2.tent.level === undefined, 'the panel sets an added one too')
ok(folkOf(ad2, 1).length > 0 && folkOf(ad2, 1).every(f => f.home === a.id), 'an added settlement has folk')
ok(addedName('s1-x-11', []) === addedName('s1-x-11', []), 'names are stable')

// ── REMOVE ──
let R = removeSettlementEdit(E, 's1-3')
const m3 = applySettlementEdits(bake, R)
ok(!byId(m3, 's1-3') && m3.settlements.length === bake.settlements.length, 'remove a baked one (the add keeps the count)')
ok(JSON.stringify(removedIds(R)) === '["s1-3"]', 'removed list offers it back')
R = patchEdit(R, 's1-3', { removed: undefined })
ok(!!byId(applySettlementEdits(bake, R), 's1-3') && !R.some(e => e.id === 's1-3'), 'restoring a baked one with no other edit leaves no entry')
R = removeSettlementEdit(R, a.id)
ok(!R.some(e => e.id === a.id) && !byId(applySettlementEdits(bake, R), a.id), 'remove an added one: its entry goes')

// ── RE-BAKE SURVIVES: a new bake (moved spots, a settlement gone, a new one) keeps every edit by id ──
const rebake: Network = { ...bake, settlements: bake.settlements.filter(s => s.id !== 's1-5').map(s => ({ ...s, x: s.x + 7, z: s.z - 3 })).concat([{ id: 's1-11', name: 'Mossholt', x: 10, z: 10, biome: 'woods' }]) }
const E2 = patchEdit(E, 's1-5', { focus: 'woods' })
const m4 = applySettlementEdits(rebake, E2)
ok(byId(m4, 's1-0')!.x === s0.x + 120 && byId(m4, 's1-0')!.biome === 'rock' && byId(m4, 's1-0')!.homes === 2, 're-bake: the moved one stays where the owner put it, with its focus + homes')
ok(!!byId(m4, a.id) && byId(m4, a.id)!.x === -700, 're-bake: the added one still stands')
ok(!byId(m4, 's1-5') && !!byId(m4, 's1-11') && byId(m4, 's1-2')!.x === bake.settlements.find(s => s.id === 's1-2')!.x + 7, 're-bake: an edit whose id is gone is ignored; new + unedited take the bake')
ok(a.id !== 's1-11', 'an added id never collides with a baked id form')

// ── the wire: junk-proof, last per id wins ──
const W = cleanSettlementEdits({ settlements: [
  { id: 's1-0', x: 1, z: 2, focus: 'lava', homes: 9, tent: { contest: 'clash' } },
  { id: 'evil', x: 0, z: 0 }, null, 7, { id: 's1-x-20', focus: 'rock' }, { id: 's1-x-21', x: 5, z: 5, name: '<script>' },
  { id: 's1-4', x: 1e9, z: 0, tent: { contest: 'jump' } }, { id: 's1-4', homes: 3 }, { id: 's1-6', removed: 'yes' },
] })
const w0 = W.find(e => e.id === 's1-0')!
ok(w0.x === 1 && w0.focus === undefined && w0.homes === undefined && w0.tent?.contest === 'clash' && w0.tent.level === 'easy', 'bad focus / homes dropped; a Clash tent with no level = easy')
ok(!W.some(e => e.id === 'evil') && !W.some(e => e.id === 's1-x-20'), 'a bad id and an added one with no spot are dropped')
ok(W.find(e => e.id === 's1-x-21')!.name === 's1-x-21', 'a bad name falls back to the id')
ok(JSON.stringify(W.find(e => e.id === 's1-4')) === '{"id":"s1-4","homes":3}', 'last entry per id wins; far coords + bad tent dropped')
ok(!W.find(e => e.id === 's1-6')?.removed, 'removed must be exactly true')
ok(cleanSettlementEdits({ settlements: 'x' }).length === 0 && cleanSettlementEdits(null).length === 0, 'junk = none')

// ── the builder layer carries it: clean, size, sameLayer, publish ──
const L = cleanLayer({ ...EMPTY_LAYER, settlements: E })
ok(JSON.stringify(L.settlements) === JSON.stringify(cleanSettlementEdits({ settlements: E })) && L.settlements!.length === E.length, 'cleanLayer keeps the settlements')
ok(cleanLayer(EMPTY_LAYER).settlements === undefined, 'no edits = no key (older layers byte-identical)')
ok(layerSize(L).settlements === E.length, 'layerSize counts them')
ok(!sameLayer(L, EMPTY_LAYER) && sameLayer(L, cleanLayer({ ...EMPTY_LAYER, settlements: [...E].reverse() })), 'sameLayer sees them, order-free')
ok(!sameLayer(L, cleanLayer({ ...EMPTY_LAYER, settlements: patchEdit(E, 's1-0', { homes: 3 }) })), 'sameLayer sees a home-count change')
const plan = planPublish(emptyIndex('wilds'), L, EMPTY_LAYER, 't')
const live = plan.writes.find(w => w.kind === 'live') as { layer: typeof L }
ok(settlementEditsCanon(live.layer.settlements) === settlementEditsCanon(E), 'Publish writes them to the live layer')
// round trip through JSON (the file) and the game's merge
const back = cleanSettlementEdits(JSON.parse(JSON.stringify(live.layer)))
ok(JSON.stringify(applySettlementEdits(bake, back).settlements) === JSON.stringify(applySettlementEdits(bake, E).settlements), 'file round trip: the game merges the same network')

console.log(`settlement-edits: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
