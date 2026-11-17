// THE OPEN WORLD'S MANA'MAL COMPANION (Alex 11-16: "Yes the manamal follower would be nice to have").
// Canon: game/shimmer-skilling.md › Progression + Two-Tier Companions (RULED 07-05 / 07-09): every skill grants a
// companion at TWO gates. At level 15 the LESSER companion (the old beast roster) unlocks with a weaker form of the
// skill's perk; at level 100 the TRUE Mana'mal unlocks with the strong form. Both tiers carry the SAME perk name.
//
//   skill        @15 lesser     @100 true Mana'mal   perk
//   Farming      Dustwhisker    Tuskroot             Tuberfind
//   Forestry     Drifthorn      Rootback             Grovekin
//   Prospecting  Glowmite       Gemdigger            Gemsense     (canon: "bonus ore + gem-drop chance")
//   Rinning      Embermole      Prismstrike          Truesight
//   Alchemy      Sporeling      Sporehound           Sporebloom
//
// ONE companion walks with you at a time (the Character tab picks it). Its perk only works on its own skill.
// Magnitudes are BUILD (Jin's by the boundary): lesser = beast.ts › PERK_MAX_BONUS (the old roster's number), true = double.
// The old Shimmer's happiness/hunger care loop is NOT carried over: the open world has no feeding yet, so the perk
// runs at full strength. Whether care returns here is a design call for later, not a canon one.
//
// ★ PURE but for the guarded localStorage load/save and a tiny subscribe store (as forestry.ts). Joins are noticed by
//   watching the open world's skill set (forestry.ts › subscribeForestry fires on every XP grant), so no skill's own
//   code has to remember to announce a companion.

import type { SkillId } from '../../engine/skills'
import { PERK_INFO, PERK_MAX_BONUS, type BeastPerk } from '../../beasts/beast'
import { openLevel, subscribeForestry } from '../ather/forestry'
import { gardenKey } from '@/lib/keeper-local'

export type CompanionId =
  | 'dustwhisker' | 'drifthorn' | 'glowmite' | 'embermole' | 'sporeling'
  | 'tuskroot' | 'rootback' | 'gemdigger' | 'prismstrike' | 'sporehound'

export interface CompanionDef {
  id: CompanionId
  name: string
  /** canon's look, quoted or near-quoted from world/manamals.md, shown in the Character tab */
  kind: string
  skill: SkillId
  tier: 'lesser' | 'true'
  /** the skill level that unlocks it (canon: 15 / 100) */
  level: 15 | 100
  perk: BeastPerk
}

const C = (id: CompanionId, name: string, kind: string, skill: SkillId, tier: 'lesser' | 'true', perk: BeastPerk): CompanionDef =>
  ({ id, name, kind, skill, tier, level: tier === 'lesser' ? 15 : 100, perk })

export const COMPANIONS: CompanionDef[] = [
  C('dustwhisker', 'Dustwhisker', 'a rabbit, ears twitching toward mana', 'farming', 'lesser', 'tuberfind'),
  C('tuskroot', 'Tuskroot', 'a boar, tusks aglow with earthy amber', 'farming', 'true', 'tuberfind'),
  C('drifthorn', 'Drifthorn', 'a deer, antler tips glowing faintly', 'forestry', 'lesser', 'grovekin'),
  C('rootback', 'Rootback', 'a bear, moss on its back', 'forestry', 'true', 'grovekin'),
  C('glowmite', 'Glowmite', 'a firefly, its light patterned like language', 'prospecting', 'lesser', 'gemsense'),
  C('gemdigger', 'Gemdigger', 'a prairie dog, belly pouch glinting with stones', 'prospecting', 'true', 'gemsense'),
  C('embermole', 'Embermole', 'a mole whose fur radiates warmth', 'rinning', 'lesser', 'truesight'),
  C('prismstrike', 'Prismstrike', 'plated Rinn-kin, the ancient watcher', 'rinning', 'true', 'truesight'),
  C('sporeling', 'Sporeling', 'tiny and mushroom-bodied', 'alchemy', 'lesser', 'sporebloom'),
  C('sporehound', 'Sporehound', 'a hyena, a scavenger', 'alchemy', 'true', 'sporebloom'),
]
export const companionDef = (id: CompanionId) => COMPANIONS.find(c => c.id === id)!
export const perkLabel = (c: CompanionDef) => PERK_INFO[c.perk].label

