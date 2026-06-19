'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import type { Spirit } from '../spirits/spirit'
import {
  PartyBattleState, PartyCombatant, PartyEvent, PartyAction, AIConfig, ManaConfig,
  createPartyBattle, takeAction, currentActor, chooseAction,
  livingEnemiesOf, manaCostFor, BASIC_STRIKE,
} from '../engine/party-battle'
import { drawBattleBg, BG_W, BG_H } from './BattleBackground'
import { BattlePixiRenderer } from '../engine/pixi-battle'
import { startBattleMusic, stopBattleMusic } from '../engine/music'

// ── Props ──

export interface PartyBattleSceneProps {
  allySpirits: Spirit[]
  enemySpirits: Spirit[]
  zoneId: string
  ai?: AIConfig
  mana?: { ally?: Partial<ManaConfig>; enemy?: Partial<ManaConfig> }
  onEnd: (outcome: 'win' | 'lose') => void
}

type UIPhase = 'intro' | 'selectMove' | 'selectTarget' | 'enemyTurn' | 'animating' | 'end'

// ── Constants ──

const ELEMENT_COLORS: Record<string, string> = {
  mana: '#9a6aaa', storm: '#4a6aaa', earth: '#8a6a3a', water: '#3a7a7a', neutral: '#666', base: '#d4a843',
}
const elem = (e?: string) => (!e || e === 'base' ? 'neutral' : e)

const STATUS_VERB: Record<string, string> = {
  ignition: 'catches fire', regen: 'steadies, mending', crystallize: 'crystallizes',
  fortify: 'fortifies', surge: 'is surging', erosion: 'starts eroding', anchor: 'is anchored',
}
const STATUS_LABEL: Record<string, string> = {
  ignition: 'BRN', regen: 'RGN', crystallize: 'CRY', fortify: 'FRT', surge: 'SRG', erosion: 'ERO', anchor: 'ANC',
}
const STATUS_COLOR: Record<string, string> = {
  ignition: '#e06030', regen: '#50c878', crystallize: '#80b0d0', fortify: '#b0a060', surge: '#d08040', erosion: '#907060', anchor: '#6070a0',
}

/** A move needs a foe target only if it damages or has a foe-directed effect. Pure self-buffs skip the picker. */
function needsTarget(move: { power: number; effect?: string; statChanges?: { target: string }[] }): boolean {
  if (move.power > 0) return true
  if (move.effect) return true
  return !!move.statChanges?.some(sc => sc.target === 'foe')
}

// ── HP Bar ──

function HPBar({ current, max, w = 88 }: { current: number; max: number; w?: number }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  const color = pct > 50 ? '#50c878' : pct > 25 ? '#d4a843' : '#c04040'
  return (
    <div className="h-[5px] rounded-sm bg-[#1a1a2a] border border-white/10 overflow-hidden" style={{ width: w }}>
      <div className="h-full rounded-sm" style={{
        width: `${pct}%`, backgroundColor: color,
        transition: 'width 0.5s ease-out, background-color 0.3s',
      }} />
    </div>
  )
}

// ── Combatant plate (one party member) ──

