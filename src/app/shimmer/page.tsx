'use client'
// Bare /shimmer → THE FRONT DOOR. Decides which dimension opens, then goes there.
//
// ── ★ THE DOORS SETTLED 2026-09-15 (Alex) ─────────────────────────────────────────────────────
// Third move of this redirect, and this time it stops being a redirect. 07-21 pointed it at
// `play3d`; 08-07 flipped it to `voxel3d` ("point the front door at the game being built"), which
// was right about the build and wrong about the game: a new keeper landed in the Ather unborn to
// Rune Hold — no Greg, no warning, no shop, no doorway — because Beat 0 lives in the town and the
// town is `play3d`. Alex's incognito walk on 09-15 found exactly that.
//
// The ruling: the engine IS the dimension. `voxel3d` = the Ather (the keeper's to shape).
// `play3d` = the mortal side — Rune Hold, the Crucible, the expeditions — authored and visited.
// Neither is legacy. `engine/front-door.ts` holds the rule and its test; this file only asks it.
//
// ⚠ A CLIENT COMPONENT, NOT `redirect()`, BECAUSE THE ANSWER IS IN localStorage. Who is playing
// has to be resolved first (`saveKey`/`keeperKey` answer "anonymous" until told) — same ordering
// contract as both world routes. A failed session fetch resolves to anonymous, deliberately.
import { useEffect } from 'react'
import { setSaveOwner } from '@/lib/save-slot'
import { adoptAnonKeeperState } from '@/lib/keeper-local'
import { resetIfStale } from '@/lib/ather-epoch'
import { loadRuneInventory } from './play3d/rune-inventory'
import { frontDoorFor, readSide } from './engine/front-door'

export default function ShimmerIndex() {
  useEffect(() => {
    let alive = true
    void (async () => {
      resetIfStale()   // ⚠ before any read — see ather-epoch.ts
      let userId: string | null = null
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        const body = (await res.json()) as { session: { user_id: string } | null }
        userId = body.session?.user_id ?? null
      } catch { /* offline — anonymous, local-only */ }
      setSaveOwner(userId)
      adoptAnonKeeperState(userId)   // idempotent; whichever route runs first does it
      if (!alive) return
      const born = Boolean(loadRuneInventory().birth)
      window.location.replace(frontDoorFor(born, readSide(localStorage)))
    })()
    return () => { alive = false }
  }, [])

  return (
    <div className="fixed inset-0 grid place-items-center bg-[#0b0d14] text-white/60 text-xs font-mono tracking-widest uppercase">
      finding the door…
    </div>
  )
}
