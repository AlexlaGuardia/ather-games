// THE FIRST RINSTICK IS EARNED (BETA M22, Alex 11-18 playtest: rinning is 'pretty hard (which is a good thing) but there
// should definitely be a side mission to unlock the default fishing rod.. maybe crafting the fishing room starts this side
// quest'). A keeper born after M22 has NO worn rinstick; the Rinnshop standing starts a side quest (a journal line per step).
// Keepers who played before M22 keep theirs (never take a tool off a live save).
//
// CANON (game/ather-rework-2026-11.md › WORKSHOP ROOMS (4½), RULED 11-18 /magii + Alex, athernyx 62f59a5): rinsticks are made
// from rinn, so the first cannot come from a catch: A RINN GIVES IT. (1) Building the Rinnshop brings FENNEL (the Moonwell
// cook, who trades in rinn): 'no stick, no catch; no catch, no stick, unless one gives itself.' (2) The keeper sits still at
// the MOONWELL water at DUSK, no tool. (3) A rinn surfaces and leaves a SHED SCALE on the bank, freely given, kin to kin.
// (4) The keeper binds it into a first rinstick at the Rinnshop bench and brings Fennel the first catch. Rinstick only.
// BUILD (Jin): triggers, timing, the wait, rewards; the stick is in hand from the BIND (step 4), the quest closes when
// Fennel has the first catch. LINES: every player-read word below is a placeholder for @lark (Alex signs). Pure; saved per keeper.

import type { JournalEntry } from '../shared/journal'

export type QuestState = 'none' | 'active' | 'done'
/** `stick`: the worn rinstick is the keeper's (set at the bind, before the quest closes on the first catch) */
export interface RinQuest { v: 1; state: QuestState; step: number; stick?: boolean }
export const RINQUEST_KEY = 'open.rinquest.v1'
export const SHED_SCALE = 'shed_scale'

/** What finishes a step, as data: a ruling change edits this table, not the code that walks it. */
export type StepDo =
  | { kind: 'talk'; who: 'fennel'; needs?: 'catch' }                 // E at Fennel (with a rinn in the bag, when `needs`)
  | { kind: 'wait'; at: 'moonwell'; phase: 'dusk'; stillS: number }  // still, hands empty, at the water, in the phase, this long
  | { kind: 'pickup'; item: string }                                 // walk over what the wait left on the bank
  | { kind: 'bench'; at: 'rinnshop'; takes: string; grants: true }   // the Rinnshop bench binds it: the stick is yours
export interface QuestStep { id: string; title: string; note: string; button?: string; do: StepDo }

// lark, athernyx 112926e, SIGNED by Alex 11-19 (CANON/game/first-rinstick-script.md); slots the script has no line for keep their placeholder.
// Step notes = the script's step logs (step 4's log also covers the 'catch' step). Titles + the 'catch' note: still placeholder.
export const RINQUEST_STEPS: readonly QuestStep[] = [
  { id: 'meet', title: 'Meet Fennel at your Rinnshop', note: 'Fennel says a rinn may give you a stick. Sit at the Moonwell at dusk with no tool.', do: { kind: 'talk', who: 'fennel' } },
  { id: 'dusk', title: 'Sit by the Moonwell at dusk', note: 'Sit still at the Moonwell water at dusk. Hold nothing.', do: { kind: 'wait', at: 'moonwell', phase: 'dusk', stillS: 12 } },
  { id: 'scale', title: 'Take the shed scale', note: 'A rinn left a shed scale on the bank. Take it to the Rinnshop bench.', do: { kind: 'pickup', item: SHED_SCALE } },
  { id: 'bind', title: 'Bind the scale at your Rinnshop', note: 'Bind the scale into a rinstick at the bench. Bring Fennel your first catch.', button: 'Bind the scale', do: { kind: 'bench', at: 'rinnshop', takes: SHED_SCALE, grants: true } },
  { id: 'catch', title: 'Bring Fennel your first catch', note: 'Rin a catch with your new rinstick and bring it to Fennel at your Rinnshop.', do: { kind: 'talk', who: 'fennel', needs: 'catch' } },
]
export const RINQUEST_LINES = {  // lark, SIGNED by Alex 11-19 (noShop/started/inQuest/done: no script line, still placeholder)
  noShop: 'You have no rinstick. Build a Rinnshop on your plot to earn your first.',
  started: 'Your Rinnshop stands. Someone has come to see it.',
  inQuest: 'You have no rinstick yet. See your journal.',
  waitHeld: 'Put it away. Come with empty hands.',
  waitTime: 'Not yet. Wait for the light to go.',
  waitStart: 'Sit by the water. Hold nothing.',
  surfaced: 'A ripple, a flash of scale, and then only the water again. On the bank, where it touched the stones, something small is shining.',
  picked: 'A shed scale. It was left for you.',
  got: 'First rinstick made. Go and ask something of the water.',
  done: 'Fennel takes your first catch. The Rinnshop is yours to work.',
}

export const fresh = (): RinQuest => ({ v: 1, state: 'none', step: 0 })
export const hasStick = (q: RinQuest) => q.state === 'done' || !!q.stick

