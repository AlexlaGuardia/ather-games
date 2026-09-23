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
// The frame is procedural (gradients + an SVG grain), so the look can be judged before any frame
// art is generated. If B wins, the frame is the one piece worth handing to the art pipeline.
import React, { useEffect, useMemo, useState } from 'react'
import { CraftGrid, CardButton, CraftIcon, type GridTile } from '../../voxel3d/craft-grid'
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

// ── the material ─────────────────────────────────────────────────────────────────────────────
// One SVG grain, reused by the wood (stretched along the board) and the parchment (fine and square).
const grain = (fx: number, fy: number, oct: number, alpha: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='${oct}' seed='7'/><feColorMatrix values='0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.04  0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}")`
const WOOD = `${grain(0.012, 0.22, 3, 0.55)}, linear-gradient(180deg, #7a4f2c 0%, #5e3a1f 45%, #4a2d18 100%)`
const PAPER = `${grain(0.9, 0.9, 2, 0.10)}, radial-gradient(120% 90% at 50% 0%, #f7eedb 0%, #efe1c3 70%, #e6d3ae 100%)`

const H = {
  ink: '#3a2716', inkSoft: '#6b5238', inkFaint: '#9a8163',
  ember: '#c8642a', emberHi: '#e0823f', moss: '#5f7d45', rust: '#a8482f', sky: '#4f7690',
}
const display = { fontFamily: 'var(--font-hearth-display), Georgia, serif' }
const body = { fontFamily: 'var(--font-hearth-body), system-ui, sans-serif' }

function HearthX({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="close" title="close (esc)"
            className="absolute -top-3 -right-3 z-30 w-9 h-9 rounded-full grid place-items-center transition-transform hover:scale-105 active:scale-95"
            style={{ background: `${grain(0.02, 0.3, 3, 0.5)}, radial-gradient(circle at 35% 30%, #8a5b33, #4a2d18)`,
                     boxShadow: '0 3px 6px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,220,170,.35), inset 0 -2px 3px rgba(0,0,0,.4)' }}>
      <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1.8 1.8 L8.2 8.2 M8.2 1.8 L1.8 8.2" stroke="#f1dfbf" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      </svg>
    </button>
  )
}

function Well({ itemId, size, dim }: { itemId: string; size: number; dim?: boolean }) {
  return (
    <span className="grid place-items-center shrink-0 rounded-[10px]"
          style={{ width: size, height: size,
                   background: 'radial-gradient(circle at 50% 40%, #e9d7b4, #d6bf95)',
                   boxShadow: 'inset 0 2px 4px rgba(74,45,24,.45), inset 0 -1px 0 rgba(255,250,235,.7), 0 1px 0 rgba(255,250,235,.6)',
                   filter: dim ? 'grayscale(.7) opacity(.55)' : undefined }}>
      <CraftIcon itemId={itemId} size={Math.round(size * 0.62)} />
    </span>
  )
}

function HearthButton({ primary, disabled, children, onClick }: { primary?: boolean; disabled?: boolean; children: React.ReactNode; onClick: () => void }) {
  const style: React.CSSProperties = disabled
    ? { background: '#e3d2b1', color: H.inkFaint, boxShadow: 'inset 0 1px 2px rgba(74,45,24,.25)' }
    : primary
      ? { background: `linear-gradient(180deg, ${H.emberHi}, ${H.ember})`, color: '#fff7ea', boxShadow: '0 2px 0 #8d4119, 0 3px 6px rgba(74,45,24,.35), inset 0 1px 0 rgba(255,225,190,.6)' }
      : { background: 'linear-gradient(180deg, #f6ead2, #e7d5b2)', color: H.ink, boxShadow: '0 2px 0 #b99a6c, 0 3px 5px rgba(74,45,24,.2), inset 0 1px 0 #fffaf0' }
  return (
    <button disabled={disabled} onClick={onClick}
            className={`h-9 px-4 rounded-full text-[13px] font-extrabold transition-transform ${disabled ? 'cursor-not-allowed' : 'hover:-translate-y-px active:translate-y-[2px]'}`}
            style={{ ...body, ...style }}>{children}</button>
  )
}

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
    <div className="hearth-open relative w-[min(560px,calc(100vw-32px))]">
      <HearthX onClick={onClose} />
      {/* the frame: carved boards, a bevel, the parchment set into it */}
      <div className="rounded-[18px] p-[13px]"
           style={{ background: WOOD, boxShadow: '0 18px 40px rgba(20,10,4,.55), 0 4px 10px rgba(20,10,4,.4), inset 0 1px 0 rgba(255,210,160,.35), inset 0 -2px 0 rgba(0,0,0,.35)' }}>
        {/* the title plaque, carved into the top board */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-4 z-20 px-6 h-9 rounded-full flex items-center gap-2 whitespace-nowrap"
             style={{ background: `${grain(0.015, 0.3, 3, 0.5)}, linear-gradient(180deg, #8c5d34, #5a371d)`,
                      boxShadow: '0 4px 8px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,215,170,.4), inset 0 -2px 2px rgba(0,0,0,.35)' }}>
          <span className="text-[19px] font-semibold tracking-[.01em]" style={{ ...display, color: '#f6e4c2', textShadow: '0 1px 0 rgba(0,0,0,.5)' }}>Crafting</span>
        </div>
        <div className="rounded-[10px] overflow-hidden"
             style={{ background: PAPER, boxShadow: 'inset 0 2px 6px rgba(58,39,22,.45), inset 0 0 0 1px rgba(58,39,22,.35)' }}>
          <div className="max-h-[78vh] overflow-y-auto hearth-scroll" style={{ ...body, color: H.ink }}>
            {/* head: where you are, the tabs, the search — sticky, like the shipped grid */}
            <div className="sticky top-0 z-10 px-4 pt-6 pb-3" style={{ background: 'linear-gradient(180deg, #f5ebd5 85%, rgba(245,235,213,0))' }}>
              <div className="text-center text-[12px] mb-3" style={{ color: H.inkSoft }}>
                at the bench <span style={{ color: H.inkFaint }}>·</span> drawing on the bank
              </div>
              <div className="flex items-end gap-1 flex-wrap">
                {TABS.map(t => {
                  const on = t === tab && !q
                  const n = TILES.filter(x => x.tab === t && x.can).length
                  return (
                    <button key={t} onClick={() => { setTab(t); setQ('') }}
                            className="relative px-3 pt-1.5 pb-2 rounded-t-[10px] text-[13px] font-bold transition-all"
                            style={on
                              ? { background: '#fbf4e4', color: H.ink, boxShadow: '0 -1px 3px rgba(58,39,22,.18), inset 0 -3px 0 ' + H.ember, transform: 'translateY(0)' }
                              : { background: 'rgba(214,191,149,.45)', color: H.inkSoft, transform: 'translateY(2px)' }}>
                      {t}
                      <span className="ml-1.5 text-[11px] font-semibold tabular-nums" style={{ color: n ? H.moss : H.inkFaint }}>{n}</span>
                    </button>
                  )
                })}
                <label className="ml-auto flex items-center gap-1.5 h-8 px-3 rounded-full mb-1"
                       style={{ background: '#e8d8b8', boxShadow: 'inset 0 1px 3px rgba(58,39,22,.35)' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="5" cy="5" r="3.6" stroke={H.inkSoft} strokeWidth="1.5" fill="none" /><path d="M7.8 7.8 L11 11" stroke={H.inkSoft} strokeWidth="1.5" strokeLinecap="round" /></svg>
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find…"
                         className="w-24 bg-transparent outline-none text-[13px] placeholder:text-[#9a8163]" style={{ color: H.ink }} />
                </label>
              </div>
              <div className="h-px -mt-px" style={{ background: 'rgba(58,39,22,.25)' }} />

              {/* the lifted-paper card */}
              <div className="mt-3" style={{ minHeight: 92 }}>
                {pick ? (
                  <div key={pick.id} className="hearth-card rounded-[12px] px-3.5 py-3 flex items-center gap-3"
                       style={{ background: 'linear-gradient(180deg, #fffaf0, #f6ead2)',
                                boxShadow: '0 6px 14px rgba(58,39,22,.22), 0 1px 2px rgba(58,39,22,.25)', transform: 'rotate(-0.4deg)' }}>
                    <Well itemId={pick.itemId} size={58} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[18px] font-semibold leading-tight" style={display}>{pick.name}</span>
                        <span className="text-[12px] font-bold tabular-nums" style={{ color: H.ember }}>makes {pick.yields}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {pick.cost.map(x => {
                          const ok = have(x.itemId) >= x.count
                          return (
                            <span key={x.itemId} className="inline-flex items-center gap-1 h-6 pl-0.5 pr-2 rounded-full text-[12px] font-semibold"
                                  style={{ background: ok ? 'rgba(95,125,69,.14)' : 'rgba(168,72,47,.12)', color: ok ? H.moss : H.rust }}>
                              <CraftIcon itemId={x.itemId} size={18} />
                              {itemLabel(x.itemId)}
                              <span className="tabular-nums">{have(x.itemId)}/{x.count}</span>
                              {!ok && MADE_AT[x.itemId] && <span className="font-medium" style={{ color: H.sky }}>· {MADE_AT[x.itemId]}</span>}
                            </span>
                          )
                        })}
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
                  </div>
                ) : (
                  <div className="rounded-[12px] px-4 flex items-center gap-3 text-[13px] italic"
                       style={{ minHeight: 92, border: '1.5px dashed rgba(58,39,22,.25)', color: H.inkFaint }}>
                    <span className="w-[58px] h-[58px] rounded-[10px] shrink-0" style={{ boxShadow: 'inset 0 2px 4px rgba(74,45,24,.25)' }} />
                    Pick something to see what it takes.
                  </div>
                )}
              </div>
            </div>

            {/* the grid of carved wells */}
            <div className="px-4 pb-5 grid grid-cols-4 sm:grid-cols-5 gap-x-2 gap-y-3">
              {shown.map((t, i) => {
                const on = t.id === picked
                const seam = i > 0 && !t.can && shown[i - 1].can
                return (<React.Fragment key={t.id}>
                  {seam && (
                    <div className="col-span-full flex items-center gap-2 mt-1 text-[12px] italic" style={{ ...display, color: H.inkFaint }}>
                      <span className="flex-1 h-px" style={{ background: 'rgba(58,39,22,.2)' }} />
                      needs materials
                      <span className="flex-1 h-px" style={{ background: 'rgba(58,39,22,.2)' }} />
                    </div>
                  )}
                  <button onClick={() => setPicked(on ? null : t.id)} title={t.name}
                          className="hearth-tile group relative flex flex-col items-center gap-1 pt-1.5 pb-1 rounded-[12px] transition-all"
                          style={{ animationDelay: `${Math.min(i, 14) * 18}ms`,
                                   background: on ? 'rgba(200,100,42,.13)' : 'transparent',
                                   boxShadow: on ? `inset 0 0 0 2px ${H.ember}` : undefined }}>
                    <span className="transition-transform group-hover:-translate-y-0.5"><Well itemId={t.itemId} size={62} dim={!t.can} /></span>
                    <span className="text-[12px] leading-[14px] text-center line-clamp-2 px-0.5 font-semibold"
                          style={{ color: t.can ? H.ink : H.inkFaint }}>{t.name}</span>
                    {have(t.itemId) > 0 && (
                      <span className="absolute top-0.5 right-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-extrabold grid place-items-center tabular-nums"
                            style={{ background: '#fbf4e4', color: H.inkSoft, boxShadow: '0 1px 2px rgba(58,39,22,.35)' }}>{have(t.itemId)}</span>
                    )}
                  </button>
                </React.Fragment>)
              })}
              {shown.length === 0 && <div className="col-span-full py-6 text-center italic" style={{ color: H.inkFaint }}>Nothing here{q ? ` for “${q}”` : ''}.</div>}
            </div>
          </div>
        </div>
      </div>
      {made > 0 && <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-[12px] text-white/70" style={body}>mock: {made} crafted (no state touched)</div>}
    </div>
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
      <style>{`
        @keyframes hearthOpen { 0% { opacity: 0; transform: translateY(14px) scale(.96) } 60% { opacity: 1; transform: translateY(-3px) scale(1.01) } 100% { transform: none } }
        @keyframes hearthCard { 0% { opacity: 0; transform: translateY(-6px) rotate(-1.4deg) } 100% { opacity: 1; transform: rotate(-0.4deg) } }
        @keyframes hearthTile { 0% { opacity: 0; transform: translateY(6px) } 100% { opacity: 1; transform: none } }
        .hearth-open { animation: hearthOpen 320ms cubic-bezier(.2,.9,.3,1.2) both }
        .hearth-card { animation: hearthCard 220ms cubic-bezier(.2,.9,.3,1.15) both }
        .hearth-tile { animation: hearthTile 240ms ease-out both }
        .hearth-scroll::-webkit-scrollbar { width: 8px } .hearth-scroll::-webkit-scrollbar-thumb { background: rgba(58,39,22,.3); border-radius: 8px }
        @media (prefers-reduced-motion: reduce) { .hearth-open, .hearth-card, .hearth-tile { animation: none } }
      `}</style>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(0,0,0,.35) 100%)' }} />

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex flex-wrap justify-center gap-1.5 px-4" style={body}>
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
        <button onClick={() => setOpen(true)} className="absolute bottom-8 left-1/2 -translate-x-1/2 px-5 h-10 rounded-full bg-black/50 text-white/85 text-sm" style={body}>
          open the crafter (C)
        </button>
      )}
    </main>
  )
}
