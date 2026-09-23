'use client'
// THE HUD KIT, MOUNTED — the real Phase 9 pieces over the same world frame as `hud-mock`.
//
// ★ WHY A SECOND PAGE (2026-09-23, play lane). `hud-mock` is a static drawing of the two faces;
// this page mounts the SHIPPABLE components from `ui/hearth-hud.tsx` — live refs, the real ItemChip
// icons, the real mana vessel, the real day-cycle clock. What Alex judges here is what the Hud swap
// will draw, not a picture of it. Same backdrop and the same toggles, so the two pages compare 1:1.
//
// Sample state only: fixed refs for vitals/mana/buffs, a painted stand-in under the minimap frame
// (the backdrop is scaled to the window, so its own minimap never lines up — hud-mock's reason too).
// The tool sockets carry only the kit's plate (`hearthSocket`); their glyphs/rings stay hud-corner's.
import React, { useEffect, useRef, useState } from 'react'
import { HEARTH_FONT_VARS } from '../../ui/hearth-fonts'
import { hearthBody } from '../../ui/hearth'
import { HearthHotbar, HearthObjective, HearthVitals, HearthBuffChips, HearthMapFrame, HearthClock, HearthOrbRim, hearthSocket, MINIMAP_BOX } from '../../ui/hearth-hud'
import { parseHudFace, type HudFace } from '../../ui/hud-flag'
import { ManaGauge } from '../../hud/mana-gauge'
import type { ActiveBuffs } from '../../engine/potion-effects'

const BAR: ([string, number] | null)[] = [['shimmeroak_plank', 22], ['mushroom_cap', 2], ['glass', 3], null, ['raw_mana_shard', 5], ['chest', 2], ['moonberry', 12], ['cobblestone', 31]]
const ENTRIES = BAR.map(e => (e ? { itemId: e[0], count: e[1] } : null))

export default function HudKit() {
  const [face, setFace] = useState<HudFace>('light')
  const [night, setNight] = useState(false)
  const [sel, setSel] = useState(2)
  const vitals = useRef({ hp: 72, hpMax: 100, shield: 30, shieldMax: 50 })
  const mana = useRef({ cur: 84, max: 120, regen: 1 })
  const buffs = useRef<ActiveBuffs>({} as ActiveBuffs)
  useEffect(() => {
    const p = new URLSearchParams(location.search)
    setFace(parseHudFace(p.get('hud')) ?? 'light')
    setNight(p.get('night') === '1')
    // Set after mount: a wall-clock deadline in the first render is a hydration mismatch.
    buffs.current = { fleetfoot: Date.now() + 185_000, kindred: Date.now() + 61_000 } as ActiveBuffs
    // Number keys pick a slot, as in the world — so the selected well can be judged moving.
    const k = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= 8) setSel(n - 1) }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])
  const held = ENTRIES[sel] ? { text: `${ENTRIES[sel]!.itemId.replace(/_/g, ' ')} · ${ENTRIES[sel]!.count}`, out: false } : null
  const pill = (on: boolean) => `px-3 h-8 rounded-full text-[12px] font-semibold transition-colors ${on ? 'bg-white text-black' : 'bg-black/55 text-white/80 hover:bg-black/70'}`
  return (
    <main className={`fixed inset-0 overflow-hidden select-none ${HEARTH_FONT_VARS}`} style={{ background: '#6fa0d8' }}>
      <img src="/shimmer/mock/hud-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover"
           style={{ filter: night ? 'brightness(.32) saturate(.7) hue-rotate(12deg)' : undefined }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: night ? 'radial-gradient(120% 90% at 50% 45%, rgba(20,30,70,.15), rgba(5,8,25,.55))' : undefined }} />
      <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />

      {/* The live minimap's box, painted, so the frame is judged around a map. */}
      <div style={{ position: 'fixed', top: MINIMAP_BOX.top, right: MINIMAP_BOX.right, width: MINIMAP_BOX.size, height: MINIMAP_BOX.size, zIndex: MINIMAP_BOX.z, borderRadius: 10,
                    background: 'radial-gradient(60% 75% at 30% 50%, #6f9e52 0%, #5d8a45 70%, #1a1430 71%, #0d0a1c 100%)' }} />
      <HearthMapFrame face={face} />
      <HearthClock face={face} />
      <HearthObjective face={face} value="Find Gregory" />
      <HearthBuffChips face={face} buffs={buffs} />
      <div className="absolute bottom-4 left-4"><HearthVitals face={face} vitals={vitals} /></div>
      <HearthHotbar face={face} entries={ENTRIES} sel={sel} held={held} dimmed={false} onSelect={setSel} />
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="relative">
          <ManaGauge mana={mana} />
          <HearthOrbRim face={face} />
          {[180, 137, 93, 50].map((a, i) => {
            const r = 115, rad = (a * Math.PI) / 180
            return <div key={a} className="absolute w-14 h-14 rounded-full"
                        style={{ left: 76 + r * Math.cos(rad), top: 76 - r * Math.sin(rad), transform: 'translate(-50%,-50%)', ...hearthSocket(face, i === 1) }} />
          })}
        </div>
      </div>

      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex flex-wrap justify-center gap-1.5 px-4" style={hearthBody}>
        <button className={pill(face === 'light')} onClick={() => setFace('light')}>1 · Light touch</button>
        <button className={pill(face === 'full')} onClick={() => setFace('full')}>2 · Full hearth</button>
        <span className="w-2" />
        <button className={pill(!night)} onClick={() => setNight(false)}>day</button>
        <button className={pill(night)} onClick={() => setNight(true)}>night</button>
        <a className={pill(false) + ' grid place-items-center'} href="/shimmer/dev/hud-mock">vs mock</a>
      </div>
    </main>
  )
}
