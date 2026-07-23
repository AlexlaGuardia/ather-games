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

export type FrameStats = {
  fps: number; worstMs: number; spikes: number; dpr: number
  // ── Leak detection ────────────────────────────────────────────────────────────────────────────
  // Alex's lag arrives "after a while", which is the signature of something GROWING, not of a
  // scene that is simply too heavy — that would stutter from the first second. These are three.js's
  // own accounting plus the JS heap, with a baseline captured on the first sample so DRIFT is
  // visible rather than an absolute nobody can calibrate against. Geometries/textures/programs
  // climbing while you stand still is a leak and a code bug. All flat while frames get worse is
  // the GPU genuinely being out of room, and only then is it a hardware conversation.
  geometries: number; textures: number; programs: number
  calls: number; triangles: number
  heapMB: number
  /** First-sample values — the "what did we start at" column. */
  base: { geometries: number; textures: number; programs: number; heapMB: number } | null
}

/** Autosave cost, written by flushPersist in Shimmer3D. Here because this is the diagnostics panel. */
export type SaveStats = { ms: number; kb: number; writes: number; skipped: number }

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
  const baseRef = useRef<FrameStats['base']>(null)
  useFrame((state, dt) => {
    const a = acc.current
    a.frames++
    a.t += dt
    const ms = dt * 1000
    if (ms > a.worst) a.worst = ms
    if (ms > SPIKE_MS) a.spikes++
    if (a.t >= WINDOW_S) {
      const info = state.gl.info
      // Chrome-only and not in TS's DOM lib. Absent elsewhere, which is fine — the three.js
      // counters are the load-bearing ones and they work everywhere.
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      const heapMB = mem ? mem.usedJSHeapSize / 1048576 : 0
      const geometries = info.memory.geometries
      const textures = info.memory.textures
      const programs = info.programs?.length ?? 0
      // Baseline on the first full sample, not at mount — the scene is still streaming in at mount,
      // so a mount-time baseline would count normal warm-up as a leak.
      if (!baseRef.current) baseRef.current = { geometries, textures, programs, heapMB }
      statsRef.current = {
        fps: a.frames / a.t,
        worstMs: a.worst,
        spikes: a.spikes / a.t,          // spikes per second — comparable across window lengths
        dpr: state.gl.getPixelRatio(),   // reads what AdaptiveDpr actually settled on, not what we asked for
        geometries, textures, programs,
        calls: info.render.calls,        // per-frame; three.js resets these each frame
        triangles: info.render.triangles,
        heapMB,
        base: baseRef.current,
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

/**
 * A counter next to how far it has drifted from its baseline. The delta is the whole point — an
 * absolute geometry count means nothing without knowing whether it is going up.
 */
function Drift({ k, v, base, unit = '' }: { k: string; v: number; base?: number; unit?: string }) {
  const d = base === undefined ? 0 : v - base
  // 5% of baseline (min 2 units) before it counts as growth — small churn is normal as the player
  // crosses chunk boundaries and props stream in and out.
  const grew = base !== undefined && d > Math.max(2, base * 0.05)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', lineHeight: 1.8 }}>
      <span style={{ font: '700 10px ui-monospace, monospace', color: '#cfeee2' }}>{k}</span>
      <span style={{ font: '800 12px ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', color: grew ? '#ff9d7a' : '#eafff6' }}>
        {v ? v.toFixed(0) : '—'}{v ? unit : ''}
        {grew && <span style={{ font: '700 10px ui-monospace, monospace' }}> +{d.toFixed(0)}</span>}
      </span>
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
export function GfxPanel({ gfx, onGfx, statsRef, saveRef }: {
  gfx: GfxSettings
  onGfx: (next: GfxSettings) => void
  statsRef: React.RefObject<FrameStats>
  saveRef: React.RefObject<SaveStats>
}) {
  const [stats, setStats] = useState<FrameStats>({
    fps: 0, worstMs: 0, spikes: 0, dpr: 1,
    geometries: 0, textures: 0, programs: 0, calls: 0, triangles: 0, heapMB: 0, base: null,
  })
  const [save, setSave] = useState<SaveStats>({ ms: 0, kb: 0, writes: 0, skipped: 0 })
  useEffect(() => {
    const t = setInterval(() => {
      if (statsRef.current) setStats(statsRef.current)
      if (saveRef.current) setSave({ ...saveRef.current })
    }, 250)
    return () => clearInterval(t)
  }, [statsRef, saveRef])

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

      <div style={{ ...label, margin: '12px 0 4px' }}>LEAK WATCH</div>
      <div style={{ background: '#0b1513', border: '1px solid #ffffff18', borderRadius: 8, padding: '6px 9px' }}>
        <Drift k="geometries" v={stats.geometries} base={stats.base?.geometries} />
        <Drift k="textures" v={stats.textures} base={stats.base?.textures} />
        <Drift k="shaders" v={stats.programs} base={stats.base?.programs} />
        <Drift k="js heap" v={stats.heapMB} base={stats.base?.heapMB} unit="mb" />
        <Row k="draw calls" v={stats.calls ? String(stats.calls) : '—'} />
        <Row k="triangles" v={stats.triangles ? `${(stats.triangles / 1000).toFixed(0)}k` : '—'} />
      </div>
      <div style={{ font: '600 9px/1.4 ui-monospace, monospace', color: '#8aa9a0', margin: '5px 0 2px' }}>
        Numbers in orange are climbing since you opened this. Standing still should hold them
        steady — if they creep, it is a leak in the code, not the GPU.
      </div>

      <div style={{ ...label, margin: '12px 0 4px' }}>AUTOSAVE</div>
      <div style={{ background: '#0b1513', border: '1px solid #ffffff18', borderRadius: 8, padding: '6px 9px' }}>
        <Row k="last save" v={save.writes || save.skipped ? `${save.ms.toFixed(1)}ms` : '—'} warn={save.ms > 16} />
        <Row k="save size" v={save.kb ? `${save.kb.toFixed(0)}kb` : '—'} />
        <Row k="writes/skips" v={`${save.writes}/${save.skipped}`} />
      </div>
      <div style={{ font: '600 9px/1.4 ui-monospace, monospace', color: '#8aa9a0', margin: '5px 0 2px' }}>
        Skips are saves where nothing changed. Runs in idle time, not mid-frame.
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
