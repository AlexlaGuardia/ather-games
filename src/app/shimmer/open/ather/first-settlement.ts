// ── THE FIRST SETTLEMENT (BETA M70 s1; plan docs/tutorial-cluster.md › The first settlement) ──────────────────────────────
// Canon: CANON/game/shimmer-quest-glade-tutorial.md › M70 (SIGNED by Alex 11-22, names rev1 Magii 846719a). Through the
// Glade's gate the keeper lands at the "The Wilds" waypoint (Greg's waymark, relief.ts ARRIVAL): the first settlement stands
// round it. The settlement keeps no name of its own. CHAMOMILE meets the keeper, BORAGE and FEVERFEW are the other settlers,
// ANGELICA the alchemist (her side quest is s3: she stands, no talk yet). GLEANER's stall (M112) is part of it.
// Lamps stand along the paths, unlit while the big one (ather/champion.ts, the nearest infected node's champion) stands.
// Lamps Out: Chamomile's arrival talk opens it and picks the node; its champion down -> lamps lit; Chamomile's thanks hand
// the potions + the starter pack ONCE (the tutorial's gift guard, saved before the bag is told) -> quest.m70.after.
// Jin's (build): the spots, the lamp count, which speaker answers when, the pack's contents.
// ★ PURE. Every line comes from glade-tutorial-lines.ts (generated from the signed canon file) by id.
import type { TalkNode } from '../shared/npc-talk'
import { ANSWERS } from './greg-talk'
import { line, GLADE_LINES } from './glade-tutorial-lines'
import { gift, type Tut } from './glade-tutorial'
import { potionId } from './alchemy-set'
import { seedId } from './farming'

/** The settlement's middle = the arrival (relief.ts ARRIVAL / waymarks.ts GREG_WAYMARK, first-wilds, world = tile coords). */
export const SETTLEMENT = { x: -300, z: 300, r: 24 } as const
export type SettlerId = 'chamomile' | 'borage' | 'feverfew' | 'angelica'
export interface SettlerSpot { id: SettlerId; name: string; x: number; z: number; yaw: number; talks: boolean }
const face = (x: number, z: number) => Math.atan2(SETTLEMENT.x - x, SETTLEMENT.z - z)
const spot = (id: SettlerId, name: string, x: number, z: number, talks = true): SettlerSpot => ({ id, name, x, z, yaw: face(x, z), talks })
/** Chamomile stands where the keeper lands (a few steps off the arrival); the others round the middle. */
export const SETTLERS: readonly SettlerSpot[] = [
  spot('chamomile', 'Chamomile', -296, 296),
  spot('borage', 'Borage', -309, 293),
  spot('feverfew', 'Feverfew', -307, 309),
  spot('angelica', 'Angelica', -291, 310, false),   // s3: the alchemist's side quest
]
export const settlerAt = (id: SettlerId) => SETTLERS.find(s => s.id === id)!
/** canon speaker name -> who stands there (a bark is spoken by its canon speaker, over their head) */
export const speakerOf = (lineId: string): SettlerSpot => SETTLERS.find(s => s.name === GLADE_LINES[lineId]?.who) ?? settlerAt('chamomile')
/** Lamps along the two paths out of the middle (pairs, one each side). */
export const LAMPS: readonly { x: number; z: number }[] = [6, 12, 18].flatMap(d => [
  { x: SETTLEMENT.x + d * 0.71 + 1.6, z: SETTLEMENT.z - d * 0.71 + 1.6 }, { x: SETTLEMENT.x + d * 0.71 - 1.6, z: SETTLEMENT.z - d * 0.71 - 1.6 },
  { x: SETTLEMENT.x - d * 0.71 + 1.6, z: SETTLEMENT.z + d * 0.71 + 1.6 }, { x: SETTLEMENT.x - d * 0.71 - 1.6, z: SETTLEMENT.z + d * 0.71 - 1.6 },
])
export const inSettlement = (x: number, z: number) => Math.hypot(x - SETTLEMENT.x, z - SETTLEMENT.z) < SETTLEMENT.r
/** Lamps burn once the big one is down. */
export const lampsLit = (t: Tut) => t.m70 === 'down' || t.m70 === 'thanked'

