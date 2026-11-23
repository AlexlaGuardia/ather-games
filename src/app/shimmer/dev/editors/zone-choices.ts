// ── BETA M114: what a building zone's tag dropdowns list. EXISTING data only, never a new name (Alex 11-23; hub brief) ──
//   HOME     who lives there: the named folk of the map being built. Moonwell Glade: Gregory, the three friends and the Moglins of
//            the Glade (moonwell-glade.ts gladeFolk + glade-cluster.ts). The Wilds: every Moglin of the season's settlements
//            (settlement-folk.ts folkOf, names from the canon pool), labelled with their settlement. The Nyx continent: no list of
//            continent residents exists yet, so its list is the Glade's + the Wilds' (flagged in the M84 s1 report).
//   SHOP     the canon storefronts (business/doors.ts FRONT_SHOPS): one entry per shop, its own name.
//   SUPPLIER no 'supplier' list exists anywhere in the game or the canon files (11-23). Stand-in: the trade goods (trade.ts GOODS),
//            "who supplies what", by the good's own name. FLAGGED for the hub / Magii; swap the source here when one is ruled.
import type { BuilderMap } from '../../world/builder'
import type { ZoneKind } from '../../world/builder-zones'
import { FRONT_SHOPS } from '../../open/business/doors'
import { GOODS } from '../../open/trade'
import { folkOf } from '../../open/ather/settlement-folk'
import { gladeFolk } from '../../open/ather/moonwell-glade'
import { gladeKeepers, gladeClusterFolk, gregInGlade } from '../../open/ather/glade-cluster'
import type { Network } from '../../open/ather/network'

export interface Choice { ref: string; name: string }

const dedupe = (a: Choice[]) => { const seen = new Set<string>(); return a.filter(c => !seen.has(c.ref) && (seen.add(c.ref), true)) }

export function gladeHomes(): Choice[] {
  const g = gregInGlade()
  return dedupe([{ ref: g.id, name: g.name }, ...gladeKeepers().map(k => ({ ref: k.id, name: k.name })),
    ...gladeFolk(0).map(f => ({ ref: f.id, name: f.name })), ...gladeClusterFolk().map(f => ({ ref: f.id, name: f.name }))])
}
export function wildsHomes(net: Network | null): Choice[] {
  if (!net) return []
  return dedupe(net.settlements.flatMap(s => folkOf(s, net.season).map(f => ({ ref: f.id, name: `${f.name} (${s.name})` }))))
}
export function homeChoices(map: BuilderMap, net: Network | null): Choice[] {
  return map === 'glade' ? gladeHomes() : map === 'wilds' ? wildsHomes(net) : [...gladeHomes(), ...wildsHomes(net)]
}
export const shopChoices = (): Choice[] => Object.entries(FRONT_SHOPS).map(([id, s]) => ({ ref: id, name: s.name }))
export const supplierChoices = (): Choice[] => Object.values(GOODS).map(g => ({ ref: g.id, name: g.name }))

export function choicesFor(kind: ZoneKind, map: BuilderMap, net: Network | null): Choice[] {
  return kind === 'home' ? homeChoices(map, net) : kind === 'shop' ? shopChoices() : kind === 'supplier' ? supplierChoices() : []
}
