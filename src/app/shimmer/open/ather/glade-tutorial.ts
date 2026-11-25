// M68 s1: THE GLADE TUTORIAL'S STATE (plan Beat 1 + the gardens table + Beat 2). Lines: athernyx
// CANON/game/shimmer-quest-glade-tutorial.md rev1 (SIGNED), wired by id through glade-tutorial-lines.ts. Rulings (Magii 846719a):
// Greg's Spirits branch hands the GRIMOIRE; tool sockets start EMPTY, Otto lights the spike, Bonn the pruner; Tess gives the
// starter seeds with ONE random grade-A; Fennel starts the signed first-rinstick quest (never hands a stick) and gives bait,
// then ~25 a day from the jar. Beat 2 (the gate ask) opens only once all four are heard.
// Jin's: the order of screens, the jar size, which seed turns grade-A, the save shape.
//
// ★ PURE but for the guarded load/save. One reducer per thing that happens; every gift goes through `gift`, which says
//   whether it is FRESH, so a reload (or a second talk) can never hand anything twice.
import { gardenKey } from '@/lib/keeper-local'
import { seedId, type CropId } from './farming'

export type Friend = 'otto' | 'tess' | 'bonn' | 'fennel'
export const FRIENDS: readonly Friend[] = ['otto', 'tess', 'bonn', 'fennel']
/** M155: the four Moglins of the guided tour who are not friends (Fennel is both) */
export type Guide = 'hazel' | 'sax' | 'yarrow' | 'mallow'
export const GUIDES: readonly Guide[] = ['hazel', 'sax', 'yarrow', 'mallow']
/** whose garden a guide lives in: that friend sends you, so a guide's tour talk waits for them */
export const GUIDE_OF: Readonly<Record<Guide, Friend>> = { hazel: 'bonn', sax: 'otto', yarrow: 'tess', mallow: 'tess' }
export type Stop = Friend | Guide
/** Alex's order (11-25): Greg, then these, then Greg again */
export const TOUR: readonly Stop[] = ['bonn', 'hazel', 'otto', 'sax', 'tess', 'yarrow', 'mallow', 'fennel']
export type Gift = 'grimoire' | 'spike' | 'pruner' | 'seeds' | 'bait' | 'rinquest' | 'm70pack' | 'm70set'
/** the Glade's gifts (a legacy keeper counts these as given); M70's pack is the settlement's, every keeper earns it */
export const GIFTS: readonly Gift[] = ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest']
const GIFT_IDS: readonly Gift[] = [...GIFTS, 'm70pack', 'm70set']
export type Beat2 = 'none' | 'asked' | 'accepted'
/** M70 s1 (first-settlement.ts): Lamps Out. none = not told · open = Chamomile asked (the big one stands) · down = it fell ·
 *  thanked = Chamomile's thanks heard and the gift handed (once). */
export type M70 = 'none' | 'open' | 'down' | 'thanked'
const M70S: readonly M70[] = ['none', 'open', 'down', 'thanked']
/** M70 s3 (m70-alchemist.ts): A Proper Batch. none = not offered · later = 'Later.' · open = 'Show me.' · brewed = a batch
 *  brewed at Angelica's Desk · done = the bottle handed and the alchemy set given (once, gift 'm70set'). */
export type M70Side = 'none' | 'later' | 'open' | 'brewed' | 'done'
const M70SIDES: readonly M70Side[] = ['none', 'later', 'open', 'brewed', 'done']
export interface Tut {
  v: 1
  /** false = a keeper born before the tutorial existed: everything reads as done, nothing is re-gifted */
  live: boolean
  greg: { welcome: boolean; moglins: boolean; spirits: boolean; wilds: boolean }
  heard: Friend[]
  /** M155: the tour's Moglins met. ABSENT = a save from the old any-order flow (or before Greg sends you): metOf() reads it */
  met?: Guide[]
  gifts: Gift[]
  b2: Beat2
  /** the in-game day Fennel's jar was last emptied by this keeper (null = never) */
  baitDay: number | null
  /** M70 s1: the first settlement's quest + the node its big one guards (picked when Chamomile asks) */
  m70: M70
  m70node: string | null
  /** M70 s3: Angelica's side quest */
  m70side: M70Side
  /** M71 s1 (garden-fold.ts): Greg has folded this keeper's first garden. false only for a keeper born after M71 who has not
   *  paid him yet; every save from before M71 (no field) and every legacy keeper reads true: an existing garden is never taken. */
  folded: boolean
  /** M146: First Steps ended (back at Greg after the settlement's thanks). Absent on every save from before it: firstStepsOn. */
  fs?: 'done'
}
export const freshTut = (): Tut => ({ v: 1, live: true, greg: { welcome: false, moglins: false, spirits: false, wilds: false }, heard: [], gifts: [], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: false })
/** What an older save becomes: the whole tutorial done, every gift counted as given (they already hold their tools). */
export const legacyTut = (): Tut => ({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [...FRIENDS], gifts: [...GIFTS], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true })

