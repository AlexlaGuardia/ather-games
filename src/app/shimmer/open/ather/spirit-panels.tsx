'use client'
// M76 s1: E at a SPIRIT PLANTER (plant a Mana Seed, watch it grow, see who bloomed) and E at the GRIMOIRE PEDESTAL (the
// pages, SEEN / BONDED, in discovery order). The book store lives here; spirit-seeds.ts + grimoire-book.ts hold the rules.
// A page's SEEN face = image, type, physical description (canon ather-story §5): the manifest's img + analog + quirk.
// Its BONDED face adds the full entry. No lore is authored here: every line about a spirit comes from
// public/grimoire/spirits.json (Raven/Magii's copy).
import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { HearthFrame, HearthButton, Well, H } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import type { Bank } from './garden-bank'
import { hudSay } from '../shared/hud-say'
import { SPECIES_NAMES, type Species } from '../../spirits/spirit'
import { SEED_NAME, seedIcon, speciesOf, plant, ripen, growth, settlePot, tend, canTend, tendedToday, bloomAt, growDay, gameDay, seedsOnPlot, takeSeed, BLOOM_DAYS, hasten, growingIn, spiritsAt, featuredAt, withFeatured, BED_RECORD_MAX, type SeedId } from './spirit-seeds'
import { GAME_DAY_MS } from './nodes'
import { loadBook, saveBook, see, seenCount, freshBook, type Book } from './grimoire-book'
import { GRIMOIRE_SIZE } from './plot'
import { SpiritRoster } from './spirit-roster'
import { BED_UI } from './planter-lines'

// ── the book store (one per keeper; ripens every pot whose time has come on every read) ───────────────────────────
let book: Book | null = null
const subs = new Set<() => void>()
const bump = () => subs.forEach(f => f())
function current(): Book {
  if (!book) book = typeof window === 'undefined' ? freshBook() : loadBook()
  return book
}
/** The current book (loaded once). */
export const getBook = () => current()
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
/** M106 fix: the planters' pots, for a pickup (piece-lift.ts › liftPiece) to carry a growing pot with its planter. */
export const getPots = () => current().pots
/** Save the pots a pickup returned (unchanged = no write). */
export function setPots(pots: Book['pots']) { const b = current(); if (pots !== b.pots) setBook({ ...b, pots }) }
/** A Spirit Planter was just set down: it takes the oldest pot carried in the bag (seed, planting time, tends intact).
 *  True = a carried seed went back into the ground here. */
export function settlePlanter(pieceId: string): boolean {
  const b = current(), next = settlePot(b.pots, pieceId)
  if (next === b.pots) return false
  setBook({ ...b, pots: next })
  return true
}
export const potOf = (pieceId: string) => growingIn(current().pots, pieceId) ?? current().pots[spiritsAt(current().pots, pieceId)[0] ?? '']   // M122

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

