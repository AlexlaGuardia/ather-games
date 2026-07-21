import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../../../shimmer/lib/backup'

// Authored Vault levels live as a JSON map in public/ so a "Save to Live" write is served
// immediately by `next start` (no rebuild) — the game fetches this store at runtime. Keyed by
// authoredKey(a,i) = `${areaId}-l${i+1}`. Value = an AuthoredLevel snapshot from the map editor.
const STORE = join(process.cwd(), 'public/vault/authored-levels.json')

const KEY_RE = /^a\d+-l\d+$/ // 'a3-l7' — guards the write key so a typo can't scribble the store

async function readStore(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(STORE, 'utf-8')
    const j = JSON.parse(raw)
    return j && typeof j === 'object' ? j : {}
  } catch { return {} }
}

// GET → the full authored-level store (both the game and the editor read it here).
export async function GET() {
  return NextResponse.json(await readStore(), { headers: { 'cache-control': 'no-store' } })
}

// POST { key, level }        → publish an authored level to that slot
// POST { key, delete: true } → clear the slot (the game falls back to procedural)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const key: unknown = body?.key
    if (typeof key !== 'string' || !KEY_RE.test(key)) {
      return NextResponse.json({ error: `bad slot key: ${String(key)}` }, { status: 400 })
    }
    const store = await readStore()

    if (body?.delete === true) {
      delete store[key]
      await writeFile(STORE, JSON.stringify(store, null, 0), 'utf-8')
      return NextResponse.json({ ok: true, key, removed: true, count: Object.keys(store).length })
    }

    const lvl = body?.level
    if (!lvl || !Array.isArray(lvl.segs) || !lvl.segs.length) {
      return NextResponse.json({ error: 'level has no platforms' }, { status: 400 })
    }
    // normalize to the AuthoredLevel shape — never trust the paste
    const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
    store[key] = {
      seed: num(lvl.seed, 1) || 1,
      end: Math.round(num(lvl.end, 5000)),
      areaId: key.split('-')[0],
      segs: lvl.segs.map((s: Record<string, unknown>) => ({ x0: num(s.x0), x1: num(s.x1), top: num(s.top) })),
      // the high road (optional): same shape as segs, normalized the same way. Absent → no high road.
      ledges: Array.isArray(lvl.ledges) ? lvl.ledges.map((s: Record<string, unknown>) => ({ x0: num(s.x0), x1: num(s.x1), top: num(s.top) })) : [],
      foes: Array.isArray(lvl.foes) ? lvl.foes.map((f: Record<string, unknown>) => ({ x: num(f.x), y: num(f.y), dead: false })) : [],
      spikes: Array.isArray(lvl.spikes) ? lvl.spikes.map((s: Record<string, unknown>) => ({ x: num(s.x), y: num(s.y) })) : [],
      motes: Array.isArray(lvl.motes) ? lvl.motes.map((m: Record<string, unknown>) => ({ x: num(m.x), y: num(m.y), got: false })) : [],
    }
    await writeFile(STORE, JSON.stringify(store, null, 0), 'utf-8')
    return NextResponse.json({ ok: true, key, count: Object.keys(store).length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'save failed' }, { status: 500 })
  }
}
