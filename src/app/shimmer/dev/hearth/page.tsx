'use client'
// THE CARVED HEARTH — direction B for Shimmer's in-game menus, mocked on the crafter.
//
// ★ WHY (2026-09-22, Alex: "improve our ingame menus and make them look more modern" → "lets go
// with B to see how that feels"). Research (SHIMMER_MENU_RESEARCH.md) found the arcade gx chrome —
// dark plates, CRT scanlines, squared caps — is the cabinets' register, not a cozy world's. B is the
// storybook answer: a carved wood frame around a parchment window, one ember accent, a soft serif
// for headings, sentence case, carved icon wells, a lifted-paper recipe card, spring motion.
//
// ★ ONE DATA SET, TWO SKINS. The "now" toggle mounts the SHIPPED `CraftGrid` inside the shipped
// `PanelFrame` over the same tiles, so the comparison is the look and nothing else. The icons are
// the real `CraftIcon` art. The tiles and stock are a fixed sample, not a save — this page reads no
// recipes and changes no game state.
//
// ★ B IS BUILT FROM `shimmer/ui/hearth.tsx` — the kit the panels ship with — so this page cannot
// drift from what the game wears. It was the prototype; now it is the kit's showroom.
import React, { useEffect, useMemo, useState } from 'react'
import { CraftGrid, CardButton, type GridTile } from '../../voxel3d/craft-grid'
import { H, hearthDisplay, hearthBody, HearthFrame, HearthHead, HearthNote, HearthSearch, HearthTabs, HearthCard, HearthCardEmpty, HearthButton, HearthTile, HearthDivider, CostChip, Well } from '../../ui/hearth'
import { PanelFrame } from '../../voxel3d/panel-frame'
import { itemLabel } from '../../hud/satchel'

// ── the sample ───────────────────────────────────────────────────────────────────────────────
const STOCK: Record<string, number> = {
  shimmeroak_log: 14, shimmeroak_plank: 22, dawnwood_plank: 6, cobblestone: 31, cut_stone: 2,
  block_sand: 18, glass: 3, thatch: 9, sunfruit: 7, moonberry: 12, clay_pot: 1, canvas: 0,
  goldwood_plank: 0, stone_brick: 4, plaster: 0, raw_mana_shard: 2,
}
const have = (id: string) => STOCK[id] ?? 0
const c = (itemId: string, count: number) => ({ itemId, count })
const RAW: { itemId: string; tab: string; cost: { itemId: string; count: number }[]; yields: string; tag?: string }[] = [
  { itemId: 'shimmeroak_plank', tab: 'Materials', cost: [c('shimmeroak_log', 1)], yields: '4×' },
  { itemId: 'dawnwood_plank', tab: 'Materials', cost: [c('dawnwood_log', 1)], yields: '4×' },
  { itemId: 'goldwood_plank', tab: 'Materials', cost: [c('goldwood_log', 1)], yields: '4×' },
  { itemId: 'cut_stone', tab: 'Materials', cost: [c('cobblestone', 4)], yields: '2×' },
  { itemId: 'glass', tab: 'Materials', cost: [c('block_sand', 4)], yields: '1×', tag: 'kiln does it for 3 sand' },
  { itemId: 'plaster', tab: 'Materials', cost: [c('block_sand', 2), c('clay_pot', 2)], yields: '2×' },
  { itemId: 'canvas', tab: 'Materials', cost: [c('thatch', 6)], yields: '1×' },
  { itemId: 'stone_brick', tab: 'Blocks', cost: [c('cut_stone', 4)], yields: '4×' },
  { itemId: 'mossy_stone_brick', tab: 'Blocks', cost: [c('stone_brick', 4), c('glow_moss', 1)], yields: '4×' },
  { itemId: 'pale_brick', tab: 'Blocks', cost: [c('block_sand', 4), c('cut_stone', 2)], yields: '4×' },
  { itemId: 'sandstone', tab: 'Blocks', cost: [c('block_sand', 4)], yields: '1×' },
  { itemId: 'shingle', tab: 'Blocks', cost: [c('shimmeroak_plank', 3)], yields: '4×' },
  { itemId: 'thatch', tab: 'Blocks', cost: [c('tall_grass', 6)], yields: '1×' },
  { itemId: 'timber_stack', tab: 'Blocks', cost: [c('shimmeroak_log', 4)], yields: '1×' },
  { itemId: 'stone_stack', tab: 'Blocks', cost: [c('cobblestone', 6)], yields: '1×' },
  { itemId: 'crafting_table', tab: 'Stations', cost: [c('shimmeroak_plank', 8)], yields: '1×' },
  { itemId: 'sawmill', tab: 'Stations', cost: [c('shimmeroak_plank', 12), c('cut_stone', 2)], yields: '1×' },
  { itemId: 'stonecutter', tab: 'Stations', cost: [c('cut_stone', 6), c('shimmeroak_plank', 4)], yields: '1×' },
  { itemId: 'kiln', tab: 'Stations', cost: [c('cobblestone', 12), c('clay_pot', 2)], yields: '1×' },
  { itemId: 'cauldron', tab: 'Stations', cost: [c('stone_brick', 6), c('raw_mana_shard', 1)], yields: '1×' },
  { itemId: 'oven', tab: 'Stations', cost: [c('cobblestone', 10)], yields: '1×' },
  { itemId: 'chest', tab: 'Furniture', cost: [c('shimmeroak_plank', 8)], yields: '1×' },
  { itemId: 'mana_lantern', tab: 'Furniture', cost: [c('glass', 2), c('raw_mana_shard', 1)], yields: '1×' },
  { itemId: 'shelf_slices', tab: 'Furniture', cost: [c('shimmeroak_plank', 3)], yields: '1×' },
  { itemId: 'garden_bed_shimmeroak', tab: 'Furniture', cost: [c('shimmeroak_plank', 6), c('block_topsoil', 4)], yields: '1×' },
  { itemId: 'waymark', tab: 'Furniture', cost: [c('cut_stone', 4), c('ather_crystal', 1)], yields: '1×' },
]
const MADE_AT: Record<string, string> = { cut_stone: 'at the stonecutter', glass: 'at the kiln', clay_pot: 'at the kiln' }
const TABS = ['Materials', 'Blocks', 'Stations', 'Furniture']
const TILES: GridTile[] = RAW.map(r => ({
  id: `r:${r.itemId}`, itemId: r.itemId, name: itemLabel(r.itemId), tab: r.tab, cost: r.cost, yields: r.yields, tag: r.tag,
  can: r.cost.every(x => have(x.itemId) >= x.count),
}))

