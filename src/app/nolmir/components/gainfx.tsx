'use client'

// NOLMIR "numbers go up" — the shared gain feedback. A rising ±N floater off a currency
// readout + a flash on the number (emerald pop on gain, rose dip on spend). First built inline
// on the Orrery (corelight, 5973bb4); extracted here so the Crucible (mana) and Expeditions
// (marks) get the same feel without three copies. Drop <GainFxStyles/> once per page (global
// keyframes), put <FloatLayer/> in a relative parent over the readout, and flashCls() on the <b>.

import { useCallback, useRef, useState } from 'react'

export interface Floater { id: number; text: string; cls: string }
export type Flash = 'gain' | 'spend' | null

const fmt = (n: number): string => {
  const a = Math.abs(n)
  if (a >= 1e9) return (a / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return (a / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return (a / 1e3).toFixed(1) + 'k'
  return Math.floor(a).toString()
}

// one fx channel per currency readout. push(amount, unit) floats ±N unit and flashes the number.
export function useGainFx() {
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [flash, setFlash] = useState<Flash>(null)
  const idRef = useRef(0)
  const push = useCallback((amount: number, unit: string) => {
    if (!amount) return
    const gain = amount > 0
    const id = idRef.current++
    setFloaters((fl) => [...fl, { id, text: `${gain ? '+' : '−'}${fmt(amount)} ${unit}`, cls: gain ? 'text-emerald-300' : 'text-rose-300/90' }])
    setFlash(gain ? 'gain' : 'spend')
    window.setTimeout(() => setFloaters((fl) => fl.filter((x) => x.id !== id)), 1100)
    window.setTimeout(() => setFlash(null), 460)
  }, [])
  return { floaters, flash, push }
}

export const flashCls = (flash: Flash): string =>
  flash === 'gain' ? 'nolmir-cf-g' : flash === 'spend' ? 'nolmir-cf-s' : ''

export function FloatLayer({ floaters }: { floaters: Floater[] }) {
  return (
    <span className="pointer-events-none absolute left-2 -top-2">
      {floaters.map((fl) => (
        <span key={fl.id} className={`absolute whitespace-nowrap text-xs tabular-nums nolmir-float ${fl.cls}`}>{fl.text}</span>
      ))}
    </span>
  )
}

// global so the classes resolve regardless of which component renders the floater/flash
export function GainFxStyles() {
  return (
    <style jsx global>{`
      @keyframes nolmir-float { 0% { opacity: 1; transform: translateY(0) } 100% { opacity: 0; transform: translateY(-24px) } }
      .nolmir-float { animation: nolmir-float 1.1s ease-out forwards }
      @keyframes nolmir-cf-g { 0%, 100% { transform: scale(1) } 30% { color: #6ee7b7; transform: scale(1.28) } }
      @keyframes nolmir-cf-s { 0%, 100% { transform: scale(1) } 35% { color: #fda4af; transform: scale(0.88) } }
      .nolmir-cf-g { animation: nolmir-cf-g 0.5s ease-out }
      .nolmir-cf-s { animation: nolmir-cf-s 0.5s ease-out }
      @keyframes nolmir-levelup { 0%, 100% { transform: scale(1); text-shadow: none } 35% { transform: scale(1.45); text-shadow: 0 0 12px #c4b5fd } }
      .nolmir-levelup { animation: nolmir-levelup 0.9s ease-out }
    `}</style>
  )
}
