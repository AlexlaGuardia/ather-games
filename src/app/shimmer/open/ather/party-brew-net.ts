'use client'
// ── A BREWING over the relay (BETA M57 slice 3b; the rules are pure in party-brew.ts) ─────────────────────────────────────────
// HOST (on their own plot, in a party): holds the one brewing (saved per keeper, so a reload keeps what everyone spent), answers
// every PB_CLAIM with claim() on the guest's reported bag, sends the state to each guest in view on change and every STATE_MS,
// and POURS on its own the moment the Desk's last step is done: its share into its own bag, each other hand's share by PB_POUR.
// GUEST (visiting a mate's plot): mirrors the host's state (its clock read through an offset), asks for steps, spends what the
// host granted out of its own bag, and takes its bottles when the pour arrives.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { keeperKey } from '@/lib/keeper-local'
import { selfPlayerId } from '../../play3d/multiplayer'
import { getInv, setInv } from '../shared/bag'
import { give, take, itemDef, type Inv } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { ALC_POTIONS, type Have } from './alchemy-set'
import { boonAt } from './alchemist-boon'
import { loadVillage } from './moglins'
import { currentVisit, isVisiting, subscribeVisit, type Visit } from './plot-visit'
import { openBrewing, adoptBrewing, hostClaim, pourReady, pour, isClaim, isGrant, isPour, PB_STATE, PB_CLAIM, PB_GRANT, PB_DENY, PB_POUR, PB_ACK, STATE_MS, owe, acked, adoptOwed, isAck, takePour, type Brewing, type OwedBook } from './party-brew'
import type { Works } from './rooms'

type Relay = (kind: string, data: unknown, to?: string) => boolean
type OnRelay = (f: (m: { from: string; kind: string; data: unknown }) => void) => () => void

export const haveOfInv = (inv: Inv): Have => { const h: Record<string, number> = {}; for (const s of inv.slots) if (s) h[s.id] = (h[s.id] ?? 0) + s.n; return h }
const spendFromBag = (spend: { id: string; n: number }[]): boolean => {
  let bag: Inv | null = getInv()
  for (const x of spend) bag = bag && take(bag, x.id, x.n)
  if (!bag) return false
  setInv(bag); return true
}
const giveBottles = (id: string, n: number) => {
  const g = give(getInv(), id, n)
  setInv(g.inv)
  return n - g.left
}

// ── the store ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const KEY = 'open.brewing.v1'
let hostB: Brewing | null | undefined   // undefined = not read yet
let guestB: Brewing | null = null, offset = 0
let ver = 0
const subs = new Set<() => void>()
const emit = () => { ver++; subs.forEach(f => f()) }
const loadHost = (): Brewing | null => { if (hostB === undefined) { try { hostB = adoptBrewing(JSON.parse(localStorage.getItem(keeperKey(KEY)) ?? 'null')) } catch { hostB = null } } return hostB }
function setHost(b: Brewing | null) { hostB = b; try { localStorage.setItem(keeperKey(KEY), JSON.stringify(b)) } catch { /* private window */ } emit() }
subscribeVisit(() => { if (!isVisiting()) guestB = null; emit() })
// the host's owed book (hands away at a pour) and the guest's taken pour ids: both saved, so a reload on either side loses nothing
const OWED_KEY = 'open.brewing.owed.v1', SEEN_KEY = 'open.brewing.seen.v1'
const readJ = (k: string) => { try { return JSON.parse(localStorage.getItem(keeperKey(k)) ?? 'null') } catch { return null } }
const writeJ = (k: string, v: unknown) => { try { localStorage.setItem(keeperKey(k), JSON.stringify(v)) } catch { /* private window */ } }
const loadOwed = (): OwedBook => adoptOwed(readJ(OWED_KEY))
const loadSeen = (): string[] => { const v = readJ(SEEN_KEY); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] }

