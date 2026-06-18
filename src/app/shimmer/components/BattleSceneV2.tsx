'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import type { Spirit, Species } from '../spirits/spirit'
import type { SpriteAnim } from '../sprites/sprite-data'
import {
  BattleState, BattleEvent, BattleRewards,
  createBattle, createReachBattle, submitPlayerAction, submitEnemyAction,
  resolveActions, executeAction, endOfTurn, checkBattleEnd,
  calculateRewards,
} from '../engine/battle'
import { MOVE_STILL_BREATH, MOVE_SPIRIT_WARD } from '../engine/moves'
import { aiSelectAction, AITier } from '../engine/battle-ai'

// Reach encounter: free a collared spirit by reaching it. Grant the player the calming moves
// (Still-Breath / Spirit Ward) alongside two of its own, so it can choose to reach OR to force.
function setupReachBattle(player: Spirit, enemy: Spirit): BattleState {
  const st = createReachBattle(player, enemy)
  const reachMoves = [
    { move: MOVE_STILL_BREATH, ppLeft: MOVE_STILL_BREATH.pp },
    { move: MOVE_SPIRIT_WARD, ppLeft: MOVE_SPIRIT_WARD.pp },
  ]
  st.player.moves = [...reachMoves, ...st.player.moves].slice(0, 4)
  return st
}
import { drawBattleBg, BG_W, BG_H } from './BattleBackground'
import { BattlePixiRenderer } from '../engine/pixi-battle'
import { startBattleMusic, stopBattleMusic } from '../engine/music'

// ── Types ──

export interface BattleSceneV2Props {
  playerSpirit: Spirit
  enemySpirit: Spirit
  aiTier: AITier
  zoneId: string
  sprites?: Record<string, Record<string, SpriteAnim>>
  mode?: 'standard' | 'reach'
  onEnd: (outcome: 'win' | 'lose' | 'flee', rewards?: BattleRewards) => void
}

// ── Spirit Image URL Resolution ──

function getSpiritImageUrl(species: Species, element: string): string {
  // Filesystem uses 'waterbear' not 'water-bear'
  const slug = species.replace('-', '')
  if (!element || element === 'base') return `/spirits/${slug}.png`
  // Prefer _nobg (transparent background) variants
  return `/spirits/forms/${slug}_${element}_nobg.png`
}

function getSpiritDepthUrl(species: Species, element: string): string | undefined {
  const slug = species.replace('-', '')
  if (!element || element === 'base') return `/spirits/depth/${slug}_depth.png`
  return `/spirits/depth/${slug}_${element}_depth.png`
}

type UIPhase = 'intro' | 'menu' | 'moves' | 'animating' | 'rewards' | 'end'

// ── Constants ──

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

const BURST_COLORS: Record<string, number> = {
  mana: 0xd4b0e8, storm: 0x90b0e0, earth: 0xc8a870,
  water: 0x80c0c0, neutral: 0xf0d070, base: 0xf0d070,
}

// ── Event Text ──

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
      return `${name} is affected by ${ev.status}...`
    }
    case 'ENDURE': return `${ev.target === 'player' ? pName : eName} held on!`
    case 'KO': return `${ev.target === 'player' ? pName : eName} fainted!`
    case 'REACH': return ev.delta > 0 ? `You reach for the spirit beneath the collar...` : `The collar yanks it back...`
    case 'COLLAR_BREAK': return `The collar shatters — its light returns!`
    case 'BATTLE_END': {
      if (ev.outcome === 'win') return 'You won!'
      if (ev.outcome === 'lose') return 'You lost...'
      return 'Got away safely!'
    }
    case 'TEXT': return ev.message
    default: return ''
  }
}

// ── HP Bar ──

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

// ── Reach Bar (collared spirit) — fill it to break the collar, don't KO it ──

