'use client'

// Voxel route. R3F Canvas is client/WebGL-only — never SSR it.
//
// Separate from /shimmer/play3d on purpose: this walks the VOXEL world model (no zones, no tiles,
// no warps) and the live game walks the tile world. See VoxelWorld.tsx for the full reasoning.
//
// ── ★ BIRTH GATES THE DIMENSION (2026-08-07) ────────────────────────────────────────────────
// You do not walk into the world unnamed. The ritual runs first and the world mounts after, which
// is why this is a phase machine rather than a modal over a live scene: generating a world for
// someone who has not been born yet burns a worker and a few hundred ms of meshing to render
// something behind an opaque overlay.
//
// The birth rune is READ and WRITTEN through play3d's `rune-inventory` rather than the raw key.
// That module is the owner of what a keeper holds; duplicating the string here would give the
// voxel world its own second opinion about who you are, and the two would drift the first time
// rune acquisition lands.

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import BirthScreen from '../play3d/birth/BirthScreen'
import { loadRuneInventory, saveRuneInventory } from '../play3d/rune-inventory'
import { resetIfStale } from '@/lib/ather-epoch'

const VoxelWorld = dynamic(() => import('./VoxelWorld'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#0b0d14] text-white/60 text-xs font-mono tracking-widest uppercase">
      generating the world…
    </div>
  ),
})

type Phase = 'checking' | 'birth' | 'world'

export default function VoxelPage() {
  // Starts at 'checking' rather than 'birth' because localStorage is not readable during SSR or the
  // first paint. Guessing 'birth' would flash the ritual at an already-born keeper on every load.
  const [phase, setPhase] = useState<Phase>('checking')

  useEffect(() => {
    resetIfStale()   // ⚠ must precede the read below — see ather-epoch.ts
    setPhase(loadRuneInventory().birth ? 'world' : 'birth')
  }, [])

  if (phase === 'checking') {
    return <div className="fixed inset-0 bg-[#0b0d14]" />
  }

  if (phase === 'birth') {
    return (
      // No `onCancel`: there is nowhere to back out TO. In play3d the ritual sits over a running
      // game, so escaping means "carry on as you were"; here escaping would mean standing in a
      // dimension you were never born into. The HUD's exits are the way out.
      <BirthScreen
        onChoose={(runeId) => {
          saveRuneInventory({ birth: runeId, owned: [runeId] })
          setPhase('world')
        }}
      />
    )
  }

  return <VoxelWorld />
}
