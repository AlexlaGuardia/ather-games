// ── MOREL'S FOLK PINGS (BETA M33 slice 3) ─────────────────────────────────────────────────────────────────────────────────
// Someone calls the keeper through the gem: Morel reports it on the message line ('Morel: Fennel says come by…') and that
// journal entry's MARKER lights (beacon + compass mark), without stealing the active line. Call it on the CHANGE that makes
// the call true (the first Rinnshop standing), never on a timer. PURE of React; checks read window.__morelPing (ids + marker).
import { hudSay } from './hud-say'
import { setPrefs, getJournal, markerOn } from './journal'
import { hasMet } from './met'

/** `from` = the NPC calling (their bubble name). Only someone the keeper has MET can call (Alex 11-19), unless `intro`: a call
 *  that IS the introduction (Fennel's first, when the Rinnshop stands: she has come to meet you). Returns whether it went. */
export function morelPing(entryId: string, line: string, from: string, intro = false): boolean {
  if (!intro && !hasMet(from)) return false
  hudSay(line, 'morel')
  setPrefs(p => ({ ...p, marker: { ...p.marker, [entryId]: true } }))
  if (typeof window === 'undefined') return true
  const g = window as unknown as { __morelPing?: { ids: string[]; marker: (id: string) => boolean } }
  g.__morelPing ??= { ids: [], marker: id => markerOn(getJournal().prefs, id) }
  g.__morelPing.ids.push(entryId)
  return true
}
