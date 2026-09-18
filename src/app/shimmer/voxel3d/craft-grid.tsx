'use client'
// The craft grid — tabs of item icons, craftable first, one card for the picked one.
//
// ── ★ WHY (2026-09-15, Alex: "im in the crafting table and im finding it really difficult to find
//    the item i want to craft.. a grid view of item icons with the craftables first maybe organized
//    into tabs") ─────────────────────────────────────────────────────────────────────────────────
// The panel was a LIST: every refine, then 98 piece rows behind a material strip, then tools, each a
// full-width button with its costs spelled out. Sixty rows to scroll for one bench. A grid of icons
// is how every inventory game solves this, because an icon is read in one glance and a name in
// three; craftable-first means the top of the grid is what you can do NOW; tabs cut the set into
// what you are looking for. One tile carries no costs — the CARD does, for the one you picked.
//
// ★ ONE COMPONENT FOR THE BENCH AND THE STATIONS. The sawmill and stonecutter show the same grid
// over their own (shorter) table and hand the pick to a job loader instead of a craft button.
import React, { useMemo, useState } from 'react'
import { itemIcon } from './tex/item-icon'
import { materialForItem } from '../voxel/registry'
import { MATERIAL_COLOR } from './attrs'

/** What a tile is — the grid never reads a recipe, so the bench, a station and the tool list all fit. */
export interface GridTile {
  id: string
  name: string
  itemId: string
  /** Can be made right now (the sort key and the bright/dim split). */
  can: boolean
  /** The tab it lives on. */
  tab: string
  /** A short tag under the name on the card (e.g. "at a crafting table", "tier 2 forestry"). */
  tag?: string
  /** Inputs, for the card: have / need. */
  cost: { itemId: string; count: number }[]
  /** Yield line, for the card. */
  yields: string
}

export function CraftIcon({ itemId, size }: { itemId: string; size: number }) {
  const icon = itemIcon(itemId)
  if (icon) return <img src={icon} alt="" width={size} height={size} className="[image-rendering:pixelated]" draggable={false} />
  const mat = materialForItem(itemId)
  const swatch = mat !== undefined ? `#${(MATERIAL_COLOR[mat] ?? 0x888888).toString(16).padStart(6, '0')}` : undefined
  // No art: a chip with the item's initials, so a grid of unknowns is still a grid of DIFFERENT things.
  const initials = itemId.split('_').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  return (
    <span className="rounded-sm border border-black/40 grid place-items-center text-[9px] text-white/60"
          style={{ width: size, height: size, background: swatch ?? 'rgba(255,255,255,0.12)' }}>{initials}</span>
  )
}

