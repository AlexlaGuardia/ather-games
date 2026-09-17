'use client'

// VORANYX — the Silt arena. You're a worm of Ather-light: steer toward your pointer,
// graze dross + seeds to grow (first seed paints you), gather motes to BOOST, and
// keep your head off everyone's body while the void ring closes in. Stop eating and
// you sublimate back to the blank thread. Vector-glow, camera-followed, world-space
// deep (no fixed backdrop — it pans). Core sim lives in lib/voranyx.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import ArcadeCabinet from '../_components/ArcadeCabinet'
import { StartButton, useStartKey } from '../_components/ArcadeStart'
import { mulberry32 } from '@/lib/arcade/rng'
import { useNoScroll } from '@/lib/arcade/useNoScroll'
import { screenMaxW, deckMaxW, cabinetMaxW } from '@/lib/arcade/fit'
import {
  makeWorld,
  player,
  steer,
  zoomFor,
  cursorHeading,
  keysHeading,
  setBoost,
  tick,
  score,
  loadBest,
  saveBest,
  bodyRadius,
  SWALLOW_BULGE,
  segCount,
  BOOST_MAX,
  MAGNET_R,
  type World,
  type Wyrm,
  type Element,
} from './lib/voranyx'
import { sfx } from './lib/sfx'
import { dailySeed, dailyNumber, loadDailyBest, saveDailyBest, dailyShare, copyShare } from '@/lib/arcade/daily'
import DailyLeaderboard from '../_components/DailyLeaderboard'
import ArcadeControls from '../_components/ArcadeControls'

const ATHER = '#37e6ff'
const HOT = '#e8feff'
const VOID_EDGE = '#c86bff'
const MAGNET_COL = '#ff5cc8' // magnet power-up (pull)
const STASIS_COL = '#ffe08a' // stasis / "infinity" power-up (no drain)
const ELEM_COLOR: Record<Element, string> = {
  mana: '#37e6ff',
  storm: '#ffd54a',
  earth: '#54ffae',
  water: '#5d9eff',
}
const BLANK = '#dfe8f0'

// world-space ambient drift specks (parallax with the camera)
const SPECKS = (() => {
  const r = mulberry32(0x511)
  return Array.from({ length: 300 }, () => ({ x: (r() - 0.5) * 6800, y: (r() - 0.5) * 6800, s: 0.5 + r() * 1.3, p: r() * 6.28 }))
})()

function taunt(mass: number): string {
  if (mass < 26) return 'Back to the blank thread. The Silt barely felt you pass.'
  if (mass < 60) return 'A fair length. The dross will remember the shape of you.'
  if (mass < 120) return 'You grew bold down there in the dark.'
  return 'A leviathan of the Silt. Something old finally looked up.'
}

