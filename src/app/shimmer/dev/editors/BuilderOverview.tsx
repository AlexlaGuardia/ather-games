'use client'

// ── BETA M83: the whole-map overview under the tile editor (Alex 11-23). The whole selected map, top-down, from the same heights
// the tile view sculpts + the draft's edits; the open tile outlined; click a tile to open it. Redrawn when the tile changes and
// after each stroke / undo (rev), not per brush tick. Pure half: builder-overview.ts.
import { useEffect, useMemo, useRef, useState } from 'react'
import { overviewLayout, overviewHeights, overviewRGBA, tileAtPixel, tileBox, type OvTile, type OvSource } from './builder-overview'

export interface OverviewProps {
  tiles: OvTile[]
  tile: string
  onPick: (name: string) => void
  source: (t: OvTile) => OvSource | null
  edits: (name: string) => Record<string, number> | undefined
  waterY: number
  /** bump to redraw (strokes, undo, a tile's heights arriving) */
  rev: number
  px?: number
  tint?: boolean
  maxW?: number
  note?: string
}

export default function BuilderOverview({ tiles, tile, onPick, source, edits, waterY, rev, px = 32, tint = true, maxW = 520, note }: OverviewProps) {
  const cv = useRef<HTMLCanvasElement>(null)
  const L = useMemo(() => overviewLayout(tiles, px), [tiles, px])
  const [hover, setHover] = useState<OvTile | null>(null)
  const drawn = useRef(0)
  const src = useRef(source); src.current = source
  const ed = useRef(edits); ed.current = edits

  useEffect(() => {
    const c = cv.current; if (!c || !L.w) return
    if (c.width !== L.w || c.height !== L.h) { c.width = L.w; c.height = L.h }
    const { H, edited, drawn: n } = overviewHeights(L, tiles, t => src.current(t), name => ed.current(name))
    drawn.current = n
    const img = new ImageData(L.w, L.h); img.data.set(overviewRGBA(L, H, edited, waterY, tint))
    c.getContext('2d')!.putImageData(img, 0, 0)
  }, [L, tiles, waterY, rev, tint])

  const at = (e: { clientX: number; clientY: number }) => {
    const c = cv.current; if (!c) return undefined
    const r = c.getBoundingClientRect()
    return tileAtPixel(L, tiles, (e.clientX - r.left) / r.width * L.w, (e.clientY - r.top) / r.height * L.h)
  }
  const cur = tiles.find(t => t.name === tile), box = cur ? tileBox(L, cur) : null, hb = hover && hover.name !== tile ? tileBox(L, hover) : null

  // test hook (scripts/builder-overview-check.mts): what is drawn, what is lit, and where a tile sits on screen
  useEffect(() => {
    ;(window as unknown as { __overview?: unknown }).__overview = {
      tiles: tiles.length, cols: L.cols, rows: L.rows, drawn: () => drawn.current, current: tile, lit: box,
      names: () => tiles.map(t => t.name),
      /** client coords of a tile's centre (for a real mouse click) */
      centre: (name: string) => {
        const t = tiles.find(q => q.name === name), c = cv.current; if (!t || !c) return null
        const r = c.getBoundingClientRect(), b = tileBox(L, t)
        return { x: r.left + (b.x + b.w / 2) * r.width, y: r.top + (b.y + b.h / 2) * r.height }
      },
      /** mean rgb inside a tile's box (proves pixels were drawn there) */
      rgb: (name: string) => {
        const t = tiles.find(q => q.name === name), c = cv.current; if (!t || !c) return null
        const x0 = (t.tx - L.tx0) * L.px, y0 = (t.ty - L.ty0) * L.px, d = c.getContext('2d')!.getImageData(x0, y0, L.px, L.px).data
        let r = 0, g = 0, b = 0; for (let o = 0; o < d.length; o += 4) { r += d[o]; g += d[o + 1]; b += d[o + 2] }
        const n = d.length / 4; return [r / n, g / n, b / n]
      },
    }
  })

  if (!L.w) return null
  return (
    <div className="flex flex-col gap-1" data-testid="overview-wrap">
      <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
        <span>Whole map</span>
        <span className="normal-case tracking-normal font-mono text-white/35">{hover ? `${hover.name} (${hover.tx},${hover.ty}) · click to open` : `${tile} lit${tiles.length > 1 ? ' · click a tile to open it' : ''}`}</span>
      </div>
      <div className="relative select-none" style={{ width: '100%', maxWidth: Math.min(maxW, L.w * 8), aspectRatio: `${L.cols} / ${L.rows}` }}>
        <canvas ref={cv} className="absolute inset-0 w-full h-full block rounded" style={{ cursor: tiles.length > 1 ? 'pointer' : 'default' }} data-testid="overview"
          onPointerMove={e => { const t = at(e); setHover(t ?? null) }} onPointerLeave={() => setHover(null)}
          onClick={e => { const t = at(e); if (t && t.name !== tile) onPick(t.name) }} />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
          {hb && <rect x={hb.x} y={hb.y} width={hb.w} height={hb.h} fill="white" fillOpacity={0.12} stroke="white" strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
          {box && <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#fbbf24" fillOpacity={0.12} stroke="#fbbf24" strokeWidth={2.5} vectorEffect="non-scaling-stroke" data-testid="overview-lit" />}
        </svg>
      </div>
      {note && <div className="text-[10px] font-mono text-white/30">{note}</div>}
    </div>
  )
}
