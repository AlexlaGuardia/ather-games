// puppet-guards.ts — the Three Puppet Guards. The Throne encounter.
//
// ── CANON, and there is a LOT of it — none of this is invented ─────────────────
// `characters/elite-guards.md` + `game/pyramid-zero.md` § Level 3.
//
// In Year 600 they were real people who served Lazerin for three different reasons and died
// defending something none of them believed in. In 1672 he rebuilt them from memory — not for
// defence ("the Pyramid's defences don't need guards") but because **he was lonely**. Canon's own
// line: *"They're not guards. They're furniture. Familiar shapes in an empty room."*
//
//   **SEREN — The Proud** · holds the line. Barriers that don't just defend, they CLAIM: walls that
//     advance, shields that shove, ground that becomes hers the moment she steps on it. Fighting her
//     "feels like being squeezed out of a room." She won't raise a barrier until the last possible
//     moment — flinching early is weakness.
//   **CADE — The Greedy** · flanks and traps. "Feels like being audited." Layers upon layers. He
//     doesn't fight to kill, he fights to TAKE: enemies boxed in, options stripped away, until
//     surrender is the only math that works.
//   **WREN — The Doubtful** · counters. "Feels like fighting your own shadow." Never the first move,
//     always the counter — barriers that catch mid-swing and turn attacks back. The most technically
//     gifted of the three and the least aggressive.
//
//   Formation:      [SEREN]        The Loop: SQUEEZE → TRAP → COUNTER, repeat.
//                  /       \
//              [CADE]     [WREN]
//              (flank)    (counter)
//
//   What's WRONG with the puppets (this is the reveal, and it must be PLAYABLE, not just lore):
//     - Seren's pride has no weight behind it — posturing at nothing
//     - Cade's hands still move, checking pouches that are empty
//     - Wren still hesitates — but there's no one inside making the choice
//     - **They don't bleed right**
//   Canon calls these the breadcrumbs of a thousand-year foreshadow: a casual player reads "cool
//   bosses", a lore reader reads "he rebuilt them from memory; he was alone for 1000 years." The
//   tells below exist so the renderer can SHOW that without a line of dialogue.
//
// ── WHAT'S MINE ────────────────────────────────────────────────────────────────
// Numbers, timings, and the shape of the state machine. Everything canon fixes — who they are, what
// each one's combat FEELS like, the formation, the loop order — is transcribed, not designed.
//
// Pure step function, no THREE.js, no React: the renderer owns bodies and the sim owns behaviour,
// so the whole encounter is provable headless before anything is drawn.

export type GuardId = 'seren' | 'cade' | 'wren'
export type GuardRole = 'hold' | 'flank' | 'counter'
/** the formation loop — canon's "squeeze, trap, counter. Repeat until surrender or death." */
export type LoopPhase = 'squeeze' | 'trap' | 'counter'

export interface GuardSpec {
  id: GuardId
  name: string
  epithet: string
  role: GuardRole
  /** the phase this guard LEADS. The other two support. */
  leads: LoopPhase
  hp: number
  /** metres per second while advancing/repositioning */
  speed: number
  /** how close this guard wants to be to the player */
  standoff: number
  /**
   * Seren "doesn't raise barriers until the last possible moment — flinching early is weakness."
   * Low = raises late. Canon personality expressed as a number.
   */
  guardThreshold: number
  /** the puppet tell — the renderer plays this on idle. Canon, verbatim in spirit. */
  tell: string
}

