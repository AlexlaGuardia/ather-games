// Run: npx tsx src/app/shimmer/spirits/evolution.test.ts
//
// ★ EVERY ASSERT HERE IS A SENTENCE ABOUT A KEEPER, not about a number. The bug this file exists to
// prevent has a specific shape: a spirit reaches level 34 before it has been infused, and is then
// owed its form forever after — because canon sets the form by DOMINANT INFUSION, and infusions can
// arrive at any time. An edge-triggered rule ("the level you crossed 34") answers that wrong and
// answers it silently: the keeper pours, the bar fills, and nothing ever happens again.
import { createSpirit, addXP, addInfusion, SECOND_FORM_NAMES, type Spirit } from './spirit'
import { pendingEvolution, evolveSpirit, evolutionBlocker, secondFormName } from './evolution'
import { EVOLUTION_THRESHOLDS } from './evolution-config'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++; else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const SECOND = EVOLUTION_THRESHOLDS.secondFormLevel
const spiritAt = (level: number, inf: Partial<Record<'mana'|'storm'|'earth'|'water', number>> = {}) => {
  const s = createSpirit('fox', 'Test', 0, 0)
  s.level = level
  for (const [el, n] of Object.entries(inf)) for (let i = 0; i < (n ?? 0); i++) addInfusion(s.infusions, el as 'mana')
  return s
}

console.log('\nwhen a spirit is owed a form')
{
  check('below the threshold it is too young', evolutionBlocker(spiritAt(SECOND - 1, { storm: 3 })) === 'too-young')
  check('at the threshold with no infusions there is nothing to read',
    evolutionBlocker(spiritAt(SECOND)) === 'no-infusions')
  check('a dead-even lean is TIED, not "no"', evolutionBlocker(spiritAt(SECOND, { storm: 2, water: 2 })) === 'tied')
  check('a clear lean at the threshold is owed a form', evolutionBlocker(spiritAt(SECOND, { storm: 2, water: 1 })) === null)
  check('a spirit that already has a form is settled',
    (() => { const s = spiritAt(SECOND + 20, { storm: 3 }); s.element = 'storm'; return evolutionBlocker(s) })() === 'settled')

  // ⚠ A three-way tie is still a tie. `dominantInfusion` only compares the top two, so this is the
  // shape that would slip through a naive "are the top two equal" test written here instead.
  check('a three-way tie is tied', evolutionBlocker(spiritAt(SECOND, { mana: 2, storm: 2, earth: 2 })) === 'tied')
  // ★ AND A MINORITY ELEMENT NEVER WINS — the form is the MAJORITY, which is what makes pouring a
  // choice rather than a lottery.
  check('the majority element is the form', pendingEvolution(spiritAt(SECOND, { earth: 4, mana: 3 }))?.element === 'earth')
}

console.log('\n★ the standing rule — the whole reason this module exists')
{
  // A spirit levels past 34 with nothing poured into it. Under the old EDGE rule this is the moment
  // the one and only chance was spent.
  const s = createSpirit('owl', 'Late', 0, 0)
  s.level = SECOND - 1
  const r = addXP(s, 10_000_000)
  check('it levels well past the threshold', s.level > SECOND, `level ${s.level}`)
  check('and addXP does NOT announce a form it cannot take', r.evolved === null,
    'this is canon\'s "announces ready to evolve and then nothing happens"')
  check('nothing is owed yet', pendingEvolution(s) === null)

  // The keeper infuses it afterwards — which is the normal way round, since infusions are brewed.
  addInfusion(s.infusions, 'water')
  const due = pendingEvolution(s)
  check('★★ once infused, the form is owed — LATE, and that must still work', due?.element === 'water')
  check('and it is the ruled name for this species', due?.formName === SECOND_FORM_NAMES.owl.water,
    `got ${due?.formName}`)
}

console.log('\ntaking the form')
{
  const s = spiritAt(SECOND, { earth: 3, mana: 1 })
  const before = JSON.stringify({ ...s, element: null })
  const got = evolveSpirit(s)
  check('it evolves', got?.element === 'earth')
  check('the element is written', s.element === 'earth')
  check('the name is canon\'s grid', got?.formName === SECOND_FORM_NAMES.fox.earth)
  // ⚠ ONLY `element` MOVES. Level, xp, infusions, bond, hp are all derived-from or independent, and
  // a second write here would be a second copy of a fact the rest of the game computes.
  check('and nothing else about the spirit changed', JSON.stringify({ ...s, element: null }) === before)

  // ⚠ IDEMPOTENT — a panel that re-renders, or two callers racing, must not double-apply.
  check('evolving again does nothing', evolveSpirit(s) === null)
  check('and it keeps the form it took', s.element === 'earth')
}

console.log('\nrefusals write nothing')
{
  for (const [label, s] of [
    ['too young', spiritAt(SECOND - 1, { storm: 5 })],
    ['un-infused', spiritAt(SECOND)],
    ['tied', spiritAt(SECOND, { storm: 2, earth: 2 })],
  ] as [string, Spirit][]) {
    check(`${label}: evolveSpirit returns null`, evolveSpirit(s) === null)
    check(`${label}: and the spirit is still base`, s.element === 'base')
  }
}

console.log('\nthe form name never gets invented')
{
  // ★ Canon's grid is 40 cells and the canon gate watches it. A missing cell must fall back to the
  // species name, never to a composed "Storm Fox" — a name canon never ruled, shown at the single
  // most memorable moment in the game.
  const s = createSpirit('bat', 'B', 0, 0)
  check('a ruled cell is used', secondFormName(s, 'mana') === SECOND_FORM_NAMES.bat.mana)
  const rogue = { ...s, species: 'not-a-species' } as unknown as Spirit
  check('an unknown species falls back rather than composing', secondFormName(rogue, 'storm') === 'not-a-species')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
