'use client'

// VAULT — a mote of Ather-light crosses the greying (canon: CANON/game/vault.md). The land is going
// grey, eaten into the void's tears; the mote runs the failing ground and leaps the gaps — forward
// motion is the defiance. One input: the VAULT (jump), variable (tap = short hop, hold = float higher).
// Unmake grey void-spawn from above (stomp + bounce-combo), hop the rooted corruption, gather loose
// light. Sibling to Updraft (the climb). Sim in lib/vault.ts (mechanics canon-agnostic; this is the skin).

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import { screenMaxW, deckMaxW, cabinetMaxW } from '@/lib/arcade/fit'
import {
  makeWorld,
  makeAuthoredWorld,
  authoredKey,
  pressJump,
  releaseJump,
  tick,
  diffAt,
  loadBest,
  saveBest,
  VW,
  VH,
  RUNNER_SX,
  RUNNER_W,
  RUNNER_H,
  FOE_W,
  FOE_H,
  SPIKE_W,
  SPIKE_H,
  MOTE_R,
  MAX_HEARTS,
  MAX_FUEL,
  TOP_BASE,
  TOP_MIN,
  AREAS,
  LEVELS_PER_AREA,
  levelCfg,
  levelSeed,
  loadProgress,
  saveProgress,
  levelUnlocked,
  areaUnlocked,
  areaDone,
  allAreasDone,
  ENDLESS_CFG,
  type World,
  type MovementCfg,
  type AuthoredLevel,
} from './lib/vault'
import { sfx } from './lib/sfx'
import { music } from './music'
import { vo } from './vo'
import Trail from './Trail'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'
import DailyLeaderboard from '../_components/DailyLeaderboard'
import ArcadeControls from '../_components/ArcadeControls'
import { StartButton, useStartKey } from '../_components/ArcadeStart'

// ── the greying palette ───────────────────────────────────────────────────────────
const BG_TOP = '#070a12' // night over the failing land
const BG_BOT = '#0c0f18'
const ATHER = '#7fe9ff' // the mote (you) — Ather-light, cyan core
const GOLD = '#ffd479' // the light's warm glow + loose motes
const HOT = '#eafcff'
const LAND = '#2f7d74' // surviving coloured ground (still alive)
const LAND_LIP = '#5fe0c8' // the lit edge of living ground
const GREY = '#71717a' // the grey — void-spawn + rooted corruption
const GREY_HOT = '#a7a7b0'
const ACCENT = ATHER

type Phase = 'ready' | 'playing' | 'dead' | 'won'
type Mode = 'story' | 'endless' | 'daily'

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string }