/** The garden bank's store, handed in by workshop.tsx (it owns it; importing it here would be a cycle). */
export type BankStore = { use: () => Bank; get: () => Bank; set: (b: Bank) => void }
/** Rough real time: "12 min", "2 h 5 min". */
const realIn = (ms: number) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min` }

// owner dev control (Bloom now / +1 day): the /api/owner gate the Options Dev tab uses; a player never sees the buttons
let ownerP: Promise<boolean> | null = null
function useOwner() {
  const [o, setO] = useState(false)
  useEffect(() => { let alive = true; (ownerP ??= fetch('/api/owner', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => !!j?.owner).catch(() => false)).then(v => { if (alive) setO(v) }); return () => { alive = false } }, [])
  return o
}

/** E at a planter. M106: lists every Mana Seed on the plot (bag + the garden bank every chest opens onto); Tend replaces Turn. */
export function PlanterPanel({ pieceId, onClose, footer, bank }: { pieceId: string; onClose: () => void; footer: React.ReactNode; bank: BankStore }) {
  const b = useBook(), inv = useInv(), bk = bank.use(), m = useManifest(), owner = useOwner()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => { setNow(Date.now()); const s = ripenBook(); if (s.length) hudSay(`A ${nameOf(s[0])} bloomed.`, 'item', 4) }, 1000); ripenBook(); return () => clearInterval(t) }, [])
  // M122 (RULED 756fdbb): a bloomed planter is free for the next seed. `growing` = the seed in it now; `home` = the spirits
  // who bloomed here (they stay theirs: party, follow and the garden roam are untouched)
  const growing = growingIn(b.pots, pieceId), home = spiritsAt(b.pots, pieceId)
  // M124 s1 (RULED ce34508): the bed's record (cap BED_RECORD_MAX) + its ONE featured spirit (stays near, drawn)
  const feat = featuredAt(b.pots, b.featured, pieceId), full = home.length >= BED_RECORD_MAX
  const doFeature = (k: string) => { const c = current(), f = withFeatured(c.pots, c.featured, k); if (f) setBook({ ...c, featured: f }) }
  const seeds = seedsOnPlot(inv, bk)
  const doPlant = (id: SeedId) => {
    const next = plant(current().pots, pieceId, id, Date.now()), t = takeSeed(getInv(), bank.get(), id)
    if (!next || !t) return
    if (t.from === 'bag') setInv(t.inv); else bank.set(t.bank)
    setBook({ ...current(), pots: next }); hudSay('Planted. Give it time.', 'item', 3)
  }
  const doTend = () => {
    const t = Date.now(), next = tend(current().pots, pieceId, t)
    if (!next) { hudSay('Tended today already.', 'info'); return }   // TODO @lark
    setBook({ ...current(), pots: next }); setNow(t)
    const s = ripenBook(t)
    hudSay(s.length ? `A ${nameOf(s[0])} bloomed.` : 'Tended.', 'item', 3)   // TODO @lark
  }
  const doHasten = (ms: number | 'now') => {
    if (!owner) return
    const t = Date.now(), next = hasten(current().pots, pieceId, t, ms)
    if (!next) return
    setBook({ ...current(), pots: next }); setNow(t)
    const s = ripenBook(t)
    if (s.length) hudSay(`A ${nameOf(s[0])} bloomed.`, 'item', 3)
  }
  const due = growing ? bloomAt(growing) : 0
  // the bloom as a day of its growing (1-based from planting) and the real wait; the next tend opens with the next game day
  // untended = 'at the end of day 3'; tended d1 + d2 = 'at the start of day 3' (Alex's words); one tend = 'midway through day 3'
  const span = growing ? (due - growing.at) / GAME_DAY_MS : 0, whole = Math.floor(span)
  const when = span === whole ? (whole >= BLOOM_DAYS ? `at the end of day ${whole}` : `at the start of day ${whole + 1}`) : `midway through day ${whole + 1}`
  const nextTend = (gameDay(now) + 1) * GAME_DAY_MS - now
  return (
    <HearthFrame title={BED_UI.title} maxWidth={420} onClose={onClose} fixed dataPanel="planter">
      <div style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        {!growing && full && <div data-planter="full" style={{ fontSize: 13, color: H.inkSoft }}>{BED_UI.full}</div>}
        {!growing && !full && (seeds.length
          ? <><div style={lab}>Plant a seed</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {seeds.map(s => <button key={s.id} data-act="plant-seed" data-seed={s.id} data-bag={s.bag} data-bank={s.bank} onClick={() => doPlant(s.id)} title={SEED_NAME} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', position: 'relative' }}>
                  <Well size={52}><img src={seedIcon(s.id)} alt={SEED_NAME} width={36} height={36} /></Well>
                  <span style={{ position: 'absolute', right: 3, bottom: 1, fontSize: 11, fontWeight: 700, color: H.ink, fontVariantNumeric: 'tabular-nums' }}>{s.bag + s.bank}</span>
                </button>)}
              </div></>
          : <div data-planter="empty" style={{ fontSize: 13, color: H.inkSoft }}>Empty. A Mana Seed would grow here, if you had one.</div>)}
        {growing && (
          <div data-planter="growing" data-growth={growth(growing, now).toFixed(2)} data-day={growDay(growing, now)} data-bloom-at={due} data-tends={growing.tends?.length ?? 0}>
            {/* TODO @lark: the growing lines below are placeholders */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={lab}>Growing</span>
              <span style={{ fontSize: 12, color: H.inkSoft, fontVariantNumeric: 'tabular-nums' }}>Day {Math.min(growDay(growing, now), BLOOM_DAYS)} of {BLOOM_DAYS}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: '#0002', overflow: 'hidden', marginTop: 6 }}><div style={{ width: `${growth(growing, now) * 100}%`, height: '100%', background: '#e8c25a' }} /></div>
            <div data-bloom-line style={{ fontSize: 12, color: H.inkSoft, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              Blooms {growing.v === 2 ? `${when}, ` : ''}in about {realIn(due - now)}
            </div>
            {growing.v === 2 && tendedToday(growing, now) && <div style={{ fontSize: 12, color: H.inkSoft }}>Next tend in about {realIn(nextTend)}</div>}
          </div>
        )}
        {home.length > 0 && <div data-bed-record={home.length} style={{ ...lab, display: 'flex', justifyContent: 'space-between' }}><span>{BED_UI.record}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{home.length} / {BED_RECORD_MAX}</span></div>}
        {home.length > 0 && <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
          {home.map(k => { const sp = speciesOf(b.pots[k].seed), card = m ? m[nameOf(sp)] : null, on = k === feat, w = on ? 72 : 44
            // the words are signed (batch 11-24c A): asking one to stay is an ask, never a set
            return <div key={k} data-planter="bloomed" data-spirit={k} data-species={sp} data-featured={on ? '1' : '0'} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Well size={w}>{card ? <img src={card.img} alt="" width={w - 12} height={w - 12} style={{ objectFit: 'contain' }} /> : null}</Well>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{nameOf(sp)}</div><div style={{ fontSize: 12.5, color: H.inkSoft }}>{on ? BED_UI.featured : BED_UI.roaming}</div></div>
              {!on && <span data-act="feature-spirit"><HearthButton small onClick={() => doFeature(k)}>{BED_UI.ask}</HearthButton></span>}
            </div> })}
        </div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {growing && growing.v === 2 && (canTend(growing, now)
            ? <span data-act="tend-planter"><HearthButton small onClick={doTend}>Tend</HearthButton></span>
            : <span data-act="tend-planter" data-tended="1"><HearthButton small disabled onClick={doTend}>Tended today</HearthButton></span>)}
          {growing && owner && <>
            <span data-act="planter-day"><HearthButton small onClick={() => doHasten(GAME_DAY_MS)}>+1 day</HearthButton></span>
            <span data-act="planter-bloom-now"><HearthButton small onClick={() => doHasten('now')}>Bloom now (owner dev)</HearthButton></span>
          </>}
          {footer}
        </div>
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
            {card && <div style={{ fontSize: 12.5, color: H.inkSoft }}>Like {/^[aeiou]/i.test(card.analog) ? 'an' : 'a'} {card.analog}. {card.quirk.charAt(0).toUpperCase() + card.quirk.slice(1)}.</div>}
            {card && page.stage === 'bonded' && card.entry && <div style={{ fontSize: 13 }}>{card.entry}</div>}
          </div>
        )}
        <SpiritRoster onClose={onClose} />{/* M109 s3: the roster face (every keeper since M123 s2) */}
        {footer}
      </div>
    </HearthFrame>
  )
}
