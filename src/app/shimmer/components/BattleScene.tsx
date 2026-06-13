'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import type { Spirit, Species } from '../spirits/spirit'
import type { SpriteAnim } from '../sprites/sprite-data'
import { PALETTES, getEvolvedPalette } from '../sprites/palette'
import { drawSprite } from './SpriteRenderers'
import {
  BattleState, BattleEvent, BattleRewards,
  createBattle, submitPlayerAction, submitEnemyAction,
  resolveActions, executeAction, endOfTurn, checkBattleEnd,
  calculateRewards,
} from '../engine/battle'
import { aiSelectAction, AITier } from '../engine/battle-ai'
import BattleBackground from './BattleBackground'
import { startBattleMusic, stopBattleMusic } from '../engine/music'

// ============================================
// Types
// ============================================

export interface BattleLayout {
  enemyTop: number          // % from top for enemy sprite
  enemyRight: number        // px from right
  playerBottom: number      // px from bottom
  playerLeft: number        // px from left
  enemySpriteSize: number   // px width/height of enemy sprite
  playerSpriteSize: number  // px width/height of player sprite
  enemyPlateTop: number     // px from top for enemy info plate
  enemyPlateLeft: number    // px from left for enemy info plate
  playerPlateBottom: number // px from bottom for player info plate
  playerPlateRight: number  // px from right for player info plate
}

export const DEFAULT_LAYOUT: BattleLayout = {
  enemyTop: 20,
  enemyRight: 24,
  playerBottom: 16,
  playerLeft: 24,
  enemySpriteSize: 96,
  playerSpriteSize: 96,
  enemyPlateTop: 12,
  enemyPlateLeft: 12,
  playerPlateBottom: 56,
  playerPlateRight: 12,
}

interface BattleSceneProps {
  playerSpirit: Spirit
  enemySpirit: Spirit
  aiTier: AITier
  zoneId: string
  sprites: Record<string, Record<string, SpriteAnim>>
  onEnd: (outcome: 'win' | 'lose' | 'flee', rewards?: BattleRewards) => void
  layout?: BattleLayout
}

type UIPhase = 'intro' | 'menu' | 'moves' | 'animating' | 'rewards' | 'end'

const ELEMENT_COLORS: Record<string, string> = {
  mana: '#9a6aaa', storm: '#4a6aaa', earth: '#8a6a3a', water: '#3a7a7a', neutral: '#666',
}

const STATUS_COLORS: Record<string, string> = {
  ignition: '#e06030', regen: '#50c878', crystallize: '#80b0d0',
  fortify: '#b0a060', surge: '#d08040', erosion: '#907060', anchor: '#6070a0',
}

const STATUS_LABELS: Record<string, string> = {
  ignition: 'BRN', regen: 'RGN', crystallize: 'CRY',
  fortify: 'FRT', surge: 'SRG', erosion: 'ERO', anchor: 'ANC',
}

// ============================================
// Event → Text
// ============================================

function eventText(ev: BattleEvent, pName: string, eName: string): string {
  switch (ev.type) {
    case 'BATTLE_START': return `A wild ${eName} appeared!`
    case 'MOVE_ANNOUNCE': return `${ev.spiritName} used ${ev.moveName}!`
    case 'DAMAGE': {
      let msg = ev.crit ? 'Critical hit! ' : ''
      if (ev.effective === 'super') msg += "It's super effective!"
      else if (ev.effective === 'weak') msg += "Not very effective..."
      else msg += `Dealt ${ev.amount} damage!`
      return msg
    }
    case 'MISS': return 'The attack missed!'
    case 'STAT_CHANGE': {
      const name = ev.target === 'player' ? pName : eName
      const dir = ev.stages > 0 ? 'rose' : 'fell'
      const sharp = Math.abs(ev.stages) > 1 ? ' sharply' : ''
      return `${name}'s ${ev.stat.toUpperCase()}${sharp} ${dir}!`
    }
    case 'STATUS_INFLICT': {
      const name = ev.target === 'player' ? pName : eName
      const labels: Record<string, string> = {
        ignition: 'caught fire', regen: 'began regenerating', crystallize: 'was crystallized',
        fortify: 'fortified its defenses', surge: 'was surged', erosion: 'is eroding',
        anchor: 'was anchored in place',
      }
      return `${name} ${labels[ev.status] ?? `was afflicted with ${ev.status}`}!`
    }
    case 'STATUS_TICK': {
      const name = ev.target === 'player' ? pName : eName
      if (ev.status === 'regen') return `${name} recovered HP!`
      if (ev.status === 'ignition') return `${name} is burning!`
      if (ev.status === 'surge') return `${name} took surge damage!`
      if (ev.status === 'erosion') return `${name}'s body is eroding...`
      if (ev.status === 'fortify') return `${name} is fortified.`
      if (ev.status === 'anchor') return `${name} is anchored.`
      return `${name} is affected by ${ev.status}...`
    }
    case 'ENDURE': {
      const name = ev.target === 'player' ? pName : eName
      return `${name} held on!`
    }
    case 'KO': {
      const name = ev.target === 'player' ? pName : eName
      return `${name} fainted!`
    }
    case 'BATTLE_END': {
      if (ev.outcome === 'win') return 'You won!'
      if (ev.outcome === 'lose') return 'You lost...'
      return 'Got away safely!'
    }
    case 'TEXT': return ev.message
    default: return ''
  }
}

