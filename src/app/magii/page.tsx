'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useCloudSave } from '@/lib/use-cloud-save'
import { useWallet } from '@/lib/use-wallet'
import { useParty } from '@/lib/party'
import { useAccount } from '@/lib/accounts/use-account'
import { rememberSeed } from './lib/seed-history'
import {
  GameState, SeatSpec, initGame, startPlaying, applySeats, soloSeats, NPC_NAMES,
  drawFromDeck, drawFromDiscard, discardCard, callMagii,
} from './lib/engine'
import { useTable, reduceMove, tableSeats, type TableMove } from './lib/table'
import { chooseDrawAction, chooseDiscardAction, shouldCallMagii, getNPCDifficulty } from './lib/npc'
import { getMagiiAudio, type SoundName } from './lib/audio'
import { getHubAudio } from '@/lib/hub-audio'
import { GameBoard, GameOverOverlay, Card } from './game-board'
import type { Card as CardType } from './lib/data'
import { COLLECTIONS, getCollectionEntry } from './lib/data'
import { saveOwnerResolved, SAVE_OWNER_EVENT } from '@/lib/save-slot'

// The card game is the Marks FAUCET (canon: Marks = the Mug's coin). No ante, no
// double-down — one flat prize: win → 10 + 30% of your score; everyone else leaves
// with 10. You never lose Marks at the table; the arcade games are where they're spent.
const PRIZE_FLOOR = 10        // consolation — everyone leaves the table with at least this
const PRIZE_SCORE_RATE = 0.3  // winner's bonus = this × their winning score
const WELCOME_STAKE = 100     // one-time bankroll for brand-new players

