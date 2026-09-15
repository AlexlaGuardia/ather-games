// The Moonwell Glade tutorial — Greg's chain from the warning to the fold, with the five doors in it.
//
// ★ HOST SIDE (localStorage), same reasoning as settings.ts: this is per-keeper SESSION state, not
// world terrain, so it does not belong in the IndexedDB column saves (save.ts) which exist
// specifically for "what you built" — see that file's header. Keyed per SEED so a future
// multi-seed world does not cross-contaminate one keeper's tutorial into another's, matching the
// key shape settings.ts and edits use.
//
// ── ★★ REWIRED TO MAGII'S SHEET (2026-09-15, athernyx 17e2223) ────────────────────────────────
// Two tutorials had grown up not knowing about each other: canon's taught the ECONOMY (five doors,
// want/give, the stay choice) and this file taught the HANDS (cut → planks → lantern → light) under
// placeholder Greg lines, with the five folk standing in their buildings saying nothing. The ruling
// gives each hands-stage a door, and no locked line moves:
//   greet  = Greg's warning + offer (he hands NOTHING here — a shard with no use is a prop)
//   doors  = knock on five doors. Only HAZEL's want is a hard errand: she lends her blade, the
//            keeper cuts a log and mills planks at HER sawmill, brings the stack square and the
//            blade back. Sax / Yarrow / Fennel / Mallow are visits (greet → want → give).
//   ask    = five doors met → Greg asks for a light on the path and hands the raw shard THERE
//   lantern / light = craft the mana lantern, set it on the glade path; Greg's `lit` line fires
//   choice = "So. Are you staying, Keeper?" — 'Not yet' re-arms it; 'I am staying' folds
//   done   = the fold; the gate is open and the starter bag (Beat 1's gi_5) is handed out
//
// ★ THE KEEPER HAS NO TOOL OF THEIR OWN UNTIL THE FOLD. Canon puts the bag after the fold, which is
// why Hazel lends hers — "the free folk lend; the collar takes" — and why the return is a beat and
// not a formality: hand it back and you cannot cut until Greg's bag arrives. The build preference
// on the sheet ("gate cut on holding it") is met by there being no other blade to hold.
//
// ★ PURE TRANSITIONS. `talkGreg` / `talkFolk` / `answerChoice` return the next state, the script
// beats to show and an effect for the host to apply (equip / take the blade, give the shard, hand
// out the bag). They never touch inventory or tools — that is the host's, so the oracle can walk
// the whole chain in `tutorial.test.ts` without a world.

import { keeperKey } from '@/lib/keeper-local'

import type { ActionId } from '@/lib/input/actions'
import { SCRIPT, type Beat, type Trigger } from './folk-lines'
import { FOLK_IDS, type FolkId } from './folk'

export type TutorialStage =
  | 'greet'   // find Greg → warning + offer
  | 'doors'   // meet the five folk (Hazel's errand runs inside this stage)
  | 'ask'     // all five met → back to Greg → he asks for a light and hands the shard
  | 'lantern' // craft mana_lantern
  | 'light'   // place a mana_lantern in the glade
  | 'choice'  // talk to Greg → are you staying?
  | 'done'    // terminal — folded, the gate is open, the bag is yours

const STAGES: readonly TutorialStage[] = ['greet', 'doors', 'ask', 'lantern', 'light', 'choice', 'done']

/** Hazel's errand: nothing yet · her blade is in your hand and the stack is owed · returned. */
export type HazelErrand = 'unmet' | 'owed' | 'done'

export interface TutorialState {
  stage: TutorialStage
  /** Doors knocked on, in the order they were. Five = the gate to Greg's ask. */
  met: FolkId[]
  hazel: HazelErrand
}

const DEFAULT_TUTORIAL: TutorialState = { stage: 'greet', met: [], hazel: 'unmet' }

/** The square stack Hazel asked for. One goldwood log mills to four, so one log is the errand. */
export const HAZEL_STACK = 4
/** Her blade, as the tool slot knows it (engine/tools.ts). Lent, never crafted, never dropped. */
export const HAZELS_BLADE = 'hazels_blade'

/** Per keeper: which prompts THIS keeper has been shown. Family prefix, listed in `KEEPER_KEYS`. */
export const TUTORIAL_BASE = 'voxel3d:tutorial:'
const storageKey = (seed: number) => keeperKey(`${TUTORIAL_BASE}${seed}`)

