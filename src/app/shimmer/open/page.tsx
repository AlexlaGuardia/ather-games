import { redirect } from 'next/navigation'

// /shimmer/open — the open world's front door (2026-11-14). It used to BE the P0 hillside feel slice; that lives at
// /shimmer/open/hillside now. A keeper starts at home: the Ather plot, whose one gate (the Hallway) opens the Wilds
// and the city doors on the continent. Query strings ride along so `?waymark=` and friends still land.
export default async function OpenFrontDoor({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) for (const x of [v].flat()) if (x != null) q.append(k, x)
  redirect(`/shimmer/open/ather${q.size ? `?${q}` : ''}`)
}
