// ★ BETA M233 CLASH v2c (play, 2026-11-27): FIGHT MEMORY as a LESSON LIST (Alex 11-27: "an achievement list of anything
// battle related, e.g. if a spirit is hit with a move that's effective against it, now it knows to prioritise evading").
// A fixed table of LESSONS. Each = a TRIGGER read off one Clash bout's event log (clash-fight.ts FightEvent, from HER side)
// and ONE TACTIC shift in the engine's utility AI (clash-fight.ts Tactic: where she stands, what she throws first, when she
// spends her dodge). NEVER a stat, a damage number or a cooldown (Alex rule: power = choice; she gets smarter, not stronger).
//  · each lesson is learned ONCE, she holds at most LESSON_CAP, at most ONE new lesson a bout;
//  · a LOSS teaches more than a win (LEARN_CHANCE.lost > .won), rolled on the bout's seed (a bout replays the same);
//  · saved on her pot (`lessons`, like pot.moves: spirit-seeds.ts Pot, grimoire-book.ts parseBook); the Clash panel feeds her
//    bouts in (clash-panel.tsx), the engine reads them as tactics (clash-bout.ts -> Entrant.tactics), her spirit panel lists them.
// Names: lesson ids are code ids; LESSON_UI labels are plain placeholders for @lark. ★ PURE: no React, no storage.
// Run: npx tsx src/app/shimmer/open/ather/clash-lessons.test.ts
import { KIND, type FightEvent, type Tactic } from './clash-fight'
import type { Species, Element } from '../../spirits/spirit'

/** what one bout looked like from her side: her seat (0/1), the foe she met, how it ended, every event of the bout */
export interface BoutRecord {
  side: 0 | 1
  foe: { species: Species; element: Element }
  won: boolean
  /** her HP fraction when the bout ended (0..1) */
  hpEnd: number
  ev: readonly FightEvent[]
}

/** facts counted off the log (the triggers read these) */
export interface BoutFacts {
  won: boolean; hpEnd: number; foePref: number
  /** hits she TOOK: all, by the foe's melee, by the foe's bonded move, super-effective ones */
  tookMelee: number; tookBonded: number; tookStrong: number
  /** hits she LANDED by melee / bonded move; her attacks that missed, were evaded, were guarded */
  landedMelee: number; landedBonded: number; missed: number; evadedByFoe: number; guardedByFoe: number
  /** slow / root / dot riders the foe landed on her */
  snared: number
  cheered: boolean
}
export function factsOf(r: BoutRecord): BoutFacts {
  const me = r.side, foe = (1 - me) as 0 | 1
  const n = (f: (e: FightEvent) => boolean) => r.ev.filter(f).length
  return {
    won: r.won, hpEnd: r.hpEnd, foePref: KIND[r.foe.species]?.pref ?? 3,
    tookMelee: n(e => e.kind === 'hit' && e.side === foe && e.move === 'melee'),
    tookBonded: n(e => e.kind === 'hit' && e.side === foe && e.move === 'bonded'),
    tookStrong: n(e => e.kind === 'hit' && e.side === foe && (e.eff ?? 1) > 1),
    landedMelee: n(e => e.kind === 'hit' && e.side === me && e.move === 'melee'),
    landedBonded: n(e => e.kind === 'hit' && e.side === me && e.move === 'bonded'),
    missed: n(e => e.kind === 'miss' && e.side === me),
    evadedByFoe: n(e => e.kind === 'evaded' && e.side === foe),
    guardedByFoe: n(e => e.kind === 'guarded' && e.side === me),
    snared: n(e => e.kind === 'rider' && e.side === foe && (e.rider === 'slow' || e.rider === 'root' || e.rider === 'dot')),
    cheered: r.ev.some(e => e.kind === 'cheer' && e.side === me),
  }
}

