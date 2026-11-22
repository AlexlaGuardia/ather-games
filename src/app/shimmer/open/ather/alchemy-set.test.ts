// alchemy-set.ts. Run: npx tsx src/app/shimmer/open/ather/alchemy-set.test.ts
import {
  ALC_POTIONS, ALC_POTION_ORDER, ALC_ORDER, INTERMEDIATES, POTENCY, gradeOf, gradeFrom, fills, pickFor, stepMakes, nextStep,
  effectOf, isAlcPotion, alcName, stepsAt, chainOf, ALC_STATIONS,
} from './alchemy-set'
import { OPEN_ITEMS } from '../shared/inventory'
import { CROPS } from './farming'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// every chain is well formed: ends at the desk, every alc: input is made by an earlier step, every plain input is a real bag row
for (const id of ALC_POTION_ORDER) {
  const p = ALC_POTIONS[id], made = new Set<string>()
  ok(p.steps[p.steps.length - 1].at === 'desk' && p.steps[p.steps.length - 1].out === id, `${id}: the last step is the desk and pours it`)
  p.steps.forEach((s, k) => {
    for (const slot of s.in) {
      if (slot.id.startsWith('alc:')) ok(made.has(slot.id.slice(4)), `${id} step ${k}: ${slot.id} is made by an earlier step`)
      else if (slot.id.startsWith('crop:')) ok(slot.id.slice(5) in CROPS, `${id} step ${k}: ${slot.id} is a crop`)
      else ok(slot.id in OPEN_ITEMS, `${id} step ${k}: ${slot.id} is a bag row`)
    }
    if (k < p.steps.length - 1) { ok(s.out in INTERMEDIATES, `${id} step ${k}: ${s.out} is named`); made.add(s.out) }
  })
}
ok(ALC_ORDER.every(a => stepsAt(a).length > 0), 'every station has work to do')
ok(['health', 'mana', 'wisdom'].every(p => p in ALC_POTIONS), 'the starter set: health, mana, an XP boost')
// Alex's chain, word for word
const h = ALC_POTIONS.health.steps.map(s => s.at).join()
ok(h === 'crusher,nook,still,desk', 'health = the ruled first recipe: Rinnscale Dust, Goldleaf Steep, Golden Dew Extract, Desk')
ok(ALC_POTIONS.health.steps.slice(0, -1).map(s => INTERMEDIATES[s.out]).join() === 'Rinnscale Dust,Goldleaf Steep,Golden Dew Extract', 'the first recipe, word for word (61911e7)')
ok(['health', 'mana', 'wisdom'].map(p => ALC_POTIONS[p].name).join() === 'Health Draught,Mana Draught,Starlight Tincture', 'the three ruled starters')
// the naming grammar: every intermediate ends in its station's word
const WORD = { crusher: /( Dust| Gel)$/, nook: / Steep$/, still: / Extract$/ } as const
ok(ALC_POTION_ORDER.every(p => ALC_POTIONS[p].steps.slice(0, -1).every(s => s.at !== 'desk' && WORD[s.at as keyof typeof WORD].test(INTERMEDIATES[s.out]))), 'every intermediate is named by its station (Dust/Gel, Steep, Extract)')
// the ruled chain order (2cbbaca): crush -> mix -> distil -> combine; no potion walks it backwards, every one ends at the Desk
const RANK = { crusher: 0, nook: 1, still: 2, desk: 3 } as const
ok(ALC_POTION_ORDER.every(p => chainOf(p).every((a, k, c) => !k || RANK[c[k - 1]] <= RANK[a])), 'every recipe walks the chain in order')
ok(ALC_ORDER.join() === 'crusher,nook,still,desk' && ALC_ORDER.map(a => ALC_STATIONS[a].name).join() === 'Crusher Table,Cauldron Nook,Still,Alchemy Desk', 'the four ruled stations, in chain order')
ok(stepsAt('crusher').some(x => x.step.out.endsWith('_gel')) && stepsAt('crusher').some(x => x.step.out.endsWith('_powder') || x.step.out.endsWith('_dust')), 'the Crusher makes powders AND gels')

