'use client'
// THE HUD KIT, MOUNTED — the real Phase 9 pieces over the same world frame as `hud-mock`.
//
// ★ WHY A SECOND PAGE (2026-09-23, play lane). `hud-mock` is a static drawing of the two faces;
// this page mounts the SHIPPABLE components from `ui/hearth-hud.tsx` — live refs, the real ItemChip
// icons, the real mana vessel, the real day-cycle clock. What Alex judges here is what the Hud swap
// will draw, not a picture of it. Same backdrop and the same toggles, so the two pages compare 1:1.
//
// ★ THE WIDTH TOGGLE (2026-09-23, Alex: "any suggestions for the narrow window.. i imagine its the
// same for mobile"). wide / compact / phone are the three layouts `hud-flag.ts` § THE HUD SIZES
// describes; `auto` is whatever this window really is (so on a phone it IS the phone layout). A
// simulated width renders inside a frame with a `transform`, which makes it the containing block for
// the kit's `position:fixed` pieces — so the map frame and clock land in the simulated corner, not
// the real one. That is also why sizes are props: a media query would read the real window.
//
// Sample state only: fixed refs for vitals/mana/buffs/tools, a painted stand-in under the minimap
// frame (the backdrop is scaled to the window, so its own minimap never lines up — hud-mock's reason).
import React, { useEffect, useRef, useState } from 'react'
import { HEARTH_FONT_VARS } from '../../ui/hearth-fonts'
import { hearthBody } from '../../ui/hearth'
import {
  HearthHotbar, HearthObjective, HearthVitals, HearthBuffChips, HearthMapFrame, HearthClock, HearthOrbRim,
  HearthLip, HearthToolPips, hearthSocket, useHudSize, MINIMAP_BOX, MINIMAP_BOX_PHONE, type ToolPip,
} from '../../ui/hearth-hud'
import { parseHudFace, type HudFace, type HudSize } from '../../ui/hud-flag'
import { ManaGauge } from '../../hud/mana-gauge'
import type { ActiveBuffs } from '../../engine/potion-effects'

const BAR: ([string, number] | null)[] = [['shimmeroak_plank', 22], ['mushroom_cap', 2], ['glass', 3], null, ['raw_mana_shard', 5], ['chest', 2], ['moonberry', 12], ['cobblestone', 31]]
const ENTRIES = BAR.map(e => (e ? { itemId: e[0], count: e[1] } : null))
const PIPS: ToolPip[] = [
  { family: 'forestry', level: 4, xpPct: 0.6, active: true },
  { family: 'prospecting', level: 2, xpPct: 0.25, active: false },
  { family: 'rinning', level: 1, xpPct: 0.1, active: false },
  { family: 'farming', level: 3, xpPct: 0.8, active: false },
]
type View = 'auto' | HudSize
/** The simulated screens. Compact = Alex's own 842px window; phone = a 390×844 handset. */
const SIM: Record<HudSize, { w: number; h: number } | null> = { wide: null, compact: { w: 842, h: 910 }, phone: { w: 390, h: 844 } }

function Layout({ face, size, sel, setSel, night }: { face: HudFace; size: HudSize; sel: number; setSel: (i: number) => void; night: boolean }) {
  const vitals = useRef({ hp: 72, hpMax: 100, shield: 30, shieldMax: 50 })
  const mana = useRef({ cur: 84, max: 120, regen: 1 })
  const buffs = useRef<ActiveBuffs>({} as ActiveBuffs)
  useEffect(() => {
    // Set after mount: a wall-clock deadline in the first render is a hydration mismatch.
    buffs.current = { fleetfoot: Date.now() + 185_000, kindred: Date.now() + 61_000 } as ActiveBuffs
  }, [])
  const held = ENTRIES[sel] ? { text: `${ENTRIES[sel]!.itemId.replace(/_/g, ' ')} · ${ENTRIES[sel]!.count}`, out: false } : null
  const box = size === 'phone' ? MINIMAP_BOX_PHONE : MINIMAP_BOX
  const lip = size === 'compact' ? <HearthLip face={face} vitals={vitals} />
    : size === 'phone' ? <HearthLip face={face} vitals={vitals} mana={mana} tools={<HearthToolPips face={face} pips={PIPS} />} />
    : undefined
  return (
    <>
      <img src="/shimmer/mock/hud-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover"
           style={{ filter: night ? 'brightness(.32) saturate(.7) hue-rotate(12deg)' : undefined }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: night ? 'radial-gradient(120% 90% at 50% 45%, rgba(20,30,70,.15), rgba(5,8,25,.55))' : undefined }} />
      <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />

      {/* The live minimap's box, painted, so the frame is judged around a map. */}
      <div style={{ position: 'fixed', top: box.top, right: box.right, width: box.size, height: box.size, zIndex: box.z, borderRadius: 10,
                    background: 'radial-gradient(60% 75% at 30% 50%, #6f9e52 0%, #5d8a45 70%, #1a1430 71%, #0d0a1c 100%)' }} />
      <HearthMapFrame face={face} box={box} />
      <HearthClock face={face} box={box} />
      <HearthObjective face={face} value="Find Gregory" anchor={size === 'phone' ? 'left' : 'center'} />
      <HearthBuffChips face={face} buffs={buffs} top={size === 'wide' ? undefined : size === 'phone' ? 58 : 12} />
      {size === 'wide' && <div className="absolute bottom-4 left-4"><HearthVitals face={face} vitals={vitals} /></div>}
      <HearthHotbar face={face} entries={ENTRIES} sel={sel} held={held} dimmed={false} onSelect={setSel} size={size} lip={lip} />
      {/* The orb corner: whole at wide, shrunk to ~96px at compact (the live gauge is a fixed 152, so
          the wiring needs a size on ManaGauge/HudCorner — scaled here to judge the look), gone on a phone. */}
      {size !== 'phone' && (
        <div className="absolute bottom-4 right-4 pointer-events-none" style={size === 'compact' ? { transform: 'scale(.63)', transformOrigin: 'bottom right' } : undefined}>
          <div className="relative">
            <ManaGauge mana={mana} />
            <HearthOrbRim face={face} />
            {[180, 137, 93, 50].map((a, i) => {
              const r = 115, rad = (a * Math.PI) / 180
              return <div key={a} className="absolute w-14 h-14 rounded-full"
                          style={{ left: 76 + r * Math.cos(rad), top: 76 - r * Math.sin(rad), transform: 'translate(-50%,-50%)', ...hearthSocket(face, i === 0) }} />
            })}
          </div>
        </div>
      )}
    </>
  )
}

