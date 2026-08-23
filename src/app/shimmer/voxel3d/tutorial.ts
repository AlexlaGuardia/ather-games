// The Moonwell Glade tutorial quest — Greg's chain from greeting to the gate.
//
// ★ HOST SIDE (localStorage), same reasoning as settings.ts: this is per-keeper SESSION state, not
// world terrain, so it does not belong in the IndexedDB column saves (save.ts) which exist
// specifically for "what you built" — see that file's header. Keyed per SEED so a future
// multi-seed world does not cross-contaminate one keeper's tutorial into another's, matching the
// key shape settings.ts and edits use.
//
// ★ PHASE 1 = MECHANICS, PLACEHOLDER DIALOGUE. Every line in GREG_LINE is a short, neutral
// stand-in — no attempt at Greg's eventual cozy voice. That is Alex/raven's pass, not this one's.

import { keeperKey } from '@/lib/keeper-local'

export type TutorialStage =
  | 'greet'   // objective: find and talk to Greg → he gifts 1 raw_mana_shard
  | 'cut'     // objective: break any log block
  | 'planks'  // objective: craft any planks recipe
  | 'lantern' // objective: craft mana_lantern
  | 'light'   // objective: place a mana_lantern block
  | 'report'  // objective: talk to Greg again — see the note below on why this stage exists
  | 'done'    // terminal — the gate is open

/**
 * ★ WHY 'report' EXISTS AND ISN'T ONE OF THE BRIEF'S SIX NAMED STAGES.
 * The brief's chain reads "...light (place a mana_lantern block) → done (talk to Greg again → gate
 * opens)" — which packs two distinct facts into one name: the objective right after placing the
 * lantern is "go tell Greg", and telling him is the ACT that opens the gate. Those have to be
 * separable states (a player who has placed the lantern but not yet talked to Greg is not the same
 * as one who has and has heard the gate open), so `'report'` is "lantern placed, go talk to Greg"
 * and `'done'` is the terminal state entered by that conversation. Judgment call, not a deviation
 * from the chain's shape — every one of the brief's six names still exists and still means what it
 * says.
 */
const STAGES: TutorialStage[] = ['greet', 'cut', 'planks', 'lantern', 'light', 'report', 'done']

export interface TutorialState {
  stage: TutorialStage
}

const DEFAULT_TUTORIAL: TutorialState = { stage: 'greet' }

/** Per keeper: which prompts THIS keeper has been shown. Family prefix, listed in `KEEPER_KEYS`. */
export const TUTORIAL_BASE = 'voxel3d:tutorial:'
const storageKey = (seed: number) => keeperKey(`${TUTORIAL_BASE}${seed}`)

/**
 * ⚠ Same failure discipline as settings.ts: private mode, a corrupt value, SSR — every path returns
 * a safe default rather than throwing. A tutorial that fails to load must not fail to render.
 */
export function loadTutorial(seed: number): TutorialState {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_TUTORIAL }
  try {
    const raw = localStorage.getItem(storageKey(seed))
    if (!raw) return { ...DEFAULT_TUTORIAL }
    const parsed = JSON.parse(raw)
    const stage: TutorialStage = STAGES.includes(parsed?.stage) ? parsed.stage : 'greet'
    return { stage }
  } catch { return { ...DEFAULT_TUTORIAL } }
}

export function saveTutorial(seed: number, s: TutorialState): void {
  try { localStorage.setItem(storageKey(seed), JSON.stringify(s)) } catch { /* private mode: run unpersisted */ }
}

// Gregory's voice — written by the raven agent against settled canon (greg-lines.ts). The
// `report` stage carries the `done` beat: the return-to-Greg talk IS the payoff (night warning +
// the door opening); post-gate `done` repeats only the farewell so re-talking stays warm, not loopy.
import { GREG_LINES } from './greg-lines'
export const GREG_LINE: Record<TutorialStage, string> = {
  greet: GREG_LINES.greet.join('\n'),
  cut: GREG_LINES.cut.join('\n'),
  planks: GREG_LINES.planks.join('\n'),
  lantern: GREG_LINES.lantern.join('\n'),
  light: GREG_LINES.light.join('\n'),
  report: GREG_LINES.done.join('\n'),
  done: GREG_LINES.done[GREG_LINES.done.length - 1],
}

/** The HUD objective chip's value — short enough for one line, caps handled by the chip's CSS. */
export const OBJECTIVE_LABEL: Record<TutorialStage, string> = {
  greet: 'Find Gregory',
  cut: 'Cut a tree',
  planks: 'Craft planks',
  lantern: 'Craft a mana lantern',
  light: 'Place the lantern',
  report: 'Return to Gregory',
  done: 'Gate open',
}
