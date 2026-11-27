// ── THE THISTLEDOWN FAIR'S CLASH TENTS (BETA M233 s3), server side: which tents a keeper has WON this season, and the tent's
// Marks prize paid ONCE per tent per season. No board (boards are Dash's). Rules: app/shimmer/open/ather/fair-clash-rules.ts.
// WHO YOU ARE is the session (api/fair/clash); the body names the tent, its tier and the spirit. The bouts are fought on the
// client (the turn-based battle); the honest trade is once-a-season per tent, not a replay.
// Run: npx tsx src/lib/accounts/fair-clash.test.ts
import { accountsDb } from './db'
import { CLASH_OPEN, CLASH_PRIZE, cleanTent, isClashTier, type ClashClaim, type ClashState } from '@/app/shimmer/open/ather/fair-clash-rules'
import { cleanSpirit } from '@/app/shimmer/open/ather/fair-smash-rules'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export function clashState(season: number, viewer: string | null): ClashState {
  const won = viewer ? (accountsDb().prepare('SELECT tent FROM fair_clash WHERE season = ? AND user_id = ? ORDER BY tent').all(season, viewer) as unknown as { tent: number }[]).map(r => r.tent) : []
  return { season, signedIn: !!viewer, won }
}

/** the keeper beat a tent's whole line-up: the first win of the season pays the tent's prize, a later one pays nothing */
export function recordClash(user_id: string, season: number, body: Record<string, unknown>, now = Date.now()): Result<ClashClaim> {
  const tent = cleanTent(body.tent), level = body.level
  if (tent == null) return { ok: false, error: 'Not a tent.' }
  if (!isClashTier(level)) return { ok: false, error: 'Not a tent.' }
  if (!CLASH_OPEN[level]) return { ok: false, error: 'This tent opens later in the season.' }
  const r = accountsDb().prepare('INSERT INTO fair_clash (season, user_id, tent, level, spirit, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(season, user_id, tent) DO NOTHING')
    .run(season, user_id, tent, level, cleanSpirit(body.spirit), now)
  const first = Number(r.changes) > 0
  return { ok: true, value: { ...clashState(season, user_id), first, prize: first ? CLASH_PRIZE[level] : 0 } }
}
