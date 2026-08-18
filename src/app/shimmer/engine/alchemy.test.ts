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
import { POTION_DEFS, INFUSION_BREWS, elementForInfusion, canBrew, brewPotion } from './alchemy'
import { ELEMENT_HERBS } from './farming'
import { ITEMS } from '../sprites/items'
import { createInventory, countItem, addItems } from './inventory'
import { createSkillSet } from './skills'
import { createManaPool } from './mana'

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

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
