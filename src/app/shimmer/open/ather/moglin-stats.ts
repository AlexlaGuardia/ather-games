// MOGLIN STATS (BETA M65 slice 1, Alex 11-22): a Moglin card is a 5-stat RADAR, not a nine-skill list.
// Five stats, each graded S/A/B/C/D/F: CORE, DEXTERITY, PATIENCE (each covers a set of skills), TALENT (a bonus to every
// stat graded B or better) and LUCK (a double-drop chance on all its skills). A skill's SCORE (0-10) = the points of the
// stat it sits under + Talent's bonus when that stat is B or better.
// Slice 1 was DATA + DISPLAY; slice 2 (bottom of this file) makes the score + luck what rooms read, replacing the M46 grade
// reads and the alchemist extra-bottle curve. The M46 nine grades stay as the roll's BIAS (rollStats).
// Old saves need no migration: a Moglin's stats are DERIVED on read, deterministically from its id and biased by its M46
// skill grades, so a reload never rerolls and an older record (grades only) still gets a full card.
// ★ PURE: no React, no DOM.
import type { MoglinRecord } from './moglins'
import { SKILLS, SKILL_LABEL, SKILL_OF_ROOM, rngOf, skillsOf, luckOf, type Skill } from './moglin-skills'
import type { RoomKind } from './rooms'

export type Stat = 'core' | 'dexterity' | 'patience' | 'talent' | 'luck'
/** the radar's axes, clockwise from the top */
export const STATS: readonly Stat[] = ['core', 'dexterity', 'patience', 'talent', 'luck']
export const STAT_LABEL: Record<Stat, string> = { core: 'Core', dexterity: 'Dexterity', patience: 'Patience', talent: 'Talent', luck: 'Luck' }
export type StatGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
/** worst to best: the index is the grade's rank */
export const STAT_GRADES: readonly StatGrade[] = ['F', 'D', 'C', 'B', 'A', 'S']
export const rankOf = (g: StatGrade) => STAT_GRADES.indexOf(g)
export type Stats = Record<Stat, StatGrade>

// ── ★ THE KNOBS (Alex's row M65). The three marked PENDING are the hub's defaults, waiting on Alex: change them HERE only ──
/** a stat grade's points toward a skill score */
export const GRADE_POINTS: Record<StatGrade, number> = { S: 6, A: 5, B: 4, C: 3, D: 2, F: 0 }
/** Talent's bonus by Talent's own grade. PENDING Alex: C = 1 (hub default). */
export const TALENT_BONUS: Record<StatGrade, number> = { S: 4, A: 3, B: 2, C: 1, D: 1, F: 0 }
/** Talent lifts a stat only when that stat is graded at least this. PENDING Alex: 'B or better' (hub default). */
export const TALENT_FROM: StatGrade = 'B'
/** Luck: the double-drop chance on all of a Moglin's skills */
export const LUCK_PCT: Record<StatGrade, number> = { S: 40, A: 30, B: 20, C: 10, D: 5, F: 0 }
/** which stat each skill sits under. Rinning stays a keeper skill (canon): the Moglin's is Rinnshop. Carpentry = woodworking,
 *  Stonery = masonry, Hearth = cooking, Smithy = metalwork, Prospecting = mining. PENDING Alex: Alchemy (potions) under Patience. */
export const STAT_OF_SKILL: Readonly<Record<Skill, 'core' | 'dexterity' | 'patience'>> = {
  forestry: 'core', mining: 'core',
  rinnshop: 'dexterity', woodworking: 'dexterity', masonry: 'dexterity',
  cooking: 'patience', metalwork: 'patience', farming: 'patience', potions: 'patience',
}
export const SCORE_MAX = 10

/** A skill's score: its stat's points + Talent's bonus when that stat is graded TALENT_FROM or better; capped at 10. */
export function skillScore(stats: Stats, skill: Skill): number {
  const g = stats[STAT_OF_SKILL[skill]]
  const bonus = rankOf(g) >= rankOf(TALENT_FROM) ? TALENT_BONUS[stats.talent] : 0
  return Math.min(SCORE_MAX, GRADE_POINTS[g] + bonus)
}
export const luckPct = (stats: Stats) => LUCK_PCT[stats.luck]

