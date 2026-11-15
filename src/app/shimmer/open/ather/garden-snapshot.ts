// What a cluster-mate sees of your Ather plot: the squares you hold, nothing else (Alex 09-23: a mate's plot is
// read-only to you). One pure checker, run on the way into the server (api/cluster/garden) AND on the way into a
// mate's world, because a snapshot is somebody else's data. Node-safe: no React, no DOM.

export const GARDEN_MAX_BYTES = 2048
export interface GardenSnap { v: 1; owned: string[] }

export function readGarden(text: string): GardenSnap | null {
  if (!text || text.length > GARDEN_MAX_BYTES) return null
  try {
    const v = JSON.parse(text)
    if (!v || v.v !== 1 || !Array.isArray(v.owned) || v.owned.length > 81) return null
    const owned = [...new Set(v.owned as unknown[])].filter((s): s is string => typeof s === 'string' && /^[0-8],[0-8]$/.test(s))
    if (owned.length !== v.owned.length) return null
    return { v: 1, owned: owned.sort() }
  } catch { return null }
}
export const gardenText = (owned: readonly string[]) => JSON.stringify({ v: 1, owned: [...owned].sort() })
