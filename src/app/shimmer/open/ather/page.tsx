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
import { OpenHands } from '../shared/open-hands'
import type { HandsSignal } from '../../voxel3d/hands'
import { VoxelDayNight } from '../shared/day-night'
import { terrainWorld } from '../terrain-world'
import { Walker, verbOf, type Loco } from './walker'
import {
  plotShape, plotHeightAt, mistWalls, THRESHOLD, GATE, GREG, FALL_Y, REACH, squareAt, sqId, canBuy,
  loadGarden, saveGarden, freshGarden, type Garden,
} from './plot'
import { PlotScene } from './plot-scene'
import { WorkshopScene, WorkshopPanel, PlacingBar, usePlacingKeys, useWorks, workWalls, workPrompt } from './workshop'
import { nearWork, type WorkNear } from './rooms'
import { ClusterScene } from './cluster-scene'
import { cycleLook, LookChip } from './ground-look'
import { GroundCover, coverFromUrl } from './ground-cover'
import { ClusterPanel, useCluster } from './cluster-panel'
import { clusterGround, mateWalls, mateAt, inMiddle, onPath, onMeadow } from './cluster'
import { WildsScene } from './wilds-scene'
import { FoldMap, GregPanel, LANDING, type Dest } from './panels'
import { gemsGiven, markGemsGiven, stageOf, gregsGems, errandEntries, birthSeat } from '../business/errand'
import { skillPointerEntries } from '../business/skill-pointers'
import { SEATS } from '../business/letters'
import { useBirth } from '../birth-gate'
import { castMoves, press, freshClock, cooling, CAST_KEY, type CastSlot, type CastClock } from '../shared/casting'
import { castForMove, type CastSpec } from '../../play3d/cast'
import type { CastHit } from './combat-casts'
import { useLoadout } from '../shared/loadout'
import { pitstopsUnlocked, type PlaceLike, type Pitstop } from '../continent/pitstops'
import { tileCentreWorld, BIOME, BIOME_NAME, type Wilds, type Tree } from './wilds'
import { loadIndex, makeWorld, stream, tileOf, zonesOf, TILE_M, type WildsWorld } from './wilds-world'
import { loadNetwork, clearing, settlementAt, nearFair, fairDoor, FAIR_NAME, FAIR_DOOR_R, type Network } from './network'
import { TilePaths, Settlements, BigTop } from './network-scene'
import { canPlant, plant, lift, loadWaymarks, saveWaymarks, GREG_WAYMARK, MAX_WAYMARKS, type Waymark } from './waymarks'
import { loadFog, saveFog, reveal, type Fog } from './explored'
import { CombatLayer, type CombatHud } from './combat-layer'
import type { CombatEvent, Terrain } from './combat'
import { ownerOf, nodeRegions, GAME_DAY_MS, SUB, type WildsNode } from './nodes'
import { advance, clearAt, loadSpread, saveSpread, loadSkew, saveSkew, type SpreadState, type SpreadEvent } from './spread'
import { TouchControls, type TouchAction } from '../shared/touch-controls'
import { isTouchOnly, pressKey, touch } from '../shared/touch'
import { useMenuLock } from '../shared/menu-lock'
import { BirthGate, useBirthGateUp } from '../birth-gate'
import { OpenOptions, useOptionsKeys, useOptionsOpen, setOptionsOpen } from '../options'
import { useInv, setInv, getInv, hotbarEntries } from '../shared/bag'
import { STOWED, STOWED_SPEED, HOLD_MS, tapR, holdR, selectSlot, equipSlot, heldOf, litSlot, settle, type Stance } from '../shared/stance'
import { ensureBasicTools, type EquippedTools } from '../../engine/tools'
import type { SkillSet } from '../../engine/skills'
import { PackMenu, PACK_KEYS, type PackTab } from '../pack'
import { QuestGuide } from '../quest-guide'
import { useJournal, postEntries, questMarks } from '../shared/journal'
import { give, take, itemDef, countOf, NO_BAIT_LINE } from '../shared/inventory'
import { BAIT, rollRinn, type Rinn } from './rinning'
import { RinningFX, type RinningApi } from '../shared/rinning-fx'
import type { Reel } from '../shared/reel'
import { ReelBar } from '../shared/reel-bar'
/** the Wilds' water surface (the rinning float rides it) */
const WILDS_WATER_Y = 0.02
import { prune, pruneCheck, startShake, openSkills, openLevel, addOpenXp, TREE_NAME, MANA_COST, ZONE_NAME, type Zone as WildsZone } from './forestry'
import { ForestryFX, type Aim, type ForestryFx } from './forestry-fx'
import { ProspectingFX, type CrystalAim, type ProspectFx } from './prospecting-fx'
import { CompanionFollower } from '../shared/companion-follower'
import { subscribeCompanion, takeJoined, perkLabel, perkBonus } from '../shared/companion'
import { mine, mineCheck, CRYSTAL_NAME, CRYSTAL_ITEM, MANA_COST as MINE_COST } from './prospecting'
import { GameHud, useGameHudSize, hudSay, type CompassMark, type CompassPose, type Mana } from '../shared/game-hud'
import { AtherMiniMap } from './minimap'
import type { Vitals } from '../../engine/vitals'