// ── Greg ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Which screen Greg opens on. `hub` lists the open choices (The Wilds? only once Moglins? and Spirits? are both heard). */
export type GregScreen =
  | { kind: 'welcome' }
  | { kind: 'hub'; choices: ('a' | 'b' | 'c')[]; back: boolean }
  | { kind: 'pending' }          // greg.b1.bark.pending: a stop of the tour is left
  | { kind: 'ask' }              // greg.b2.ask: the tour is walked, the gate favour
  | { kind: 'open' }             // greg.b2.bark.open: the favour accepted, not yet done
export function gregScreen(t: Tut): GregScreen {
  const g = t.greg
  if (!g.welcome) return { kind: 'welcome' }
  if (!g.wilds) {
    const choices: ('a' | 'b' | 'c')[] = []
    if (!g.moglins) choices.push('a')
    if (!g.spirits) choices.push('b')
    if (g.moglins && g.spirits) choices.push('c')
    return { kind: 'hub', choices, back: true }
  }
  if (!tourDone(t)) return { kind: 'pending' }
  return t.b2 === 'accepted' ? { kind: 'open' } : { kind: 'ask' }
}
export const heardWelcome = (t: Tut): Tut => (t.greg.welcome ? t : { ...t, greg: { ...t.greg, welcome: true } })
export const heardMoglins = (t: Tut): Tut => (t.greg.moglins ? t : { ...t, greg: { ...t.greg, moglins: true } })
/** Spirits? hands over the grimoire on `.3`: the caller gives it when `gift(t, 'grimoire')` says fresh. */
export const heardSpirits = (t: Tut): Tut => (t.greg.spirits ? t : { ...t, greg: { ...t.greg, spirits: true } })
export function heardWilds(t: Tut): Tut {
  if (t.greg.wilds || !(t.greg.moglins && t.greg.spirits)) return t
  return { ...t, greg: { ...t.greg, wilds: true }, met: metOf(t) }
}
/** M146: FIRST STEPS is still on: nothing else opens until it is done. A legacy keeper, and any keeper with a garden (folded:
 *  Greg folds only after the settlement, and every save from before M71 reads folded), is past it, so old saves never change. */
export const firstStepsOn = (t: Tut) => t.live && !t.folded && t.fs !== 'done'
/** E at Greg after the settlement's thanks ends it. */
export const endFirstSteps = (t: Tut): Tut => (firstStepsOn(t) && t.m70 === 'thanked' ? { ...t, fs: 'done' } : t)
export const answerGate = (t: Tut, go: boolean): Tut => (!tourDone(t) || t.b2 === 'accepted' ? t : { ...t, b2: go ? 'accepted' : 'asked' })

