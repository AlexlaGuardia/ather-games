'use client'

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { Card as CardType, Element, ELEMENTS } from './lib/data'

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return mobile
}
import { GameState, Player, findBestSets, getAvailableDiscardPiles, canCallMagii } from './lib/engine'
import { getMagiiAudio } from './lib/audio'
import { getSpiritImage, getRuneImage } from './lib/card-art'

// --- Hand Sorting & Set Detection ---

const ELEMENT_ORDER: Element[] = ['Mana', 'Storm', 'Earth', 'Water']

interface GroupedCard {
  card: CardType
  originalIdx: number
  groupBreak: boolean
  setType: 'triad' | 'spectrum' | null
}

function groupHand(hand: CardType[]): GroupedCard[] {
  const indexed = hand.map((card, i) => ({ card, originalIdx: i }))
  indexed.sort((a, b) => {
    const ei = ELEMENT_ORDER.indexOf(a.card.element) - ELEMENT_ORDER.indexOf(b.card.element)
    if (ei !== 0) return ei
    return a.card.rune.localeCompare(b.card.rune)
  })

  // Detect sets across all cards in hand
  const inSet = new Map<string, 'triad' | 'spectrum'>()
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const a = hand[i], b = hand[j], c = hand[k]
        // Triad: identical cards (same element, rune, spirit)
        if (a.element === b.element && b.element === c.element &&
            a.rune === b.rune && b.rune === c.rune &&
            a.spirit === b.spirit && b.spirit === c.spirit) {
          ;[a, b, c].forEach(card => inSet.set(card.id, 'triad'))
        }
        // Spectrum: same element+rune, 3 different spirits
        else if (a.element === b.element && b.element === c.element &&
                 a.rune === b.rune && b.rune === c.rune &&
                 a.spirit !== b.spirit && b.spirit !== c.spirit && a.spirit !== c.spirit) {
          ;[a, b, c].forEach(card => {
            if (!inSet.has(card.id)) inSet.set(card.id, 'spectrum')
          })
        }
      }
    }
  }

  return indexed.map((entry, i) => ({
    card: entry.card,
    originalIdx: entry.originalIdx,
    groupBreak: i > 0 && indexed[i - 1].card.element !== entry.card.element,
    setType: inSet.get(entry.card.id) ?? null,
  }))
}

const SET_COLORS = {
  triad: '#d4a843',
  spectrum: '#8b5cf6',
}

// --- Physical Card on Table ---

