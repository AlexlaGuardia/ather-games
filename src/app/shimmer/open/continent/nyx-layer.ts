// ── THE NYX CONTINENT'S BUILDER LAYER, IN THE GAME (BETA M83 s3) ──
// The World Builder sculpts the continent on virtual 1 km tiles (world/nyx-builder.ts); a Publish writes world/nyx-edits.json,
// served at GET /shimmer/open/nyx-edits (no build). The continent page fetches it once, right after the region loads and BEFORE
// the first render, and adds the deltas to the region's height grid in place: the terrain mesh, heightAt, groundAt (what the
// courser drives and the walker stands on), water tests and tree placement all read that one array, so nothing re-derives.
// No layer / a failed fetch = the continent exactly as exported. Painted water and falls lines are not drawn on the continent yet.
import { cleanEdits } from '../ather/wilds-edits'
import { applyNyxLayer, NYX_REGION } from '../../world/nyx-builder'
import type { Region } from '../region'

/** Apply the published layer to a just-loaded region (only the Nyx continent export; any other ?region= is left alone).
 *  Returns how many vertices moved (0 = nothing published, or not the continent). */
export async function applyPublishedNyxLayer(R: Region): Promise<number> {
  if (R.meta.name !== NYX_REGION) return 0
  try {
    const r = await fetch('/shimmer/open/nyx-edits', { cache: 'no-store' })
    if (!r.ok) return 0
    return applyNyxLayer(R.meta, R.h, cleanEdits(await r.json()))
  } catch { return 0 }
}
