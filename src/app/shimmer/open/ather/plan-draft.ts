// BETA M138: the PLAN as one thing: what is only planned (drafts on every level), thrown away or found again. A draft never cost
// anything (plot-bom.ts pays at Build), so throwing it away gives nothing back and touches nothing that stands. PURE.
// Any planned PIECE (works.planned, M143) is part of the plan too: Build pays it, Cancel drops it.
import { levelOf, levelCount, levelsOf, withLevel, type Level, type Stacked } from './plot-floors'
import { edgeEnds, findRooms, type Walls, type PlotRoom, type Paid } from './plot-walls'

type Drafted = { draft?: true }
export type Planned = Stacked & { planned?: readonly { x: number; z: number }[] }
const isDraft = (x: object) => (x as Drafted).draft === true
const stand = <T extends Drafted>(m: Readonly<Record<string, T>> | undefined): Readonly<Record<string, T>> | undefined => {
  if (!m || !Object.values(m).some(isDraft)) return m   // nothing planned here: the same object back
  return Object.fromEntries(Object.entries(m).filter(([, x]) => !isDraft(x)))
}
const count = (m: Readonly<Record<string, Drafted>> | undefined) => (m ? Object.values(m).filter(isDraft).length : 0)
const onLevel = (lv: Level) => count(lv.walls) + count(lv.cols) + count(lv.stairs) + count(lv.decks)

/** how much is planned on each level (index 0 = the ground), planned pieces apart */
export const draftsByLevel = (w: Planned): number[] => levelsOf(w).map(onLevel)
export const draftPieces = (w: Planned): number => w.planned?.length ?? 0
export const hasDraft = (w: Planned): boolean => draftPieces(w) > 0 || draftsByLevel(w).some(n => n > 0)

/** CANCEL PLAN: every level's drafts gone, everything built exactly as it stands (paid rooms, floors, tints, upper levels) */
export function cancelPlan<T extends Planned>(w: T): T {
  let out: T = w
  for (let k = levelCount(w) - 1; k >= 0; k--) {   // top down: an upper level left empty is no level (withLevel drops it)
    const lv = levelOf(out, k); if (!onLevel(lv)) continue
    out = withLevel(out, k, { ...lv, walls: stand(lv.walls) as Walls, ...(lv.cols ? { cols: stand(lv.cols) } : {}), ...(lv.stairs ? { stairs: stand(lv.stairs) } : {}), ...(lv.decks ? { decks: stand(lv.decks) } : {}) })
  }
  if (out.planned) { const { planned: _p, ...rest } = out; void _p; out = rest as T }
  return out
}

/** EDIT PLAN: the level to open (`at` when something is planned there, else the lowest with drafts) and the middle of its drafts */
export function planSpot(w: Planned, at: number): { level: number; x: number; z: number } | null {
  const n = draftsByLevel(w), pcs = w.planned ?? []; let level = n[at] ? at : n.findIndex(x => x > 0)
  if (pcs.length && (level < 0 || at === 0)) level = 0   // planned pieces stand on the ground floor
  if (level < 0) return null
  const lv = levelOf(w, level), pts: [number, number][] = []
  for (const [k, x] of Object.entries(lv.walls)) if (isDraft(x)) pts.push(...edgeEnds(k))
  for (const m of [lv.cols, lv.stairs, lv.decks]) for (const [k, x] of Object.entries((m ?? {}) as Record<string, Drafted>)) if (isDraft(x)) { const [i, j] = k.split(',').map(Number); pts.push([i + 0.5, j + 0.5]) }
  if (level === 0) for (const p of pcs) pts.push([p.x, p.z])
  const mid = (a: number) => { const v = pts.map(p => p[a]); return (Math.min(...v) + Math.max(...v)) / 2 }
  return { level, x: mid(0), z: mid(1) }
}
/** the planned ones of these wall pieces (an edit takes out the plan's own, never a standing wall) */
export const draftKeys = (walls: Walls, keys: string[]) => keys.filter(k => walls[k]?.draft)
/** M143: is this planned room cut out of a floor that is already built and paid (a drafted divider across it)? Its floor is not the
 *  plan's to repaint: a free repaint would stay after Cancel, and come back as materials nobody paid. */
export function builtUnderPlan(walls: Walls, paid: Paid | undefined, room: PlotRoom): boolean {
  if ((paid ?? {})[room.key]) return false
  const cells = new Set(room.cells.map(String))
  return findRooms(stand(walls)!).some(r => (paid ?? {})[r.key] !== undefined && r.cells.some(c => cells.has(String(c))))
}