export function Card({
  card, selected, onClick, size = 'md', faceDown,
}: {
  card?: CardType | null
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  faceDown?: boolean
}) {
  const dimMap = { sm: 'w-14 h-[76px]', md: 'w-[96px] h-[132px]', lg: 'w-[160px] h-[220px]' }
  const dims = dimMap[size]
  const spiritSize = { sm: 52, md: 80, lg: 140 }[size]
  const runeSize = { sm: 20, md: 30, lg: 44 }[size]
  const runeSizeBtm = { sm: 16, md: 25, lg: 38 }[size]
  const pad = { sm: 'p-1.5', md: 'p-1.5', lg: 'p-2.5' }[size]

  if (faceDown || !card) {
    const mSize = { sm: 20, md: 32, lg: 44 }[size]
    const orbSize = { sm: 10, md: 16, lg: 24 }[size]
    const orbRadius = { sm: 16, md: 26, lg: 38 }[size]
    const mFont = { sm: '8px', md: '12px', lg: '16px' }[size]
    const orbs = [
      { element: 'mana', angle: -90 },   // top
      { element: 'storm', angle: 0 },     // right
      { element: 'earth', angle: 90 },    // bottom
      { element: 'water', angle: 180 },   // left
    ]
    return (
      <div className={`${dims} rounded-md card-shadow bg-[#15121e] border border-[#2a2540] flex items-center justify-center`}
        style={{ background: 'radial-gradient(ellipse at center, #1a1628 0%, #0e0c18 70%)' }}>
        <div className="relative flex items-center justify-center"
          style={{ width: `${orbRadius * 2 + orbSize}px`, height: `${orbRadius * 2 + orbSize}px` }}>
          {/* Element orbs circling */}
          {orbs.map(({ element, angle }) => {
            const rad = (angle * Math.PI) / 180
            const x = Math.cos(rad) * orbRadius
            const y = Math.sin(rad) * orbRadius
            return (
              <img
                key={element}
                src={`/magii/elements-sm/${element}.png`}
                alt={element}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: `${orbSize}px`,
                  height: `${orbSize}px`,
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  opacity: 0.5,
                  filter: 'drop-shadow(0 0 3px rgba(139,92,246,0.3))',
                }}
              />
            )
          })}
          {/* Center M */}
          <div className="rounded-full border border-violet/25 flex items-center justify-center"
            style={{ width: `${mSize}px`, height: `${mSize}px`, background: 'radial-gradient(circle, #1e1a30, transparent)' }}>
            <span className="text-violet/40 font-display font-bold" style={{ fontSize: mFont }}>M</span>
          </div>
        </div>
      </div>
    )
  }

  const el = ELEMENTS[card.element]
  const spiritSrc = getSpiritImage(card.spirit, card.element)
  const runeSrc = getRuneImage(card.rune)

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      onMouseEnter={() => { if (onClick) getMagiiAudio().play('card-hover') }}
      className={`${dims} rounded-lg card-shadow transition-all duration-150 flex flex-col overflow-hidden relative group
        ${selected ? 'scale-105 -translate-y-1' : ''}
        ${onClick ? 'hover:-translate-y-0.5 hover:brightness-110 cursor-pointer' : ''}`}
      style={{
        boxShadow: selected
          ? `0 4px 16px ${el.color}40, 0 0 12px ${el.color}20`
          : `0 2px 8px rgba(0,0,0,0.5), inset 0 0 0 1px ${el.color}18`,
        border: `1.5px solid ${selected ? `${el.color}70` : `${el.color}25`}`,
        background: `linear-gradient(160deg, ${el.color}12 0%, #0c0a16 40%, #0c0a16 100%)`,
      }}
    >
      {/* Element color top edge */}
      <div className="h-[2px] w-full shrink-0" style={{ background: `linear-gradient(90deg, transparent, ${el.color}, transparent)` }} />

      {/* Spirit art — centered */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <img
          src={spiritSrc}
          alt={card.spirit}
          className="pointer-events-none select-none"
          style={{
            width: `${spiritSize}px`,
            height: `${spiritSize}px`,
            objectFit: 'cover',
            opacity: 0.9,
            maskImage: 'radial-gradient(ellipse 52% 50% at 50% 50%, black 55%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 52% 50% at 50% 50%, black 55%, transparent 100%)',
          }}
        />
      </div>

      {/* Corner overlays */}
      <div className={`relative z-10 flex-1 flex flex-col justify-between ${pad}`}>
        {/* Top left: rune */}
        <div className="flex items-start justify-start">
          <img
            src={runeSrc}
            alt={card.rune}
            className="drop-shadow-lg"
            style={{ width: `${runeSize}px`, height: `${runeSize}px` }}
          />
        </div>

        {/* Bottom right: rune (rotated) */}
        <div className="flex items-end justify-end">
          <img
            src={runeSrc}
            alt={card.rune}
            className="drop-shadow-lg"
            style={{
              width: `${runeSizeBtm}px`,
              height: `${runeSizeBtm}px`,
              transform: 'rotate(180deg)',
            }}
          />
        </div>
      </div>

      {/* Bottom edge glow */}
      <div className="h-[2px] w-full shrink-0" style={{ background: `linear-gradient(90deg, transparent, ${el.color}60, transparent)` }} />
    </button>
  )
}

// --- Draw Pile (center of table) ---

const ELEMENT_ORBS = [
  { element: 'mana', angle: -90 },
  { element: 'storm', angle: 0 },
  { element: 'earth', angle: 90 },
  { element: 'water', angle: 180 },
]

