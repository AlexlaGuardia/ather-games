// M242 s1: Planter Box STYLES + the LOCK + the box's own EXP. Run: npx tsx src/app/shimmer/open/ather/planter-box-styles.test.ts
import { PLANTER_BOX, PLANTER_STYLES, isPlanterBox, plantBox, pickBox, carryBox, settleBox, parseBoxes, lockedTo, expOf, boxTag, stageOf, grownAt, BOX_EXP_PER_HARVEST, BUSH_REGROW_MS, STAGE_MS, type Boxes } from './planter-box'
import { liftPiece } from './piece-lift'
import { breakTarget } from './melee'
import { FURNITURE, BENCH_JOBS } from './furniture'
import { freshWorks, type Works } from './rooms'
import { GAME_DAY_MS } from './nodes'
import { MOONBERRY } from './cooking'
import { newInv, countOf, itemDef } from '../shared/inventory'
import { existsSync } from 'fs'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// (1) STYLES: real pieces, the plain one first, each its own bench job (= the style pick), each with an icon
ok(PLANTER_STYLES[0] === PLANTER_BOX && PLANTER_STYLES.length >= 3, `styles: plain first, a few (${PLANTER_STYLES})`)
for (const id of PLANTER_STYLES) {
  const f = FURNITURE[id]
  ok(!!f && f.recipe.length > 0 && !f.build && !f.train && !f.spirit, `${id}: a craftable decor piece`)
  ok(!!f && f.recipe.every(c => !!itemDef(c.id) && itemDef(c.id).name !== c.id), `${id}: made from existing materials`)
  ok(BENCH_JOBS.some(j => j.id === id), `${id}: on the carpentry bench`)
  ok(existsSync(`public${itemDef(id).icon}`), `${id}: has its icon ${itemDef(id).icon}`)
  ok(isPlanterBox(id), `${id}: is a planter box`)
}
ok(new Set(PLANTER_STYLES.map(id => FURNITURE[id].name)).size === PLANTER_STYLES.length, 'every style has its own name')
ok(!isPlanterBox('spirit_planter') && !isPlanterBox('goldwood_stool'), 'other pieces are not planter boxes')

// (2) LOCK: once planted, the box takes nothing else (the same plant neither)
const t0 = 40 * GAME_DAY_MS + 123
const b1 = plantBox({}, 'pb1', MOONBERRY, t0)!
ok(lockedTo(b1, 'pb1') === MOONBERRY && lockedTo(b1, 'pbX') === null, 'locked to its plant; an empty box is free')
ok(plantBox(b1, 'pb1', 'goldwood_sapling', t0 + 5) === null, 'a Moonberry box refuses a sapling')
ok(plantBox(b1, 'pb1', MOONBERRY, t0 + 5) === null, 'and a second Moonberry (it does not re-root)')
ok(plantBox(b1, 'carried:pb1', 'goldwood_sapling', t0) === null, 'a carry key is never planted into')

// (3) EXP: every harvest gives the box EXP
const g = grownAt(b1.pb1)
const h1 = pickBox(b1, 'pb1', g)!
ok(expOf(b1.pb1) === 0 && expOf(h1.boxes.pb1) === BOX_EXP_PER_HARVEST && BOX_EXP_PER_HARVEST > 0, `a harvest gives EXP (${expOf(h1.boxes.pb1)})`)
const h2 = pickBox(h1.boxes, 'pb1', g + BUSH_REGROW_MS)!
ok(expOf(h2.boxes.pb1) === 2 * BOX_EXP_PER_HARVEST, 'two harvests, twice the EXP')
ok(pickBox(h2.boxes, 'pb1', g + BUSH_REGROW_MS + 1) === null && expOf(h2.boxes.pb1) === 2 * BOX_EXP_PER_HARVEST, 'no harvest, no EXP')
ok(boxTag(h2.boxes.pb1, 'Moonberry') === `Moonberry box · EXP ${2 * BOX_EXP_PER_HARVEST}`, `tag: ${boxTag(h2.boxes.pb1, 'Moonberry')}`)