// ── the four ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const allHeard = (t: Tut) => FRIENDS.every(f => t.heard.includes(f))
/** A friend's talk counts once Greg has sent you (`.wilds`); before that they still talk, but the quest does not tick. */
export function hearFriend(t: Tut, f: Friend): Tut {
  if (!t.greg.wilds || t.heard.includes(f)) return t
  return { ...t, heard: [...t.heard, f], met: metOf(t) }   // M155: an old save's Moglins are settled BEFORE this friend joins
}
// ── M155: THE GUIDED TOUR (Alex 11-25) ───────────────────────────────────────────────────────────────────────────
// One stop at a time in TOUR's order, but a keeper who walks up to someone early is heard all the same and the marker passes over
// them: nothing is lost and nobody is stuck. Only First Steps asks for the guides; after it (the skip path) the four friends are all
// Greg ever waits for, as before.
/** The guides met. A save with no record is from the old flow: the Moglins of a friend already heard there are behind them. */
export const metOf = (t: Tut): Guide[] => t.met ?? GUIDES.filter(g => t.greg.wilds && t.heard.includes(GUIDE_OF[g]))
const isGuide = (s: Stop): s is Guide => (GUIDES as readonly string[]).includes(s)
export const stopDone = (t: Tut, s: Stop) => isGuide(s) ? metOf(t).includes(s) : t.heard.includes(s)
/** Where the marker is: the first stop not done, or null (back to Greg). */
export const tourStop = (t: Tut): Stop | null => TOUR.find(s => !stopDone(t, s)) ?? null
export const tourDone = (t: Tut) => (firstStepsOn(t) ? tourStop(t) === null : allHeard(t))
/** A guide's tour talk is due: their friend has sent you, First Steps is on, and they have not had it. */
export const guideDue = (t: Tut, g: Guide) => firstStepsOn(t) && t.greg.wilds && t.heard.includes(GUIDE_OF[g]) && !metOf(t).includes(g)
export const meetGuide = (t: Tut, g: Guide): Tut => (guideDue(t, g) ? { ...t, met: [...metOf(t), g] } : t)
/** The old Greg tour (M32) is this one now: a keeper who has walked it is taken straight to the planning table (its end). */
export const walkedTour = (t: Tut) => t.live && t.fs === 'done' && tourStop(t) === null
/** A friend's first talk after Greg sent you = greet + gift; any later talk = their bark. */
export const friendScreen = (t: Tut, f: Friend): 'greet' | 'bark' => (t.heard.includes(f) ? 'bark' : 'greet')
/** M68 s3b: a tutorial keeper who has not yet had Fennel's first talk: the first-rinstick quest waits for HER (the Rinnshop
 *  standing does not start it) and the farm room's starter packet is not given (Tess's packet is the one source; hub #16510). */
export const fennelInGlade = (t: Tut) => t.live && !t.heard.includes('fennel')
/** Hub #16510: the farm room's starter packet is off for every live tutorial keeper; legacy keepers unchanged. */
export const farmStarterOn = (t: Tut) => !t.live
/** The friend's gift, by the gardens table. */
export const GIFT_OF: Readonly<Record<Friend, Gift>> = { otto: 'spike', bonn: 'pruner', tess: 'seeds', fennel: 'rinquest' }
/** Give once: `fresh` false = already given (reload, a second talk, a legacy save). */
export function gift(t: Tut, g: Gift): { t: Tut; fresh: boolean } {
  if (t.gifts.includes(g)) return { t, fresh: false }
  return { t: { ...t, gifts: [...t.gifts, g] }, fresh: true }
}

/** Tool sockets start EMPTY for a live tutorial keeper (Magii 846719a): the worn spike is lit by Otto, the worn pruner by Bonn.
 *  A legacy keeper (born before the tutorial) keeps theirs. Read by rinsticks.ts › loadTools; only BASIC tools are ever held back. */
export const socketLit = (t: Tut, skill: 'forestry' | 'prospecting') => !t.live || t.gifts.includes(skill === 'forestry' ? 'pruner' : 'spike')

// ── Tess: the starter seeds, one of them grade-A ─────────────────────────────────────────────────────────────────
export const TESS_SEEDS: readonly { crop: CropId; n: number }[] = [{ crop: 'goldleaf', n: 3 }, { crop: 'ather_wheat', n: 3 }, { crop: 'dewdrop_vine', n: 2 }]
/** The packet as bag stacks: `roll` in [0,1) picks which ONE seed of the eight is grade-A ("I won't say which"). */
export function tessPacket(roll: number): { id: string; n: number }[] {
  const total = TESS_SEEDS.reduce((a, s) => a + s.n, 0)
  let k = Math.min(total - 1, Math.floor(Math.max(0, roll) * total))
  const out: { id: string; n: number }[] = []
  for (const s of TESS_SEEDS) {
    const a = k >= 0 && k < s.n ? 1 : 0
    k -= s.n
    if (s.n - a > 0) out.push({ id: seedId(s.crop), n: s.n - a })
    if (a) out.push({ id: seedId(s.crop, 'A'), n: 1 })
  }
  return out
}

