'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchDailyBoard, submitDailyScore, getPlayer, setPlayerName, type LbResult } from '@/lib/arcade/leaderboard'

// Reusable Daily-leaderboard panel. Drop into a game's game-over screen:
//   <DailyLeaderboard gameId="atherdash" accent="#37e6ff" score={score} />
// Pass `score` once (the just-finished daily run) and it submits on mount; omit it
// to show today's board read-only. Player name is editable and persists.

type Props = {
  gameId: string
  accent: string
  score?: number // the run just finished (submitted once); omit for read-only
  className?: string
}

export default function DailyLeaderboard({ gameId, accent, score, className = '' }: Props) {
  const [board, setBoard] = useState<LbResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('wanderer')
  const [editing, setEditing] = useState(false)
  const myId = useRef('')
  const submitted = useRef(false)

  useEffect(() => {
    const p = getPlayer()
    myId.current = p.id
    setName(p.name)
    let alive = true
    ;(async () => {
      // submit the finished run exactly once, else just read the board.
      const res = score && score > 0 && !submitted.current
        ? (submitted.current = true, await submitDailyScore(gameId, score))
        : await fetchDailyBoard(gameId)
      if (alive) { setBoard(res); setLoading(false) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  const saveName = async () => {
    const p = setPlayerName(name)
    setName(p.name)
    setEditing(false)
    // re-push so the board reflects the new name on the player's row.
    const res = await submitDailyScore(gameId, board?.best ?? (score ?? 0))
    if (res) setBoard(res)
  }

  const dim = `${accent}55`
  const top = board?.top ?? []

  return (
    <div
      className={`w-full max-w-[300px] rounded-[3px] border px-3 py-2.5 text-left ${className}`}
      style={{ borderColor: dim, background: 'rgba(4,4,10,0.55)' }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="gx-label text-[10px]" style={{ color: accent }}>
          daily board{board ? ` · #${board.number}` : ''}
        </span>
        {board?.rank ? (
          <span className="gx-label text-[10px]" style={{ color: accent }}>your rank #{board.rank}</span>
        ) : null}
      </div>

      {loading ? (
        <div className="text-[10px] font-mono py-3 text-center" style={{ color: dim }}>loading…</div>
      ) : top.length === 0 ? (
        <div className="text-[10px] font-mono py-3 text-center" style={{ color: dim }}>
          no runs yet today — set the pace
        </div>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {top.slice(0, 8).map((e, i) => {
            const mine = e.id === myId.current
            return (
              <li
                key={e.id}
                className="flex items-center gap-2 text-[11px] font-mono px-1.5 py-0.5 rounded-[2px]"
                style={mine ? { background: `${accent}1f`, color: accent } : { color: '#cfe9ee' }}
              >
                <span className="w-5 tabular-nums opacity-60 text-right">{i + 1}</span>
                <span className="flex-1 truncate">{e.name}{mine ? ' (you)' : ''}</span>
                <span className="tabular-nums" style={{ color: mine ? accent : '#e8feff' }}>{e.score}</span>
              </li>
            )
          })}
        </ol>
      )}

      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t" style={{ borderColor: dim }}>
        {editing ? (
          <>
            <input
              value={name}
              autoFocus
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName() }}
              className="flex-1 min-w-0 bg-transparent border rounded-[2px] px-1.5 py-0.5 text-[11px] font-mono outline-none"
              style={{ borderColor: dim, color: '#e8feff' }}
            />
            <button onClick={saveName} className="gx-label text-[10px] px-2 py-0.5 rounded-[2px]" style={{ color: '#04040a', background: accent }}>
              save
            </button>
          </>
        ) : (
          <>
            <span className="text-[10px] font-mono flex-1 truncate" style={{ color: dim }}>
              playing as <span style={{ color: accent }}>{name}</span>
            </span>
            <button onClick={() => setEditing(true)} className="gx-label text-[10px] px-2 py-0.5 rounded-[2px] border" style={{ borderColor: dim, color: accent }}>
              rename
            </button>
          </>
        )}
      </div>
    </div>
  )
}
