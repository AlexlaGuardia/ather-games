// Run: npx tsx src/app/shimmer/spirits/evolution.test.ts
//
// ★ EVERY ASSERT HERE IS A SENTENCE ABOUT A KEEPER, not about a number. The bug this file exists to
// prevent has a specific shape: a spirit reaches level 34 before it has been infused, and is then
// owed its form forever after — because canon sets the form by DOMINANT INFUSION, and infusions can
// arrive at any time. An edge-triggered rule ("the level you crossed 34") answers that wrong and
// answers it silently: the keeper pours, the bar fills, and nothing ever happens again.
import { createSpirit, addXP, addInfusion, SECOND_FORM_NAMES, type Spirit } from './spirit'
import { pendingEvolution, evolveSpirit, evolutionBlocker, secondFormName, leaningBar, legacyStatOf } from './evolution'
import { EVOLUTION_THRESHOLDS } from './evolution-config'
import { SECOND_FORM_BAR, GATE_STAT, FORM_ELEMENTS, formBars, type StatOf } from './second-form-gate'
import { SPECIES_BASE } from '../open/ather/spirit-growth'
import { TRAIN, statValue, type StatRec } from '../open/ather/spirit-stats'
import { secondFormView, SECOND_FORM_UI } from '../open/ather/second-form-view'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++; else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
// M201: no level gate any more. SECOND = a legacy level whose growth clears every species' bar (asserted below), so the
// infusion asserts read the infusion rule alone; the stat bar has its own section.
const SECOND = 60
void EVOLUTION_THRESHOLDS
const spiritAt = (level: number, inf: Partial<Record<'mana'|'storm'|'earth'|'water', number>> = {}) => {
  const s = createSpirit('fox', 'Test', 0, 0)
  s.level = level
  for (const [el, n] of Object.entries(inf)) for (let i = 0; i < (n ?? 0); i++) addInfusion(s.infusions, el as 'mana')
  return s
}

