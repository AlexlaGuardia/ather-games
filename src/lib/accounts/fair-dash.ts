// ── THE THISTLEDOWN FAIR'S DASH BOARD + GHOST POOL (BETA M233 s2): the season's best race time per keeper, and the spirit +
// stats that ran it. That row IS the keeper's ghost: other keepers race it (the client re-runs the race on those stats, never
// a live player). Rules: app/shimmer/open/ather/fair-dash-rules.ts. WHO YOU ARE is the session (api/fair/dash); the body names
// the time, the spirit and her stats. Anyone reads the board; only a signed-in keeper races for the board, DASH_TRIES a day.
// The time is the client's race (fair-dash-race.ts): the honest trade is a sanity window (MIN_MS..MAX_MS), not a replay.
// Run: npx tsx src/lib/accounts/fair-dash.test.ts
import { accountsDb } from './db'
import { BOARD_TOP, DASH_TRIES, RACERS, cleanElement, cleanName, cleanSpecies, cleanStats, cleanTime, dashDay, type DashBoard, type DashGhost, type DashRow, type RaceStats } from '@/app/shimmer/open/ather/fair-dash-rules'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const triesUsed = (user_id: string, day: string) =>
  Number((accountsDb().prepare('SELECT n FROM fair_dash_tries WHERE user_id = ? AND day = ?').get(user_id, day) as { n: number } | undefined)?.n ?? 0)

/** up to RACERS - 1 ghosts from other keepers' entries this season (a random draw each time) */
export function dashGhosts(season: number, viewer: string | null): DashGhost[] {
  const rows = accountsDb().prepare(`SELECT d.spirit, d.species, d.element, d.stats, a.username AS who FROM fair_dash d JOIN accounts a ON a.user_id = d.user_id
    WHERE d.season = ? AND d.user_id != ? ORDER BY RANDOM() LIMIT ?`).all(season, viewer ?? '', RACERS - 1) as unknown as { spirit: string; species: string; element: string; stats: string; who: string | null }[]
  return rows.flatMap(r => {
    let stats: RaceStats | null = null
    try { stats = cleanStats(JSON.parse(r.stats)) } catch { /* a bad row races no one */ }
    return stats ? [{ who: r.who ?? 'a keeper', spirit: r.spirit, species: r.species, element: r.element, stats }] : []
  })
}

export function dashBoard(season: number, viewer: string | null, now = Date.now()): DashBoard {
  const rows = accountsDb().prepare(`SELECT d.user_id, d.ms, d.spirit, a.username AS who FROM fair_dash d JOIN accounts a ON a.user_id = d.user_id
    WHERE d.season = ? ORDER BY d.ms ASC, d.at ASC LIMIT ?`).all(season, BOARD_TOP) as unknown as { user_id: string; ms: number; spirit: string; who: string | null }[]
  const top: DashRow[] = rows.map(r => ({ who: r.who ?? 'a keeper', ms: r.ms, spirit: r.spirit, mine: r.user_id === viewer }))
  const mine = viewer ? accountsDb().prepare('SELECT ms FROM fair_dash WHERE season = ? AND user_id = ?').get(season, viewer) as { ms: number } | undefined : undefined
  return { season, top, signedIn: !!viewer, best: mine?.ms ?? null, triesLeft: viewer ? Math.max(0, DASH_TRIES - triesUsed(viewer, dashDay(now))) : 0, ghosts: dashGhosts(season, viewer) }
}

/** one finished race: spends a try, keeps the keeper's best (fastest) time for the season, and that run's spirit as their ghost */
export function recordDash(user_id: string, season: number, body: Record<string, unknown>, now = Date.now()): Result<DashBoard> {
  const ms = cleanTime(body.ms)
  if (ms == null) return { ok: false, error: 'Not a race time.' }
  const species = cleanSpecies(body.species), stats = cleanStats(body.stats)
  if (!species || !stats) return { ok: false, error: 'Not a racer.' }
  const day = dashDay(now), used = triesUsed(user_id, day)
  if (used >= DASH_TRIES) return { ok: false, error: 'No races left today.' }
  const d = accountsDb()
  d.prepare('INSERT INTO fair_dash_tries (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET n = n + 1').run(user_id, day)
  d.prepare(`INSERT INTO fair_dash (season, user_id, ms, spirit, species, element, stats, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(season, user_id) DO UPDATE SET ms = excluded.ms, spirit = excluded.spirit, species = excluded.species, element = excluded.element,
    stats = excluded.stats, at = excluded.at WHERE excluded.ms < fair_dash.ms`)
    .run(season, user_id, ms, cleanName(body.spirit), species, cleanElement(body.element), JSON.stringify(stats), now)
  return { ok: true, value: dashBoard(season, user_id, now) }
}
