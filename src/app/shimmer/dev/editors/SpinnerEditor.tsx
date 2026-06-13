'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import EditorShell from '../templates/EditorShell'

/* ── Types ───────────────────────────────────────────────────── */
type Frame = number[][] // 4 rows × 8 cols, values 0|1

/* ── Braille conversion ──────────────────────────────────────── */
// Each braille char covers 2 cols × 4 rows.
// Dot bit positions within Unicode braille block (U+2800):
//   Col 0 (left):  row0=0x01, row1=0x02, row2=0x04, row3=0x40
//   Col 1 (right): row0=0x08, row1=0x10, row2=0x20, row3=0x80
const LEFT_BITS  = [0x01, 0x02, 0x04, 0x40]
const RIGHT_BITS = [0x08, 0x10, 0x20, 0x80]

function frameToBraille(frame: Frame): string {
  // 8 cols → 4 braille chars
  let result = ''
  for (let charIdx = 0; charIdx < 4; charIdx++) {
    const leftCol  = charIdx * 2
    const rightCol = charIdx * 2 + 1
    let bits = 0
    for (let row = 0; row < 4; row++) {
      if (frame[row]?.[leftCol])  bits |= LEFT_BITS[row]
      if (frame[row]?.[rightCol]) bits |= RIGHT_BITS[row]
    }
    result += String.fromCharCode(0x2800 + bits)
  }
  return result
}

