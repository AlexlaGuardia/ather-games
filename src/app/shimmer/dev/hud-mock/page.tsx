'use client'
// THE HUD LOOK-CALL — Phase 9 of the Carved Hearth rollout, mocked before it is built.
//
// ★ WHY (2026-09-22, Alex: "show me a mock of 1 and 2 first"). Every menu now wears the hearth; the
// always-on HUD is still the arcade's dark plates. The HUD is on screen for the whole game, so its
// look is Alex's call, judged over the world rather than described. Three faces over ONE frame of a
// real harness world (public/shimmer/mock/hud-bg.jpg, HTML overlays hidden at capture):
//   Now   — the shipped HUD, approximated here in its own classes.
//   1     — LIGHT TOUCH: stays dark and quiet so it never competes with the world, but takes the
//           hearth's shapes — rounded wells, a slim wood rim, the ember ring, the two faces.
//   2     — FULL HEARTH: wood frames and parchment on the HUD itself.
// The night toggle darkens the world, because a HUD that reads at noon and vanishes at dusk is the
// failure this choice is most likely to hide.
//
// Static mock: no refs, no world, fixed sample data. The icons are the real `CraftIcon` art.
import React, { useEffect, useState } from 'react'
import { CraftIcon } from '../../voxel3d/craft-icon'
import { H, WOOD, PAPER, grain, hearthDisplay, hearthBody } from '../../ui/hearth'
import { HEARTH_FONT_VARS } from '../../ui/hearth-fonts'

type V = 'now' | 'light' | 'full'
const BAR = ['shimmeroak_plank', 'mushroom_cap', 'glass', 'ather_crystal', 'raw_mana_shard', 'chest', 'moonberry', 'cobblestone']
const COUNTS = [22, 2, 3, 1, 5, 2, 12, 31]
const SEL = 2

// ── tokens per face ──────────────────────────────────────────────────────────────────────────
const CREAM = '#f6e4c2'
const SMOKE = 'rgba(30,19,10,.62)'                       // light-touch plate: warm charcoal, not black
const RIM = 'linear-gradient(180deg, #9a6a3c, #5a371d)'  // the slim wood rim, as a border-image stand-in
const shadowText = '0 1px 2px rgba(0,0,0,.85)'

function Rim({ children, r = 12, pad = 2, style }: { children: React.ReactNode; r?: number; pad?: number; style?: React.CSSProperties }) {
  // A slim carved rim: wood gradient behind, the content inset by `pad`.
  return (
    <div style={{ background: `${grain(0.01, 0.4, 3, 0.6)}, ${RIM}`, borderRadius: r, padding: pad, boxShadow: '0 3px 8px rgba(0,0,0,.4)', ...style }}>
      {children}
    </div>
  )
}

function Frame({ children, r = 14, style }: { children: React.ReactNode; r?: number; style?: React.CSSProperties }) {
  // Full hearth: a wood frame around parchment.
  return (
    <div style={{ background: WOOD, borderRadius: r, padding: 6, boxShadow: '0 6px 14px rgba(20,10,4,.5), inset 0 1px 0 rgba(255,210,160,.35)', ...style }}>
      <div style={{ background: PAPER, borderRadius: r - 5, boxShadow: 'inset 0 1px 4px rgba(58,39,22,.45)', color: H.ink }}>{children}</div>
    </div>
  )
}

// ── top-left: where you are ──────────────────────────────────────────────────────────────────
function Info({ v }: { v: V }) {
  if (v === 'now') return (
    <div className="absolute top-3 left-3 bg-black/70 rounded px-2.5 py-2 font-mono text-[11px] leading-5">
      <div className="text-white font-bold tracking-[.12em]">SHIMMER</div>
      <div className="text-white/50">⌂ room ❈ Rune Hold (play3d)</div>
      <div className="text-white/80">x 224 y 100 z 13</div>
      <div><span className="text-white/40 tracking-[.14em]">FORE</span> <span className="text-white">Worn Blade</span> <span className="text-white/40 tracking-[.14em]">PROS</span> <span className="text-white">Worn Spike</span></div>
    </div>
  )
  const body = (tone: string, dim: string) => (
    <div className="px-3 py-2 leading-5" style={hearthBody}>
      <div className="text-[16px] font-semibold" style={{ ...hearthDisplay, color: tone }}>Shimmer</div>
      <div className="text-[12px]" style={{ color: dim }}>your garden · x 224, z 13</div>
      <div className="text-[12px]" style={{ color: dim }}>fore <b style={{ color: tone }}>Worn Blade</b> · pros <b style={{ color: tone }}>Worn Spike</b></div>
    </div>
  )
  if (v === 'light') return (
    <div className="absolute top-3 left-3"><Rim r={12}><div style={{ background: SMOKE, borderRadius: 10, textShadow: shadowText }}>{body(CREAM, 'rgba(246,228,194,.7)')}</div></Rim></div>
  )
  return <div className="absolute top-3 left-3"><Frame r={14}>{body(H.ink, H.inkSoft)}</Frame></div>
}