export default function MagiiPage() {
  // Solo play keeps its own state; a networked table's state is DERIVED from the deal plus
  // the relayed move log and never set directly. Two sources on purpose — mixing them would
  // mean a local move could sneak onto a networked table without going through the relay,
  // which is the one thing that breaks convergence.
  const [soloState, setSoloState] = useState<GameState | null>(null)
  const [npcProcessing, setNpcProcessing] = useState(false)
  const [npcAction, setNpcAction] = useState('')
  const [turnFlashKey, setTurnFlashKey] = useState(0)
  const [marksDelta, setMarksDelta] = useState(0)

  const prevPhase = useRef<string | null>(null)
  const prevTurn = useRef<number | null>(null)
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

  // ── The party sits down together ────────────────────────────────────────────
  //
  // This is what the whole identity chain was built for. The party is site-level (lib/party):
  // the group you made in the world, or off an invite link, is already here — so sitting down
  // needs no lobby, no per-game invite UI, and no "waiting for players" wall. Sit Down reads
  // the party, and whichever chairs your friends have not taken are played by the regulars.
  //
  // The socket opens on SIT DOWN, not on page load. Occupying a chair while you are still
  // reading the rules would let a party of four fill the table with people who have not
  // actually sat, and the fourth would be told the table was full.
  const party = useParty()
  const { session } = useAccount()
  const myName = session?.username || 'Traveler'
  const [tableCode, setTableCode] = useState<string | null>(null)
  const table = useTable(tableCode, myName, session?.user_id ?? null, selectedId)
  const netMode = tableCode !== null
  const mySeat = netMode ? table.seat : 0

  // Who is in which chair. Rebuilt from the roster, so a friend arriving or dropping shows
  // up here and nowhere else.
  const seats: SeatSpec[] = useMemo(
    () => (netMode ? tableSeats(table.roster, table.seat) : soloSeats()),
    [netMode, table.roster, table.seat],
  )

  // ── The networked table's state ─────────────────────────────────────────────
  //
  // Held as {gen, applied, state} rather than a bare GameState because the reducers have to
  // be applied EXACTLY ONCE each, in order. Keeping the applied count next to the state it
  // produced makes this updater idempotent — running it twice on the same inputs is a no-op —
  // which matters because React re-invokes updaters in development and a double-applied
  // discard would silently deal a card out of the wrong hand.
  const [net, setNet] = useState<{ gen: number; applied: number; state: GameState } | null>(null)

  useEffect(() => {
    if (!netMode || table.seat === null || !table.seed || !table.collection) return
    const entry = getCollectionEntry(table.collection)
    setNet(prev => {
      let base = prev
      if (!base || base.gen !== table.gen) {
        // A fresh deal, or the first sight of this table. Note the seats passed here are
        // only labels: the deal is a function of (collection, seed) alone, so everyone
        // builds the identical deck no matter what they call each other.
        base = { gen: table.gen, applied: 0, state: startPlaying(initGame(entry.collection, table.seed!, seats)) }
      }
      if (base.applied >= table.moves.length) return base
      let s = base.state
      for (let i = base.applied; i < table.moves.length; i++) s = reduceMove(s, table.moves[i])
      return { gen: table.gen, applied: table.moves.length, state: s }
    })
  }, [netMode, table.seat, table.seed, table.collection, table.gen, table.moves, seats])

  // Names are cosmetic and deliberately not part of the deal, so they are stamped on at
  // render time. That keeps the canonical replayed state above independent of who happened
  // to be connected — which is exactly what lets a latecomer replay the log and land on the
  // same table as everyone else.
  const gameState: GameState | null = useMemo(
    () => (netMode ? (net ? applySeats(net.state, seats) : null) : soloState),
    [netMode, net, seats, soloState],
  )

  // The table remembers the deal it is playing, for a bug report or to sit down at it again.
  const seedNotedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!netMode || !table.seed || !table.collection) return
    if (seedNotedRef.current === table.seed) return
    seedNotedRef.current = table.seed
    rememberSeed(table.seed, getCollectionEntry(table.collection).collection.name)
  }, [netMode, table.seed, table.collection])

  // Sitting down at a table that is already full is a real answer, not an error to retry:
  // four chairs is the design. Drop back to the start screen and say so.
  const [tableFullNote, setTableFullNote] = useState(false)
  useEffect(() => {
    if (table.full) { setTableCode(null); setNet(null); setTableFullNote(true) }
  }, [table.full])

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
  // ★ AND NOT UNTIL WE KNOW WHOSE SAVE IT IS (2026-08-23). The card save is per-account now, and
  // `SaveOwnerBoot` answers that a few frames in — loading before it lands reads the ANONYMOUS
  // stats and then never re-reads, so a signed-in player would sit in somebody else's collection
  // for the whole session. `loadedRef` makes the fetch once; this decides WHEN once is.
  //
  // ⚠ HONESTLY LABELLED: THIS GUARD HAS NO DEMONSTRATED FAILING CASE. Removing it and re-running
  // `scripts/save-owner-probe.mts` stays green, because nothing on this page writes the stats back
  // on load — so the wrong read leaves no trace in storage for a probe to find, and what is wrong
  // is only what the player SEES. The reasoning stands (a slot read before the owner is known IS
  // the anonymous slot) and the case that bites is an account whose adoption LOCKED: it already
  // has a save, so nothing moves, and a different anonymous save sits beside it. Kept because it is
  // free and the premise protecting it today — that this page never re-saves on load — is a fact
  // about this page, not a guarantee. If you make it re-save, this becomes load-bearing.
  const [ownerKnown, setOwnerKnown] = useState(saveOwnerResolved())
  useEffect(() => {
    if (ownerKnown) return
    const on = () => setOwnerKnown(true)
    window.addEventListener(SAVE_OWNER_EVENT, on)
    if (saveOwnerResolved()) setOwnerKnown(true)      // it landed between render and this effect
    return () => window.removeEventListener(SAVE_OWNER_EVENT, on)
  }, [ownerKnown])

  useEffect(() => {
    if (loadedRef.current) return
    if (!ownerKnown) return
    if (!isSignedIn) { setStatsReady(true); return }  // wait for auth (or genuinely signed out)
    loadedRef.current = true
    load().then(data => {
      if (data) statsRef.current = { ...statsRef.current, ...data }
      const list = statsRef.current.ownedCollections ?? ['tavern']
      statsRef.current.ownedCollections = list.includes('tavern') ? list : ['tavern', ...list]
      setOwned(statsRef.current.ownedCollections)
      setStatsReady(true)
    })
  }, [isSignedIn, load, ownerKnown])

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
    setNpcProcessing(false)
    setMarksDelta(0)
    setTableFullNote(false)

    // In a party? Then Sit Down means sit down WITH THEM. The party code addresses the
    // table, so everyone who clicks this lands at the same one and the server hands out the
    // chairs. Nothing is dealt locally — the deal comes back from the table.
    if (party.party) {
      setTableCode(party.party)
      return
    }

    const entry = getCollectionEntry(owned.includes(selectedId) ? selectedId : 'tavern')
    // no stakes step — deal and play straight through to the flat prize
    const state = startPlaying(initGame(entry.collection))
    // Remember the seed so this exact table can be dealt again from a bug report. Expires
    // after a week — see lib/seed-history.
    rememberSeed(state.seed, entry.collection.name)
    setSoloState(state)
  }

  /** Play Again. At a networked table the deal is the table's, so ask for it rather than
   *  minting one — simultaneous clicks collapse into a single new deck (see dealAgain). */
  function playAgain() {
    if (netMode) {
      getMagiiAudio().play('game-start')
      setMarksDelta(0)
      table.dealAgain()
      return
    }
    newGame()
  }

  /** Leave the table. Networked: stand up so the chair goes back to a regular. */
  function leaveTable() {
    getMagiiAudio().destroy()
    setTableCode(null)
    setNet(null)
    setSoloState(null)
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

  /**
   * Every move goes through here, and the difference between solo and networked play is the
   * whole of it: solo applies the reducer now, networked SUBMITS and applies when the server
   * echoes it back. That echo round-trip is what keeps four clients in lockstep — applying
   * locally as well would run your own discard twice on your machine and once on everyone
   * else's, which is a divergence that only surfaces several turns later.
   */
  const submit = useCallback((move: TableMove, phase: 'draw' | 'discard', sound: SoundName) => {
    const seatNow = mySeat
    if (!gameState || seatNow === null) return
    if (npcProcessing || gameState.turnPhase !== phase || gameState.currentPlayer !== seatNow) return
    if (gameState.phase !== 'playing') return
    getMagiiAudio().play(sound)
    if (netMode) { table.send(move); return }
    setSoloState(reduceMove(gameState, { seq: 0, seat: seatNow, move }))
  }, [gameState, mySeat, npcProcessing, netMode, table])

  const handleDrawDeck = () => submit({ kind: 'draw-deck' }, 'draw', 'card-draw')
  const handleDrawDiscard = (targetId: number) => submit({ kind: 'draw-discard', targetId }, 'draw', 'card-draw')
  const handleDiscard = (cardIdx: number) => submit({ kind: 'discard', cardIdx }, 'discard', 'card-place')
  // Call Magii. Valid hand → score it. Invalid → −50 penalty, decided by the engine on
  // every machine identically, so a bad call is not something the relay has to police.
  const handleCallMagii = () => submit({ kind: 'call' }, 'discard', 'magii-call')

  // Is the chair whose turn it is being played by a person?
  const seatIsHuman = useCallback(
    (i: number) => (netMode ? !!table.roster[i]?.occupied : i === 0),
    [netMode, table.roster],
  )

  // Exactly one client runs the regulars. Solo that is trivially you; at a networked table it
  // is the dealer (the lowest occupied seat), because the NPC brain reads Math.random — two
  // clients running it would choose two different discards for the same chair and the tables
  // would fork. Everyone else simply waits for the relay, same as for a human's turn.
  const iAmDealer = netMode ? table.dealer !== null && table.dealer === table.seat : true

  /**
   * ONE move per step, chosen from the state as it stands.
   *
   * Written as a reaction to (whose turn, which phase) rather than as a turn played straight
   * through, because networked moves land on the ECHO: a turn that sent its draw and its
   * discard back to back would decide the discard against a hand the table had not dealt yet,
   * and the state arriving between the two would re-trigger this and draw a tenth card. One
   * move, then wait to see it land, is both simpler and self-healing — if a move is ever
   * dropped, the next render simply decides again from wherever the table actually is.
   *
   * `npcStepRef` is what makes it safe to re-run: it fingerprints the state this step was
   * decided from, so the same step cannot be played twice while its move is in flight.
   */
  const npcStepRef = useRef('')

  const processNPCTurn = useCallback(() => {
    if (!gameState || gameState.phase !== 'playing') return
    const pid = gameState.currentPlayer
    if (seatIsHuman(pid) || !iAmDealer) return

    const key = [
      netMode ? table.gen : 'solo', gameState.turn, pid, gameState.turnPhase,
      gameState.deck.length, gameState.players[pid].hand.length,
    ].join('|')
    if (npcStepRef.current === key) return
    npcStepRef.current = key

    const difficulty = getNPCDifficulty(pid)
    const drawing = gameState.turnPhase === 'draw'
    // A regular pauses to think before drawing; the discard follows quickly, so the pair
    // reads as one deliberation rather than two.
    const delay = drawing ? 800 + Math.random() * 600 : 260 + Math.random() * 200
    setNpcProcessing(true)

    setTimeout(() => {
      // The relay is the only path a move takes to a networked table — a regular's included.
      const play = (move: TableMove, applied: GameState) => {
        if (netMode) table.sendFor(pid, move)
        else setSoloState(applied)
        setNpcProcessing(false)
      }

      if (drawing) {
        const action = chooseDrawAction(pid, gameState, difficulty)
        const move: TableMove = action.type === 'draw-deck'
          ? { kind: 'draw-deck' }
          : { kind: 'draw-discard', targetId: action.targetId! }
        getMagiiAudio().play('card-draw')
        setNpcAction(`${gameState.players[pid].name} ${action.type === 'draw-deck' ? 'drew from deck' : 'took a discard'}`)
        setTimeout(() => setNpcAction(''), 1800)
        play(move, reduceMove(gameState, { seq: 0, seat: pid, move }))
        return
      }

      // Discard phase — bank a complete hand, or throw the weakest card and keep going.
      if (shouldCallMagii(gameState.players[pid], difficulty, gameState)) {
        getMagiiAudio().play('magii-call')
        setNpcAction(`${gameState.players[pid].name} called Magii!`)
        setTimeout(() => setNpcAction(''), 2500)
        play({ kind: 'call' }, callMagii(gameState, pid))
        return
      }
      const { cardIdx } = chooseDiscardAction(pid, gameState, difficulty)
      getMagiiAudio().play('card-place')
      play({ kind: 'discard', cardIdx }, discardCard(gameState, pid, cardIdx))
    }, delay)
  }, [gameState, seatIsHuman, iAmDealer, netMode, table])

  useEffect(() => {
    if (gameState?.phase === 'playing' && !seatIsHuman(gameState.currentPlayer)) {
      processNPCTurn()
    }
  }, [gameState, processNPCTurn, seatIsHuman])

  // A friend's move should read on the table the same way a regular's does. Driven off the
  // relayed log rather than off whoever made the move, so it works for every seat but yours.
  useEffect(() => {
    if (!netMode || !gameState || mySeat === null) return
    const last = table.moves[table.moves.length - 1]
    if (!last || last.seat === mySeat || !seatIsHuman(last.seat)) return
    const who = gameState.players[last.seat]?.name ?? 'Someone'
    const said = last.move.kind === 'draw-deck' ? 'drew from deck'
      : last.move.kind === 'draw-discard' ? 'took a discard'
      : last.move.kind === 'call' ? 'called Magii!'
      : 'discarded'
    setNpcAction(`${who} ${said}`)
    const t = setTimeout(() => setNpcAction(''), 1800)
    return () => clearTimeout(t)
  }, [netMode, table.moves, mySeat, seatIsHuman, gameState])

  // Sound: chime when it becomes the player's turn
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing' || mySeat === null) return
    if (gameState.currentPlayer === mySeat && prevTurn.current !== null && prevTurn.current !== mySeat) {
      getMagiiAudio().play('turn-start')
      setTurnFlashKey(k => k + 1)
    }
    prevTurn.current = gameState.currentPlayer
  }, [gameState?.currentPlayer, gameState?.phase, mySeat])

  // Sound + cloud save on game over.
  // Every seat scores itself: at a networked table all four are real players, so "did I win"
  // and "what did I score" are questions about MY chair, not about seat 0.
  useEffect(() => {
    if (!gameState || mySeat === null) return
    if (gameState.phase === 'game-over' && prevPhase.current !== 'game-over') {
      getMagiiAudio().play(gameState.winner === mySeat ? 'victory' : 'defeat')

      const stats = statsRef.current
      const playerScore = gameState.scores[mySeat]
      const won = gameState.winner === mySeat
      stats.gamesPlayed++
      stats.totalScore += playerScore
      if (won) stats.wins++
      else stats.losses++
      if (playerScore > stats.highScore) stats.highScore = playerScore

      // Flat prize — the faucet. Win → 10 + 30% of your score; everyone else → 10.
      // No forfeit: you always leave the table richer (marks are spent at the arcade).
      const prize = won ? Math.round(PRIZE_FLOOR + PRIZE_SCORE_RATE * playerScore) : PRIZE_FLOOR
      setMarksDelta(prize)
      wallet.earn(prize)

      if (isSignedIn) {
        save({ ...stats })
        submitScore(stats.highScore)
      }
    }
    prevPhase.current = gameState.phase
  }, [gameState?.phase, gameState?.winner, mySeat, isSignedIn, save, submitScore, wallet])

  // Example card for the start screen guide
  const exampleCard: CardType = {
    id: 'storm-lightning-fox-0',
    element: 'Storm',
    rune: 'Lightning',
    spirit: 'fox',
    color: '#fbbf24',
  }

  // --- Taking a seat (networked) ---
  // The gap between clicking Sit Down and the table answering with a seat. Brief, but it must
  // not look like the start screen ignored the click.
  if (netMode && !gameState) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-6">
        <div className="magii-table rounded-2xl p-10 max-w-sm w-full text-center relative overflow-hidden">
          <div className="magii-table-circuits" />
          <div className="magii-table-edge" />
          <div className="relative z-10">
            <p className="font-display text-lg text-text mb-1">Pulling up a chair…</p>
            <p className="text-text-faint text-[11px] font-display tracking-widest uppercase mb-5">
              party {tableCode}
            </p>
            <button onClick={leaveTable}
              className="text-[11px] text-text-faint/50 hover:text-text-dim transition-colors font-display">
              never mind
            </button>
          </div>
        </div>
      </div>
    )
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
                        ? 'border-gold bg-gold/10 shadow-md shadow-gold/20'
                        : 'border-white/8 bg-black/25 hover:border-gold/30'
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
              className="px-10 py-3.5 rounded-lg bg-gold text-black font-display font-semibold text-lg hover:brightness-110 transition-all shadow-lg shadow-gold/30 magii-glow mb-2">
              Sit Down &middot; {getCollectionEntry(selectedId).collection.name}
            </button>

            {/* The party is already here — it came from the world, or from an invite link.
                Say so plainly, because the button now means something different: your friends
                get the chairs they arrive to claim, and the regulars hold the rest. */}
            {party.party ? (
              <p className="text-[11px] text-emerald-400/70 font-display mb-8">
                Playing with your party <span className="tracking-widest">{party.party}</span>
                <span className="text-text-faint/50"> · the regulars fill the empty chairs</span>
              </p>
            ) : (
              <p className="text-[11px] text-text-faint/40 font-display mb-8">
                Three regulars at the table. Start a party in the room to bring friends.
              </p>
            )}

            {/* Four chairs is the design, not a queue to wait in. */}
            {tableFullNote && (
              <p className="text-[11px] text-red-400/70 font-display mb-6 -mt-4">
                That table has all four chairs taken.
              </p>
            )}

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
        {/* hidden on mobile when the fixed "back to the room" pill occupies this corner */}
        <span className={`font-display text-sm text-text-faint tracking-widest uppercase ${roomDest ? 'hidden sm:inline' : ''}`}>
          Magii <span className="text-text-faint/40 normal-case tracking-normal">
            {/* The deck is the TABLE's, so read it off the table and not off your own picker —
                a guest at someone else's table is playing their collection. */}
            · {getCollectionEntry(netMode ? (table.collection ?? 'tavern') : selectedId).collection.name}
          </span>
        </span>
        <div className="flex items-center gap-4">
          {netMode && (
            <span className={`font-display text-[10px] tracking-widest uppercase ${table.connected ? 'text-emerald-400/70' : 'text-red-400/70'}`}
              title={table.connected ? `party ${tableCode}` : 'reconnecting to the table'}>
              {table.connected ? `${table.roster.filter(r => r.occupied).length}/4 seated` : 'reconnecting…'}
            </span>
          )}
          <span className="font-display text-xs text-[#d4a843]/80" title="Your Marks purse">
            ⬡ {wallet.marks} <span className="text-[#d4a843]/40">Marks</span>
          </span>
          <button onClick={leaveTable}
            className="text-[10px] text-text-faint/40 hover:text-text-dim transition-colors">
            Leave Table
          </button>
        </div>
      </div>

      {gameState.phase === 'game-over' && (
        <GameOverOverlay
          state={gameState}
          onPlayAgain={playAgain}
          marksDelta={marksDelta}
          walletBalance={wallet.marks}
          seat={mySeat ?? 0}
        />
      )}

      {/* Networked, "waiting" means any chair but yours is acting — a friend deliberating looks
          the same from here as a regular thinking. */}
      <GameBoard
        state={gameState}
        onDrawDeck={handleDrawDeck}
        onDrawDiscard={handleDrawDiscard}
        onDiscard={handleDiscard}
        onCallMagii={handleCallMagii}
        npcProcessing={npcProcessing || (netMode && mySeat !== null && gameState.currentPlayer !== mySeat)}
        npcAction={npcAction}
        turnFlashKey={turnFlashKey}
        seat={mySeat ?? 0}
      />
    </div>
  )
}
