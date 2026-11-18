// The XP feed (BETA M21, Alex 11-18 "feel the levels"): every open-world XP gain is announced here ONCE, by the one
// open-world skill store (ather/forestry.ts › addOpenXp + pruneCommit), so the HUD's XP bar hears forestry,
// prospecting, rinning (both maps) and anything later routed through addOpenXp without a page edit.
// Pure: no DOM, no React. The bar (xp-bar.tsx) subscribes; tests subscribe too.
import { xpForSkillLevel, SKILL_META, type SkillId } from '../../engine/skills'

export interface XpGain {
  skill: SkillId
  name: string
  /** XP just added (after any multiplier) */
  gained: number
  /** level and XP into it AFTER the gain */
  level: number
  xp: number
  /** XP the current level needs to tick over */
  need: number
  /** the level reached, when this gain crossed one (or more) */
  leveledTo: number | null
}

const subs = new Set<(g: XpGain) => void>()
export const subscribeXp = (f: (g: XpGain) => void) => { subs.add(f); return () => { subs.delete(f) } }

/** Announce a gain. `s` is the skill AFTER engine/skills.ts › addSkillXP mutated it. */
export function emitXp(s: { id: SkillId; level: number; xp: number }, gained: number, leveled: boolean): XpGain | null {
  if (!(gained > 0)) return null
  const g: XpGain = {
    skill: s.id, name: SKILL_META[s.id]?.name ?? s.id, gained,
    level: s.level, xp: s.xp, need: xpForSkillLevel(s.level), leveledTo: leveled ? s.level : null,
  }
  subs.forEach(f => { try { f(g) } catch { /* a bad listener never blocks a gain */ } })
  return g
}

/** The bar's fill for a gain, 0..1. */
export const fillOf = (g: Pick<XpGain, 'xp' | 'need'>) => (g.need > 0 ? Math.min(1, Math.max(0, g.xp / g.need)) : 1)