export default function VoranyxPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const seedRef = useRef(1)
  const startedRef = useRef(false)
  const overRef = useRef(false)
  const camRef = useRef({ x: 0, y: 0 })
  const syncT = useRef(0)
  const keysRef = useRef<Set<string>>(new Set()) // WASD / arrows held right now (desktop)

  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(false)
  const [len, setLen] = useState(0)
  const [best, setBest] = useState(0)
  const [boostPct, setBoostPct] = useState(100)
  const [muted, setMuted] = useState(false)
  const [mode, setMode] = useState<'endless' | 'daily'>('endless')
  const modeRef = useRef(mode); modeRef.current = mode
  const [dailyBest, setDailyBest] = useState(0)
  const [shared, setShared] = useState(false)

  useNoScroll()

  const boot = useCallback(() => {
    let seed: number
    if (modeRef.current === 'daily') seed = dailySeed()
    else { seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0; seed = seedRef.current ^ (Date.now() >>> 0) }
    const w = makeWorld(seed)
    worldRef.current = w
    const p = player(w)!
    camRef.current = { x: p.x, y: p.y }
    overRef.current = false
    setOver(false)
    setShared(false)
    setLen(score(w))
  }, [])

  const pickMode = (m: 'endless' | 'daily') => {
    if (m === modeRef.current) return
    modeRef.current = m
    setMode(m)
    boot()
  }
  const onShare = async () => {
    if (await copyShare(dailyShare('Voranyx', len))) {
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    }
  }

  useEffect(() => {
    seedRef.current = Date.now() >>> 0
    boot()
    setMuted(sfx.isMuted())
    setBest(loadBest())
    setDailyBest(loadDailyBest('voranyx'))
  }, [boot])

  // ── render + sim loop ────────────────────────────────────────────────────────
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

      if (startedRef.current && !overRef.current) {
        // keyboard steer is sampled per frame (a held key keeps pulling the heading around, like the
        // stick held at its rim); the cursor and the stick steer on their own events. Last input wins.
        const kh = keysHeading(keysRef.current)
        if (kh !== null) steer(w, kh)
        const ev = tick(w, dt)
        if (ev.ate) sfx.play('eat')
        if (ev.seed) sfx.play('seed')
        if (ev.killed) sfx.play('kill')
        if (ev.died) {
          sfx.play('death')
          overRef.current = true
          if (modeRef.current === 'daily') setDailyBest(saveDailyBest('voranyx', score(w)))
          else setBest(saveBest(score(w)))
          setLen(score(w))
          setOver(true)
        }
        const p = player(w)
        if (p && p.boosting && p.boost > 0) sfx.play('boost')
        syncT.current += dt
        if (syncT.current >= 0.1) { syncT.current = 0; setLen(score(w)); if (p) setBoostPct((p.boost / BOOST_MAX) * 100) }
      }

      render(canvas, w, ts, camRef.current, startedRef.current && !overRef.current)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  // START owns launching the run (flip started WITHOUT committing a heading — the worm coasts on its
  // spawn heading so you can read the silt; your first stick input then steers). Decoupled from movement.
  const start = useCallback(() => {
    if (startedRef.current || overRef.current) return
    sfx.ensure()
    startedRef.current = true
    setStarted(true)
  }, [])
  useStartKey(start, !started && !over) // Enter / Space also start

  // DECK steering: the cabinet stick gives a -1..1 vector; steer the worm toward it past a deadzone.
  // Releasing the stick leaves the last heading (the worm keeps gliding). Steers only once launched.
  const deckStick = useCallback((x: number, y: number) => {
    if (!startedRef.current || overRef.current) return
    if (Math.hypot(x, y) > 0.2 && worldRef.current) steer(worldRef.current, Math.atan2(y, x))
  }, [])

  // dedicated boost (touch thumb + Space) — acts only once launched
  const boostOn = useCallback(() => { if (!startedRef.current || overRef.current) return; if (worldRef.current) setBoost(worldRef.current, true) }, [])
  const boostOff = useCallback(() => { if (worldRef.current) setBoost(worldRef.current, false) }, [])
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); boostOn(); return }
      const k = e.key.toLowerCase()
      if (k.startsWith('arrow')) e.preventDefault() // arrows would scroll the page under the cabinet
      keysRef.current.add(k)
    }
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') boostOff(); else keysRef.current.delete(e.key.toLowerCase()) }
    const blur = () => keysRef.current.clear() // a key released in another window never sends keyup here
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur) }
  }, [boostOn, boostOff])

  // CURSOR steering (desktop): the worm chases the mouse, measured from its HEAD on screen (the camera
  // eases, so the head is near centre, not at it). Mouse only — a phone steers from the deck stick, and
  // a thumb on the screen must not fight it. Holding the button boosts, like Space.
  const onCanvasMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'mouse' || !startedRef.current || overRef.current) return
    const w = worldRef.current, p = w && player(w)
    if (!w || !p) return
    const r = e.currentTarget.getBoundingClientRect()
    const zoom = zoomFor(p.mass), cam = camRef.current
    const head = { x: (p.x - cam.x) * zoom + r.width / 2, y: (p.y - cam.y) * zoom + r.height / 2 }
    const h = cursorHeading(head, { x: e.clientX - r.left, y: e.clientY - r.top })
    if (h !== null) steer(w, h)
  }, [])
  const onCanvasDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'mouse') return
    e.preventDefault()
    onCanvasMove(e)
    boostOn()
  }, [onCanvasMove, boostOn])
  const onCanvasUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => { if (e.pointerType === 'mouse') boostOff() }, [boostOff])

  const restart = useCallback(() => { sfx.ensure(); boot() }, [boot])
  const toggleMute = () => { sfx.ensure(); const m = !sfx.isMuted(); sfx.setMuted(m); setMuted(m) }

  const lowBoost = boostPct <= 18

  return (
    <ArcadeCabinet gameId="voranyx" accent="#37e6ff" wall={1} maxWidth={cabinetMaxW(360, 480)}>
      <div className="w-full flex items-center justify-between mb-3" style={{ maxWidth: cabinetMaxW(360, 480) }}>
        <span aria-hidden className="w-10" />
        <div className="text-center">
          <div className="gx-title text-[#37e6ff] text-sm tracking-[0.35em] uppercase" style={{ textShadow: '0 0 8px #37e6ff80' }}>Voranyx</div>
          <div className="gx-label text-[9px] text-[#7fd8e6]/40 mt-0.5">worms of the silt</div>
        </div>
        <button onClick={toggleMute} className="text-[10px] tracking-[0.2em] uppercase text-[#37e6ff]/50 hover:text-[#37e6ff] font-mono w-10 text-right">{muted ? 'son' : 'snd'}</button>
      </div>

      <div className="w-full mb-2 flex items-center gap-3 font-mono" style={{ maxWidth: cabinetMaxW(360, 480) }}>
        <span className="gx-label text-[9px] text-[#7fd8e6]/40">length</span>
        <span className="gx-value text-[#e8feff] text-lg leading-none" style={{ textShadow: '0 0 8px #37e6ff70' }}>{len}</span>
        <span className="gx-label text-[9px] text-[#7fd8e6]/30 ml-1">best {best}</span>
        <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden ml-auto max-w-[130px]">
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${boostPct}%`, background: lowBoost ? '#ff5d9e' : '#37e6ff', boxShadow: `0 0 10px ${lowBoost ? '#ff5d9e' : '#37e6ff'}` }} />
        </div>
        <span className="gx-label text-[9px] text-[#7fd8e6]/40">boost</span>
      </div>

      <div className="gx-chrome relative w-full" style={{ maxWidth: screenMaxW(360, 480), aspectRatio: '3 / 4', ['--gx-accent' as string]: '#37e6ff' } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block rounded-md touch-none cursor-crosshair"
          onPointerMove={onCanvasMove}
          onPointerDown={onCanvasDown}
          onPointerUp={onCanvasUp}
          onPointerLeave={onCanvasUp}
        />
        <div className="pointer-events-none absolute inset-0 rounded-md vx-crt" />

        {!started && (
          <div className="pointer-events-none absolute inset-0 isolate overflow-hidden flex flex-col items-center justify-center gap-3 rounded-md text-center px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/voranyx/card.webp" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.6]" />
            <div className="absolute inset-0 -z-10 bg-[#04040a]/62" />
            <div className="gx-title text-[#37e6ff] text-2xl tracking-[0.3em] uppercase" style={{ textShadow: '0 0 18px #37e6ff' }}>Voranyx</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 max-w-[290px]">
              drag the stick to steer (WASD or your cursor on desktop). graze the dross, swallow a seed to take its colour, gather motes to boost. keep eating or you fade — and never put your head into another worm.
            </p>
            {/* the finds, in the glyphs the silt draws them with — learn them here, read them out there */}
            <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[9px] font-mono tracking-wider text-[#9fd6e0]/70 -mt-1 max-w-[300px]">
              <span className="flex items-center gap-1 whitespace-nowrap"><Glyph kind="seed" /> seed · colour</span>
              <span className="flex items-center gap-1 whitespace-nowrap"><Glyph kind="mote" /> mote · boost</span>
              <span className="flex items-center gap-1 whitespace-nowrap"><Glyph kind="magnet" /> magnet · pulls</span>
              <span className="flex items-center gap-1 whitespace-nowrap"><Glyph kind="stasis" /> stasis · no fade</span>
            </div>
            <div className="gx-label pointer-events-auto flex items-center gap-1.5 mt-0.5 text-[10px]">
              {(['endless', 'daily'] as const).map((m) => (
                <button key={m} onClick={() => pickMode(m)}
                  className={`px-3 py-1.5 rounded-sm border transition-colors ${mode === m ? 'text-[#04040a] bg-[#37e6ff] border-[#37e6ff]' : 'text-[#37e6ff]/55 border-[#37e6ff]/25 hover:text-[#37e6ff]'}`}>
                  {m === 'daily' ? `daily #${dailyNumber()}` : m}
                </button>
              ))}
            </div>
            {mode === 'daily' && <div className="text-[9px] font-mono text-[#7fd8e6]/45 tracking-wider -mt-1">same silt for everyone today</div>}
            <div className="mt-1"><StartButton accent={ATHER} onStart={start} hint="then steer to dive" /></div>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 overflow-y-auto bg-[#04040a]/75 rounded-md">
           <div className="min-h-full flex flex-col items-center justify-center gap-2.5 text-center px-6 py-4">
            <div className="gx-title text-[#c86bff] text-lg tracking-[0.3em] uppercase" style={{ textShadow: '0 0 14px #c86bff' }}>Scattered</div>
            <div className="gx-value font-mono text-[#e8feff] text-3xl leading-none" style={{ textShadow: '0 0 12px #37e6ff80' }}>{len}</div>
            <p className="text-[11px] leading-relaxed text-[#9fd6e0]/80 italic max-w-[280px]">{taunt(len)}</p>
            <div className="text-[10px] font-mono text-[#7fd8e6]/50 tracking-wider">
              {mode === 'daily'
                ? <>daily #{dailyNumber()} · best {dailyBest}{len >= dailyBest && len > 0 ? ' ✦ today’s best' : ''}</>
                : <>best {best}{len >= best && len > 0 ? ' ✦ new best' : ''}</>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={restart} className="gx-label text-[11px] text-[#04040a] bg-[#37e6ff] hover:bg-[#7df0ff] px-5 py-2 rounded-[2px]" style={{ boxShadow: '0 0 18px #37e6ff80' }}>dive again →</button>
              {mode === 'daily' && (
                <button onClick={onShare} className="gx-label text-[11px] text-[#37e6ff] border border-[#37e6ff]/40 hover:border-[#37e6ff] px-5 py-2 rounded-[2px] transition-colors">{shared ? 'copied ✓' : 'share'}</button>
              )}
            </div>
            {mode === 'daily' && <DailyLeaderboard gameId="voranyx" accent="#37e6ff" score={len} className="mt-1.5" />}
           </div>
          </div>
        )}
      </div>

      {/* the cabinet control deck — steer stick + a BOOST button (screen stays a clean display) */}
      <ArcadeControls
        accent="#37e6ff"
        maxWidth={deckMaxW}
        stick
        onStick={deckStick}
        buttons={[{ id: 'boost', label: 'Boost', glyph: '»', hint: 'space', size: 'lg' }]}
        onPress={boostOn}
        onRelease={boostOff}
        hint="drag the stick to steer · hold boost to surge"
        keyLegend={[{ keys: 'W A S D / mouse', label: 'steer' }, { keys: 'Space / click', label: 'boost' }]}
      />


      <style jsx>{`
        .vx-crt {
          background:
            radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%),
            repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.13) 3px, rgba(0,0,0,0) 4px);
          animation: vx-flicker 5s infinite steps(60);
          mix-blend-mode: multiply;
        }
        @keyframes vx-flicker { 0%,97%,100% { opacity: 1; } 98% { opacity: 0.94; } 99% { opacity: 0.98; } }
      `}</style>
    </ArcadeCabinet>
  )
}

