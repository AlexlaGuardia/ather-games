'use client'
// ── Keeper's Arena — standalone cold-play harness ────────────────────────────────
// A test slice of the real-time combat, decoupled from the world so the feel can be
// tuned in isolation. The renderer + HUD live in components/ArenaBattle.tsx — the
// SAME component play3d mounts in-world — so this harness stays honest to the real
// thing. Route: /shimmer/arena · boss slice: /shimmer/arena?mode=hold (a Sorrel-shaped
// stronghold: champion guard + two collared captives, hold banner, freed beat).

import { useState, useCallback } from 'react'
import ArenaBattle from '../components/ArenaBattle'
import { createSpirit, type Element, type Species } from '../spirits/spirit'

const mk = (sp: Species, name: string, lvl: number, el: Element = 'base', seedFloor = 0) => {
  const s = createSpirit(sp, name, 0, 0); s.level = lvl; s.bond = 60; s.happiness = 128
  if (el !== 'base') s.element = el
  s.seeds = Array.from({ length: 6 }, () => seedFloor + Math.floor(Math.random() * (32 - seedFloor)))
  return s
}

function buildSlice() {
  // A party with distinct roles so the Speak layer matters: striker · caster · wall.
  const allies = [mk('fox', 'Kit', 22, 'storm'), mk('owl', 'Sage', 22, 'mana'), mk('water-bear', 'Tor', 22, 'earth')]
  const enemies = [mk('frog', 'Blightling', 22), mk('bat', 'Gnash', 22), mk('rabbit', 'Scree', 22)]
  return { allies, enemies }
}

// The boss slice — Sorrel-shaped: one juiced champion guard shielding two collared
// captives. Exercises the whole hold layer (tier AI, collar render, banner, freed beat).
function buildHoldSlice() {
  const allies = [mk('fox', 'Kit', 22, 'storm'), mk('owl', 'Sage', 22, 'mana'), mk('water-bear', 'Tor', 22, 'earth')]
  const enemies = [
    mk('frog', "Test Brute", 24, 'earth', 16),
    mk('rabbit', 'Collared Rabbit', 22),
    mk('bat', 'Collared Bat', 22),
  ]
  return { allies, enemies }
}

// A companion is a bond, not a loadout (picker removed 2026-07-22 per Alex) — the
// harness runs the default Bonn + Momo kit; in-world the gift follows the actual bond.
export default function ArenaSlice() {
  const [hold] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'hold')
  const [runId, setRunId] = useState(0)
  const [slice, setSlice] = useState(hold ? buildHoldSlice : buildSlice)
  const restart = useCallback(() => { setSlice(hold ? buildHoldSlice() : buildSlice()); setRunId(r => r + 1) }, [hold])

  // key remounts ArenaBattle so it re-seeds a fresh fight; the AGAIN button routes here.
  return (
    <ArenaBattle
      key={runId}
      allies={slice.allies}
      enemies={slice.enemies}
      enemyTier={hold ? 'champion' : undefined}
      collaredIndices={hold ? [1, 2] : undefined}
      title={hold ? 'HOLD — TEST STRONGHOLD' : undefined}
      onEnd={restart}
      continueLabel="AGAIN"
    />
  )
}