/** the brewing this page shows: the host's mirror while visiting, else your own */
export const shownBrewing = (): Brewing | null => (isVisiting() ? guestB : (typeof window === 'undefined' ? null : loadHost()))
/** now on the brewing's clock (the host's) */
export const brewNow = () => Date.now() + (isVisiting() ? offset : 0)
export const useBrewing = () => { useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => ver, () => 0); return shownBrewing() }
/** the id this page brews as (the socket id; the host's hands list holds these) */
export const brewSelf = () => selfPlayerId()

let send: Relay | null = null
const pending = new Set<number>()   // guest: steps asked for and not answered yet

/** HOST: open a brewing of `potion` at your Desk (one at a time; a poured one is replaced). */
export function openPartyBrew(potion: string): boolean {
  if (isVisiting()) return false
  const cur = loadHost()
  if (cur && !cur.poured) { hudSay('A brewing is already going on your plot.', 'info', 4); return false }
  const b = openBrewing(selfPlayerId(), potion); if (!b) return false
  setHost(b); hudSay(`A brewing of ${ALC_POTIONS[potion].name} is open. Your party can take the steps at the stations.`, 'info', 5); return true
}
/** HOST: close a brewing nobody has started a step on (nothing to give back) */
export function closePartyBrew(): boolean {
  const b = loadHost(); if (!b || isVisiting() || Object.keys(b.runs).length) return false
  setHost(null); return true
}
/** Take step `k`: the host claims at once from its own bag; a guest asks the host. */
export function claimStep(k: number): void {
  if (isVisiting()) {
    const v = currentVisit(); if (!v || !send || pending.has(k)) return
    if (send(PB_CLAIM, { k, have: haveOfInv(getInv()) }, v.host)) { pending.add(k); emit() }
    return
  }
  const b = loadHost(); if (!b) return
  const r = hostClaim(b, selfPlayerId(), k, haveOfInv(getInv()), Date.now())
  if ('why' in r) { hudSay(r.why, 'info', 4); return }
  if (!spendFromBag(r.spend)) { hudSay('You are short of what that step takes.', 'info', 4); return }
  setHost(r.b)
}
export const isPending = (k: number) => pending.has(k)

const probe = { claims: 0, grants: 0, denies: 0, pours: 0, gotBottles: 0, states: 0, owedSent: 0, acks: 0 }

