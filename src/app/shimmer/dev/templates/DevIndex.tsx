'use client'

/**
 * THE FRONT DOOR — every editor and every standalone dev route, on one searchable page.
 *
 * ★★★ WHY (2026-09-01). `/shimmer/dev` opened straight into the sprite editor, so the hub had no
 * home: thirty editors behind a two-level tab bar you had to already understand, and sixteen
 * standalone pages behind URLs you had to already know. This is the page that answers *"what is
 * even in here"* without asking anyone to remember.
 *
 * ⚠ IT READS `dev-pages.ts` AND `TAB_GROUPS`, AND OWNS NEITHER. A front door that keeps its own
 * copy of the roster is a mirror, and a mirror agrees with its source right up until it does not
 * (PATTERNS 2026-08-22). Adding a page here is not a step: `dev-pages.test.ts` makes the registry
 * mandatory, and this renders whatever the registry holds.
 */

import { useState, useMemo } from 'react'
import { DEV_PAGES, DEV_GROUPS, DEV_GROUP_ORDER, type DevPage } from './dev-pages'
import { bandOf, BAND_LABELS, EDITOR_BANDS, type Band } from './editor-bands.generated'

/**
 * ★★ THE BAND ANSWERS "WHICH GAME IS THIS FOR", WHICH IS THE QUESTION THE INDEX CREATED.
 * Alex, 2026-09-02, the morning after this page shipped: *"it looks like we have a bunch of the old
 * pixel game editors mixed in here.. this has nothing to do with our game anymore."* Half right, and
 * finding out which half took an import-closure measurement — eleven of the thirty still author data
 * the shipped voxel game imports. The badge puts that measurement on the card so nobody has to take
 * it again, and `editor-bands.generated.ts` is DERIVED, so it cannot rot into a comfortable answer.
 */
const BAND_STYLE: Record<Band, string> = {
  live:   'border-emerald-400/30 text-emerald-300/80',
  legacy: 'border-amber-400/30 text-amber-300/80',
  orphan: 'border-rose-400/35 text-rose-300/80',
  opaque: 'border-sky-400/30 text-sky-300/80',
  tool:   'border-white/15 text-white/40',
}

/**
 * The hover text for a band badge: what the band means, and — when the editor authors dead
 * modules — exactly which ones. The card used to print that list in red monospace; moving it here
 * keeps the evidence one hover away instead of deleting it, which is the whole reason the list
 * existed. See the note at the badge.
 */
const bandTitle = (b: { band: Band; orphan: string[] }) =>
  b.orphan.length > 0
    ? `${BAND_LABELS[b.band].note}\n\nNo shipped game imports: ${b.orphan.join(', ')}`
    : BAND_LABELS[b.band].note

export interface IndexEditor {
  id: string
  label: string
  group: string
}

