import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import type { TileGroup } from '../world/structures'

const STRUCTURES_DIR = join(process.cwd(), 'src/app/shimmer/data/structures')
const SAFE_ID = /^[a-zA-Z0-9_-]+$/

// GET: list all structures, or fetch one by ?id=
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')

    if (id) {
      if (!SAFE_ID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
      const filePath = join(STRUCTURES_DIR, `${id}.json`)
      const content = await readFile(filePath, 'utf-8')
      return NextResponse.json(JSON.parse(content))
    }

    await mkdir(STRUCTURES_DIR, { recursive: true })
    const files = await readdir(STRUCTURES_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    const structures: TileGroup[] = await Promise.all(jsonFiles.map(async f => {
      const content = await readFile(join(STRUCTURES_DIR, f), 'utf-8')
      return JSON.parse(content)
    }))

    return NextResponse.json({ structures })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

// PUT: save/update a structure
export async function PUT(req: NextRequest) {
  try {
    const structure = await req.json()
    if (!structure.id || !SAFE_ID.test(structure.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    if (!structure.name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    if (!structure.cells || !Array.isArray(structure.cells)) {
      return NextResponse.json({ error: 'Missing cells array' }, { status: 400 })
    }

    await mkdir(STRUCTURES_DIR, { recursive: true })
    const filePath = join(STRUCTURES_DIR, `${structure.id}.json`)
    await writeFile(filePath, JSON.stringify(structure, null, 2) + '\n', 'utf-8')

    return NextResponse.json({ success: true, id: structure.id })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

// DELETE: remove a structure
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id || !SAFE_ID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const filePath = join(STRUCTURES_DIR, `${id}.json`)
    await unlink(filePath)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
