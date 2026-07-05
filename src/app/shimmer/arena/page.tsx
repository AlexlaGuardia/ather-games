'use client'
// ── Keeper's Arena — standalone cold-play harness ────────────────────────────────
// A test slice of the real-time combat, decoupled from the world so the feel can be
// tuned in isolation. The renderer + HUD live in components/ArenaBattle.tsx — the
// SAME component play3d mounts in-world — so this harness stays honest to the real
// thing. The kit picker swaps the bonded Mana'mal (the 3rd Aid slot) so the per-
// companion kit difference is feelable here. Route: /shimmer/arena.

import { useState, useCallback } from 'react'
import ArenaBattle from '../components/ArenaBattle'
import { kitForManamal, type ManamalId } from '../engine/arena'
import { createSpirit, type Element, type Species } from '../spirits/spirit'

function buildSlice() {
  const mk = (sp: Species, name: string, lvl: number, el: Element = 'base') => {
    const s = createSpirit(sp, name, 0, 0); s.level = lvl; s.bond = 60; s.happiness = 128
    if (el !== 'base') s.element = el
    return s
  }
  // A party with distinct roles so the Speak layer matters: striker · caster · wall.
  const allies = [mk('fox', 'Kit', 22, 'storm'), mk('owl', 'Sage', 22, 'mana'), mk('water-bear', 'Tor', 22, 'earth')]
  const enemies = [mk('frog', 'Blightling', 22), mk('bat', 'Gnash', 22), mk('rabbit', 'Scree', 22)]
  return { allies, enemies }
}

// The bonded Mana'mal = the swappable 3rd Aid slot. All three Rinn-kin combat gifts are
// canon-ruled (2026-07-05): Momo→Rainbow Flash, Coilguard→Wardcoil, Frilldrift→Witherbloom.
const MANAMALS: { id: ManamalId; label: string }[] = [
  { id: 'duskpuff', label: 'Momo · Flash' },
  { id: 'coilguard', label: 'Coilguard · Wardcoil' },
  { id: 'frilldrift', label: 'Frilldrift · Witherbloom' },
]

export default function ArenaSlice() {
  const [runId, setRunId] = useState(0)
  const [slice, setSlice] = useState(buildSlice)
  const [manamal, setManamal] = useState<ManamalId>('duskpuff')
  const restart = useCallback(() => { setSlice(buildSlice()); setRunId(r => r + 1) }, [])
  const swap = useCallback((m: ManamalId) => { setManamal(m); setSlice(buildSlice()); setRunId(r => r + 1) }, [])

  return (
    <>
      {/* key remounts ArenaBattle so it re-seeds a fresh fight; the AGAIN button routes here. */}
      <ArenaBattle key={runId} allies={slice.allies} enemies={slice.enemies} aidKit={kitForManamal(manamal)} onEnd={restart} continueLabel="AGAIN" />
      {/* dev kit picker — swap the bonded Mana'mal to feel a different 3rd Aid slot */}
      <div style={{ position: 'fixed', top: 118, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 60, pointerEvents: 'auto' }}>
        {MANAMALS.map(m => (
          <button key={m.id} onClick={() => swap(m.id)}
            style={{ padding: '5px 10px', borderRadius: 8, border: `2px solid ${manamal === m.id ? '#7fe3c8' : '#ffffff22'}`,
              background: manamal === m.id ? '#12181a' : '#12181acc', color: manamal === m.id ? '#7fe3c8' : '#9fb8c8',
              font: '700 10px ui-monospace, monospace', letterSpacing: '0.04em', cursor: 'pointer', touchAction: 'none' }}>
            {m.label}
          </button>
        ))}
      </div>
    </>
  )
}
