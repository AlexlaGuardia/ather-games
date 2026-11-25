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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { loadWilds, type WildsMeta } from '../../open/ather/wilds'
import { loadIndex, makeWorld, zonesOf, tileOf, TILE_M, type WildsWorld } from '../../open/ather/wilds-world'
import { loadNetwork, clearing, roadField } from '../../open/ather/network'
import { makeVoids, type IndexLike } from '../../open/ather/wilds-voids'
import { paintVoids, cellKey, cellOf, VCELL, type VoidEdits } from '../../open/ather/void-edits'
import type { Network } from '../../open/ather/network'
import { applyBrush, mergeEdits, EditHistory, BRUSHES, paintWater, foldWater, WATER_PREFIX, FALLS_PREFIX, addFall, removeFallsNear, fallLines, fallSheets, ponds, type Brush, type Edits, type BrushTile, type WaterMap } from '../../open/ather/wilds-edits'

import { ramp } from './terrain-ramp'
import type { FlyTile } from './BuilderFly'
import { STRENGTH_MIN, STRENGTH_MAX, stepStrength } from './fly-cam'
const BuilderFly = dynamic(() => import('./BuilderFly'), { ssr: false })   // M83 s1b: three only loads when Fly is opened
import { AUTOSAVE_MS, savedAgo, type Layer, type Index, type BuilderMap } from '../../world/builder'
import { GLADE_BRUSH_TILE, GLADE_LAYER_TILE, GLADE_WATER_Y, sampleGladeBase, triLerp } from '../../world/glade-builder'
import { gladeZoneGround } from '../../open/ather/glade-cluster'
import { poolOver, POOL_Y } from '../../open/ather/moonwell-water'
import { NYX_REGION, NYX_WATER_Y, nyxBrushTile, nyxTiles, sampleNyxTile, nyxN, nyxOrigin } from '../../world/nyx-builder'
import BuilderOverview from './BuilderOverview'
import type { OvTile, OvSource } from './builder-overview'
import { loadRegion, type Region } from '../../open/region'
import { wildsOverlay, gladeOverlay, nyxOverlay, poisIn, roadsIn, POI_COLOR, ROAD_COLOR, EMPTY_OVERLAY, type Overlay } from './builder-pois'
import { GLADE_TILE_CENTER, GLADE_SIZE } from '../../world/glade-builder'
import { NYX_TILE_M } from '../../world/nyx-builder'
import { zoneParts } from '../../open/ather/zone-parts'   // M84 s3: Fly shows each zone's build
import { flattenZone, normRect, bigEnough, overlapping, zoneAt, newZoneId, zoneOverlay, zoneLabel, ZONE_KINDS, KIND_LABEL, ZONE_FRONTS, FRONT_LABEL, ZONE_BLEND_M, type Zone, type ZoneKind, type ZoneTag, type ZoneFront } from '../../world/builder-zones'
import { choicesFor, type Choice } from './zone-choices'
import { ZoneBuilder } from './ZoneBuilder'   // M84 s2: build on a zone
import { FURNITURE } from '../../open/ather/furniture'
import { quad } from '../../open/ather/build-prefs'

// ── BETA M83 p1 s1a: the editor works on the World Builder DRAFT (world/builder.ts), never on the live layer. Save + autosave write
// the draft; PUBLISH makes it a version and puts it live; the history rolls back to any version. Players see nothing until Publish.
interface BSnap { draft: Layer; draftAt: number | null; index: Index; state: 'unpublished changes' | 'matches live' }
// M83 s2a: which map. The Wilds = its exported tiles (pick one, the 3x3 ring parses); the Glade = ONE virtual tile sampled from
// its ground function (world/glade-builder.ts), so everything below works on it unchanged.
// M83 s3: the Nyx continent = virtual 1 km tiles cut from its one exported region (world/nyx-builder.ts), on the Wilds' tile grid.
const MAP_NAME: Record<BuilderMap, string> = { wilds: 'the Wilds', glade: 'Moonwell Glade', nyx: 'Nyx continent' }
const LOAD_NAME: Record<BuilderMap, string> = { wilds: 'Wilds', glade: 'Glade', nyx: 'continent' }
/** the tile picker / ring's view of a tiled map (a WildsWorld has these; the Nyx continent builds its own) */
type Grid = { at(tx: number, ty: number): { name: string; tx: number; ty: number } | undefined; byName: Map<string, { name: string; tx: number; ty: number }> }
const GLADE_FOCUS = { x: -100, z: 110 }   // Fly opens over Greg's garden (the tile's centre is void, between the islands)
/** the route's last refusal (M104: Publish refused, naming the zone a void edit seals) */
const lastError = { msg: '' }
const sigOf = (v: VoidEdits | undefined | null) => v ? Object.keys(v).sort().map(k => k + v[k]).join(',') : ''
async function builderCall(map: BuilderMap, body?: Record<string, unknown>): Promise<BSnap | null> {
  try {
    const r = body ? await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map, ...body }) })
      : await fetch(`/shimmer/save-builder?map=${map}`, { cache: 'no-store' })
    lastError.msg = ''
    if (!r.ok) { try { const j = await r.json() as { error?: unknown }; lastError.msg = typeof j.error === 'string' ? j.error : '' } catch { /* */ } return null }
    return await r.json() as BSnap
  } catch { return null }
}
const isCheck = (n: string) => n.startsWith('check:')

/** ox, oz = the tile's centre in world coords (a Wilds tile: tx/ty * TILE_M; the Glade's tile: its own centre). `voidV` (Glade):
 *  vertices that are NOT ground: heightAt answers NaN there, so the brush skips them, and Fly drops their triangles. */
interface Base { meta: WildsMeta; tx: number; ty: number; ox: number; oz: number; h: Float32Array; voided?: Uint8Array; voidV?: Uint8Array }
type Tool = Brush | 'water' | 'dry' | 'falls' | 'void' | 'zone'
const TOOLS: Tool[] = [...BRUSHES, 'water', 'dry', 'falls', 'void', 'zone']
const TOOL_KEY: Record<Tool, string> = { raise: 'Raise', lower: 'Lower', flatten: 'Flatten', smooth: 'Smooth', water: 'Water', dry: 'Dry', falls: 'Falls', void: 'Void', zone: 'Zone' }
// M84 s1: the building zones live beside the edits; a change marks this key dirty so autosave / Save send them
const ZONES_KEY = 'zones/'
// M104: the void brush's cells live in the same store under one key (not a tile name: '/' never passes TILE_NAME), so one undo
// history, dirty set, autosave and Publish cover them; the layer file carries them as `voids` (void-edits.ts)
const VOIDS_KEY = 'voids/'
// the editor keeps heights and water in ONE store (so one undo history covers both): '<tile>' = heights, 'water/<tile>' = water
const wkey = (t: string) => WATER_PREFIX + t, fkey = (t: string) => FALLS_PREFIX + t
const tileOfKey = (k: string) => k.startsWith(WATER_PREFIX) ? k.slice(WATER_PREFIX.length) : k.startsWith(FALLS_PREFIX) ? k.slice(FALLS_PREFIX.length) : k
const TICK_MS = 50

// the map picker: switching maps remounts the editor (its own draft, history and undo), saving unsaved strokes on the way out
export default function TerrainEditor() {
  // read ?map= after mount (reading window in the state initialiser made the server render the Wilds and the client the Glade:
  // a hydration error, caught by builder-glade-check)
  const [map, setMap] = useState<BuilderMap | null>(null)
  useEffect(() => { try { const q = new URLSearchParams(window.location.search).get('map'); setMap(q === 'glade' || q === 'nyx' ? q : 'wilds') } catch { setMap('wilds') } }, [])
  const pick = (m: BuilderMap) => {
    setMap(m)
    try { const u = new URL(window.location.href); u.searchParams.set('map', m); window.history.replaceState(null, '', u) } catch { /* */ }
  }
  return map ? <MapEditor key={map} map={map} onMap={pick} /> : <div className="text-xs font-mono text-white/50">loading…</div>
}