export default function VaultPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const seedRef = useRef(1)
  const voMileRef = useRef(0) // distance-milestone crossings spoken (reset each run)
  const downKeys = useRef<Set<string>>(new Set()) // tracks held jump keys (ignore auto-repeat)
  const trail = useRef<number[]>([]) // recent runner screen-y for the light-trail / jump arc
  const fx = useRef<Particle[]>([])
  const shake = useRef(0)
  const comboFx = useRef(0)
  const syncT = useRef(0)

  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [dist, setDist] = useState(0)
  const [motes, setMotes] = useState(0)
  const [hearts, setHearts] = useState(3)
  const [fuel, setFuel] = useState(100)
  const [cause, setCause] = useState<'gap' | 'grey'>('gap')
  const [muted, setMuted] = useState(false)
  const [mode, setMode] = useState<Mode>('story')
  const modeRef = useRef(mode); modeRef.current = mode
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)
  // Story mode = a level ladder. progress[a] = levels cleared in area a (persisted). The trail is two-tier
  // (areas → an area's levels); storyView flips between the trail and an actual level run. run{Area,Level}
  // track the level currently being played.
  const [progress, setProgress] = useState<number[]>(() => AREAS.map(() => 0))
  const [trailView, setTrailView] = useState<'areas' | 'levels'>('areas')
  const [selArea, setSelArea] = useState(0) // which area's levels are shown in the levels view
  const [runArea, setRunArea] = useState(0)
  const [runLevel, setRunLevel] = useState(0)
  const runAreaRef = useRef(0); runAreaRef.current = runArea
  const runLevelRef = useRef(0); runLevelRef.current = runLevel
  const [storyView, setStoryView] = useState<'trail' | 'run'>('trail')
  const storyViewRef = useRef(storyView); storyViewRef.current = storyView
  const activeCfgRef = useRef<MovementCfg>(ENDLESS_CFG) // the cfg the current run uses (for restart)
  const activeSeedRef = useRef<number | null>(null) // fixed seed for a level (null = random/daily)
  const activeAuthoredRef = useRef<AuthoredLevel | null>(null) // hand-authored layout for the current run (null = procedural)
  const authoredStoreRef = useRef<Record<string, AuthoredLevel>>({}) // published authored levels, keyed by authoredKey(a,i)

  useNoScroll()

  const boot = useCallback((cfg: MovementCfg = ENDLESS_CFG, fixedSeed: number | null = null, authored: AuthoredLevel | null = null) => {
    activeCfgRef.current = cfg
    activeSeedRef.current = fixedSeed
    activeAuthoredRef.current = authored
    let seed: number
    if (fixedSeed !== null) seed = fixedSeed // a Story level = a fixed, learnable layout
    else if (modeRef.current === 'daily') seed = dailySeed() // same crossing for everyone today
    else { seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0; seed = seedRef.current ^ (Date.now() >>> 0) }
    worldRef.current = authored ? makeAuthoredWorld(authored, cfg) : makeWorld(seed, cfg)
    downKeys.current.clear()
    trail.current = []
    fx.current = []
    shake.current = 0
    comboFx.current = 0
    voMileRef.current = 0; vo.reset() // fresh run: re-arm the commentator
    setScore(0); setDist(0); setMotes(0); setNewBest(false); setShared(false)
    setHearts(MAX_HEARTS); setFuel(MAX_FUEL)
    setPhase('ready')
  }, [])

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    music.setMuted(sfx.isMuted()); void music.ensure() // decode the bed ahead of the first press
    vo.setMuted(sfx.isMuted()); void vo.ensure(); vo.setOnSpeak(() => music.duck()) // a spoken line dips the bed
    setBest(loadBest())
    setDailyBest(loadDailyBest('vault'))
    setProgress(loadProgress())
    // pull any hand-authored ladder levels (published from /vault/dev) so a slot plays its authored layout
    fetch('/vault/dev/save', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((store) => { if (store && typeof store === 'object') authoredStoreRef.current = store as Record<string, AuthoredLevel> })
      .catch(() => {})
    return () => { music.stop(); vo.stop() } // tear audio down on leave — never follows you out
  }, [boot])

  const pickMode = (m: Mode) => {
    if (m === modeRef.current) return
    modeRef.current = m
    setMode(m)
    if (m === 'story') { setStoryView('trail'); setPhase('ready') } // show the trail; a level boots on tap
    else boot(ENDLESS_CFG) // endless + daily both run the endless crossing (daily just seeds it fixed)
  }
  const openArea = (a: number) => { if (areaUnlocked(loadProgress(), a)) { setSelArea(a); setTrailView('levels') } }
  // play a specific level (from the levels view). Locked levels can't be picked; a level = a FIXED seed.
  const playLevel = (a: number, i: number) => {
    if (!levelUnlocked(loadProgress(), a, i)) return
    setRunArea(a); runAreaRef.current = a
    setRunLevel(i); runLevelRef.current = i
    setStoryView('run')
    // an authored slot plays its hand-built layout (still uses the area's movement/look via levelCfg); else procedural.
    const authored = authoredStoreRef.current[authoredKey(a, i)] ?? null
    boot(levelCfg(a, i), levelSeed(a, i), authored) // fixed layout for this level; press Vault to begin
  }
  // the light carries on past the whole ladder → the crossing without end
  const carryOnEndless = () => {
    modeRef.current = 'endless'; setMode('endless')
    setStoryView('trail'); setTrailView('areas')
    boot(ENDLESS_CFG)
  }
  const onShare = async () => {
    if (await copyShare(dailyShare('Vault', score))) {
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

  // START launches the run (ready → playing) — the click/key IS the audio-unlock gesture. It flips the
  // world + phase WITHOUT committing a vault, so the first Vault input only jumps, never launches.
  const start = useCallback(() => {
    // on the Story trail the world sits 'ready' behind the menu — never launch from there
    if (modeRef.current === 'story' && storyViewRef.current === 'trail') return
    const w = worldRef.current
    if (!w || w.state !== 'ready') return
    sfx.ensure()
    w.state = 'playing'
    setPhase('playing'); music.start(); vo.play('start')
  }, [])

  // ── the one input: the vault (jump). Variable via hold (press → up-arc, release → cut). ──────────
  // Acts only mid-run now — START owns launching, so the first press no longer starts the game.
  const doPress = useCallback(() => {
    const w = worldRef.current
    if (!w || w.state !== 'playing') return
    pressJump(w)
  }, [])
  const doRelease = useCallback(() => {
    const w = worldRef.current
    if (w) releaseJump(w)
  }, [])

  useEffect(() => {
    const JUMP_KEYS = new Set([' ', 'arrowup', 'w', 'k'])
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (!JUMP_KEYS.has(k)) return
      e.preventDefault()
      if (downKeys.current.has(k)) return // ignore auto-repeat — only the first press is a vault
      downKeys.current.add(k)
      doPress()
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (!JUMP_KEYS.has(k)) return
      downKeys.current.delete(k)
      if (downKeys.current.size === 0) doRelease()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [doPress, doRelease])

  // ── render + sim loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0
    let last = 0
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw)
      const canvas = canvasRef.current
      const w = worldRef.current
      if (!canvas || !w) return
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0
      last = ts

      if (comboFx.current > 0) comboFx.current = Math.max(0, comboFx.current - dt)
      if (shake.current > 0) shake.current = Math.max(0, shake.current - dt)
      stepParticles(dt)

      if (w.state === 'playing') {
        tick(w, dt)
        for (const ev of w.events) {
          if (ev.type === 'jump') { if (ev.air) { sfx.play('djump'); burstAirJump(w) } else sfx.play('jump') }
          else if (ev.type === 'land') sfx.play('land')
          else if (ev.type === 'collect') { sfx.play('collect'); burstCollect(w); setFuel(w.fuel) }
          else if (ev.type === 'stomp') { sfx.play('stomp'); burstStomp(w); comboFx.current = 0.6; vo.play('stomp') }
          else if (ev.type === 'hurt') { sfx.play('death'); shake.current = 0.28; setHearts(w.hearts) } // the grey chips a heart
          else if (ev.type === 'death') {
            sfx.play('death'); shake.current = 0.4
            setScore(w.score); setDist(Math.floor(w.dist / 10)); setMotes(w.motesGot); setCause(ev.cause)
            const b = saveBest(w.score); const isBest = w.score > 0 && w.score >= b
            setBest(b); setNewBest(isBest)
            if (modeRef.current === 'daily') setDailyBest(saveDailyBest('vault', w.score))
            setPhase('dead')
            vo.play(isBest ? 'best' : 'over')
          }
          else if (ev.type === 'won') {
            // a level's goal crossed — the light carries on. Mark it cleared (unlocks the next) + bank score.
            setScore(w.score); setDist(Math.floor(w.dist / 10)); setMotes(w.motesGot)
            saveBest(w.score); setBest(loadBest())
            const a = runAreaRef.current, i = runLevelRef.current
            const prog = loadProgress()
            prog[a] = Math.max(prog[a] ?? 0, Math.min(LEVELS_PER_AREA, i + 1))
            saveProgress(prog); setProgress(prog)
            vo.play('best') // the warm "well carried" beat
            setPhase('won')
          }
        }
        // carrying milestone — a warm beat roughly every ~7-8s of running (250 was every ~1.3s, which
        // made George nonstop; the VoBank throttle thins it further).
        if (w.dist >= (voMileRef.current + 1) * 1500) { voMileRef.current++; vo.play('carrying') }
        // light-trail: remember recent screen-y (the arc when jumping)
        trail.current.unshift(w.y)
        if (trail.current.length > 14) trail.current.pop()
        syncT.current += dt
        if (syncT.current >= 0.1) { syncT.current = 0; setScore(w.score); setMotes(w.motesGot); setFuel(w.fuel); setHearts(w.hearts) }
      }
      render(canvas, w, ts, trail.current, fx.current, shake.current, comboFx.current)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // ── particle helpers ──────────────────────────────────────────────────────────
  function stepParticles(dt: number) {
    const ps = fx.current
    for (const p of ps) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; p.life -= dt }
    fx.current = ps.filter(p => p.life > 0)
  }
  function burstStomp(w: World) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      fx.current.push({ x: RUNNER_SX, y: w.y - RUNNER_H * 0.4, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 40, life: 0.4, max: 0.4, c: GREY_HOT })
    }
  }
  function burstCollect(w: World) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2
      fx.current.push({ x: RUNNER_SX, y: w.y - RUNNER_H * 0.5, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 60, life: 0.35, max: 0.35, c: GOLD })
    }
  }
  // the double-jump kick — a downward ring of ather-light puffing off the leap (the momentum carry)
  function burstAirJump(w: World) {
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.15 + (i / 7) * 0.7) // a fan aimed downward (the push-off)
      fx.current.push({ x: RUNNER_SX, y: w.y - RUNNER_H * 0.3, vx: Math.cos(a) * 70 - 30, vy: Math.sin(a) * 80, life: 0.3, max: 0.3, c: ATHER })
    }
  }

  const restart = useCallback(() => { sfx.ensure(); boot(activeCfgRef.current, activeSeedRef.current, activeAuthoredRef.current) }, [boot]) // re-run the same level/crossing
  const toTrail = () => { setStoryView('trail'); setPhase('ready') }
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); music.setMuted(m); vo.setMuted(m); setMuted(m) }

  // the Story trail is a MENU, not gameplay — render it full-height (not jammed in the landscape
  // canvas letterbox), and hide the score row + controller while it's up.
  const isStoryTrail = mode === 'story' && storyView === 'trail'

  // Enter / Space launch the run — but only on an actual level's ready screen, never while the Story
  // trail menu is up (there the world sits 'ready' behind the menu and a keypress must not launch).
  useStartKey(start, phase === 'ready' && !isStoryTrail)

  return (
    <ArcadeCabinet gameId="vault" accent={ACCENT} wall={1} maxWidth={cabinetMaxW(VW, VH)}>
      <div className="w-full flex items-center justify-between mb-3" style={{ maxWidth: screenMaxW(VW, VH) }}>
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-sm tracking-[0.35em] uppercase" style={{ color: ACCENT, textShadow: `0 0 8px ${ACCENT}80` }}>Vault</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">carry the light · leap the tears</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      {/* mode select — one clean row, never overlapping the menus (only when not mid-run) */}
      {phase !== 'playing' && (
        <div className="w-full mb-2 flex items-center justify-center gap-1.5 text-[10px] font-mono tracking-wider uppercase" style={{ maxWidth: screenMaxW(VW, VH) }}>
          {(['story', 'endless', 'daily'] as const).map((m) => (
            <button key={m} onClick={() => pickMode(m)}
              className={`px-3 py-1.5 rounded-sm border transition-colors ${mode === m ? 'text-[#070a12] bg-[#7fe9ff] border-[#7fe9ff]' : 'text-[#7fe9ff]/55 border-[#7fe9ff]/25 hover:text-[#7fe9ff]'}`}>
              {m === 'daily' ? `daily #${dailyNumber()}` : m}
            </button>
          ))}
        </div>
      )}

      {isStoryTrail ? (
        <div className="w-full" style={{ maxWidth: screenMaxW(VW, VH) }}>
          <Trail
            areas={AREAS}
            levelsPerArea={LEVELS_PER_AREA}
            progress={progress}
            view={trailView}
            selArea={selArea}
            onOpenArea={openArea}
            onBackToAreas={() => setTrailView('areas')}
            onPlayLevel={playLevel}
            onEndless={carryOnEndless}
          />
        </div>
      ) : phase === 'dead' ? (
        // result screen — its OWN full-height panel (not the landscape letterbox), so the buttons
        // are never clipped or hidden under the controller deck.
        <div className="w-full flex flex-col items-center gap-2 rounded-md border border-white/10 bg-[#070a12]/85 px-6 py-6 text-center" style={{ maxWidth: screenMaxW(VW, VH) }}>
          <div className="gx-title text-[#a7a7b0] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #71717a' }}>The grey takes the light</div>
          <div className="gx-value font-mono text-[#e8feff] text-4xl leading-none tabular-nums" style={{ textShadow: `0 0 12px ${ACCENT}80` }}>{score}</div>
          {newBest
            ? <div className="gx-label text-[10px] font-mono tracking-wider" style={{ color: ACCENT }}>✦ new best</div>
            : best > 0 && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/45 tracking-wider">best {best}</div>}
          {mode === 'story' && <div className="gx-label text-[10px] tracking-[0.2em] uppercase text-[#7fd8e6]/55">{AREAS[runArea].name} · {runLevel + 1}</div>}
          <div className="gx-label text-[10px] font-mono text-[#9fd6e0]/55 tracking-wider">
            crossed <span style={{ color: ACCENT }} className="tabular-nums">{dist}</span> · gathered <span style={{ color: GOLD }} className="tabular-nums">{motes}</span>
          </div>
          {mode === 'daily' && (
            <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/55 tracking-wider">daily #{dailyNumber()} · best {dailyBest}{score >= dailyBest && score > 0 ? ' ✦ today’s best' : ''}</div>
          )}
          <p className="text-[10px] leading-relaxed text-[#9fd6e0]/70 max-w-[260px] italic mt-0.5">{DEATH_LINE[cause]}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <button onClick={restart} className="gx-label text-[11px] text-[#070a12] hover:brightness-110 px-5 py-2 rounded-[2px]" style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}80` }}>carry it again →</button>
            {mode === 'story' && (
              <button onClick={() => { setSelArea(runArea); setTrailView('levels'); toTrail() }} className="gx-label text-[11px] text-[#7fe9ff] border border-[#7fe9ff]/40 hover:border-[#7fe9ff] px-5 py-2 rounded-[2px] transition-colors">‹ levels</button>
            )}
            {mode === 'daily' && (
              <button onClick={onShare} className="gx-label text-[11px] text-[#7fe9ff] border border-[#7fe9ff]/40 hover:border-[#7fe9ff] px-5 py-2 rounded-[2px] transition-colors">{shared ? 'copied ✓' : 'share'}</button>
            )}
          </div>
          {mode === 'daily' && <DailyLeaderboard gameId="vault" accent={ACCENT} score={score} className="mt-1.5 w-full" />}
        </div>
      ) : phase === 'won' ? (() => {
        const a = runArea, i = runLevel
        const hasNextLevel = i + 1 < LEVELS_PER_AREA
        const hasNextArea = a + 1 < AREAS.length
        const finished = !hasNextLevel && !hasNextArea // cleared the very last level of the ladder
        const title = finished ? 'Beyond the teller’s sight' : hasNextLevel ? 'The light carries on' : `${AREAS[a].name} — cleared`
        return (
        <div className="w-full flex flex-col items-center gap-2 rounded-md border border-white/10 bg-[#070a12]/85 px-6 py-6 text-center" style={{ maxWidth: screenMaxW(VW, VH) }}>
          <div className="gx-title text-lg tracking-[0.25em] uppercase" style={{ color: GOLD, textShadow: `0 0 16px ${GOLD}` }}>{title}</div>
          <div className="gx-label text-[10px] tracking-[0.2em] uppercase text-[#7fd8e6]/55">{AREAS[a].name} · {i + 1} · crossed</div>
          <div className="gx-value font-mono text-[#e8feff] text-4xl leading-none tabular-nums" style={{ textShadow: `0 0 12px ${ACCENT}80` }}>{score}</div>
          <div className="gx-label text-[10px] font-mono text-[#9fd6e0]/55 tracking-wider">crossed <span style={{ color: ACCENT }} className="tabular-nums">{dist}</span> · gathered <span style={{ color: GOLD }} className="tabular-nums">{motes}</span></div>
          <p className="text-[10px] leading-relaxed text-[#9fd6e0]/70 max-w-[270px] italic mt-0.5">{finished ? 'the tale is told to its heart. the light does not stop — it passes on, still crossing, past where the Mug can follow.' : hasNextLevel ? 'you cannot hold the light still. deeper the crossing goes.' : 'this stretch of the greying is behind you. the descent goes on.'}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {finished
              ? <button onClick={carryOnEndless} className="gx-label text-[11px] text-[#070a12] hover:brightness-110 px-5 py-2 rounded-[2px]" style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}80` }}>cross without end →</button>
              : hasNextLevel
                ? <button onClick={() => playLevel(a, i + 1)} className="gx-label text-[11px] text-[#070a12] hover:brightness-110 px-5 py-2 rounded-[2px]" style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}80` }}>next level →</button>
                : <button onClick={() => playLevel(a + 1, 0)} className="gx-label text-[11px] text-[#070a12] hover:brightness-110 px-5 py-2 rounded-[2px]" style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}80` }}>next area →</button>}
            <button onClick={() => { setSelArea(a); setTrailView('levels'); toTrail() }} className="gx-label text-[11px] text-[#7fe9ff] border border-[#7fe9ff]/40 hover:border-[#7fe9ff] px-5 py-2 rounded-[2px] transition-colors">‹ levels</button>
          </div>
        </div>
        )
      })() : (<>

      {/* HUD: hearts (the light's resilience) · crossing · fuel gauge (the carried light) · motes */}
      <div className="w-full mb-2 flex items-center gap-2 font-mono" style={{ maxWidth: screenMaxW(VW, VH) }}>
        {/* hearts */}
        <span className="flex items-center gap-0.5" aria-label={`${hearts} of ${MAX_HEARTS} light`}>
          {Array.from({ length: MAX_HEARTS }).map((_, i) => (
            <span key={i} aria-hidden className="text-[12px] leading-none transition-opacity" style={{ opacity: i < hearts ? 1 : 0.22, filter: i < hearts ? `drop-shadow(0 0 4px ${ACCENT})` : 'none' }}>✦</span>
          ))}
        </span>
        <span className="gx-label text-[10px] ml-1" style={{ color: ACCENT }}>crossing</span>
        <span className="gx-label text-[10px] text-[#e8feff] tabular-nums">{score}</span>
        {/* fuel gauge — how lit the carried light is */}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="relative h-[6px] w-[46px] overflow-hidden rounded-full border border-white/10 bg-black/40" aria-label="light fuel">
            <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150"
              style={{ width: `${Math.max(0, Math.min(100, fuel / MAX_FUEL * 100))}%`, background: fuel <= 0 ? '#71717a' : `linear-gradient(90deg, ${GOLD}, ${ACCENT})`, boxShadow: fuel > 0 ? `0 0 6px ${ACCENT}80` : 'none' }} />
          </span>
          <span className="gx-label text-[9px] tracking-wider" style={{ color: GOLD }}>light <span className="text-[#e8feff] tabular-nums">{motes}</span></span>
        </span>
      </div>

      <div className="gx-chrome relative w-full" style={{ maxWidth: screenMaxW(VW, VH), aspectRatio: `${VW} / ${VH}`, ['--gx-accent' as string]: ACCENT } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block rounded-md select-none pointer-events-none"
        />

        {phase === 'ready' && (
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/vault/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.55]" />
            <div className="absolute inset-0 -z-10 bg-[#070a12]/68" />
            {mode === 'story' ? (
              <>
                <button onClick={() => { setSelArea(runArea); setTrailView('levels'); setStoryView('trail') }} className="pointer-events-auto absolute top-2 left-2 gx-label text-[10px] text-[#7fe9ff]/60 hover:text-[#7fe9ff] tracking-wider">‹ levels</button>
                <div className="gx-label text-[9px] tracking-[0.25em] uppercase text-[#7fd8e6]/50">{AREAS[runArea].name} · level {runLevel + 1} of {LEVELS_PER_AREA}</div>
                <div className="gx-title text-2xl tracking-[0.2em] uppercase" style={{ color: ACCENT, textShadow: `0 0 18px ${ACCENT}` }}>Level {runLevel + 1}</div>
                <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[280px] italic">{AREAS[runArea].blurb}</p>
              </>
            ) : (
              <>
                <div className="gx-title text-2xl tracking-[0.3em] uppercase" style={{ color: ACCENT, textShadow: `0 0 18px ${ACCENT}` }}>Vault</div>
                <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[290px]">
                  the land is going grey. you are a mote of Ather-light running the failing ground. tap (or hold) to vault the void&apos;s tears, and unmake the grey by landing on it from above — each unmaking gives you a double-jump, so tap again to chain across them. you cannot hold the light still. carry it.
                </p>
              </>
            )}
            {mode === 'daily' && <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider">same crossing for everyone today</div>}
            <StartButton accent={ACCENT} onStart={start} hint="or press Space" />
            {best > 0 && mode !== 'story' && <div className="gx-label text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider mt-1">best <span className="text-[#e8feff] tabular-nums">{best}</span></div>}
          </div>
        )}
      </div>

      {/* the cabinet control deck — one big VAULT button under the screen (keyboard still works) */}
      <ArcadeControls
        accent={ACCENT}
        maxWidth={deckMaxW}
        buttons={[{ id: 'jump', label: 'Vault', glyph: '↟', hint: 'space', size: 'lg' }]}
        onPress={doPress}
        onRelease={doRelease}
        hint="tap = short hop · hold = float higher"
      />

      <div className="w-full flex items-center justify-center mt-3" style={{ maxWidth: screenMaxW(VW, VH) }}>
        <p className="text-[10px] text-[#7fd8e6]/35 font-mono tracking-wider">stomp grey from above → tap again to double-jump · hop the thorns</p>
      </div>
      </>)}
    </ArcadeCabinet>
  )
}

