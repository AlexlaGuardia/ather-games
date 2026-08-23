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
import { setSaveOwner } from '@/lib/save-slot'
import { adoptAnonWorld } from './save'
import { WORLD_SEED } from './world-seed'

const VoxelWorld = dynamic(() => import('./VoxelWorld'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#0b0d14] text-white/60 text-xs font-mono tracking-widest uppercase">
      generating the world…
    </div>
  ),
})

/**
 * ── ★★ WHO IS PLAYING, BEFORE THE WORLD IS ADDRESSED (2026-08-23, #692) ──────────────────────
 * This route resolved no session at all, and that was two live bugs rather than an omission.
 *
 *   · THE BLOCKS. `voxel3d/save.ts` keys every column by owner now, and it reads that owner from
 *     `saveOwner()`. Unresolved answers "anonymous", so every signed-in keeper on this route shared
 *     one world: account B walked into account A's garden and stood in A's chests. That is #682 one
 *     storage layer over, and it is what #692 asked for.
 *   · THE PARTY, which was already broken and nothing was watching it. `VoxelWorld` reads and
 *     writes the shared save through `saveKey()`, which went per-account on 2026-08-23 — so from
 *     that commit until this one, a signed-in keeper catching a spirit HERE wrote it into the
 *     anonymous slot while play3d read their account's. The spirit did not vanish; it went
 *     somewhere the rest of the game does not look. `saveKey()`'s own warning was firing into a
 *     console nobody had reason to open.
 *
 * ⚠ AWAITED BEFORE THE PHASE FLIPS, AND THAT IS THE WHOLE CONTRACT. `VoxelWorld` streams columns
 * while it renders, so the owner has to be settled before it mounts — the same ordering rule
 * `play3d/page.tsx` states, for the same reason. Do not move this after the world phase.
 *
 * ⚠ A FAILED FETCH RESOLVES TO ANONYMOUS, DELIBERATELY. Offline means we cannot prove who this is,
 * and the safe direction is a signed-in keeper seeing the anonymous world (confusing, reversible,
 * and nothing uploads) rather than guessing a name and writing into somebody's garden. Never fail
 * toward an identity.
 */
async function resolveKeeper(): Promise<void> {
  let userId: string | null = null
  try {
    const res = await fetch('/api/auth/session', { cache: 'no-store' })
    const body = (await res.json()) as { session: { user_id: string } | null }
    userId = body.session?.user_id ?? null
  } catch { /* offline — anonymous, local-only */ }
  setSaveOwner(userId)

  // First sign-in moves this browser's anonymous world into the account. Once, ever — see
  // `planAdoption` for the three cases and why an already-claimed space is left alone.
  const plan = await adoptAnonWorld(WORLD_SEED, userId)
  if (plan.reason === 'adopted') console.info(`[save] adopted this browser's anonymous world (${plan.moves.length} records) into the account signing in`)
  if (plan.reason === 'someone-elses') console.info('[save] this browser\'s anonymous world already belongs to another account — starting fresh')
}

type Phase = 'checking' | 'birth' | 'world'

export default function VoxelPage() {
  // Starts at 'checking' rather than 'birth' because localStorage is not readable during SSR or the
  // first paint. Guessing 'birth' would flash the ritual at an already-born keeper on every load.
  const [phase, setPhase] = useState<Phase>('checking')

  useEffect(() => {
    resetIfStale()   // ⚠ must precede the read below — see ather-epoch.ts
    void (async () => {
      await resolveKeeper()
      setPhase(loadRuneInventory().birth ? 'world' : 'birth')
    })()
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
