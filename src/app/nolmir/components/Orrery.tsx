'use client'

// The orrery — the Starforge's face. Your ship at the center of the system,
// planets wheeling around it. Click a planet to work it.

import { useEffect, useRef } from 'react'
import { ForgeState, activePlanets, ORE_COLOR, OreId } from '../lib/starforge'

// panel = the old framed view; backdrop = full-page layer behind the rooms.
// backdrop doubles the SPACE (wider rings), not the planets — and leaves
// orbit slots free for a bigger roster later.
const GEOM = {
  panel: { w: 640, h: 480, ringBase: 70, ringStep: 26 },
  backdrop: { w: 1280, h: 760, ringBase: 96, ringStep: 38 },
}

interface Props {
  forge: ForgeState
  selected: number | null
  onSelect: (idx: number | null) => void
  backdrop?: boolean
}

function planetPos(
  idx: number,
  now: number,
  g: { w: number; h: number; ringBase: number; ringStep: number },
): { x: number; y: number; r: number } {
  const ring = g.ringBase + idx * g.ringStep
  // each ring wheels at its own pace; deeper = slower (render-only, not sim)
  const angle = (now / (14000 + idx * 9000)) * Math.PI * 2 + idx * 2.2
  return { x: g.w / 2 + ring * Math.cos(angle), y: g.h / 2 + ring * 0.62 * Math.sin(angle), r: 8 + idx * 1.1 }
}

// hand-drawn worlds (Aseprite, via the dropbox) — the face library.
// node 1 planets match by name; generated systems borrow a face whose
// primary ore matches theirs (deterministic per name, stable across loads).
const SPRITE_LIB: { name: string; ore: OreId; src: string }[] = [
  { name: 'Cinder', ore: 'ferrite', src: '/nolmir/planets/cinder.png' },
  { name: 'Pale Echo', ore: 'ferrite', src: '/nolmir/planets/pale-echo.png' },
  { name: 'Brundt', ore: 'ferrite', src: '/nolmir/planets/brundt.png' },
  { name: 'Veilmoor', ore: 'lumenglass', src: '/nolmir/planets/veilmoor.png' },
  { name: 'Korrath', ore: 'voidsteel', src: '/nolmir/planets/korrath.png' },
  { name: 'Glasswomb', ore: 'aetherite', src: '/nolmir/planets/glasswomb.png' },
  { name: 'Null Choir', ore: 'aetherite', src: '/nolmir/planets/null-choir.png' },
  { name: 'The Drowned Eye', ore: 'manapearl', src: '/nolmir/planets/drowned-eye.png' },
]

function nameHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// exact name first (node 1); else same-primary-ore candidates; else the whole library
function spriteFor(name: string, primaryOre: OreId): string {
  const exact = SPRITE_LIB.find((e) => e.name === name)
  if (exact) return exact.src
  const pool = SPRITE_LIB.filter((e) => e.ore === primaryOre)
  const lib = pool.length > 0 ? pool : SPRITE_LIB
  return lib[nameHash(name) % lib.length].src
}

