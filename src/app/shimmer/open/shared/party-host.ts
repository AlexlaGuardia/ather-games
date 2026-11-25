// ── WHO HOSTS A PARTY'S WILDS (BETA M156 s2) ───────────────────────────────────────────────────────────────────────────────
// One keeper hosts the Wilds a party stands in: their Hollows are fought (fight-share.ts) and their grey ground is drawn
// (ather/guest-wilds.ts). HOST = the party STARTER (the lobby's longest-standing member, shimmer-server lobby.py) while they are
// here; with them elsewhere, the next longest-standing member who IS here; so the ground and the Hollows are never two keepers'.
// A keeper the lobby has no seat for (it holds three) follows whoever sends the host's ledger; nobody known = the lowest id, as M28.
// ★ PURE but for the two boxes the page fills (the lobby's order, the last keeper heard sending as host).
import { hostOf } from './fight-share'
/** how long a heard host stands for a keeper with no seat */
export const SAID_MS = 10_000
export function pickHost(me: string, live: readonly string[], order: readonly string[], said: string | null): string {
  const first = order.find(id => id === me || live.includes(id))
  return first ?? (said && live.includes(said) ? said : hostOf(me, live))
}
let order: readonly string[] = [], said: { id: string; at: number } | null = null
/** the lobby's members' socket ids, longest-standing first ([] = no roster: no party, full, not joined yet) */
export function setPartyOrder(ids: readonly string[]) { order = ids }
export const partyOrder = () => order
export function noteHost(id: string) { said = { id, at: performance.now() } }
export const partyHost = (me: string, live: readonly string[]) => pickHost(me, live, order, said && performance.now() - said.at < SAID_MS ? said.id : null)
