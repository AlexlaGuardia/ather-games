'use client'
// ── CHORDMATES' HEALTH, ABOVE YOUR OWN (BETA M188 s1) ────────────────────────────────────────────────────────────────────
// Only while in a chord (chord.ts box non-empty). Each mate: a nametag in their chord colour + a slim health bar, stacked
// over this keeper's own health (desktop: the vitals plate, phone: the hotbar's lip). Health travels on the open-world
// socket's existing relay ('chord.hp', see chord.ts); this component both SAYS my health and HEARS the mates'.
import { useEffect, useRef, useState } from 'react'
import type { Vitals } from '../../engine/vitals'
import { hearthBody } from '../../ui/hearth'
import { openNet } from './open-mp'
import { newHeldSend, heldDue } from './held-gun'
import { HP_KIND, useChordBox, chordBox, mateBars, hpFrac, decodeHp, type MateBar } from './chord'

const heard = new Map<string, { hp: number; at: number }>()

export function ChordBars({ vitals, phone }: { vitals: React.RefObject<Vitals>; phone: boolean }) {
  const { members, me, code } = useChordBox()
  const [bars, setBars] = useState<MateBar[]>([])
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)
  const sendSt = useRef(newHeldSend())
  const inChord = !!code && members.some(m => m.look && m.look !== me)

  // say mine, hear theirs (the relay subscription is stable per socket hook; re-subscribe if the page's hook changed)
  useEffect(() => {
    if (!code) return
    let off: (() => void) | null = null, sub: unknown = null
    const tick = () => {
      const net = openNet(), now = performance.now() / 1000
      if (net && net.onRelay !== sub) {
        off?.(); sub = net.onRelay
        off = net.onRelay(m => { if (m.kind !== HP_KIND) return; const h = decodeHp(m.data); if (h !== undefined) heard.set(m.from, { hp: h, at: performance.now() / 1000 }) })
      }
      const v = vitals.current
      if (net && v) {
        const f = hpFrac(v.hp, v.hpMax)
        if (heldDue(sendSt.current, String(f), net.live(), now)) net.relay(HP_KIND, { h: f })
      }
      const b = chordBox()
      setBars(mateBars(b.members, b.me, heard, now))
      const a = document.querySelector(phone ? '[data-hud="hotbar"]' : '[data-hud="vitals"]')
      if (a) { const r = a.getBoundingClientRect(); setPos(p => p && p.left === Math.round(r.left) && p.bottom === Math.round(innerHeight - r.top) ? p : { left: Math.round(r.left), bottom: Math.round(innerHeight - r.top) }) }
    }
    tick()
    const t = setInterval(tick, 500)
    return () => { clearInterval(t); off?.() }
  }, [code, phone, vitals])

  if (!inChord || !bars.length || !pos) return null
  const w = phone ? 124 : 176
  return (
    <div data-chord-bars className="fixed pointer-events-none flex flex-col gap-1" style={{ left: Math.max(8, pos.left), bottom: pos.bottom + 6, width: w, zIndex: 32, ...hearthBody }}>
      {bars.map(b => (
        <div key={b.id} data-chord-bar={b.id} data-hp={b.hp ?? ''} className="rounded-[8px] px-1.5 py-[3px]"
             style={{ background: 'rgba(43,30,18,.62)', boxShadow: `inset 3px 0 0 ${b.colour}, 0 1px 3px rgba(0,0,0,.35)` }}>
          <div className="flex items-center gap-1 pl-1">
            <span className="inline-block w-[7px] h-[7px] rounded-full shrink-0" style={{ background: b.colour, boxShadow: `0 0 4px ${b.colour}` }} />
            <span data-chord-name className="truncate font-bold leading-none" style={{ fontSize: phone ? 10.5 : 11.5, color: '#f3e6cf' }}>{b.name}</span>
          </div>
          <div className="relative mt-[3px] ml-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,.45)' }}>
            <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200"
                 style={{ width: `${(b.hp ?? 1) * 100}%`, background: 'linear-gradient(180deg, #d9735a, #a8482f)', opacity: b.hp === null ? 0.3 : 1 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
