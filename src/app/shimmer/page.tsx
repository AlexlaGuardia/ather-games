// Bare /shimmer → the live game is play3d. The old 2D Shimmer that used to live here was
// archived 2026-07-21 (see archive/shimmer-2d/) — play3d is Shimmer now. This redirect keeps
// any old bookmark/link landing on the real game instead of a 404.
import { redirect } from 'next/navigation'

export default function ShimmerIndex() {
  redirect('/shimmer/play3d')
}
