'use client'
// Shimmer 3D — Phase 1 proof (renderer seam). A self-contained route that renders ONE real
// zone's blockout grid as 3D geometry, with a capsule driven by grid collision reused from the
// 2D engine (`walkable`). Owner-gated like the rest of /shimmer. See SHIMMER_3D_PLAN.md.
import dynamic from 'next/dynamic'

// R3F Canvas is client/WebGL-only — never SSR it.
const Shimmer3D = dynamic(() => import('./Shimmer3D'), { ssr: false })

export default function Play3DPage() {
  return <Shimmer3D />
}
