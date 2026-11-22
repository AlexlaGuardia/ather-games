// M76 s1: THE GRIMOIRE (the TABLET Greg hands over in Beat 1; it rests on its PEDESTAL in the garden). Canon:
// game/ather-story.md §5 + CANON_GAPS 2026-11-22 [RULED-AFK]: 10 entries ("pages"), numbered in DISCOVERY order so every
// keeper's book differs; a page has two stages, SEEN (image, type, physical description) then BONDED (the full entry +
// a ribbon by the name); no evolution pages. The 10 / 15 / 25 seen tiers gate the plot (plot.ts › RING_PAGES, M71).
// Here: the spirit you BLOOM takes the next page as SEEN. What makes a page BONDED is a later row (canon: the spirit
// "decides, all on its own, whether you are someone worth staying for"), so `bond` exists but nothing calls it yet.
//
// ★ PURE but for the guarded localStorage load/save (as plot.ts).
import { gardenKey } from '@/lib/keeper-local'
import type { Species } from '../../spirits/spirit'
import type { Pots } from './spirit-seeds'
import { isSeed } from './seed-items'

export type Stage = 'seen' | 'bonded'
export interface Page { species: Species; stage: Stage; at: number }
/** The book + the garden's spirit state that lives with it: the planters' pots and the Anemonyx visits already met. */
export interface Book { v: 1; pages: Page[]; pots: Pots; met: number[] }
export const freshBook = (): Book => ({ v: 1, pages: [], pots: {}, met: [] })

/** A species seen for the first time takes the next page; seeing it again changes nothing. */
export function see(b: Book, species: Species, now: number): Book {
  if (b.pages.some(p => p.species === species)) return b
  return { ...b, pages: [...b.pages, { species, stage: 'seen', at: now }] }
}
export function bond(b: Book, species: Species): Book {
  if (!b.pages.some(p => p.species === species && p.stage === 'seen')) return b
  return { ...b, pages: b.pages.map(p => (p.species === species ? { ...p, stage: 'bonded' } : p)) }
}
/** Seen pages = every filled page (a bonded page was seen first). What the plot tiers count. */
export const seenCount = (b: Book) => b.pages.length
export const seenSet = (b: Book) => new Set(b.pages.map(p => p.species))

const KEY = 'ather.grimoire.v1'
export function parseBook(v: unknown): Book {
  const o = v as Partial<Book> | null
  if (!o || typeof o !== 'object') return freshBook()
  const pages = Array.isArray(o.pages) ? o.pages.filter((p): p is Page => !!p && typeof p.species === 'string' && (p.stage === 'seen' || p.stage === 'bonded')) : []
  const pots: Record<string, Pots[string]> = {}
  for (const [id, p] of Object.entries(o.pots ?? {})) if (p && isSeed(p.seed) && typeof p.at === 'number') pots[id] = p.bloomed ? { seed: p.seed, at: p.at, bloomed: true } : { seed: p.seed, at: p.at }
  const met = Array.isArray(o.met) ? o.met.filter((k): k is number => Number.isInteger(k)) : []
  return { v: 1, pages, pots, met }
}
export function loadBook(): Book {
  try { return parseBook(JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null')) } catch { return freshBook() }
}
export function saveBook(b: Book): void {
  try { localStorage.setItem(gardenKey(KEY), JSON.stringify(b)) } catch { /* private window */ }
}