function ReachBar({ reach, max }: { reach: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (reach / max) * 100))
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-[#37e6ff]/60 font-mono tracking-wider">REACH</span>
        <div className="w-[100px] h-[5px] bg-[#0a1a22] border border-[#37e6ff]/20 rounded-sm overflow-hidden">
          <div
            className="h-full rounded-sm"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg,#1f9fc4,#37e6ff)',
              boxShadow: pct > 0 ? '0 0 6px #37e6ff80' : 'none',
              transition: 'width 0.5s ease-out',
            }}
          />
        </div>
      </div>
      <p className="text-[8px] text-[#37e6ff]/40 mt-0.5 italic">reach it — don&apos;t break it</p>
    </div>
  )
}

// ── Battle Scene V2 ──

export default function BattleSceneV2({
  playerSpirit, enemySpirit, aiTier, zoneId, sprites, mode, onEnd,
}: BattleSceneV2Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<BattlePixiRenderer | null>(null)
  const battleRef = useRef<BattleState>(
    mode === 'reach' ? setupReachBattle(playerSpirit, enemySpirit) : createBattle(playerSpirit, enemySpirit)
  )
  const processedRef = useRef(battleRef.current.events.length)

  const [uiPhase, setUIPhase] = useState<UIPhase>('intro')
  const [text, setText] = useState('')
  const [menuIdx, setMenuIdx] = useState(0)
  const [moveIdx, setMoveIdx] = useState(0)
  const [playerHP, setPlayerHP] = useState(() => battleRef.current.player.maxHp)
  const [enemyHP, setEnemyHP] = useState(() => battleRef.current.enemy.maxHp)
  const [enemyReach, setEnemyReach] = useState(() => battleRef.current.enemy.reach ?? 0)
  const [rewards, setRewards] = useState<BattleRewards | null>(null)

  const battle = battleRef.current
  const playerMoves = battle.player.moves

  // ── Init PixiJS Renderer ──

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const renderer = new BattlePixiRenderer(480, 320)
    rendererRef.current = renderer

    renderer.init(el).then(async () => {
      // Background
      const bgCanvas = document.createElement('canvas')
      bgCanvas.width = BG_W; bgCanvas.height = BG_H
      const bgCtx = bgCanvas.getContext('2d')!
      bgCtx.imageSmoothingEnabled = false
      drawBattleBg(bgCtx, BG_W, BG_H, zoneId)
      renderer.setBackground(bgCanvas)

      // Load high-res Flux concept art for battle sprites
      const pElement = playerSpirit.element === 'base' ? 'neutral' : (playerSpirit.element ?? 'neutral')
      const eElement = enemySpirit.element === 'base' ? 'neutral' : (enemySpirit.element ?? 'neutral')

      const pUrl = getSpiritImageUrl(playerSpirit.species, playerSpirit.element ?? 'base')
      const eUrl = getSpiritImageUrl(enemySpirit.species, enemySpirit.element ?? 'base')
      const pDepth = getSpiritDepthUrl(playerSpirit.species, playerSpirit.element ?? 'base')
      const eDepth = getSpiritDepthUrl(enemySpirit.species, enemySpirit.element ?? 'base')

      await Promise.all([
        renderer.setSpiritFromImage('player', pUrl, pElement, pDepth),
        renderer.setSpiritFromImage('enemy', eUrl, eElement, eDepth),
      ])
    })

    return () => {
      renderer.destroy()
      rendererRef.current = null
      if (el) el.innerHTML = ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Battle music
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

  // ── Battle Logic ──

  const consumeEvents = useCallback((): BattleEvent[] => {
    const fresh = battle.events.slice(processedRef.current)
    processedRef.current = battle.events.length
    return fresh
  }, [battle])

  const playEvents = useCallback((events: BattleEvent[], onDone: () => void) => {
    if (events.length === 0) { onDone(); return }
    setUIPhase('animating')
    const renderer = rendererRef.current
    let i = 0

    function next() {
      if (i >= events.length) { onDone(); return }
      const ev = events[i]
      setText(eventText(ev, playerSpirit.name, enemySpirit.name))
      // Reach encounter: themed end-text (freed / forced / fainted) overrides the generic win/lose line
      if (ev.type === 'BATTLE_END' && battle.mode === 'reach') {
        setText(
          battle.reachResult === 'freed' ? 'The collar breaks. The spirit chooses to stay — by trust. The leash drops, useless.'
          : battle.reachResult === 'forced' ? 'You overpowered it... but you forced it. The collar drags it back. That was not the way.'
          : 'Your spirit retreated into the mist. Steady your heart, and try again.'
        )
      }
      if (ev.type === 'REACH') setTimeout(() => setEnemyReach(ev.reach), 150)
      if (ev.type === 'COLLAR_BREAK' && renderer) { renderer.flash('enemy'); renderer.burst('enemy', 0x37e6ff, 60) }

      // Attack slide animation on move announce
      if (ev.type === 'MOVE_ANNOUNCE' && renderer) {
        renderer.attack(ev.attacker)
      }

      if (ev.type === 'DAMAGE' && renderer) {
        renderer.flash(ev.target)
        renderer.shake(ev.crit ? 14 : 7)

        // Burst color: element-tinted for super effective, muted for weak
        const color = ev.effective === 'super' ? 0xffffff
          : ev.effective === 'weak' ? 0x888888
          : 0xf0d070
        renderer.burst(ev.target, color, ev.crit ? 50 : 30)

        setTimeout(() => {
          if (ev.target === 'player') setPlayerHP(battle.player.hp)
          else setEnemyHP(battle.enemy.hp)
        }, 200)
      }

      if (ev.type === 'STATUS_TICK' && renderer) {
        setTimeout(() => {
          setPlayerHP(battle.player.hp)
          setEnemyHP(battle.enemy.hp)
        }, 200)
      }

      if (ev.type === 'KO' && renderer) {
        renderer.ko(ev.target)
      }

      i++
      const delay = (ev.type === 'DAMAGE' || ev.type === 'KO') ? 1100
        : ev.type === 'BATTLE_END' ? 1400 : 800
      setTimeout(next, delay)
    }

    next()
  }, [battle, playerSpirit.name, enemySpirit.name])

  const executeTurn = useCallback(() => {
    const b = battle
    submitEnemyAction(b, aiSelectAction(b, aiTier))
    resolveActions(b)
    const first = b.firstAttacker!
    const second = first === 'player' ? 'enemy' : 'player'
    executeAction(b, first)
    if (b[second].hp > 0 && b.outcome === 'pending') executeAction(b, second)
    if (b.outcome === 'pending') { endOfTurn(b); checkBattleEnd(b) }

    playEvents(consumeEvents(), () => {
      if (b.outcome !== 'pending') {
        if (b.outcome === 'win') { setRewards(calculateRewards(b)); setUIPhase('rewards') }
        else setUIPhase('end')
      } else {
        setText('What will you do?')
        setUIPhase('menu')
        setMenuIdx(0)
      }
    })
  }, [battle, aiTier, consumeEvents, playEvents])

  // ── Keyboard ──

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
          if (menuIdx === 0) { setMoveIdx(0); setUIPhase('moves') }
          else { submitPlayerAction(battle, { type: 'flee' }); executeTurn() }
        }
      }

      if (uiPhase === 'moves') {
        if (key === 'arrowup') { e.preventDefault(); setMoveIdx(p => p >= 2 ? p - 2 : p) }
        if (key === 'arrowdown') { e.preventDefault(); setMoveIdx(p => p + 2 < playerMoves.length ? p + 2 : p) }
        if (key === 'arrowleft') { e.preventDefault(); setMoveIdx(p => p > 0 ? p - 1 : p) }
        if (key === 'arrowright') { e.preventDefault(); setMoveIdx(p => p + 1 < playerMoves.length ? p + 1 : p) }
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

  // ── Render ──

  const pElem = playerSpirit.element === 'base' ? 'neutral' : playerSpirit.element
  const eElem = enemySpirit.element === 'base' ? 'neutral' : enemySpirit.element

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col rounded overflow-hidden"
      style={{ animation: 'battleFadeIn 0.4s ease-out' }}
    >
      <style>{`
        @keyframes battleFadeIn {
          0% { opacity: 0; }
          30% { opacity: 0; background: white; }
          50% { opacity: 1; background: white; }
          100% { opacity: 1; background: transparent; }
        }
      `}</style>

      {/* Battle arena — PixiJS canvas + HP overlays */}
      <div className="flex-1 relative overflow-hidden bg-[#060610]">
        {/* PixiJS canvas container */}
        <div ref={canvasRef} className="absolute inset-0" />

        {/* Enemy info plate (top-left) */}
        <div className="absolute z-10 bg-[#0d0d1a]/80 border border-white/[0.06] rounded-lg px-3 py-2 backdrop-blur-sm" style={{ top: 12, left: 12 }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-[12px] text-white/90">{enemySpirit.name}</span>
            <span className="text-[9px] text-white/35 font-mono">Lv{enemySpirit.level}</span>
            <span
              className="text-[7px] px-1 py-px rounded uppercase tracking-wider font-display"
              style={{ backgroundColor: ELEMENT_COLORS[eElem] + '25', color: ELEMENT_COLORS[eElem] }}
            >{eElem}</span>
          </div>
          <HPBar current={enemyHP} max={battle.enemy.maxHp} />
          {battle.enemy.collared && (
            <ReachBar reach={enemyReach} max={battle.enemy.reachMax ?? 100} />
          )}
          {battle.enemy.status && (
            <span className="text-[7px] font-mono mt-1 block tracking-wider"
              style={{ color: STATUS_COLORS[battle.enemy.status] ?? '#888' }}
            >{STATUS_LABELS[battle.enemy.status] ?? battle.enemy.status}</span>
          )}
        </div>

        {/* Player info plate (bottom-right) */}
        <div className="absolute z-10 bg-[#0d0d1a]/80 border border-white/[0.06] rounded-lg px-3 py-2 backdrop-blur-sm" style={{ bottom: 16, right: 12 }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-[12px] text-white/90">{playerSpirit.name}</span>
            <span className="text-[9px] text-white/35 font-mono">Lv{playerSpirit.level}</span>
            <span
              className="text-[7px] px-1 py-px rounded uppercase tracking-wider font-display"
              style={{ backgroundColor: ELEMENT_COLORS[pElem] + '25', color: ELEMENT_COLORS[pElem] }}
            >{pElem}</span>
          </div>
          <HPBar current={playerHP} max={battle.player.maxHp} showNumbers />
          {battle.player.status && (
            <span className="text-[7px] font-mono mt-1 block tracking-wider"
              style={{ color: STATUS_COLORS[battle.player.status] ?? '#888' }}
            >{STATUS_LABELS[battle.player.status] ?? battle.player.status}</span>
          )}
        </div>
      </div>

      {/* Bottom text/action panel */}
      <div className="px-2 pb-2 bg-[#060610]">
        <div className="bg-[#0d0d1a]/95 border border-[#d4a843]/30 rounded-lg px-4 py-3 shadow-lg shadow-black/40">

          {(uiPhase === 'intro' || uiPhase === 'animating') && (
            <p className="text-white/90 text-[13px] leading-relaxed min-h-[2.6em]">
              {text}
              {uiPhase === 'animating' && <span className="text-white/30 animate-pulse ml-1">...</span>}
            </p>
          )}

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
                  >{label}</button>
                ))}
              </div>
            </div>
          )}

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
                      >{slot.move.element}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[8px] text-white/25">
                        {slot.move.power > 0 ? `PWR ${slot.move.power}` : 'Status'}
                        {slot.move.accuracy < 100 ? ` · ${slot.move.accuracy}%` : ''}
                      </span>
                      <span className="text-[8px] text-white/25 font-mono">{slot.ppLeft}/{slot.move.pp}</span>
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
