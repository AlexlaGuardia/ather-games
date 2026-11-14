'use client'

// The two panels the plot opens: the GATE's fold map (fast travel through the fold network) and GREGORY's ground
// (buy garden squares with grey matter, once the grimoire allows the ring). Flat DOM over the canvas.

import { useEffect, useRef } from 'react'
import { tileCentreWorld, type Wilds } from './wilds'
import { GREG_WAYMARK, MAX_WAYMARKS, type Waymark } from './waymarks'
import { BIOME_NAME } from './wilds'
import { cellOrigin, FOG_CELL, walkedShare, type Fog } from './explored'
import { drawCloud, ATHER_CLOUD } from '../../ui/map-kit'
import type { Pitstop } from '../continent/pitstops'
import { GRID, sqId, ringOf, canBuy, RING_PAGES, GRIMOIRE_SIZE, type Garden } from './plot'

export type Dest =
  | { kind: 'home' }
  | { kind: 'waymark'; w: Waymark }
  | { kind: 'landing'; id: string; name: string }

/** Rune Hold's public gate-landing (gates.md 08-12): the first pitstop door, open from the start. THE HALLWAY
 *  (gates.md 11-14) adds a door per city the keeper has visited; the list comes from continent/pitstops.ts. */
export const LANDING: Pitstop = { id: 'rune-hold', name: 'Rune Hold', x: 255, z: 53 }

const shell: React.CSSProperties = { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(12,16,20,0.55)' }
const card: React.CSSProperties = { width: 'min(94vw, 760px)', maxHeight: '92vh', overflow: 'auto', padding: 16, borderRadius: 12, background: 'rgba(24,28,32,0.94)', color: '#eef3f6', font: '13px system-ui, sans-serif' }
const label: React.CSSProperties = { opacity: 0.55, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }
const title: React.CSSProperties = { font: '600 12px system-ui', letterSpacing: '0.2em', textTransform: 'uppercase' }
const pin = (bg: string, size: number): React.CSSProperties => ({
  position: 'absolute', width: size, height: size, margin: -size / 2, borderRadius: size, background: bg,
  boxShadow: '0 0 0 2px rgba(20,24,28,0.75)', border: 0, padding: 0, cursor: 'pointer',
})

/** The fog of war over the tile image, painted by the shared map kit (same cloud as the continent map). The fog
 *  is one continent-wide grid in world coords; this crops it to the tile. */
function FogLayer({ fog, W }: { fog: Fog; W: Wilds }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const px = 640; cv.width = px; cv.height = px
    const c = tileCentreWorld(W.meta), x0 = c.x - W.meta.sizeX / 2, z0 = c.z - W.meta.sizeZ / 2
    const cellPx = px / (W.meta.sizeX / FOG_CELL)
    const ctx = cv.getContext('2d')!; ctx.clearRect(0, 0, px, px)
    drawCloud(ctx, fog, cellPx, -((x0 - cellOrigin.x) / FOG_CELL) * cellPx, -((z0 - cellOrigin.z) / FOG_CELL) * cellPx, ATHER_CLOUD)
  }, [fog, fog.rev, W])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
}