function DrawPile({ count, onClick, canDraw }: { count: number; onClick: () => void; canDraw: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        disabled={!canDraw || count === 0}
        className="relative group disabled:cursor-default"
      >
        {/* Stacked cards effect */}
        <div className="absolute top-0.5 left-0.5 w-[72px] h-[100px] rounded-md bg-[#0d0b14] border border-[#1e1a2e]" />
        <div className="absolute top-[3px] left-[3px] w-[72px] h-[100px] rounded-md bg-[#100e18] border border-[#1e1a2e]" />
        <div className={`relative w-[72px] h-[100px] rounded-md border border-[#2a2540] flex flex-col items-center justify-center
          ${canDraw ? 'group-hover:border-violet/40 transition-colors' : ''}`}
          style={{ background: 'radial-gradient(ellipse at center, #1a1628 0%, #0e0c18 70%)' }}>
          {/* Orbs + M */}
          <div className="relative w-[52px] h-[52px] flex items-center justify-center">
            {ELEMENT_ORBS.map(({ element, angle }) => {
              const rad = (angle * Math.PI) / 180
              const x = Math.cos(rad) * 20
              const y = Math.sin(rad) * 20
              return (
                <img
                  key={element}
                  src={`/magii/elements-sm/${element}.png`}
                  alt={element}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: '12px', height: '12px',
                    left: '50%', top: '50%',
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    opacity: 0.5,
                    filter: 'drop-shadow(0 0 2px rgba(139,92,246,0.3))',
                  }}
                />
              )
            })}
            <div className="w-7 h-7 rounded-full border border-violet/25 flex items-center justify-center"
              style={{ background: 'radial-gradient(circle, #1e1a30, transparent)' }}>
              <span className="text-violet/40 text-[11px] font-display font-bold">M</span>
            </div>
          </div>
          <span className="text-[10px] text-text-faint mt-0.5">{count}</span>
        </div>
      </button>
      {canDraw && (
        <span className="text-[9px] text-text-faint/60">Draw</span>
      )}
    </div>
  )
}

// --- Opponent Seat (across the table) ---