// ============================================
// BattleSprite — canvas sized to sprite data, CSS-scaled
// ============================================

function BattleSprite({ species, variant, element = 'base', facing = 'down', size = 96, sprites, flip, flash, ko }: {
  species: Species
  variant: string
  element?: string
  facing?: 'up' | 'down'
  size?: number
  sprites: Record<string, Record<string, SpriteAnim>>
  flip?: boolean
  flash?: boolean
  ko?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [frame, setFrame] = useState(0)

  // 2-frame idle animation
  useEffect(() => {
    const id = setInterval(() => setFrame(f => f === 0 ? 1 : 0), 600)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const spriteData = sprites[species]
    const battleKey = facing === 'up' ? 'battle_back' : 'battle_front'
    const legacyKey = facing === 'up' ? 'up_idle' : 'down_idle'
    const anim = spriteData?.[battleKey] ?? spriteData?.[legacyKey] ?? spriteData?.idle
    // Derive canvas size from sprite pixel data
    const ss = anim ? Math.round(Math.sqrt(anim.frames[0].length)) || 32 : 32
    canvas.width = ss
    canvas.height = ss
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, ss, ss)
    if (anim) {
      const frameIdx = Math.min(frame, anim.frames.length - 1)
      const palette = element !== 'base'
        ? getEvolvedPalette(species, element)
        : (PALETTES[species]?.[variant] ?? PALETTES[species]?.base ?? ['#888', '#aaa', '#ccc'])
      drawSprite(ctx, anim.frames[frameIdx], palette, 0, 0, 'normal', flip)
    }
  }, [species, variant, element, facing, sprites, flip, frame])

  return (
    <canvas
      ref={ref}
      className={`transition-all duration-300 ${ko ? 'opacity-0 translate-y-8' : ''}`}
      style={{
        imageRendering: 'pixelated' as const,
        width: size,
        height: size,
        filter: flash ? 'brightness(10) contrast(10)' : 'none',
        transition: flash ? 'filter 0.05s' : 'filter 0.15s, opacity 0.3s, transform 0.3s',
      }}
    />
  )
}

// ============================================
// HPBar
// ============================================

function HPBar({ current, max, showNumbers }: { current: number; max: number; showNumbers?: boolean }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color = pct > 50 ? '#50c878' : pct > 25 ? '#d4a843' : '#c04040'
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-white/30 font-mono">HP</span>
        <div className="w-[100px] h-[5px] bg-[#1a1a2a] border border-white/10 rounded-sm overflow-hidden">
          <div
            className="h-full rounded-sm"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
              transition: 'width 0.6s ease-out, background-color 0.3s',
            }}
          />
        </div>
      </div>
      {showNumbers && (
        <p className="text-[10px] text-white/50 text-right mt-0.5 font-mono tabular-nums">
          {Math.max(0, current)}/{max}
        </p>
      )}
    </div>
  )
}

// ============================================
// BattleScene — Main Component
// ============================================

