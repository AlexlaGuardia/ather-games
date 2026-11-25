// ── GLEANER + THE BURRFOLK CAMP (BETA M112 s2) ───────────────────────────────────────────────────────────────────────────
// Canon: CANON/game/shimmer-folds-settlements.md › THE BURRFOLK (RULED 2026-11-23): Gleaner = the Burrfolk at the FIRST
// settlement (the Glade-tutorial settlement, Angelica's) and points the keeper to the camp; the camp = the Burrfolk's home
// ground in the Wilds (its place + layout + stock = Jin's). Lines: batch 11-23b › D1-D4, SIGNED (Alex), the MAIN text, word for
// word; stall + camp = batch 11-25b › A (dewls, SIGNED 0c9415c) (gleaner.test.ts reads the canon file).
// ★ Magii #16993 (11-23): players meet Gleaner only when M70 (the first settlement) ships. M70 s1 shipped it: GLEANER_POST is
//   the stall in the first settlement round the arrival (first-settlement.ts), on for every keeper. The camp is for everyone.
// ★ Canon gives Gleaner no pronoun yet: keep every build text and comment here pronoun-free.
// PURE: folk-talk.ts arranges nothing here; use-folk-talk.tsx applies the sale; network-scene.tsx draws the post + the camp.
import type { Settlement } from './network'
import type { WareKey, Burrfolk } from './burrfolk'
import type { TalkNode } from '../shared/npc-talk'

export const GLEANER_NAME = 'Gleaner'
/** ★ SIGNED: batch 11-23b › D1-D4 (MAIN); stall + camp = 11-25b › A (MAIN). */
export const GLEANER_LINES = {
  greet: 'Mind the pack. Everything in it has been somewhere.',
  greetRepeat: "Back again. Good. Odds don't sell themselves.",
  stall: 'Odds and ends. No coin here, only dewls.',
  stallEmpty: 'Picked clean for now. Come by again.',
  camp: "If you want the odd finds, our camp's out in the Wilds. All of us gather there, so bring dewls.",
  campRepeat: 'Our camp, out in the Wilds. Go and see.',
  ask: 'My stall stays and so do I. Feet were never my trade.',
} as const
/** ★ SIGNED: D1's two answers */
export const GLEANER_ASK = { have: 'What have you got?', look: 'Just looking.' } as const

/** Owner-only test post (Magii #16993): beside the keeper's arrival from the Glade's gate (relief.ts ARRIVAL, Greg's waymark),
 *  on the old Glade footprint's void-free ground. Not in the season's network: no folk, no map dot, no road. */
export const GLEANER_POST: Settlement = { id: 'gleaner-post', name: GLEANER_NAME, x: -286, z: 286, biome: 'meadow' }
/** how near the keeper must be for E to reach the post */
export const GLEANER_POST_R = 12
/** the stock: the meadow's own trade, then the carpenter's (Jin's pick; the first settlement's real stock waits on M70) */
export const GLEANER_STOCK: readonly WareKey[] = ['saptapper', 'carpenter']
export const gleanerOf = (): Burrfolk => ({ id: 'burr:gleaner', name: GLEANER_NAME, home: GLEANER_POST.id, stock: [...GLEANER_STOCK] })
export const isGleaner = (id: string | undefined) => id === 'burr:gleaner'

/** THE BURRFOLK CAMP, out in the Wilds on the Glade side: ~130 m north of the arrival, in the arrival's own region (no void to
 *  cross: gleaner.test.ts), on land. Three stalls round a heap of packs. Label = canon's word for it, no name of its own. */
export const BURR_CAMP = { x: -300, z: 170, r: 14 } as const
export const CAMP_LABEL = 'Burrfolk camp'
/** the camp's stalls, world spots facing the middle */
export function campStalls(): { id: string; x: number; z: number; yaw: number }[] {
  return [0, 1, 2].map(k => {
    const a = (k / 3) * Math.PI * 2 + 0.4, x = BURR_CAMP.x + Math.sin(a) * 9, z = BURR_CAMP.z + Math.cos(a) * 9
    return { id: `burr:camp:${k}`, x, z, yaw: Math.atan2(BURR_CAMP.x - x, BURR_CAMP.z - z) }
  })
}

/** What Gleaner remembers of this keeper, this visit (per page, as the Glade's folk: a reload starts fresh). */
export interface GleanerMem { buys: number; campTold: boolean }
export const gleanerMem: GleanerMem = { buys: 0, campTold: false }
export const _resetGleaner = () => { gleanerMem.buys = 0; gleanerMem.campTold = false }

export type GleanerScreen = 'hello' | 'stall' | 'said'
export interface GleanerActs { go: (screen: GleanerScreen, line?: string) => void; buy: (k: WareKey) => void; bye: () => void }
/** One talk node. `rep` = hellos heard before this one. The camp line plays once: on the second visit's hello, or straight
 *  after the first purchase (canon D3 trigger), whichever comes first; after that, the repeat bark is the leave line. */
export function gleanerTalk(b: Burrfolk, screen: GleanerScreen, line: string | undefined, rep: number, mem: GleanerMem, act: GleanerActs, labels: { swap: (k: WareKey) => string; back: string; bye: string; room: string }): TalkNode {
  const bye = { label: labels.bye, pick: act.bye }
  const back = { label: labels.back, pick: () => act.go('hello') }
  if (screen === 'stall') {
    if (!b.stock.length) return { line: GLEANER_LINES.stallEmpty, options: [back, bye] }
    return { line: GLEANER_LINES.stall, options: [...b.stock.map(k => ({ label: labels.swap(k), pick: () => act.buy(k) })), back, bye] }
  }
  if (screen === 'said') return { line: line ?? GLEANER_LINES.greetRepeat, options: [back, bye] }
  // building the node never changes `mem` (the hook may rebuild it): the camp counts as told once an answer is picked
  const campNow = rep > 0 && !mem.campTold, told = (f: () => void) => () => { if (campNow) mem.campTold = true; f() }
  const hello = campNow ? GLEANER_LINES.camp : rep > 0 ? GLEANER_LINES.greetRepeat : GLEANER_LINES.greet
  return { line: hello, options: [
    { label: GLEANER_ASK.have, pick: told(() => act.go('stall')) },
    { label: labels.room, pick: told(() => act.go('said', GLEANER_LINES.ask)) },   // D4: the Moglin invite option
    { label: GLEANER_ASK.look, pick: told(act.bye) },
  ] }
}
/** after a sale went through: the first one tells of the camp (once) */
export function afterBuy(mem: GleanerMem): string | null {
  mem.buys++
  if (mem.campTold) return null
  mem.campTold = true; return GLEANER_LINES.camp
}
/** the line Gleaner calls after the keeper as they leave: the camp bark once the camp is told */
export const gleanerLeave = (mem: GleanerMem): string | null => (mem.campTold ? GLEANER_LINES.campRepeat : null)