/**
 * ⚠ Same failure discipline as settings.ts: private mode, a corrupt value, SSR — every path returns
 * a safe default rather than throwing. A tutorial that fails to load must not fail to render.
 *
 * ★ OLD SAVES MIGRATE HERE, ONCE, ON READ. The pre-09-15 chain stored `{stage}` alone with stages
 * cut/planks/lantern/light/report. `done` stays done (every door met, Hazel squared — the harness
 * and Alex's own save write exactly `{"stage":"done"}`); `report` was "lantern placed, go talk to
 * Greg", which is now `choice`; anything mid-chain restarts at the doors, since the old chain gave
 * a shard at greet that the new one gives at the ask, and re-walking five doors costs a minute.
 */
export function loadTutorial(seed: number): TutorialState {
  if (typeof localStorage === 'undefined') return fresh()
  try {
    const raw = localStorage.getItem(storageKey(seed))
    if (!raw) return fresh()
    return migrate(JSON.parse(raw))
  } catch { return fresh() }
}

const fresh = (): TutorialState => ({ ...DEFAULT_TUTORIAL, met: [] })

export function migrate(parsed: unknown): TutorialState {
  const p = (parsed && typeof parsed === 'object' ? parsed : {}) as Partial<Record<string, unknown>>
  const s = typeof p.stage === 'string' ? p.stage : 'greet'
  if (s === 'done') return { stage: 'done', met: [...FOLK_IDS], hazel: 'done' }
  // The old shape had no `met`; the new one always does. 'lantern' / 'light' exist in both chains
  // and mean different things (the old one handed the shard at greet), so the shape decides.
  if (Array.isArray(p.met) && (STAGES as readonly string[]).includes(s)) {
    const met = p.met.filter((m): m is FolkId => (FOLK_IDS as readonly string[]).includes(m as string))
    const hazel: HazelErrand = p.hazel === 'owed' || p.hazel === 'done' ? p.hazel : 'unmet'
    return { stage: s as TutorialStage, met, hazel }
  }
  if (s === 'report') return { stage: 'choice', met: [...FOLK_IDS], hazel: 'done' }
  if (s === 'greet') return fresh()
  // cut / planks / lantern / light from the old chain (or a shapeless record): Greg has spoken,
  // the doors have not.
  return { stage: 'doors', met: [], hazel: 'unmet' }
}

export function saveTutorial(seed: number, s: TutorialState): void {
  try { localStorage.setItem(storageKey(seed), JSON.stringify(s)) } catch { /* private mode: run unpersisted */ }
}

// ── The conversations ───────────────────────────────────────────────────────────────────────

/** What the host does after a conversation closes. One at a time; none is fine. */
export type TutorialEffect =
  | 'lend_blade'    // equip Hazel's blade in the forestry slot
  | 'take_blade'    // remove it
  | 'give_shard'    // raw_mana_shard ×1, Greg's ask
  | 'fold'          // the gate opens; hand out the starter bag (tools + crafting table)

export interface Talk {
  next: TutorialState
  beats: readonly Beat[]
  effect?: TutorialEffect
  /** The choice beat: the box shows its two options as buttons and routes through `answerChoice`. */
  choice?: boolean
}

/** What the folk conversations need to know about the keeper's hands. */
export interface Hands {
  planks: number
  hasHazelsBlade: boolean
}

const beats = (...t: Trigger[]): Beat[] => t.flatMap(k => [...SCRIPT[k]])
/** The speaker of a trigger's first spoken beat. */
export function speakerOf(bs: readonly Beat[]): string {
  for (const b of bs) if ('who' in b) return b.who
  return ''
}

/** E on Greg. Pure. */
export function talkGreg(s: TutorialState): Talk {
  switch (s.stage) {
    case 'greet':
      return { next: { ...s, stage: 'doors' }, beats: beats('warning', 'offer') }
    case 'doors':
      return { next: s, beats: beats('greg:bark') }
    case 'ask':
      return { next: { ...s, stage: 'lantern' }, beats: beats('greg:ask'), effect: 'give_shard' }
    case 'lantern':
    case 'light':
      return { next: s, beats: beats('greg:bark:light') }
    case 'choice':
      return { next: s, beats: beats('choice'), choice: true }
    case 'done':
      // Post-fold Greg is the man who widens the fold — the host's GregDialogue owns that talk.
      return { next: s, beats: [] }
  }
}

/** The choice answered. 'staying' folds; 'not-yet' leaves the question armed. */
export function answerChoice(s: TutorialState, answer: 'staying' | 'not-yet'): Talk {
  if (s.stage !== 'choice') return { next: s, beats: [] }
  if (answer === 'not-yet') return { next: s, beats: beats('choice:not-yet') }
  return { next: { ...s, stage: 'done' }, beats: beats('fold'), effect: 'fold' }
}