// ── B, built from the kit — the same pieces the panels ship with ─────────────────────────────
function HearthCrafter({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(() => TABS.find(t => TILES.some(x => x.tab === t && x.can)) ?? TABS[0])
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [made, setMade] = useState(0)
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    const pool = n ? TILES.filter(t => t.name.toLowerCase().includes(n) || t.itemId.includes(n)) : TILES.filter(t => t.tab === tab)
    return [...pool].sort((a, b) => Number(b.can) - Number(a.can) || a.name.localeCompare(b.name))
  }, [tab, q])
  const pick = picked ? TILES.find(t => t.id === picked) ?? null : null

  return (
    <HearthFrame title="Crafting" maxWidth={560} onClose={onClose} backdrop={false}>
      <HearthHead>
        <div className="flex items-center justify-between gap-3 mb-3">
          <HearthNote>at the bench <span style={{ color: H.inkFaint }}>·</span> drawing on the bank</HearthNote>
          <HearthSearch value={q} onChange={setQ} />
        </div>
        <HearthTabs tabs={TABS.map(t => ({ id: t, label: t, count: TILES.filter(x => x.tab === t && x.can).length }))}
                    active={q ? null : tab} onPick={t => { setTab(t); setQ('') }} />
        <div className="mt-3" style={{ minHeight: 92 }}>
          {pick ? (
            <HearthCard key={pick.id}>
              <Well itemId={pick.itemId} size={58} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[18px] font-semibold leading-tight" style={hearthDisplay}>{pick.name}</span>
                  <span className="text-[12px] font-bold tabular-nums" style={{ color: H.ember }}>makes {pick.yields}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {pick.cost.map(x => <CostChip key={x.itemId} itemId={x.itemId} label={itemLabel(x.itemId)} have={have(x.itemId)} need={x.count} madeAt={MADE_AT[x.itemId]} />)}
                </div>
                {pick.tag && <div className="mt-1 text-[12px] italic" style={{ color: H.sky }}>{pick.tag}</div>}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0 items-stretch">
                <HearthButton primary disabled={!pick.can} onClick={() => setMade(m => m + 1)}>Craft</HearthButton>
                <div className="flex gap-1">
                  <HearthButton disabled={!pick.can} onClick={() => setMade(m => m + 5)}>×5</HearthButton>
                  <HearthButton disabled={!pick.can} onClick={() => setMade(m => m + 10)}>×10</HearthButton>
                </div>
              </div>
            </HearthCard>
          ) : <HearthCardEmpty>Pick something to see what it takes.</HearthCardEmpty>}
        </div>
      </HearthHead>
      <div className="px-4 pb-5 grid grid-cols-4 sm:grid-cols-5 gap-x-2 gap-y-3">
        {shown.map((t, i) => {
          const seam = i > 0 && !t.can && shown[i - 1].can
          return (<React.Fragment key={t.id}>
            {seam && <HearthDivider>needs materials</HearthDivider>}
            <HearthTile itemId={t.itemId} name={t.name} count={have(t.itemId)} can={t.can} index={i}
                        picked={t.id === picked} onClick={() => setPicked(t.id === picked ? null : t.id)} />
          </React.Fragment>)
        })}
        {shown.length === 0 && <div className="col-span-full py-6 text-center italic" style={{ color: H.inkFaint }}>Nothing here{q ? ` for “${q}”` : ''}.</div>}
      </div>
      {made > 0 && <div className="px-4 pb-3 text-[12px] italic" style={{ color: H.inkFaint }}>mock: {made} crafted (no state touched)</div>}
    </HearthFrame>
  )
}