/** The saved quest, or (no flag) a keeper BORN BEFORE M22 = done, keeping the worn rinstick. A keeper born after M22 never
 *  has no flag: the birth gate writes `fresh()` the moment the rune is chosen (hub 11-18: the bag saves within seconds of a
 *  birth, so 'has a saved bag' cannot tell old from new; the birth can). A save from the one-step placeholder (live 11-18)
 *  reads straight into this table: active step 0 was 'ask', is now 'meet'; done stays done. */
export function migrate(saved: unknown): RinQuest {
  const q = saved as RinQuest | null
  if (q && q.v === 1 && (q.state === 'none' || q.state === 'active' || q.state === 'done') && Number.isInteger(q.step) && q.step >= 0)
    return { v: 1, state: q.state, step: q.state === 'done' ? RINQUEST_STEPS.length : Math.min(q.step, RINQUEST_STEPS.length - 1), ...(q.stick ? { stick: true } : {}) }
  return { v: 1, state: 'done', step: RINQUEST_STEPS.length }
}

/** The Rinnshop standing (raised) starts the quest; nothing else changes the state here. */
export const onShop = (q: RinQuest, shopRaised: boolean): RinQuest => (q.state === 'none' && shopRaised ? { ...q, state: 'active', step: 0 } : q)

export const currentStep = (q: RinQuest): QuestStep | null => (q.state === 'active' ? RINQUEST_STEPS[q.step] ?? null : null)

/** Something the world saw happen. A step completes only on ITS event; anything else leaves the quest as it is. */
export type QuestEvent =
  | { kind: 'talk'; who: 'fennel'; hasCatch: boolean }
  | { kind: 'waited'; at: 'moonwell' }
  | { kind: 'picked'; item: string }
  | { kind: 'bench'; at: 'rinnshop'; has: (item: string) => boolean }

export function doStep(q: RinQuest, ev: QuestEvent): { q: RinQuest; granted: boolean; took: string | null } {
  const s = currentStep(q), none = { q, granted: false, took: null }
  if (!s) return none
  const d = s.do
  const ok = (d.kind === 'talk' && ev.kind === 'talk' && ev.who === d.who && (!d.needs || ev.hasCatch))
    || (d.kind === 'wait' && ev.kind === 'waited' && ev.at === d.at)
    || (d.kind === 'pickup' && ev.kind === 'picked' && ev.item === d.item)
    || (d.kind === 'bench' && ev.kind === 'bench' && ev.at === d.at && ev.has(d.takes))
  if (!ok) return none
  const step = q.step + 1, granted = d.kind === 'bench' && d.grants
  const next: RinQuest = step >= RINQUEST_STEPS.length ? { v: 1, state: 'done', step } : { ...q, step, ...(granted ? { stick: true } : {}) }
  return { q: next, granted, took: d.kind === 'bench' ? d.takes : null }
}

/** Is the current step one Fennel answers? (Fennel stands at the Rinnshop from the quest's start until it closes.) */
export const fennelHere = (q: RinQuest) => q.state === 'active'
/** Is the current step the Moonwell wait / the scale on the bank? */
export const waitingAt = (q: RinQuest) => { const d = currentStep(q)?.do; return d?.kind === 'wait' ? d : null }
export const scaleOnBank = (q: RinQuest) => currentStep(q)?.do.kind === 'pickup'

/** The wait, as a pure clock: it counts only while the keeper is AT the water, STILL, hands EMPTY (the stowed stance), and
 *  the hour is right; any of those breaking resets it (canon: 'sits still'). Returns the new count and whether it's done. */
export function waitTick(t: number, dt: number, ok: { at: boolean; still: boolean; empty: boolean; phase: boolean }, stillS: number): { t: number; done: boolean } {
  if (!(ok.at && ok.still && ok.empty && ok.phase)) return { t: 0, done: false }
  const n = t + dt
  return { t: n, done: n >= stillS }
}

/** What a keeper with bait at the water but no rinstick is told. */
export const noStickLine = (q: RinQuest) => (q.state === 'active' ? RINQUEST_LINES.inQuest : RINQUEST_LINES.noShop)

/** The journal: the open step (keeper's hand), or the done record struck; nothing before the Rinnshop stands (the rinning
 *  pointer says 'build a Rinnshop' then, skill-pointers.ts). The Moonwell step points at the water (beacon + trail). */
/** `fennel` = where she stands by the Rinnshop (BETA M33: Morel's ping lights the meeting's marker, so the step points at her). */
export function questEntries(q: RinQuest, moonwell?: { x: number; z: number }, fennel?: { x: number; z: number } | null): JournalEntry[] {
  if (q.state === 'none') return []
  const s = currentStep(q)
  if (s) {
    const where = (s.do.kind === 'wait' || s.do.kind === 'pickup') && moonwell ? { zone: 'wilds' as const, x: moonwell.x, z: moonwell.z }
      : s.id === 'meet' && fennel ? { zone: 'ather' as const, x: fennel.x, z: fennel.z } : null
    return [{ id: 'rinquest', hand: 'keeper', title: s.title, note: s.note, where }]
  }
  return [{ id: 'rinquest', hand: 'keeper', title: 'A rinstick of your own', note: 'Quest done: A Stick That Gives Itself. You have your first rinstick.', where: null, struck: true }]
}