const DEATH_LINE: Record<'gap' | 'grey', string> = {
  gap: 'the light fell into the void’s tear. read the gap sooner.',
  grey: 'the light guttered out to grey. gather more of it, and keep it lit.',
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, trail: number[], fx: Particle[], shake: number, comboFx: number) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  if (canvas.width !== VW * dpr || canvas.height !== VH * dpr) {
    canvas.width = VW * dpr
    canvas.height = VH * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const t = ts / 1000
  const d = diffAt(w.dist) // the greying: grows with distance
  const camX = w.dist - RUNNER_SX
  const sx = (x: number) => x - camX

  // vertical follow-camera: keep the light ~60% down the screen when it climbs above the normal frame;
  // rest at 0 (identical to the flat game) whenever content fits the view. `camY` = world-y at the top edge.
  let worldTop = TOP_BASE
  for (const s of w.segs) if (s.top < worldTop) worldTop = s.top
  const camLo = Math.min(0, worldTop - 34) // furthest up the camera may travel (never below 0 = normal frame)
  const camTarget = Math.max(camLo, Math.min(0, w.y - VH * 0.6))
  w.camY += (camTarget - w.camY) * 0.18
  if (Math.abs(w.camY) < 0.3) w.camY = 0
  const camY = w.camY

  // screen-shake on death
  ctx.save()
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 22, (Math.random() - 0.5) * shake * 22)

  // sky — darkens/greys as the Dying gains ground
  const g = ctx.createLinearGradient(0, 0, 0, VH)
  g.addColorStop(0, BG_TOP)
  g.addColorStop(1, BG_BOT)
  ctx.fillStyle = g
  ctx.fillRect(-30, -30, VW + 60, VH + 60)
  // a creeping grey wash from the top, thicker with difficulty (the greying)
  ctx.globalAlpha = 0.04 + d * 0.16
  ctx.fillStyle = GREY
  ctx.fillRect(-30, -30, VW + 60, VH + 60)
  ctx.globalAlpha = 1

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // faint parallax motes of dead light drifting back (cheap depth)
  ctx.globalAlpha = 0.06
  ctx.fillStyle = GREY_HOT
  for (let i = 0; i < 6; i++) {
    const px = ((i * 113 - w.dist * 0.18) % (VW + 80) + VW + 80) % (VW + 80) - 40
    dot(ctx, px, 40 + ((i * 53) % 120) - camY * 0.3, 2.5) // mild vertical parallax when the camera climbs
  }
  ctx.globalAlpha = 1

  // everything from here is world-space — shift it by the vertical camera (sky above stays screen-fixed)
  ctx.save()
  ctx.translate(0, -camY)

  // ── surviving ground (coloured islands) — gaps between them are the void's tears ──
  // segs in the normal band fill to the bottom (living land); segs authored ABOVE the frame (top < TOP_MIN)
  // are floating alt-route ledges → draw them as a thin slab, not a full column to the death floor.
  for (const s of w.segs) {
    const x0 = sx(s.x0), x1 = sx(s.x1)
    if (x1 < -20 || x0 > VW + 20) continue
    const wdt = x1 - x0
    const floating = s.top < TOP_MIN
    const depth = floating ? 26 : VH - s.top + 30
    // body of living ground
    const gg = ctx.createLinearGradient(0, s.top, 0, s.top + depth)
    gg.addColorStop(0, LAND)
    gg.addColorStop(1, floating ? 'rgba(17,32,31,0)' : '#11201f')
    ctx.fillStyle = gg
    ctx.fillRect(x0, s.top, wdt, depth)
    // the lit living edge (brighter = the light still holds here)
    ctx.strokeStyle = LAND_LIP
    ctx.globalAlpha = 0.9
    ctx.shadowBlur = 8
    ctx.shadowColor = LAND_LIP
    ctx.lineWidth = 2
    seg(ctx, x0, s.top, x1, s.top)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  // ── motes — loose Ather-light (gather them) ───────────────────────────────────
  for (const m of w.motes) {
    if (m.got) continue
    const mx = sx(m.x)
    if (mx < -10 || mx > VW + 10) continue
    const bob = Math.sin(t * 4 + m.x * 0.05) * 2
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + m.x * 0.05)
    const my = m.y + bob
    // a soft living halo — the light is precious, and it reads against the grey
    ctx.globalAlpha = 0.18 + 0.16 * pulse
    ctx.fillStyle = GOLD; ctx.shadowBlur = 14; ctx.shadowColor = GOLD
    dot(ctx, mx, my, MOTE_R * 1.7)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 10
    dot(ctx, mx, my, MOTE_R * (0.92 + 0.12 * pulse))
    ctx.fillStyle = HOT
    ctx.globalAlpha = 0.85
    dot(ctx, mx, my, MOTE_R * 0.42)
    ctx.globalAlpha = 1
  }
  ctx.shadowBlur = 0

  // ── rooted corruption (spikes) — grey thorns, never stompable ─────────────────
  for (const s of w.spikes) {
    const cx = sx(s.x)
    if (cx < -16 || cx > VW + 16) continue
    drawSpike(ctx, cx, s.y, s.x) // seed by world-x → stable, varied cluster
  }

  // ── grey void-spawn (foes) — soulless, colourless; unmake from above ──────────
  for (const f of w.foes) {
    if (f.dead) continue
    const fx2 = sx(f.x)
    if (fx2 < -18 || fx2 > VW + 18) continue
    const wob = Math.sin(t * 8 + f.x * 0.1) * 1.5
    drawFoe(ctx, fx2, f.y + wob, t, f.x * 0.1) // base at f.y; bob the whole body
  }

  // ── transient FX (unmaking burst / collect spark) ─────────────────────────────
  for (const p of fx) {
    ctx.globalAlpha = Math.max(0, p.life / p.max)
    ctx.fillStyle = p.c
    dot(ctx, p.x, p.y, 2.2)
  }
  ctx.globalAlpha = 1

  // ── the mote (you) — light-trail arc + bright cyan/gold core ──────────────────
  if (w.state !== 'dead') {
    // light-trail: fading after-images along the recent arc (offset left = motion)
    for (let i = trail.length - 1; i > 0; i--) {
      ctx.globalAlpha = 0.04 + 0.12 * (1 - i / trail.length)
      ctx.fillStyle = ATHER
      dot(ctx, RUNNER_SX - i * 3.2, trail[i] - RUNNER_H * 0.5, RUNNER_W * 0.34)
    }
    ctx.globalAlpha = 1
    const cy = w.y - RUNNER_H * 0.5
    // ground-shadow under the mote (reads height/landing)
    const segUnder = w.segs.find(s => w.dist >= s.x0 && w.dist <= s.x1)
    if (segUnder) {
      ctx.globalAlpha = 0.25
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(RUNNER_SX, segUnder.top - 1, RUNNER_W * 0.5, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    // the carried light — its SIZE + BRIGHTNESS ride on fuel (bright/big when fed → small/dim when
    // starving), it greys as it runs dry, and it flickers during invuln right after a hit.
    const fuelFrac = Math.max(0, Math.min(1, w.fuel / MAX_FUEL))
    const lit = 0.6 + 0.4 * fuelFrac
    const dry = w.fuel <= 0
    ctx.globalAlpha = w.iframes > 0 && Math.floor(w.iframes * 18) % 2 === 0 ? 0.4 : 1
    // gold outer glow
    ctx.fillStyle = dry ? GREY_HOT : GOLD
    ctx.shadowBlur = 16 * lit
    ctx.shadowColor = dry ? GREY_HOT : GOLD
    dot(ctx, RUNNER_SX, cy, RUNNER_W * 0.55 * lit)
    // cyan core
    ctx.fillStyle = dry ? '#9aa6b0' : ATHER
    ctx.shadowBlur = 12 * lit
    ctx.shadowColor = dry ? '#8890a0' : ATHER
    dot(ctx, RUNNER_SX, cy, RUNNER_W * 0.42 * lit)
    // hot center
    ctx.shadowBlur = 6
    ctx.fillStyle = dry ? '#ccd2da' : HOT
    dot(ctx, RUNNER_SX, cy, RUNNER_W * 0.2 * lit)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  // ── combo readout (the unmaking chain) ────────────────────────────────────────
  if (comboFx > 0 && w.combo > 1) {
    ctx.globalAlpha = Math.min(1, comboFx / 0.4)
    ctx.fillStyle = GREY_HOT
    ctx.font = 'bold 16px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`unmaking ×${w.combo}`, RUNNER_SX, w.y - RUNNER_H - 14)
    ctx.globalAlpha = 1
    ctx.textAlign = 'start'
  }

  ctx.restore() // end vertical-camera transform
  ctx.restore() // end shake transform
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}
// stable per-entity pseudo-random from a seed (so a foe/spike looks the same every frame, no flicker)
function hash(seed: number, n: number): number {
  const s = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// ── rooted grey corruption — a cluster of jagged crystalline shards gripping the ground ──
// (was a single flat triangle). Kept inside the SPIKE_W × SPIKE_H hitbox so the read = the hazard.
function drawSpike(ctx: CanvasRenderingContext2D, cx: number, base: number, seed: number) {
  const half = SPIKE_W * 0.5
  // dark rooted mound where it grips the failing ground
  ctx.fillStyle = '#191a20'
  ctx.beginPath(); ctx.ellipse(cx, base, half * 0.95, 3.5, 0, 0, Math.PI * 2); ctx.fill()
  // three shards: tall jagged centre + two flanking, leaning off-true (corrupt, not geometric)
  const shards = [
    { off: -SPIKE_W * 0.30, hf: 0.60, wf: 0.30 },
    { off: SPIKE_W * 0.30, hf: 0.56, wf: 0.28 },
    { off: 0, hf: 0.96, wf: 0.36 },
  ]
  for (let i = 0; i < shards.length; i++) {
    const sh = shards[i]
    const x = cx + sh.off
    const h = SPIKE_H * (sh.hf * (0.85 + 0.3 * hash(seed, i)))
    const w = SPIKE_W * sh.wf
    const lean = (hash(seed, i + 5) - 0.5) * w * 0.7 // the tip leans — grey that grew wrong
    const tipX = Math.max(cx - half, Math.min(cx + half, x + lean))
    ctx.beginPath()
    ctx.moveTo(x - w / 2, base)
    ctx.lineTo(tipX, base - h)
    ctx.lineTo(x + w / 2, base)
    ctx.closePath()
    ctx.fillStyle = GREY
    ctx.fill()
    // lit cold facet down one edge + a sickly tip glint
    ctx.strokeStyle = GREY_HOT; ctx.lineWidth = 1; ctx.globalAlpha = 0.75
    ctx.beginPath(); ctx.moveTo(x - w / 2, base); ctx.lineTo(tipX, base - h); ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = GREY_HOT; ctx.shadowBlur = 5; ctx.shadowColor = GREY_HOT
    dot(ctx, tipX, base - h, 1); ctx.shadowBlur = 0
  }
}

// ── grey void-spawn — a blank, soulless thing barely cohered: unstable dome, dissolving jagged
// underside, a void-BLACK hollow where a soul would be. (was a rounded rect + two dots.) ──
function drawFoe(ctx: CanvasRenderingContext2D, cx: number, base: number, t: number, seed: number) {
  const w = FOE_W, h = FOE_H
  const top = base - h
  ctx.save()
  ctx.shadowBlur = 8; ctx.shadowColor = GREY_HOT
  ctx.fillStyle = GREY
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, base - 5)
  ctx.quadraticCurveTo(cx - w / 2, top, cx, top) // dome shoulders
  ctx.quadraticCurveTo(cx + w / 2, top, cx + w / 2, base - 5)
  const teeth = 5 // dissolving jagged underside (it's void — it doesn't hold a clean edge)
  for (let i = teeth; i >= 0; i--) {
    const fx = cx - w / 2 + w * (i / teeth)
    const dy = i % 2 === 0 ? 0 : 3 + Math.sin(t * 9 + seed + i) * 1.5
    ctx.lineTo(fx, base - dy)
  }
  ctx.closePath(); ctx.fill()
  ctx.shadowBlur = 0
  // the void-black hollow — an absence given form (the soullessness, canon)
  ctx.fillStyle = '#05060b'
  ctx.beginPath(); ctx.ellipse(cx, top + h * 0.52, w * 0.3, h * 0.32, 0, 0, Math.PI * 2); ctx.fill()
  // two dead pinpoint glints barely visible in the void
  ctx.fillStyle = '#3b4150'
  dot(ctx, cx - 3, top + h * 0.44, 1.3); dot(ctx, cx + 3, top + h * 0.44, 1.3)
  ctx.restore()
}