// ── top-centre: the objective ────────────────────────────────────────────────────────────────
function Objective({ v }: { v: V }) {
  if (v === 'now') return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono bg-black/45 rounded px-2.5 py-1">
      <span className="text-white/40 tracking-[.22em] uppercase">objective</span>{' '}<span className="text-amber-200/90">Find Gregory</span>
    </div>
  )
  const inner = (tone: string, dim: string) => (
    <div className="px-4 py-1.5 text-[13px] flex items-baseline gap-2" style={hearthBody}>
      <span className="italic" style={{ ...hearthDisplay, color: dim }}>next</span>
      <span className="font-bold" style={{ color: tone }}>Find Gregory</span>
    </div>
  )
  if (v === 'light') return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2"><Rim r={999}><div style={{ background: SMOKE, borderRadius: 999, textShadow: shadowText }}>{inner('#f1b27a', 'rgba(246,228,194,.7)')}</div></Rim></div>
  )
  return <div className="absolute top-3 left-1/2 -translate-x-1/2"><Frame r={999} style={{ padding: 4 }}>{inner(H.ember, H.inkSoft)}</Frame></div>
}

// ── top-right: minimap, clock, options door ──────────────────────────────────────────────────
function Corner({ v }: { v: V }) {
  // The capture's own minimap canvas sits at top-right (1440 wide: ~1282..1426, 12..158); the mock
  // frames that same spot so the frame is judged around the real picture.
  const door = v === 'now'
    ? <div className="mt-2 ml-auto w-7 h-7 grid place-items-center rounded-[2px] border border-amber-300/40 bg-amber-300/10 text-amber-200 text-[14px]">☰</div>
    : v === 'light'
      ? <div className="mt-2 ml-auto"><Rim r={999} pad={2}><div className="w-9 h-9 grid place-items-center rounded-full text-[16px]" style={{ background: SMOKE, color: CREAM }}>☰</div></Rim></div>
      : <div className="mt-2 ml-auto w-10 h-10 grid place-items-center rounded-full text-[16px]" style={{ background: WOOD, color: CREAM, boxShadow: '0 3px 6px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,215,170,.4)' }}>☰</div>
  // A painted stand-in map under every frame: the backdrop is scaled to the window, so the capture's
  // own minimap never lines up with a fixed frame — this keeps the comparison about the FRAME.
  const map: React.CSSProperties = { background: 'radial-gradient(60% 75% at 30% 50%, #6f9e52 0%, #5d8a45 70%, #1a1430 71%, #0d0a1c 100%)' }
  return (
    <div className="absolute flex flex-col" style={{ top: 6, right: 8, width: 158 }}>
      <div className="absolute left-0 right-0 top-0 overflow-hidden" style={{ height: 152, borderRadius: v === 'now' ? 8 : 14, ...map }}>
        <span className="absolute w-2 h-2 rounded-full bg-rose-400 ring-2 ring-white/80" style={{ left: '46%', top: '48%' }} />
      </div>
      {v === 'now' && <div style={{ height: 152 }} className="rounded-lg border border-white/15" />}
      {v === 'light' && <div style={{ height: 152, borderRadius: 14, boxShadow: `inset 0 0 0 3px #7a4f2c, inset 0 0 0 4px rgba(255,210,160,.35), 0 3px 8px rgba(0,0,0,.4)` }} />}
      {v === 'full' && (
        <div className="relative" style={{ height: 152, borderRadius: 16, boxShadow: `inset 0 0 0 6px #6a4222, inset 0 0 0 7px rgba(255,210,160,.35), 0 6px 14px rgba(20,10,4,.5)` }}>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 h-6 rounded-full flex items-center text-[12px] font-semibold whitespace-nowrap"
               style={{ ...hearthDisplay, background: WOOD, color: CREAM, boxShadow: '0 2px 5px rgba(0,0,0,.45)' }}>11:00 · morning</div>
        </div>
      )}
      {v !== 'full' && (
        <div className="mt-1.5 self-center px-2 py-0.5 rounded-full text-[12px] whitespace-nowrap"
             style={v === 'now' ? { background: 'rgba(0,0,0,.45)', color: 'rgba(255,255,255,.6)', fontFamily: 'monospace', fontSize: 10 } : { ...hearthBody, background: SMOKE, color: CREAM, textShadow: shadowText, fontWeight: 700 }}>
          11:00 · morning
        </div>
      )}
      {door}
    </div>
  )
}