// ── the roll: deterministic per Moglin id, biased by what it is already good at ──────────────────────────────────────────
/** the drift around a stat's biased rank: one grade down 25 %, as is 50 %, one up 25 % */
export const DRIFT: readonly [number, number][] = [[-1, 25], [0, 50], [1, 25]]
function drift(rnd: () => number): number {
  let r = rnd() * 100
  for (const [d, w] of DRIFT) { if ((r -= w) < 0) return d }
  return 0
}
const clampRank = (r: number) => STAT_GRADES[Math.max(0, Math.min(STAT_GRADES.length - 1, r))]
/** An M46 grade (1 fair .. 5 rare) maps to a stat rank: 1 D, 2 C, 3 B, 4 A, 5 S (F only by drifting down from D). */
export const rankFromGrade = (g: number) => Math.max(1, Math.min(5, g))

type Rec = Pick<MoglinRecord, 'id' | 'profession' | 'grades' | 'skills' | 'luck'>
/** A Moglin's five stats. CORE / DEXTERITY / PATIENCE start at the BEST M46 grade among their skills (a carpenter's
 *  woodworking makes its Dexterity), LUCK at its M46 luck, TALENT at C (B when any skill is rare); each then drifts one
 *  grade from a seed of the id. Same id + same skills = same stats, every load. */
export function rollStats(m: Rec): Stats {
  const sk = skillsOf(m), rnd = rngOf(`stats:${m.id}`)
  const best = (s: 'core' | 'dexterity' | 'patience') => Math.max(...SKILLS.filter(k => STAT_OF_SKILL[k] === s).map(k => sk[k]))
  const base: Record<Stat, number> = {
    core: rankFromGrade(best('core')), dexterity: rankFromGrade(best('dexterity')), patience: rankFromGrade(best('patience')),
    talent: SKILLS.some(k => sk[k] === 5) ? rankOf('B') : rankOf('C'),
    luck: rankFromGrade(luckOf(m)),
  }
  const out = {} as Stats
  for (const s of STATS) out[s] = clampRank(base[s] + drift(rnd))   // fixed order: the stream is stable
  return out
}
export const statsOf = (m: Rec): Stats => rollStats(m)

/** what the card shows: five axes (grade + 0..1 reach for the radar) and every skill's score, in the M46 skill order */
export interface StatAxis { stat: Stat; label: string; grade: StatGrade; reach: number }
export interface ScoreRow { skill: Skill; label: string; stat: Stat; score: number }
export function statView(m: Rec): { axes: StatAxis[]; scores: ScoreRow[]; luckPct: number } {
  const st = statsOf(m)
  return {
    axes: STATS.map(s => ({ stat: s, label: STAT_LABEL[s], grade: st[s], reach: GRADE_POINTS[st[s]] / GRADE_POINTS.S })),
    scores: SKILLS.map(k => ({ skill: k, label: SKILL_LABEL[k], stat: STAT_OF_SKILL[k], score: skillScore(st, k) })),
    luckPct: luckPct(st),
  }
}

// ── SLICE 2 (Alex 11-22 via hub 7f25d6a2): the score and the luck are what PLAY reads ─────────────────────────────────────
// A room reads the Moglin's 0-10 SCORE in the skill it uses there (SKILL_OF_ROOM), not the M46 1-5 grade. The curves keep
// today's balance at the middle: score 5 (a B stat + a C talent) pays what an M46 'fine' (3) did, 0 pays a 'fair' (1),
// 10 pays a 'rare' (5). LUCK replaces both the M46 +1-per-run luck and the M57 alchemist extra-bottle curve: one chance,
// LUCK_PCT, to DOUBLE what a run / an item / a bottle drops. Nothing adds a second chance on top (no stacking).
/** the M46 grade a score stands in for (0 -> 1, 5 -> 3, 10 -> 5), continuous */
export const gradeEquiv = (score: number) => 1 + 0.4 * Math.max(0, Math.min(SCORE_MAX, score))
/** a Moglin's score in the skill `roomKind`'s craft (bench pace) or yield (idle product) reads */
export const scoreIn = (m: Rec, roomKind: RoomKind, use: 'craft' | 'yield'): number => skillScore(statsOf(m), SKILL_OF_ROOM[roomKind][use])
/** a Moglin's double-drop chance, 0..1 */
export const luckChance = (m: Rec): number => luckPct(statsOf(m)) / 100
/** one roll: does this drop come out doubled? `rnd` in [0,1). */
export const doubles = (chance: number, rnd: () => number): boolean => chance > 0 && rnd() < chance
