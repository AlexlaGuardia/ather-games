/**
 * stillwind-road.ts — THE STILLWIND'S ROAD: what a keeper carries out of the Breach lab, for good.
 *
 * ── ★ CANON (athernyx `3d2a7b2`, `game/season-01-lenna.md` › The colossus; CANON_GAPS › the Stillwind raid) ──
 * The Lenn recorded where the wind stalls and in what pattern. Reading their notes (the lab's capstone study,
 * `hold.ts` › LAB_NODES 'road') tells a keeper where and when the Stillwind walks, NEVER what it is, and that
 * opens the road to it. The notes are a found thing carried out: access, never power. The raid closes with
 * the season's window (so does the whole planet); the deed stays on Lenna's archive page.
 *
 * ── JIN'S CALLS ──
 *   · stored per keeper (the ledger, like vessel pieces), with the season it belongs to
 *   · ⚠ the season WINDOW is not built yet: until it is, a known road stays known. When the window lands,
 *     `roadOpen` is where "closed with the window" gets enforced, so there is one place to change
 */
import { keeperKey } from '@/lib/keeper-local'

export const ROAD_KEY = 'ather:shimmer:stillwind-road'
export const ROAD_SEASON = 'lenna'
/** What the Lenn's notes say when the road is read. Lark's draft #1 (09-28), ⚠ AWAITING ALEX'S SIGN-OFF — his
 *  alternates: "Watch the wind. Where it stops, and when — that is its road." · "It comes without wind. Mark the
 *  place the wind dies — that ground is its path." Where and when, never what (canon 3d2a7b2). */
export const ROAD_LINE = 'The wind dies before it comes. Mark where it dies — that is where it walks.'
export interface RoadRecord { season: string; at: number }

export function loadRoad(): RoadRecord | null {
  try {
    const raw = localStorage.getItem(keeperKey(ROAD_KEY))
    if (!raw) return null
    const r = JSON.parse(raw) as Partial<RoadRecord>
    return typeof r.season === 'string' && typeof r.at === 'number' ? { season: r.season, at: r.at } : null
  } catch { return null }
}
export function saveRoad(now: number = Date.now()): RoadRecord {
  const r: RoadRecord = { season: ROAD_SEASON, at: now }
  try { localStorage.setItem(keeperKey(ROAD_KEY), JSON.stringify(r)) } catch { /* private mode */ }
  return r
}
/** Is the Stillwind's road open to this keeper right now? (The season window will narrow this.) */
export const roadOpen = (r: RoadRecord | null): boolean => !!r && r.season === ROAD_SEASON
