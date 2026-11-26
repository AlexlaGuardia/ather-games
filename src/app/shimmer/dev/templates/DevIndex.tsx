'use client'

/**
 * THE FRONT DOOR of /shimmer/dev.
 *
 * ★★★ M214 (2026-11-26). Alex: *"a graveyard of old tools we have made and left hanging around.. make
 * this a usable place with a pill to use the world creation mode"*. So the page now leads with ONE big
 * Creative mode pill (the M83 World Builder, `?mode=terrain`), then the live tools, and nothing else above
 * the fold. The 30 old voxel / play3d / pixel routes and 16 dead editor tabs were removed from the app
 * (DEV_ARCHIVE.md at the repo root lists each with its sha); the "old versions" fold and the band badges
 * (measured against the voxel game, itself archived) went with them.
 *
 * ⚠ IT READS `dev-pages.ts` AND `TAB_GROUPS`, AND OWNS NEITHER (09-01 rule, still true). A front door that
 * keeps its own roster is a mirror. `dev-pages.test.ts` makes registration mandatory and also asserts the
 * pill (`data-creative-pill`) renders before the live tools (`data-live-tools`).
 */

import { useState, useMemo, type MouseEvent } from 'react'
import { DEV_PAGES, DEV_ERAS, type DevPage } from './dev-pages'

export interface IndexEditor {
  id: string
  label: string
  group: string
}

/** The editor the pill opens: the World Builder (terrain, voids, zones, overlay). */
const CREATIVE = 'terrain'
/** M213: the spirit gallery is a looking glass, so it sits with the live tools, not the data editors. */
const GALLERY = 'spirits'

