import { NextRequest, NextResponse } from 'next/server'
import { readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { existsSync } from 'fs'

const BG_DIR = join(process.cwd(), 'public/data/battle-bgs')

function bgFilePath(zoneId: string): string {
  // Sanitize: allow only alphanumeric + hyphens
  const safe = zoneId.replace(/[^a-z0-9-]/gi, '')
  return join(BG_DIR, `${safe}.json`)
}

// GET — load a saved background
export async function GET(req: NextRequest) {
  const zoneId = req.nextUrl.searchParams.get('zone')
  if (!zoneId) return NextResponse.json({ error: 'Missing zone param' }, { status: 400 })

  const path = bgFilePath(zoneId)
  if (!existsSync(path)) {
    return NextResponse.json({ exists: false })
  }

  try {
    const raw = await readFile(path, 'utf-8')
    const data = JSON.parse(raw)
    return NextResponse.json({ exists: true, palette: data.palette, pixels: data.pixels })
  } catch {
    return NextResponse.json({ exists: false })
  }
}

// POST — save a background to disk
export async function POST(req: NextRequest) {
  try {
    const { zoneId, palette, pixels } = await req.json()

    if (!zoneId || !palette || !pixels) {
      return NextResponse.json({ error: 'Missing zoneId, palette, or pixels' }, { status: 400 })
    }

    if (!Array.isArray(palette) || typeof pixels !== 'string') {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }

    // Ensure directory exists
    if (!existsSync(BG_DIR)) {
      await mkdir(BG_DIR, { recursive: true })
    }

    const path = bgFilePath(zoneId)
    await writeFile(path, JSON.stringify({ palette, pixels }, null, 2), 'utf-8')

    return NextResponse.json({ success: true, file: path })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
