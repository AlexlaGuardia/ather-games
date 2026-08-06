'use client'

// Voxel test bed route. R3F Canvas is client/WebGL-only — never SSR it.
//
// Separate from /shimmer/play3d on purpose: this walks the VOXEL world model (no zones, no tiles,
// no warps) and the live game walks the tile world. See VoxelWorld.tsx for the full reasoning.

import dynamic from 'next/dynamic'

const VoxelWorld = dynamic(() => import('./VoxelWorld'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#0b0d14] text-white/60 text-xs font-mono tracking-widest uppercase">
      generating the world…
    </div>
  ),
})

export default function VoxelPage() {
  return <VoxelWorld />
}
