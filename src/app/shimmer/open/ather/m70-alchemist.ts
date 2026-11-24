// ── A PROPER BATCH: ANGELICA'S SIDE QUEST (BETA M70 s3; plan docs/tutorial-cluster.md › The first settlement) ──────────────
// Canon: CANON/game/shimmer-quest-glade-tutorial.md › alchemist.side (SIGNED, Alex 11-22; names rev1 Magii 846719a). Talk to
// Angelica after Chamomile's thanks: the offer, 'Show me.' / 'Later.', the open bark, the reward lines, the quest log's title
// and done line. Guard (canon): Angelica teaches and brews for her own folk; she NEVER brews or buys FOR the keeper. So the
// keeper gathers, the keeper's own hands brew at her Desk, and the keeper hands her the bottle (for her folk).
// ⚖ Jin's (canon gap #3, the build's): THE STEPS = 3, using what the game already has:
//   1 gather  — the raw makings of the game's first recipe, the Health Draught (alchemy-set.ts › health, canon's first recipe:
//               Shimmerscale from the shore + Goldleaf and Dewdrop Vine grown from the settlers' own seed bundle)
//   2 brew    — at Angelica's Desk (an Alchemy Desk standing by her), the whole chain in the keeper's hands, graded as usual
//   3 hand    — give her one of the bottles
// The SET = every alchemy station the furniture table defines (FURNITURE[*].alc), Desk first ("Desk first, always").
// Step text + the Desk's labels are PLACEHOLDERS (canon marks them [GAP: step text]) for @lark: M70SIDE_TEXT below.
// ★ PURE. Every signed line comes from glade-tutorial-lines.ts (generated from the canon file) by id.
import type { TalkNode } from '../shared/npc-talk'
import { ANSWERS } from './greg-talk'
import { line } from './glade-tutorial-lines'
import { gift, type Tut, type M70Side } from './glade-tutorial'
import { ALC_POTIONS, ALC_ORDER, pickFor, stepMakes, gradeOf, gradeScore, type Have } from './alchemy-set'
import { FURNITURE } from './furniture'
import { settlerAt, SETTLER_BYE } from './first-settlement'

/** the batch Angelica teaches: the first recipe */
export const M70_BATCH = 'health'
/** what the batch takes from the bag: every slot of its chain that is not an earlier step's product */
export const BATCH_NEEDS: readonly { id: string; n: number }[] = (() => {
  const m = new Map<string, number>()
  for (const s of ALC_POTIONS[M70_BATCH].steps) for (const x of s.in) if (!x.id.startsWith('alc:')) m.set(x.id, (m.get(x.id) ?? 0) + x.n)
  return [...m].map(([id, n]) => ({ id, n }))
})()
/** the basic alchemy set: every station the furniture table defines, Desk first, then the chain's order */
export const ALC_SET_ITEMS: readonly string[] = Object.keys(FURNITURE).filter(id => FURNITURE[id].alc)
  .sort((a, b) => { const r = (id: string) => (FURNITURE[id].alc === 'desk' ? -1 : ALC_ORDER.indexOf(FURNITURE[id].alc!)); return r(a) - r(b) })

/** Angelica's Desk: beside her, on her right hand, facing the middle with her. */
export const ANGELICA_DESK = (() => {
  const a = settlerAt('angelica'), fx = Math.sin(a.yaw), fz = Math.cos(a.yaw)
  return { x: a.x - fz * 1.6, z: a.z + fx * 1.6, yaw: a.yaw, r: 2.6 }
})()

// ── the batch ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** how many of a slot the bag holds (a graded slot `crop:x` counts every grade of it) */
export const holding = (have: Have, id: string) => Object.keys(have).reduce((a, k) => a + ((k === id && !id.startsWith('crop:')) || (id.includes(':') && k.startsWith(id + ':')) ? have[k] : 0), 0)
export const batchReady = (have: Have) => BATCH_NEEDS.every(x => holding(have, x.id) >= x.n)
/** Run the chain in the keeper's hands: what it spends and the bottles it pours. Null when the bag cannot. */
export function brewBatch(have: Have): { spend: { id: string; n: number }[]; make: { id: string; n: number } } | null {
  const h: Record<string, number> = { ...have }, spend: { id: string; n: number }[] = []
  const steps = ALC_POTIONS[M70_BATCH].steps
  let make: { id: string; n: number } | null = null
  for (let k = 0; k < steps.length; k++) {
    const used = pickFor(steps[k], h)
    if (!used) return null
    for (const u of used) { h[u.id] -= u.n; if (!u.id.startsWith('alc:')) spend.push(u) }
    const out = stepMakes(M70_BATCH, k, used)
    if (k === steps.length - 1) make = out
    else h[out.id] = (h[out.id] ?? 0) + out.n
  }
  return make && { spend, make }
}
/** a Health Draught in the bag to hand over (her keeper's worst bottle: the best stay with the keeper) */
export function bottleToHand(have: Have): string | null {
  const ids = Object.keys(have).filter(id => have[id] > 0 && id.startsWith(`potion:${M70_BATCH}:`) && gradeOf(id))
  ids.sort((a, b) => gradeScore(gradeOf(a)!) - gradeScore(gradeOf(b)!))
  return ids[0] ?? null
}

