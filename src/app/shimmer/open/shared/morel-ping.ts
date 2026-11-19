// ── MOREL'S FOLK PINGS (BETA M33 slice 3) ─────────────────────────────────────────────────────────────────────────────────
// Someone calls the keeper through the gem: Morel reports it on the message line ('Morel: Fennel says come by…') and that
// journal entry's MARKER lights (beacon + compass mark), without stealing the active line. Call it on the CHANGE that makes
// the call true (the first Rinnshop standing), never on a timer. PURE of React; checks read window.__morelPing (ids + marker).
import { hudSay } from './hud-say'
import { setPrefs, getJournal, markerOn } from './journal'

export function morelPing(entryId: string, line: string) {
  hudSay(line, 'morel')
  setPrefs(p => ({ ...p, marker: { ...p.marker, [entryId]: true } }))
  if (typeof window === 'undefined') return
  const g = window as unknown as { __morelPing?: { ids: string[]; marker: (id: string) => boolean } }
  g.__morelPing ??= { ids: [], marker: id => markerOn(getJournal().prefs, id) }
  g.__morelPing.ids.push(entryId)
}
