'use client'

// The breach — the expedition arena. A 64x64 open field, the core at center,
// three trinity posts around it, the flood pouring in from every direction. In
// `placing` mode it renders the still arena and the post ranges (the only time
// the radius is visible) and takes placement clicks; in run mode it steps the
// sim, hides the ranges (low noise), and the host just watches the hold.

import { useEffect, useRef } from 'react'
import {
  BREACH_W,
  BREACH_H,
  GATE_X,
  GATE_Y,
  LEASH_R,
  ExpedState,
  RunConfig,
  RunResult,
  makeBreachMap,
  startRun,
  stepRun,
  validAnchor,
} from '../lib/expedition'
import { heartbeatLive, clearLive } from '../lib/expedmeta'
import { vecToAngle, snap8 } from '../lib/facing'
import { sfx, type SfxId } from '../lib/sfx'
import { resolveSprite } from '@/lib/arcade/sprites'

const PX = 10 // 64 * 10 = 640px arena
const TSUNAMI_MS = 2500 // wall-clock length of the wash spectacle

export interface HudSnapshot {
  wave: number
  phase: 'breaking' | 'wave'
  gate: number
  gateMax: number
  salvage: number
  kills: number
  tracks: [number, number, number]
  feed: string[]
  guards: { name: string; hp: number; maxHp: number; alive: boolean }[]
}

interface Props {
  placing?: boolean
  anchors: { x: number; y: number }[]
  onPlace?: (x: number, y: number) => void
  cfg?: RunConfig | null // non-null starts a run
  tickMs?: number
  onHud?: (s: HudSnapshot) => void
  onEnd?: (r: RunResult) => void
}

export default function Breach({ placing, anchors, onPlace, cfg, tickMs = 70, onHud, onEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<ExpedState | null>(null)
  const lastTickRef = useRef(0)
  const lastHudRef = useRef(0)
  const lastBeatRef = useRef(0)
  const placingRef = useRef(placing)
  placingRef.current = placing
  const anchorsRef = useRef(anchors)
  anchorsRef.current = anchors
  const floodImgRef = useRef<HTMLImageElement | null>(null)
  const spriteCacheRef = useRef<Record<string, HTMLImageElement | null>>({})
  const tsunamiStartRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = BREACH_W * PX
    const H = BREACH_H * PX
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)
    ctx.imageSmoothingEnabled = false // crisp pixel art

    if (!floodImgRef.current) {
      const img = new Image()
      img.src = '/nolmir/sprites/flood-01.png'
      img.onload = () => (floodImgRef.current = img)
    }

    stateRef.current = cfg ? startRun(cfg) : null
    tsunamiStartRef.current = 0

    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const s = stateRef.current
      if (s && !s.done && now - lastTickRef.current >= tickMs) {
        lastTickRef.current = now
        stepRun(s)
        // drain the tick's sound tags — the manager throttles + mutes
        if (s.sfx.length) {
          for (const tag of s.sfx) sfx.play(tag as SfxId)
          s.sfx.length = 0
        }
        if (now - lastBeatRef.current > 20_000) {
          lastBeatRef.current = now
          heartbeatLive()
        }
        if (onHud && now - lastHudRef.current > 120) {
          lastHudRef.current = now
          onHud({
            wave: s.wave,
            phase: s.phase,
            gate: Math.max(0, Math.round(s.gate)),
            gateMax: s.gateMax,
            salvage: Math.floor(s.salvage),
            kills: s.kills,
            tracks: [...s.tracks] as [number, number, number],
            feed: [...s.feed],
            guards: s.guards.map((g) => ({ name: g.name, hp: Math.max(0, g.hp), maxHp: g.maxHp, alive: g.alive })),
          })
        }
        if (s.done) {
          clearLive()
          if (s.result && onEnd) onEnd(s.result)
        }
      }
      if (s && s.tsunami && tsunamiStartRef.current === 0) tsunamiStartRef.current = now
      const tp = s && s.tsunami ? Math.min(1, (now - tsunamiStartRef.current) / TSUNAMI_MS) : 0
      draw(ctx, s, anchorsRef.current, now, placingRef.current ?? false, floodImgRef.current, tp, spriteCacheRef.current)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      clearLive()
    }
  }, [cfg, tickMs, onHud, onEnd])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!placing || !onPlace) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / PX)
    const y = Math.floor((e.clientY - rect.top) / PX)
    if (validAnchor(x, y)) onPlace(x, y)
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={`rounded-lg border border-violet-900/40 shadow-[0_0_40px_rgba(167,139,250,0.06)] ${
        placing ? 'cursor-crosshair' : ''
      }`}
    />
  )
}

const MAP = makeBreachMap() // the core body is fixed — one copy for the still render

const SEG = 36 // rim arcs for the pressure read (10deg each)
const PRESS_DMAX = 42 // gradient distance ~corner-to-core, for the proximity weight
const PRESS_REF = 4.5 // mass-weighted pressure that reads as "full breach"

