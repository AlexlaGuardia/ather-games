// Bare /shimmer → the voxel world.
//
// ── ★ THE DOORS FLIPPED 2026-08-07 (Alex) ────────────────────────────────────────────────────
// Second time this redirect has moved, and it is the same call each time: point the front door at
// the game being built, not the one that used to be. 2026-07-21 the 2D Shimmer was archived and
// this pointed at `play3d`. Shimmer went voxel on 2026-08-06, and until today every entrance still
// opened on `play3d` while the voxel world sat behind an owner-only door in its ☰ menu — so it kept
// reading as "play3d is the game" no matter what the roadmap said.
//
// ⚠ `play3d` is NOT dead and must not be deleted. Sixteen of its twenty-three engine systems port
// to the voxel world UNTOUCHED (PLAY3D-MIGRATION.md measured it) — it is the supply line for the
// port, not a rival. What changed is that it is no longer the front door: it is now the owner-only
// legacy route, the exact inverse of yesterday. Archive the source only once the port has taken
// what it needs; you do not archive the thing you are still mining.
import { redirect } from 'next/navigation'

export default function ShimmerIndex() {
  redirect('/shimmer/voxel3d')
}
