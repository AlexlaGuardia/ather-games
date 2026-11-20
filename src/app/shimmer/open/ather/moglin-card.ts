// MOGLIN CARD (BETA M46 slices 2+3): what the Inspect answer in a Moglin's talk shows. PURE: no React, no DOM.
// Slice 2: nine skill pips + a luck charm, the frame tinted by the best grade. Slice 3 (TRUST REVEAL): a Moglin that does not
// trust the keeper yet shows its trade only; every good brought toward its hoop lights more skills, best first; luck shows
// last, once it trusts. A Moglin that would come for the asking (no hoop) trusts from the start, so its card is full.
import type { Grade, MoglinRecord, Profession } from './moglins'
import { GLADE_NAME } from './moonwell-glade'
import { SKILLS, SKILL_LABEL, skillsOf, luckOf, type Skill } from './moglin-skills'
import { wantsLeft, type Folk, type Trust } from './settlement-folk'

export interface CardRow { skill: Skill; label: string; /** null = not revealed yet */ grade: Grade | null }
export interface CardView {
  name: string; home: string; trade: string
  rows: CardRow[]
  luck: Grade | null
  /** the frame tint: the best grade SHOWN (0 = nothing shown yet) */
  best: Grade | 0
  /** 0..1, how much of the card is lit */
  shown: number
  full: boolean
}

export const tradeLabel = (p: Profession) => p[0].toUpperCase() + p.slice(1)

/** 0..1: how far the keeper is through this Moglin's hoop (1 = trusted, or no hoop at all) */
export function trustShare(f: Folk, t: Trust): number {
  if (!f.employed || !f.wants.length) return 1
  const all = f.wants.reduce((a, w) => a + w.n, 0)
  const left = wantsLeft(f, t).reduce((a, w) => a + w.n, 0)
  return all > 0 ? Math.max(0, Math.min(1, (all - left) / all)) : 1
}

/** The card for `f`, as far as `t` reveals it. Rows keep the fixed skill order; the REVEAL order is best grade first (ties in
 *  skill order), so the first lit pips are always the ones that say what this Moglin is for. */
export function cardOf(f: Folk, t: Trust, homeName: string): CardView {
  const skills = skillsOf(f), share = trustShare(f, t), full = share >= 1
  const n = full ? SKILLS.length : Math.floor(share * SKILLS.length)
  const order = [...SKILLS].sort((a, b) => skills[b] - skills[a] || SKILLS.indexOf(a) - SKILLS.indexOf(b))
  const lit = new Set(order.slice(0, n))
  const rows = SKILLS.map(s => ({ skill: s, label: SKILL_LABEL[s], grade: lit.has(s) ? skills[s] : null }))
  const best = rows.reduce<Grade | 0>((a, r) => (r.grade && r.grade > a ? r.grade : a), 0)
  return { name: f.name, home: homeName, trade: tradeLabel(f.profession), rows, luck: full ? luckOf(f) : null, best, shown: full ? 1 : n / SKILLS.length, full }
}

/** A Moglin already in the keeper's garden (M46 'card for recruited Moglins'): it came because it trusts the keeper, so its
 *  card is FULL. Home = the settlement name kept at recruit; an older save without one falls back (the Glade by its id). */
export const homeOfRecord = (m: Pick<MoglinRecord, 'home' | 'homeName'>): string =>
  m.homeName || (m.home === 'moonwell' ? GLADE_NAME : 'a Wilds settlement')
export function recordCard(m: MoglinRecord): CardView {
  const skills = skillsOf(m)
  const rows = SKILLS.map(s => ({ skill: s, label: SKILL_LABEL[s], grade: skills[s] }))
  const best = rows.reduce<Grade>((a, r) => (r.grade > a ? r.grade : a), 1)
  return { name: m.name, home: homeOfRecord(m), trade: tradeLabel(m.profession), rows, luck: luckOf(m), best, shown: 1, full: true }
}
