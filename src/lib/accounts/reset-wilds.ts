// ── OWNER TOOL: RESET A KEEPER'S WILDS (BETA M180, Alex 11-25) ─────────────────────────────────────────────────────────
// "the wilds have just gotten unmanagable ... is there anyway we can restart my wilds maybe a dev setting". His picks: wipe the
// INFECTION + SPREAD and the NODE TIMERS; keep the map fog and the waymarks (and everything else).
//
// WHAT A KEEPER'S WILDS IS (all GARDEN keys, one per account, synced in the open save's `garden.keys`):
//   ather.nodes.v2           the spread ledger: which nodes are clean + its epoch (ather/spread.ts)
//   ather.nodes.skew         the tune-mode clock skew (] skips days) the node timers run on (ather/spread.ts)
//   ather.spreadmap.v1       the section map: seen, grey (Hollow ground), the M121 rule's seed/day (ather/spread-map.ts)
//   ather.infection.v1       the M128 weekly settlement infections: held (champion + Hollow ground), saved, lost (ather/infection.ts)
//   ather.infection-told.v1  the infections' lines told + clues heard (ather/infect-tell.ts)
// Champions, held settlements and Hollow ground are all DRAWN from those five; nothing about the Wilds is stored anywhere else.
// A guest's / party mate's Wilds is the host's ledger relayed live (ather/guest-wilds.ts) and never stored on the server.
//
// THE RESET = A NEWBORN'S WILDS: a brand-new save holds none of the five keys. Every reader then starts from its fresh value
// (freshSpread: the world fully infested, freshMap, freshInfection, freshTell) and the page's startRule seeds the M121 rule once,
// as it does for every save without a ledger. So the reset REMOVES the keys; it invents no default of its own.
//
// ★ PURE. The route (api/owner/reset-wilds) reads the stored doc, calls this, and writes it back by compare-and-swap.

export const WILDS_KEYS: readonly string[] = [
  'ather.nodes.v2',
  'ather.nodes.skew',
  'ather.spreadmap.v1',
  'ather.infection.v1',
  'ather.infection-told.v1',
]

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The doc with the Wilds keys taken out of its garden section; every other key, keeper and field is the same value.
 *  `removed` = the keys that were there (sorted). A doc with no garden section, or none of the keys, comes back unchanged. */
export function resetWildsDoc<T extends Obj>(doc: T): { doc: T; removed: string[] } {
  const g = doc.garden
  if (!isObj(g) || !isObj(g.keys)) return { doc, removed: [] }
  const keys: Obj = {}, removed: string[] = []
  for (const [k, v] of Object.entries(g.keys)) {
    if (WILDS_KEYS.includes(k)) removed.push(k)
    else keys[k] = v
  }
  if (!removed.length) return { doc, removed }
  return { doc: { ...doc, garden: { ...g, keys } }, removed: removed.sort() }
}
