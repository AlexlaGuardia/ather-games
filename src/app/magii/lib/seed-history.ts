// ── Recent table seeds ────────────────────────────────────────────────────────
//
// Every game is dealt from a seed, so any table can be dealt again exactly. This keeps the
// recent ones so a player can say "table 8F3K2Q dealt me a hand that could not be scored"
// and it can be reproduced instead of guessed at.
//
// It expires on purpose. A seed is only useful while the game is fresh in someone's memory,
// and an unbounded list of every table you ever sat at is a small pile of stale data that
// exists for no one's benefit. Kept device-local, never sent anywhere.

const KEY = 'ather:magii:seeds'
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // a week — long enough to report a game, short enough to forget it
const MAX = 20

export interface SeedRecord {
  seed: string
  collection: string
  at: number
}

function read(): SeedRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const rows = JSON.parse(raw) as SeedRecord[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return [] // unreadable or blocked storage is not worth an error path here
  }
}

/** Prune on every read AND write, so an abandoned tab cannot leave stale rows behind. */
function fresh(rows: SeedRecord[], now: number): SeedRecord[] {
  return rows.filter(r => r && typeof r.seed === 'string' && now - r.at < TTL_MS).slice(0, MAX)
}

export function recentSeeds(now = Date.now()): SeedRecord[] {
  return fresh(read(), now)
}

export function rememberSeed(seed: string, collection: string, now = Date.now()): void {
  try {
    const rows = fresh([{ seed, collection, at: now }, ...read().filter(r => r.seed !== seed)], now)
    localStorage.setItem(KEY, JSON.stringify(rows))
  } catch {
    // Private mode or a full quota. Losing the history is harmless; never break the deal over it.
  }
}
