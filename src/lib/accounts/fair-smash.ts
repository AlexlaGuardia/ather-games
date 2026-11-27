// ── THE THISTLEDOWN FAIR'S SMASH BOARD (BETA M233 s1): the season's best bell hit per keeper, shared by every keeper.
// Rules: app/shimmer/open/ather/fair-smash-rules.ts. WHO YOU ARE is the session (api/fair/smash); the body only names the
// hit and the spirit. Anyone reads the board; only a signed-in keeper swings, SMASH_TRIES a day (counted here, server side).
// The hit is the client's battle roll (fair-smash.ts): the honest trade is a sanity cap (MAX_HIT), not a replay.
// Run: npx tsx src/lib/accounts/fair-smash.test.ts
import { accountsDb } from './db'
import { BOARD_TOP, SMASH_TRIES, cleanHit, cleanSpirit, smashDay, type SmashBoard, type SmashRow } from '@/app/shimmer/open/ather/fair-smash-rules'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const triesUsed = (user_id: string, day: string) =>
  Number((accountsDb().prepare('SELECT n FROM fair_smash_tries WHERE user_id = ? AND day = ?').get(user_id, day) as { n: number } | undefined)?.n ?? 0)

export function smashBoard(season: number, viewer: string | null, now = Date.now()): SmashBoard {
  const rows = accountsDb().prepare(`SELECT s.user_id, s.best, s.spirit, a.username AS who FROM fair_smash s JOIN accounts a ON a.user_id = s.user_id
    WHERE s.season = ? ORDER BY s.best DESC, s.at ASC LIMIT ?`).all(season, BOARD_TOP) as unknown as { user_id: string; best: number; spirit: string; who: string | null }[]
  const top: SmashRow[] = rows.map(r => ({ who: r.who ?? 'a keeper', best: r.best, spirit: r.spirit, mine: r.user_id === viewer }))
  const mine = viewer ? accountsDb().prepare('SELECT best FROM fair_smash WHERE season = ? AND user_id = ?').get(season, viewer) as { best: number } | undefined : undefined
  return { season, top, signedIn: !!viewer, best: mine?.best ?? null, triesLeft: viewer ? Math.max(0, SMASH_TRIES - triesUsed(viewer, smashDay(now))) : 0 }
}

/** one swing: spends a try, keeps the keeper's best for the season */
export function recordSmash(user_id: string, season: number, body: Record<string, unknown>, now = Date.now()): Result<SmashBoard> {
  const hit = cleanHit(body.hit)
  if (hit == null) return { ok: false, error: 'Not a hit.' }
  const day = smashDay(now), used = triesUsed(user_id, day)
  if (used >= SMASH_TRIES) return { ok: false, error: 'No tries left today.' }
  const d = accountsDb()
  d.prepare('INSERT INTO fair_smash_tries (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET n = n + 1').run(user_id, day)
  d.prepare(`INSERT INTO fair_smash (season, user_id, best, spirit, at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(season, user_id) DO UPDATE SET best = excluded.best, spirit = excluded.spirit, at = excluded.at WHERE excluded.best > fair_smash.best`)
    .run(season, user_id, hit, cleanSpirit(body.spirit), now)
  return { ok: true, value: smashBoard(season, user_id, now) }
}
