'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import type { Spirit } from '../spirits/spirit'
import {
  PartyBattleState, PartyCombatant, PartyEvent, PartyAction, AIConfig, ManaConfig, KeeperArchetype,
  createPartyBattle, takeAction, currentActor, chooseAction, chooseKeeperAction,
  livingEnemiesOf,
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
  reach?: boolean   // Reach-encounter: enemy lead (idx 0) is a collared captive — free it, don't KO it
  captiveIdxs?: number[]   // stronghold reach: explicit collared-captive enemy indices (Sorrel keeps two)
  keeper?: KeeperArchetype   // a Keeper support companion joins your side (AI-driven)
  onEnd: (outcome: 'win' | 'lose', reachResult?: 'freed' | 'forced' | 'fainted' | null) => void
}

type UIPhase = 'intro' | 'selectStance' | 'selectFocus' | 'animating' | 'end'
type Stance = 'press' | 'guard' | 'focus' | 'reach'

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

function CombatantPlate({ c, hp, isActor, isTarget, shielded, onClick }: {
  c: PartyCombatant; hp: number; isActor: boolean; isTarget: boolean; shielded?: boolean; onClick?: () => void
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
        <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: c.isKeeper ? '#d4a843' : ELEMENT_COLORS[e], boxShadow: c.alive ? `0 0 5px ${c.isKeeper ? '#d4a843' : ELEMENT_COLORS[e]}` : 'none' }} />
        <span className="font-display text-[10px] text-white/85 truncate">{c.spirit.name}</span>
        <span className="text-[7px] text-white/35 font-mono shrink-0 tabular-nums">Lv{c.spirit.level}</span>
        {c.isKeeper && <span className="text-[7px] text-[#d4a843]/80 font-display tracking-wider shrink-0">✦KEEPER</span>}
        {c.alive && c.status && (
          <span className="text-[7px] font-mono px-1 rounded leading-tight shrink-0"
            style={{ color: STATUS_COLOR[c.status], backgroundColor: (STATUS_COLOR[c.status] ?? '#888') + '22' }}>
            {STATUS_LABEL[c.status] ?? c.status}
          </span>
        )}
        <span className="text-[8px] text-white/30 font-mono ml-auto tabular-nums">{Math.max(0, hp)}</span>
      </div>
      <HPBar current={hp} max={c.maxHp} />
      {c.alive && c.reachMax !== undefined && c.collared && (
        shielded ? (
          <div className="mt-1">
            <div className="h-[4px] rounded-sm bg-[#1a1208] border border-[#d4a843]/25 overflow-hidden opacity-60" />
            <p className="text-[7px] text-[#d4a843]/70 mt-0.5 italic leading-none">🔒 shielded — break the stronghold first</p>
          </div>
        ) : (
          <div className="mt-1">
            <div className="h-[4px] rounded-sm bg-[#0a1a22] border border-[#37e6ff]/20 overflow-hidden">
              <div className="h-full rounded-sm" style={{
                width: `${Math.min(100, ((c.reach ?? 0) / (c.reachMax || 100)) * 100)}%`,
                background: 'linear-gradient(90deg,#1f9fc4,#37e6ff)',
                boxShadow: (c.reach ?? 0) > 0 ? '0 0 5px #37e6ff80' : 'none',
                transition: 'width 0.4s ease-out',
              }} />
            </div>
            <p className="text-[7px] text-[#37e6ff]/50 mt-0.5 italic leading-none">reach it — don&apos;t break it</p>
          </div>
        )
      )}
    </button>
  )
}

// ── Party Battle Scene ──

