'use client'

// The terrarium — the ant-farm view. Tiny figures push into the gauntlet
// and die in interesting places. This is the AFK face of the game.
//
// Two paces: free-running (the dev editor's back-to-back loop) and
// SCHEDULED (the live page) — a match answers the beacon on wall-clock
// marks; between matches the tank shows a ghost replay of the last stand
// under a countdown. Matches are events, not noise.

import { useEffect, useRef, useState } from 'react'
import { CrucibleDoc, MatchMods, MatchResult, TILE, TEAM_COLORS, TEAM_NAMES } from '../lib/types'
import { MatchState, createMatch, frontFloor, step, runMatch } from '../lib/sim'
import { sfx, type SfxId } from '../lib/sfx'
import { docFloors } from '../lib/crucible'

const PX = 14 // screen px per tile — figures stay tiny by design

// hand-drawn constructs (Aseprite, via the dropbox). 32x32 source rendered
// tiny — distance does the heavy lifting. Falls back to the colored squares
// until the image lands.
const GUARD_SPRITE: HTMLImageElement | null =
  typeof window !== 'undefined'
    ? (() => {
        const img = new Image()
        img.src = '/nolmir/sprites/guard.png'
        return img
      })()
    : null

// the barn doors — hand-drawn shutter sheet (256x144, 16:9; the code slices
// it into left/right 128x144 halves and slides them). Placeholder steel
// renders until the art lands at this path.
const SHUTTER_SPRITE: HTMLImageElement | null =
  typeof window !== 'undefined'
    ? (() => {
        const img = new Image()
        img.src = '/nolmir/sprites/shutter.png'
        return img
      })()
    : null

const SHUTTER_MS = 700 // how long the doors take to swing

// two halves sliding in from the sides; t: 0 = open, 1 = sealed
function drawShutters(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, now: number) {
  if (t <= 0) return
  const half = (W / 2) * t
  const hasArt = SHUTTER_SPRITE?.complete && SHUTTER_SPRITE.naturalWidth > 0
  if (hasArt) {
    const img = SHUTTER_SPRITE!
    const hw = img.naturalWidth / 2
    ctx.imageSmoothingEnabled = false
    // each half anchored to its outer edge, sliding inward
    ctx.drawImage(img, 0, 0, hw, img.naturalHeight, half - W / 2, 0, W / 2, H)
    ctx.drawImage(img, hw, 0, hw, img.naturalHeight, W - half, 0, W / 2, H)
    ctx.imageSmoothingEnabled = true
    return
  }
  // placeholder steel — panels, rivets, a cyan seam light
  for (const side of [0, 1] as const) {
    const x0 = side === 0 ? half - W / 2 : W - half
    ctx.fillStyle = '#0b1018'
    ctx.fillRect(x0, 0, W / 2, H)
    ctx.strokeStyle = '#1b2433'
    ctx.lineWidth = 2
    for (let i = 1; i < 4; i++) {
      ctx.strokeRect(x0 + 10 * i, 10 * i, W / 2 - 20 * i, H - 20 * i)
    }
    ctx.fillStyle = '#2c3a55'
    for (let y = 14; y < H; y += 36) {
      for (let x = 14; x < W / 2; x += 44) {
        ctx.fillRect(x0 + x, y, 3, 3)
      }
    }
  }
  // the seam — where the doors meet, a thin light
  const seamL = half - 1
  const seamR = W - half + 1
  const glow = 0.4 + 0.25 * Math.sin(now / 600)
  ctx.fillStyle = `rgba(34, 211, 238, ${t >= 1 ? glow : 0.25})`
  ctx.fillRect(seamL - 1, 0, 2, H)
  ctx.fillRect(seamR - 1, 0, 2, H)
}

type Phase = 'live' | 'closing' | 'idle' | 'opening' | 'replay'

interface Props {
  doc: CrucibleDoc
  mods?: MatchMods // Starforge upgrades reaching into the sim
  tickMs?: number // sim pace while watching
  pauseMs?: number // breath between matches
  autoLoop?: boolean
  seedRef?: { current: number }
  onMatchEnd?: (r: MatchResult) => void
  // wall-clock cadence in ms — when set, matches fire on marks (seeded from
  // the mark, so a reload can't reroll), and the idle tank replays
  scheduleMs?: number
  // the idle panel's LOGS button — the page decides what the logs are
  onLogs?: () => void
  // the downtime minigame — fly the drift while the doors are shut
  onDrift?: () => void
}