function OpponentSeat({
  player, isActive, canTakeDiscard, onTakeDiscard,
}: {
  player: Player
  isActive: boolean
  canTakeDiscard: boolean
  onTakeDiscard: () => void
}) {
  const discardTop = player.discardPile.length > 0
    ? player.discardPile[player.discardPile.length - 1]
    : null

  return (
    <div className={`flex flex-col items-center gap-2 ${isActive ? 'relative magii-active-opponent' : ''}`}>
      {/* Name plate */}
      <div className={`px-3 py-1 rounded-full text-xs font-display font-semibold transition-all
        ${isActive
          ? 'bg-violet/15 text-violet border border-violet/30'
          : 'bg-black/20 text-text-dim border border-white/5'
        }`}>
        {player.name}
        {player.doubled && <span className="text-gold text-[9px] ml-1.5">2x</span>}
        {isActive && <span className="text-violet/60 text-[9px] ml-1.5 animate-pulse">...</span>}
      </div>

      {/* Hand — face-down cards (desktop) */}
      <div className="hidden md:flex gap-[3px]">
        {player.hand.map((_, i) => (
          <div key={i} className="w-[22px] h-[32px] rounded-[3px] border border-[#2a2540] flex items-center justify-center"
            style={{ background: 'radial-gradient(ellipse at center, #1a1628, #0e0c18)' }}>
            <span className="text-violet/20 text-[6px] font-display font-bold">M</span>
          </div>
        ))}
      </div>
      {/* Hand — card count (mobile) */}
      <span className="md:hidden text-[9px] text-text-faint/40 font-display">{player.hand.length} cards</span>

      {/* Discard pile — clickable during draw phase */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[8px] text-text-faint/40 font-display">Discard</span>
        {discardTop ? (
          <Card
            card={discardTop}
            size="sm"
            onClick={canTakeDiscard ? onTakeDiscard : undefined}
            selected={canTakeDiscard}
          />
        ) : (
          <div className="w-14 h-[76px] rounded-md border border-dashed border-white/5" />
        )}
      </div>
    </div>
  )
}

// --- Player's Hand Area (bottom of table) ---

function PlayerArea({
  player, isDrawPhase, isDiscardPhase,
  onDiscard, onCallMagii, npcProcessing,
}: {
  player: Player
  isDrawPhase: boolean
  isDiscardPhase: boolean
  onDiscard: (idx: number) => void
  onCallMagii: () => void
  npcProcessing: boolean
}) {
  const isMobile = useIsMobile()
  const discardTop = player.discardPile.length > 0
    ? player.discardPile[player.discardPile.length - 1]
    : null
  const grouped = groupHand(player.hand)
  const activeSetTypes = [...new Set(grouped.map(g => g.setType).filter(Boolean))] as ('triad' | 'spectrum')[]
  const cardSize = isMobile ? 'sm' : 'md'
  const handComplete = isDiscardPhase && canCallMagii(player)

  // Fanned hand: measure available width and overlap cards so they always fit.
  const fanRef = useRef<HTMLDivElement>(null)
  const [fanW, setFanW] = useState(0)
  useEffect(() => {
    const el = fanRef.current
    if (!el) return
    const update = () => setFanW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Tap-to-lift, tap-again-to-discard (works on touch + mouse).
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  useEffect(() => { setSelectedIdx(null) }, [player.hand.length, isDiscardPhase])
  const handleCardClick = (originalIdx: number) => {
    if (isDiscardPhase && selectedIdx === originalIdx) {
      onDiscard(originalIdx)
      setSelectedIdx(null)
    } else {
      setSelectedIdx(prev => (prev === originalIdx ? null : originalIdx))
    }
  }

  // Card footprint + per-card step (center-to-center). Negative margin = overlap.
  const cardW = isMobile ? 56 : 96
  const n = grouped.length
  const maxStep = cardW + 8
  const avail = fanW || (isMobile ? 340 : 600)
  const fitStep = n > 1 ? (avail - cardW) / (n - 1) : maxStep
  const minStep = Math.round(cardW * 0.36)
  const step = Math.max(minStep, Math.min(maxStep, fitStep))
  const overlapMargin = Math.round(step - cardW)
  const roomy = step >= cardW * 0.7  // enough slack to separate element groups

  return (
    <div className="flex flex-col items-center gap-2 md:gap-4">
      {/* Discard pile + status area */}
      <div className="flex items-end gap-3 md:gap-6">
        {/* Your discard pile */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] text-text-faint/40 font-display">Discard</span>
          {discardTop ? (
            <Card card={discardTop} size="sm" />
          ) : (
            <div className="w-14 h-[76px] rounded-md border border-dashed border-white/5" />
          )}
        </div>

        {/* Turn prompts + Call Magii */}
        <div className="flex flex-col items-center gap-1.5 min-w-[80px] md:min-w-[140px]">
          {isDrawPhase && !npcProcessing && (
            <span className="text-[11px] text-violet/60 font-display animate-pulse">Draw a card...</span>
          )}
          {isDiscardPhase && (
            <>
              <button
                onClick={onCallMagii}
                title={handComplete
                  ? 'Bank this hand and end the round'
                  : 'Your hand may be incomplete — calling wrong costs −50'}
                className={`px-4 py-1.5 rounded-lg font-display font-bold text-sm transition-all
                  ${handComplete
                    ? 'bg-gold text-black shadow-lg shadow-gold/30 hover:brightness-110 magii-glow'
                    : 'bg-black/30 border border-white/10 text-text-faint hover:border-gold/30 hover:text-text-dim'}`}
              >
                Call Magii
              </button>
              <span className="text-[10px] text-text-faint/50 font-display">
                {handComplete ? 'complete — or push for more' : 'or discard a card'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Your Hand — fanned, overlapping, lifts on hover/tap */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        <span className="text-[9px] text-text-faint/30 font-display tracking-widest uppercase">
          Your Hand ({player.hand.length})
        </span>
        <div
          ref={fanRef}
          className="flex justify-center items-end w-full max-w-[660px] px-2"
          style={{ paddingTop: cardSize === 'md' ? 24 : 16 }}
        >
          {grouped.map((g, i) => {
            const isSelected = selectedIdx === g.originalIdx
            return (
              <div
                key={g.card.id}
                className={`relative magii-card-enter group transition-all duration-150 ease-out
                  hover:z-20 hover:-translate-y-2 ${isSelected ? 'z-30 -translate-y-4 scale-[1.12]' : 'z-0'}`}
                style={{ marginLeft: i === 0 ? 0 : overlapMargin + (g.groupBreak && roomy ? 6 : 0) }}
              >
                {/* Set membership bar on the visible left edge */}
                {g.setType && (
                  <div
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full z-[1] pointer-events-none"
                    style={{ backgroundColor: SET_COLORS[g.setType], opacity: 0.85 }}
                    title={g.setType}
                  />
                )}
                <Card
                  card={g.card}
                  size={cardSize}
                  selected={isSelected}
                  onClick={() => handleCardClick(g.originalIdx)}
                />
                {/* Two-step discard hint on the lifted card */}
                {isSelected && isDiscardPhase && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-40 pointer-events-none whitespace-nowrap">
                    <span className="text-[9px] font-display text-violet bg-black/70 px-1.5 py-0.5 rounded">
                      tap to discard
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Set legend */}
        {activeSetTypes.length > 0 && (
          <div className="flex gap-3 mt-0.5">
            {activeSetTypes.map(t => (
              <div key={t} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SET_COLORS[t], opacity: 0.7 }} />
                <span className="text-[8px] text-text-faint/40 font-display">{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Game Log (subtle overlay at bottom) ---

function GameLog({ log }: { log: string[] }) {
  const recent = log.slice(-2)
  return (
    <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
      {recent.map((msg, i) => (
        <p key={i} className={`text-[10px] ${i === recent.length - 1 ? 'text-text-dim/60' : 'text-text-faint/30'}`}>
          {msg}
        </p>
      ))}
    </div>
  )
}

// --- Double Down Modal ---

export function DoubleDownModal({ onChoice, marks, anteBase, anteDoubled }: {
  onChoice: (doubled: boolean) => void
  marks: number
  anteBase: number
  anteDoubled: number
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 magii-modal-enter">
      <div className="bg-[#13111d] rounded-xl p-6 md:p-8 max-w-sm w-full border border-[#2a2540] text-center magii-modal-content">
        <p className="font-display text-2xl font-bold text-text mb-2">Set Your Stakes</p>
        <p className="text-text-dim text-sm mb-1">Win the round to bank your score. Lose, and your ante is gone.</p>
        <p className="text-[11px] text-[#d4a843]/70 font-display mb-6">⬡ {marks} Marks in your purse</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => onChoice(false)}
            className="flex flex-col items-center px-6 py-3 rounded-lg bg-black/30 border border-white/10 text-text hover:border-violet/30 transition-colors font-display font-semibold">
            I&apos;m in.
            <span className="text-[10px] text-text-faint font-normal mt-0.5">ante {anteBase}</span>
          </button>
          <button onClick={() => onChoice(true)}
            className="flex flex-col items-center px-6 py-3 rounded-lg bg-violet text-white hover:bg-violet-dim transition-colors font-display font-semibold shadow-lg shadow-violet/20">
            Double.
            <span className="text-[10px] text-white/60 font-normal mt-0.5">ante {anteDoubled} · 2× score</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Game Over Overlay ---

export function GameOverOverlay({ state, onPlayAgain, marksDelta, walletBalance }: {
  state: GameState; onPlayAgain: () => void; marksDelta?: number; walletBalance?: number
}) {
  const winner = state.winner !== null ? state.players[state.winner] : null
  const playerSets = state.players.map(p => findBestSets(p.hand))
  const caller = state.calledBy !== null ? state.players[state.calledBy] : null
  const falseCallerIdx = state.scores.findIndex(s => s === -50)
  const falseCaller = falseCallerIdx >= 0 ? state.players[falseCallerIdx] : null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4 magii-game-over">
      <div className="bg-[#13111d] rounded-xl p-5 md:p-8 max-w-lg w-full border border-[#2a2540] magii-modal-content">
        <p className="font-display text-3xl font-bold text-text text-center mb-1">
          {winner?.isHuman ? 'Victory!' : `${winner?.name} wins!`}
        </p>
        <p className="text-text-faint text-xs text-center mb-6">
          {falseCaller
            ? `${falseCaller.isHuman ? 'You' : falseCaller.name} called on an incomplete hand — −50.`
            : caller
            ? `${caller.isHuman ? 'You' : caller.name} completed three sets first.`
            : 'The deck ran out — most points wins.'}
        </p>
        <div className="space-y-2">
          {state.players.map((p, i) => (
            <div key={i} className={`flex items-center justify-between px-4 py-2.5 rounded-lg
              ${i === state.winner ? 'bg-violet/10 border border-violet/25' : 'bg-black/20 border border-white/5'}`}>
              <div>
                <span className="font-display font-semibold text-text text-sm">{p.name}</span>
                {p.doubled && <span className="text-gold text-[10px] ml-2">2x</span>}
                {i === state.calledBy && (
                  <span className="text-violet text-[9px] ml-2 font-display uppercase tracking-wide">Magii</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {playerSets[i] && (
                  <div className="flex gap-1">
                    {playerSets[i]!.map((s, j) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-black/30 border border-white/5 text-text-faint">
                        {s.type}
                      </span>
                    ))}
                  </div>
                )}
                <span className="font-display font-bold text-lg" style={{ color: i === state.winner ? '#8b5cf6' : undefined }}>
                  {state.scores[i]}
                </span>
              </div>
            </div>
          ))}
        </div>
        {marksDelta !== undefined && (
          <div className="mt-4 text-center">
            <span className={`font-display text-sm ${marksDelta >= 0 ? 'text-[#d4a843]' : 'text-red-400/80'}`}>
              {marksDelta >= 0 ? `+${marksDelta}` : marksDelta} Marks
            </span>
            {walletBalance !== undefined && (
              <span className="text-text-faint/40 text-[10px] ml-2">⬡ {walletBalance} in purse</span>
            )}
          </div>
        )}
        <button onClick={onPlayAgain}
          className="mt-4 w-full py-3 rounded-lg bg-violet text-white font-display font-semibold hover:bg-violet-dim transition-colors shadow-lg shadow-violet/20">
          Play Again
        </button>
      </div>
    </div>
  )
}

// --- Volume Control ---

function VolumeControl() {
  const audio = getMagiiAudio()
  const [open, setOpen] = useState(false)
  useSyncExternalStore(
    (cb) => audio.subscribe(cb),
    () => `${audio.muted}-${JSON.stringify(audio.volumes)}`
  )

  const vols = audio.volumes
  const sliders: { key: 'music' | 'sfx' | 'ambient'; label: string }[] = [
    { key: 'music', label: 'Music' },
    { key: 'sfx', label: 'Effects' },
    { key: 'ambient', label: 'Ambience' },
  ]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-7 h-7 flex items-center justify-center rounded-md bg-black/30 border border-white/5 text-text-faint hover:text-text-dim hover:border-white/10 transition-colors"
        title={audio.muted ? 'Sound off' : 'Sound on'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          {!audio.muted && <path d="M15.54 8.46a5 5 0 010 7.07" />}
          {audio.muted && <><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></>}
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-[#13111d]/95 backdrop-blur-sm rounded-lg p-3 border border-white/8 w-40 z-50">
          <button
            onClick={() => audio.toggleMute()}
            className={`w-full text-left text-[10px] font-display font-semibold mb-2.5 transition-colors
              ${audio.muted ? 'text-red-400/70' : 'text-text-dim'}`}
          >
            {audio.muted ? 'Unmute' : 'Mute'}
          </button>
          {sliders.map(({ key, label }) => (
            <div key={key} className="mb-2 last:mb-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-text-faint">{label}</span>
                <span className="text-[8px] text-text-faint/50">{Math.round(vols[key] * 100)}</span>
              </div>
              <input
                type="range" min="0" max="100" value={Math.round(vols[key] * 100)}
                onChange={e => audio.setVolume(key, parseInt(e.target.value) / 100)}
                className="magii-slider w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main Game Board (Table Layout) ---

export function GameBoard({
  state, onDrawDeck, onDrawDiscard, onDiscard, onCallMagii,
  npcProcessing, npcAction, turnFlashKey,
}: {
  state: GameState
  onDrawDeck: () => void
  onDrawDiscard: (targetId: number) => void
  onDiscard: (cardIdx: number) => void
  onCallMagii: () => void
  npcProcessing?: boolean
  npcAction?: string
  turnFlashKey?: number
}) {
  const human = state.players[0]
  const isPlayerTurn = state.currentPlayer === 0 && state.phase === 'playing'
  const isDrawPhase = isPlayerTurn && state.turnPhase === 'draw'
  const isDiscardPhase = isPlayerTurn && state.turnPhase === 'discard'

  // Which opponent discard piles can be taken from
  const availableDiscards = isDrawPhase ? getAvailableDiscardPiles(state, 0) : []

  return (
    <div className="magii-table relative rounded-2xl overflow-hidden min-h-[calc(100dvh-5rem)] md:min-h-[720px] flex flex-col">
      {/* Table surface layers */}
      <div className="magii-table-circuits" />
      <div className="magii-table-nodes" />
      <div className="magii-table-rune" />
      <div className="magii-table-edge" />

      {/* Volume control */}
      <div className="absolute top-2 left-2 md:top-3 md:left-4 z-20">
        <VolumeControl />
      </div>

      {/* Turn indicator */}
      <div className="absolute top-2 right-2 md:top-3 md:right-4 z-10">
        <span className="text-[10px] text-text-faint/50 font-display">Turn {state.turn}</span>
      </div>

      {/* Your turn flash */}
      {turnFlashKey !== undefined && turnFlashKey > 0 && (
        <div key={turnFlashKey} className="absolute inset-0 pointer-events-none rounded-2xl magii-your-turn z-30" />
      )}

      {/* NPC action toast */}
      {npcAction && (
        <div className="absolute top-[38%] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="magii-toast px-4 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
            <span className="text-[11px] text-text-dim font-display">{npcAction}</span>
          </div>
        </div>
      )}

      {/* --- Table Layout --- */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between py-3 px-2 md:py-6 md:px-8">

        {/* Opponents across the table */}
        <div className="flex items-start justify-center gap-3 md:gap-12 w-full">
          {[1, 2, 3].map(i => (
            <OpponentSeat
              key={i}
              player={state.players[i]}
              isActive={state.currentPlayer === i && state.phase === 'playing'}
              canTakeDiscard={availableDiscards.includes(i)}
              onTakeDiscard={() => onDrawDiscard(i)}
            />
          ))}
        </div>

        {/* Center of table — Draw Pile */}
        <div className="my-4">
          <DrawPile
            count={state.deck.length}
            onClick={onDrawDeck}
            canDraw={isDrawPhase}
          />
        </div>

        {/* Player area (bottom of table) */}
        <div className={npcProcessing ? 'magii-waiting' : ''}>
          <PlayerArea
            player={human}
            isDrawPhase={isDrawPhase}
            isDiscardPhase={isDiscardPhase}
            onDiscard={onDiscard}
            onCallMagii={onCallMagii}
            npcProcessing={!!npcProcessing}
          />
        </div>
      </div>

      {/* Game log */}
      <GameLog log={state.log} />
    </div>
  )
}
