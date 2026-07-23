'use client'
// Graphics quality panel + the frame instrument behind it.
//
// Built because the fix for Alex's lag (MSAA off, smaller shadow map) is a LOOK trade, and a look
// call is his, not mine. Rather than describe jaggies in prose and ask him to imagine them, this
// puts the toggles and a live frame readout on screen together so he rules from what he sees.
//
// The readout reports WORST FRAME, not just average fps. Average fps hides exactly the thing he
// reported: a scene can average a healthy 55fps and still hitch, because one 180ms frame is a
// visible stutter that a one-second average smears into nothing. Worst-frame and the spike count
// are the honest numbers for "is it hitching", so they get equal billing.
import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { menuBtn } from './ui'
import { type GfxSettings, type ShadowQuality, GFX_DEFAULTS } from './gfx'

export type FrameStats = { fps: number; worstMs: number; spikes: number; dpr: number }

// A frame slower than this reads as a hitch rather than a slow-but-smooth frame. 50ms = 20fps
// instantaneous; below that the eye stops reading motion and starts reading a stutter.
const SPIKE_MS = 50
const WINDOW_S = 0.5

/**
 * Mount INSIDE the Canvas. Writes frame stats into the shared ref; never sets React state, so
 * measuring the render loop cannot itself perturb the render loop. The panel polls the ref.
 */
export function FrameProbe({ statsRef }: { statsRef: React.RefObject<FrameStats> }) {
  const acc = useRef({ frames: 0, t: 0, worst: 0, spikes: 0 })
  useFrame((state, dt) => {
    const a = acc.current
    a.frames++
    a.t += dt
    const ms = dt * 1000
    if (ms > a.worst) a.worst = ms
    if (ms > SPIKE_MS) a.spikes++
    if (a.t >= WINDOW_S) {
      statsRef.current = {
        fps: a.frames / a.t,
        worstMs: a.worst,
        spikes: a.spikes / a.t,          // spikes per second — comparable across window lengths
        dpr: state.gl.getPixelRatio(),   // reads what AdaptiveDpr actually settled on, not what we asked for
      }
      a.frames = 0; a.t = 0; a.worst = 0; a.spikes = 0
    }
  })
  return null
}

const label: React.CSSProperties = {
  font: '800 9px ui-monospace, monospace', color: '#8fd9c4', letterSpacing: '0.14em',
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', lineHeight: 1.8 }}>
      <span style={{ font: '700 10px ui-monospace, monospace', color: '#cfeee2' }}>{k}</span>
      <span style={{
        font: '800 12px ui-monospace, monospace', fontVariantNumeric: 'tabular-nums',
        color: warn ? '#ff9d7a' : '#eafff6',
      }}>{v}</span>
    </div>
  )
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      ...menuBtn, flex: 1, textAlign: 'center', padding: '5px 0',
      border: active ? '1px solid #7fe3c8' : '1px solid #ffffff22',
      background: active ? '#12352c' : '#0b1513',
      color: active ? '#eafff6' : '#8aa9a0',
    }}>{children}</button>
  )
}

/**
 * The DOM half. Polls statsRef at 4Hz — the same polling shape useRoster uses, and for the same
 * reason: a readout that re-rendered per frame would be measuring its own overhead.
 */
export function GfxPanel({ gfx, onGfx, statsRef }: {
  gfx: GfxSettings
  onGfx: (next: GfxSettings) => void
  statsRef: React.RefObject<FrameStats>
}) {
  const [stats, setStats] = useState<FrameStats>({ fps: 0, worstMs: 0, spikes: 0, dpr: 1 })
  useEffect(() => {
    const t = setInterval(() => { if (statsRef.current) setStats(statsRef.current) }, 250)
    return () => clearInterval(t)
  }, [statsRef])

  const set = (patch: Partial<GfxSettings>) => onGfx({ ...gfx, ...patch })
  const isLight = !gfx.antialias && gfx.shadows !== 'high' && gfx.adaptiveDpr

  return (
    <div style={{ width: 216, background: 'rgba(11,21,19,0.96)', border: '1px solid #2f5c4f', borderRadius: 11, padding: 12 }}>
      <div style={{ ...label, textAlign: 'center', marginBottom: 10 }}>GRAPHICS</div>

      <div style={{ background: '#0b1513', border: '1px solid #ffffff18', borderRadius: 8, padding: '6px 9px' }}>
        <Row k="fps" v={stats.fps ? stats.fps.toFixed(0) : '—'} warn={stats.fps > 0 && stats.fps < 50} />
        <Row k="worst frame" v={stats.worstMs ? `${stats.worstMs.toFixed(0)}ms` : '—'} warn={stats.worstMs > SPIKE_MS} />
        <Row k="hitches/s" v={stats.spikes ? stats.spikes.toFixed(1) : '0'} warn={stats.spikes > 0.5} />
        <Row k="resolution" v={`${stats.dpr.toFixed(2)}x`} />
      </div>
      <div style={{ font: '600 9px/1.4 ui-monospace, monospace', color: '#8aa9a0', margin: '5px 0 2px' }}>
        Worst frame is the number that matters for stutter. Under {SPIKE_MS}ms is smooth.
      </div>

      <div style={{ ...label, margin: '12px 0 4px' }}>EDGE SMOOTHING</div>
      <div style={{ display: 'flex', gap: 5 }}>
        <Seg active={gfx.antialias} onClick={() => set({ antialias: true })}>On</Seg>
        <Seg active={!gfx.antialias} onClick={() => set({ antialias: false })}>Off</Seg>
      </div>
      <div style={{ font: '600 9px/1.4 ui-monospace, monospace', color: '#8aa9a0', marginTop: 4 }}>
        Off = stair-stepped diagonals. Costs the most on integrated graphics.
      </div>

      <div style={{ ...label, margin: '12px 0 4px' }}>SHADOWS</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {(['off', 'low', 'high'] as ShadowQuality[]).map(q => (
          <Seg key={q} active={gfx.shadows === q} onClick={() => set({ shadows: q })}>
            {q === 'off' ? 'Off' : q === 'low' ? 'Soft' : 'Sharp'}
          </Seg>
        ))}
      </div>
      <div style={{ font: '600 9px/1.4 ui-monospace, monospace', color: '#8aa9a0', marginTop: 4 }}>
        Soft = same shadows, blurrier edges. Range and draw distance never change.
      </div>

      <div style={{ ...label, margin: '12px 0 4px' }}>ADAPTIVE RESOLUTION</div>
      <div style={{ display: 'flex', gap: 5 }}>
        <Seg active={gfx.adaptiveDpr} onClick={() => set({ adaptiveDpr: true })}>On</Seg>
        <Seg active={!gfx.adaptiveDpr} onClick={() => set({ adaptiveDpr: false })}>Off</Seg>
      </div>
      <div style={{ font: '600 9px/1.4 ui-monospace, monospace', color: '#8aa9a0', marginTop: 4 }}>
        Drops sharpness only while the GPU is drowning, then recovers.
      </div>

      <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
        <button
          onClick={() => onGfx(isLight ? GFX_DEFAULTS : { antialias: false, shadows: 'low', adaptiveDpr: true })}
          style={{ ...menuBtn, flex: 1, textAlign: 'center' }}
        >{isLight ? '↺ Full look' : '⚡ Light preset'}</button>
      </div>
      <div style={{ font: '600 9px/1.4 ui-monospace, monospace', color: '#b8ae94', marginTop: 6 }}>
        Changing edge smoothing or shadows rebuilds the view — you keep your spot, but click once to
        re-grab the mouse.
      </div>
    </div>
  )
}
