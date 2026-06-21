'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useCloudSave } from '@/lib/use-cloud-save'
import { useWallet } from '@/lib/use-wallet'
import {
  GameState, initGame, setDoubleDown, startPlaying,
  drawFromDeck, drawFromDiscard, discardCard, callMagii,
} from './lib/engine'
import { chooseDrawAction, chooseDiscardAction, shouldCallMagii, decideDoubleDown, getNPCDifficulty } from './lib/npc'
import { getMagiiAudio } from './lib/audio'
import { getHubAudio } from '@/lib/hub-audio'
import { GameBoard, DoubleDownModal, GameOverOverlay, Card } from './game-board'
import type { Card as CardType } from './lib/data'
import { COLLECTIONS, getCollectionEntry } from './lib/data'

// Ante (buy-in) wagered each round. Doubling down stakes more — and risks more.
const ANTE_BASE = 10
const ANTE_DOUBLED = 20
const WELCOME_STAKE = 100  // one-time bankroll for brand-new players

export default function MagiiPage() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [npcProcessing, setNpcProcessing] = useState(false)
  const [npcAction, setNpcAction] = useState('')
  const [turnFlashKey, setTurnFlashKey] = useState(0)
  const [marksDelta, setMarksDelta] = useState(0)

  const prevPhase = useRef<string | null>(null)
  const prevTurn = useRef<number | null>(null)
  const wagerRef = useRef(ANTE_BASE)
  const { load, save, submitScore, isSignedIn } = useCloudSave('magii')
  const wallet = useWallet()
  const statsRef = useRef({ wins: 0, losses: 0, highScore: 0, totalScore: 0, gamesPlayed: 0, seeded: false, ownedCollections: ['tavern'] as string[] })
  // Owned + selected collection drive the start-screen picker. Tavern is always owned.
  const [owned, setOwned] = useState<string[]>(['tavern'])
  const [selectedId, setSelectedId] = useState('tavern')
  const loadedRef = useRef(false)
  const seededRef = useRef(false)
  const [statsReady, setStatsReady] = useState(false)
  // came in through the spatial Room hub → offer a walk-back affordance
  const [roomDest, setRoomDest] = useState<string | null>(null)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('from') === 'room') setRoomDest('/room')
    // if the muffled tavern bed carried through the door, open it to the in-game
    // level right away (no wait for the start-screen click). See lib/hub-audio.ts.
    const hub = getHubAudio()
    if (hub.isStarted) hub.open()
  }, [])

  // Load saved stats from cloud on mount.
  // Don't mark loaded until auth resolves — useSession is undefined on first
  // render, so claiming "loaded" here would permanently skip the fetch once
  // the session hydrates and isSignedIn flips true.
  useEffect(() => {
    if (loadedRef.current) return
    if (!isSignedIn) { setStatsReady(true); return }  // wait for auth (or genuinely signed out)
    loadedRef.current = true
    load().then(data => {
      if (data) statsRef.current = { ...statsRef.current, ...data }
      const list = statsRef.current.ownedCollections ?? ['tavern']
      statsRef.current.ownedCollections = list.includes('tavern') ? list : ['tavern', ...list]
      setOwned(statsRef.current.ownedCollections)
      setStatsReady(true)
    })
  }, [isSignedIn, load])

  // One-time welcome stake so a player has a bankroll to bet with.
  // Gated on a persisted `seeded` flag (loaded with stats) so it fires once per account.
  useEffect(() => {
    if (wallet.loading || !statsReady || seededRef.current) return
    seededRef.current = true
    if (wallet.marks === 0 && !statsRef.current.seeded) {
      statsRef.current.seeded = true
      wallet.earn(WELCOME_STAKE)
      if (isSignedIn) save({ ...statsRef.current })
    }
  }, [wallet.loading, statsReady, wallet.marks, wallet, isSignedIn, save])

  function newGame() {
    const audio = getMagiiAudio()
    audio.init()
    audio.play('game-start')
    const entry = getCollectionEntry(owned.includes(selectedId) ? selectedId : 'tavern')
    const state = initGame(entry.collection)
    setGameState(state)
    setNpcProcessing(false)
    setMarksDelta(0)
  }

  // Spend Marks to unlock a collection, then select it. No-op if already owned or too poor.
  function unlockCollection(id: string, cost: number) {
    if (owned.includes(id)) { setSelectedId(id); return }
    if (!wallet.spend(cost)) { getMagiiAudio().play('button-click'); return }
    getMagiiAudio().play('double-down')
    const next = [...owned, id]
    setOwned(next)
    setSelectedId(id)
    statsRef.current.ownedCollections = next
    if (isSignedIn) save({ ...statsRef.current })
  }

  function handleDoubleDown(doubled: boolean) {
    if (!gameState) return
    if (doubled) getMagiiAudio().play('double-down')
    else getMagiiAudio().play('button-click')
    wagerRef.current = doubled ? ANTE_DOUBLED : ANTE_BASE
    let next = setDoubleDown(gameState, 0, doubled)
    for (let i = 1; i < 4; i++) {
      const npcDoubled = decideDoubleDown(next.players[i], getNPCDifficulty(i))
      next = setDoubleDown(next, i, npcDoubled)
    }
    next = startPlaying(next)
    setGameState(next)
  }

  function handleDrawDeck() {
    if (!gameState || npcProcessing || gameState.turnPhase !== 'draw' || gameState.currentPlayer !== 0) return
    getMagiiAudio().play('card-draw')
    setGameState(drawFromDeck(gameState, 0))
  }

  function handleDrawDiscard(targetId: number) {
    if (!gameState || npcProcessing || gameState.turnPhase !== 'draw' || gameState.currentPlayer !== 0) return
    getMagiiAudio().play('card-draw')
    setGameState(drawFromDiscard(gameState, 0, targetId))
  }

  // Player chooses to call Magii. Valid hand → score it. Invalid → −50 penalty.
  function handleCallMagii() {
    if (!gameState || npcProcessing || gameState.turnPhase !== 'discard' || gameState.currentPlayer !== 0) return
    getMagiiAudio().play('magii-call')
    setGameState(callMagii(gameState, 0))
  }

  function handleDiscard(cardIdx: number) {
    if (!gameState || npcProcessing || gameState.turnPhase !== 'discard' || gameState.currentPlayer !== 0) return
    getMagiiAudio().play('card-place')
    const next = discardCard(gameState, 0, cardIdx)
    setGameState(next)
  }

  const processNPCTurn = useCallback(() => {
    if (!gameState || gameState.phase !== 'playing' || gameState.currentPlayer === 0) return
    if (npcProcessing) return

    setNpcProcessing(true)
    const pid = gameState.currentPlayer
    const difficulty = getNPCDifficulty(pid)
    const delay = 800 + Math.random() * 600

    setTimeout(() => {
      let next = gameState

      // Step 1: Draw
      const drawAction = chooseDrawAction(pid, next, difficulty)
      if (drawAction.type === 'draw-deck') {
        next = drawFromDeck(next, pid)
      } else {
        next = drawFromDiscard(next, pid, drawAction.targetId!)
      }

      // Step 2: Check Magii or discard
      if (shouldCallMagii(next.players[pid], difficulty, next)) {
        getMagiiAudio().play('magii-call')
        setNpcAction(`${next.players[pid].name} called Magii!`)
        setTimeout(() => setNpcAction(''), 2500)
        next = callMagii(next, pid)
        setGameState(next)
        setNpcProcessing(false)
        return
      }

      const discardAction = chooseDiscardAction(pid, next, difficulty)
      const pName = next.players[pid].name
      const labels: Record<string, string> = {
        'draw-deck': 'drew from deck',
        'draw-discard': 'took a discard',
      }
      getMagiiAudio().play('card-draw')
      setNpcAction(`${pName} ${labels[drawAction.type] ?? 'acted'}`)
      setTimeout(() => setNpcAction(''), 1800)

      next = discardCard(next, pid, discardAction.cardIdx)
      setGameState(next)
      setNpcProcessing(false)
    }, delay)
  }, [gameState, npcProcessing])

  useEffect(() => {
    if (gameState?.phase === 'playing' && gameState.currentPlayer !== 0) {
      processNPCTurn()
    }
  }, [gameState?.currentPlayer, gameState?.phase, processNPCTurn])

  // Sound: chime when it becomes the player's turn
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return
    if (gameState.currentPlayer === 0 && prevTurn.current !== null && prevTurn.current !== 0) {
      getMagiiAudio().play('turn-start')
      setTurnFlashKey(k => k + 1)
    }
    prevTurn.current = gameState.currentPlayer
  }, [gameState?.currentPlayer, gameState?.phase])

  // Sound + cloud save on game over
  useEffect(() => {
    if (!gameState) return
    if (gameState.phase === 'game-over' && prevPhase.current !== 'game-over') {
      getMagiiAudio().play(gameState.winner === 0 ? 'victory' : 'defeat')

      const stats = statsRef.current
      const playerScore = gameState.scores[0]
      const won = gameState.winner === 0
      stats.gamesPlayed++
      stats.totalScore += playerScore
      if (won) stats.wins++
      else stats.losses++
      if (playerScore > stats.highScore) stats.highScore = playerScore

      // Settle the wager: win → bank winnings; lose → forfeit the ante.
      if (won) {
        const winnings = Math.max(0, Math.ceil(playerScore / 5))
        setMarksDelta(winnings)
        if (winnings > 0) wallet.earn(winnings)
      } else {
        const loss = Math.min(wagerRef.current, wallet.marks)
        setMarksDelta(-loss)
        if (loss > 0) wallet.spend(loss)
      }

      if (isSignedIn) {
        save({ ...stats })
        submitScore(stats.highScore)
      }
    }
    prevPhase.current = gameState.phase
  }, [gameState?.phase, gameState?.winner, isSignedIn, save, submitScore, wallet])

  // Example card for the start screen guide
  const exampleCard: CardType = {
    id: 'storm-lightning-fox-0',
    element: 'Storm',
    rune: 'Lightning',
    spirit: 'fox',
    color: '#fbbf24',
  }

  // --- Start Screen (tavern entrance) ---
  if (!gameState) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-6">
        <div className="magii-table rounded-2xl p-12 max-w-xl w-full text-center relative overflow-hidden">
          {/* Table surface layers */}
          <div className="magii-table-circuits" />
          <div className="magii-table-nodes" />
          <div className="magii-table-rune" />
          <div className="magii-table-edge" />

          <div className="relative z-10">
            <h1 className="font-display text-5xl font-bold text-text mb-2 tracking-wide">Magii</h1>
            <p className="text-text-dim text-sm mb-1">A tavern card game of sets and stakes.</p>
            <p className="text-text-faint text-xs mb-5 italic font-display">
              Four elements. Eight runes. Three spirits each. One winner.
            </p>

            <p className="text-[11px] text-[#d4a843]/60 font-display mb-3">
              ⬡ {wallet.marks} Marks in your purse
            </p>

            {/* Collection picker — choose your deck, unlock more with Marks */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {COLLECTIONS.map(entry => {
                const isOwned = owned.includes(entry.id)
                const isSelected = selectedId === entry.id
                const canAfford = wallet.marks >= entry.cost
                return (
                  <button
                    key={entry.id}
                    onClick={() => isOwned ? setSelectedId(entry.id) : unlockCollection(entry.id, entry.cost)}
                    disabled={!isOwned && !canAfford}
                    className={`relative text-left rounded-lg p-3 border transition-all ${
                      isSelected
                        ? 'border-violet bg-violet/10 shadow-md shadow-violet/20'
                        : 'border-white/8 bg-black/20 hover:border-white/20'
                    } ${!isOwned && !canAfford ? 'opacity-40 cursor-not-allowed' : ''}`}
                    style={isSelected ? { borderColor: entry.accent } : undefined}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.accent }} />
                      <span className="font-display text-[12px] font-semibold text-text leading-tight">{entry.collection.name}</span>
                    </div>
                    <p className="text-[10px] text-text-faint leading-snug mb-1.5">{entry.blurb}</p>
                    {isOwned
                      ? <span className="text-[10px] font-display text-text-dim">{isSelected ? 'Selected' : 'Owned'}</span>
                      : <span className={`text-[10px] font-display ${canAfford ? 'text-[#d4a843]' : 'text-red-400/70'}`}>⬡ {entry.cost} {canAfford ? 'Unlock' : 'Locked'}</span>}
                  </button>
                )
              })}
            </div>

            <button onClick={newGame}
              className="px-10 py-3.5 rounded-lg bg-violet text-white font-display font-semibold text-lg hover:bg-violet-dim transition-all shadow-lg shadow-violet/25 magii-glow mb-8">
              Sit Down &middot; {getCollectionEntry(selectedId).collection.name}
            </button>

            {/* Reading the Cards — example card with guide */}
            <div className="bg-black/20 rounded-xl p-5 border border-white/5 mb-4">
              <p className="font-display font-semibold text-text text-sm mb-4">Reading the Cards</p>
              <div className="flex items-center gap-6 justify-center">
                {/* Example card */}
                <div className="shrink-0">
                  <Card card={exampleCard} size="lg" />
                </div>

                {/* Callout labels */}
                <div className="text-left space-y-3 text-[12px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#fbbf24]/60 shrink-0" />
                    <p className="text-text-dim">
                      <strong className="text-text">Rune</strong> &mdash; top left &amp; bottom right
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#8b5cf6]/60 shrink-0" />
                    <p className="text-text-dim">
                      <strong className="text-text">Element</strong> &mdash; border color
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#3b82f6]/60 shrink-0" />
                    <p className="text-text-dim">
                      <strong className="text-text">Spirit</strong> &mdash; the creature
                    </p>
                  </div>
                  <div className="pt-2 border-t border-white/5 text-[11px] text-text-faint">
                    <p>Match 3 cards to form sets and call Magii.</p>
                    <p className="mt-1">Same spirit &times; 3 = <strong className="text-[#d4a843]">Triad</strong> (40 pts)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Play */}
            <div className="text-left bg-black/20 rounded-xl p-5 border border-white/5">
              <p className="font-display font-semibold text-text text-sm mb-3">How to Play</p>
              <div className="space-y-1.5 text-[12px] text-text-dim leading-relaxed">
                <p>You&apos;re dealt 8 cards. Build <strong className="text-text">3 sets of 3</strong>, then <strong className="text-text">call Magii</strong> to end the round.</p>
                <p><strong className="text-text">Triad</strong> (40 pts) &mdash; 3 identical cards (same rune &amp; spirit)</p>
                <p><strong className="text-text">Spectrum</strong> (25 pts) &mdash; same rune, all 3 different spirits</p>
                <p className="pt-1 text-text-faint">Each turn: draw from the deck or an opponent&apos;s discard, then discard one &mdash; or <strong className="text-text">call</strong> when your hand is complete.</p>
                <p className="text-text-faint">A complete hand is yours to bank &mdash; or push for high-scoring Triads. But call on an <strong className="text-text">incomplete</strong> hand and it&apos;s &minus;50.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Game View ---
  return (
    <div className="max-w-6xl mx-auto px-2 py-2 md:px-4 md:py-4">
      {roomDest && (
        <a
          href={roomDest}
          className="fixed top-4 left-4 z-50 flex items-center gap-2 rounded-md border border-[#d4a843]/30 bg-[#12121e]/80 backdrop-blur px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[#d4a843]/80 transition hover:text-[#d4a843] hover:border-[#d4a843]/60"
        >
          ‹ back to the room
        </a>
      )}
      {/* Minimal header */}
      <div className="flex items-center justify-between mb-2 md:mb-3 px-1">
        <span className="font-display text-sm text-text-faint tracking-widest uppercase">
          Magii <span className="text-text-faint/40 normal-case tracking-normal">· {getCollectionEntry(selectedId).collection.name}</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="font-display text-xs text-[#d4a843]/80" title="Your Marks purse">
            ⬡ {wallet.marks} <span className="text-[#d4a843]/40">Marks</span>
          </span>
          <button onClick={() => { getMagiiAudio().destroy(); setGameState(null) }}
            className="text-[10px] text-text-faint/40 hover:text-text-dim transition-colors">
            Leave Table
          </button>
        </div>
      </div>

      {gameState.phase === 'double-down' && (
        <DoubleDownModal
          onChoice={handleDoubleDown}
          marks={wallet.marks}
          anteBase={ANTE_BASE}
          anteDoubled={ANTE_DOUBLED}
        />
      )}
      {gameState.phase === 'game-over' && (
        <GameOverOverlay
          state={gameState}
          onPlayAgain={newGame}
          marksDelta={marksDelta}
          walletBalance={wallet.marks}
        />
      )}

      <GameBoard
        state={gameState}
        onDrawDeck={handleDrawDeck}
        onDrawDiscard={handleDrawDiscard}
        onDiscard={handleDiscard}
        onCallMagii={handleCallMagii}
        npcProcessing={npcProcessing}
        npcAction={npcAction}
        turnFlashKey={turnFlashKey}
      />
    </div>
  )
}
