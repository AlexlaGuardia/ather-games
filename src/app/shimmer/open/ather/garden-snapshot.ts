// What a cluster-mate sees of your Ather plot: the squares you hold, nothing else (Alex 09-23: a mate's plot is
// read-only to you). One pure checker, run on the way into the server (api/cluster/garden) AND on the way into a
// mate's world, because a snapshot is somebody else's data. Node-safe: no React, no DOM.

//
// v1 = the centred-start layout; v2 = the corner start (Alex 11-15, the cluster sketch). A v1 snapshot is still
// accepted and read through the same shift a local save takes (old centre 3×3 → the corner), so a mate who has not
// loaded since keeps their garden in the new frame instead of vanishing.

export const GARDEN_MAX_BYTES = 2048
/** The garden layout a save or snapshot is written in. */
export const LAYOUT = 2
export interface GardenSnap { v: 2; owned: string[] }

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
    if (!v || (v.v !== 1 && v.v !== 2) || !Array.isArray(v.owned) || v.owned.length > 81) return null
    const owned = [...new Set(v.owned as unknown[])].filter((s): s is string => typeof s === 'string' && /^[0-8],[0-8]$/.test(s))
    if (owned.length !== v.owned.length) return null
    return { v: 2, owned: (v.v === 1 ? shiftLegacyOwned(owned).kept : owned).sort() }
  } catch { return null }
}
export const gardenText = (owned: readonly string[]) => JSON.stringify({ v: 2, owned: [...owned].sort() })
