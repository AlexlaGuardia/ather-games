'use client'
// ── Keeper's Arena — standalone cold-play harness ────────────────────────────────
// A test slice of the real-time combat, decoupled from the world so the feel can be
// tuned in isolation. The renderer + HUD live in components/ArenaBattle.tsx — the
// SAME component play3d mounts in-world — so this harness stays honest to the real
// thing. The kit picker swaps the bonded Mana'mal (the 3rd Aid slot) so the per-
// companion kit difference is feelable here. Route: /shimmer/arena.

import { useState, useCallback } from 'react'
import ArenaBattle from '../components/ArenaBattle'
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

// The bonded Mana'mal's gift (3rd Aid slot) is NOT pickable — a companion is a bond,
// not a loadout (the anti-collar identity; picker removed 2026-07-22 per Alex). The
// harness runs the default Bonn + Momo kit; in-world the gift follows the actual bond.
export default function ArenaSlice() {
  const [runId, setRunId] = useState(0)
  const [slice, setSlice] = useState(buildSlice)
  const restart = useCallback(() => { setSlice(buildSlice()); setRunId(r => r + 1) }, [])

  // key remounts ArenaBattle so it re-seeds a fresh fight; the AGAIN button routes here.
  return <ArenaBattle key={runId} allies={slice.allies} enemies={slice.enemies} onEnd={restart} continueLabel="AGAIN" />
}