function MapEditor({ map, onMap }: { map: BuilderMap; onMap: (m: BuilderMap) => void }) {
  const glade = map === 'glade', nyx = map === 'nyx'
  const [status, setStatus] = useState(glade ? 'sampling the Glade…' : nyx ? 'loading the continent…' : 'loading the Wilds index…')
  const [tiles, setTiles] = useState<{ name: string; tx: number; ty: number; land: number }[]>([])
  const [tile, setTile] = useState(glade ? GLADE_LAYER_TILE : 'first-wilds')
  const [brush, setBrush] = useState<Tool>('raise')
  const [level, setLevel] = useState<number | null>(null)   // water level (m, absolute); null = the first Water click picks ground + 1 m
  const [picking, setPicking] = useState(false)
  const [fallW, setFallW] = useState(1.5)
  const [voidMode, setVoidMode] = useState<-1 | 1>(-1)   // M104: the void brush erases (-1, the crust holds) or paints (1)
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
  const [lockLook, setLockLook] = useState(true)               // M83 (Alex 11-23): Fly click locks the pointer: mouse-look + centre crosshair brush
  const [locked, setLocked] = useState(false)
  // M105 (Alex 11-23): the POI + roads overlay, read-only, from the data the game reads (builder-pois.ts). O toggles it.
  const [showOv, setShowOv] = useState(false)
  const [ovData, setOvData] = useState<Overlay>(EMPTY_OVERLAY)
  const [ovDoors, setOvDoors] = useState(false)   // nyx: the shop doors are worked out (town plans) the first time the overlay opens
  // M84 s1 + M114: building zones (world/builder-zones.ts). The flatten is baked into the edits; `zones` is the list + their tags.
  const [zones, setZonesS] = useState<Zone[]>([])
  const zonesRef = useRef<Zone[]>([])
  const setZones = (z: Zone[]) => { zonesRef.current = z; setZonesS(z) }
  const [selZone, setSelZone] = useState<string | null>(null)   // the zone whose tag popup is open
  const [buildZone, setBuildZone] = useState<string | null>(null)   // M84 s2: the zone whose build is open
  const zoneDrag = useRef<{ ax: number; az: number; bx: number; bz: number } | null>(null)
  const [zoneBox, setZoneBox] = useState<{ x0: number; z0: number; x1: number; z1: number } | null>(null)   // the rectangle being dragged
  const [zoneNet, setZoneNet] = useState<Network | null>(null)   // the Wilds' season network: its Moglins fill the Home list
  // M84 s1: the zones (a marker named by the tag + the rectangle) ride on the M105 overlay, in all three views
  const ovAll = useMemo((): Overlay => { if (!zones.length) return ovData; const z = zoneOverlay(zones); return { pois: [...ovData.pois, ...z.pois], roads: [...ovData.roads, ...z.roads] } }, [ovData, zones])

  const worldRef = useRef<WildsWorld | null>(null)
  const gridRef = useRef<Grid | null>(null)       // the Wilds' world, or the Nyx continent's virtual tiles
  const regionRef = useRef<Region | null>(null)   // M83 s3: the continent's height grid (bare: the published layer is NOT applied)
  const bases = useRef(new Map<string, Base>())
  const edits = useRef<Edits>({})
  const hist = useRef(new EditHistory())
  const dirtyRef = useRef(new Set<string>())
  const canvas = useRef<HTMLCanvasElement>(null)
  const paint = useRef<{ x: number; z: number; target?: number; timer: number } | null>(null)
  const opts = useRef({ brush, radius, strength, level, picking, fallW, voidMode }); opts.current = { brush, radius, strength, level, picking, fallW, voidMode }
  const tileRef = useRef(tile); tileRef.current = tile
  // M83 overview: the Wilds' tiles nobody has opened yet are drawn from their raw exported heights (the .bin the parse reads,
  // fetched once, shared with the browser cache), with the void field's carve; an opened tile draws from its parsed base
  const rawRef = useRef(new Map<string, Int16Array>())
  const [rawN, setRawN] = useState(0)
  // M104: what the void field was built from, and the void cells it was built with; a change (stroke end, undo, rollback) rebuilds
  // the field and re-parses the open tiles (the carve is baked into a parsed tile), so tile view, overview and Fly show the result
  const voidSrc = useRef<{ idx: IndexLike; nw: Network | null } | null>(null)
  const voidSig = useRef('')
  const [voidRev, setVoidRev] = useState(0)

  // ── the world: index + network + voids, then the edits file ──
  useEffect(() => {
    let dead = false
    if (glade) {   // M83 s2a: no index, no tiles to parse: sample the Glade's ground once, then the draft
      builderCall('glade').then(b => {
        if (dead) return
        if (!b) { setStatus('could not read the builder draft (owner only)'); return }
        const G = sampleGladeBase(gladeZoneGround), T = GLADE_BRUSH_TILE
        const meta: WildsMeta = { name: T.name, cell: T.cell, nx: T.nx, nz: T.nz, sizeX: T.sizeX, sizeZ: T.sizeZ, waterY: GLADE_WATER_Y, source: { x0: 0, y0: 0, x1: 0, y1: 0, mPerPx: T.cell } }
        bases.current.set(T.name, { meta, tx: 0, ty: 0, ox: T.ox, oz: T.oz, h: G.h, voided: G.voided, voidV: G.voidV })
        setOvData(gladeOverlay())
        setSnapB(b); setSavedAt(b.draftAt)
        const store: Edits = { ...b.draft.tiles }; for (const [t, m] of Object.entries(b.draft.water)) store[wkey(t)] = { ...m }; for (const [t, m] of Object.entries(b.draft.falls)) store[fkey(t)] = { ...m }
        if (b.draft.voids) store[VOIDS_KEY] = { ...b.draft.voids }
        edits.current = store; setZones(b.draft.zones ?? [])
        setTiles([{ name: T.name, tx: 0, ty: 0, land: 1 }])
        setStatus(''); setReady(true); setRev(r => r + 1)
      }).catch(err => setStatus(`failed to load: ${String(err)}`))
      return () => { dead = true }
    }
    if (nyx) {   // M83 s3: the continent's one region, cut into virtual 1 km tiles; open on the land tile nearest the centre
      Promise.all([loadRegion(NYX_REGION), builderCall('nyx')]).then(([R, b]) => {
        if (dead) return
        if (!b) { setStatus('could not read the builder draft (owner only)'); return }
        regionRef.current = R
        setOvData(nyxOverlay(R.meta))
        const list = nyxTiles(R.meta, R.h).filter(t => t.land > 0.02)
        const byName = new Map(list.map(t => [t.name, t]))
        gridRef.current = { byName, at: (tx, ty) => byName.get(`nyx_${tx}_${ty}`) }
        setSnapB(b); setSavedAt(b.draftAt)
        const store: Edits = { ...b.draft.tiles }; for (const [t, m] of Object.entries(b.draft.water)) store[wkey(t)] = { ...m }; for (const [t, m] of Object.entries(b.draft.falls)) store[fkey(t)] = { ...m }
        if (b.draft.voids) store[VOIDS_KEY] = { ...b.draft.voids }
        edits.current = store; setZones(b.draft.zones ?? [])
        const first = [...list].sort((a, c) => Math.hypot(a.tx, a.ty) - Math.hypot(c.tx, c.ty) || c.land - a.land)[0]
        setTiles(list)
        if (first) setTile(first.name)
        setStatus(''); setRev(r => r + 1)
      }).catch(err => setStatus(`failed to load: ${String(err)}`))
      return () => { dead = true }
    }
    Promise.all([loadIndex(), loadNetwork(), builderCall('wilds')]).then(([idx, nw, b]) => {
      if (dead) return
      if (!b) { setStatus('could not read the builder draft (owner only)'); return }
      const layer = { edits: b.draft.tiles, water: b.draft.water, falls: b.draft.falls }
      setSnapB(b); setSavedAt(b.draftAt)
      const w = makeWorld(idx); if (nw) { w.clear = clearing(nw); w.roads = roadField(nw) }
      w.voids = makeVoids(idx, nw ?? null, [], b.draft.voids ?? null)   // M104: the DRAFT's void brush cells over the generated voids
      voidSrc.current = { idx, nw: nw ?? null }; voidSig.current = sigOf(b.draft.voids)
      setOvData(wildsOverlay(nw ?? null, w.voids.crossings))
      worldRef.current = w; gridRef.current = w
      const store: Edits = { ...layer.edits }; for (const [t, m] of Object.entries(layer.water)) store[wkey(t)] = { ...m }; for (const [t, m] of Object.entries(layer.falls)) store[fkey(t)] = { ...m }
      if (b.draft.voids) store[VOIDS_KEY] = { ...b.draft.voids }
      edits.current = store; setZones(b.draft.zones ?? []); setZoneNet(nw ?? null)
      setTiles(idx.tiles.filter(t => t.land > 0.02).map(t => ({ name: t.name, tx: t.tx, ty: t.ty, land: t.land })).sort((a, b) => a.ty - b.ty || a.tx - b.tx))
      setStatus('')
      setRev(r => r + 1)
    }).catch(err => setStatus(`failed to load: ${String(err)}`))
    return () => { dead = true }
  }, [glade, nyx])

  // M105: the continent's shop doors come from each town's plan (business/doors.ts, the game's own): only once the overlay is opened
  useEffect(() => {
    const R = regionRef.current
    if (!nyx || !showOv || ovDoors || !R) return
    let dead = false
    import('../../open/business/doors').then(m => {
      if (dead) return
      const safe = (id: string) => { try { return m.doorsCached(R, id) } catch { return [] } }
      setOvData(nyxOverlay(R.meta, safe)); setOvDoors(true)
    }).catch(() => { /* places + roads still drawn */ })
    return () => { dead = true }
  }, [nyx, showOv, ovDoors, rev])

  // ── the tile + its neighbours, parsed bare (no edits) ──
  useEffect(() => {
    const w = gridRef.current; if (!w) return
    const c = w.byName.get(tile); if (!c) { setStatus(`no tile ${tile}`); return }
    const R = regionRef.current
    if (nyx && R) {   // M83 s3: a continent tile is a straight copy of region vertices, no parse
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const t = w.at(c.tx + dx, c.ty + dy); if (!t || bases.current.has(t.name)) continue
        const T = nyxBrushTile(R.meta, t.tx, t.ty), S = sampleNyxTile(R.meta, R.h, t.tx, t.ty)
        const meta: WildsMeta = { name: T.name, cell: T.cell, nx: T.nx, nz: T.nz, sizeX: T.sizeX, sizeZ: T.sizeZ, waterY: NYX_WATER_Y, source: { x0: 0, y0: 0, x1: 0, y1: 0, mPerPx: T.cell } }
        bases.current.set(t.name, { meta, tx: t.tx, ty: t.ty, ox: T.ox, oz: T.oz, h: S.h, voided: S.voided, voidV: S.voidV })
      }
      setStatus(''); setReady(true); setRev(r => r + 1)
      return
    }
    const W0 = worldRef.current; if (!W0) return
    let dead = false
    setReady(false)
    const want: string[] = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = w.at(c.tx + dx, c.ty + dy); if (t) want.push(t.name) }
    const need = want.filter(n => !bases.current.has(n))
    if (need.length) setStatus(`parsing ${need.length} tile${need.length > 1 ? 's' : ''}…`)
    Promise.all(need.map(async n => {
      const W = await loadWilds(n, '/open/wilds', zonesOf(W0, n), W0.clear, W0.roads, W0.voids, null)
      const t = W0.byName.get(n)!
      bases.current.set(n, { meta: W.meta, tx: t.tx, ty: t.ty, ox: t.tx * TILE_M, oz: t.ty * TILE_M, h: W.h, voided: W.voided })
    })).then(() => { if (!dead) { setStatus(''); setReady(true); setRev(r => r + 1) } })
      .catch(err => { if (!dead) setStatus(`parse failed: ${String(err)}`) })
    return () => { dead = true }
  }, [tile, tiles, voidRev])

  // ── M83 overview: every Wilds tile's raw heights, a few at a time (glade/nyx have theirs in memory already) ──
  useEffect(() => {
    if (glade || nyx || !tiles.length) return
    let dead = false
    const todo = tiles.map(t => t.name).filter(n => !rawRef.current.has(n))
    const worker = async () => {
      for (let n = todo.shift(); n && !dead; n = todo.shift()) {
        try { const r = await fetch(`/open/wilds/${n}.bin`); if (r.ok) { rawRef.current.set(n, new Int16Array(await r.arrayBuffer())); if (!dead) setRawN(c => c + 1) } } catch { /* drawn when opened */ }
      }
    }
    for (let i = 0; i < 6; i++) worker()
    return () => { dead = true }
  }, [tiles, glade, nyx])
  const ovTiles = useMemo((): OvTile[] => glade ? [{ name: GLADE_LAYER_TILE, tx: 0, ty: 0 }] : tiles, [glade, tiles])
  const ovSource = useCallback((t: OvTile): OvSource | null => {
    const B = bases.current.get(t.name)
    if (B) {
      const { nx, nz } = B.meta
      return { nx, nz, at: (i, j) => (B.voidV?.[j * nx + i] || B.voided?.[Math.min(j, nz - 2) * (nx - 1) + Math.min(i, nx - 2)]) ? NaN : B.h[j * nx + i] }
    }
    if (nyx) {
      const R = regionRef.current; if (!R) return null
      const N = nyxN(R.meta), { i0, j0 } = nyxOrigin(R.meta, t.tx, t.ty), M = R.meta
      return { nx: N, nz: N, at: (a, b) => { const i = i0 + a, j = j0 + b; return i >= 0 && j >= 0 && i < M.nx && j < M.nz ? R.h[j * M.nx + i] : NaN } }
    }
    const raw = rawRef.current.get(t.name); if (!raw) return null
    const n = Math.round(Math.sqrt(raw.length)), cell = TILE_M / (n - 1), V = worldRef.current?.voids
    return { nx: n, nz: n, at: (i, j) => V?.isVoid(t.tx * TILE_M - TILE_M / 2 + i * cell, t.ty * TILE_M - TILE_M / 2 + j * cell) ? NaN : raw[j * n + i] / 10 }
  }, [nyx])

  // ── the edited ground, in WORLD coords (what the brush reads) ──
  const heightAt = useCallback((x: number, z: number): number => {
    let name: string, B: Base | undefined
    if (glade) { name = GLADE_LAYER_TILE; B = bases.current.get(name) }
    else {
      const w = gridRef.current; if (!w) return NaN
      const { tx, ty } = tileOf(x, z), t = w.at(tx, ty); if (!t) return NaN
      name = t.name; B = bases.current.get(name)
    }
    if (!B) return NaN
    const { nx, nz, cell, sizeX, sizeZ } = B.meta, E = edits.current[name]
    const rx = (x - B.ox + sizeX / 2) / cell, rz = (z - B.oz + sizeZ / 2) / cell
    if (B.voidV) {   // the Glade: off its tile, or at a vertex that is not ground, there is nothing to stand on or sculpt
      if (!(rx >= 0 && rz >= 0 && rx <= nx - 1 && rz <= nz - 1) || B.voidV[Math.round(rz) * nx + Math.round(rx)]) return NaN
    }
    const fx = Math.min(nx - 1 - 1e-6, Math.max(0, rx)), fz = Math.min(nz - 1 - 1e-6, Math.max(0, rz))
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j
    const at = (ii: number, jj: number) => { const k = jj * nx + ii; return B.h[k] + (E?.[k] ?? 0) / 10 }
    if (glade) return triLerp(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1), u, v)   // M157: the ground the game draws and walks
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v
  }, [glade])   // nyx reads gridRef (set before ready)
  // M84 s3: the zones' builds in Fly (world coords, on the draft's ground), read-only; rebuilt when the zones or the ground change
  const flyParts = useMemo(() => (view === 'fly' ? zoneParts(zones, heightAt) : []), [view, zones, heightAt, rev])
  const brushTiles = useCallback((): BrushTile[] => [...bases.current.entries()].map(([name, B]) => ({ name, ox: B.ox, oz: B.oz, nx: B.meta.nx, nz: B.meta.nz, cell: B.meta.cell, sizeX: B.meta.sizeX, sizeZ: B.meta.sizeZ })), [])

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
      else if (glade && poolOver(B.ox - B.meta.sizeX / 2 + i * cell, B.oz - B.meta.sizeZ / 2 + j * cell, h)) { const d = Math.min(1, (POOL_Y - h) / 2); r = 0.66 - 0.3 * d; g = 0.84 - 0.22 * d; b = 0.95 - 0.08 * d }   // M157: the Moonwell's own water
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
    // M104: the void brush's cells on this tile (erase = green, the crust holds; paint = red, void); the carve shows after the stroke
    const VO = edits.current[VOIDS_KEY]
    if (VO && (showEdits || opts.current.brush === 'void')) {
      const x0 = B.ox - B.meta.sizeX / 2, z0 = B.oz - B.meta.sizeZ / 2, s = VCELL / cell
      for (let j = cellOf(z0); j <= cellOf(z0 + B.meta.sizeZ); j++) for (let i = cellOf(x0); i <= cellOf(x0 + B.meta.sizeX); i++) {
        const v = VO[cellKey(i, j)]; if (!v) continue
        ctx.fillStyle = v < 0 ? 'rgba(120,235,160,0.35)' : 'rgba(255,80,60,0.42)'
        ctx.fillRect((i * VCELL - x0) / cell, (j * VCELL - z0) / cell, s, s)
      }
    }
    // falls: every sheet the game will draw (auto from the ponds + the drawn lines), white; drawn lines get their points
    const hAtL = (x: number, z: number) => { const fx = Math.min(nx - 1.001, Math.max(0, (x + B.meta.sizeX / 2) / cell)), fz = Math.min(nz - 1.001, Math.max(0, (z + B.meta.sizeZ / 2) / cell)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j; return (H[j * nx + i] * (1 - u) + H[j * nx + i + 1] * u) * (1 - v) + (H[(j + 1) * nx + i] * (1 - u) + H[(j + 1) * nx + i + 1] * u) * v }
    const lines = fallLines(edits.current[fkey(tileRef.current)]), sheets = fallSheets(B.meta, H, hAtL, ponds(B.meta, H, Wm).cells, lines)
    const P = (x: number, z: number): [number, number] => [(x + B.meta.sizeX / 2) / cell, (z + B.meta.sizeZ / 2) / cell]
    ctx.lineCap = 'round'
    for (const q of sheets) { ctx.strokeStyle = q.auto ? 'rgba(255,255,255,0.95)' : 'rgba(255,250,210,0.95)'; ctx.lineWidth = q.auto ? 1 : 1.5; ctx.beginPath(); ctx.moveTo(...P(q.ax, q.az)); ctx.lineTo(...P(q.bx, q.bz)); ctx.stroke() }
    for (const L of lines) { ctx.fillStyle = 'rgba(255,240,170,0.9)'; for (const p of L.pts) { const [a, b] = P(p[0], p[1]); ctx.fillRect(a - 0.5, b - 0.5, 1, 1) } }
    const cur = line.current; if (cur && cur.length > 1) { ctx.strokeStyle = 'rgba(255,220,120,1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...P(cur[0][0], cur[0][1])); for (const p of cur.slice(1)) ctx.lineTo(...P(p[0], p[1])); ctx.stroke() }
  }, [showEdits, glade])
  useEffect(() => { if (ready) draw() }, [ready, rev, draw])
  const raf = useRef(0)
  const redraw = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; draw() }) }, [draw])

  const allKeys = () => [...bases.current.keys()].flatMap(n => [n, wkey(n), fkey(n)]).concat(VOIDS_KEY)
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
        const rm = removeFallsNear(edits.current[fkey(name)], x - B.ox, z - B.oz, o.radius)
        if (Object.keys(rm).length) markDirty(mergeEdits(edits.current, { [fkey(name)]: rm }))
      }
    } else if (o.brush === 'void') {
      if (glade || nyx) return   // no voids on this map
      markDirty(mergeEdits(edits.current, { [VOIDS_KEY]: paintVoids(edits.current[VOIDS_KEY], x, z, o.radius, o.voidMode) }))
    } else if (o.brush !== 'falls' && o.brush !== 'zone') {
      const d = applyBrush(heightAt, brushTiles(), edits.current, { kind: o.brush, x, z, r: o.radius, s: o.strength, target })
      markDirty(mergeEdits(edits.current, d))
    }
    redraw()
  }, [heightAt, brushTiles, redraw, glade, nyx])

  // M104: rebuild the void field when the void cells changed (never mid-stroke: rev only moves on stroke end / undo / load)
  useEffect(() => {
    const w = worldRef.current, src = voidSrc.current; if (!w || !src || glade || nyx || paint.current) return
    const ov = edits.current[VOIDS_KEY] as VoidEdits | undefined, sig = sigOf(ov)
    if (sig === voidSig.current) return
    voidSig.current = sig
    w.voids = makeVoids(src.idx, src.nw, [], ov ?? null)
    setOvData(wildsOverlay(src.nw, w.voids.crossings))
    bases.current.clear(); setVoidRev(v => v + 1)
  }, [rev, glade, nyx])

  const toWorld = (e: { clientX: number; clientY: number }) => {
    const cv = canvas.current, B = bases.current.get(tileRef.current); if (!cv || !B) return null
    const rc = cv.getBoundingClientRect(), u = (e.clientX - rc.left) / rc.width, v = (e.clientY - rc.top) / rc.height
    if (u < 0 || u > 1 || v < 0 || v > 1) return null
    return { u, v, x: B.ox - B.meta.sizeX / 2 + u * B.meta.sizeX, z: B.oz - B.meta.sizeZ / 2 + v * B.meta.sizeZ }
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
    if (opts.current.brush === 'falls') { const b = bases.current.get(tileRef.current)!; line.current = [[p.x - b.ox, p.z - b.oz]]; return }
    if (opts.current.brush === 'zone') { zoneDrag.current = { ax: p.x, az: p.z, bx: p.x, bz: p.z }; setZoneBox(null); return }   // M84 s1: drag a rectangle
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
    setHover({ x: Math.round(p.x - (B ? B.ox : 0)), z: Math.round(p.z - (B ? B.oz : 0)), h: heightAt(p.x, p.z), d: 0 })
    if (paint.current) { paint.current.x = p.x; paint.current.z = p.z }
    const zd = zoneDrag.current; if (zd) { zd.bx = p.x; zd.bz = p.z; setZoneBox(normRect(zd.ax, zd.az, zd.bx, zd.bz)) }
    if (line.current && B) { const q: [number, number] = [p.x - B.ox, p.z - B.oz], l = line.current[line.current.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= 3) { line.current.push(q); redraw() } }
  }
  const commitLine = (pts: [number, number][], w: number, name = tileRef.current) => {
    const k = fkey(name), add = addFall(edits.current[k], pts, w); if (!Object.keys(add).length) return false
    hist.current.begin(edits.current, [k]); markDirty(mergeEdits(edits.current, { [k]: add })); hist.current.commit(); setRev(r => r + 1); return true
  }
  const endStroke = () => {
    const zd = zoneDrag.current
    if (zd) { zoneDrag.current = null; setZoneBox(null); endZoneDrag(zd); return }
    if (line.current) { const pts = line.current; line.current = null; if (!commitLine(pts, opts.current.fallW)) redraw(); return }
    const q = paint.current; if (!q) return; clearInterval(q.timer); paint.current = null; hist.current.commit(); setRev(r => r + 1) }

  // ── M84 s1: zones. A drag makes one (flattened to the ground under the first click, blended out ZONE_BLEND_M); a click selects
  // one (its tag popup). Zones are not in the undo history (it resets on a zone change, so an older undo can never rewrite a
  // zone's ground); Delete is the undo: it writes back the deltas the zone replaced. ──
  const createZone = (ax: number, az: number, bx: number, bz: number): Zone | null => {
    const r = normRect(ax, az, bx, bz), h = heightAt(ax, az)
    if (!bigEnough(r)) return null
    if (!Number.isFinite(h)) { setStatus('a zone starts on ground (the first click was off the land)'); return null }
    const hit = overlapping(zonesRef.current, r)
    if (hit) { setStatus(`zones cannot overlap (with ${zoneLabel(hit)}, ${ZONE_BLEND_M} m edge included)`); return null }
    const { d, prev } = flattenZone(brushTiles(), heightAt, edits.current, r, Math.round(h * 10) / 10)
    const z: Zone = { id: newZoneId(zonesRef.current), ...r, h: Math.round(h * 10) / 10, tag: null, prev }
    markDirty([...mergeEdits(edits.current, d), ZONES_KEY]); hist.current = new EditHistory()
    setZones([...zonesRef.current, z]); setSelZone(z.id); setStatus(''); setRev(v => v + 1)
    return z
  }
  const endZoneDrag = (zd: { ax: number; az: number; bx: number; bz: number }) => {
    if (bigEnough(normRect(zd.ax, zd.az, zd.bx, zd.bz))) { createZone(zd.ax, zd.az, zd.bx, zd.bz); return }
    const z = zoneAt(zonesRef.current, zd.ax, zd.az); setSelZone(z ? z.id : null)
  }
  const deleteZone = (id: string): boolean => {
    const z = zonesRef.current.find(q => q.id === id); if (!z) return false
    markDirty([...mergeEdits(edits.current, z.prev), ZONES_KEY]); hist.current = new EditHistory()
    setZones(zonesRef.current.filter(q => q.id !== id)); setSelZone(null); setRev(v => v + 1)
    return true
  }
  const tagZone = (id: string, tag: ZoneTag | null) => {
    if (!zonesRef.current.some(q => q.id === id)) return false
    setZones(zonesRef.current.map(q => q.id === id ? { ...q, tag } : q)); markDirty([ZONES_KEY]); return true
  }
  // M84 s2: the zone's build changed (ZoneBuilder): it rides with the zone, so the zones key autosaves it
  const buildOnZone = (z: Zone) => {
    if (!zonesRef.current.some(q => q.id === z.id)) return false
    setZones(zonesRef.current.map(q => q.id === z.id ? z : q)); markDirty([ZONES_KEY]); return true
  }
  const undo = useCallback(() => { markDirty(hist.current.undo(edits.current)); setRev(r => r + 1) }, [])
  const redo = useCallback(() => { markDirty(hist.current.redo(edits.current)); setRev(r => r + 1) }, [])
  const resetTile = () => { hist.current.begin(edits.current, [tile, wkey(tile), fkey(tile)]); delete edits.current[tile]; delete edits.current[wkey(tile)]; delete edits.current[fkey(tile)]; hist.current.commit(); markDirty([tile, wkey(tile), fkey(tile)]); setRev(r => r + 1) }
  // the whole store as one layer (the draft is small and sparse: one request replaces it, so there is no per-tile race)
  const layerOf = (): Layer => {
    const L: Layer = { v: 1, tiles: {}, water: {}, falls: {} }
    for (const [k, m] of Object.entries(edits.current)) {
      if (!Object.keys(m).length) continue
      if (k === VOIDS_KEY) L.voids = m; else if (k.startsWith(WATER_PREFIX)) L.water[tileOfKey(k)] = m; else if (k.startsWith(FALLS_PREFIX)) L.falls[tileOfKey(k)] = m; else L.tiles[k] = m
    }
    if (zonesRef.current.length) L.zones = zonesRef.current
    return L
  }
  const loadLayer = (L: Layer) => {
    const store: Edits = { ...L.tiles }; for (const [t, m] of Object.entries(L.water)) store[wkey(t)] = { ...m }; for (const [t, m] of Object.entries(L.falls)) store[fkey(t)] = { ...m }
    if (L.voids) store[VOIDS_KEY] = { ...L.voids }
    edits.current = store; setZones(L.zones ?? []); setSelZone(null); hist.current = new EditHistory(); dirtyRef.current.clear(); setDirty([]); setRev(r => r + 1)
  }
  const save = useCallback(async (auto = false): Promise<boolean> => {
    const names = [...dirtyRef.current]; if (!names.length) return true
    if (!auto) setStatus('saving the draft…')
    const b = await builderCall(map, { action: 'draft', layer: layerOf() })
    if (b) { for (const n of names) dirtyRef.current.delete(n); setSnapB(b); setSavedAt(b.draftAt ?? Date.now()) }
    setDirty([...dirtyRef.current])
    setStatus(b ? (auto ? '' : 'draft saved · players see it after Publish') : 'save FAILED (nothing written; try again)')
    return !!b
  }, [map])
  const publish = useCallback(async (msg?: string): Promise<boolean> => {
    if (!(await save())) return false
    setBusy(true); setStatus('publishing…')
    const b = await builderCall(map, { action: 'publish', note: msg ?? note })
    setBusy(false)
    if (b) { setSnapB(b); setNote('') }
    setStatus(b ? `published v${b.index.live} · live on the next ${LOAD_NAME[map]} load` : lastError.msg ? `${lastError.msg} (live unchanged)` : 'publish FAILED (live unchanged)')
    return !!b
  }, [save, note, map, glade])
  const rollback = useCallback(async (v: number): Promise<boolean> => {
    setBusy(true); setStatus(`rolling back to v${v}…`)
    const b = await builderCall(map, { action: 'rollback', v })
    setBusy(false)
    if (b) { setSnapB(b); setSavedAt(b.draftAt); loadLayer(b.draft) }
    setStatus(b ? `rolled back to v${v} (now v${b.index.live}) · the draft is that version too` : 'rollback FAILED (live unchanged)')
    return !!b
  }, [map])
  // AUTOSAVE every minute while there are unsaved strokes; the label ticks every 5 s
  useEffect(() => {
    const a = setInterval(() => { if (dirtyRef.current.size && !paint.current) save(true) }, AUTOSAVE_MS)
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => { clearInterval(a); clearInterval(t) }
  }, [save])

  const viewRef = useRef(view); viewRef.current = view
  useEffect(() => { if (view !== 'fly') setFull(false) }, [view])
  // keys: 1-8 brush, V void erase/paint, [ ] radius, F fullscreen fly, Esc leave it, ctrl+z / ctrl+shift+z / ctrl+y, ctrl+s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
      else if (!mod && e.key >= '1' && e.key <= '9') setBrush(TOOLS[+e.key - 1])
      else if (!mod && e.code === 'KeyV' && !e.repeat) setVoidMode(m => (m === -1 ? 1 : -1))   // M104: void brush erase / paint
      else if (!mod && (e.code === 'Minus' || e.code === 'NumpadSubtract')) setStrength(s => stepStrength(s, -1))   // M83: strength - / =
      else if (!mod && (e.code === 'Equal' || e.code === 'NumpadAdd')) setStrength(s => stepStrength(s, 1))
      else if (e.key === '[') setRadius(r => Math.max(4, r - 4))
      else if (e.key === ']') setRadius(r => Math.min(80, r + 4))
      else if (!mod && e.code === 'KeyF' && !e.repeat && viewRef.current === 'fly') setFull(f => !f)
      else if (!mod && e.code === 'KeyO' && !e.repeat) setShowOv(v => !v)   // M105: the POI + roads overlay
      else if (e.key === 'Escape') setFull(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, save])
  // switching maps unmounts this editor: send its unsaved strokes as the draft on the way out (keepalive survives the unmount)
  const layerRef = useRef(() => layerOf()); layerRef.current = () => layerOf()
  useEffect(() => () => {
    if (!dirtyRef.current.size) return
    try { fetch('/shimmer/save-builder', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map, action: 'draft', layer: layerRef.current() }) }) } catch { /* */ }
  }, [map])
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
      ready, tile, map,
      heightAt: (lx: number, lz: number) => { const b = B(); return b ? heightAt(b.ox + lx, b.oz + lz) : NaN },
      /** the open tile's centre in world coords (M83 s3: the check maps tile-local to the continent's world xz) */
      origin: () => { const b = B(); return b ? { x: b.ox, z: b.oz } : null },
      stroke: (kind: Brush, lx: number, lz: number, r: number, s: number, n = 1) => {
        const b = B(); if (!b) return false
        const x = b.ox + lx, z = b.oz + lz, target = kind === 'flatten' ? heightAt(x, z) : undefined
        hist.current.begin(edits.current, allKeys())
        for (let i = 0; i < n; i++) markDirty(mergeEdits(edits.current, applyBrush(heightAt, brushTiles(), edits.current, { kind, x, z, r, s, target })))
        hist.current.commit(); setRev(v => v + 1); return true
      },
      /** paint water at an absolute level (m), or dry it (null) */
      water: (lx: number, lz: number, r: number, lv: number | null) => {
        const b = B(); if (!b) return false
        hist.current.begin(edits.current, allKeys())
        const d = paintWater(brushTiles(), b.ox + lx, b.oz + lz, r, lv), pre: Record<string, WaterMap> = {}
        for (const [t, m] of Object.entries(d)) pre[wkey(t)] = m
        markDirty(foldWater(edits.current, pre, lv === null)); hist.current.commit(); setRev(v => v + 1); return true
      },
      /** the water level painted at a point (m) or null */
      levelAt: (lx: number, lz: number) => { const b = B(); if (!b) return null; const { cell, sizeX, sizeZ, nx } = b.meta, i = Math.floor((lx + sizeX / 2) / cell), j = Math.floor((lz + sizeZ / 2) / cell), v = edits.current[wkey(tileRef.current)]?.[String(j * (nx - 1) + i)]; return v === undefined ? null : v / 10 },
      /** draw a waterfall line (tile-local points) of width w */
      fall: (pts: [number, number][], w: number) => commitLine(pts, w),
      /** what the game will draw on this tile: sheets (auto from ponds + lines) */
      sheets: () => { const b = B(); if (!b) return []; const nm = tileRef.current, E = edits.current[nm], H = Float32Array.from(b.h, (v, k) => v + (E?.[k] ?? 0) / 10), hAt = (x: number, z: number) => heightAt(b.ox + x, b.oz + z); return fallSheets(b.meta, H, hAt, ponds(b.meta, H, edits.current[wkey(nm)]).cells, fallLines(edits.current[fkey(nm)])).map(q => ({ auto: q.auto, top: q.top, bottom: q.bottom })) },
      undo, redo, save, dirty: () => [...dirtyRef.current],
      publish, rollback, builder: () => snapB, savedAt: () => savedAt,
      strength, radius, brush, lockLook, setLockLook,
      /** M104: the void brush at tile-local (lx, lz): mode -1 erase / 1 paint, one undo step; the field rebuilds + tiles re-parse */
      voidStroke: (lx: number, lz: number, r: number, mode: -1 | 1) => {
        const b = B(); if (!b || glade || nyx) return false
        hist.current.begin(edits.current, allKeys())
        markDirty(mergeEdits(edits.current, { [VOIDS_KEY]: paintVoids(edits.current[VOIDS_KEY], b.ox + lx, b.oz + lz, r, mode) }))
        hist.current.commit(); setRev(v => v + 1); return true
      },
      /** the DRAFT's void field at tile-local (lx, lz) (the builder's own, edits applied) */
      voidAt: (lx: number, lz: number) => { const b = B(), V = worldRef.current?.voids; if (!b || !V) return null; return { w: V.weight(b.ox + lx, b.oz + lz), isVoid: V.isVoid(b.ox + lx, b.oz + lz), crossings: V.crossings.length } },
      voidCells: () => Object.keys(edits.current[VOIDS_KEY] ?? {}).length,
      voidRev, status: () => status,
      /** M105: the overlay: on/off, toggle, and the data it draws (the game's own) */
      overlay: { on: showOv, set: setShowOv, data: () => ovAll, doors: ovDoors },
      /** M84 s1: the zones (tile-local helpers for the check), the open popup, and the actions the popup drives */
      zones: () => zonesRef.current.map(z => ({ id: z.id, x0: z.x0, z0: z.z0, x1: z.x1, z1: z.z1, h: z.h, tag: z.tag, n: Object.values(z.prev).reduce((a, m) => a + Object.keys(m).length, 0), build: z.build ?? [] })),
      selZone, deleteZone, tagZone, setBrush,
    }
  }, [ready, tile, map, heightAt, brushTiles, undo, redo, save, publish, rollback, snapB, savedAt, strength, radius, brush, lockLook, showOv, ovAll, ovDoors, voidRev, status, glade, nyx, selZone])

  // M105: the overlay cut to the open tile (tile view) and to its 3x3 ring (Fly); off = undefined, nothing drawn
  const Bt = bases.current.get(tile)
  const tileOv = useMemo((): Overlay | null => {
    if (!showOv || !Bt) return null
    const x0 = Bt.ox - Bt.meta.sizeX / 2, z0 = Bt.oz - Bt.meta.sizeZ / 2, x1 = x0 + Bt.meta.sizeX, z1 = z0 + Bt.meta.sizeZ
    return { pois: poisIn(ovAll, x0, z0, x1, z1), roads: roadsIn(ovAll, x0, z0, x1, z1) }
  }, [showOv, Bt, ovAll])
  const flyOv = useMemo((): Overlay | undefined => {
    if (!showOv || !Bt) return undefined
    const S = Bt.meta.sizeX, x0 = Bt.ox - S * 1.5, z0 = Bt.oz - Bt.meta.sizeZ * 1.5, x1 = Bt.ox + S * 1.5, z1 = Bt.oz + Bt.meta.sizeZ * 1.5
    return { pois: poisIn(ovAll, x0, z0, x1, z1), roads: roadsIn(ovAll, x0, z0, x1, z1) }
  }, [showOv, Bt, ovAll])
  const cur = tiles.find(t => t.name === tile)
  const step = (dx: number, dy: number) => { const w = gridRef.current; if (!w || !cur) return; const t = w.at(cur.tx + dx, cur.ty + dy); if (t) setTile(t.name) }
  const B = bases.current.get(tile)
  const nEdits = Object.keys(edits.current[tile] ?? {}).length, nWater = Object.keys(edits.current[wkey(tile)] ?? {}).length, nFalls = fallLines(edits.current[fkey(tile)]).length

  const btn = 'px-2.5 py-1 rounded text-xs font-mono border transition-colors'
  const on = 'bg-amber-500/20 border-amber-400 text-amber-200', off = 'bg-white/5 border-white/15 text-white/60 hover:text-white'
  return (
    <div className="flex flex-col lg:flex-row gap-4 text-white/85">
      <div className="flex flex-col gap-2 w-full max-w-[760px]">
      <div className="flex flex-wrap gap-1 items-center">{/* M83 s2b: wraps (the map buttons crowded the row) */}
        {(['wilds', 'glade', 'nyx'] as const).map(m => <button key={m} className={`${btn} ${map === m ? on : off}`} onClick={() => map !== m && onMap(m)} data-testid={`map-${m}`}>{MAP_NAME[m]}</button>)}
        <span className="w-3" />
        {(['2d', 'fly'] as const).map(v => <button key={v} className={`${btn} ${view === v ? on : off}`} onClick={() => setView(v)} data-testid={`view-${v}`}>{v === '2d' ? 'Map (top-down)' : 'Fly (3D)'}</button>)}
        <button className={`${btn} ${showOv ? on : off}`} onClick={() => setShowOv(v => !v)} data-testid="overlay-toggle" title="POIs + roads, where the game puts them (read-only)">POIs + roads (O)</button>
        {view === 'fly' && <button className={`${btn} ${off}`} onClick={() => setFull(true)} data-testid="fly-full">Fullscreen (F)</button>}
        {view === 'fly' && <button className={`${btn} ${lockLook ? on : off}`} onClick={() => setLockLook(v => !v)} data-testid="fly-lock" title="on: click the view to lock the mouse (look + crosshair brush, Esc frees it). off: left-drag sculpts at the pointer, right-drag looks">Mouse-look {lockLook ? 'on' : 'off'}</button>}
        {view === 'fly' && <span className="basis-full text-[11px] font-mono text-white/40">{lockLook ? 'click the view: mouse looks, crosshair = brush, left = sculpt, Esc frees' : 'right-drag look · left-drag sculpt'} · WASD move · Space/C up/down · Shift fast · wheel zoom · T top-down · - = strength · [ ] radius</span>}
      </div>
      {view === 'fly' && B && (
        <div className={full ? 'fixed inset-0 z-[60] bg-black select-none touch-none' : 'relative w-full aspect-[4/3] bg-black/40 rounded overflow-hidden select-none touch-none'} data-testid="fly-frame" data-full={full ? '1' : '0'}>
          {full && (
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none [&>*]:pointer-events-auto">
              <div className="flex gap-1 items-center rounded bg-black/70 border border-white/10 px-2 py-1.5">
                {TOOLS.map((t, i) => <button key={t} className={`${btn} ${brush === t ? on : off}`} disabled={t === 'void' && (glade || nyx)} onClick={() => setBrush(t)}>{i + 1} {t[0].toUpperCase() + t.slice(1)}</button>)}
                {brush === 'void' && <button className={`${btn} ${on}`} onClick={() => setVoidMode(m => (m === -1 ? 1 : -1))}>{voidMode === -1 ? 'Erase' : 'Paint'} (V)</button>}
                <span className="text-[11px] font-mono text-white/70 tabular-nums pl-2">radius {radius} m [ ] · strength {strength.toFixed(2)} - =</span>
                <button className={`${btn} ${off}`} onClick={undo}>Undo</button>
                <button className={`${btn} ${showOv ? on : off}`} onClick={() => setShowOv(v => !v)}>POIs (O)</button>
                <button className={`${btn} ${off}`} onClick={() => setFull(false)} data-testid="fly-exit">Exit (Esc)</button>
              </div>
              <div className="w-fit rounded bg-black/70 border border-white/10 px-2 py-1 text-[11px] font-mono text-white/60 tabular-nums">
                {dirty.length ? 'unsaved, autosave soon' : savedAgo(savedAt, Date.now())} · WASD · Space/C · Shift fast · wheel · T top-down · {lockLook ? (locked ? 'left sculpt at the crosshair · Esc frees the mouse' : 'click to lock the mouse') : 'right-drag look · left-drag sculpt'}
              </div>
            </div>
          )}
          {/* the 3x3 ring only: bases caches every tile opened this session (builder-fly-check saw 18 meshes after two tiles) */}
          <BuilderFly tiles={[...bases.current.entries()].filter(([, b]) => Math.abs(b.tx - B.tx) <= 1 && Math.abs(b.ty - B.ty) <= 1).map(([name, b]): FlyTile => ({ name, ox: b.ox, oz: b.oz, nx: b.meta.nx, nz: b.meta.nz, cell: b.meta.cell, sizeX: b.meta.sizeX, sizeZ: b.meta.sizeZ, h: b.h, waterY: b.meta.waterY, voidV: b.voidV, noSea: glade, full: glade }))}
            deltas={n => edits.current[n]} rev={rev} heightAt={heightAt} radius={radius} focus={glade ? GLADE_FOCUS : { x: B.ox, z: B.oz }}
            onBegin={beginAt} onMove={moveAt} onEnd={endStroke} lockLook={lockLook} onLock={setLocked} overlay={flyOv} parts={flyParts} pool={glade} />
          {!full && <div className="absolute left-2 bottom-2 rounded bg-black/60 px-2 py-1 text-[11px] font-mono text-white/75 tabular-nums pointer-events-none" data-testid="fly-hud">
            {TOOL_KEY[brush]} · strength {strength.toFixed(2)} m/tick (- =) · radius {radius} m ([ ]){lockLook ? (locked ? ' · Esc frees the mouse' : ' · click to lock the mouse') : ''}
          </div>}
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
        {showOv && tileOv && B && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`${B.ox - B.meta.sizeX / 2} ${B.oz - B.meta.sizeZ / 2} ${B.meta.sizeX} ${B.meta.sizeZ}`} preserveAspectRatio="none" data-testid="ov-tile">
            {tileOv.roads.map((r, k) => <polyline key={k} points={r.pts.map(q => `${q[0]},${q[1]}`).join(' ')} fill="none" stroke={ROAD_COLOR} strokeOpacity={0.9} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray={r.kind === 'ferry' ? '6 4' : undefined} data-road={r.kind} />)}
            {tileOv.pois.map((p, k) => { const m = B.meta.sizeX / 760; return (
              <g key={k} data-poi={p.kind} data-name={p.name} data-x={p.x} data-z={p.z}>
                <circle cx={p.x} cy={p.z} r={5 * m} fill={POI_COLOR[p.kind]} stroke="black" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                <text x={p.x + 8 * m} y={p.z + 4 * m} fontSize={12 * m} fill="white" stroke="black" strokeWidth={3 * m} paintOrder="stroke" fontFamily="ui-monospace, monospace">{p.name}</text>
              </g>) })}
          </svg>
        )}
        {B && (brush === 'zone' || zoneBox) && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`${B.ox - B.meta.sizeX / 2} ${B.oz - B.meta.sizeZ / 2} ${B.meta.sizeX} ${B.meta.sizeZ}`} preserveAspectRatio="none" data-testid="zone-tile">
            {zones.map(z => <rect key={z.id} x={z.x0} y={z.z0} width={z.x1 - z.x0} height={z.z1 - z.z0} fill={z.id === selZone ? 'rgba(232,121,249,0.25)' : 'rgba(232,121,249,0.10)'} stroke="#e879f9" strokeWidth={z.id === selZone ? 2 : 1} vectorEffect="non-scaling-stroke" data-zone={z.id} />)}
            {zones.flatMap(z => (z.build ?? []).map(p => { const f = FURNITURE[p.item]; return f ? <polygon key={`${z.id}/${p.id}`} points={quad(z.x0 + p.x, z.z0 + p.z, f.w, f.d, p.q).map(([x, y]) => `${x},${y}`).join(' ')} fill={f.panel ? '#a8794e' : f.slab ? '#d8c39a' : '#7fa6c4'} data-zone-part={p.id} /> : null }))}
            {zoneBox && <rect x={zoneBox.x0} y={zoneBox.z0} width={zoneBox.x1 - zoneBox.x0} height={zoneBox.z1 - zoneBox.z0} fill="rgba(255,255,255,0.12)" stroke="white" strokeDasharray="4 3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" data-testid="zone-drag" />}
          </svg>
        )}
        {(!ready || status) && <div className="absolute left-2 top-2 text-xs font-mono bg-black/70 px-2 py-1 rounded">{status || 'loading…'}</div>}
        <div className="absolute right-2 bottom-2 text-[10px] font-mono text-white/50 bg-black/50 px-1.5 rounded">{MAP_NAME[map]} · +x → · +z ↓ · 1 km</div>
      </div>
      {/* M83: the whole map, the open tile lit, click to open (Alex 11-23) */}
      {(glade ? ready : tiles.length > 0) && <BuilderOverview tiles={ovTiles} tile={tile} onPick={n => n !== tile && setTile(n)} source={ovSource}
        edits={n => edits.current[n]} waterY={glade ? GLADE_WATER_Y : nyx ? NYX_WATER_Y : 0} rev={rev + rawN} tint={showEdits}
        overlay={showOv ? { data: ovAll, c0: glade ? GLADE_TILE_CENTER : { x: 0, z: 0 }, tileM: glade ? GLADE_SIZE : nyx ? NYX_TILE_M : TILE_M } : undefined}
        px={glade ? 128 : 32} maxW={glade ? 300 : 560} note={!glade && !nyx && rawN < tiles.length ? `loading tiles ${rawN}/${tiles.length}…` : undefined} />}
      </div>

      <div className="flex flex-col gap-3 min-w-[240px] text-sm">
        {glade ? <div className="text-xs text-white/55"><div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">Map</div>Moonwell Glade: Greg's garden, the three friends' gardens, the Green and the paths. Off the islands is void (you sculpt the land the Glade has).</div> : <div>
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
        </div>}

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">Brush</div>
          <div className="flex flex-wrap gap-1">
            {TOOLS.map((b, i) => <button key={b} className={`${btn} ${brush === b ? on : off} disabled:opacity-35`} disabled={b === 'void' && (glade || nyx)} onClick={() => setBrush(b)} data-testid={`brush-${b}`}>{i + 1} {TOOL_KEY[b]}</button>)}
          </div>
          {(glade || nyx) && <div className="text-[11px] text-white/40 mt-1" data-testid="void-note">Void brush: {glade ? 'the Glade' : 'the Nyx continent'} has no cloud voids; it works on the Wilds.</div>}
          {brush === 'void' && !glade && !nyx && <div className="flex flex-col gap-1 mt-2" data-testid="void-panel">
            <div className="flex gap-1">
              <button className={`${btn} ${voidMode === -1 ? on : off}`} onClick={() => setVoidMode(-1)} data-testid="void-erase">Erase</button>
              <button className={`${btn} ${voidMode === 1 ? on : off}`} onClick={() => setVoidMode(1)} data-testid="void-paint">Paint</button>
              <span className="text-[11px] text-white/35 self-center">V toggles</span>
            </div>
            <div className="text-[11px] text-white/45">{voidMode === -1 ? 'erase: the crust holds there, Settle ground you can walk (a cooled neck). Green = erased.' : 'paint: the crust is gone, a void like the generated ones (never on a path, a settlement or the Glade). Red = painted.'} The ground updates when you let go. Publish refuses if a zone would be cut off from Moonwell.</div>
          </div>}
          {brush === 'flatten' && <div className="text-[11px] text-white/45 mt-1">levels to the height under your first click</div>}
          {brush === 'zone' && <div className="text-[11px] text-white/45 mt-1" data-testid="zone-hint">drag a building zone: the ground inside levels to the height under your first click, the edge blends over {ZONE_BLEND_M} m. Click a zone to tag or delete it. Delete puts the ground back (undo does not reach past a zone). {zones.length} zone{zones.length === 1 ? '' : 's'} on this map.</div>}
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
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">Strength <span className="tabular-nums text-white/80 normal-case tracking-normal">{strength.toFixed(2)} m/tick</span> <span className="normal-case tracking-normal text-white/30">- =</span></span>
          <input type="range" min={STRENGTH_MIN} max={STRENGTH_MAX} step={0.01} value={strength} onChange={e => setStrength(+e.target.value)} />
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
          <div className="text-white/35 pt-1">Hold to paint. Brushes cross onto the neighbouring tiles so seams meet. You are editing the DRAFT: players see nothing until Publish (live on the next {LOAD_NAME[map]} load, no build).</div>
        </div>
      </div>
      {selZone && zones.some(z => z.id === selZone) && <ZonePopup zone={zones.find(z => z.id === selZone)!} map={map} net={zoneNet} onNeedNet={() => { if (!zoneNet) loadNetwork().then(n => setZoneNet(n)).catch(() => { /* the Glade's folk still listed */ }) }}
        onTag={t => tagZone(selZone, t)} onDelete={() => deleteZone(selZone)} onClose={() => setSelZone(null)} onBuild={() => { setBuildZone(selZone); setSelZone(null) }} />}
      {buildZone && zones.some(z => z.id === buildZone) && <ZoneBuilder zone={zones.find(z => z.id === buildZone)!} onChange={buildOnZone} onClose={() => setBuildZone(null)} />}
    </div>
  )
}