// grades
ok(gradeOf('crop:goldleaf:B') === 'B' && gradeOf('goldleaf') === null && gradeOf('alc:rinnscale_dust:S') === 'S', 'gradeOf')
ok(fills('crop:goldleaf', 'crop:goldleaf:A') && !fills('crop:goldleaf', 'crop:dewdrop_vine:A') && !fills('crop:goldleaf', 'seed:goldleaf:A'), 'a graded slot takes any grade of that crop only')
ok(fills('shimmerscale', 'shimmerscale') && !fills('shimmerscale', 'crop:shimmerscale:A'), 'a plain slot takes itself')
ok(gradeFrom([{ id: 'crop:goldleaf:S', n: 2 }, { id: 'crop:dewdrop_vine:S', n: 2 }]) === 'S', 'all S makes S')
ok(gradeFrom([{ id: 'crop:goldleaf:S', n: 1 }, { id: 'crop:dewdrop_vine:D', n: 3 }]) === 'C', 'one S on three D rounds down to C (score 2)')
ok(gradeFrom([{ id: 'crop:goldleaf:A', n: 1 }, { id: 'crop:dewdrop_vine:D', n: 1 }]) === 'C', 'A with D (2.5) rounds DOWN to C')
ok(gradeFrom([{ id: 'shimmerscale', n: 2 }]) === 'D', 'nothing graded makes D')
ok(stepMakes('health', 0, [{ id: 'shimmerscale', n: 2 }]).id === 'alc:rinnscale_dust' && fills('alc:rinnscale_dust', 'alc:rinnscale_dust') && !fills('crop:goldleaf', 'crop:goldleaf'), 'ground plain scales stay plain and fill their slot')
ok(stepMakes('mana', ALC_POTIONS.mana.steps.length - 1, [{ id: 'alc:shard_steep', n: 1 }]).id === 'potion:mana:D', 'a bottle with no grade in it is a D')
ok(gradeFrom([{ id: 'shimmerscale', n: 9 }, { id: 'alc:x:A', n: 1 }]) === 'A', 'plain inputs do not drag a grade down')

// a whole chain: grades carry through every step to the bottle's potency
const bag: Record<string, number> = { shimmerscale: 2, 'crop:goldleaf:A': 2, 'crop:dewdrop_vine:A': 2 }
const spend = (s: { id: string; n: number }[]) => { for (const x of s) { bag[x.id] -= x.n; if (!bag[x.id]) delete bag[x.id] } }
const give = (x: { id: string; n: number }) => { bag[x.id] = (bag[x.id] ?? 0) + x.n }
ok(nextStep('health', bag) === 1 || nextStep('health', bag) === 0, 'health can start')
for (let k = 0; k < ALC_POTIONS.health.steps.length; k++) {
  const s = pickFor(ALC_POTIONS.health.steps[k], bag)
  ok(!!s, `health step ${k} can be filled`)
  if (!s) break
  spend(s); give(stepMakes('health', k, s))
}
ok(bag['potion:health:A'] === 2 && Object.keys(bag).length === 1, `the chain pours 2 grade-A health, nothing left over (${JSON.stringify(bag)})`)
const eA = effectOf('potion:health:A'), eD = effectOf('potion:health:D')
ok(!!eA && !!eD && 'heal' in eA && 'heal' in eD && eA.heal === 60 && eD.heal === 25, 'potency: grade A heals 60, grade D 25 (M78: % of max HP by grade, shared/vitals-economy.ts)')
ok(Object.values(POTENCY).every((v, i, a) => i === 0 || v > a[i - 1]), 'potency climbs with every grade')
const w = effectOf('potion:wisdom:S')
const wD = effectOf('potion:wisdom:D')
ok(!!w && !!wD && 'xp' in w && 'xp' in wD && w.ms > wD.ms && w.xp === wD.xp, 'an S wisdom potion lasts longer than a D, same lift')
ok(isAlcPotion('potion:mana:B') && !isAlcPotion('potion:nope:B') && !isAlcPotion('potion:mana'), 'isAlcPotion')
ok(alcName('alc:golden_dew_extract:B') === 'Golden Dew Extract · B' && alcName('potion:mana:S') === 'Mana Draught · S', 'names')

// pickFor spends the best first, and refuses a short bag
const NOOK = ALC_POTIONS.health.steps.findIndex(s => s.at === 'nook'), DESK = ALC_POTIONS.health.steps.length - 1
const best = pickFor(ALC_POTIONS.health.steps[NOOK], { 'crop:goldleaf:D': 5, 'crop:goldleaf:S': 1, 'crop:dewdrop_vine:B': 2 })
ok(!!best && best[0].id === 'crop:goldleaf:S' && best[0].n === 1 && best[1].id === 'crop:goldleaf:D', 'best grade spent first, topped up with the rest')
ok(pickFor(ALC_POTIONS.health.steps[NOOK], { 'crop:goldleaf:S': 1, 'crop:dewdrop_vine:B': 2 }) === null, 'a short bag cannot fill a step')
// a keeper holding the extract skips to the desk
ok(nextStep('health', { 'alc:golden_dew_extract:B': 1, 'alc:rinnscale_dust:C': 1 }) === DESK, 'holding the parts goes straight to the desk')
ok(nextStep('health', {}) === -1, 'an empty bag cannot start')

console.log(`alchemy-set: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