// ── the hook ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function usePartyBrew(o: { relay: Relay; onRelay: OnRelay; hosting: boolean; visit: Visit | null; guests: string[]; works: () => Works }) {
  send = o.relay
  const guests = useRef(o.guests); guests.current = o.guests
  const works = useRef(o.works); works.current = o.works

  // host: answer claims, broadcast state, pour
  useEffect(() => {
    if (!o.hosting) return
    let lastSent = ''
    const state = (to?: string[]) => { const b = loadHost(), msg = { b, now: Date.now() }; for (const g of to ?? guests.current) o.relay(PB_STATE, msg, g) }
    const sendOwed = (to: string[]) => { const book = loadOwed(); for (const g of to) for (const ow of book[g] ?? []) if (o.relay(PB_POUR, ow, g)) probe.owedSent++ }
    const off = o.onRelay(m => {
      if (m.kind === PB_ACK && isAck(m.data)) { const book = loadOwed(), next = acked(book, m.from, m.data.pid); if (next !== book) { probe.acks++; writeJ(OWED_KEY, next) } return }
      if (m.kind !== PB_CLAIM || !isClaim(m.data)) return
      const b = loadHost(); probe.claims++
      if (!b) { o.relay(PB_DENY, { k: m.data.k, why: 'No brewing is open here.' }, m.from); return }
      const r = hostClaim(b, m.from, m.data.k, m.data.have, Date.now())
      if ('why' in r) { probe.denies++; o.relay(PB_DENY, { k: m.data.k, why: r.why }, m.from); return }
      probe.grants++; setHost(r.b)
      o.relay(PB_GRANT, { k: m.data.k, spend: r.spend }, m.from)
      state()
    })
    const t = setInterval(() => {
      const b = loadHost(), now = Date.now()
      if (b && pourReady(b, now)) {
        const desk = works.current().pieces.find(p => p.item === 'alc_desk')
        const chance = desk ? boonAt(loadVillage(), works.current(), desk.id).chance : 0
        const fixed = (window as unknown as { __alcRoll?: number }).__alcRoll
        const r = pour(b, now, chance, typeof fixed === 'number' ? () => fixed : Math.random)
        if (r) {
          probe.pours++
          const me = selfPlayerId(), mine = r.per[me] ?? 0
          if (mine) { const got = giveBottles(r.bottle, mine); hudSay(`${itemDef(r.bottle).name}${got > 1 ? ` × ${got}` : ''} from the brewing.${r.extra[me] ? ' One extra, thanks to your alchemist.' : ''}${got < mine ? ' Your bag was full for the rest.' : ''}`, 'item', 5) }
          // every other hand is OWED its share until it acks (away at the pour = paid on return)
          const pid = `${me}-${now.toString(36)}`, book = owe(loadOwed(), r.per, r.extra, r.bottle, me, pid)
          writeJ(OWED_KEY, book); sendOwed(r.b.hands.filter(h => h !== me))
          setHost(r.b); state()
        }
      }
      const key = JSON.stringify(loadHost())
      if (key !== lastSent) { lastSent = key; state() }
    }, 500)
    const s = setInterval(() => { state(); sendOwed(guests.current) }, STATE_MS)   // a guest who just arrived gets the brewing, and what it is owed
    return () => { off(); clearInterval(t); clearInterval(s) }
  }, [o.hosting, o.relay, o.onRelay])

  // guest: mirror, grants, denials, the pour
  const host = o.visit?.host ?? null
  useEffect(() => {
    if (!host) return
    const off = o.onRelay(m => {
      if (m.from !== host) return
      if (m.kind === PB_STATE) {
        const d = m.data as { b?: unknown; now?: unknown } | null
        if (!d || typeof d.now !== 'number') return
        guestB = d.b === null ? null : adoptBrewing(d.b); offset = d.now - Date.now(); probe.states++; emit()
      } else if (m.kind === PB_GRANT && isGrant(m.data)) {
        pending.delete(m.data.k)
        if (!spendFromBag(m.data.spend)) hudSay('Your bag changed before the step started. It runs on what you gave.', 'info', 4)
        emit()
      } else if (m.kind === PB_DENY) {
        const d = m.data as { k?: number; why?: string }
        if (typeof d?.k === 'number') pending.delete(d.k)
        if (typeof d?.why === 'string') hudSay(d.why.slice(0, 120), 'info', 4)
        emit()
      } else if (m.kind === PB_POUR && isPour(m.data)) {
        const pid = (m.data as { pid?: unknown }).pid
        if (typeof pid !== 'string') return
        const t = takePour(loadSeen(), pid)
        o.relay(PB_ACK, { pid }, host)   // ack every copy: a lost ack only means one more re-send, never a second payment
        if (!t.fresh) return
        writeJ(SEEN_KEY, t.seen)
        const got = giveBottles(m.data.bottle, m.data.n); probe.gotBottles += got
        hudSay(`${itemDef(m.data.bottle).name}${got > 1 ? ` × ${got}` : ''} from the brewing.${m.data.extra ? ' One extra, thanks to their alchemist.' : ''}${got < m.data.n ? ' Your bag was full for the rest.' : ''}`, 'item', 5)
      }
    })
    return () => { off(); pending.clear() }
  }, [host, o.onRelay])

  if (typeof window !== 'undefined') (window as unknown as { __brew?: unknown }).__brew = {
    shown: () => shownBrewing(), now: () => brewNow(), owed: () => loadOwed(), self: () => selfPlayerId(), net: () => ({ ...probe }), pending: () => [...pending],
  }
}