// ── rendering ───────────────────────────────────────────────────────────────────
function render(canvas: HTMLCanvasElement, w: World, ts: number, cam: { x: number; y: number }, live: boolean) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const cw = canvas.clientWidth || 440
  const ch = canvas.clientHeight || 587
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
    canvas.width = cw * dpr
    canvas.height = ch * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#04040a'
  ctx.fillRect(0, 0, cw, ch)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const t = ts / 1000

  const p = player(w)
  // camera eases toward the player head
  if (p) {
    cam.x += (p.x - cam.x) * (live ? 0.12 : 1)
    cam.y += (p.y - cam.y) * (live ? 0.12 : 1)
  }
  // zoom out harder as you grow so a mid-game worm sees room ahead of it (was 0.95 - mass*0.0019,
  // which barely backed off — 0.855 at mass 50). Steeper slope + lower floor: ~0.74 at mass 50,
  // floors at 0.5 (whole closing ring in view) from ~mass 96 up.
  const zoom = zoomFor(p?.mass)
  const toX = (wx: number) => (wx - cam.x) * zoom + cw / 2
  const toY = (wy: number) => (wy - cam.y) * zoom + ch / 2

  // ambient specks (world-space; only those near view)
  for (const s of SPECKS) {
    const sx = toX(s.x), sy = toY(s.y)
    if (sx < -10 || sx > cw + 10 || sy < -10 || sy > ch + 10) continue
    ctx.globalAlpha = 0.08 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.1 + s.p))
    ctx.fillStyle = '#7b6fa6'
    dot(ctx, sx, sy, s.s)
  }
  ctx.globalAlpha = 1

  // the void ring — the Silt's edge, closing in
  const cx = toX(0), cy = toY(0), rr = w.radius * zoom
  ctx.strokeStyle = VOID_EDGE
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 2.5
  ctx.shadowBlur = 18
  ctx.shadowColor = VOID_EDGE
  ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
  // darken beyond the ring
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.arc(cx, cy, rr, 0, Math.PI * 2, true)
  ctx.fillStyle = 'rgba(10,4,18,0.66)'
  ctx.fill('evenodd')
  ctx.restore()

  // food
  for (const f of w.food) {
    const fx = toX(f.x), fy = toY(f.y)
    if (fx < -8 || fx > cw + 8 || fy < -8 || fy > ch + 8) continue
    if (f.kind === 'seed') {
      const c = f.element ? ELEM_COLOR[f.element] : BLANK
      ctx.fillStyle = c; ctx.shadowBlur = 10; ctx.shadowColor = c
      diamond(ctx, fx, fy, 4 + 0.6 * Math.sin(t * 4 + f.x))
    } else if (f.kind === 'mote') {
      // a mote is a spark: four points, slowly turning — it reads as ENERGY, not as a fat dross
      ctx.fillStyle = ATHER; ctx.shadowBlur = 9; ctx.shadowColor = ATHER
      spark(ctx, fx, fy, 3.6 + 0.5 * Math.sin(t * 6 + f.y), t * 0.9 + f.x)
    } else if (f.kind === 'magnet' || f.kind === 'stasis') {
      // rare power-ups — the glyph says WHAT it does (horseshoe pulls, ∞ never drains), the ring says RARE
      const col = f.kind === 'magnet' ? MAGNET_COL : STASIS_COL
      const p = 0.5 + 0.5 * Math.sin(t * 5 + f.x)
      ctx.shadowBlur = 14; ctx.shadowColor = col
      if (f.kind === 'magnet') magnet(ctx, fx, fy, 6.5, col)
      else infinity(ctx, fx, fy, 7, col)
      ctx.strokeStyle = col; ctx.globalAlpha = 0.35 + 0.35 * p; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(fx, fy, 10 + p * 3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = '#9fb6c8'; ctx.shadowBlur = 5; ctx.shadowColor = '#9fb6c8'
      dot(ctx, fx, fy, 1.7)
    }
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0

  // wyrms — glowing serpents in their element colour
  for (const s of w.wyrms) {
    if (!s.alive || s.trail.length < 4) continue
    const col = s.element ? ELEM_COLOR[s.element] : BLANK
    const br = bodyRadius(s.grown) // world units — what the swallow has landed, not what you scored
    const bw = br * 2 * zoom
    const pts = slitherPoints(s, br, zoom, toX, toY, cw, ch)
    // the glow: one blurred stroke through the waved spine (blur once, not per bead)
    ctx.strokeStyle = col
    ctx.globalAlpha = s.isPlayer ? 0.55 : 0.4
    ctx.lineWidth = Math.max(2, bw)
    ctx.shadowBlur = s.isPlayer ? 14 : 9
    ctx.shadowColor = col
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    for (let i = 3; i < pts.length; i += 3) ctx.lineTo(pts[i], pts[i + 1])
    ctx.stroke()
    ctx.shadowBlur = 0
    // the scales: overlapping beads tail→head so each scale sits on the one behind it, lit from
    // the upper-left so the body reads as a tube; the boost shimmer is a hot core down the spine
    const hot = s.boosting && s.boost > 0
    ctx.globalAlpha = s.isPlayer ? 0.95 : 0.8
    for (let i = pts.length - 3; i >= 3; i -= 3) {
      const x = pts[i], y = pts[i + 1], r = pts[i + 2]
      if (x < -bw || x > cw + bw || y < -bw || y > ch + bw) continue
      ctx.fillStyle = col; dot(ctx, x, y, r)
      // a dark rim is what separates one scale from the one it overlaps — on the blank worm a white
      // highlight alone vanishes into a white body
      ctx.strokeStyle = 'rgba(4,4,10,0.4)'; ctx.lineWidth = Math.max(0.8, r * 0.14); ctx.stroke()
      ctx.fillStyle = hot ? HOT : 'rgba(255,255,255,0.3)'; dot(ctx, x - r * 0.3, y - r * 0.3, r * 0.38)
    }
    // head
    const hx = pts[0], hy = pts[1]
    ctx.globalAlpha = 1
    ctx.fillStyle = HOT; ctx.shadowBlur = 14; ctx.shadowColor = col
    dot(ctx, hx, hy, Math.max(2.5, bw * 0.62))
    // eye-glint toward heading
    ctx.fillStyle = col
    dot(ctx, hx + Math.cos(s.angle) * bw * 0.3, hy + Math.sin(s.angle) * bw * 0.3, Math.max(1, bw * 0.22))
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0

  // ── power-up feedback ─────────────────────────────────────────────────────────
  const pl = w.wyrms.find((s) => s.isPlayer && s.alive)
  if (pl) {
    if (pl.magnetT > 0) {
      // a faint pull-ring around your head showing the magnet's reach
      const hx = toX(pl.trail[0]), hy = toY(pl.trail[1])
      ctx.strokeStyle = MAGNET_COL; ctx.globalAlpha = 0.16 + 0.1 * Math.sin(t * 5)
      ctx.lineWidth = 2; ctx.setLineDash([5, 7])
      ctx.beginPath(); ctx.arc(hx, hy, MAGNET_R * zoom, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([]); ctx.globalAlpha = 1
    }
    // active-effect badges (screen-fixed, top-left) with a live countdown
    let by = 22
    const badge = (kind: 'magnet' | 'stasis', label: string, col: string) => {
      ctx.shadowBlur = 6; ctx.shadowColor = col
      if (kind === 'magnet') magnet(ctx, 18, by - 4, 5, col); else infinity(ctx, 18, by - 4, 5.5, col)
      ctx.font = '600 11px ui-monospace, monospace'; ctx.textAlign = 'left'
      ctx.fillStyle = col
      ctx.fillText(label, 30, by); ctx.shadowBlur = 0; by += 17
    }
    if (pl.stasisT > 0) badge('stasis', 'STASIS ' + Math.ceil(pl.stasisT) + 's', STASIS_COL)
    if (pl.magnetT > 0) badge('magnet', 'MAGNET ' + Math.ceil(pl.magnetT) + 's', MAGNET_COL)
  }
}

// the same four glyphs as the canvas draws, for the intro legend (SVG so they sit in the HTML overlay)
function Glyph({ kind }: { kind: 'seed' | 'mote' | 'magnet' | 'stasis' }) {
  const col = kind === 'seed' ? BLANK : kind === 'mote' ? ATHER : kind === 'magnet' ? MAGNET_COL : STASIS_COL
  return (
    <svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden="true" style={{ filter: `drop-shadow(0 0 3px ${col})` }}>
      {kind === 'seed' && <path d="M0 -6 L6 0 L0 6 L-6 0 Z" fill={col} />}
      {kind === 'mote' && <path d="M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8 Z" fill={col} />}
      {kind === 'magnet' && (
        <g fill="none" stroke={col} strokeWidth="3">
          <path d="M-4.5 -1 A4.5 4.5 0 0 1 4.5 -1 M-4.5 -1 V3.5 M4.5 -1 V3.5" />
          <path d="M-4.5 4.5 V6 M4.5 4.5 V6" stroke={HOT} strokeWidth="3.4" />
        </g>
      )}
      {kind === 'stasis' && <path d="M0 0 C2 -4 6.5 -4 6.5 0 C6.5 4 2 4 0 0 C-2 -4 -6.5 -4 -6.5 0 C-6.5 4 -2 4 0 0 Z" fill="none" stroke={col} strokeWidth="1.8" />}
    </svg>
  )
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill()
}

// ── the slither ──────────────────────────────────────────────────────────────────
// The sim's trail is a breadcrumb of head positions, so the body already follows the path you
// steered — but a polyline through it is a ribbon, not a snake. The render adds a lateral wave that
// travels BACKWARD along the body at the worm's own speed (phase = dist travelled − distance from
// the head), which is what a snake's undulation looks like from above; it grows from nothing at the
// neck (the head goes where you aim) to SLITHER_AMP of the radius, and the beads taper to the tail.
// Render-only: the sim's collision reads the unwaved trail, and the offset stays inside the body.
const SLITHER_AMP = 0.28 // of body radius
const SLITHER_LAMBDA = 9 // wavelength, in body radii
const SLITHER_NECK = 5 // radii over which the wave ramps in from the head
const BEAD_STEP = 0.55 // bead spacing, in body radii
const TAIL_TAPER = 0.3 // last fraction of the body that thins
const SWALLOW_W = (br: number) => Math.max(14, br * 2.2) // half-width of a swallow bulge, world units
function slitherPoints(
  s: { trail: number[]; dist: number; boosting: boolean; boost: number; swallows: number[] },
  br: number, zoom: number,
  toX: (x: number) => number, toY: (y: number) => number, cw: number, ch: number,
): number[] {
  // Resample the spine (live head + samples) at an EXACT arc-length step, continuous in the radius.
  // Stepping by trail INDEX lumps twice over: the head→first-sample gap breathes 0→6 units as the
  // worm moves, and a rounded index step pops between 1 and 2 as the worm grows. Walking the
  // polyline by distance makes bead spacing, the wave's phase and the taper all true arc length.
  const tr = s.trail
  const n = tr.length / 2
  // arc length of the spine
  let total = 0
  for (let i = 1; i < n; i++) total += Math.hypot(tr[i * 2] - tr[i * 2 - 2], tr[i * 2 + 1] - tr[i * 2 - 1])
  const stepLen = Math.max(1.5, BEAD_STEP * br)
  const lambda = Math.max(48, SLITHER_LAMBDA * br)
  const k = (Math.PI * 2) / lambda
  const pts: number[] = [] // world-space [x, y, d] along the spine at even d
  let seg = 1, segStart = 0
  let sx = tr[0], sy = tr[1], ex = tr[2] ?? tr[0], ey = tr[3] ?? tr[1]
  let segLen = Math.hypot(ex - sx, ey - sy)
  for (let d = 0; d <= total; d += stepLen) {
    while (seg < n - 1 && d > segStart + segLen) {
      segStart += segLen; seg++
      sx = ex; sy = ey; ex = tr[seg * 2]; ey = tr[seg * 2 + 1]
      segLen = Math.hypot(ex - sx, ey - sy)
    }
    const u = segLen > 0 ? Math.min(1, (d - segStart) / segLen) : 0
    pts.push(sx + (ex - sx) * u, sy + (ey - sy) * u, d)
  }
  const out: number[] = []
  const m = pts.length / 3
  for (let i = 0; i < m; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], d = pts[i * 3 + 2]
    // tangent from the resampled neighbours (they are evenly spaced, so this is smooth)
    const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1)
    let tx = pts[b * 3] - pts[a * 3], ty = pts[b * 3 + 1] - pts[a * 3 + 1]
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl; ty /= tl
    const ramp = Math.min(1, d / (SLITHER_NECK * br))
    const amp = SLITHER_AMP * br * ramp * Math.sin(k * (s.dist - d))
    const taper = total > 0 ? Math.min(1, 0.3 + 0.7 * ((total - d) / (TAIL_TAPER * total))) : 1
    // the swallow bulges: each meal is a lump riding down the body (a parabolic bump ~2 radii wide)
    let bulge = 0
    for (let j = 0; j < s.swallows.length; j += 2) {
      const u = Math.abs(d - s.swallows[j]) / SWALLOW_W(br)
      if (u < 1) bulge += s.swallows[j + 1] * (1 - u * u)
    }
    const swell = 1 + Math.min(0.6, SWALLOW_BULGE * bulge)
    out.push(toX(x - ty * amp), toY(y + tx * amp), Math.max(1.2, br * zoom * taper * swell))
  }
  return out
}

// ── glyphs (phosphor vector, house look) ──────────────────────────────────────────
// a four-point spark — the energy mote
function spark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4
    const rr = i % 2 === 0 ? r : r * 0.32
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath(); ctx.fill()
}
// a horseshoe magnet, open at the bottom, hot tips — it PULLS
function magnet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  ctx.strokeStyle = col; ctx.lineWidth = r * 0.55; ctx.lineCap = 'butt'
  ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.7, Math.PI, 0); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - r * 0.7, y - r * 0.15); ctx.lineTo(x - r * 0.7, y + r * 0.55)
  ctx.moveTo(x + r * 0.7, y - r * 0.15); ctx.lineTo(x + r * 0.7, y + r * 0.55)
  ctx.stroke()
  ctx.fillStyle = HOT
  ctx.fillRect(x - r * 0.7 - r * 0.275, y + r * 0.55, r * 0.55, r * 0.3)
  ctx.fillRect(x + r * 0.7 - r * 0.275, y + r * 0.55, r * 0.55, r * 0.3)
  ctx.lineCap = 'round'
}
// a lemniscate — stasis, the infinity: your points stop draining
function infinity(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, r * 0.3)
  ctx.beginPath()
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2
    const den = 1 + Math.sin(t) * Math.sin(t)
    const px = x + (r * Math.cos(t)) / den, py = y + (r * Math.sin(t) * Math.cos(t)) / den
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath(); ctx.stroke()
}
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill()
}
