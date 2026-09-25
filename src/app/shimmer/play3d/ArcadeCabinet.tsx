'use client'

/**
 * An arcade cabinet in the Passage — walk up, drop a Mark, play the game without leaving the room.
 *
 * Canon (`world/rune-hold.md` › The arcade room, RULED 2026-08-26): the arcade ROOM is in the Passage and
 * is where Marks are SPENT; the Mug's one cabinet is where they are earned. *"The tavern's one cabinet
 * pays you; the market's room of them takes it back."* How many cabinets, which games, and the price are
 * the build's.
 *
 * ── JIN'S ──
 *   · A MARK A PLAY. The coin is the ritual, not the gate: one Mark is the cheapest thing on any shelf
 *     down here, and a cabinet that costs as much as a gem would be a shop, not an arcade.
 *   · The game runs in a frame over the world, so closing it puts you back on the arcade-room floor in
 *     front of the same cabinet. The standalone `/arcade` stays free and untouched — this is the same
 *     game reached a second way, not a paywall on the first.
 *   · A back-room game's cabinet stands for everyone (the room is one room) and is DARK for a public
 *     keeper: *"not lit yet"*. Hiding it would leave a gap in the row that reads as a bug.
 */
import { useEffect, useState } from 'react'
import { getMarks, spendMarks } from '@/lib/wallet'
import type { GameEntry } from '@/lib/games'
import { passage as P } from './scene-palette'

export const CABINET_PRICE = 1

export function ArcadeCabinet({ game, isOwner, onClose }: { game: GameEntry; isOwner: boolean; onClose: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const dark = game.tier !== 'live' && !isOwner
  const marks = getMarks()

  // Esc closes the cabinet only while the coin plate is up: once a game is running it owns the keyboard,
  // and several of them use Esc themselves. The X is always there.
  useEffect(() => {
    if (playing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, onClose])

  const drop = () => {
    if (dark) return
    if (getMarks() < CABINET_PRICE) { setNote('Your purse is empty.'); return }
    if (!spendMarks(CABINET_PRICE)) { setNote('The Mark would not leave your hand.'); return }
    setPlaying(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-6" onPointerDown={e => e.stopPropagation()}>
      <div className="relative flex h-full max-h-[900px] w-full max-w-[1200px] flex-col overflow-hidden rounded-lg border border-amber-700/50"
           style={{ background: P.plate.bg, boxShadow: `0 0 40px ${P.plate.glow}` }}>
        <div className="flex items-center gap-3 border-b border-amber-700/40 px-4 py-2">
          <span className="text-lg" aria-hidden>{game.glyph}</span>
          <span className="font-semibold uppercase tracking-[0.18em] text-amber-200 text-sm">{game.title}</span>
          <span className="ml-auto tabular-nums text-xs text-amber-400/80">{getMarks()} Marks</span>
          <button type="button" aria-label="Step back from the cabinet" onClick={onClose}
                  className="ml-2 rounded border border-amber-700/50 px-2 py-0.5 text-amber-200 hover:bg-amber-900/40">✕</button>
        </div>
        {playing ? (
          <iframe title={game.title} src={game.href} className="h-full w-full flex-1 border-0 bg-black" allow="autoplay; fullscreen; gamepad" />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="text-6xl" aria-hidden style={{ filter: dark ? 'grayscale(1) brightness(0.4)' : `drop-shadow(0 0 12px ${P.plate.faint})` }}>{game.glyph}</div>
            <div className="max-w-md text-sm text-amber-100/80">{dark ? 'The screen is dark. Not lit yet.' : game.tagline}</div>
            {!dark && (
              <button type="button" onClick={drop} disabled={marks < CABINET_PRICE}
                      className="rounded border border-amber-500 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-200 enabled:hover:bg-amber-900/40 disabled:opacity-40">
                drop a Mark
              </button>
            )}
            <div className="text-xs text-amber-400/60">{dark ? '' : `${CABINET_PRICE} Mark a play · you carry ${marks}`}</div>
            {note && <div className="text-xs text-amber-300">{note}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
