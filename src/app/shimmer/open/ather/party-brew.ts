// ── A BREWING: alchemy with a party on the host's plot (M57 slice 3a, the PURE model; hub 9bf57e68 #15633) ──────────────────
// CANON (game/alchemy.md): 08-29 a brewing is hosted on a keeper's plot, more hands brew more per ingredient with a DIMINISHING
// return, and it gives MORE, never ONLY (no recipe behind company). 09-16: the host starts the recipe, guests take steps, an
// ingredient AND a performed step are both a contribution, every hand leaves the pour with a bottle, bottle-only (no recipe
// learned), skill follows the hand. 11-21 THE ALCHEMY SET: the recipe opens and closes at the Desk, so the Desk's last step
// IS the pour here (supersedes 09-16's cauldron-last, which named the old four).
// BUILD (Jin): the claim rule, the curve, the split, the boon roll. Everything here is data in, data out, so the relay
// (slice 3b) only ships a Brewing and the actions; every client runs the same functions on the same state.
//   · steps run in DEPENDENCY order, not index order: a step is OPEN once every intermediate it takes has been made (the
//     Health Draught's crush and its steep can run side by side on two stations).
//   · a hand claims an open step and spends that step's RAW inputs from ITS OWN bag; intermediates come from the brewing's
//     shared pool (made by whoever ran the step before). One step per hand at a time.
//   · the pour: total bottles = max(hands, round(makes × yieldMult(hands))), yieldMult flattens near four; every hand gets 1,
//     the rest goes by contribution (steps run + ingredient units given), the host winning ties. A solo brewing pours exactly
//     what a solo brew does (makes), so the host never loses by opening the fold.
//   · the alchemist boon (alchemist-boon.ts) rolls ONCE PER HAND at the pour; each hit is one more bottle for that hand.
// Run: npx tsx src/app/shimmer/open/ather/party-brew.test.ts
import { ALC_POTIONS, pickFor, stepMakes, type Have } from './alchemy-set'

export interface StepRun { by: string; spent: { id: string; n: number }[]; start: number; ms: number }
export interface Brewing {
  host: string
  potion: string
  /** every hand present (host first); a hand that leaves keeps its share of what it gave */
  hands: string[]
  /** step index -> the run on it (absent = not claimed yet) */
  runs: Record<number, StepRun>
  /** set once the pour has been paid out */
  poured?: boolean
}

export const MAX_HANDS = 6
const isAlc = (id: string) => id.startsWith('alc:')

/** The host opens a brewing at their Desk with a potion they know. */
export function openBrewing(host: string, potion: string): Brewing | null {
  if (!ALC_POTIONS[potion]) return null
  return { host, potion, hands: [host], runs: {} }
}
export function join(b: Brewing, who: string): Brewing {
  if (b.hands.includes(who) || b.hands.length >= MAX_HANDS || b.poured) return b
  return { ...b, hands: [...b.hands, who] }
}

const runDone = (r: StepRun | undefined, now: number) => !!r && now >= r.start + r.ms
/** What the finished steps have made so far (intermediates and, once the last step is done, the bottles' id). */
export function made(b: Brewing, now: number): Record<number, { id: string; n: number }> {
  const out: Record<number, { id: string; n: number }> = {}
  for (const [k, r] of Object.entries(b.runs)) if (runDone(r, now)) out[+k] = stepMakes(b.potion, +k, r.spent)
  return out
}
/** The intermediates in the shared pool: made by a finished step and not yet spent by a later one. */
export function pool(b: Brewing, now: number): Have {
  const have: Record<string, number> = {}
  for (const m of Object.values(made(b, now))) if (isAlc(m.id)) have[m.id] = (have[m.id] ?? 0) + m.n
  for (const r of Object.values(b.runs)) for (const s of r.spent) if (isAlc(s.id) && s.id in have) have[s.id] -= s.n
  return have
}
/** The steps a hand may claim now: unclaimed, and every intermediate they take is in the pool. */
export function openSteps(b: Brewing, now: number): number[] {
  if (b.poured) return []
  const steps = ALC_POTIONS[b.potion].steps, pl = pool(b, now)
  return steps.map((st, k) => k).filter(k => !b.runs[k] && steps[k].in.filter(s => isAlc(s.id)).every(s => Object.entries(pl).some(([id, n]) => n >= s.n && (id === s.id || id.startsWith(s.id + ':')))))
}
export const busy = (b: Brewing, who: string, now: number) => Object.values(b.runs).some(r => r.by === who && !runDone(r, now))

