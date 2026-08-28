'use client'

// The reference swatch: the actual generated tiles, drawn at TRUE pixel size, 32 above 64.
//
// ★ WHY THIS EXISTS ALONGSIDE THE 3D VIEW. The terrain answers "does the extra resolution reach my
// eye at play distance" — a rendering question. This answers a different one: "how much art am I
// signing up to paint per block." A 64px tile is FOUR TIMES the pixels of a 32px tile, and that cost
// is invisible in a 3D view where both are minified. Seeing them at 1:1, at the size you would
// actually paint them, is the part that decides the workload.

import { useEffect, useRef, useState } from 'react'
import { buildTileArray, sliceLayer, layerOf, TOP, SIDE } from './tiles'
import { MAT } from '../../voxel/depth'
import { SEAM } from '../../voxel/seams'

/** A readable cross-section of the set, not all 43 layers — grass crown, grass flank, the rocks,
 *  the soil, and two ores so the emissive mask is visible as a shape. */
const SHOWN: [number, number, string][] = [
  [MAT.TOPSOIL, TOP, 'grass'],
  [MAT.TOPSOIL, SIDE, 'flank'],
  [MAT.STONE, SIDE, 'stone'],
  [MAT.DEEP_STONE, SIDE, 'deep'],
  [MAT.SUBSOIL, SIDE, 'soil'],
  [MAT.SAND, SIDE, 'sand'],
  [SEAM.RAW_MANA, SIDE, 'mana'],
  [SEAM.ATHER_CRYSTAL, SIDE, 'ather'],
]

export function TileStrip() {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'KeyT') setOpen(o => !o) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) {
    return (
      <div className="absolute bottom-3 right-3 text-[10px] font-mono text-white/40 bg-black/45 rounded px-2 py-1 pointer-events-none">
        T · tiles
      </div>
    )
  }

  return (
    <div className="absolute bottom-3 right-3 bg-black/60 rounded px-3 py-2.5 pointer-events-none">
      <div className="text-[10px] font-mono text-white/70 tracking-wide mb-1.5">
        TILES AT TRUE PIXEL SIZE <span className="text-white/35">· T to hide</span>
      </div>
      <Row size={32} accent="text-emerald-300" />
      <Row size={64} accent="text-amber-300" />
      <div className="text-[9px] font-mono text-white/35 mt-1.5 max-w-[22rem] leading-snug">
        64px is 4x the pixels per tile. Same visual language, genuinely finer grain — not an upscale.
      </div>
    </div>
  )
}

function Row({ size, accent }: { size: number; accent: string }) {
  return (
    <div className="flex items-end gap-1.5 mb-1.5">
      <div className={`text-[10px] font-mono ${accent} w-9 shrink-0`}>{size}px</div>
      {SHOWN.map(([m, f, label]) => (
        <div key={`${m}-${f}`} className="flex flex-col items-center gap-0.5">
          <Swatch size={size} layer={layerOf(m, f)} />
          <div className="text-[8px] font-mono text-white/35">{label}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * One tile, blitted at 1:1 with smoothing off.
 *
 * ⚠ `imageSmoothingEnabled = false` AND `image-rendering: pixelated` are both required and neither is
 * redundant: the first governs the putImageData→canvas path, the second governs how the browser
 * scales the canvas ELEMENT if CSS pixels and device pixels disagree. Miss either on a HiDPI screen
 * and the swatch is a blurred lie about art you have not painted yet.
 */
function Swatch({ size, layer }: { size: number; layer: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    // Generated per swatch rather than hoisted: this runs once, off the render path, and keeping the
    // HUD independent of the scene's tile arrays means neither can quietly desync from the other.
    const all = buildTileArray(size)
    const px = sliceLayer(all, size, layer)
    // ★ FORCE ALPHA OPAQUE. In the tile set, alpha is the EMISSIVE MASK (see writeOre) — zero on
    // every pixel that does not glow. `ImageData` reads that same byte as OPACITY, so blitting the
    // layer verbatim draws stone, soil and grass as fully transparent and the swatch row comes out
    // black, with only the ore crystals visible. The 3D path is unaffected because the shader reads
    // `tile.a` separately and takes opacity from the material. Two consumers, one byte, two meanings.
    for (let i = 3; i < px.length; i += 4) px[i] = 255
    ctx.imageSmoothingEnabled = false
    ctx.putImageData(new ImageData(px, size, size), 0, 0)
  }, [size, layer])

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className="rounded-[2px] ring-1 ring-white/15"
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}
