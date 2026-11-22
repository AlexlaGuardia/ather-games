'use client'
// M76 s1: E at a SPIRIT PLANTER (plant a Mana Seed, watch it grow, see who bloomed) and E at the GRIMOIRE PEDESTAL (the
// pages, SEEN / BONDED, in discovery order). The book store lives here; spirit-seeds.ts + grimoire-book.ts hold the rules.
// A page's SEEN face = image, type, physical description (canon ather-story §5): the manifest's img + analog + quirk.
// Its BONDED face adds the full entry. No lore is authored here: every line about a spirit comes from
// public/grimoire/spirits.json (Raven/Magii's copy).
import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { HearthFrame, HearthButton, Well, H } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import { countOf, give, take } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { SPECIES_NAMES, type Species } from '../../spirits/spirit'
import { SEED_IDS, SEED_NAME, seedIcon, speciesOf, plant, ripen, growth, liftPot, BLOOM_MS, type SeedId } from './spirit-seeds'
import { loadBook, saveBook, see, seenCount, freshBook, type Book } from './grimoire-book'
import { GRIMOIRE_SIZE } from './plot'

// ── the book store (one per keeper; ripens every pot whose time has come on every read) ───────────────────────────
let book: Book | null = null
const subs = new Set<() => void>()
const bump = () => subs.forEach(f => f())
function current(): Book {
  if (!book) book = typeof window === 'undefined' ? freshBook() : loadBook()
  return book
}
export function setBook(b: Book) { book = b; saveBook(b); bump() }
/** Bloom every due pot into its page. Returns the species that just bloomed (for a HUD line). */
export function ripenBook(now = Date.now()): Species[] {
  const b = current(), r = ripen(b.pots, now)
  if (!r.bloomed.length) return []
  let next: Book = { ...b, pots: r.pots }
  for (const x of r.bloomed) next = see(next, x.species, now)
  setBook(next)
  return r.bloomed.map(x => x.species)
}
export function useBook(): Book {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, current, freshBook)
}
/** Pages the plot tiers count (plot.ts › RING_PAGES). */
export const bookPages = () => seenCount(current())
/** Picking a planter up: refuses one a spirit lives in; a growing seed goes back to the bag. Null = refuse (with a line). */
export function liftPlanter(pieceId: string): boolean {
  const b = current(), r = liftPot(b.pots, pieceId)
  if (!r) { hudSay('A spirit lives in this planter. It stays.', 'info'); return false }
  if (r.seed) {
    const g = give(getInv(), r.seed, 1)
    if (g.left) { hudSay('No room in the bag for the seed.', 'info'); return false }
    setInv(g.inv)
  }
  if (r.pots !== b.pots) setBook({ ...b, pots: r.pots })
  return true
}
export const potOf = (pieceId: string) => current().pots[pieceId]

// ── the manifest (img, type, description, entry) ─────────────────────────────────────────────────────────────────
type Man = { name: string; analog: string; quirk: string; img: string; entry: string }
let man: Record<string, Man> | null = null
function useManifest() {
  const [m, setM] = useState(man)
  useEffect(() => {
    if (man) return
    fetch('/grimoire/spirits.json').then(r => r.json()).then(d => { man = Object.fromEntries((d.spirits as Man[]).map(s => [s.name, s])); setM(man) }).catch(() => {})
  }, [])
  return m
}
const nameOf = (s: Species) => SPECIES_NAMES[s]
const lab: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: H.inkSoft }

