'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { importPng, buildColorMap, extractColors, applyColorMap, sliceFrames, pngToImageData, type ColorMapping, type PngImportResult } from './PngImportUtils'

interface PngImportProps {
  open: boolean
  onClose: () => void
  palette: readonly string[]
  gridSize: number
  onImportSingle: (pixels: number[]) => void
  onImportMulti: (frames: number[][]) => void
  species: string
  animName: string
  frameIndex: number
}

export default function PngImport({ open, onClose, palette, gridSize, onImportSingle, onImportMulti, species, animName, frameIndex }: PngImportProps) {
  const [result, setResult] = useState<PngImportResult | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [colorMap, setColorMap] = useState<ColorMapping[]>([])
  const [rawImageData, setRawImageData] = useState<ImageData | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewOrigRef = useRef<HTMLCanvasElement>(null)
  const previewMappedRef = useRef<HTMLCanvasElement>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) { setResult(null); setError(''); setColorMap([]); setRawImageData(null) }
  }, [open])

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/png') && !file.type.startsWith('image/')) {
      setError('Please drop a PNG image'); return
    }
    setError('')
    try {
      const res = await importPng(file, palette, gridSize)
      setResult(res)
      setColorMap(res.colorMap)
      // Store raw image data for re-mapping when user overrides colors
      const imgData = await pngToImageData(file)
      setRawImageData(imgData)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setResult(null)
    }
  }, [palette, gridSize])

  // Re-map pixels when user overrides a color mapping
  const updateMapping = useCallback((idx: number, newPaletteIndex: number) => {
    setColorMap(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], paletteIndex: newPaletteIndex, distance: 0 }
      return next
    })
  }, [])

  // Recompute frames when colorMap changes
  useEffect(() => {
    if (!rawImageData || colorMap.length === 0) return
    const allPixels = applyColorMap(rawImageData, colorMap)
    const frames = sliceFrames(allPixels, rawImageData.width, rawImageData.height, gridSize)
    setResult(prev => prev ? { ...prev, frames, unmappedCount: colorMap.filter(c => c.distance > 0).length } : null)
  }, [colorMap, rawImageData, gridSize])

  // Draw previews
  useEffect(() => {
    if (!result || !rawImageData) return
    // Original preview
    const origCtx = previewOrigRef.current?.getContext('2d')
    if (origCtx && previewOrigRef.current) {
      previewOrigRef.current.width = rawImageData.width
      previewOrigRef.current.height = rawImageData.height
      origCtx.putImageData(rawImageData, 0, 0)
    }
    // Mapped preview — render first frame (or all frames) using palette colors
    const mappedCtx = previewMappedRef.current?.getContext('2d')
    if (mappedCtx && previewMappedRef.current) {
      previewMappedRef.current.width = rawImageData.width
      previewMappedRef.current.height = rawImageData.height
      const imgData = mappedCtx.createImageData(rawImageData.width, rawImageData.height)
      // Rebuild full-width pixel array from frames
      for (let f = 0; f < result.frames.length; f++) {
        const frame = result.frames[f]
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            const pi = frame[y * gridSize + x]
            const di = ((y * rawImageData.width) + (f * gridSize + x)) * 4
            if (pi === 0) {
              imgData.data[di + 3] = 0 // transparent
            } else {
              const hex = palette[pi - 1] || '#ff00ff'
              imgData.data[di] = parseInt(hex.slice(1, 3), 16)
              imgData.data[di + 1] = parseInt(hex.slice(3, 5), 16)
              imgData.data[di + 2] = parseInt(hex.slice(5, 7), 16)
              imgData.data[di + 3] = 255
            }
          }
        }
      }
      mappedCtx.putImageData(imgData, 0, 0)
    }
  }, [result, rawImageData, palette, gridSize])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  if (!open) return null

  const scale = Math.min(4, Math.floor(320 / gridSize))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#0a0a1a]/95 border border-white/15 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm text-white/80 font-medium">Import PNG — {species} / {animName}</span>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg leading-none">&times;</button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {/* Drop zone */}
          {!result && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragging ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/20 hover:border-white/40'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/png,image/gif,image/webp" className="hidden" onChange={handleFileSelect} />
              <p className="text-white/50 text-sm">Drop PNG or click to browse</p>
              <p className="text-white/30 text-[10px] mt-1">
                Single frame: {gridSize}x{gridSize} — Spritesheet: Nx{gridSize} horizontal strip
              </p>
            </div>
          )}

          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

          {/* Preview + color map */}
          {result && (
            <div className="space-y-4">
              {/* Side-by-side preview */}
              <div className="flex gap-4 items-start">
                <div>
                  <span className="text-[9px] text-white/40 block mb-1">Original</span>
                  <canvas
                    ref={previewOrigRef}
                    style={{ width: result.width * scale, height: result.height * scale, imageRendering: 'pixelated' }}
                    className="border border-white/10 rounded bg-[#111]"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-white/40 block mb-1">Palette-mapped</span>
                  <canvas
                    ref={previewMappedRef}
                    style={{ width: result.width * scale, height: result.height * scale, imageRendering: 'pixelated' }}
                    className="border border-white/10 rounded bg-[#111]"
                  />
                </div>
                <div className="text-[10px] text-white/50">
                  <p>{result.frameCount} frame{result.frameCount > 1 ? 's' : ''} detected</p>
                  <p>{result.width}x{result.height}px</p>
                  <p>{colorMap.length} color{colorMap.length !== 1 ? 's' : ''}</p>
                  {result.unmappedCount > 0 && (
                    <p className="text-amber-400">{result.unmappedCount} approximate match{result.unmappedCount > 1 ? 'es' : ''}</p>
                  )}
                </div>
              </div>

              {/* Color map table */}
              {colorMap.length > 0 && (
                <div>
                  <span className="text-[9px] text-white/40 block mb-1">Color mapping</span>
                  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    {colorMap.map((cm, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/5 rounded px-2 py-1">
                        <div className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: cm.hex }} title={cm.hex} />
                        <span className="text-white/30 text-[10px]">→</span>
                        {/* Palette swatch picker */}
                        <div className="flex gap-0.5 flex-wrap">
                          {palette.map((c, pi) => (
                            <button
                              key={pi}
                              className={`w-3.5 h-3.5 rounded-sm border ${cm.paletteIndex === pi + 1 ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-white/10'}`}
                              style={{ backgroundColor: c }}
                              onClick={() => updateMapping(i, pi + 1)}
                              title={`Palette ${pi + 1}: ${c}`}
                            />
                          ))}
                          <button
                            className={`w-3.5 h-3.5 rounded-sm border ${cm.paletteIndex === 0 ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-white/10'}`}
                            style={{ background: 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 4px 4px' }}
                            onClick={() => updateMapping(i, 0)}
                            title="Transparent"
                          />
                        </div>
                        {cm.distance > 0 && <span className="text-amber-400/60 text-[8px]">~{cm.distance}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Frame thumbnails for spritesheets */}
              {result.frameCount > 1 && (
                <div>
                  <span className="text-[9px] text-white/40 block mb-1">Frames</span>
                  <div className="flex gap-1 flex-wrap">
                    {result.frames.map((frame, fi) => (
                      <FrameThumb key={fi} frame={frame} gridSize={gridSize} palette={palette} index={fi} />
                    ))}
                  </div>
                </div>
              )}

              {/* Import buttons */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                {result.frameCount === 1 ? (
                  <button
                    onClick={() => { onImportSingle(result.frames[0]); onClose() }}
                    className="px-4 py-2 rounded text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30"
                  >
                    Import frame
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { onImportMulti(result.frames); onClose() }}
                      className="px-4 py-2 rounded text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30"
                    >
                      Import all {result.frameCount} frames
                    </button>
                    <button
                      onClick={() => { onImportSingle(result.frames[0]); onClose() }}
                      className="px-4 py-2 rounded text-xs bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                    >
                      Import first frame only
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setResult(null); setError(''); setColorMap([]); setRawImageData(null) }}
                  className="px-4 py-2 rounded text-xs bg-white/5 text-white/40 hover:text-white/60"
                >
                  Choose different file
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Tiny frame thumbnail preview */
function FrameThumb({ frame, gridSize, palette, index }: { frame: number[]; gridSize: number; palette: readonly string[]; index: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !canvasRef.current) return
    canvasRef.current.width = gridSize
    canvasRef.current.height = gridSize
    const imgData = ctx.createImageData(gridSize, gridSize)
    for (let i = 0; i < frame.length; i++) {
      const pi = frame[i]
      const di = i * 4
      if (pi === 0) { imgData.data[di + 3] = 0; continue }
      const hex = palette[pi - 1] || '#ff00ff'
      imgData.data[di] = parseInt(hex.slice(1, 3), 16)
      imgData.data[di + 1] = parseInt(hex.slice(3, 5), 16)
      imgData.data[di + 2] = parseInt(hex.slice(5, 7), 16)
      imgData.data[di + 3] = 255
    }
    ctx.putImageData(imgData, 0, 0)
  }, [frame, gridSize, palette])

  return (
    <div className="text-center">
      <canvas
        ref={canvasRef}
        style={{ width: 48, height: 48, imageRendering: 'pixelated' }}
        className="border border-white/10 rounded bg-[#111]"
      />
      <span className="text-[8px] text-white/30 block">{index}</span>
    </div>
  )
}