// ── bottom-centre: the hotbar ────────────────────────────────────────────────────────────────
function Bar({ v }: { v: V }) {
  const held = 'Glass · 3'
  const label = (
    <div className="mb-1.5 text-center text-[14px] font-semibold"
         style={v === 'now' ? { color: '#fde68a', textShadow: shadowText, fontFamily: 'monospace', letterSpacing: '.08em', fontSize: 13 } : { ...hearthDisplay, color: CREAM, textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>{held}</div>
  )
  const slot = (i: number) => {
    const sel = i === SEL
    if (v === 'now') return (
      <div key={i} className={`w-12 h-12 rounded border-2 flex flex-col items-center justify-center text-[9px] font-mono ${sel ? 'border-amber-300 bg-black/60' : 'border-white/20 bg-black/40'}`}>
        <CraftIcon itemId={BAR[i]} size={24} /><div className="text-white/80 mt-0.5 tabular-nums">{COUNTS[i]}</div>
      </div>
    )
    const well: React.CSSProperties = v === 'light'
      ? { background: 'radial-gradient(circle at 50% 40%, rgba(60,40,24,.75), rgba(22,14,8,.85))', boxShadow: sel ? `inset 0 0 0 2.5px ${H.emberHi}, 0 0 12px rgba(224,130,63,.55)` : 'inset 0 2px 5px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,210,160,.14)' }
      : { background: 'radial-gradient(circle at 50% 40%, #e9d7b4, #d6bf95)', boxShadow: sel ? `inset 0 0 0 2.5px ${H.ember}, 0 3px 8px rgba(200,100,42,.4)` : 'inset 0 2px 4px rgba(74,45,24,.45), inset 0 -1px 0 rgba(255,250,235,.7)' }
    return (
      <div key={i} className="relative w-[52px] h-[52px] rounded-[11px] grid place-items-center transition-transform"
           style={{ ...well, transform: sel ? 'translateY(-3px)' : undefined }}>
        <CraftIcon itemId={BAR[i]} size={32} />
        <span className="absolute bottom-0.5 right-1.5 text-[11px] font-extrabold tabular-nums"
              style={{ ...hearthBody, color: v === 'light' ? CREAM : H.ink, textShadow: v === 'light' ? shadowText : '0 1px 0 rgba(255,250,235,.8)' }}>{COUNTS[i]}</span>
        <span className="absolute top-0.5 left-1.5 text-[10px] font-bold" style={{ ...hearthBody, color: v === 'light' ? 'rgba(246,228,194,.45)' : H.inkFaint }}>{i + 1}</span>
      </div>
    )
  }
  const row = <div className="inline-flex items-end gap-1.5">{BAR.map((_, i) => slot(i))}</div>
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
      {label}
      {v === 'now' && row}
      {v === 'light' && <Rim r={16} pad={2}><div className="p-1.5 rounded-[14px]" style={{ background: SMOKE }}>{row}</div></Rim>}
      {v === 'full' && <div className="p-2 rounded-[18px]" style={{ background: WOOD, boxShadow: '0 8px 18px rgba(20,10,4,.5), inset 0 1px 0 rgba(255,210,160,.35), inset 0 -2px 0 rgba(0,0,0,.35)' }}>{row}</div>}
    </div>
  )
}

// ── bottom-left: tool slots + health ─────────────────────────────────────────────────────────
function Vitals({ v }: { v: V }) {
  if (v === 'now') return (
    <div className="absolute bottom-3 left-3 w-[172px]">
      <div className="flex gap-1.5 mb-1.5">
        {['Z', 'C'].map(k => <div key={k} className="relative w-11 h-11 rounded border border-white/15 bg-black/60"><span className="absolute bottom-0.5 right-1 text-[9px] font-mono text-white/60">{k.toLowerCase()}</span></div>)}
      </div>
      <div className="rounded border border-white/15 bg-black/60 px-2 py-1.5 font-mono text-[9px]">
        <div className="flex justify-between"><span className="text-rose-300/70 tracking-[.14em]">HEALTH</span><span><span className="text-sky-300/80">+100</span> <span className="text-white">100</span></span></div>
        <div className="mt-1 h-2.5 rounded bg-indigo-200/80" />
      </div>
    </div>
  )
  const tone = v === 'light' ? CREAM : H.ink
  const dim = v === 'light' ? 'rgba(246,228,194,.65)' : H.inkSoft
  const inner = (
    <div className="px-3 py-2" style={hearthBody}>
      <div className="flex justify-between items-baseline text-[12px]">
        <span className="font-semibold" style={{ ...hearthDisplay, color: tone, fontSize: 14 }}>Health</span>
        <span className="tabular-nums font-bold" style={{ color: tone }}><span style={{ color: v === 'light' ? '#9cc58a' : H.moss }}>+100</span> 100</span>
      </div>
      <div className="mt-1.5 h-2.5 rounded-full overflow-hidden" style={{ background: v === 'light' ? 'rgba(0,0,0,.45)' : H.paperLo, boxShadow: 'inset 0 1px 2px rgba(0,0,0,.4)' }}>
        <div className="h-full rounded-full" style={{ width: '100%', background: 'linear-gradient(180deg, #d9735a, #a8482f)' }} />
      </div>
      <div className="mt-1 text-[11px] italic" style={{ ...hearthDisplay, color: dim }}>well rested</div>
    </div>
  )
  const tool = (k: string, icon?: string) => {
    const well: React.CSSProperties = v === 'light'
      ? { background: 'radial-gradient(circle at 50% 40%, rgba(60,40,24,.75), rgba(22,14,8,.85))', boxShadow: 'inset 0 2px 5px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,210,160,.14)' }
      : { background: 'radial-gradient(circle at 50% 40%, #e9d7b4, #d6bf95)', boxShadow: 'inset 0 2px 4px rgba(74,45,24,.45)' }
    return (
      <div key={k} className="relative w-12 h-12 rounded-[11px] grid place-items-center" style={well}>
        {icon && <CraftIcon itemId={icon} size={28} />}
        <span className="absolute bottom-0.5 right-1.5 text-[11px] font-bold" style={{ ...hearthBody, color: v === 'light' ? 'rgba(246,228,194,.6)' : H.inkFaint }}>{k}</span>
      </div>
    )
  }
  const tools = <div className="flex gap-1.5 mb-2">{tool('z', 'shimmeroak_plank')}{tool('c')}</div>
  return (
    <div className="absolute bottom-3 left-3 w-[190px]">
      {v === 'light' ? <Rim r={14} pad={2} style={{ display: 'inline-block', marginBottom: 8 }}><div className="p-1 rounded-[12px]" style={{ background: SMOKE }}>{tools}</div></Rim> : tools}
      {v === 'light'
        ? <Rim r={14}><div className="rounded-[12px]" style={{ background: SMOKE, textShadow: shadowText }}>{inner}</div></Rim>
        : <Frame r={14}>{inner}</Frame>}
    </div>
  )
}

// ── bottom-right: the rune rings + the mana orb ──────────────────────────────────────────────
function Mana({ v }: { v: V }) {
  const rings = [{ x: -124, y: 6 }, { x: -106, y: -54 }, { x: -62, y: -98 }, { x: -2, y: -118 }]
  const ring = (i: number) => {
    const p = rings[i]
    const style: React.CSSProperties = v === 'now'
      ? { background: 'rgba(0,0,0,.6)', border: '1px solid rgba(255,255,255,.25)' }
      : v === 'light'
        ? { background: SMOKE, boxShadow: `inset 0 0 0 2px #7a4f2c, 0 0 0 1px rgba(255,210,160,.25), 0 3px 6px rgba(0,0,0,.4)` }
        : { background: 'radial-gradient(circle at 50% 40%, #e9d7b4, #d6bf95)', boxShadow: `inset 0 0 0 4px #6a4222, 0 3px 6px rgba(0,0,0,.45)` }
    const glyph = v === 'full' ? H.ink : CREAM
    return (
      <div key={i} className="absolute w-12 h-12 rounded-full grid place-items-center" style={{ left: 60 + p.x, top: 20 + p.y, ...style }}>
        <svg width="18" height="18" viewBox="0 0 24 24"><path d={['M6 18 L18 6', 'M12 4 L12 20 M8 8 L16 8', 'M5 12 Q12 2 19 12', 'M7 7 L17 17 M17 7 L7 17'][i]} stroke={glyph} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
        <span className="absolute -bottom-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold grid place-items-center"
              style={v === 'full' ? { background: H.paperHi, color: H.inkSoft, boxShadow: '0 1px 2px rgba(58,39,22,.35)' } : { background: 'rgba(0,0,0,.8)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}>{[16, 1, 18, 16][i]}</span>
      </div>
    )
  }
  const orb: React.CSSProperties = v === 'now'
    ? { background: 'radial-gradient(circle at 50% 40%, #9a78d4, #7a58b8)' }
    : v === 'light'
      ? { background: 'radial-gradient(circle at 45% 35%, #b397e6, #7657b4 60%, #4f3a82)', boxShadow: `0 0 0 3px #7a4f2c, 0 0 0 4px rgba(255,210,160,.35), 0 6px 14px rgba(0,0,0,.45), inset 0 -6px 14px rgba(0,0,0,.25)` }
      : { background: 'radial-gradient(circle at 45% 35%, #b397e6, #7657b4 60%, #4f3a82)', boxShadow: `0 0 0 7px #6a4222, 0 0 0 8px rgba(255,210,160,.35), 0 8px 18px rgba(20,10,4,.5), inset 0 -6px 14px rgba(0,0,0,.25)` }
  return (
    <div className="absolute bottom-4 right-4" style={{ width: 110, height: 110 }}>
      {[0, 1, 2, 3].map(ring)}
      <div className="absolute inset-0 rounded-full grid place-items-center text-center" style={orb}>
        <div>
          <div className="text-[26px] leading-none font-bold" style={v === 'now' ? { color: '#fff', fontFamily: 'monospace' } : { ...hearthDisplay, color: '#fff7ea' }}>120</div>
          <div className="text-[11px]" style={v === 'now' ? { color: 'rgba(255,255,255,.75)', fontFamily: 'monospace', letterSpacing: '.2em' } : { ...hearthDisplay, color: 'rgba(255,247,234,.85)', fontStyle: 'italic' }}>{v === 'now' ? 'MANA' : 'mana'}</div>
        </div>
      </div>
    </div>
  )
}

export default function HudMock() {
  const [v, setV] = useState<V>('light')
  const [night, setNight] = useState(false)
  useEffect(() => {
    const p = new URLSearchParams(location.search)
    const q = p.get('v'); if (q === 'now' || q === 'light' || q === 'full') setV(q)
    if (p.get('night') === '1') setNight(true)
  }, [])
  const pill = (on: boolean) => `px-3 h-8 rounded-full text-[12px] font-semibold transition-colors ${on ? 'bg-white text-black' : 'bg-black/55 text-white/80 hover:bg-black/70'}`
  return (
    <main className={`fixed inset-0 overflow-hidden select-none ${HEARTH_FONT_VARS}`} style={{ background: '#6fa0d8' }}>
      <img src="/shimmer/mock/hud-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover"
           style={{ filter: night ? 'brightness(.32) saturate(.7) hue-rotate(12deg)' : undefined }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: night ? 'radial-gradient(120% 90% at 50% 45%, rgba(20,30,70,.15), rgba(5,8,25,.55))' : undefined }} />
      <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />

      <Info v={v} />
      <Objective v={v} />
      <Corner v={v} />
      <Bar v={v} />
      <Vitals v={v} />
      <Mana v={v} />

      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex flex-wrap justify-center gap-1.5 px-4" style={hearthBody}>
        <button className={pill(v === 'now')} onClick={() => setV('now')}>Now</button>
        <button className={pill(v === 'light')} onClick={() => setV('light')}>1 · Light touch</button>
        <button className={pill(v === 'full')} onClick={() => setV('full')}>2 · Full hearth</button>
        <span className="w-2" />
        <button className={pill(!night)} onClick={() => setNight(false)}>day</button>
        <button className={pill(night)} onClick={() => setNight(true)}>night</button>
      </div>
    </main>
  )
}