/** E on one of the five. Pure. */
export function talkFolk(s: TutorialState, id: FolkId, hands: Hands): Talk {
  const key = id.toUpperCase() as 'HAZEL' | 'SAX' | 'YARROW' | 'FENNEL' | 'MALLOW'
  // Before Greg has spoken the folk are still there (their doors are open); they just bark. A
  // keeper who wanders in first is not punished, and the greet waits for the offer that frames it.
  if (s.stage === 'greet') return { next: s, beats: beats(`folk:${key}:bark`) }
  if (!s.met.includes(id)) {
    const met = [...s.met, id]
    const allMet = met.length === FOLK_IDS.length
    const stage: TutorialStage = s.stage === 'doors' && allMet ? 'ask' : s.stage
    if (id === 'hazel') {
      return {
        next: { ...s, stage, met, hazel: 'owed' },
        beats: beats('folk:HAZEL:greet', 'folk:HAZEL:want', 'folk:HAZEL:lend', 'folk:HAZEL:give'),
        effect: 'lend_blade',
      }
    }
    return { next: { ...s, stage, met }, beats: beats(`folk:${key}:greet`, `folk:${key}:want`, `folk:${key}:give`) }
  }
  if (id === 'hazel' && s.hazel === 'owed') {
    if (hands.planks >= HAZEL_STACK && hands.hasHazelsBlade) {
      return { next: { ...s, hazel: 'done' }, beats: beats('folk:HAZEL:turn-in'), effect: 'take_blade' }
    }
    return { next: s, beats: beats('folk:HAZEL:bark:owed') }
  }
  return { next: s, beats: beats(`folk:${key}:bark`) }
}

// ── The HUD objective ───────────────────────────────────────────────────────────────────────

/** What the keeper is holding, as far as the objective chip cares. */
export interface Progress {
  logs: number
  planks: number
  hasHazelsBlade: boolean
}

/**
 * The objective chip's value — short enough for one line, caps handled by the chip's CSS.
 * Derived from the state AND the hands: Hazel's errand has three visible steps (cut, mill, bring)
 * that are nothing but inventory, so they are read off the inventory rather than stored twice.
 */
export function objectiveLabel(s: TutorialState, p: Progress): string {
  switch (s.stage) {
    case 'greet': return 'Find Gregory'
    case 'doors': {
      if (s.hazel === 'owed') {
        if (p.planks >= HAZEL_STACK) return 'Bring Hazel the stack'
        if (p.logs > 0) return "Mill planks at Hazel's sawmill"
        return "Cut a log with Hazel's blade"
      }
      const left = FOLK_IDS.length - s.met.length
      return left === FOLK_IDS.length ? 'Knock on five doors' : `${left} door${left === 1 ? '' : 's'} left`
    }
    case 'ask': return s.hazel === 'owed' ? "Bring Hazel the stack" : 'Return to Gregory'
    case 'lantern': return 'Craft a mana lantern'
    case 'light': return 'Set the lantern on the path'
    case 'choice': return 'Return to Gregory'
    case 'done': return 'Gate open'
  }
}

/**
 * The actions each objective actually needs, so its hint can be RESOLVED from the player's own
 * bindings instead of typed out.
 *
 * ⚠ THIS REPLACES A PERMANENT TWO-LINE CONTROL DUMP IN THE HUD CORNER (Alex, 2026-08-23: "the
 * button hints should be part of the tutorial"). Those lines were the widest thing on screen, said
 * the same thing forever, and were WRONG the moment anyone rebound a key or picked up a pad — a
 * string literal claiming to describe a binding. Naming ACTIONS means a rebind and a controller
 * both come out right with nothing here to go stale.
 *
 * Movement is on `greet` alone: it is how you reach Gregory, and repeating WASD on every step is
 * the noise that made the old block ignorable. `done` is deliberately empty — a finished tutorial
 * has nothing to teach, and the permanent reference is Settings › Controls.
 */
export function stageActions(s: TutorialState, p: Progress): readonly ActionId[] {
  switch (s.stage) {
    case 'greet': return ['move.forward', 'move.jump', 'world.interact']
    case 'doors':
      if (s.hazel !== 'owed') return ['world.interact']
      if (p.planks >= HAZEL_STACK) return ['world.interact']
      if (p.logs > 0) return ['world.interact']   // the sawmill opens on E
      return ['world.mine']
    case 'ask': return ['world.interact']
    case 'lantern': return ['ui.craft', 'ui.inventory']
    case 'light': return ['world.place']
    case 'choice': return ['world.interact']
    case 'done': return []
  }
}
