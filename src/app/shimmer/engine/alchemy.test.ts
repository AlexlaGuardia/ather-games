// Run: npx tsx src/app/shimmer/engine/alchemy.test.ts
//
// ★ THE POINT OF THIS FILE IS THE JOINS, NOT THE NUMBERS. The canon gate (`npm run canon`,
// [infusions]) reads the canon claims: four brews, one per ruled element, each catalysed by its own
// crystal and fed by its own herb. What it cannot see is whether those ids resolve to anything the
// build actually has — and every one of those failures is silent. A recipe naming an item with no
// ItemDef does not throw; the brew simply can never be made, forever, while the game runs fine and
// the other three elements work. A keeper reads that as "Earth spirits just don't seem to evolve."
//
// The infusions are canon's ONLY road to an evolved form, so a broken join here costs ten of the
// forty ruled second forms per element, with nothing on screen to say so.
import { POTION_DEFS, INFUSION_BREWS, elementForInfusion, canBrew, brewPotion, applyInfusion } from './alchemy'
import { ELEMENT_HERBS } from './farming'
import { ITEMS } from '../sprites/items'
import { createInventory, countItem, addItems } from './inventory'
import { createSkillSet } from './skills'
import { createManaPool } from './mana'
import { createSpirit, infusionTotal, dominantInfusion, MAX_INFUSIONS_TOTAL, MAX_INFUSIONS_PER_ELEMENT } from '../spirits/spirit'
import { spiritsToSave, spiritsFromSave } from '../spirits/spirit-save'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const ELEMENTS = ['mana', 'storm', 'earth', 'water'] as const
const itemIds = new Set(ITEMS.map(i => i.id))
/** Canon names each element's catalyst in game/shimmer-skilling.md; these are its build ids. */
const CATALYST: Record<string, string> = {
  mana: 'violet_crystal', storm: 'storm_crystal', earth: 'earth_crystal', water: 'water_crystal',
}

console.log('\nthe four elemental infusions')
{
  for (const el of ELEMENTS) {
    const id = INFUSION_BREWS[el]
    const def = POTION_DEFS[id]

    // ★★ THE ONE THAT MATTERS MOST. A missing brew is not a missing feature, it is ten canon second
    // forms that can never be reached, while the game reports nothing at all.
    check(`${el} has a brew that resolves in POTION_DEFS`, !!def, `INFUSION_BREWS.${el} = '${id}'`)
    if (!def) continue

    // ⚠ THE HERB JOIN IS THE WHOLE POINT OF SLICE ①. If the storm brew is fed by tidepetal, the
    // keeper farms the wrong plant and their spirit grows into the wrong RULED form — legal code,
    // canon contradiction, identical in a diff.
    const herb = ELEMENT_HERBS[el].harvestItemId
    check(`the ${el} brew is fed by its own element's herb`,
      def.recipe.some(r => r.itemId === herb), `wants ${herb}, recipe has ${def.recipe.map(r => r.itemId).join('+')}`)

    check(`the ${el} brew is catalysed by its own element's crystal`,
      def.recipe.some(r => r.itemId === CATALYST[el]), `wants ${CATALYST[el]}`)

    // ⚠ EVERY INGREDIENT MUST BE A REAL ITEM. A dangling itemId is the quiet version of a missing
    // brew: `canAfford` simply never returns true and nothing anywhere says why.
    for (const r of def.recipe) {
      check(`${el} brew ingredient '${r.itemId}' has an ItemDef`, itemIds.has(r.itemId))
      check(`${el} brew ingredient '${r.itemId}' costs a positive count`, r.count > 0, `got ${r.count}`)
    }
    check(`the ${el} brew yields something`, def.resultCount > 0)
    check(`the ${el} brew itself has an ItemDef to land in the bag`, itemIds.has(id))
  }

  // ★ ALL FOUR ARE PEERS, AND THIS IS A DESIGN CLAIM WORTH FAILING ON. A cheaper infusion is a
  // cheaper ELEMENT, and the element decides which of four ruled second forms a spirit becomes — so
  // an innocent tuning nudge here is a thumb on forty canon outcomes.
  const defs = ELEMENTS.map(el => POTION_DEFS[INFUSION_BREWS[el]]).filter(Boolean)
  const same = (f: (d: typeof defs[number]) => number) => new Set(defs.map(f)).size === 1
  check('all four cost the same alchemy level', same(d => d.minAlchemyLevel))
  check('all four cost the same mana', same(d => d.manaCost))
  check('all four grant the same xp', same(d => d.xpGrant))
  check('all four yield the same count', same(d => d.resultCount))
  check('all four take the same number of ingredients', same(d => d.recipe.length))

  // ★ AND EACH ELEMENT GETS ITS OWN BREW — a mapping where two elements share one potion would make
  // dominantInfusion() unreachable for one of them while every assert above still passed.
  check('no two elements share a brew', new Set(Object.values(INFUSION_BREWS)).size === 4)
}