// ── Fennel's jar ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Bait in the jar each in-game day (the row's ~25). Dial. */
export const JAR_BAIT = 25
/** Emptying the jar: the day's bait once per in-game day. */
export function claimJar(t: Tut, day: number): { t: Tut; bait: number } {
  if (t.baitDay === day) return { t, bait: 0 }
  return { t: { ...t, baitDay: day }, bait: JAR_BAIT }
}
export const jarFull = (t: Tut, day: number) => t.baitDay !== day

// ── save (garden-tied, registered in GARDEN_KEY_SPECS) ─────────────────────────────────────────────────────────────
export const TUT_KEY = 'open.tutorial.v1'
const bool = (x: unknown) => x === true
export function parseTut(v: unknown): Tut | null {
  const o = v as Partial<Tut> | null
  if (!o || typeof o !== 'object' || o.v !== 1) return null
  const g = (o.greg ?? {}) as Partial<Tut['greg']>
  return {
    v: 1, live: o.live !== false,
    greg: { welcome: bool(g.welcome), moglins: bool(g.moglins), spirits: bool(g.spirits), wilds: bool(g.wilds) },
    heard: Array.isArray(o.heard) ? [...new Set(o.heard.filter((f): f is Friend => FRIENDS.includes(f)))] : [],   // save order kept
    gifts: Array.isArray(o.gifts) ? [...new Set(o.gifts.filter((x): x is Gift => GIFT_IDS.includes(x)))] : [],
    b2: o.b2 === 'asked' || o.b2 === 'accepted' ? o.b2 : 'none',
    baitDay: Number.isInteger(o.baitDay) ? o.baitDay! : null,
    m70: M70S.includes(o.m70 as M70) ? o.m70! : 'none',
    m70node: typeof o.m70node === 'string' ? o.m70node : null,
    m70side: M70SIDES.includes(o.m70side as M70Side) ? o.m70side! : 'none',
    ...(o.fs === 'done' ? { fs: 'done' as const } : {}),
    folded: o.folded !== false,   // M71: only an explicit false (a post-M71 newborn) is unfolded; a save without the field had its garden
    ...(Array.isArray(o.met) ? { met: [...new Set(o.met.filter((g): g is Guide => GUIDES.includes(g)))] } : {}),
  }
}
/** No save yet: a keeper who has already played (any garden/works save) is a LEGACY keeper; a brand-new one starts fresh. */
export function adoptTut(raw: unknown, playedBefore: boolean): Tut {
  return parseTut(raw) ?? (playedBefore ? legacyTut() : freshTut())
}
export function loadTut(): Tut {
  try {
    const raw = JSON.parse(localStorage.getItem(gardenKey(TUT_KEY)) ?? 'null')
    const played = localStorage.getItem(gardenKey('ather.garden.v1')) !== null || localStorage.getItem(gardenKey('open.works.v1')) !== null
    const t = adoptTut(raw, played)
    if (!raw) saveTut(t)
    return t
  } catch { return freshTut() }
}
export function saveTut(t: Tut): void {
  try { localStorage.setItem(gardenKey(TUT_KEY), JSON.stringify(t)) } catch { /* private window */ }
  if (typeof window !== 'undefined' && typeof Event !== 'undefined') window.dispatchEvent?.(new Event(TUT_EVENT))
}
/** M146: the tutorial's save moved (use-first-steps.ts, opening-chain-store.ts) */
export const TUT_EVENT = 'ather-tutorial'
/** M146: is First Steps on, READ only (never writes a first save: a keeper with no record yet is judged where they first meet Greg). */
export function peekFirstSteps(): boolean {
  try { const t = parseTut(JSON.parse(localStorage.getItem(gardenKey(TUT_KEY)) ?? 'null')); return !!t && firstStepsOn(t) } catch { return false }
}
