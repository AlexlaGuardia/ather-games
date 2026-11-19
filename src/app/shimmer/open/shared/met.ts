// ── WHO THE KEEPER HAS MET (BETA M33, Alex 11-19: "every NPC the keeper has MET can ping through Morel") ────────────────
// A per-keeper set of NPC names, marked the first time their talk bubble opens (npc-talk.tsx TalkBubble, so every NPC on
// every page counts without each page wiring it). Morel's pings (morel-ping.ts) only carry a call from someone met.
// Keyed by the NAME the bubble shows, lower-cased ('gregory', 'fennel', a door talker's name).
import { gardenKey } from '@/lib/keeper-local'

export const MET_KEY = 'open.met.v1'
const norm = (n: string) => n.trim().toLowerCase()
function load(): string[] { try { const a = JSON.parse(localStorage.getItem(gardenKey(MET_KEY)) ?? '[]'); return Array.isArray(a) ? a : [] } catch { return [] } }
export function hasMet(name: string): boolean { return typeof window !== 'undefined' && load().includes(norm(name)) }
export function markMet(name: string) {
  if (typeof window === 'undefined' || !name) return
  const a = load(), n = norm(name)
  if (a.includes(n)) return
  try { localStorage.setItem(gardenKey(MET_KEY), JSON.stringify([...a, n])) } catch { /* private window */ }
}
export const metList = () => (typeof window === 'undefined' ? [] : load())
