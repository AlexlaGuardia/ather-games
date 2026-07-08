'use client'

// VAULT — map editor (/vault/dev). Desktop tool. Seed a level from the procedural
// generator, then tweak it: drag platforms, drop motes / foes / spikes, move the
// finish. Test-play it in-place (same engine, blockout render — the Vault skin is
// cosmetic and blockout reads the layout more clearly). Export JSON for the ladder.
//
// Coords are world-space: x = distance, y = VH-space (smaller y = higher). Platforms
// are Seg{x0,x1,top}; foe/spike carry feet-y (sit on a platform top); motes float free.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  VH, TOP_MIN, TOP_MAX, TOP_BASE, RUNNER_SX, RUNNER_W, RUNNER_H,
  FOE_W, FOE_H, ENDLESS_CFG, bakeLevel, makeAuthoredWorld, tick, pressJump, releaseJump,
  type AuthoredLevel, type World, type MovementCfg,
} from '../lib/vault'

type Tool = 'platform' | 'mote' | 'foe' | 'spike' | 'erase' | 'move'
const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'platform', label: '▭ Platform', hint: 'drag to draw a ledge' },
  { id: 'mote', label: '● Mote', hint: 'click to drop (floats)' },
  { id: 'foe', label: '✖ Foe', hint: 'click a ledge (stompable)' },
  { id: 'spike', label: '▲ Spike', hint: 'click a ledge (leap only)' },
  { id: 'move', label: '✥ Move', hint: 'drag a piece to reposition' },
  { id: 'erase', label: '⌫ Erase', hint: 'click a piece to delete' },
]

const STORE_KEY = 'vault.dev.level'
const GRID_X = 20
const SNAP = (v: number, g: number) => Math.round(v / g) * g
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const editorCfg = (end: number): MovementCfg => ({ ...ENDLESS_CFG, goalDist: end })

const COL = { bg: '#0d0b14', grid: '#241d33', ledge: '#3b4b63', ledgeTop: '#8fb0d8', mote: '#ffd15c', foe: '#71717a', spike: '#e8554e', finish: '#7fe0a0', runner: '#fff2b0' }

function emptyLevel(end = 5000): AuthoredLevel {
  return { seed: 1, end, segs: [{ x0: -RUNNER_SX, x1: 900, top: TOP_BASE }], foes: [], spikes: [], motes: [] }
}

