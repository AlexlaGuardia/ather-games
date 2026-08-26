'use client'

// Every icon the game can put in a keeper's hands, in one place, drawn the way the bag draws it.
//
// ★ IT CALLS THE SHIPPED CHAIN. `icon-sheet.mts` states the rule and `dev/seam` follows it: a
// preview that re-derives can be perfectly correct while the game is wrong, which is the exact
// failure a preview exists to catch. So this asks `itemIcon()` for the data URL — the same function
// the hotbar and the satchel call — and `iconSourceFor()` for which arm answered. Nothing here
// knows how an icon is made.
//
// ★ AND THE ITEM LIST COMES FROM `voxel3d/item-universe.ts`, shared with `scripts/item-art.mts`.
// A page that rebuilt the list would be a mirror of the script: agreeing with each other, drifting
// from the game. That derivation's own history counts seven instances of precisely that.
//
// ⚠ THE BACKGROUND TOGGLE IS NOT A GARNISH. This HUD has twice shipped art that was invisible
// against the thing behind it — an emerald health bar that vanished into grass, and tool sockets
// that read as "translucent green shapes" once dimmed. An icon judged only on near-black is judged
// against the one background the player rarely sees it on. Grass and stone are here to be switched
// to, and the answer sometimes differs.
//
// Run: tools/devwin.sh sprites → http://localhost:3202/shimmer/dev/icons   (or /shimmer/dev/icons)

import { useMemo, useState } from 'react'
import { itemUniverse, UNIVERSE_SOURCES } from '../../voxel3d/item-universe'
import { itemIcon, iconSourceFor, iconPixelsFor } from '../../voxel3d/tex/item-icon'
import { ITEM_PALETTE } from '../../sprites/items'

type Source = ReturnType<typeof iconSourceFor>

/** How each arm is described, in the order the chain tries them. */
const BUCKETS: { key: Source; glyph: string; label: string; note: string }[] = [
  { key: 'block',   glyph: '🟦', label: 'derived',  note: "the block's own faces — nothing to draw" },
  { key: 'cross',   glyph: '🌿', label: 'cross',    note: 'crossed quads, as the world stands them' },
  { key: 'flora',   glyph: '🌱', label: 'flora',    note: "the world's own ground-cover generator" },
  { key: 'mesh',    glyph: '🧊', label: 'mesh',     note: 'rendered from the scatter geometry' },
  { key: 'painted', glyph: '🟩', label: 'painted',  note: 'hand-painted sprite in sprites/items.ts' },
  { key: null,      glyph: '⬜', label: 'no art',   note: 'the honest chip — nobody has drawn it' },
]

/** The pink that means nobody chose a palette. Slot 0 of the default, read not restated. */
const SENTINEL = ITEM_PALETTE[0]
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** Fraction of an icon's visible pixels wearing the sentinel — measured off the SHIPPED pixels. */
function sentinelPct(id: string): number {
  const px = iconPixelsFor(id, 48)
  if (!px) return 0
  const [r, g, b] = hex(SENTINEL)
  let cov = 0, hit = 0
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    cov++
    if (px[i] === r && px[i + 1] === g && px[i + 2] === b) hit++
  }
  return cov ? hit / cov : 0
}

const GROUNDS: { key: string; label: string; css: string }[] = [
  { key: 'dark',  label: 'night',  css: '#0d0d14' },
  { key: 'grass', label: 'meadow', css: '#4a7a3a' },
  { key: 'stone', label: 'stone',  css: '#8a8a86' },
  { key: 'sky',   label: 'sky',    css: '#9ec6e8' },
]

export default function IconsPage() {
  const [ground, setGround] = useState(GROUNDS[0])
  const [only, setOnly] = useState<Source | 'sentinel' | null | undefined>(undefined)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const uni = itemUniverse()
    return [...uni.entries()]
      .map(([id, from]) => ({ id, from: [...from], src: iconSourceFor(id), pct: sentinelPct(id) }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [])

  const shown = rows.filter(r => {
    if (q && !r.id.includes(q.toLowerCase())) return false
    if (only === undefined) return true
    if (only === 'sentinel') return r.pct > 0
    return r.src === only
  })

  const count = (k: Source) => rows.filter(r => r.src === k).length
  const screaming = rows.filter(r => r.pct > 0).length

  return (
    <div className="gx-chrome min-h-screen bg-[#0b0b11] text-white/90 p-6 font-mono text-[11px]">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="gx-label text-[15px] text-amber-200/90">Item icons</h1>
        <span className="text-white/40">{rows.length} reachable · drawn by the shipped chain</span>
        <span className="text-white/25">universe: {UNIVERSE_SOURCES}</span>
      </div>

      {/* Ground switch — see the header on why this is load-bearing rather than decorative. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="gx-label text-[9px] text-white/35">ground</span>
        {GROUNDS.map(g => (
          <button key={g.key} onClick={() => setGround(g)}
                  className={`gx-btn px-2 py-0.5 text-[10px] ${ground.key === g.key ? 'gx-active' : 'gx-inactive'}`}>
            {g.label}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="filter by id"
               className="ml-2 rounded-sm border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] outline-none
                          placeholder:text-white/25 focus:border-amber-200/50" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button onClick={() => setOnly(undefined)}
                className={`gx-btn px-2 py-0.5 text-[10px] ${only === undefined ? 'gx-active' : 'gx-inactive'}`}>all</button>
        {BUCKETS.map(b => (
          <button key={b.label} onClick={() => setOnly(b.key)} title={b.note}
                  className={`gx-btn px-2 py-0.5 text-[10px] ${only === b.key ? 'gx-active' : 'gx-inactive'}`}>
            {b.glyph} {b.label} {count(b.key)}
          </button>
        ))}
        {/* ⚠ The one bucket that is not about WHICH arm drew it, but about whether the result is
            wearing the "nobody chose colours" pink. An item can be `painted` and still be wrong. */}
        <button onClick={() => setOnly('sentinel')}
                className={`gx-btn px-2 py-0.5 text-[10px] ${only === 'sentinel' ? 'gx-active' : 'gx-inactive'}`}
                style={{ ['--gx-accent' as string]: SENTINEL }}
                title={`wearing ${SENTINEL} — slot 0 of the default palette, meaning no palette was chosen`}>
          no palette {screaming}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {shown.map(r => {
          const url = itemIcon(r.id)
          return (
            <div key={r.id} className="gx-card w-[128px] p-2" title={r.from.join(' · ')}>
              <div className="mb-1.5 grid h-[72px] place-items-center rounded-sm"
                   style={{ background: ground.css }}>
                {url
                  ? <img src={url} alt={r.id} width={56} height={56} style={{ imageRendering: 'pixelated' }} />
                  /* The chip is what the bag itself shows, so the page shows it too rather than a
                     placeholder of its own — an absence has to look like the real absence. */
                  : <span className="text-[9px] text-white/40">no art</span>}
              </div>
              <div className="truncate text-[10px] text-white/85" title={r.id}>{r.id}</div>
              <div className="flex items-baseline justify-between">
                <span className="text-[8px] text-white/35">{r.src ?? 'chip'}</span>
                {r.pct > 0 && (
                  <span className="gx-value text-[8px]" style={{ color: SENTINEL }}>
                    {Math.round(r.pct * 100)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {shown.length === 0 && <div className="text-white/35">nothing matches</div>}
    </div>
  )
}