type Zone = { kind: 'plot' } | { kind: 'wilds'; tile: string }
type Spawn = { x: number; z: number; yaw: number }
type Panel = null | { kind: 'map'; view: 'ather' | 'athernyx'; travel: boolean } | { kind: 'greg' } | { kind: 'pack'; tab: PackTab } | { kind: 'cluster' } | { kind: 'work'; near: WorkNear }
type Near = null | { kind: 'gate' } | { kind: 'greg' } | { kind: 'work'; near: WorkNear } | { kind: 'waymark'; w: Waymark; own: boolean }

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
  // a Mana'mal companion joins at a skill's 15 / 100 (shared/companion.ts): say so, including any met before this page loaded.
  //   hudSay straight, not the toast state: a join lands mid-mine, and the mine's own toast would replace it
  useEffect(() => {
    const say = () => { const j = takeJoined(); for (const c of j) hudSay(`${c.name} has joined you (${perkLabel(c)}). Character tab to call it out.`, 'chat') }
    say(); return subscribeCompanion(say)
  }, [])
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
  // ★ mana is real now: pruning from a distance spends it (forestry.ts › MANA_COST), it refills slowly (build: 1.5/s)
  const manaRef = useRef<Mana>({ cur: 100, max: 100, regen: 1.5 })
  // ★ THE CAST KEYS (Alex 11-16, Q tactical · X signature; shared/casting.ts): clocks per slot, keyed by the move they
  // timed (a new word worn starts fresh), the fight's queue, and the two that move the keeper themselves
  const castClocks = useRef<Record<CastSlot, { move: string | null; clock: CastClock }>>({ tactical: { move: null, clock: freshClock(castForMove(null)) }, signature: { move: null, clock: freshClock(castForMove(null)) } })
  const castQueue = useRef<CastSpec[]>([])
  const [net, setNet] = useState<Network | null>(null), netRef = useRef<Network | null>(null), placeRef = useRef<string | null>(null)
  const atFairDoor = (x: number, z: number) => { const f = netRef.current?.fair; if (!f || zoneRef0.current !== 'wilds') return false; const d = fairDoor(f); return Math.hypot(d.x - x, d.z - z) < FAIR_DOOR_R }
  const zoneRef0 = useRef<string>('plot')
  const surge = useRef<{ until: number; mult: number }>({ until: 0, mult: 1 })
  const impulse = useRef<CastSpec | null>(null)
  const aimRef = useRef<Aim>({ tree: null, dist: Infinity }), fxRef = useRef<ForestryFx | null>(null)
  const cAimRef = useRef<CrystalAim>({ crystal: null, dist: Infinity }), cFxRef = useRef<ProspectFx | null>(null)
  // ★ THE STANCE (shared/stance.ts, Alex 11-15): stowed by default; R draws / swaps / (held) stows; 1-8 / the wheel pick
  // a hotbar item while not holding a weapon; stowed, a node is worked with the socket's tool
  const [stance, setStance] = useState<Stance>(STOWED)
  const stanceRef = useRef(stance); stanceRef.current = stance
  const [reloadTick, setReloadTick] = useState(0)
  const toolsRef = useRef<EquippedTools>(ensureBasicTools({})), skillsRef = useRef<SkillSet>(openSkills())
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
    // the season's path network first (network.ts): no tree may stand on a path, so it must be known before a tile parses
    Promise.all([loadIndex(), loadNetwork()]).then(async ([idx, nw]) => {
      const w = makeWorld(idx); if (nw) { w.clear = clearing(nw); setNet(nw); netRef.current = nw }
      await stream(w, GREG_WAYMARK.x, GREG_WAYMARK.z); setWw(w); setWrev(w.rev)
    })
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
  // GARDEN CLUSTERS (cluster.ts + meadow.ts, Alex 11-15, his sketch): alone, the plot as ever; linked, the meadow
  // round us all (the square, the paths, the hills) and my mates' plots (turned to face the square, fenced by their own
  // mist) become ground
  const cl = useCluster(garden.owned)
  const clusterRef = useRef(cl.frame); clusterRef.current = cl.frame
  const works = useWorks()   // the workshop rooms (workshop.tsx): their walls are solid
  const worksRef = useRef(works); worksRef.current = works
  usePlacingKeys(owned)
  const plotWorld = useMemo(() => terrainWorld(cl.frame.linked
    ? plotShape(owned, [...mistWalls(owned), ...mateWalls(cl.frame), ...workWalls(works)], (x, z) => clusterGround(cl.frame, x, z))
    : plotShape(owned, [...mistWalls(owned), ...workWalls(works)])), [owned, cl.frame, works])
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
  // ground cover preview (ground-cover.tsx, ?cover=): nothing on a path, the gate's pad or at Greg's feet
  const [cover, setCover] = useState<'none' | 'tufts' | 'meadow' | 'lush'>('meadow')
  useEffect(() => setCover(coverFromUrl()), [])
  const coverSkip = useCallback((x: number, z: number) => (cl.frame.linked && onPath(cl.frame, x, z)) || Math.hypot(x - GATE.x, z - GATE.z) < 5 || Math.hypot(x - GREG.x, z - GREG.z) < 2.5 || Math.hypot(x - THRESHOLD.x, z - THRESHOLD.z) < 2, [cl.frame])
  const ground = useMemo(() => zone.kind === 'plot' ? (cl.frame.linked ? (x: number, z: number) => Math.max(plotHeightAt(x, z), clusterGround(cl.frame, x, z)) : plotHeightAt) : ww ? ww.heightAt : () => 0, [zone, ww, cl.frame])

  const onTick = useCallback((lc: Loco, _yaw: number, dt: number) => {
    pos.current = { x: lc.px, z: lc.pz, grounded: !lc.airborne, swimming: lc.swimming }
    { const m = manaRef.current; if (m.cur < m.max) m.cur = Math.min(m.max, m.cur + m.regen * dt) }   // mana refills (forestry spends it)
    lc.speedMult = (stanceRef.current.kind === 'stowed' ? STOWED_SPEED : 1)   // hands free, a little quicker on foot
      * (performance.now() < surge.current.until ? surge.current.mult : 1)      // a surge cast (Static Burst)
    if (impulse.current) {   // an impulse cast (Quickform): up, keeping the run
      const sp = impulse.current; impulse.current = null
      lc.vy = Math.max(lc.vy, sp.impulseUp || 8); lc.airborne = true
      if (!sp.keepMomentum) { lc.hvx = 0; lc.hvz = 0 }
    }
    poseRef.current = { x: lc.px, z: lc.pz, yaw: _yaw }
    let n: Near = null
    if (zone.kind === 'plot') {
      if (Math.hypot(GATE.x - lc.px, GATE.z - lc.pz) < REACH + 1.2) n = { kind: 'gate' }
      else if (Math.hypot(GREG.x - lc.px, GREG.z - lc.pz) < REACH) n = { kind: 'greg' }
      else { const w = nearWork(worksRef.current, lc.px, lc.pz); if (w) n = { kind: 'work', near: w } }
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
        : n?.kind === 'work' ? workPrompt(n.near)
        : n?.kind === 'waymark' ? (n.own ? 'E · fold map · L lift this waymark' : 'E · fold map')
        : atFairDoor(lc.px, lc.pz) ? 'E · the Thistledown Fair'
        : rinPrompt() ?? (cAimRef.current.crystal && cAimRef.current.dist < aimRef.current.dist ? crystalPrompt() : treePrompt())
      setPrompt(p)
      let where = 'your plot'
      if (zone.kind === 'wilds' && ww) {
        // the zone you stand in (this season's, RULED 11-15), then the ground's state
        const g = groundRef.current(lc.px, lc.pz), tt = ww.at(tileOf(lc.px, lc.pz).tx, tileOf(lc.px, lc.pz).ty)
        let zn: string = BIOME_NAME[ww.biomeAt(lc.px, lc.pz)]
        if (tt) { const o = ww.offsetOf(tt.name); zn = ZONE_NAME[zonesOf(ww, tt.name)(Math.min(4, Math.floor((lc.px - o.x + 500) / 200)), Math.min(4, Math.floor((lc.pz - o.z + 500) / 200)))] }
        where = zn + (g ? ` · ${g}` : '')
        // the path network: a settlement or the fair names itself on the message line as you walk in
        const nw = netRef.current
        if (nw) {
          const st = settlementAt(nw, lc.px, lc.pz), fr = nearFair(nw, lc.px, lc.pz)
          const place = st ? st.name : fr ? FAIR_NAME : null
          if (place && place !== placeRef.current) hudSay(st ? `${st.name} · a free Moglin settlement` : `${FAIR_NAME} · this season's pitch`, 'zone')
          placeRef.current = place
          if (place) where = st ? `${st.name} · free Moglins` : FAIR_NAME
        }
      }
      else if (!squareAt(lc.px, lc.pz)) {
        // off your own grid: in a linked cluster that is somewhere real (a friend's plot, the Green, the valley, a path).
        // Names RULED 2026-11-15 (CANON_GAPS › Garden clusters come BACK): the Green, the valley.
        const f = clusterRef.current, onMate = f.linked ? mateAt(f, lc.px, lc.pz) : undefined
        where = Number.isFinite(plotHeightAt(lc.px, lc.pz)) ? 'your plot'
          : onMate ? `${onMate.name}'s plot`
          : inMiddle(f, lc.px, lc.pz) ? 'the Green'
          : f.linked && onPath(f, lc.px, lc.pz) ? 'the path'
          : f.linked && onMeadow(f, lc.px, lc.pz) ? 'the valley' : 'the edge'
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
      prune: () => pruneAimed(), aim: () => aimRef.current.tree?.id ?? null, mine: () => mineAimed(), crystal: () => { const c = cAimRef.current.crystal; return c ? { id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z } : null }, mana: () => manaRef.current.cur,
      stance: () => stanceRef.current, speedMult: () => (stanceRef.current.kind === 'stowed' ? STOWED_SPEED : 1),
      rin: () => rinApi.current?.view() ?? null, cast: () => castOrAnswer(), hold: (h: boolean | 'track') => { reelHold.current = h === 'track' ? (r: Reel) => (r.zone - r.bob) * 6 + (r.zoneV - r.bobV) * 1.6 > 0 : h },
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
  // what you hold is what the stance says (a drawn gun, a picked hotbar item, or nothing): a waymark plants on click,
  // the Repeater fires (combat-layer only fires while armed), stowed hands work a node
  const inv = useInv()
  const held = heldOf(stance, inv)
  useEffect(() => { setStance(st => settle(st, inv)) }, [inv])   // the last waymark planted empties the hand
  const heldRef = useRef(held); heldRef.current = held
  // ── forestry from a distance (forestry.ts + forestry-fx.tsx): stowed, click (or E) a tree within 10 m; the Forestry
  //    socket's tool does the work
  const pruneAimed = useCallback(() => {
    const t = aimRef.current.tree
    if (!t || zone.kind !== 'wilds') return
    if (stanceRef.current.kind !== 'stowed') { setToast('Stow first (hold R): stowed hands use the right tool.'); return }
    if (!toolsRef.current.forestry) { setToast('You have no Forestry focus.'); return }
    const c = pruneCheck(t.kind, t.id); if (!c.ok) { setToast(c.why); return }
    if (fxRef.current?.busy()) return
    if (manaRef.current.cur < MANA_COST) { setToast(`Not enough mana (${MANA_COST} to prune). It comes back on its own.`); return }
    let text = ''
    const ok = fxRef.current?.start(t, () => {
      const r = prune(t.kind, t.id)
      if (!r.ok) { text = r.why; return [] }
      const perk = perkBonus('forestry'); if (perk) r.drops[0].n += 1   // Grovekin (Drifthorn / Rootback): an extra log
      let inv = getInv(); const names: string[] = []
      for (const d of r.drops) { const g = give(inv, d.id, d.n); inv = g.inv; names.push(`${d.n > 1 ? d.n + ' × ' : ''}${itemDef(d.id).name}${g.left ? ' (bag full)' : ''}`) }
      setInv(inv)
      text = `${perk ? `${perk}! ` : ''}${names.join(' · ')} · +${r.xp} Forestry${r.levelUp ? `. Forestry ${r.levelUp}!` : ''}`
      return r.drops
    }, () => { if (text) setToast(text) })
    if (ok) { manaRef.current.cur -= MANA_COST; startShake(t.id) }
  }, [zone.kind])
  // ── prospecting (prospecting.ts + prospecting-fx.tsx): the same hand as forestry. Stowed, click (or E) a crystal
  //    within 10 m; the Prospecting focus (the Worn Spike) channels and the node fractures
  const mineAimed = useCallback(() => {
    const c = cAimRef.current.crystal
    if (!c || zone.kind !== 'wilds') return
    if (stanceRef.current.kind !== 'stowed') { setToast('Stow first (hold R): stowed hands use the right tool.'); return }
    if (!toolsRef.current.prospecting) { setToast('You have no Prospecting focus.'); return }
    const v = mineCheck(c.kind, c.id); if (!v.ok) { setToast(v.why); return }
    if (cFxRef.current?.busy() || fxRef.current?.busy()) return
    if (manaRef.current.cur < MINE_COST) { setToast(`Not enough mana (${MINE_COST} to prospect). It comes back on its own.`); return }
    let text = ''
    const ok = cFxRef.current?.start(c, () => {
      const r = mine(c.kind, c.id)
      if (!r.ok) { text = r.why; return null }
      let inv = getInv(); const names: string[] = []
      for (const d of r.drops) { const g = give(inv, d.id, d.n); inv = g.inv; names.push(`${d.n > 1 ? d.n + ' × ' : ''}${itemDef(d.id).name}${g.left ? ' (bag full)' : ''}`) }
      setInv(inv)
      text = `${c.kind === 'egg' ? `It was ${CRYSTAL_NAME[r.found].toLowerCase().replace(' crystal', '')}! ` : ''}${r.perk ? `${r.perk}! ` : ''}${names.join(' · ')} · +${r.xp} Prospecting${r.levelUp ? `. Prospecting ${r.levelUp}!` : ''}`
      return { found: r.found, n: r.drops.find(d => d.id === CRYSTAL_ITEM[r.found])?.n ?? 1 }
    }, () => { if (text) setToast(text) })
    if (ok) manaRef.current.cur -= MINE_COST
  }, [zone.kind])
  /** stowed hands work whichever node is nearer under the crosshair: a tree or a crystal */
  const workAimed = useCallback(() => {
    if (cAimRef.current.crystal && cAimRef.current.dist < aimRef.current.dist) mineAimed(); else pruneAimed()
  }, [mineAimed, pruneAimed])
  const crystalPrompt = () => {
    const c = cAimRef.current.crystal
    if (!c || zone.kind !== 'wilds') return null
    if (stanceRef.current.kind !== 'stowed') return `${CRYSTAL_NAME[c.kind]} · hold R to stow, then click to prospect`
    const v = mineCheck(c.kind, c.id)
    return v.ok ? `Click or E · prospect the ${CRYSTAL_NAME[c.kind]} (${MINE_COST} mana)` : v.why
  }
  // ── rinning (rinning.ts + rinning-fx.tsx): bait in hand → the rinstick is out; click the water to cast (one bait),
  //    click the take to answer, hold to reel while the rinn rests, let go while it pulls
  const rinApi = useRef<RinningApi | null>(null), reelHold = useRef<boolean | ((r: Reel) => boolean)>(false)
  const zoneAtWorld = useCallback((x: number, z: number): WildsZone => {
    if (!ww) return 'meadows'
    const tt = ww.at(tileOf(x, z).tx, tileOf(x, z).ty); if (!tt) return 'meadows'
    const o = ww.offsetOf(tt.name)
    return zonesOf(ww, tt.name)(Math.min(4, Math.floor((x - o.x + 500) / 200)), Math.min(4, Math.floor((z - o.z + 500) / 200)))
  }, [ww])
  const castOrAnswer = useCallback(() => {
    const r = rinApi.current; if (!r || zone.kind !== 'wilds') return
    const v = r.view()
    if (v.phase === 'waiting' || v.phase === 'rising' || v.phase === 'taking') { r.answer(); return }   // a click off the take costs nothing
    if (v.phase !== 'idle' && v.phase !== 'landed' && v.phase !== 'gone') return
    if (!toolsRef.current.rinning) { setToast('You have no rinstick.'); return }
    if (!v.aim) { setToast('Aim at open water to cast.'); return }
    const spent = take(getInv(), BAIT, 1)
    if (!spent) { setToast(NO_BAIT_LINE); return }
    if (r.cast()) { setInv(spent); if (!countOf(spent, BAIT)) setToast(NO_BAIT_LINE) }   // the last bait: say where more comes from
  }, [zone.kind])
  const onCatch = useCallback((rn: Rinn) => {
    const perk = perkBonus('rinning')   // Truesight (Embermole / Prismstrike): a second of the same rinn
    const g = give(getInv(), rn.id, perk ? 2 : 1); setInv(g.inv)
    const up = addOpenXp('rinning', rn.xp)
    setToast(`${perk ? `${perk}! 2 × ` : ''}${rn.name}${g.left ? ' (bag full)' : ''} · +${rn.xp} Rinning${up ? `. Rinning ${up}!` : ''}`)
  }, [])
  // 11-16: the rinn can get away. The bait is spent; nothing else is lost.
  const onGone = useCallback((rn: Rinn) => setToast(`It got away. A ${rn.name.toLowerCase()}, by the way it moved.`), [])
  const rinWaterAt = useCallback((x: number, z: number) => !!ww && ww.biomeAt(x, z) === BIOME.water && ww.heightAt(x, z) < WILDS_WATER_Y - 0.1, [ww])
  const rinRoll = useCallback((x: number, z: number) => rollRinn(openLevel('rinning'), zoneAtWorld(x, z), Math.random), [zoneAtWorld])
  const rinRarer = useCallback((x: number, z: number) => zoneAtWorld(x, z) === 'springs', [zoneAtWorld])
  const rinPrompt = () => {
    if (heldRef.current !== BAIT || zone.kind !== 'wilds') return null
    const v = rinApi.current?.view(); if (!v) return null
    const left = countOf(getInv(), BAIT)
    if (v.phase === 'idle' || v.phase === 'landed' || v.phase === 'gone') return v.aim ? `${isTouch ? 'Fire' : 'Click'} · cast (${left} bait left)` : 'Aim at open water to cast'
    if (v.phase === 'casting' || v.phase === 'waiting') return 'Watch the water…'
    if (v.phase === 'rising') return 'Something is coming…'
    if (v.phase === 'taking') return `${isTouch ? 'Fire' : 'Click'} to answer it`
    return null   // reeling: the reel bar speaks
  }
  const treePrompt = () => {
    const t = aimRef.current.tree
    if (!t || zone.kind !== 'wilds') return null
    if (stanceRef.current.kind !== 'stowed') return `${TREE_NAME[t.kind]} · hold R to stow, then click to prune`
    const c = pruneCheck(t.kind, t.id)
    return c.ok ? `Click or E · prune the ${TREE_NAME[t.kind]} (${MANA_COST} mana)` : c.why
  }
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button !== 0) return
      reelHold.current = true
      if (!locked.current || frozen.current) return
      if (held === 'waymark') plantHere()
      else if (held === BAIT) castOrAnswer()
      else if (stanceRef.current.kind === 'stowed') workAimed()   // stowed: the click works the node in front of you
    }
    const up = (e: MouseEvent) => { if (e.button === 0) reelHold.current = false }
    window.addEventListener('mousedown', down); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up) }
  }, [held, plantHere, workAimed, castOrAnswer])
  // PHONE (BETA M6a, 11-17): the FIRE button is the click. With bait in hand it casts, answers the take, and is the reel's
  // hold, the same three jobs the mouse has above. (Polled on a timer, not rAF: a tap shorter than a frame still counts.)
  useEffect(() => {
    if (!isTouch || held !== BAIT) return
    let was = touch.fire
    const id = setInterval(() => {
      const f = touch.fire; if (f === was) return
      was = f; reelHold.current = f
      if (f && !frozen.current) castOrAnswer()
    }, 30)
    return () => { clearInterval(id); reelHold.current = false }
  }, [isTouch, held, castOrAnswer])
  // R: a TAP draws the primary / swaps / reloads, a HOLD (HOLD_MS) stows (shared/stance.ts). Timed off down → up so a
  // hold stows the moment it qualifies, without waiting for the release.
  const panelRef = useRef(panel); panelRef.current = panel
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null, held = false
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Stow') { setStance(st => holdR(st)); return }   // the phone's stow button (pressKey('Stow'))
      if (e.code !== 'KeyR' || e.repeat || panelRef.current || frozen.current) return
      held = false
      t = setTimeout(() => { held = true; setStance(st => holdR(st)) }, HOLD_MS)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'KeyR' || !t) return
      clearTimeout(t); t = null
      if (held) return
      const r = tapR(stanceRef.current, getInv())
      setStance(r.stance)
      if (r.reload) setReloadTick(n => n + 1)
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); if (t) clearTimeout(t) }
  }, [])
  // compass marks: what the keeper might be heading for, by zone
  useEffect(() => {
    marksRef.current = zone.kind === 'plot'
      ? [{ x: GATE.x, z: GATE.z, color: '#e7c766', title: 'the gate' }, { x: GREG.x, z: GREG.z, color: '#c9a27a', title: 'Gregory' }]
      : [
          // the six nearest infected nodes (the continent holds hundreds), Greg's waymark, your waymarks, all in world coords
          ...[...nearNodes].sort((a, b) => Math.hypot(a.x - pos.current.x, a.z - pos.current.z) - Math.hypot(b.x - pos.current.x, b.z - pos.current.z)).slice(0, 6)
            .map(n => ({ x: n.x, z: n.z, color: '#5f6165', title: 'infected ground' })),
          { x: GREG_WAYMARK.x, z: GREG_WAYMARK.z, color: '#e7c766', title: "Gregory's waymark" },
          ...(net ? [...net.settlements].sort((a, b) => Math.hypot(a.x - pos.current.x, a.z - pos.current.z) - Math.hypot(b.x - pos.current.x, b.z - pos.current.z)).slice(0, 4)
            .map(st => ({ x: st.x, z: st.z, color: '#d9c39a', title: st.name })) : []),
          ...(net?.fair ? [{ x: net.fair.x, z: net.fair.z, color: '#b37fd6', title: FAIR_NAME }] : []),
          ...waymarks.filter(w => ww?.byName.has(w.tile)).map(w => { const o = ww!.offsetOf(w.tile); return { x: w.x + o.x, z: w.z + o.z, color: '#6fd3c4', title: 'your waymark' } }),
        ]
    marksRef.current = [...marksRef.current, ...questMarks(zone.kind === 'plot' ? 'ather' : 'wilds')]   // the journal's waymarks (pack.tsx)
  }, [zone, nearNodes, waymarks, journal, ww, net])
  // THE FIRST ERRAND (business/errand.ts, Magii + Alex 11-16): Greg hands the birth letter's gems; the journal points to
  // the school's runesmith, then the Enchant Temple in the Citadel (those waymarks light on the continent page)
  const birth = useBirth(), loadoutNow = useLoadout()
  const castSet = useMemo(() => castMoves(loadoutNow, birth), [loadoutNow, birth])
  const castSetRef = useRef(castSet); castSetRef.current = castSet
  // ── the keeper's hands (open/shared/open-hands.tsx): what the body is doing, read once a frame ─────────────────────
  const handsCastAt = useRef(-Infinity)
  const feedHands = useCallback((sg: HandsSignal) => {
    const pruning = !!fxRef.current?.busy(), mining = !!cFxRef.current?.busy(), h = heldRef.current
    sg.family = pruning ? 'forestry' : mining ? 'prospecting' : h === BAIT ? 'rinning' : null
    sg.breaking = pruning || mining
    sg.tier = 0
    sg.hidden = frozen.current || h === 'repeater'   // a panel owns the screen, or the gun is out (it draws its own)
    sg.held = h === 'waymark' ? { colour: 0x8a6a3c, piece: true } : null
    sg.castAt = handsCastAt.current
    sg.airborne = false; sg.sliding = false; sg.crouching = false; sg.climbing = false
    sg.wallCatch = false; sg.hanging = false; sg.mantle = -1; sg.swimming = false
  }, [])
  const zoneRef = useRef(zone.kind); zoneRef.current = zone.kind; zoneRef0.current = zone.kind
  /** Q / X: pay, then the keeper moves (surge, impulse) or the fight takes it (combat-casts.ts) */
  const castSlot = useCallback((slot: CastSlot) => {
    const move = castSetRef.current[slot], cc = castClocks.current[slot]
    if (cc.move !== move) castClocks.current[slot] = { move, clock: freshClock(castForMove(move)) }
    const v = press(slot, move, castClocks.current[slot].clock, performance.now(), manaRef.current.cur, { fight: zoneRef.current === 'wilds' })
    if (!v.ok) { hudSay(v.why, 'info'); return }
    castClocks.current[slot].clock = v.clock; manaRef.current.cur = v.mana
    handsCastAt.current = performance.now()   // the glove comes up (open-hands.tsx)
    const sp = v.spec
    if (sp.archetype === 'surge') { surge.current = { until: performance.now() + sp.surgeSecs * 1000, mult: sp.surgeMult || 1.5 }; hudSay(sp.label, 'item'); return }
    if (sp.archetype === 'impulse') { impulse.current = sp; hudSay(sp.label, 'item'); return }
    if (sp.archetype === 'restore' && zoneRef.current !== 'wilds') { hudSay(`${sp.label} · you are whole`, 'item'); return }
    castQueue.current.push(sp)
  }, [])
  const onCast = useCallback((sp: CastSpec, hit: CastHit | null) => {
    if (!hit) return
    const n = hit.hit
    hudSay(sp.archetype === 'restore' ? `${sp.label} · +${sp.heal}` : sp.archetype === 'infusion' ? `${sp.label} · the gun hits harder` : n ? `${sp.label} · ${n} held` : `${sp.label} · nothing caught`, 'item')
  }, [])
  // what the HUD shows for the two keys
  const castHud = useRef<{ key: string; name: string | null; cool: number; tooDear: boolean }[]>([])
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const now = performance.now()
      castHud.current = (['tactical', 'signature'] as CastSlot[]).map(slot => {
        const move = castSetRef.current[slot], sp = castForMove(move), cc = castClocks.current[slot]
        return { key: slot === 'tactical' ? 'Q' : 'X', name: move ? sp.label : null, cool: cc.move === move ? cooling(sp, cc.clock, now) : 0, tooDear: !!move && manaRef.current.cur < sp.manaCost }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const [given, setGiven] = useState(false)
  useEffect(() => setGiven(gemsGiven()), [])
  const errandStage = stageOf(birth, inv, loadoutNow, given)
  useEffect(() => { postEntries('errand', errandEntries(errandStage, birth, { greg: { x: GREG.x, z: GREG.z }, gate: { x: GATE.x, z: GATE.z } })) }, [errandStage, birth])
  // BETA M6a/M6b: the rinning + prospecting pointers, struck once used (re-read on every pack change: a catch/cut lands in it)
  useEffect(() => {
    const k = openSkills(), used = (id: 'rinning' | 'prospecting') => k[id].level > 1 || k[id].xp > 0
    postEntries('skills', skillPointerEntries({ rinning: used('rinning'), prospecting: used('prospecting') }))
  }, [inv])
  const seat = birthSeat(birth)
  const gregErrand = {
    stage: errandStage, seatName: seat ? SEATS[seat].name : '', where: seat ? SEATS[seat].where : '', citadel: seat === 'enchant',
    onTake: () => {
      if (!birth || gemsGiven()) return
      const g = gregsGems(getInv(), birth)
      if (g.left) { hudSay('Your bag is full. Make room for the gems.', 'info'); return }
      setInv(g.inv); markGemsGiven(); setGiven(true)
      hudSay(`Gregory's gems · cut your letter at the ${seat ? SEATS[seat].name : ''} runesmith`, 'item')
    },
  }
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
      if (e.code === 'KeyK') { cycleLook(); return }   // the ground-look A/B (ground-look.tsx)
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
      if (e.code === 'KeyE' && !n && (aimRef.current.tree || cAimRef.current.crystal) && stanceRef.current.kind === 'stowed') { workAimed(); return }
      if (e.code === 'KeyE' && !n && atFairDoor(pos.current.x, pos.current.z)) {
        hudSay(`${FAIR_NAME} · the troupe is still pitching. The season's games, contests and market open soon.`, 'info', 6); return
      }
      if (e.code === 'KeyE' && n) {
        if (n.kind === 'greg') setPanel({ kind: 'greg' })
        else if (n.kind === 'work') { if (n.near.kind !== 'raising') setPanel({ kind: 'work', near: n.near }) }
        else setPanel({ kind: 'map', view: 'ather', travel: true })
        return
      }
      if (e.code === 'KeyF') plantHere()
      if (!e.repeat && e.code === CAST_KEY.tactical) castSlot('tactical')
      if (!e.repeat && e.code === CAST_KEY.signature) castSlot('signature')

      if (e.code === 'KeyL' && n?.kind === 'waymark' && n.own) {
        const next = lift(waymarks, n.w.id); setWaymarks(next); saveWaymarks(next)
        const back = give(getInv(), 'waymark', 1); setInv(back.inv)
        setToast(back.left ? 'Waymark lifted, but your bag is full: it went back to the fold.' : 'Waymark lifted. It is back in your bag.')
      }
      if (e.code === 'KeyH' && zone.kind === 'wilds') goHome()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [panel, fade, zone, waymarks, ww, goHome, tune, skipDays, allNodes, plantHere, castSlot])

  const zoneName = zone.kind === 'plot' ? 'Your plot' : 'The Wilds'
  // Phone taps: only what applies here and now, each the key this page already handles.
  const touchActions: TouchAction[] = [
    ...(prompt ? [{ code: 'KeyE', key: 'E', label: prompt.startsWith('E · Gregory') ? 'Gregory' : 'use', near: true }] : []),
    ...(prompt?.includes('L lift') ? [{ code: 'KeyL', key: 'L', label: 'lift', near: true }] : []),
    { code: 'KeyM', key: 'M', label: 'map' },
    { code: 'KeyO', key: 'O', label: 'options' },
    ...(zone.kind === 'plot' ? [{ code: 'KeyC', key: 'C', label: 'friends' }] : []),
    { code: 'KeyI', key: 'I', label: 'pack' },
    // a phone button sends down + up at once, so it cannot HOLD R: stowing gets its own button while something is in hand
    ...(stance.kind !== 'stowed' ? [{ code: 'Stow', key: 'R', label: 'stow' }] : []),
    ...(zone.kind === 'wilds' ? [
      { code: 'KeyF', key: 'F', label: 'waymark' },
      { code: 'KeyR', key: 'R', label: stance.kind === 'weapon' ? 'swap · reload' : 'draw' },
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
        <OpenHands feed={feedHands} />
        <VoxelDayNight gloomAt={zone.kind === 'wilds' && ww ? (x, z) => ww.canopyAt(x, z) * 0.7 : undefined} />
        {zone.kind === 'plot' && <PlotScene owned={owned} pages={garden.pages} />}
        {zone.kind === 'plot' && <WorkshopScene pose={poseRef} owned={owned} />}
        {zone.kind === 'plot' && <ClusterScene frame={cl.frame} />}
        {zone.kind === 'plot' && cover !== 'none' && <GroundCover cover={cover} ground={ground} skip={coverSkip} focus={poseRef} />}
        {zone.kind === 'wilds' && ww && <ForestryFX ww={ww} aim={aimRef} fx={fxRef} ground={ground} />}
        {zone.kind === 'wilds' && ww && <ProspectingFX ww={ww} aim={cAimRef} fx={cFxRef} ground={ground} mineable={c => mineCheck(c.kind, c.id).ok} />}
        {zone.kind === 'wilds' && ww && <RinningFX waterY={WILDS_WATER_Y} isWater={rinWaterAt} roll={rinRoll} rarer={rinRarer} api={rinApi} holding={reelHold} out={held === BAIT} onCatch={onCatch} onGone={onGone} />}
        {zone.kind === 'wilds' && ww && [...ww.loaded].map(([name, T]) => { const t = ww.byName.get(name)!; return <group key={name} position={[t.tx * TILE_M, 0, t.ty * TILE_M]}><WildsScene W={T} waymarks={waymarks} focus={poseRef} off={{ x: t.tx * TILE_M, z: t.ty * TILE_M }} />{net && <TilePaths net={net} W={T} off={{ x: t.tx * TILE_M, z: t.ty * TILE_M }} />}</group> })}
        {zone.kind === 'wilds' && ww && net && <Settlements net={net} loaded={(x, z) => ww.tileAtPoint(x, z) ? ww.heightAt(x, z) : null} />}
        {zone.kind === 'wilds' && ww && net?.fair && ww.tileAtPoint(net.fair.x, net.fair.z) && <BigTop fair={net.fair} y={ww.heightAt(net.fair.x, net.fair.z)} />}
        {terrain && (
          <CombatLayer T={terrain} locked={locked} frozen={frozen} active={zone.kind === 'wilds' && fade === 0}
            safe={{ x: GREG_WAYMARK.x, z: GREG_WAYMARK.z, r: 30 }} onEvents={onCombat} onHud={onCombatHud} reviveKey={reviveKey} armed={held === 'repeater'} reloadTick={reloadTick} nodes={nearNodes} ownerOf={nodeOwner} casts={castQueue} onCast={onCast} />
        )}
        <QuestGuide zone={zone.kind === 'plot' ? 'ather' : 'wilds'} ground={ground} />
        {world && fade === 0 && <CompanionFollower pose={poseRef} ground={ground} />}
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
      <GameHud size={hudSize} pose={poseRef} marks={marksRef} vitals={vitalsRef} mana={manaRef} entries={hotbar} sel={litSlot(stance, inv)} onSelect={i => setStance(st => selectSlot(st, i, getInv()))} onEquip={i => setStance(st => equipSlot(st, i, getInv()))} tools={toolsRef} skills={skillsRef} casts={castHud}
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
      {panel?.kind === 'greg' && <GregPanel garden={garden} onBuy={buy} onClose={() => setPanel(null)} errand={gregErrand} />}
      {panel?.kind === 'cluster' && <ClusterPanel c={cl} onClose={() => setPanel(null)} />}
      {panel?.kind === 'work' && <WorkshopPanel near={panel.near} owned={owned} onClose={() => setPanel(null)} />}
      {zone.kind === 'plot' && <PlacingBar owned={owned} />}
      <LookChip />
      {zone.kind === 'wilds' && held === BAIT && <ReelBar api={rinApi} />}
      {optionsOpen && <OpenOptions onClose={() => setOptionsOpen(false)} />}
      <BirthGate />
      {panel?.kind === 'pack' && <PackMenu tab={panel.tab} onTab={t => setPanel({ kind: 'pack', tab: t })} onClose={() => setPanel(null)} sel={litSlot(stance, inv)} isTouch={isTouch} />}
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
              The gate ahead is the fold map: travel to the Wilds, your waymarks, or out through a city's door in Athernyx. Gregory, by the threshold, sells the ground under the mist. In the Wilds the Hollows wander: R draws the Repeater (tap again to reload, hold R to put it away), click to shoot, walk over grey matter to take it. Hands free, click a tree to prune it. F plants a waymark, H walks home, I opens your bag.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const panelBtn: React.CSSProperties = { padding: '12px 20px', borderRadius: 8, border: '1px solid rgba(244,239,226,0.4)', background: 'rgba(12,16,20,0.8)', color: '#f4efe2', font: '600 13px system-ui', letterSpacing: '0.12em', textTransform: 'uppercase', touchAction: 'manipulation' }
