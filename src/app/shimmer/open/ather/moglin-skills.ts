// MOGLIN SKILLS (BETA M46 slice 1): nine skills graded 1-5 plus LUCK replace the three grade categories as what a Moglin is
// good at. ANY Moglin works ANY room at its grade there (skillIn); WORKS_IN (moglins.ts) still gates who may be assigned, in
// this slice. Rolls are SPIKY: the trade's own skill(s) roll high, 1-2 side skills middling, the rest low; luck mostly low.
// MINING is graded but UNUSED yet: no Stonery idle yield exists (the stonemason's yield side maps to it, nothing reads it).
// ★ PURE: no React, no DOM. Types only from moglins.ts (value imports run the other way), so there is no cycle.
import type { Grade, MoglinRecord, Profession } from './moglins'
import type { RoomKind } from './rooms'

export type Skill = 'forestry' | 'woodworking' | 'farming' | 'cooking' | 'masonry' | 'metalwork' | 'mining' | 'potions' | 'rinnshop'
export const SKILLS: readonly Skill[] = ['forestry', 'woodworking', 'farming', 'cooking', 'masonry', 'metalwork', 'mining', 'potions', 'rinnshop']
/** the card's labels. 'Rinnshop', never 'Rinning' (canon ruling: Rinning stays a keeper skill). */
export const SKILL_LABEL: Record<Skill, string> = {
  forestry: 'Forestry', woodworking: 'Woodworking', farming: 'Farming', cooking: 'Cooking', masonry: 'Masonry',
  metalwork: 'Metalwork', mining: 'Mining', potions: 'Potions', rinnshop: 'Rinnshop',
}
export type Skills = Record<Skill, Grade>

/** which skill a room's work reads: craft = bench pace (refine/roast/brew), yield = the idle product */
export const SKILL_OF_ROOM: Readonly<Record<RoomKind, Record<'craft' | 'yield', Skill>>> = {
  carpentry: { craft: 'woodworking', yield: 'forestry' },
  farm: { craft: 'farming', yield: 'farming' },
  cooking: { craft: 'cooking', yield: 'cooking' },
  alchemy: { craft: 'potions', yield: 'potions' },
  stonemason: { craft: 'masonry', yield: 'mining' },
  smith: { craft: 'metalwork', yield: 'metalwork' },
  rinnshop: { craft: 'rinnshop', yield: 'rinnshop' },
}

/** A trade's skills: `main` roll high; `craft`/`yield` = where an OLD save's craft / yield grade lands (`first` wins when
 *  both sides are one skill: the side that trade's room actually reads). */
const PROF: Readonly<Record<Profession, { main: readonly Skill[]; craft?: Skill; yield?: Skill; first?: 'craft' | 'yield' }>> = {
  farmer: { main: ['farming'], craft: 'farming', yield: 'farming', first: 'yield' },
  cook: { main: ['cooking'], craft: 'cooking', yield: 'rinnshop' },
  carpenter: { main: ['woodworking', 'forestry'], craft: 'woodworking', yield: 'forestry' },
  stonemason: { main: ['masonry', 'mining'], craft: 'masonry', yield: 'mining' },
  alchemist: { main: ['potions'], craft: 'potions', yield: 'potions', first: 'craft' },
  smith: { main: ['metalwork'], craft: 'metalwork', yield: 'metalwork', first: 'yield' },
  jeweler: { main: ['masonry'], craft: 'masonry', yield: 'mining' },
  rinnshop: { main: ['rinnshop'], craft: 'rinnshop', yield: 'rinnshop', first: 'craft' },   // the bait-maker (Yarrow, 11-21)
  digger: { main: ['mining'], craft: 'masonry', yield: 'mining', first: 'yield' },   // M108 s3: Marl's trade (no room work yet)
  shopkeeper: { main: [] },
}

export function rngOf(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  let s = h >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}
function pick<T>(rnd: () => number, w: readonly [T, number][]): T {
  const total = w.reduce((a, [, x]) => a + x, 0); let r = rnd() * total
  for (const [v, x] of w) { if ((r -= x) < 0) return v }
  return w[w.length - 1][0]
}
export const MAIN_ODDS: readonly [Grade, number][] = [[3, 10], [4, 40], [5, 50]]
export const SIDE_ODDS: readonly [Grade, number][] = [[2, 40], [3, 40], [4, 20]]
export const REST_ODDS: readonly [Grade, number][] = [[1, 55], [2, 35], [3, 10]]
export const LUCK_ODDS: readonly [Grade, number][] = [[1, 55], [2, 25], [3, 12], [4, 6], [5, 2]]

/** The spiky roll for a trade, deterministic from `rnd`. Returns skills + luck. */
export function rollSkills(profession: Profession, rnd: () => number): { skills: Skills; luck: Grade } {
  const main = PROF[profession].main
  const rest = SKILLS.filter(s => !main.includes(s))
  const nSide = 1 + (rnd() < 0.5 ? 1 : 0)
  const sides = new Set<Skill>()
  const pool = [...rest]
  for (let i = 0; i < nSide && pool.length; i++) sides.add(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
  const skills = {} as Skills
  for (const s of SKILLS) skills[s] = main.includes(s) ? pick(rnd, MAIN_ODDS) : sides.has(s) ? pick(rnd, SIDE_ODDS) : pick(rnd, REST_ODDS)
  return { skills, luck: pick(rnd, LUCK_ODDS) }
}

type Legacy = Pick<MoglinRecord, 'id' | 'profession' | 'grades'>
/** An old record (grades only): its trade's craft-side / yield-side skills keep the old grades, the rest and luck roll ONCE
 *  from a seed of the Moglin's id, so a reload never rerolls. */
export function migrateSkills(m: Legacy): { skills: Skills; luck: Grade } {
  const r = rollSkills(m.profession, rngOf(`skills:${m.id}`))
  const p = PROF[m.profession], order: ('craft' | 'yield')[] = p.first === 'yield' ? ['craft', 'yield'] : ['yield', 'craft']
  for (const u of order) { const s = p[u]; if (s) r.skills[s] = m.grades[u] }   // `first` is written last, so it wins a shared skill
  return r
}
const okGrade = (g: unknown): g is Grade => g === 1 || g === 2 || g === 3 || g === 4 || g === 5
export const validSkills = (s: unknown): s is Skills => !!s && typeof s === 'object' && SKILLS.every(k => okGrade((s as Record<string, unknown>)[k]))

/** a Moglin's skills (its own, or the migration of an old record) */
export const skillsOf = (m: Legacy & { skills?: Skills }): Skills => (validSkills(m.skills) ? m.skills : migrateSkills(m).skills)
export const luckOf = (m: Legacy & { luck?: Grade }): Grade => (okGrade(m.luck) ? m.luck : migrateSkills(m).luck)
/** ★ ANY Moglin, ANY room: the grade it brings to `roomKind`'s craft (bench pace) or yield (idle product) */
export const skillIn = (m: Legacy & { skills?: Skills }, roomKind: RoomKind, use: 'craft' | 'yield'): Grade => skillsOf(m)[SKILL_OF_ROOM[roomKind][use]]

// (M46's per-run +1 luck, LUCK_CHANCE / luckBonus, is gone: M65 s2's Luck double-drop in moglin-stats.ts replaced it.)
