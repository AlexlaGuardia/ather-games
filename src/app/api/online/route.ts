import { NextResponse } from 'next/server'

// How many keepers are in the world right now, for the front page's "N playing now".
// Reads the presence server's own /stats (server-to-server, same box) and passes on ONE number, nothing
// about who. The presence server down reads as 0, never an error: the front page just hides the counter.
export const revalidate = 30

export async function GET() {
  const port = process.env.SHIMMER_SERVER_PORT ?? '8400'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/stats`, { signal: AbortSignal.timeout(1500), next: { revalidate: 30 } })
    const body = (await res.json()) as { presence?: { online?: number } }
    return NextResponse.json({ online: Math.max(0, Number(body.presence?.online) || 0) })
  } catch {
    return NextResponse.json({ online: 0 })
  }
}
