'use client'
// THE OPENING CHAIN's store + clock (BETA M73). Rules: opening-chain.ts (pure, tested). Saved per keeper (CHAIN_KEY in
// KEEPER_KEY_SPECS), so it rides keeper swaps and the cloud like the bag.
//   the Ather page mounts      useOpeningChain({ packLying, getInv, setInv })   (hands the note once, ticks the ping/nudge once a second)
//   the page's 'down' handler  chainDeath()                     (after fallAndDrop, so the pack is already lying)
//   the bag's note             chainRead()                      the fold map: chainGateOpen() on a gate open, chainFlip(view)
// Checks READ window.__chain (state + what Morel said); they never write through it.

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { keeperKey } from '@/lib/keeper-local'
import { hudSay } from './hud-say'
import { giveInvite, type Inv } from './inventory'
import { getLoadout } from './loadout'
import { MOREL_PING, MOREL_NUDGE, MOREL_DIG_HINT } from './morel-lines'
import { CHAIN_KEY, parseChain, migrate, readInvite, onDeath, tick, onGateOpen, onFlip, wantsInvite, newChain, type Chain, type ChainSay } from './opening-chain'

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

/** The page's clock. `packLying` = a backpack still lies in the Wilds (death-pack.tsx › packLying). */
export function useOpeningChain(o: { packLying: () => boolean; getInv: () => Inv; setInv: (i: Inv) => void }) {
  const ref = useRef(o); ref.current = o
  useEffect(() => {
    cur = null   // a keeper swap reloads the page, but re-read anyway: never carry another keeper's chain
    const g = window as unknown as { __chain?: unknown }
    g.__chain = { state: () => ({ ...get() }), said: () => [...said] }
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
