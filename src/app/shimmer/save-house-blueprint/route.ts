// M39 slice 1: SAVE A HOUSE BLUEPRINT (one building drawn in plan mode; open/ather/plot-blueprint.ts). Owner-only: the
// `/shimmer/save-*` prefix is what proxy.ts gates (an unauthenticated file write would be the hole), so this route lives here
// on purpose. Files go to world/house-blueprints/<id>.json at the repo root: OUTSIDE src, read at runtime by
// /shimmer/open/house-blueprints (no deploy needed to see a save in the Glade). Validated by the same parseHouse the loader
// uses; an overwrite is backed up first (safeWriteFile). ⚠ These are Alex's drawings: commit them by pathspec.
import { NextRequest, NextResponse } from 'next/server'
import { mkdir, readdir } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile } from '../lib/backup'
import { parseHouse, houseProblems } from '../open/ather/plot-blueprint'

const HOUSE_DIR = join(process.cwd(), 'world/house-blueprints')

/** GET: the saved ids */
export async function GET() {
  await mkdir(HOUSE_DIR, { recursive: true })
  const ids = (await readdir(HOUSE_DIR)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
  return NextResponse.json({ ids })
}
/** POST { blueprint }: save it (validated) */
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const raw = (body as { blueprint?: unknown })?.blueprint
  const why = houseProblems(raw)
  if (why.length) return NextResponse.json({ error: why.join('; ') }, { status: 400 })
  const bp = parseHouse(raw)!
  await mkdir(HOUSE_DIR, { recursive: true })
  await safeWriteFile(join(HOUSE_DIR, `${bp.id}.json`), JSON.stringify(bp, null, 1) + '\n')
  return NextResponse.json({ ok: true, id: bp.id, w: bp.w, d: bp.d, pieces: Object.keys(bp.walls).length })
}
