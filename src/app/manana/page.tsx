'use client'

// MANA'NANA — match-3 with blooming specials. Match 4 → Surge (line), 5 → Prism
// (colour wipe), 7 → Ather Star (cross). Detonate by matching or swapping. Score
// milestones earn moves; cascades ramp an ather-heat multiplier. Glossy CSS gems.

import { useEffect, useRef, useState } from 'react'
import RoomReturn from '../_components/RoomReturn'
import DailyLeaderboard from '../_components/DailyLeaderboard'
import { mulberry32, type Rng } from '@/lib/arcade/rng'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import {
  W, H, idx, xy, areAdjacent, reshuffle, swapped, swapMakesMatch, swapDetonation,
  resolve, anyMove, isPuff, seedPuffs, spreadPuffs, countPuffs,
  isCollared, seedCollars, atherSurge, type Cell, type Kind, type ResolveStep,
} from './lib/match3'
import { sfx, type ManaSfx } from './lib/sfx'
import AtherBackdrop from './AtherBackdrop'
import { RuneMark, type RuneId } from './runes'
import { LEVELS, levelAt, isLastLevel, trackStep, goalMet, goalProgress, goalLabel } from './lib/quests'

const START_MOVES = 20
const PUFF_SEED = 3 // cloud-puffs seeded at board start; they spread if ignored
const MOVES_PER_MILESTONE = 4
const ATHER_MAX = 48 // orbs to clear to charge one Ather Surge (forges 3 specials)
const ATHER_FORGE = 3 // specials the surge forges
const milestoneTarget = (n: number) => Math.round(1200 + n * 1500 + n * n * 350)

