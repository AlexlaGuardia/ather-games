'use client'
// THE OPENING CHAIN's store + clock (BETA M73). Rules: opening-chain.ts (pure, tested). Saved per keeper (CHAIN_KEY in
// KEEPER_KEY_SPECS), so it rides keeper swaps and the cloud like the bag.
//   the Ather page mounts      useOpeningChain({ packLying, getInv, setInv })   (hands the note once, ticks the ping/nudge once a second)
//   the page's 'down' handler  chainDeath()                     (after fallAndDrop, so the pack is already lying)
//   the bag's note             chainRead()                      the fold map: chainGateOpen() on a gate open, chainFlip(view)
//   s3, the continent mounts   useChainYard({ inYard, getInv, setInv })  (the yard step + the page found there, once a second)
//   the bag's page             chainReadPage()                  Veyra's send line: chainVeyraSend()
//   ★ THE SHIP-REPAIR FLAG     getShipRepairFlag()              (M108 + world-destmap's destination-map gate read THIS)
// Checks READ window.__chain (state + what Morel said); they never write through it.

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { keeperKey } from '@/lib/keeper-local'
import { hudSay } from './hud-say'
import { giveInvite, givePage, type Inv } from './inventory'
import { KAEL_PAGE_NAME } from './kael-page-lines'
import { getLoadout } from './loadout'
import { MOREL_PING, MOREL_NUDGE, MOREL_DIG_HINT } from './morel-lines'
import { CHAIN_KEY, parseChain, migrate, readInvite, onDeath, tick, onGateOpen, onFlip, wantsInvite, newChain, onYard, wantsPage, pageFound, readPage, onVeyraSend, shipRepair, type Chain, type ChainSay } from './opening-chain'

export const CHAIN_LINES: Record<ChainSay, string> = { ping: MOREL_PING.unreadNote, nudge: MOREL_NUDGE.unreadNote, hint: MOREL_DIG_HINT.digFlip }

let cur: Chain | null = null
const said: ChainSay[] = []
const subs = new Set<() => void>()
const SERVER = newChain()
function get(): Chain {
  if (typeof window === 'undefined') return SERVER
  if (!cur) {
    let saved: Chain | null = null
    try { saved = parseChain(JSON.parse(localStorage.getItem(keeperKey(CHAIN_KEY)) ?? 'null')) } catch { /* private window */ }
    if (saved) cur = saved
    else { cur = migrate({ kaelChestOpen: getLoadout().kael === true }); save(cur) }
  }
  return cur
}
function save(c: Chain) { try { localStorage.setItem(keeperKey(CHAIN_KEY), JSON.stringify(c)) } catch { /* private window */ } }
function put(c: Chain) { if (c === cur) return; cur = c; save(c); subs.forEach(f => f()) }
function say(s: ChainSay | null) { if (!s) return; said.push(s); hudSay(CHAIN_LINES[s], 'morel') }

export const getChain = get
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useChain = () => useSyncExternalStore(subscribe, get, () => SERVER)

export function chainRead() { put(readInvite(get())) }
export function chainDeath() { put(onDeath(get())) }
export function chainGateOpen() { const r = onGateOpen(get()); put(r.chain); say(r.say) }
export function chainFlip(to: 'ather' | 'athernyx') { put(onFlip(get(), to)) }
export function chainReadPage() { put(readPage(get())) }
export function chainVeyraSend() { put(onVeyraSend(get())) }
/** ★ THE SHIP-REPAIR FLAG (M73 s3): Veyra sent the keeper to get the ship running. The repair quest (M108) and the
 *  destination-map gate read it here; it rides the chain record (per keeper, CHAIN_KEY), so it survives a reload. */
export const getShipRepairFlag = () => shipRepair(get())

/** the pickup's HUD line: the item's signed name + where it went (build text, no lore) */
export const PAGE_FOUND = `${KAEL_PAGE_NAME[0].toUpperCase()}${KAEL_PAGE_NAME.slice(1)} · in your bag`

function installProbe() {
  const g = window as unknown as { __chain?: unknown }
  g.__chain = { state: () => ({ ...get() }), said: () => [...said], shipRepair: () => getShipRepairFlag() }
}

/** s3, the continent's clock: `inYard` = the keeper stands in Kael's yard (the inherited plot above Rune Hold). The yard
 *  step lands there, and the page is found: handed into the bag once (retried while the bag is full). */
export function useChainYard(o: { inYard: () => boolean; getInv: () => Inv; setInv: (i: Inv) => void }) {
  const ref = useRef(o); ref.current = o
  useEffect(() => {
    cur = null
    installProbe()
    const t = setInterval(() => {
      let c = get()
      if (ref.current.inYard()) c = onYard(c)
      if (wantsPage(c)) {
        const inv = givePage(ref.current.getInv())
        if (inv) { ref.current.setInv(inv); c = pageFound(c); hudSay(PAGE_FOUND, 'item', 6) }
      }
      put(c)
    }, 1000)
    return () => clearInterval(t)
  }, [])
}

/** The page's clock. `packLying` = a backpack still lies in the Wilds (death-pack.tsx › packLying). */
export function useOpeningChain(o: { packLying: () => boolean; getInv: () => Inv; setInv: (i: Inv) => void }) {
  const ref = useRef(o); ref.current = o
  useEffect(() => {
    cur = null   // a keeper swap reloads the page, but re-read anyway: never carry another keeper's chain
    installProbe()
    const t = setInterval(() => {
      const c = get()
      // the note, once: retried each second while the bag is full (giveInvite returns null, nothing is marked)
      if (wantsInvite(c)) { const inv = giveInvite(ref.current.getInv()); if (inv) ref.current.setInv(inv) }
      const r = tick(c, { packLying: ref.current.packLying(), now: Date.now() })
      put(r.chain); say(r.say)
    }, 1000)
    return () => clearInterval(t)
  }, [])
}
