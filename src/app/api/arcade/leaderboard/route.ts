import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { dailyKey, dailyNumber } from '@/lib/arcade/daily'

// ── Arcade Daily leaderboard ──────────────────────────────────────────────────
// File-backed (one JSON per game), single pm2 process, writes serialized by an
// in-process lock. No auth — scores are client-submitted and therefore trivially
// spoofable; that's acceptable for a personal arcade. Light caps keep it sane.

type Entry = { id: string; name: string; score: number; ts: number }
type Board = Record<string, Entry[]> // dailyKey -> entries (sorted desc)

// games that opt into the Daily leaderboard, with a generous sanity cap on score.
const GAMES: Record<string, number> = {
  atherdash: 100_000,
  ward: 1_000_000,
  updraft: 1_000_000,
  voranyx: 1_000_000,
  manana: 1_000_000,
  rekindle: 1_000_000,
  seedfall: 1_000_000, // reserved — Seedfall gains a score in its redesign
  vault: 1_000_000, // the auto-runner — the crossing (distance + motes + unmaking-combo)
  squall: 1_000_000, // pure-evasion bullet-hell — survival time + grazes
  driftling: 1_000_000, // food-chain evolution — score off tier + eats
  dewdrop: 1_000_000, // Pac-Man maze — dew gathered + collars snapped
}

const STORED_PER_DAY = 200 // keep at most this many rows per day on disk
const RETURNED_TOP = 20 // hand back this many to the client
const DATA_DIR = join(process.cwd(), 'data', 'leaderboards')

const fileFor = (game: string) => join(DATA_DIR, `${game}.json`)

async function loadBoard(game: string): Promise<Board> {
  try {
    return JSON.parse(await readFile(fileFor(game), 'utf-8')) as Board
  } catch {
    return {}
  }
}

// serialize all writes so concurrent submits can't clobber a read-modify-write.
let lock: Promise<unknown> = Promise.resolve()
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = lock.then(fn, fn)
  lock = next.catch(() => {})
  return next
}

function cleanName(raw: unknown): string {
  const s = String(raw ?? '')
    .replace(/[\x00-\x1f\x7f]/g, '') // strip control chars
    .replace(/[^\p{L}\p{N} _.\-]/gu, '') // letters, numbers, space, _ . -
    .trim()
    .slice(0, 16)
  return s || 'wanderer'
}

const cleanId = (raw: unknown): string => String(raw ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 24)

function shape(board: Board, key: string) {
  const rows = board[key] || []
  return {
    day: key,
    number: dailyNumber(new Date(`${key}T00:00:00Z`)),
    count: rows.length,
    top: rows.slice(0, RETURNED_TOP),
  }
}

export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get('game') || ''
  if (!(game in GAMES)) return NextResponse.json({ error: 'unknown game' }, { status: 400 })
  const key = req.nextUrl.searchParams.get('day') || dailyKey()
  const board = await loadBoard(game)
  return NextResponse.json(shape(board, key), { headers: { 'cache-control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const game = String(body.game || '')
  const cap = GAMES[game]
  if (cap === undefined) return NextResponse.json({ error: 'unknown game' }, { status: 400 })

  const score = Math.floor(Number(body.score))
  if (!Number.isFinite(score) || score < 0 || score > cap)
    return NextResponse.json({ error: 'bad score' }, { status: 400 })

  const id = cleanId(body.id)
  if (!id) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  const name = cleanName(body.name)
  const key = String(body.day || dailyKey())
  const ts = Date.now()

  const result = await withLock(async () => {
    const board = await loadBoard(game)
    const rows = board[key] || []
    const prev = rows.find((r) => r.id === id)
    // keep the player's BEST for the day; one row per player id.
    if (prev) {
      if (score > prev.score) { prev.score = score; prev.ts = ts }
      prev.name = name
    } else {
      rows.push({ id, name, score, ts })
    }
    rows.sort((a, b) => b.score - a.score || a.ts - b.ts)
    board[key] = rows.slice(0, STORED_PER_DAY)
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(fileFor(game), JSON.stringify(board))
    const rank = board[key].findIndex((r) => r.id === id) + 1
    return { ...shape(board, key), rank: rank || null, best: board[key].find((r) => r.id === id)?.score ?? score }
  })

  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
}