export function CraftGrid({ tiles, tabs, have, label, pickedId, onPick, action, footer, madeAt }: {
  tiles: GridTile[]
  /** Tab order; a tab with no tiles is hidden. */
  tabs: string[]
  have: (itemId: string) => number
  label: (itemId: string) => string
  pickedId: string | null
  onPick: (id: string | null) => void
  /** The card's action row for the picked tile — the bench crafts, a station loads runs. */
  action: (tile: GridTile) => React.ReactNode
  /** Rendered in the head, under the tabs, for the ACTIVE tab only — the pieces' material strip belongs to Pieces. */
  footer?: (tab: string) => React.ReactNode
  /** Where a SHORT input is made ("at the stonecutter") — the card names the next hop of the chain. */
  madeAt?: (itemId: string) => string | undefined
}) {
  // Opens on the first tab with something you can MAKE, not the first with something in it — a
  // keeper with planks lands on Pieces, not on a Materials tab of greyed refines (Alex, 09-17:
  // "prioritize the grid by craftable").
  const [tab, setTab] = useState<string>(() =>
    tabs.find(t => tiles.some(x => x.tab === t && x.can)) ?? tabs.find(t => tiles.some(x => x.tab === t)) ?? tabs[0])
  const [q, setQ] = useState('')
  const live = tabs.filter(t => tiles.some(x => x.tab === t))
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const inTab = needle ? tiles : tiles.filter(t => t.tab === tab)
    const matched = needle ? inTab.filter(t => t.name.toLowerCase().includes(needle) || t.itemId.includes(needle)) : inTab
    // Craftable first, then by name — stable, so a tile does not jump when its stock ticks.
    return [...matched].sort((a, b) => Number(b.can) - Number(a.can) || a.name.localeCompare(b.name))
  }, [tiles, tab, q])
  const picked = pickedId ? tiles.find(t => t.id === pickedId) ?? null : null

  // ── ★ THE CARD SITS ON TOP, AND THE HEAD STAYS PUT (2026-09-17, Alex: "when you pick something
  //    to craft it should show at the top of the grid not the bottom") ──────────────────────────
  // The first cut put the card UNDER the grid, which on the pieces tab is thirteen rows down: you
  // pick a tile at the top and the card lands below the fold, so the pick reads as nothing
  // happening. Now tabs, search, the tab's material strip and the card are one head that is
  // STICKY inside the panel's scroll, and the grid runs under it — wherever you are in a long
  // tab, the thing you picked is in front of you with its costs and its button. An unpicked head
  // holds a one-line hint at the card's height so the grid does not jump when a pick lands.
  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-2 bg-[#0e1018]">
        <div className="flex items-center gap-1 mb-2 flex-wrap pr-6">
          {live.map(t => (
            <button key={t} onClick={() => { setTab(t); setQ('') }}
                    className={`px-2 h-6 rounded border text-[9px] tracking-[.14em] uppercase ${
                      t === tab && !q ? 'border-amber-300 bg-black/70 text-amber-200' : 'border-white/15 bg-black/40 text-white/55 hover:border-white/40'}`}>
              {t} <span className="text-white/30 tracking-normal">{tiles.filter(x => x.tab === t && x.can).length}</span>
            </button>
          ))}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="find… (stonecutter)"
                 className="ml-auto w-32 h-6 px-2 rounded border border-white/15 bg-black/40 text-white/80 text-[10px] outline-none focus:border-amber-300/60" />
        </div>
        {footer?.(q ? '' : tab)}
        {picked ? (
          <div className={`rounded border px-3 py-2.5 ${picked.can ? 'border-amber-200/30 bg-amber-100/[0.03]' : 'border-white/10'}`}>
            <div className="flex items-center gap-2.5">
              <CraftIcon itemId={picked.itemId} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2 items-baseline">
                  <span className="text-white/90">{picked.name}</span>
                  <span className="text-amber-200/70 tabular-nums whitespace-nowrap">{picked.yields}</span>
                </div>
                <div className="text-[10px] text-white/45 mt-0.5">
                  {picked.cost.map((c, i) => (
                    <span key={c.itemId} className={have(c.itemId) >= c.count ? 'text-emerald-300/70' : 'text-rose-300/60'}>
                      {i > 0 && <span className="text-white/25"> · </span>}
                      {label(c.itemId).toLowerCase()} {have(c.itemId)}/{c.count}
                      {have(c.itemId) < c.count && madeAt?.(c.itemId) && <span className="text-sky-300/60"> ({madeAt(c.itemId)})</span>}
                    </span>
                  ))}
                  {picked.tag && <span className="text-sky-300/60"> · {picked.tag}</span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">{action(picked)}</div>
            </div>
          </div>
        ) : (
          <div className="rounded border border-dashed border-white/10 px-3 py-2.5 text-white/30 flex items-center gap-2.5" style={{ minHeight: 58 }}>
            <span className="w-9 h-9 rounded-sm border border-white/10 shrink-0" />
            <span>pick a tile — its cost and what it makes show here, and the button to make it</span>
          </div>
        )}
      </div>
      {/* ★ A TILE CARRIES ITS NAME (2026-09-17, Alex: "rn its just a confusing grid of items").
          Twenty-one pieces in one wood are twenty-one brown icons; without the word under each, the
          grid is a guessing game and every guess is a click. Six across instead of eight buys the
          two lines the name needs. The name is dim on a tile you cannot make, bright on one you can —
          the split the card then explains in red and green. */}
      <div className="grid grid-cols-6 gap-1 mb-2">
        {shown.map((t, i) => {
          const on = t.id === pickedId
          // The seam between what you can make and what you cannot, said once: craftable first is
          // the sort, and this row is what makes the sort READ as a priority rather than a shuffle.
          const seam = i > 0 && !t.can && shown[i - 1].can
          return (<React.Fragment key={t.id}>
            {seam && <div className="col-span-6 mt-1 mb-0.5 text-[8px] tracking-[.14em] uppercase text-white/30 border-t border-white/10 pt-1">need materials</div>}
            <button title={t.name} onClick={() => onPick(on ? null : t.id)}
                    className={`relative rounded border flex flex-col items-center gap-1 pt-1.5 pb-1 px-0.5 transition-colors ${
                      on ? 'border-amber-300 bg-amber-200/10'
                         : t.can ? 'border-white/20 bg-white/[0.04] hover:border-amber-200/60'
                                 : 'border-white/8 bg-transparent opacity-45 hover:opacity-75'}`}>
              <CraftIcon itemId={t.itemId} size={28} />
              <span className={`text-[8px] leading-[10px] text-center line-clamp-2 break-words w-full ${t.can ? 'text-white/75' : 'text-white/45'}`}>{t.name}</span>
              {have(t.itemId) > 0 && <span className="absolute top-0 right-0.5 text-[8px] text-white/50 tabular-nums">{have(t.itemId)}</span>}
            </button>
          </React.Fragment>)
        })}
        {shown.length === 0 && <div className="col-span-6 text-white/35 py-3">nothing here{q ? ` for "${q}"` : ''}</div>}
      </div>
    </div>
  )
}

/** A small action button, the card's grammar. */
export function CardButton({ on, disabled, children, onClick }: { on?: boolean; disabled?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick}
            className={`px-2.5 py-1 rounded border text-[10px] transition-colors ${
              disabled ? 'border-white/5 text-white/25 cursor-not-allowed'
                       : on ? 'border-amber-200/60 text-amber-100/90 hover:bg-amber-200/10' : 'border-white/20 text-white/70 hover:border-white/50'}`}>
      {children}
    </button>
  )
}