// lift -> carried with its STYLE; set down a box of the same style -> same plant, stage, picks, EXP
const w: Works = { ...freshWorks(), pieces: [{ id: 'pb1', item: 'planter_box_carved', x: 0, z: -1.5, q: 0, placedAt: 1 }, { id: 'pb2', item: 'planter_tub_round', x: 3, z: -1.5, q: 0, placedAt: 1 }] }
const bx: Boxes = { ...h2.boxes, pb2: { sapling: 'starwillow_sapling', at: t0, exp: 3 } }
for (const [name, r] of [['E pick up', liftPiece(w, 'pb1', newInv(), {}, bx)], ['melee', breakTarget(w, { kind: 'piece', id: 'pb1' }, newInv(), {}, bx)]] as const) {
  ok(!!r && typeof r === 'object', `${name}: the carved box comes up`)
  if (!r || typeof r !== 'object') continue
  ok(countOf(r.inv, 'planter_box_carved') === 1, `${name}: the CARVED box is in the bag (its style is the item)`)
  const cr = r.boxes['carried:pb1']
  ok(cr?.box === 'planter_box_carved' && cr.sapling === MOONBERRY && expOf(cr) === 2 * BOX_EXP_PER_HARVEST, `${name}: plant + EXP ride along with the style`)
  ok(settleBox(r.boxes, 'n1', PLANTER_BOX) === r.boxes, `${name}: a PLAIN box set down does not take the carved box's plant`)
  ok(settleBox(r.boxes, 'n1', 'planter_tub_round') === r.boxes, `${name}: nor a tub`)
  const back = settleBox(r.boxes, 'n1', 'planter_box_carved')
  ok(back.n1?.sapling === MOONBERRY && expOf(back.n1) === 2 * BOX_EXP_PER_HARVEST && back.n1.at === t0 && back.n1.picked === h2.boxes.pb1.picked && back.n1.box === undefined && !back['carried:pb1'], `${name}: a carved box set down = the same plant, stage, picks + EXP`)
  ok(stageOf(back.n1, g) === stageOf(b1.pb1, g), `${name}: same stage`)
  ok(plantBox(back, 'n1', 'goldwood_sapling', g) === null, `${name}: still locked after the move`)
  ok(back.pb2 === bx.pb2, `${name}: the other box untouched`)
}
// two carried of different styles each go home to their own style
const mix: Boxes = { 'carried:a': { sapling: 'goldwood_sapling', at: 1, box: 'planter_tub_round' }, 'carried:b': { sapling: MOONBERRY, at: 5, exp: 4, box: 'planter_box_banded' } }
ok(settleBox(mix, 'x', 'planter_box_banded').x?.sapling === MOONBERRY && settleBox(mix, 'x', 'planter_tub_round').x?.sapling === 'goldwood_sapling', 'each carried plant settles into its own style only')

// SAVE-SAFE for M241 boxes: no style / no exp rows load as the plain box, EXP 0, still locked; an old carried row = plain
const old = parseBoxes({ p1: { sapling: MOONBERRY, at: 9, picked: 20 }, 'carried:p2': { sapling: 'goldwood_sapling', at: 3 } })
ok(JSON.stringify(old) === JSON.stringify({ p1: { sapling: MOONBERRY, at: 9, picked: 20 }, 'carried:p2': { sapling: 'goldwood_sapling', at: 3 } }), 'an M241 save loads unchanged')
ok(expOf(old.p1) === 0 && lockedTo(old, 'p1') === MOONBERRY, 'an M241 box: EXP 0, locked to its bush')
ok(settleBox(old, 'q', PLANTER_BOX).q?.sapling === 'goldwood_sapling', 'an M241 carried plant settles into a plain box (the default style)')
ok(settleBox(old, 'q', 'planter_box_banded') === old, '... not into another style')
ok(lockedTo(old, 'empty') === null && plantBox(old, 'empty', MOONBERRY, 1) !== null, 'an empty M241 box stays unlocked')
// parse keeps exp + style, drops junk
const rt = parseBoxes(JSON.parse(JSON.stringify({ a: { sapling: MOONBERRY, at: 1, exp: 7 }, 'carried:b': { sapling: MOONBERRY, at: 1, exp: 2, box: 'planter_tub_round' }, c: { sapling: MOONBERRY, at: 1, exp: -3, box: 'planter_tub_round' }, 'carried:d': { sapling: MOONBERRY, at: 1, box: 'goldwood_stool' }, e: { sapling: MOONBERRY, at: 1, exp: 'x' } })))
ok(expOf(rt.a) === 7 && rt['carried:b']?.box === 'planter_tub_round' && expOf(rt['carried:b']) === 2, 'a reload keeps EXP + a carried style')
ok(expOf(rt.c) === 0 && rt.c.box === undefined && rt['carried:d']?.box === undefined && expOf(rt.e) === 0, 'bad EXP / style dropped (a placed box carries no stamp)')
ok(STAGE_MS > 0, 'stages tick')

console.log(`planter-box-styles: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
