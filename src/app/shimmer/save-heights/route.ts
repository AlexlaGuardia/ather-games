// Persists sculpted terrain heights. POST { zoneId, heights: number[][] } → merges into
// world/heightmaps.json. Owner-gated by the proxy (/shimmer/save-*). A rebuild bakes the JSON
// import; the 3D view already shows the in-memory sculpt live. (Mirrors the save-map workflow.)
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'

const FILE = join(process.cwd(), 'src/app/shimmer/world/heightmaps.json')

export async function POST(req: NextRequest) {
  try {
    const { zoneId, heights } = await req.json()
    if (typeof zoneId !== 'string' || !Array.isArray(heights) || !Array.isArray(heights[0])) {
      return NextResponse.json({ error: 'expected { zoneId, heights: number[][] }' }, { status: 400 })
    }
    let data: Record<string, number[][]> = {}
    try { data = JSON.parse(await readFile(FILE, 'utf-8')) } catch { /* fresh file */ }
    data[zoneId] = heights
    await writeFile(FILE, JSON.stringify(data) + '\n')
    return NextResponse.json({ ok: true, zoneId, rows: heights.length, cols: heights[0].length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
