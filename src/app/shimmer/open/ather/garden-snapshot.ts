// What a cluster-mate sees of your Ather plot: the squares you hold, nothing else (Alex 09-23: a mate's plot is
// read-only to you). One pure checker, run on the way into the server (api/cluster/garden) AND on the way into a
// mate's world, because a snapshot is somebody else's data. Node-safe: no React, no DOM.

//
// v1 = the centred-start 9×9; v2 = the corner-start 9×9 (Alex 11-15, the cluster sketch); v3 = the corner-start 15×15
// of 20 m squares (300 m, RULED 11-15). Older snapshots are still accepted and read through the same moves a local save
// takes, so a mate who has not loaded since keeps their garden in the new frame instead of vanishing.

export const GARDEN_MAX_BYTES = 2600   // 225 ids at up to 7 bytes each, with the frame
/** The garden layout a save or snapshot is written in. */
export const LAYOUT = 3
export interface GardenSnap { v: 3; owned: string[] }
const ID = /^([0-9]|1[0-4]),([0-9]|1[0-4])$/

/** The 9×9 corner start → the 15×15's: the start corner (south-west) is the anchor, so every square keeps its place
 *  counted from the corner: rows move down by 6 (j 8 → 14). */
export const cornerTo15 = (owned: readonly string[]) => owned.map(id => { const [i, j] = id.split(',').map(Number); return `${i},${j + 6}` })

/** The old centred layout → the corner start: every square moves 3 west and 3 south (the old middle 3×3 lands on
 *  the new start corner). Squares the move pushes off the 9×9 grid come back in `dropped`. */
export function shiftLegacyOwned(owned: readonly string[]): { kept: string[]; dropped: string[] } {
  const kept: string[] = [], dropped: string[] = []
  for (const id of owned) {
    const [i, j] = id.split(',').map(Number), ni = i - 3, nj = j + 3
    if (ni >= 0 && nj >= 0 && ni < 9 && nj < 9) kept.push(`${ni},${nj}`); else dropped.push(id)
  }
  return { kept, dropped }
}

export function readGarden(text: string): GardenSnap | null {
  if (!text || text.length > GARDEN_MAX_BYTES) return null
  try {
    const v = JSON.parse(text)
    if (!v || (v.v !== 1 && v.v !== 2 && v.v !== 3) || !Array.isArray(v.owned) || v.owned.length > (v.v === 3 ? 225 : 81)) return null
    const ok = v.v === 3 ? ID : /^[0-8],[0-8]$/
    const owned = [...new Set(v.owned as unknown[])].filter((s): s is string => typeof s === 'string' && ok.test(s))
    if (owned.length !== v.owned.length) return null
    const now = v.v === 1 ? cornerTo15(shiftLegacyOwned(owned).kept) : v.v === 2 ? cornerTo15(owned) : owned
    return { v: 3, owned: now.sort() }
  } catch { return null }
}
export const gardenText = (owned: readonly string[]) => JSON.stringify({ v: 3, owned: [...owned].sort() })
