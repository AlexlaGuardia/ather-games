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
  const query = q.trim().toLowerCase()

  const matchPage = (p: DevPage) =>
    !query ||
    p.title.toLowerCase().includes(query) ||
    p.blurb.toLowerCase().includes(query) ||
    p.path.toLowerCase().includes(query) ||
    (p.keywords ?? []).some(k => k.includes(query))

  const matchEditor = (e: IndexEditor) =>
    !query || e.label.toLowerCase().includes(query) || e.group.toLowerCase().includes(query)

  const pages = useMemo(() => DEV_PAGES.filter(matchPage), [query])
  const eds = useMemo(() => editors.filter(matchEditor), [query, editors])
  const total = pages.length + eds.length

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
          <p className="text-[11px] text-white/40 mb-3">Author game data. Open in this hub, no navigation.</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
            {eds.map(e => (
              <button
                key={e.id}
                onClick={() => onOpenEditor(e.id)}
                className="text-left px-3 py-2 rounded-md border border-white/8 bg-white/[0.02]
                           hover:border-white/20 hover:bg-white/[0.06] transition-all group"
              >
                <span className="block text-[13px] text-white/85 group-hover:text-white">{e.label}</span>
                <span className="block text-[10px] text-white/35 uppercase tracking-wider">{e.group}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {DEV_GROUP_ORDER.map(g => {
        const inGroup = pages.filter(p => p.group === g)
        if (inGroup.length === 0) return null
        return (
          <section key={g} className="mb-8">
            <h3 className="font-display text-xs uppercase tracking-[0.18em] text-white/60 mb-1">
              {DEV_GROUPS[g].label}
            </h3>
            <p className="text-[11px] text-white/40 mb-3 max-w-[70ch]">{DEV_GROUPS[g].note}</p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-2">
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
            </div>
          </section>
        )
      })}
    </div>
  )
}
