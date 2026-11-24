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
export interface Book { v: 1; pages: Page[]; pots: Pots; met: number[]; /** the absolute game day this book began (the Anemonyx counts her visits from it) */ since?: number; /** M124: each spirit bed's featured spirit (bed piece id -> spirit pots key) */ featured?: Record<string, string> }
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
  for (const [id, p] of Object.entries(o.pots ?? {})) if (p && isSeed(p.seed) && typeof p.at === 'number') {
    // M106: v 2 = the day rule, with the game days it was tended on; no v = an M76 pot (keeps its 16-min promise)
    const day = p.v === 2 ? { v: 2 as const, tends: Array.isArray(p.tends) ? p.tends.filter((d: unknown): d is number => typeof d === 'number' && Number.isInteger(d)) : [] } : {}
    pots[id] = p.bloomed ? { seed: p.seed, at: p.at, ...day, bloomed: true } : { seed: p.seed, at: p.at, ...day }
  }
  const met = Array.isArray(o.met) ? o.met.filter((k): k is number => Number.isInteger(k)) : []
  const since = Number.isInteger(o.since) ? o.since : undefined
  // M124: the featured spirit per bed (a stale or foreign entry is harmless: featuredAt falls back to the first bloomed)
  const featured: Record<string, string> = {}
  if (o.featured && typeof o.featured === 'object') for (const [bed, k] of Object.entries(o.featured)) if (typeof k === 'string') featured[bed] = k
  const b: Book = since === undefined ? { v: 1, pages, pots, met } : { v: 1, pages, pots, met, since }
  return Object.keys(featured).length ? { ...b, featured } : b
}
export function loadBook(): Book {
  try { return parseBook(JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null')) } catch { return freshBook() }
}
export function saveBook(b: Book): void {
  try { localStorage.setItem(gardenKey(KEY), JSON.stringify(b)) } catch { /* private window */ }
}
