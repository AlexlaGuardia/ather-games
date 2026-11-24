'use client'

// /shimmer/open/ather — THE ATHER SIDE of the open world (Alex 11-14, Jin/world).
//
//   · THE HOME PLOT — a full-size floating island cut into a 9×9 garden grid. The corner 3×3 by the gate is yours; the rest is
//     under fold-mist until you buy it from GREGORY with grey matter, ring by ring as the grimoire fills (plot.ts).
//     ONE GATE: its face is the fold map. The Ather side shows the Wilds you have walked and your waymarks; Tab flips
//     to Athernyx, where the gate steps you out to a place on the continent. Walk off the edge and the fold brings
//     you back to the threshold.
//   · THE WILDS — the continent's land in the Ather's state (world/ather.md 09-07), one 1 km tile cut from the same
//     height map the coursers drive. A held waymark plants where you stand (click / E); standing at one, E opens the fold map too.
//
// The Ather revamp (no holds, Hollows + grey matter, the grimoire's tiers) is Alex's direction, logged [OPEN] in
// CANON_GAPS for Magii; UI copy stays plain until it is authored. Desktop: pointer lock + keys. Phone (11-15): shared/
// touch-controls (stick, drag-look, jump/slide/fire, context taps that press the same keys this page handles).

import { OwnerReady } from '../shared/owner-ready'
import { LoadScreen } from '../shared/load-screen'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { subscribeVisit, currentVisit, isVisiting, startVisit, endVisit, noteVisit, shownOwned, plotZone, guestRefuses, snapMoglins, type PlotSnap } from './plot-visit'   // BETA M61
import { usePlotVisitNet } from './plot-visit-net'
import { usePartyBrew } from './party-brew-net'   // M57 s3b
import { BrewingPanel } from './brewing-panel'
import { FURNITURE } from './furniture'
import { AnemonyxIfHere, anemonyxPick, anemonyxHere, meetToday } from './anemonyx-view'   // M76 s2
import { useBook, getPots } from './spirit-panels'
import { seenCount } from './grimoire-book'
import type { AlcStation } from './alchemy-set'
import { useParty, storedParty } from '@/lib/party'
import { selfPlayerId } from '../../play3d/multiplayer'
import { clusterFrame } from './cluster'
import { setLobbyZone, setVisitHandler } from '../shared/play-together'
import { Canvas } from '@react-three/fiber'
import { ProgramKeeper } from './program-keeper-view'
import { WarmProxies } from './warm-proxies'
import { OpenHands, type OpenHandsApi } from '../shared/open-hands'
import { HeldRod } from '../shared/held-rod'   // M82 s2: the rinstick in the mitt
import { ACTIONS, oneShot } from '../shared/fp-actions'
import { FpGun, ScopeRing, fpGunAds, ADS_TIGHT, type FpGunApi } from '../shared/fp-gun'
import { RANGE_GUNS } from '../shared/gunplay'
import { ThirdPersonBody, dollAction, pullBack, newDrive } from '../shared/third-person'
import { Vector3, type Camera, type Scene, type WebGLRenderer } from 'three'
import { VoxelDayNight } from '../shared/day-night'
import { terrainWorld } from '../terrain-world'
import { withPieces } from './dynamic-solids'
import { wildsStructures, setWildsPartBoxes } from './obstacles'   // M117 s3: Hollows steer round buildings, shots stop on walls
import { GateRings } from '../shared/gate-rings'
import { Walker, verbOf, type Loco } from './walker'
import {
  plotShape, plotHeightAt, mistWalls, THRESHOLD, GATE, GREG, FALL_Y, REACH, squareAt, sqId, canBuy,
  loadGarden, saveGarden, freshGarden, type Garden,
} from './plot'
import { PlotScene } from './plot-scene'
import { HeldItem } from './held-item'
import { heldUse, placesFromHand, useLabel } from './held-use'
import { WorkshopScene, WorkshopPanel, PlacingBar, BuildBar, usePlacingKeys, isPlacing, holdFromHand, useWorks, workWalls, workPrompt, currentWorks, currentBank, setWorks } from './workshop'
import { bankCount } from './garden-bank'
import { currentFarm, setFarm, currentWater, setWater, farmNow } from './farm-room'
import { BuildPointer, stepBuildCam, useBuildMode, useBuildKeys, isBuilding, exitBuild } from './build-mode'
import { tick as villageTick, loadVillage, saveVillage } from './moglins'
import { workPickables, type WorkNear } from './rooms'
import { callNearest, withLifts } from './lift'
import { ClusterScene } from './cluster-scene'
import { cycleLook, LookChip } from './ground-look'
import { GroundCover, coverFromUrl } from './ground-cover'
import { coverClear } from './cover-clear'
import { useOpenMultiplayer, RemoteKeepers, OPEN_WILDS, openNet } from '../shared/open-mp'
import { OpenSocial } from '../shared/play-together'
import { ClusterPanel, useCluster } from './cluster-panel'
import { clusterGround, mateWalls, mateAt, inMiddle, onPath, onMeadow } from './cluster'
import { WildsScene } from './wilds-scene'
import { FoldMap, GregPanel, LANDING, type Dest } from './panels'
import { gregTalk } from './greg-talk'
import { tutStart, tutNode, grimoireGift, pedestalOwed, type TutCursor } from './glade-greg-talk'   // M68 s2 (+ M123 s1 pedestalOwed)
import { useSpiritsDev } from './spirit-model'   // M123: Greg's grimoire hand-over for a legacy keeper (every keeper since s2)
import { loadTut, saveTut, gift as tutGift, allHeard, tessPacket, type Tut, type Gift as TutGift } from './glade-tutorial'
import { gardenOpen, foldOffered, foldNode, buyPick, FOLD_TEXT, type FoldStep } from './garden-fold'   // M71 s1: Greg folds the first garden
import { friendStart, friendNode, FRIEND_NAME, GARDEN_FRIENDS, type FriendCursor, type GardenFriend } from './glade-friend-talk'   // M68 s3a
import { line as gladeLine } from './glade-tutorial-lines'
import { gregSpot, GLADE } from './moonwell-glade'   // M30 part 2: Greg lives at the Glade
import { GladeLots } from './glade-lots-view'
import { GladeCluster, gladeFolkDrawn } from './glade-cluster-view'   // M67 s1a: the closed Glade's keepers, Moglins, Greg's marker
import { GLADE_FRAME, GLADE_OWNED, GLADE_TILE, GLADE_ZONE_NAME, GLADE_GATE, gladeNewbornSpot, gladeWhere, gregInGlade, gladeKeepers } from './glade-cluster'   // M40: the green, the five's lots + stations, Greg's jetty
import { gladeLayerGround, gladeLift } from './glade-layer'
import { useGladeLayer, GladeWater } from './glade-layer-view'   // M83 s2b: the Glade's published builder layer
import { zoneParts, zonePartBoxes, withZoneParts, publishedZones } from './zone-parts'   // M84 s3: published zone builds (drawn + solid)
import { ZonePartsView } from './zone-parts-view'
import { zoneDoor, zoneUse, zonePrompt, zoneSay, homeTalk, type ZoneUse } from './zone-tags'   // M114 s2: a published zone's tag = one E point
import { ShopPanel } from '../business/shop-panel'   // M114 s2: a Shop zone opens its storefront's own panel
import { useLedger } from '../trade-ui'
import { loadSpot, saveSpot, clearSpot, makeSpot, resumeFrom } from './last-spot'   // where you were (a reload in the Wilds resumes there)
import { GladeGreg, type GregTourState, type GregLive } from './glade-greg'
import { biomeGround } from './hollow-goop'   // M34: what a Hollow's sheen borrows
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
import { loadIndex, makeWorld, stream, releaseTo, tileOf, zonesOf, TILE_M, WILDS_RELEASE_MS, type WildsWorld } from './wilds-world'
import { makeVoids, FALL_LIP, type VoidField } from './wilds-voids'
import { ensureEdits, voidEditsLive, zonesJsonLive } from './wilds-edits'   // M104: the void brush layer
import { startFall, stepFall, type FallState } from './void-fall'
import { loadNetwork, clearing, roadField, settlementAt, nearFair, fairDoor, FAIR_NAME, FAIR_DOOR_R, type Network, type Settlement } from './network'
import { useFolkTalk } from './use-folk-talk'
import { useSpiritTalk, type SpiritTalkState } from './spirit-talk'   // M109 s1: E at a garden spirit (owner + ?spirits=3d)
import { liveSpirits, setKeeperAt, followIds } from './spirit-follow'
import { inParty } from './spirit-party'   // M118 s1: party spirits walking with the keeper grow from her fights
import { fightExp } from './spirit-stats'
import { GROWTH, grownLine } from './spirit-growth'
import { speciesOf } from './seed-items'
import { SPECIES_NAMES } from '../../spirits/spirit'
import { useMeleeReady, lastSwingAt, lastSwingAction } from './melee-view'
import { reportAway } from './away-report'
import { folkOf } from './settlement-folk'   // M84 s3b: a Wilds Home zone's resident -> their settlement's talk
import { TilePaths, Settlements, BigTop, folkDrawn, stallDrawn, gleanerPost, FirstSettlement } from './network-scene'
import { SETTLERS, settlerAt, speakerOf, inSettlement, settlerStart, settlerNode, pickTarget, m70Down, m70Quest, M70_GIFT, SETTLEMENT, type SettlerId, type SettlerCursor } from './first-settlement'   // M70 s1
import { angelicaTalks, deskOpen, angelicaStart, angelicaNode, bottleToHand, brewed, sideQuest, M70SIDE_TEXT, ALC_SET_ITEMS, ANGELICA_DESK, type AngelicaCursor } from './m70-alchemist'   // M70 s3
import { AngelicaDeskPanel, sideItemName, haveOf } from './m70-desk-panel'   // M70 s3
import { GLEANER_POST, GLEANER_POST_R, BURR_CAMP, CAMP_LABEL } from './gleaner'   // M112 s2
import { aimPick, lookDir, type Pickable } from '../shared/aim-pick'
import { MOGLIN_HEIGHT } from '../shared/moglin-model'
import { canPlant, plant, lift, loadWaymarks, saveWaymarks, groundOf, canTravel, isLit, lastLit, GREG_WAYMARK, MAX_WAYMARKS, type Waymark, type PlantVerdict } from './waymarks'
import { loadFog, saveFog, reveal, type Fog } from './explored'
import { WildsSpirits, useSpiritFight } from './wilds-spirits'   // M127 s1
import { CombatLayer, type CombatHud, type SightLink } from './combat-layer'
import type { CombatEvent, Terrain } from './combat'
import { ownerOf, nodeRegions, GAME_DAY_MS, SUB, type WildsNode } from './nodes'
import { advance, clearAt, loadSpread, saveSpread, loadSkew, saveSkew, type SpreadState, type SpreadEvent } from './spread'
import { loadMap, saveMap, areaState, uncover, tend, firstLook, changes, growLine, clearLine, firstLine, type SpreadMap, type AreaState } from './spread-map'   // M70 s2
import { TouchControls, type TouchAction } from '../shared/touch-controls'
import { isTouchOnly, pressKey, touch } from '../shared/touch'
import { useMenuLock } from '../shared/menu-lock'
import { BirthGate, useBirthGateUp, BORN_EVENT } from '../birth-gate'
import { MorelBubble } from '../shared/morel-bubble'   // BETA M33: the glove's gem speaks (ammo)
import { markMet } from '../shared/met'
import { useMorelHints } from '../shared/morel-hints'   // BETA M33 S2: stuck hints on the errand
import { OpenOptions, useOptionsKeys, useOptionsOpen, setOptionsOpen } from '../options'
import { useInv, setInv, getInv, hotbarEntries } from '../shared/bag'
import { DeathPack, fallAndDrop, packLying } from './death-pack'
import { useOpeningChain, useChain, chainDeath, chainGateOpen, chainFlip } from '../shared/opening-chain-store'   // BETA M73: Ather to Nyx
import { flipPulse, runeHoldPulse } from '../shared/opening-chain'
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
import { useGladeFennel, FENNEL_FOLK_ID } from './glade-fennel-view'
import { IdleMoglins, idleDrawn, useIdleTalk } from './moglins-idle-view'   // P1 11-23
import type { IdleScreen } from './moglins-idle'   // M68 s3b: Fennel's talk in the Glade
import type { FennelCursor } from './glade-fennel-talk'
import { MoonwellPool } from './moonwell-quest'
import { frameStats } from '../shared/keeper-look'
import { getLook } from '../shared/look-store'
import { manaFor, bonusXp, wearFocus } from './focuses'
import { isPotion, drink, buffOn, loadBuffs, saveBuffs, BUFF_NAME, STARLIGHT_XP, WISDOM_XP, OPEN_FLOW_MULT, type Buffs, type BuffId } from './alchemy'
import { BAIT, rollRinn, type Rinn } from './rinning'
import { RinningFX, type RinningApi } from '../shared/rinning-fx'
import type { Reel } from '../shared/reel'
import { ReelBar } from '../shared/reel-bar'
import { play as sfx } from '../shared/sfx'
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
import { ECON, potionCdLeft, potionWaitLine, RELOAD_DRY_LINE } from '../shared/vitals-economy'
import { useSkinCharge, type SkinPool } from '../shared/use-skin-charge'
import { SKIN_HOLDS } from '../shared/touch-controls'
import { AtherMiniMap } from './minimap'
import type { SkinVitals } from '../../ui/hearth-hud'
const aimDirV = new Vector3()   // M60: the camera's forward, reused every frame


// M67 s1a: 'glade' = the closed tutorial cluster a newborn opens their eyes in (glade-cluster.ts); its one way out is the gate
type Zone = { kind: 'plot' } | { kind: 'wilds'; tile: string } | { kind: 'glade' }
type Spawn = { x: number; z: number; yaw: number }
/** the Wilds' safe ground round the arrival: where the Glade's green stood until M67 s1b-2 (30.75 m north of Greg's waymark) */
const WILDS_SAFE = { x: GREG_WAYMARK.x, z: GREG_WAYMARK.z - 30.75, r: 50 }
const gregAt = gregSpot()   // BETA M30 part 2: where Gregory sits (Moonwell Glade); the plot keeps only its old anchor numbers (plot.ts GREG)
type Panel = null | { kind: 'map'; view: 'ather' | 'athernyx'; travel: boolean } | { kind: 'greg' } | { kind: 'talk'; step: number } | { kind: 'pack'; tab: PackTab } | { kind: 'cluster' } | { kind: 'work'; near: WorkNear } | { kind: 'folk'; s: Settlement } | { kind: 'fennel'; page: number } | { kind: 'brew'; station: AlcStation } | { kind: 'friend'; c: FriendCursor } | { kind: 'gfennel'; c: FennelCursor } | { kind: 'idlemog'; c: { id: string; screen: IdleScreen } } | { kind: 'spirit'; c: SpiritTalkState } | { kind: 'shop'; id: string } | { kind: 'settler'; c: SettlerCursor | AngelicaCursor } | { kind: 'adesk' }
type Near = null | { kind: 'gate' } | { kind: 'greg' } | { kind: 'friend'; f: GardenFriend } | { kind: 'fennel' } | { kind: 'gfennel' } | { kind: 'idlemog'; id: string; name: string } | { kind: 'anemonyx' } | { kind: 'work'; near: WorkNear } | { kind: 'waymark'; w: Waymark; own: boolean } | { kind: 'folk'; s: Settlement } | { kind: 'spirit'; id: string; name: string } | { kind: 'zone'; u: ZoneUse } | { kind: 'settler'; id: SettlerId; name: string } | { kind: 'adesk' }

