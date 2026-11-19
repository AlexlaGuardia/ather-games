'use client'
// The first-rinstick quest, live (BETA M22; rules in rinquest.ts, save in rinsticks.ts). The Ather page calls useRinQuest():
//   - watches the garden's works: once a Rinnshop STANDS (raised) the quest starts (none -> active) + a HUD line
//   - posts the journal line for the open step (source 'rinquest'; the Moonwell steps point at the water)
// Everything else reports what it saw through questEvent(): Fennel's talk (fennelTalk below), the Moonwell wait and the
// scale on the bank (moonwell-quest.tsx), the Rinnshop bench's bind (workshop.tsx). The page re-reads its tools on
// TOOLS_EVENT (saveQuest fires it), so the stick is in hand the moment the scale is bound.

import { useEffect, useSyncExternalStore } from 'react'
import { postEntries, getJournal } from '../shared/journal'
import { hudSay, linesAt } from '../shared/hud-say'
import { getInv, setInv } from '../shared/bag'
import { take, isCatch, SLOTS, type Inv } from '../shared/inventory'
import type { TalkNode } from '../shared/npc-talk'
import { currentWorks } from './workshop'
import { raised } from './rooms'
import { onShop, doStep, questEntries, currentStep, RINQUEST_LINES, type RinQuest, type QuestEvent } from './rinquest'
import { loadQuest, saveQuest, TOOLS_EVENT } from './rinsticks'
import { MOONWELL } from './moonwell'

let q: RinQuest | null = null
const get = () => (q ??= loadQuest())
const SERVER: RinQuest = { v: 1, state: 'done', step: 0 }
const sub = (f: () => void) => {
  const on = () => { const n = loadQuest(); if (!q || n.state !== q.state || n.step !== q.step || !!n.stick !== !!q.stick) q = n; f() }
  window.addEventListener(TOOLS_EVENT, on); return () => window.removeEventListener(TOOLS_EVENT, on)
}
export const useQuest = () => useSyncExternalStore(sub, get, () => SERVER)
export const currentQuest = () => get()
const put = (n: RinQuest) => { q = n; saveQuest(n) }

/** the first rinn catch in the bag, if any (Fennel takes one) */
export const firstCatch = (inv: Inv) => inv.slots.slice(0, SLOTS).find(s => s && isCatch(s.id))?.id ?? null

/** Report something the world saw. Applies the step if it is the current one: takes what the step takes from the bag (the
 *  scale at the bind, a catch for Fennel), says the line. Returns true when the quest moved. */
export function questEvent(ev: QuestEvent): boolean {
  const before = get(), r = doStep(before, ev)
  if (r.q === before) return false
  if (r.took) { const out = take(getInv(), r.took, 1); if (!out) return false; setInv(out) }
  if (ev.kind === 'talk' && ev.hasCatch && currentStep(before)?.do.kind === 'talk' && r.q.state === 'done') {
    const c = firstCatch(getInv()); if (c) { const out = take(getInv(), c, 1); if (out) setInv(out) }
  }
  put(r.q)
  const d = currentStep(before)?.do
  if (r.granted) hudSay(RINQUEST_LINES.got, 'info')
  else if (r.q.state === 'done') hudSay(RINQUEST_LINES.done, 'info')
  else if (d?.kind === 'wait') hudSay(RINQUEST_LINES.surfaced, 'info')
  else if (d?.kind === 'pickup') hudSay(RINQUEST_LINES.picked, 'item')
  return true
}

// ── Fennel's talk (shared/npc-talk.tsx shape). lark draft, athernyx 112926e, UNSIGNED until Alex signs (CANON/game/first-rinstick-script.md); slots the script has no line for keep their placeholder.
// Placeholder still: the 'I'll go at dusk.' option, the Goodbye label, the 'catch' with-nothing-in-bag and fallback lines. `page` = which screen of the meeting; `close` ends the talk.
export const FENNEL_NAME = 'Fennel'
export function fennelTalk(quest: RinQuest, page: number, inv: Inv, acts: { goto: (page: number) => void; close: () => void }): TalkNode {
  const d = currentStep(quest)?.do
  const bye = { label: 'Goodbye, Fennel.', pick: acts.close }
  if (d?.kind === 'talk' && !d.needs) {
    if (page === 0) return { line: "A Rinnshop! Look at the shelves. Now all it needs is a stick. Here's the trouble. No stick, no catch. No catch, no stick. Unless one gives itself.", options: [{ label: 'How does one give itself?', pick: () => acts.goto(1) }, bye] }
    if (page === 1) return { line: 'Sit by the Moonwell when the light goes. Bring nothing. Sit still and be easy to like.', options: [{ label: 'Anything I should bring?', pick: () => acts.goto(2) }, bye] }
    return { line: "Only your patience. Dusk, at the water. I'll keep the pot warm.", options: [{ label: "I'll go at dusk.", pick: () => { questEvent({ kind: 'talk', who: 'fennel', hasCatch: false }); acts.close() } }] }
  }
  if (d?.kind === 'talk' && d.needs === 'catch') {
    const c = firstCatch(inv)
    if (c) {
      if (page === 0) return { line: "Oh, look at you. First catch, and it's a good one. Somebody gave you that stick, so go easy on the water. Come back hungry.", options: [{ label: 'Thank you.', pick: () => acts.goto(1) }, { label: '(leave)', pick: () => acts.goto(2) }] }
      const fin = { label: 'Goodbye, Fennel.', pick: () => { questEvent({ kind: 'talk', who: 'fennel', hasCatch: true }); acts.close() } }
      if (page === 1) return { line: "Don't thank me. Thank whoever left the scale. Then eat.", options: [{ label: '(leave)', pick: () => acts.goto(2) }] }
      return { line: "Pot's on. It's always on.", options: [fin] }
    }
    return { line: "A stick's only half. Go and ask the water for the rest.", options: [bye] }
  }
  if (d?.kind === 'wait') return { line: "Dusk, at the water, empty hands. It's not hard. It's only slow.", options: [bye] }
  if (d?.kind === 'pickup') return { line: "Dusk, at the water, empty hands. It's not hard. It's only slow.", options: [bye] }
  if (d?.kind === 'bench') return { line: 'Got something shiny? Take it to the bench before it forgets what it\'s for.', options: [bye] }
  return { line: 'Back to the kitchen with me. Feed those spirits!', options: [bye] }
}

export function useRinQuest() {
  const quest = useQuest()
  // probes for rinquest-check (reading only; the clicks, the wait and the walking are real)
  useEffect(() => {
    const g = window as unknown as { __rinquest?: Record<string, unknown> }
    g.__rinquest = { quest: () => get(), journal: () => getJournal().entries.map(e => ({ id: e.id, title: e.title, struck: !!e.struck })), said: () => linesAt().map(l => l.text), moonwell: () => MOONWELL }
  }, [])
  useEffect(() => { postEntries('rinquest', questEntries(quest, MOONWELL)) }, [quest])
  useEffect(() => {
    if (quest.state !== 'none') return
    const tick = () => {
      const shop = currentWorks().rooms.some(r => r.kind === 'rinnshop' && raised(r))
      const n = onShop(get(), shop)
      if (n !== get()) { put(n); hudSay(RINQUEST_LINES.started, 'info') }
    }
    tick(); const id = setInterval(tick, 2000); return () => clearInterval(id)
  }, [quest.state])
  return quest
}