export default function PartyBattleScene({
  allySpirits, enemySpirits, zoneId, ai, mana, reach, captiveIdxs, keeper, onEnd,
}: PartyBattleSceneProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<BattlePixiRenderer | null>(null)
  // captiveIdxs (a stronghold's two-on-the-leash) wins over the single-captive `reach` boolean (idx 0).
  const reachCfg = captiveIdxs?.length ? { captiveIdxs } : reach ? { captiveIdxs: [0] } : undefined
  const stateRef = useRef<PartyBattleState>(createPartyBattle(allySpirits, enemySpirits, mana, reachCfg, keeper ? { archetype: keeper } : undefined))
  const aiCfg: AIConfig = ai ?? { focusFire: true, spendMana: true }

  const [uiPhase, setUIPhase] = useState<UIPhase>('intro')
  const [text, setText] = useState('')
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [round, setRound] = useState(1)
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
        case 'KEEPER_ACT': {
          const k = nameOf(ev.keeperId), t = nameOf(ev.targetId)
          setText(
            ev.kind === 'ward' ? `${k} raises a ward over ${t}.`
            : ev.kind === 'mend' ? `${k} tends ${t}'s wounds.`
            : ev.kind === 'break' ? `${k} cracks ${t}'s guard open.`
            : ev.kind === 'channel' ? `${k} channels the Ather to you.`
            : `${k} steadies, gathering mana.`
          )
          delay = 600; break
        }
        case 'HEAL':
          if (ev.amount > 0) {
            setText(`${nameOf(ev.targetId)} recovers ${ev.amount}.`)
            if (r) { r.flashToken(ev.targetId); r.burstToken(ev.targetId, 0x50c878, 22) }
            setTimeout(refreshHP, 200)
          }
          delay = 650; break
        case 'MANA_GRANT':
          if (ev.amount > 0) setText(`+${ev.amount} mana to your pool.`)
          delay = 450; break
        case 'REACH':
          if (ev.delta > 0) setText(`You reach for the spirit beneath the collar...`)
          else setText(`The collar yanks it back...`)
          delay = ev.delta > 0 ? 600 : 450; break
        case 'REACH_SHIELDED':
          setText(`The stronghold shields the collar — break the guards first.`)
          delay = 700; break
        case 'COLLAR_BREAK':
          setText(`The collar shatters — its light returns!`)
          if (r) { r.freeCollarToken(ev.captiveId); r.flashToken(ev.captiveId); r.burstToken(ev.captiveId, 0x37e6ff, 60) }
          delay = 1100; break
        case 'BATTLE_END': {
          const rr = stateRef.current.reachResult
          if (stateRef.current.mode === 'reach') {
            setText(
              rr === 'freed' ? 'The collar breaks. It chooses to stay — by trust, not the leash.'
              : rr === 'forced' ? 'You overpowered the captive... but you forced it. That was not the way.'
              : 'Your circle is overwhelmed. Steady your hearts, and try again.'
            )
          } else {
            setText(ev.outcome === 'win' ? 'The stronghold falls. Your circle holds.' : 'Your circle is overwhelmed...')
          }
          delay = 1400; break
        }
      }
      i++
      setTimeout(next, delay)
    }
    next()
  }, [nameOf, refreshHP])

  const finish = useCallback(() => {
    rendererRef.current?.highlightToken(null)
    setResolvingId(null)
    setUIPhase('end')
  }, [])

  // ── Half-director: pick ONE stance per round, then the round auto-resolves ──

  // Prompt the Keeper (player) for this round's directive.
  const beginRound = useCallback(() => {
    const s = stateRef.current
    if (s.outcome !== 'pending') { finish(); return }
    setRound(s.round)
    setResolvingId(null)
    rendererRef.current?.highlightToken(null)
    setUIPhase('selectStance')
    setText('Give the directive.')
  }, [finish])

  // Resolve combatants of the CURRENT round one at a time; pause for the next directive at the round break.
  const resolveNext = useCallback((stance: Stance, focusId: string | undefined, roundAtStart: number) => {
    const s = stateRef.current
    if (s.outcome !== 'pending') { finish(); return }
    if (s.round !== roundAtStart) { beginRound(); return } // a new round began → new directive
    const actor = currentActor(s)
    if (!actor) { beginRound(); return }

    rendererRef.current?.highlightToken(actor.id)
    setResolvingId(actor.id)
    let action: PartyAction
    if (actor.side === 'enemy') action = chooseAction(s, actor, aiCfg)
    else if (actor.isKeeper) action = chooseKeeperAction(s, actor)
    else action = chooseAction(s, actor, { focusFire: true, spendMana: true, stance, focusTargetId: focusId })

    const before = s.events.length
    takeAction(s, action)
    playEvents(s.events.slice(before), () => {
      refreshHP()
      if (s.outcome !== 'pending') finish()
      else resolveNext(stance, focusId, roundAtStart)
    })
  }, [aiCfg, playEvents, refreshHP, finish, beginRound])

  const onStance = useCallback((stance: Stance) => {
    const s = stateRef.current
    const livingFoes = livingEnemiesOf(s, 'ally')
    if (stance === 'focus' && livingFoes.length > 1) { setUIPhase('selectFocus'); return }
    resolveNext(stance, stance === 'focus' ? livingFoes[0]?.id : undefined, s.round)
  }, [resolveNext])

  const onFocus = useCallback((enemyId: string) => {
    resolveNext('focus', enemyId, stateRef.current.round)
  }, [resolveNext])

  // ── Intro → first directive ──
  useEffect(() => {
    setText('The stronghold spirits bar the way!')
    const t = setTimeout(() => beginRound(), 1500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Esc backs out of focus-target selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && uiPhase === 'selectFocus') { e.preventDefault(); setUIPhase('selectStance') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [uiPhase])

  // ── Render ──
  const foes = livingEnemiesOf(st, 'ally')
  const pool = st.mana.ally

  return (
    <div className="absolute inset-0 z-50 flex flex-col rounded overflow-hidden" style={{ animation: 'pbFade 0.4s ease-out' }}>
      <style>{`@keyframes pbFade{0%{opacity:0}100%{opacity:1}}@keyframes pbToast{0%{opacity:0;transform:translateY(6px) scale(0.97)}100%{opacity:1;transform:none}}`}</style>

      {/* Arena */}
      <div className="flex-1 relative overflow-hidden bg-[#060610]">
        <div ref={canvasRef} className="absolute inset-0" />

        {/* Move narration — prominent center callout (the bottom panel keeps the quiet log line) */}
        {(uiPhase === 'intro' || uiPhase === 'animating') && text && (
          <div className="absolute z-20 inset-x-0 flex justify-center pointer-events-none px-4" style={{ top: '40%' }}>
            <div className="max-w-[85%] bg-black/75 border border-[#d4a843]/30 rounded-xl px-5 py-3 backdrop-blur-sm text-center shadow-lg shadow-black/50"
              style={{ animation: 'pbToast 0.22s ease-out' }}>
              <p className="text-white text-[16px] leading-snug font-display">
                {text}{uiPhase === 'animating' && <span className="text-[#d4a843]/70 animate-pulse ml-1">▸</span>}
              </p>
            </div>
          </div>
        )}

        {/* Enemy roster (top-left) */}
        <div className="absolute z-10 flex flex-col gap-1 w-[148px]" style={{ top: 10, left: 10 }}>
          {st.enemies.map(c => (
            <CombatantPlate
              key={c.id} c={c} hp={hp[c.id] ?? c.hp}
              isActor={resolvingId === c.id}
              isTarget={uiPhase === 'selectFocus' && c.alive}
              shielded={st.enemies.some(e => e.alive && e.reachMax === undefined)}
              onClick={uiPhase === 'selectFocus' && c.alive ? () => onFocus(c.id) : undefined}
            />
          ))}
        </div>

        {/* Ally roster (bottom-right) */}
        <div className="absolute z-10 flex flex-col gap-1 w-[148px]" style={{ bottom: 10, right: 10 }}>
          {st.allies.map(c => (
            <CombatantPlate
              key={c.id} c={c} hp={hp[c.id] ?? c.hp}
              isActor={resolvingId === c.id}
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

          {(uiPhase === 'intro' || uiPhase === 'animating') && (
            <p className="text-white/40 text-[11px] leading-relaxed">
              {text}{uiPhase === 'animating' && <span className="text-white/25 animate-pulse ml-1">...</span>}
            </p>
          )}

          {uiPhase === 'selectStance' && (
            <div>
              <p className="text-[10px] text-white/40 mb-1.5">Round {round} — your directive. Your spirits will follow your lead.</p>
              <div className={`grid gap-1.5 ${st.mode === 'reach' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <StanceButton name="Press" accent="#e0704a" hint="all-out — strike the weak point" onClick={() => onStance('press')} />
                <StanceButton name="Guard" accent="#6aa0c0" hint="brace — weather the blow" onClick={() => onStance('guard')} />
                <StanceButton name="Focus" accent="#c77ce0" hint="pile on one foe" onClick={() => onStance('focus')} />
                {st.mode === 'reach' && (
                  <StanceButton name="Reach" accent="#37e6ff" hint="free the collared — don't break it" onClick={() => onStance('reach')} />
                )}
              </div>
            </div>
          )}

          {uiPhase === 'selectFocus' && (
            <div>
              <p className="text-[12px] text-[#c77ce0] mb-1">Focus — point your circle at a foe.</p>
              <p className="text-[9px] text-white/30">Click an enemy&apos;s plate, or Esc to go back.</p>
            </div>
          )}

          {uiPhase === 'end' && (
            <div>
              <p className={`font-display text-[14px] mb-1 ${st.outcome === 'win' ? 'text-[#d4a843]' : 'text-red-400'}`}>
                {st.outcome === 'win' ? 'Victory' : 'Defeated'}
              </p>
              <p className="text-white/70 text-[12px]">{text}</p>
              <button onClick={() => onEnd(st.outcome === 'win' ? 'win' : 'lose', stateRef.current.reachResult)}
                className="mt-2 px-5 py-3 min-h-[48px] w-full rounded-xl bg-[#d4a843]/20 border border-[#d4a843]/40 text-[#d4a843] font-display text-[14px] hover:bg-[#d4a843]/30 active:scale-95 transition-all">
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stance directive button ──

function StanceButton({ name, hint, accent, onClick }: {
  name: string; hint: string; accent: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="text-left px-3 py-3 min-h-[60px] rounded-xl border hover:bg-white/[0.05] active:scale-95 transition-all"
      style={{ borderColor: `${accent}40`, background: `${accent}10` }}
    >
      <span className="font-display text-[16px] tracking-wide block" style={{ color: accent }}>{name}</span>
      <span className="text-[9px] text-white/40 leading-tight block mt-0.5">{hint}</span>
    </button>
  )
}
