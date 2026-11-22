'use client'

// ── BETA M62: THE TERRAIN EDITOR (/shimmer/dev?mode=terrain, owner only: the proxy 403s /shimmer/dev and /shimmer/save-*) ──
// Alex 11-21: sculpt the REAL Wilds from the dev tools, top-down and bare. Pick a tile, paint with RAISE / LOWER / FLATTEN (to the
// height under the first click) / SMOOTH, radius + strength, undo / redo, SAVE. Saving writes the edit layer
// (open/ather/wilds-edits.ts: sparse per-vertex deltas in world/wilds-edits.json) that the game's parse adds after relief and the
// void carve, so what is sculpted here is what keepers walk on the next load. Never the in-game B editor M38 had (Alex killed it).
//
// The ground shown is the game's ground: the tile and its 8 neighbours are parsed exactly as the Wilds stream does (zones, path
// clearing, road field, voids) but WITHOUT edits, kept as a base, and the edits are added on top live. The brush reaches into
// the neighbours, so a stroke on an edge raises both sides of the seam and the saved tiles meet.

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { loadWilds, type WildsMeta } from '../../open/ather/wilds'
import { loadIndex, makeWorld, zonesOf, tileOf, TILE_M, type WildsWorld } from '../../open/ather/wilds-world'
import { loadNetwork, clearing, roadField } from '../../open/ather/network'
import { makeVoids } from '../../open/ather/wilds-voids'
import { applyBrush, mergeEdits, EditHistory, BRUSHES, paintWater, foldWater, WATER_PREFIX, FALLS_PREFIX, addFall, removeFallsNear, fallLines, fallSheets, ponds, type Brush, type Edits, type BrushTile, type WaterMap } from '../../open/ather/wilds-edits'

import { ramp } from './terrain-ramp'
import type { FlyTile } from './BuilderFly'
const BuilderFly = dynamic(() => import('./BuilderFly'), { ssr: false })   // M83 s1b: three only loads when Fly is opened
import { AUTOSAVE_MS, savedAgo, type Layer, type Index } from '../../world/builder'

// ── BETA M83 p1 s1a: the editor works on the World Builder DRAFT (world/builder.ts), never on the live layer. Save + autosave write
// the draft; PUBLISH makes it a version and puts it live; the history rolls back to any version. Players see nothing until Publish.
interface BSnap { draft: Layer; draftAt: number | null; index: Index; state: 'unpublished changes' | 'matches live' }
const MAP = 'wilds'
async function builderCall(body?: Record<string, unknown>): Promise<BSnap | null> {
  try {
    const r = body ? await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: MAP, ...body }) })
      : await fetch(`/shimmer/save-builder?map=${MAP}`, { cache: 'no-store' })
    return r.ok ? await r.json() as BSnap : null
  } catch { return null }
}
const isCheck = (n: string) => n.startsWith('check:')

interface Base { meta: WildsMeta; tx: number; ty: number; h: Float32Array; voided?: Uint8Array }
type Tool = Brush | 'water' | 'dry' | 'falls'
const TOOLS: Tool[] = [...BRUSHES, 'water', 'dry', 'falls']
const TOOL_KEY: Record<Tool, string> = { raise: 'Raise', lower: 'Lower', flatten: 'Flatten', smooth: 'Smooth', water: 'Water', dry: 'Dry', falls: 'Falls' }
// the editor keeps heights and water in ONE store (so one undo history covers both): '<tile>' = heights, 'water/<tile>' = water
const wkey = (t: string) => WATER_PREFIX + t, fkey = (t: string) => FALLS_PREFIX + t
const tileOfKey = (k: string) => k.startsWith(WATER_PREFIX) ? k.slice(WATER_PREFIX.length) : k.startsWith(FALLS_PREFIX) ? k.slice(FALLS_PREFIX.length) : k
const TICK_MS = 50

