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

export function CraftGrid({ tiles, tabs, have, label, pickedId, onPick, action, footer }: {
  tiles: GridTile[]
  /** Tab order; a tab with no tiles is hidden. */
  tabs: string[]
  have: (itemId: string) => number
  label: (itemId: string) => string
  pickedId: string | null
  onPick: (id: string | null) => void
  /** The card's action row for the picked tile — the bench crafts, a station loads runs. */
  action: (tile: GridTile) => React.ReactNode
  /** Rendered under the grid for the ACTIVE tab only — the pieces' material strip belongs to Pieces. */
  footer?: (tab: string) => React.ReactNode
}) {
  const [tab, setTab] = useState<string>(() => tabs.find(t => tiles.some(x => x.tab === t)) ?? tabs[0])
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

  return (
    <div>
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {live.map(t => (
          <button key={t} onClick={() => { setTab(t); setQ('') }}
                  className={`px-2 h-6 rounded border text-[9px] tracking-[.14em] uppercase ${
                    t === tab && !q ? 'border-amber-300 bg-black/70 text-amber-200' : 'border-white/15 bg-black/40 text-white/55 hover:border-white/40'}`}>
            {t} <span className="text-white/30 tracking-normal">{tiles.filter(x => x.tab === t && x.can).length}</span>
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="find…"
               className="ml-auto w-24 h-6 px-2 rounded border border-white/15 bg-black/40 text-white/80 text-[10px] outline-none focus:border-amber-300/60" />
      </div>
      <div className="grid grid-cols-8 gap-1 mb-2">
        {shown.map(t => {
          const on = t.id === pickedId
          return (
            <button key={t.id} title={t.name} onClick={() => onPick(on ? null : t.id)}
                    className={`relative aspect-square rounded border grid place-items-center transition-colors ${
                      on ? 'border-amber-300 bg-amber-200/10'
                         : t.can ? 'border-white/20 bg-white/[0.04] hover:border-amber-200/60'
                                 : 'border-white/8 bg-transparent opacity-40 hover:opacity-70'}`}>
              <CraftIcon itemId={t.itemId} size={28} />
              {have(t.itemId) > 0 && <span className="absolute bottom-0 right-0.5 text-[8px] text-white/50 tabular-nums">{have(t.itemId)}</span>}
            </button>
          )
        })}
        {shown.length === 0 && <div className="col-span-8 text-white/35 py-3">nothing here{q ? ` for "${q}"` : ''}</div>}
      </div>
      {picked && (
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
                  </span>
                ))}
                {picked.tag && <span className="text-sky-300/60"> · {picked.tag}</span>}
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-1.5">{action(picked)}</div>
        </div>
      )}
      {footer?.(q ? '' : tab)}
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
