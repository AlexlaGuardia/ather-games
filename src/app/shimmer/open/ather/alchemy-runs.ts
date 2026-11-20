// M57: what each placed alchemy piece is working on (alchemy-set.ts says what a step IS; this says which step a station is
// running and when it finishes). One run per piece. The inputs are spent when the run starts, the product lands in the bag
// when it is collected after `start + ms`. Saved per keeper (open.alchemy.v1). A run outlives the panel: close it, walk off,
// come back, the product is waiting. Run: npx tsx src/app/shimmer/open/ather/alchemy-runs.test.ts
import { keeperKey } from '@/lib/keeper-local'
import { ALC_POTIONS, pickFor, stepMakes, type Have } from './alchemy-set'

export interface Run { potion: string; k: number; spent: { id: string; n: number }[]; start: number; ms: number }
export type Runs = Record<string, Run>   // piece id → its run

export const runLeft = (r: Run, now: number) => Math.max(0, r.start + r.ms - now)
export const runFrac = (r: Run, now: number) => r.ms <= 0 ? 1 : Math.min(1, (now - r.start) / r.ms)
export const runDone = (r: Run, now: number) => runLeft(r, now) === 0

/** Start step `k` of `potion` at piece `pid`: what to spend, and the runs after. Null if the piece is busy or the bag is short. */
export function startRun(runs: Runs, pid: string, potion: string, k: number, have: Have, now: number): { runs: Runs; spend: { id: string; n: number }[] } | null {
  if (runs[pid]) return null
  const st = ALC_POTIONS[potion]?.steps[k]
  if (!st) return null
  const spend = pickFor(st, have)
  if (!spend) return null
  return { runs: { ...runs, [pid]: { potion, k, spent: spend, start: now, ms: st.ms } }, spend }
}

/** Collect a finished run: the product, and the runs without it. Null while it is still going. */
export function collectRun(runs: Runs, pid: string, now: number): { runs: Runs; got: { id: string; n: number } } | null {
  const r = runs[pid]
  if (!r || !runDone(r, now)) return null
  const rest = { ...runs }; delete rest[pid]
  return { runs: rest, got: stepMakes(r.potion, r.k, r.spent) }
}

/** A piece picked up with a run on it gives the inputs back (nothing is lost by moving furniture). */
export function dropRun(runs: Runs, pid: string): { runs: Runs; back: { id: string; n: number }[] } {
  const r = runs[pid]
  if (!r) return { runs, back: [] }
  const rest = { ...runs }; delete rest[pid]
  return { runs: rest, back: r.spent }
}

export function adoptRuns(v: unknown): Runs {
  const out: Runs = {}
  if (!v || typeof v !== 'object') return out
  for (const [pid, r] of Object.entries(v as Record<string, Run>)) {
    if (!r || typeof r !== 'object' || !(r.potion in ALC_POTIONS) || !ALC_POTIONS[r.potion].steps[r.k]) continue
    if (!Number.isFinite(r.start) || !Number.isFinite(r.ms) || !Array.isArray(r.spent)) continue
    out[pid] = { potion: r.potion, k: r.k, start: r.start, ms: r.ms, spent: r.spent.filter(s => s && typeof s.id === 'string' && Number.isFinite(s.n) && s.n > 0) }
  }
  return out
}
export const RUNS_KEY = 'open.alchemy.v1'
export function loadRuns(): Runs { try { return adoptRuns(JSON.parse(localStorage.getItem(keeperKey(RUNS_KEY)) ?? 'null')) } catch { return {} } }
export function saveRuns(r: Runs) { try { localStorage.setItem(keeperKey(RUNS_KEY), JSON.stringify(r)) } catch { /* private window */ } }