// ★ held until the save owner is known (shared/owner-ready.tsx: the 11-18 'rooms vanished on refresh' fix)
/** M61: a mate's island alone on the Green (the frame nobody is linked into) */
const SOLO_FRAME = clusterFrame(null, [])
const GLADE_FRIENDS_AT = gladeKeepers().filter((k): k is typeof k & { id: GardenFriend } => (GARDEN_FRIENDS as readonly string[]).includes(k.id))   // M68 s3a: Otto, Tess, Bonn
/** M70 s3: may Angelica talk / does her Desk work now (re-read with the journal, every 3 s and after a talk) */
const m70sideNow = { angelica: false, desk: false }
const VISIT_WAIT_MS = 45_000   // M61 s3: a backstop for a socket that never relays; the real give-up counts asks (plot-visit GIVE_UP_ASKS)
/** M61: who you are visiting, and the way home (game-UI rule: text on a plate, never raw on the scene) */
function VisitPill({ name, ready, onHome }: { name: string; ready: boolean; onHome: () => void }) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[30] pointer-events-auto flex items-center gap-2 px-3 py-1 rounded-lg"
      style={{ background: 'linear-gradient(#f3e6c8, #e6d3ab)', border: '2px solid #6b4a2e', boxShadow: '0 1px 4px rgba(0,0,0,.45)', color: '#3a2716', font: '700 12px ui-sans-serif, system-ui, sans-serif' }} data-visit-pill>
      <span>{ready ? `Visiting ${name}'s plot` : `Walking over to ${name}'s plot…`}</span>
      <button onClick={onHome} className="hk-btn px-2 py-0.5 text-[11px]" data-act="visit-home">Home (H)</button>
    </div>
  )
}
/** M61 s3: the host's side: who is on your plot, and a way to send each one home */
function GuestsPill({ guests, onSend }: { guests: { id: string; name: string }[]; onSend: (id: string) => void }) {
  if (!guests.length) return null
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[30] pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-3 py-1 rounded-lg max-w-[92vw]"
      style={{ background: 'linear-gradient(#f3e6c8, #e6d3ab)', border: '2px solid #6b4a2e', boxShadow: '0 1px 4px rgba(0,0,0,.45)', color: '#3a2716', font: '700 12px ui-sans-serif, system-ui, sans-serif' }} data-guests-pill>
      <span>On your plot:</span>
      {guests.map(g => (
        <span key={g.id} className="flex items-center gap-1">
          <span>{g.name}</span>
          <button onClick={() => onSend(g.id)} className="hk-btn px-2 py-0.5 text-[11px]" data-act="send-home" data-guest={g.id}>Send home</button>
        </span>
      ))}
    </div>
  )
}
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
  const spiritFight = useSpiritFight()   // M127 s1: owner-only for now
  const book = useBook(), pagesNow = garden.pages + seenCount(book)   // M76: bloomed spirits fill the grimoire; garden.pages = older grants
  const [panel, setPanel] = useState<Panel>(null)
  // M36 (Alex 11-19 'yes wire the page.tsx sfx hooks'): a panel opening / closing swishes; any button tap ticks. Only yay sounds play.
  const panelWas = useRef(false)
  useEffect(() => { const on = !!panel; if (on !== panelWas.current) sfx(on ? 'ui-panel-open' : 'ui-panel-close'); panelWas.current = on }, [panel])
  useEffect(() => { const tap = (e: PointerEvent) => { if ((e.target as Element | null)?.closest?.('button')) sfx('ui-tap') }; document.addEventListener('pointerdown', tap, true); return () => document.removeEventListener('pointerdown', tap, true) }, [])   // pointerdown: some buttons act (and unmount) on press, so a click never lands
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
  const rodOutRef = useRef(false)   // M82 s2: the rinstick is out in the mitt (set at render, read by the walker tick)
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
  const vitalsRef = useRef<SkinVitals>({ hp: 100, hpMax: 100, shield: 0, shieldMax: 0, skin: true })   // M59: the shield drawn as the Mana Skin
  // ★ mana is real now: pruning from a distance spends it (forestry.ts › MANA_COST), it refills slowly (M78: 0.4/s, paused 3 s after any spend; shared/vitals-economy.ts)
  const manaRef = useRef<Mana>({ cur: 100, max: 100, regen: ECON.manaRegen })
  const skinRef = useRef<SkinPool>({ cur: 0 })   // M80: hold F charges the keeper's own Mana Skin (shared/use-skin-charge.ts)
  const drankAt = useRef<number | null>(null)   // M78: the one potion cooldown every bottle shares (seconds, performance clock)
  const [potionCool, setPotionCool] = useState(0)   // whole seconds left, for the status chip
  useEffect(() => { if (potionCool <= 0) return; const t = setTimeout(() => setPotionCool(Math.ceil(potionCdLeft(drankAt.current, performance.now() / 1000))), 1000); return () => clearTimeout(t) }, [potionCool])
  const dryAt = useRef(-99)   // M78: the last 'not enough mana to reload' line (said at most every 2 s)
  const buffsRef = useRef<Buffs>({})   // potion buffs (ather/alchemy.ts), loaded per keeper on mount
  useEffect(() => { buffsRef.current = loadBuffs(); toolsRef.current = loadTools() }, [])   // per keeper, after mount (localStorage)
  useEffect(() => { const on = () => { toolsRef.current = loadTools() }; window.addEventListener(TOOLS_EVENT, on); return () => window.removeEventListener(TOOLS_EVENT, on) }, [])   // a rinstick made at the Rinnshop
  // THE GARDEN VILLAGE AT WORK (moglins.ts): on load the village catches up on the time you were away (capped at 12 h) and
  // says what it made; then it ticks every minute while you play. The product lands in each room's own store.
  const runVillage = useCallback((say: boolean) => {
    if (isVisiting()) return {}   // M61: on a mate's plot your village waits (it catches up at home)
    const v = loadVillage()
    if (!v.moglins.some(m => m.room)) { saveVillage({ ...v, lastTick: Date.now() }); return {} }
    // the farm's own clock (farm-room.tsx › farmNow; equals Date.now() but for a check's skew), so a farmer tends on the
    // same time the beds grow on
    const t = villageTick(v, currentWorks(), farmNow(), { farm: currentFarm().farm, water: currentWater() })
    saveVillage(t.village)
    if (Object.keys(t.made).length) setWorks(t.works)
    if (t.tended && t.grounds) { setFarm({ ...currentFarm(), farm: t.grounds.farm }); setWater(t.grounds.water) }
    // one 'while you were away' line with the stations' catch-up (away-report.ts joins both reports)
    if (say && Object.keys(t.made).length) reportAway(t.made)
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
  const stowedNow = useCallback(() => stanceRef.current.kind === 'stowed', [])   // M42: melee swings only with empty hands
  const [reloadTick, setReloadTick] = useState(0)
  const toolsRef = useRef<EquippedTools>(ensureBasicTools({})), skillsRef = useRef<SkillSet>(openSkills())
  const onCombatHud = useCallback((h: CombatHud) => { vitalsRef.current = { hp: h.hp, hpMax: h.maxHp, shield: h.skin ?? 0, shieldMax: h.skinMax ?? 0, skin: true, popAt: h.skinPopAt }; setChud(h) }, [])
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
      await ensureEdits()   // M104: the live layer BEFORE the voids (its void brush cells are applied over the generated field)
      w.voids = voidsRef.current = makeVoids(idx, nw ?? null, [], voidEditsLive())   // M41: the cloud voids between zones, carved as each tile parses
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

  // BETA M61 PLOT VISITS (plot-visit.ts): visiting a party mate's plot shows THEIR squares and works, read-only
  const visitNow = useSyncExternalStore(subscribeVisit, currentVisit, () => null)
  const owned = useMemo(() => new Set(shownOwned(garden.owned)), [garden.owned, visitNow])   // eslint-disable-line react-hooks/exhaustive-deps
  // GARDEN CLUSTERS (cluster.ts + meadow.ts, Alex 11-15, his sketch): alone, the plot as ever; linked, the meadow
  // round us all (the square, the paths, the hills) and my mates' plots (turned to face the square, fenced by their own
  // mist) become ground
  const cl0 = useCluster(garden.owned)
  // M61: on a mate's plot their island stands alone on the Green (your own cluster mates are not theirs)
  const cl = useMemo(() => (visitNow ? { ...cl0, frame: SOLO_FRAME } : cl0), [cl0, visitNow])
  const clusterRef = useRef(cl.frame); clusterRef.current = cl.frame
  const works = useWorks()   // the workshop rooms (workshop.tsx): their walls are solid
  const worksRef = useRef(works); worksRef.current = works
  usePlacingKeys(owned)
  const plotWorld = useMemo(() => terrainWorld(withLifts(cl.frame.linked
    ? plotShape(owned, [...mistWalls(owned), ...mateWalls(cl.frame), ...workWalls(works)], (x, z) => clusterGround(cl.frame, x, z))
    : plotShape(owned, [...mistWalls(owned), ...workWalls(works)]))), [owned, cl.frame, works])
  const gladeLayer = useGladeLayer(zone.kind === 'glade')   // M83 s2b: refetched on each Glade entry, so a publish shows next visit
  const gladeZoneGround = useMemo(() => gladeLayerGround(gladeLayer.edits), [gladeLayer])
  const gladeMeshLift = useMemo(() => gladeLift(gladeLayer.edits), [gladeLayer])
  const gladeParts = useMemo(() => zoneParts(gladeLayer.zones ?? [], gladeZoneGround), [gladeLayer, gladeZoneGround])   // M84 s3
  // M114 s2: each tagged zone's ONE E point (zone-tags.ts: front edge; locked / shop panel / home label + talk / supplier line)
  const gladeDoors = useMemo(() => (gladeLayer.zones ?? []).flatMap(z => { const u = zoneUse(z); return u ? [{ id: z.id, ...zoneDoor(z), u }] : [] }), [gladeLayer])
  const gladeDoorsRef = useRef(gladeDoors); gladeDoorsRef.current = gladeDoors
  const gladeWorld = useMemo(() => terrainWorld(withZoneParts(withPieces({ ...plotShape(GLADE_OWNED, [...mistWalls(GLADE_OWNED), ...mateWalls(GLADE_FRAME)]), ground: gladeZoneGround }, undefined, true), zonePartBoxes(gladeParts))), [gladeZoneGround, gladeParts])   // M67 s1a; s1b-2: the pond's bowl + Greg's home, lots, jetty
  const updateGarden = useCallback((g: Garden) => { setGarden(g); saveGarden(g) }, [])

  const fading = useRef(false)
  const rendererRef = useRef<{ gl: WebGLRenderer; scene: Scene; camera: Camera } | null>(null)
  // M67 s1b fix (hub 11-22, glade-cluster-check red on edesk): a second arrive() while the veil is still up was DROPPED with no
  // word, so the Glade's gate pressed in the last moments of an earlier arrival did nothing. `wait` queues it behind that veil
  // (latest one wins) instead; the fall and the spawn-type arrivals keep the old drop, so they never stack an extra fade.
  const queued = useRef<{ z: Zone; s: Spawn } | null>(null)
  const arrive = useCallback((z: Zone, s: Spawn, wait = false) => {
    if (fading.current) { if (wait) queued.current = { z, s }; return }
    fading.current = true; setFade(1); setPanel(null); exitBuild()
    setTimeout(() => {
      setZone(z); setSpawn(s); setEpoch(e => e + 1)
      // M44: let the new zone mount, WARM its shaders behind the veil, then lift; capped so it never traps
      const lift = () => { setFade(0); fading.current = false; const q = queued.current; if (q) { queued.current = null; arriveRef.current(q.z, q.s) } }
      const r = rendererRef.current
      if (!r) { lift(); return }
      let done = false; const once = () => { if (!done) { done = true; lift() } }
      const cap = setTimeout(once, 2500)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        // SYNC compile, not compileAsync: three's async poll reads currentProgram.isReady on a timer, and a zone that disposes a
        // material mid-poll threw an uncaught 'reading isReady' page error on prod (folk-check 11-20). The veil is up; blocking is fine.
        try { r.gl.compile(r.scene, r.camera) } catch { /* warm-up is best effort */ }
        clearTimeout(cap); once()
      }))
    }, 380)
  }, [])
  const arriveRef = useRef(arrive); arriveRef.current = arrive
  // M71 s1: a keeper Greg has not folded a garden for has no home yet: 'home' (H, the map, a fall, the Hollows) is the Glade
  const goHome = useCallback(() => { if (gardenOpen(loadTut())) arrive({ kind: 'plot' }, THRESHOLD); else arrive({ kind: 'glade' }, gladeNewbornSpot()) }, [arrive])
  // M61: going visiting (or coming home) = a walk through the veil to the plot's threshold. Play together's Visit button calls the
  // handler; ?visit=<host>&vn=<name> is how the continent page hands a visit over.
  const visitHost = visitNow?.host ?? null, lastHost = useRef<string | null>(null)
  useEffect(() => {
    if (visitHost === lastHost.current) return
    lastHost.current = visitHost
    if (visitHost) arrive({ kind: 'plot' }, THRESHOLD); else goHome()   // M71 s1: home from a visit = the Glade until the fold
  }, [visitHost, arrive, goHome])
  useEffect(() => {
    // only a party mate visits (the party instance is the only door); a visit link without one says so and goes nowhere
    const go = (host: string, name: string) => {
      if (host === selfPlayerId()) return
      if (!storedParty()) { noteVisit('refused:no-party'); hudSay('Join their party first: only party mates can visit a plot.', 'info', 5); return }
      startVisit(host, name)
    }
    setVisitHandler(go)
    const q = new URLSearchParams(window.location.search), h = q.get('visit')
    if (h) {
      go(h, q.get('vn') ?? '')
      const url = new URL(window.location.href); url.searchParams.delete('visit'); url.searchParams.delete('vn'); window.history.replaceState(null, '', url)
    }
    return () => { setVisitHandler(null); endVisit() }
  }, [])
  // no plot from the host in VISIT_WAIT_MS (they left their plot, went offline, or this is not their party) = home, with one line
  const visitReady = !!visitNow?.snap
  useEffect(() => {
    if (!visitHost || visitReady) return
    const t = setTimeout(() => { const v = currentVisit(); if (v && !v.snap) { hudSay(`Could not reach ${v.name}'s plot. They may have left it.`, 'info', 5); endVisit('timeout') } }, VISIT_WAIT_MS)
    return () => clearTimeout(t)
  }, [visitHost, visitReady])
  // ── M41 CLOUD VOIDS: a fall costs time, never gore. Over the edge -> a short fade -> set down at the last crossing you used,
  // else the last waymark (Greg's stone when you hold none).
  const voidsRef = useRef<VoidField | null>(null)
  const lastCross = useRef<{ x: number; z: number } | null>(null)
  const wwRef = useRef<WildsWorld | null>(null); wwRef.current = ww
  const wayRef = useRef<Waymark[]>([]); wayRef.current = waymarks
  const infRef = useRef<ReadonlySet<string>>(new Set())   // M75 s2: the spread's infected nodes (set below), for the fall's lit waymark
  // void v2: the FALL before the cost (void-fall.ts). Over the lip, the page takes the body from the walker (sinkRef), it drops
  // into the fog column under gravity while a black veil closes (voidDark), and only once the view is black does voidFall run.
  const sinkRef = useRef<((lc: Loco, dt: number) => void) | null>(null)
  const fallSt = useRef<FallState | null>(null), voidDark = useRef<HTMLDivElement | null>(null)
  const setDark = (d: number) => { const el = voidDark.current; if (el) el.style.opacity = String(d) }
  /** the arrival's veil is up (arrive() set it this frame): hand the body back, lift the black under the veil */
  const endSink = () => { sinkRef.current = null; fallSt.current = null; setTimeout(() => setDark(0), 450) }
  useEffect(() => { sinkRef.current = null; fallSt.current = null; setDark(0) }, [epoch])   // any arrival: the new body is the walker's
  const voidFall = useCallback(() => {
    const w = wwRef.current; if (!w || fading.current) return
    const way = lastLit(wayRef.current, infRef.current), o = way ? w.offsetOf(way.tile) : { x: 0, z: 0 }
    const at = lastCross.current ?? (way ? { x: way.x + o.x + 2.2, z: way.z + o.z + 2.2 } : { x: GREG_WAYMARK.x + 2.2, z: GREG_WAYMARK.z + 2.2 })
    const { tx, ty } = tileOf(at.x, at.z), t = w.at(tx, ty); if (!t) return
    fading.current = true   // arrive() below takes it over once the tile is in
    stream(w, at.x, at.z).then(() => { fading.current = false; setWrev(w.rev); setHereTile(t.name); arrive({ kind: 'wilds', tile: t.name }, { x: at.x, z: at.z, yaw: Math.PI * 0.75 }); endSink(); setToast(lastCross.current ? 'You went over the edge. You are back at the last crossing.' : 'You went over the edge. You are back at your last waymark.') })
  }, [arrive])

  // ── combat in the Wilds ──
  const terrain = useMemo<Terrain | null>(() => ww ? { heightAt: ww.heightAt, walkable: (x, z) => ww.walkable(x, z), structures: wildsStructures } : null, [ww])
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
  infRef.current = infectedSet
  // M70 s2: THE SPREAD MAP (spread-map.ts): uncovered areas + their neglect clock; ticks every 4 s (uncover where you stand,
  // grow toasts for watched areas that turned Hollow ground). The first read after a load only records (no toast on reload).
  const [smap, setSmapState] = useState<SpreadMap>(() => (typeof window === 'undefined' ? { v: 1, seen: {}, first: false } : loadMap()))
  const smapRef = useRef(smap); smapRef.current = smap
  const setSmap = (m: SpreadMap) => { if (m === smapRef.current) return; smapRef.current = m; saveMap(m); setSmapState(m) }
  const [smapTick, setSmapTick] = useState(0)
  const smapPrev = useRef<Record<string, AreaState> | null>(null)
  const nodesRef0 = useRef<WildsNode[]>([]); nodesRef0.current = nodes   // M70 s1: Chamomile's ask aims at the nearest
  // each loaded tile's borders in its LOCAL coords (the minimap composes per tile; the fold map shows the tile you are in)
  const regionsByTile = useMemo(() => {
    const m = new Map<string, { id: string; poly: { x: number; z: number }[]; infected: boolean; seen: boolean }[]>()
    if (!ww) return m
    const now = clock()
    for (const name of ww.loaded.keys()) {
      const t = ww.byName.get(name)!, ox = t.tx * TILE_M, oz = t.ty * TILE_M
      const local = (nodesByTile.get(name) ?? []).map(n => ({ ...n, x: n.x - ox, z: n.z - oz }))
      m.set(name, nodeRegions(local, TILE_M, TILE_M).map(r => { const s = areaState(smap, r.id, infectedSet.has(r.id), now); return { ...r, infected: s === 'hollow', seen: s !== 'unseen' } }))   // M70 s2: the spread map's three states
    }
    return m
  }, [ww, wrev, nodesByTile, infectedSet, smap, smapTick]) // eslint-disable-line react-hooks/exhaustive-deps
  const regions = regionsByTile.get(hereTile) ?? []
  useEffect(() => {   // M70 s2: the spread map's tick
    if (zone.kind !== 'wilds' || !ww || !nodeOwner) return
    const placeOf = (id: string) => { const n = allNodes.find(x => x.id === id); return n ? ZONE_NAME[zonesOf(ww, n.tile)(n.i, n.j)] : 'the Wilds' }
    const tick = () => {
      const p = pos.current, here = nodeOwner(p.x, p.z), now = clock()
      if (here) setSmap(uncover(smapRef.current, here, now))
      const m = smapRef.current, next: Record<string, AreaState> = {}
      for (const id of Object.keys(m.seen)) next[id] = areaState(m, id, infectedSet.has(id), now)
      if (smapPrev.current) { const c = changes(smapPrev.current, next); if (c.grew.length) hudSay(growLine(placeOf(c.grew[0])), 'info', 6); else if (c.cleared.length) hudSay(clearLine(), 'info', 4) }
      const moved = !smapPrev.current || Object.keys(next).some(k => smapPrev.current![k] !== next[k])
      smapPrev.current = next
      if (moved) setSmapTick(k => k + 1)   // the regions re-tint only when a state moved
    }
    ;(window as unknown as { __spreadMap?: unknown }).__spreadMap = () => ({ first: smapRef.current.first, seen: Object.keys(smapRef.current.seen), here: nodeOwner(pos.current.x, pos.current.z) ?? null,
      state: (id: string) => areaState(smapRef.current, id, infectedSet.has(id), clock()), place: placeOf })   // checks read it (m70-spread-check)
    tick(); const id = setInterval(tick, 4000); return () => clearInterval(id)
  }, [zone.kind, ww, nodeOwner, infectedSet, allNodes]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {   // M70 s2: spread.map.first, Chamomile's line the first time the spread map is opened with ground uncovered (once)
    if (panel?.kind !== 'map') return
    const f = firstLook(smapRef.current); if (f.fire) { setSmap(f.m); hudSay(`Chamomile: ${firstLine()}`, 'info', 7) }
  }, [panel?.kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const hereOff = useMemo(() => { const t = ww?.byName.get(hereTile); return t ? { x: t.tx * TILE_M, z: t.ty * TILE_M } : { x: 0, z: 0 } }, [ww, hereTile])
  const groundRef = useRef<(x: number, z: number) => string | null>(() => null)
  groundRef.current = (x, z) => { const id = nodeOwner?.(x, z); return id ? (nodes.some(n => n.id === id) ? 'infected ground' : 'cleared ground') : null }
  const gardenRef = useRef(garden); gardenRef.current = garden
  const onCombat = useCallback((evs: CombatEvent[]) => {
    let got = 0
    // M118 s1: Hollows dispersed with party spirits walking beside the keeper fill their growth bars (canon c01931e/05f3d0d)
    const exp = evs.reduce((n, e) => n + (e.kind === 'hit' && e.killed ? GROWTH.KILL_EXP : e.kind === 'champ-down' ? GROWTH.CHAMP_EXP : 0), 0)
    if (exp > 0) {
      const beside = followIds().filter(inParty), grew = fightExp(beside, exp)
      if (grew.length) { const pots = getPots(); setToast(grew.map(id => { const p = pots[id]; return grownLine(p ? SPECIES_NAMES[speciesOf(p.seed)] : 'Your spirit') }).join(' ')) }
    }
    for (const e of evs) {
      if (e.kind === 'pickup') { got += e.amount; sfx('pickup-grey-matter') }
      if (e.kind === 'reload-dry') { const t = performance.now() / 1000; if (t - dryAt.current > 2) { dryAt.current = t; hudSay(RELOAD_DRY_LINE, 'info') } }   // M78
      if (e.kind === 'champ-wake') setToast('Something heaves up out of the grey.')
      if (e.kind === 'champ-break') setToast(e.bar === 0 ? 'It sinks into the ooze, and more come crawling out.' : 'It sinks again. When it rises it moves wrong, wild.')
      if (e.kind === 'champ-down') {
        setToast('The grey thins here. For now.')
        { const t0 = loadTut(), t1 = m70Down(t0, e.nodeId); if (t1 !== t0) saveTut(t1) }   // M70 s1: Lamps Out's big one
        { const m = tend(smapRef.current, e.nodeId, clock()); setSmap(m); smapPrev.current = smapPrev.current && { ...smapPrev.current, [e.nodeId]: 'clear' }; hudSay(clearLine(), 'info', 4) }   // M70 s2: its area reads Clear
        const cur = spreadRef.current
        if (cur) { const r = clearAt(cur, allNodes, e.nodeId, clock()); saveSpread(r.s); setSpread(r.s) }
      }
      if (e.kind === 'down') {
        { const p = pos.current; fallAndDrop(p.x, heightRef.current(p.x, p.z), p.z) }   // M20: the bag stays where they fell (death-pack.tsx)
        chainDeath()   // M73: the first death arms Morel's ping (it waits for the pack; opening-chain.ts)
        setToast('The Hollows dragged you under. The fold caught you and set you down at home.')
        setTimeout(() => setReviveKey(k => k + 1), 400)
        goHome()   // M71 s1: the plot, or the Glade before Greg folds one
      }
    }
    if (got) { const g = { ...gardenRef.current, grey: gardenRef.current.grey + got }; setGarden(g); saveGarden(g) }
  }, [arrive, allNodes, goHome])

  const travel = useCallback((d: Dest) => {
    if (d.kind === 'home') { goHome(); return }
    if (d.kind === 'glade') { arrive({ kind: 'glade' }, gladeNewbornSpot()); return }   // M67 s1b: a visit lands where a newborn wakes, facing Greg
    if (d.kind === 'waymark') {
      if (!ww) { setToast('The Wilds are still loading.'); return }
      // M75 s2 (Magii d3bf5e9): a waymark whose ground went grey again is DARK: no travel until the ground is cleared again
      const v = canTravel(d.w, infectedSet); if (!v.ok) { setToast(v.why); return }
      // a waymark is saved in its tile's own coords; the world is one space, so place it, load round it, then arrive
      const o = ww.offsetOf(d.w.tile), x = d.w.x + o.x + 2.2, z = d.w.z + o.z + 2.2
      stream(ww, x, z).then(() => { setWrev(ww.rev); setHereTile(d.w.tile); arrive({ kind: 'wilds', tile: d.w.tile }, { x, z, yaw: Math.PI * 0.75 }) })
      return
    }
    // Athernyx: out through a city's door off the hall (hub's ?at= sets you down at that pitstop).
    setPanel(null); setFade(1)
    setTimeout(() => { window.location.href = `/shimmer/open/continent?at=${encodeURIComponent(d.id)}` }, 380)
  }, [ww, arrive, goHome, infectedSet])

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

  // WHERE YOU WERE (last-spot.ts, Alex 11-19: "if the page refreshes i should still be in the same spot"). A load with a
  // saved Wilds spot sets the keeper back down there (after the Hallway's ?waymark=, which wins; ?home=1 goes home). While
  // out in the Wilds the spot is saved every 3 s and as the page hides; arriving HOME (epoch > 0: a real arrival, not the
  // page's first plot frame) clears it, so dying or folding home starts the next load at home.
  // ★ NO HOME FLASH (Alex 11-20: "if i refresh the screen the game takes me to the homeplot for a sec, then the last location"):
  // the page's first zone is the plot, and the Wilds stream in after it. When a resume is coming, the veil is UP before the
  // first paint (layout effect, no fade-in) and stays up until arrive() takes over its own fade; a resume that turns out
  // void (tile unknown) or never lands lifts it.
  const [resuming, setResuming] = useState(false)
  useLayoutEffect(() => {
    // M67 s1a: a keeper who left off in the closed Glade wakes there (its spot carries GLADE_TILE, never a Wilds tile)
    const gs = resumeFrom(window.location.search, loadSpot(), n => n === GLADE_TILE)
    if (gs) { landed.current = true; arrive({ kind: 'glade' }, { x: gs.x, z: gs.z, yaw: gs.yaw }); return }
    if (!resumeFrom(window.location.search, loadSpot(), () => true)) return
    setResuming(true)
    const cap = setTimeout(() => setResuming(false), 20000)
    return () => clearTimeout(cap)
  }, [])
  useEffect(() => {
    if (landed.current || !ww) return
    const sp = resumeFrom(window.location.search, loadSpot(), n => !!ww.byName.get(n))
    if (!sp || sp.tile === GLADE_TILE) { setResuming(false); return }
    landed.current = true
    stream(ww, sp.x, sp.z).then(() => { setWrev(ww.rev); setHereTile(sp.tile); arrive({ kind: 'wilds', tile: sp.tile }, { x: sp.x, z: sp.z, yaw: sp.yaw }); setResuming(false) })
  }, [ww, arrive])
  const hereTileRef = useRef(hereTile); hereTileRef.current = hereTile
  const fadeRef = useRef(fade); fadeRef.current = fade
  // M71 s1 backstop: any other way onto your own plot before Greg folds it (the routes above already go to the Glade) lands in the Glade
  useEffect(() => { if (zone.kind === 'plot' && epoch > 0 && !visitNow && !gardenOpen(loadTut())) arrive({ kind: 'glade' }, gladeNewbornSpot()) }, [zone, epoch])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (zone.kind === 'plot') { if (epoch > 0) clearSpot(); return }
    const glade = zone.kind === 'glade'   // M67 s1a: the closed Glade keeps a spot too, so a reload wakes you in it
    // M67 s1b fix: write the arrival point NOW. The tick below only saves once the veil is down (up to ~2.5 s) and then every
    // 3 s, so a reload in the first seconds after the Glade's gate read the OLD spot and woke the keeper back in the Glade.
    saveSpot(makeSpot(glade ? GLADE_TILE : hereTileRef.current, spawn.x, spawn.z, spawn.yaw))
    const save = () => { if (fadeRef.current === 0) { const p = poseRef.current; saveSpot(makeSpot(glade ? GLADE_TILE : hereTileRef.current, p.x, p.z, p.yaw)) } }
    const hide = () => { if (document.visibilityState === 'hidden') save() }
    const t = setInterval(save, 3000)
    window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', hide)
    return () => { clearInterval(t); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', hide) }
  }, [zone, epoch])   // eslint-disable-line react-hooks/exhaustive-deps -- spawn changes with every arrival (epoch)

  // BORN AT MOONWELL (BETA M31, Alex 11-19: 'the start loses new keepers'). A keeper born on this page (the rune chosen)
  // opens their eyes at Moonwell Glade beside Greg, not on the plot: set down at his waymark (~6.6 m from his bench) behind
  // the Born beat + the creator, turned to FACE him (the waymark's own yaw looks past him). Waits for the Wilds if they are
  // still streaming. A returning keeper never fires it (born already), so they load as today; the plot stays theirs.
  const [bornPending, setBornPending] = useState(false)
  useEffect(() => { const on = () => setBornPending(true); window.addEventListener(BORN_EVENT, on); return () => window.removeEventListener(BORN_EVENT, on) }, [])
  useEffect(() => {
    if (!bornPending) return
    setBornPending(false)
    // ★ M67 s1a (Alex 11-22, docs/tutorial-cluster.md): a newborn opens their eyes in the CLOSED Glade, in Greg's garden, facing
    // him (glade-cluster.ts gladeNewbornSpot), no longer at Moonwell in the open Wilds. The Glade needs no streaming.
    arrive({ kind: 'glade' }, gladeNewbornSpot())
  }, [bornPending, arrive])
  // M67 s1a: the Glade's gate (open from the start) is its one way out: straight through to the Wilds at Greg's waymark
  // M67 s1b fix: pressed before the Wilds have loaded, the gate WAITS for them (one pending exit) instead of asking for a retry
  const [gatePending, setGatePending] = useState(false)
  const leaveGlade = useCallback(() => {
    if (!ww) { setGatePending(true); hudSay('The gate opens onto the Wilds...', 'info', 3); return }
    const o = ww.offsetOf(GREG_WAYMARK.tile), x = GREG_WAYMARK.x + o.x, z = GREG_WAYMARK.z + o.z
    stream(ww, x, z).then(() => { setWrev(ww.rev); setHereTile(GREG_WAYMARK.tile); arrive({ kind: 'wilds', tile: GREG_WAYMARK.tile }, { x, z, yaw: Math.PI * 0.75 }, true); hudSay('The Wilds', 'zone') })
  }, [ww, arrive])
  useEffect(() => { if (gatePending && ww) { setGatePending(false); if (zone.kind === 'glade') leaveGlade() } }, [gatePending, ww, zone, leaveGlade])
  const gladeFall = useCallback(() => arrive({ kind: 'glade' }, gladeNewbornSpot()), [arrive])

  // M84 s3b: the Wilds read published zone builds + tags the way the Glade does (zone-parts.ts / zone-tags.ts). The layer came with
  // ensureEdits (before ww exists); a part stands only once its tile is loaded (heightAt is -Infinity off the loaded land), so the
  // parts re-derive as tiles stream (wrev) and only re-key the world when the set of placed parts actually changes
  const wildsZones = useMemo(() => ww ? publishedZones(zonesJsonLive()) : [], [ww])
  const wildsPartsNow = useMemo(() => ww && wildsZones.length ? zoneParts(wildsZones, ww.heightAt) : [], [ww, wrev, wildsZones])   // eslint-disable-line react-hooks/exhaustive-deps
  const wildsPartsSig = wildsPartsNow.map(p => `${p.key}@${p.y.toFixed(2)}`).join()
  const wildsParts = useMemo(() => wildsPartsNow, [wildsPartsSig])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setWildsPartBoxes(zonePartBoxes(wildsParts)); return () => setWildsPartBoxes([]) }, [wildsParts])   // M117 s3
  const wildsDoors = useMemo(() => wildsZones.flatMap(z => { const u = zoneUse(z); return u ? [{ id: z.id, ...zoneDoor(z), u }] : [] }), [wildsZones])
  const wildsDoorsRef = useRef(wildsDoors); wildsDoorsRef.current = wildsDoors
  const world = useMemo(() => zone.kind === 'plot' ? plotWorld : zone.kind === 'glade' ? gladeWorld : ww ? terrainWorld(withZoneParts(withPieces(ww.shape), zonePartBoxes(wildsParts))) : null, [zone, ww, plotWorld, gladeWorld, wildsParts])   // ww.shape reads the live tiles
  // ground cover preview (ground-cover.tsx, ?cover=): nothing on a path, the gate's pad or at Greg's feet
  const [cover, setCover] = useState<'none' | 'tufts' | 'meadow' | 'lush'>('meadow')
  useEffect(() => setCover(coverFromUrl()), [])
  const placedClear = useMemo(() => coverClear(works), [works])   // M23: every placed room / piece / chest / the table clears its floor
  const coverSkip = useCallback((x: number, z: number) => placedClear(x, z) || (cl.frame.linked && onPath(cl.frame, x, z)) || Math.hypot(x - GATE.x, z - GATE.z) < 5 || Math.hypot(x - GREG.x, z - GREG.z) < 2.5 || Math.hypot(x - THRESHOLD.x, z - THRESHOLD.z) < 2, [cl.frame, placedClear])
  const ground = useMemo(() => zone.kind === 'glade' ? gladeZoneGround : zone.kind === 'plot' ? (cl.frame.linked ? (x: number, z: number) => Math.max(plotHeightAt(x, z), clusterGround(cl.frame, x, z)) : plotHeightAt) : ww ? ww.heightAt : () => 0, [zone, ww, cl.frame, gladeZoneGround])
  // M27: others in the Wilds (shared/open-mp.tsx); the plot is personal, no socket. Feet on the ground the page knows.
  // M61: on a plot IN A PARTY there is a socket now: your own plot = open:plot:<you> (you host), a mate's = open:plot:<them>.
  // The party instance is the only way in (strangers never match into one); no party = no socket on the plot, as before.
  const { party } = useParty()
  const plotMp = zone.kind === 'plot' && party ? plotZone(visitNow ? visitNow.host : selfPlayerId()) : null
  const mp = useOpenMultiplayer(zone.kind === 'wilds' ? OPEN_WILDS : plotMp, () => { const p = poseRef.current, y = ground(p.x, p.z); return { x: p.x, y: Number.isFinite(y) ? y : 0, z: p.z, yaw: p.yaw } },
    () => (stanceRef.current.kind === 'weapon' ? heldRef.current : null))   // M27 slice 4: the party sees my gun
  const heightRef = useRef(ground); heightRef.current = ground
  const visitRev = useMemo(() => ({ works, owned: garden.owned }), [works, garden.owned])   // stable until the plot changes
  const plotNet = usePlotVisitNet({ relay: mp.relay, onRelay: mp.onRelay, hosting: !!plotMp && !visitNow, visit: visitNow,
    snapOf: (): PlotSnap => ({ works: currentWorks(), owned: [...garden.owned], moglins: snapMoglins(loadVillage().moglins), farm: currentFarm(), water: currentWater() }),   // leftovers: the host's Moglins, beds + tanks
    live: () => openNet()?.live() ?? [], rev: visitRev,   // M61 s2: a new works / owned = a re-send
    say: m => hudSay(m, 'info', 5) })   // s3: sent home / the host left
  usePartyBrew({ relay: mp.relay, onRelay: mp.onRelay, hosting: !!plotMp && !visitNow, visit: visitNow, guests: plotNet.guests, works: currentWorks })
  const guestsHere = plotNet.guests.map(id => ({ id, name: mp.peers.current.get(id)?.name || 'A friend' }))
  useEffect(() => { setLobbyZone(zone.kind === 'wilds' ? OPEN_WILDS : plotZone(visitNow ? visitNow.host : selfPlayerId())) }, [zone.kind, visitNow])
  // third person (V): your own keeper, the segmented doll (open/shared/third-person.tsx), driven from the tick below
  const thirdRef = useRef(false), dollDrive = useRef(newDrive()), camRef = useRef<Camera | null>(null)

  const gateStepRef = useRef<(lc: Loco, yaw: number, dt: number, g: (x: number, z: number) => number) => void>(() => {})
  const onTick = useCallback((lc: Loco, yaw: number, dt: number) => {
    pos.current = { x: lc.px, z: lc.pz, grounded: !lc.airborne, swimming: lc.swimming }
    { const v = voidsRef.current   // M41: on a crossing = the place to come back to; in a void = over the edge
      if (v && zoneRef0.current === 'wilds') {
        if (sinkRef.current) return   // falling: the sink owns the body (void v2)
        const c = v.crossingNear(lc.px, lc.pz, 7); if (c) lastCross.current = { x: c.x, z: c.z }
        if (!fading.current && v.weight(lc.px, lc.pz) >= FALL_LIP) {   // over the lip: fall into the fog, THEN the cost
          const gx = v.weight(lc.px + 1, lc.pz) - v.weight(lc.px - 1, lc.pz), gz = v.weight(lc.px, lc.pz + 1) - v.weight(lc.px, lc.pz - 1), gl = Math.hypot(gx, gz)
          const st = startFall({ px: lc.px, py: lc.py, pz: lc.pz }, lc.vy, lc.hvx, lc.hvz, gl > 1e-6 ? { x: gx / gl, z: gz / gl } : undefined); fallSt.current = st
          let paid = false
          sinkRef.current = (b, dt) => {
            const d = stepFall(st, b, dt, heightRef.current)
            b.vy = st.vy; b.hvx = st.hvx; b.hvz = st.hvz; b.airborne = true
            setDark(d)
            if (st.done && !paid) { paid = true; voidFall(); if (!fading.current) endSink() }   // voidFall bailed (no world): hand back
          }
          return
        }
      } }
    stepChannel(lc.px, lc.pz)   // gathering by channel: the next chip, or let go
    { // the body, read once: posed against THIS frame's camera (the walker placed it just before calling us), off its own state
      const now = performance.now(), h = heldRef.current, third = thirdRef.current
      const speed = Math.hypot(lc.hvx, lc.hvz), working = !!chanRef.current || !!fxRef.current?.busy() || !!cFxRef.current?.busy()
      // the first-person hands (hidden in third person: the doll's own hands are what you see)
      handsApi.current?.step({ now, speed, airborne: lc.airborne, hidden: frozen.current || stanceRef.current.kind === 'weapon' || third || isBuilding(),
        castAt: handsCastAt.current, working, holding: stanceRef.current.kind === 'item' && !!h && !rodOutRef.current,   // M45: the mitt turns to present (not the rinstick: it is held, not shown)
        actionR: rodOutRef.current ? oneShot(ACTIONS['rinstick.cast'], now - (rinApi.current?.castAt() ?? -Infinity))   // M82 s2: a cast plays the authored cast
          : stanceRef.current.kind === 'stowed' ? oneShot(lastSwingAction() ?? ACTIONS['melee.swing'], now - lastSwingAt()) : undefined }, dt)   // M82 s3: and a swing the swing
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
      setOpenXpMult(Math.max(buffOn(b, 'starlight', t) ? STARLIGHT_XP : 1, buffOn(b, 'wisdom', t) ? WISDOM_XP : 1))   // the stronger of the two, never stacked
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
    setKeeperAt(lc.px, lc.pz, yaw)   // M109: a following spirit trails this
    let n: Near = null
    // BETA M60 (Alex 11-21): E acts only on what the CROSSHAIR is on, within 3 m of the keeper (shared/aim-pick.ts); each kind keeps
    // its own E action. Every interactable is a capsule here; the camera's centre ray picks (the same on a phone).
    const cam = camRef.current, from = { x: lc.px, z: lc.pz }
    const eye = cam ? { x: cam.position.x, y: cam.position.y, z: cam.position.z } : { x: lc.px, y: lc.py + 1.6, z: lc.pz }
    const dir = cam ? (() => { const v = cam.getWorldDirection(aimDirV); return { x: v.x, y: v.y, z: v.z } })() : lookDir(yaw, 0)
    const g = heightRef.current
    const cap = (x: number, z: number, r: number, h: number, item: Near): Pickable<Near> => { const y = g(x, z); return { x, z, y0: y - 0.2, y1: y + h, r, item } }
    if (zone.kind === 'glade') {   // M67 s1a: the gate; s1b-2: Greg + the five talk here (they left the Wilds)
      const cands: Pickable<Near>[] = [cap(GLADE_GATE.x, GLADE_GATE.z, 1.4, 3.2, { kind: 'gate' })]
      const gl = gregLive.current
      if (!tourRef.current) cands.push(cap(gl.x, gl.z, 0.45, 1.8, { kind: 'greg' }))
      for (const k of GLADE_FRIENDS_AT) cands.push(cap(k.x, k.z, 0.45, 1.8, { kind: 'friend', f: k.id }))   // M68 s3a
      if (tourRef.current && !tourRef.current.talk && Math.hypot(gl.x - lc.px, gl.z - lc.pz) > 30) setTour(null)   // M32: walked off = the tour is skipped
      for (const f of gladeFolkDrawn) cands.push(cap(f.x, f.z, 0.4, MOGLIN_HEIGHT.chibi + 0.1, f.id === FENNEL_FOLK_ID ? { kind: 'gfennel' } : { kind: 'folk', s: GLADE }))   // M68 s3b
      for (const d of gladeDoorsRef.current) { const y = g(d.x, d.z); if (Number.isFinite(y)) cands.push(cap(d.x, d.z, 0.6, 2.4, { kind: 'zone', u: d.u })) }   // M114 s2
      n = aimPick(cands, eye, dir, from)
    }
    else if (zone.kind === 'plot') {
      const cands: Pickable<Near>[] = [cap(GATE.x, GATE.z, 1.4, 3.2, { kind: 'gate' })]
      if (fennelRef.current) cands.push(cap(fennelRef.current.x, fennelRef.current.z, 0.45, 1.1, { kind: 'fennel' }))   // M22
      if (!visitNow) for (const m of idleDrawn) cands.push(cap(m.x, m.z, 0.4, MOGLIN_HEIGHT.chibi + 0.1, { kind: 'idlemog', id: m.id, name: m.name }))   // P1: E on a recruit waiting for a room
      // M109 s1: a drawn 3D garden spirit (owner + ?spirits=3d only: nothing is live otherwise), a capsule round her as she stands
      if (!visitNow) for (const s of liveSpirits()) cands.push({ x: s.x, z: s.z, y0: s.y - 0.1, y1: s.y + s.h + 0.15, r: Math.max(0.25, s.h * 0.6), item: { kind: 'spirit', id: s.id, name: SPECIES_NAMES[s.sp] } })
      if (anemonyxHere(clock())) cands.push(anemonyxPick<Near>({ kind: 'anemonyx' }))   // M76 s2: her day at the Green's edge
      for (const w of workPickables(worksRef.current, g)) cands.push({ ...w, item: { kind: 'work', near: w.item } })
      n = aimPick(cands, eye, dir, from)
    } else {
      const cands: Pickable<Near>[] = []
      for (const { w, own } of [{ w: GREG_WAYMARK, own: false }, ...waymarks.map(w => ({ w, own: true }))]) { const o = ww?.byName.has(w.tile) ? ww.offsetOf(w.tile) : null; if (o) cands.push(cap(w.x + o.x, w.z + o.z, 0.55, 1.7, { kind: 'waymark', w, own })) }
      // (M30's Gregory + the Glade's five stood here until M67 s1b-2 moved them into the closed Glade, above)
      // a settlement's folk: each Moglin standing in it (nobody home = the settlement's own anchor, where the talk camera falls back)
      // ...but a node under the crosshair with hands stowed keeps E for the work (Alex 11-19: at Moonwell Glade the folk ate E, no mining)
      const workAim = (aimRef.current.tree || cAimRef.current.crystal) && stanceRef.current.kind === 'stowed'
      if (!workAim && netRef.current) { const st = settlementAt(netRef.current, lc.px, lc.pz); if (st) { const figs = folkDrawn.get(st.id)
        if (figs?.length) for (const f of figs) cands.push(cap(f.x, f.z, 0.4, MOGLIN_HEIGHT.chibi + 0.1, { kind: 'folk', s: st }))
        else cands.push(cap(st.x, st.z, 0.8, 2, { kind: 'folk', s: st }))
        const stall = stallDrawn.get(st.id); if (stall) cands.push(cap(stall.x, stall.z, 0.6, MOGLIN_HEIGHT.chibi + 0.4, { kind: 'folk', s: st })) } }   // M112: the Burrfolk's stall (the talk opens on the nearest)
      if (!workAim && gleanerPost.on && Math.hypot(lc.px - GLEANER_POST.x, lc.pz - GLEANER_POST.z) < GLEANER_POST_R) { const g = stallDrawn.get(GLEANER_POST.id); if (g) cands.push(cap(g.x, g.z, 0.6, MOGLIN_HEIGHT.chibi + 0.4, { kind: 'folk', s: GLEANER_POST })) }   // M112 s2: Gleaner (owner-only post)
      if (!workAim && inSettlement(lc.px, lc.pz)) for (const st of SETTLERS) if (st.talks || (st.id === 'angelica' && m70sideNow.angelica)) cands.push(cap(st.x, st.z, 0.45, MOGLIN_HEIGHT.chibi + 0.1, { kind: 'settler', id: st.id, name: st.name }))   // M70 s1 (+ s3 Angelica)
      if (!workAim && m70sideNow.desk && Math.hypot(lc.px - ANGELICA_DESK.x, lc.pz - ANGELICA_DESK.z) < 12) cands.push(cap(ANGELICA_DESK.x, ANGELICA_DESK.z, 0.7, 1.2, { kind: 'adesk' }))   // M70 s3: Angelica's Desk
      for (const d of wildsDoorsRef.current) { const y = g(d.x, d.z); if (Number.isFinite(y)) cands.push(cap(d.x, d.z, 0.6, 2.4, { kind: 'zone', u: d.u })) }   // M84 s3b: a tagged zone's E point (only where its tile is loaded)
      n = aimPick(cands, eye, dir, from)
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
      // M67 fix (hub 11-22): no E prompt (nor the phone's Use button, which is built from it) while the veil is up: the keys are
      // ignored under it (`if (panel || fade) return`), so a prompt there promised a press that did nothing. On a slow GPU the
      // veil after an arrival lasts seconds; the gate's E pressed in that window was the edesk's 'through the gate' red.
      const p = fadeRef.current ? null
        : tourRef.current?.talk ? null   // M32: Greg is talking at a stop; E answers him, nothing else
        : n?.kind === 'gate' ? (zone.kind === 'glade' ? 'E · the gate (the Wilds)' : 'E · the gate (fold map)')
        : n?.kind === 'greg' ? 'E · Gregory (buy ground)'
        : n?.kind === 'fennel' || n?.kind === 'gfennel' ? 'E · Fennel'
        : n?.kind === 'idlemog' || n?.kind === 'spirit' || n?.kind === 'settler' ? `E · ${n.name}`
        : n?.kind === 'friend' ? `E · ${FRIEND_NAME[n.f]}`
        : n?.kind === 'anemonyx' ? 'E · the Anemonyx'
        : n?.kind === 'adesk' ? `E · ${M70SIDE_TEXT.deskTitle}`
        : n?.kind === 'work' ? workPrompt(n.near)
        : n?.kind === 'waymark' ? (n.own ? 'E · fold map · L lift this waymark' : 'E · fold map')
        : n?.kind === 'folk' ? `E · talk to the folk of ${n.s.name}`
        : n?.kind === 'zone' ? zonePrompt(n.u)   // M114 s2
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
          const camp = !st && !fr && Math.hypot(lc.px - BURR_CAMP.x, lc.pz - BURR_CAMP.z) < BURR_CAMP.r * 2   // M112 s2: the Burrfolk camp
          const place = st ? st.name : fr ? FAIR_NAME : camp ? CAMP_LABEL : null
          if (place && place !== placeRef.current) hudSay(st ? `${st.name} · a free Moglin settlement` : fr ? `${FAIR_NAME} · this season's pitch` : CAMP_LABEL, 'zone')
          placeRef.current = place
          if (place) where = st ? `${st.name} · free Moglins` : place
        }
      }
      else if (zone.kind === 'glade') where = gladeWhere(lc.px, lc.pz)
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
  }, [zone, waymarks, ww, fog, tileOff, streamAt, voidFall])

  const buy = useCallback((i: number, j: number) => {
    const v = canBuy(owned, i, j, pagesNow, garden.grey)
    if (!v.ok) { setToast(v.why); return }
    updateGarden({ ...garden, owned: [...garden.owned, sqId(i, j)], grey: garden.grey - v.cost })
    setToast(`Ground opened. ${garden.grey - v.cost} grey matter left.`)
  }, [owned, garden, pagesNow, updateGarden])

  // Probes for scripted shots and for testing the economy before the Hollows land.
  useEffect(() => {
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = {
      ...(g.__ather ?? {}),
      // read-only probe (owner-race-check): the plot the page is DRAWING, from the live store
      works: () => { const w = currentWorks(); return { rooms: w.rooms.map(r => r.kind), pieces: w.pieces.map(p => p.item) } },
      zone: () => zone.kind,
      // CHECK-ONLY (glade-cluster-check): set the keeper down somewhere in the closed Glade (only while in it), to walk the last steps to the gate
      gladeAt: (x: number, z: number, yaw: number) => { if (zone.kind === 'glade') arrive({ kind: 'glade' }, { x, z, yaw }) },
      zoneDoors: () => zoneRef0.current === 'wilds' ? wildsDoorsRef.current : gladeDoorsRef.current, near: () => near.current, panel: () => panelRef.current?.kind ?? null,   // read-only probes (M114 s2 zone-tags-check): the tagged zones' E points, what E would act on
      falling: () => (fallSt.current ? { t: fallSt.current.t, done: fallSt.current.done } : null),   // read-only probe (void-fall-check): the fall into a void
      wildsLoaded: () => [...(wwRef.current?.loaded.keys() ?? [])],   // read-only probe (M9 wilds-release-check): the parsed Wilds tiles held now
      open: (k: 'gate' | 'greg' | 'athernyx') => { if (k === 'greg') openGreg(); else setPanel({ kind: 'map', view: k === 'athernyx' ? 'athernyx' : 'ather', travel: true }) },
      travel: (d: Dest) => travel(d),
      grant: (grey = 0, pages = 0) => updateGarden({ ...garden, grey: garden.grey + grey, pages: garden.pages + pages }),
      resetGarden: () => updateGarden(freshGarden()),
      spread: () => spreadRef.current, skipDays, ownerAt: (x: number, z: number) => nodeOwner?.(x, z),
      chan: () => (chanRef.current ? { id: chanRef.current.w.id, done: chanRef.current.w.done, of: chanRef.current.w.chips.length } : null), prune: () => pruneAimed(), aim: () => aimRef.current.tree?.id ?? null, mine: () => mineAimed(), crystal: () => { const c = cAimRef.current.crystal; return c ? { id: c.id, kind: c.kind, x: c.x, y: c.y, z: c.z } : null }, mana: () => manaRef.current.cur,
      stance: () => stanceRef.current, speedMult: () => (stanceRef.current.kind === 'stowed' ? STOWED_SPEED : 1) * frameStats(getLook()).speed,
      village: () => loadVillage(), villageTick: () => runVillage(false), fennelAt: () => fennelRef.current,
      eat: () => eatHeld(), hp: () => vitalsRef.current.hp, drink: () => drinkHeld(), buffs: () => buffsRef.current, tools: () => toolsRef.current, setMana: (n: number) => { manaRef.current.cur = n },
      rin: () => rinApi.current?.view() ?? null, cast: () => castOrAnswer(), hold: (h: boolean | 'track') => { reelHold.current = h === 'track' ? (r: Reel) => (r.zone - r.bob) * 6 + (r.zoneV - r.bobV) * 1.6 > 0 : h },
    }
  }, [zone, travel, garden, updateGarden, skipDays, nodeOwner, arrive])

  const plantHere = useCallback((): PlantVerdict => {
    if (zone.kind !== 'wilds' || !ww) return { ok: false, why: 'not in the Wilds' }
    // a waymark belongs to the tile it stands in, in that tile's own coords (the fold map, the spacing rules, saves)
    const p = pos.current, biome = ww.biomeAt(p.x, p.z), t = ww.at(tileOf(p.x, p.z).tx, tileOf(p.x, p.z).ty)
    if (!t) return { ok: false, why: 'no tile' }
    const lx = p.x - t.tx * TILE_M, lz = p.z - t.ty * TILE_M
    const st = netRef.current ? settlementAt(netRef.current, p.x, p.z) : null   // a settlement is kept ground (Alex 11-18)
    // M75: so is ground the keeper cleared (canon: a waymark exists only once the place is kept); it links home, so not pre-fold
    const owner = nodeOwner?.(p.x, p.z) ?? null, ground = groundOf(owner, infectedSet)
    const v = canPlant(waymarks, { tile: t.name, x: lx, z: lz, biome, grounded: p.grounded, swimming: p.swimming, settlement: st?.id ?? null, ground, folded: gardenOpen(loadTut()) })
    if (!v.ok) { setToast(v.why); return v }
    const spent = take(getInv(), 'waymark', 1)          // a waymark is a thing in the bag now: planting spends one
    if (!spent) { const why = 'No waymarks in your bag. Lift one you planted to carry it again.'; setToast(why); return { ok: false, why } }
    setInv(spent)
    const next = plant(waymarks, { tile: t.name, x: lx, y: ww.heightAt(p.x, p.z), z: lz, biome, ...(st ? { settlement: st.id } : owner ? { node: owner } : {}) })
    setWaymarks(next); saveWaymarks(next)
    setToast(`Waymark bound in ${st?.name ?? 'the Wilds'}. It is a stop on the fold map now.`)
    return v
  }, [zone, ww, waymarks, nodeOwner, infectedSet])
  const liftWaymark = useCallback((id: string) => {
    const next = lift(wayRef.current, id); setWaymarks(next); saveWaymarks(next)
    const back = give(getInv(), 'waymark', 1); setInv(back.inv)
    setToast(back.left ? 'Waymark lifted, but your bag is full: it went back to the fold.' : 'Waymark lifted. It is back in your bag.')
  }, [])
  // M75 probes (m75-waymark-check): the ledger, plant/lift through the same paths as click/L, the ground word where the keeper
  // stands, kept/infected ground nearby. wmGoto + wmClearHere + wmGrey/wmClear (M75 s2) are CHECK-ONLY (like grant): set down at a Wilds point, clear its node.
  useEffect(() => {
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = {
      ...(g.__ather ?? {}),
      wm: () => wayRef.current, wmBag: () => countOf(getInv(), 'waymark'), wmPlant: () => plantHere(), wmLift: (id: string) => liftWaymark(id),
      wmGround: () => { const p = pos.current; return { ground: groundOf(nodeOwner?.(p.x, p.z) ?? null, infectedSet), settlement: netRef.current ? settlementAt(netRef.current, p.x, p.z)?.id ?? null : null, x: p.x, z: p.z, grounded: p.grounded } },
      wmNodes: () => { const p = pos.current; return allNodes.filter(n => n.tile === GREG_WAYMARK.tile).map(n => ({ id: n.id, x: n.x, z: n.z, infected: infectedSet.has(n.id), d: Math.hypot(n.x - p.x, n.z - p.z) })).sort((a, b) => a.d - b.d).slice(0, 40) },
      wmGoto: (x: number, z: number) => { if (!ww) return false; const { tx, ty } = tileOf(x, z), t = ww.at(tx, ty); if (!t) return false; const o = ww.offsetOf(t.name); travel({ kind: 'waymark', w: { id: 'probe', tile: t.name, x: x - o.x - 2.2, y: 0, z: z - o.z - 2.2, biome: BIOME.meadow, made: 0 } }); return true },
      wmLit: () => wayRef.current.map(w => ({ id: w.id, node: w.node ?? null, lit: isLit(w, infectedSet) })),
      wmGrey: (id: string) => { const cur = spreadRef.current; if (!cur || !cur.clean.includes(id)) return false; const s = { ...cur, clean: cur.clean.filter(c => c !== id) }; saveSpread(s); setSpread(s); return true },
      wmClear: (id: string) => { const cur = spreadRef.current; if (!cur || !allNodes.some(n => n.id === id)) return false; const r = clearAt(cur, allNodes, id, clock()); saveSpread(r.s); setSpread(r.s); return true },
      wmClearHere: () => { const p = pos.current, id = nodeOwner?.(p.x, p.z), cur = spreadRef.current; if (!id || !cur) return null; const r = clearAt(cur, allNodes, id, clock()); saveSpread(r.s); setSpread(r.s); return id },
    }
  }, [plantHere, liftWaymark, nodeOwner, infectedSet, allNodes, ww, travel])
  // what you hold is what the stance says (a drawn gun, a picked hotbar item, or nothing): a waymark plants on click,
  // the Repeater fires (combat-layer only fires while armed), stowed hands work a node
  const inv = useInv()
  const held = heldOf(stance, inv)
  useEffect(() => { setStance(st => settle(st, inv)) }, [inv])   // the last waymark planted empties the hand
  const heldRef = useRef(held); heldRef.current = held
  // M45: what E does with it (held-use.ts). Furniture / a Keepstone in hand stands its ghost in front of you on the plot
  // (workshop holdFromHand: E taps set it, an E hold turns it); it goes when a panel, the planner or a fade is up.
  const heldUseNow = zone.kind === 'glade' ? null : heldUse(held, zone.kind === 'plot' ? 'plot' : 'wilds')   // M67: nothing placed or cast in the Glade (not your ground)
  useEffect(() => { holdFromHand(placesFromHand(heldUseNow) && !panel && !building && !fade ? held : null) }, [held, heldUseNow, panel, building, fade])
  useEffect(() => { (window as unknown as { __held?: unknown }).__held = () => ({ id: heldRef.current, use: heldUse(heldRef.current, zoneRef0.current === 'wilds' ? 'wilds' : 'plot') }) }, [])
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
      if (chip.drops.some(d => d.n > 0)) sfx('pickup-item')
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
    // M36: each chip knocks (axe on wood / pick on crystal); the last one finishes with the snip / the glassy ring
    if (ch.node === 'tree') sfx(chip.last ? 'hit-prune-tree' : 'hit-axe-tree', { at: { x: ch.t.x, y: 1, z: ch.t.z } })
    else sfx(chip.last ? 'hit-prospect-crystal' : 'hit-pick-crystal', { at: { x: ch.c.x, y: ch.c.y, z: ch.c.z } })
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
    const left = potionCdLeft(drankAt.current, performance.now() / 1000)
    if (left > 0) { hudSay(potionWaitLine(left), 'info'); return }   // M78: one 15 s cooldown for every bottle
    const d = drink(id, manaRef.current, buffsRef.current, Date.now(), vitalsRef.current.hpMax)
    if (!d.ok) { if (d.why) hudSay(d.why, 'info'); return }
    if (d.heal !== undefined) {   // M57 health potion: the same rules as a roast (Wilds only, not at full health, not while down)
      if (zoneRef0.current !== 'wilds') { hudSay('Save it for the Wilds. It heals you mid-fight.', 'info'); return }
      const v = vitalsRef.current
      if (v.hp <= 0) return
      if (v.hp >= v.hpMax) { hudSay('You are whole. Keep it for a fight.', 'info'); return }
    }
    const out = take(getInv(), id, 1); if (!out) return
    setInv(out)
    if (d.heal !== undefined) eatQueue.current.push(d.heal)
    if (d.mana !== undefined) manaRef.current.cur = d.mana
    if (d.buffs !== buffsRef.current) { buffsRef.current = d.buffs; saveBuffs(d.buffs) }
    drankAt.current = performance.now() / 1000; setPotionCool(ECON.potionCd)
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
    marksRef.current = zone.kind === 'glade'
      ? [{ x: gregInGlade().x, z: gregInGlade().z, color: '#f2cf63', title: 'Gregory' }, { x: GLADE_GATE.x, z: GLADE_GATE.z, color: '#e7c766', title: 'the gate' }]
      : zone.kind === 'plot'
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
    marksRef.current = [...marksRef.current, ...questMarks(zone.kind === 'plot' ? 'ather' : zone.kind)]   // the journal's waymarks (pack.tsx); M67 s1b-2: the Glade has its own (the pool, Greg)
  }, [zone, nearNodes, waymarks, journal, ww, net])
  // THE FIRST ERRAND (business/errand.ts, Magii + Alex 11-16): Greg hands the birth letter's gems; the journal points to
  // the school's runesmith, then the Enchant Temple in the Citadel (those waymarks light on the continent page)
  const birth = useBirth(), loadoutNow = useLoadout()
  // ── the keeper's hands (open/shared/open-hands.tsx): stepped from the walker's onTick, after the camera moved ─────────
  const zoneRef = useRef(zone.kind); zoneRef.current = zone.kind; zoneRef0.current = zone.kind
  // Q / X + mana refill + the cast chips: ONE shared hook (shared/use-casts.ts), the same on the continent
  const { castSlot, gate: castGate, gateStep, closeGate, channel: castChannel, castQueue, castHud, surge, impulse, handsCastAt } = useCasts({ manaRef, vitalsRef, fightHere: () => zoneRef.current === 'wilds', flow: () => (buffOn(buffsRef.current, 'ather_flow') ? OPEN_FLOW_MULT : 1), gateHere: () => true })
  // M80: hold F charges the keeper's own skin, anywhere on foot; the combat layer draws it in the Wilds, this hook elsewhere
  useSkinCharge({ mana: manaRef, skin: skinRef, active: () => !frozen.current, vitals: vitalsRef, drawn: () => zoneRef.current !== 'wilds' })
  gateStepRef.current = gateStep
  useEffect(() => { closeGate() }, [zone.kind, closeGate])   // a Gate never leaves the zone
  // M9 (11-22): a minute at home gives the Wilds' tiles back (back to the boot set round Greg's waymark); a hop back sooner keeps them
  useEffect(() => {
    if (zone.kind !== 'plot' || !ww) return
    const id = setTimeout(() => { if (releaseTo(ww, GREG_WAYMARK.x, GREG_WAYMARK.z)) setWrev(ww.rev) }, WILDS_RELEASE_MS)
    return () => clearTimeout(id)
  }, [zone.kind, ww])
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
    if (zone.kind === 'glade') return { x: GLADE_GATE.x, z: GLADE_GATE.z, zone: 'glade' as const }   // M67: the Glade's one way out
    if (zone.kind !== 'wilds') return { x: GATE.x, z: GATE.z, zone: 'ather' as const }
    if (!ww || !ww.byName.has(GREG_WAYMARK.tile)) return null
    const o = ww.offsetOf(GREG_WAYMARK.tile); return { x: GREG_WAYMARK.x + o.x, z: GREG_WAYMARK.z + o.z, zone: 'wilds' as const }
  }, [zone.kind, ww, wrev])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { postEntries('errand', errandEntries(errandStage, birth, { greg: { x: gregAt.x, z: gregAt.z }, gate: errandGate })) }, [errandStage, birth, errandGate])
  // BETA M73 the opening chain: the note handed once, Morel's ping after the first death + pack, the gate hint, the flip
  useOpeningChain({ packLying, getInv, setInv })
  const chain = useChain()
  const mapOpen = panel?.kind === 'map' ? `${panel.travel ? 'gate' : 'look'}:${panel.view}` : ''
  useEffect(() => {
    if (!mapOpen) return
    if (mapOpen.startsWith('gate:')) chainGateOpen()
    if (mapOpen.endsWith(':athernyx')) chainFlip('athernyx')
  }, [mapOpen])
  useMorelHints({ stage: errandStage, zone: zone.kind === 'plot' ? 'ather' : zone.kind, pos: () => poseRef.current,
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
  // M68 s2: a live tutorial keeper hears Greg's Beat 1 first (glade-greg-talk.ts), then his ordinary talk with the pending bark
  //   as its hello until the four are heard. The tutorial is re-read at every E (a sign-in switches keeper).
  const [tut, setTutState] = useState<Tut | null>(null)
  const [tutC, setTutC] = useState<TutCursor | null>(null)
  const [foldC, setFoldC] = useState<FoldStep | null>(null)   // M71 s1: Greg's fold offer (garden-fold.ts), in front of his usual talk
  const setTut = (t: Tut) => { saveTut(t); setTutState(t) }
  const [gregSaid, setGregSaid] = useState<string | null>(null)   // M123 s1: his line after handing the grimoire over
  const spiritsDev = useSpiritsDev()
  const openGreg = () => { setGregSaid(null); const t = loadTut(); setTutState(t); const c = tutStart(t); setTutC(c); setFoldC(!c && foldOffered(t) ? 'offer' : null); setPanel({ kind: 'talk', step: 0 }) }
  /** Hub call (M68): ONE Grimoire Pedestal per keeper. One already crafted (the old recipe) or placed or banked counts. */
  const ownsPedestal = () => countOf(getInv(), 'grimoire_pedestal') > 0 || currentWorks().pieces.some(p => p.item === 'grimoire_pedestal') || bankCount(currentBank(), 'grimoire_pedestal') > 0
  /** M71 s2: a bought waymark: into the bag first (a full bag refuses, nothing spent), then the garden's grey */
  const buyWaymark = (grey: number) => {
    const r = give(getInv(), 'waymark', 1); if (r.left) { hudSay('Your bag is full. Make room for the waymark.', 'info'); return false }
    setInv(r.inv); const g = { ...gardenRef.current, grey }; setGarden(g); saveGarden(g); hudSay(`Waymark · in your bag. ${grey} grey matter left.`, 'item'); return true
  }
  const talkStep = panel?.kind === 'talk' ? panel.step : -1
  const talkNode = useMemo(() => {
    if (talkStep < 0) return null
    if (tut && tutC) return tutNode(tut, tutC, {
      set: setTut,
      go: c => { setTutC(c); if (!c) setPanel(null) },
      grimoire: () => {
        const g = grimoireGift(tut.gifts.includes('grimoire'), ownsPedestal())
        if (!g.record) return true
        if (g.give) {
          const r = give(getInv(), 'grimoire_pedestal', 1)
          if (r.left) { hudSay('Your bag is full. Make room for the grimoire.', 'info'); return false }
          setInv(r.inv); hudSay(`${FURNITURE.grimoire_pedestal.name} · in your bag`, 'item')
        }
        setTut(tutGift(tut, 'grimoire').t); return true
      },
    })
    if (tut && foldC) return foldNode(tut, foldC, {
      grey: () => gardenRef.current.grey,
      pay: (t, grey) => { const g = { ...gardenRef.current, grey }; setGarden(g); saveGarden(g); setTut(t); hudSay(`Garden folded. ${grey} grey matter left.`, 'item') },   // garden first, then the flag
      go: s => { setFoldC(s); if (!s) setPanel(null) },
      home: () => goHome(),
      buy: grey => buyWaymark(grey),
    })
    const pending = !!tut && tut.live && tut.greg.wilds && !allHeard(tut)
    const open = !tut || gardenOpen(tut)   // M71 s1: no ground screen and no tour (it ends at your table) before the fold
    return gregTalk(gregErrand, talkStep, {
      ground: open ? () => setPanel({ kind: 'greg' }) : undefined, bye: () => setPanel(null), goto: step => setPanel({ kind: 'talk', step }),
      tour: open ? () => { setPanel(null); setStops(tourStops()); setTour({ i: 0, talk: false }) } : undefined,
      hello: pending ? gladeLine('greg.b1.bark.pending') : undefined,
      // M123 s1: a keeper with no grimoire pedestal (a legacy keeper never heard Beat 1) asks 'Spirits?' and Greg hands it over
      grimoire: spiritsDev && pedestalOwed(tut, ownsPedestal()) ? { label: gladeLine('greg.b1.choice.b'), pick: () => {
        const r = give(getInv(), 'grimoire_pedestal', 1)
        if (r.left) { hudSay('Your bag is full. Make room for the grimoire.', 'info'); return }
        setInv(r.inv); hudSay(`${FURNITURE.grimoire_pedestal.name} · in your bag`, 'item'); setGregSaid(gladeLine('greg.b1.spirits.3'))
      } } : undefined,
      said: gregSaid ?? undefined,
      buy: tut && open ? { label: FOLD_TEXT.buyAsk, pick: () => buyPick(tut, { grey: () => gardenRef.current.grey, pay: () => {}, go: s => { setFoldC(s); if (!s) setPanel(null) }, home: () => goHome(), buy: grey => buyWaymark(grey) }) } : undefined,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkStep, errandStage, birth, given, tut, tutC, foldC, spiritsDev, gregSaid])
  // M68 s3a: Otto, Tess, Bonn (glade-friend-talk.ts). Greet + gift once Greg has sent you; their bark otherwise.
  const openFriend = (f: GardenFriend) => { const t = loadTut(); setTutState(t); setPanel({ kind: 'friend', c: friendStart(t, f) }) }
  /** Hand a friend's gift once (the tutorial's gift guard). Tools: recording the gift lights the socket (rinsticks.ts › loadTools). */
  const friendGive = (t: Tut, g: TutGift): boolean => {
    if (t.gifts.includes(g)) return true
    if (g === 'seeds') {
      let inv = getInv()
      for (const st of tessPacket(Math.random())) { const r = give(inv, st.id, st.n); if (r.left) { hudSay('Your bag is full. Make room for the seeds.', 'info'); return false } inv = r.inv }
      setInv(inv); hudSay('Starter seeds · in your bag', 'item')
    }
    setTut(tutGift(t, g).t)
    if (g === 'spike' || g === 'pruner') { toolsRef.current = loadTools(); hudSay(`${g === 'spike' ? 'Worn Spike' : 'Worn Pruner'} · lit in your hand`, 'item') }
    return true
  }
  const friendC = panel?.kind === 'friend' ? panel.c : null
  const friendTalkNode = useMemo(() => !friendC || !tut ? null : friendNode(tut, friendC, {
    set: setTut,
    go: i => setPanel(i === null ? null : { kind: 'friend', c: { ...friendC, i } }),
    give: g => friendGive(tut, g),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [friendC, tut])
  // M70 s1: the first settlement's folk (first-settlement.ts). The tutorial is re-read at every E.
  const openSettler = (id: SettlerId) => { const t = loadTut(); setTutState(t); const c = id === 'angelica' ? angelicaStart(t, !!bottleToHand(haveOf(getInv()))) : settlerStart(t, id); if (c) setPanel({ kind: 'settler', c }) }
  const settlerC = panel?.kind === 'settler' ? panel.c : null
  const settlerGive = (): boolean => {
    let inv = getInv()
    for (const st of M70_GIFT) { const r = give(inv, st.id, st.n); if (r.left) { hudSay('Your bag is full. Make room for the bundle.', 'info'); return false } inv = r.inv }
    setInv(inv); hudSay('Health Draught ×3 · a bundle of bits and pieces · in your bag', 'item'); return true
  }
  // M70 s3: the bottle goes to Angelica and the alchemy set comes back, together or not at all
  const angelicaHand = (withSet: boolean): boolean => {
    const b = bottleToHand(haveOf(getInv())); if (!b) return false
    let inv = take(getInv(), b, 1); if (!inv) return false
    if (withSet) for (const id of ALC_SET_ITEMS) { const r = give(inv, id, 1); if (r.left) { hudSay(M70SIDE_TEXT.bagFull, 'info'); return false } inv = r.inv }
    setInv(inv); if (withSet) hudSay(`${ALC_SET_ITEMS.map(id => itemDef(id).name).join(' · ')} · in your bag`, 'item'); return true
  }
  const settlerTalkNode = useMemo(() => !settlerC || !tut ? null : settlerC.who === 'angelica' ? angelicaNode(tut, settlerC as AngelicaCursor, {
    set: t => { setTut(t); m70sideNow.angelica = angelicaTalks(t); m70sideNow.desk = deskOpen(t) },
    go: i => setPanel(i === null ? null : { kind: 'settler', c: { ...(settlerC as AngelicaCursor), i } }),
    hand: angelicaHand,
  }) : settlerNode(tut, settlerC as SettlerCursor, {
    set: setTut,
    go: i => setPanel(i === null ? null : { kind: 'settler', c: { ...(settlerC as SettlerCursor), i } }),
    target: () => pickTarget(nodesRef0.current)?.id ?? null,
    give: settlerGive,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [settlerC, tut])
  const settlerSpeaker = settlerC ? (settlerC.mode === 'bark' ? speakerOf(settlerC.script[0]) : settlerAt(settlerC.who)) : null
  const settlerHead = settlerSpeaker && zone.kind === 'wilds' && ww ? { x: settlerSpeaker.x, y: ww.heightAt(settlerSpeaker.x, settlerSpeaker.z) + MOGLIN_HEIGHT.chibi, z: settlerSpeaker.z } : null
  const [ledger, setLedger] = useLedger()   // M114 s2: a Shop zone's panel buys with the keeper's purse (the continent's own hook)
  const gFennel = useGladeFennel(panel?.kind === 'gfennel' ? panel.c : null, c => setPanel(c ? { kind: 'gfennel', c } : null), () => setPanel({ kind: 'folk', s: GLADE }), gladeZoneGround)   // M68 s3b
  const spiritTalk = useSpiritTalk(panel?.kind === 'spirit' ? panel.c : null, useCallback((c: SpiritTalkState | null) => setPanel(c ? { kind: 'spirit', c } : null), []), hudSize === 'phone')   // M109 s1
  const idleTalk = useIdleTalk(panel?.kind === 'idlemog' ? panel.c : null, c => setPanel(c ? { kind: 'idlemog', c } : null))   // P1
  const friendAt = friendC ? GLADE_FRIENDS_AT.find(k => k.id === friendC.f) ?? null : null
  const friendHead = friendAt && zone.kind === 'glade' ? { x: friendAt.x, y: gladeZoneGround(friendAt.x, friendAt.z) + 1.75, z: friendAt.z } : null
  const talkFocus = useRef<{ x: number; y: number; z: number } | null>(null)
  // M32 (Magii 944ad1d): Greg lights the starter glove with the birth's ruled word, only while its seat is empty
  function lightGlove() {
    const r = giveGloveWord(getLoadout(), birth); if (!r) return
    setLoadout(r.loadout); hudSay(`Gregory: ${GLOVE_GIVE}`, 'chat'); hudSay(`${r.name} · lit in your glove`, 'item')
  }
  const gl0 = gregLive.current   // M32: he may be standing anywhere on the Glade (tour); seated = his bench (M30)
  const gregHead = useMemo(() => zone.kind === 'plot'   // M32: on the plot he is only ever at the planning table (the tour's end)
    ? { x: TABLE_STOP.at.x, y: plotHeightAt(TABLE_STOP.at.x, TABLE_STOP.at.z) + 1.75, z: TABLE_STOP.at.z }
    : { x: gl0.x, y: (zone.kind === 'glade' ? gladeZoneGround(gl0.x, gl0.z) : 0) + (gl0.seated ? 1.55 : 1.75), z: gl0.z },   // M67 s1b-2: he lives in the Glade
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
    if (zone.kind === 'glade' && !tour.talk) {   // M67 s1b-2: the tour's Glade stops are in the closed Glade now
      const k = TABLE_KEEPER, g = TABLE_STOP.at
      setTableVisit(true); arrive({ kind: 'plot' }, { x: k.x, z: k.z, yaw: Math.atan2(-(g.x - k.x), -(g.z - k.z)) })   // walker: forward = (-sin, -cos)
    } else if (zone.kind === 'plot' && !tour.talk) setTour({ i: tour.i, talk: true })
  }, [tour, tableIdx, zone.kind, arrive])
  // the tour lives in the Glade and at the table; anywhere else ends it. Greg leaves the table once his talk is over.
  useEffect(() => { if (tourRef.current && zone.kind === 'plot' && tourRef.current.i !== tableIdx) setTour(null) }, [zone.kind, tableIdx])
  useEffect(() => { if (!tour && panel?.kind !== 'talk' && panel?.kind !== 'greg') setTableVisit(false) }, [tour, panel])
  // BETA M13: E in a settlement talks to ONE Moglin (folk-talk.ts); the settlement's heart is its anchor (no Moglin models are drawn yet)
  const folkTalk = useFolkTalk(panel?.kind === 'folk' ? panel.s : null, useCallback((x: number, z: number) => zone.kind === 'glade' ? gladeZoneGround(x, z) : ww && ww.tileAtPoint(x, z) ? ww.heightAt(x, z) : 0, [ww, zone.kind, gladeZoneGround]), () => setPanel(null))
  // BETA M22: Fennel at the Rinnshop while the first-rinstick quest is open (fennel.tsx, use-rinquest.ts › fennelTalk)
  const fennelAt = useMemo(() => (!visitNow && fennelHere(rinQuest) ? fennelSpot(works) : null), [rinQuest, works, visitNow])   // M61: your Fennel stays on YOUR plot
  const fennelRef = useRef(fennelAt); fennelRef.current = fennelAt
  const fennelHead = useMemo(() => (fennelAt ? { x: fennelAt.x, y: plotHeightAt(fennelAt.x, fennelAt.z) + FENNEL_HEAD, z: fennelAt.z } : null), [fennelAt])
  const fennelNode = panel?.kind === 'fennel' ? fennelTalk(rinQuest, panel.page, inv, { goto: page => setPanel({ kind: 'fennel', page }), close: () => setPanel(null) }) : null
  useEffect(() => { const m = tour && tourNode ? stops[tour.i]?.meets : undefined; if (m) markMet(m) }, [tour, tourNode, stops])   // BETA M33: Greg's introduction = met
  useEffect(() => { talkFocus.current = talkNode ? gregHead : tourNode && tour ? (() => { const L = stops[tour.i].look, ly = (stops[tour.i].zone === 'plot' ? plotHeightAt(L.x, L.z) : gladeZoneGround(L.x, L.z)) + 1.0
    // M32: between what he shows and his head (his side heavier: his bubble must stay on screen), so a phone frames both (aimed at the station alone, his bubble left the screen)
    return { x: L.x * 0.4 + gregHead.x * 0.6, y: ly * 0.4 + (gregHead.y + 0.6) * 0.6, z: L.z * 0.4 + gregHead.z * 0.6 } })() : fennelNode && fennelHead ? fennelHead : friendTalkNode && friendHead ? friendHead : settlerTalkNode && settlerHead ? settlerHead : gFennel.node && gFennel.head ? gFennel.head : idleTalk.node && idleTalk.head ? idleTalk.head : spiritTalk.node && spiritTalk.head ? spiritTalk.head : folkTalk.focus }, [spiritTalk.node, spiritTalk.head?.x, talkNode, gregHead, tourNode, tour, stops, ww, fennelNode, fennelHead, folkTalk.focus, friendTalkNode, friendHead?.x, friendHead?.z, settlerTalkNode, settlerHead?.x, gFennel.node, gFennel.head?.x, gFennel.head?.z, idleTalk.node, idleTalk.head?.x])   // eslint-disable-line react-hooks/exhaustive-deps
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
  // M70 s1: Lamps Out in the journal (signed quest-log lines; re-read every 3 s, the tutorial save moves in talks and fights)
  useEffect(() => {
    const post = () => {
      const t = loadTut(), q = m70Quest(t)
      if (!q) { postEntries('m70', []); return }
      const n = t.m70 === 'open' && t.m70node ? allNodes.find(x => x.id === t.m70node) : undefined
      const where = t.m70 === 'open' ? (n ? { zone: 'wilds' as const, x: n.x, z: n.z } : null)
        : t.m70 === 'down' ? { zone: 'wilds' as const, x: SETTLEMENT.x, z: SETTLEMENT.z }
        : { zone: 'glade' as const, x: gregInGlade().x, z: gregInGlade().z }
      postEntries('m70', [{ id: 'm70', hand: 'keeper', title: gladeLine(q.title), note: gladeLine(q.step), where }])
    }
    post(); const id = setInterval(post, 3000); return () => clearInterval(id)
  }, [allNodes])
  // M70 s3: A Proper Batch in the journal (signed title + done line; the step text is a placeholder for @lark)
  useEffect(() => {
    const post = () => {
      const t = loadTut(), have = haveOf(getInv()), q = sideQuest(t, have, sideItemName)
      m70sideNow.angelica = angelicaTalks(t); m70sideNow.desk = deskOpen(t)
      ;(window as unknown as { __m70side?: unknown }).__m70side = () => ({ side: loadTut().m70side, step: sideQuest(loadTut(), haveOf(getInv()), sideItemName)?.step ?? null, desk: ANGELICA_DESK })   // read-only probe (m70-alchemist-check)
      if (!q) { postEntries('m70side', []); return }
      const where = q.step === 'done' ? null : { zone: 'wilds' as const, x: q.step === 'brew' ? ANGELICA_DESK.x : settlerAt('angelica').x, z: q.step === 'brew' ? ANGELICA_DESK.z : settlerAt('angelica').z }
      postEntries('m70side', [{ id: 'm70side', hand: 'keeper', title: q.title, note: q.note, where }])
    }
    post(); const id = setInterval(post, 3000); return () => clearInterval(id)
  }, [])
  // entering somewhere says so on the message line: the zone, and crossing a node border
  const zoneName0 = zone.kind === 'plot' ? 'Your plot' : zone.kind === 'glade' ? GLADE_ZONE_NAME : 'The Wilds'
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
      // M45: E uses what is in hand first (a placing from the hand is caught earlier, by workshop's usePlacingKeys)
      if (e.code === 'KeyE' && !e.repeat) {
        const u = zone.kind === 'glade' ? null : heldUse(heldRef.current, zone.kind === 'plot' ? 'plot' : 'wilds')
        if (u === 'eat') { eatHeld(); return }
        if (u === 'drink') { drinkHeld(); return }
        if (u === 'plant') { plantHere(); return }
      }
      if (e.code === 'KeyE' && !n && (aimRef.current.tree || cAimRef.current.crystal) && stanceRef.current.kind === 'stowed') { workAimed(); return }
      if (e.code === 'KeyE' && !n && atFairDoor(pos.current.x, pos.current.z)) {
        hudSay(`${FAIR_NAME} · the troupe is still pitching. The season's games, contests and market open soon.`, 'info', 6); return
      }
      if (e.code === 'KeyE' && n) {
        if (n.kind === 'greg') openGreg()
        else if (n.kind === 'friend') openFriend(n.f)
        else if (n.kind === 'fennel') setPanel({ kind: 'fennel', page: 0 })
        else if (n.kind === 'gfennel') gFennel.open()   // M68 s3b
        else if (n.kind === 'settler') openSettler(n.id)   // M70 s1
        else if (n.kind === 'adesk') setPanel({ kind: 'adesk' })   // M70 s3
        else if (n.kind === 'idlemog') setPanel({ kind: 'idlemog', c: { id: n.id, screen: 'hello' } })   // P1: the go-home talk
        else if (n.kind === 'spirit') setPanel({ kind: 'spirit', c: { id: n.id, screen: 'talk' } })   // M109 s1
        else if (n.kind === 'anemonyx') meetToday(clock())   // M76 s2
        else if (n.kind === 'work' && n.near.kind === 'piece' && currentWorks().pieces.some(x => x.id === (n.near as { id: string }).id && x.item === 'lift') && callNearest()) return   // M61 s3: a guest calls a mate's lift too (a local ride, never saved)
        else if (n.kind === 'work' && n.near.kind === 'piece' && isVisiting() && (() => { const pc = currentWorks().pieces.find(x => x.id === (n.near as { id: string }).id), st = pc && FURNITURE[pc.item]?.alc; if (st) setPanel({ kind: 'brew', station: st }); return !!st })()) return   // M57 s3b: a guest takes brewing steps at a mate's alchemy set
        else if (n.kind === 'work' && guestRefuses(m => hudSay(m, 'info', 4))) return   // M61: a guest opens no station, store or piece
        else if (n.kind === 'work') { if (n.near.kind !== 'raising') setPanel({ kind: 'work', near: n.near }) }
        else if (n.kind === 'folk') setPanel({ kind: 'folk', s: n.s })
        else if (n.kind === 'gate' && zone.kind === 'glade') leaveGlade()
        else if (n.kind === 'zone') {   // M114 s2: a tagged zone's E point
          const u = n.u, line = zoneSay(u); if (line) hudSay(line, 'info', 4)
          if (u.kind === 'shop') setPanel({ kind: 'shop', id: u.id })
          else if (u.kind === 'home' && zone.kind === 'wilds') {   // M84 s3b: a Wilds resident = a settlement's Moglin: that settlement's talk
            const net = netRef.current, st = net && u.ref ? net.settlements.find(s => folkOf(s, net.season).some(f => f.id === u.ref)) : undefined
            if (st) setPanel({ kind: 'folk', s: st })
          }
          else if (u.kind === 'home') {
            const t = homeTalk(u.ref, { greg: !tourRef.current, friends: GLADE_FRIENDS_AT.map(k => k.id), fennel: FENNEL_FOLK_ID, folk: gladeFolkDrawn.map(f => f.id) })
            if (t?.kind === 'greg') openGreg(); else if (t?.kind === 'friend') openFriend(t.f as GardenFriend); else if (t?.kind === 'fennel') gFennel.open(); else if (t?.kind === 'folk') setPanel({ kind: 'folk', s: GLADE })
          }
        }
        else setPanel({ kind: 'map', view: 'ather', travel: true })   // Alex 11-20: the map opens on the side you stand on (the Ather here); an errand keeper's Rune Hold goal waits one Tab away
        return
      }
      if (!e.repeat && e.code === CAST_KEY.tactical) castSlot('tactical')
      if (!e.repeat && e.code === CAST_KEY.signature) castSlot('signature')

      if (e.code === 'KeyL' && n?.kind === 'waymark' && n.own) liftWaymark(n.w.id)
      if (e.code === 'KeyH' && zone.kind === 'wilds') goHome()
      else if (e.code === 'KeyH' && currentVisit()) endVisit()   // M61: H on a mate's plot = home
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [panel, fade, zone, waymarks, ww, goHome, leaveGlade, tune, skipDays, allNodes, plantHere, liftWaymark, castSlot, errandToHold, eatHeld, drinkHeld])

  const zoneName = zone.kind === 'plot' ? 'Your plot' : zone.kind === 'glade' ? GLADE_ZONE_NAME : 'The Wilds'
  // Phone taps: only what applies here and now, each the key this page already handles.
  const meleeReady = useMeleeReady()
  const rodOut = zone.kind === 'wilds' && !!ww && held === BAIT && !!toolsRef.current.rinning; rodOutRef.current = rodOut   // M82 s2: exactly when RinningFX is out
  const touchActions: TouchAction[] = [
    ...(useLabel(heldUseNow) ? [{ code: 'KeyE', key: 'E', label: useLabel(heldUseNow)!, near: true }]   // M45: the Use button for what is in hand
      : prompt ? [{ code: 'KeyE', key: 'E', label: prompt.startsWith('E · Gregory') ? 'Gregory' : 'use', near: true }] : []),
    ...(prompt?.includes('L lift') ? [{ code: 'KeyL', key: 'L', label: 'lift', near: true }] : []),
    { code: 'KeyM', key: 'M', label: 'map' },
    { code: 'KeyO', key: 'O', label: 'options' },
    ...(zone.kind === 'plot' ? [{ code: 'KeyC', key: 'C', label: 'friends' }] : []),
    { code: 'KeyI', key: 'I', label: 'pack' },
    // a phone button sends down + up at once, so it cannot HOLD R: stowing gets its own button while something is in hand
    ...(stance.kind !== 'stowed' ? [{ code: 'Stow', key: 'R', label: 'stow' }] : []),
    ...(zone.kind === 'plot' && stance.kind === 'stowed' && meleeReady ? [{ code: 'Melee', key: '✊', label: 'hit', near: true }] : []),   // M42: three hits pop it into the bag
    ...(zone.kind === 'wilds' ? [
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
        // M44 (profile dcff05b4): three's checkShaderErrors reads getProgramInfoLog/getShaderInfoLog after EVERY link, a SYNC
        // GPU wait (up to 1.3 s in one arrival frame). Dev keeps the check so a broken shader still shouts.
        onCreated={({ gl, scene, camera }) => { rendererRef.current = { gl, scene, camera }; canvasEl.current = gl.domElement; gl.debug.checkShaderErrors = process.env.NODE_ENV !== 'production' }}
      >
        <ProgramKeeper />
        {zone.kind === 'wilds' && <WarmProxies key={epoch} />}   {/* M44: late-mounting shader variants, compiled behind the arrival veil */}
        {zone.kind === 'wilds' && <ZonePartsView parts={wildsParts} />}   {/* M84 s3b */}
        <OpenHands ref={handsApi} held={rodOut ? <HeldRod /> : <HeldItem id={stance.kind === 'item' ? held : null} />} />
        <FpGun ref={gunApi} />
        <ThirdPersonBody drive={dollDrive} camRef={camRef} />
        {zone.kind === 'plot' && <BuildPointer />}
        <VoxelDayNight gloomAt={zone.kind === 'wilds' && ww ? (x, z) => ww.canopyAt(x, z) * 0.7 : undefined} />
        {zone.kind === 'plot' && <PlotScene owned={owned} pages={pagesNow} linked={cl.frame.linked} />}
        {zone.kind === 'plot' && <AnemonyxIfHere clock={clock} />}
        {zone.kind === 'plot' && <WorkshopScene pose={poseRef} owned={owned} stowed={stowedNow} />}
        {zone.kind === 'plot' && <ClusterScene frame={cl.frame} />}
        {zone.kind === 'glade' && <><PlotScene owned={GLADE_OWNED} pages={0} linked lift={gladeMeshLift} /><ClusterScene frame={GLADE_FRAME} lift={gladeMeshLift} /><GladeCluster ground={ground} /><GladeWater layer={gladeLayer} /><ZonePartsView parts={gladeParts} /></>}   {/* M67 s1a */}
        {(zone.kind === 'wilds' || plotMp) && <RemoteKeepers peers={mp.peers} me={() => poseRef.current} />}
        {zone.kind === 'plot' && cover !== 'none' && <GroundCover cover={cover} ground={ground} skip={coverSkip} focus={poseRef} />}
        {zone.kind === 'wilds' && ww && <ForestryFX ww={ww} aim={aimRef} fx={fxRef} ground={ground} />}
        {zone.kind === 'wilds' && <ChannelFocus focus={focusRef} />}
        {zone.kind === 'wilds' && ww && <ProspectingFX ww={ww} aim={cAimRef} fx={cFxRef} ground={ground} mineable={c => mineCheck(c.kind, c.id).ok} />}
        {zone.kind === 'wilds' && ww && <RinningFX ease={easeOf(toolsRef.current.rinning)} waterY={WILDS_WATER_Y} isWater={rinWaterAt} roll={rinRoll} rarer={rinRarer} api={rinApi} holding={reelHold} out={held === BAIT && !!toolsRef.current.rinning} onCatch={onCatch} onGone={onGone} />}
        {zone.kind === 'wilds' && ww && [...ww.loaded].map(([name, T]) => { const t = ww.byName.get(name)!; return <group key={name} position={[t.tx * TILE_M, 0, t.ty * TILE_M]}><WildsScene W={T} waymarks={waymarks} infected={infectedSet} focus={poseRef} off={{ x: t.tx * TILE_M, z: t.ty * TILE_M }} />{net && <TilePaths net={net} W={T} off={{ x: t.tx * TILE_M, z: t.ty * TILE_M }} />}</group> })}
        {ww && <DeathPack active={zone.kind === 'wilds'} />}
        {zone.kind === 'wilds' && ww && <><CloudReefs layout={reefLayout} /><CloudDeck squares={deckLayout} size={TILE_M} y={WILDS_WATER_Y - 0.1} /><HorizonRing y={WILDS_WATER_Y} /></>}   {/* M24: the sea turns to cloud past the map */}
        {zone.kind === 'glade' && <><MoonwellPool ground={ground} stowed={() => stanceRef.current.kind === 'stowed'} /><GladeLots /></>}   {/* M67 s1b-2: the Glade's backdrop in Greg's garden */}
        {zone.kind === 'glade' && <GladeGreg loaded={(x, z) => { const y = gladeZoneGround(x, z); return Number.isFinite(y) ? y : null }} tour={tour} hold={panel?.kind === 'talk' || panel?.kind === 'greg'} keeper={poseRef} onArrive={onTourArrive} live={gregLive} />}
        {zone.kind === 'wilds' && ww && net && <Settlements net={net} loaded={(x, z) => ww.tileAtPoint(x, z) ? ww.heightAt(x, z) : null} />}
        {zone.kind === 'wilds' && ww && <FirstSettlement loaded={(x, z) => ww.tileAtPoint(x, z) ? ww.heightAt(x, z) : null} />}   {/* M70 s1 */}
        {zone.kind === 'wilds' && ww && net?.fair && ww.tileAtPoint(net.fair.x, net.fair.z) && <BigTop fair={net.fair} y={ww.heightAt(net.fair.x, net.fair.z)} />}
        {terrain && (
          <CombatLayer spirits={spiritFight} T={terrain} locked={locked} frozen={frozen} active={zone.kind === 'wilds' && fade === 0}
            groundAt={ww ? (x: number, z: number) => biomeGround(ww.biomeAt(x, z)) : undefined}
            safe={WILDS_SAFE} onEvents={onCombat} onHud={onCombatHud} reviveKey={reviveKey} armed={stance.kind === 'weapon' && !!held} gunId={stance.kind === 'weapon' ? held : null} reloadTick={reloadTick} mana={manaRef.current} skin={skinRef.current} nodes={nearNodes} ownerOf={nodeOwner} casts={castQueue} onCast={onCast} eats={eatQueue} sight={sightRef} channel={castChannel} />
        )}
        {folkTalk.node && folkTalk.bubbleAt && zone.kind !== 'plot' && <TalkBubble at={folkTalk.bubbleAt} name={folkTalk.name} line={folkTalk.node.line} scene={(folkTalk.node as { scene?: string }).scene} />}
        {zone.kind === 'plot' && tableVisit && !visitNow && (() => {   /* M61: your Greg never stands at a mate's table */ const g = TABLE_STOP.at, p = poseRef.current; return (
          <group position={[g.x, plotHeightAt(g.x, g.z), g.z]} rotation-y={Math.atan2(p.x - g.x, p.z - g.z)}><FolkModel look={folkLook('gregory')} action={tourNode || talkNode ? 'talk' : 'idle'} /></group>) })()}
        {(talkNode ?? tourNode) && (zone.kind === 'glade' || (tableVisit && !visitNow)) && <TalkBubble at={[gregHead.x, gregHead.y + 0.95, gregHead.z]} name="Gregory" line={(talkNode ?? tourNode)!.line} />}
        {zone.kind === 'plot' && fennelAt && <Fennel spot={fennelAt} y={plotHeightAt(fennelAt.x, fennelAt.z)} talking={!!fennelNode} />}
        {zone.kind === 'plot' && !visitNow && <IdleMoglins w={works} />}   {/* P1 11-23: recruits with no room wait by the planning table */}
        {spiritTalk.node && spiritTalk.head && zone.kind === 'plot' && <TalkBubble at={[spiritTalk.head.x, spiritTalk.head.y + 0.5, spiritTalk.head.z]} name={spiritTalk.name} line={spiritTalk.node.line} />}   {/* M109 s1 */}
        {idleTalk.node && idleTalk.head && zone.kind === 'plot' && <TalkBubble at={[idleTalk.head.x, idleTalk.head.y + 0.5, idleTalk.head.z]} name={idleTalk.name} line={idleTalk.node.line} />}
        {friendTalkNode && friendHead && friendC && <TalkBubble at={[friendHead.x, friendHead.y + 0.5, friendHead.z]} name={FRIEND_NAME[friendC.f]} line={friendTalkNode.line} />}   {/* M68 s3a */}
        {settlerTalkNode && settlerHead && settlerSpeaker && <TalkBubble at={[settlerHead.x, settlerHead.y + 0.5, settlerHead.z]} name={settlerSpeaker.name} line={settlerTalkNode.line} />}   {/* M70 s1 */}
        {gFennel.node && gFennel.head && zone.kind === 'glade' && <TalkBubble at={[gFennel.head.x, gFennel.head.y + 0.5, gFennel.head.z]} name="Fennel" line={gFennel.node.line} />}   {/* M68 s3b */}
        {fennelNode && fennelHead && zone.kind === 'plot' && <TalkBubble at={[fennelHead.x, fennelHead.y + 0.5, fennelHead.z]} name={FENNEL_NAME} line={fennelNode.line} />}
        <QuestGuide zone={zone.kind === 'plot' ? 'ather' : zone.kind} ground={ground} water={zone.kind === 'wilds' ? rinWaterAt : undefined} />   {/* M67 s1b-2: the Glade's quest steps (the Moonwell wait, Greg) point here too */}
        {spiritFight && terrain && zone.kind === 'wilds' && fade === 0 && !visitNow && <WildsSpirits T={terrain} keeper={poseRef} />}   {/* M127 s1 */}
        {world && fade === 0 && <CompanionFollower pose={poseRef} ground={ground} />}
        <GateRings gate={castGate} />
        {world && (
          <Walker
            key={epoch} world={world} ground={ground} spawn={spawn} locked={locked} frozen={frozen} focus={talkFocus}
            fallY={zone.kind !== 'wilds' ? FALL_Y : -60}
            onFall={zone.kind === 'glade' ? gladeFall : goHome}
            onTick={onTick} sink={sinkRef}
          />
        )}
      </Canvas>
      {!building && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, margin: -2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />}
      <GameHud size={hudSize} pose={poseRef} marks={marksRef} vitals={vitalsRef} mana={manaRef} entries={hotbar} sel={litSlot(stance, inv)} onSelect={i => setStance(st => selectSlot(st, i, getInv()))} onEquip={i => setStance(st => equipSlot(st, i, getInv()))} tools={toolsRef} skills={skillsRef} casts={castHud}
        // never dimmed in the Ather (Alex 11-17: 'the hotbar stays greyed out and doesnt highlight'): the plot uses the bar now
        // (Keepstones, furniture, bait), and HearthHotbar drops the selected slot's light while dimmed (selected = i === sel && !dimmed)
        dimmed={false} input={!panel && !fade && !optionsOpen && !building}
        minimap={ww && zone.kind !== 'glade' && <AtherMiniMap size={hudSize} zone={zone.kind} world={ww} wrev={wrev} fog={fog} tileOff={tileOff} pose={poseRef} waymarks={waymarks} regionsByTile={regionsByTile} cluster={cl.frame}
          owned={owned} onExpand={() => setPanel({ kind: 'map', view: 'ather', travel: false })} />}
        status={[
          { label: hud.where },
          ...(zone.kind === 'wilds' && chud ? [{ label: chud.gun.charAt(0) + chud.gun.slice(1).toLowerCase(), value: chud.reloading ? 'reloading' : `${chud.ammo} / ${chud.clip}` }] : []),
          ...(potionCool > 0 ? [{ label: 'Potion', value: `${potionCool} s` }] : []),   // M78: the shared cooldown
          { label: 'Grey matter', value: garden.grey, accent: true },
          { label: 'Grimoire', value: pagesNow },
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
        <FoldMap view={panel.view} travel={panel.travel} W={W} fog={fog} waymarks={waymarks} infected={infectedSet} here={{ x: pos.current.x - hereOff.x, z: pos.current.z - hereOff.z }}
          inWilds={zone.kind === 'wilds'} onTravel={travel} tile={hereTile} pitstops={pitstops}
          nodes={(nodesByTile.get(hereTile) ?? []).filter(n => infectedSet.has(n.id)).map(n => ({ ...n, x: n.x - hereOff.x, z: n.z - hereOff.z }))} regions={regions}
          area={ww ? { world: ww, regionsByTile, cx: hereOff.x, cz: hereOff.z, tileOff, nodes: nodes.filter(n => Math.abs(n.x - hereOff.x) < 1600 && Math.abs(n.z - hereOff.z) < 1600), here: { x: pos.current.x, z: pos.current.z } } : undefined}
          onClose={() => setPanel(null)} goal={errandToHold || runeHoldPulse(chain) ? LANDING.id : undefined} flipPulse={flipPulse(chain)} digGoal={runeHoldPulse(chain) && !errandToHold} onFlip={() => setPanel(p => p?.kind === 'map' ? { ...p, view: p.view === 'ather' ? 'athernyx' : 'ather' } : p)} />
      )}
      {folkTalk.node && <TalkChoices node={folkTalk.node} phone={hudSize === 'phone'} />}
      {(talkNode ?? fennelNode ?? friendTalkNode ?? settlerTalkNode ?? gFennel.node ?? idleTalk.node ?? tourNode) && <TalkChoices node={(talkNode ?? fennelNode ?? friendTalkNode ?? settlerTalkNode ?? gFennel.node ?? idleTalk.node ?? tourNode)!} phone={hudSize === 'phone'} />}
      {spiritTalk.node && <TalkChoices node={spiritTalk.node} phone={hudSize === 'phone'} />}
      {spiritTalk.panel}
      {panel?.kind === 'greg' && <GregPanel garden={{ ...garden, pages: pagesNow }} onBuy={buy} onClose={() => setPanel(null)} />}
      {panel?.kind === 'cluster' && <ClusterPanel c={cl} onClose={() => setPanel(null)} />}
      {panel?.kind === 'shop' && <ShopPanel id={panel.id} ledger={ledger} setLedger={setLedger} onClose={() => setPanel(null)} isTouch={isTouch} />}   {/* M114 s2: a Shop zone */}
      {panel?.kind === 'brew' && <BrewingPanel station={panel.station} onClose={() => setPanel(null)} />}
      {panel?.kind === 'adesk' && <AngelicaDeskPanel onClose={() => setPanel(null)} say={s => hudSay(s, 'item')} onBrewed={() => { const t = loadTut(), t1 = brewed(t); if (t1 !== t) setTut(t1) }} />}   {/* M70 s3 */}
      {panel?.kind === 'work' && !visitNow && <WorkshopPanel near={panel.near} owned={owned} onClose={() => setPanel(null)} />}
      {zone.kind === 'plot' && <PlacingBar owned={owned} />}
      {zone.kind === 'plot' && !visitNow && <BuildBar owned={owned} />}
      {visitNow && <VisitPill name={visitNow.name} ready={!!visitNow.snap} onHome={() => endVisit()} />}
      {!visitNow && <GuestsPill guests={guestsHere} onSend={id => { if (plotNet.sendHome(id)) hudSay('Sent home.', 'info', 3) }} />}
      <LookChip />
      {zone.kind === 'wilds' && held === BAIT && <ReelBar api={rinApi} />}
      {optionsOpen && <OpenOptions onClose={() => setOptionsOpen(false)} inGarden={zone.kind === 'plot'} />}
      <OpenSocial />   {/* M27: presence + invites + the Play together panel */}
      <BirthGate />
      {panel?.kind === 'pack' && <PackMenu tab={panel.tab} onTab={t => setPanel({ kind: 'pack', tab: t })} onClose={() => setPanel(null)} sel={litSlot(stance, inv)} isTouch={isTouch} />}
      {resuming && <LoadScreen side="ather" />}
      <div ref={voidDark} data-veil="void" style={{ position: 'absolute', inset: 0, background: '#000', opacity: 0, pointerEvents: 'none' }} />
      <div data-veil={resuming ? 'resume' : 'fade'} style={{ position: 'absolute', inset: 0, background: '#f6f1e4', opacity: resuming ? 1 : fade, transition: resuming ? 'none' : 'opacity 0.35s', pointerEvents: 'none' }} />
      {isTouch && !panel && !building && (
        <TouchControls showFire={zone.kind === 'wilds'} actions={touchActions} holds={SKIN_HOLDS} />
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