/** The perk's chance on its own skill (build magnitudes): the lesser companion's number is the old roster's. */
export const perkChance = (c: CompanionDef) => PERK_MAX_BONUS[c.perk] * (c.tier === 'true' ? 2 : 1)
/** Gemdigger's strong Gemsense also turns up a GEM now and then (canon: "bonus ore + gem-drop chance"). */
export const GEM_DROP_CHANCE = 0.06
export const GEM_ITEM = 'pure_mana_core'

/** What the companion line says about its perk, for the Character tab. */
export function perkLine(c: CompanionDef): string {
  const pct = Math.round(perkChance(c) * 100)
  const skill = c.skill[0].toUpperCase() + c.skill.slice(1)
  return `${perkLabel(c)} · ${pct}% chance of a bonus find when ${VERB[c.skill]}${c.id === 'gemdigger' ? `, and now and then a gem` : ''} (${skill})`
}
const VERB: Record<SkillId, string> = { farming: 'you harvest', forestry: 'you prune', prospecting: 'you prospect', rinning: 'you land a rinn', alchemy: 'you brew', mana: 'you channel' }

// ── state: which one walks with you, and which ones you have met ───────────────────────────────────────────────
const KEY = 'open.companion.v1'
interface Saved { active: CompanionId | null; met: CompanionId[]; sentHome: boolean }
let st: Saved = { active: null, met: [], sentHome: false }
let rev = 0
let joined: CompanionId[] = []   // met since the page last asked (for its toast)
const subs = new Set<() => void>()
const bump = () => { rev++; subs.forEach(f => f()) }
const save = () => { try { localStorage.setItem(gardenKey(KEY), JSON.stringify(st)) } catch { /* private window */ } }
export const subscribeCompanion = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const companionRev = () => rev

/** Which companions this level set has unlocked (pure: the tests hand it levels). */
export function unlockedBy(levelOf: (s: SkillId) => number): CompanionDef[] {
  return COMPANIONS.filter(c => levelOf(c.skill) >= c.level)
}

/** Meet any newly unlocked companion. The first one you ever meet starts walking with you; a TRUE Mana'mal steps in
 *  for its own skill's lesser companion if that is the one out. Returns who joined. */
export function checkJoins(levelOf: (s: SkillId) => number = openLevel): CompanionId[] {
  const fresh = unlockedBy(levelOf).filter(c => !st.met.includes(c.id))
  if (!fresh.length) return []
  for (const c of fresh) {
    st.met.push(c.id)
    const out = st.active ? companionDef(st.active) : null
    if (!st.sentHome && (!out || (c.tier === 'true' && out.skill === c.skill && out.tier === 'lesser'))) st.active = c.id
  }
  joined.push(...fresh.map(c => c.id))
  save(); bump()
  return fresh.map(c => c.id)
}
/** Who joined since the last call (the page turns it into a toast), cleared on read. */
export function takeJoined(): CompanionDef[] { const j = joined.map(companionDef); joined = []; return j }

export const metCompanions = () => st.met.map(companionDef)
export const activeCompanion = (): CompanionDef | null => (st.active ? companionDef(st.active) : null)
/** Walk with this one, or `null` to send the companion home. */
export function setCompanion(id: CompanionId | null) {
  if (id && !st.met.includes(id)) return
  st.active = id; st.sentHome = id === null
  save(); bump()
}

/** The perk roll for a skill action: true when the companion out is this skill's and its perk fires. */
export function perkFires(skill: SkillId, rand: () => number = Math.random): boolean {
  const c = activeCompanion()
  return !!c && c.skill === skill && rand() < perkChance(c)
}

/** perkFires, named: the perk's label when it fires (for the toast), else null. Grovekin (prune) and Truesight (a
 *  landed rinn) are rolled at the call site this way: forestry.ts cannot import this file (it imports forestry). */
export function perkBonus(skill: SkillId, rand: () => number = Math.random): string | null {
  return perkFires(skill, rand) ? perkLabel(activeCompanion()!) : null
}

if (typeof window !== 'undefined') {
  try {
    const s = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null')
    if (s && typeof s === 'object' && Array.isArray(s.met)) {
      const ids = new Set(COMPANIONS.map(c => c.id))
      st = { met: s.met.filter((x: CompanionId) => ids.has(x)), active: ids.has(s.active) ? s.active : null, sentHome: !!s.sentHome }
    }
  } catch { /* fresh */ }
  checkJoins()
  subscribeForestry(() => { checkJoins() })
}

/** Test hook. */
export function _resetCompanion() { st = { active: null, met: [], sentHome: false }; joined = []; bump() }
