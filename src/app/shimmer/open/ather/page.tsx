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

import { OwnerReady } from '../shared/owner-ready'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OpenHands, type OpenHandsApi } from '../shared/open-hands'
import { FpGun, ScopeRing, fpGunAds, ADS_TIGHT, type FpGunApi } from '../shared/fp-gun'
import { RANGE_GUNS } from '../shared/gunplay'
import { ThirdPersonBody, dollAction, pullBack, newDrive } from '../shared/third-person'
import type { Camera } from 'three'
import { VoxelDayNight } from '../shared/day-night'
import { terrainWorld } from '../terrain-world'
import { withPieces } from './dynamic-solids'
import { GateRings } from '../shared/gate-rings'
import { Walker, verbOf, type Loco } from './walker'
import {
  plotShape, plotHeightAt, mistWalls, THRESHOLD, GATE, GREG, FALL_Y, REACH, squareAt, sqId, canBuy,
  loadGarden, saveGarden, freshGarden, type Garden,
} from './plot'
import { PlotScene } from './plot-scene'
import { WorkshopScene, WorkshopPanel, PlacingBar, BuildBar, usePlacingKeys, isPlacing, useWorks, workWalls, workPrompt, currentWorks, setWorks } from './workshop'
import { currentFarm, setFarm, currentWater, setWater, farmNow } from './farm-room'
import { BuildPointer, stepBuildCam, useBuildMode, useBuildKeys, isBuilding, exitBuild } from './build-mode'
import { tick as villageTick, loadVillage, saveVillage } from './moglins'
import { nearWork, type WorkNear } from './rooms'
import { ClusterScene } from './cluster-scene'
import { cycleLook, LookChip } from './ground-look'
import { GroundCover, coverFromUrl } from './ground-cover'
import { coverClear } from './cover-clear'
import { useOpenMultiplayer, RemoteKeepers, OPEN_WILDS } from '../shared/open-mp'
import { OpenSocial } from '../shared/play-together'
import { ClusterPanel, useCluster } from './cluster-panel'
import { clusterGround, mateWalls, mateAt, inMiddle, onPath, onMeadow } from './cluster'
import { WildsScene } from './wilds-scene'
import { FoldMap, GregPanel, LANDING, type Dest } from './panels'
import { gregTalk } from './greg-talk'
import { gregSpot } from './moonwell-glade'   // M30 part 2: Greg lives at the Glade
import { GladeGreg, type GregTourState, type GregLive } from './glade-greg'
import { tourStops, giveGloveWord, TABLE_STOP, TABLE_KEEPER, GLOVE_GIVE, TOUR_NEXT, TOUR_SKIP, TOUR_DONE } from './greg-tour'
import { FolkModel, folkLook } from '../shared/folk-model'
import { getLoadout, setLoadout } from '../shared/loadout'
import { TalkBubble, TalkChoices, type TalkNode } from '../shared/npc-talk'
import { gemsGiven, markGemsGiven, stageOf, gregsGems, errandEntries, birthSeat } from '../business/errand'
import { skillPointerEntries } from '../business/skill-pointers'
import { SEATS } from '../business/letters'
import { useBirth } from '../birth-gate'
import { CAST_KEY } from '../shared/casting'
import { useCasts } from '../shared/use-casts'
import { type CastSpec } from '../../play3d/cast'
import type { CastHit } from './combat-casts'
import { useLoadout } from '../shared/loadout'
import { pitstopsUnlocked, type PlaceLike, type Pitstop } from '../continent/pitstops'
import { tileCentreWorld, BIOME, BIOME_NAME, type Wilds, type Tree, type Crystal } from './wilds'
import { loadIndex, makeWorld, stream, tileOf, zonesOf, TILE_M, type WildsWorld } from './wilds-world'
import { loadNetwork, clearing, roadField, settlementAt, nearFair, fairDoor, FAIR_NAME, FAIR_DOOR_R, type Network, type Settlement } from './network'
import { useFolkTalk } from './use-folk-talk'
import { TilePaths, Settlements, BigTop } from './network-scene'
import { canPlant, plant, lift, loadWaymarks, saveWaymarks, GREG_WAYMARK, MAX_WAYMARKS, type Waymark } from './waymarks'
import { loadFog, saveFog, reveal, type Fog } from './explored'
import { CombatLayer, type CombatHud, type SightLink } from './combat-layer'
import type { CombatEvent, Terrain } from './combat'
import { ownerOf, nodeRegions, GAME_DAY_MS, SUB, type WildsNode } from './nodes'
import { advance, clearAt, loadSpread, saveSpread, loadSkew, saveSkew, type SpreadState, type SpreadEvent } from './spread'
import { TouchControls, type TouchAction } from '../shared/touch-controls'
import { isTouchOnly, pressKey, touch } from '../shared/touch'
import { useMenuLock } from '../shared/menu-lock'
import { BirthGate, useBirthGateUp, BORN_EVENT } from '../birth-gate'
import { MorelBubble } from '../shared/morel-bubble'   // BETA M33: the glove's gem speaks (ammo)
import { markMet } from '../shared/met'
import { useMorelHints } from '../shared/morel-hints'   // BETA M33 S2: stuck hints on the errand
import { OpenOptions, useOptionsKeys, useOptionsOpen, setOptionsOpen } from '../options'
import { useInv, setInv, getInv, hotbarEntries } from '../shared/bag'
import { DeathPack, fallAndDrop } from './death-pack'
import { CloudReefs, CloudDeck, HorizonRing } from '../shared/cloud-edge'
import { wildsReefPuffs, deckSquares } from './edge-clouds'
import { STOWED, STOWED_SPEED, HOLD_MS, tapR, holdR, selectSlot, equipSlot, heldOf, litSlot, settle, type Stance } from '../shared/stance'
import { ensureBasicTools, type EquippedTools } from '../../engine/tools'
import type { SkillSet } from '../../engine/skills'
import { PackMenu, PACK_KEYS, type PackTab } from '../pack'
import { QuestGuide } from '../quest-guide'
import { useJournal, postEntries, questMarks } from '../shared/journal'
import { give, take, itemDef, countOf, NO_BAIT_LINE } from '../shared/inventory'
import { isDish, healOf } from './cooking'
import { loadTools, saveTools, easeOf, xpOf, wearRinstick, TOOLS_EVENT } from './rinsticks'
import { useRinQuest, fennelTalk, FENNEL_NAME } from './use-rinquest'
import { noStickLine, hasStick, fennelHere } from './rinquest'
import { Fennel, fennelSpot, FENNEL_HEAD } from './fennel'
import { MoonwellPool } from './moonwell-quest'
import { frameStats } from '../shared/keeper-look'
import { getLook } from '../shared/look-store'
import { manaFor, bonusXp, wearFocus } from './focuses'
import { isPotion, drink, buffOn, loadBuffs, saveBuffs, BUFF_NAME, STARLIGHT_XP, OPEN_FLOW_MULT, type Buffs, type BuffId } from './alchemy'
import { BAIT, rollRinn, type Rinn } from './rinning'
import { RinningFX, type RinningApi } from '../shared/rinning-fx'
import type { Reel } from '../shared/reel'
import { ReelBar } from '../shared/reel-bar'
/** the Wilds' water surface (the rinning float rides it) */
const WILDS_WATER_Y = 0.02
import { prunePlan, pruneCommit, pruneCheck, startShake, openSkills, openLevel, addOpenXp, setOpenXpMult, TREE_NAME, MANA_COST, ZONE_NAME, type Zone as WildsZone } from './forestry'
import { ForestryFX, type Aim, type ForestryFx } from './forestry-fx'
import { ProspectingFX, crystalCentre, type CrystalAim, type ProspectFx } from './prospecting-fx'
import { CompanionFollower } from '../shared/companion-follower'
import { subscribeCompanion, takeJoined, perkLabel, perkBonus } from '../shared/companion'
import { minePlan, mineCommit, mineCheck, CRYSTAL_NAME, CRYSTAL_ITEM, TIER as CRYSTAL_TIER, MANA_COST as MINE_COST, type CrystalKind } from './prospecting'
import { beginWork, takeChip, workOf, chipGapMs, HOLD_RANGE, type Work, type Stack as ChipStack } from './channel'
import { ChannelFocus, freshFocus, type FocusState } from './channel-fx'
import { GameHud, useGameHudSize, hudSay, type CompassMark, type CompassPose, type Mana } from '../shared/game-hud'
import { AtherMiniMap } from './minimap'
import type { Vitals } from '../../engine/vitals'


