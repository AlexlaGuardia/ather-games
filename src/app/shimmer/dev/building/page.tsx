'use client'

// The building vocabulary, in one place, drawn the way the world draws it.
//
// ★ WHY THIS EXISTS. Judging a wall meant loading voxel3d — 30s of worldgen at 19fps — walking to
// a hold, and looking. `dev/hud` made exactly this argument three days ago and paid for itself the
// same evening. Blocks are worse than the HUD, because the thing you are judging is how two
// materials read WHEN MIXED, which needs them side by side and re-rollable, not found in a field.
//
// ★ IT CALLS THE SHIPPED PAINTER. Every tile below is `paintFor(material, face, size)` — the same
// function `makeTileArray` calls to build the texture array the game samples. Nothing here knows
// how a stone is drawn. `dev/icons` states the rule and its history counts seven times a preview
// that re-derived was perfectly correct while the game was wrong.
//
// ⚠⚠ WHAT THIS IS NOT, AND THE PAGE SAYS SO ON ITS FACE. The wall board is a 2D ELEVATION with real
// textures — it is honest about TEXTURE-MIXING and it cannot show RELIEF. Recessed windows and
// outcropped corners, the other half of what the building sources call for, are depth: they exist
// in the 3D world and are invisible here by construction. Reading "the wall looks flat" off this
// page would be reading the instrument, not the wall.
//
// ⚠ `put()` writes ALPHA 0 — that channel is not opacity to the shader. Copying a Layer straight
// into ImageData yields a fully transparent tile and a blank board, so the alpha is forced here.
//
// ⚠ NAMED `building`, NOT `build`, AND THAT IS NOT A PREFERENCE. `.gitignore:5` is a bare `build`,
// which git matches as a directory of that name AT ANY DEPTH — so `dev/build/` was silently
// unaddable and the page would have worked all session on this box and existed in no history
// anywhere. `git add` said so out loud, which is the only reason it was caught; nothing else would
// have. Worth knowing before naming any other directory in this tree.
//
// Run: tools/devwin.sh sprites → http://localhost:3202/shimmer/dev/building   (or /shimmer/dev/building)

import { useEffect, useMemo, useRef, useState } from 'react'
import { MAT } from '../../voxel/depth'
import { blockDef } from '../../voxel/registry'
import { PIECES, ALL_PIECES, PIECE_MATERIALS, basePieceId, pieceMaterial } from '../../voxel/pieces'
import { paintFor, TOP, SIDE } from '../../voxel3d/tex/tiles'

const TILE = 16

/** The building stones and woods, in the order a builder reaches for them. Names come off the registry. */
const WALL_MATERIALS: number[] = [
  MAT.CUT_STONE, MAT.MOSSY_CUT_STONE,
  MAT.STONE_BRICK, MAT.MOSSY_STONE_BRICK, MAT.CRACKED_STONE_BRICK,
  MAT.PALE_BRICK, MAT.SANDSTONE, MAT.RUBBLE, MAT.STONE,
  MAT.PLANKS_GOLDWOOD, MAT.PLANKS_SHIMMEROAK, MAT.PLANKS_DAWNWOOD,
]

const nameOf = (m: number) => blockDef(m)?.name ?? `#${m}`

/** One tile as an ImageData, alpha forced — see the header note on `put()`. */
function tileImage(material: number, face: number): ImageData {
  const layer = paintFor(material, face, TILE)
  const px = new Uint8ClampedArray(TILE * TILE * 4)
  for (let i = 0; i < TILE * TILE; i++) {
    px[i * 4] = layer[i * 4]; px[i * 4 + 1] = layer[i * 4 + 1]
    px[i * 4 + 2] = layer[i * 4 + 2]; px[i * 4 + 3] = 255
  }
  return new ImageData(px, TILE, TILE)
}

/** A tile blown up with no smoothing, so a texel stays a texel. */
function TileSwatch({ material, face, scale }: { material: number; face: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const src = document.createElement('canvas'); src.width = src.height = TILE
    src.getContext('2d')!.putImageData(tileImage(material, face), 0, 0)
    const g = cv.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.clearRect(0, 0, cv.width, cv.height)
    g.drawImage(src, 0, 0, TILE, TILE, 0, 0, cv.width, cv.height)
  }, [material, face, scale])
  return <canvas ref={ref} width={TILE * scale} height={TILE * scale} style={{ imageRendering: 'pixelated' }} />
}