export default function DevIndex({
  editors,
  onOpenEditor,
}: {
  editors: IndexEditor[]
  onOpenEditor: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [bandFilter, setBandFilter] = useState<Band | null>(null)
  const [protoOpen, setProtoOpen] = useState(false)
  const query = q.trim().toLowerCase()

  const matchPage = (p: DevPage) =>
    !query ||
    p.title.toLowerCase().includes(query) ||
    p.blurb.toLowerCase().includes(query) ||
    p.path.toLowerCase().includes(query) ||
    (p.keywords ?? []).some(k => k.includes(query))

  const matchEditor = (e: IndexEditor) => {
    const b = bandOf(e.id)
    if (bandFilter && b?.band !== bandFilter) return false
    if (!query) return true
    return e.label.toLowerCase().includes(query)
      || e.group.toLowerCase().includes(query)
      // Searching a dead module name should find the editor that still authors it.
      || (b?.orphan ?? []).some(m => m.includes(query))
  }

  const pages = useMemo(() => (bandFilter ? [] : DEV_PAGES.filter(matchPage)), [query, bandFilter])
  const eds = useMemo(() => editors.filter(matchEditor), [query, editors, bandFilter])

  /** Counts come from the cache, not from `editors`, so a chip reads 0 rather than vanishing. */
  const bandCounts = useMemo(() => {
    const c = {} as Record<Band, number>
    for (const b of EDITOR_BANDS) c[b.band] = (c[b.band] ?? 0) + 1
    return c
  }, [])
  const total = pages.length + eds.length

  /** Editors under their own group heading, in the order the hub's tab bar already uses. */
  const editorGroups = useMemo(() => {
    const by = new Map<string, IndexEditor[]>()
    for (const e of eds) {
      const list = by.get(e.group)
      if (list) list.push(e)
      else by.set(e.group, [e])
    }
    return [...by.entries()]
  }, [eds])

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="font-display text-2xl text-gold tracking-wide">The dev surface</h2>
        <span className="text-[11px] text-white/40 tabular-nums">
          {editors.length} editors &middot; {DEV_PAGES.length} standalone pages
        </span>
      </div>
      <p className="text-[12px] text-white/50 mb-5 max-w-[70ch]">
        Editors live in this hub behind tabs. The standalone pages have their own URL &mdash; most of
        them are looking glasses, built so one thing can be judged without loading the world and
        walking to it.
      </p>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Filter everything…"
        className="w-full max-w-[420px] mb-6 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm
                   text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/25"
      />

      {total === 0 && (
        <p className="text-sm text-white/30 py-8">Nothing matches “{q}”.</p>
      )}

      {eds.length > 0 && (
        <section className="mb-8">
          <h3 className="font-display text-xs uppercase tracking-[0.18em] text-white/60 mb-1">Editors</h3>
          <p className="text-[11px] text-white/40 mb-2 max-w-[70ch]">
            Author game data. Open in this hub, no navigation. The badge says which game&rsquo;s data each
            one actually feeds &mdash; measured from the shipped import graph, not maintained by hand.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {(Object.keys(BAND_LABELS) as Band[]).map(b => (
              <button
                key={b}
                onClick={() => setBandFilter(bandFilter === b ? null : b)}
                title={BAND_LABELS[b].note}
                className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider transition-all ${BAND_STYLE[b]} ${
                  bandFilter === b ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'
                }`}
              >
                {BAND_LABELS[b].label} <span className="tabular-nums opacity-60">{bandCounts[b] ?? 0}</span>
              </button>
            ))}
            {bandFilter && (
              <button onClick={() => setBandFilter(null)} className="px-2 py-0.5 text-[10px] text-white/40 hover:text-white/70">
                clear
              </button>
            )}
          </div>
          {bandFilter && (
            <p className="text-[11px] text-white/45 mb-3 max-w-[70ch]">{BAND_LABELS[bandFilter].note}</p>
          )}
          {/* ★ GROUPED, BECAUSE A FLAT GRID PRINTED ITS OWN GROUP LABEL 28 TIMES AND ORGANISED
              NOTHING. Every card carried an uppercase SPRITES / SPIRITS / WORLD line that repeated
              its neighbours and could not be scanned; the same word said once, as a heading, both
              removes 28 lines of text and puts the editors in the order the tab bar already uses. */}
          {editorGroups.map(([groupLabel, items]) => (
            <div key={groupLabel} className="mb-3">
              <h4 className="text-[10px] uppercase tracking-[0.16em] text-white/30 mb-1.5">{groupLabel}</h4>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
                {items.map(e => {
                  const b = bandOf(e.id)
                  return (
                    <button
                      key={e.id}
                      onClick={() => onOpenEditor(e.id)}
                      title={b ? bandTitle(b) : undefined}
                      className="text-left px-3 py-2 rounded-md border border-white/8 bg-white/[0.02]
                                 hover:border-white/20 hover:bg-white/[0.06] transition-all group"
                    >
                      <span className="flex items-baseline justify-between gap-1.5">
                        <span className="text-[13px] text-white/85 group-hover:text-white">{e.label}</span>
                        {b && (
                          <span className={`shrink-0 px-1 rounded border text-[9px] uppercase tracking-wider ${BAND_STYLE[b.band]}`}>
                            {BAND_LABELS[b.band].label}
                            {/* ⚠ THE COUNT KEEPS THE ACCUSATION HONEST WITHOUT PRINTING THE CASE.
                                A bare "orphaned" badge is an accusation with no evidence on it and
                                the only safe response to one is to ignore it — that reasoning still
                                holds, so the dead modules are still NAMED, in the card's tooltip.
                                What is gone is four lines of red monospace on every offending card,
                                which was the loudest thing on the page and made ORPHANED read as an
                                error rather than a note. It is not one: `map` is banded orphaned and
                                still authors THIRTEEN live modules. */}
                            {b.orphan.length > 0 && <span className="tabular-nums opacity-70"> {b.orphan.length}</span>}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {DEV_GROUP_ORDER.map(g => {
        const inGroup = pages.filter(p => p.group === g)
        if (inGroup.length === 0) return null
        /* ★ THE ONE SECTION THAT ASKS TO BE FOLDED IS THE ONE THAT DESCRIBES ITSELF AS UNMAINTAINED.
           `proto`'s own note is "Standalone routes kept because they still answer a question. Not
           maintained as tools." — so it is the only group on this page that is explicitly not part of
           anyone's working set, and it sat open at the bottom taking the same room as the benches.
           Folded, not removed: the routes still answer their question, and a search still finds them
           because `pages` is filtered before this runs. */
        const foldable = g === 'proto' && !query
        const open = foldable ? protoOpen : true
        return (
          <section key={g} className="mb-8">
            <h3 className="font-display text-xs uppercase tracking-[0.18em] text-white/60 mb-1">
              {foldable ? (
                <button
                  onClick={() => setProtoOpen(v => !v)}
                  className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em] hover:text-white/85 transition-colors"
                  aria-expanded={open}
                >
                  <span className={`text-[9px] transition-transform ${open ? 'rotate-90' : ''}`}>&#9656;</span>
                  {DEV_GROUPS[g].label}
                  <span className="tabular-nums text-white/30 normal-case tracking-normal">{inGroup.length}</span>
                </button>
              ) : DEV_GROUPS[g].label}
            </h3>
            {open && <p className="text-[11px] text-white/40 mb-3 max-w-[70ch]">{DEV_GROUPS[g].note}</p>}
            {open && <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-2">
              {inGroup.map(p => (
                <a
                  key={p.path}
                  href={p.path}
                  className="block px-3.5 py-3 rounded-md border border-white/8 bg-white/[0.02]
                             hover:border-violet-400/40 hover:bg-white/[0.06] transition-all group"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] text-white/90 group-hover:text-white font-medium">{p.title}</span>
                    <code className="text-[10px] text-white/30 group-hover:text-violet-300/70 font-mono shrink-0">
                      {p.path}
                    </code>
                  </span>
                  <span className="block text-[11px] text-white/55 mt-1 leading-snug">{p.blurb}</span>
                </a>
              ))}
            </div>}
          </section>
        )
      })}
    </div>
  )
}