// ── TUNING — every number in the encounter ─────────────────────────────────────
//
// ── ★ TUNING IS AN ARGUMENT, NOT A MODULE CONSTANT (2026-08-12) ────────────────
// Every number below was a first guess, and a first guess is only ever settled by someone
// FEELING it. The range console can now drive these live (`GuardTuningPanel` in Shimmer3D),
// which is worth a word about why it did not become a mutable module-level `let`:
//
//   A mutable export would make `stepEncounter` impure — the same state and the same dt would
//   stop producing the same next state, which is the one property this file's header promises
//   and the whole reason the encounter is provable headless. It would also mean the oracle and
//   the running game could silently disagree, because the oracle imports the same binding the
//   sliders are writing to.
//
// Passing tuning IN keeps the functions total over their inputs and actually makes them *more*
// pure than before: the numbers stop being ambient. The default argument is what keeps all
// existing call sites (and every assert in crucible-encounter.test.ts) working untouched.
export interface GuardTuning {
  /** seconds each phase of the loop holds before handing to the next */
  phaseSec: number
  /** Seren's advance claims this much ground per phase — the "squeezed out of a room" feel */
  claimPerPhase: number
  /** how tight Cade's box gets each time the loop comes round. Options stripped away. */
  boxShrink: number
  /** Wren's counter window — attacks landing inside it get turned back */
  counterWindowSec: number
  /** fraction of damage Wren returns on a successful counter */
  counterReturn: number
  /** a guard is staggered this long when broken out of its posture */
  staggerSec: number
  /** the arena radius the trio will not let the player leave */
  boxStartRadius: number
  boxMinRadius: number
}

export const GUARD_TUNING: Readonly<GuardTuning> = {
  phaseSec: 7,
  claimPerPhase: 2.2,
  boxShrink: 0.82,
  counterWindowSec: 1.1,
  counterReturn: 0.55,
  staggerSec: 1.4,
  boxStartRadius: 14,
  boxMinRadius: 5,
}

export const GUARDS: GuardSpec[] = [
  {
    id: 'seren', name: 'Seren', epithet: 'The Proud', role: 'hold', leads: 'squeeze',
    hp: 260, speed: 2.6, standoff: 3.2, guardThreshold: 0.18,
    tell: 'holds the posture a beat too long — pride with nothing behind it',
  },
  {
    id: 'cade', name: 'Cade', epithet: 'The Greedy', role: 'flank', leads: 'trap',
    hp: 210, speed: 3.4, standoff: 7.0, guardThreshold: 0.5,
    tell: 'hands keep checking pouches that are empty',
  },
  {
    id: 'wren', name: 'Wren', epithet: 'The Doubtful', role: 'counter', leads: 'counter',
    hp: 190, speed: 3.0, standoff: 9.0, guardThreshold: 0.75,
    tell: 'hesitates — but there is no one inside making the choice',
  },
]

export const LOOP_ORDER: LoopPhase[] = ['squeeze', 'trap', 'counter']

export interface GuardState {
  id: GuardId
  hp: number
  alive: boolean
  /** distance this guard is currently holding from the player */
  standoff: number
  /** true while this guard leads the current phase */
  leading: boolean
  /** barrier up. Seren raises hers late on purpose. */
  guarding: boolean
  staggerFor: number
}

export interface EncounterState {
  t: number
  phase: LoopPhase
  /** how many complete squeeze→trap→counter cycles have run — the pressure keeps rising */
  cycle: number
  phaseElapsed: number
  guards: GuardState[]
  /** the radius the trio is holding the player inside. Shrinks every cycle. */
  boxRadius: number
  /** true once all three are down */
  cleared: boolean
}

export function initEncounter(tuning: Readonly<GuardTuning> = GUARD_TUNING): EncounterState {
  return {
    t: 0, phase: LOOP_ORDER[0], cycle: 0, phaseElapsed: 0,
    boxRadius: tuning.boxStartRadius,
    cleared: false,
    guards: GUARDS.map((g) => ({
      id: g.id, hp: g.hp, alive: true, standoff: g.standoff,
      leading: g.leads === LOOP_ORDER[0], guarding: false, staggerFor: 0,
    })),
  }
}

export const specOf = (id: GuardId): GuardSpec => {
  const s = GUARDS.find((g) => g.id === id)
  if (!s) throw new Error(`puppet-guards: unknown guard '${id}'`)
  return s
}

/**
 * Advance the encounter. Pure: same state + same dt ⇒ same next state.
 *
 * `playerHpFrac` drives the personality thresholds (Seren raising her barrier at the last possible
 * moment reads off the pressure she's under, not a timer).
 */