function CombatantPlate({ c, hp, isActor, isTarget, onClick }: {
  c: PartyCombatant; hp: number; isActor: boolean; isTarget: boolean; onClick?: () => void
}) {
  const e = elem(c.element)
  return (
    <button
      disabled={!onClick}
      onClick={onClick}
      className={`w-full text-left rounded-md px-2 py-1.5 border transition-all ${
        !c.alive ? 'opacity-30 border-transparent'
          : isTarget ? 'border-[#e0704a] bg-[#e0704a]/10'
          : isActor ? 'border-[#d4a843]/60 bg-[#d4a843]/10'
          : 'border-white/[0.06] bg-[#0d0d1a]/70'
      } ${onClick ? 'cursor-pointer hover:border-[#e0704a]/60' : 'cursor-default'}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: ELEMENT_COLORS[e], boxShadow: c.alive ? `0 0 5px ${ELEMENT_COLORS[e]}` : 'none' }} />
        <span className="font-display text-[10px] text-white/85 truncate">{c.spirit.name}</span>
        {c.alive && c.status && (
          <span className="text-[7px] font-mono px-1 rounded leading-tight shrink-0"
            style={{ color: STATUS_COLOR[c.status], backgroundColor: (STATUS_COLOR[c.status] ?? '#888') + '22' }}>
            {STATUS_LABEL[c.status] ?? c.status}
          </span>
        )}
        <span className="text-[8px] text-white/30 font-mono ml-auto tabular-nums">{Math.max(0, hp)}</span>
      </div>
      <HPBar current={hp} max={c.maxHp} />
    </button>
  )
}

// ── Party Battle Scene ──

export default function PartyBattleScene({
  allySpirits, enemySpirits, zoneId, ai, mana, onEnd,
}: PartyBattleSceneProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<BattlePixiRenderer | null>(null)
  const stateRef = useRef<PartyBattleState>(createPartyBattle(allySpirits, enemySpirits, mana))
  const aiCfg: AIConfig = ai ?? { focusFire: true, spendMana: true }

  const [uiPhase, setUIPhase] = useState<UIPhase>('intro')
  const [text, setText] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pendingMoveIdx, setPendingMoveIdx] = useState<number>(-1)
  const [targetIdx, setTargetIdx] = useState(0)
  const [hp, setHp] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    const s = stateRef.current
    ;[...s.allies, ...s.enemies].forEach(c => { m[c.id] = c.hp })
    return m
  })

  const st = stateRef.current
  const nameOf = useCallback((id: string) => [...st.allies, ...st.enemies].find(c => c.id === id)?.spirit.name ?? '?', [st])
  const refreshHP = useCallback(() => {
    const m: Record<string, number> = {}
    ;[...st.allies, ...st.enemies].forEach(c => { m[c.id] = c.hp })
    setHp(m)
  }, [st])

  // ── Init renderer ──
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const renderer = new BattlePixiRenderer(480, 320)
    rendererRef.current = renderer
    renderer.init(el).then(() => {
      const bg = document.createElement('canvas')
      bg.width = BG_W; bg.height = BG_H
      const ctx = bg.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      drawBattleBg(ctx, BG_W, BG_H, zoneId)
      renderer.setBackground(bg)
      renderer.setParty(
        st.allies.map(c => ({ id: c.id, element: elem(c.element), collared: c.collared })),
        st.enemies.map(c => ({ id: c.id, element: elem(c.element), collared: c.collared })),
      )
    })
    return () => { renderer.destroy(); rendererRef.current = null; if (el) el.innerHTML = '' }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { startBattleMusic(); return () => stopBattleMusic() }, [])

  // ── Animate a slice of events, then continue ──
  const playEvents = useCallback((events: PartyEvent[], onDone: () => void) => {
    if (events.length === 0) { onDone(); return }
    setUIPhase('animating')
    const r = rendererRef.current
    let i = 0
    function next() {
      if (i >= events.length) { onDone(); return }
      const ev = events[i]
      let delay = 700
      switch (ev.type) {
        case 'ROUND':
          setText(`— Round ${ev.round} —`); delay = 500; break
        case 'MOVE':
          setText(`${nameOf(ev.actorId)} used ${ev.moveName}!`)
          if (r) r.attackToken(ev.actorId, ev.targetId)
          delay = 650; break
        case 'DAMAGE': {
          const tag = ev.effectiveness > 1 ? "It's super effective! " : ev.effectiveness < 1 && ev.effectiveness > 0 ? 'Not very effective... ' : ''
          setText(`${tag}${ev.crit ? 'Critical! ' : ''}${ev.amount} damage to ${nameOf(ev.targetId)}.`)
          if (r) {
            r.flashToken(ev.targetId)
            r.shake(ev.crit ? 12 : 6)
            const color = ev.effectiveness > 1 ? 0xffffff : ev.effectiveness < 1 ? 0x888888 : 0xf0d070
            r.burstToken(ev.targetId, color, ev.crit ? 46 : 28)
          }
          setTimeout(refreshHP, 200)
          delay = 950; break
        }
        case 'STAT_CHANGE':
          setText(`${nameOf(ev.targetId)}'s ${ev.stat.toUpperCase()} ${ev.stages > 0 ? 'rose' : 'fell'}${Math.abs(ev.stages) > 1 ? ' sharply' : ''}.`)
          delay = 550; break
        case 'STATUS_INFLICT':
          setText(`${nameOf(ev.targetId)} ${STATUS_VERB[ev.status] ?? `is afflicted (${ev.status})`}.`)
          delay = 650; break
        case 'STATUS_TICK':
          if (ev.amount !== 0) {
            setText(`${nameOf(ev.targetId)} ${ev.amount > 0 ? `takes ${ev.amount} from ${ev.status}` : `recovers ${-ev.amount}`}.`)
            if (r) { r.flashToken(ev.targetId); if (ev.amount > 0) r.burstToken(ev.targetId, 0xe06030, 16) }
            setTimeout(refreshHP, 200)
            delay = 650
          } else { delay = 0 }
          break
        case 'MISS':
          setText(`${nameOf(ev.targetId)} slipped aside — dodged!`)
          delay = 600; break
        case 'KO':
          setText(`${nameOf(ev.targetId)} is down!`)
          if (r) r.koToken(ev.targetId)
          delay = 800; break
        case 'MANA_DRY':
          setText(`${ev.side === 'ally' ? 'Your side is' : 'The enemy is'} out of mana — a basic strike.`)
          delay = 600; break
        case 'BATTLE_END':
          setText(ev.outcome === 'win' ? 'The stronghold falls. Your circle holds.' : 'Your circle is overwhelmed...')
          delay = 1300; break
      }
      i++
      setTimeout(next, delay)
    }
    next()
  }, [nameOf, refreshHP])

  const finish = useCallback(() => {
    rendererRef.current?.highlightToken(null)
    setUIPhase('end')
  }, [])

  // ── Submit an action and pump to the next turn ──
  const doAction = useCallback((action: PartyAction) => {
    const s = stateRef.current
    const before = s.events.length
    takeAction(s, action)
    const fresh = s.events.slice(before)
    playEvents(fresh, () => {
      refreshHP()
      if (s.outcome !== 'pending') finish()
      else pump()
    })
  }, [playEvents, refreshHP, finish]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Decide whose turn it is, prompt player or run AI ──
  const pump = useCallback(() => {
    const s = stateRef.current
    if (s.outcome !== 'pending') { finish(); return }
    const actor = currentActor(s)
    if (!actor) { finish(); return }
    rendererRef.current?.highlightToken(actor.id)
    if (actor.side === 'enemy') {
      setActiveId(actor.id)
      setUIPhase('enemyTurn')
      setText(`${actor.spirit.name} moves...`)
      setTimeout(() => doAction(chooseAction(s, actor, aiCfg)), 650)
    } else {
      setActiveId(actor.id)
      setPendingMoveIdx(-1)
      setUIPhase('selectMove')
      setText(`${actor.spirit.name} — your move.`)
    }
  }, [doAction, finish, aiCfg])

  // ── Intro → first pump ──
  useEffect(() => {
    setText('The stronghold spirits bar the way!')
    const t = setTimeout(() => pump(), 1500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Esc backs out of target selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && uiPhase === 'selectTarget') {
        e.preventDefault()
        setUIPhase('selectMove')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [uiPhase])

  // ── Player action helpers ──
  const actor = activeId ? [...st.allies, ...st.enemies].find(c => c.id === activeId) : undefined
  const foes = livingEnemiesOf(st, 'ally')
  const pool = st.mana.ally

  const chooseMove = useCallback((moveIdx: number) => {
    // moveIdx -1 = Strike (always needs a foe). Self-buffs skip targeting; single foe auto-targets.
    const move = moveIdx < 0 ? { power: BASIC_STRIKE.power } : actor?.moves[moveIdx]?.move
    const wantsTarget = !move || needsTarget(move)
    if (!wantsTarget) {
      doAction({ type: 'move', actorId: activeId!, moveIdx, targetId: activeId! })
    } else if (foes.length <= 1) {
      doAction({ type: 'move', actorId: activeId!, moveIdx, targetId: foes[0]?.id ?? '' })
    } else {
      setPendingMoveIdx(moveIdx)
      setTargetIdx(0)
      setUIPhase('selectTarget')
    }
  }, [foes, activeId, actor, doAction])

  const confirmTarget = useCallback((id: string) => {
    doAction({ type: 'move', actorId: activeId!, moveIdx: pendingMoveIdx, targetId: id })
  }, [activeId, pendingMoveIdx, doAction])

  // ── Render ──
  const targetId = uiPhase === 'selectTarget' ? foes[targetIdx]?.id : undefined

  return (
    <div className="absolute inset-0 z-50 flex flex-col rounded overflow-hidden" style={{ animation: 'pbFade 0.4s ease-out' }}>
      <style>{`@keyframes pbFade{0%{opacity:0}100%{opacity:1}}`}</style>

      {/* Arena */}
      <div className="flex-1 relative overflow-hidden bg-[#060610]">
        <div ref={canvasRef} className="absolute inset-0" />

        {/* Enemy roster (top-left) */}
        <div className="absolute z-10 flex flex-col gap-1 w-[148px]" style={{ top: 10, left: 10 }}>
          {st.enemies.map(c => (
            <CombatantPlate
              key={c.id} c={c} hp={hp[c.id] ?? c.hp}
              isActor={activeId === c.id && uiPhase === 'enemyTurn'}
              isTarget={targetId === c.id}
              onClick={uiPhase === 'selectTarget' && c.alive ? () => confirmTarget(c.id) : undefined}
            />
          ))}
        </div>

        {/* Ally roster (bottom-right) */}
        <div className="absolute z-10 flex flex-col gap-1 w-[148px]" style={{ bottom: 10, right: 10 }}>
          {st.allies.map(c => (
            <CombatantPlate
              key={c.id} c={c} hp={hp[c.id] ?? c.hp}
              isActor={activeId === c.id && (uiPhase === 'selectMove' || uiPhase === 'selectTarget')}
              isTarget={false}
            />
          ))}
        </div>

        {/* Turn order strip (top, centered) */}
        <div className="absolute z-10 left-1/2 -translate-x-1/2 flex items-center gap-1" style={{ top: 10 }}>
          {st.order.map((id, idx) => {
            const c = [...st.allies, ...st.enemies].find(x => x.id === id)
            if (!c) return null
            const acted = idx < st.turnIdx
            const cur = idx === st.turnIdx
            const e = elem(c.element)
            return (
              <span key={id + idx}
                title={c.spirit.name}
                className={`w-2.5 h-2.5 rounded-full transition-all ${acted ? 'opacity-25' : ''} ${cur ? 'ring-2 ring-white/70 scale-125' : ''}`}
                style={{ backgroundColor: ELEMENT_COLORS[e], outline: c.side === 'ally' ? '1px solid rgba(80,200,120,0.5)' : '1px solid rgba(224,112,74,0.5)' }}
              />
            )
          })}
        </div>

        {/* Mana bar (bottom-left) */}
        <div className="absolute z-10 flex items-center gap-1.5" style={{ bottom: 10, left: 10 }}>
          <span className="text-[8px] text-[#9a6aaa] font-display tracking-wider">MANA</span>
          <div className="w-[80px] h-[6px] rounded-sm bg-[#1a1a2a] border border-[#9a6aaa]/25 overflow-hidden">
            <div className="h-full rounded-sm" style={{
              width: `${(pool.current / pool.max) * 100}%`,
              background: 'linear-gradient(90deg,#6a4a8a,#c77ce0)',
              boxShadow: '0 0 5px #9a6aaa80', transition: 'width 0.4s ease-out',
            }} />
          </div>
          <span className="text-[8px] text-white/40 font-mono tabular-nums">{pool.current}/{pool.max}</span>
        </div>
      </div>

      {/* Action panel */}
      <div className="px-2 pb-2 bg-[#060610]">
        <div className="bg-[#0d0d1a]/95 border border-[#d4a843]/30 rounded-lg px-4 py-3 shadow-lg shadow-black/40 min-h-[78px]">

          {(uiPhase === 'intro' || uiPhase === 'animating' || uiPhase === 'enemyTurn') && (
            <p className="text-white/90 text-[13px] leading-relaxed">
              {text}{uiPhase === 'animating' && <span className="text-white/30 animate-pulse ml-1">...</span>}
            </p>
          )}

          {uiPhase === 'selectMove' && actor && (
            <div>
              <p className="text-[10px] text-white/40 mb-1.5">{text}</p>
              <div className="grid grid-cols-2 gap-1.5">
                <MoveButton name="Strike" element="neutral" cost={0} affordable onClick={() => chooseMove(-1)} sub="weak · free" />
                {actor.moves.map((slot, i) => {
                  const cost = manaCostFor(slot.move)
                  const affordable = cost <= pool.current
                  return (
                    <MoveButton key={slot.move.id} name={slot.move.name} element={slot.move.element}
                      cost={cost} affordable={affordable}
                      sub={slot.move.power > 0 ? `pwr ${slot.move.power}` : 'status'}
                      onClick={() => chooseMove(i)} />
                  )
                })}
                <MoveButton name="Defend" element="base" cost={0} affordable accent="#6aa0c0"
                  sub="+guard" onClick={() => doAction({ type: 'defend', actorId: activeId! })} />
              </div>
            </div>
          )}

          {uiPhase === 'selectTarget' && (
            <div>
              <p className="text-[12px] text-[#e0704a] mb-1">Choose a target — pick an enemy above.</p>
              <p className="text-[9px] text-white/30">Click a foe&apos;s plate, or Esc to go back.</p>
            </div>
          )}

          {uiPhase === 'end' && (
            <div>
              <p className={`font-display text-[14px] mb-1 ${st.outcome === 'win' ? 'text-[#d4a843]' : 'text-red-400'}`}>
                {st.outcome === 'win' ? 'Victory' : 'Defeated'}
              </p>
              <p className="text-white/70 text-[12px]">{text}</p>
              <button onClick={() => onEnd(st.outcome === 'win' ? 'win' : 'lose')}
                className="mt-2 px-4 py-1.5 rounded bg-[#d4a843]/20 border border-[#d4a843]/40 text-[#d4a843] font-display text-[11px] hover:bg-[#d4a843]/30 transition-all">
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Move button ──

function MoveButton({ name, element, cost, affordable, sub, accent, onClick }: {
  name: string; element: string; cost: number; affordable: boolean; sub: string; accent?: string; onClick: () => void
}) {
  const col = accent ?? ELEMENT_COLORS[element] ?? '#888'
  return (
    <button onClick={onClick}
      className={`text-left px-2.5 py-1.5 rounded border transition-all ${
        affordable ? 'border-white/[0.06] hover:border-[#d4a843]/40 hover:bg-[#d4a843]/[0.06]' : 'border-white/[0.04] opacity-45'
      }`}
      title={affordable ? '' : 'Not enough mana — will fall back to Strike'}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] text-white/85">{name}</span>
        {cost > 0 && (
          <span className="text-[8px] font-mono tabular-nums" style={{ color: affordable ? '#c77ce0' : '#80708a' }}>{cost}◆</span>
        )}
      </div>
      <span className="text-[8px] text-white/25">{sub}</span>
      <span className="block h-[2px] mt-1 rounded-full" style={{ backgroundColor: col, opacity: 0.5 }} />
    </button>
  )
}
