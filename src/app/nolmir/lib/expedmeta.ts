// EXPEDITIONS — the meta layer. Marks (primary expedition reward), the
// workshop (permanent squad floor), breach tiers + per-tier records
// (multiplayer-shaped score documents, local board for now),
// and the off-post flag the Crucible reads.

import { RunResult } from './expedition'

export const EXPED_KEY = 'nolmir.exped.v1'
export const LIVE_KEY = 'nolmir.exped.live.v1'

export const TIER_UNLOCK_WAVE = 12 // clear this deep to open the next breach down

// ---- workshop — marks buy a permanent floor under every run ----

export const WORKSHOP = [
  { id: 'vigor', name: 'Pattern Tempering', line: '+10% squad hp per level', mult: 0.1 },
  { id: 'edge', name: 'Volley Tuning', line: '+10% squad attack per level', mult: 0.1 },
  { id: 'plating', name: 'Gate Plating', line: '+30 gate integrity per level', mult: 30 },
  { id: 'scanner', name: 'Salvage Scanner', line: '+12% salvage per level', mult: 0.12 },
] as const
export type WorkshopId = (typeof WORKSHOP)[number]['id']

export function workshopCost(level: number): number {
  return Math.round(25 * Math.pow(2, level))
}

// ---- per-tier records — score documents, multiplayer-shaped ----

export interface TierRecord {
  tier: number
  wave: number
  roster: string[]
  doctrine: string
  at: number
}

export interface ExpedMeta {
  workshop: Record<string, number>
  records: TierRecord[] // best per tier
  runs: number
}

export function defaultExpedMeta(): ExpedMeta {
  return {
    workshop: Object.fromEntries(WORKSHOP.map((w) => [w.id, 0])),
    records: [],
    runs: 0,
  }
}

export function loadExpedMeta(): ExpedMeta {
  try {
    const raw = localStorage.getItem(EXPED_KEY)
    if (raw) return { ...defaultExpedMeta(), ...(JSON.parse(raw) as ExpedMeta) }
  } catch {}
  return defaultExpedMeta()
}

export function saveExpedMeta(m: ExpedMeta) {
  try {
    localStorage.setItem(EXPED_KEY, JSON.stringify(m))
  } catch {}
}

export function bestWave(m: ExpedMeta, tier: number): number {
  return m.records.find((r) => r.tier === tier)?.wave ?? 0
}

// tier N+1 opens when tier N has been held past the unlock wave
export function tiersUnlocked(m: ExpedMeta): number {
  let t = 1
  while (bestWave(m, t) >= TIER_UNLOCK_WAVE) t++
  return t
}

// returns true if this run set a new record for its tier
export function recordRun(m: ExpedMeta, r: RunResult): boolean {
  m.runs++
  const prev = m.records.find((rec) => rec.tier === r.tier)
  if (!prev || r.wave > prev.wave) {
    const rec: TierRecord = { tier: r.tier, wave: r.wave, roster: r.roster, doctrine: r.doctrine, at: Date.now() }
    m.records = [...m.records.filter((x) => x.tier !== r.tier), rec].sort((a, b) => a.tier - b.tier)
    return true
  }
  return false
}

// ---- the off-post flag — a guard on expedition is off their crucible post ----
// (defense vs glory.) The run page heartbeats while a run is live; the
// Crucible strips champions from its mods while the beat is fresh.

const LIVE_FRESH_MS = 2 * 60 * 1000

export function heartbeatLive() {
  try {
    localStorage.setItem(LIVE_KEY, String(Date.now()))
  } catch {}
}

export function clearLive() {
  try {
    localStorage.removeItem(LIVE_KEY)
  } catch {}
}

export function championsOffPost(m: ExpedMeta, now: number): boolean {
  try {
    const raw = localStorage.getItem(LIVE_KEY)
    if (raw && now - Number(raw) < LIVE_FRESH_MS) return true
  } catch {}
  return false
}
