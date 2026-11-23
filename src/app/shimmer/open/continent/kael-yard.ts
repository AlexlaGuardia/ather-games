// ── KAEL'S YARD, FOR THE OPENING CHAIN (BETA M73 s3) ──────────────────────────────────────────────────────────────────────
// Is the keeper standing in Kael's yard (the inherited shipyard plot above Rune Hold, business/shipyards.ts KAEL_SHIPYARD)?
// The chain's yard step lands there and the journal page is found (shared/opening-chain-store.ts › useChainYard). Inside the
// fence only: the road past the gate does not count.
import type { Region } from '../region'
import { shipyardSites, KAEL_SHIPYARD } from '../business/shipyards'
import { plotToLocal, PLOT } from '../business/shipyard-plots'

export function inKaelYard(R: Region, x: number, z: number): boolean {
  const s = shipyardSites(R).find(q => q.key === KAEL_SHIPYARD); if (!s) return false
  const l = plotToLocal(s.plot.frame, x, z)
  return Math.abs(l.lx) < PLOT / 2 && Math.abs(l.lz) < PLOT / 2
}