// The six orbs map to canon: the 4 elements (Mana/Storm/Earth/Water) + Ather
// (the raw substance) + Love. Colours unchanged; `rune` picks the mark, `mark`
// is its colour (light on dark orbs, ink on the pale Ather orb). Order is fixed —
// the index is the board's colour id, so renames must stay in place.
type Piece = { name: string; base: string; light: string; edge: string; rune: RuneId; mark: string }
const PIECES: Piece[] = [
  { name: 'Storm', base: '#f0a526', light: '#ffd884', edge: '#9c6510', rune: 'storm', mark: 'rgba(255,255,255,0.9)' },
  { name: 'Water', base: '#37a3e6', light: '#a6d8f7', edge: '#1d5f8e', rune: 'water', mark: 'rgba(255,255,255,0.92)' },
  { name: 'Mana', base: '#9b5ad2', light: '#d8b3f2', edge: '#5e3088', rune: 'mana', mark: 'rgba(255,255,255,0.92)' },
  { name: 'Earth', base: '#48b56f', light: '#a4e7bb', edge: '#236e3f', rune: 'earth', mark: 'rgba(255,255,255,0.9)' },
  { name: 'Love', base: '#e8554e', light: '#f9a8a2', edge: '#9c2f2a', rune: 'love', mark: 'rgba(255,255,255,0.92)' },
  { name: 'Ather', base: '#c9d2e6', light: '#ffffff', edge: '#7e879b', rune: 'ather', mark: 'rgba(64,68,92,0.9)' },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Cloud-puff blocker — CSS stub in Shimmer's canon cloud palette (warm pale
// lavender/mauve, see tiles.ts T34), not cold grey. Swap for a painted Aseprite
// cloud sprite later (same path as the orbs). Not interactive.
function PuffCell({ pop }: { pop: boolean }) {
  const lump = (s: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', borderRadius: '9999px', ...s })
  return (
    <span
      className={`absolute inset-0 flex items-center justify-center pointer-events-none ${pop ? 'manana-pop' : ''}`}
      aria-hidden
    >
      <span className="relative" style={{ width: '82%', height: '64%', filter: 'drop-shadow(0 2px 4px rgba(34,34,54,0.45))' }}>
        <span style={lump({ left: '-2%', bottom: '2%', width: '46%', height: '72%', background: '#dcc7da' })} />
        <span style={lump({ right: '-2%', bottom: '2%', width: '46%', height: '72%', background: '#dcc7da' })} />
        <span style={lump({ left: '14%', top: '-14%', width: '42%', height: '84%', background: '#efe0f4' })} />
        <span style={lump({ left: '40%', top: '-6%', width: '46%', height: '80%', background: '#e7d3ea' })} />
        <span style={lump({ left: '6%', bottom: '-4%', width: '88%', height: '66%', background: '#cdb4cb' })} />
        <span style={lump({ left: '24%', top: '4%', width: '34%', height: '38%', background: 'rgba(255,255,255,0.6)', filter: 'blur(2px)' })} />
      </span>
    </span>
  )
}
// detonation effects (clean arcade): beams for surge/star, a ring for prism,
// a soft flash for star, and colour motes off every cleared cell.
type FxSpec =
  | { t: 'beamH'; y: number; ox: number; color: string }
  | { t: 'beamV'; x: number; oy: number; color: string }
  | { t: 'ring'; x: number; y: number; color: string }
  | { t: 'flash' }
  | { t: 'mote'; x: number; y: number; dx: number; dy: number; color: string }
type Fx = FxSpec & { id: number }

const RAINBOW = 'conic-gradient(from 210deg, #f0a526, #e8554e, #9b5ad2, #37a3e6, #48b56f, #f0a526)'

function bigSound(fired: Kind[]): ManaSfx | null {
  if (fired.includes('star') || fired.includes('burst')) return 'star'
  if (fired.includes('prism')) return 'prism'
  if (fired.some((k) => k === 'surgeH' || k === 'surgeV')) return 'surge'
  return null
}

// a big floating word when you forge a special or land a combo — teaches the roster.
const SPECIAL_NAME: Partial<Record<Kind, string>> = { surgeH: 'SURGE', surgeV: 'SURGE', prism: 'PRISM', star: 'STAR', burst: 'BURST' }
const specialRank = (k: Kind): number => (k === 'burst' || k === 'star' ? 3 : k === 'prism' ? 2 : k === 'surgeH' || k === 'surgeV' ? 1 : 0)
function calloutFor(step: ResolveStep): string | null {
  if (step.spawned.length) {
    const best = step.spawned.map((s) => s.kind).sort((a, b) => specialRank(b) - specialRank(a))[0]
    return `${SPECIAL_NAME[best] ?? 'SPECIAL'}!`
  }
  if (step.fired.length >= 2) return 'COMBO!' // several specials detonating together
  return null
}

export default function MananaPage() {
  const [board, setBoardState] = useState<Cell[]>([])
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [moves, setMovesState] = useState(START_MOVES)
  const [milestones, setMilestones] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [popping, setPopping] = useState<Set<number>>(new Set())
  const [heat, setHeat] = useState(1)
  const [reward, setReward] = useState(0)
  const [callout, setCallout] = useState<{ text: string; key: number } | null>(null)
  const calloutNonce = useRef(0)
  const [atherCharge, setAtherCharge] = useState(0) // 0..ATHER_MAX; full = surge ready
  const atherChargeRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [mode, setMode] = useState<'endless' | 'daily' | 'quests'>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [level, setLevel] = useState(0) // quest ladder index
  const levelRef = useRef(0)
  const [questGot, setQuestGot] = useState(0) // progress toward the current goal
  const questGotRef = useRef(0)
  const [won, setWon] = useState(false) // the over-overlay is a WIN (quest cleared) not a loss
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)
  const [muted, setMuted] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [boardPx, setBoardPx] = useState<number | null>(null)
  const [fx, setFx] = useState<Fx[]>([])
  const fxIdRef = useRef(0)

  useNoScroll() // pin to viewport on mobile — no page scroll / iOS bounce

  // clear the special/combo callout after it flashes
  useEffect(() => {
    if (!callout) return
    const t = setTimeout(() => setCallout(null), 850)
    return () => clearTimeout(t)
  }, [callout])

  const boardWrapRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<Cell[]>([])
  const movesRef = useRef(START_MOVES)
  const scoreRef = useRef(0)
  const milestonesRef = useRef(0)
  const rngRef = useRef<Rng>(mulberry32(1))
  const dragRef = useRef<{ i: number; x: number; y: number } | null>(null)

  const apply = (b: Cell[]) => {
    boardRef.current = b
    setBoardState(b)
  }

  const newGame = () => {
    // daily = the same board + luck sequence for everyone today; endless = random.
    rngRef.current = mulberry32(modeRef.current === 'daily' ? dailySeed() : ((Date.now() & 0xffffffff) >>> 0))
    apply(seedPuffs(reshuffle(rngRef.current), rngRef.current, PUFF_SEED))
    setShared(false)
    scoreRef.current = 0
    setScore(0)
    movesRef.current = START_MOVES
    setMovesState(START_MOVES)
    milestonesRef.current = 0
    setMilestones(0)
    atherChargeRef.current = 0
    setAtherCharge(0)
    setSelected(null)
    setPopping(new Set())
    setHeat(1)
    setReward(0)
    setOver(false)
    setBusy(false)
  }

  useEffect(() => {
    rngRef.current = mulberry32((Date.now() & 0xffffffff) >>> 0)
    setBest(Number(localStorage.getItem('manana.best') ?? 0))
    setDailyBest(loadDailyBest('manana'))
    setMuted(sfx.isMuted())
    apply(seedPuffs(reshuffle(rngRef.current), rngRef.current, PUFF_SEED))
    setMounted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // size the board to the largest square that fits its slot (width AND height) —
  // pure-CSS aspect/cqmin can't read a flex-grown height reliably, so measure it.
  useEffect(() => {
    const el = boardWrapRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      // available height from the wrapper's top to the viewport bottom, minus footer room.
      // (measuring r.height would feed back — the board inflates its own wrapper.)
      const avail = window.innerHeight - r.top - 52
      const s = Math.floor(Math.min(r.width, avail))
      if (s > 80) setBoardPx(s)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mounted])

  // iOS locks to the board: React touch handlers are passive, so kill the page's
  // rubber-band scroll/bounce with a real non-passive listener on the board.
  useEffect(() => {
    const el = boardWrapRef.current
    if (!el) return
    const block = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [mounted])

  // start (or restart) a quest level: its own board seed, move budget, puff count.
  const startLevel = (i: number) => {
    const clamped = Math.max(0, Math.min(LEVELS.length - 1, i))
    const lv = LEVELS[clamped]
    levelRef.current = clamped
    setLevel(clamped)
    localStorage.setItem('manana.quest.level', String(clamped))
    rngRef.current = mulberry32((Date.now() & 0xffffffff) >>> 0)
    let b0 = seedPuffs(reshuffle(rngRef.current), rngRef.current, lv.puffs)
    if (lv.collars) b0 = seedCollars(b0, rngRef.current, lv.collars)
    apply(b0)
    scoreRef.current = 0; setScore(0)
    movesRef.current = lv.moves; setMovesState(lv.moves)
    questGotRef.current = 0; setQuestGot(0)
    milestonesRef.current = 0; setMilestones(0)
    atherChargeRef.current = 0; setAtherCharge(0)
    setSelected(null); setPopping(new Set()); setHeat(1); setReward(0)
    setWon(false); setOver(false); setBusy(false)
  }

  // the current goal was met — clear the level and remember the next one.
  const win = () => {
    setWon(true)
    setOver(true)
    sfx.play('reward')
    const next = Math.min(levelRef.current + 1, LEVELS.length)
    localStorage.setItem('manana.quest.level', String(isLastLevel(levelRef.current) ? levelRef.current : next))
  }

  const endGame = () => {
    setOver(true)
    setWon(false)
    sfx.play('over')
    if (modeRef.current === 'daily') {
      setDailyBest(saveDailyBest('manana', scoreRef.current))
    } else if (modeRef.current === 'endless' && scoreRef.current > best) {
      setBest(scoreRef.current)
      localStorage.setItem('manana.best', String(scoreRef.current))
    }
  }

  // quests: check the goal (win) before the out-of-moves loss.
  const settle = () => {
    if (modeRef.current === 'quests') {
      if (goalMet(questGotRef.current, levelAt(levelRef.current).goal, scoreRef.current)) return win()
      settle()
      return
    }
    if (movesRef.current <= 0) endGame()
  }

  const pickMode = (m: 'endless' | 'daily' | 'quests') => {
    if (m === modeRef.current) return
    modeRef.current = m // sync so the re-seed reads the new mode
    setMode(m)
    sfx.ensure()
    if (m === 'quests') startLevel(Number(localStorage.getItem('manana.quest.level') ?? 0))
    else newGame()
  }
  const onShare = async () => {
    if (await copyShare(dailyShare("Mana'nana", scoreRef.current))) {
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

  const awardMilestones = () => {
    if (modeRef.current === 'quests') return // quests have a fixed move budget
    let awarded = 0
    while (scoreRef.current >= milestoneTarget(milestonesRef.current)) {
      milestonesRef.current += 1
      movesRef.current += MOVES_PER_MILESTONE
      awarded += MOVES_PER_MILESTONE
    }
    if (awarded) {
      setMilestones(milestonesRef.current)
      setMovesState(movesRef.current)
      sfx.play('reward')
      setReward(awarded)
      setTimeout(() => setReward(0), 1300)
    }
  }

  // cell-center geometry inside the board (p-2.5 = 10px pad, gap-1.5 = 6px)
  const cellCenter = (n: number, bp: number) => {
    const cell = (bp - 20 - 7 * 6) / 8
    return 10 + n * (cell + 6) + cell / 2
  }

  const spawnFx = (items: FxSpec[], ttl: number) => {
    if (!items.length) return
    const tagged = items.map((f) => ({ ...f, id: fxIdRef.current++ } as Fx))
    setFx((cur) => [...cur, ...tagged])
    const ids = new Set(tagged.map((f) => f.id))
    setTimeout(() => setFx((cur) => cur.filter((f) => !ids.has(f.id))), ttl)
  }

  // turn a resolve step into beams / ring / flash / motes
  const fireEffects = (step: { matched: number[]; blasts: { i: number; kind: Kind; color: number }[]; spawned: { i: number }[] }) => {
    const bp = boardPx
    if (!bp) return
    const items: FxSpec[] = []
    let flash = false
    for (const bl of step.blasts) {
      const { x, y } = xy(bl.i)
      const col = PIECES[bl.color]?.base ?? '#ffd884'
      if (bl.kind === 'surgeH') items.push({ t: 'beamH', y: cellCenter(y, bp), ox: cellCenter(x, bp), color: col })
      else if (bl.kind === 'surgeV') items.push({ t: 'beamV', x: cellCenter(x, bp), oy: cellCenter(y, bp), color: col })
      else if (bl.kind === 'star') { items.push({ t: 'beamH', y: cellCenter(y, bp), ox: cellCenter(x, bp), color: col }, { t: 'beamV', x: cellCenter(x, bp), oy: cellCenter(y, bp), color: col }); flash = true }
      else if (bl.kind === 'prism') items.push({ t: 'ring', x: cellCenter(x, bp), y: cellCenter(y, bp), color: col })
      else if (bl.kind === 'burst') { items.push({ t: 'ring', x: cellCenter(x, bp), y: cellCenter(y, bp), color: col }); flash = true }
    }
    if (flash) items.push({ t: 'flash' })
    // colour motes off each cleared cell (capped so big cascades stay clean)
    const spawned = new Set(step.spawned.map((s) => s.i))
    let motes = 0
    for (const i of step.matched) {
      if (motes >= 40 || spawned.has(i)) continue
      const c = boardRef.current[i]
      const col = c && c.color >= 0 ? PIECES[c.color]?.base ?? '#ffd884' : '#e7d3ea'
      const cx = cellCenter(xy(i).x, bp), cy = cellCenter(xy(i).y, bp)
      const n = 4
      for (let k = 0; k < n; k++) {
        const a = (Math.PI * 2 * k) / n + Math.random() * 0.8
        const r = 14 + Math.random() * 16
        items.push({ t: 'mote', x: cx, y: cy, dx: Math.cos(a) * r, dy: Math.sin(a) * r, color: col })
      }
      motes++
    }
    spawnFx(items, 540)
  }

  const runResolve = async (start: Cell[], opts: { swapAt?: number; forced?: Set<number> }) => {
    const { steps, puffs } = resolve(start, rngRef.current, opts)
    for (let s = 0; s < steps.length; s++) {
      const step = steps[s]
      setPopping(new Set(step.matched))
      fireEffects(step)
      setHeat(step.mult)
      if (step.spawned.length) sfx.play('bloom')
      const big = bigSound(step.fired)
      if (big) sfx.play(big)
      else sfx.play(s === 0 ? 'pop' : 'combo')
      await sleep(255)
      scoreRef.current += step.gained
      setScore(scoreRef.current)
      awardMilestones()
      const call = calloutFor(step)
      if (call) { calloutNonce.current += 1; setCallout({ text: call, key: calloutNonce.current }) }
      if (step.freed) sfx.play('reward') // a collar snapped
      // charge the Ather Surge by orbs cleared this cascade (caps when full)
      if (atherChargeRef.current < ATHER_MAX) {
        atherChargeRef.current = Math.min(ATHER_MAX, atherChargeRef.current + step.colorCounts.reduce((a, c) => a + c, 0))
        setAtherCharge(atherChargeRef.current)
      }
      if (modeRef.current === 'quests') {
        questGotRef.current = trackStep(questGotRef.current, levelAt(levelRef.current).goal, step)
        setQuestGot(questGotRef.current)
      }
      apply(step.fallen)
      setPopping(new Set())
      await sleep(115)
    }
    setHeat(1)
    // the spread rule: clear no puff this move and the cloud creeps one cell.
    if (puffs === 0 && countPuffs(boardRef.current) > 0) {
      const spread = spreadPuffs(boardRef.current, rngRef.current)
      if (spread !== boardRef.current) {
        sfx.play('bad')
        apply(spread)
        await sleep(180)
      }
    }
    if (!anyMove(boardRef.current)) {
      sfx.play('shuffle')
      await sleep(220)
      apply(seedPuffs(reshuffle(rngRef.current), rngRef.current, PUFF_SEED))
    }
  }

  const trySwap = async (a: number, c: number) => {
    const before = boardRef.current
    const det = swapDetonation(before, a, c, rngRef.current)
    if (det) {
      sfx.ensure(); sfx.play('swap'); setBusy(true)
      apply(det.board)
      movesRef.current -= 1; setMovesState(movesRef.current)
      await sleep(120)
      await runResolve(det.board, { forced: det.forced })
      setBusy(false)
      settle()
    } else if (swapMakesMatch(before, a, c)) {
      sfx.ensure(); sfx.play('swap'); setBusy(true)
      const nb = swapped(before, a, c)
      apply(nb)
      movesRef.current -= 1; setMovesState(movesRef.current)
      await sleep(120)
      await runResolve(nb, { swapAt: c })
      setBusy(false)
      settle()
    } else {
      sfx.ensure(); sfx.play('bad'); setBusy(true)
      apply(swapped(before, a, c))
      await sleep(165)
      apply(before)
      setBusy(false)
    }
  }

  // ATHER SURGE — spend a full charge to forge random specials onto the board (no move cost).
  const fireAtherSurge = async () => {
    if (busy || over || atherChargeRef.current < ATHER_MAX) return
    sfx.ensure(); setBusy(true)
    atherChargeRef.current = 0; setAtherCharge(0)
    calloutNonce.current += 1; setCallout({ text: 'ATHER SURGE!', key: calloutNonce.current })
    sfx.play('bloom')
    const surged = atherSurge(boardRef.current, rngRef.current, ATHER_FORGE)
    apply(surged)
    setSelected(null)
    await sleep(260)
    setBusy(false)
  }

  const onPiece = (i: number) => {
    if (busy || over || isPuff(boardRef.current[i]) || isCollared(boardRef.current[i])) return
    if (selected === null) { sfx.ensure(); setSelected(i) }
    else if (selected === i) setSelected(null)
    else if (areAdjacent(selected, i)) { const a = selected; setSelected(null); trySwap(a, i) }
    else setSelected(i)
  }

  const DRAG_THRESH = 14
  const onDown = (i: number, e: React.PointerEvent) => {
    if (busy || over) return
    sfx.ensure()
    dragRef.current = { i, x: e.clientX, y: e.clientY }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || busy || over) return
    if (isCollared(boardRef.current[d.i])) { dragRef.current = null; return } // can't drag a locked orb
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.hypot(dx, dy) < DRAG_THRESH) return
    const { x, y } = xy(d.i)
    let target = -1
    if (Math.abs(dx) > Math.abs(dy)) target = dx > 0 ? (x < W - 1 ? idx(x + 1, y) : -1) : (x > 0 ? idx(x - 1, y) : -1)
    else target = dy > 0 ? (y < H - 1 ? idx(x, y + 1) : -1) : (y > 0 ? idx(x, y - 1) : -1)
    dragRef.current = null
    if (target >= 0 && !isPuff(boardRef.current[target]) && !isCollared(boardRef.current[target])) { setSelected(null); trySwap(d.i, target) }
  }
  const onUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (d && !busy && !over) onPiece(d.i)
  }

  if (!mounted) return <div className="min-h-screen bg-[#0d0a14]" />

  const prevAt = milestones > 0 ? milestoneTarget(milestones - 1) : 0
  const nextAt = milestoneTarget(milestones)
  const barPct = Math.max(0, Math.min(100, ((score - prevAt) / (nextAt - prevAt)) * 100))

  // quest HUD
  const lvl = levelAt(level)
  const questProg = goalProgress(questGot, lvl.goal, score)
  const questBarPct = Math.min(100, (questProg / lvl.goal.target) * 100)

  return (
    <div className="gx-chrome relative min-h-[calc(100svh-5rem)] overflow-hidden text-slate-200 font-sans" style={{ touchAction: 'manipulation', overscrollBehavior: 'none', ['--gx-accent' as string]: '#ffd884' } as React.CSSProperties}>
      <AtherBackdrop />
      {/* full-bleed board (its own AtherBackdrop) — deliberately NOT a cabinet; just
          the room tie so back lands facing the Arcade arch. */}
      <RoomReturn wall={1} />
      <style>{`
        @keyframes manana-pop { 0%{transform:scale(1)} 40%{transform:scale(1.28)} 100%{transform:scale(0);opacity:0} }
        @keyframes manana-drop { 0%{transform:translateY(-14px) scale(0.9);opacity:0.2} 100%{transform:translateY(0) scale(1);opacity:1} }
        @keyframes manana-charged { 0%,100%{ filter:brightness(1) } 50%{ filter:brightness(1.4) } }
        .manana-gem{ transition: transform .12s ease, box-shadow .12s ease; animation: manana-drop .18s ease; }
        .manana-pop{ animation: manana-pop .26s ease forwards !important; }
        .manana-charged{ animation: manana-charged 1.1s ease-in-out infinite; }

        /* --- special-piece detonations (clean arcade) --- */
        @keyframes manana-beamH { 0%{opacity:0;transform:translateY(-50%) scaleX(0)} 22%{opacity:1;transform:translateY(-50%) scaleX(1)} 65%{opacity:0.8} 100%{opacity:0;transform:translateY(-50%) scaleX(1)} }
        @keyframes manana-beamV { 0%{opacity:0;transform:translateX(-50%) scaleY(0)} 22%{opacity:1;transform:translateX(-50%) scaleY(1)} 65%{opacity:0.8} 100%{opacity:0;transform:translateX(-50%) scaleY(1)} }
        @keyframes manana-ring { 0%{opacity:0.9;transform:translate(-50%,-50%) scale(0.12)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1)} }
        @keyframes manana-flash { 0%{opacity:0} 18%{opacity:0.45} 100%{opacity:0} }
        @keyframes manana-mote { 0%{opacity:1;transform:translate(-50%,-50%)} 100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy)))} }
        .manana-beamH{ position:absolute; left:8px; right:8px; border-radius:9999px; mix-blend-mode:screen;
          background:linear-gradient(180deg,transparent,var(--c),#fff 50%,var(--c),transparent); box-shadow:0 0 16px var(--c);
          animation:manana-beamH .42s ease-out forwards; }
        .manana-beamV{ position:absolute; top:8px; bottom:8px; border-radius:9999px; mix-blend-mode:screen;
          background:linear-gradient(90deg,transparent,var(--c),#fff 50%,var(--c),transparent); box-shadow:0 0 16px var(--c);
          animation:manana-beamV .42s ease-out forwards; }
        .manana-ring{ position:absolute; border-radius:9999px; border:3px solid var(--c); box-shadow:0 0 22px var(--c),inset 0 0 18px var(--c); mix-blend-mode:screen;
          animation:manana-ring .52s ease-out forwards; }
        .manana-flash{ position:absolute; inset:0; border-radius:1rem; background:radial-gradient(circle,#fff,rgba(255,255,255,0.15)); mix-blend-mode:screen;
          animation:manana-flash .3s ease-out forwards; }
        .manana-mote{ position:absolute; width:7px; height:7px; border-radius:9999px; background:var(--c); box-shadow:0 0 8px var(--c); mix-blend-mode:screen;
          animation:manana-mote .5s ease-out forwards; }
        @keyframes manana-callout{ 0%{ transform:scale(.5); opacity:0 } 18%{ transform:scale(1.12); opacity:1 } 70%{ transform:scale(1); opacity:1 } 100%{ transform:scale(1.04); opacity:0 } }
        .manana-callout{ animation:manana-callout .85s ease-out forwards; }
      `}</style>

      <div className="relative z-10 max-w-[560px] mx-auto px-4 py-6 min-h-[calc(100svh-5rem)] flex flex-col">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#ffd884' }}>Mana&apos;nana</h1>
            <p className="text-[11px] text-slate-400/70 mt-0.5">match · bloom · detonate</p>
          </div>
          <div className="flex items-center gap-3">
            {(() => {
              const pct = Math.round((atherCharge / ATHER_MAX) * 100)
              const ready = atherCharge >= ATHER_MAX
              return (
                <button
                  onClick={fireAtherSurge}
                  disabled={!ready || busy}
                  title={ready ? 'Ather Surge — forge specials' : `Ather Surge · charging ${pct}%`}
                  aria-label="Ather Surge"
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center text-sm leading-none transition-all ${ready ? 'text-[#1a1228] animate-pulse cursor-pointer' : 'text-slate-400 cursor-default'}`}
                  style={{
                    background: ready ? 'radial-gradient(circle,#ffe6a8,#f0a526)' : `conic-gradient(#ffd884 ${pct}%, rgba(255,255,255,0.07) ${pct}%)`,
                    boxShadow: ready ? '0 0 12px #ffd884aa' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  }}
                >
                  <span className={ready ? '' : 'opacity-70'}>{'⚡'}</span>
                </button>
              )
            })()}
            <button
              onClick={() => { sfx.ensure(); const m = !muted; sfx.setMuted(m); setMuted(m); if (!m) sfx.play('swap') }}
              title={muted ? 'sound off' : 'sound on'}
              className="text-lg text-slate-500 hover:text-amber-300 transition-colors"
            >{muted ? '\u{1F507}' : '\u{1F50A}'}</button>          </div>
        </header>

        <div className="grid grid-cols-3 gap-2 mb-2 text-center">
          {[
            { k: 'SCORE', v: score, c: '#ffd884' },
            { k: 'MOVES', v: moves, c: moves <= 4 ? '#f9a8a2' : '#a6d8f7' },
            { k: 'BEST', v: best, c: '#a4e7bb' },
          ].map((s) => (
            <div key={s.k} className="rounded-xl bg-white/[0.04] border border-white/[0.06] py-2">
              <div className="gx-label text-[9px] text-slate-500">{s.k}</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: s.c }}>{s.v.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-2 text-[10px] tracking-[0.18em] uppercase">
          {(['quests', 'endless', 'daily'] as const).map((m) => (
            <button
              key={m}
              onClick={() => pickMode(m)}
              className={`px-3 py-1 rounded-full border transition-colors ${mode === m ? 'text-[#1a1228] bg-amber-300 border-amber-300 font-semibold' : 'text-slate-400 border-white/15 hover:text-amber-200'}`}
            >
              {m === 'daily' ? `daily #${dailyNumber()}` : m === 'quests' ? 'quest' : m}
            </button>
          ))}
        </div>

        {/* quests → goal tracker · endless/daily → milestone (+moves) bar */}
        {mode === 'quests' ? (
          <div className="mb-3">
            <div className="flex justify-between items-baseline text-[10px] mb-1">
              <span className="text-amber-200 font-semibold tracking-wide">Lv {lvl.id} · {lvl.name}</span>
              <span className="text-slate-300 tabular-nums">{questProg}/{lvl.goal.target}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${questBarPct}%`, background: 'linear-gradient(90deg,#a4e7bb,#ffd884)' }} />
            </div>
            <div className="text-[8px] text-slate-500 mt-1 tracking-wider text-center uppercase">{goalLabel(lvl.goal)}</div>
          </div>
        ) : (
          <div className="mb-3">
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${barPct}%`, background: 'linear-gradient(90deg,#a4e7bb,#ffd884)' }} />
            </div>
            <div className="flex justify-between text-[8px] text-slate-500 mt-1 tracking-wider">
              <span>ather meter</span>
              <span>next +{MOVES_PER_MILESTONE} moves</span>
            </div>
          </div>
        )}

        {/* board fits the leftover height — the whole 8x8 stays on screen, no scroll.
            100cqmin = the smaller of the wrapper's w/h, so the square never overflows either axis */}
        <div ref={boardWrapRef} className="flex-1 min-h-0 flex items-center justify-center w-full">
        <div className="relative rounded-2xl bg-black/30 border border-white/[0.06] p-2.5 shadow-2xl shadow-black/40" style={boardPx ? { width: boardPx, height: boardPx } : { width: '100%' }}>
          {/* heat multiplier */}
          {heat > 1 && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider text-[#1a1228]" style={{ background: 'linear-gradient(180deg,#ffe09a,#f0a526)' }}>
              ✦ ATHER HEAT ×{heat.toFixed(1)}
            </div>
          )}
          {reward > 0 && (
            <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full text-[11px] font-bold text-emerald-200 bg-emerald-500/20 border border-emerald-400/30 animate-pulse">
              +{reward} moves
            </div>
          )}

          {/* special / combo callout — names what you just forged */}
          {callout && (
            <div key={callout.key} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <span className="manana-callout text-3xl sm:text-4xl font-black italic tracking-wider" style={{ color: '#fff', textShadow: '0 0 16px #ffd884, 0 0 4px #ffb020, 0 2px 6px rgba(0,0,0,0.7)' }}>
                {callout.text}
              </span>
            </div>
          )}

          {/* detonation effects layer — never eats clicks */}
          {boardPx && fx.length > 0 && (() => {
            const cell = (boardPx - 20 - 7 * 6) / 8
            const beamT = cell * 0.78
            return (
              <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
                {fx.map((f) => {
                  if (f.t === 'beamH') return <span key={f.id} className="manana-beamH" style={{ top: f.y, height: beamT, transformOrigin: `${f.ox - 8}px center`, ['--c' as string]: f.color } as React.CSSProperties} />
                  if (f.t === 'beamV') return <span key={f.id} className="manana-beamV" style={{ left: f.x, width: beamT, transformOrigin: `center ${f.oy - 8}px`, ['--c' as string]: f.color } as React.CSSProperties} />
                  if (f.t === 'ring') return <span key={f.id} className="manana-ring" style={{ left: f.x, top: f.y, width: boardPx * 1.1, height: boardPx * 1.1, ['--c' as string]: f.color } as React.CSSProperties} />
                  if (f.t === 'flash') return <span key={f.id} className="manana-flash" />
                  return <span key={f.id} className="manana-mote" style={{ left: f.x, top: f.y, ['--c' as string]: f.color, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px` } as React.CSSProperties} />
                })}
              </div>
            )
          })()}

          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${W}, 1fr)`, touchAction: 'none' }}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={() => { dragRef.current = null }}
          >
            {board.map((cell, i) => {
              const isPop = popping.has(i)
              if (isPuff(cell)) {
                return (
                  <div key={i} className="relative aspect-square rounded-full flex items-center justify-center" aria-label="Cloud-puff">
                    <PuffCell pop={isPop} />
                  </div>
                )
              }
              const p = PIECES[cell.color] ?? PIECES[0]
              const isSel = selected === i
              const k = cell.kind
              const bg = k === 'prism' ? RAINBOW : `radial-gradient(circle at 32% 28%, ${p.light}, ${p.base} 58%, ${p.edge})`
              return (
                <button
                  key={i}
                  onPointerDown={(e) => onDown(i, e)}
                  className="relative aspect-square rounded-full"
                  style={{ touchAction: 'none' }}
                  aria-label={p.name}
                >
                  <span
                    className={`manana-gem absolute inset-0 rounded-full flex items-center justify-center ${isPop ? 'manana-pop' : ''} ${k !== 'none' ? 'manana-charged' : ''}`}
                    style={{
                      background: bg,
                      boxShadow: isSel
                        ? '0 0 0 3px #ffffffcc, 0 4px 10px rgba(0,0,0,0.5)'
                        : k !== 'none'
                          ? `inset 0 -3px 6px ${p.edge}88, 0 0 10px ${p.light}cc, 0 3px 6px rgba(0,0,0,0.35)`
                          : `inset 0 -3px 6px ${p.edge}88, 0 3px 6px rgba(0,0,0,0.35)`,
                      transform: isSel ? 'scale(1.08)' : undefined,
                    }}
                  >
                    <span className="absolute rounded-full" style={{ top: '14%', left: '20%', width: '32%', height: '24%', background: 'rgba(255,255,255,0.55)', filter: 'blur(2px)' }} />
                    {/* special markings */}
                    {k === 'surgeH' && <span className="absolute left-[6%] right-[6%] top-1/2 -translate-y-1/2 h-[26%] rounded-full bg-white/70" />}
                    {k === 'surgeV' && <span className="absolute top-[6%] bottom-[6%] left-1/2 -translate-x-1/2 w-[26%] rounded-full bg-white/70" />}
                    {k === 'star' && <span className="relative text-white text-[16px] sm:text-[20px] leading-none drop-shadow-[0_0_4px_white]">✦</span>}
                    {k === 'prism' && <span className="absolute inset-[34%] rounded-full bg-white/85" />}
                    {k === 'burst' && <span className="absolute inset-[30%] rounded-[4px] bg-white/85 rotate-45" />}
                    {k === 'none' && <RuneMark rune={p.rune} color={p.mark} />}
                    {/* collar — a gold band locking the orb (canon: free the spirit) */}
                    {isCollared(cell) && (
                      <>
                        <span className="absolute inset-0 rounded-full bg-black/40" />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] h-[30%] rounded-full border-2 border-[#e7c878] bg-[#2a2114]/70" style={{ boxShadow: '0 0 6px #e7c87899, inset 0 0 4px #00000088' }} />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[14%] h-[14%] rounded-full bg-[#e7c878] shadow-[0_0_4px_#e7c878]" />
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {over && (
            <div className="absolute inset-0 z-30 overflow-y-auto rounded-2xl bg-black/70 backdrop-blur-sm">
             <div className="min-h-full flex flex-col items-center justify-center py-4 px-4 text-center">
              {mode === 'quests' && won ? (
                <>
                  <div className="gx-label text-emerald-300 text-sm mb-1 tracking-wide">
                    {isLastLevel(level) ? 'MANA’NANA CLEARED ✦' : 'LEVEL CLEARED ✦'}
                  </div>
                  <div className="text-3xl font-bold text-white mb-1 tabular-nums">{score.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-400 mb-4">
                    {isLastLevel(level) ? 'you cleared every level of the ladder' : `Lv ${lvl.id} · ${goalLabel(lvl.goal)}`}
                  </div>
                  <button
                    onClick={() => { sfx.ensure(); sfx.play('shuffle'); startLevel(isLastLevel(level) ? 0 : level + 1) }}
                    className="px-5 py-2 rounded-full text-sm font-semibold tracking-wide text-[#1a1228]"
                    style={{ background: 'linear-gradient(180deg,#b6f2c8,#48b56f)' }}
                  >{isLastLevel(level) ? 'Play from Lv 1' : 'Next level →'}</button>
                </>
              ) : mode === 'quests' ? (
                <>
                  <div className="gx-label text-amber-200 text-sm mb-1">OUT OF MOVES</div>
                  <div className="text-3xl font-bold text-white mb-1 tabular-nums">{score.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-400 mb-4">Lv {lvl.id} · {goalLabel(lvl.goal)} · {questProg}/{lvl.goal.target}</div>
                  <button
                    onClick={() => { sfx.ensure(); sfx.play('shuffle'); startLevel(level) }}
                    className="px-5 py-2 rounded-full text-sm font-semibold tracking-wide text-[#1a1228]"
                    style={{ background: 'linear-gradient(180deg,#ffe09a,#f0a526)' }}
                  >Retry level</button>
                </>
              ) : (
                <>
                  <div className="gx-label text-amber-200 text-sm mb-1">OUT OF MOVES</div>
                  <div className="text-3xl font-bold text-white mb-1 tabular-nums">{score.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-400 mb-4">
                    {mode === 'daily'
                      ? `daily #${dailyNumber()} · ${score >= dailyBest ? 'today’s best!' : `best ${dailyBest.toLocaleString()}`}`
                      : (score >= best ? 'a new best!' : `best ${best.toLocaleString()}`)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { sfx.ensure(); sfx.play('shuffle'); newGame() }}
                      className="px-5 py-2 rounded-full text-sm font-semibold tracking-wide text-[#1a1228]"
                      style={{ background: 'linear-gradient(180deg,#ffe09a,#f0a526)' }}
                    >Play again</button>
                    {mode === 'daily' && (
                      <button onClick={onShare} className="px-5 py-2 rounded-full text-sm font-semibold tracking-wide text-amber-200 border border-amber-300/40 hover:border-amber-300 transition-colors">
                        {shared ? 'copied ✓' : 'share'}
                      </button>
                    )}
                  </div>
                  {mode === 'daily' && <DailyLeaderboard gameId="manana" accent="#f0a526" score={score} className="mt-3" />}
                </>
              )}
             </div>
            </div>
          )}
        </div>
        </div>

        <footer className="mt-3 shrink-0 text-center text-[10px] text-slate-600">
          drag to a neighbour · 4→Surge · 5→Prism · 7→Star · swap two specials to combo
        </footer>
      </div>
    </div>
  )
}