function NowCrafter({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <PanelFrame width="w-[440px]" onClose={onClose}>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-white/95 font-semibold tracking-[.18em] uppercase">Crafting
          <span className="ml-2 text-amber-200/70 normal-case tracking-normal font-normal">at table</span>
          <span className="ml-2 text-white/35 normal-case tracking-normal font-normal">· drawing on the bank</span>
        </span>
      </div>
      <CraftGrid tiles={TILES} tabs={TABS} have={have} label={itemLabel} madeAt={id => MADE_AT[id]}
                 pickedId={picked} onPick={setPicked}
                 action={t => (<>
                   <CardButton on disabled={!t.can} onClick={() => {}}>craft</CardButton>
                   <CardButton disabled={!t.can} onClick={() => {}}>×5</CardButton>
                   <CardButton disabled={!t.can} onClick={() => {}}>×10</CardButton>
                 </>)} />
    </PanelFrame>
  )
}

// Stand-ins for the world behind the panel — a panel is judged over the scene it sits on.
const SCENES: Record<string, string> = {
  meadow: 'linear-gradient(180deg, #9fc9e8 0%, #cfe6ef 38%, #a9c77f 40%, #7fa55a 70%, #5d8445 100%)',
  dusk: 'linear-gradient(180deg, #2b2f5c 0%, #7a5a86 35%, #e0a07a 44%, #4d5a3a 46%, #2f3b26 100%)',
  night: 'linear-gradient(180deg, #0b1024 0%, #1a2240 40%, #1f2e24 44%, #111a14 100%)',
}

export default function HearthMock() {
  const [skin, setSkin] = useState<'hearth' | 'now'>('hearth')
  const [scene, setScene] = useState<keyof typeof SCENES>('meadow')
  const [open, setOpen] = useState(true)
  useEffect(() => {
    const p = new URLSearchParams(location.search)
    if (p.get('skin') === 'now') setSkin('now')
    const s = p.get('scene'); if (s && s in SCENES) setScene(s as keyof typeof SCENES)
  }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'c' && !(e.target instanceof HTMLInputElement)) setOpen(o => !o) }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  const pill = (on: boolean) => `px-3 h-8 rounded-full text-[12px] font-semibold transition-colors ${on ? 'bg-white text-black' : 'bg-black/40 text-white/75 hover:bg-black/60'}`

  return (
    <main className="fixed inset-0 overflow-hidden select-none" style={{ background: SCENES[scene] }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(0,0,0,.35) 100%)' }} />

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex flex-wrap justify-center gap-1.5 px-4" style={hearthBody}>
        <button className={pill(skin === 'hearth')} onClick={() => setSkin('hearth')}>B · Carved Hearth</button>
        <button className={pill(skin === 'now')} onClick={() => setSkin('now')}>Now (shipped)</button>
        <span className="w-2" />
        {Object.keys(SCENES).map(s => <button key={s} className={pill(scene === s)} onClick={() => setScene(s as keyof typeof SCENES)}>{s}</button>)}
      </div>

      {open ? (
        skin === 'hearth' ? (
          <div className="absolute inset-0 grid place-items-center pt-10 backdrop-blur-[3px] bg-black/25" onClick={() => setOpen(false)}>
            <div onClick={e => e.stopPropagation()}><HearthCrafter key={skin} onClose={() => setOpen(false)} /></div>
          </div>
        ) : (
          <div className="absolute inset-0 pt-10"><NowCrafter onClose={() => setOpen(false)} /></div>
        )
      ) : (
        <button onClick={() => setOpen(true)} className="absolute bottom-8 left-1/2 -translate-x-1/2 px-5 h-10 rounded-full bg-black/50 text-white/85 text-sm" style={hearthBody}>
          open the crafter (C)
        </button>
      )}
    </main>
  )
}