export default function DevIndex({
  editors,
  onOpenEditor,
}: {
  editors: IndexEditor[]
  onOpenEditor: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  const matchPage = (p: DevPage) =>
    !query ||
    p.title.toLowerCase().includes(query) ||
    p.blurb.toLowerCase().includes(query) ||
    p.path.toLowerCase().includes(query) ||
    (p.keywords ?? []).some(k => k.includes(query))
  const matchEditor = (e: IndexEditor) =>
    !query || e.label.toLowerCase().includes(query) || e.group.toLowerCase().includes(query)

  const livePages = useMemo(() => DEV_PAGES.filter(p => p.era === 'live' && matchPage(p)), [query])
  const otherPages = useMemo(() => DEV_PAGES.filter(p => p.era === 'other' && matchPage(p)), [query])
  const gallery = editors.find(e => e.id === GALLERY)
  const showGallery = !!gallery && (matchEditor(gallery) || 'spirit gallery models'.includes(query))

  /** Data editors under their tab-bar group, in the tab bar's order. */
  const editorGroups = useMemo(() => {
    const by = new Map<string, IndexEditor[]>()
    for (const e of editors) {
      if (e.id === CREATIVE || e.id === GALLERY || !matchEditor(e)) continue
      const list = by.get(e.group)
      if (list) list.push(e)
      else by.set(e.group, [e])
    }
    return [...by.entries()]
  }, [query, editors])

  const openEditor = (id: string) => (ev: MouseEvent) => {
    // A real href (so middle-click / open-in-tab works); a plain click switches in place.
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
    ev.preventDefault()
    onOpenEditor(id)
  }

  const card = 'block px-3.5 py-3 rounded-md border border-white/8 bg-white/[0.02] hover:border-violet-400/40 hover:bg-white/[0.06] transition-all group'

  return (
    <div>
      {/* ── THE PILL ─────────────────────────────────────────────────────────────────────────── */}
      <a
        data-creative-pill
        href={`/shimmer/dev?mode=${CREATIVE}`}
        onClick={openEditor(CREATIVE)}
        className="group flex items-center gap-5 w-full mb-8 px-8 py-6 rounded-full border border-emerald-300/40
                   bg-gradient-to-r from-emerald-500/25 via-teal-500/15 to-amber-400/20
                   hover:from-emerald-500/35 hover:to-amber-400/30 hover:border-emerald-200/70
                   shadow-[0_0_40px_-12px_rgba(52,211,153,0.6)] transition-all"
      >
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-300/20 border border-emerald-200/40 text-2xl text-emerald-100 shrink-0" aria-hidden>
          &#9650;
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-3xl tracking-wide text-white">Creative mode</span>
          <span className="block text-[13px] text-emerald-100/70 mt-0.5">World Builder: terrain, voids, zones, overlay</span>
        </span>
        <span className="text-emerald-100/60 group-hover:text-white text-2xl shrink-0 transition-colors" aria-hidden>&rarr;</span>
      </a>

      {/* ── LIVE TOOLS ───────────────────────────────────────────────────────────────────────── */}
      <section data-live-tools className="mb-10">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="font-display text-xl text-gold tracking-wide">Live tools</h2>
          <span className="text-[11px] text-white/40 tabular-nums">{livePages.length + (showGallery ? 1 : 0)}</span>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Filter…"
            className="ml-auto w-[220px] px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-[12px]
                       text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/25"
          />
        </div>
        <p className="text-[11px] text-white/40 mb-3 max-w-[70ch]">{DEV_ERAS.live.note}</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-2">
          {showGallery && gallery && (
            <a key="gallery" href={`/shimmer/dev?mode=${GALLERY}`} onClick={openEditor(GALLERY)} className={card}>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-white/90 group-hover:text-white font-medium">Spirit gallery</span>
                <code className="text-[10px] text-white/30 group-hover:text-violet-300/70 font-mono shrink-0">?mode={GALLERY}</code>
              </span>
              <span className="block text-[11px] text-white/55 mt-1 leading-snug">Every spirit model on a dial: the base spirits, then the forms, each live as the game mounts it.</span>
            </a>
          )}
          {livePages.map(p => (
            <a key={p.path} href={p.path} className={card}>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-white/90 group-hover:text-white font-medium">{p.title}</span>
                <code className="text-[10px] text-white/30 group-hover:text-violet-300/70 font-mono shrink-0">{p.path.replace('/shimmer/dev/', '')}</code>
              </span>
              <span className="block text-[11px] text-white/55 mt-1 leading-snug">{p.blurb}</span>
            </a>
          ))}
        </div>
      </section>

      {/* ── GAME DATA EDITORS (each one edits a table the live game reads) ─────────────────────── */}
      {editorGroups.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl text-gold tracking-wide mb-1">Game data</h2>
          <p className="text-[11px] text-white/40 mb-3 max-w-[70ch]">Editors for tables the live game reads.</p>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {editorGroups.map(([groupLabel, items]) => (
              <div key={groupLabel}>
                <h3 className="text-[10px] uppercase tracking-[0.16em] text-white/35 mb-1.5">{groupLabel}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(e => (
                    <a
                      key={e.id}
                      href={`/shimmer/dev?mode=${e.id}`}
                      onClick={openEditor(e.id)}
                      className="px-3 py-1.5 rounded-md border border-white/8 bg-white/[0.02] text-[13px] text-white/80
                                 hover:border-white/25 hover:bg-white/[0.06] hover:text-white transition-all"
                    >
                      {e.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── OTHER GAMES ──────────────────────────────────────────────────────────────────────── */}
      {otherPages.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-sm uppercase tracking-[0.18em] text-white/50 mb-2">{DEV_ERAS.other.label}</h2>
          <div className="flex flex-wrap gap-1.5">
            {otherPages.map(p => (
              <a key={p.path} href={p.path} title={p.blurb}
                 className="px-3 py-1.5 rounded-md border border-white/8 text-[12px] text-white/60 hover:text-white hover:border-white/25 transition-all">
                {p.title}
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] text-white/30">Old pixel and voxel tools were removed. DEV_ARCHIVE.md in the repo lists each one and how to bring it back.</p>
    </div>
  )
}