export default function VaultDevPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [level, setLevel] = useState<AuthoredLevel>(emptyLevel)
  const levelRef = useRef(level); levelRef.current = level
  const [tool, setTool] = useState<Tool>('platform')
  const toolRef = useRef(tool); toolRef.current = tool
  const [camX, setCamX] = useState(0)
  const camXRef = useRef(0); camXRef.current = camX
  const [scale, setScale] = useState(1.4)
  const scaleRef = useRef(scale); scaleRef.current = scale
  const [testing, setTesting] = useState(false)
  const testRef = useRef(false); testRef.current = testing
  const worldRef = useRef<World | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [exportText, setExportText] = useState('')
  const [ioMsg, setIoMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dims, setDims] = useState({ w: 960, h: Math.round(VH * 1.4) })

  // drag state (edit mode)
  const drag = useRef<{ kind: 'platform' | 'move' | 'pan'; x0: number; y0: number; ref?: unknown; camStart?: number } | null>(null)
  const [preview, setPreview] = useState<{ x0: number; x1: number; top: number } | null>(null)
  const previewRef = useRef(preview); previewRef.current = preview
  const testResultRef = useRef(testResult); testResultRef.current = testResult

  // ── load / autosave ─────────────────────────────────────────────────────────
  useEffect(() => {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) setLevel(JSON.parse(raw)) } catch {}
  }, [])
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(levelRef.current)) } catch {} }, 400)
    return () => clearTimeout(t)
  }, [level])

  // ── size to container ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const measure = () => { const w = el.clientWidth; const sc = Math.max(0.5, Math.min(1.6, w / 1100)); setScale(sc); setDims({ w, h: Math.round(VH * sc) }) } // ~1100 world units across, height letterboxed to match
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect()
  }, [])

  // ── coordinate transforms ──────────────────────────────────────────────────────
  const s2w = useCallback((px: number, py: number) => ({ x: px / scaleRef.current + camXRef.current, y: py / scaleRef.current }), [])

  // ── render loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0, last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now
      const cv = canvasRef.current; if (!cv) { raf = requestAnimationFrame(loop); return }
      const ctx = cv.getContext('2d')!; const sc = scaleRef.current
      // advance test sim
      if (testRef.current && worldRef.current) {
        const w = worldRef.current
        if (w.state === 'playing') { tick(w, dt); camXRef.current = w.dist - RUNNER_SX / sc }
        else if (!testResultRef.current) setTestResult(w.state === 'won' ? 'CLEARED ✦' : 'THE GREY TOOK IT')
      }
      draw(ctx, cv.width, cv.height, sc)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function draw(ctx: CanvasRenderingContext2D, W: number, H: number, sc: number) {
    const cam = camXRef.current, lvl = levelRef.current
    const wx = (x: number) => (x - cam) * sc, wy = (y: number) => y * sc
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H)
    // grid + guide lines
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.fillStyle = '#4a3f63'
    const startX = Math.floor(cam / 100) * 100
    for (let x = startX; wx(x) < W; x += 100) { const px = wx(x); ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke(); ctx.fillText(String(x), px + 2, H - 4) }
    for (const gy of [TOP_MIN, TOP_BASE, TOP_MAX]) { ctx.strokeStyle = '#1c1730'; ctx.beginPath(); ctx.moveTo(0, wy(gy)); ctx.lineTo(W, wy(gy)); ctx.stroke() }
    // death line
    ctx.strokeStyle = '#3a1d24'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, wy(VH)); ctx.lineTo(W, wy(VH)); ctx.stroke(); ctx.setLineDash([])
    // platforms
    for (const s of lvl.segs) {
      const x = wx(s.x0), w = (s.x1 - s.x0) * sc, y = wy(s.top)
      ctx.fillStyle = COL.ledge; ctx.fillRect(x, y, w, wy(VH) - y)
      ctx.fillStyle = COL.ledgeTop; ctx.fillRect(x, y - 2 * sc, w, 3 * sc)
    }
    // motes
    for (const m of lvl.motes) { if (m.got) continue; ctx.fillStyle = COL.mote; ctx.beginPath(); ctx.arc(wx(m.x), wy(m.y), 5 * sc, 0, 7); ctx.fill() }
    // foes
    for (const f of lvl.foes) { if (f.dead) continue; ctx.fillStyle = COL.foe; ctx.fillRect(wx(f.x) - FOE_W * sc / 2, wy(f.y) - FOE_H * sc, FOE_W * sc, FOE_H * sc) }
    // spikes
    ctx.fillStyle = COL.spike
    for (const sp of lvl.spikes) { const cx = wx(sp.x), by = wy(sp.y); ctx.beginPath(); ctx.moveTo(cx, by - 20 * sc); ctx.lineTo(cx - 11 * sc, by); ctx.lineTo(cx + 11 * sc, by); ctx.closePath(); ctx.fill() }
    // finish
    const fx = wx(lvl.end); ctx.strokeStyle = COL.finish; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, wy(VH)); ctx.stroke(); ctx.fillStyle = COL.finish; ctx.fillText('FINISH', fx + 4, 14)
    ctx.lineWidth = 1
    // preview platform
    const pv = previewRef.current
    if (pv) { ctx.strokeStyle = COL.ledgeTop; ctx.strokeRect(wx(pv.x0), wy(pv.top), (pv.x1 - pv.x0) * sc, wy(VH) - wy(pv.top)) }
    // runner (test) or start marker (edit)
    if (testRef.current && worldRef.current) {
      const w = worldRef.current
      ctx.fillStyle = COL.runner; ctx.fillRect(wx(w.dist) - RUNNER_W * sc / 2, wy(w.y) - RUNNER_H * sc, RUNNER_W * sc, RUNNER_H * sc)
    } else {
      ctx.strokeStyle = COL.runner; ctx.strokeRect(wx(0) - RUNNER_W * sc / 2, wy(TOP_BASE) - RUNNER_H * sc, RUNNER_W * sc, RUNNER_H * sc)
    }
  }

  // ── hit testing (edit) ─────────────────────────────────────────────────────────
  const segTopAt = (x: number): number => { const s = levelRef.current.segs.find((s) => x >= s.x0 && x <= s.x1); return s ? s.top : TOP_BASE }
  function pick(wx: number, wy: number) {
    const lvl = levelRef.current
    for (let i = lvl.motes.length - 1; i >= 0; i--) { const m = lvl.motes[i]; if (Math.hypot(m.x - wx, m.y - wy) < 14) return { t: 'mote' as const, i } }
    for (let i = lvl.foes.length - 1; i >= 0; i--) { const f = lvl.foes[i]; if (Math.abs(f.x - wx) < FOE_W / 2 + 4 && wy > f.y - FOE_H && wy < f.y + 6) return { t: 'foe' as const, i } }
    for (let i = lvl.spikes.length - 1; i >= 0; i--) { const s = lvl.spikes[i]; if (Math.abs(s.x - wx) < 14 && wy > s.y - 22 && wy < s.y + 6) return { t: 'spike' as const, i } }
    for (let i = lvl.segs.length - 1; i >= 0; i--) { const s = lvl.segs[i]; if (wx >= s.x0 && wx <= s.x1 && wy >= s.top - 6) return { t: 'seg' as const, i } }
    return null
  }

  // ── pointer handlers ────────────────────────────────────────────────────────
  function onDown(e: React.PointerEvent) {
    if (testRef.current) { if (worldRef.current) pressJump(worldRef.current); return }
    const rect = canvasRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    const { x, y } = s2w(px, py)
    if (e.button === 1 || e.shiftKey) { drag.current = { kind: 'pan', x0: px, y0: py, camStart: camXRef.current }; return }
    const t = toolRef.current
    if (t === 'platform') { const sx = Math.max(0, SNAP(x, GRID_X)); const top = clamp(SNAP(y, 4), TOP_MIN, TOP_MAX); drag.current = { kind: 'platform', x0: sx, y0: top }; setPreview({ x0: sx, x1: sx, top }); return }
    if (t === 'mote') { setLevel((L) => ({ ...L, motes: [...L.motes, { x: SNAP(x, GRID_X), y: clamp(SNAP(y, 8), TOP_MIN - 70, TOP_MAX), got: false }] })); return }
    if (t === 'foe') { const fx = SNAP(x, GRID_X); setLevel((L) => ({ ...L, foes: [...L.foes, { x: fx, y: segTopAt(fx), dead: false }] })); return }
    if (t === 'spike') { const sx = SNAP(x, GRID_X); setLevel((L) => ({ ...L, spikes: [...L.spikes, { x: sx, y: segTopAt(sx) }] })); return }
    if (t === 'erase') { const p = pick(x, y); if (p) eraseAt(p); return }
    if (t === 'move') { const p = pick(x, y); if (p) drag.current = { kind: 'move', x0: x, y0: y, ref: p } }
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current; if (!d || testRef.current) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    const { x, y } = s2w(px, py)
    if (d.kind === 'pan') { setCamX(Math.max(-RUNNER_SX, d.camStart! - (px - d.x0) / scaleRef.current)); return }
    if (d.kind === 'platform') { const x1 = Math.max(d.x0 + GRID_X, SNAP(x, GRID_X)); setPreview({ x0: d.x0, x1, top: d.y0 }); return }
    if (d.kind === 'move') { moveRef(d.ref as ReturnType<typeof pick>, x, y); d.x0 = x; d.y0 = y }
  }
  function onUp() {
    const d = drag.current; drag.current = null
    if (!d) return
    if (d.kind === 'platform' && preview && preview.x1 > preview.x0) {
      const p = preview; setLevel((L) => ({ ...L, segs: [...L.segs, { x0: p.x0, x1: p.x1, top: p.top }] }))
    }
    setPreview(null)
  }
  function eraseAt(p: NonNullable<ReturnType<typeof pick>>) {
    setLevel((L) => {
      if (p.t === 'mote') return { ...L, motes: L.motes.filter((_, i) => i !== p.i) }
      if (p.t === 'foe') return { ...L, foes: L.foes.filter((_, i) => i !== p.i) }
      if (p.t === 'spike') return { ...L, spikes: L.spikes.filter((_, i) => i !== p.i) }
      return { ...L, segs: L.segs.filter((_, i) => i !== p.i) }
    })
  }
  function moveRef(p: ReturnType<typeof pick>, x: number, y: number) {
    if (!p) return
    setLevel((L) => {
      if (p.t === 'mote') { const motes = L.motes.slice(); motes[p.i] = { ...motes[p.i], x: SNAP(x, GRID_X), y: clamp(SNAP(y, 8), TOP_MIN - 70, TOP_MAX) }; return { ...L, motes } }
      if (p.t === 'foe') { const foes = L.foes.slice(); const fx = SNAP(x, GRID_X); foes[p.i] = { ...foes[p.i], x: fx, y: segTopAt(fx) }; return { ...L, foes } }
      if (p.t === 'spike') { const spikes = L.spikes.slice(); const sx = SNAP(x, GRID_X); spikes[p.i] = { x: sx, y: segTopAt(sx) }; return { ...L, spikes } }
      const segs = L.segs.slice(); const s = segs[p.i]; const w = s.x1 - s.x0; const nx = Math.max(0, SNAP(x - w / 2, GRID_X)); segs[p.i] = { x0: nx, x1: nx + w, top: clamp(SNAP(y, 4), TOP_MIN, TOP_MAX) }; return { ...L, segs }
    })
  }

  // ── actions ─────────────────────────────────────────────────────────────────
  const reroll = () => { const seed = ((Math.floor((camX + 1) * 2654435761) ^ (level.segs.length * 40503) ^ Date.now()) >>> 0) || 1; setLevel(bakeLevel(seed, editorCfg(level.end), level.end)) }
  const clearAll = () => setLevel(emptyLevel(level.end))
  const setEnd = (end: number) => setLevel((L) => ({ ...L, end: clamp(Math.round(end), 1200, 40000) }))
  const startTest = () => { setTestResult(null); const w = makeAuthoredWorld(levelRef.current, editorCfg(levelRef.current.end)); w.state = 'playing'; worldRef.current = w; setCamX(0); setTesting(true) }
  const stopTest = () => { setTesting(false); worldRef.current = null; setTestResult(null); setCamX(0) }
  const doExport = () => {
    const j = JSON.stringify(level); setExportText(j)
    setIoMsg({ ok: true, text: '✓ exported to the box below' })
    navigator.clipboard?.writeText(j).then(() => setIoMsg({ ok: true, text: '✓ copied to clipboard' })).catch(() => {})
  }
  // validate + normalize a pasted level so a partial/typo'd paste can't silently break the canvas.
  const doImport = () => {
    let raw: unknown
    try { raw = JSON.parse(exportText) } catch { setIoMsg({ ok: false, text: '✗ not valid JSON — paste the full level text' }); return }
    const r = raw as Partial<AuthoredLevel>
    if (!r || !Array.isArray(r.segs) || !r.segs.length) { setIoMsg({ ok: false, text: '✗ no platforms found — is this a Vault level?' }); return }
    const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
    const L: AuthoredLevel = {
      seed: num(r.seed, 1) || 1,
      end: clamp(Math.round(num(r.end, 5000)), 1200, 40000),
      segs: r.segs.map((s) => ({ x0: num(s.x0), x1: num(s.x1), top: num(s.top, TOP_BASE) })),
      foes: Array.isArray(r.foes) ? r.foes.map((f) => ({ x: num(f.x), y: num(f.y, TOP_BASE), dead: false })) : [],
      spikes: Array.isArray(r.spikes) ? r.spikes.map((s) => ({ x: num(s.x), y: num(s.y, TOP_BASE) })) : [],
      motes: Array.isArray(r.motes) ? r.motes.map((m) => ({ x: num(m.x), y: num(m.y, TOP_BASE), got: false })) : [],
    }
    setLevel(L); setCamX(0)
    setIoMsg({ ok: true, text: `✓ imported — ${L.segs.length} plat · ${L.foes.length} foe · ${L.spikes.length} spike · ${L.motes.length} mote · end ${L.end}` })
  }

  // keyboard: space = jump (test), esc = stop test
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); if (testRef.current && worldRef.current) pressJump(worldRef.current) }
      if (e.code === 'Escape' && testRef.current) stopTest()
    }
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space' && testRef.current && worldRef.current) releaseJump(worldRef.current) }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = `${level.segs.length} plat · ${level.foes.length} foe · ${level.spikes.length} spike · ${level.motes.length} mote`

  return (
    <div className="min-h-[100svh] bg-[#0a0810] text-slate-200 font-sans select-none" style={{ touchAction: 'none' }}>
      <div className="mx-auto max-w-[1100px] px-4 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-black tracking-tight text-amber-200">Vault · Map Editor</h1>
            <div className="text-[11px] text-slate-500">seed then tweak · {counts} · end {level.end}</div>
          </div>
          <button onClick={() => router.push('/vault')} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">‹ Vault</button>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {!testing && TOOLS.map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.hint}
              className={`rounded-md px-2.5 py-1.5 text-sm border ${tool === t.id ? 'bg-amber-400/20 border-amber-300/60 text-amber-100' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>{t.label}</button>
          ))}
          <div className="flex-1" />
          {!testing ? (
            <>
              <button onClick={reroll} className="rounded-md px-2.5 py-1.5 text-sm bg-white/5 border border-white/10 hover:bg-white/10">⟳ Reroll</button>
              <button onClick={clearAll} className="rounded-md px-2.5 py-1.5 text-sm bg-white/5 border border-white/10 hover:bg-white/10">Clear</button>
              <button onClick={startTest} className="rounded-md px-3 py-1.5 text-sm font-bold bg-emerald-500/25 border border-emerald-400/50 text-emerald-100 hover:bg-emerald-500/35">▶ Test Play</button>
            </>
          ) : (
            <button onClick={stopTest} className="rounded-md px-3 py-1.5 text-sm font-bold bg-rose-500/25 border border-rose-400/50 text-rose-100 hover:bg-rose-500/35">■ Stop (Esc)</button>
          )}
        </div>

        {/* canvas */}
        <div ref={wrapRef} className="relative w-full rounded-xl overflow-hidden border border-white/10">
          <canvas ref={canvasRef} width={dims.w} height={dims.h} style={{ width: '100%', height: dims.h, display: 'block', cursor: testing ? 'pointer' : tool === 'erase' ? 'not-allowed' : 'crosshair' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} />
          {testing && (
            <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 text-center">
              {testResult ? <div className="text-lg font-black text-amber-200">{testResult} · Esc to edit</div>
                : <div className="text-xs text-slate-300/80 bg-black/40 rounded px-2 py-0.5">SPACE / click = jump · reach the finish</div>}
            </div>
          )}
        </div>

        {/* scrub + length (edit only) */}
        {!testing && (
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-14">scroll</span>
              <input type="range" min={-RUNNER_SX} max={level.end} value={camX} onChange={(e) => setCamX(Number(e.target.value))} className="flex-1" />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-14">length</span>
              <input type="range" min={1200} max={20000} step={100} value={level.end} onChange={(e) => setEnd(Number(e.target.value))} className="flex-1" />
              <span className="w-12 tabular-nums text-right">{level.end}</span>
            </label>
            <div className="text-[11px] text-slate-500">shift-drag or middle-drag to pan · {TOOLS.find((t) => t.id === tool)?.hint}</div>
          </div>
        )}

        {/* export / import */}
        {!testing && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1">
              <button onClick={doExport} className="rounded-md px-2.5 py-1 text-xs bg-white/5 border border-white/10 hover:bg-white/10">Export → clipboard</button>
              <button onClick={doImport} className="rounded-md px-2.5 py-1 text-xs bg-white/5 border border-white/10 hover:bg-white/10">Import ↓ from box</button>
              {ioMsg && <span className={`text-xs font-medium ${ioMsg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{ioMsg.text}</span>}
            </div>
            <textarea value={exportText} onChange={(e) => setExportText(e.target.value)} placeholder="level JSON appears here on export; paste + Import to load"
              className="w-full h-20 rounded-md bg-black/40 border border-white/10 p-2 text-[10px] font-mono text-slate-400" />
          </div>
        )}
      </div>
    </div>
  )
}