export default function BattleScene({ playerSpirit, enemySpirit, aiTier, zoneId, sprites, onEnd, layout: layoutProp }: BattleSceneProps) {
  const L = layoutProp ?? DEFAULT_LAYOUT
  const battleRef = useRef<BattleState>(createBattle(playerSpirit, enemySpirit))
  const [uiPhase, setUIPhase] = useState<UIPhase>('intro')
  const [text, setText] = useState('')
  const [menuIdx, setMenuIdx] = useState(0)
  const [moveIdx, setMoveIdx] = useState(0)
  const [playerHP, setPlayerHP] = useState(() => battleRef.current.player.maxHp)
  const [enemyHP, setEnemyHP] = useState(() => battleRef.current.enemy.maxHp)
  const [playerFlash, setPlayerFlash] = useState(false)
  const [enemyFlash, setEnemyFlash] = useState(false)
  const [playerKO, setPlayerKO] = useState(false)
  const [enemyKO, setEnemyKO] = useState(false)
  const [rewards, setRewards] = useState<BattleRewards | null>(null)
  const processedRef = useRef(battleRef.current.events.length) // skip initial BATTLE_START (handled by intro text)

  const battle = battleRef.current
  const playerMoves = battle.player.moves

  // Battle music — fade in on mount, fade out + resume zone on unmount
  useEffect(() => {
    startBattleMusic()
    return () => stopBattleMusic()
  }, [])

  // Intro
  useEffect(() => {
    setText(`A wild ${enemySpirit.name} appeared!`)
    const t = setTimeout(() => {
      setText('What will you do?')
      setUIPhase('menu')
    }, 1500)
    return () => clearTimeout(t)
  }, [enemySpirit.name])

  // Consume new events from battle state
  const consumeEvents = useCallback((): BattleEvent[] => {
    const all = battle.events
    const fresh = all.slice(processedRef.current)
    processedRef.current = all.length
    return fresh
  }, [battle])

  // Play events sequentially with timing
  const playEvents = useCallback((events: BattleEvent[], onDone: () => void) => {
    if (events.length === 0) { onDone(); return }
    setUIPhase('animating')
    let i = 0

    function next() {
      if (i >= events.length) { onDone(); return }
      const ev = events[i]
      setText(eventText(ev, playerSpirit.name, enemySpirit.name))

      // Visual effects
      if (ev.type === 'DAMAGE') {
        const isPlayer = ev.target === 'player'
        if (isPlayer) {
          setPlayerFlash(true)
          setTimeout(() => setPlayerFlash(false), 150)
          setTimeout(() => setPlayerHP(battle.player.hp), 200)
        } else {
          setEnemyFlash(true)
          setTimeout(() => setEnemyFlash(false), 150)
          setTimeout(() => setEnemyHP(battle.enemy.hp), 200)
        }
      }
      if (ev.type === 'STATUS_TICK' && ev.damage) {
        setTimeout(() => {
          setPlayerHP(battle.player.hp)
          setEnemyHP(battle.enemy.hp)
        }, 200)
      }
      if (ev.type === 'KO') {
        if (ev.target === 'player') setPlayerKO(true)
        else setEnemyKO(true)
      }

      i++
      const delay = (ev.type === 'DAMAGE' || ev.type === 'KO') ? 1100
        : ev.type === 'BATTLE_END' ? 1400
        : 800
      setTimeout(next, delay)
    }

    next()
  }, [battle, playerSpirit.name, enemySpirit.name])

  // Execute a full turn
  const executeTurn = useCallback(() => {
    const b = battle

    // AI picks
    const aiAction = aiSelectAction(b, aiTier)
    submitEnemyAction(b, aiAction)

    // Resolve order
    resolveActions(b)

    // Execute actions
    const first = b.firstAttacker!
    const second = first === 'player' ? 'enemy' : 'player'
    executeAction(b, first)
    if (b[second].hp > 0 && b.outcome === 'pending') {
      executeAction(b, second)
    }

    // End-of-turn
    if (b.outcome === 'pending') {
      endOfTurn(b)
      checkBattleEnd(b)
    }

    // Play new events
    const events = consumeEvents()
    playEvents(events, () => {
      if (b.outcome !== 'pending') {
        if (b.outcome === 'win') {
          const r = calculateRewards(b)
          setRewards(r)
          setUIPhase('rewards')
        } else {
          setUIPhase('end')
        }
      } else {
        setText('What will you do?')
        setUIPhase('menu')
        setMenuIdx(0)
      }
    })
  }, [battle, aiTier, consumeEvents, playEvents])

  // Keyboard input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase()

      if (uiPhase === 'menu') {
        if (key === 'arrowleft' || key === 'arrowright') {
          e.preventDefault()
          setMenuIdx(p => p === 0 ? 1 : 0)
        }
        if (key === 'z' || key === ' ') {
          e.preventDefault()
          if (menuIdx === 0) {
            setMoveIdx(0)
            setUIPhase('moves')
          } else {
            submitPlayerAction(battle, { type: 'flee' })
            executeTurn()
          }
        }
      }

      if (uiPhase === 'moves') {
        if (key === 'arrowup') {
          e.preventDefault()
          setMoveIdx(p => p >= 2 ? p - 2 : p)
        }
        if (key === 'arrowdown') {
          e.preventDefault()
          setMoveIdx(p => p + 2 < playerMoves.length ? p + 2 : p)
        }
        if (key === 'arrowleft') {
          e.preventDefault()
          setMoveIdx(p => p > 0 ? p - 1 : p)
        }
        if (key === 'arrowright') {
          e.preventDefault()
          setMoveIdx(p => p + 1 < playerMoves.length ? p + 1 : p)
        }
        if (key === 'z' || key === ' ') {
          e.preventDefault()
          const slot = playerMoves[moveIdx]
          if (slot && slot.ppLeft > 0) {
            submitPlayerAction(battle, { type: 'fight', moveIndex: moveIdx })
            executeTurn()
          }
        }
        if (key === 'x' || key === 'escape') {
          e.preventDefault()
          setUIPhase('menu')
          setText('What will you do?')
        }
      }

      if (uiPhase === 'rewards' || uiPhase === 'end') {
        if (key === 'z' || key === ' ' || key === 'escape') {
          e.preventDefault()
          onEnd(battle.outcome as 'win' | 'lose' | 'flee', rewards ?? undefined)
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [uiPhase, menuIdx, moveIdx, battle, playerMoves, executeTurn, onEnd, rewards])

  const pElem = playerSpirit.element === 'base' ? 'neutral' : playerSpirit.element
  const eElem = enemySpirit.element === 'base' ? 'neutral' : enemySpirit.element

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col rounded overflow-hidden"
      style={{ animation: 'battleFadeIn 0.4s ease-out' }}
    >
      {/* Inline keyframes */}
      <style>{`
        @keyframes battleFadeIn {
          0% { opacity: 0; }
          30% { opacity: 0; background: white; }
          50% { opacity: 1; background: white; }
          100% { opacity: 1; background: transparent; }
        }
      `}</style>

      {/* Battle area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Background — pixel art scene */}
        <BattleBackground zoneId={zoneId} />

        {/* Enemy info plate (top-left) */}
        <div className="absolute z-10 bg-[#0d0d1a]/80 border border-white/[0.06] rounded-lg px-3 py-2" style={{ top: L.enemyPlateTop, left: L.enemyPlateLeft }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-[12px] text-white/90">{enemySpirit.name}</span>
            <span className="text-[9px] text-white/35 font-mono">Lv{enemySpirit.level}</span>
            <span
              className="text-[7px] px-1 py-px rounded uppercase tracking-wider font-display"
              style={{ backgroundColor: ELEMENT_COLORS[eElem] + '25', color: ELEMENT_COLORS[eElem] }}
            >
              {eElem}
            </span>
          </div>
          <HPBar current={enemyHP} max={battle.enemy.maxHp} />
          {/* Status */}
          {battle.enemy.status && (
            <span
              className="text-[7px] font-mono mt-1 block tracking-wider"
              style={{ color: STATUS_COLORS[battle.enemy.status] ?? '#888' }}
            >
              {STATUS_LABELS[battle.enemy.status] ?? battle.enemy.status}
            </span>
          )}
        </div>

        {/* Enemy sprite (top-right) */}
        <div className="absolute z-10" style={{ top: `${L.enemyTop}%`, right: L.enemyRight }}>
          <BattleSprite
            species={enemySpirit.species}
            variant={enemySpirit.variant ?? 'base'}
            element={enemySpirit.element ?? 'base'}
            facing="down"
            size={L.enemySpriteSize}
            sprites={sprites}
            flash={enemyFlash}
            ko={enemyKO}
          />
          <div className="w-16 h-1.5 mx-auto mt-1 rounded-full bg-black/20" />
        </div>

        {/* Player sprite (bottom-left, facing up) */}
        <div className="absolute z-10" style={{ bottom: L.playerBottom, left: L.playerLeft }}>
          <BattleSprite
            species={playerSpirit.species}
            variant={playerSpirit.variant ?? 'base'}
            element={playerSpirit.element ?? 'base'}
            facing="up"
            size={L.playerSpriteSize}
            sprites={sprites}
            flip
            flash={playerFlash}
            ko={playerKO}
          />
          <div className="w-16 h-1.5 mx-auto mt-1 rounded-full bg-black/20" />
        </div>

        {/* Player info plate (bottom-right) */}
        <div className="absolute z-10 bg-[#0d0d1a]/80 border border-white/[0.06] rounded-lg px-3 py-2" style={{ bottom: L.playerPlateBottom, right: L.playerPlateRight }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-[12px] text-white/90">{playerSpirit.name}</span>
            <span className="text-[9px] text-white/35 font-mono">Lv{playerSpirit.level}</span>
            <span
              className="text-[7px] px-1 py-px rounded uppercase tracking-wider font-display"
              style={{ backgroundColor: ELEMENT_COLORS[pElem] + '25', color: ELEMENT_COLORS[pElem] }}
            >
              {pElem}
            </span>
          </div>
          <HPBar current={playerHP} max={battle.player.maxHp} showNumbers />
          {battle.player.status && (
            <span
              className="text-[7px] font-mono mt-1 block tracking-wider"
              style={{ color: STATUS_COLORS[battle.player.status] ?? '#888' }}
            >
              {STATUS_LABELS[battle.player.status] ?? battle.player.status}
            </span>
          )}
        </div>
      </div>

      {/* Bottom text/action panel */}
      <div className="px-2 pb-2 bg-[#060610]">
        <div className="bg-[#0d0d1a]/95 border border-[#d4a843]/30 rounded-lg px-4 py-3 shadow-lg shadow-black/40">

          {/* Intro / Animation text */}
          {(uiPhase === 'intro' || uiPhase === 'animating') && (
            <p className="text-white/90 text-[13px] leading-relaxed min-h-[2.6em]">
              {text}
              {uiPhase === 'animating' && <span className="text-white/30 animate-pulse ml-1">...</span>}
            </p>
          )}

          {/* Menu: Fight / Flee */}
          {uiPhase === 'menu' && (
            <div className="flex items-center justify-between min-h-[2.6em]">
              <p className="text-white/90 text-[13px]">{text}</p>
              <div className="flex gap-2">
                {['Fight', 'Flee'].map((label, i) => (
                  <button
                    key={label}
                    className={`px-4 py-1.5 rounded font-display text-[11px] transition-all ${
                      menuIdx === i
                        ? 'bg-[#d4a843]/20 text-[#d4a843] border border-[#d4a843]/40'
                        : 'text-white/40 hover:text-white/60 border border-transparent'
                    }`}
                    onClick={() => {
                      if (i === 0) { setMoveIdx(0); setUIPhase('moves') }
                      else { submitPlayerAction(battle, { type: 'flee' }); executeTurn() }
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Move selection */}
          {uiPhase === 'moves' && (
            <div>
              <div className="grid grid-cols-2 gap-1.5">
                {playerMoves.map((slot, i) => (
                  <button
                    key={slot.move.id}
                    disabled={slot.ppLeft <= 0}
                    className={`text-left px-3 py-1.5 rounded transition-all ${
                      i === moveIdx
                        ? 'bg-[#d4a843]/15 border border-[#d4a843]/40'
                        : 'hover:bg-white/[0.03] border border-white/[0.04]'
                    } ${slot.ppLeft <= 0 ? 'opacity-25 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (slot.ppLeft > 0) {
                        submitPlayerAction(battle, { type: 'fight', moveIndex: i })
                        executeTurn()
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-[11px] text-white/85">{slot.move.name}</span>
                      <span
                        className="text-[7px] px-1 py-px rounded uppercase font-display tracking-wider"
                        style={{
                          backgroundColor: ELEMENT_COLORS[slot.move.element] + '20',
                          color: ELEMENT_COLORS[slot.move.element],
                        }}
                      >
                        {slot.move.element}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[8px] text-white/25">
                        {slot.move.power > 0 ? `PWR ${slot.move.power}` : 'Status'}
                        {slot.move.accuracy < 100 ? ` · ${slot.move.accuracy}%` : ''}
                      </span>
                      <span className="text-[8px] text-white/25 font-mono">
                        {slot.ppLeft}/{slot.move.pp}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[8px] text-white/20 text-right mt-1.5">
                <span className="text-[#d4a843]/30">Z</span> Select
                <span className="text-[#d4a843]/30 ml-3">X</span> Back
              </p>
            </div>
          )}

          {/* Victory rewards */}
          {uiPhase === 'rewards' && rewards && (
            <div className="min-h-[2.6em]">
              <p className="text-[#d4a843] font-display text-[13px] mb-2">Victory!</p>
              <div className="flex gap-5 text-[11px]">
                <span className="text-white/70">+{rewards.xp} <span className="text-white/30">XP</span></span>
                <span className="text-white/70">+{rewards.gold} <span className="text-white/30">Gold</span></span>
                <span className="text-white/70">+{rewards.bondChange} <span className="text-white/30">Bond</span></span>
              </div>
              <p className="text-[8px] text-[#d4a843]/30 text-right mt-2">Space to continue</p>
            </div>
          )}

          {/* Loss / Flee end */}
          {uiPhase === 'end' && (
            <div className="min-h-[2.6em]">
              <p className="text-white/80 text-[13px]">{text}</p>
              <p className="text-[8px] text-[#d4a843]/30 text-right mt-2">Space to continue</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