export function stepEncounter(
  prev: EncounterState, dt: number, playerHpFrac = 1,
  tuning: Readonly<GuardTuning> = GUARD_TUNING,
): EncounterState {
  if (prev.cleared) return prev

  const guards = prev.guards.map((g) => ({ ...g }))
  let { phase, cycle, phaseElapsed, boxRadius } = prev

  phaseElapsed += dt

  // the loop only advances while someone is alive to run it
  const anyAlive = guards.some((g) => g.alive)
  if (anyAlive && phaseElapsed >= tuning.phaseSec) {
    phaseElapsed = 0
    const i = LOOP_ORDER.indexOf(phase)
    const nextI = (i + 1) % LOOP_ORDER.length
    phase = LOOP_ORDER[nextI]
    // a full pass of squeeze→trap→counter = one cycle: the box tightens, canon's "nowhere to go"
    if (nextI === 0) {
      cycle += 1
      boxRadius = Math.max(tuning.boxMinRadius, boxRadius * tuning.boxShrink)
    }
  }
  // The minimum is an INVARIANT, not merely a floor applied at shrink time. Once tuning can move
  // under a running encounter, raising `boxMinRadius` has to actually give the room back — the old
  // one-sided clamp only ever ran on the shrink step, so a raised minimum would sit there doing
  // nothing and read as a dead slider. Costs one Math.max per step and makes the state honest.
  boxRadius = Math.max(tuning.boxMinRadius, boxRadius)

  for (const g of guards) {
    if (!g.alive) { g.leading = false; g.guarding = false; continue }
    if (g.staggerFor > 0) {
      g.staggerFor = Math.max(0, g.staggerFor - dt)
      g.guarding = false
      g.leading = false
      continue
    }
    const spec = specOf(g.id)
    g.leading = spec.leads === phase
    // Seren claims ground while she leads the squeeze — she closes and does not give it back
    if (g.id === 'seren' && g.leading) {
      g.standoff = Math.max(spec.standoff, g.standoff - tuning.claimPerPhase * dt)
    } else if (!g.leading) {
      // supporting guards drift back toward their own preferred distance
      g.standoff += (spec.standoff - g.standoff) * Math.min(1, dt * 0.8)
    }
    // barriers: each guard's threshold IS their personality. Seren's is lowest — she raises last.
    g.guarding = playerHpFrac <= 1 && (1 - playerHpFrac) >= spec.guardThreshold
      ? true
      : g.leading && spec.id !== 'seren'
  }

  return {
    ...prev,
    t: prev.t + dt,
    phase, cycle, phaseElapsed, boxRadius, guards,
    cleared: guards.every((g) => !g.alive),
  }
}

/** Damage a guard. Returns the new state plus how much Wren turned back, if any. */
export function damageGuard(
  state: EncounterState, id: GuardId, amount: number,
  tuning: Readonly<GuardTuning> = GUARD_TUNING,
): { state: EncounterState; returned: number } {
  const guards = state.guards.map((g) => ({ ...g }))
  const g = guards.find((x) => x.id === id)
  if (!g || !g.alive) return { state, returned: 0 }

  let dealt = amount
  let returned = 0

  // Wren "never the first move, always the counter" — inside her window she turns it back.
  if (g.id === 'wren' && state.phase === 'counter' && state.phaseElapsed <= tuning.counterWindowSec) {
    returned = amount * tuning.counterReturn
    dealt = amount * (1 - tuning.counterReturn)
  }
  // a raised barrier blunts the hit and staggers the guard instead of dropping it
  if (g.guarding) {
    dealt *= 0.4
    g.staggerFor = tuning.staggerSec
    g.guarding = false
  }

  g.hp = Math.max(0, g.hp - dealt)
  if (g.hp === 0) g.alive = false

  return {
    state: { ...state, guards, cleared: guards.every((x) => !x.alive) },
    returned,
  }
}

/**
 * The puppet tells, for the renderer.
 *
 * Canon is explicit that the wrongness is the payoff — "they don't bleed right" is the last
 * breadcrumb of a thousand-year foreshadow. It has to be VISIBLE in the fight, so it lives here
 * as data the renderer can play rather than as a comment nobody ships.
 */
export const PUPPET_TELLS = {
  /** played on idle, per guard — the personality loop running with no one inside it */
  idle: Object.fromEntries(GUARDS.map((g) => [g.id, g.tell])) as Record<GuardId, string>,
  /** every guard shares this one. It is the reveal. */
  onHit: 'they don’t bleed right',
} as const