/** E at a planter. */
export function PlanterPanel({ pieceId, onClose, footer }: { pieceId: string; onClose: () => void; footer: React.ReactNode }) {
  const b = useBook(), inv = useInv(), m = useManifest()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => { setNow(Date.now()); const s = ripenBook(); if (s.length) hudSay(`A ${nameOf(s[0])} bloomed.`, 'item', 4) }, 1000); ripenBook(); return () => clearInterval(t) }, [])
  const pot = b.pots[pieceId]
  const seeds = SEED_IDS.filter(id => countOf(inv, id) > 0)
  const doPlant = (id: SeedId) => {
    const next = plant(current().pots, pieceId, id, Date.now()), i = take(getInv(), id, 1)
    if (!next || !i) return
    setInv(i); setBook({ ...current(), pots: next }); hudSay('Planted. Give it time.', 'item', 3)
  }
  const sp = pot ? speciesOf(pot.seed) : null, card = sp && m ? m[nameOf(sp)] : null
  return (
    <HearthFrame title="Spirit Planter" maxWidth={420} onClose={onClose} fixed dataPanel="planter">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        {!pot && (seeds.length
          ? <><div style={lab}>Plant a seed</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {seeds.map(id => <button key={id} data-act="plant-seed" data-seed={id} onClick={() => doPlant(id)} title={SEED_NAME} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
                  <Well size={52}><img src={seedIcon(id)} alt={SEED_NAME} width={36} height={36} /></Well>
                </button>)}
              </div></>
          : <div data-planter="empty" style={{ fontSize: 13, color: H.inkSoft }}>Empty. A Mana Seed would grow here, if you had one.</div>)}
        {pot && !pot.bloomed && (
          <div data-planter="growing" data-growth={growth(pot, now).toFixed(2)}>
            <div style={lab}>Growing</div>
            <div style={{ height: 8, borderRadius: 4, background: '#0002', overflow: 'hidden', marginTop: 6 }}><div style={{ width: `${growth(pot, now) * 100}%`, height: '100%', background: '#e8c25a' }} /></div>
            <div style={{ fontSize: 12, color: H.inkSoft, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{Math.max(0, Math.ceil((pot.at + BLOOM_MS - now) / 60000))} min</div>
          </div>
        )}
        {pot?.bloomed && sp && (
          <div data-planter="bloomed" data-species={sp} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Well size={72}>{card ? <img src={card.img} alt="" width={60} height={60} style={{ objectFit: 'contain' }} /> : null}</Well>
            <div><div style={{ fontWeight: 700 }}>{nameOf(sp)}</div><div style={{ fontSize: 12.5, color: H.inkSoft }}>It bloomed here, and here it stays.</div></div>
          </div>
        )}
        {footer}
      </div>
    </HearthFrame>
  )
}

/** E at the grimoire pedestal: the pages in discovery order, then the empty ones. */
export function GrimoirePanel({ onClose, footer }: { onClose: () => void; footer: React.ReactNode }) {
  const b = useBook(), m = useManifest()
  useEffect(() => { ripenBook() }, [])
  const size = GRIMOIRE_SIZE(seenCount(b))
  const [open, setOpen] = useState<number | null>(null)
  const page = open !== null ? b.pages[open] : null, card = page && m ? m[nameOf(page.species)] : null
  return (
    <HearthFrame title="Grimoire" maxWidth={460} onClose={onClose} fixed dataPanel="grimoire">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        <div data-grimoire-count={seenCount(b)} style={{ fontSize: 13, color: H.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{seenCount(b)} / {size} pages</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {Array.from({ length: size }, (_, i) => {
            const p = b.pages[i], c = p && m ? m[nameOf(p.species)] : null
            return <button key={i} data-page={i + 1} data-species={p?.species ?? ''} data-stage={p?.stage ?? 'empty'} disabled={!p} onClick={() => setOpen(i)}
              style={{ background: 'none', border: 0, padding: 0, cursor: p ? 'pointer' : 'default', opacity: p ? 1 : 0.4, position: 'relative' }}>
              <Well size={56}>{c ? <img src={c.img} alt="" width={44} height={44} style={{ objectFit: 'contain' }} /> : <span style={{ fontSize: 11, color: H.inkSoft }}>{i + 1}</span>}</Well>
              {p?.stage === 'bonded' && <span style={{ position: 'absolute', top: 2, right: 4, width: 6, height: 14, background: '#c0392b', borderRadius: 1 }} />}
            </button>
          })}
        </div>
        {page && (
          <div data-page-open={open! + 1} style={{ display: 'grid', gap: 6, borderTop: `1px solid ${H.inkSoft}33`, paddingTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700 }}>{open! + 1}. {nameOf(page.species)}{page.stage === 'bonded' ? ' 🎗' : ''}</span>
              <span style={lab}>{page.stage === 'bonded' ? 'Bonded' : 'Seen'}</span>
            </div>
            {card && <div style={{ fontSize: 12.5, color: H.inkSoft }}>Like a {card.analog}. {card.quirk.charAt(0).toUpperCase() + card.quirk.slice(1)}.</div>}
            {card && page.stage === 'bonded' && card.entry && <div style={{ fontSize: 13 }}>{card.entry}</div>}
          </div>
        )}
        {footer}
      </div>
    </HearthFrame>
  )
}