/** Deterministic per-cell hash, so a wall is stable across re-renders and re-rolls on demand. */
function h(x: number, y: number, s: number): number {
  let v = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)
  v = Math.imul(v ^ (v >>> 13), 1274126177)
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296
}

/**
 * A wall elevation. `mix` is the share of cells that take an accent material.
 *
 * ★ THE ACCENTS ARE PICKED PER CELL, NOT IN PATCHES, because that is what the sources describe —
 * "mix in cracked stone brick and andesite so the texture has noise". Patches would be a different
 * technique (weathering zones) and would flatter the result by looking deliberate.
 */
function WallBoard({ base, accents, mix, seed, cols, rows, scale }: {
  base: number; accents: number[]; mix: number; seed: number; cols: number; rows: number; scale: number
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const g = cv.getContext('2d')!; g.imageSmoothingEnabled = false
    const cache = new Map<number, HTMLCanvasElement>()
    const tileOf = (m: number) => {
      let c = cache.get(m)
      if (!c) {
        c = document.createElement('canvas'); c.width = c.height = TILE
        c.getContext('2d')!.putImageData(tileImage(m, SIDE), 0, 0)
        cache.set(m, c)
      }
      return c
    }
    g.clearRect(0, 0, cv.width, cv.height)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const r = h(x, y, seed)
        let m = base
        if (accents.length && r < mix) m = accents[Math.floor(h(x, y, seed + 91) * accents.length) % accents.length]
        g.drawImage(tileOf(m), 0, 0, TILE, TILE, x * TILE * scale, y * TILE * scale, TILE * scale, TILE * scale)
      }
    }
  }, [base, accents, mix, seed, cols, rows, scale])
  return <canvas ref={ref} width={cols * TILE * scale} height={rows * TILE * scale}
                 style={{ imageRendering: 'pixelated', display: 'block' }} />
}

