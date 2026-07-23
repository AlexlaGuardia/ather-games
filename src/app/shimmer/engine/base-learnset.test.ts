// Base-learnset oracle — run: npx tsx src/app/shimmer/engine/base-learnset.test.ts
//
// Guards the three ways this system can silently rot:
//   1. an id in BASE_LEARNSET that no longer resolves (the check the const reference gave us
//      before the TDZ cycle forced ids — see base-learnset.ts's import note),
//   2. a species whose late kit is all utility, which cannot finish a fight and whose mirror
//      stalemates outright (that exact failure already cost a session — GBOARD arena-pacing),
//   3. the raw/runed contract breaking — a base spirit leaking a runed element (free STAB and
//      matchups 30 levels early) or an evolved spirit failing to ignite its carried kit.
//
// Note this asserts the SHAPE of progression, not its balance. Fight pacing is arena.test.ts.

import { BASE_LEARNSET, baseLearnedBy, BLOOM_LEVEL, STILL_BREATH_LEVEL, KIT_SIZE } from './base-learnset'
import { ALL_MOVES, getMovesForSpirit, ELEMENT_MID_LEVEL, ELEMENT_HIGH_LEVEL } from './moves'
import type { Species, Element } from '../spirits/spirit'

const SPECIES = Object.keys(BASE_LEARNSET) as Species[]
const ELEMENTS: Exclude<Element, 'base'>[] = ['mana', 'storm', 'earth', 'water']

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) return
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

// ── 1. Every id resolves, and the tables are well-formed ──
console.log('\n[ids + shape]')
for (const species of SPECIES) {
  const entries = BASE_LEARNSET[species]
  for (const e of entries) {
    check(`${species} id`, !!ALL_MOVES[e.id], `'${e.id}' is not in ALL_MOVES`)
    check(`${species} level`, e.level > BLOOM_LEVEL && e.level < 34,
      `${e.id} at lv${e.level} — must sit between bloom and evolution`)
  }
  const levels = entries.map(e => e.level)
  check(`${species} order`, levels.every((l, i) => i === 0 || l > levels[i - 1]),
    `levels not strictly ascending: ${levels.join(',')}`)
  check(`${species} depth`, entries.length >= KIT_SIZE,
    `only ${entries.length} picks — fewer than a kit means no choice pressure`)
  const ids = entries.map(e => e.id)
  check(`${species} unique`, new Set(ids).size === ids.length, `duplicate id in ${ids.join(',')}`)
}

// ── 2. The damage floor ──
// A kit needs something that can actually close. Utility moves (power 0) cannot, and a
// species that stacks guard while dealing no damage produces the stalemate mirror.
console.log('\n[damage floor]')
for (const species of SPECIES) {
  for (const level of [5, 10, 15, 20, 22, 29, 33]) {
    const kit = getMovesForSpirit(species, 'base', level, 0)
    // Excludes Mana Pulse deliberately. Counting the pinned 40-power fallback as a real strike
    // let water-bear ship a lv19-24 kit of Gem Shell + Fluid Restore + Mana Pulse, which reads as
    // "has damage" and plays as a spirit that cannot kill anything — and since the ally party
    // tanks with that species, it dropped the arena party baseline from 38% to 9.5%.
    const damage = kit.filter(m => m.power > 0 && m.id !== 'mana_pulse')
    // At lv5-9 a spirit still carries Spirit Ward, so one real strike is honest.
    const floor = level < 10 ? 1 : 2
    check(`${species} lv${level} damage`, damage.length >= floor,
      `kit has ${damage.length} real strike(s), want ${floor}: ${kit.map(m => `${m.name}(${m.power})`).join(', ')}`)
  }
  // At most ONE utility pick per species, and never two inside a rolling kit window. This is the
  // structural form of the rule above: three consecutive picks are what a kit holds from lv19 on,
  // so two utilities anywhere adjacent guarantees a window with a single strike in it.
  const util = BASE_LEARNSET[species].filter(e => ALL_MOVES[e.id].power === 0)
  check(`${species} utility budget`, util.length <= 1,
    `${util.length} utility picks (${util.map(e => e.id).join(', ')}) — budget is 1`)
  // ...and it cannot sit at lv14, where Still-Breath is still holding a slot.
  check(`${species} utility placement`, util.every(e => e.level >= 15),
    `utility pick ${util.map(e => `${e.id}@${e.level}`).join(', ')} lands before lv15`)
  // The capstone must be a real strike, not a buff — it is what the endgame kit is built around.
  const capstone = BASE_LEARNSET[species].at(-1)!
  check(`${species} capstone`, ALL_MOVES[capstone.id].power > 0,
    `lv${capstone.level} ${capstone.id} is a utility move`)
}