const markSeed = (mark: number) => Math.floor(mark / 1000) >>> 0

export default function Terrarium({
  doc,
  mods,
  tickMs = 90,
  pauseMs = 2600,
  autoLoop = true,
  seedRef,
  onMatchEnd,
  scheduleMs,
  onLogs,
  onDrift,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const matchRef = useRef<MatchState | null>(null)
  const replayRef = useRef<MatchState | null>(null)
  const lastTickRef = useRef(0)
  const pauseUntilRef = useRef(0)
  const replayPauseRef = useRef(0)
  const nextMarkRef = useRef(0)
  // the barn doors — matches are events; between them the doors are SHUT
  const phaseRef = useRef<Phase>('idle')
  const shutterRef = useRef(1) // 0 open .. 1 sealed
  const shutterFromRef = useRef(1)
  const shutterStartRef = useRef(0)
  const lastSeedRef = useRef<number | null>(null)
  const replayAskedRef = useRef(false)
  const [idleUi, setIdleUi] = useState(!!scheduleMs)
  const [countText, setCountText] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // canvas sized to the largest floor in the chain; smaller floors center
    const chain = docFloors(doc)
    const W = Math.max(...chain.map((f) => f.w)) * PX
    const H = Math.max(...chain.map((f) => f.h)) * PX
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    // display responsively: scale to fit, cap at native size, keep aspect
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    canvas.style.maxWidth = `${W}px`
    // cap the wrapper too so the absolutely-positioned idle overlay tracks the canvas
    if (wrapRef.current) wrapRef.current.style.maxWidth = `${W}px`
    ctx.scale(dpr, dpr)

    const newMatch = () => {
      const seed = seedRef ? seedRef.current++ : ((Math.random() * 0xffffffff) >>> 0)
      matchRef.current = createMatch(doc, seed, mods)
    }

    if (scheduleMs) {
      nextMarkRef.current = Math.ceil(Date.now() / scheduleMs) * scheduleMs
      // the doors start SHUT; the last settled mark is what REPLAY shows
      lastSeedRef.current = markSeed(nextMarkRef.current - scheduleMs)
      phaseRef.current = 'idle'
      shutterRef.current = 1
      setIdleUi(true)
    } else {
      newMatch()
    }

    const swingTo = (open: boolean, now: number) => {
      shutterFromRef.current = shutterRef.current
      shutterStartRef.current = now
      phaseRef.current = open ? 'opening' : 'closing'
    }
    const stepShutter = (now: number, target: number) => {
      const t = Math.min(1, (now - shutterStartRef.current) / SHUTTER_MS)
      shutterRef.current = shutterFromRef.current + (target - shutterFromRef.current) * t
      return t >= 1
    }

    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)

      if (scheduleMs) {
        const wall = Date.now()
        const phase = phaseRef.current

        // a mark fires no matter the phase — the beacon outranks everything
        // except a live match already running
        if (phase !== 'live' && phase !== 'opening' && wall >= nextMarkRef.current) {
          // marks missed while the tab slept settle instantly; the newest runs live
          while (nextMarkRef.current + scheduleMs <= wall) {
            const r = runMatch(doc, markSeed(nextMarkRef.current), mods)
            lastSeedRef.current = markSeed(nextMarkRef.current)
            if (onMatchEnd) onMatchEnd(r)
            nextMarkRef.current += scheduleMs
          }
          matchRef.current = createMatch(doc, markSeed(nextMarkRef.current), mods)
          nextMarkRef.current += scheduleMs
          replayRef.current = null
          setIdleUi(false)
          swingTo(true, now)
          sfx.play('unlock') // the beacon answers — a challenger has come

        }

        switch (phaseRef.current) {
          case 'opening': {
            const arrived = stepShutter(now, 0)
            draw(ctx, matchRef.current ?? replayRef.current, now, W, H, null)
            drawShutters(ctx, W, H, shutterRef.current, now)
            if (arrived) phaseRef.current = matchRef.current ? 'live' : replayRef.current ? 'replay' : 'idle'
            return
          }
          case 'live': {
            const live = matchRef.current
            if (!live) {
              phaseRef.current = 'idle'
              setIdleUi(true)
              return
            }
            if (!live.done) {
              if (now - lastTickRef.current >= tickMs) {
                lastTickRef.current = now
                step(live)
                for (const t of live.sfx) sfx.play(t as SfxId)
                if (live.done) {
                  pauseUntilRef.current = now + pauseMs * 3 // let the veil hang
                  lastSeedRef.current = live.seed
                  if (live.result && onMatchEnd) onMatchEnd(live.result)
                }
              }
              draw(ctx, live, now, W, H, null)
              return
            }
            if (now < pauseUntilRef.current) {
              draw(ctx, live, now, W, H, null)
              return
            }
            matchRef.current = null
            swingTo(false, now)
            return
          }
          case 'replay': {
            const ghost = replayRef.current
            if (!ghost) {
              swingTo(false, now)
              return
            }
            if (!ghost.done) {
              if (now - lastTickRef.current >= tickMs) {
                lastTickRef.current = now
                step(ghost) // no onMatchEnd — replays pay nothing, but they DO sound
                for (const t of ghost.sfx) sfx.play(t as SfxId)
              }
              draw(ctx, ghost, now, W, H, '◦ REPLAY — the last stand')
              return
            }
            if (replayPauseRef.current === 0) replayPauseRef.current = now + pauseMs
            if (now < replayPauseRef.current) {
              draw(ctx, ghost, now, W, H, '◦ REPLAY — the last stand')
              return
            }
            replayRef.current = null
            replayPauseRef.current = 0
            swingTo(false, now)
            return
          }
          case 'closing': {
            const sealed = stepShutter(now, 1)
            draw(ctx, matchRef.current ?? replayRef.current, now, W, H, null)
            drawShutters(ctx, W, H, shutterRef.current, now)
            if (sealed) {
              phaseRef.current = 'idle'
              setIdleUi(true)
            }
            return
          }
          case 'idle': {
            // the doors are shut — the crucible rests until the next mark
            if (replayAskedRef.current) {
              replayAskedRef.current = false
              if (lastSeedRef.current !== null) {
                replayRef.current = createMatch(doc, lastSeedRef.current, mods)
                replayPauseRef.current = 0
                setIdleUi(false)
                swingTo(true, now)
                return
              }
            }
            ctx.fillStyle = '#070a10'
            ctx.fillRect(0, 0, W, H)
            drawShutters(ctx, W, H, 1, now)
            const left = Math.max(0, nextMarkRef.current - wall)
            const mm = Math.floor(left / 60000)
            const ss = Math.floor((left % 60000) / 1000)
            const txt = `${mm}:${String(ss).padStart(2, '0')}`
            setCountText((prev) => (prev === txt ? prev : txt))
            return
          }
        }
        return
      }

      // free-running (dev editor)
      const m = matchRef.current
      if (!m) return
      if (!m.done && now - lastTickRef.current >= tickMs) {
        lastTickRef.current = now
        step(m)
        for (const t of m.sfx) sfx.play(t as SfxId)
        if (m.done) {
          pauseUntilRef.current = now + pauseMs
          if (m.result && onMatchEnd) onMatchEnd(m.result)
        }
      }
      if (m.done && autoLoop && now >= pauseUntilRef.current) newMatch()
      draw(ctx, m, now, W, H, null)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [doc, mods, tickMs, pauseMs, autoLoop, seedRef, onMatchEnd, scheduleMs])

  return (
    <div ref={wrapRef} className="relative mx-auto w-full">
      <canvas
        ref={canvasRef}
        className="block w-full rounded-lg border border-cyan-900/40 shadow-[0_0_40px_rgba(34,211,238,0.06)]"
      />
      {/* the idle panel — the doors are shut, the beacon counts down */}
      {scheduleMs && idleUi && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="text-slate-500 text-[10px] tracking-[0.3em]">THE CRUCIBLE RESTS</div>
          <div className="text-cyan-300 text-4xl tabular-nums tracking-widest drop-shadow-[0_0_12px_rgba(34,211,238,0.35)]">
            {countText}
          </div>
          <div className="text-slate-600 text-[10px] tracking-[0.25em] -mt-2">UNTIL THE NEXT CHALLENGE</div>
          <div className="flex flex-wrap justify-center gap-3 mt-2 px-2 pointer-events-auto">
            <button
              onClick={() => {
                sfx.ensure() // a gesture — unlock audio so the replay has sound
                replayAskedRef.current = true
              }}
              className="px-4 py-1.5 text-[11px] tracking-[0.2em] rounded border border-cyan-800 text-cyan-300 hover:bg-cyan-950/40 transition-colors"
            >
              ▶ REPLAY LAST CHALLENGE
            </button>
            {onLogs && (
              <button
                onClick={onLogs}
                className="px-4 py-1.5 text-[11px] tracking-[0.2em] rounded border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
              >
                ▤ LOGS
              </button>
            )}
            {onDrift && (
              <button
                onClick={onDrift}
                className="px-4 py-1.5 text-[11px] tracking-[0.2em] rounded border border-violet-900 text-violet-300 hover:bg-violet-950/40 transition-colors"
              >
                ▲ FLY THE DRIFT
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function drawCountdown(ctx: CanvasRenderingContext2D, text: string, W: number) {
  ctx.font = '600 14px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#22d3ee'
  ctx.fillText(text, W / 2, 24)
}

function draw(
  ctx: CanvasRenderingContext2D,
  m: MatchState | null,
  now: number,
  W: number,
  H: number,
  countdown: string | null,
) {
  // ancient stone, near-black
  ctx.fillStyle = '#070a10'
  ctx.fillRect(0, 0, W, H)

  if (!m) {
    if (countdown) drawCountdown(ctx, countdown, W)
    return
  }
  // the window follows the action front — the deepest floor with life in it
  const view = frontFloor(m)
  const floor = m.floors[view]
  const last = m.floors.length - 1

  // center smaller floors
  const ox = Math.floor((W - floor.w * PX) / 2)
  const oy = Math.floor((H - floor.h * PX) / 2)
  ctx.save()
  ctx.translate(ox, oy)

  // tiles
  for (let y = 0; y < floor.h; y++) {
    for (let x = 0; x < floor.w; x++) {
      const t = floor.tiles[y * floor.w + x]
      const px = x * PX
      const py = y * PX
      if (t === TILE.WALL) {
        ctx.fillStyle = '#1b2233'
        ctx.fillRect(px, py, PX, PX)
        ctx.fillStyle = '#2c3a55'
        ctx.fillRect(px, py, PX, 2)
      } else if (t === TILE.GATE) {
        ctx.fillStyle = '#0b2a33'
        ctx.fillRect(px, py, PX, PX)
        ctx.fillStyle = '#22d3ee'
        ctx.fillRect(px + 2, py + 2, PX - 4, PX - 4)
      } else if (t === TILE.VAULT) {
        const pulse = 0.6 + 0.4 * Math.sin(now / 400)
        ctx.fillStyle = '#2a2208'
        ctx.fillRect(px, py, PX, PX)
        ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`
        ctx.fillRect(px + 2, py + 2, PX - 4, PX - 4)
      } else if (t === TILE.PORTAL) {
        // the red hex — sealed: dim ember; open: burning bright
        const cx = px + PX / 2
        const cy = py + PX / 2
        const r = PX / 2 - 1
        const open = m.portalOpen
        const pulse = open ? 0.7 + 0.3 * Math.sin(now / 150) : 0.35 + 0.1 * Math.sin(now / 800)
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6
          const hx = cx + r * Math.cos(a)
          const hy = cy + r * Math.sin(a)
          if (i === 0) ctx.moveTo(hx, hy)
          else ctx.lineTo(hx, hy)
        }
        ctx.closePath()
        ctx.fill()
      } else {
        // floor — faint grid breath
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = '#0a0e16'
          ctx.fillRect(px, py, PX, PX)
        }
      }
    }
  }

  // spikes
  for (const t of m.traps) {
    if (t.floor !== view) continue
    const cx = t.x * PX + PX / 2
    const cy = t.y * PX + PX / 2
    const hot = t.cooldown > 0
    ctx.fillStyle = hot ? '#c084fc' : '#5b21b6'
    ctx.beginPath()
    ctx.moveTo(cx, cy - 4)
    ctx.lineTo(cx + 4, cy)
    ctx.lineTo(cx, cy + 4)
    ctx.lineTo(cx - 4, cy)
    ctx.closePath()
    ctx.fill()
  }

  // guards — crimson constructs; sigil champions burn amber
  for (const g of m.guards) {
    if (!g.alive || g.floor !== view) continue
    const px = g.x * PX
    const py = g.y * PX
    if (g.champion) {
      const cx = px + PX / 2
      const cy = py + PX / 2
      const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 10)
      glow.addColorStop(0, 'rgba(251, 191, 36, 0.5)')
      glow.addColorStop(1, 'rgba(251, 191, 36, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(cx - 10, cy - 10, 20, 20)
      ctx.fillStyle = '#92400e'
      ctx.fillRect(px + 1, py + 1, PX - 2, PX - 2)
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(px + 3, py + 3, PX - 6, PX - 6)
    } else if (g.watcher) {
      // the posted eye — a dark socket, a red iris, a sliver of aim
      const cx = px + PX / 2
      const cy = py + PX / 2
      ctx.fillStyle = '#450a0a'
      ctx.beginPath()
      ctx.moveTo(cx, cy - 6)
      ctx.lineTo(cx + 6, cy)
      ctx.lineTo(cx, cy + 6)
      ctx.lineTo(cx - 6, cy)
      ctx.closePath()
      ctx.fill()
      const charging = (g.cooldown ?? 0) === 0
      ctx.fillStyle = charging ? '#ef4444' : '#7f1d1d'
      ctx.beginPath()
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
      ctx.fill()
      if (g.fx || g.fy) {
        const a = Math.atan2(g.fy ?? 0, g.fx ?? 0)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + 6 * Math.cos(a), cy + 6 * Math.sin(a))
        ctx.stroke()
      }
    } else if (GUARD_SPRITE?.complete && GUARD_SPRITE.naturalWidth > 0) {
      // the hand-drawn construct — up-facing source, rotated to its facing.
      // steps are cardinal (pixel-perfect 90s); strikes aim at true angle.
      const d = PX + 4
      const angle = g.fx || g.fy ? Math.atan2(g.fx ?? 0, -(g.fy ?? -1)) : 0
      ctx.save()
      ctx.translate(px + PX / 2, py + PX / 2)
      ctx.rotate(angle)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(GUARD_SPRITE, -d / 2, -d / 2, d, d)
      ctx.imageSmoothingEnabled = true
      ctx.restore()
    } else {
      ctx.fillStyle = '#7f1d1d'
      ctx.fillRect(px + 2, py + 2, PX - 4, PX - 4)
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(px + 4, py + 4, PX - 8, PX - 8)
    }
    ctx.fillStyle = '#000'
    ctx.fillRect(px + 2, py, PX - 4, 2)
    ctx.fillStyle = g.champion ? '#fcd34d' : '#f87171'
    ctx.fillRect(px + 2, py, (PX - 4) * (g.hp / g.maxHp), 2)
  }

  // shot tracers — fade over a few ticks; mends run green
  for (const sh of m.shots) {
    if (sh.floor !== view) continue
    const age = m.tick - sh.at
    if (age > 3) continue
    const col = sh.heal ? '#4ade80' : sh.team >= 0 ? TEAM_COLORS[sh.team % TEAM_COLORS.length] : sh.team === -2 ? '#fbbf24' : '#ef4444'
    ctx.strokeStyle = `${col}${age === 0 ? 'cc' : age === 1 ? '88' : '44'}`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(sh.x0 * PX + PX / 2, sh.y0 * PX + PX / 2)
    ctx.lineTo(sh.x1 * PX + PX / 2, sh.y1 * PX + PX / 2)
    ctx.stroke()
  }

  // lead-death rings — the perimeter breaking, drawn as a dying pulse
  for (const fl of m.flashes) {
    if (fl.floor !== view) continue
    const age = m.tick - fl.at
    if (age > 12) continue
    const col = TEAM_COLORS[fl.team % TEAM_COLORS.length]
    ctx.strokeStyle = `${col}${age < 4 ? 'aa' : age < 8 ? '66' : '33'}`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(fl.x * PX + PX / 2, fl.y * PX + PX / 2, 4 + age * 1.8, 0, Math.PI * 2)
    ctx.stroke()
  }

  // fighters — tiny glowing figures in team colors
  for (const f of m.fighters) {
    if (f.floor !== view) continue
    const cx = f.x * PX + PX / 2
    const cy = f.y * PX + PX / 2
    const col = TEAM_COLORS[f.team % TEAM_COLORS.length]
    if (!f.alive) {
      ctx.fillStyle = `${col}40`
      ctx.fillRect(cx - 3, cy - 1, 6, 2)
      continue
    }
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 8)
    glow.addColorStop(0, `${col}e6`)
    glow.addColorStop(1, `${col}00`)
    ctx.fillStyle = glow
    ctx.fillRect(cx - 8, cy - 8, 16, 16)
    ctx.fillStyle = col
    if (f.role === 'healer') {
      // healers read as small triangles (the back line)
      ctx.beginPath()
      ctx.moveTo(cx, cy - 4)
      ctx.lineTo(cx + 3.5, cy + 3)
      ctx.lineTo(cx - 3.5, cy + 3)
      ctx.closePath()
      ctx.fill()
    } else if (f.role === 'tank') {
      // the wall — square bulk
      ctx.fillRect(cx - 4, cy - 4, 8, 8)
    } else {
      // the lead (and any roleless stray) — a circle with a bright core
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fill()
      if (f.role === 'lead') {
        ctx.fillStyle = '#fff'
        ctx.fillRect(cx - 1, cy - 1, 2, 2)
      }
    }
    // hp pip
    ctx.fillStyle = '#000'
    ctx.fillRect(cx - 4, cy - 7, 8, 2)
    ctx.fillStyle = '#4ade80'
    ctx.fillRect(cx - 4, cy - 7, 8 * (f.hp / f.maxHp), 2)
  }

  ctx.restore()

  // idle veil — the tank dims between matches, the replay runs underneath
  if (countdown) {
    ctx.fillStyle = 'rgba(7, 10, 16, 0.4)'
    ctx.fillRect(0, 0, W, H)
    ctx.font = '10px ui-monospace, monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#64748b'
    ctx.fillText('◦ REPLAY — the last stand', 8, H - 10)
    drawCountdown(ctx, countdown, W)
  }

  // stage chip — names the floor under the window
  if (!countdown && !m.done) {
    ctx.font = '10px ui-monospace, monospace'
    ctx.textAlign = 'left'
    const floorTag = m.floors.length > 2 ? ` · floor ${view + 1}/${m.floors.length}` : ''
    if (view === last) {
      ctx.fillStyle = '#facc15'
      ctx.fillText(`◦ THE GAUNTLET — the host is watching${floorTag}`, 8, 14)
    } else if (view === m.sealedIdx) {
      ctx.fillStyle = m.portalOpen ? '#ef4444' : '#f87171'
      ctx.fillText(
        m.portalOpen ? `◦ THE PORTAL BURNS — ascend${floorTag}` : `◦ the portal is sealed — last team standing${floorTag}`,
        8,
        14,
      )
    } else {
      ctx.fillStyle = '#fb923c'
      ctx.fillText(`◦ the way up stands OPEN — fights spill upward${floorTag}`, 8, 14)
    }
  }

  // end-of-match veil
  if (!countdown && m.done && m.result) {
    ctx.fillStyle = 'rgba(7, 10, 16, 0.55)'
    ctx.fillRect(0, 0, W, H)
    ctx.font = '600 18px ui-monospace, monospace'
    ctx.textAlign = 'center'
    if (m.result.victory && m.result.winnerTeam !== null) {
      ctx.fillStyle = TEAM_COLORS[m.result.winnerTeam % TEAM_COLORS.length]
      const name =
        m.result.teamNames?.[m.result.winnerTeam] ?? TEAM_NAMES[m.result.winnerTeam % TEAM_NAMES.length]
      ctx.fillText(`${name.toUpperCase()} TAKES THE VAULT`, W / 2, H / 2 - 8)
    } else {
      ctx.fillStyle = '#22d3ee'
      ctx.fillText('THE CRUCIBLE HOLDS', W / 2, H / 2 - 8)
    }
    ctx.font = '12px ui-monospace, monospace'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(
      `${m.result.fallen} fallen · deepest ${(m.result.deepest * 100).toFixed(0)}%${m.result.reachedGauntlet ? ' · reached the gauntlet' : ''} · +${m.result.manaYield} mana`,
      W / 2,
      H / 2 + 14,
    )
  }
}
