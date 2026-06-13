'use client'

import { useRef, useEffect } from 'react'
import { TILE } from '../engine/renderer'
import { PALETTES } from '../sprites/palette'

// Simplified tile colors for minimap (index matches TILES array)
const MM_COLORS: string[] = [
  '#2d6b16', // 0: grass
  '#2d6b16', // 1: grass alt
  '#8a7a4a', // 2: dirt path
  '#8a7a4a', // 3: dirt path2
  '#3d9c30', // 4: flowers
  '#3d9c30', // 5: flowers2
  '#d4a843', // 6: spirit console
  '#2060a0', // 7: water edge
  '#1850b0', // 8: water
  '#2060a0', // 9: water edge inner
  '#2060a0', // 10: water edge outer
  '#c0c0d0', // 11: cloud border
  '#c0c0d0', // 12: cloud border corner
  '#6a6a3a', // 13: dirt path3
]

const SCALE = 3 // pixels per tile

interface MinimapPanelProps {
  grid: number[][]
  playerTileX: number
  playerTileY: number
  spirits: { x: number; y: number; species: string; element?: string; variant?: string }[]
  onClick?: () => void
}

export default function MinimapPanel({ grid, playerTileX, playerTileY, spirits, onClick }: MinimapPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blinkRef = useRef(0)
  const rafRef = useRef<number>(0)
  const tileLayerRef = useRef<HTMLCanvasElement | null>(null)
  const cachedGridRef = useRef<number[][] | null>(null)

  const cols = grid[0]?.length ?? 0
  const rows = grid.length
  const mapW = cols * SCALE
  const mapH = rows * SCALE

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = mapW
    canvas.height = mapH

    // Cache tile layer to offscreen canvas (only rebuild when grid changes)
    if (cachedGridRef.current !== grid) {
      cachedGridRef.current = grid
      const offscreen = document.createElement('canvas')
      offscreen.width = mapW
      offscreen.height = mapH
      const oc = offscreen.getContext('2d')!
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const val = grid[ty][tx]
          const tileIdx = val & 0xFF
          oc.fillStyle = MM_COLORS[tileIdx] ?? MM_COLORS[0]
          oc.fillRect(tx * SCALE, ty * SCALE, SCALE, SCALE)
        }
      }
      tileLayerRef.current = offscreen
    }

    let lastTime = 0
    const draw = (time: number) => {
      const dt = (time - lastTime) / 1000
      lastTime = time
      blinkRef.current += dt
      const blink = blinkRef.current % 0.8 < 0.5

      ctx.imageSmoothingEnabled = false

      // Blit cached tile layer
      if (tileLayerRef.current) {
        ctx.drawImage(tileLayerRef.current, 0, 0)
      }

      // Spirit dots
      for (const s of spirits) {
        const stx = Math.floor(s.x / TILE)
        const sty = Math.floor(s.y / TILE)
        const v = s.variant ?? 'base'
        const color = PALETTES[s.species]?.[v]?.[0] ?? PALETTES[s.species]?.base[0] ?? '#aaa'
        ctx.fillStyle = color
        ctx.fillRect(stx * SCALE, sty * SCALE, SCALE, SCALE)
      }

      // Player dot (blinking gold)
      if (blink) {
        ctx.fillStyle = '#d4a843'
      } else {
        ctx.fillStyle = 'rgba(212, 168, 67, 0.4)'
      }
      ctx.fillRect(playerTileX * SCALE, playerTileY * SCALE, SCALE, SCALE)

      // Subtle border around player position
      ctx.strokeStyle = 'rgba(212, 168, 67, 0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(
        playerTileX * SCALE - 1,
        playerTileY * SCALE - 1,
        SCALE + 2,
        SCALE + 2,
      )

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [grid, playerTileX, playerTileY, spirits, mapW, mapH, cols, rows])

  return (
    <div className="relative group cursor-pointer" onClick={onClick}>
      {/* Label */}
      <div className="text-center mb-1.5 flex items-center justify-center gap-1">
        <span className="text-[10px] font-display text-[#d4a843]/60 uppercase tracking-[0.2em] group-hover:text-[#d4a843] transition-colors">
          Scanner
        </span>
      </div>
      
      {/* Circular clip container */}
      <div
        className="relative rounded-full overflow-hidden border-2 border-[#d4a843]/40 shadow-lg shadow-black/40 group-hover:border-[#d4a843]/80 group-hover:shadow-[#d4a843]/20 transition-all duration-300"
        style={{ width: mapW + 4, height: mapH + 4, padding: 2 }}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
          style={{
            imageRendering: 'pixelated',
            width: mapW,
            height: mapH,
          }}
        />

        {/* Scan line effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
          <div 
            className="absolute left-0 right-0 h-[2px] bg-[#d4a843]/50 shadow-[0_0_8px_#d4a843] animate-[scan_3s_linear_infinite]"
            style={{ top: '-10%' }}
          />
        </div>

        {/* Glass gloss */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { top: -10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 110%; opacity: 0; }
        }
      `}</style>
    </div>
  )
}