export default function TerrainEditor() {
  const [status, setStatus] = useState('loading the Wilds index…')
  const [tiles, setTiles] = useState<{ name: string; tx: number; ty: number; land: number }[]>([])
  const [tile, setTile] = useState('first-wilds')
  const [brush, setBrush] = useState<Tool>('raise')
  const [level, setLevel] = useState<number | null>(null)   // water level (m, absolute); null = the first Water click picks ground + 1 m
  const [picking, setPicking] = useState(false)
  const [fallW, setFallW] = useState(1.5)
  const line = useRef<[number, number][] | null>(null)   // the waterfall line being drawn (tile-local)
  const [radius, setRadius] = useState(16)
  const [strength, setStrength] = useState(0.2)
  const [showEdits, setShowEdits] = useState(true)
  const [hover, setHover] = useState<{ x: number; z: number; h: number; d: number } | null>(null)
  const [cursor, setCursor] = useState<{ u: number; v: number } | null>(null)
  const [dirty, setDirty] = useState<string[]>([])
  const [rev, setRev] = useState(0)
  const [ready, setReady] = useState(false)
  const [snapB, setSnapB] = useState<BSnap | null>(null)     // the builder's last answer: index (history), draft vs live
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [, setNow] = useState(0)                             // re-render the 'saved Ns ago' label
  const [full, setFull] = useState(false)                      // M83 s1c: Fly fills the window (F toggles, Esc leaves): build for hours, not in a 400px box
  const [view, setView] = useState<'2d' | 'fly'>('2d')         // M83 s1b: the top-down map or the 3D free-fly view (same draft, same brush)

  const worldRef = useRef<WildsWorld | null>(null)
  const bases = useRef(new Map<string, Base>())
  const edits = useRef<Edits>({})
  const hist = useRef(new EditHistory())
  const dirtyRef = useRef(new Set<string>())
  const canvas = useRef<HTMLCanvasElement>(null)
  const paint = useRef<{ x: number; z: number; target?: number; timer: number } | null>(null)
  const opts = useRef({ brush, radius, strength, level, picking, fallW }); opts.current = { brush, radius, strength, level, picking, fallW }
  const tileRef = useRef(tile); tileRef.current = tile

  // ── the world: index + network + voids, then the edits file ──
  useEffect(() => {
    let dead = false
    Promise.all([loadIndex(), loadNetwork(), builderCall()]).then(([idx, nw, b]) => {
      if (dead) return
      if (!b) { setStatus('could not read the builder draft (owner only)'); return }
      const layer = { edits: b.draft.tiles, water: b.draft.water, falls: b.draft.falls }
      setSnapB(b); setSavedAt(b.draftAt)
      const w = makeWorld(idx); if (nw) { w.clear = clearing(nw); w.roads = roadField(nw) }
      w.voids = makeVoids(idx, nw ?? null)
      worldRef.current = w
      const store: Edits = { ...layer.edits }; for (const [t, m] of Object.entries(layer.water)) store[wkey(t)] = { ...m }; for (const [t, m] of Object.entries(layer.falls)) store[fkey(t)] = { ...m }
      edits.current = store
      setTiles(idx.tiles.filter(t => t.land > 0.02).map(t => ({ name: t.name, tx: t.tx, ty: t.ty, land: t.land })).sort((a, b) => a.ty - b.ty || a.tx - b.tx))
      setStatus('')
      setRev(r => r + 1)
    }).catch(err => setStatus(`failed to load: ${String(err)}`))
    return () => { dead = true }
  }, [])

  // ── the tile + its neighbours, parsed bare (no edits) ──
  useEffect(() => {
    const w = worldRef.current; if (!w) return
    const c = w.byName.get(tile); if (!c) { setStatus(`no tile ${tile}`); return }
    let dead = false
    setReady(false)
    const want: string[] = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = w.at(c.tx + dx, c.ty + dy); if (t) want.push(t.name) }
    const need = want.filter(n => !bases.current.has(n))
    if (need.length) setStatus(`parsing ${need.length} tile${need.length > 1 ? 's' : ''}…`)
    Promise.all(need.map(async n => {
      const W = await loadWilds(n, '/open/wilds', zonesOf(w, n), w.clear, w.roads, w.voids, null)
      const t = w.byName.get(n)!
      bases.current.set(n, { meta: W.meta, tx: t.tx, ty: t.ty, h: W.h, voided: W.voided })
    })).then(() => { if (!dead) { setStatus(''); setReady(true); setRev(r => r + 1) } })
      .catch(err => { if (!dead) setStatus(`parse failed: ${String(err)}`) })
    return () => { dead = true }
  }, [tile, tiles])

  // ── the edited ground, in WORLD coords (what the brush reads) ──
  const heightAt = useCallback((x: number, z: number): number => {
    const w = worldRef.current; if (!w) return NaN
    const { tx, ty } = tileOf(x, z), t = w.at(tx, ty), B = t && bases.current.get(t.name)
    if (!B) return NaN
    const { nx, nz, cell, sizeX, sizeZ } = B.meta, E = edits.current[t!.name]
    const fx = Math.min(nx - 1 - 1e-6, Math.max(0, (x - tx * TILE_M + sizeX / 2) / cell)), fz = Math.min(nz - 1 - 1e-6, Math.max(0, (z - ty * TILE_M + sizeZ / 2) / cell))
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j
    const at = (ii: number, jj: number) => { const k = jj * nx + ii; return B.h[k] + (E?.[k] ?? 0) / 10 }
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v
  }, [])
  const brushTiles = useCallback((): BrushTile[] => [...bases.current.entries()].map(([name, B]) => ({ name, ox: B.tx * TILE_M, oz: B.ty * TILE_M, nx: B.meta.nx, nz: B.meta.nz, cell: B.meta.cell, sizeX: B.meta.sizeX, sizeZ: B.meta.sizeZ })), [])

  // ── draw: shaded relief + contour tint, water below the line, voids dark, edited ground tinted ──
  const draw = useCallback(() => {
    const cv = canvas.current, B = bases.current.get(tileRef.current); if (!cv || !B) return
    const { nx, nz, cell, waterY } = B.meta, E = edits.current[tileRef.current], Wm = edits.current[wkey(tileRef.current)] as WaterMap | undefined
    if (cv.width !== nx || cv.height !== nz) { cv.width = nx; cv.height = nz }
    const ctx = cv.getContext('2d')!, img = ctx.createImageData(nx, nz), px = img.data
    const H = new Float32Array(nx * nz)
    for (let k = 0; k < H.length; k++) H[k] = B.h[k] + (E?.[k] ?? 0) / 10
    const L = [-0.55, -0.55, 0.63]   // light from the top-left
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, h = H[k]
      const hl = H[j * nx + Math.max(0, i - 1)], hr = H[j * nx + Math.min(nx - 1, i + 1)], hu = H[Math.max(0, j - 1) * nx + i], hd = H[Math.min(nz - 1, j + 1) * nx + i]
      const gx = (hr - hl) / (2 * cell), gz = (hd - hu) / (2 * cell), n = 1 / Math.hypot(gx, gz, 1)
      const shade = Math.max(0.25, Math.min(1.25, 0.55 + 0.9 * ((-gx * L[0] - gz * L[1] + L[2]) * n - 0.4)))
      let r: number, g: number, b: number
      const vi = Math.min(j, nz - 2) * (nx - 1) + Math.min(i, nx - 2)
      const wl = Wm?.[vi] !== undefined ? Wm[vi] / 10 : null, lo = Math.min(H[Math.min(j, nz - 2) * nx + Math.min(i, nx - 2)], H[Math.min(j, nz - 2) * nx + Math.min(i, nx - 2) + 1], H[(Math.min(j, nz - 2) + 1) * nx + Math.min(i, nx - 2)], H[(Math.min(j, nz - 2) + 1) * nx + Math.min(i, nx - 2) + 1])
      if (wl !== null && wl > lo) { const d = Math.min(1, (wl - h) / 6); r = 0.26 - 0.14 * Math.max(0, d); g = 0.55 - 0.2 * Math.max(0, d); b = 0.86 - 0.16 * Math.max(0, d) }
      else if (B.voided?.[vi]) { r = 0.10; g = 0.11; b = 0.15 }
      else if (h < waterY) { const d = Math.min(1, (waterY - h) / 12); r = 0.30 - 0.18 * d; g = 0.52 - 0.22 * d; b = 0.72 - 0.20 * d }
      else {
        ;[r, g, b] = ramp(h - waterY); r *= shade; g *= shade; b *= shade
        const band = (y: number, s: number) => Math.floor((y - waterY) / s)
        if (band(h, 25) !== band(hr, 25) || band(h, 25) !== band(hd, 25)) { r *= 0.55; g *= 0.55; b *= 0.55 }
        else if (band(h, 5) !== band(hr, 5) || band(h, 5) !== band(hd, 5)) { r *= 0.8; g *= 0.8; b *= 0.8 }
      }
      if (showEdits && wl !== null && !(wl > lo)) { b += (1 - b) * 0.35; g += (0.9 - g) * 0.15 }   // painted, but the ground stands above the level: dry
      if (showEdits && E?.[k]) { const t = Math.min(0.5, Math.abs(E[k]) / 80); if (E[k] > 0) { r += (1 - r) * t; b += (0.6 - b) * t } else { b += (1 - b) * t; r *= 1 - t } }
      const o = k * 4; px[o] = Math.min(255, r * 255); px[o + 1] = Math.min(255, g * 255); px[o + 2] = Math.min(255, b * 255); px[o + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    // falls: every sheet the game will draw (auto from the ponds + the drawn lines), white; drawn lines get their points
    const hAtL = (x: number, z: number) => { const fx = Math.min(nx - 1.001, Math.max(0, (x + B.meta.sizeX / 2) / cell)), fz = Math.min(nz - 1.001, Math.max(0, (z + B.meta.sizeZ / 2) / cell)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j; return (H[j * nx + i] * (1 - u) + H[j * nx + i + 1] * u) * (1 - v) + (H[(j + 1) * nx + i] * (1 - u) + H[(j + 1) * nx + i + 1] * u) * v }
    const lines = fallLines(edits.current[fkey(tileRef.current)]), sheets = fallSheets(B.meta, H, hAtL, ponds(B.meta, H, Wm).cells, lines)
    const P = (x: number, z: number): [number, number] => [(x + B.meta.sizeX / 2) / cell, (z + B.meta.sizeZ / 2) / cell]
    ctx.lineCap = 'round'
    for (const q of sheets) { ctx.strokeStyle = q.auto ? 'rgba(255,255,255,0.95)' : 'rgba(255,250,210,0.95)'; ctx.lineWidth = q.auto ? 1 : 1.5; ctx.beginPath(); ctx.moveTo(...P(q.ax, q.az)); ctx.lineTo(...P(q.bx, q.bz)); ctx.stroke() }
    for (const L of lines) { ctx.fillStyle = 'rgba(255,240,170,0.9)'; for (const p of L.pts) { const [a, b] = P(p[0], p[1]); ctx.fillRect(a - 0.5, b - 0.5, 1, 1) } }
    const cur = line.current; if (cur && cur.length > 1) { ctx.strokeStyle = 'rgba(255,220,120,1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...P(cur[0][0], cur[0][1])); for (const p of cur.slice(1)) ctx.lineTo(...P(p[0], p[1])); ctx.stroke() }
  }, [showEdits])
  useEffect(() => { if (ready) draw() }, [ready, rev, draw])
  const raf = useRef(0)
  const redraw = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; draw() }) }, [draw])

  const allKeys = () => [...bases.current.keys()].flatMap(n => [n, wkey(n), fkey(n)])
  const markDirty = (names: string[]) => { if (!names.length) return; for (const n of names) dirtyRef.current.add(n); setDirty([...dirtyRef.current]) }

  // ── the brush ──
  const applyAt = useCallback((x: number, z: number, target?: number) => {
    const o = opts.current
    if (o.brush === 'water' || o.brush === 'dry') {
      const lv = o.brush === 'dry' ? null : (target ?? o.level)
      if (o.brush === 'water' && lv === null) return
      const d = paintWater(brushTiles(), x, z, o.radius, lv), pre: Record<string, WaterMap> = {}
      for (const [t, m] of Object.entries(d)) pre[wkey(t)] = m
      markDirty(foldWater(edits.current, pre, o.brush === 'dry'))
      if (o.brush === 'dry') for (const [name, B] of bases.current) {   // Dry also clears waterfall lines under the brush
        const rm = removeFallsNear(edits.current[fkey(name)], x - B.tx * TILE_M, z - B.ty * TILE_M, o.radius)
        if (Object.keys(rm).length) markDirty(mergeEdits(edits.current, { [fkey(name)]: rm }))
      }
    } else if (o.brush !== 'falls') {
      const d = applyBrush(heightAt, brushTiles(), edits.current, { kind: o.brush, x, z, r: o.radius, s: o.strength, target })
      markDirty(mergeEdits(edits.current, d))
    }
    redraw()
  }, [heightAt, brushTiles, redraw])

  const toWorld = (e: { clientX: number; clientY: number }) => {
    const cv = canvas.current, B = bases.current.get(tileRef.current); if (!cv || !B) return null
    const rc = cv.getBoundingClientRect(), u = (e.clientX - rc.left) / rc.width, v = (e.clientY - rc.top) / rc.height
    if (u < 0 || u > 1 || v < 0 || v > 1) return null
    return { u, v, x: B.tx * TILE_M - B.meta.sizeX / 2 + u * B.meta.sizeX, z: B.ty * TILE_M - B.meta.sizeZ / 2 + v * B.meta.sizeZ }
  }
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !ready) return
    const p = toWorld(e); if (!p) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    beginAt(p.x, p.z)
  }
  // ── the brush in WORLD coords: the 2D canvas and the 3D fly view (raycast) both drive these ──
  const beginAt = (px: number, pz: number) => {
    const p = { x: px, z: pz }
    if (!ready) return
    if (opts.current.picking) { setLevel(Math.round(heightAt(p.x, p.z) * 10) / 10); setPicking(false); return }
    if (opts.current.brush === 'falls') { const b = bases.current.get(tileRef.current)!; line.current = [[p.x - b.tx * TILE_M, p.z - b.ty * TILE_M]]; return }
    hist.current.begin(edits.current, allKeys())
    let target = opts.current.brush === 'flatten' ? heightAt(p.x, p.z) : undefined
    if (opts.current.brush === 'water' && opts.current.level === null) { target = Math.round((heightAt(p.x, p.z) + 1) * 10) / 10; setLevel(target) }
    else if (opts.current.brush === 'water') target = opts.current.level ?? undefined
    applyAt(p.x, p.z, target)
    const timer = window.setInterval(() => { const q = paint.current; if (q) applyAt(q.x, q.z, q.target) }, TICK_MS)
    paint.current = { x: p.x, z: p.z, target, timer }
  }
  const onMove = (e: React.PointerEvent) => {
    const p = toWorld(e)
    if (!p) { setCursor(null); setHover(null); return }
    setCursor({ u: p.u, v: p.v })
    moveAt(p.x, p.z)
  }
  const moveAt = (px: number, pz: number) => {
    const p = { x: px, z: pz }
    const B = bases.current.get(tileRef.current)
    setHover({ x: Math.round(p.x - (B ? B.tx * TILE_M : 0)), z: Math.round(p.z - (B ? B.ty * TILE_M : 0)), h: heightAt(p.x, p.z), d: 0 })
    if (paint.current) { paint.current.x = p.x; paint.current.z = p.z }
    if (line.current && B) { const q: [number, number] = [p.x - B.tx * TILE_M, p.z - B.ty * TILE_M], l = line.current[line.current.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= 3) { line.current.push(q); redraw() } }
  }
  const commitLine = (pts: [number, number][], w: number, name = tileRef.current) => {
    const k = fkey(name), add = addFall(edits.current[k], pts, w); if (!Object.keys(add).length) return false
    hist.current.begin(edits.current, [k]); markDirty(mergeEdits(edits.current, { [k]: add })); hist.current.commit(); setRev(r => r + 1); return true
  }
  const endStroke = () => {
    if (line.current) { const pts = line.current; line.current = null; if (!commitLine(pts, opts.current.fallW)) redraw(); return }
    const q = paint.current; if (!q) return; clearInterval(q.timer); paint.current = null; hist.current.commit(); setRev(r => r + 1) }

  const undo = useCallback(() => { markDirty(hist.current.undo(edits.current)); setRev(r => r + 1) }, [])
  const redo = useCallback(() => { markDirty(hist.current.redo(edits.current)); setRev(r => r + 1) }, [])
  const resetTile = () => { hist.current.begin(edits.current, [tile, wkey(tile), fkey(tile)]); delete edits.current[tile]; delete edits.current[wkey(tile)]; delete edits.current[fkey(tile)]; hist.current.commit(); markDirty([tile, wkey(tile), fkey(tile)]); setRev(r => r + 1) }
  // the whole store as one layer (the draft is small and sparse: one request replaces it, so there is no per-tile race)
  const layerOf = (): Layer => {
    const L: Layer = { v: 1, tiles: {}, water: {}, falls: {} }
    for (const [k, m] of Object.entries(edits.current)) {
      if (!Object.keys(m).length) continue
      if (k.startsWith(WATER_PREFIX)) L.water[tileOfKey(k)] = m; else if (k.startsWith(FALLS_PREFIX)) L.falls[tileOfKey(k)] = m; else L.tiles[k] = m
    }
    return L
  }
  const loadLayer = (L: Layer) => {
    const store: Edits = { ...L.tiles }; for (const [t, m] of Object.entries(L.water)) store[wkey(t)] = { ...m }; for (const [t, m] of Object.entries(L.falls)) store[fkey(t)] = { ...m }
    edits.current = store; hist.current = new EditHistory(); dirtyRef.current.clear(); setDirty([]); setRev(r => r + 1)
  }
  const save = useCallback(async (auto = false): Promise<boolean> => {
    const names = [...dirtyRef.current]; if (!names.length) return true
    if (!auto) setStatus('saving the draft…')
    const b = await builderCall({ action: 'draft', layer: layerOf() })
    if (b) { for (const n of names) dirtyRef.current.delete(n); setSnapB(b); setSavedAt(b.draftAt ?? Date.now()) }
    setDirty([...dirtyRef.current])
    setStatus(b ? (auto ? '' : 'draft saved · players see it after Publish') : 'save FAILED (nothing written; try again)')
    return !!b
  }, [])
  const publish = useCallback(async (msg?: string): Promise<boolean> => {
    if (!(await save())) return false
    setBusy(true); setStatus('publishing…')
    const b = await builderCall({ action: 'publish', note: msg ?? note })
    setBusy(false)
    if (b) { setSnapB(b); setNote('') }
    setStatus(b ? `published v${b.index.live} · live on the next Wilds load` : 'publish FAILED (live unchanged)')
    return !!b
  }, [save, note])
  const rollback = useCallback(async (v: number): Promise<boolean> => {
    setBusy(true); setStatus(`rolling back to v${v}…`)
    const b = await builderCall({ action: 'rollback', v })
    setBusy(false)
    if (b) { setSnapB(b); setSavedAt(b.draftAt); loadLayer(b.draft) }
    setStatus(b ? `rolled back to v${v} (now v${b.index.live}) · the draft is that version too` : 'rollback FAILED (live unchanged)')
    return !!b
  }, [])
  // AUTOSAVE every minute while there are unsaved strokes; the label ticks every 5 s
  useEffect(() => {
    const a = setInterval(() => { if (dirtyRef.current.size && !paint.current) save(true) }, AUTOSAVE_MS)
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => { clearInterval(a); clearInterval(t) }
  }, [save])

  const viewRef = useRef(view); viewRef.current = view
  useEffect(() => { if (view !== 'fly') setFull(false) }, [view])
  // keys: 1-7 brush, [ ] radius, F fullscreen fly, Esc leave it, ctrl+z / ctrl+shift+z / ctrl+y, ctrl+s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
      else if (!mod && e.key >= '1' && e.key <= '7') setBrush(TOOLS[+e.key - 1])
      else if (e.key === '[') setRadius(r => Math.max(4, r - 4))
      else if (e.key === ']') setRadius(r => Math.min(80, r + 4))
      else if (!mod && e.code === 'KeyF' && !e.repeat && viewRef.current === 'fly') setFull(f => !f)
      else if (e.key === 'Escape') setFull(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, save])
  // never lose a sculpt to a closed tab
  useEffect(() => {
    if (!dirty.length) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty.length])

  // test hook (scripts/terrain-editor-check.mts): local coords on the current tile
  useEffect(() => {
    const B = () => bases.current.get(tileRef.current)
    ;(window as unknown as { __terrain?: unknown }).__terrain = {
      ready, tile,
      heightAt: (lx: number, lz: number) => { const b = B(); return b ? heightAt(b.tx * TILE_M + lx, b.ty * TILE_M + lz) : NaN },
      stroke: (kind: Brush, lx: number, lz: number, r: number, s: number, n = 1) => {
        const b = B(); if (!b) return false
        const x = b.tx * TILE_M + lx, z = b.ty * TILE_M + lz, target = kind === 'flatten' ? heightAt(x, z) : undefined
        hist.current.begin(edits.current, allKeys())
        for (let i = 0; i < n; i++) markDirty(mergeEdits(edits.current, applyBrush(heightAt, brushTiles(), edits.current, { kind, x, z, r, s, target })))
        hist.current.commit(); setRev(v => v + 1); return true
      },
      /** paint water at an absolute level (m), or dry it (null) */
      water: (lx: number, lz: number, r: number, lv: number | null) => {
        const b = B(); if (!b) return false
        hist.current.begin(edits.current, allKeys())
        const d = paintWater(brushTiles(), b.tx * TILE_M + lx, b.ty * TILE_M + lz, r, lv), pre: Record<string, WaterMap> = {}
        for (const [t, m] of Object.entries(d)) pre[wkey(t)] = m
        markDirty(foldWater(edits.current, pre, lv === null)); hist.current.commit(); setRev(v => v + 1); return true
      },
      /** the water level painted at a point (m) or null */
      levelAt: (lx: number, lz: number) => { const b = B(); if (!b) return null; const { cell, sizeX, sizeZ, nx } = b.meta, i = Math.floor((lx + sizeX / 2) / cell), j = Math.floor((lz + sizeZ / 2) / cell), v = edits.current[wkey(tileRef.current)]?.[String(j * (nx - 1) + i)]; return v === undefined ? null : v / 10 },
      /** draw a waterfall line (tile-local points) of width w */
      fall: (pts: [number, number][], w: number) => commitLine(pts, w),
      /** what the game will draw on this tile: sheets (auto from ponds + lines) */
      sheets: () => { const b = B(); if (!b) return []; const nm = tileRef.current, E = edits.current[nm], H = Float32Array.from(b.h, (v, k) => v + (E?.[k] ?? 0) / 10), hAt = (x: number, z: number) => heightAt(b.tx * TILE_M + x, b.ty * TILE_M + z); return fallSheets(b.meta, H, hAt, ponds(b.meta, H, edits.current[wkey(nm)]).cells, fallLines(edits.current[fkey(nm)])).map(q => ({ auto: q.auto, top: q.top, bottom: q.bottom })) },
      undo, redo, save, dirty: () => [...dirtyRef.current],
      publish, rollback, builder: () => snapB, savedAt: () => savedAt,
    }
  }, [ready, tile, heightAt, brushTiles, undo, redo, save, publish, rollback, snapB, savedAt])

  const cur = tiles.find(t => t.name === tile)
  const step = (dx: number, dy: number) => { const w = worldRef.current; if (!w || !cur) return; const t = w.at(cur.tx + dx, cur.ty + dy); if (t) setTile(t.name) }
  const B = bases.current.get(tile)
  const nEdits = Object.keys(edits.current[tile] ?? {}).length, nWater = Object.keys(edits.current[wkey(tile)] ?? {}).length, nFalls = fallLines(edits.current[fkey(tile)]).length

  const btn = 'px-2.5 py-1 rounded text-xs font-mono border transition-colors'
  const on = 'bg-amber-500/20 border-amber-400 text-amber-200', off = 'bg-white/5 border-white/15 text-white/60 hover:text-white'
  return (
    <div className="flex flex-col lg:flex-row gap-4 text-white/85">
      <div className="flex flex-col gap-2 w-full max-w-[760px]">
      <div className="flex gap-1 items-center">
        {(['2d', 'fly'] as const).map(v => <button key={v} className={`${btn} ${view === v ? on : off}`} onClick={() => setView(v)} data-testid={`view-${v}`}>{v === '2d' ? 'Map (top-down)' : 'Fly (3D)'}</button>)}
        {view === 'fly' && <button className={`${btn} ${off}`} onClick={() => setFull(true)} data-testid="fly-full">Fullscreen (F)</button>}
        {view === 'fly' && <span className="text-[11px] font-mono text-white/40 pl-2">WASD move · Space/C up/down · Shift fast · right-drag look · wheel zoom · T top-down · left-drag sculpt</span>}
      </div>
      {view === 'fly' && B && (
        <div className={full ? 'fixed inset-0 z-[60] bg-black select-none touch-none' : 'relative w-full aspect-[4/3] bg-black/40 rounded overflow-hidden select-none touch-none'} data-testid="fly-frame" data-full={full ? '1' : '0'}>
          {full && (
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none [&>*]:pointer-events-auto">
              <div className="flex gap-1 items-center rounded bg-black/70 border border-white/10 px-2 py-1.5">
                {TOOLS.map((t, i) => <button key={t} className={`${btn} ${brush === t ? on : off}`} onClick={() => setBrush(t)}>{i + 1} {t[0].toUpperCase() + t.slice(1)}</button>)}
                <span className="text-[11px] font-mono text-white/70 tabular-nums pl-2">radius {radius} m [ ]</span>
                <button className={`${btn} ${off}`} onClick={undo}>Undo</button>
                <button className={`${btn} ${off}`} onClick={() => setFull(false)} data-testid="fly-exit">Exit (Esc)</button>
              </div>
              <div className="w-fit rounded bg-black/70 border border-white/10 px-2 py-1 text-[11px] font-mono text-white/60 tabular-nums">
                {dirty.length ? 'unsaved, autosave soon' : savedAgo(savedAt, Date.now())} · WASD · Space/C · Shift fast · right-drag look · wheel · T top-down · left-drag sculpt
              </div>
            </div>
          )}
          {/* the 3x3 ring only: bases caches every tile opened this session (builder-fly-check saw 18 meshes after two tiles) */}
          <BuilderFly tiles={[...bases.current.entries()].filter(([, b]) => Math.abs(b.tx - B.tx) <= 1 && Math.abs(b.ty - B.ty) <= 1).map(([name, b]): FlyTile => ({ name, ox: b.tx * TILE_M, oz: b.ty * TILE_M, nx: b.meta.nx, nz: b.meta.nz, cell: b.meta.cell, sizeX: b.meta.sizeX, sizeZ: b.meta.sizeZ, h: b.h, waterY: b.meta.waterY }))}
            deltas={n => edits.current[n]} rev={rev} heightAt={heightAt} radius={radius} focus={{ x: B.tx * TILE_M, z: B.ty * TILE_M }}
            onBegin={beginAt} onMove={moveAt} onEnd={endStroke} />
        </div>
      )}
      <div className={`relative w-full aspect-square bg-black/40 rounded overflow-hidden select-none touch-none ${view === 'fly' ? 'hidden' : ''}`}>
        <canvas ref={canvas} className="w-full h-full block" style={{ cursor: 'none' }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={endStroke} onPointerCancel={endStroke}
          onPointerLeave={() => { setCursor(null); setHover(null) }} data-testid="terrain-canvas" />
        {cursor && B && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
            <circle cx={cursor.u} cy={cursor.v} r={radius / B.meta.sizeX} fill="none" stroke="white" strokeOpacity={0.9} strokeWidth={0.002} />
            <circle cx={cursor.u} cy={cursor.v} r={0.0025} fill="white" />
          </svg>
        )}
        {(!ready || status) && <div className="absolute left-2 top-2 text-xs font-mono bg-black/70 px-2 py-1 rounded">{status || 'loading…'}</div>}
        <div className="absolute right-2 bottom-2 text-[10px] font-mono text-white/50 bg-black/50 px-1.5 rounded">+x → · +z ↓ · 1 km</div>
      </div>
      </div>

      <div className="flex flex-col gap-3 min-w-[240px] text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">Tile</div>
          <div className="flex gap-1 items-center">
            <select value={tile} onChange={e => setTile(e.target.value)} className="bg-black/40 border border-white/15 rounded px-2 py-1 font-mono text-xs flex-1">
              {tiles.map(t => <option key={t.name} value={t.name}>{t.name} ({t.tx},{t.ty}) {Math.round(t.land * 100)}% land{dirty.some(d => tileOfKey(d) === t.name) ? ' •' : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-1 w-28">
            <span /><button className={`${btn} ${off}`} onClick={() => step(0, -1)}>↑</button><span />
            <button className={`${btn} ${off}`} onClick={() => step(-1, 0)}>←</button><span /><button className={`${btn} ${off}`} onClick={() => step(1, 0)}>→</button>
            <span /><button className={`${btn} ${off}`} onClick={() => step(0, 1)}>↓</button><span />
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">Brush</div>
          <div className="flex flex-wrap gap-1">
            {TOOLS.map((b, i) => <button key={b} className={`${btn} ${brush === b ? on : off}`} onClick={() => setBrush(b)}>{i + 1} {TOOL_KEY[b]}</button>)}
          </div>
          {brush === 'flatten' && <div className="text-[11px] text-white/45 mt-1">levels to the height under your first click</div>}
          {(brush === 'water' || brush === 'dry') && <div className="text-[11px] text-white/45 mt-1">{brush === 'water' ? 'paints water at the level below; it fills wherever the level stands above the ground (carve a bowl, paint = a lake). A pond edge over lower water falls by itself.' : 'removes painted water and waterfall lines under the brush'}</div>}
          {brush === 'falls' && <div className="text-[11px] text-white/45 mt-1">drag along a cliff edge: water springs out of it and falls to the lower side, onto painted water if there is some</div>}
          {brush === 'falls' && <label className="flex flex-col gap-1 mt-2"><span className="text-[10px] uppercase tracking-[0.18em] text-white/40">Fall width <span className="tabular-nums text-white/80 normal-case tracking-normal">{fallW.toFixed(1)}</span></span><input type="range" min={0.4} max={6} step={0.1} value={fallW} onChange={e => setFallW(+e.target.value)} /></label>}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">Water level</div>
          <div className="flex gap-1 items-center">
            <input type="number" step={0.1} value={level ?? ''} placeholder="first click + 1 m" onChange={e => setLevel(e.target.value === '' ? null : +e.target.value)}
              className="bg-black/40 border border-white/15 rounded px-2 py-1 font-mono text-xs w-32 tabular-nums" />
            <span className="text-xs text-white/40">m</span>
            <button className={`${btn} ${picking ? on : off}`} onClick={() => setPicking(v => !v)}>{picking ? 'click the map…' : 'Pick'}</button>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">Radius <span className="tabular-nums text-white/80 normal-case tracking-normal">{radius} m</span> <span className="normal-case tracking-normal text-white/30">[ ]</span></span>
          <input type="range" min={4} max={80} step={1} value={radius} onChange={e => setRadius(+e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">Strength <span className="tabular-nums text-white/80 normal-case tracking-normal">{strength.toFixed(2)} m/tick</span></span>
          <input type="range" min={0.02} max={1} step={0.02} value={strength} onChange={e => setStrength(+e.target.value)} />
        </label>

        <div className="flex flex-wrap gap-1">
          <button className={`${btn} ${off}`} onClick={undo} disabled={!hist.current.canUndo}>Undo</button>
          <button className={`${btn} ${off}`} onClick={redo} disabled={!hist.current.canRedo}>Redo</button>
          <button className={`${btn} ${off}`} onClick={resetTile} disabled={!nEdits && !nWater && !nFalls}>Reset tile</button>
          <button className={`${btn} ${showEdits ? on : off}`} onClick={() => setShowEdits(v => !v)}>Tint edits</button>
        </div>
        <button onClick={() => save()} disabled={!dirty.length}
          className={`px-3 py-2 rounded font-mono text-xs uppercase tracking-[0.15em] border ${dirty.length ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-white/5 border-white/10 text-white/30'}`}>
          {dirty.length ? `Save draft: ${new Set(dirty.map(tileOfKey)).size} tile${new Set(dirty.map(tileOfKey)).size > 1 ? 's' : ''} (ctrl+s)` : 'Draft saved'}
        </button>
        <div className="text-[11px] font-mono text-white/45 tabular-nums" data-testid="saved-ago">
          {savedAgo(savedAt, Date.now())} · autosave every {AUTOSAVE_MS / 1000} s · {dirty.length || snapB?.state !== 'matches live' ? 'unpublished changes' : 'matches live'}
        </div>

        <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Publish</div>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={120} placeholder="what changed (optional)"
            className="bg-black/40 border border-white/15 rounded px-2 py-1 font-mono text-xs" />
          <button onClick={() => publish()} disabled={busy || (!dirty.length && snapB?.state === 'matches live')}
            className={`px-3 py-2 rounded font-mono text-xs uppercase tracking-[0.15em] border ${!busy && (dirty.length || snapB?.state !== 'matches live') ? 'bg-sky-500/20 border-sky-400 text-sky-200' : 'bg-white/5 border-white/10 text-white/30'}`}>
            Publish to players
          </button>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 pt-1">History</div>
          <div className="max-h-56 overflow-y-auto space-y-1" data-testid="history">
            {!snapB?.index.versions.length && <div className="text-xs text-white/35">nothing published yet</div>}
            {[...(snapB?.index.versions ?? [])].reverse().filter(v => !isCheck(v.note)).map(v => (
              <div key={v.v} className="flex items-center gap-2 text-xs font-mono">
                <span className={`tabular-nums ${v.v === snapB?.index.live ? 'text-emerald-300' : 'text-white/60'}`}>v{v.v}</span>
                <span className="flex-1 truncate text-white/70" title={`${v.note} · ${v.size.verts} vertices, ${v.size.water} water cells`}>{v.note}</span>
                <span className="text-white/35 tabular-nums">{new Date(v.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                {v.v === snapB?.index.live ? <span className="text-emerald-300/80 text-[10px] uppercase">live</span>
                  : <button className={`${btn} ${off} !px-1.5 !py-0.5`} disabled={busy} onClick={() => rollback(v.v)}>Roll back</button>}
              </div>
            ))}
            {!!snapB?.index.versions.filter(v => isCheck(v.note)).length && <div className="text-[10px] text-white/30">+ {snapB.index.versions.filter(v => isCheck(v.note)).length} check runs hidden</div>}
          </div>
        </div>

        <div className="text-xs font-mono text-white/55 space-y-0.5 tabular-nums">
          <div>{nEdits} edited vertices, {nWater} water cells, {nFalls} waterfall lines on {tile}</div>
          {hover && Number.isFinite(hover.h) && <div>({hover.x}, {hover.z}) · ground {hover.h.toFixed(1)} m{B && hover.h < B.meta.waterY ? ' · under the sea' : ''}</div>}
          <div className="text-white/35 pt-1">Hold to paint. Brushes cross onto the neighbouring tiles so seams meet. You are editing the DRAFT: players see nothing until Publish (live on the next Wilds load, no build).</div>
        </div>
      </div>
    </div>
  )
}
