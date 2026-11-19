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
import { DEV_PAGES, DEV_GROUPS, DEV_GROUP_ORDER, DEV_ERAS, DEV_ERA_ORDER, type DevPage, type DevEra } from './dev-pages'
import { bandOf, BAND_LABELS, EDITOR_BANDS, type Band } from './editor-bands.generated'

/**
 * ★★ THE BAND ANSWERS "WHICH GAME IS THIS FOR", WHICH IS THE QUESTION THE INDEX CREATED.
 * Alex, 2026-09-02, the morning after this page shipped: *"it looks like we have a bunch of the old
 * pixel game editors mixed in here.. this has nothing to do with our game anymore."* Half right, and
 * finding out which half took an import-closure measurement — eleven of the thirty still author data
 * the shipped voxel game imports. The badge puts that measurement on the card so nobody has to take
 * it again, and `editor-bands.generated.ts` is DERIVED, so it cannot rot into a comfortable answer.
 */
const BAND_SHOWN: Record<Band, string> = { live: 'Voxel', legacy: 'Play3d', orphan: 'Orphaned', opaque: 'Opaque', tool: 'Tool' }

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
  const [oldOpen, setOldOpen] = useState(false)
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


  const renderCards = (list: DevPage[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-2">
      {list.map(p => (
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
    </div>
  )

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="font-display text-2xl text-gold tracking-wide">Dev tools</h2>
        <span className="text-[11px] text-white/40 tabular-nums">
          {DEV_PAGES.length} pages &middot; {editors.length} editors
        </span>
      </div>
      <p className="text-[12px] text-white/50 mb-5 max-w-[70ch]">
        The first section is the live game, Ather. The old pixel and voxel versions are folded away at the
        bottom. Nothing was removed and every link still works.
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

      {DEV_ERA_ORDER.map(era => {
        const inEra = pages.filter(p => p.era === era)
        const isOld = era === 'old'
        const edCount = isOld ? eds.length : 0
        if (inEra.length + edCount === 0) return null
        /* THE OLD VERSIONS FOLD. A search or a band filter opens them, so a match is never hidden. */
        const open = isOld ? oldOpen || !!query || !!bandFilter : true
        return (
          <section key={era} className="mb-8">
            <h3 className="font-display text-xs uppercase tracking-[0.18em] text-white/60 mb-1">
              {isOld ? (
                <button
                  onClick={() => setOldOpen(v => !v)}
                  className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em] hover:text-white/85 transition-colors"
                  aria-expanded={open}
                >
                  <span className={`text-[9px] transition-transform ${open ? 'rotate-90' : ''}`}>&#9656;</span>
                  {DEV_ERAS[era].label}
                  <span className="tabular-nums text-white/30 normal-case tracking-normal">{inEra.length + edCount}</span>
                </button>
              ) : DEV_ERAS[era].label}
            </h3>
            <p className="text-[11px] text-white/40 mb-3 max-w-[70ch]">{DEV_ERAS[era].note}</p>
            {open && (isOld ? (
              <>
                {DEV_GROUP_ORDER.map(g => {
                  const inGroup = inEra.filter(p => p.group === g)
                  if (inGroup.length === 0) return null
                  return (
                    <div key={g} className="mb-4">
                      <h4 className="text-[10px] uppercase tracking-[0.16em] text-white/30 mb-1.5">{DEV_GROUPS[g].label}</h4>
                      {renderCards(inGroup)}
                    </div>
                  )
                })}
      {eds.length > 0 && (
        <div className="mb-4">
          <h4 className="text-[10px] uppercase tracking-[0.16em] text-white/30 mb-1.5">Pixel tab editors</h4>
          <p className="text-[11px] text-white/40 mb-2 max-w-[70ch]">
            Pixel-era tabs that open inside this hub. The badge was measured against the voxel game, which is
            also an old version now, so read it as history, not as what the live game uses.
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
                {BAND_SHOWN[b]} <span className="tabular-nums opacity-60">{bandCounts[b] ?? 0}</span>
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
                            {BAND_SHOWN[b.band]}
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
        </div>
      )}


              </>
            ) : renderCards(inEra))}
          </section>
        )
      })}
    </div>
  )
}
