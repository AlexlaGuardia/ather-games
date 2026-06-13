'use client'

// Sandbox Preview — live game simulation inside the sprite editor
// Uses real game loop (15 TPS + 60fps render), real pathfinding, real movement
// Click-to-move on the test_sandbox zone map

import { useRef, useEffect, useCallback, useState } from 'react'
import { Renderer, TILE, WIDTH, HEIGHT } from '../engine/renderer'
import { createGameLoop } from '../engine/game-loop'
import { Player, createPlayer, updatePlayer, setPath, spriteDir, isPlayOncePhase } from '../engine/player'
import { findPath, smoothPath } from '../engine/pathfinder'
import { createInputManager } from '../engine/input'
import { TILES, ABOVE } from '../world/tiles'
import { ZONES } from '../world/zones'
import { SpriteAnim } from '../sprites/sprite-data'

const SANDBOX_ZONE = ZONES.find(z => z.id === 'test-sandbox') ?? ZONES[0]

interface SandboxPreviewProps {
  /** Current sprites record — read live from editor state */
  sprites: Record<string, SpriteAnim>
  /** Current palette */
  palette: readonly string[]
  /** Per-animation frame durations from editor (matches in-game timing) */
  durations?: Record<string, number[]>
  /** CSS display width */
  displayWidth?: number
  /** CSS display height */
  displayHeight?: number
}

export default function SandboxPreview({
  sprites,
  palette,
  durations,
  displayWidth = 960,
  displayHeight = 640,
}: SandboxPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const playerRef = useRef<Player | null>(null)
  const loopRef = useRef<ReturnType<typeof createGameLoop> | null>(null)
  const spritesRef = useRef(sprites)
  const paletteRef = useRef(palette)
  const durationsRef = useRef(durations)
  const globalTickRef = useRef(0)

  // Keep refs in sync with props (live hotswap)
  spritesRef.current = sprites
  paletteRef.current = palette
  durationsRef.current = durations

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new Renderer(canvas)
    rendererRef.current = renderer

    const grid = SANDBOX_ZONE.grid
    const startX = SANDBOX_ZONE.playerStart?.tileX ?? 5
    const startY = SANDBOX_ZONE.playerStart?.tileY ?? 5
    renderer.cacheTilemap(grid, TILES)
    renderer.cacheOverlay(grid, TILES, ABOVE)
    renderer.buildAnimMap(grid, TILES)

    const player = createPlayer(startX, startY)
    playerRef.current = player

    const input = createInputManager()

    const loop = createGameLoop(
      // Update (15 TPS)
      () => {
        globalTickRef.current++
        updatePlayer(player, input.state, grid)
      },
      // Render (60fps)
      (_dt, alpha) => {
        const curSprites = spritesRef.current
        const curPalette = paletteRef.current
        const curDurations = durationsRef.current

        // Interpolate player position
        const visualX = player.prevX + (player.x - player.prevX) * alpha
        const visualY = player.prevY + (player.y - player.prevY) * alpha

        // Camera
        renderer.centerOn(visualX, visualY, grid[0]?.length ?? 16, grid.length)

        // Tilemap
        renderer.drawBackground()
        renderer.drawAnimatedTiles(TILES, ABOVE, globalTickRef.current, false)

        // Player sprite — uses movementPhase for sprite key
        const phase = player.movementPhase
        const sd = spriteDir(player.direction)
        let animKey = `${sd.dir}_${phase}`

        let anim = curSprites[animKey]
        if (!anim && (phase === 'start_run' || phase === 'end_run' || phase === 'special')) {
          anim = curSprites[`${sd.dir}_run`]
        }
        if (!anim && phase !== 'walk' && phase !== 'idle') {
          anim = curSprites[`${sd.dir}_walk`]
        }
        if (!anim) anim = curSprites[`${sd.dir}_idle`]
        anim = anim ?? curSprites.down_idle

        if (anim) {
          // Apply editor durations (matches in-game applyDurations behavior)
          const frameDurations = curDurations?.[animKey]
          const holdTime = frameDurations?.[player.animFrame % anim.frames.length]
            ?? anim.durations?.[player.animFrame % anim.frames.length]
            ?? anim.rate
          if (player.animTimer >= holdTime) {
            const nextFrame = player.animFrame + 1
            if (isPlayOncePhase(phase) && nextFrame >= anim.frames.length) {
              player.animFrame = anim.frames.length - 1
              player.phaseAnimDone = true
            } else {
              player.animFrame = nextFrame % anim.frames.length
            }
            player.animTimer = 0
          }

          const frameIdx = player.animFrame % anim.frames.length
          const frame = anim.frames[frameIdx]
          const palHash = curPalette.join(',')
          const key = `sandbox-player-${animKey}-${frameIdx}-${palHash}`
          const spriteCanvas = renderer.getSprite(key, frame, [...curPalette], 32, 32)

          // Shadow
          const px = visualX, py = visualY
          renderer.drawPixel(px + 10, py + 31, '#000000', 0.1)
          renderer.drawPixel(px + 12, py + 31, '#000000', 0.15)
          renderer.drawPixel(px + 14, py + 31, '#000000', 0.2)
          renderer.drawPixel(px + 16, py + 31, '#000000', 0.25)
          renderer.drawPixel(px + 18, py + 31, '#000000', 0.2)
          renderer.drawPixel(px + 20, py + 31, '#000000', 0.15)
          renderer.drawPixel(px + 22, py + 31, '#000000', 0.1)

          renderer.drawSprite(spriteCanvas, px, py, sd.flip)
        }

        // Above-layer tiles
        renderer.drawAnimatedTiles(TILES, ABOVE, globalTickRef.current, true)
        renderer.drawOverlay()

        // Present
        renderer.present()
      },
    )

    loopRef.current = loop
    loop.start()

    return () => {
      loop.stop()
      loopRef.current = null
    }
  }, []) // Only mount once — sprites update via ref

  // Click-to-move handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    const player = playerRef.current
    if (!canvas || !renderer || !player) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = WIDTH / rect.width
    const scaleY = HEIGHT / rect.height
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY

    // Canvas coords → world coords (add camera offset)
    const worldX = canvasX + renderer.camX
    const worldY = canvasY + renderer.camY

    const clickTileX = Math.floor(worldX / TILE)
    const clickTileY = Math.floor(worldY / TILE)

    const grid = SANDBOX_ZONE.grid
    const rawPath = findPath(grid, player.tileX, player.tileY, clickTileX, clickTileY)
    if (rawPath) {
      const path = smoothPath(grid, rawPath, player.tileX, player.tileY)
      setPath(player, path, { x: clickTileX, y: clickTileY })
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="border border-white/10 rounded-lg cursor-crosshair"
      style={{
        imageRendering: 'pixelated',
        width: displayWidth,
        height: displayHeight,
      }}
    />
  )
}