export interface Lesson { id: string; tactic: Tactic; when: (f: BoutFacts) => boolean }
/** THE TABLE (Jin's game calls, flagged for Alex). One trigger, one tactic each; the tactic's meaning is in clash-fight.ts. */
export const LESSONS: readonly Lesson[] = [
  // took a hit her element is weak to -> she keeps her dodge / guard for THAT move, not the foe's melee
  { id: 'stung', tactic: 'saveDefense', when: f => f.tookStrong >= 1 },
  // the foe's bonded move landed on her twice -> she watches for its wind-up first (and the melee's less)
  { id: 'caught', tactic: 'watchBonded', when: f => f.tookBonded >= 2 },
  // lost to a far-standing kind -> she presses in on kiters instead of waiting at her own range
  { id: 'kited', tactic: 'pressKiter', when: f => !f.won && f.foePref > 2.5 },
  // lost to a close kind that beat on her -> she keeps a step off brawlers while their strike is ready
  { id: 'crowded', tactic: 'spaceBrawler', when: f => !f.won && f.foePref <= 2.5 && f.tookMelee >= 3 },
  // won on her bonded move -> she throws it from the edge of its reach
  { id: 'reach', tactic: 'trustReach', when: f => f.won && f.landedBonded >= 2 && f.landedBonded > f.landedMelee },
  // won up close -> she darts in for a strike whenever it is ready
  { id: 'brawl', tactic: 'pressMelee', when: f => f.won && f.landedMelee >= 3 },
  // cheered and won -> she stops backing off when hurt
  { id: 'rally', tactic: 'bold', when: f => f.won && f.cheered },
  // won by a hair -> hurt, she strikes only with her dodge / guard ready
  { id: 'close_call', tactic: 'wary', when: f => f.won && f.hpEnd < 0.2 },
  // her attacks fell short twice -> she closes the gap before she throws her bonded move
  { id: 'whiff', tactic: 'closeIn', when: f => f.missed >= 2 },
  // her hits were guarded twice -> she does not strike into a raised guard
  { id: 'walled', tactic: 'waitGuard', when: f => f.guardedByFoe >= 2 },
  // her attacks were dodged twice -> she draws the dodge with her melee before the bonded move
  { id: 'dodged', tactic: 'baitDodge', when: f => f.evadedByFoe >= 2 },
  // slowed / rooted / burned twice -> while slowed she backs off instead of trading
  { id: 'snared', tactic: 'shakeOff', when: f => f.snared >= 2 },
]
export const LESSON_IDS: readonly string[] = LESSONS.map(l => l.id)
/** at most this many lessons (Jin dial): which ones she keeps is the story of her fights */
export const LESSON_CAP = 8
/** chance a met trigger is learned this bout (a loss teaches more) */
export const LEARN_CHANCE = { won: 0.35, lost: 0.7 } as const

/** the lessons met by a bout (table order), whether or not she learns them */
export const triggered = (r: BoutRecord): string[] => { const f = factsOf(r); return LESSONS.filter(l => l.when(f)).map(l => l.id) }

function mix(n: number): number {
  let t = (n ^ 0x2c1b3c6d) >>> 0
  t = Math.imul(t ^ (t >>> 16), 0x7feb352d) >>> 0; t = Math.imul(t ^ (t >>> 15), 0x846ca68b) >>> 0
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}
/** what she learns from a bout: at most ONE new lesson (not one she has, none past the cap), rolled per met trigger on the
 *  bout's seed. null = nothing this time. */
export function learnFrom(have: readonly string[], r: BoutRecord, seed: number): string | null {
  if (have.length >= LESSON_CAP) return null
  const p = r.won ? LEARN_CHANCE.won : LEARN_CHANCE.lost
  const met = triggered(r).filter(id => !have.includes(id))
  for (let i = 0; i < met.length; i++) if (mix(seed * 31 + i * 7 + 1) < p) return met[i]
  return null
}
/** her lessons as the engine's tactics */
export const tacticsOf = (lessons: readonly string[] | undefined): Tactic[] =>
  (lessons ?? []).flatMap(id => { const l = LESSONS.find(x => x.id === id); return l ? [l.tactic] : [] })
/** a pot's lesson list from storage: known ids only, no repeats, capped; junk drops */
export function parseLessons(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const ok = v.filter((x, i): x is string => typeof x === 'string' && LESSON_IDS.includes(x) && v.indexOf(x) === i).slice(0, LESSON_CAP)
  return ok.length ? ok : undefined
}

/** labels (plain placeholder UI, readable; @lark for the words) */
export const LESSON_UI = {
  header: 'Lessons',
  none: 'No lessons yet. She learns in the Clash ring.',
  learned: (name: string, lesson: string) => `${name} learned: ${lesson}`,
  name: {
    stung: 'Saves her dodge for moves that hurt most',
    caught: 'Watches for the big move first',
    kited: 'Presses in on spirits who keep away',
    crowded: 'Keeps a step off close fighters',
    reach: 'Throws her move from the edge of its reach',
    brawl: 'Darts in when her strike is ready',
    rally: 'Holds her ground when hurt',
    close_call: 'Keeps her dodge ready when hurt',
    whiff: 'Closes in before she throws',
    walled: 'Waits out a raised guard',
    dodged: 'Draws the dodge before her big move',
    snared: 'Backs off when slowed',
  } as Record<string, string>,
}
