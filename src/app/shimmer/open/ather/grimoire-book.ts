// M76 s1: THE GRIMOIRE (the TABLET Greg hands over in Beat 1; it rests on its PEDESTAL in the garden). Canon:
// game/ather-story.md §5 + CANON_GAPS 2026-11-22 [RULED-AFK]: 10 entries ("pages"), numbered in DISCOVERY order so every
// keeper's book differs; a page has two stages, SEEN (image, type, physical description) then BONDED (the full entry +
// a ribbon by the name). M203 (Alex 11-26, reverses 11-14 'no evolution pages'; canon amend [OPEN]): each second form a
// keeper's spirit takes gets its OWN page (Page.form), seen like a base page, numbered in the same discovery order; one
// page per form however many keepers take it. Form pages do NOT count toward the plot tiers (Jin's pick until Magii
// rules): seenCount / seenSet read base pages only. The 10 / 15 / 25 seen tiers gate the plot (plot.ts › RING_PAGES, M71).
// Here: the spirit you BLOOM takes the next page as SEEN. What makes a page BONDED is a later row (canon: the spirit
// "decides, all on its own, whether you are someone worth staying for"), so `bond` exists but nothing calls it yet.
//
// ★ PURE but for the guarded localStorage load/save (as plot.ts).
import { gardenKey } from '@/lib/keeper-local'
import type { Species } from '../../spirits/spirit'
import type { Pot, Pots } from './spirit-seeds'
import { isSeed, speciesOf } from './seed-items'
import type { FormElement } from '../../spirits/second-form-gate'

export type Stage = 'seen' | 'bonded'
/** form = a second-form page (M203): the species' form in that element. No form = the base page. */
export interface Page { species: Species; stage: Stage; at: number; form?: FormElement }
/** The book + the garden's spirit state that lives with it: the planters' pots and the Anemonyx visits already met. */
export interface Book { v: 1; pages: Page[]; pots: Pots; met: number[]; /** the absolute game day this book began (the Anemonyx counts her visits from it) */ since?: number; /** M124: each spirit bed's featured spirit (bed piece id -> spirit pots key) */ featured?: Record<string, string> }
export const freshBook = (): Book => ({ v: 1, pages: [], pots: {}, met: [] })

/** A species seen for the first time takes the next page; seeing it again changes nothing. */
export function see(b: Book, species: Species, now: number): Book {
  if (b.pages.some(p => p.species === species && !p.form)) return b
  return { ...b, pages: [...b.pages, { species, stage: 'seen', at: now }] }
}
export function bond(b: Book, species: Species): Book {
  if (!b.pages.some(p => p.species === species && !p.form && p.stage === 'seen')) return b
  return { ...b, pages: b.pages.map(p => (p.species === species && !p.form ? { ...p, stage: 'bonded' } : p)) }
}
/** M203: a second form seen for the first time takes the next page; a second keeper of the same form changes nothing. */
export function seeForm(b: Book, species: Species, form: FormElement, now: number): Book {
  if (b.pages.some(p => p.species === species && p.form === form)) return b
  return { ...b, pages: [...b.pages, { species, stage: 'seen', at: now, form }] }
}
/** M203: every bloomed spirit that has taken her form gets its form page (the hook every book write runs through, so an
 *  evolve by any path, and a spirit evolved before M203, both land). Same book back when nothing is owed. */
export function syncForms(b: Book, now: number): Book {
  let next = b
  for (const p of Object.values(b.pots)) if (p.bloomed && p.element) next = seeForm(next, speciesOf(p.seed), p.element, now)
  return next
}
/** Seen pages = every filled BASE page (a bonded page was seen first). What the plot tiers count (M203: forms excluded). */
export const seenCount = (b: Book) => b.pages.filter(p => !p.form).length
export const seenSet = (b: Book) => new Set(b.pages.filter(p => !p.form).map(p => p.species))
/** M203: the form pages filled. */
export const formCount = (b: Book) => b.pages.filter(p => p.form).length

const KEY = 'ather.grimoire.v1'
export function parseBook(v: unknown): Book {
  const o = v as Partial<Book> | null
  if (!o || typeof o !== 'object') return freshBook()
  const FORMS = ['mana', 'storm', 'earth', 'water']
  const pages = Array.isArray(o.pages) ? o.pages.filter((p): p is Page => !!p && typeof p.species === 'string' && (p.stage === 'seen' || p.stage === 'bonded'))
    // M203: a bad form is dropped (the page is kept as nothing it was not); a good one rides
    .filter(p => p.form === undefined || FORMS.includes(p.form)) : []
  const pots: Record<string, Pots[string]> = {}
  for (const [id, p] of Object.entries(o.pots ?? {})) if (p && isSeed(p.seed) && typeof p.at === 'number') {
    // M106: v 2 = the day rule, with the game days it was tended on; no v = an M76 pot (keeps its 16-min promise)
    const day = p.v === 2 ? { v: 2 as const, tends: Array.isArray(p.tends) ? p.tends.filter((d: unknown): d is number => typeof d === 'number' && Number.isInteger(d)) : [] } : {}
    // M204: her second form (element) and her meal bar ride the pot (a bad value is dropped, never guessed; the bar caps at 10)
    const EL = ['mana', 'storm', 'earth', 'water']
    const el = p.bloomed && EL.includes(p.element as string) ? { element: p.element } : {}
    const ml = p.bloomed && Array.isArray(p.meals) ? p.meals.filter((m: unknown): m is NonNullable<Pot['element']> => EL.includes(m as string)).slice(0, 10) : []
    const meals = ml.length ? { meals: ml } : {}
    pots[id] = p.bloomed ? { seed: p.seed, at: p.at, ...day, bloomed: true, ...el, ...meals } : { seed: p.seed, at: p.at, ...day }
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
