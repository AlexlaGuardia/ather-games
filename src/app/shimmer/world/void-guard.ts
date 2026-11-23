// BETA M104: THE PUBLISH GUARD for the void brush. A Wilds publish whose layer carries void edits (void-edits.ts) is refused when
// any region the keeper reaches ON FOOT from Moonwell with no voids at all is no longer reachable with the edited voids (the M41
// walk: wilds-voids.test.ts section 3, now void-edits.ts onFootRegions). The answer names the zone(s), so the owner knows where.
// PURE: the route reads tiles.json + the season's network and hands them in.
import { makeVoids, FALL_W, type IndexLike } from '../open/ather/wilds-voids'
import { sealedRegions, sealedMessage, type VoidEdits } from '../open/ather/void-edits'
import { GLADE } from '../open/ather/relief'
import type { Network } from '../open/ather/network'

/** '' = publish may go ahead; else the refusal, naming each sealed zone */
export function voidGuard(index: IndexLike, net: Network | null, voids: VoidEdits | undefined): string {
  if (!voids || !Object.keys(voids).length) return ''   // the generated voids alone seal nothing (wilds-voids.test 3)
  const V = makeVoids(index, net, [], voids)
  return sealedMessage(sealedRegions(V, GLADE.gx, GLADE.gz, FALL_W))
}
