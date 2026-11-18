'use client'
// The first-rinstick quest, live (BETA M22; rules in rinquest.ts, save in rinsticks.ts). One hook the Ather page calls:
//   - watches the garden's works: once a Rinnshop STANDS (raised) the quest starts (none -> active) + a HUD line
//   - posts the journal line for the open step (source 'rinquest')
//   - answers the bench: askAtRinnshop() does a step 'at rinnshop' and, on the last, puts the worn rinstick in hand
// The page re-reads its tools on TOOLS_EVENT (saveQuest fires it), so the stick appears the moment it is earned.

import { useEffect, useSyncExternalStore } from 'react'
import { postEntries, getJournal } from '../shared/journal'
import { hudSay, linesAt } from '../shared/hud-say'
import { currentWorks } from './workshop'
import { raised } from './rooms'
import { onShop, doStep, questEntries, RINQUEST_LINES, type RinQuest, type StepAt } from './rinquest'
import { loadQuest, saveQuest, TOOLS_EVENT } from './rinsticks'

let q: RinQuest | null = null
const get = () => (q ??= loadQuest())
const SERVER: RinQuest = { v: 1, state: 'done', step: 0 }
const sub = (f: () => void) => {
  const on = () => { const n = loadQuest(); if (!q || n.state !== q.state || n.step !== q.step) q = n; f() }
  window.addEventListener(TOOLS_EVENT, on); return () => window.removeEventListener(TOOLS_EVENT, on)
}
export const useQuest = () => useSyncExternalStore(sub, get, () => SERVER)
const put = (n: RinQuest) => { q = n; saveQuest(n) }

/** The Rinnshop bench's quest button: does the current step if it is done there. */
export function askAt(at: StepAt) {
  const r = doStep(get(), at)
  if (r.q === get()) return false
  put(r.q)
  if (r.granted) hudSay(RINQUEST_LINES.got, 'info')
  return true
}

export function useRinQuest() {
  const quest = useQuest()
  // probes for rinquest-check (reading only; the bench button is the real click)
  useEffect(() => {
    const g = window as unknown as { __rinquest?: Record<string, unknown> }
    g.__rinquest = { quest: () => get(), journal: () => getJournal().entries.map(e => ({ id: e.id, title: e.title, struck: !!e.struck })), said: () => linesAt().map(l => l.text) }
  }, [])
  useEffect(() => { postEntries('rinquest', questEntries(quest)) }, [quest])
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
