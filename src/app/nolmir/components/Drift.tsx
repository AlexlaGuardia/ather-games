'use client'

// THE DRIFT — the downtime minigame. While the crucible rests, the young
// pyramid flies the lanes between nodes: asteroids tumble past, stray
// fighters weave in. Arrows (or A/D) to steer; the ship never stops firing.
// Fixed-shooter bones (Invaders/Galaga), forward-travel dressing (River
// Raid), Asteroids' splitting rocks. Score only — the drift pays in pride.

import { useEffect, useRef, useState } from 'react'

const W = 420
const H = 560
const BEST_KEY = 'nolmir.drift.best'

interface Rock {
  x: number
  y: number
  vx: number
  vy: number
  r: number // radius — big rocks split
  hp: number
  spin: number
  angle: number
  verts: number[] // radius jitter per vertex — lumpy silhouette
}
interface Foe {
  x: number
  y: number
  vy: number
  phase: number // sine weave
  amp: number
  fireAt: number
}
interface Bolt {
  x: number
  y: number
  vy: number
  hostile: boolean
}

interface Game {
  ship: { x: number; lives: number; invulnUntil: number }
  rocks: Rock[]
  foes: Foe[]
  bolts: Bolt[]
  stars: { x: number; y: number; v: number; b: number }[]
  score: number
  t: number // seconds survived — the ramp
  nextRock: number
  nextFoe: number
  nextFire: number
  over: boolean
  flashUntil: number
}

function makeRock(x: number, y: number, r: number, rng: () => number): Rock {
  const verts: number[] = []
  for (let i = 0; i < 8; i++) verts.push(0.72 + rng() * 0.36)
  return {
    x,
    y,
    vx: (rng() - 0.5) * 40,
    vy: 50 + rng() * 60,
    r,
    hp: r > 14 ? 2 : 1,
    spin: (rng() - 0.5) * 2.4,
    angle: rng() * Math.PI * 2,
    verts,
  }
}

function newGame(): Game {
  const stars = []
  for (let i = 0; i < 70; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, v: 24 + Math.random() * 90, b: 0.25 + Math.random() * 0.6 })
  }
  return {
    ship: { x: W / 2, lives: 3, invulnUntil: 0 },
    rocks: [],
    foes: [],
    bolts: [],
    stars,
    score: 0,
    t: 0,
    nextRock: 0.6,
    nextFoe: 5,
    nextFire: 0,
    over: false,
    flashUntil: 0,
  }
}

