// Yarrow's counter and the recipe book — the canon boundary as asserts.
// Run: npx tsx src/app/shimmer/voxel3d/recipe-book.test.ts
import {
  LADDER, FIRST_RECIPE, HERB_PAIR, fillHerbs, nextRung, learnFromBrew, learnFirst, legacyKnown, parseBook,
  type RecipeBook,
} from './recipe-book'
import { talkFolk, answerYarrow, migrate, type TutorialState } from './tutorial'
import { POTION_DEFS } from '../engine/alchemy'
import { ELEMENT_HERBS } from '../voxel/crops'
import { FOLK_IDS } from './folk'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const done: TutorialState = { stage: 'done', met: [...FOLK_IDS], hazel: 'done' }
const hands = { planks: 0, hasHazelsBlade: false }
const text = (bs: readonly unknown[]) => JSON.stringify(bs)

// §1 the gate: a cauldron of their own, and a return. Not before.
{
  const before = talkFolk(done, 'yarrow', { ...hands, cauldronOnPlot: false })
  ok(!before.choice && !text(before.beats).includes('Then it is today'), '§1 no cauldron → Yarrow barks, does not teach')
  const t = talkFolk(done, 'yarrow', { ...hands, cauldronOnPlot: true })
  ok(t.choice === 'yarrow', '§1 ★ cauldron on the plot → the counter scene, with its choice')
  ok(t.next === done && !t.effect, '§1 opening the scene changes nothing — closing unanswered leaves it armed')
  ok(text(t.beats).includes(`puts ${HERB_PAIR.wrong.name} into`), '§1 the WRONG slot is filled')
  ok(!/<RIGHT>|<WRONG>/.test(text(t.beats)), '§1 no placeholder reaches the screen')
  const firstMeet = talkFolk({ ...done, met: [] }, 'yarrow', { ...hands, cauldronOnPlot: true })
  ok(!firstMeet.choice, '§1 the first knock is the greeting, never the teaching — it is a RETURN beat')
  const taught = talkFolk({ ...done, yarrow: 'taught' }, 'yarrow', { ...hands, cauldronOnPlot: true })
  ok(!taught.choice, '§1 ★ "I will show you once" — never a second teaching')
}

// §2 ★ THE OPTION DOES NOT GATE: both answers give the herb and the page; only one line differs.
{
  const p = answerYarrow(done, 'pointed'), s = answerYarrow(done, 'silent')
  ok(p.effect === 'yarrow_page' && s.effect === 'yarrow_page', '§2 ★ both answers give the page')
  ok(p.next.yarrow === 'taught' && s.next.yarrow === 'taught', '§2 both mark the teaching spent')
  ok(text(p.beats).includes('You looked at the plant') && !text(p.beats).includes('Wrong one.'), '§2 pointing gets its line')
  ok(text(s.beats).includes('Wrong one. Same look.') && !text(s.beats).includes('You looked'), '§2 silence gets its line')
  ok(text(p.beats).includes(`${HERB_PAIR.right.name}. That is the one with mana in it.`), '§2 the RIGHT slot is filled, bare noun')
  ok(answerYarrow({ ...done, yarrow: 'taught' }, 'pointed').effect === undefined, '§2 a stale answer after the page gives nothing twice')
}

// §3 the save keeps the teaching (migrate used to rebuild the object and would have dropped it).
ok(migrate({ stage: 'done', yarrow: 'taught' }).yarrow === 'taught', '§3 ★ a done save keeps yarrow:taught')
ok(migrate({ stage: 'doors', met: ['yarrow'], hazel: 'unmet', yarrow: 'taught' }).yarrow === 'taught', '§3 a mid save keeps it too')
ok(migrate({ stage: 'done' }).yarrow === undefined, '§3 an old save has not been taught')

// §4 the pair: canon's constraint — the right one is the Mana herb, the wrong one shares the look, not the element.
ok(HERB_PAIR.right.itemId === ELEMENT_HERBS.mana.harvestItemId, '§4 ★ RIGHT is canon\'s Mana element herb')
ok(!Object.values(ELEMENT_HERBS).some(h => h.harvestItemId === HERB_PAIR.wrong.itemId), '§4 ★ WRONG carries no element')
ok(!/\s/.test(HERB_PAIR.right.name) && !/\s/.test(HERB_PAIR.wrong.name), '§4 single words — the slots are bare nouns')
ok(fillHerbs('<RIGHT>/<WRONG>') === `${HERB_PAIR.right.name}/${HERB_PAIR.wrong.name}`, '§4 fillHerbs fills both')

// §5 the draught uses the herb Yarrow hands over — or the lesson is a lie at the pot.
ok(POTION_DEFS[FIRST_RECIPE].recipe.some(r => r.itemId === HERB_PAIR.right.itemId), '§5 ★ the Mana Draught takes the right herb')
ok(!POTION_DEFS[FIRST_RECIPE].recipe.some(r => r.itemId === HERB_PAIR.wrong.itemId), '§5 and never the wrong one')

// §6 the ladder: one pour, one page, gated by level; nothing before Yarrow's page.
{
  const empty: RecipeBook = { known: [] }
  ok(learnFromBrew(empty, 25) === null && empty.known.length === 0, '§6 ★ an empty book learns nothing from a pot — the first page is Yarrow\'s')
  const b: RecipeBook = { known: [] }
  ok(learnFirst(b) && b.known[0] === FIRST_RECIPE && !learnFirst(b), '§6 Yarrow\'s page, idempotent')
  const got = learnFromBrew(b, 1)
  ok(got !== null && POTION_DEFS[got].minAlchemyLevel <= 1, `§6 a level-1 pour works out a level-1 page (${got})`)
  let n = 0
  while (learnFromBrew(b, 1)) n++
  ok(b.known.every(id => POTION_DEFS[id].minAlchemyLevel <= 1), '§6 ★ the level still gates what a page can be')
  ok(nextRung(b.known, 1) === null, '§6 pages run out at the level\'s edge')
  ok(learnFromBrew(b, 5) !== null, '§6 and resume when the level rises')
  ok(LADDER.length === Object.keys(POTION_DEFS).length && new Set(LADDER).size === LADDER.length, '§6 the ladder holds every recipe once')
}

// §7 grandfathered saves lose nothing; parse is defensive.
ok(legacyKnown(1).includes(FIRST_RECIPE) && legacyKnown(1).every(id => POTION_DEFS[id].minAlchemyLevel <= 4), '§7 legacy = the old level+3 window, exactly')
ok(parseBook({ known: ['mana_draught', 'nope', 'mana_draught'], cauldron: true })?.known.join() === 'mana_draught', '§7 unknown ids and duplicates drop')
ok(parseBook({ known: 'x' }) === null && parseBook(null) === null, '§7 a shapeless record is no record')

if (fails.length) { console.error(`recipe-book: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`recipe-book: ${pass}/${pass} pass`)