export function FoldMap({ view, travel, W, fog, waymarks, here, inWilds, onTravel, tile, pitstops }: {
  view: 'ather' | 'athernyx'; travel: boolean; W: Wilds | null; fog: Fog | null; waymarks: Waymark[]
  here: { x: number; z: number }; inWilds: boolean; onTravel: (d: Dest) => void; tile: string; pitstops: Pitstop[]
}) {
  const sx = W?.meta.sizeX ?? 1000, sz = W?.meta.sizeZ ?? 1000
  const pct = (x: number, z: number) => ({ left: `${((x + sx / 2) / sx) * 100}%`, top: `${((z + sz / 2) / sz) * 100}%` })
  const src = W?.meta.source ?? { x0: 770, y0: 420, x1: 870, y1: 520 }
  const go = (d: Dest) => travel && onTravel(d)
  const stop = (name: string, sub: string, d: Dest, colour: string) => (
    <button key={name} disabled={!travel} onClick={() => go(d)} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6,
      border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'inherit', font: 'inherit', cursor: travel ? 'pointer' : 'default',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: colour, flex: 'none' }} />
      <span style={{ flex: 1 }}>{name}<br /><span style={{ opacity: 0.55, fontSize: 11 }}>{sub}</span></span>
    </button>
  )
  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={title}>{view === 'ather' ? 'The fold map · the Ather' : 'The fold map · Athernyx'}</div>
          <div style={{ ...label, opacity: 0.6 }}>{travel ? 'Click to travel · ' : ''}Tab flips · Esc closes</div>
        </div>
        {view === 'ather' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 14 }}>
            <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#334' }}>
              <img src={`/open/wilds/${tile}-map.png`} alt="" style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }} />
              {fog && W && <FogLayer fog={fog} W={W} />}
              <button title="Gregory's waymark" onClick={() => go({ kind: 'waymark', w: GREG_WAYMARK })} style={{ ...pin('#e7c766', 13), ...pct(GREG_WAYMARK.x, GREG_WAYMARK.z) }} />
              {waymarks.filter(w => w.tile === tile).map(w => (
                <button key={w.id} title={`Your waymark · ${BIOME_NAME[w.biome]}`} onClick={() => go({ kind: 'waymark', w })} style={{ ...pin('#6fd3c4', 13), ...pct(w.x, w.z) }} />
              ))}
              {inWilds && <div style={{ ...pin('#ffffff', 8), cursor: 'default', ...pct(here.x, here.z) }} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={label}>Stops</div>
              {stop('Your plot', 'home', { kind: 'home' }, '#f2d88a')}
              {stop("Gregory's waymark", 'the Wilds · meadow', { kind: 'waymark', w: GREG_WAYMARK }, '#e7c766')}
              {waymarks.map((w, k) => stop(`Waymark ${k + 1}`, `the Wilds · ${BIOME_NAME[w.biome]}`, { kind: 'waymark', w }, '#6fd3c4'))}
              <div style={{ opacity: 0.6, fontSize: 11, marginTop: 6 }}>{waymarks.length} / {MAX_WAYMARKS} waymarks. Plant one with F where you stand in the Wilds.</div>
              {fog && W && (() => { const c = tileCentreWorld(W.meta); return <div style={{ opacity: 0.6, fontSize: 11 }}>Walked: {Math.round(walkedShare(fog, c.x - sx / 2, c.z - sz / 2, c.x + sx / 2, c.z + sz / 2) * 100)}% of this country</div> })()}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img src="/open/wilds/continent-relief.jpg" alt="" style={{ width: '100%', display: 'block' }} />
              <div title="Your Wilds stand here" style={{ position: 'absolute', left: `${(src.x0 / 1168) * 100}%`, top: `${(src.y0 / 784) * 100}%`, width: `${((src.x1 - src.x0) / 1168) * 100}%`, height: `${((src.y1 - src.y0) / 784) * 100}%`, border: '2px solid #6fd3c4', boxShadow: '0 0 0 2px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
              {pitstops.map(p => (
                <button key={p.id} title={`${p.name} · a door off the hall`} onClick={() => go({ kind: 'landing', id: p.id, name: p.name })}
                  style={{ ...pin('#f2d88a', 13), left: `${((p.x + 5835) / 11670) * 100}%`, top: `${((p.z + 3915) / 7830) * 100}%` }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 14, marginTop: 10, alignItems: 'start' }}>
              <div style={{ opacity: 0.75, fontSize: 12 }}>The same ground in its other state. Each city keeps a door off the hall; visit a city and its door opens to you. {LANDING.name}&apos;s is open from the start.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={label}>Doors</div>
                {pitstops.map(p => stop(p.name, p.id === LANDING.id ? 'the gate-landing' : 'city door', { kind: 'landing', id: p.id, name: p.name }, '#f2d88a'))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function GregPanel({ garden, onBuy, onClose }: { garden: Garden; onBuy: (i: number, j: number) => void; onClose: () => void }) {
  const owned = new Set(garden.owned)
  const size = GRIMOIRE_SIZE(garden.pages)
  const nextRing = RING_PAGES.findIndex(p => garden.pages < p)
  return (
    <div style={shell}>
      <div style={{ ...card, width: 'min(94vw, 560px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={title}>Gregory · your ground</div>
          <button onClick={onClose} style={{ background: 'none', border: 0, color: 'inherit', opacity: 0.6, cursor: 'pointer', font: 'inherit' }}>Esc closes</button>
        </div>
        <div style={{ display: 'flex', gap: 18, marginBottom: 12 }}>
          <div><div style={label}>Grey matter</div><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>{garden.grey}</span></div>
          <div><div style={label}>Grimoire</div><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>{garden.pages} / {size}</span> pages</div>
          <div><div style={label}>Ground</div><span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>{owned.size} / {GRID * GRID}</span> squares</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID}, 1fr)`, gap: 3, aspectRatio: '1', maxWidth: 420, margin: '0 auto' }}>
          {Array.from({ length: GRID * GRID }, (_, k) => {
            const i = k % GRID, j = Math.floor(k / GRID), id = sqId(i, j)
            const mine = owned.has(id), v = canBuy(owned, i, j, garden.pages, garden.grey)
            const ring = ringOf(i, j), sealed = garden.pages < RING_PAGES[ring]
            const forSale = !mine && !sealed && (v.ok || v.cost !== undefined && !v.why.startsWith('It has to touch'))
            const bg = mine ? '#7fae5a' : forSale ? (v.ok ? '#d9b85c' : '#8a7a4a') : '#3a3f46'
            return (
              <button key={id} title={mine ? 'Yours' : v.ok ? `Buy for ${v.cost} grey matter` : v.why}
                onClick={() => v.ok && onBuy(i, j)}
                style={{ border: 0, borderRadius: 3, background: bg, color: '#1b1e22', font: '600 10px system-ui', cursor: v.ok ? 'pointer' : 'default', opacity: mine || forSale ? 1 : 0.7 }}>
                {!mine && forSale ? v.cost : !mine && sealed ? RING_PAGES[ring] + 'p' : ''}
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.55, opacity: 0.8 }}>
          {nextRing > 0
            ? <>Next ring opens at <b>{RING_PAGES[nextRing]}</b> grimoire pages. </>
            : <>Every ring is open. </>}
          Gold squares are for sale now (number = grey matter). Squares marked with <b>p</b> need that many pages. Hollows in the Wilds drop grey matter.
        </div>
      </div>
    </div>
  )
}