console.log('\nelementForInfusion')
{
  for (const el of ELEMENTS) check(`${el} round-trips`, elementForInfusion(INFUSION_BREWS[el]) === el)

  // ⚠⚠ THE TRAP THIS FUNCTION EXISTS TO AVOID. `ather_infusion` is a tier-4 PLAYER BUFF with nothing
  // to do with the elemental spine. Any implementation that reads the id's spelling sweeps it in and
  // hands a spirit an element canon never ruled — and it would look completely correct.
  check('the tier-4 Ather Infusion is NOT an elemental infusion',
    elementForInfusion('ather_infusion') === null)
  check('an ordinary potion is not an elemental infusion', elementForInfusion('mana_draught') === null)
  check('an unknown id is not an elemental infusion', elementForInfusion('nonsense') === null)
}

console.log('\nbrewing one, for real')
{
  const el = 'storm' as const
  const id = INFUSION_BREWS[el]
  const def = POTION_DEFS[id]
  const inv = createInventory(), skills = createSkillSet(), mana = createManaPool(1)
  skills.alchemy.level = def.minAlchemyLevel
  mana.current = def.manaCost
  for (const r of def.recipe) addItems(inv, r.itemId, r.count)

  check('exactly the recipe is enough to brew', canBrew(id, inv, skills.alchemy.level, mana))
  const ok = brewPotion(id, inv, skills, mana)
  check('the brew succeeds', ok)
  check('and the infusion is in the bag', countItem(inv, id) >= def.resultCount, `got ${countItem(inv, id)}`)
  for (const r of def.recipe) check(`it consumed the ${r.itemId}`, countItem(inv, r.itemId) === 0)

  // ⚠ ONE SHORT MUST FAIL. A recipe that brews without its herb would make slice ① decorative.
  const inv2 = createInventory(), mana2 = createManaPool(1)
  mana2.current = def.manaCost
  for (const r of def.recipe) addItems(inv2, r.itemId, r.count - (r.itemId === ELEMENT_HERBS[el].harvestItemId ? 1 : 0))
  check('one herb short and it refuses', !canBrew(id, inv2, def.minAlchemyLevel, mana2))

  // ⚠ AND THE LEVEL GATE IS REAL, not decoration on the tooltip.
  const inv3 = createInventory(), mana3 = createManaPool(1)
  mana3.current = def.manaCost
  for (const r of def.recipe) addItems(inv3, r.itemId, r.count)
  check('under the alchemy level it refuses', !canBrew(id, inv3, def.minAlchemyLevel - 1, mana3))
}

