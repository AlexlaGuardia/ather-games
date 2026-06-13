import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const DURATIONS_PATH = join(process.cwd(), 'src/app/shimmer/data/frame-durations.json')

type DurationsData = Record<string, Record<string, number[]>>
// { "alkin": { "down_idle": [24, 4, 4, 24], "down_walk": [3, 3, 3, 3] } }

async function loadDurations(): Promise<DurationsData> {
  try {
    const raw = await readFile(DURATIONS_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function GET(req: NextRequest) {
  const species = req.nextUrl.searchParams.get('species')
  const data = await loadDurations()
  if (species) {
    return NextResponse.json({ durations: data[species] ?? {} })
  }
  return NextResponse.json({ durations: data })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { species, anim, durations } = body

  if (!species || !anim || !Array.isArray(durations)) {
    return NextResponse.json({ error: 'Missing species, anim, or durations' }, { status: 400 })
  }

  const data = await loadDurations()
  if (!data[species]) data[species] = {}
  data[species][anim] = durations

  await writeFile(DURATIONS_PATH, JSON.stringify(data, null, 2), 'utf-8')
  return NextResponse.json({ success: true })
}
