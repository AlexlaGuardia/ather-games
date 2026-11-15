'use client'

// /shimmer/open/ather — THE ATHER SIDE of the open world (Alex 11-14, Jin/world).
//
//   · THE HOME PLOT — a full-size floating island cut into a 9×9 garden grid. The corner 3×3 by the gate is yours; the rest is
//     under fold-mist until you buy it from GREGORY with grey matter, ring by ring as the grimoire fills (plot.ts).
//     ONE GATE: its face is the fold map. The Ather side shows the Wilds you have walked and your waymarks; Tab flips
//     to Athernyx, where the gate steps you out to a place on the continent. Walk off the edge and the fold brings
//     you back to the threshold.
//   · THE WILDS — the continent's land in the Ather's state (world/ather.md 09-07), one 1 km tile cut from the same
//     height map the coursers drive. F plants a waymark where you stand; standing at one, E opens the fold map too.
//
// The Ather revamp (no holds, Hollows + grey matter, the grimoire's tiers) is Alex's direction, logged [OPEN] in
// CANON_GAPS for Magii; UI copy stays plain until it is authored. Desktop: pointer lock + keys. Phone (11-15): shared/
// touch-controls (stick, drag-look, jump/slide/fire, context taps that press the same keys this page handles).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { VoxelDayNight } from '../shared/day-night'
import { terrainWorld } from '../terrain-world'
import { Walker, verbOf, type Loco } from './walker'
import {
  plotShape, plotHeightAt, mistWalls, THRESHOLD, GATE, GREG, FALL_Y, REACH, squareAt, sqId, canBuy,
  loadGarden, saveGarden, freshGarden, type Garden,
} from './plot'
import { PlotScene } from './plot-scene'
import { ClusterScene } from './cluster-scene'
import { ClusterPanel, useCluster } from './cluster-panel'
import { clusterGround, mateWalls, mateAt, inMiddle, onRoad } from './cluster'
import { WildsScene } from './wilds-scene'
import { FoldMap, GregPanel, LANDING, type Dest } from './panels'
import { pitstopsUnlocked, type PlaceLike, type Pitstop } from '../continent/pitstops'
import { tileCentreWorld, BIOME_NAME, type Wilds } from './wilds'
import { loadIndex, makeWorld, stream, tileOf, TILE_M, type WildsWorld } from './wilds-world'
import { canPlant, plant, lift, loadWaymarks, saveWaymarks, GREG_WAYMARK, MAX_WAYMARKS, type Waymark } from './waymarks'
import { loadFog, saveFog, reveal, type Fog } from './explored'
import { CombatLayer, type CombatHud } from './combat-layer'
import type { CombatEvent, Terrain } from './combat'
import { ownerOf, nodeRegions, GAME_DAY_MS, SUB, type WildsNode } from './nodes'
import { advance, clearAt, loadSpread, saveSpread, loadSkew, saveSkew, type SpreadState, type SpreadEvent } from './spread'
import { TouchControls, type TouchAction } from '../shared/touch-controls'
import { isTouchOnly, pressKey } from '../shared/touch'
import { useMenuLock } from '../shared/menu-lock'
import { BirthGate, useBirthGateUp } from '../birth-gate'
import { OpenOptions, useOptionsKeys, useOptionsOpen, setOptionsOpen } from '../options'
import { useInv, setInv, getInv, hotbarEntries, heldItem } from '../shared/bag'
import { PackMenu, PACK_KEYS, type PackTab } from '../pack'
import { QuestGuide } from '../quest-guide'
import { useJournal, postEntries, questMarks } from '../shared/journal'
import { give, take } from '../shared/inventory'
import { GameHud, useGameHudSize, hudSay, type CompassMark, type CompassPose, type Mana } from '../shared/game-hud'
import { AtherMiniMap } from './minimap'
import type { Vitals } from '../../engine/vitals'


type Zone = { kind: 'plot' } | { kind: 'wilds'; tile: string }
type Spawn = { x: number; z: number; yaw: number }
type Panel = null | { kind: 'map'; view: 'ather' | 'athernyx'; travel: boolean } | { kind: 'greg' } | { kind: 'pack'; tab: PackTab } | { kind: 'cluster' }
type Near = null | { kind: 'gate' } | { kind: 'greg' } | { kind: 'waymark'; w: Waymark; own: boolean }