// ── 3. Kit size and the pinned strike ──
console.log('\n[kit]')
for (const species of SPECIES) {
  for (const level of [BLOOM_LEVEL, 5, 9, 20, 33, 34, 50]) {
    const el: Element = level >= 34 ? 'storm' : 'base'
    const kit = getMovesForSpirit(species, el, level, 0)
    check(`${species} lv${level} size`, kit.length <= KIT_SIZE, `${kit.length} moves`)
    check(`${species} lv${level} pulse`, kit.some(m => m.id === 'mana_pulse'),
      'Mana Pulse is not pinned — a spirit can be left with nothing off cooldown')
    check(`${species} lv${level} unique`, new Set(kit.map(m => m.id)).size === kit.length,
      `duplicate in ${kit.map(m => m.id).join(',')}`)
  }
}
// A freshly bloomed spirit knows the raw-mana pair and nothing else.
const bloomed = getMovesForSpirit('fox', 'base', BLOOM_LEVEL, 0)
check('bloom kit', bloomed.length === 2 && bloomed.some(m => m.id === 'spirit_ward'),
  `bloomed with ${bloomed.map(m => m.id).join(',')}`)
// Still-Breath must NOT be in the general kit — it is granted per-encounter by createReachBattle.
// As a learnset entry it burned a slot in every lv5-18 combat kit for zero combat value.
check('still-breath is not a combat-kit move',
  ![9, 14, 19, 30].some(l => getMovesForSpirit('fox', 'base', l, 0).some(m => m.id === 'still_breath')),
  'Still-Breath is diluting the combat kit again')

// ── 4. The raw/runed contract ──
console.log('\n[raw vs runed]')
for (const species of SPECIES) {
  // Base: everything channels neutral. A runed move here is 30 levels of free STAB+matchups.
  for (const move of getMovesForSpirit(species, 'base', 33, 99)) {
    check(`${species} raw`, move.element === 'neutral',
      `${move.name} leaked element '${move.element}' on a base spirit`)
  }
  // Evolved: the carried kit ignites — the same moves now express their registered runes.
  for (const el of ELEMENTS) {
    const kit = getMovesForSpirit(species, el, 34, 0)
    const carried = kit.filter(m => BASE_LEARNSET[species].some(e => e.id === m.id))
    check(`${species}/${el} ignites`, carried.length > 0, 'no base-learnset move survived evolution')
    for (const move of carried) {
      check(`${species}/${el} runed`, move.element === ALL_MOVES[move.id].element,
        `${move.name} stayed neutral after evolution`)
    }
  }
}

// ── 5. Evolution actually pays out ──
console.log('\n[evolution reward]')
for (const species of SPECIES) {
  for (const el of ELEMENTS) {
    const before = getMovesForSpirit(species, 'base', 33, 99)
    const after = getMovesForSpirit(species, el, ELEMENT_MID_LEVEL, 99)
    check(`${species}/${el} mid`, after.some(m => !before.some(b => b.id === m.id)),
      'evolving added no new move')
    const high = getMovesForSpirit(species, el, ELEMENT_HIGH_LEVEL, 99)
    check(`${species}/${el} high`, high.length === KIT_SIZE, `${high.length} moves at high tier`)
    const sig = getMovesForSpirit(species, el, ELEMENT_HIGH_LEVEL, 50)
    check(`${species}/${el} signature`, sig.some(m => m.id.includes('_')), 'signature never reachable')
  }
}

// ── 6. Variety — the whole point ──
console.log('\n[variety]')
const kitsAt = (level: number) =>
  SPECIES.map(s => getMovesForSpirit(s, 'base', level, 0).map(m => m.id).sort().join('|'))
for (const level of [5, 15, 29]) {
  const distinct = new Set(kitsAt(level)).size
  check(`lv${level} distinct kits`, distinct >= 8,
    `only ${distinct}/10 species have a distinct kit — they will all fight alike`)
}
const reachable = new Set<string>()
for (const species of SPECIES) {
  for (const level of [5, 10, 15, 22, 29]) {
    for (const m of getMovesForSpirit(species, 'base', level, 0)) reachable.add(m.id)
  }
  for (const el of ELEMENTS) for (const m of getMovesForSpirit(species, el, 50, 60)) reachable.add(m.id)
}
console.log(`  reachable moves across all species/levels/elements: ${reachable.size} of ${Object.keys(ALL_MOVES).length}`)
check('reach', reachable.size >= 30, `only ${reachable.size} moves are reachable in the whole game`)

console.log(failures === 0 ? '\nbase-learnset: PASS\n' : `\nbase-learnset: ${failures} FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)