console.log('\npouring an infusion into a spirit')
{
  const spiritWith = (bag: [string, number][] = []) => {
    const inv = createInventory()
    for (const [id, n] of bag) addItems(inv, id, n)
    return { inv, s: createSpirit('fox', 'Test', 0, 0) }
  }

  // ★ THE POINT OF THE WHOLE ROW: before this call existed, dominantInfusion() returned null forever
  // and all forty ruled second forms were unreachable.
  {
    const { inv, s } = spiritWith([[INFUSION_BREWS.storm, 1]])
    const r = applyInfusion(inv, s, INFUSION_BREWS.storm)
    check('pouring a storm infusion succeeds', r.ok === true)
    check('the spirit gained a storm point', s.infusions.storm === 1)
    check('and nothing else moved', infusionTotal(s.infusions) === 1)
    check('the bottle left the bag', countItem(inv, INFUSION_BREWS.storm) === 0)
  }

  // ⚠⚠ ASK FIRST, SPEND SECOND — THE ASSERT THIS FUNCTION EXISTS FOR. A refusal that has already
  // eaten the bottle destroys a tier-2 brew (four gathered ingredients, a farming cycle) for
  // nothing, and reads to a keeper as "the button sometimes doesn't work".
  {
    const { inv, s } = spiritWith([[INFUSION_BREWS.storm, 1]])
    s.infusions.storm = MAX_INFUSIONS_PER_ELEMENT
    const r = applyInfusion(inv, s, INFUSION_BREWS.storm)
    check('a spirit full of storm refuses more', r.ok === false)
    check('and says WHICH full it is', !r.ok && r.reason === 'element-full')
    check('★ and the bottle is STILL IN THE BAG', countItem(inv, INFUSION_BREWS.storm) === 1)
    check('and no point was added', s.infusions.storm === MAX_INFUSIONS_PER_ELEMENT)
  }
  {
    const { inv, s } = spiritWith([[INFUSION_BREWS.water, 1]])
    s.infusions.storm = 6; s.infusions.earth = 5   // 11 total, water still 0
    check('the total cap is genuinely reached', infusionTotal(s.infusions) === MAX_INFUSIONS_TOTAL)
    const r = applyInfusion(inv, s, INFUSION_BREWS.water)
    check('a spirit at the total cap refuses a fresh element', r.ok === false)
    check('and calls it spirit-full, not element-full', !r.ok && r.reason === 'spirit-full')
    check('★ and that bottle is still in the bag too', countItem(inv, INFUSION_BREWS.water) === 1)
  }

  // ⚠ AN EMPTY BAG IS NOT A CAP. Conflating them is how a keeper is told their spirit is full when
  // they simply have not brewed one yet.
  {
    const { inv, s } = spiritWith()
    const r = applyInfusion(inv, s, INFUSION_BREWS.earth)
    check('with none in the bag it refuses', r.ok === false)
    check('and says so as none-in-bag', !r.ok && r.reason === 'none-in-bag')
    check('and the spirit is untouched', infusionTotal(s.infusions) === 0)
  }

  // ⚠ AND AN ORDINARY POTION CANNOT BE POURED INTO A SPIRIT — including the tier-4 `ather_infusion`,
  // which is a player buff whose id would fool any spelling-based rule.
  for (const bad of ['mana_draught', 'ather_infusion', 'nonsense']) {
    const { inv, s } = spiritWith([[bad, 1]])
    const r = applyInfusion(inv, s, bad)
    check(`'${bad}' is refused as not-an-infusion`, r.ok === false && !r.ok && r.reason === 'not-an-infusion')
    check(`'${bad}' is not consumed`, countItem(inv, bad) === 1)
    check(`'${bad}' adds nothing`, infusionTotal(s.infusions) === 0)
  }

  // ★ STEERING IS THE WHOLE MECHANIC — pour a majority and the dominant element is what the level-34
  // threshold will read. Asserted through the real API, not by setting the record by hand.
  {
    const { inv, s } = spiritWith([[INFUSION_BREWS.earth, 3], [INFUSION_BREWS.mana, 1]])
    for (let i = 0; i < 3; i++) applyInfusion(inv, s, INFUSION_BREWS.earth)
    applyInfusion(inv, s, INFUSION_BREWS.mana)
    check('four pours land four points', infusionTotal(s.infusions) === 4)
    check('and the majority element is dominant', dominantInfusion(s.infusions) === 'earth')
  }

  // ⚠ NO LEVEL GATE. Infusing is how the form is STEERED; level 34 is when the world reads the
  // ledger, not when the keeper may write to it.
  {
    const { inv, s } = spiritWith([[INFUSION_BREWS.mana, 1]])
    s.level = 1
    check('a level-1 spirit can still be infused', applyInfusion(inv, s, INFUSION_BREWS.mana).ok === true)
  }
}

console.log('\nand it survives a reload')
{
  // ⚠⚠ THE FAILURE THIS PINS IS THE WORST ONE AVAILABLE HERE. Pouring mutates the Spirit in place,
  // so if the save round-trip dropped `infusions` the keeper would spend a tier-2 brew, watch the
  // number go up, and find it gone next session — strictly worse than a refusal, and invisible in
  // any test that only calls applyInfusion.
  const inv = createInventory()
  addItems(inv, INFUSION_BREWS.earth, 2)
  const s = createSpirit('owl', 'Reload', 0, 0)
  applyInfusion(inv, s, INFUSION_BREWS.earth)
  applyInfusion(inv, s, INFUSION_BREWS.earth)
  const back = spiritsFromSave(spiritsToSave([s]))[0]
  check('the poured points come back', back.infusions.earth === 2, `got ${back?.infusions?.earth}`)
  check('the total comes back', infusionTotal(back.infusions) === 2)
  check('and the lean the threshold reads comes back', dominantInfusion(back.infusions) === 'earth')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