export default function Orrery({ forge, selected, onSelect, backdrop = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({ forge, selected })
  const spritesRef = useRef<Record<string, HTMLImageElement>>({})
  stateRef.current = { forge, selected }
  const g = backdrop ? GEOM.backdrop : GEOM.panel
  const { w: W, h: H } = g
  const CX = W / 2
  const CY = H / 2

  useEffect(() => {
    for (const { src } of SPRITE_LIB) {
      const img = new Image()
      img.src = src
      img.onload = () => {
        spritesRef.current[src] = img
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    // display responsively: fill the container, capped at native size, aspect kept
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    canvas.style.maxWidth = `${W}px`
    ctx.scale(dpr, dpr)

    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const { forge: f, selected: sel } = stateRef.current

      ctx.fillStyle = '#070a10'
      ctx.fillRect(0, 0, W, H)

      const SYS = activePlanets(f)
      // ring paths
      for (let i = 0; i < SYS.length; i++) {
        const ring = g.ringBase + i * g.ringStep
        ctx.strokeStyle = f.planets[i] > 0 ? 'rgba(125, 211, 252, 0.10)' : 'rgba(148, 163, 184, 0.05)'
        ctx.beginPath()
        ctx.ellipse(CX, CY, ring, ring * 0.62, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // the ship — a young pyramid, humming
      const pulse = 0.65 + 0.35 * Math.sin(now / 700)
      const glow = ctx.createRadialGradient(CX, CY, 2, CX, CY, 34)
      glow.addColorStop(0, `rgba(125, 211, 252, ${0.35 * pulse})`)
      glow.addColorStop(1, 'rgba(125, 211, 252, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(CX - 34, CY - 34, 68, 68)
      ctx.fillStyle = '#0b2a3a'
      ctx.beginPath()
      ctx.moveTo(CX, CY - 14)
      ctx.lineTo(CX + 13, CY + 10)
      ctx.lineTo(CX - 13, CY + 10)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = `rgba(125, 211, 252, ${pulse})`
      ctx.stroke()
      // the red beacon at the apex — dim ember in the deep past
      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + 0.3 * Math.sin(now / 1400)})`
      ctx.beginPath()
      ctx.arc(CX, CY - 14, 2.2, 0, Math.PI * 2)
      ctx.fill()

      // planets
      for (let i = 0; i < SYS.length; i++) {
        const p = planetPos(i, now, g)
        const def = SYS[i]
        const unlocked = f.planets[i] > 0
        const primaryOre = Object.keys(def.ores)[0] as OreId
        const col = ORE_COLOR[primaryOre]

        // a frayed line dims the world; a cut line leaves it dark with a red ring
        const conn = unlocked ? (f.connections?.[i] ?? 100) : 100
        if (unlocked && conn > 0) {
          const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r * 2.4)
          const glowA = conn >= 50 ? '55' : '22'
          g.addColorStop(0, `${col}${glowA}`)
          g.addColorStop(1, `${col}00`)
          ctx.fillStyle = g
          ctx.fillRect(p.x - p.r * 2.4, p.y - p.r * 2.4, p.r * 4.8, p.r * 4.8)
        }
        ctx.globalAlpha = unlocked && conn < 100 ? Math.max(0.25, conn / 100) : 1
        const sprite = spritesRef.current[spriteFor(def.name, primaryOre)]
        if (sprite) {
          // hand-drawn world — pixel-crisp, sized to its orbit slot
          const d = p.r * 2.6
          ctx.imageSmoothingEnabled = false
          if (!unlocked) ctx.globalAlpha = 0.35
          ctx.drawImage(sprite, p.x - d / 2, p.y - d / 2, d, d)
          ctx.imageSmoothingEnabled = true
        } else {
          ctx.fillStyle = unlocked ? col : '#1e293b'
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        if (!unlocked) {
          ctx.strokeStyle = '#334155'
          ctx.stroke()
        }
        if (unlocked && conn <= 0) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2)
          ctx.stroke()
        }
        if (sel === i) {
          ctx.strokeStyle = '#22d3ee'
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2)
          ctx.stroke()
        }
        // name + level
        ctx.font = '9px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = unlocked ? '#94a3b8' : '#475569'
        ctx.fillText(unlocked ? `${def.name} ·${f.planets[i]}` : def.name, p.x, p.y + p.r + 11)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    // map the tap from displayed px back into the canvas's logical W×H space
    const sx = W / rect.width
    const mx = (e.clientX - rect.left) * sx
    const my = (e.clientY - rect.top) * (H / rect.height)
    // a finger is ~22 screen px; convert to logical px so taps are forgiving when
    // the orrery is scaled down on mobile. pick the NEAREST planet within reach.
    const tol = 22 * sx
    const now = performance.now()
    let best = -1
    let bestD = Infinity
    for (let i = activePlanets(stateRef.current.forge).length - 1; i >= 0; i--) {
      const p = planetPos(i, now, g)
      const d = Math.hypot(mx - p.x, my - p.y)
      if (d <= Math.max(p.r + 6, tol) && d < bestD) {
        bestD = d
        best = i
      }
    }
    onSelect(best >= 0 ? best : null)
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      className={
        backdrop
          ? 'cursor-pointer'
          : 'rounded-lg border border-sky-900/40 cursor-pointer shadow-[0_0_40px_rgba(125,211,252,0.05)]'
      }
    />
  )
}
