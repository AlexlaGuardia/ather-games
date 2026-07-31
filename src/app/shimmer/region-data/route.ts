import { NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

// Live region-map data — the region half of /shimmer/world-data. The play3d boot gate (and
// anything else that wants sculpt-fresh regions) fetches this and patches the compiled
// region module before mount, which is what makes sculpt → Save → refresh live with NO
// rebuild. Public read-only world state, same class as world-data. RLE ships as-is — it is
// the compact form; the client decodes.

const REGION_DIR = join(process.cwd(), 'src/app/shimmer/world/region-maps')

export async function GET() {
  try {
    const files = (await readdir(REGION_DIR)).filter(f => f.endsWith('.json'))
    const regions: Record<string, unknown> = {}
    await Promise.all(files.map(async f => {
      try {
        const parsed = JSON.parse(await readFile(join(REGION_DIR, f), 'utf-8')) as { id?: string }
        if (parsed.id) regions[parsed.id] = parsed
      } catch { /* one corrupt file must not take the whole payload down */ }
    }))
    return NextResponse.json({ regions }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