// ── M114: the tag popup. Opens when a zone is made (and on a click on one): Home / Shop / Supplier / Other; the first three pick
// from a list of what already exists (zone-choices.ts). Other = a building that stays locked and empty inside. ──
function ZonePopup({ zone, map, net, onNeedNet, onTag, onDelete, onClose, onBuild }: { zone: Zone; map: BuilderMap; net: Network | null; onNeedNet: () => void; onTag: (t: ZoneTag | null) => void; onDelete: () => void; onClose: () => void; onBuild: () => void }) {
  const kind = zone.tag?.kind ?? null
  useEffect(() => { if (kind === 'home' && map !== 'glade') onNeedNet() }, [kind, map])   // eslint-disable-line react-hooks/exhaustive-deps
  const list: Choice[] = useMemo(() => kind ? choicesFor(kind, map, net) : [], [kind, map, net])
  const front = zone.tag?.front, keep = front ? { front } : {}   // M114 s3: the picked front edge survives a kind / entry change
  const pickKind = (k: ZoneKind) => onTag({ kind: k, ...keep })
  const pick = (ref: string) => { if (!kind) return; const c = list.find(x => x.ref === ref); onTag(c ? { kind, ref: c.ref, name: c.name, ...keep } : { kind, ...keep }) }
  const pickFront = (f: ZoneFront) => { if (zone.tag) onTag({ ...zone.tag, front: f === 's' ? undefined : f }) }
  const btn = 'px-2.5 py-1 rounded text-xs font-mono border transition-colors'
  const on = 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100', off = 'bg-white/5 border-white/15 text-white/70 hover:text-white'
  const ASK: Record<Exclude<ZoneKind, 'other'>, string> = { home: 'Who lives here', shop: 'Which shop', supplier: 'Which supplier' }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-[340px] rounded-lg bg-zinc-900 border border-fuchsia-400/40 p-4 flex flex-col gap-3 text-white/85 shadow-xl" data-testid="zone-popup" data-zone={zone.id}>
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Building zone · {Math.round(zone.x1 - zone.x0)} × {Math.round(zone.z1 - zone.z0)} m · ground {zone.h.toFixed(1)} m</div>
        <div className="text-sm">What is this building?</div>
        <div className="grid grid-cols-2 gap-1.5">
          {ZONE_KINDS.map(k => <button key={k} className={`${btn} ${kind === k ? on : off}`} onClick={() => pickKind(k)} data-testid={`zone-kind-${k}`}>{k === 'other' ? 'Other (locked, empty)' : KIND_LABEL[k]}</button>)}
        </div>
        {kind && kind !== 'other' && <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">{ASK[kind]}</span>
          <select value={zone.tag?.ref ?? ''} onChange={e => pick(e.target.value)} data-testid="zone-choice" className="bg-black/40 border border-white/15 rounded px-2 py-1 font-mono text-xs">
            <option value="">{list.length ? 'pick one…' : 'loading…'}</option>
            {list.map(c => <option key={c.ref} value={c.ref}>{c.name}</option>)}
          </select>
        </label>}
        {kind === 'other' && <div className="text-[11px] text-white/50">Its door stays locked and there is nothing inside.</div>}
        {kind && <div className="flex items-center gap-1.5" data-testid="zone-front">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45 mr-1">Front edge</span>
          {ZONE_FRONTS.map(f => <button key={f} className={`${btn} ${(front ?? 's') === f ? on : off}`} onClick={() => pickFront(f)} data-testid={`zone-front-${f}`}>{FRONT_LABEL[f]}</button>)}
        </div>}
        <div className="text-[11px] font-mono text-white/45" data-testid="zone-label">{zoneLabel(zone)}</div>
        <div className="flex gap-1.5 justify-between pt-1">
          <button className={`${btn} bg-red-500/15 border-red-400/60 text-red-200`} onClick={onDelete} data-testid="zone-delete">Delete zone</button>
          <button className={`${btn} ${on}`} onClick={onBuild} data-testid="zone-build-open">Build{zone.build?.length ? ` (${zone.build.length})` : ''}</button>
          <button className={`${btn} ${off}`} onClick={onClose} data-testid="zone-done">Done</button>
        </div>
      </div>
    </div>
  )
}
