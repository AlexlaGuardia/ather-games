// Record Alex's yay / nay on a game sound into open/shared/sounds.json (BETA M36).
//
// ★ NAMED `save-sound-vote` TO INHERIT THE OWNER GATE: `proxy.ts` hard-403s `/shimmer/save-*` without the owner cookie, and this
// writes a file the build reads. Do not move it onto another prefix without moving the gate.
// ⚠ A VOTE IS LIVE AT THE NEXT DEPLOY, NOT ON SAVE: sounds.json is imported by the bundle at build time.
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { removeNay } from '../dev/sounds/sections'

const FILE = join(process.cwd(), 'src/app/shimmer/open/shared/sounds.json')
const STATUSES = ['proposed', 'yay', 'nay']
type Row = { id: string; status: string; note: string; [k: string]: unknown }

async function rows(): Promise<Row[]> { return JSON.parse(await readFile(FILE, 'utf-8')) as Row[] }

export async function GET() {
  try { return NextResponse.json({ sounds: await rows() }) }
  catch (e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 }) }
}

/** POST {id, status, note?} — set one sound's status (and note). Refuses an unknown id or status. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id?: unknown; status?: unknown; note?: unknown }
    if (typeof body.id !== 'string' || typeof body.status !== 'string' || !STATUSES.includes(body.status))
      return NextResponse.json({ error: 'need id and status (proposed | yay | nay)' }, { status: 400 })
    const all = await rows(), row = all.find(r => r.id === body.id)
    if (!row) return NextResponse.json({ error: `unknown sound id: ${body.id.slice(0, 60)}` }, { status: 400 })
    row.status = body.status
    if (typeof body.note === 'string') row.note = body.note.slice(0, 300)
    await writeFile(FILE, JSON.stringify(all, null, 1) + '\n')
    return NextResponse.json({ ok: true, id: row.id, status: row.status, live: 'at the next deploy (coord build)' })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

/** DELETE {id}: REMOVE a NAY'd sound's row (BETA M92). The game then falls back to silent for it. Refuses a yay/proposed row. */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { id?: unknown }
    if (typeof body.id !== 'string') return NextResponse.json({ error: 'need id' }, { status: 400 })
    const all = await rows(), r = removeNay(all, body.id)
    if (!r.ok) return NextResponse.json({ error: r.why }, { status: 400 })
    await writeFile(FILE, JSON.stringify(r.rows, null, 1) + '\n')
    return NextResponse.json({ ok: true, id: body.id, removed: true, live: 'at the next deploy (coord build)' })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
