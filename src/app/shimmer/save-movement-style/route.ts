import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const STYLES_PATH = join(process.cwd(), 'src/app/shimmer/data/movement-styles.json')

interface PlayerStyle { walkSpeed: number; runSpeed: number; rampTiles: number; brakeTiles: number; longPathThreshold?: number; specialThreshold?: number; endRunTiles?: number }
interface BeastStyle { walkSpeed: number; catchupSpeed: number; catchupDistance: number; longPathThreshold?: number; specialThreshold?: number; endRunTiles?: number }
interface StylesData { players: Record<string, PlayerStyle>; beasts: Record<string, BeastStyle> }

async function loadStyles(): Promise<StylesData> {
  try {
    const raw = await readFile(STYLES_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { players: {}, beasts: {} }
  }
}

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') // 'player' or 'beast'
  const id = req.nextUrl.searchParams.get('id')
  const data = await loadStyles()

  if (kind === 'player' && id) return NextResponse.json({ style: data.players[id] ?? null })
  if (kind === 'beast' && id) return NextResponse.json({ style: data.beasts[id] ?? null })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { kind, id, style } = body

  if (!kind || !id || !style) {
    return NextResponse.json({ error: 'Missing kind, id, or style' }, { status: 400 })
  }

  const data = await loadStyles()
  if (kind === 'player') data.players[id] = style
  else if (kind === 'beast') data.beasts[id] = style
  else return NextResponse.json({ error: 'kind must be player or beast' }, { status: 400 })

  await writeFile(STYLES_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  return NextResponse.json({ success: true })
}
