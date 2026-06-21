// ARCADE TOOLKIT — the Daily Challenge. One seeded run per UTC day, the SAME course
// for everyone, with a shareable result. Any score-chase game opts in: seed its world
// from dailySeed(), track its best with load/saveDailyBest(), and offer dailyShare().
// (Rekindle had its own date-seed first; this is the shared, reusable version.)

const EPOCH = Date.UTC(2026, 0, 1) // "Daily #1" = 2026-01-01 (UTC)

// "YYYY-MM-DD" for the current UTC day — the storage + display key.
export function dailyKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// a uint32 seed derived from the UTC day — identical for everyone, every game.
export function dailySeed(d: Date = new Date()): number {
  return (d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()) >>> 0
}

// the running day index, for "Daily #123" labels.
export function dailyNumber(d: Date = new Date()): number {
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.floor((today - EPOCH) / 86400000) + 1
}

// per-game daily best, keyed by day (replay freely; your BEST is the day's score).
const storeKey = (gameId: string, key: string) => `daily.${gameId}.${key}`

export function loadDailyBest(gameId: string, key: string = dailyKey()): number {
  try {
    return Math.max(0, +(localStorage.getItem(storeKey(gameId, key)) || 0) || 0)
  } catch {
    return 0
  }
}

export function saveDailyBest(gameId: string, score: number, key: string = dailyKey()): number {
  try {
    const best = Math.max(score, loadDailyBest(gameId, key))
    localStorage.setItem(storeKey(gameId, key), String(best))
    return best
  } catch {
    return score
  }
}

// a Wordle-flavoured share line — no link spam, just the brag + the domain.
export function dailyShare(gameName: string, score: number, d: Date = new Date()): string {
  return `${gameName} · Daily #${dailyNumber(d)}\nscore ${score}\nather.games`
}

// copy to clipboard; returns whether it landed (caller can fall back to "copied?" UI).
export async function copyShare(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