export default function HudKit() {
  const [face, setFace] = useState<HudFace>('full')
  const [night, setNight] = useState(false)
  const [sel, setSel] = useState(2)
  const [view, setView] = useState<View>('auto')
  const [vh, setVh] = useState(900)
  const real = useHudSize()
  useEffect(() => {
    const p = new URLSearchParams(location.search)
    setFace(parseHudFace(p.get('hud')) ?? 'full')
    setNight(p.get('night') === '1')
    const w = p.get('w'); if (w === 'wide' || w === 'compact' || w === 'phone') setView(w)
    const k = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= 8) setSel(n - 1) }
    const r = () => setVh(innerHeight)
    r(); addEventListener('keydown', k); addEventListener('resize', r)
    return () => { removeEventListener('keydown', k); removeEventListener('resize', r) }
  }, [])
  const size: HudSize = view === 'auto' ? real : view
  const sim = view === 'auto' ? null : SIM[view]
  const BAR_H = 52
  const scale = sim ? Math.min(1, (vh - BAR_H - 16) / sim.h) : 1
  const pill = (on: boolean) => `px-3 h-8 rounded-full text-[12px] font-semibold transition-colors ${on ? 'bg-white text-black' : 'bg-black/55 text-white/80 hover:bg-black/70'}`
  const controls = (
    <div className="flex flex-wrap justify-center gap-1.5 px-4" style={hearthBody}>
      <button className={pill(face === 'light')} onClick={() => setFace('light')}>1 · Light</button>
      <button className={pill(face === 'full')} onClick={() => setFace('full')}>2 · Full hearth</button>
      <span className="w-2" />
      <button className={pill(!night)} onClick={() => setNight(false)}>day</button>
      <button className={pill(night)} onClick={() => setNight(true)}>night</button>
      <span className="w-2" />
      {(['auto', 'wide', 'compact', 'phone'] as const).map(v => (
        <button key={v} className={pill(view === v)} onClick={() => setView(v)}>
          {v === 'auto' ? `auto (${real})` : v === 'compact' ? 'compact · 842' : v === 'phone' ? 'phone · 390' : 'wide'}
        </button>
      ))}
      <a className={pill(false) + ' grid place-items-center'} href="/shimmer/dev/hud-mock">vs mock</a>
    </div>
  )
  return (
    <main className={`fixed inset-0 overflow-hidden select-none ${HEARTH_FONT_VARS}`} style={{ background: sim ? '#15110d' : '#6fa0d8' }}>
      {sim ? (
        <>
          <div className="absolute top-2 left-0 right-0 z-50">{controls}</div>
          {/* ⚠ `transform` IS LOAD-BEARING: it makes this box the containing block for the kit's
              position:fixed pieces, so the simulated screen owns its own corners. */}
          <div className="absolute left-1/2 overflow-hidden rounded-[18px] ring-1 ring-white/15"
               style={{ top: BAR_H, width: sim.w, height: sim.h, transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' }}>
            <Layout face={face} size={size} sel={sel} setSel={setSel} night={night} />
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ transform: 'translateZ(0)' }}>
            <Layout face={face} size={size} sel={sel} setSel={setSel} night={night} />
          </div>
          <div className={`absolute left-0 right-0 z-50 ${size === 'phone' ? 'top-[38%]' : 'top-14'}`}>{controls}</div>
        </>
      )}
    </main>
  )
}