/** A hand claims step `k`: raw inputs from ITS bag (`have`), intermediates from the pool. Returns the brewing after and what
 *  leaves the hand's bag. Null when the step is not open, the hand is busy or not in the brewing, or its bag is short. */
export function claim(b: Brewing, who: string, k: number, have: Have, now: number): { b: Brewing; spend: { id: string; n: number }[] } | null {
  if (!b.hands.includes(who) || busy(b, who, now) || !openSteps(b, now).includes(k)) return null
  const st = ALC_POTIONS[b.potion].steps[k], raw = { ...st, in: st.in.filter(s => !isAlc(s.id)) }, alc = { ...st, in: st.in.filter(s => isAlc(s.id)) }
  const fromBag = raw.in.length ? pickFor(raw, have) : []
  const fromPool = alc.in.length ? pickFor(alc, pool(b, now)) : []
  if (!fromBag || !fromPool) return null
  return { b: { ...b, runs: { ...b.runs, [k]: { by: who, spent: [...fromBag, ...fromPool], start: now, ms: st.ms } } }, spend: fromBag }
}

export const lastStep = (b: Brewing) => ALC_POTIONS[b.potion].steps.length - 1
/** The pour is ready: the Desk's last step has finished and nothing has been paid yet. */
export const pourReady = (b: Brewing, now: number) => !b.poured && runDone(b.runs[lastStep(b)], now)

/** Bottles a brewing of `hands` pours per `makes`: x1 alone, then x1.9 / x2.35 / x2.58 / x2.69 ..., flattening near four. */
export const yieldMult = (hands: number) => 1 + 1.8 * (1 - Math.pow(0.5, Math.max(1, hands) - 1))
export const totalBottles = (makes: number, hands: number) => Math.max(hands, Math.round(makes * yieldMult(hands)))

/** What each hand gave: steps run, and raw ingredient units out of its own bag. */
export function contribution(b: Brewing): Record<string, { steps: number; gave: number }> {
  const out: Record<string, { steps: number; gave: number }> = {}
  for (const h of b.hands) out[h] = { steps: 0, gave: 0 }
  for (const r of Object.values(b.runs)) {
    const c = (out[r.by] ??= { steps: 0, gave: 0 })
    c.steps++; c.gave += r.spent.filter(s => !isAlc(s.id)).reduce((a, s) => a + s.n, 0)
  }
  return out
}

/** The pour: bottles per hand (every hand at least one; the rest by weight = steps + units given; ties to the host, then
 *  join order), plus one boon roll per hand (`chance` from alchemist-boon.ts). Null when not ready. */
export function pour(b: Brewing, now: number, chance = 0, rnd: () => number = Math.random): { b: Brewing; bottle: string; per: Record<string, number>; extra: Record<string, number> } | null {
  if (!pourReady(b, now)) return null
  const hands = b.hands, bottle = made(b, now)[lastStep(b)].id, total = totalBottles(ALC_POTIONS[b.potion].makes, hands.length)
  const per: Record<string, number> = {}, c = contribution(b), w = (h: string) => c[h].steps + c[h].gave
  for (const h of hands) per[h] = 1
  const order = [...hands].sort((a, z) => w(z) - w(a) || (a === b.host ? -1 : z === b.host ? 1 : hands.indexOf(a) - hands.indexOf(z)))
  const sumW = hands.reduce((a, h) => a + w(h), 0)
  let left = total - hands.length
  if (sumW > 0) for (const h of order) { const k = Math.floor((total - hands.length) * w(h) / sumW); per[h] += k; left -= k }
  for (let i = 0; left > 0; i = (i + 1) % order.length, left--) per[order[i]]++
  const extra: Record<string, number> = {}
  for (const h of hands) { extra[h] = chance > 0 && rnd() < chance ? 1 : 0; per[h] += extra[h] }
  return { b: { ...b, poured: true }, bottle, per, extra }
}