type Zone = { kind: 'plot' } | { kind: 'wilds'; tile: string }
type Spawn = { x: number; z: number; yaw: number }
const gregAt = gregSpot()   // BETA M30 part 2: where Gregory sits (Moonwell Glade); the plot keeps only its old anchor numbers (plot.ts GREG)
type Panel = null | { kind: 'map'; view: 'ather' | 'athernyx'; travel: boolean } | { kind: 'greg' } | { kind: 'talk'; step: number } | { kind: 'pack'; tab: PackTab } | { kind: 'cluster' } | { kind: 'work'; near: WorkNear } | { kind: 'folk'; s: Settlement } | { kind: 'fennel'; page: number }
type Near = null | { kind: 'gate' } | { kind: 'greg' } | { kind: 'fennel' } | { kind: 'work'; near: WorkNear } | { kind: 'waymark'; w: Waymark; own: boolean } | { kind: 'folk'; s: Settlement }

// ★ held until the save owner is known (shared/owner-ready.tsx: the 11-18 'rooms vanished on refresh' fix)
export default function AtherSlice() { return <OwnerReady><AtherSliceGame /></OwnerReady> }
function AtherSliceGame() {
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
  // M24 the sea turns to cloud past the map: reef layout off the tile INDEX (not what is loaded), so it never flickers as tiles stream
  const reefLayout = useCallback((cx: number, cz: number) => (ww ? wildsReefPuffs(cx, cz, (tx, ty) => ww.at(tx, ty)?.land ?? 0, WILDS_WATER_Y, TILE_M) : []), [ww])
  const deckLayout = useCallback((cx: number, cz: number) => (ww ? deckSquares(cx, cz, (tx, ty) => !!ww.at(tx, ty), TILE_M) : []), [ww])
  const [wrev, setWrev] = useState(0)
  const [hereTile, setHereTile] = useState('first-wilds')
  const W: Wilds | null = ww?.loaded.get(hereTile) ?? null
  const streamAt = useCallback(async (x: number, z: number) => { if (ww && await stream(ww, x, z)) setWrev(ww.rev) }, [ww])
  const [fog, setFog] = useState<Fog | null>(null)
  const [waymarks, setWaymarks] = useState<Waymark[]>([])
  const [garden, setGarden] = useState<Garden>(freshGarden)
  const [panel, setPanel] = useState<Panel>(null)
  // BETA M32: Greg's walking tour (greg-tour.ts). Not a panel: the keeper walks along with him; only a stop's talk freezes them.
  const [tour, setTour] = useState<GregTourState | null>(null)
  const tourRef = useRef(tour); tourRef.current = tour
  const gregLive = useRef<GregLive>({ x: gregAt.x, z: gregAt.z, seated: true })   // where Greg is NOW (glade-greg.tsx writes it)
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
  const handsApi = useRef<OpenHandsApi>(null)
  // THE GUN IN HAND + ITS SIGHTS (Alex 11-18; shared/fp-gun.tsx): drawn whenever R has a gun out (the gloves hold it now), right-click
  // aims (combat-layer sets `aiming`), the cone tightens past ADS_TIGHT, and recoil + the etched mark's flare read firedAt / charge
  const gunApi = useRef<FpGunApi>(null)
  const sightRef = useRef<SightLink>({ aiming: false, ads: false, firedAt: -Infinity, charge: 0 })
  const near = useRef<Near>(null)
  const hereRef = useRef('first-wilds'), nearRef = useRef('')
  const hudT = useRef(0), fogT = useRef(0), fogDirty = useRef(false)
  const [chud, setChud] = useState<CombatHud | null>(null)
  const chudRef = useRef(chud); chudRef.current = chud
  // ── THE HUD (shared/game-hud.tsx): the same hearth HUD as every open-world page ──
  const hudSize = useGameHudSize(isTouch)
  const poseRef = useRef<CompassPose>({ x: THRESHOLD.x, z: THRESHOLD.z, yaw: THRESHOLD.yaw })
  const marksRef = useRef<CompassMark[]>([])
  const journal = useJournal()   // re-marks the compass when a journal waymark is toggled
  const vitalsRef = useRef<Vitals>({ hp: 100, hpMax: 100, shield: 0, shieldMax: 0 })
  // ★ mana is real now: pruning from a distance spends it (forestry.ts › MANA_COST), it refills slowly (build: 1.5/s)
  const manaRef = useRef<Mana>({ cur: 100, max: 100, regen: 1.5 })
  const buffsRef = useRef<Buffs>({})   // potion buffs (ather/alchemy.ts), loaded per keeper on mount
  useEffect(() => { buffsRef.current = loadBuffs(); toolsRef.current = loadTools() }, [])   // per keeper, after mount (localStorage)
  useEffect(() => { const on = () => { toolsRef.current = loadTools() }; window.addEventListener(TOOLS_EVENT, on); return () => window.removeEventListener(TOOLS_EVENT, on) }, [])   // a rinstick made at the Rinnshop
  // THE GARDEN VILLAGE AT WORK (moglins.ts): on load the village catches up on the time you were away (capped at 12 h) and
  // says what it made; then it ticks every minute while you play. The product lands in each room's own store.
  const runVillage = useCallback((say: boolean) => {
    const v = loadVillage()
    if (!v.moglins.some(m => m.room)) { saveVillage({ ...v, lastTick: Date.now() }); return {} }
    // the farm's own clock (farm-room.tsx › farmNow; equals Date.now() but for a check's skew), so a farmer tends on the
    // same time the beds grow on
    const t = villageTick(v, currentWorks(), farmNow(), { farm: currentFarm().farm, water: currentWater() })
    saveVillage(t.village)
    if (Object.keys(t.made).length) setWorks(t.works)
    if (t.tended && t.grounds) { setFarm({ ...currentFarm(), farm: t.grounds.farm }); setWater(t.grounds.water) }
    const names = Object.entries(t.made).map(([id, n]) => `${n} ${itemDef(id).name}`)
    // an info line held 9 s, after the arrival lines (an 'item' line lasts 1.8 s and the next slot name replaces it)
    if (say && names.length) { const text = `While you were away, your village made ${names.join(', ')}. You will find it all in the rooms' stores.`; setTimeout(() => hudSay(text, 'info', 9), 1500) }
    return t.made
  }, [])
  useEffect(() => { runVillage(true); const id = setInterval(() => runVillage(false), 60_000); return () => clearInterval(id) }, [runVillage])
  const eatQueue = useRef<number[]>([])   // meals spent, healed on the combat layer's next frame (ather/cooking.ts)
  const [net, setNet] = useState<Network | null>(null), netRef = useRef<Network | null>(null), placeRef = useRef<string | null>(null)
  const atFairDoor = (x: number, z: number) => { const f = netRef.current?.fair; if (!f || zoneRef0.current !== 'wilds') return false; const d = fairDoor(f); return Math.hypot(d.x - x, d.z - z) < FAIR_DOOR_R }
  const zoneRef0 = useRef<string>('plot')
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
  const rinQuest = useRinQuest(), rinQuestRef = useRef(rinQuest); rinQuestRef.current = rinQuest   // M22 the first rinstick (use-rinquest.ts)
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
      const w = makeWorld(idx); if (nw) { w.clear = clearing(nw); w.roads = roadField(nw); setNet(nw); netRef.current = nw }
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
  // BUILD MODE (build-mode.tsx, Alex 11-18): the planning table's flying planner. The keeper freezes where they stand,
  // the mouse is freed (you click the ground), and the lens flies from the walker's tick below
  const building = useBuildMode()
  useBuildKeys(isPlacing)
  useOptionsKeys(panel !== null || birthUp || building)
  useEffect(() => { frozen.current = panel !== null || optionsOpen || birthUp || building || !!tour?.talk }, [panel, optionsOpen, birthUp, building, tour])
  // panels are clicked, so they free the mouse; closing one takes the camera back (shared/menu-lock.ts)
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const getCanvas = useCallback(() => canvasEl.current, [])
  useMenuLock(panel !== null || optionsOpen || building, getCanvas)
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
    fading.current = true; setFade(1); setPanel(null); exitBuild()
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
        { const p = pos.current; fallAndDrop(p.x, heightRef.current(p.x, p.z), p.z) }   // M20: the bag stays where they fell (death-pack.tsx)
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

  // BORN AT MOONWELL (BETA M31, Alex 11-19: 'the start loses new keepers'). A keeper born on this page (the rune chosen)
  // opens their eyes at Moonwell Glade beside Greg, not on the plot: set down at his waymark (~6.6 m from his bench) behind
  // the Born beat + the creator, turned to FACE him (the waymark's own yaw looks past him). Waits for the Wilds if they are
  // still streaming. A returning keeper never fires it (born already), so they load as today; the plot stays theirs.
  const [bornPending, setBornPending] = useState(false)
  useEffect(() => { const on = () => setBornPending(true); window.addEventListener(BORN_EVENT, on); return () => window.removeEventListener(BORN_EVENT, on) }, [])
  useEffect(() => {
    if (!bornPending || !ww) return
    setBornPending(false)
    const o = ww.offsetOf(GREG_WAYMARK.tile), x = GREG_WAYMARK.x + o.x + 2.2, z = GREG_WAYMARK.z + o.z + 2.2
    const yaw = Math.atan2(-(gregAt.x - x), -(gregAt.z - z))   // walker: forward = (-sin yaw, -cos yaw)
    stream(ww, x, z).then(() => { setWrev(ww.rev); setHereTile(GREG_WAYMARK.tile); arrive({ kind: 'wilds', tile: GREG_WAYMARK.tile }, { x, z, yaw }) })
  }, [bornPending, ww, arrive])

  const world = useMemo(() => zone.kind === 'plot' ? plotWorld : ww ? terrainWorld(withPieces(ww.shape)) : null, [zone, ww, plotWorld])   // ww.shape reads the live tiles
  // ground cover preview (ground-cover.tsx, ?cover=): nothing on a path, the gate's pad or at Greg's feet
  const [cover, setCover] = useState<'none' | 'tufts' | 'meadow' | 'lush'>('meadow')
  useEffect(() => setCover(coverFromUrl()), [])
  const placedClear = useMemo(() => coverClear(works), [works])   // M23: every placed room / piece / chest / the table clears its floor
  const coverSkip = useCallback((x: number, z: number) => placedClear(x, z) || (cl.frame.linked && onPath(cl.frame, x, z)) || Math.hypot(x - GATE.x, z - GATE.z) < 5 || Math.hypot(x - GREG.x, z - GREG.z) < 2.5 || Math.hypot(x - THRESHOLD.x, z - THRESHOLD.z) < 2, [cl.frame, placedClear])
  const ground = useMemo(() => zone.kind === 'plot' ? (cl.frame.linked ? (x: number, z: number) => Math.max(plotHeightAt(x, z), clusterGround(cl.frame, x, z)) : plotHeightAt) : ww ? ww.heightAt : () => 0, [zone, ww, cl.frame])
  // M27: others in the Wilds (shared/open-mp.tsx); the plot is personal, no socket. Feet on the ground the page knows.
  const mp = useOpenMultiplayer(zone.kind === 'wilds' ? OPEN_WILDS : null, () => { const p = poseRef.current, y = ground(p.x, p.z); return { x: p.x, y: Number.isFinite(y) ? y : 0, z: p.z, yaw: p.yaw } })
  const heightRef = useRef(ground); heightRef.current = ground
  // third person (V): your own keeper, the segmented doll (open/shared/third-person.tsx), driven from the tick below
  const thirdRef = useRef(false), dollDrive = useRef(newDrive()), camRef = useRef<Camera | null>(null)

  const gateStepRef = useRef<(lc: Loco, yaw: number, dt: number, g: (x: number, z: number) => number) => void>(() => {})
  const onTick = useCallback((lc: Loco, yaw: number, dt: number) => {
    pos.current = { x: lc.px, z: lc.pz, grounded: !lc.airborne, swimming: lc.swimming }
    stepChannel(lc.px, lc.pz)   // gathering by channel: the next chip, or let go
    { // the body, read once: posed against THIS frame's camera (the walker placed it just before calling us), off its own state
      const now = performance.now(), h = heldRef.current, third = thirdRef.current
      const speed = Math.hypot(lc.hvx, lc.hvz), working = !!chanRef.current || !!fxRef.current?.busy() || !!cFxRef.current?.busy()
      // the first-person hands (hidden in third person: the doll's own hands are what you see)
      handsApi.current?.step({ now, speed, airborne: lc.airborne, hidden: frozen.current || stanceRef.current.kind === 'weapon' || third || isBuilding(),
        castAt: handsCastAt.current, working }, dt)
      handsApi.current?.seat(now - handsCastAt.current < 640 ? 1 : 0)
      { // the held gun: out only with a gun drawn, first person, nothing owning the screen
        const sg = sightRef.current, gun = stanceRef.current.kind === 'weapon' && !third && !frozen.current && !isBuilding() ? RANGE_GUNS.find(g => g.id === h) ?? null : null
        if (!gun) sg.aiming = false
        gunApi.current?.step({ gun, aiming: sg.aiming, speed, firedAt: sg.firedAt, reloading: !!chudRef.current?.reloading, charging: sg.charge, now }, dt)
        sg.ads = fpGunAds().t > ADS_TIGHT
      }
      // the doll: where the keeper stands, facing where the camera looks (the doll faces +z, the lens looks down -z)
      const d = dollDrive.current, a = dollAction({ speed, airborne: lc.airborne, working, castAgoMs: now - handsCastAt.current, gun: stanceRef.current.kind === 'weapon' })
      d.action = a.action; d.rate = a.rate; d.x = lc.px; d.y = lc.py; d.z = lc.pz; d.yaw = yaw + Math.PI; d.visible = third || isBuilding()
      if (third && camRef.current) pullBack(camRef.current, heightRef.current, lc.py)
      if (isBuilding() && camRef.current) stepBuildCam(camRef.current, dt)   // the flying planner owns the lens
    }
    { const b = buffsRef.current, t = Date.now()   // a potion buff that has run out says so, once, and leaves the save
      setOpenXpMult(buffOn(b, 'starlight', t) ? STARLIGHT_XP : 1)
      for (const k of Object.keys(b) as BuffId[]) if (!buffOn(b, k, t)) { const nb = { ...b }; delete nb[k]; buffsRef.current = nb; saveBuffs(nb); hudSay(`${BUFF_NAME[k]} fades.`, 'info') } }
    lc.speedMult = (stanceRef.current.kind === 'stowed' ? STOWED_SPEED : 1) * frameStats(getLook()).speed   // hands free, a little quicker on foot; M29 frame (Small +5%)
      * (performance.now() < surge.current.until ? surge.current.mult : 1)      // a surge cast (Static Burst)
    if (impulse.current) {   // an impulse cast (Quickform): up, keeping the run
      const sp = impulse.current; impulse.current = null
      lc.vy = Math.max(lc.vy, sp.impulseUp || 8); lc.airborne = true
      if (!sp.keepMomentum) { lc.hvx = 0; lc.hvz = 0 }
    }
    gateStepRef.current(lc, yaw, dt, heightRef.current)   // a standing Gate (shared/use-casts.ts): bills, and carries the keeper through an end
    poseRef.current = { x: lc.px, z: lc.pz, yaw }
    let n: Near = null
    if (zone.kind === 'plot') {
      if (Math.hypot(GATE.x - lc.px, GATE.z - lc.pz) < REACH + 1.2) n = { kind: 'gate' }
      else if (fennelRef.current && Math.hypot(fennelRef.current.x - lc.px, fennelRef.current.z - lc.pz) < REACH) n = { kind: 'fennel' }   // M22
      else { const w = nearWork(worksRef.current, lc.px, lc.pz); if (w) n = { kind: 'work', near: w } }
    } else {
      const all = [{ w: GREG_WAYMARK, own: false }, ...waymarks.map(w => ({ w, own: true }))]
      let wmD = Infinity
      for (const { w, own } of all) { const o = ww?.byName.has(w.tile) ? ww.offsetOf(w.tile) : null; const d = o ? Math.hypot(w.x + o.x - lc.px, w.z + o.z - lc.pz) : Infinity; if (d < 2.6) { n = { kind: 'waymark', w, own }; wmD = d } }
      // M30: Gregory at Moonwell Glade, ~3.5 m from the arrival waymark. The NEARER one takes E (11-19 overnight, beta-m5-errand:
      // 'Greg always wins' left a keeper at the stone unable to open the fold map home).
      { const gl = gregLive.current, gd = Math.hypot(gl.x - lc.px, gl.z - lc.pz)
        if (gd < REACH && gd < wmD && !tourRef.current) n = { kind: 'greg' }
        if (tourRef.current && !tourRef.current.talk && gd > 30) setTour(null) }   // M32: walked off = the tour is skipped
      // a settlement's folk: E anywhere inside it talks to them (settlement-folk.ts / folk-panel.tsx); a waymark at your feet wins
      // ...but a node under the crosshair with hands stowed keeps E for the work (Alex 11-19: at Moonwell Glade the folk ate E, no mining)
      const workAim = (aimRef.current.tree || cAimRef.current.crystal) && stanceRef.current.kind === 'stowed'
      if (!n && !workAim && netRef.current) { const st = settlementAt(netRef.current, lc.px, lc.pz); if (st) n = { kind: 'folk', s: st } }
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
      const p = tourRef.current?.talk ? null   // M32: Greg is talking at a stop; E answers him, nothing else
        : n?.kind === 'gate' ? 'E · the gate (fold map)'
        : n?.kind === 'greg' ? 'E · Gregory (buy ground)'
        : n?.kind === 'fennel' ? 'E · Fennel'
        : n?.kind === 'work' ? workPrompt(n.near)
        : n?.kind === 'waymark' ? (n.own ? 'E · fold map · L lift this waymark' : 'E · fold map')
        : n?.kind === 'folk' ? `E · talk to the folk of ${n.s.name}`
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
      // read-only probe (owner-race-check): the plot the page is DRAWING, from the live store
      works: () => { const w = currentWorks(); return { rooms: w.rooms.map(r => r.kind), pieces: w.pieces.map(p => p.item) } },
      zone: () => zone.kind,
      open: (k: 'gate' | 'greg' | 'athernyx') => setPanel(k === 'greg' ? { kind: 'talk', step: 0 } : { kind: 'map', view: k === 'athernyx' ? 'athernyx' : 'ather', travel: true }),
      travel: (d: Dest) => travel(d),
      grant: (grey = 0, pages = 0) => updateGarden({ ...garden, grey: garden.grey + grey, pages: garden.pages + pages }),
      resetGarden: () => updateGarden(freshGarden()),
      spread: () => spreadRef.current, skipDays, ownerAt: (x: number, z: number) => nodeOwner?.(x, z),
      chan: () => (chanRef.current ? { id: chanRef.current.w.id, done: chanRef.current.w.done, of: chanRef.current.w.chips.length } : null), prune: () => pruneAimed(), aim: () => aimRef.current.tree?.id ?? null, mine: () => mineAimed(), crystal: () => { const c = cAimRef.current.crystal; return c ? { id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z } : null }, mana: () => manaRef.current.cur,
      stance: () => stanceRef.current, speedMult: () => (stanceRef.current.kind === 'stowed' ? STOWED_SPEED : 1) * frameStats(getLook()).speed,
      village: () => loadVillage(), villageTick: () => runVillage(false),
      eat: () => eatHeld(), hp: () => vitalsRef.current.hp, drink: () => drinkHeld(), buffs: () => buffsRef.current, tools: () => toolsRef.current, setMana: (n: number) => { manaRef.current.cur = n },
      rin: () => rinApi.current?.view() ?? null, cast: () => castOrAnswer(), hold: (h: boolean | 'track') => { reelHold.current = h === 'track' ? (r: Reel) => (r.zone - r.bob) * 6 + (r.zoneV - r.bobV) * 1.6 > 0 : h },
    }
  }, [zone, travel, garden, updateGarden, skipDays, nodeOwner])

  const plantHere = useCallback(() => {
    if (zone.kind !== 'wilds' || !ww) return
    // a waymark belongs to the tile it stands in, in that tile's own coords (the fold map, the spacing rules, saves)
    const p = pos.current, biome = ww.biomeAt(p.x, p.z), t = ww.at(tileOf(p.x, p.z).tx, tileOf(p.x, p.z).ty)
    if (!t) return
    const lx = p.x - t.tx * TILE_M, lz = p.z - t.ty * TILE_M
    const st = netRef.current ? settlementAt(netRef.current, p.x, p.z) : null   // waymarks bind only where folk live (Alex 11-18)
    const v = canPlant(waymarks, { tile: t.name, x: lx, z: lz, biome, grounded: p.grounded, swimming: p.swimming, settlement: st?.id ?? null })
    if (!v.ok) { setToast(v.why); return }
    const spent = take(getInv(), 'waymark', 1)          // a waymark is a thing in the bag now: planting spends one
    if (!spent) { setToast('No waymarks in your bag. Lift one you planted to carry it again.'); return }
    setInv(spent)
    const next = plant(waymarks, { tile: t.name, x: lx, y: ww.heightAt(p.x, p.z), z: lz, biome, settlement: st?.id })
    setWaymarks(next); saveWaymarks(next)
    setToast(`Waymark bound in ${st?.name ?? 'the Wilds'}. It is a stop on the fold map now.`)
  }, [zone, ww, waymarks])
  // what you hold is what the stance says (a drawn gun, a picked hotbar item, or nothing): a waymark plants on click,
  // the Repeater fires (combat-layer only fires while armed), stowed hands work a node
  const inv = useInv()
  const held = heldOf(stance, inv)
  useEffect(() => { setStance(st => settle(st, inv)) }, [inv])   // the last waymark planted empties the hand
  const heldRef = useRef(held); heldRef.current = held
  // ── forestry from a distance (forestry.ts + forestry-fx.tsx): stowed, click (or E) a tree within 10 m; the Forestry
  //    socket's tool does the work
  // ── GATHERING BY CHANNEL (channel.ts; Alex 11-17): stowed, E or click a tree / crystal in reach → the right focus appears
  //    at the node and chips at it, a beat at a time, until the node gives way. E / click it again, walk off, draw a weapon
  //    or open a panel and it lets go; the chips you got stay yours and the node keeps its progress.
  const TREE_TIER = { goldwood: 1, shimmeroak: 2, starwillow: 3, dawnwood: 4 } as const   // the Forestry gates 1/4/7/10
  type Chan = { w: Work; node: 'tree'; t: Tree; nextAt: number; waiting: boolean; got: Record<string, number> }
    | { w: Work; node: 'crystal'; c: Crystal; nextAt: number; waiting: boolean; got: Record<string, number> }
  const chanRef = useRef<Chan | null>(null), focusRef = useRef<FocusState>(freshFocus())
  const stopChannel = useCallback((why?: string) => {
    const ch = chanRef.current; if (!ch) return
    chanRef.current = null; focusRef.current = { ...focusRef.current, node: null }
    if (why) setToast(why)
  }, [])
  const chanName = (ch: Chan) => (ch.node === 'tree' ? TREE_NAME[ch.t.kind] : CRYSTAL_NAME[ch.c.kind])
  const pruneAimed = useCallback(() => {
    const t = aimRef.current.tree
    if (!t || zone.kind !== 'wilds') return
    if (chanRef.current?.w.id === t.id) { stopChannel(`Let go. The ${TREE_NAME[t.kind]} keeps what is done.`); return }
    if (stanceRef.current.kind !== 'stowed') { setToast('Stow first (hold R): stowed hands use the right tool.'); return }
    if (!toolsRef.current.forestry) { setToast('You have no Forestry focus.'); return }
    const c = pruneCheck(t.kind, t.id); if (!c.ok) { setToast(c.why); return }
    stopChannel()
    const w = beginWork('tree', t.id, () => { const d = prunePlan(t.kind); const perk = perkBonus('forestry'); if (perk) d[0].n += 1; return { drops: d, extra: perk } }, TREE_TIER[t.kind], manaFor(toolsRef.current.forestry, TREE_TIER[t.kind], MANA_COST))   // M17: double above the focus's reach
    chanRef.current = { w, node: 'tree', t, nextAt: 0, waiting: false, got: {} }
  }, [zone.kind, stopChannel])
  const mineAimed = useCallback(() => {
    const c = cAimRef.current.crystal
    if (!c || zone.kind !== 'wilds') return
    if (chanRef.current?.w.id === c.id) { stopChannel(`Let go. The ${CRYSTAL_NAME[c.kind]} keeps what is done.`); return }
    if (stanceRef.current.kind !== 'stowed') { setToast('Stow first (hold R): stowed hands use the right tool.'); return }
    if (!toolsRef.current.prospecting) { setToast('You have no Prospecting focus.'); return }
    const v = mineCheck(c.kind, c.id); if (!v.ok) { setToast(v.why); return }
    stopChannel()
    const w = beginWork('crystal', c.id, () => { const p = minePlan(c.kind); return { drops: p.drops, extra: p } }, CRYSTAL_TIER[c.kind], manaFor(toolsRef.current.prospecting, CRYSTAL_TIER[c.kind], MINE_COST))
    chanRef.current = { w, node: 'crystal', c, nextAt: 0, waiting: false, got: {} }
  }, [zone.kind, stopChannel])
  /** one frame of the channel (called from onTick): let go when it should, else land the next chip when its beat comes */
  const stepChannel = useCallback((px: number, pz: number) => {
    const ch = chanRef.current; if (!ch) return
    const at = ch.node === 'tree' ? ch.t : ch.c
    if (zoneRef0.current !== 'wilds') { stopChannel(); return }
    if (stanceRef.current.kind !== 'stowed') { stopChannel(`Let go of the ${chanName(ch)}: your hands are full.`); return }
    if (Math.hypot(at.x - px, at.z - pz) > HOLD_RANGE) { stopChannel(`Too far. The ${chanName(ch)} keeps what is done.`); return }
    if (frozen.current) return
    focusRef.current = ch.node === 'tree'
      ? { ...focusRef.current, node: 'tree', x: ch.t.x, y: ch.t.y + 1.5, z: ch.t.z }
      : { ...focusRef.current, node: 'crystal', x: ch.c.x, y: crystalCentre(ch.c) + 0.75 * ch.c.s + 0.35, z: ch.c.z }
    const fx = ch.node === 'tree' ? fxRef.current : cFxRef.current
    const now = performance.now()
    if (!fx || fx.busy() || now < ch.nextAt) return
    const m = manaRef.current
    if (m.cur < ch.w.manaPerChip) { if (!ch.waiting) { ch.waiting = true; setToast('Out of mana. It comes back on its own, and the work goes on.') } return }
    ch.waiting = false; m.cur -= ch.w.manaPerChip
    const chip = takeChip(ch.w), gap = chipGapMs(toolsRef.current[ch.node === 'tree' ? 'forestry' : 'prospecting']?.speedBonus)
    focusRef.current.pulseAt = now
    ch.nextAt = Infinity   // the next beat is set when this chip lands
    const land = (): ChipStack[] => {
      let inv = getInv(), full = false
      for (const d of chip.drops) { const g = give(inv, d.id, d.n); inv = g.inv; if (g.left) full = true; ch.got[d.id] = (ch.got[d.id] ?? 0) + d.n - g.left }
      setInv(inv)
      ch.nextAt = performance.now() + gap
      if (chip.last) {
        const r = ch.node === 'tree' ? pruneCommit(ch.t.kind, ch.t.id) : mineCommit(ch.c.kind, ch.c.id)
        const skill = ch.node === 'tree' ? 'Forestry' : 'Prospecting', sk = ch.node === 'tree' ? 'forestry' : 'prospecting'
        // M17: the focus's xpBonus on top of the node's XP, and the node wears it one use (worn out = the worn starter back)
        const extraXp = bonusXp(toolsRef.current[sk], r.xp); if (extraXp > 0) { const up2 = addOpenXp(sk, extraXp); if (up2 && !r.levelUp) r.levelUp = up2 }
        r.xp += extraXp
        const wore = wearFocus(toolsRef.current, sk); toolsRef.current = wore.tools; saveTools(wore.tools)
        if (wore.broke) hudSay(`Your ${wore.broke} wore out. The worn one is back in hand.`, 'item', 6)
        const names = Object.entries(ch.got).filter(([, n]) => n > 0).map(([id, n]) => `${n > 1 ? n + ' × ' : ''}${itemDef(id).name}`)
        const ex = ch.w.extra as { found?: string; perk?: string } | string | undefined
        const perk = typeof ex === 'string' ? ex : ex?.perk
        const egg = ch.node === 'crystal' && ch.c.kind === 'egg' && typeof ex === 'object' && ex?.found ? `It was ${CRYSTAL_NAME[ex.found as keyof typeof CRYSTAL_NAME].toLowerCase().replace(' crystal', '')}! ` : ''
        setToast(`${egg}${perk ? `${perk}! ` : ''}${names.join(' · ')} · +${r.xp} ${skill}${r.levelUp ? `. ${skill} ${r.levelUp}!` : ''}${full ? ' (bag full)' : ''}`)
        if (chanRef.current === ch) stopChannel()
      } else if (full) { if (chanRef.current === ch) stopChannel('Your bag is full. The node keeps the rest.') }
      return chip.drops
    }
    if (ch.node === 'tree') { fxRef.current!.start(ch.t, land, () => {}); startShake(ch.t.id) }
    else cFxRef.current!.start(ch.c, () => { const d = land(); const ex = ch.w.extra as { found: Exclude<CrystalKind, 'egg'> }; return { found: ex.found, n: Math.max(1, d.find(x => x.id === CRYSTAL_ITEM[ex.found])?.n ?? 1) } }, () => {})
  }, [stopChannel])
  /** stowed hands work whichever node is nearer under the crosshair: a tree or a crystal */
  const workAimed = useCallback(() => {
    if (cAimRef.current.crystal && cAimRef.current.dist < aimRef.current.dist) mineAimed(); else pruneAimed()
  }, [mineAimed, pruneAimed])
  const crystalPrompt = () => {
    const c = cAimRef.current.crystal
    if (!c || zone.kind !== 'wilds') return null
    if (stanceRef.current.kind !== 'stowed') return `${CRYSTAL_NAME[c.kind]} · hold R to stow, then click to prospect`
    const v = mineCheck(c.kind, c.id)
    const ch = chanRef.current, w = workOf(c.id)
    if (ch?.w.id === c.id) return `Working the ${CRYSTAL_NAME[c.kind]} · ${ch.w.done} / ${ch.w.chips.length} · E to let go`
    return v.ok ? (w ? `Click or E · keep working the ${CRYSTAL_NAME[c.kind]} (${w.done} / ${w.chips.length})` : `Click or E · prospect the ${CRYSTAL_NAME[c.kind]} (${manaFor(toolsRef.current.prospecting, CRYSTAL_TIER[c.kind], MINE_COST)} mana)`) : v.why
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
  // EAT (the cooking room, 11-17): a held roast, clicked, heals mid-fight. Refuses where it would be wasted: off the Wilds
  // (nothing hurts you there), at full health, or while down. One meal per click.
  const eatHeld = useCallback(() => {
    const id = heldRef.current
    if (!isDish(id)) return
    if (zoneRef0.current !== 'wilds') { hudSay('Save it for the Wilds. A meal heals you mid-fight.', 'info'); return }
    const v = vitalsRef.current
    if (v.hp <= 0) return
    if (v.hp >= v.hpMax) { hudSay('You are whole. Keep it for a fight.', 'info'); return }
    const out = take(getInv(), id, 1); if (!out) return
    setInv(out); eatQueue.current.push(healOf(id)); hudSay(`${itemDef(id).name} · +${healOf(id)}`, 'item')
  }, [])
  // DRINK (the alchemy room, 11-17): a held potion, clicked, anywhere: a tonic refills mana (refused at a full bar), a buff
  // potion starts or refreshes its clock (ather/alchemy.ts).
  const drinkHeld = useCallback(() => {
    const id = heldRef.current
    if (!isPotion(id)) return
    const d = drink(id, manaRef.current, buffsRef.current)
    if (!d.ok) { if (d.why) hudSay(d.why, 'info'); return }
    const out = take(getInv(), id, 1); if (!out) return
    setInv(out)
    if (d.mana !== undefined) manaRef.current.cur = d.mana
    if (d.buffs !== buffsRef.current) { buffsRef.current = d.buffs; saveBuffs(d.buffs) }
    hudSay(d.line, 'item')
  }, [])
  const castOrAnswer = useCallback(() => {
    const r = rinApi.current; if (!r || zone.kind !== 'wilds') return
    const v = r.view()
    if (v.phase === 'waiting' || v.phase === 'rising' || v.phase === 'taking') { r.answer(); return }   // a click off the take costs nothing
    if (v.phase !== 'idle' && v.phase !== 'landed' && v.phase !== 'gone') return
    if (!toolsRef.current.rinning) { setToast(noStickLine(rinQuestRef.current)); return }   // M22: the first one is earned
    if (!v.aim) { setToast('Aim at open water to cast.'); return }
    const spent = take(getInv(), BAIT, 1)
    if (!spent) { setToast(NO_BAIT_LINE); return }
    if (r.cast()) { setInv(spent); if (!countOf(spent, BAIT)) setToast(NO_BAIT_LINE) }   // the last bait: say where more comes from
  }, [zone.kind])
  const onCatch = useCallback((rn: Rinn) => {
    const perk = perkBonus('rinning')   // Truesight (Embermole / Prismstrike): a second of the same rinn
    const g = give(getInv(), rn.id, perk ? 2 : 1); setInv(g.inv)
    const xp = xpOf(toolsRef.current.rinning, rn.xp), up = addOpenXp('rinning', xp)
    const worn = wearRinstick(toolsRef.current); toolsRef.current = worn.tools; saveTools(worn.tools)   // a landed rinn wears the rinstick
    setToast(`${perk ? `${perk}! 2 × ` : ''}${rn.name}${g.left ? ' (bag full)' : ''} · +${xp} Rinning${up ? `. Rinning ${up}!` : ''}${worn.broke ? `. Your ${worn.broke} wore out. The worn one is back in hand.` : ''}`)
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
    const ch = chanRef.current, w = workOf(t.id)
    if (ch?.w.id === t.id) return `Working the ${TREE_NAME[t.kind]} · ${ch.w.done} / ${ch.w.chips.length} · E to let go`
    return c.ok ? (w ? `Click or E · keep working the ${TREE_NAME[t.kind]} (${w.done} / ${w.chips.length})` : `Click or E · prune the ${TREE_NAME[t.kind]} (${manaFor(toolsRef.current.forestry, TREE_TIER[t.kind], MANA_COST)} mana)`) : c.why
  }
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button !== 0) return
      reelHold.current = true
      if (!locked.current || frozen.current) return
      if (held === 'waymark') plantHere()
      else if (held === BAIT) castOrAnswer()
      else if (isDish(held)) eatHeld()
      else if (isPotion(held)) drinkHeld()
      else if (stanceRef.current.kind === 'stowed') workAimed()   // stowed: the click works the node in front of you
    }
    const up = (e: MouseEvent) => { if (e.button === 0) reelHold.current = false }
    window.addEventListener('mousedown', down); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up) }
  }, [held, plantHere, workAimed, castOrAnswer, eatHeld, drinkHeld])
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
  // PHONE: with a roast or a potion in hand, the FIRE button eats / drinks it (one per press).
  useEffect(() => {
    if (!isTouch || !(isDish(held) || isPotion(held))) return
    let was = touch.fire
    const id = setInterval(() => { const f = touch.fire; if (f === was) return; was = f; if (f && !frozen.current) (isDish(held) ? eatHeld : drinkHeld)() }, 30)
    return () => clearInterval(id)
  }, [isTouch, held, eatHeld, drinkHeld])
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
      ? [{ x: GATE.x, z: GATE.z, color: '#e7c766', title: 'the gate' }]
      : [
          // ★ NO NODE MARKS (Alex 11-18: "the nodes really dont even need to be on the map.. as long as the section gets an
          // infected theme its up to the player to track the champion"). Greg's waymark, settlements, the fair, your waymarks:
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
  // ── the keeper's hands (open/shared/open-hands.tsx): stepped from the walker's onTick, after the camera moved ─────────
  const zoneRef = useRef(zone.kind); zoneRef.current = zone.kind; zoneRef0.current = zone.kind
  // Q / X + mana refill + the cast chips: ONE shared hook (shared/use-casts.ts), the same on the continent
  const { castSlot, gate: castGate, gateStep, closeGate, channel: castChannel, castQueue, castHud, surge, impulse, handsCastAt } = useCasts({ manaRef, vitalsRef, fightHere: () => zoneRef.current === 'wilds', flow: () => (buffOn(buffsRef.current, 'ather_flow') ? OPEN_FLOW_MULT : 1), gateHere: () => true })
  gateStepRef.current = gateStep
  useEffect(() => { closeGate() }, [zone.kind, closeGate])   // a Gate never leaves the zone
  const onCast = useCallback((sp: CastSpec, hit: CastHit | null) => {
    if (!hit) return
    const n = hit.hit
    hudSay(sp.archetype === 'restore' ? `${sp.label} · +${sp.heal}` : sp.archetype === 'infusion' ? `${sp.label} · the gun hits harder` : sp.archetype === 'field' || sp.archetype === 'terrain' ? `${sp.label} · set down` : n ? `${sp.label} · ${n} held` : `${sp.label} · nothing caught`, 'item')
  }, [])
  const [given, setGiven] = useState(false)
  useEffect(() => setGiven(gemsGiven()), [])
  const errandStage = stageOf(birth, inv, loadoutNow, given)
  const errandToHold = errandStage === 'smith' || errandStage === 'temple'   // M32 trail: the next step is through Rune Hold
  // M32 trail (hub 11-19): the way on to the runesmith is continuous. On the plot it is the gate; in the Wilds it is the Glade's
  // waymark stone (both open the fold map, which then opens on Rune Hold for an errand keeper); on the continent, the door.
  const errandGate = useMemo(() => {
    if (zone.kind !== 'wilds') return { x: GATE.x, z: GATE.z, zone: 'ather' as const }
    if (!ww || !ww.byName.has(GREG_WAYMARK.tile)) return null
    const o = ww.offsetOf(GREG_WAYMARK.tile); return { x: GREG_WAYMARK.x + o.x, z: GREG_WAYMARK.z + o.z, zone: 'wilds' as const }
  }, [zone.kind, ww, wrev])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { postEntries('errand', errandEntries(errandStage, birth, { greg: { x: gregAt.x, z: gregAt.z }, gate: errandGate })) }, [errandStage, birth, errandGate])
  useMorelHints({ stage: errandStage, zone: zone.kind === 'plot' ? 'ather' : 'wilds', pos: () => poseRef.current,
    busy: () => frozen.current || (!!chudRef.current && performance.now() / 1000 - chudRef.current.hurtAt < 10) })   // a fight is not 'stuck'
  // BETA M6a/M6b: the rinning + prospecting pointers, struck once used (re-read on every pack change: a catch/cut lands in it)
  useEffect(() => {
    const k = openSkills(), used = (id: 'rinning' | 'prospecting') => k[id].level > 1 || k[id].xp > 0
    postEntries('skills', skillPointerEntries({ rinning: used('rinning'), prospecting: used('prospecting') }, hasStick(rinQuest)))
  }, [inv, rinQuest])
  const seat = birthSeat(birth)
  const gregErrand = {
    stage: errandStage, seatName: seat ? SEATS[seat].name : '', where: seat ? SEATS[seat].where : '', citadel: seat === 'enchant',
    onTake: () => {
      if (!birth || gemsGiven()) return
      const g = gregsGems(getInv(), birth)
      if (g.left) { hudSay('Your bag is full. Make room for the gems.', 'info'); return }
      setInv(g.inv); markGemsGiven(); setGiven(true)
      lightGlove()   // M32 (hub rule): any route that reaches the gems also lights the glove (empty seat only)
      hudSay(`Gregory's gems · cut your letter at the ${seat ? SEATS[seat].name : ''} runesmith`, 'item')
    },
  }
  // BETA M13: E at Greg is a conversation (greg-talk.ts): his line in a bubble, one screen per answer; the camera turns to him
  const talkStep = panel?.kind === 'talk' ? panel.step : -1
  const talkNode = useMemo(() => talkStep < 0 ? null : gregTalk(gregErrand, talkStep, {
    ground: () => setPanel({ kind: 'greg' }), bye: () => setPanel(null), goto: step => setPanel({ kind: 'talk', step }),
    tour: () => { setPanel(null); setStops(tourStops()); setTour({ i: 0, talk: false }) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [talkStep, errandStage, birth, given])
  const talkFocus = useRef<{ x: number; y: number; z: number } | null>(null)
  // M32 (Magii 944ad1d): Greg lights the starter glove with the birth's ruled word, only while its seat is empty
  function lightGlove() {
    const r = giveGloveWord(getLoadout(), birth); if (!r) return
    setLoadout(r.loadout); hudSay(`Gregory: ${GLOVE_GIVE}`, 'chat'); hudSay(`${r.name} · lit in your glove`, 'item')
  }
  const gl0 = gregLive.current   // M32: he may be standing anywhere on the Glade (tour); seated = his bench (M30)
  const gregHead = useMemo(() => zone.kind === 'plot'   // M32: on the plot he is only ever at the planning table (the tour's end)
    ? { x: TABLE_STOP.at.x, y: plotHeightAt(TABLE_STOP.at.x, TABLE_STOP.at.z) + 1.75, z: TABLE_STOP.at.z }
    : { x: gl0.x, y: (ww && ww.tileAtPoint(gl0.x, gl0.z) ? ww.heightAt(gl0.x, gl0.z) : 0) + (gl0.seated ? 1.55 : 1.75), z: gl0.z },
    [zone.kind, ww, hereTile, gl0.x, gl0.z, gl0.seated, panel, tour])   // eslint-disable-line react-hooks/exhaustive-deps
  // BETA M32: a tour stop's talk (lines are @lark placeholders, greg-tour.ts). Skip at every stop; the last one ends it, and a
  // keeper still on the first errand goes straight into his send-off (the gems), where he stands.
  // The Glade stops, then the keeper's own planning TABLE (Magii: Greg visits the plot for it, then goes home). A skip at a Glade
  // stop jumps to the table (the tour's END: the glove word, then the gems for a keeper still on the first errand).
  const [stops, setStops] = useState(() => tourStops())   // re-read at each tour start (who of the five is home)
  const tableIdx = stops.findIndex(x => x.zone === 'plot')
  const [tableVisit, setTableVisit] = useState(false)     // Greg standing at the keeper's table (plot), until his talk ends
  const endTour = useCallback(() => {
    setTour(null); lightGlove()
    if (errandStage === 'greg') setPanel({ kind: 'talk', step: 0 })
  }, [errandStage, birth])   // eslint-disable-line react-hooks/exhaustive-deps
  const tourNode = useMemo<TalkNode | null>(() => {
    if (!tour?.talk) return null
    if (tour.i >= tableIdx) return { line: stops[tour.i].line, options: [{ label: TOUR_DONE, pick: endTour }] }
    return { line: stops[tour.i].line, options: [{ label: TOUR_NEXT, pick: () => setTour({ i: tour.i + 1, talk: false }) }, { label: TOUR_SKIP, pick: () => setTour({ i: tableIdx, talk: false }) }] }
  }, [tour, stops, tableIdx, endTour])
  const onTourArrive = useCallback((i: number) => setTour(t => t && t.i === i ? { i, talk: true } : t), [])
  // to the table: the fade home, set down facing Greg; on the plot his talk opens at once (he is already there)
  useEffect(() => {
    if (!tour || tour.i !== tableIdx) return
    if (zone.kind === 'wilds' && !tour.talk) {
      const k = TABLE_KEEPER, g = TABLE_STOP.at
      setTableVisit(true); arrive({ kind: 'plot' }, { x: k.x, z: k.z, yaw: Math.atan2(-(g.x - k.x), -(g.z - k.z)) })   // walker: forward = (-sin, -cos)
    } else if (zone.kind === 'plot' && !tour.talk) setTour({ i: tour.i, talk: true })
  }, [tour, tableIdx, zone.kind, arrive])
  // the tour lives in the Wilds and at the table; anywhere else ends it. Greg leaves the table once his talk is over.
  useEffect(() => { if (tourRef.current && zone.kind === 'plot' && tourRef.current.i !== tableIdx) setTour(null) }, [zone.kind, tableIdx])
  useEffect(() => { if (!tour && panel?.kind !== 'talk' && panel?.kind !== 'greg') setTableVisit(false) }, [tour, panel])
  // BETA M13: E in a settlement talks to ONE Moglin (folk-talk.ts); the settlement's heart is its anchor (no Moglin models are drawn yet)
  const folkTalk = useFolkTalk(panel?.kind === 'folk' ? panel.s : null, useCallback((x: number, z: number) => ww && ww.tileAtPoint(x, z) ? ww.heightAt(x, z) : 0, [ww]), () => setPanel(null))
  // BETA M22: Fennel at the Rinnshop while the first-rinstick quest is open (fennel.tsx, use-rinquest.ts › fennelTalk)
  const fennelAt = useMemo(() => (fennelHere(rinQuest) ? fennelSpot(works) : null), [rinQuest, works])
  const fennelRef = useRef(fennelAt); fennelRef.current = fennelAt
  const fennelHead = useMemo(() => (fennelAt ? { x: fennelAt.x, y: plotHeightAt(fennelAt.x, fennelAt.z) + FENNEL_HEAD, z: fennelAt.z } : null), [fennelAt])
  const fennelNode = panel?.kind === 'fennel' ? fennelTalk(rinQuest, panel.page, inv, { goto: page => setPanel({ kind: 'fennel', page }), close: () => setPanel(null) }) : null
  useEffect(() => { const m = tour && tourNode ? stops[tour.i]?.meets : undefined; if (m) markMet(m) }, [tour, tourNode, stops])   // BETA M33: Greg's introduction = met
  useEffect(() => { talkFocus.current = talkNode ? gregHead : tourNode && tour ? (() => { const L = stops[tour.i].look, ly = (stops[tour.i].zone === 'plot' ? plotHeightAt(L.x, L.z) : ww && ww.tileAtPoint(L.x, L.z) ? ww.heightAt(L.x, L.z) : 0) + 1.0
    // M32: between what he shows and his head (his side heavier: his bubble must stay on screen), so a phone frames both (aimed at the station alone, his bubble left the screen)
    return { x: L.x * 0.4 + gregHead.x * 0.6, y: ly * 0.4 + (gregHead.y + 0.6) * 0.6, z: L.z * 0.4 + gregHead.z * 0.6 } })() : fennelNode && fennelHead ? fennelHead : folkTalk.focus }, [talkNode, gregHead, tourNode, tour, stops, ww, fennelNode, fennelHead, folkTalk.focus])
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
      if (e.code === 'Escape' && tourRef.current) { setTour(null); return }   // M32: Esc skips Greg's tour, walking or talking
      if (e.code === 'Tab' && panel?.kind === 'map') { e.preventDefault(); setPanel({ ...panel, view: panel.view === 'ather' ? 'athernyx' : 'ather' }); return }
      if (e.code === 'KeyM') { setPanel(p => p ? null : { kind: 'map', view: 'ather', travel: false }); return }
      // third person is a TEST VIEW, not part of the game (Alex 11-18: "the game is meant to be played in 1st person"): only
      // under ?tune=1, to check the doll other keepers will see. Driving / emote pull-backs are their own thing, later.
      if (e.code === 'KeyV' && tune) { thirdRef.current = !thirdRef.current; hudSay(thirdRef.current ? 'Test view: third person · V back' : 'First person', 'info'); return }
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
        if (n.kind === 'greg') setPanel({ kind: 'talk', step: 0 })
        else if (n.kind === 'fennel') setPanel({ kind: 'fennel', page: 0 })
        else if (n.kind === 'work') { if (n.near.kind !== 'raising') setPanel({ kind: 'work', near: n.near }) }
        else if (n.kind === 'folk') setPanel({ kind: 'folk', s: n.s })
        else setPanel({ kind: 'map', view: errandToHold ? 'athernyx' : 'ather', travel: true })   // M32 trail: an errand keeper's map opens on Rune Hold
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
  }, [panel, fade, zone, waymarks, ww, goHome, tune, skipDays, allNodes, plantHere, castSlot, errandToHold])

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
      { code: 'KeyR', key: 'R', label: stance.kind === 'weapon' ? 'swap · reload' : 'draw', near: true },
      { code: 'KeyH', key: 'H', label: 'home' },
    ] : []),
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bcd6e6' }}>
      <Canvas
        camera={{ fov: 75, near: 0.05, far: 900, position: [THRESHOLD.x, 3, THRESHOLD.z] }}
        onClick={(e) => { if (!panel && !isTouch && !isBuilding()) (e.target as HTMLCanvasElement).requestPointerLock?.() }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { canvasEl.current = gl.domElement }}
      >
        <OpenHands ref={handsApi} />
        <FpGun ref={gunApi} />
        <ThirdPersonBody drive={dollDrive} camRef={camRef} />
        {zone.kind === 'plot' && <BuildPointer />}
        <VoxelDayNight gloomAt={zone.kind === 'wilds' && ww ? (x, z) => ww.canopyAt(x, z) * 0.7 : undefined} />
        {zone.kind === 'plot' && <PlotScene owned={owned} pages={garden.pages} linked={cl.frame.linked} />}
        {zone.kind === 'plot' && <WorkshopScene pose={poseRef} owned={owned} />}
        {zone.kind === 'plot' && <ClusterScene frame={cl.frame} />}
        {zone.kind === 'wilds' && <RemoteKeepers peers={mp.peers} me={() => poseRef.current} />}
        {zone.kind === 'plot' && cover !== 'none' && <GroundCover cover={cover} ground={ground} skip={coverSkip} focus={poseRef} />}
        {zone.kind === 'wilds' && ww && <ForestryFX ww={ww} aim={aimRef} fx={fxRef} ground={ground} />}
        {zone.kind === 'wilds' && <ChannelFocus focus={focusRef} />}
        {zone.kind === 'wilds' && ww && <ProspectingFX ww={ww} aim={cAimRef} fx={cFxRef} ground={ground} mineable={c => mineCheck(c.kind, c.id).ok} />}
        {zone.kind === 'wilds' && ww && <RinningFX ease={easeOf(toolsRef.current.rinning)} waterY={WILDS_WATER_Y} isWater={rinWaterAt} roll={rinRoll} rarer={rinRarer} api={rinApi} holding={reelHold} out={held === BAIT && !!toolsRef.current.rinning} onCatch={onCatch} onGone={onGone} />}
        {zone.kind === 'wilds' && ww && [...ww.loaded].map(([name, T]) => { const t = ww.byName.get(name)!; return <group key={name} position={[t.tx * TILE_M, 0, t.ty * TILE_M]}><WildsScene W={T} waymarks={waymarks} focus={poseRef} off={{ x: t.tx * TILE_M, z: t.ty * TILE_M }} />{net && <TilePaths net={net} W={T} off={{ x: t.tx * TILE_M, z: t.ty * TILE_M }} />}</group> })}
        {ww && <DeathPack active={zone.kind === 'wilds'} />}
        {zone.kind === 'wilds' && ww && <><MoonwellPool ground={ground} stowed={() => stanceRef.current.kind === 'stowed'} /><CloudReefs layout={reefLayout} /><CloudDeck squares={deckLayout} size={TILE_M} y={WILDS_WATER_Y - 0.1} /><HorizonRing y={WILDS_WATER_Y} /></>}   {/* M24: the sea turns to cloud past the map */}
        {zone.kind === 'wilds' && ww && <GladeGreg loaded={(x, z) => ww.tileAtPoint(x, z) ? ww.heightAt(x, z) : null} tour={tour} hold={panel?.kind === 'talk' || panel?.kind === 'greg'} keeper={poseRef} onArrive={onTourArrive} live={gregLive} />}
        {zone.kind === 'wilds' && ww && net && <Settlements net={net} loaded={(x, z) => ww.tileAtPoint(x, z) ? ww.heightAt(x, z) : null} />}
        {zone.kind === 'wilds' && ww && net?.fair && ww.tileAtPoint(net.fair.x, net.fair.z) && <BigTop fair={net.fair} y={ww.heightAt(net.fair.x, net.fair.z)} />}
        {terrain && (
          <CombatLayer T={terrain} locked={locked} frozen={frozen} active={zone.kind === 'wilds' && fade === 0}
            safe={{ x: GREG_WAYMARK.x, z: GREG_WAYMARK.z, r: 30 }} onEvents={onCombat} onHud={onCombatHud} reviveKey={reviveKey} armed={stance.kind === 'weapon' && !!held} gunId={stance.kind === 'weapon' ? held : null} reloadTick={reloadTick} nodes={nearNodes} ownerOf={nodeOwner} casts={castQueue} onCast={onCast} eats={eatQueue} sight={sightRef} channel={castChannel} />
        )}
        {folkTalk.node && folkTalk.bubbleAt && zone.kind === 'wilds' && <TalkBubble at={folkTalk.bubbleAt} name={folkTalk.name} line={folkTalk.node.line} />}
        {zone.kind === 'plot' && tableVisit && (() => { const g = TABLE_STOP.at, p = poseRef.current; return (
          <group position={[g.x, plotHeightAt(g.x, g.z), g.z]} rotation-y={Math.atan2(p.x - g.x, p.z - g.z)}><FolkModel look={folkLook('gregory')} action={tourNode || talkNode ? 'talk' : 'idle'} /></group>) })()}
        {(talkNode ?? tourNode) && (zone.kind === 'wilds' || tableVisit) && <TalkBubble at={[gregHead.x, gregHead.y + 0.95, gregHead.z]} name="Gregory" line={(talkNode ?? tourNode)!.line} />}
        {zone.kind === 'plot' && fennelAt && <Fennel spot={fennelAt} y={plotHeightAt(fennelAt.x, fennelAt.z)} talking={!!fennelNode} />}
        {fennelNode && fennelHead && zone.kind === 'plot' && <TalkBubble at={[fennelHead.x, fennelHead.y + 0.5, fennelHead.z]} name={FENNEL_NAME} line={fennelNode.line} />}
        <QuestGuide zone={zone.kind === 'plot' ? 'ather' : 'wilds'} ground={ground} />
        {world && fade === 0 && <CompanionFollower pose={poseRef} ground={ground} />}
        <GateRings gate={castGate} />
        {world && (
          <Walker
            key={epoch} world={world} ground={ground} spawn={spawn} locked={locked} frozen={frozen} focus={talkFocus}
            fallY={zone.kind === 'plot' ? FALL_Y : -60}
            onFall={goHome}
            onTick={onTick}
          />
        )}
      </Canvas>
      {!building && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, margin: -2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />}
      <GameHud size={hudSize} pose={poseRef} marks={marksRef} vitals={vitalsRef} mana={manaRef} entries={hotbar} sel={litSlot(stance, inv)} onSelect={i => setStance(st => selectSlot(st, i, getInv()))} onEquip={i => setStance(st => equipSlot(st, i, getInv()))} tools={toolsRef} skills={skillsRef} casts={castHud}
        // never dimmed in the Ather (Alex 11-17: 'the hotbar stays greyed out and doesnt highlight'): the plot uses the bar now
        // (Keepstones, furniture, bait), and HearthHotbar drops the selected slot's light while dimmed (selected = i === sel && !dimmed)
        dimmed={false} input={!panel && !fade && !optionsOpen && !building}
        minimap={ww && <AtherMiniMap size={hudSize} zone={zone.kind} world={ww} wrev={wrev} fog={fog} tileOff={tileOff} pose={poseRef} waymarks={waymarks} regionsByTile={regionsByTile} cluster={cl.frame}
          owned={owned} onExpand={() => setPanel({ kind: 'map', view: 'ather', travel: false })} />}
        status={[
          { label: hud.where },
          ...(zone.kind === 'wilds' && chud ? [{ label: chud.gun.charAt(0) + chud.gun.slice(1).toLowerCase(), value: chud.reloading ? 'reloading' : `${chud.ammo} / ${chud.clip}` }] : []),
          { label: 'Grey matter', value: garden.grey, accent: true },
          { label: 'Grimoire', value: garden.pages },
          ...(tune && spread ? [{ label: `Tune · day ${Math.floor((clock() - spread.epoch) / GAME_DAY_MS)}`, value: `${allNodes.length - spread.clean.length}/${allNodes.length} grey · [ clear all · ] +1d · ⇧] +5d`, accent: true }] : []),
        ]} />
      <ScopeRing />
      {zone.kind === 'wilds' && chud && <MorelBubble feed={chudRef} />}
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
      {prompt && !panel && !building && (
        <div style={{ position: 'absolute', left: '50%', top: '58%', transform: 'translateX(-50%)', padding: '6px 12px', borderRadius: 6, background: 'rgba(12,16,20,0.65)', color: '#f4efe2', font: '13px system-ui', pointerEvents: 'none' }}>{prompt}</div>
      )}
      {panel?.kind === 'map' && (
        <FoldMap view={panel.view} travel={panel.travel} W={W} fog={fog} waymarks={waymarks} here={{ x: pos.current.x - hereOff.x, z: pos.current.z - hereOff.z }}
          inWilds={zone.kind === 'wilds'} onTravel={travel} tile={hereTile} pitstops={pitstops}
          nodes={(nodesByTile.get(hereTile) ?? []).filter(n => infectedSet.has(n.id)).map(n => ({ ...n, x: n.x - hereOff.x, z: n.z - hereOff.z }))} regions={regions}
          area={ww ? { world: ww, regionsByTile, cx: hereOff.x, cz: hereOff.z, tileOff, nodes: nodes.filter(n => Math.abs(n.x - hereOff.x) < 1600 && Math.abs(n.z - hereOff.z) < 1600), here: { x: pos.current.x, z: pos.current.z } } : undefined}
          onClose={() => setPanel(null)} goal={errandToHold ? LANDING.id : undefined} onFlip={() => setPanel(p => p?.kind === 'map' ? { ...p, view: p.view === 'ather' ? 'athernyx' : 'ather' } : p)} />
      )}
      {folkTalk.node && <TalkChoices node={folkTalk.node} phone={hudSize === 'phone'} />}
      {(talkNode ?? fennelNode ?? tourNode) && <TalkChoices node={(talkNode ?? fennelNode ?? tourNode)!} phone={hudSize === 'phone'} />}
      {panel?.kind === 'greg' && <GregPanel garden={garden} onBuy={buy} onClose={() => setPanel(null)} />}
      {panel?.kind === 'cluster' && <ClusterPanel c={cl} onClose={() => setPanel(null)} />}
      {panel?.kind === 'work' && <WorkshopPanel near={panel.near} owned={owned} onClose={() => setPanel(null)} />}
      {zone.kind === 'plot' && <PlacingBar owned={owned} />}
      {zone.kind === 'plot' && <BuildBar owned={owned} />}
      <LookChip />
      {zone.kind === 'wilds' && held === BAIT && <ReelBar api={rinApi} />}
      {optionsOpen && <OpenOptions onClose={() => setOptionsOpen(false)} inGarden={zone.kind === 'plot'} />}
      <OpenSocial />   {/* M27: presence + invites + the Play together panel */}
      <BirthGate />
      {panel?.kind === 'pack' && <PackMenu tab={panel.tab} onTab={t => setPanel({ kind: 'pack', tab: t })} onClose={() => setPanel(null)} sel={litSlot(stance, inv)} isTouch={isTouch} />}
      <div style={{ position: 'absolute', inset: 0, background: '#f6f1e4', opacity: fade, transition: 'opacity 0.35s', pointerEvents: 'none' }} />
      {isTouch && !panel && !building && (
        <TouchControls showFire={zone.kind === 'wilds'} actions={touchActions} />
      )}
      {isTouch && !introSeen && !panel && !building && (
        <div onPointerDown={() => setIntroSeen(true)} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 16, zIndex: 30, background: 'rgba(5,6,14,0.35)' }}>
          <div style={{ padding: '18px 20px', borderRadius: 10, background: 'rgba(12,16,20,0.82)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.6, textAlign: 'center', maxWidth: 420 }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Ather · your plot and the Wilds</div>
            Left thumb moves. Drag on the right to look.<br />Buttons for jump, slide, and whatever is in reach.
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
              The gate ahead is the fold map: travel to the Wilds, your waymarks, or out through a city's door. Gregory, at Moonwell Glade in the Wilds, sells the ground under the mist. In the Wilds the Hollows wander: hold fire to shoot.
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
              The gate ahead is the fold map: travel to the Wilds, your waymarks, or out through a city's door in Athernyx. Gregory, at Moonwell Glade in the Wilds, sells the ground under the mist. In the Wilds the Hollows wander: R draws the Repeater (tap again to reload, hold R to put it away), click to shoot, walk over grey matter to take it. Hands free, click a tree to prune it. F plants a waymark, H walks home, I opens your bag.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const panelBtn: React.CSSProperties = { padding: '12px 20px', borderRadius: 8, border: '1px solid rgba(244,239,226,0.4)', background: 'rgba(12,16,20,0.8)', color: '#f4efe2', font: '600 13px system-ui', letterSpacing: '0.12em', textTransform: 'uppercase', touchAction: 'manipulation' }