// ── the quest ──────────────────────────────────────────────────────────────────────────────────────────────────────
export type SideStep = 'gather' | 'brew' | 'hand'
/** Angelica talks once Lamps Out is thanked, until her batch is done. */
export const angelicaTalks = (t: Tut) => t.m70 === 'thanked' && t.m70side !== 'done'
/** the Desk works for the keeper while the batch is open (and after brewing, so a drunk bottle can be brewed again) */
export const deskOpen = (t: Tut) => t.m70side === 'open' || t.m70side === 'brewed'
export const sideStep = (t: Tut, have: Have): SideStep | null =>
  t.m70side === 'open' ? (batchReady(have) ? 'brew' : 'gather') : t.m70side === 'brewed' ? 'hand' : null
/** The desk brewed: the quest moves to the hand-over (once open; never backwards). */
export const brewed = (t: Tut): Tut => (t.m70side === 'open' ? { ...t, m70side: 'brewed' } : t)

/** PLACEHOLDER texts (@lark; canon: [GAP: step text]). Names come from the game's own tables. */
export const M70SIDE_TEXT = {
  gather: (name: (id: string) => string) => `Gather ${BATCH_NEEDS.map(x => `${x.n} ${name(x.id)}`).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`,
  brew: `Brew a ${ALC_POTIONS[M70_BATCH].name} at Angelica's Desk.`,
  hand: `Give Angelica a ${ALC_POTIONS[M70_BATCH].name}.`,
  handLabel: `Give her the ${ALC_POTIONS[M70_BATCH].name}.`,
  deskTitle: "Angelica's Desk",
  deskBrew: `Brew a ${ALC_POTIONS[M70_BATCH].name}`,
  deskNeed: 'You need:',
  bagFull: 'Your bag is full. Make room for the stations.',
} as const
/** The journal entry: title + note (already words). null = nothing to show. */
export function sideQuest(t: Tut, have: Have, name: (id: string) => string): { title: string; note: string; step: SideStep | 'done' } | null {
  if (t.m70side === 'done') return { title: line('quest.m70side.title'), note: line('quest.m70side.done'), step: 'done' }
  const s = sideStep(t, have)
  if (!s) return null
  return { title: line('quest.m70side.title'), note: s === 'gather' ? M70SIDE_TEXT.gather(name) : M70SIDE_TEXT[s], step: s }
}

// ── talk ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export type AngelicaMode = 'offer' | 'bark' | 'hand'
export interface AngelicaCursor { who: 'angelica'; mode: AngelicaMode; script: string[]; i: number }
export const OFFER_SCRIPT = ['alchemist.offer.1', 'alchemist.offer.2', 'alchemist.yes', 'alchemist.no']
export const HAND_SCRIPT = ['alchemist.bark.open', 'alchemist.reward.1', 'alchemist.reward.2', 'alchemist.reward.3']
/** `holds` = a bottle is in the bag to hand over. Null = she has nothing to say. */
export function angelicaStart(t: Tut, holds: boolean): AngelicaCursor | null {
  if (!angelicaTalks(t)) return null
  if (t.m70side === 'none' || t.m70side === 'later') return { who: 'angelica', mode: 'offer', script: OFFER_SCRIPT, i: 0 }
  if (t.m70side === 'brewed' && holds) return { who: 'angelica', mode: 'hand', script: HAND_SCRIPT, i: 0 }
  return { who: 'angelica', mode: 'bark', script: ['alchemist.bark.open'], i: 0 }
}
export interface AngelicaActs {
  set: (t: Tut) => void
  go: (i: number | null) => void
  /** take one bottle and hand the set; false = nothing handed (no bottle, or the bag could not take the set) */
  hand: (withSet: boolean) => boolean
}
export function angelicaNode(t: Tut, c: AngelicaCursor, act: AngelicaActs): TalkNode {
  const k = Math.min(c.i, c.script.length - 1), id = c.script[k], bye = { label: SETTLER_BYE, pick: () => act.go(null) }
  if (c.mode === 'bark') return { line: line(id), options: [bye] }
  if (c.mode === 'offer') {
    if (k === 0) return { line: line(id), options: [{ label: ANSWERS.more, pick: () => act.go(1) }] }
    if (k === 1) return { line: line(id), options: [
      { label: line('alchemist.choice.yes'), pick: () => { act.set({ ...t, m70side: 'open' }); act.go(2) } },
      { label: line('alchemist.choice.no'), pick: () => { act.set({ ...t, m70side: 'later' }); act.go(3) } },
    ] }
    return { line: line(id), options: [bye] }
  }
  // hand
  if (k === 0) return { line: line(id), options: [{ label: M70SIDE_TEXT.handLabel, pick: () => handOver(t, act) }, bye] }
  if (k === c.script.length - 1) return { line: line(id), options: [bye] }
  return { line: line(id), options: [{ label: ANSWERS.more, pick: () => act.go(k + 1) }] }
}
/** once: the set's gift guard is checked and saved with the state, so a reload (or a second talk) never hands it twice */
function handOver(t: Tut, act: AngelicaActs) {
  if (t.m70side !== 'brewed') { act.go(null); return }
  const g = gift(t, 'm70set')
  if (!act.hand(g.fresh)) { act.go(null); return }
  act.set({ ...g.t, m70side: 'done' })
  act.go(1)
}
