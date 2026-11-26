// BETA M201 (play, 2026-11-26): what the SPIRIT PANEL shows of her second form. Pure (no React, no storage).
// The gate itself is spirits/evolution.ts evolutionBlocker + spirits/second-form-gate.ts (canon b0f1d0d: the dominant
// infusion picks the form, a stat bar on the element she leans to gates it). Here her stats are the LIVE record
// (spirit-stats.ts statValue: species base x growth + training), never a level.
// ⚠ THE OPEN WORLD HAS NO ELEMENTAL INFUSION YET (no pour reaches a garden spirit), so every open-world spirit reads
// `no-infusions` until one does; the four bars still show what each form will ask. `inf` is the seam for that pour.
import { createInfusions, dominantInfusion, type Infusions, type Species } from '../../spirits/spirit'
import { evolutionBlocker, type EvolutionBlocker } from '../../spirits/evolution'
import { formBars, type FormBar, type FormElement, type StatOf } from '../../spirits/second-form-gate'
import { statValue, type StatRec } from './spirit-stats'

export type SecondFormView = { blocker: EvolutionBlocker | null; lean: FormElement | null; bars: FormBar[] }

/** her stats as the gate reads them: the live record (growth + training) */
export const recStatOf = (sp: Species, rec: StatRec | undefined): StatOf => k => statValue(sp, rec, k)

export function secondFormView(sp: Species, rec: StatRec | undefined, element: FormElement | 'base' = 'base', inf: Infusions = createInfusions()): SecondFormView {
  const statOf = recStatOf(sp, rec), subject = { species: sp, element, infusions: inf }
  const blocker = evolutionBlocker(subject, statOf)
  const bars = formBars(sp, statOf)
  const lean = element !== 'base' ? element : (blocker === 'below-bar' || blocker === null) ? dominantInfusion(inf) : null
  return { blocker, lean, bars }
}

/** player-facing words: plain functional UI labels, UNSIGNED (for @lark) */
export const ELEMENT_LABEL: Record<FormElement, string> = { mana: 'Mana', storm: 'Storm', earth: 'Earth', water: 'Water' }
export const SECOND_FORM_UI = {
  header: 'Second form',
  reason(v: SecondFormView, statLabel: (k: FormBar['stat']) => string): string {
    const b = v.lean ? v.bars.find(x => x.element === v.lean) : undefined
    switch (v.blocker) {
      case 'settled': return v.lean ? `${ELEMENT_LABEL[v.lean]} form` : 'Second form'
      case 'no-infusions': return 'No infusion yet. The element she leans to sets her form.'
      case 'tied': return 'Pulled two ways: no form yet.'
      case 'below-bar': return b ? `Leaning ${ELEMENT_LABEL[b.element]}: ${statLabel(b.stat)} ${Math.round(b.have)} / ${b.need}` : ''
      default: return b ? `Ready for her ${ELEMENT_LABEL[b.element]} form` : ''
    }
  },
}