// accumulate flood pressure per rim arc and paint a rising amber->red glow on
// the arcs that are massing — imminent (near-core) flood weighs heavier.
function drawPressure(ctx: CanvasRenderingContext2D, s: ExpedState, now: number) {
  const press = new Float32Array(SEG)
  for (const u of s.tide) {
    if (!u.alive) continue
    const ang = Math.atan2(u.y - GATE_Y, u.x - GATE_X)
    let seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * SEG) % SEG
    if (seg < 0) seg += SEG
    const tx = Math.max(0, Math.min(s.map.w - 1, Math.round(u.x)))
    const ty = Math.max(0, Math.min(s.map.h - 1, Math.round(u.y)))
    const d = s.map.dist[ty * s.map.w + tx]
    const prox = Math.max(0.12, 1 - (d < 0 ? PRESS_DMAX : d) / PRESS_DMAX)
    press[seg] += (u.mass || 1) * prox
  }
  const gx = (GATE_X + 0.5) * PX
  const gy = (GATE_Y + 0.5) * PX
  const rim = (BREACH_W / 2) * PX - PX * 0.5
  const pulse = 0.85 + 0.15 * Math.sin(now / 300)
  for (let i = 0; i < SEG; i++) {
    const t = Math.min(1, press[i] / PRESS_REF)
    if (t < 0.04) continue
    const a0 = (i / SEG) * Math.PI * 2 - Math.PI
    const a1 = ((i + 1) / SEG) * Math.PI * 2 - Math.PI
    // amber (cool) -> red (hot) as the arc loads
    const r = Math.round(251 - 0 * t)
    const g = Math.round(191 - 78 * t)
    const b = Math.round(36 + 0 * t)
    ctx.strokeStyle = `rgba(${r},${g},${b},${(0.12 + 0.55 * t) * pulse})`
    ctx.lineWidth = PX * (1.2 + 3.5 * t)
    ctx.beginPath()
    ctx.arc(gx, gy, rim, a0, a1)
    ctx.stroke()
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  s: ExpedState | null,
  anchors: { x: number; y: number }[],
  now: number,
  placing: boolean,
  floodImg?: HTMLImageElement | null,
  tp = 0, // tsunami progress 0..1
  spriteCache: Record<string, HTMLImageElement | null> = {},
) {
  const map = s ? s.map : MAP
  const W = BREACH_W * PX
  const H = BREACH_H * PX

  // arena floor — a faint radial so the eye falls to the core
  ctx.fillStyle = '#070a10'
  ctx.fillRect(0, 0, W, H)
  const grad = ctx.createRadialGradient((GATE_X + 0.5) * PX, (GATE_Y + 0.5) * PX, PX, (GATE_X + 0.5) * PX, (GATE_Y + 0.5) * PX, W / 2)
  grad.addColorStop(0, '#0e1526')
  grad.addColorStop(1, '#090d18')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // pressure telegraph — the rim glows where the flood is massing. ranges are
  // invisible, so this is how the host reads which seam is about to break.
  if (s) drawPressure(ctx, s, now)

  // the trinity ranges — shown ONLY while placing (invisible in combat = low noise)
  const liveAnchors = s ? s.guards.map((g) => ({ x: g.anchorX, y: g.anchorY, alive: g.alive })) : anchors.map((a) => ({ ...a, alive: true }))
  if (placing) {
    for (const a of liveAnchors) {
      ctx.strokeStyle = 'rgba(251,191,36,0.22)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc((a.x + 0.5) * PX, (a.y + 0.5) * PX, LEASH_R * PX, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  // the posts themselves always read
  for (const a of liveAnchors) {
    ctx.fillStyle = a.alive ? 'rgba(251,191,36,0.5)' : 'rgba(100,116,139,0.3)'
    ctx.fillRect(a.x * PX + 2, a.y * PX + 2, PX - 4, PX - 4)
  }

  // the core — integrity ring breathes, fills red as the flood pours in
  const gx = (GATE_X + 0.5) * PX
  const gy = (GATE_Y + 0.5) * PX
  const share = s ? Math.max(0, s.gate) / s.gateMax : 1
  const pulse = 0.75 + 0.25 * Math.sin(now / 400)
  ctx.strokeStyle = `rgba(34,211,238,${0.5 * pulse})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(gx, gy, PX * 2.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share)
  ctx.stroke()
  ctx.fillStyle = share > 0.35 ? '#22d3ee' : '#f87171'
  ctx.beginPath()
  ctx.arc(gx, gy, PX * 1.3, 0, Math.PI * 2)
  ctx.fill()

  if (!s) return

  // tracers
  for (const sh of s.shots) {
    const age = (s.tick - sh.at) / 3
    ctx.strokeStyle = `rgba(251,191,36,${0.8 * (1 - age)})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo((sh.x0 + 0.5) * PX, (sh.y0 + 0.5) * PX)
    ctx.lineTo((sh.x1 + 0.5) * PX, (sh.y1 + 0.5) * PX)
    ctx.stroke()
  }

  // the flood — fluid creatures, bigger as they pool
  const ready = floodImg && floodImg.complete && floodImg.naturalWidth > 0
  for (const u of s.tide) {
    if (!u.alive) continue
    const cx = (u.x + 0.5) * PX
    const cy = (u.y + 0.5) * PX
    // tile-span by mass class — a drift is ~2 tiles, a behemoth ~4
    const span = (u.kind === 'behemoth' ? 4 : u.kind === 'bulk' ? 3 : u.kind === 'swift' ? 1.8 : 2.2) * PX
    // frost tell — slowed flood wear a cold glaze
    if (u.slowUntil > s.tick) {
      ctx.fillStyle = 'rgba(125,211,252,0.28)'
      ctx.beginPath()
      ctx.arc(cx, cy, span * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }
    if (ready) {
      // rotate the up-facing sprite to its heading (snapped to 8 for crisp pixels)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(snap8(vecToAngle(u.fx, u.fy)))
      ctx.drawImage(floodImg!, -span / 2, -span / 2, span, span)
      ctx.restore()
    } else {
      ctx.fillStyle =
        u.kind === 'behemoth' ? '#7c3aed' : u.kind === 'bulk' ? '#a78bfa' : u.kind === 'swift' ? '#f472b6' : '#c084fc'
      ctx.beginPath()
      ctx.arc(cx, cy, span * 0.32, 0, Math.PI * 2)
      ctx.fill()
    }
    if (u.hp < u.maxHp) {
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(cx - span / 2, cy - span / 2 - 3, span, 2)
      ctx.fillStyle = '#c084fc'
      ctx.fillRect(cx - span / 2, cy - span / 2 - 3, span * (u.hp / u.maxHp), 2)
    }
  }

  // the guards — amber posts (they are the towers), or profile art when drawn
  for (const g of s.guards) {
    if (!g.alive) {
      ctx.fillStyle = 'rgba(100,116,139,0.4)'
      ctx.fillRect(g.x * PX + 3, g.y * PX + 3, PX - 6, PX - 6)
      continue
    }
    const spr = resolveSprite(spriteCache, g.sprite)
    if (spr) {
      // the shared profile sprite, drawn a touch larger than the post tile
      const span = PX + 6
      const cx = g.x * PX + PX / 2
      const cy = g.y * PX + PX / 2
      ctx.drawImage(spr, cx - span / 2, cy - span / 2, span, span)
    } else {
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(g.x * PX + 1, g.y * PX + 1, PX - 2, PX - 2)
    }
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(g.x * PX, g.y * PX - 3, PX - 1, 2)
    ctx.fillStyle = '#4ade80'
    ctx.fillRect(g.x * PX, g.y * PX - 3, (PX - 1) * Math.max(0, g.hp / g.maxHp), 2)
  }

  // the Tsunamizilla — the core fell, the wash rises and takes the board
  if (tp > 0) drawTsunami(ctx, W, H, tp, now)
}

// the wash spectacle — water surges in from every edge, the Tsunamizilla (the
// flood's apex form) rises from the deep, then full submersion + crest flash.
function drawTsunami(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, now: number) {
  const cx = W / 2
  const cy = H / 2
  const ease = p * p * (3 - 2 * p) // smoothstep

  // 1) water surges inward from all four edges, foam on the advancing crest
  const inset = ease * Math.min(W, H) * 0.62
  ctx.fillStyle = `rgba(18,46,92,${0.55 + 0.35 * ease})`
  ctx.fillRect(0, 0, W, inset)
  ctx.fillRect(0, H - inset, W, inset)
  ctx.fillRect(0, 0, inset, H)
  ctx.fillRect(W - inset, 0, inset, H)
  ctx.strokeStyle = `rgba(186,224,255,${0.5 * ease})`
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let x = 0; x <= W; x += 14) ctx.lineTo(x, inset + 3 * Math.sin(now / 120 + x * 0.05))
  ctx.stroke()
  ctx.beginPath()
  for (let x = 0; x <= W; x += 14) ctx.lineTo(x, H - inset + 3 * Math.sin(now / 120 + x * 0.05 + 2))
  ctx.stroke()

  // (the Tsunamizilla itself rises here once real apex art lands — deferred;
  //  for now the wash is water surge + submersion.)

  // 3) full submersion, a crest flash, settling ripples
  if (p > 0.62) {
    const fp = (p - 0.62) / 0.38
    ctx.fillStyle = `rgba(11,30,66,${fp})`
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = `rgba(210,235,255,${0.5 * Math.max(0, 1 - fp * 1.4)})`
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(140,200,255,${0.4 * fp * (1 - i * 0.2)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, (PX * 3 + i * 8) * (1 + fp * 2), 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}