/* ── Default data (from /root/akatskii/assets/thinking.json) ─── */
const DEFAULT_FRAMES: Frame[] = [
  [[0,0,1,1,1,1,0,0],[0,1,0,0,0,0,1,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
  [[0,0,0,0,1,1,0,0],[0,0,0,0,0,1,1,0],[0,0,0,0,0,0,1,0],[0,0,0,0,0,0,0,0]],
  [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,1,1],[0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,0]],
  [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,1,1,0],[0,0,0,0,1,1,0,0]],
  [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,1,1,1,1,0,0]],
  [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,1,1,0,0,0,0,0],[0,0,1,1,0,0,0,0]],
  [[0,0,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
  [[0,0,1,1,0,0,0,0],[0,1,1,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
]

const DEFAULT_QUOTES: string[] = [
  'Consulting the cats...',
  'Rummaging through cortex...',
  'Hold on, vibes loading...',
  'Asking Gemini politely...',
  'Brewing an answer...',
  'Let me check my notes...',
  'One neuron at a time...',
  'Poking the database...',
  'Running it through vibes...',
  'Processing... beep boop...',
  'Waking up a brain cell...',
  'Loading personality...',
  'Checking the vibe index...',
  '*elevator music*',
  'Shuffling neurons...',
  'This one\'s juicy, hold on...',
  'Warming up the cortex...',
  'Asking the oracle...',
  'Manifesting a response...',
  'Let me cook...',
  'Summoning brain cells...',
  'Almost there, maybe...',
  'Hmm, interesting question...',
  'Running the numbers...',
  'Hold my coffee...',
  'Paging Dr. Luna...',
  'Consulting my horoscope...',
  'Asking the shadow rooms...',
  'One sec, thinking thoughts...',
  'Vibes are loading...',
  'Checking with the birds...',
  'Let me poke around...',
]

function emptyFrame(): Frame {
  return [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]]
}

function cloneFrame(f: Frame): Frame {
  return f.map(row => [...row]) as Frame
}

/* ── Frame thumbnail ─────────────────────────────────────────── */
function FrameThumb({ frame, active, onClick, onDelete, onMoveUp, onMoveDown, index, total }: {
  frame: Frame
  active: boolean
  onClick: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  index: number
  total: number
}) {
  const braille = frameToBraille(frame)
  return (
    <div
      className={`relative group flex flex-col items-center gap-1 px-1 py-1.5 rounded cursor-pointer transition-all ${
        active
          ? 'bg-violet-500/20 border border-violet-500/60'
          : 'border border-transparent hover:bg-white/5 hover:border-white/10'
      }`}
      onClick={onClick}
    >
      <span className="text-[10px] text-white/20 select-none">{index + 1}</span>
      <span
        className="font-mono select-none text-base leading-none"
        style={{ color: active ? '#a78bfa' : 'rgba(255,255,255,0.4)', letterSpacing: '0.02em' }}
      >
        {braille}
      </span>
      {/* Controls visible on hover */}
      <div className="absolute right-0 top-0 hidden group-hover:flex flex-col gap-0.5 -mr-5">
        <button
          onClick={e => { e.stopPropagation(); onMoveUp() }}
          disabled={index === 0}
          className="w-4 h-4 text-[9px] flex items-center justify-center rounded bg-white/10 text-white/50 hover:bg-white/20 disabled:opacity-20"
        >▴</button>
        <button
          onClick={e => { e.stopPropagation(); onMoveDown() }}
          disabled={index === total - 1}
          className="w-4 h-4 text-[9px] flex items-center justify-center rounded bg-white/10 text-white/50 hover:bg-white/20 disabled:opacity-20"
        >▾</button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="w-4 h-4 text-[9px] flex items-center justify-center rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
        >×</button>
      </div>
    </div>
  )
}

/* ── Pixel canvas ────────────────────────────────────────────── */
const CELL = 40

function PixelCanvas({ frame, onChange }: { frame: Frame; onChange: (f: Frame) => void }) {
  const painting = useRef(false)
  const paintValue = useRef(0)

  const getCell = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / CELL)
    const row = Math.floor((e.clientY - rect.top) / CELL)
    return { col, row }
  }

  const paint = useCallback((row: number, col: number) => {
    if (row < 0 || row >= 4 || col < 0 || col >= 8) return
    onChange(
      frame.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? paintValue.current : c)) : r
      ) as Frame
    )
  }, [frame, onChange])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const { col, row } = getCell(e)
    if (row < 0 || row >= 4 || col < 0 || col >= 8) return
    paintValue.current = frame[row][col] === 1 ? 0 : 1
    painting.current = true
    paint(row, col)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!painting.current) return
    const { col, row } = getCell(e)
    paint(row, col)
  }

  const handleMouseUp = () => { painting.current = false }

  return (
    <div
      className="rounded-lg border border-white/10 bg-black/30 select-none"
      style={{ width: CELL * 8, height: CELL * 4, position: 'relative', cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Grid cells */}
      {frame.map((row, ri) =>
        row.map((val, ci) => (
          <div
            key={`${ri}-${ci}`}
            style={{
              position: 'absolute',
              left: ci * CELL,
              top: ri * CELL,
              width: CELL,
              height: CELL,
              background: val ? '#a78bfa' : '#111118',
              borderRight: '1px solid rgba(255,255,255,0.07)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              boxSizing: 'border-box',
              transition: 'background 0.05s',
            }}
          />
        ))
      )}
      {/* Row labels */}
      {[0,1,2,3].map(ri => (
        <span
          key={ri}
          style={{
            position: 'absolute',
            left: -16,
            top: ri * CELL + CELL / 2 - 7,
            fontSize: 9,
            color: 'rgba(255,255,255,0.2)',
            userSelect: 'none',
            fontFamily: 'monospace',
          }}
        >{ri}</span>
      ))}
      {/* Col labels */}
      {[0,1,2,3,4,5,6,7].map(ci => (
        <span
          key={ci}
          style={{
            position: 'absolute',
            top: -14,
            left: ci * CELL + CELL / 2 - 4,
            fontSize: 9,
            color: 'rgba(255,255,255,0.2)',
            userSelect: 'none',
            fontFamily: 'monospace',
          }}
        >{ci}</span>
      ))}
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────── */
export default function SpinnerEditor() {
  const [frames, setFrames] = useState<Frame[]>(() => DEFAULT_FRAMES.map(cloneFrame))
  const [activeIdx, setActiveIdx] = useState(0)
  const [intervalMs, setIntervalMs] = useState(100)
  const [playing, setPlaying] = useState(true)
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0)
  const [previewQuoteIdx, setPreviewQuoteIdx] = useState(0)
  const [quotes, setQuotes] = useState<string[]>([...DEFAULT_QUOTES])
  const [newQuote, setNewQuote] = useState('')
  const [editingQuoteIdx, setEditingQuoteIdx] = useState<number | null>(null)
  const [editingQuoteVal, setEditingQuoteVal] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const activeFrame = frames[activeIdx] ?? emptyFrame()

  /* ── Animation ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setPreviewFrameIdx(i => (i + 1) % frames.length)
      setPreviewQuoteIdx(i => (i + 1) % quotes.length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [playing, intervalMs, frames.length, quotes.length])

  /* ── Frame ops ─────────────────────────────────────────────── */
  const updateFrame = useCallback((f: Frame) => {
    setFrames(prev => prev.map((fr, i) => i === activeIdx ? f : fr))
  }, [activeIdx])

  const addFrame = () => {
    const copy = cloneFrame(frames[activeIdx] ?? emptyFrame())
    setFrames(prev => {
      const next = [...prev]
      next.splice(activeIdx + 1, 0, copy)
      return next
    })
    setActiveIdx(activeIdx + 1)
  }

  const deleteFrame = (idx: number) => {
    if (frames.length <= 1) return
    setFrames(prev => prev.filter((_, i) => i !== idx))
    setActiveIdx(prev => Math.min(prev, frames.length - 2))
  }

  const moveFrame = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= frames.length) return
    setFrames(prev => {
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
    setActiveIdx(target)
  }

  /* ── Frame tools ───────────────────────────────────────────── */
  const clearFrame = () => updateFrame(emptyFrame())
  const invertFrame = () => updateFrame(activeFrame.map(row => row.map(v => v ? 0 : 1)) as Frame)
  const copyFrame   = () => addFrame()

  /* ── Quote ops ─────────────────────────────────────────────── */
  const addQuote = () => {
    const trimmed = newQuote.trim()
    if (!trimmed) return
    setQuotes(prev => [...prev, trimmed])
    setNewQuote('')
  }

  const deleteQuote = (idx: number) => {
    setQuotes(prev => prev.filter((_, i) => i !== idx))
    if (previewQuoteIdx >= quotes.length - 1) setPreviewQuoteIdx(0)
  }

  const startEditQuote = (idx: number) => {
    setEditingQuoteIdx(idx)
    setEditingQuoteVal(quotes[idx])
  }

  const saveEditQuote = () => {
    if (editingQuoteIdx === null) return
    const trimmed = editingQuoteVal.trim()
    if (!trimmed) return
    setQuotes(prev => prev.map((q, i) => i === editingQuoteIdx ? trimmed : q))
    setEditingQuoteIdx(null)
    setEditingQuoteVal('')
  }

  /* ── Save ──────────────────────────────────────────────────── */
  const save = async () => {
    setSaveStatus('saving')
    const payload = {
      grid_size: [8, 4],
      interval_ms: intervalMs,
      frames,
      quotes,
    }
    try {
      const res = await fetch('http://localhost:8200/luna/thinking-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }

  /* ── Styles ────────────────────────────────────────────────── */
  const btn = 'px-3 py-1.5 rounded text-xs font-medium transition-all'
  const btnDim = `${btn} bg-white/5 text-white/60 hover:bg-white/10 hover:text-white`
  const btnViolet = `${btn} bg-violet-500/20 text-violet-300 hover:bg-violet-500/30`
  const btnRed = `${btn} bg-red-500/10 text-red-400 hover:bg-red-500/20`

  const currentBraille = frameToBraille(activeFrame)
  const previewBraille = frameToBraille(frames[previewFrameIdx] ?? emptyFrame())
  const previewQuote   = quotes[previewQuoteIdx] ?? ''

  return (
    <EditorShell
      title="Spinner Editor"
      subtitle="Paint frames for the Luna CLI thinking animation."
      headerActions={
        <div className="flex items-center gap-2 ml-auto">
          <button className={btnDim} onClick={clearFrame}>Clear</button>
          <button className={btnDim} onClick={invertFrame}>Invert</button>
          <button className={btnDim} onClick={copyFrame}>Copy Frame</button>
          <button
            className={`${btn} ${
              saveStatus === 'saving' ? 'bg-amber-500/20 text-amber-300 animate-pulse' :
              saveStatus === 'saved'  ? 'bg-green-500/20 text-green-300' :
              saveStatus === 'error'  ? 'bg-red-500/20 text-red-300' :
              'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
            }`}
            onClick={save}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' :
             saveStatus === 'saved'  ? 'Saved!' :
             saveStatus === 'error'  ? 'Error' : 'Save to Luna'}
          </button>
        </div>
      }
    >
      <div className="flex gap-5">

        {/* ── Frame list ──────────────────────────────────────── */}
        <div className="flex flex-col gap-1 min-w-[60px]">
          <span className="text-[9px] text-white/25 uppercase tracking-wider mb-1 select-none">Frames</span>
          <div className="flex flex-col gap-0.5 pr-6">
            {frames.map((frame, i) => (
              <FrameThumb
                key={i}
                frame={frame}
                active={i === activeIdx}
                index={i}
                total={frames.length}
                onClick={() => setActiveIdx(i)}
                onDelete={() => deleteFrame(i)}
                onMoveUp={() => moveFrame(i, -1)}
                onMoveDown={() => moveFrame(i, 1)}
              />
            ))}
          </div>
          <button
            className="mt-1 text-[11px] text-white/30 hover:text-violet-400 transition-colors py-1 rounded hover:bg-violet-500/10 text-center"
            onClick={addFrame}
          >+ frame</button>
        </div>

        {/* ── Canvas + right panels ────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-5">

          {/* Canvas row */}
          <div className="flex gap-8 items-start">
            {/* Canvas */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-white/25 uppercase tracking-wider select-none">
                Frame {activeIdx + 1} of {frames.length}
              </span>
              <div className="pl-5 pt-3">
                <PixelCanvas frame={activeFrame} onChange={updateFrame} />
              </div>
            </div>

            {/* Right: preview + controls */}
            <div className="flex flex-col gap-4 min-w-[240px]">

              {/* Animation preview */}
              <div>
                <span className="text-[9px] text-white/25 uppercase tracking-wider select-none">Animation Preview</span>
                <div className="mt-1.5 bg-[#0d1117] rounded-lg px-4 py-3 border border-white/10 font-mono text-sm">
                  <span style={{ color: '#a78bfa', letterSpacing: '0.05em' }}>{previewBraille}</span>
                  <span className="text-white/40 ml-2 text-xs">{previewQuote}</span>
                </div>
              </div>

              {/* Current frame braille */}
              <div>
                <span className="text-[9px] text-white/25 uppercase tracking-wider select-none">Current Frame (braille)</span>
                <div className="mt-1.5 bg-[#0d1117] rounded-lg px-4 py-3 border border-white/10 font-mono">
                  <span style={{ color: '#a78bfa', fontSize: 28, letterSpacing: '0.1em' }}>{currentBraille}</span>
                </div>
              </div>

              {/* Speed control */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] text-white/25 uppercase tracking-wider select-none">Speed</span>
                  <span className="text-[10px] text-white/40">{intervalMs}ms</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={300}
                  step={10}
                  value={intervalMs}
                  onChange={e => setIntervalMs(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-[9px] text-white/20 mt-0.5">
                  <span>50ms fast</span>
                  <span>300ms slow</span>
                </div>
              </div>

              {/* Play/pause */}
              <button
                className={playing ? btnRed : btnViolet}
                onClick={() => setPlaying(p => !p)}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
            </div>
          </div>

          {/* ── Quotes section ──────────────────────────────────── */}
          <div className="border-t border-white/10 pt-4">
            <span className="text-[9px] text-white/25 uppercase tracking-wider select-none">Thinking Quotes</span>
            <div className="mt-2 flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
              {quotes.map((q, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs group ${
                    i === previewQuoteIdx ? 'bg-violet-500/10 border border-violet-500/20' : 'hover:bg-white/5'
                  }`}
                >
                  {editingQuoteIdx === i ? (
                    <>
                      <input
                        className="flex-1 bg-black/40 border border-white/20 rounded px-2 py-0.5 text-white/80 text-xs font-mono focus:outline-none focus:border-violet-500/50"
                        value={editingQuoteVal}
                        onChange={e => setEditingQuoteVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEditQuote(); if (e.key === 'Escape') setEditingQuoteIdx(null) }}
                        autoFocus
                      />
                      <button className="text-[10px] text-emerald-400 hover:text-emerald-300" onClick={saveEditQuote}>ok</button>
                      <button className="text-[10px] text-white/30 hover:text-white/60" onClick={() => setEditingQuoteIdx(null)}>esc</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-white/60 font-mono">{q}</span>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-white/30 hover:text-white/60 transition-opacity"
                        onClick={() => startEditQuote(i)}
                      >edit</button>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400/60 hover:text-red-400 transition-opacity"
                        onClick={() => deleteQuote(i)}
                      >del</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add quote input */}
            <div className="flex gap-2 mt-3">
              <input
                className="flex-1 bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs text-white/70 font-mono placeholder:text-white/20 focus:outline-none focus:border-violet-500/40"
                placeholder="Add a thinking quote..."
                value={newQuote}
                onChange={e => setNewQuote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addQuote() }}
              />
              <button className={btnViolet} onClick={addQuote}>Add</button>
            </div>
          </div>
        </div>
      </div>
    </EditorShell>
  )
}
