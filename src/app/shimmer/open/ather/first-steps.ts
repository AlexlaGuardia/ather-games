// ── FIRST STEPS: THE ONE OPENING QUEST (BETA M146, Alex 11-24; canon athernyx 951cc3a / e4092f5, CANON_GAPS › "The opening
// quest's title" + "May The Dig wait") ─────────────────────────────────────────────────────────────────────────────────────
// From Greg and his friends, through the gate, to the first settlement's big one, and back to Greg: one journal line, one
// title, the SIGNED step lines word for word. Until it is done (glade-tutorial.ts › firstStepsOn) nothing else opens: no first
// errand, no gems, no glove, no Dig (opening-chain.ts `held`). Its marks are the CURRENT STEP's only.
// ★ M155 (Alex 11-25): the friends' step is a GUIDED TOUR, one stop and one marker at a time (glade-tutorial.ts › TOUR).
// ★ PURE. The skip path (the gate is open from the start) runs through the same steps: the settlement's state leads, so a
//   keeper who never talked to anyone still ends at Greg.
import { firstStepsOn, tourStop, type Stop, type Tut } from './glade-tutorial'
import { line } from './glade-tutorial-lines'
import { SETTLEMENT } from './first-settlement'
import type { JournalEntry, Zone } from '../shared/journal'

/** SIGNED (Alex 11-24): replaces 'Meet the Glade' + 'A Favour for Greg' (first-steps.test.ts reads the canon file). */
export const FIRST_STEPS_TITLE = 'First Steps'
export const FIRST_STEPS_ID = 'first-steps'

export type FirstStep = 'greg' | 'tour' | 'back' | 'gate' | 'bigone' | 'settlers' | 'home'
export function firstStep(t: Tut): FirstStep | null {
  if (!firstStepsOn(t)) return null
  if (t.m70 === 'open') return 'bigone'
  if (t.m70 === 'down') return 'settlers'
  if (t.m70 === 'thanked') return 'home'
  if (!t.greg.wilds) return 'greg'
  if (tourStop(t)) return 'tour'
  return t.b2 === 'accepted' ? 'gate' : 'back'
}
/** The step's signed line. */
export function stepLine(t: Tut): string {
  switch (firstStep(t)) {
    case 'greg': return line('quest.b1.step.greg')
    case 'tour': return line(`quest.b1.step.${tourStop(t)}`)
    case 'back': return line('quest.b1.done')
    case 'gate': return line('quest.b2.step')
    case 'bigone': return line('quest.m70.step')
    case 'settlers': return line('quest.m70.done')
    case 'home': return line('quest.m70.after')
    default: return ''
  }
}
type At = { x: number; z: number }
export interface FirstStepsWorld {
  greg: At; gate: At; 
  /** where each stop of the tour stands NOW (Place mode moves them: the page asks at the call) */
  stops: Readonly<Record<Stop, At>>
  /** the Wilds' way back to the Glade (Greg's waymark stone) */
  stone: At
  /** the big one's node, where the save names one */
  bigone: At | null
}
/** Where the current step points: in the Glade, and in the Wilds (one zone's mark leads to the other's). */
export function stepSpots(t: Tut, w: FirstStepsWorld): { zone: Zone; x: number; z: number }[] {
  const g = (p: At) => ({ zone: 'glade' as const, x: p.x, z: p.z }), o = (p: At) => ({ zone: 'wilds' as const, x: p.x, z: p.z })
  switch (firstStep(t)) {
    case 'greg': case 'back': case 'home': return [g(w.greg), o(w.stone)]
    case 'tour': return [g(w.stops[tourStop(t)!]), o(w.stone)]
    case 'gate': case 'settlers': return [g(w.gate), o(SETTLEMENT)]
    case 'bigone': return [g(w.gate), ...(w.bigone ? [o(w.bigone)] : [])]
    default: return []
  }
}
/** The fold map's pins: the step's own side only (the Glade's stop, or its Wilds spot), never the way there. */
export function mapSpots(t: Tut, w: FirstStepsWorld) {
  const s = firstStep(t), side: Zone = s === 'gate' || s === 'bigone' || s === 'settlers' ? 'wilds' : 'glade'
  return stepSpots(t, w).filter(x => x.zone === side)
}
export function firstStepsEntries(t: Tut, w: FirstStepsWorld): JournalEntry[] {
  if (!firstStepsOn(t)) return []
  const [where, ...also] = stepSpots(t, w)
  return [{ id: FIRST_STEPS_ID, hand: 'keeper', title: FIRST_STEPS_TITLE, note: stepLine(t), where: where ?? null, also }]
}