export default function BuildHarness() {
  const [base, setBase] = useState<number>(MAT.STONE_BRICK)
  const [accents, setAccents] = useState<number[]>([MAT.MOSSY_STONE_BRICK, MAT.CRACKED_STONE_BRICK])
  const [mix, setMix] = useState(0.28)
  const [seed, setSeed] = useState(7)
  const [scale, setScale] = useState(3)

  const toggleAccent = (m: number) =>
    setAccents(a => (a.includes(m) ? a.filter(x => x !== m) : [...a, m]))

  // Grouped by hand-written shape, so the board reads as "eight shapes" rather than "56 rows".
  const byShape = useMemo(() => PIECES.map(basePiece => ({
    base: basePiece,
    variants: ALL_PIECES.filter(p => basePieceId(p.id) === basePiece.id),
  })), [])

  return (
    <div className="gx-chrome" style={{ minHeight: '100vh', padding: 24, background: '#12141a', color: '#dfe4ea' }}>
      <h1 className="gx-title" style={{ fontSize: 22, marginBottom: 4 }}>BUILDING VOCABULARY</h1>
      <p className="gx-label" style={{ opacity: 0.75, maxWidth: 760, lineHeight: 1.5 }}>
        Every tile below is <code>paintFor()</code> — the function that builds the texture array the
        game samples. The wall board is a <strong>2D elevation with real textures</strong>: it is
        honest about texture-mixing and <strong>cannot show relief</strong>. Recessed windows and
        outcropped corners are depth and live in the 3D world; their absence here is the board, not
        the wall.
      </p>

      {/* ── the wall board ─────────────────────────────────────────────────────────────────── */}
      <section className="gx-card" style={{ marginTop: 24, padding: 16, background: '#191c24', borderRadius: 8 }}>
        <h2 className="gx-title" style={{ fontSize: 15, marginBottom: 12 }}>THE WALL — flat against mixed</h2>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <figure style={{ margin: 0 }}>
            <WallBoard base={base} accents={[]} mix={0} seed={seed} cols={12} rows={7} scale={scale} />
            <figcaption className="gx-label" style={{ marginTop: 6, opacity: 0.7 }}>
              one material · {nameOf(base)}
            </figcaption>
          </figure>
          <figure style={{ margin: 0 }}>
            <WallBoard base={base} accents={accents} mix={mix} seed={seed} cols={12} rows={7} scale={scale} />
            <figcaption className="gx-label" style={{ marginTop: 6, opacity: 0.7 }}>
              mixed · {Math.round(mix * 100)}% across {accents.length || 0} accent{accents.length === 1 ? '' : 's'}
            </figcaption>
          </figure>
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="gx-label">base&nbsp;
            <select className="gx-btn" value={base} onChange={e => setBase(Number(e.target.value))}>
              {WALL_MATERIALS.map(m => <option key={m} value={m}>{nameOf(m)}</option>)}
            </select>
          </label>
          <label className="gx-label">mix&nbsp;
            <input type="range" min={0} max={0.6} step={0.02} value={mix}
                   onChange={e => setMix(Number(e.target.value))} />
            <span className="gx-value">&nbsp;{Math.round(mix * 100)}%</span>
          </label>
          <label className="gx-label">zoom&nbsp;
            <input type="range" min={1} max={6} step={1} value={scale}
                   onChange={e => setScale(Number(e.target.value))} />
            <span className="gx-value">&nbsp;{scale}×</span>
          </label>
          <button className="gx-btn" onClick={() => setSeed(s => s + 1)}>re-roll</button>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="gx-label" style={{ opacity: 0.7, marginBottom: 6 }}>accents — click to mix in</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {WALL_MATERIALS.map(m => (
              <button key={m} onClick={() => toggleAccent(m)}
                      className={accents.includes(m) ? 'gx-active' : 'gx-inactive'}
                      title={nameOf(m)}
                      style={{
                        padding: 3, borderRadius: 4, lineHeight: 0, cursor: 'pointer',
                        border: accents.includes(m) ? '2px solid #7fd1ff' : '2px solid #2a2f3a',
                        background: 'none',
                      }}>
                <TileSwatch material={m} face={SIDE} scale={2} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── the palette, at ship size and blown up ──────────────────────────────────────────── */}
      <section className="gx-card" style={{ marginTop: 20, padding: 16, background: '#191c24', borderRadius: 8 }}>
        <h2 className="gx-title" style={{ fontSize: 15, marginBottom: 4 }}>THE PALETTE</h2>
        <p className="gx-label" style={{ opacity: 0.7, marginBottom: 12 }}>
          Left column is <strong>16px — the size it ships at</strong>. Art judged only at authoring
          size is art judged at a size no player sees.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          {WALL_MATERIALS.map(m => (
            <div key={m} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <TileSwatch material={m} face={SIDE} scale={1} />
              <TileSwatch material={m} face={SIDE} scale={3} />
              <TileSwatch material={m} face={TOP} scale={3} />
              <div>
                <div className="gx-value" style={{ fontSize: 12 }}>{nameOf(m)}</div>
                <div className="gx-label" style={{ fontSize: 11, opacity: 0.6 }}>
                  side · top · hardness {blockDef(m)?.hardness ?? '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── the piece catalogue ─────────────────────────────────────────────────────────────── */}
      <section className="gx-card" style={{ marginTop: 20, padding: 16, background: '#191c24', borderRadius: 8 }}>
        <h2 className="gx-title" style={{ fontSize: 15, marginBottom: 4 }}>
          THE PIECES — {PIECES.length} shapes, {ALL_PIECES.length} buildable
        </h2>
        <p className="gx-label" style={{ opacity: 0.7, marginBottom: 12 }}>
          Read off <code>ALL_PIECES</code>. A variant is the same shape in another material, so the
          footprint column is identical down each row by construction — if it ever is not, the
          oracle in <code>pieces.test.ts</code> is what says so.
        </p>
        {byShape.map(({ base: b, variants }) => (
          <div key={b.id} style={{ marginBottom: 14 }}>
            <div className="gx-value" style={{ fontSize: 13, marginBottom: 4 }}>
              {b.name} <span className="gx-label" style={{ opacity: 0.55, fontSize: 11 }}>
                · {b.w}×{b.h}×{b.d}{b.halfHeight ? ' · half height' : ''}
                {b.passable ? ` · ${b.passable.length} walkable` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {variants.map(v => {
                const mat = pieceMaterial(v.id)
                return (
                  <span key={v.id} className="gx-label" title={v.id}
                        style={{
                          fontSize: 11, padding: '3px 7px', borderRadius: 4,
                          background: mat?.family === 'stone' ? '#252a33' : '#2c2820',
                          border: v.id === b.id ? '1px solid #7fd1ff' : '1px solid transparent',
                        }}>
                    {mat?.name ?? '—'} <span className="gx-value">{v.cost[0].count}×</span>
                  </span>
                )
              })}
            </div>
          </div>
        ))}
        <div className="gx-label" style={{ opacity: 0.6, fontSize: 11, marginTop: 8 }}>
          Blue outline = the hand-written base, which already wears that material and is not
          duplicated. Warm chips are wood, cool are stone. {PIECE_MATERIALS.length} materials.
        </div>
      </section>
    </div>
  )
}