console.log('\nwhen a spirit is owed a form')
{
  check('a fresh legacy spirit (level 1) leaning storm is below the bar', evolutionBlocker(spiritAt(1, { storm: 3 })) === 'below-bar')
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
  s.level = 1
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
    ['below the bar', spiritAt(1, { storm: 5 })],
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

console.log('\n★ M201: the stat bar (canon b0f1d0d: infusion + a stat gate on her leaning element)')
{
  const fox = (inf: Partial<Record<'mana'|'storm'|'earth'|'water', number>>) => spiritAt(1, inf)
  const need = SECOND_FORM_BAR.fox.storm, stat = GATE_STAT.storm
  const at = (v: number): StatOf => k => (k === stat ? v : 0)
  // ★ THE DONE-CHECK: below the bar = blocked with the reason; at the bar + dominant infusion = she evolves (element set)
  const below = fox({ storm: 3, water: 1 })
  check('one under the bar is blocked: below-bar', evolutionBlocker(below, at(need - 0.01)) === 'below-bar')
  check('the reason names her lean, the stat, have / need',
    SECOND_FORM_UI.reason({ blocker: 'below-bar', lean: 'storm', bars: formBars('fox', at(need - 1)) }, k => k.toUpperCase()) === `Leaning Storm: PWR ${need - 1} / ${need}`)
  check('blocked writes nothing', evolveSpirit(below, at(need - 0.01)) === null && below.element === 'base')
  const s = fox({ storm: 3, water: 1 })
  check('AT the bar with a dominant infusion she is owed', evolutionBlocker(s, at(need)) === null)
  const got = evolveSpirit(s, at(need))
  check('★ she evolves, element set to her lean', got?.element === 'storm' && s.element === 'storm', `got ${got?.element} / ${s.element}`)
  check('the bar is the LEANING element\'s: the water stat does not count', evolutionBlocker(fox({ storm: 3, water: 1 }), k => (k === GATE_STAT.water ? 999 : 0)) === 'below-bar')
  check('the lean is read before the bar: no infusion beats a full bar', evolutionBlocker(fox({}), () => 999) === 'no-infusions')
  check('a tie beats a full bar', evolutionBlocker(fox({ storm: 2, earth: 2 }), () => 999) === 'tied')
  check('leaningBar reports the leaning element', leaningBar(fox({ earth: 2 }), at(0))?.element === 'earth')
  check('a NaN stat reads 0, never meets the bar', evolutionBlocker(fox({ storm: 1 }), () => NaN) === 'below-bar')

  // the table: per species x per element, every cell from the species base, every one needs real growth or training
  const sps = Object.keys(SPECIES_BASE) as (keyof typeof SPECIES_BASE)[]
  check('the table has every species x element', sps.every(sp => FORM_ELEMENTS.every(el => Number.isFinite(SECOND_FORM_BAR[sp]?.[el]))))
  check('the four elements read four DIFFERENT trainable stats', new Set(Object.values(GATE_STAT)).size === 4 && Object.values(GATE_STAT).every(k => (['pwr','grd','agi','vig'] as string[]).includes(k)))
  check('no spirit meets any bar at bloom', sps.every(sp => FORM_ELEMENTS.every(el => SPECIES_BASE[sp][GATE_STAT[el]] < SECOND_FORM_BAR[sp][el])))
  // M200: training is now +1% a point of her grown stat, so full training (TRAIN.cap = +20%) at bloom is base x1.2: read
  // through the REAL statValue, every bar round(2 x base + 10) still sits above it, and growth is still needed to close it
  check('★ full training alone (TRAIN.cap, M200 +20%) never reaches a bar: growth is needed too',
    sps.every(sp => FORM_ELEMENTS.every(el => { const k = GATE_STAT[el]
      return statValue(sp, { form: 'base', g: { [k]: TRAIN.cap }, plays: TRAIN.cap }, k) < SECOND_FORM_BAR[sp][el] })))
  check('M200: and some growth WITH full training does reach every bar (the gate is reachable)',
    sps.every(sp => FORM_ELEMENTS.every(el => { const k = GATE_STAT[el]
      return statValue(sp, { form: 'base', g: { [k]: TRAIN.cap }, plays: TRAIN.cap, grown: 200 }, k) >= SECOND_FORM_BAR[sp][el] })))
  check('a stronger base stat asks a higher bar', SECOND_FORM_BAR['water-bear'].earth > SECOND_FORM_BAR.hummingbird.earth)
  check('SECOND (legacy) clears every bar, so the infusion asserts above read the infusion rule alone',
    sps.every(sp => FORM_ELEMENTS.every(el => legacyStatOf({ species: sp, element: 'base', infusions: { mana: 0, storm: 0, earth: 0, water: 0 }, level: SECOND })(GATE_STAT[el]) >= SECOND_FORM_BAR[sp][el])))

  // the open world reads the LIVE record (growth + training), never a level
  const fresh = secondFormView('fox', undefined)
  check('open world, fresh: no infusion yet, four bars, none met', fresh.blocker === 'no-infusions' && fresh.bars.length === 4 && fresh.bars.every(b => !b.met))
  const grown: StatRec = { form: 'base', g: { pwr: 20 }, plays: 20, xp: 0, grown: 200 }
  const v = secondFormView('fox', grown, 'base', { mana: 0, storm: 2, earth: 0, water: 0 })
  check('open world, grown + trained + leaning storm: ready, lean storm', v.blocker === null && v.lean === 'storm', JSON.stringify(v.bars[1]))
  check('open world, training shows in the bar', Math.abs(secondFormView('fox', { form: 'base', g: { pwr: 7 }, plays: 7 }).bars[1].have - SPECIES_BASE.fox.pwr * 1.07) < 1e-9)
  check('open world, settled reads settled', secondFormView('fox', grown, 'earth').blocker === 'settled')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
