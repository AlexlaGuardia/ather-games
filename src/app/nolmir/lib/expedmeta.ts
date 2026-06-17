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
  garrisonTick?: number // last time the held breaches were settled for idle marks
}

export function defaultExpedMeta(): ExpedMeta {
  return {
    workshop: Object.fromEntries(WORKSHOP.map((w) => [w.id, 0])),
    records: [],
    runs: 0,
  }
}

// ---- garrison idle yield — the held breaches keep salvaging while you're away ----
// Every cleared tier passively earns marks (the meta coin) over time. This is the
// third pillar's idle hook (the Orrery + Crucible already accrue offline); it's a
// NUDGE to return, not a grind-replacer — a full 48h haul ≈ one solid active run.

export const GARRISON_CAP_MS = 48 * 3600_000 // beyond two days the salvage piles up no further

// marks/hour from all held breaches — deeper + higher tiers pay more
export function garrisonRatePerHour(m: ExpedMeta): number {
  let r = 0
  for (const rec of m.records) {
    if (rec.wave <= 0) continue
    r += rec.wave * (1 + 0.4 * (rec.tier - 1)) * 0.55
  }
  return r
}

// preview the pending haul WITHOUT mutating (deck / expeditions display)
export function garrisonPending(m: ExpedMeta, now: number): { marks: number; ms: number } {
  if (m.garrisonTick == null) return { marks: 0, ms: 0 }
  const ms = Math.min(Math.max(0, now - m.garrisonTick), GARRISON_CAP_MS)
  const marks = Math.floor(garrisonRatePerHour(m) * (ms / 3600_000))
  return { marks, ms }
}

// Settle the garrison: returns whole marks to bank into the host + the advanced
// meta. Idempotent by timestamp — whoever loads first banks, the next sees ~0.
// Advances the tick ONLY by the time the banked whole-marks represent (the
// sub-mark remainder carries), and discards overflow past the cap.
export function settleGarrison(m: ExpedMeta, now: number): { meta: ExpedMeta; marks: number } {
  if (m.garrisonTick == null) return { meta: { ...m, garrisonTick: now }, marks: 0 }
  const rate = garrisonRatePerHour(m)
  const rawMs = Math.max(0, now - m.garrisonTick)
  const ms = Math.min(rawMs, GARRISON_CAP_MS)
  if (rate <= 0 || ms <= 0) return { meta: { ...m, garrisonTick: now }, marks: 0 }
  const marks = Math.floor(rate * (ms / 3600_000))
  // past the cap → discard overflow, reset to now. Within cap → advance only by
  // the banked whole marks so the fractional remainder isn't lost across visits.
  const nextTick = rawMs > GARRISON_CAP_MS ? now : m.garrisonTick + (marks > 0 ? (marks / rate) * 3600_000 : 0)
  return { meta: { ...m, garrisonTick: nextTick }, marks }
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
