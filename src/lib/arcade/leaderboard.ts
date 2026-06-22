// ARCADE TOOLKIT — the Daily leaderboard client. A game submits its daily score
// with submitDailyScore(); the board + the player's rank come back. Identity is a
// per-browser id + an editable display name (no accounts), persisted locally.

import { dailyKey } from './daily'

export type LbEntry = { id: string; name: string; score: number; ts: number }
export type LbResult = {
  day: string
  number: number
  count: number
  top: LbEntry[]
  rank?: number | null
  best?: number
}

const PLAYER_KEY = 'arcade.player'

export type Player = { id: string; name: string }

// stable per-browser id + display name. id is opaque; name is what shows on the board.
export function getPlayer(): Player {
  try {
    const raw = localStorage.getItem(PLAYER_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Player
      if (p && p.id) return { id: p.id, name: p.name || 'wanderer' }
    }
  } catch {}
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  const p = { id, name: 'wanderer' }
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(p)) } catch {}
  return p
}

export function setPlayerName(name: string): Player {
  const p = getPlayer()
  const next = { ...p, name: (name || '').trim().slice(0, 16) || 'wanderer' }
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(next)) } catch {}
  return next
}

export async function fetchDailyBoard(gameId: string, day: string = dailyKey()): Promise<LbResult | null> {
  try {
    const r = await fetch(`/api/arcade/leaderboard?game=${encodeURIComponent(gameId)}&day=${day}`, { cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json()) as LbResult
  } catch {
    return null
  }
}

// submit (idempotent per player/day — server keeps your best). Returns the fresh board.
export async function submitDailyScore(gameId: string, score: number, day: string = dailyKey()): Promise<LbResult | null> {
  const p = getPlayer()
  try {
    const r = await fetch('/api/arcade/leaderboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: gameId, score: Math.max(0, Math.floor(score)), id: p.id, name: p.name, day }),
    })
    if (!r.ok) return null
    return (await r.json()) as LbResult
  } catch {
    return null
  }
}
