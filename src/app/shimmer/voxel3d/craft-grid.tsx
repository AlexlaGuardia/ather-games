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
// ★ CARVED HEARTH (rollout Phase 3, 2026-09-22): the grid is built from ui/hearth — carved wells,
// parchment tabs, the lifted-paper card, moss/rust cost chips. What it SHOWS and how it SORTS did
// not change; every ★ below still holds. The dev page /shimmer/dev/hearth mounts the same pieces.
//
// ★ ONE COMPONENT FOR THE BENCH AND THE STATIONS. The sawmill and stonecutter show the same grid
// over their own (shorter) table and hand the pick to a job loader instead of a craft button.
import React, { useMemo, useState } from 'react'
import { CraftIcon } from './craft-icon'
import { H, hearthDisplay, HearthNote, HearthSearch, HearthTabs, HearthCard, HearthCardEmpty, HearthTile, HearthDivider, HearthButton, CostChip, Well } from '../ui/hearth'

export { CraftIcon }

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

export function CraftGrid({ tiles, tabs, have, label, pickedId, onPick, action, footer, madeAt, note }: {
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
  /** The quiet italic line at the head: where you are, what the grid draws on. */
  note?: React.ReactNode
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
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-3" style={{ background: `linear-gradient(180deg, ${H.paper} 88%, rgba(245,235,213,0))` }}>
        <div className="flex items-center justify-between gap-3 mb-3 min-h-8">
          {note ? <HearthNote>{note}</HearthNote> : <span />}
          <HearthSearch value={q} onChange={setQ} placeholder="Find… (stonecutter)" width={120} />
        </div>
        <HearthTabs tabs={live.map(t => ({ id: t, label: t, count: tiles.filter(x => x.tab === t && x.can).length }))}
                    active={q ? null : tab} onPick={t => { setTab(t); setQ('') }} />
        <div className="mt-2">{footer?.(q ? '' : tab)}</div>
        <div className="mt-1" style={{ minHeight: 92 }}>
          {picked ? (
            <HearthCard key={picked.id}>
              <Well itemId={picked.itemId} size={58} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[18px] font-semibold leading-tight" style={hearthDisplay}>{picked.name}</span>
                  <span className="text-[12px] font-bold tabular-nums" style={{ color: H.ember }}>{picked.yields}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {picked.cost.map(c => <CostChip key={c.itemId} itemId={c.itemId} label={label(c.itemId)} have={have(c.itemId)} need={c.count} madeAt={madeAt?.(c.itemId)} />)}
                </div>
                {picked.tag && <div className="mt-1 text-[12px] italic" style={{ color: H.sky }}>{picked.tag}</div>}
              </div>
              <div className="flex flex-wrap justify-end gap-1.5 shrink-0 max-w-[40%]">{action(picked)}</div>
            </HearthCard>
          ) : <HearthCardEmpty>Pick something to see what it takes.</HearthCardEmpty>}
        </div>
      </div>
      {/* ★ A TILE CARRIES ITS NAME (2026-09-17, Alex: "rn its just a confusing grid of items").
          Twenty-one pieces in one wood are twenty-one brown icons; without the word under each, the
          grid is a guessing game and every guess is a click. The name is dim on a tile you cannot
          make, bright on one you can — the split the card then explains in rust and moss. */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-2 gap-y-3 mb-2">
        {shown.map((t, i) => {
          // The seam between what you can make and what you cannot, said once: craftable first is
          // the sort, and this row is what makes the sort READ as a priority rather than a shuffle.
          const seam = i > 0 && !t.can && shown[i - 1].can
          return (<React.Fragment key={t.id}>
            {seam && <HearthDivider>needs materials</HearthDivider>}
            <HearthTile itemId={t.itemId} name={t.name} count={have(t.itemId)} can={t.can} index={i}
                        picked={t.id === pickedId} onClick={() => onPick(t.id === pickedId ? null : t.id)} />
          </React.Fragment>)
        })}
        {shown.length === 0 && <div className="col-span-full py-6 text-center italic" style={{ color: H.inkFaint }}>Nothing here{q ? ` for “${q}”` : ''}.</div>}
      </div>
    </div>
  )
}

/** A card action, the card's grammar: `on` = the primary (ember) act. */
export function CardButton({ on, disabled, children, onClick }: { on?: boolean; disabled?: boolean; children: React.ReactNode; onClick: () => void }) {
  return <HearthButton small primary={on} disabled={disabled} onClick={onClick}>{children}</HearthButton>
}