export default function AtherSlice() {
  const locked = useRef(false), frozen = useRef(false)
  const [isLocked, setLocked] = useState(false)
  const [isTouch, setIsTouch] = useState(false)
  const [introSeen, setIntroSeen] = useState(false)
  const [played, setPlayed] = useState(false)   // locked once: after that an unlocked screen says 'click to resume', not the whole intro
  useEffect(() => setIsTouch(isTouchOnly()), [])
  const [zone, setZone] = useState<Zone>({ kind: 'plot' })
  const [spawn, setSpawn] = useState<Spawn>(THRESHOLD)
  const [epoch, setEpoch] = useState(0)
  // THE WILDS, STREAMED (wilds-world.ts, Alex 11-15): `ww` is the whole continent's Wilds as one ground, its tiles
  // loading round you; `W` is the tile you stand in (the fold map, its borders). One space: first-wilds local = world.
  const [ww, setWw] = useState<WildsWorld | null>(null)
  const [wrev, setWrev] = useState(0)
  const [hereTile, setHereTile] = useState('first-wilds')
  const W: Wilds | null = ww?.loaded.get(hereTile) ?? null
  const streamAt = useCallback(async (x: number, z: number) => { if (ww && await stream(ww, x, z)) setWrev(ww.rev) }, [ww])
  const [fog, setFog] = useState<Fog | null>(null)
  const [waymarks, setWaymarks] = useState<Waymark[]>([])
  const [garden, setGarden] = useState<Garden>(freshGarden)
  const [panel, setPanel] = useState<Panel>(null)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [fade, setFade] = useState(0)
  const [hud, setHud] = useState({ verb: 'idle', where: 'your plot' })
  const pos = useRef({ x: THRESHOLD.x, z: THRESHOLD.z, grounded: true, swimming: false })
  const near = useRef<Near>(null)
  const hereRef = useRef('first-wilds'), nearRef = useRef('')
  const hudT = useRef(0), fogT = useRef(0), fogDirty = useRef(false)
  const [chud, setChud] = useState<CombatHud | null>(null)
  // ── THE HUD (shared/game-hud.tsx): the same hearth HUD as every open-world page ──
  const hudSize = useGameHudSize(isTouch)
  const poseRef = useRef<CompassPose>({ x: THRESHOLD.x, z: THRESHOLD.z, yaw: THRESHOLD.yaw })
  const marksRef = useRef<CompassMark[]>([])
  const journal = useJournal()   // re-marks the compass when a journal waymark is toggled
  const vitalsRef = useRef<Vitals>({ hp: 100, hpMax: 100, shield: 0, shieldMax: 0 })
  const manaRef = useRef<Mana>({ cur: 100, max: 100, regen: 0 })   // no casting in the open world yet: shown full
  const [slot, setSlot] = useState(0)                               // 0 = the Repeater, 1 = a waymark to plant
  const onCombatHud = useCallback((h: CombatHud) => { vitalsRef.current = { hp: h.hp, hpMax: h.maxHp, shield: 0, shieldMax: 0 }; setChud(h) }, [])
  const [pitstops, setPitstops] = useState<Pitstop[]>([LANDING])
  const [reviveKey, setReviveKey] = useState(0)
  const [spread, setSpread] = useState<SpreadState | null>(null)
  const spreadRef = useRef<SpreadState | null>(null); spreadRef.current = spread
  // tuning (Alex 11-15: feel the raw spread before any brakes): ?tune=1 → ] skips a game day; skew is kept so a reload stays put
  const [tune, setTune] = useState(false)
  const skew = useRef(0)
  const clock = () => Date.now() + skew.current

  useEffect(() => { setWaymarks(loadWaymarks()); setGarden(loadGarden()); setFog(loadFog()); skew.current = loadSkew(); setTune(new URLSearchParams(location.search).get('tune') === '1') }, [])
  // the Hallway's city doors: the ones the keeper has unlocked by visiting (hub's continent/pitstops.ts)
  useEffect(() => {
    fetch('/open/continent.json').then(r => r.json()).then(m => setPitstops(pitstopsUnlocked(m.places as PlaceLike[])))
      .catch(() => { /* Rune Hold alone */ })
  }, [])
  useEffect(() => {
    loadIndex().then(async idx => { const w = makeWorld(idx); await stream(w, GREG_WAYMARK.x, GREG_WAYMARK.z); setWw(w); setWrev(w.rev) })
      .catch(e => setToast(`The Wilds would not load: ${e.message}`))
  }, [])
  // the anchor tile's centre in continent coords (the fog grid and the continent map add it to world coords)
  const tileOff = useMemo(() => tileCentreWorld({ source: { x0: 770, y0: 420, x1: 870, y1: 520, mPerPx: 10 } } as Wilds['meta']), [])
  useEffect(() => {
    const ch = () => { locked.current = !!document.pointerLockElement; setLocked(locked.current); if (locked.current) setPlayed(true) }
    document.addEventListener('pointerlockchange', ch)
    return () => document.removeEventListener('pointerlockchange', ch)
  }, [])
  const optionsOpen = useOptionsOpen()   // Options (options.tsx): O, Esc once the mouse is free, the pack's gear
  // the birth gate (Jin 1's birth-gate.tsx): a keeper with no birth rune is born on first entry; Play lands here, so the
  // ritual must be here too. Its screen drives on arrows/Enter/Space, so the walker freezes under it.
  const birthUp = useBirthGateUp()
  useOptionsKeys(panel !== null || birthUp)
  useEffect(() => { frozen.current = panel !== null || optionsOpen || birthUp }, [panel, optionsOpen, birthUp])
  // panels are clicked, so they free the mouse; closing one takes the camera back (shared/menu-lock.ts)
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const getCanvas = useCallback(() => canvasEl.current, [])
  useMenuLock(panel !== null || optionsOpen, getCanvas)
  // toasts speak on the template's message line (under the hotbar), then clear
  useEffect(() => { if (!toast) return; hudSay(toast, 'info'); setToast(null) }, [toast])
  // persist the walked fog every few seconds and on the way out
  useEffect(() => {
    const flush = () => { if (fog && fogDirty.current) { saveFog(fog); fogDirty.current = false } }
    const t = setInterval(flush, 3000); window.addEventListener('beforeunload', flush)
    return () => { clearInterval(t); window.removeEventListener('beforeunload', flush); flush() }
  }, [fog])

  const owned = useMemo(() => new Set(garden.owned), [garden.owned])
  // GARDEN CLUSTERS (cluster.ts, Alex 11-15, his sketch): alone, the plot as ever; linked, the shared square, the #
  // of streets, each gate's ramp and my mates' plots (turned to face the square, fenced by their own mist) become ground
  const cl = useCluster(garden.owned)
  const clusterRef = useRef(cl.frame); clusterRef.current = cl.frame
  const plotWorld = useMemo(() => terrainWorld(cl.frame.linked
    ? plotShape(owned, [...mistWalls(owned), ...mateWalls(cl.frame)], (x, z) => clusterGround(cl.frame, x, z))
    : plotShape(owned)), [owned, cl.frame])
  const updateGarden = useCallback((g: Garden) => { setGarden(g); saveGarden(g) }, [])

  const fading = useRef(false)
  const arrive = useCallback((z: Zone, s: Spawn) => {
    if (fading.current) return
    fading.current = true; setFade(1); setPanel(null)
    setTimeout(() => { setZone(z); setSpawn(s); setEpoch(e => e + 1); setFade(0); fading.current = false }, 380)
  }, [])
  const goHome = useCallback(() => arrive({ kind: 'plot' }, THRESHOLD), [arrive])

  // ── combat in the Wilds ──
  const terrain = useMemo<Terrain | null>(() => ww ? { heightAt: ww.heightAt, walkable: (x, z) => ww.walkable(x, z) } : null, [ww])
  // THE NODE MAP (nodes.ts: one node per land subsection) and THE SPREAD (spread.ts: Alex's raw numbers, no brakes).
  // The world catches up on load (the clock ran while you were away), then ticks live every 20 s.
  // every node on the continent, from the tile index (placed at export by the same placeNodes), in world coords: the
  // spread must know them all, loaded or not, or a streamed-out tile would forget what you cleared
  const allNodes = useMemo<WildsNode[]>(() => ww ? ww.index.tiles.flatMap(t => t.nodes.map(n => ({ ...n, tile: t.name, x: n.x + t.tx * TILE_M, z: n.z + t.ty * TILE_M, gi: t.tx * SUB + n.i, gj: t.ty * SUB + n.j }))) : [], [ww])
  const nodesByTile = useMemo(() => { const m = new Map<string, WildsNode[]>(); for (const n of allNodes) { const a = m.get(n.tile) ?? []; a.push(n); m.set(n.tile, a) } return m }, [allNodes])
  const tell = useCallback((evs: SpreadEvent[], lead: string) => {
    const sp = evs.filter(e => e.kind === 'spread').length, wl = evs.filter(e => e.kind === 'well').length
    if (sp || wl) hudSay(`${lead}${[sp && `the grey spread to ${sp} place${sp === 1 ? '' : 's'}`, wl && `${wl} cleared place${wl === 1 ? '' : 's'} welled up again`].filter(Boolean).join(', ')}.`, 'info', 6)
  }, [])
  useEffect(() => {
    if (!allNodes.length) return
    const r = advance(loadSpread(clock()), allNodes, clock())
    saveSpread(r.s); setSpread(r.s); tell(r.events, 'While you were away, ')
    const id = setInterval(() => {
      const cur = spreadRef.current; if (!cur) return
      const n = advance(cur, allNodes, clock()); if (n.s.at === cur.at && !n.events.length) return
      saveSpread(n.s); setSpread(n.s); tell(n.events, '')
    }, 20000)
    return () => clearInterval(id)
  }, [allNodes, tell]) // eslint-disable-line react-hooks/exhaustive-deps
  const skipDays = useCallback((d: number) => {
    const cur = spreadRef.current; if (!cur) return
    skew.current += d * GAME_DAY_MS; saveSkew(skew.current)
    const n = advance(cur, allNodes, clock()); saveSpread(n.s); setSpread(n.s)
    const day = Math.floor((clock() - n.s.epoch) / GAME_DAY_MS)
    const sp = n.events.filter(e => e.kind === 'spread').length, wl = n.events.filter(e => e.kind === 'well').length
    hudSay(`Day ${day} · ${allNodes.length - n.s.clean.length}/${allNodes.length} infected${sp ? ` · +${sp} spread` : ''}${wl ? ` · +${wl} welled` : ''}`, 'info', 5)
  }, [allNodes]) // eslint-disable-line react-hooks/exhaustive-deps
  const nodes = useMemo(() => spread ? allNodes.filter(n => !spread.clean.includes(n.id)) : [], [allNodes, spread])
  // ownership is per tile (a node owns the nearest ground in ITS tile), the same rule the tile's borders are drawn with
  const nodeOwner = useMemo(() => ww && allNodes.length ? (x: number, z: number) => {
    const { tx, ty } = tileOf(x, z), t = ww.at(tx, ty); if (!t) return undefined
    return ownerOf(nodesByTile.get(t.name) ?? [], x, z)?.id
  } : undefined, [ww, allNodes, nodesByTile])
  // what the fight and the plumes need: the infected nodes near you (963 mounds would sink the frame rate)
  const [nearKey, setNearKey] = useState('')
  const nearNodes = useMemo(() => { const p = pos.current; return nodes.filter(n => Math.abs(n.x - p.x) < 450 && Math.abs(n.z - p.z) < 450) }, [nodes, nearKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // the countries on the fold map, and which one the keeper stands in (HUD), off the same nearest-node rule
  const infectedSet = useMemo(() => new Set(nodes.map(n => n.id)), [nodes])
  // each loaded tile's borders in its LOCAL coords (the minimap composes per tile; the fold map shows the tile you are in)
  const regionsByTile = useMemo(() => {
    const m = new Map<string, { id: string; poly: { x: number; z: number }[]; infected: boolean }[]>()
    if (!ww) return m
    for (const name of ww.loaded.keys()) {
      const t = ww.byName.get(name)!, ox = t.tx * TILE_M, oz = t.ty * TILE_M
      const local = (nodesByTile.get(name) ?? []).map(n => ({ ...n, x: n.x - ox, z: n.z - oz }))
      m.set(name, nodeRegions(local, TILE_M, TILE_M).map(r => ({ ...r, infected: infectedSet.has(r.id) })))
    }
    return m
  }, [ww, wrev, nodesByTile, infectedSet]) // eslint-disable-line react-hooks/exhaustive-deps
  const regions = regionsByTile.get(hereTile) ?? []
  const hereOff = useMemo(() => { const t = ww?.byName.get(hereTile); return t ? { x: t.tx * TILE_M, z: t.ty * TILE_M } : { x: 0, z: 0 } }, [ww, hereTile])
  const groundRef = useRef<(x: number, z: number) => string | null>(() => null)
  groundRef.current = (x, z) => { const id = nodeOwner?.(x, z); return id ? (nodes.some(n => n.id === id) ? 'infected ground' : 'cleared ground') : null }
  const gardenRef = useRef(garden); gardenRef.current = garden
  const onCombat = useCallback((evs: CombatEvent[]) => {
    let got = 0
    for (const e of evs) {
      if (e.kind === 'pickup') got += e.amount
      if (e.kind === 'champ-wake') setToast('Something heaves up out of the grey.')
      if (e.kind === 'champ-break') setToast(e.bar === 0 ? 'It sinks into the ooze, and more come crawling out.' : 'It sinks again. When it rises it moves wrong, wild.')
      if (e.kind === 'champ-down') {
        setToast('The grey thins here. For now.')
        const cur = spreadRef.current
        if (cur) { const r = clearAt(cur, allNodes, e.nodeId, clock()); saveSpread(r.s); setSpread(r.s) }
      }
      if (e.kind === 'down') {
        setToast('The Hollows dragged you under. The fold caught you and set you down at home.')
        setTimeout(() => setReviveKey(k => k + 1), 400)
        arrive({ kind: 'plot' }, THRESHOLD)
      }
    }
    if (got) { const g = { ...gardenRef.current, grey: gardenRef.current.grey + got }; setGarden(g); saveGarden(g) }
  }, [arrive, allNodes])

  const travel = useCallback((d: Dest) => {
    if (d.kind === 'home') { goHome(); return }
    if (d.kind === 'waymark') {
      if (!ww) { setToast('The Wilds are still loading.'); return }
      // a waymark is saved in its tile's own coords; the world is one space, so place it, load round it, then arrive
      const o = ww.offsetOf(d.w.tile), x = d.w.x + o.x + 2.2, z = d.w.z + o.z + 2.2
      stream(ww, x, z).then(() => { setWrev(ww.rev); setHereTile(d.w.tile); arrive({ kind: 'wilds', tile: d.w.tile }, { x, z, yaw: Math.PI * 0.75 }) })
      return
    }
    // Athernyx: out through a city's door off the hall (hub's ?at= sets you down at that pitstop).
    setPanel(null); setFade(1)
    setTimeout(() => { window.location.href = `/shimmer/open/continent?at=${encodeURIComponent(d.id)}` }, 380)
  }, [ww, arrive, goHome])

  // THE HALLWAY (gates.md, ruled 11-14): any door to any door. Arriving from the continent map with ?waymark=<id>
  // sets the keeper down at that bound waymark. An id the keeper has not bound is refused (the threshold instead).
  const landed = useRef(false)
  useEffect(() => {
    if (landed.current || !ww) return
    const id = new URLSearchParams(window.location.search).get('waymark')
    if (!id) return
    landed.current = true
    const url = new URL(window.location.href); url.searchParams.delete('waymark'); window.history.replaceState(null, '', url)
    const w = id === GREG_WAYMARK.id ? GREG_WAYMARK : loadWaymarks().find(k => k.id === id)
    if (!w) { setToast('That door is not bound to anything you have walked to. You are home.'); return }
    travel({ kind: 'waymark', w })
  }, [ww, travel])

  const world = useMemo(() => zone.kind === 'plot' ? plotWorld : ww ? terrainWorld(ww.shape) : null, [zone, ww, plotWorld])   // ww.shape reads the live tiles
  const ground = useMemo(() => zone.kind === 'plot' ? (cl.frame.linked ? (x: number, z: number) => Math.max(plotHeightAt(x, z), clusterGround(cl.frame, x, z)) : plotHeightAt) : ww ? ww.heightAt : () => 0, [zone, ww, cl.frame])

  const onTick = useCallback((lc: Loco, _yaw: number, dt: number) => {
    pos.current = { x: lc.px, z: lc.pz, grounded: !lc.airborne, swimming: lc.swimming }
    poseRef.current = { x: lc.px, z: lc.pz, yaw: _yaw }
    let n: Near = null
    if (zone.kind === 'plot') {
      if (Math.hypot(GATE.x - lc.px, GATE.z - lc.pz) < REACH + 1.2) n = { kind: 'gate' }
      else if (Math.hypot(GREG.x - lc.px, GREG.z - lc.pz) < REACH) n = { kind: 'greg' }
    } else {
      const all = [{ w: GREG_WAYMARK, own: false }, ...waymarks.map(w => ({ w, own: true }))]
      for (const { w, own } of all) { const o = ww?.byName.has(w.tile) ? ww.offsetOf(w.tile) : null; if (o && Math.hypot(w.x + o.x - lc.px, w.z + o.z - lc.pz) < 2.6) n = { kind: 'waymark', w, own } }
      // streaming: crossing into another tile loads round you and re-aims everything that is per tile
      const t = ww ? ww.at(tileOf(lc.px, lc.pz).tx, tileOf(lc.px, lc.pz).ty) : undefined
      if (t && t.name !== hereRef.current) { hereRef.current = t.name; setHereTile(t.name); streamAt(lc.px, lc.pz) }
      const nk = `${Math.round(lc.px / 150)},${Math.round(lc.pz / 150)}`; if (nk !== nearRef.current) { nearRef.current = nk; setNearKey(nk) }
      fogT.current -= dt
      if (fog && fogT.current <= 0) { fogT.current = 0.25; if (reveal(fog, lc.px + tileOff.x, lc.pz + tileOff.z)) fogDirty.current = true }
    }
    near.current = n
    hudT.current -= dt
    if (hudT.current <= 0) {
      hudT.current = 0.12
      const p = n?.kind === 'gate' ? 'E · the gate (fold map)'
        : n?.kind === 'greg' ? 'E · Gregory (buy ground)'
        : n?.kind === 'waymark' ? (n.own ? 'E · fold map · L lift this waymark' : 'E · fold map') : null
      setPrompt(p)
      let where = 'your plot'
      if (zone.kind === 'wilds' && ww) { const g = groundRef.current(lc.px, lc.pz); where = BIOME_NAME[ww.biomeAt(lc.px, lc.pz)] + (g ? ` · ${g}` : '') }
      else if (!squareAt(lc.px, lc.pz)) {
        // off your own grid: in a linked cluster that is somewhere real (a friend's plot, the shared ground, a road)
        const f = clusterRef.current, onMate = f.linked ? mateAt(f, lc.px, lc.pz) : undefined
        where = Number.isFinite(plotHeightAt(lc.px, lc.pz)) ? 'your plot'
          : onMate ? `${onMate.name}'s plot`
          : inMiddle(f, lc.px, lc.pz) ? 'the shared ground'
          : f.linked && onRoad(f, lc.px, lc.pz) ? 'the road' : 'the edge'
      }
      setHud({ verb: verbOf(lc), where })
    }
  }, [zone, waymarks, ww, fog, tileOff, streamAt])

  const buy = useCallback((i: number, j: number) => {
    const v = canBuy(owned, i, j, garden.pages, garden.grey)
    if (!v.ok) { setToast(v.why); return }
    updateGarden({ ...garden, owned: [...garden.owned, sqId(i, j)], grey: garden.grey - v.cost })
    setToast(`Ground opened. ${garden.grey - v.cost} grey matter left.`)
  }, [owned, garden, updateGarden])

  // Probes for scripted shots and for testing the economy before the Hollows land.
  useEffect(() => {
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = {
      ...(g.__ather ?? {}),
      zone: () => zone.kind,
      open: (k: 'gate' | 'greg' | 'athernyx') => setPanel(k === 'greg' ? { kind: 'greg' } : { kind: 'map', view: k === 'athernyx' ? 'athernyx' : 'ather', travel: true }),
      travel: (d: Dest) => travel(d),
      grant: (grey = 0, pages = 0) => updateGarden({ ...garden, grey: garden.grey + grey, pages: garden.pages + pages }),
      resetGarden: () => updateGarden(freshGarden()),
      spread: () => spreadRef.current, skipDays, ownerAt: (x: number, z: number) => nodeOwner?.(x, z),
    }
  }, [zone, travel, garden, updateGarden, skipDays, nodeOwner])

  const plantHere = useCallback(() => {
    if (zone.kind !== 'wilds' || !ww) return
    // a waymark belongs to the tile it stands in, in that tile's own coords (the fold map, the spacing rules, saves)
    const p = pos.current, biome = ww.biomeAt(p.x, p.z), t = ww.at(tileOf(p.x, p.z).tx, tileOf(p.x, p.z).ty)
    if (!t) return
    const lx = p.x - t.tx * TILE_M, lz = p.z - t.ty * TILE_M
    const v = canPlant(waymarks, { tile: t.name, x: lx, z: lz, biome, grounded: p.grounded, swimming: p.swimming })
    if (!v.ok) { setToast(v.why); return }
    const spent = take(getInv(), 'waymark', 1)          // a waymark is a thing in the bag now: planting spends one
    if (!spent) { setToast('No waymarks in your bag. Lift one you planted to carry it again.'); return }
    setInv(spent)
    const next = plant(waymarks, { tile: t.name, x: lx, y: ww.heightAt(p.x, p.z), z: lz, biome })
    setWaymarks(next); saveWaymarks(next)
    setToast(`Waymark bound in the ${BIOME_NAME[biome]}. It is a stop on the fold map now.`)
  }, [zone, ww, waymarks])
  // what you hold is what sits in the selected hotbar slot (the bag, shared/bag.tsx): a waymark plants on click,
  // the Repeater fires (combat-layer only fires while armed)
  const inv = useInv()
  const held = heldItem(inv, slot)
  useEffect(() => {
    const down = (e: MouseEvent) => { if (e.button === 0 && held === 'waymark' && locked.current && !frozen.current) plantHere() }
    window.addEventListener('mousedown', down); return () => window.removeEventListener('mousedown', down)
  }, [held, plantHere])
  // compass marks: what the keeper might be heading for, by zone
  useEffect(() => {
    marksRef.current = zone.kind === 'plot'
      ? [{ x: GATE.x, z: GATE.z, color: '#e7c766', title: 'the gate' }, { x: GREG.x, z: GREG.z, color: '#c9a27a', title: 'Gregory' }]
      : [
          // the six nearest infected nodes (the continent holds hundreds), Greg's waymark, your waymarks, all in world coords
          ...[...nearNodes].sort((a, b) => Math.hypot(a.x - pos.current.x, a.z - pos.current.z) - Math.hypot(b.x - pos.current.x, b.z - pos.current.z)).slice(0, 6)
            .map(n => ({ x: n.x, z: n.z, color: '#5f6165', title: 'infected ground' })),
          { x: GREG_WAYMARK.x, z: GREG_WAYMARK.z, color: '#e7c766', title: "Gregory's waymark" },
          ...waymarks.filter(w => ww?.byName.has(w.tile)).map(w => { const o = ww!.offsetOf(w.tile); return { x: w.x + o.x, z: w.z + o.z, color: '#6fd3c4', title: 'your waymark' } }),
        ]
    marksRef.current = [...marksRef.current, ...questMarks(zone.kind === 'plot' ? 'ather' : 'wilds')]   // the journal's waymarks (pack.tsx)
  }, [zone, nearNodes, waymarks, journal, ww])
  // the journal: the nearest infected node is the keeper's open line on this side (re-aimed as you move; unchanged posts are free)
  useEffect(() => {
    const post = () => {
      if (!nodes.length) { postEntries('ather-nodes', []); return }
      const p = poseRef.current
      const n = nodes.reduce((a, b) => (Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a))
      postEntries('ather-nodes', [{ id: 'ather-node', hand: 'keeper', title: `Clear the infected ${BIOME_NAME[n.biome].toLowerCase()} ground`,
        note: `Grey has welled up at a node in the ${BIOME_NAME[n.biome]}. Its champion rises when you come close: break all three bars and the ground goes quiet for a while. ${nodes.length} node${nodes.length === 1 ? '' : 's'} infected in the Wilds.`,
        where: { zone: 'wilds', x: n.x, z: n.z } }])
    }
    post(); const id = setInterval(post, 3000); return () => clearInterval(id)
  }, [nodes])
  // entering somewhere says so on the message line: the zone, and crossing a node border
  const zoneName0 = zone.kind === 'plot' ? 'Your plot' : 'The Wilds'
  useEffect(() => { hudSay(zoneName0, 'zone') }, [zoneName0])
  const groundKind = hud.where.includes('infected') ? 'Infected ground' : hud.where.includes('cleared') ? 'Cleared ground' : null
  const lastGround = useRef<string | null>(null)
  useEffect(() => { if (groundKind && lastGround.current && groundKind !== lastGround.current) hudSay(groundKind, 'zone'); lastGround.current = groundKind }, [groundKind])
  const hotbar = useMemo(() => hotbarEntries(inv, { repeater: chud?.ammo ?? 12 }), [inv, chud?.ammo])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && panel) { setPanel(null); return }
      if (e.code === 'Tab' && panel?.kind === 'map') { e.preventDefault(); setPanel({ ...panel, view: panel.view === 'ather' ? 'athernyx' : 'ather' }); return }
      if (e.code === 'KeyM') { setPanel(p => p ? null : { kind: 'map', view: 'ather', travel: false }); return }
      if (e.code === 'KeyC' && zone.kind === 'plot') { setPanel(p => p?.kind === 'cluster' ? null : p ? p : { kind: 'cluster' }); return }
      if (e.code === 'BracketRight' && tune) { skipDays(e.shiftKey ? 5 : 1); return }
      if (e.code === 'BracketLeft' && tune && spreadRef.current) {   // tuning: wipe the map clean to watch it grow back
        let st = spreadRef.current; for (const n of allNodes) st = clearAt(st, allNodes, n.id, clock()).s
        saveSpread(st); setSpread(st); hudSay(`Tune · every node cleared (${allNodes.length}). ] to let days pass.`, 'info', 5); return
      }
      const packTab = PACK_KEYS[e.code]   // I bag · J journal · P character: same key again closes; another switches tab
      if (packTab) { setPanel(p => p?.kind === 'pack' ? (p.tab === packTab ? null : { kind: 'pack', tab: packTab }) : p ? p : { kind: 'pack', tab: packTab }); return }
      if (panel || fade) return
      const n = near.current
      if (e.code === 'KeyE' && n) {
        if (n.kind === 'greg') setPanel({ kind: 'greg' })
        else setPanel({ kind: 'map', view: 'ather', travel: true })
        return
      }
      if (e.code === 'KeyF') plantHere()

      if (e.code === 'KeyL' && n?.kind === 'waymark' && n.own) {
        const next = lift(waymarks, n.w.id); setWaymarks(next); saveWaymarks(next)
        const back = give(getInv(), 'waymark', 1); setInv(back.inv)
        setToast(back.left ? 'Waymark lifted, but your bag is full: it went back to the fold.' : 'Waymark lifted. It is back in your bag.')
      }
      if (e.code === 'KeyH' && zone.kind === 'wilds') goHome()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [panel, fade, zone, waymarks, ww, goHome, tune, skipDays, allNodes, plantHere])

  const zoneName = zone.kind === 'plot' ? 'Your plot' : 'The Wilds'
  // Phone taps: only what applies here and now, each the key this page already handles.
  const touchActions: TouchAction[] = [
    ...(prompt ? [{ code: 'KeyE', key: 'E', label: prompt.startsWith('E · Gregory') ? 'Gregory' : 'use', near: true }] : []),
    ...(prompt?.includes('L lift') ? [{ code: 'KeyL', key: 'L', label: 'lift', near: true }] : []),
    { code: 'KeyM', key: 'M', label: 'map' },
    { code: 'KeyO', key: 'O', label: 'options' },
    ...(zone.kind === 'plot' ? [{ code: 'KeyC', key: 'C', label: 'friends' }] : []),
    { code: 'KeyI', key: 'I', label: 'pack' },
    ...(zone.kind === 'wilds' ? [
      { code: 'KeyF', key: 'F', label: 'waymark' },
      { code: 'KeyR', key: 'R', label: 'reload' },
      { code: 'KeyH', key: 'H', label: 'home' },
    ] : []),
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bcd6e6' }}>
      <Canvas
        camera={{ fov: 75, near: 0.05, far: 900, position: [THRESHOLD.x, 3, THRESHOLD.z] }}
        onClick={(e) => { if (!panel && !isTouch) (e.target as HTMLCanvasElement).requestPointerLock?.() }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { canvasEl.current = gl.domElement }}
      >
        <VoxelDayNight gloomAt={zone.kind === 'wilds' && ww ? (x, z) => ww.canopyAt(x, z) * 0.7 : undefined} />
        {zone.kind === 'plot' && <PlotScene owned={owned} pages={garden.pages} />}
        {zone.kind === 'plot' && <ClusterScene frame={cl.frame} />}
        {zone.kind === 'wilds' && ww && [...ww.loaded].map(([name, T]) => { const t = ww.byName.get(name)!; return <group key={name} position={[t.tx * TILE_M, 0, t.ty * TILE_M]}><WildsScene W={T} waymarks={waymarks} /></group> })}
        {terrain && (
          <CombatLayer T={terrain} locked={locked} frozen={frozen} active={zone.kind === 'wilds' && fade === 0}
            safe={{ x: GREG_WAYMARK.x, z: GREG_WAYMARK.z, r: 30 }} onEvents={onCombat} onHud={onCombatHud} reviveKey={reviveKey} armed={held === 'repeater'} nodes={nearNodes} ownerOf={nodeOwner} />
        )}
        <QuestGuide zone={zone.kind === 'plot' ? 'ather' : 'wilds'} ground={ground} />
        {world && (
          <Walker
            key={epoch} world={world} ground={ground} spawn={spawn} locked={locked} frozen={frozen}
            fallY={zone.kind === 'plot' ? FALL_Y : -60}
            onFall={goHome}
            onTick={onTick}
          />
        )}
      </Canvas>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, margin: -2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
      <GameHud size={hudSize} pose={poseRef} marks={marksRef} vitals={vitalsRef} mana={manaRef} entries={hotbar} sel={slot} onSelect={setSlot}
        dimmed={zone.kind !== 'wilds'} input={!panel && !fade && !optionsOpen}
        minimap={ww && <AtherMiniMap size={hudSize} zone={zone.kind} world={ww} wrev={wrev} fog={fog} tileOff={tileOff} pose={poseRef} waymarks={waymarks} regionsByTile={regionsByTile} cluster={cl.frame}
          owned={owned} onExpand={() => setPanel({ kind: 'map', view: 'ather', travel: false })} />}
        status={[
          { label: hud.where },
          ...(zone.kind === 'wilds' && chud ? [{ label: 'Repeater', value: chud.reloading ? 'reloading' : `${chud.ammo} / ${chud.clip}` }] : []),
          { label: 'Grey matter', value: garden.grey, accent: true },
          { label: 'Grimoire', value: garden.pages },
          ...(tune && spread ? [{ label: `Tune · day ${Math.floor((clock() - spread.epoch) / GAME_DAY_MS)}`, value: `${allNodes.length - spread.clean.length}/${allNodes.length} grey · [ clear all · ] +1d · ⇧] +5d`, accent: true }] : []),
        ]} />
      {zone.kind === 'wilds' && chud && (() => {
        const now = performance.now() / 1000, hurt = Math.max(0, 1 - (now - chud.hurtAt) / 0.6), hit = now - chud.hitAt < 0.12
        return (
          <>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: `inset 0 0 ${120 + hurt * 80}px rgba(70,74,80,${(hurt * 0.75 + (1 - chud.hp / chud.maxHp) * 0.35).toFixed(3)})` }} />
            {chud.champ && (
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: hudSize === 'phone' ? 66 : 80, width: 'min(420px, 62vw)', pointerEvents: 'none', color: '#eef3f6', textAlign: 'center', font: '600 11px system-ui', letterSpacing: '0.24em', textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>
                HOLLOW
                <div style={{ display: 'flex', gap: 4, marginTop: 4, opacity: chud.champ.open ? 1 : 0.45 }}>
                  {Array.from({ length: chud.champ.bars }, (_, k) => {
                    const ch = chud.champ!, f = k < ch.bar ? 0 : k > ch.bar ? 1 : Math.max(0, ch.hp / ch.barHp)
                    return (
                      <div key={k} style={{ flex: 1, height: 9, borderRadius: 3, background: 'rgba(12,16,20,0.65)', outline: '1px solid rgba(238,243,246,0.35)', overflow: 'hidden' }}>
                        <div style={{ width: `${f * 100}%`, height: '100%', background: '#d9dcdf', transition: 'width 0.12s' }} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {hit && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 18, height: 18, margin: -9, border: '2px solid rgba(255,255,255,0.9)', transform: 'rotate(45deg)', borderRadius: 2, pointerEvents: 'none' }} />}
          </>
        )
      })()}
      {prompt && !panel && (
        <div style={{ position: 'absolute', left: '50%', top: '58%', transform: 'translateX(-50%)', padding: '6px 12px', borderRadius: 6, background: 'rgba(12,16,20,0.65)', color: '#f4efe2', font: '13px system-ui', pointerEvents: 'none' }}>{prompt}</div>
      )}
      {panel?.kind === 'map' && (
        <FoldMap view={panel.view} travel={panel.travel} W={W} fog={fog} waymarks={waymarks} here={{ x: pos.current.x - hereOff.x, z: pos.current.z - hereOff.z }}
          inWilds={zone.kind === 'wilds'} onTravel={travel} tile={hereTile} pitstops={pitstops}
          nodes={(nodesByTile.get(hereTile) ?? []).filter(n => infectedSet.has(n.id)).map(n => ({ ...n, x: n.x - hereOff.x, z: n.z - hereOff.z }))} regions={regions}
          area={ww ? { world: ww, regionsByTile, cx: hereOff.x, cz: hereOff.z, tileOff, nodes: nodes.filter(n => Math.abs(n.x - hereOff.x) < 1600 && Math.abs(n.z - hereOff.z) < 1600), here: { x: pos.current.x, z: pos.current.z } } : undefined}
          onClose={() => setPanel(null)} onFlip={() => setPanel(p => p?.kind === 'map' ? { ...p, view: p.view === 'ather' ? 'athernyx' : 'ather' } : p)} />
      )}
      {panel?.kind === 'greg' && <GregPanel garden={garden} onBuy={buy} onClose={() => setPanel(null)} />}
      {panel?.kind === 'cluster' && <ClusterPanel c={cl} onClose={() => setPanel(null)} />}
      {optionsOpen && <OpenOptions onClose={() => setOptionsOpen(false)} />}
      <BirthGate />
      {panel?.kind === 'pack' && <PackMenu tab={panel.tab} onTab={t => setPanel({ kind: 'pack', tab: t })} onClose={() => setPanel(null)} sel={slot} isTouch={isTouch} />}
      <div style={{ position: 'absolute', inset: 0, background: '#f6f1e4', opacity: fade, transition: 'opacity 0.35s', pointerEvents: 'none' }} />
      {isTouch && !panel && (
        <TouchControls showFire={zone.kind === 'wilds'} actions={touchActions} />
      )}
      {isTouch && !introSeen && !panel && (
        <div onPointerDown={() => setIntroSeen(true)} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 16, zIndex: 30, background: 'rgba(5,6,14,0.35)' }}>
          <div style={{ padding: '18px 20px', borderRadius: 10, background: 'rgba(12,16,20,0.82)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.6, textAlign: 'center', maxWidth: 420 }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Ather · your plot and the Wilds</div>
            Left thumb moves. Drag on the right to look.<br />Buttons for jump, slide, and whatever is in reach.
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
              The gate ahead is the fold map: travel to the Wilds, your waymarks, or out through a city's door. Gregory, by the threshold, sells the ground under the mist. In the Wilds the Hollows wander: hold fire to shoot.
            </div>
            <div style={{ marginTop: 12, color: '#d4a843', font: '600 12px system-ui', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Tap to start</div>
          </div>
        </div>
      )}
      {!isLocked && !panel && !optionsOpen && !isTouch && played && (
        <div style={{ position: 'absolute', left: '50%', top: '42%', transform: 'translateX(-50%)', padding: '7px 16px', borderRadius: 999, background: 'rgba(12,16,20,0.66)', color: '#f4efe2', font: '600 12px system-ui', letterSpacing: '0.16em', textTransform: 'uppercase', pointerEvents: 'none' }}>Click to resume</div>
      )}
      {!isLocked && !panel && !isTouch && !played && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ padding: '18px 24px', borderRadius: 10, background: 'rgba(12,16,20,0.72)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.6, textAlign: 'center', maxWidth: 540 }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Ather · your plot and the Wilds</div>
            Click to play<br />
            WASD move · Space jump (again in the air) / climb · Shift slide · E use · M map · Esc release
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
              The gate ahead is the fold map: travel to the Wilds, your waymarks, or out through a city's door in Athernyx. Gregory, by the threshold, sells the ground under the mist. In the Wilds the Hollows wander: click to shoot, R to reload, walk over grey matter to take it. F plants a waymark, H walks home, I opens your bag.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const panelBtn: React.CSSProperties = { padding: '12px 20px', borderRadius: 8, border: '1px solid rgba(244,239,226,0.4)', background: 'rgba(12,16,20,0.8)', color: '#f4efe2', font: '600 13px system-ui', letterSpacing: '0.12em', textTransform: 'uppercase', touchAction: 'manipulation' }
