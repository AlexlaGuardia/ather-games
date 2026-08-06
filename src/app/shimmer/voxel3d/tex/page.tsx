'use client'

// Block-texture spike route. R3F Canvas is client/WebGL-only — never SSR it.
//
// ⚠ `'use client'` is load-bearing above the `ssr: false` below: `next/dynamic` with `ssr: false` is
// rejected inside a Server Component. Same shape as the sibling voxel3d route, for the same reason.
//
// Its own route on purpose: this answers a look question about block textures and has no business
// inside the streaming test bed at /shimmer/voxel3d, which is a different problem being repaired in
// parallel.

import dynamic from 'next/dynamic'

const TexSpike = dynamic(() => import('./TexSpike'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#0b0d14] text-white/60 text-xs font-mono tracking-widest uppercase">
      building tiles…
    </div>
  ),
})

export default function TexSpikePage() {
  return <TexSpike />
}