// ── the quest ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** The big one: the nearest infected node to the settlement (picked when Chamomile asks, kept in the save). */
export function pickTarget<N extends { id: string; x: number; z: number }>(infected: readonly N[]): N | null {
  let best: N | null = null, bd = Infinity
  for (const n of infected) { const d = Math.hypot(n.x - SETTLEMENT.x, n.z - SETTLEMENT.z); if (d < bd) { bd = d; best = n } }
  return best
}
export const acceptM70 = (t: Tut, node: string | null): Tut => (t.m70 !== 'none' ? t : { ...t, m70: 'open', m70node: node })
/** A champion went down. The quest's own node (or any, if none was picked) moves it to 'down'. */
export function m70Down(t: Tut, nodeId: string): Tut {
  if (t.m70 !== 'open') return t
  return t.m70node && t.m70node !== nodeId ? t : { ...t, m70: 'down' }
}
/** The journal's entry: title + step ids. null = nothing to show. */
export function m70Quest(t: Tut): { title: string; step: string } | null {
  if (t.m70 === 'open') return { title: 'quest.m70.title', step: 'quest.m70.step' }
  if (t.m70 === 'down') return { title: 'quest.m70.title', step: 'quest.m70.done' }
  if (t.m70 === 'thanked') return { title: 'quest.m70.after', step: 'quest.m70.after' }   // canon: its own quest-log line, not a Lamps Out step
  return null
}

// ── the gift (hub call 11-23: potions = the game's basic Health Draught; the pack = what the next hour needs) ──────
export const M70_POTIONS = { id: potionId('health', 'D'), n: 3 } as const
export const M70_PACK: readonly { id: string; n: number }[] = [
  { id: 'goldwood_plank', n: 10 }, { id: 'stone_brick', n: 8 },
  { id: seedId('goldleaf'), n: 2 }, { id: seedId('ather_wheat'), n: 2 }, { id: seedId('dewdrop_vine'), n: 2 },
  { id: 'bait', n: 10 },
]
export const M70_GIFT = [M70_POTIONS, ...M70_PACK]

// ── talk ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export type SettlerMode = 'arrive' | 'thanks' | 'bark'
/** `mode` + `script` are decided ONCE at open (what is heard never swaps the script under the bubble). */
export interface SettlerCursor { who: SettlerId; mode: SettlerMode; script: string[]; i: number }
export function settlerStart(t: Tut, who: SettlerId): SettlerCursor | null {
  if (who === 'angelica') return null
  if (who === 'chamomile') {
    if (t.m70 === 'none') return { who, mode: 'arrive', script: ['settler.arrive.1', 'settler.arrive.2', 'settler.arrive.3', 'settler.arrive.4', 'settler.go'], i: 0 }
    if (t.m70 === 'down') return { who, mode: 'thanks', script: ['settler.thanks.1', 'settler.thanks.2', 'settler.thanks.3', 'settler.thanks.4', 'settler.thanks.5'], i: 0 }
    return { who, mode: 'bark', script: [t.m70 === 'open' ? 'settler.go' : 'settler.after.bark'], i: 0 }
  }
  const stands = t.m70 === 'none' || t.m70 === 'open'
  return { who, mode: 'bark', script: [stands ? (who === 'borage' ? 'settler.bark.open' : 'settler.bark.tired') : 'settler.after.bark'], i: 0 }
}
/** where the arrival's choice sits (after .4, before settler.go) */
export const ARRIVE_CHOICE_AT = 3
/** the thanks' gift is handed on the way from .2 to .3 (the bottles and the bundle) */
export const THANKS_GIFT_AT = 2
export const SETTLER_BYE = 'See you.'   // ★ SIGNED athernyx 1be3a9f: shimmer-lines-batch-2026-11-24a.md › B (lines-batch-24a.test.ts)

export interface SettlerActs {
  set: (t: Tut) => void
  go: (i: number | null) => void
  /** the infected node to aim the quest at (pickTarget over the live nodes) */
  target: () => string | null
  /** hand the potions + pack; false = the bag could not take it all (nothing handed) */
  give: () => boolean
}
export function settlerNode(t: Tut, c: SettlerCursor, act: SettlerActs): TalkNode {
  const k = Math.min(c.i, c.script.length - 1), id = c.script[k]
  if (k === c.script.length - 1) return { line: line(id), options: [{ label: SETTLER_BYE, pick: () => act.go(null) }] }
  if (c.mode === 'arrive' && k === ARRIVE_CHOICE_AT) return { line: line(id), options: [{ label: line('settler.choice.go'), pick: () => { act.set(acceptM70(t, act.target())); act.go(k + 1) } }] }
  if (c.mode === 'thanks' && k === THANKS_GIFT_AT - 1) return { line: line(id), options: [{ label: ANSWERS.more, pick: () => thank(t, act, k + 1) }] }
  return { line: line(id), options: [{ label: ANSWERS.more, pick: () => act.go(k + 1) }] }
}
/** once: the gift guard is checked and recorded with the state, so a reload (or a second talk) never hands it twice */
function thank(t: Tut, act: SettlerActs, next: number) {
  const g = gift(t, 'm70pack')
  if (g.fresh && !act.give()) { act.go(null); return }
  act.set({ ...g.t, m70: 'thanked' })
  act.go(next)
}
