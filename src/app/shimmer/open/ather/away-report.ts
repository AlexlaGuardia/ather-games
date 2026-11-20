// "WHILE YOU WERE AWAY" (one line, many sources). The village tick (page.tsx runVillage: idle yields, the farm) and the
// station catch-up (workshop.tsx stationTick: the Moglin's stockpile since M43a) both report what they made while the keeper
// was gone; this gathers them for a moment and says it ONCE. Before: only the village reported, so station work was silent.
import { hudSay } from '../shared/hud-say'
import { itemDef } from '../shared/inventory'

export type Made = Record<string, number>
/** the line, or null when nothing was made. PURE (item names only). */
export function awayText(made: Made): string | null {
  const names = Object.entries(made).filter(([, n]) => n > 0).map(([id, n]) => `${n} ${itemDef(id).name}`)
  return names.length ? `While you were away, your village made ${names.join(', ')}. You will find it all in the rooms' stores.` : null
}
export function addMade(into: Made, more: Made | readonly { id: string; n: number }[]): Made {
  for (const [id, n] of Array.isArray(more) ? more.map(s => [s.id, s.n] as const) : Object.entries(more)) into[id] = (into[id] ?? 0) + n
  return into
}

let pending: Made = {}, timer: ReturnType<typeof setTimeout> | null = null
/** Report what was made while away; reports within `wait` ms of the first one join into one line (an info line held 9 s,
 *  after the arrival lines). */
export function reportAway(made: Made | readonly { id: string; n: number }[], wait = 1500) {
  addMade(pending, made)
  if (timer) return
  timer = setTimeout(() => { timer = null; const t = awayText(pending); pending = {}; if (t) hudSay(t, 'info', 9) }, wait)
}