export default function Drift({ open, onClose }: { open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const keysRef = useRef({ left: false, right: false })
  const [over, setOver] = useState(false)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)

  useEffect(() => {
    if (!open) return
    try {
      setBest(Number(localStorage.getItem(BEST_KEY) ?? 0))
    } catch {}
    gameRef.current = newGame()
    setOver(false)
    setScore(0)

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = down
        e.preventDefault()
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = down
        e.preventDefault()
      } else if (e.key === 'Escape' && down) {
        onClose()
      }
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const g = gameRef.current
      if (!g) return

      // ---- update ----
      if (!g.over) {
        g.t += dt
        const ramp = 1 + g.t / 45 // everything leans harder with time

        const SHIP_SPEED = 280
        if (keysRef.current.left) g.ship.x -= SHIP_SPEED * dt
        if (keysRef.current.right) g.ship.x += SHIP_SPEED * dt
        g.ship.x = Math.max(14, Math.min(W - 14, g.ship.x))

        // the ship never stops firing
        g.nextFire -= dt
        if (g.nextFire <= 0) {
          g.bolts.push({ x: g.ship.x, y: H - 46, vy: -420, hostile: false })
          g.nextFire = 0.22
        }

        // spawns
        g.nextRock -= dt
        if (g.nextRock <= 0) {
          const r = Math.random() < 0.55 ? 10 + Math.random() * 5 : 16 + Math.random() * 7
          g.rocks.push(makeRock(20 + Math.random() * (W - 40), -24, r, Math.random))
          g.nextRock = (0.9 + Math.random() * 0.8) / ramp
        }
        g.nextFoe -= dt
        if (g.nextFoe <= 0) {
          g.foes.push({
            x: 40 + Math.random() * (W - 80),
            y: -20,
            vy: 60 + Math.random() * 40 * ramp,
            phase: Math.random() * Math.PI * 2,
            amp: 40 + Math.random() * 60,
            fireAt: 1 + Math.random() * 2,
          })
          g.nextFoe = (4 + Math.random() * 3) / ramp
        }

        // motion
        for (const r of g.rocks) {
          r.x += r.vx * dt
          r.y += r.vy * ramp * 0.7 * dt
          r.angle += r.spin * dt
          if (r.x < r.r || r.x > W - r.r) r.vx *= -1
        }
        for (const f of g.foes) {
          f.y += f.vy * dt
          f.phase += dt * 2.2
          f.x += Math.sin(f.phase) * f.amp * dt
          f.fireAt -= dt
          if (f.fireAt <= 0 && f.y > 0 && f.y < H - 140) {
            g.bolts.push({ x: f.x, y: f.y + 10, vy: 240, hostile: true })
            f.fireAt = 1.6 + Math.random() * 2
          }
        }
        for (const b of g.bolts) b.y += b.vy * dt

        // collisions — player bolts vs rocks & foes
        for (const b of g.bolts) {
          if (b.hostile || b.y < -10) continue
          for (const r of g.rocks) {
            if (r.hp <= 0) continue
            const dx = b.x - r.x
            const dy = b.y - r.y
            if (dx * dx + dy * dy < r.r * r.r) {
              r.hp--
              b.y = -999
              if (r.hp <= 0) {
                g.score += r.r > 14 ? 25 : 10
                if (r.r > 14) {
                  // a big rock breaks into two small ones
                  g.rocks.push(makeRock(r.x - 6, r.y, 9 + Math.random() * 3, Math.random))
                  g.rocks.push(makeRock(r.x + 6, r.y, 9 + Math.random() * 3, Math.random))
                }
              }
              break
            }
          }
          if (b.y === -999) continue
          for (const f of g.foes) {
            const dx = b.x - f.x
            const dy = b.y - f.y
            if (dx * dx + dy * dy < 144) {
              f.y = H + 999
              b.y = -999
              g.score += 50
              break
            }
          }
        }

        // collisions — the ship
        const sx = g.ship.x
        const sy = H - 38
        if (now >= g.ship.invulnUntil) {
          let hit = false
          for (const r of g.rocks) {
            if (r.hp <= 0) continue
            const dx = sx - r.x
            const dy = sy - r.y
            if (dx * dx + dy * dy < (r.r + 9) * (r.r + 9)) hit = true
          }
          for (const f of g.foes) {
            const dx = sx - f.x
            const dy = sy - f.y
            if (dx * dx + dy * dy < 380) hit = true
          }
          for (const b of g.bolts) {
            if (!b.hostile) continue
            const dx = sx - b.x
            const dy = sy - b.y
            if (dx * dx + dy * dy < 130) {
              hit = true
              b.y = H + 999
            }
          }
          if (hit) {
            g.ship.lives--
            g.ship.invulnUntil = now + 1800
            g.flashUntil = now + 220
            if (g.ship.lives <= 0) {
              g.over = true
              setOver(true)
              setScore(g.score)
              try {
                const b0 = Number(localStorage.getItem(BEST_KEY) ?? 0)
                if (g.score > b0) {
                  localStorage.setItem(BEST_KEY, String(g.score))
                  setBest(g.score)
                }
              } catch {}
            }
          }
        }

        // sweep the dead and the gone
        g.rocks = g.rocks.filter((r) => r.hp > 0 && r.y < H + 30)
        g.foes = g.foes.filter((f) => f.y < H + 30)
        g.bolts = g.bolts.filter((b) => b.y > -20 && b.y < H + 20)
        for (const st of g.stars) {
          st.y += st.v * dt
          if (st.y > H) {
            st.y = -2
            st.x = Math.random() * W
          }
        }
        setScore(g.score)
      }

      // ---- draw ----
      ctx.fillStyle = g.flashUntil > now ? '#1a0d12' : '#070a10'
      ctx.fillRect(0, 0, W, H)
      for (const st of g.stars) {
        ctx.fillStyle = `rgba(148, 163, 184, ${st.b})`
        ctx.fillRect(st.x, st.y, 1.5, 1.5)
      }
      // bolts
      for (const b of g.bolts) {
        ctx.fillStyle = b.hostile ? '#ef4444' : '#22d3ee'
        ctx.fillRect(b.x - 1, b.y - 5, 2, 10)
      }
      // rocks — lumpy slate polygons
      for (const r of g.rocks) {
        ctx.fillStyle = r.hp > 1 ? '#334155' : '#475569'
        ctx.beginPath()
        for (let i = 0; i < 8; i++) {
          const a = r.angle + (i / 8) * Math.PI * 2
          const rr = r.r * r.verts[i]
          const px = r.x + rr * Math.cos(a)
          const py = r.y + rr * Math.sin(a)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#1e293b'
        ctx.stroke()
      }
      // foes — red darts
      for (const f of g.foes) {
        ctx.fillStyle = '#7f1d1d'
        ctx.beginPath()
        ctx.moveTo(f.x, f.y + 10)
        ctx.lineTo(f.x + 9, f.y - 8)
        ctx.lineTo(f.x, f.y - 3)
        ctx.lineTo(f.x - 9, f.y - 8)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#ef4444'
        ctx.stroke()
      }
      // the young pyramid — blinking through its grace period
      const blink = performance.now() < g.ship.invulnUntil && Math.floor(performance.now() / 120) % 2 === 0
      if (!blink && !g.over) {
        const sx = g.ship.x
        const sy = H - 38
        ctx.fillStyle = '#0b2a3a'
        ctx.beginPath()
        ctx.moveTo(sx, sy - 12)
        ctx.lineTo(sx + 11, sy + 9)
        ctx.lineTo(sx - 11, sy + 9)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#22d3ee'
        ctx.stroke()
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)'
        ctx.beginPath()
        ctx.arc(sx, sy - 12, 2, 0, Math.PI * 2)
        ctx.fill()
        // thruster
        ctx.fillStyle = `rgba(34, 211, 238, ${0.4 + 0.3 * Math.sin(now / 60)})`
        ctx.fillRect(sx - 3, sy + 10, 6, 4 + 2 * Math.sin(now / 90))
      }
      // hud
      ctx.font = '11px ui-monospace, monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(`SCORE ${g.score}`, 10, 18)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#475569'
      for (let i = 0; i < g.ship.lives; i++) {
        const lx = W - 14 - i * 16
        ctx.fillStyle = '#22d3ee'
        ctx.beginPath()
        ctx.moveTo(lx, 8)
        ctx.lineTo(lx + 5, 18)
        ctx.lineTo(lx - 5, 18)
        ctx.closePath()
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="relative rounded-lg border border-cyan-900/60 bg-[#070a10] p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="text-cyan-300 text-xs tracking-[0.3em]">THE DRIFT</h2>
          <span className="text-slate-600 text-[10px]">
            best <b className="text-slate-400 tabular-nums">{best}</b> · ←/→ steer · esc leaves
          </span>
        </div>
        <canvas ref={canvasRef} className="rounded border border-slate-800" />
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 rounded-lg">
            <div className="text-red-400 text-sm tracking-[0.3em]">THE LANE TAKES THE SHIP</div>
            <div className="text-slate-300 text-2xl tabular-nums">{score}</div>
            {score >= best && score > 0 && <div className="text-amber-300 text-[10px] tracking-[0.25em]">A NEW BEST</div>}
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => {
                  gameRef.current = newGame()
                  setOver(false)
                  setScore(0)
                }}
                className="px-4 py-1.5 text-[11px] tracking-[0.2em] rounded border border-cyan-800 text-cyan-300 hover:bg-cyan-950/40"
              >
                ▶ FLY AGAIN
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-[11px] tracking-[0.2em] rounded border border-slate-700 text-slate-400 hover:border-slate-500"
              >
                RETURN TO THE WATCH
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
