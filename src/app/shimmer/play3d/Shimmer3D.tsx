'use client'
// Phase 1 foundation: the blockout map walkable in 3D, blocky tiered terrain, and an in-3D
// BLOCKOUT TOOL — press B for edit mode, pick a tool (Raise/Lower/Wall/Water/Floor) + brush size
// from the on-screen palette, click/drag the terrain, then Save. Height tools edit the per-zone
// height grid; cell tools edit the tile grid (so you can remove water/walls). Save persists both
// (heights→/shimmer/save-heights, grid→/shimmer/save-map). Warps/collision reuse the 2D engine.
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, PerformanceMonitor } from '@react-three/drei'
import { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback, memo, Component, type ReactNode } from 'react'
import * as THREE from 'three'
import { walkable } from '../engine/player'
import { resolveStand, canStandAt, surfacesAt, EMPTY_SEGS, type CollisionCtx } from '../engine/segs-collision'
import { SOLID } from '../world/tiles'
import { getZone, checkWarp, gateFootprint, HOLD_MAP, type Zone, type Warp, type Gate } from '../world/zones'
import { CHUNK, DEFAULT_RADIUS, chunkOf, sameChunk, chunkVisible, viewFar, fogNear, type ChunkCoord } from '../world/chunk-stream'
import { ALL_ZONES } from '../world/all-zones'
// The far end of the Ather crossing. `engine/crossing.ts` holds the contract and the reasoning;
// this file is the half that receives. See the boot effect for why the read lives where it does.
import { consumeArrival, stageEntry } from '../engine/crossing'
import { nearestGate } from '../voxel3d/crossing-out'
// ★ CARVED HEARTH PHASE 9, THE MORTAL SIDE (2026-09-23): the keeper's HUD is one object in both
// dimensions (the `hud/clock.tsx` rule), so this side takes the same `HearthHudLayer` the Ather
// mounts — bar, lip, vessel + tool arch, sized wide/compact/phone — and the hearth's own objective
// pill, clock pill, map frame and ☰ knob. It takes the LOOK, not new readouts: no always-on health
// (this side never had one; its bars are the drawn-weapon combat readout), and its buffs/companion
// column stays its own. Each piece keeps its own show-rule, which is why the frame, objective and
// clock are mounted here rather than by the layer.
import { HearthHudLayer, hudMapBox, hudDoorTop, HUD_BAR_CLEAR } from '../ui/hearth-hud-layer'
import { HudPlate, HearthMapFrame, HearthObjective, HearthClock, HearthChip, HearthPill, HearthPillSoft, fmtRemain, useHudSize } from '../ui/hearth-hud'
import type { HudFace } from '../ui/hud-face'
import { HEARTH_FONT_VARS } from '../ui/hearth-fonts'
import { H, hearthBody, hearthDisplay, HearthFrame, HearthProgress, HearthButton } from '../ui/hearth'
import { ToolGlyph } from '../hud/hud-corner'
/** Alex's pick for the always-on HUD (2026-09-23) — the Ather's `HUD_FACE`, same value. */
const HUD_FACE: HudFace = 'full'
import { SayLine } from '../hud/say-line'
import { Prompt } from '../hud/prompt'
import { DialogueBox } from '../hud/dialogue-box'
import { createGuideTrail } from '../voxel3d/guide-trail'
import { createHands, GLOVE_MODEL_URL, type Hands } from '../voxel3d/hands'
import type { GuideTarget } from '../voxel3d/guide-target'
import { forkTarget, forkObjective, forkFlags, MET_GREG_FLAG, STATION_FLAG } from './fork'
import { OptionsPanel, OptionRow, OptionHead, OptionSlider } from '../hud/options-panel'
import { OptionsDoor } from '../hud/options-door'
import { loadSettings, saveSettings } from '../voxel3d/settings'
import { setMasterVolume } from '../audio/bus'
import { LANDING_LABEL } from '../world/landing'
import { getHeightGrid } from '../world/heightmaps'
import { GardenAtmosphere } from '../world/atmosphere'
import { dayProgress, sunElevation, sunAzimuth, daylight, getPhase, getDisplayTime, CYCLE_MS, isTimePinned } from '../engine/day-cycle'
import { WORLD_SEED, currentWindow, nodeAlpha, zoneWindow, msUntilZoneReset, isBoardPinned, isFadeTest, fadeTestAlpha, slotKey, zoneBand, TIER_WEIGHTS, NOTHING_WEIGHT, FADE_OUT_MS, type DealtNode } from '../engine/spawn-board'
import { FloraTree, FloraDressing } from '../world/flora'
import { StationProp, GhostProp } from '../world/prop-models'
import { RemotePlayers, useRoster } from './RemotePlayers'
import { useMultiplayer, storedName, storeName, type RemotePlayer } from './multiplayer'
import { useParty, newPartyCode, sanitizePartyCode, inviteUrl } from '@/lib/party'
import { useAccount, type UseAccount } from '@/lib/accounts/use-account'
import { pushCloudSave } from '@/lib/cloud-sync'
import { saveKey, saveOwner } from '@/lib/save-slot'
import { birthAffinity, NEUTRAL_AFFINITY, attunementResist, combineResist, type Affinity } from './birth-affinity'
import TremorRing, { TremorSenseHud, emptyReadout, type TremorReadout } from './TremorRing'
import { senseGround, type SensedBody } from './tremor-sense'
import { castForMove, isBuilt, CAST_SLOTS, ALL_BANDS, BAND_KEYS, derivePassive, type CastSpec } from './cast'
import { getRegenRate } from '../engine/mana'
import { moveById } from './keeper-moves'
import { loadLoadout, resolveLoadout, emptySlotSentence, type EmptyReason } from './loadout'
import { stepHunter, hunterRng, RANGE_HUNTER, type HunterCtx } from '../engine/hunter-ai'
import { fillRoster, ROSTER_SIZE } from './crucible-bots'
import { startingPositions } from './crucible-entrances'
import { createFleet, stepFleet, aliveCount, type Fleet, type FleetTarget } from './crucible-fleet'
import { loadRuneInventory, saveRuneInventory, setBirthRune, grantRune, revokeRune, EMPTY_INVENTORY, type RuneInventory } from './rune-inventory'
import { spawnField, tickFields, fieldsAt, absorbShotAt, FIELD_HEIGHT, type Field } from '../engine/field-effects'
import { conjure, shapeCells, blockedAt as conjuredBlockedAt, expireConjured, liveCells, type Conjured } from '../engine/conjured-terrain'
import { emptyBag, applyStatuses, hasStatus, pruneStatuses, clearTarget, type StatusBag } from '../engine/statuses'
import { rollEncounter, HOLD_LEVELS, type WildEncounter } from '../engine/encounters'
import { derivePartyStats, type PartyStats } from '../engine/party-stats'
import { type BattleResult } from '../engine/arena'
import {
  applyFightResult, tickRecovery, fieldableSpirits, partyAllDowned,
  isDowned, hpFracOf, currentHpOf, maxHpOf, healSpirit, reviveSpirit, pickMendTarget,
  activeSpirits, restingSpirits, setSpiritActive, normalizeRoster, canFight, MAX_PARTY,
} from '../engine/spirit-health'
import { getMovesForSpirit } from '../engine/moves'
import { createSpirit, addXP, xpForLevel, speciesDisplayName, ELEMENT_COLORS, type Spirit, type Species, type Element } from '../spirits/spirit'
import { pendingEvolution, evolveSpirit, type PendingEvolution } from '../spirits/evolution'
import EvolutionOverlay from '../components/EvolutionOverlay'
import { spiritsToSave, spiritsFromSave } from '../spirits/spirit-save'
import { LAUNCHED_SPECIES } from '../engine/spirit-index'
import { ZONE_NODES, type NodePlacement } from '../world/node-placements'
import { createResourceNode, depleteNode, tickNodeRespawn, rollDrops, getNodeSkill, nodeTier, NODE_DEFS, type NodeType, type ResourceNode } from '../world/resources'
import { TOOL_DEFS, getEquippedTool, useTool, toolsToSave, toolsFromSave, ensureBasicTools, craftTool, repairTool, type EquippedTools } from '../engine/tools'
import { findAdjacentNode, addHarvestItems } from '../engine/harvesting'
import { newCast as newRinCast, phaseAt as rinPhaseAt, hook as rinHook, type RinCast } from '../engine/rinning'
import { rinBite, rinCatch, rinMiss } from './rin-fx'
import { gatherTick, gatherPop } from './gather-fx'
import BirthScreen from './birth/BirthScreen'
import { RUNES } from './birth/runes.data'
import { createSkillSet, skillSetToSave, skillSetFromSave, addSkillXP, xpForSkillLevel, SKILL_META, type SkillSet, type SkillId } from '../engine/skills'
import { WEAPONS } from '../engine/weapons'
import { createBeast, checkBeastUnlock, beastsToSave, beastsFromSave, BEAST_SPECIES, BEAST_DEFS, BEAST_PERKS, PERK_INFO, getBonusFindChance, getSpeedBonus, type ManaBeast, type BeastSpecies } from '../beasts/beast'
import { getMaxStack, createInventory, inventoryToSave, inventoryFromSave, addItems, removeItems, countItem, transferItem, createChestStorage, chestToSave, chestFromSave, type Inventory, type ItemStack, type ChestStorage, type ChestSave } from '../engine/inventory'
import { createBank, bankFromSave, bankToSave, bankUsed, bankCapacity, bankDeposit, bankWithdraw, bankForceDeposit, bankReachable, isChestFurniture, migrateChestsToBank, CHEST_CAPACITY, type BankState, type BankSave } from '../engine/bank'
import { ITEMS, NODE_TYPE_LABELS } from '../sprites/items'
import { startPerfLog, mark, logPerf } from './perflog'
import { createManaPool, manaToSave, manaFromSave, getMaxPool, type ManaPool } from '../engine/mana'
import { brewPotion, POTION_DEFS, elementForInfusion, applyInfusion, INFUSION_BREWS } from '../engine/alchemy'
import { MANA_POTIONS, HEAL_POTIONS, SPIRIT_MEND_POTIONS, MEND_POTION_ID, POTION_BUFFS, BUFF_DEFS, HARVEST_BREW_ADVANCE_MS, drinkBuff, activeBuffList, pruneBuffs, gatherXpMult, bonusFind, kindredMult, speedMult, manaRegenMult, rinTune, suppressEncounters, potionEffectLine, potionBuffLine, type ActiveBuffs } from '../engine/potion-effects'
import { canCraft, craftItem, RECIPE_DEFS } from '../engine/crafting'
import { createGEState, buyFromGE, sellToGE, tickPriceDrift, GE_ITEM_IDS, geToSave, geFromSave, type GEMarketState, type GESave } from '../engine/exchange'
import { CROP_DEFS, plantCrop, harvestCrop, plantedCropsToSave, plantedCropsFromSave, isCropReady, MANA_SEED_ITEM, type PlantedCrop } from '../engine/farming'
import type { AITier } from '../engine/battle-ai'
import ArenaBattle from '../components/ArenaBattle'
import PartyPanel from './PartyPanel'
import { HOTBAR_SLOTS, type HotbarEntry } from '../hud/hotbar'
import { BagPanel, itemLabel, type SlotRef, type Lift } from '../hud/satchel'
import { moveBetween, moveCount, halfOf } from '../voxel3d/chest'
import { createSpiritIndex } from '../engine/spirit-index'
import { NPCS_3D, GREG_SQUARE_LINES, GREG_INTRO_LINES, GREG_NUDGE, GREG_RETURN, THISTLE_TAUNT_NO_SPIRIT, THISTLE_PREFIGHT, THISTLE_DEFEAT, FREED_SPIRIT_BEAT, VETCH_PREFIGHT, VETCH_DEFEAT, FREED_PAIR_BEAT, BRACK_PREFIGHT, BRACK_FINALE, TRADER_LINES, type NPC3D } from './npcs3d'
import { useCloudSave } from '@/lib/use-cloud-save'
import { useWallet } from '@/lib/use-wallet'
import { keeperBook, saveBook } from './book'
import { PassagePanel } from './PassagePanel'
import { PassageScene } from './PassageScene'
import { ArcadeCabinet } from './ArcadeCabinet'
import { PASSAGE, type ShelfKey } from './passage-hall'
import type { GameEntry } from '@/lib/games'
import { EMPTY_BOOK, type Book } from './scroll-market'
import { StationMenus, type PlacedStruct, type StationKind } from './StationMenus'
import { prettyItem } from './ui'
import { GfxPanel, FrameProbe, type FrameStats, type SaveStats } from './GfxPanel'
import MoveBook from './MoveBook'
import { GUARDS, GUARD_TUNING, initEncounter, stepEncounter, damageGuard, specOf, type GuardTuning } from './puppet-guards'
import { K as HB, STOREY as STOREY_H, BLOCK_H } from './hold-building'
import { HOLD_TUNING, DROP_NAME, startHold, stepHold, hitBody, releaseSurge, promptAt, buyGate, buyRack, buyFont, buyCache, mendTick, endHold, fieldStrike, ownerOpenAll, ownerCalm, holdSpots, holdSolid, holdSurfaces, roundBlocked, isLoud, fmtHush, type HoldState, type HoldPrompt } from './hold'
// ── ★ THE MATCH CLOCK, WIRED 2026-09-05 ────────────────────────────────────────────────────────
// `crucible-phases.ts` has been written, canon-accurate and 42/0 green since it landed, and imported
// by NOTHING — 185 lines deriving the floors, the windows, the seal and the Vault from elapsed
// seconds, with three other files carrying comments that CITE it as done. A tested module with no
// consumer reads as covered from every angle except the one that asks who calls it.
import { crucibleAt, LEVEL_WINDOWS, MATCH_END_SEC, VAULT_END_SEC, TUNING as CRUCIBLE_TUNING } from './crucible-phases'
import { stepPrize, resetPrize, type PrizeState } from './crucible-prize'
import { clearTrial } from './vessel-drops'

/**
 * The T range-console settings, in one place.
 *
 * `tune` rides here rather than on its own ref because the guard numbers ARE a range-console
 * setting — the console is where they are turned, and threading a second ref through the same
 * five call sites would only give the two halves a chance to disagree. The shape was written out
 * inline in three separate places before this; three copies of a type is three chances to add a
 * field to two of them.
 */
export type RangeCfg = {
  moving: boolean
  hostile: boolean
  guards: boolean
  /** the Crucible bot fleet — 59 challengers on the extracted hunter brain (#302) */
  bots: boolean
  /** live guard tuning — first guesses until Alex has felt them (focus #298) */
  tune: GuardTuning
}

/**
 * The knobs the range console exposes, as DATA.
 *
 * Only the ones that change how the fight FEELS moment to moment, and only ones that take effect
 * on the running encounter — a slider that needs a re-arm to do anything is indistinguishable from
 * a broken one while you are dragging it. `boxStartRadius` is deliberately absent for exactly that
 * reason (it is read once at spawn); `counterReturn` is absent because it is a damage number, not
 * a feel number, and the panel earns its place by staying short.
 */
const GUARD_KNOBS: {
  key: keyof GuardTuning; label: string; min: number; max: number; step: number; dp: number; unit: string
}[] = [
  { key: 'phaseSec',         label: 'PHASE LENGTH',  min: 1.5, max: 14, step: 0.5,  dp: 1, unit: 's' },
  { key: 'claimPerPhase',    label: 'SEREN CLAIM',   min: 0,   max: 6,  step: 0.2,  dp: 1, unit: 'm/s' },
  { key: 'boxShrink',        label: 'BOX SHRINK',    min: 0.5, max: 1,  step: 0.02, dp: 2, unit: '×' },
  { key: 'boxMinRadius',     label: 'BOX FLOOR',     min: 3,   max: 14, step: 0.5,  dp: 1, unit: 'm' },
  { key: 'counterWindowSec', label: 'WREN WINDOW',   min: 0,   max: 3,  step: 0.1,  dp: 1, unit: 's' },
  { key: 'staggerSec',       label: 'STAGGER',       min: 0.2, max: 4,  step: 0.1,  dp: 1, unit: 's' },
]
import { loadGfx, storeGfx, gfxKey, dprCeiling, SHADOW_MAP_SIZE, DPR_FLOOR, type GfxSettings } from './gfx'
import { WorldMap, MiniMap } from './WorldMap'
import { WORLD_ZONE_ID, registerGardenWorld, getGardenWorld, isStitched, fromWorld } from '../world/garden-world'
import { allNpcs, nodePlacementsFor, dealtNodesFor, spawnerPlacementsFor, logicalZoneAt, structuresView, logicalStruct } from './world-adapter'
import { ZONE_SPAWNERS, type SpawnerPlacement } from '../world/spawn-placements'
import { MOGLIN_FUR, MOGLIN_FUR_LIGHT, GATE_COLORS } from './moglin-look'
import * as S from './scene-palette'
import { keeperKey } from '@/lib/keeper-local'
import { mint } from './tokens'
import { patrolDown, markBeaten, pruneBeaten, patrolLoop, patrolPose, type BeatenRecord, type PatrolLoop, type WanderDials } from '../engine/burrows'
import type { DealWindow } from '../engine/spawn-board'
import { regionIdOf, REGION_FILES, regionSpawnConfig, migrateLegacyPosition, WILDS_ZONE, WILDS_GEO, loadWildsRegion, isRegionZone, regionDisplayName } from '../world/region-maps'
import { cloneSparseGrid, materializeRows, newMount, syncWilds, type WildsMount } from '../world/wilds-world'

// The composed continent registers as a zone before any getZone/save-load runs.
registerGardenWorld()
const ALL_NPCS = allNpcs()

// ⚠ THE `?zone=` ESCAPE HATCH THIS LINE PROMISED DOES NOT EXIST (measured 2026-08-24). Nothing in
// `src/app/shimmer/` or `src/lib/` reads a `zone` query param — `play3d/page.tsx` does not contain the
// word — while `mode` IS read in two other pages, so the mechanism exists and this one specifically
// does not. Either it was never wired or cutover took it; the comment kept promising it regardless.
//
// ★ IT COST REAL TIME: scoping the voxel3d → Rune Hold crossing, this line was read as "the mortal
// world is already reachable by URL", and the walker-to-walker crossing was nearly built on top of
// a route that resolves nothing. A doc that claims a CAPABILITY is worse than one that claims a
// fact — you do not verify a capability, you build on it. Restoring the param is a decision and is
// not taken here; the claim is retired so the next person scopes from what exists.
// ── ★ THE FRESH KEEPER STANDS IN THE SQUARE (2026-09-15, Alex: the engine is the dimension) ──
// play3d is the MORTAL SIDE, and Beat 0 (`shimmer-quests-mainmap.md`: "on first load, keeper
// standing on the crossroads square") is its first scene. A fresh save used to boot into
// `r-home-plot`, the tile Home Plot — the OLD Ather side, which the voxel world replaced. So the
// front door delivered a new keeper to the mortal side and this constant walked them straight back
// into a plot that is not the plot. The town is the pivot now; the Ather is the other route.
const START_ZONE = 'rune-hold'
const GREG_SQUARE = NPCS_3D.find(n => n.id === 'gregory-square')!
const SPIRIT_CORNER_STEP = { x: 23, z: 49 } as const
const WATER_ID = 8, FLOOR_ID = 97, WALL_ID = 34, WARP_ID = 14, MIST_ID = 31
// The mortal side's wall. Clouds and mist are ATHER-only — a town built out of cloud reads as
// sky, which is the tonal wall canon splits on. Solid like a cloud, drawn brown.
const BUILDING_ID = 103
/** The hold's zone id (`world/zones.ts`). Everything the hold adds to the walker and the range asks this. */
const HOLD_ZONE = 'the-hold'
/** The Passage draws its own rock and fixtures (`PassageScene`) and has its own light. */
const PASSAGE_ZONE = 'the-passage'
const HOLD_BEST_KEY = 'ather:shimmer:hold:best'
// Encounters: stepping onto a fresh MIST tile can draw a wild spirit. Per-zone odds live in
// ENCOUNTER_TABLES (engine/encounters.ts → `rate`); these dials shape it for the 3D walker so a
// 888-mist zone isn't wall-to-wall battles.
const ENCOUNTER_GRACE = 1.3 // seconds after a battle / zone-entry before mist can roll again
const VOID = -1 // empty cell — renders nothing, not walkable (draw land onto an empty grid)
const STEP = 1.0
const MAX_TIER = 8
const UP = new THREE.Vector3(0, 1, 0)
// First-person rig: camera sits at eye height on the walker; wider fov for the Supra FPS feel
// (orbit follow-cam keeps the calmer 45). Camera-only for now — movement still rides the flat-grid
// canStand() until the world lane exposes a segs-collision read-API.
const EYE_H = 1.15          // eye offset above the player's foot position (capsule center is +0.7)
const EYE_SLIDE = 0.5       // eye dips this low mid-slide (crouched)
const FPS_FOV = 72
const ADS_FOV = 50   // aim-down-sights zoom (outside-Ather weapon); lerped from FPS_FOV on right-click hold
const ORBIT_FOV = 45
// ── Locomotion feel (tier units; STEP=1 so tiers≈world units). All Alex-tunable. Apex-style flow. ──
const RUN_SPEED = 6.5       // AUTO-RUN: the default sustained ground speed (no sprint key)
const BACK_SPEED = 3.5      // backpedal cap — moving against your look dir stays a walk (no reverse-sprint)
const CROUCH_SPEED = 2.6    // crouch-walk speed (hold crouch while slow / standing)
const GROUND_ACCEL = 7      // ramp-UP rate toward target speed — the "starts as a walk, builds to a run" flow
const GROUND_FRICTION = 13  // coast-DOWN rate on release (stop has weight, not a dead halt)
const GRAVITY = 22          // downward accel while airborne
const JUMP_V0 = 7.4         // jump launch speed → ~1.25-tier apex (clears a 1-tier step, reaches low segs)
const SLIDE_SPEED = 10      // slide speed FLOOR — a fast entry scales above it (curSpeed * 1.35)
const SLIDE_MIN_SPEED = 3.8 // crouch below this speed = crouch-walk; at/above = a slide
const SLIDE_TIME = 0.6      // slide duration before it bleeds back to the run
const AIR_CONTROL = 0.4     // how much WASD can steer horizontal velocity while airborne (0=none,1=full)
// ── Tier-1/2 movement tech (slide-hop · bhop chain · lurch) — all tunable, Apex/Titanfall lineage ──
const SLIDEHOP_BOOST = 1.12 // jump mid-slide multiplies current speed by this (the slide-hop pop)
const SPEED_CAP = 14        // hard ceiling on any takeoff speed — keeps hop-chains from going infinite
const BHOP_WINDOW = 0.15    // jump within this many seconds of landing = chain: keep incoming air speed
const BHOP_KEEP = 0.97      // each chained hop keeps this fraction (gentle fatigue, not a hard cap)
const LURCH_TURN = 0.64     // input-direction dot below this (≈50°+ turn) while airborne = a lurch
const LURCH_STRENGTH = 0.65 // how hard a lurch snaps momentum toward the new input direction
const LURCH_KEEP = 0.93     // speed kept through a lurch (small cost, Titanfall-style)
const FALL_OFF = 0.32       // step down more than this below the resolved floor → you've walked off a ledge → fall
const PLAYER_R = 0.4        // body radius — keeps the first-person eye this far out of walls/objects (no clip-in)
const CLIMB_SPEED = 2.5     // upward speed while wall-climbing (tier units/s) — a deliberate scramble, not a rocket
const CLIMB_STRAFE = 1.6   // lateral speed while climbing — A/D slide you ALONG the wall face (W just climbs)
const CLIMB_MAX_RISE = 2.5  // max VERTICAL rise per climb before the grip gives out (tiers). Caps distance,
                            // not time — refills only on solid ground, so you scale multi-tier terrain one
                            // ledge at a time but can't scramble up a single tall face forever.
const MANTLE_REACH = 1.4    // grab reach (tiers): airborne, if a ledge/wall TOP ahead sits within this above
                            // your feet, TAP JUMP to pull up over it. Jump alone reaches low ledges; jump then
                            // wall-climb brings a taller wall's top into reach. Skill-timed, works on any wall.
const TEST_WALL_MOONWELL = true  // TEMP scaffold (mechanics lane): stamps a stepped test wall (1..6 tiers) in
                                 // moonwell-glade for climb/mantle feel-testing. Flip false / delete to remove.
const WALLJUMP_UP = 7.0     // vertical kick of a wall-jump (~JUMP_V0; carries you up the face in bounds)
const WALLJUMP_PUSH = 6.0   // horizontal shove AWAY from the wall along wallNormal (near run speed)
const WALL_COYOTE = 0.18    // grace after leaving a wall in which Space still counts as a wall-jump
const WALLJUMP_LOCK = 0.22  // after a kick, suppress re-gripping the SAME wall so the push separates
const CLIMB_HOLD_MIN = 0.18 // Space must be HELD this long before climb/mantle engage. A jump tap (~80-120ms)
                            // never reaches it → tapping Space is ALWAYS a pure ballistic jump, never a mantle.
                            // This is the Apex release-vs-hold line: tap = bounce/jump, HOLD = climb. Kills the
                            // "jump lunges sideways" bug where a tap-jump near a wall was read as a mantle-grab.
const HANG_DROP = 0.9       // how far below the lip your grip sits while ledge-hanging (tiers) — you hang OFF the
                            // edge, head near the top, not standing on it. The PAUSE that replaces the teleport.
const MANTLE_TIME = 0.30    // seconds to pull up + over once you COMMIT a hang (press forward) — a visible
                            // climb-over, never an instant snap. This is what killed the "teleport" feel.
const HANG_COMMIT = 0.35    // input·(over-lip cardinal): press INTO the ledge past +this to pull up, AWAY past
                            // -this to drop off. Neutral = keep hanging.
const HANG_MIN = 0.22       // guaranteed grip beat (s) before commit/drop can fire — so even climbing up with W
                            // held you CATCH and hang for a moment, never insta-mantle. This IS the "pause".
const DIR_YAW: Record<string, number> = { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }

type Cell = [number, number]
type SpawnerTool = 'sp_thistle' | 'sp_vetch' | 'sp_brack'
type Tool = 'raise' | 'lower' | 'floor' | 'wall' | 'water' | 'mist' | 'warp' | 'void' | NodeType | SpawnerTool
// Node-placing tools exposed in the editor (place = click, erase = shift-click). Terrain tools
// paint the tile grid; node tools drop/remove a resource node in the separate node layer.
// Full harvestable roster (was shimmeroak-only — Alex 07-22: "nodes aren't placeable").
const NODE_TOOLS: { id: NodeType; label: string }[] = [
  { id: 'goldwood', label: 'Goldwood' }, { id: 'shimmeroak', label: 'Shimmeroak' },
  { id: 'starwillow', label: 'Starwillow' }, { id: 'dawnwood', label: 'Dawnwood' },
  { id: 'raw_mana_node', label: 'Raw Mana' }, { id: 'element_crystal_node', label: 'Elem Crystal' },
  { id: 'pure_core_node', label: 'Pure Core' }, { id: 'ather_crystal_node', label: 'Ather Crystal' },
  { id: 'small_pond', label: 'Pond' }, { id: 'stream', label: 'Stream' }, { id: 'lake', label: 'Lake' },
  { id: 'ather_soil', label: 'Soil' },
]
const NODE_TOOL_IDS = new Set<string>(NODE_TOOLS.map(t => t.id))
// Moglin-patrol spawner tools — one per hold gate. A spawner's patrols run until ITS boss
// falls (the grind-ladder: better XP + marks than wilds, worth farming until hold-ready).
const SPAWNER_TOOLS: { id: SpawnerTool; gate: SpawnerPlacement['gate']; label: string }[] = [
  { id: 'sp_thistle', gate: 'thistle', label: 'Sp·Thistle' },
  { id: 'sp_vetch', gate: 'vetch', label: 'Sp·Vetch' },
  { id: 'sp_brack', gate: 'brack', label: 'Sp·Brack' },
]
const SPAWNER_TOOL_IDS = new Set<string>(SPAWNER_TOOLS.map(t => t.id))
// itemId → display label (e.g. shimmeroak_plank → "Shimmeroak Plank"). Real item names live in
// sprites/items.ts; this prettifier is enough for harvest toasts until those are wired.
// Tap-to-transfer destination pick: a slot already holding the same item (merge target) wins,
// else the first empty slot. -1 = no room (transferChestSlot no-ops rather than dropping items).
function findEmptyOrMatch(dest: (ItemStack | null)[], item: ItemStack | null): number {
  if (!item) return -1
  const match = dest.findIndex(s => s?.itemId === item.itemId)
  if (match !== -1) return match
  return dest.findIndex(s => s === null)
}
/** Where a bottom prompt floats: centred, above the hotbar. One spot, so two prompts can never sit apart. */
const PILL_LOW: React.CSSProperties = { position: 'fixed', left: '50%', bottom: 156, transform: 'translateX(-50%)', zIndex: 35 }
/** A touch-pad button (A / B / jump / slide): a parchment disc in a carved ring, lit by `accent` when
 *  it would DO something (the A button takes the hue of what it will act on). */
const touchKnob = (size: number, accent?: string): React.CSSProperties => ({
  width: size, height: size, borderRadius: '50%', cursor: 'pointer', touchAction: 'none',
  background: `linear-gradient(180deg, ${H.paperHi}, ${H.paperLo})`, color: accent ?? H.ink,
  border: `3px solid ${accent ?? H.inkSoft}`, boxShadow: '0 4px 10px rgba(20,10,4,.45)',
  font: `800 ${Math.round(size * 0.32)}px system-ui, sans-serif`,
})
const placeIconBtn = (accent: string): React.CSSProperties => ({ width: 60, height: 60, borderRadius: '50%', border: `3px solid ${accent}`, background: `linear-gradient(180deg, ${H.paperHi}, ${H.paperLo})`, color: accent, boxShadow: '0 4px 10px rgba(20,10,4,.45)', font: '800 24px system-ui, sans-serif', cursor: 'pointer', touchAction: 'none' })
// Chop cost + time, scaling by node tier (its minLevel). Base pool is 100 and regen is slow
// (see MANA_REGEN_PER_SEC), so mana is a real budget. Shimmeroak (Lv4): 12 mana over 3s = 4/s.
// Pure feel — tune here. goldwood(1): 6 mana / 2s · shimmeroak(4): 12 / 2.9s · dawnwood(10): 24 / 4.7s.
const nodeManaCost = (type: NodeType) => 6 + (NODE_DEFS[type].minLevel - 1) * 2
const nodeChannelSec = (type: NodeType) => 2 + (NODE_DEFS[type].minLevel - 1) * 0.3
// ── ★ RAISED AND UNIFIED 2026-08-27 (Alex) ────────────────────────────────────────────────────
// This read `1 / 60` with the note "1 mana per minute by design — the real refill is Alchemy-brewed
// potions". That was a real decision and it is being reversed deliberately, not overwritten: mana
// is no longer only a casting budget, it is what BUYS YOUR SHIELD (`engine/recovery.ts`), so a rate
// tuned for "potions are the refill" now sets how survivable the game is.
//
// ⚠ AND IT CLOSES A 60× SPLIT BETWEEN THE TWO WORLDS. The voxel world has always regenerated 1.0–2.0
// per second off the mana skill (`engine/mana.ts` › `getRegenRate`); play3d ran 1/60. The same
// number meant sixty times more in one world than the other, which is why Moisture Gathering's
// absolute trickle was ~48× overtuned here and ~0.8× there. Both worlds now read the same curve.
const MANA_REGEN_PER_SEC = getRegenRate(1)   // the skill-1 floor; the curve owns the rest
// Drink effects (restore amounts, timed buffs, effect lines) live in engine/potion-effects.ts —
// one file owns what every bottle does; this walker just applies them at its hook points.
// Placeable stations — double-tap in the hotbar to enter placement mode, then confirm to build.
// Placeholder blockout look (real models later, per the art rule). w/d = footprint tiles, h = height.
const PLACEABLES: Record<string, { name: string; color: string; accent: string; h: number }> = {
  alchemy_station: { name: 'Alchemy Station', color: S.station.alchemy_station.body, accent: S.station.alchemy_station.cap, h: 1.1 },
  crafting_table:  { name: 'Crafting Table',  color: S.station.crafting_table.body, accent: S.station.crafting_table.cap, h: 0.85 },
  chest:           { name: 'Chest',           color: S.station.chest.body, accent: S.station.chest.cap, h: 0.6 },
  exchange_booth:  { name: 'Exchange Booth',  color: S.station.exchange_booth.body, accent: S.station.exchange_booth.cap, h: 1.0 },
  farm_planter:    { name: 'Planter',         color: S.station.farm_planter.body, accent: S.station.farm_planter.cap, h: 0.4 },
}

// Placed-station menu kinds, generalized over ALL 5 station itemIds (brew/craft/chest/exchange/farm).
// A station's `kind` drives which menu opens on interact + the prompt/tap-button look. `chest` and
// `exchange_booth` reuse the SAME itemIds as the 2D game's furniture (sprites/furniture.ts) — same
// item, same look, coherent across both walkers.
const STATIONS: Record<string, { kind: StationKind; verb: string; emoji: string; name: string; accent: string }> = {
  alchemy_station: { kind: 'brew',     verb: 'Brew',  emoji: '⚗', name: 'Alchemy Station', accent: S.station.alchemy_station.cue },
  crafting_table:  { kind: 'craft',    verb: 'Craft', emoji: '🔨', name: 'Crafting Table',  accent: S.station.crafting_table.cue },
  chest:           { kind: 'chest',    verb: 'Open',  emoji: '📦', name: 'Chest',           accent: S.station.chest.cue },
  exchange_booth:  { kind: 'exchange', verb: 'Trade', emoji: '💰', name: 'Exchange Booth',  accent: S.station.exchange_booth.cue },
  farm_planter:    { kind: 'farm',     verb: 'Tend',  emoji: '🌱', name: 'Planter',         accent: S.station.farm_planter.cue },
}
// Stable per-placement instance id — used to key chest contents + planted crops to a specific
// station in the world (survives save/load since it's derived, not stored).
const stationInstanceId = (s: PlacedStruct) => `${s.srcZoneId ?? s.zoneId}:${s.srcTileX ?? s.tileX},${s.srcTileY ?? s.tileY}`

// Exchange Booth "Buy" shelf — a curated shortlist (the full GE_ITEM_IDS is ~80 items; showing
// all of them on a phone-sized menu isn't usable). "Sell" already covers everything tradeable
// the player is holding, so this is just the early-game staples worth buying on demand.

// Starter build-kit — the placeable stations + enough gathered mats to build/brew day one.
// Granted ONCE per save via the `starterKitV2` flag so it reaches returning players too (older
// saves with a party skipped the first-visit seed and were stranded with no stations/mats).
// ★ THE BAG IS CANON, AND IT IS DELIBERATELY SMALL (`CANON/game/shimmer-quests-mainmap.md`):
// "He gifts your first Mana Seed + the starter bag (crafting table, pot, grimoire, tools)."
// Greg's own line sets the ceiling — "Everything a new keeper needs and nothing a new keeper does
// not." The old kit (3 potions, 2 salves, an elixir, an alchemy station and 27 assorted materials)
// broke that: it handed a new keeper the mid-game before they had planted anything, and it is the
// reason the "fresh" starter looked like a played save. Adding to this list is a canon change.
const STARTER_KIT_FLAG = 'starterKitV3'
function grantStarterKit(inv: Inventory) {
  addItems(inv, MANA_SEED_ITEM, 1)      // the gift itself — everything else exists to serve it
  addItems(inv, 'farm_planter', 1)      // "a pot" — what you plant the seed in
  addItems(inv, 'crafting_table', 1)    // "a table to work at"
  addItems(inv, 'goldwood_plank', 3)    // enough to seat the table, and nothing spare
}
// hotbar double-tap hints (drinkable potions + placeable stations)
const USE_HINTS: Record<string, string> = {
  // every potion's hint derives from its engine effect line — one source of truth
  // ⚠ AN INFUSION IS NOT DRUNK. It goes on a spirit, so it must not carry the drink affordance —
  // and `potionEffectLine` returns null for anything it has no line for, which a template literal
  // renders as the word "null" on the hotbar. Both are guarded here rather than assumed away.
  ...Object.fromEntries(Object.keys(POTION_DEFS).map(k => {
    const line = potionEffectLine(k)
    if (!line) return [k, 'no effect wired yet']
    return [k, elementForInfusion(k) ? line : `${line} · double-tap to drink`]
  })),
  ...Object.fromEntries(Object.keys(PLACEABLES).map(k => [k, 'double-tap to place'])),
}

/**
 * ★ A wall boxed in on all eight sides has no visible side face, ever.
 *
 * Walls render at a FIXED height (y=0.55, 1.3 tall) — they do not read the height map — so a wall
 * whose eight neighbours are all walls can only ever be seen from directly above. That used to be a
 * rounding error. Once the cloud substrate filled every out-of-zone tile, it became 94% of all wall
 * geometry: 99,743 of 106,508 boxes drawn every frame, each one casting a shadow, for nothing.
 *
 * So the interior is split out and drawn as a flat top-face quad instead of a box — same silhouette
 * from any position a player can reach, a sixth of the triangles, and out of the shadow pass
 * entirely. As you carve into a cloud mass its exposed tiles become shell again on the next rebuild,
 * so nothing needs to know this happened.
 */
const isWallAt = (grid: number[][], x: number, y: number) => {
  const row = grid[y]
  if (!row) return false
  const v = row[x]
  return v !== undefined && v !== VOID && (v & 0xFF) !== WARP_ID && (v & 0xFF) !== MIST_ID
    && (v & 0xFF) !== WATER_ID && !walkable(grid, x, y)
}

function bucketsRect(grid: number[][], r0: number, c0: number, r1: number, c1: number) {
  const floors: Cell[] = [], walls: Cell[] = [], waters: Cell[] = [], voids: Cell[] = [], warps: Cell[] = [], mists: Cell[] = []
  const wallTops: Cell[] = []
  // Buildings are walls that are not clouds. Same collision, same shell/top split, different
  // colour — so they ride the identical geometry path and only branch at the material.
  const buildings: Cell[] = [], buildingTops: Cell[] = []
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    const v = grid[r][c]
    if (v === VOID) { voids.push([c, r]); continue }
    const id = v & 0xFF
    if (id === WARP_ID) warps.push([c, r])
    else if (id === MIST_ID) mists.push([c, r])
    else if (id === WATER_ID) waters.push([c, r])
    else if (walkable(grid, c, r)) floors.push([c, r])
    else {
      // Neighbours are read off the whole grid, not the chunk rect, so a tile on a chunk seam is
      // classified by the world around it rather than by where the chunk happens to end.
      let buried = true
      for (let dy = -1; dy <= 1 && buried; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        if (!isWallAt(grid, c + dx, r + dy)) { buried = false; break }
      }
      if (id === BUILDING_ID) (buried ? buildingTops : buildings).push([c, r])
      else (buried ? wallTops : walls).push([c, r])
    }
  }
  return { floors, walls, waters, voids, warps, mists, wallTops, buildings, buildingTops }
}

// The world renders in CHUNK×CHUNK blocks, one instanced-mesh set each, so three.js frustum-
// culls what's behind the camera and the fog hides the far edge. Small zones land in 1-2 chunks
// ≈ the old single-bucket path.
//
// ✅ 2026-08-05: the "streaming realm later just mounts a radius instead" that this comment
// promised is now real (`world/chunk-stream.ts`) — and so is the fog it also promised, which had
// never actually been configured. Mounted chunks are bounded by the radius, not the world size.
// CHUNK + the streaming window live in world/chunk-stream.ts (pure, tested) so the rules can be
// proved headless. `center` = the player's CHUNK, not their position: keying on position would
// re-render this memo every frame and cost more than streaming saves.
function chunkBuckets(grid: number[][], center?: ChunkCoord | null, radius = DEFAULT_RADIUS) {
  const rows = grid.length, cols = grid[0].length
  const out: { key: string; b: ReturnType<typeof bucketsRect> }[] = []
  for (let r0 = 0; r0 < rows; r0 += CHUNK) for (let c0 = 0; c0 < cols; c0 += CHUNK) {
    // Skip far chunks BEFORE bucketing them — this saves the per-cell sweep too, not just the
    // draw calls. Without a center (editors, first frame) everything mounts, exactly as before.
    if (center && !chunkVisible({ cx: c0 / CHUNK, cy: r0 / CHUNK }, center, radius)) continue
    const b = bucketsRect(grid, r0, c0, Math.min(r0 + CHUNK, rows), Math.min(c0 + CHUNK, cols))
    // Every bucket must be listed here. A chunk made ENTIRELY of one omitted kind gets dropped as
    // "empty" and that content silently never renders — which is what would have happened to a
    // solid block of buildings in the middle of a town.
    if (b.floors.length || b.walls.length || b.wallTops.length || b.waters.length || b.voids.length
      || b.warps.length || b.mists.length || b.buildings.length || b.buildingTops.length)
      out.push({ key: `${r0}:${c0}`, b })
  }
  return out
}

function lerpAngle(a: number, b: number, t: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
}

// What grows out of a bloomed Mana Seed — ONE young spirit of the species the seed chose.
//
// ★ Greg no longer hands this over. Canon has him gift a SEED ("Plant it, tend it, and something
// will choose to grow"), so the spirit arrives from the pot, minutes later, as the payoff for
// having tended it. The species is picked by `rollBloomSpecies` in the engine, not here — this
// only dresses it into a young spirit.
function makeSpiritOfSpecies(sp: Species): Spirit {
  const s = createSpirit(sp, speciesDisplayName(sp), 0, 0)
  s.level = 5
  s.seeds = Array.from({ length: 6 }, () => 16 + Math.floor(Math.random() * 16)) // decent IVs
  s.bond = 40
  s.happiness = 160
  return s
}

const FILLER_SPECIES: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'bat', 'rabbit', 'turtle', 'firefly', 'hummingbird', 'water-bear']

// Build the wild side from a rolled encounter. A wild draw is light: the lead + a ~45% weaker tag-along —
// but never gang up on a lone starter (party of 1 always faces a fair 1v1).
function buildWildParty(enc: WildEncounter, playerPartySize: number): Spirit[] {
  const lead = createSpirit(enc.species, enc.name, 0, 0)
  lead.level = enc.level
  lead.element = enc.element
  lead.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
  const party = [lead]
  if (playerPartySize > 1 && Math.random() < 0.45) {
    const sp = FILLER_SPECIES[Math.floor(Math.random() * FILLER_SPECIES.length)]
    const m = createSpirit(sp, `Wild ${sp.charAt(0).toUpperCase() + sp.slice(1)}`, 0, 0)
    m.level = Math.max(1, enc.level - 1 - Math.floor(Math.random() * 2))
    m.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
    party.push(m)
  }
  return party
}

// NPC markers in the current zone — a body, a head, and a tall findable beacon so you spot them fast.
// Moglins keep a dimmed collared spirit beside them (canon) and glow an ominous violet, not warm gold.
function NPCMarkers({ npcs, heights }: { npcs: NPC3D[]; heights: number[][] }) {
  return (
    <>
      {npcs.map((n) => {
        const y = (heights[n.tileY]?.[n.tileX] ?? 0) * STEP
        const moglin = n.kind === 'moglin'
        return (
          <group key={n.id} position={[n.tileX, y, n.tileY]}>
            <mesh position={[0, 0.85, 0]} castShadow><capsuleGeometry args={[0.32, 0.7, 4, 10]} /><meshStandardMaterial color={n.color} /></mesh>
            <mesh position={[0, 1.55, 0]} castShadow><sphereGeometry args={[0.26, 14, 14]} /><meshStandardMaterial color={S.figure.head} /></mesh>
            {moglin && <mesh position={[0.9, 0.5, 0.25]} castShadow><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color={S.figure.collar} emissive={S.figure.collarGlow} emissiveIntensity={0.4} /></mesh>}
            <mesh position={[0, 3.1, 0]}><boxGeometry args={[0.13, 2.2, 0.13]} /><meshStandardMaterial color={moglin ? S.figure.moglinBeacon : S.figure.beacon} emissive={moglin ? S.figure.moglinBeaconGlow : S.figure.beaconGlow} emissiveIntensity={0.92} transparent opacity={0.8} /></mesh>
          </group>
        )
      })}
    </>
  )
}

// Resource-node placeholder looks — a blockout per type (real models come later, per the art rule).
// kind picks the FORM: 'tree' = trunk+canopy (forestry), 'crystal' = a shard cluster from a rock base
// (prospecting), 'water' = a shimmering ripple pool (rinning). trunk = base/rock/water-bed color,
// canopy = leaves/crystal/water-surface color. Canon reads inform the palette per tier.
const NODE_LOOK: Record<string, { kind: 'tree' | 'crystal' | 'water'; trunk: string; canopy: string; scale: number; glow?: number }> = {
  // Forestry
  goldwood:   { kind: 'tree', ...S.node.goldwood, scale: 1 },
  shimmeroak: { kind: 'tree', ...S.node.shimmeroak, scale: 1.35, glow: 0.35 },
  starwillow: { kind: 'tree', ...S.node.starwillow, scale: 1.15 },
  dawnwood:   { kind: 'tree', ...S.node.dawnwood, scale: 1.2, glow: 0.5 },
  // Prospecting — cloudy raw shard → violet element → clear pure core → golden ather (glow climbs with tier)
  raw_mana_node:        { kind: 'crystal', ...S.node.raw_mana_node, scale: 0.85, glow: 0.4 },
  element_crystal_node: { kind: 'crystal', ...S.node.element_crystal_node, scale: 1.0,  glow: 0.6 },
  pure_core_node:       { kind: 'crystal', ...S.node.pure_core_node, scale: 1.1,  glow: 0.8 },
  ather_crystal_node:   { kind: 'crystal', ...S.node.ather_crystal_node, scale: 1.25, glow: 1.0 },
  // Rinning — still luminescent pools; larger spots = bigger water
  small_pond: { kind: 'water', ...S.node.small_pond, scale: 1.0, glow: 0.3 },
  stream:     { kind: 'water', ...S.node.stream, scale: 1.25, glow: 0.3 },
  lake:       { kind: 'water', ...S.node.lake, scale: 1.6, glow: 0.35 },
}

// Deterministic per-node shard/ripple layout (stable across frames — seeded by tile position).
function nodeShards(tx: number, ty: number, count: number): { a: number; tilt: number; h: number; r: number }[] {
  let s = ((tx * 73856093) ^ (ty * 19349663)) >>> 0
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 0xffffffff }
  return Array.from({ length: count }, (_, i) => ({
    a: (i / count) * Math.PI * 2 + rnd() * 0.7,   // angle around the base
    tilt: 0.12 + rnd() * 0.32,                     // lean outward
    h: 0.7 + rnd() * 0.7,                          // shard height factor
    r: 0.14 + rnd() * 0.16,                        // distance from center
  }))
}
// ── Burrows — the moglin half of living-spawners (canon: shimmer-geography.md, RULED 07-30). ──
// "A burrow is a mouth, a hold is the hand behind it." Edit mode keeps the gate diamond
// (shift-click erases via the sp_* tools). Play mode always shows the MOUTH — a warm earth
// mound with a dark opening — and while its hold stands it flies the hold's pennant and a
// lesser moglin PATROLS a derived loop around it (engine/burrows.ts): position is a pure
// function of wall-clock time, so every client watches the same walk with nothing synced.
// Render caution is canon law: the species is teddy-bear-soft, child-scale, WARM earth
// tones, never grey — menace comes from the bearing and the collar-prop, not the anatomy.
// The old blockout here was a dark hunched lurker; that read as vermin and is the exact
// thing the caution bans. Hold freed → pennant comes down, the mouth quiets; after Brack
// falls a REFORMED moglin (no collar) sits by it — "came to raid, stayed to be neighbours."


function BurrowWalker({ sp, heights, gridRef, ready, keyFor }: {
  sp: SpawnerPlacement; heights: number[][]; gridRef: React.MutableRefObject<number[][]>
  ready: (sp: SpawnerPlacement) => boolean; keyFor: (sp: SpawnerPlacement) => string
}) {
  const group = useRef<THREE.Group>(null)
  // The loop is deterministic per logical key; grid edits are an edit-mode concern and the
  // walker is hidden there, so computing once per mount/zone is enough.
  const loop = useMemo<PatrolLoop>(
    () => patrolLoop(sp.tileX, sp.tileY, (x, y) => walkable(gridRef.current, x, y), keyFor(sp)),
    [sp.tileX, sp.tileY, sp.gate],  // eslint-disable-line react-hooks/exhaustive-deps
  )
  useFrame(() => {
    const g = group.current
    if (!g) return
    if (!ready(sp)) { g.visible = false; return }
    const now = Date.now()
    const pose = patrolPose(loop, sp.tileX, sp.tileY, now, currentWindow(now))
    // Emerging = rising out of the mouth: scale up and walk out from the opening.
    const px = sp.tileX + (pose.x - sp.tileX) * pose.emerge
    const pz = sp.tileY + (pose.y - sp.tileY) * pose.emerge
    const gy = (heights[Math.round(pz)]?.[Math.round(px)] ?? 0) * STEP
    const bob = pose.paused ? 0 : Math.abs(Math.sin(now / 1000 * 6 + loop.phaseS)) * 0.05
    g.visible = true
    g.position.set(px, gy + bob + (pose.emerge - 1) * 0.5, pz)
    g.rotation.y = Math.PI / 2 - pose.facing
    const s = 0.25 + 0.75 * pose.emerge
    g.scale.set(s, s, s)
  })
  const col = GATE_COLORS[sp.gate]
  return (
    <group ref={group}>
      {/* child-scale round-soft body — warm fur, rounded ears; the COLLAR is the hostile part */}
      <mesh position={[0, 0.44, 0]} castShadow><capsuleGeometry args={[0.24, 0.3, 6, 12]} /><meshStandardMaterial color={MOGLIN_FUR} roughness={0.95} /></mesh>
      <mesh position={[0, 0.86, 0]} castShadow><sphereGeometry args={[0.22, 14, 14]} /><meshStandardMaterial color={MOGLIN_FUR_LIGHT} roughness={0.95} /></mesh>
      <mesh position={[-0.13, 1.04, 0]}><sphereGeometry args={[0.08, 10, 10]} /><meshStandardMaterial color={MOGLIN_FUR} roughness={0.95} /></mesh>
      <mesh position={[0.13, 1.04, 0]}><sphereGeometry args={[0.08, 10, 10]} /><meshStandardMaterial color={MOGLIN_FUR} roughness={0.95} /></mesh>
      <mesh position={[0, 0.68, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.17, 0.045, 8, 20]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.55} roughness={0.4} /></mesh>
    </group>
  )
}

function BurrowMarkers({ spawners, heights, editing, defeated, ready, gridRef, keyFor }: {
  spawners: SpawnerPlacement[]; heights: number[][]; editing: boolean
  defeated: Record<string, boolean>; ready: (sp: SpawnerPlacement) => boolean
  gridRef: React.MutableRefObject<number[][]>; keyFor: (sp: SpawnerPlacement) => string
}) {
  const reformed = !!defeated['brack']
  return (
    <>
      {spawners.map((sp, i) => {
        const y = (heights[sp.tileY]?.[sp.tileX] ?? 0) * STEP
        const col = GATE_COLORS[sp.gate]
        const quiet = !!defeated[sp.gate]
        if (editing) {
          return (
            <group key={`sp-${i}`} position={[sp.tileX, y + 0.9, sp.tileY]}>
              <mesh><octahedronGeometry args={[0.32, 0]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={quiet ? 0.1 : 0.7} transparent opacity={quiet ? 0.4 : 0.95} /></mesh>
            </group>
          )
        }
        return (
          <group key={`sp-${i}`}>
            <group position={[sp.tileX, y, sp.tileY]}>
              {/* the mouth: warm earth mound + dark opening on its south face */}
              <mesh position={[0, 0.06, 0]} scale={[1, 0.38, 1]} castShadow><sphereGeometry args={[0.6, 16, 12]} /><meshStandardMaterial color={S.spawner.mound} roughness={1} /></mesh>
              <mesh position={[0, 0.12, 0.44]} rotation={[-0.5, 0, 0]}><circleGeometry args={[0.26, 18]} /><meshBasicMaterial color={S.spawner.mouth} side={THREE.DoubleSide} /></mesh>
              {!quiet && (
                <group position={[0.32, 0, -0.32]}>
                  {/* the hold's claim, planted at the mouth — comes down when the hold falls */}
                  <mesh position={[0, 0.7, 0]} castShadow><boxGeometry args={[0.05, 1.4, 0.05]} /><meshStandardMaterial color={S.spawner.post} roughness={0.9} /></mesh>
                  <mesh position={[0.19, 1.24, 0]}><boxGeometry args={[0.33, 0.22, 0.02]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.35} side={THREE.DoubleSide} /></mesh>
                </group>
              )}
              {quiet && reformed && (
                // The deflated folk who came to raid and stayed to be neighbours: a calm,
                // UNCOLLARED moglin sitting by the quieted mouth. The collar was the sin.
                <group position={[0.7, 0, 0.35]} rotation={[0, -0.6, 0]}>
                  <mesh position={[0, 0.3, 0]} castShadow><capsuleGeometry args={[0.22, 0.2, 6, 12]} /><meshStandardMaterial color={MOGLIN_FUR} roughness={0.95} /></mesh>
                  <mesh position={[0, 0.66, 0]} castShadow><sphereGeometry args={[0.2, 14, 14]} /><meshStandardMaterial color={MOGLIN_FUR_LIGHT} roughness={0.95} /></mesh>
                  <mesh position={[-0.12, 0.82, 0]}><sphereGeometry args={[0.07, 10, 10]} /><meshStandardMaterial color={MOGLIN_FUR} roughness={0.95} /></mesh>
                  <mesh position={[0.12, 0.82, 0]}><sphereGeometry args={[0.07, 10, 10]} /><meshStandardMaterial color={MOGLIN_FUR} roughness={0.95} /></mesh>
                </group>
              )}
            </group>
            {!quiet && <BurrowWalker sp={sp} heights={heights} gridRef={gridRef} ready={ready} keyFor={keyFor} />}
          </group>
        )
      })}
    </>
  )
}


// ── The Home Plot spirit ring — canon ruled 2026-07-30 ("where a keeper's spirits live"):
// resting spirits are "about your own plot: visible, wandering, underfoot. This is the ring
// the player feels, and it is why the garden reads as inhabited rather than as a menu."
// Same derived-position law as the moglin patrols — position is a pure function of
// wall-clock time, so every visitor to a plot would see the same spirit round the same
// bush. The old "spirits are battle-only, no overworld" convention is superseded by the
// ruling FOR THE PLOT RINGS ONLY: wild zones still never show overworld spirits.
// Greeting one (E) opens the party panel ON that spirit — the swap surface canon allows
// instead of a bank ("there is no bank, no box, no depot").
const PLOT_DIALS: WanderDials = { radius: 4.5, speed: 0.7, pauseS: 3.4 }
// Spirits LIVE here — no emerge beat at window boundaries, so hand patrolPose a window that
// started long ago and never ends.
const PLOT_WIN: DealWindow = { index: 0, startMs: 0, endMs: Number.MAX_SAFE_INTEGER }
const PLOT_ZONES = new Set(['garden', 'r-home-plot'])

/** Where a resting spirit hangs out: a seeded offset from the plot anchor, so each spirit
 *  claims its own corner of the garden and keeps it across sessions. */
function plotSpiritCenter(spiritId: string, ax: number, az: number): { x: number; z: number } {
  let h = 2166136261 >>> 0
  for (let i = 0; i < spiritId.length; i++) { h ^= spiritId.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13
  const a = ((h >>> 8) % 1024) / 1024 * Math.PI * 2
  const r = 3 + ((h >>> 18) % 1024) / 1024 * 5
  return { x: ax + Math.cos(a) * r, z: az + Math.sin(a) * r }
}

function plotSpiritLoop(sp: Spirit, ax: number, az: number, grid: number[][]): { c: { x: number; z: number }; loop: PatrolLoop } {
  const c = plotSpiritCenter(sp.id, ax, az)
  return { c, loop: patrolLoop(c.x, c.z, (x, y) => walkable(grid, x, y), `plot:${sp.id}`, PLOT_DIALS) }
}

function PlotSpiritBody({ sp, anchor, heights, gridRef }: {
  sp: Spirit; anchor: { x: number; z: number }; heights: number[][]
  gridRef: React.MutableRefObject<number[][]>
}) {
  const group = useRef<THREE.Group>(null)
  const built = useMemo(() => plotSpiritLoop(sp, anchor.x, anchor.z, gridRef.current), [sp.id, anchor.x, anchor.z])  // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const g = group.current
    if (!g) return
    const now = Date.now()
    const pose = patrolPose(built.loop, built.c.x, built.c.z, now, PLOT_WIN)
    const gy = (heights[Math.round(pose.y)]?.[Math.round(pose.x)] ?? 0) * STEP
    // living things get the live glow + a gentle float — never a flat prop (the art-medium law)
    const breathe = Math.sin(now / 1000 * 1.6 + built.loop.phaseS) * 0.05
    g.position.set(pose.x, gy + 0.45 + breathe, pose.y)
    g.rotation.y = Math.PI / 2 - pose.facing
  })
  const col = ELEMENT_COLORS[sp.element] ?? mint.base
  return (
    <group ref={group}>
      <mesh><sphereGeometry args={[0.3, 16, 16]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.35} transparent opacity={0.42} /></mesh>
      <mesh><sphereGeometry args={[0.16, 12, 12]} /><meshStandardMaterial color={S.spiritCore} emissive={col} emissiveIntensity={0.9} /></mesh>
      <mesh position={[0, -0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.22, 0.34, 20]} /><meshBasicMaterial color={col} transparent opacity={0.22} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

function PlotSpirits({ spirits, anchor, heights, gridRef }: {
  spirits: Spirit[]; anchor: { x: number; z: number }; heights: number[][]
  gridRef: React.MutableRefObject<number[][]>
}) {
  return <>{spirits.map(sp => <PlotSpiritBody key={sp.id} sp={sp} anchor={anchor} heights={heights} gridRef={gridRef} />)}</>
}

/**
 * ★ What the editor could not show you: the RARITY BAND you are authoring.
 *
 * Under the tier roll, the node type you place does two jobs, and only the first is visible. It
 * sets that slot's SKILL — and it widens the whole zone's band for that skill, because the band is
 * inferred from what the zone authors. So dropping a single Dawnwood in a far corner does not add
 * "a Dawnwood there"; it makes Dawnwood rollable in EVERY forestry slot in the zone. That is real
 * leverage and it was completely invisible, which is how you end up with a starter zone quietly
 * dealing rares and no idea which placement did it.
 *
 * So: band per skill, in rarity order, with the share of windows a slot of that skill comes up
 * filled. Live off the working placements, so it moves as you paint.
 */
function BandReadout({ zoneId, nodes, tick }: { zoneId: string; nodes: NodePlacement[]; tick: number }) {
  const rows = useMemo(() => {
    // The editor works in world space; the band is a property of the LOGICAL zone, so read the
    // authored source for the district under the player rather than the remapped working copy.
    const src = ZONE_NODES[zoneId] ?? nodes
    const skills = [...new Set(src.map(p => NODE_DEFS[p.type].skill))]
    return skills.map(skill => {
      const band = zoneBand(src, skill)
      const slots = src.filter(p => NODE_DEFS[p.type].skill === skill).length
      // Same weights the deal uses, so the number cannot drift from the roll it describes.
      const weights = band.map((_, i) => TIER_WEIGHTS[Math.min(i, TIER_WEIGHTS.length - 1)])
      const filled = weights.reduce((a, b) => a + b, 0)
      return { skill, band, slots, fill: filled / (filled + NOTHING_WEIGHT) }
    })
  }, [zoneId, nodes, tick])
  if (!rows.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', maxWidth: 480 }}>
      <span className="hk-label hk-soft" style={{ fontSize: 12 }}>
        Band · {zoneId}
      </span>
      {rows.map(r => (
        <div key={r.skill} className="hk-ink" style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <span className="hk-moss">{r.skill}</span>{' '}
          {r.band.map((t, i) => (
            <span key={t} style={{ opacity: 1 - i * 0.18 }}>{NODE_TYPE_LABELS[t]?.name ?? t}{i < r.band.length - 1 ? ' › ' : ''}</span>
          ))}
          <span className="hk-faint">{'  '}· {r.slots} slot{r.slots === 1 ? '' : 's'} · {Math.round(r.fill * 100)}% filled</span>
        </div>
      ))}
    </div>
  )
}

// The Home Plot's LOGICAL zone id. Board slot keys are zone-qualified, so this is how a runtime
// node answers "am I on the plot?" no matter which zone is mounted — in world mode the whole
// continent is one zone and the node's own zoneId cannot tell you.
const HOME_PLOT_ZONE = 'garden'
const isHomeSlot = (n: ResourceNode) => !!n.slotKey?.startsWith(`${HOME_PLOT_ZONE}|`)

/**
 * The visible half of the spawn board — a node on its way out of the world, or on its way in.
 *
 * The fade is read live in `useFrame` from the clock rather than passed down as a prop, because a
 * prop would mean re-rendering every node in the zone on a timer for three solid minutes. Nodes
 * that are neither arriving nor leaving never enter this path at all: `NodeFade` is only mounted
 * around the ones that are, so the common case costs exactly nothing.
 *
 * Two channels carry the fade, and they are deliberately not the same curve:
 *   • the GLOW dims across the whole three minutes — the mana leaving is the telegraph, and it is
 *     legible from across a clearing long before the shape goes
 *   • the FORM only dissolves in the last third, so the node stays a solid, harvestable-looking
 *     thing until it is genuinely nearly gone
 * A single linear opacity ramp read as a bug — a tree sitting half-transparent for two minutes
 * looks like a rendering fault, not like the world breathing.
 */
function NodeFade({ node, zoneId, children }: { node: ResourceNode; zoneId: string; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const applied = useRef(-1)
  useFrame(() => {
    const g = ref.current
    // The overwhelmingly common case: a node that is simply standing there. One boolean per node
    // per frame, no traversal, no allocation — cheap enough that wrapping every node is free and
    // the call site does not need a conditional wrapper.
    if (!g || (!isFadeTest && !node.leaving && !node.arriving)) return
    const now = Date.now()
    const a = isFadeTest ? fadeTestAlpha() : nodeAlpha(node, now, zoneWindow(now, regionSpawnConfig(zoneId)))
    if (a === applied.current) return
    applied.current = a
    const dissolve = a < 0.34 ? a / 0.34 : 1
    g.scale.setScalar(0.9 + 0.1 * dissolve)
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!m) return
      for (const mat of Array.isArray(m) ? m : [m]) {
        const store = mat.userData as { baseOpacity?: number; baseEmissive?: number; baseTransparent?: boolean }
        if (store.baseOpacity === undefined) {
          store.baseOpacity = mat.opacity
          store.baseTransparent = mat.transparent
          store.baseEmissive = (mat as THREE.MeshStandardMaterial).emissiveIntensity ?? 0
        }
        mat.transparent = store.baseTransparent || dissolve < 1
        mat.opacity = (store.baseOpacity ?? 1) * dissolve
        if ('emissiveIntensity' in mat) {
          (mat as THREE.MeshStandardMaterial).emissiveIntensity = (store.baseEmissive ?? 0) * (0.15 + 0.85 * a)
        }
      }
    })
  })
  return <group ref={ref}>{children}</group>
}

function NodeMarkers({ nodes, heights, editing, channel, zoneId }: { nodes: ResourceNode[]; heights: number[][]; editing: boolean; channel?: { nodeId: string; hp: number } | null; zoneId: string }) {
  return (
    <>
      {nodes.map((n) => {
        const look = NODE_LOOK[n.type] ?? NODE_LOOK.goldwood
        const y = (heights[n.tileY]?.[n.tileX] ?? 0) * STEP
        const s = look.scale
        const depleted = n.state === 'depleted'
        const chan = channel?.nodeId === n.id ? channel : null
        return (
          <group key={n.id} position={[n.tileX, y, n.tileY]}>
            {/* channel HP bar — drains as the mana-powered tool chops it down */}
            {chan && (
              <Html zIndexRange={[20, 0]} position={[0, s + 1.55, 0]} center distanceFactor={11} pointerEvents="none">
                <div style={{ width: 60, textAlign: 'center', userSelect: 'none' }}>
                  <div style={{ font: '800 9px ui-monospace, monospace', color: S.channelBar.text, textShadow: `0 1px 2px ${S.black}`, marginBottom: 2, whiteSpace: 'nowrap' }}>⚡ {prettyItem(n.type)}</div>
                  <div style={{ height: 6, background: S.channelBar.track, borderRadius: 4, border: `1px solid ${S.channelBar.trackEdge}`, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(0, chan.hp * 100)}%`, background: `linear-gradient(90deg,${S.channelBar.from},${S.channelBar.to})`, transition: 'width 0.1s linear' }} />
                  </div>
                </div>
              </Html>
            )}
            <NodeFade node={n} zoneId={zoneId}>
            {look.kind === 'tree' && <FloraTree look={look} depleted={depleted} />}

            {look.kind === 'crystal' && <>
              {/* rock base — always present; the shards break off it when mined */}
              <mesh position={[0, 0.12 * s, 0]} castShadow><dodecahedronGeometry args={[0.28 * s, 0]} /><meshStandardMaterial color={look.trunk} roughness={0.95} flatShading /></mesh>
              {/* shard cluster — angular crystals leaning outward from the base; gone while depleted */}
              {!depleted && nodeShards(n.tileX, n.tileY, 4).map((sh, i) => (
                <mesh key={i} castShadow
                  position={[Math.cos(sh.a) * sh.r * s, (0.2 + sh.h * 0.42) * s, Math.sin(sh.a) * sh.r * s]}
                  rotation={[Math.cos(sh.a) * sh.tilt, sh.a, Math.sin(sh.a) * sh.tilt]}>
                  <octahedronGeometry args={[0.17 * s, 0]} />
                  <meshStandardMaterial color={look.canopy} emissive={look.canopy} emissiveIntensity={look.glow ?? 0.4} roughness={0.25} metalness={0.1} transparent opacity={0.92} />
                </mesh>
              ))}
              {/* a taller center shard for a readable silhouette */}
              {!depleted && <mesh position={[0, 0.62 * s, 0]} castShadow rotation={[0.08, 0.6, 0.05]}><octahedronGeometry args={[0.22 * s, 0]} /><meshStandardMaterial color={look.canopy} emissive={look.canopy} emissiveIntensity={(look.glow ?? 0.4) + 0.1} roughness={0.2} transparent opacity={0.95} /></mesh>}
            </>}

            {look.kind === 'water' && <>
              {/* basin rim — a darker earthen bank so the pool reads as water set INTO the ground */}
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <ringGeometry args={[0.5 * s, 0.64 * s, 24]} />
                <meshStandardMaterial color={look.trunk} roughness={0.95} />
              </mesh>
              {/* water surface — a low shimmering disc just inside the bank */}
              <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[0.52 * s, 20]} />
                <meshStandardMaterial color={look.canopy} emissive={look.canopy} emissiveIntensity={depleted ? 0.08 : (look.glow ?? 0.3)} roughness={0.15} metalness={0.3} transparent opacity={depleted ? 0.5 : 0.82} />
              </mesh>
              {/* ripple rings — the catch-spot tell; calmer (single, dim) while fished out */}
              {[0.62, 0.82].slice(0, depleted ? 1 : 2).map((rr, i) => (
                <mesh key={i} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[rr * s * 0.5, rr * s * 0.5 + 0.03 * s, 24]} />
                  <meshBasicMaterial color={look.canopy} transparent opacity={depleted ? 0.18 : 0.4} />
                </mesh>
              ))}
              {/* bobber — a small float that marks an active spot; hidden when fished out */}
              {!depleted && <mesh position={[0.16 * s, 0.14, 0.1 * s]} castShadow><sphereGeometry args={[0.07 * s, 8, 8]} /><meshStandardMaterial color={S.bobber} emissive={S.bobber} emissiveIntensity={0.25} roughness={0.5} /></mesh>}
            </>}
            </NodeFade>
            {editing && (
              <Html zIndexRange={[20, 0]} position={[0, s + 1.2, 0]} center distanceFactor={12} pointerEvents="none">
                <div style={{ font: '700 10px ui-monospace, monospace', color: S.inkDeep, background: `${mint.text}d0`, border: `1px solid ${mint.deep}`, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{n.type}</div>
              </Html>
            )}
          </group>
        )
      })}
    </>
  )
}

// Placed stations (player-built) — blockout box + a glowing top + a facing nub.
const StructureMarkers = memo(function StructureMarkers({ structures, heights }: { structures: PlacedStruct[]; heights: number[][] }) {
  return (
    <>
      {structures.map((s, i) => {
        const def = PLACEABLES[s.itemId]; if (!def) return null
        const y = (heights[s.tileY]?.[s.tileX] ?? 0) * STEP
        return (
          <group key={`${s.itemId}-${s.tileX}-${s.tileY}-${i}`} position={[s.tileX, y, s.tileY]} rotation={[0, -s.facing * Math.PI / 180, 0]}>
            {/* real mesh where we have one; falls back to the old body+cap blockout otherwise */}
            <StationProp id={s.itemId} def={def} />
            <mesh position={[0.35, def.h * 0.6, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshBasicMaterial color={S.white} /></mesh>
          </group>
        )
      })}
    </>
  )
})

// Placement ghost — a translucent preview on the tile in front of the camera; writes that tile to
// placeTargetRef each frame (confirm reads it). Tints red where it can't build.
function PlacementGhost({ placing, posRef, heights, gridRef, placeTargetRef, structuresRef, zoneIdRef }: {
  placing: { itemId: string; facing: number } | null
  posRef: React.RefObject<THREE.Vector3>; heights: number[][]; gridRef: React.RefObject<number[][]>
  placeTargetRef: React.RefObject<{ x: number; y: number } | null>; structuresRef: React.RefObject<PlacedStruct[]>; zoneIdRef: React.RefObject<string>
}) {
  const grp = useRef<THREE.Group>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const fwd = useMemo(() => new THREE.Vector3(), [])
  // The ghost renders the REAL mesh now, so "blocked" has to reach a material it doesn't own.
  // State rather than a ref: it flips only when you cross onto a different tile, not per frame.
  const [blocked, setBlocked] = useState(false)
  const blockedRef = useRef(false)
  useFrame((state) => {
    if (!placing || !grp.current) { if (grp.current) grp.current.visible = false; return }
    state.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
    const p = posRef.current!
    const tx = Math.round(p.x + fwd.x * 1.4), tz = Math.round(p.z + fwd.z * 1.4)
    placeTargetRef.current = { x: tx, y: tz }
    const y = (heights[tz]?.[tx] ?? 0) * STEP
    const isBlocked = !walkable(gridRef.current, tx, tz) || structuresRef.current!.some(s => s.zoneId === zoneIdRef.current && s.tileX === tx && s.tileY === tz)
    grp.current.visible = true
    grp.current.position.set(tx, y, tz)
    grp.current.rotation.y = -placing.facing * Math.PI / 180
    if (ringMat.current) ringMat.current.color.setStyle(isBlocked ? S.placeRing.blocked : S.placeRing.ok)
    if (isBlocked !== blockedRef.current) { blockedRef.current = isBlocked; setBlocked(isBlocked) }
  })
  const def = placing ? PLACEABLES[placing.itemId] : null
  return (
    <group ref={grp} visible={false}>
      {def && placing && <>
        {/* real silhouette, so rotating the ghost actually shows you where the front will point */}
        <GhostProp id={placing.itemId} def={def} blocked={blocked} />
        <mesh position={[0.35, def.h * 0.6, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color={S.white} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><ringGeometry args={[0.44, 0.54, 4]} /><meshBasicMaterial ref={ringMat} color={S.placeRing.ok} transparent opacity={0.85} side={THREE.DoubleSide} /></mesh>
      </>}
    </group>
  )
}

// Shared pointer painting for any instanced cell layer. Tracks the last cell (not instanceId) so
// it survives the re-bucket when a cell changes type mid-drag.
function usePaint(cells: Cell[], paint: (c: number, r: number, shift: boolean) => void, enabled: boolean) {
  const painting = useRef(false)
  const lastKey = useRef('')
  useEffect(() => {
    const up = () => { painting.current = false; lastKey.current = '' }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])
  const apply = (e: ThreeEvent<PointerEvent>, isDown: boolean) => {
    if (!enabled || e.instanceId == null) return
    if (isDown && e.nativeEvent.button !== 0) return // left button only (right-drag = camera)
    if (!isDown && !painting.current) return
    const [c, r] = cells[e.instanceId]
    const key = `${c},${r}`
    if (!isDown && key === lastKey.current) return
    if (isDown) { e.stopPropagation(); painting.current = true }
    lastKey.current = key
    paint(c, r, e.nativeEvent.shiftKey)
  }
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => apply(e, true),
    onPointerMove: (e: ThreeEvent<PointerEvent>) => apply(e, false),
  }
}

// A render crash inside the R3F scene used to unmount the WHOLE Shimmer3D tree — the world went
// blank AND the birth modal (a DOM sibling of the Canvas) died with it, so a fresh player saw
// neither the garden nor the birth-rune screen. This boundary keeps a scene crash contained to the
// Canvas: the world area shows a recoverable message, the HUD and birth modal keep rendering. R3F
// propagates scene errors to the nearest outer boundary, which is what makes this catch them.
class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function FloorTerrain({ floors, heights, version, paint, editing, color = S.terrain.grass, emissive = S.black }: {
  floors: Cell[]; heights: number[][]; version: number
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean; color?: string; emissive?: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return  // see WallTops: an unmounted instance leaves the ref null and this effect crashes the canvas
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    const pos = new THREE.Vector3(), scl = new THREE.Vector3()
    floors.forEach(([c, r], i) => {
      const top = (heights[r]?.[c] ?? 0) * STEP
      pos.set(c, (top - 1) / 2, r)
      scl.set(1, top + 1, 1)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    })
    // ★ COUNT, not just allocation. `args` below allocates max(len, 1) because an InstancedMesh of
    // count 0 is not a thing worth having — but an allocated instance whose matrix is never written
    // keeps the IDENTITY matrix and draws at world origin (0,0,0). With zero cells that is one
    // phantom block sitting in the map's corner, per kind, stacked: a ghost warp, a ghost mist, a
    // ghost floor. It also makes a deleted last-of-its-kind look undeletable. Clamp the draw count.
    mesh.count = floors.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere() // instances sit at absolute tile coords — per-chunk culling needs real bounds
  }, [floors, heights, version])
  const h = usePaint(floors, paint, editing)
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(floors.length, 1)]} receiveShadow castShadow visible={floors.length > 0} {...h}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.6} />
    </instancedMesh>
  )
}

// Wispy translucent cloud over mist cells — encounter areas you walk through.
function MistOverlay({ mists, heights }: { mists: Cell[]; heights: number[][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return  // see WallTops: an unmounted instance leaves the ref null and this effect crashes the canvas
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(0.98, 0.8, 0.98)
    mists.forEach(([c, r], i) => { pos.set(c, (heights[r]?.[c] ?? 0) * STEP + 0.55, r); m.compose(pos, q, scl); mesh.setMatrixAt(i, m) })
    // ★ COUNT, not just allocation. `args` below allocates max(len, 1) because an InstancedMesh of
    // count 0 is not a thing worth having — but an allocated instance whose matrix is never written
    // keeps the IDENTITY matrix and draws at world origin (0,0,0). With zero cells that is one
    // phantom block sitting in the map's corner, per kind, stacked: a ghost warp, a ghost mist, a
    // ghost floor. It also makes a deleted last-of-its-kind look undeletable. Clamp the draw count.
    mesh.count = mists.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [mists, heights])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(mists.length, 1)]} visible={mists.length > 0}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={S.terrain.mist} transparent opacity={0.42} emissive={S.white} emissiveIntensity={0.12} depthWrite={false} />
    </instancedMesh>
  )
}

// A tall glowing beacon over each warp marker so doors/exits read from any angle.
function WarpBeacons({ warps, heights }: { warps: Cell[]; heights: number[][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return  // see WallTops: an unmounted instance leaves the ref null and this effect crashes the canvas
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1)
    warps.forEach(([c, r], i) => { pos.set(c, (heights[r]?.[c] ?? 0) * STEP + 1.5, r); m.compose(pos, q, scl); mesh.setMatrixAt(i, m) })
    // ★ COUNT, not just allocation. `args` below allocates max(len, 1) because an InstancedMesh of
    // count 0 is not a thing worth having — but an allocated instance whose matrix is never written
    // keeps the IDENTITY matrix and draws at world origin (0,0,0). With zero cells that is one
    // phantom block sitting in the map's corner, per kind, stacked: a ghost warp, a ghost mist, a
    // ghost floor. It also makes a deleted last-of-its-kind look undeletable. Clamp the draw count.
    mesh.count = warps.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [warps, heights])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(warps.length, 1)]} visible={warps.length > 0}>
      <boxGeometry args={[0.18, 3, 0.18]} />
      <meshStandardMaterial color={S.terrain.warpBeacon} emissive={S.terrain.warpGlow} emissiveIntensity={0.9} />
    </instancedMesh>
  )
}

/** The buried interior of a wall mass — top faces only. No shadow (nothing under it to shade), no
 *  paint handler (you cannot click what you cannot see; carving the shell re-exposes these). */
function WallTops({ cells, y, color }: { cells: Cell[]; y: number; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    // ★ Guarded, and the component below never returns null. The first cut early-returned when a
    // chunk had no buried tiles — which is most small zones — so the mesh was never created, the
    // ref stayed null, and this effect (hooks run regardless of what render returned) crashed the
    // canvas on the first frame. `Tiles` has always allocated `max(len, 1)` for the same reason:
    // an InstancedMesh of count 0 is not a thing worth having either.
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    const s = new THREE.Vector3(1, 1, 1)
    const p = new THREE.Vector3()
    cells.forEach(([c, r], i) => { m.compose(p.set(c, y, r), q, s); mesh.setMatrixAt(i, m) })
    mesh.count = cells.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells, y])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(cells.length, 1)]} receiveShadow visible={cells.length > 0}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  )
}

function Tiles({ cells, size, y, color, opacity = 1, paint, editing }: {
  cells: Cell[]; size: [number, number, number]; y: number; color: string; opacity?: number
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return  // see WallTops: an unmounted instance leaves the ref null and this effect crashes the canvas
    const m = new THREE.Matrix4()
    cells.forEach(([c, r], i) => { m.setPosition(c, y, r); mesh.setMatrixAt(i, m) })
    // ★ COUNT, not just allocation. `args` below allocates max(len, 1) because an InstancedMesh of
    // count 0 is not a thing worth having — but an allocated instance whose matrix is never written
    // keeps the IDENTITY matrix and draws at world origin (0,0,0). With zero cells that is one
    // phantom block sitting in the map's corner, per kind, stacked: a ghost warp, a ghost mist, a
    // ghost floor. It also makes a deleted last-of-its-kind look undeletable. Clamp the draw count.
    mesh.count = cells.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells, y])
  const h = usePaint(cells, paint, editing)
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(cells.length, 1)]} receiveShadow castShadow visible={cells.length > 0} {...h}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  )
}

// World-mode flora: every district's authored dressing, each mounted at its composed offset
// with a local heights slice (FloraDressing seats trees in zone-local coords).
const WorldFlora = memo(function WorldFlora({ heights }: { heights: number[][] }) {
  const parts = useMemo(() => [...getGardenWorld().placements.values()].map(p => ({
    id: p.zone.id, ox: p.ox, oy: p.oy,
    local: heights.slice(p.oy, p.oy + p.rows).map(row => row.slice(p.ox, p.ox + p.cols)),
  })), [heights])
  return <>{parts.map(pt => (
    <group key={pt.id} position={[pt.ox, 0, pt.oy]}>
      <FloraDressing zoneId={pt.id} heights={pt.local} />
    </group>
  ))}</>
})

// memo: the terrain is the heaviest node in the scene and depends on nothing that ticks. Without it,
// every channel tick (~11 Hz) rebuilt the whole floor/wall/water/mist JSX tree. All five props are
// stable (a ref, a ref's array, a version int, a useCallback, a bool), so this skips cleanly.
const ZoneGeometry = memo(function ZoneGeometry({ gridRef, heights, version, paint, editing, center, mountTick, ownSolids }: {
  gridRef: React.RefObject<number[][]>; heights: number[][]; version: number
  /** THE HOLD draws its own solids (parapets and pillars at their floor's height — `HoldScene`); the
   *  shared brown block is seated at ground level and would sink into a raised floor */
  ownSolids?: boolean
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
  /** the player's CHUNK — changes once per 64 tiles walked, so the memo still holds */
  center?: ChunkCoord | null
  /** bumped when streaming blits a region IN or OUT — an arrival mount happens at a centre
   *  this memo has already rendered, so the centre alone cannot tell it the grid changed */
  mountTick?: number
}) {
  // `editing` mounts the whole map: the map editor needs to see and click what it is drawing,
  // and an editor is not walking anywhere, so the streaming window would only get in the way.
  const chunks = useMemo(() => chunkBuckets(gridRef.current, editing ? null : center),
    [version, gridRef, center?.cx, center?.cy, editing, mountTick])
  return (
    <>
      {chunks.map(({ key, b: { floors, walls, waters, voids, warps, mists, wallTops, buildings, buildingTops } }) => (
        <group key={key}>
          <FloorTerrain floors={floors} heights={heights} version={version} paint={paint} editing={editing} />
          {/* solid clouds = the walls. Only the SHELL is boxed; the buried interior is a top face —
              see bucketsRect. Same silhouette, a sixth of the triangles, no shadow pass. */}
          <Tiles cells={walls} size={[1, 1.3, 1]} y={0.55} color={S.terrain.wall} paint={paint} editing={editing} />
          <WallTops cells={wallTops} y={1.2} color={S.terrain.wall} />
          {/* brown building blocks — the mortal side's masonry. Bumped to 3.2 (2026-08-25) so a
              storefront clears a ~1.7 keeper by a full head and a town reads as a skyline, not a
              hedge maze. y = h/2 - 0.1 keeps the base seated ~0.1 into the ground; tops ride the top. */}
          {!ownSolids && <Tiles cells={buildings} size={[1, 3.2, 1]} y={1.5} color={S.terrain.building} paint={paint} editing={editing} />}
          {!ownSolids && <WallTops cells={buildingTops} y={3.1} color={S.terrain.buildingTop} />}
          <Tiles cells={waters} size={[1, 0.3, 1]} y={-0.15} color={S.terrain.water} opacity={0.85} paint={paint} editing={editing} />
          {/* cloud mist = walkable encounter areas: land + a wispy translucent overlay */}
          <FloorTerrain floors={mists} heights={heights} version={version} paint={paint} editing={editing} />
          <MistOverlay mists={mists} heights={heights} />
          {/* warp markers — glowing gold columns + beacons (you place; Jin wires the destinations) */}
          <FloorTerrain floors={warps} heights={heights} version={version} paint={paint} editing={editing} color={S.terrain.warpFloor} emissive={S.terrain.warpGlow} />
          <WarpBeacons warps={warps} heights={heights} />
          {/* empty cells: invisible in play; a faint clickable grid-canvas to draw land onto while editing */}
          {editing && <Tiles cells={voids} size={[0.92, 0.05, 0.92]} y={-0.02} color={S.terrain.void} opacity={0.5} paint={paint} editing={editing} />}
        </group>
      ))}
    </>
  )
})

// An NPC stands in the world when it hasn't been cleared (defeated) and its gate flag (if any) is set.
// Gating chains the holds: Vetch only appears once `freedThistle` is true (he fled up here).
function npcInWorld(n: NPC3D, defeated: Record<string, boolean>, flags: Record<string, boolean>): boolean {
  if (defeated[n.id]) return false
  if (n.requiredFlag && !flags[n.requiredFlag]) return false
  return true
}

/** The hands' seat inside the Canvas: fill the signal from the host, tick the rig after the camera moved. */
function HandsMount({ hands, feed }: { hands: Hands; feed: () => void }) {
  const { camera } = useThree()
  useFrame((st, dt) => { feed(); hands.tick(camera, st.clock.elapsedTime, Math.min(dt, 0.1)) })
  return <primitive object={hands.group} />
}

/** What the walker's body is doing this frame — read by the hands (`voxel3d/hands.ts`), written here. */
export interface BodyOut { airborne: boolean; sliding: boolean; crouching: boolean; climbing: boolean; hanging: boolean; mantle: number; vy: number }
export const newBodyOut = (): BodyOut => ({ airborne: false, sliding: false, crouching: false, climbing: false, hanging: false, mantle: -1, vy: 0 })

function Player({ posRef, gridRef, heightsRef, zoneIdRef, editRef, onWarp, battleRef, partyLevelRef, onEncounter, joyRef, talkingRef, hasPartyRef, onNearChange, defeatedRef, flagsRef, harvestNodesRef, onNearNode, stationsRef, onNearStation, eyeRef, jumpRef, slideRef, speedMultRef, weaponMoveRef, dreamwalkRef, conjuredRef, holdRef, bodyOut }: {
  posRef: React.RefObject<THREE.Vector3>; gridRef: React.RefObject<number[][]>
  heightsRef: React.RefObject<number[][]>; zoneIdRef: React.RefObject<string>
  editRef: React.RefObject<boolean>; onWarp: (w: Warp) => void
  battleRef: React.RefObject<boolean>; partyLevelRef: React.RefObject<number>
  onEncounter: (enc: WildEncounter) => void
  joyRef: React.RefObject<{ x: number; y: number }>
  talkingRef: React.RefObject<boolean>; hasPartyRef: React.RefObject<boolean>
  onNearChange: (n: NPC3D | null) => void
  defeatedRef: React.RefObject<Record<string, boolean>>
  flagsRef: React.RefObject<Record<string, boolean>>
  harvestNodesRef: React.RefObject<ResourceNode[]>; onNearNode: (n: ResourceNode | null) => void
  stationsRef: React.RefObject<PlacedStruct[]>; onNearStation: (s: PlacedStruct | null) => void
  eyeRef: React.RefObject<number>
  jumpRef: React.RefObject<boolean>; slideRef: React.RefObject<boolean>
  /** The hands read this; the walker writes it. Optional so a harness need not care. */
  bodyOut?: BodyOut
  // potion-buff mirrors (walker updates on its coarse tick): ground-speed mult + calm-mist flag
  speedMultRef: React.RefObject<number>; dreamwalkRef: React.RefObject<boolean>
  conjuredRef: React.MutableRefObject<Conjured[]>  // SYSTEM 2 — a conjured slab is solid to the walker
  /** THE HOLD — windows are never climbable and a shut gate is a wall (`hold.ts` › keeperBlocked) */
  holdRef: React.RefObject<HoldState | null>
  weaponMoveRef: React.RefObject<number>  // weapon-state ground-speed mult: 1 holstered, <1 drawn, less ADS
}) {
  const group = useRef<THREE.Group>(null)
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0)
  const lastTile = useRef('')
  const warpCd = useRef(0)
  const encGrace = useRef(ENCOUNTER_GRACE)
  const lastNear = useRef<string | null>(null)
  const lastNode = useRef<string | null>(null)
  const lastStation = useRef<string | null>(null)
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const move = useMemo(() => new THREE.Vector3(), [])
  // ── Vertical + momentum physics (jump / slide-hop) ──
  const vy = useRef(0)              // vertical velocity, tier units/s
  const airborne = useRef(false)    // in a jump/fall (gravity owns p.y) vs grounded (ease to floor)
  const slideT = useRef(0)          // seconds of slide remaining (0 = not sliding)
  const jumpHeld = useRef(false)    // edge-detect Space so holding it doesn't auto-bounce
  const crouchHeld = useRef(false)  // edge-detect crouch key so one press = one slide
  const hvel = useMemo(() => new THREE.Vector3(), [])  // horizontal velocity (carries through slide+air)
  const airSpeed = useRef(0)        // horizontal speed locked at takeoff → preserved through the jump
  const landGrace = useRef(0)       // bhop window: counts down after landing; jump inside it = chain
  const landSpeed = useRef(0)       // horizontal speed at the moment of landing (what a chained hop keeps)
  const prevMove = useMemo(() => new THREE.Vector3(), [])  // last frame's air input dir (lurch edge-detect)
  const climbRise = useRef(0)       // vertical distance climbed this airborne stint (tiers); caps the climb, resets on ground
  const wallNormal = useMemo(() => new THREE.Vector3(), [])  // away-from-wall dir when in contact (climb + wall-jump)
  const onWall = useRef(false)      // pressed against a climbable wall this frame
  const wallCard = useRef({ x: 0, z: 0 })  // the GRID cardinal of the wall face we're on (pure ±1 on one axis) — mantle grabs straight over THIS, not the raw (diagonal) input dir
  const wallStick = useRef(0)       // wall-jump coyote timer: >0 = a wall was touched recently, Space kicks off it
  const spaceHeldT = useRef(0)      // seconds Space has been continuously held — gates a DELIBERATE climb/mantle vs a jump tap
  const hanging = useRef(false)     // gripping a ledge (the pause). forward commits up, back drops off
  const hangAt = useRef<{ cx: number; cz: number; y: number } | null>(null)  // the lip we're gripping
  const hangCard = useRef({ x: 0, z: 0 })  // over-the-lip cardinal at the moment of grab (commit/drop axis)
  const mantleT = useRef(0)         // pull-up animation timer (s), >0 while climbing over after a commit
  const mantleFrom = useMemo(() => new THREE.Vector3(), [])  // pull-up lerp endpoints
  const mantleTo = useMemo(() => new THREE.Vector3(), [])
  const hangT = useRef(0)           // time gripped (s) — must clear HANG_MIN before commit/drop can fire
  const hangLock = useRef(0)        // suppress re-grabbing a lip right after dropping off it
  const wallLock = useRef(0)        // post-kick lockout: no re-gripping the wall until this drains

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === ' ') e.preventDefault()  // space = jump, never page-scroll
      keys.current[key] = true
    }
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false }
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  useFrame((state, dt) => {
    const k = keys.current
    const grid = gridRef.current
    const heights = heightsRef.current
    const p = posRef.current
    // Multi-surface collision via the hub's segs engine. fromY = the walker's CURRENT elevation
    // (tier units) so a high road walks OVER a low road and climbing puts you onto it. EMPTY_SEGS
    // reproduces today's flat-grid behavior EXACTLY (200/200 parity) — the world lane drops its
    // authored segs in here via buildSegLayer(save-structure) once that data path lands, and nothing
    // else in this loop changes.
    // THE HOLD stacks its floors (`hold-building.ts`): it answers each cell's surfaces itself
    const ctx: CollisionCtx = zoneIdRef.current === HOLD_ZONE
      ? { grid, heights, segs: EMPTY_SEGS, surfaces: (cx, cz) => holdSurfaces(HOLD_MAP, cx, cz) }
      : { grid, heights, segs: EMPTY_SEGS }
    const fromY = p.y / STEP
    // Placed objects are solid to movement (you smack into them, no clip-through): stations always,
    // resource nodes unless they're water (wade in to fish). Adjacency interact/harvest still works
    // because you stand NEXT to the tile, never on it.
    const zoneNow = zoneIdRef.current
    const blockedByObject = (cx: number, cz: number) => {
      const structs = stationsRef.current
      if (structs) for (const s of structs) if (s.zoneId === zoneNow && s.tileX === cx && s.tileY === cz) return true
      const nodes = harvestNodesRef.current
      if (nodes) for (const n of nodes) if (n.zoneId === zoneNow && n.tileX === cx && n.tileY === cz && (NODE_LOOK[n.type]?.kind ?? 'tree') !== 'water') return true
      // ── SYSTEM 2: conjured terrain is solid to the WALKER as well. Feeding it through the same
      // predicate as stations/nodes means the body-radius buffer, the ledge logic and the axis-
      // separated slide all treat a Stonewall exactly like a wall — no separate collision path to
      // drift. It also means Cordon genuinely traps you if you cast it around yourself, which is
      // the decision the move is supposed to be.
      if (conjuredRef.current && conjuredBlockedAt(conjuredRef.current, cx, cz, performance.now())) return true
      if (zoneNow === HOLD_ZONE && holdSolid(HOLD_MAP, holdRef.current?.gatesOpen ?? null, cx, cz, fromY)) return true
      return false
    }
    const canStep = (cx: number, cz: number) =>
      editRef.current ? true : (canStandAt(ctx, cx, cz, fromY) && !blockedByObject(cx, cz))  // roam freely while editing
    // A SOLID BLOCKER (wall or object) for the body-radius buffer — vs a mere ledge/gap, which is a
    // void cell we must NOT buffer (you can still walk off drops). Three wall kinds, one non-wall:
    //   • a SOLID grid tile (console, water, world-border clouds) — has NO walkable surface, so
    //     surfacesAt sees nothing, yet the body must still buffer off its face (this is the clip-into-
    //     walls bug: the eye poked the face because the buffer treated a solid tile like empty air).
    //   • the world edge (out of bounds) — same, never let the first-person eye leave the map.
    //   • a tall cliff — HAS surfaces but none reachable from here (top > fromY+1).
    //   • a VOID cell (-1) — an intentional gap you can walk off: NOT a blocker.
    const isBlocker = (cx: number, cz: number) => {
      if (editRef.current) return false
      if (blockedByObject(cx, cz)) return true
      const row = grid[cz]
      if (cz < 0 || cz >= grid.length || !row || cx < 0 || cx >= row.length) return true  // world edge
      const tile = row[cx]
      if (tile !== -1 && SOLID[tile & 0xFF]) return true  // solid wall (VOID -1 stays walk-off-able)
      const surfs = surfacesAt(ctx, cx, cz)
      return surfs.length > 0 && !surfs.some((s) => s.y <= fromY + 1)
    }

    // Edit mode → WASD drives the spectator camera. Battle / dialogue → walker is frozen behind the
    // overlay. Either way, skip player movement / warps / encounters / NPC proximity.
    if (!editRef.current && !battleRef.current && !talkingRef.current) {
      state.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
      right.crossVectors(fwd, UP).normalize()
      move.set(0, 0, 0)
      if (k['w'] || k['arrowup']) move.add(fwd)
      if (k['s'] || k['arrowdown']) move.sub(fwd)
      if (k['d'] || k['arrowright']) move.add(right)
      if (k['a'] || k['arrowleft']) move.sub(right)
      // touch joystick (camera-relative, same as WASD): y = forward/back, x = strafe
      const j = joyRef.current
      if (j.x || j.y) { move.addScaledVector(fwd, j.y); move.addScaledVector(right, j.x) }
      const hasInput = move.lengthSq() > 0
      if (hasInput) move.normalize()
      const dt2 = Math.min(dt, 0.05)  // clamp so a stutter frame can't launch a huge step

      // ── CROUCH / SLIDE (Ctrl · C · touch ⇊), Apex-style. Crouch AT SPEED = a SLIDE (a burst that
      //    bleeds back to the run, and hops if you jump mid-slide). Crouch while SLOW = CROUCH-WALK.
      // Shift or C (NOT Ctrl — Ctrl+W closes the tab and isn't preventable in-browser).
      const crouchKey = !!k['shift'] || !!k['c'] || slideRef.current
      const curSpeed = Math.hypot(hvel.x, hvel.z)
      if (crouchKey && !crouchHeld.current && !airborne.current && curSpeed > SLIDE_MIN_SPEED && slideT.current <= 0) {
        slideT.current = SLIDE_TIME
        hvel.setLength(Math.max(SLIDE_SPEED, curSpeed * 1.35))  // faster entry → faster slide
      }
      crouchHeld.current = crouchKey
      const sliding = slideT.current > 0 && !airborne.current
      if (sliding) slideT.current -= dt
      const crouching = crouchKey && !sliding && !airborne.current  // slow crouch-walk (not a slide)
      if (bodyOut) { bodyOut.sliding = sliding; bodyOut.crouching = crouching }

      // ── WALL CONTACT (climb + wall-jump): pressed into a climbable wall in the direction we're
      //    pushing? Probe a body-radius ahead in the input dir at our current height. The post-kick
      //    lockout suppresses contact so a wall-jump actually separates instead of instantly re-gripping. ──
      if (wallLock.current > 0) wallLock.current -= dt
      onWall.current = false
      if (hasInput && wallLock.current <= 0) {
        // Which CARDINAL neighbour is actually a wall? Probe the two axis neighbours in the push
        // direction and lock onto a PURE cardinal (walls are grid-aligned). An angled approach used to
        // grab whichever axis the input leaned into even when the real wall was on the other axis — that
        // was the sideways "drift-right" on climb/mantle. Prefer the dominant input axis, but only when
        // that neighbour is genuinely blocked; otherwise take the axis that actually is.
        const pcx = Math.round(p.x), pcz = Math.round(p.z)
        const sx = Math.sign(move.x), sz = Math.sign(move.z)
        const xWall = sx !== 0 && isBlocker(pcx + sx, pcz)
        const zWall = sz !== 0 && isBlocker(pcx, pcz + sz)
        let cx = 0, cz = 0
        if (xWall && (!zWall || Math.abs(move.x) >= Math.abs(move.z))) cx = sx
        else if (zWall) cz = sz
        if (cx || cz) {
          onWall.current = true
          wallCard.current = { x: cx, z: cz }
          wallNormal.set(-cx, 0, -cz).normalize()  // pure cardinal → wall-jump kicks straight off the face too
        }
      }
      // wall-jump COYOTE: refreshed while touching a wall, bled down after — so a Space a hair after you
      // let go of the wall still kicks off it (wallNormal stays the last contact's away-dir).
      if (onWall.current) wallStick.current = WALL_COYOTE
      else if (wallStick.current > 0) wallStick.current -= dt
      // INPUT DECOUPLE (Apex model): jump, climb, and mantle used to all read raw "Space is down", so a jump
      // tap (Space down ~5-7 frames) was read as a climb/mantle HOLD and grabbed sideways. Now climb + mantle
      // require Space held past CLIMB_HOLD_MIN; the jump edge below is untouched, so a tap is a pure ballistic
      // jump. Touch = tap only (jumpRef is a one-frame edge) → touch never climbs, which is the intended
      // keyboard-skill split for now.
      if (k[' ']) spaceHeldT.current += dt2; else spaceHeldT.current = 0
      const climbActive = spaceHeldT.current >= CLIMB_HOLD_MIN
      // WALL-CLIMB: airborne + pushing into a wall + HOLDING Space past the threshold + grip left → scramble up
      // the face. Deliberate: release Space and you stop ascending (cling to gravity), so a wall never
      // auto-climbs just because you tapped-jumped into it. onWall already requires pushing forward into the
      // face — so you only climb forward.
      const climbing = airborne.current && onWall.current && climbActive && climbRise.current < CLIMB_MAX_RISE
      if (bodyOut) bodyOut.climbing = climbing

      // ── HORIZONTAL VELOCITY — auto-run with an accel RAMP (the flow), momentum through slide + air ──
      if (hanging.current || mantleT.current > 0) {
        hvel.set(0, 0, 0)  // gripping a ledge / pulling up — no horizontal drift; the vertical block owns position
      } else if (climbing) {
        // input-driven on the wall: A/D strafe ALONG the face (camera-right axis), W/S just climb. Fully
        // determined by input each frame → zero residual drift. No auto-creep over the top; topping out is a
        // deliberate held-Space mantle, so climbing just extends your reach up a tall wall.
        const strafe = Math.max(-1, Math.min(1, move.dot(right)))
        hvel.copy(right).multiplyScalar(strafe * CLIMB_STRAFE)
      } else if (airborne.current) {
        // steer the preserved takeoff momentum toward input, keep the magnitude (air control)
        if (hasInput && airSpeed.current > 0.01) {
          const dir = hvel.lengthSq() > 1e-5 ? hvel.clone().normalize() : move.clone()
          // LURCH: a sharp NEW input direction snaps momentum toward it once (Titanfall lineage).
          // Neutral→input redirects free; an actual direction CHANGE costs a little speed.
          if (prevMove.lengthSq() > 1e-5 && prevMove.dot(move) < LURCH_TURN) {
            dir.lerp(move, LURCH_STRENGTH).normalize()
            airSpeed.current *= LURCH_KEEP
          }
          dir.lerp(move, Math.min(1, AIR_CONTROL * dt2 * 12)).normalize()
          hvel.copy(dir).multiplyScalar(airSpeed.current)
        } else if (hasInput) {
          airSpeed.current = RUN_SPEED * 0.5  // let a pure-vertical jump gain a little drift
          hvel.copy(move).multiplyScalar(airSpeed.current)
        }
      } else if (sliding) {
        // bleed the burst back toward run speed over the slide; a little steering allowed
        const t = Math.max(RUN_SPEED, hvel.length() - (SLIDE_SPEED - RUN_SPEED) * (dt / SLIDE_TIME))
        if (hasInput && hvel.lengthSq() > 1e-5) {
          const dir = hvel.clone().normalize().lerp(move, 0.05).normalize()
          hvel.copy(dir).multiplyScalar(t)
        } else hvel.setLength(t)
      } else {
        // grounded run / crouch-walk: accelerate toward target speed (ramp up from a walk), coast to a
        // stop on release. This easing IS the "flow" — no more instant on/off. Backpedaling (input
        // pointing against your look dir) caps to a walk — no reverse-sprint. Strafe stays at run.
        const backpedal = hasInput && move.dot(fwd) < -0.2
        const targetSpeed = (crouching ? CROUCH_SPEED : backpedal ? BACK_SPEED : RUN_SPEED) * (speedMultRef.current ?? 1) * (weaponMoveRef.current ?? 1)
        const rate = Math.min(1, (hasInput ? GROUND_ACCEL : GROUND_FRICTION) * dt2)
        hvel.x += ((hasInput ? move.x * targetSpeed : 0) - hvel.x) * rate
        hvel.z += ((hasInput ? move.z * targetSpeed : 0) - hvel.z) * rate
      }
      if (hvel.lengthSq() > 1e-4) yaw.current = Math.atan2(hvel.x, hvel.z)  // face travel dir (avatar, seen in edit view)

      // ── apply horizontal with axis-separated collision (blocked axis kills that component). Each axis
      //    also keeps a PLAYER_R buffer against walls/objects (the cell one radius ahead in the move
      //    direction), so the first-person eye never enters a solid. Ledges aren't buffered (isBlocker
      //    ignores void), so you can still step off a drop. ──
      if (hvel.lengthSq() > 1e-6) {
        const nx = p.x + hvel.x * dt2
        const aheadX = Math.round(nx + Math.sign(hvel.x) * PLAYER_R)
        if (canStep(Math.round(nx), Math.round(p.z)) && !isBlocker(aheadX, Math.round(p.z))) p.x = nx; else hvel.x = 0
        const nz = p.z + hvel.z * dt2
        const aheadZ = Math.round(nz + Math.sign(hvel.z) * PLAYER_R)
        if (canStep(Math.round(p.x), Math.round(nz)) && !isBlocker(Math.round(p.x), aheadZ)) p.z = nz; else hvel.z = 0
      }

      // ── VERTICAL: gravity + jump + smooth ground-follow ──
      const surf = resolveStand(ctx, Math.round(p.x), Math.round(p.z), p.y / STEP)
      const floorY = (surf ? surf.y : (heights[Math.round(p.z)]?.[Math.round(p.x)] ?? 0)) * STEP
      // THE HOLD stacks floors: with nothing in reach (arriving through its door, or a reload, starts at
      // ground height) the fallback is the cell's HIGHEST floor, and easing up to it would be caught by
      // the first floor passed on the way. Snap instead, so arrival lands on the roof where the run starts.
      if (!surf && zoneIdRef.current === HOLD_ZONE && floorY > p.y + STEP) { p.y = floorY; vy.current = 0; airborne.current = false }
      const jumpKey = !!k[' '] || jumpRef.current
      jumpRef.current = false  // consume the touch edge
      const jumpEdge = jumpKey && !jumpHeld.current
      // MANTLE target: airborne + a genuine RAISED ledge/wall TOP ahead (in move dir, else facing) that is
      // both within grab reach of your feet AND more than a step above the floor beneath you (so a plain
      // jump over FLAT ground — or a walkable 1-tier step — never counts as a mantle; that was the skip bug).
      // Grab straight over the lip along the DOMINANT cardinal axis (walls are grid-aligned), so a mantle
      // pulls you forward-perpendicular — never diagonally off to the side.
      // Grab straight over the wall we're climbing: when on (or just off) a wall, use its locked GRID
      // cardinal so a mantle pulls forward-perpendicular over the lip — never sideways off a diagonal
      // input. Only a mantle onto a plain ledge off a jump (no wall contact) falls back to input dir.
      const wc = wallCard.current
      const onWallCard = (onWall.current || wallStick.current > 0) && (wc.x !== 0 || wc.z !== 0)
      const gdir = hasInput ? move : fwd
      const card = onWallCard ? wc
        : Math.abs(gdir.x) >= Math.abs(gdir.z)
        ? { x: Math.sign(gdir.x) || 1, z: 0 } : { x: 0, z: Math.sign(gdir.z) || 1 }
      const floorTier = floorY / STEP
      const mantle = airborne.current ? (() => {
        const cx = Math.round(p.x + card.x * (PLAYER_R + 0.4)), cz = Math.round(p.z + card.z * (PLAYER_R + 0.4))
        const s = surfacesAt(ctx, cx, cz).find(su => su.y <= fromY + MANTLE_REACH && su.y > floorTier + 1)  // a real lip, in reach
        return s ? { cx, cz, y: s.y } : null
      })() : null
      // LEDGE-GRAB (Titanfall/Apex feel, 07-22) — auto-mantle ROLLED BACK. Reaching a lip while a deliberate
      // climb/hold is active no longer teleports you on top: you GRAB the ledge and HANG (a real pause). From
      // the hang, press INTO the ledge to pull up + over (an eased climb, not a snap), press AWAY to drop off,
      // stay neutral to keep hanging. Enter the grab the moment a held climb brings a lip into reach.
      if (hangLock.current > 0) hangLock.current -= dt2
      if (!hanging.current && mantleT.current <= 0 && hangLock.current <= 0 && climbActive && mantle && airborne.current) {
        hanging.current = true; hangAt.current = mantle; hangT.current = 0
        hangCard.current = { x: card.x, z: card.z }  // the over-the-lip cardinal = the commit axis (never sideways)
        climbRise.current = 0
      }
      const hc = hangCard.current
      const intoLedge = hasInput ? (move.x * hc.x + move.z * hc.z) : 0  // cos to the over-lip dir: + = into, - = away
      // WALL-JUMP: airborne + Space edge + a wall in coyote, but ONLY when not hanging / pulling up / climbing.
      const wallJumping = airborne.current && jumpEdge && !hanging.current && mantleT.current <= 0 && !climbing && wallStick.current > 0
      if (wallJumping) {
        vy.current = WALLJUMP_UP
        hvel.copy(wallNormal).multiplyScalar(WALLJUMP_PUSH)
        airSpeed.current = WALLJUMP_PUSH
        wallStick.current = 0
        wallLock.current = WALLJUMP_LOCK
      }
      if (mantleT.current > 0) {
        // COMMIT pull-up: an eased climb-over from the grip to on-lip (up-biased so it reads up-then-forward).
        mantleT.current -= dt2
        const t = 1 - Math.max(0, mantleT.current) / MANTLE_TIME
        const e = t * t * (3 - 2 * t)                 // smoothstep forward
        const eUp = Math.min(1, e * 1.5)              // reach the top height a touch ahead of the forward slide
        p.x = mantleFrom.x + (mantleTo.x - mantleFrom.x) * e
        p.z = mantleFrom.z + (mantleTo.z - mantleFrom.z) * e
        p.y = mantleFrom.y + (mantleTo.y - mantleFrom.y) * eUp
        vy.current = 0
        if (mantleT.current <= 0) {
          p.x = mantleTo.x; p.y = mantleTo.y; p.z = mantleTo.z
          airborne.current = false; climbRise.current = 0
          hvel.set(hc.x, 0, hc.z).setLength(RUN_SPEED * 0.4)  // small settle onto the ledge
        }
      } else if (hanging.current && hangAt.current) {
        // HANG: gripped + frozen at the lip. A guaranteed HANG_MIN beat, THEN input decides.
        const lip = hangAt.current
        vy.current = 0
        p.y = lip.y * STEP - HANG_DROP  // hang OFF the edge, head near the top
        hangT.current += dt2
        if (hangT.current >= HANG_MIN && intoLedge > HANG_COMMIT) {
          mantleFrom.set(p.x, p.y, p.z); mantleTo.set(lip.cx, lip.y * STEP, lip.cz)
          mantleT.current = MANTLE_TIME; hanging.current = false; hangAt.current = null  // COMMIT → pull up
        } else if (hangT.current >= HANG_MIN && intoLedge < -HANG_COMMIT) {
          hanging.current = false; hangAt.current = null; hangLock.current = 0.35        // DROP → let go
          airborne.current = true; vy.current = 0
          hvel.set(hc.x, 0, hc.z).multiplyScalar(-2.2)  // small shove off the face so you don't instantly re-grip
        }
      } else if (airborne.current) {
        if (wallJumping) { p.y += vy.current * dt2 }                     // just launched: up-kick, no gravity this frame
        else if (climbing) { vy.current = CLIMB_SPEED; climbRise.current += CLIMB_SPEED * dt2; p.y += vy.current * dt2 }  // scramble up the wall face (grip caps total rise)
        else { vy.current -= GRAVITY * dt2; p.y += vy.current * dt2 }
        if (vy.current <= 0 && p.y <= floorY) {
          p.y = floorY; vy.current = 0; airborne.current = false; climbRise.current = 0  // land + refill grip
          landGrace.current = BHOP_WINDOW; landSpeed.current = hvel.length()             // open the hop-chain window
        }
      } else if (jumpKey && !jumpHeld.current) {
        airborne.current = true; vy.current = JUMP_V0
        let takeoff = Math.max(hvel.length(), hasInput ? RUN_SPEED : 0)  // carry slide/run speed up
        if (sliding) takeoff = Math.min(SPEED_CAP, hvel.length() * SLIDEHOP_BOOST)  // slide-hop: pop off the slide
        else if (landGrace.current > 0) takeoff = Math.min(SPEED_CAP, Math.max(takeoff, landSpeed.current * BHOP_KEEP))  // bhop chain
        airSpeed.current = takeoff
        if (sliding) slideT.current = 0  // the hop consumes the slide
      } else if (floorY < p.y - FALL_OFF) {
        airborne.current = true; vy.current = 0; airSpeed.current = hvel.length()  // walked off a ledge → fall
      } else {
        p.y += (floorY - p.y) * 0.25  // grounded: ease onto the floor (smooth stairs / seg step-ups)
        climbRise.current = 0         // grounded → refill climb grip
      }
      jumpHeld.current = jumpKey

      // eye dips while sliding OR crouch-walking, springs back when standing/running
      eyeRef.current += (((sliding || crouching) ? EYE_SLIDE : EYE_H) - eyeRef.current) * 0.25

      const tx = Math.round(p.x), tz = Math.round(p.z)
      const tileKey = `${tx},${tz}`
      const tileChanged = tileKey !== lastTile.current
      lastTile.current = tileKey
      if (encGrace.current > 0) encGrace.current -= dt
      if (landGrace.current > 0) landGrace.current -= dt
      if (airborne.current && hasInput) prevMove.copy(move); else prevMove.set(0, 0, 0)
      if (warpCd.current > 0) warpCd.current -= dt
      else if (tileChanged) {
        const w0 = checkWarp(ALL_ZONES, zoneIdRef.current, tx, tz)
        // the hold's floors share every cell: its way out is only a door on the floor it stands on
        const w = w0 && zoneIdRef.current === HOLD_ZONE && Math.abs(p.y / STEP - HOLD_MAP.exit.h) > 1.5 ? null : w0
        if (w) { onWarp(w); warpCd.current = 0.4; encGrace.current = ENCOUNTER_GRACE }
        // No door — a fresh mist tile can draw a wild spirit, but only once you HAVE a spirit (Greg's
        // starter). Before that the mist is just scenery, so a fresh player is never stuck in a fight.
        else if (encGrace.current <= 0 && hasPartyRef.current) {
          const cell = grid[tz]?.[tx]
          if (cell !== undefined && (cell & 0xFF) === MIST_ID) {
            // The FIRST mist a new Keeper crosses is a guaranteed draw so the arena reliably
            // introduces itself (the start zone has no mist, so this lands on the way to Thistle).
            // Every crossing after is the normal per-step rate.
            // Dreamwalk (dreamroot_elixir) calms the mist — but never eats the guaranteed first draw
            const force = !flagsRef.current.metFirstWild
            if (force || !dreamwalkRef.current) {
              const enc = rollEncounter(logicalZoneAt(zoneIdRef.current, tx, tz), false, force)
              if (enc) { encGrace.current = ENCOUNTER_GRACE; flagsRef.current.metFirstWild = true; onEncounter(enc) }
            }
          }
        }
      }

      // Nearest interactable NPC in this zone (within ~1.7 tiles) → drive the "talk" prompt. Fires
      // onNearChange only on enter/leave so we don't churn React state every frame.
      let near: NPC3D | null = null
      let best = 1.7
      for (const n of ALL_NPCS) {
        if (n.zone !== zoneIdRef.current || !npcInWorld(n, defeatedRef.current, flagsRef.current)) continue
        const d = Math.hypot(n.tileX - p.x, n.tileY - p.z)
        if (d < best) { best = d; near = n }
      }
      const nid = near?.id ?? null
      if (nid !== lastNear.current) { lastNear.current = nid; onNearChange(near) }

      // Nearest harvestable resource node (adjacent, ≤1.6 tiles) → drives the "Harvest" prompt.
      const node = findAdjacentNode(Math.round(p.x), Math.round(p.z), zoneIdRef.current, harvestNodesRef.current ?? [], 1) ?? null
      const nodeId = node?.id ?? null
      if (nodeId !== lastNode.current) { lastNode.current = nodeId; onNearNode(node) }

      // Nearest placed station (adjacent) → drives the interact prompt, generalized over ALL
      // registered station kinds (brew/craft/chest/exchange/farm).
      let nearSt: PlacedStruct | null = null; let bestD = Infinity
      for (const s of (stationsRef.current ?? [])) {
        if (s.zoneId !== zoneIdRef.current) continue
        if (!(s.itemId in STATIONS)) continue
        const d = Math.max(Math.abs(s.tileX - p.x), Math.abs(s.tileY - p.z))
        if (d > 1.4 || d >= bestD) continue
        bestD = d; nearSt = s
      }
      const stId = nearSt ? `${nearSt.itemId}@${nearSt.tileX},${nearSt.tileY}` : null
      if (stId !== lastStation.current) { lastStation.current = stId; onNearStation(nearSt) }
    }

    // The body's verbs for the hands — the ones that resolve at the end of the tick.
    if (bodyOut) {
      bodyOut.airborne = airborne.current; bodyOut.hanging = hanging.current; bodyOut.vy = vy.current
      bodyOut.mantle = mantleT.current > 0 ? 1 - mantleT.current / MANTLE_TIME : -1
    }
    const g = group.current!
    // First-person: camera lives at the eye, so the avatar would clip the lens — hide it (still shown
    // in edit/spectator and third-person).
    g.visible = editRef.current  // avatar shows only in edit's spectator view; hidden in first-person play
    g.position.set(p.x, p.y + 0.7, p.z)
    g.rotation.y = lerpAngle(g.rotation.y, yaw.current, 0.3)
  })

  return (
    <group ref={group}>
      <mesh castShadow><capsuleGeometry args={[0.3, 0.55, 4, 10]} /><meshStandardMaterial color={S.player.body} /></mesh>
      <mesh position={[0, 0.1, 0.38]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.13, 0.3, 8]} /><meshStandardMaterial color={S.player.cone} />
      </mesh>
    </group>
  )
}

// Per-skill tool HUD look (glyph + tint) for the bottom-bar tool gauges.
// the resource glyph that pops off a node on a completed harvest, per skill.
const HARVEST_GLYPH: Record<string, string> = { forestry: '🪵', prospecting: '💎', rinning: '🐟' }

// Blockout palette for the bonded Mana'mal follower (real sprites/models later, per the art rule).
const BEAST_COLOR: Record<string, string> = S.beast

// The active companion trails the player around the overworld — lags behind, catches up when you move.
// Keeps its own smoothed position (no path history needed): each frame it steps toward the player,
// stopping FOLLOW tiles away, so it strings out behind you and settles at your heel when you stop.
function Follower({ posRef, heightsRef, color }: {
  posRef: React.RefObject<THREE.Vector3>; heightsRef: React.RefObject<number[][]>; color: string
}) {
  const group = useRef<THREE.Group>(null)
  const fx = useRef<number | null>(null)
  const fz = useRef(0)
  useFrame((state, dt) => {
    const g = group.current; if (!g) return
    const p = posRef.current
    if (fx.current === null) { fx.current = p.x - 0.9; fz.current = p.z - 0.9 }
    const dx = p.x - fx.current, dz = p.z - fz.current
    const d = Math.hypot(dx, dz) || 1e-4
    const FOLLOW = 1.15
    if (d > FOLLOW) {
      const step = (d - FOLLOW) * Math.min(1, dt * 7)
      fx.current += (dx / d) * step
      fz.current += (dz / d) * step
    }
    const h = (heightsRef.current[Math.round(fz.current)]?.[Math.round(fx.current)] ?? 0) * STEP
    const bob = Math.sin(state.clock.elapsedTime * 4) * 0.05
    g.position.set(fx.current, h + 0.42 + bob, fz.current)
    g.rotation.y = Math.atan2(dx, dz)
  })
  return (
    <group ref={group}>
      <mesh castShadow><capsuleGeometry args={[0.2, 0.28, 4, 8]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      {/* glow tuft — the mana sheen */}
      <mesh position={[0, 0.32, 0]}><sphereGeometry args={[0.11, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} /></mesh>
      {/* face nub toward heading */}
      <mesh position={[0, 0.03, 0.2]}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color={S.inkDeep} /></mesh>
    </group>
  )
}

// The rinning tell — a world-space marker over the mote's head while the line's out: a faint
// ripple bob during the wait, a big pulsing `!` at the bite (strike it). Follows the player each frame.
function FishTell({ posRef, heightsRef, bite }: {
  posRef: React.RefObject<THREE.Vector3>; heightsRef: React.RefObject<number[][]>; bite: boolean
}) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = group.current, p = posRef.current; if (!g || !p) return
    const h = (heightsRef.current?.[Math.round(p.z)]?.[Math.round(p.x)] ?? 0) * STEP
    g.position.set(p.x, h + 1.55, p.z)
  })
  return (
    <group ref={group}>
      <Html zIndexRange={[20, 0]} center distanceFactor={9} pointerEvents="none">
        <style>{`@keyframes fishBang{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.28) translateY(-3px)}}
          @keyframes fishWait{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(4px);opacity:.9}}`}</style>
        <div style={{
          fontSize: bite ? 34 : 20, lineHeight: 1, userSelect: 'none', whiteSpace: 'nowrap',
          filter: bite ? `drop-shadow(0 0 8px ${S.biteGlow})` : 'none',
          animation: bite ? 'fishBang .32s ease-in-out infinite' : 'fishWait 1.5s ease-in-out infinite',
        }}>{bite ? '❗' : '〰️'}</div>
      </Html>
    </group>
  )
}

// The harvest payoff — a resource glyph that bursts off a node and floats up as it fades.
function HarvestPop({ pop }: { pop: { x: number; y: number; z: number; glyph: string; key: number } | null }) {
  if (!pop) return null
  return (
    <group key={pop.key} position={[pop.x, pop.y + 1.1, pop.z]}>
      <Html zIndexRange={[20, 0]} center distanceFactor={9} pointerEvents="none">
        <style>{`@keyframes gpop{0%{transform:translateY(8px) scale(.4);opacity:0}28%{opacity:1}100%{transform:translateY(-28px) scale(1.1);opacity:0}}`}</style>
        <div style={{ fontSize: 26, lineHeight: 1, userSelect: 'none', animation: 'gpop .85s ease-out forwards', filter: `drop-shadow(0 0 6px ${S.popGlow})` }}>{pop.glyph}</div>
      </Html>
    </group>
  )
}

function CameraRig({ posRef, editFocusRef, yawRef, editRef, eyeRef, adsRef, recoilRef }: {
  posRef: React.RefObject<THREE.Vector3>; editFocusRef: React.RefObject<THREE.Vector3>
  yawRef: React.RefObject<number>; editRef: React.RefObject<boolean>
  eyeRef: React.RefObject<number>; adsRef: React.RefObject<boolean>
  recoilRef: React.MutableRefObject<{ p: number; y: number }>
}) {
  const yaw = yawRef
  const pitch = useRef(0.6)          // orbit polar angle (third-person / spectator)
  const lookPitch = useRef(0)        // FPS look elevation, radians above/below horizon
  const dist = useRef(11)
  const keys = useRef<Record<string, boolean>>({})
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    let dragging = false, lx = 0, ly = 0
    const isLocked = () => document.pointerLockElement instanceof Element
    // First-person play: a click on the canvas CAPTURES the pointer (requestPointerLock) so the mouse
    // just moves the view — the Supra free-look feel. Esc releases (browser default). Drag-look stays
    // as the fallback when unlocked (and on touch), and orbit/edit keep their drag behavior.
    const dn = (e: PointerEvent) => {
      if (isLocked()) return // already captured — clicks are for future interact, not re-locking
      // Mouse only: pointer-lock is a desktop concept. Touch/pen fall through to drag-look below so
      // phones keep their finger-drag look (and the joystick handles movement).
      if (e.pointerType === 'mouse' && !editRef.current && e.target instanceof HTMLCanvasElement) {
        void (e.target as HTMLCanvasElement).requestPointerLock?.()
        return
      }
      const ok = editRef.current ? e.button === 2 : e.button === 0
      if (!ok) return
      // only orbit from drags that START on the 3D canvas — touches on the joystick / buttons / HUD
      // are theirs, not the camera's.
      if (!(e.target instanceof HTMLCanvasElement)) return
      dragging = true; lx = e.clientX; ly = e.clientY
    }
    const mv = (e: PointerEvent) => {
      if (isLocked()) {
        // captured free-look: raw mouse deltas drive yaw + look elevation directly.
        if (editRef.current) { document.exitPointerLock?.(); return }
        const sens = adsRef.current ? 0.0014 : 0.0022  // slower turn while aiming, for precision
        yaw.current -= e.movementX * sens
        lookPitch.current = Math.max(-1.25, Math.min(1.25, lookPitch.current - e.movementY * sens))
        return
      }
      if (!dragging) return
      yaw.current -= (e.clientX - lx) * 0.005
      pitch.current = Math.max(0.2, Math.min(1.45, pitch.current - (e.clientY - ly) * 0.004))
      // FPS look elevation shares the same drag; clamped short of straight up/down so the horizon never flips.
      lookPitch.current = Math.max(-1.25, Math.min(1.25, lookPitch.current - (e.clientY - ly) * 0.004))
      lx = e.clientX; ly = e.clientY
    }
    const up = () => { dragging = false }
    const wh = (e: WheelEvent) => { if (editRef.current) dist.current = Math.max(4, Math.min(40, dist.current + e.deltaY * 0.012)) }  // edit-only orbit zoom; in play the wheel is the hotbar's (the hud bar's wheel listener)
    const ctx = (e: Event) => { if (editRef.current || e.target instanceof HTMLCanvasElement) e.preventDefault() } // no browser menu on the play/edit canvas (right-click is use-item)
    const kd = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true }
    const ku = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false }
    window.addEventListener('pointerdown', dn); window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up); window.addEventListener('wheel', wh, { passive: true })
    window.addEventListener('contextmenu', ctx); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => {
      window.removeEventListener('pointerdown', dn); window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up); window.removeEventListener('wheel', wh)
      window.removeEventListener('contextmenu', ctx); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
    }
  }, [editRef, yaw])
  useFrame((state, dt) => {
    const editing = editRef.current
    const target = editing ? editFocusRef.current : posRef.current
    if (editing) {
      // spectator fly: WASD pans (camera-relative, ground plane), Q/E lower/raise
      const k = keys.current
      state.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
      right.crossVectors(fwd, UP).normalize()
      const sp = dist.current * Math.min(dt, 0.05) * 1.4
      if (k['w'] || k['arrowup']) target.addScaledVector(fwd, sp)
      if (k['s'] || k['arrowdown']) target.addScaledVector(fwd, -sp)
      if (k['d'] || k['arrowright']) target.addScaledVector(right, sp)
      if (k['a'] || k['arrowleft']) target.addScaledVector(right, -sp)
      if (k['e']) target.y += sp
      if (k['q']) target.y -= sp
    }
    const cam = state.camera as THREE.PerspectiveCamera
    const fps = !editing  // play is always first-person; edit uses the spectator orbit cam
    // Wider fov in FPS for the Supra feel; ADS (right-click hold) lerps it down to zoom. Lerp toward
    // the target so the zoom is smooth, then snap+stop touching the projection matrix once settled.
    const wantFov = fps ? (adsRef.current ? ADS_FOV : FPS_FOV) : ORBIT_FOV
    if (Math.abs(cam.fov - wantFov) > 0.1) {
      cam.fov += (wantFov - cam.fov) * Math.min(1, dt * 14)
      cam.updateProjectionMatrix()
    } else if (cam.fov !== wantFov) { cam.fov = wantFov; cam.updateProjectionMatrix() }

    if (fps) {
      // Weapon recoil: drain the pending kick into the REAL look angles over ~50ms (smooth, not a snap).
      // No auto-return — the climb is the player's to fight, so spray control is a skill (Apex model).
      const rec = recoilRef.current
      if (rec.p !== 0 || rec.y !== 0) {
        const k = Math.min(1, dt * 22)
        lookPitch.current = Math.min(1.25, lookPitch.current + rec.p * k)
        yaw.current += rec.y * k
        rec.p *= 1 - k; rec.y *= 1 - k
        if (Math.abs(rec.p) < 1e-4 && Math.abs(rec.y) < 1e-4) { rec.p = 0; rec.y = 0 }
      }
      // Eye-cam: camera AT the walker, looking along (yaw, lookPitch). Horizontal forward matches the
      // orbit's so WASD (which reads camera.getWorldDirection) stays identical between views.
      const cp = Math.cos(lookPitch.current), sp = Math.sin(lookPitch.current)
      const fx = -Math.sin(yaw.current) * cp, fz = -Math.cos(yaw.current) * cp
      const ey = target.y + (eyeRef.current ?? EYE_H)
      cam.position.set(target.x, ey, target.z)
      cam.lookAt(target.x + fx, ey + sp, target.z + fz)
      return
    }

    // Orbit / spectator follow-cam.
    const s = Math.sin(pitch.current), c = Math.cos(pitch.current)
    cam.position.set(
      target.x + dist.current * s * Math.sin(yaw.current),
      target.y + dist.current * c,
      target.z + dist.current * s * Math.cos(yaw.current),
    )
    cam.lookAt(target.x, target.y + 0.4, target.z)
  })
  return null
}

// memo: the parent re-renders on every HUD tick — mana regen fires setManaFrac at 2 Hz whenever mana
// is below full, and the harvest channel driver fires setChannel at ~11 Hz. Neither touches a Scene
// prop, so without memo the entire 3D subtree was reconciled for a number that only the HUD reads.
// Every prop here is a ref, a primitive, a useCallback, or state that genuinely should redraw.
// ── FIRING RANGE / WEAPON (outside-Ather) ──────────────────────────────────────────────────────
// The first weapon is a projectile caster: click fires a travelling energy round from the reticle.
// Hitscan would be snappier, but a visible round reads like a sigil-cast — the outside-Ather weapon.
// Mounted only in 'outside' zones. Ref-based pool + instanced render (no per-shot React re-render).
const PROJECTILE_SPEED = 34   // tiles/sec
const PROJECTILE_LIFE = 1.8   // seconds before it fizzles
const FIRE_COOLDOWN = 0.11    // seconds between shots while holding fire (~9/sec full-auto)
const TARGET_HIT_R2 = 0.72 * 0.72
const TARGET_RESPAWN = 2.5     // seconds a popped target stays down
const TRAIL_N = 8             // trail links behind each round — rendered as stretched segments = one thin tracer line
const HEAD_R = 0.06           // round head radius — tracers are THIN (Apex-style), the streak is the read, not the ball
const TRAIL_R = 0.045         // tracer line radius at the head end; tapers to ~0 down the tail
const CONVERGE_DIST = 38      // muzzle rounds converge onto the crosshair ray at this range (Apex muzzle→reticle model)
// Muzzle offset in camera space [right, down, forward]: rounds spawn at the weapon, not the eye, so the
// tracer visibly rises from low-right up to the reticle. ADS pulls the muzzle near center for a flat streak.
const MUZZLE_HIP: [number, number, number] = [0.34, 0.26, 0.6]
const MUZZLE_ADS: [number, number, number] = [0.1, 0.08, 0.6]
// ── SPITTER accuracy model (Apex-style) — the shortbarrel's consts, reused as WEAPONS[0] ── hipfire fires inside a spread cone that BLOOMS while you
// spray and recovers when you let off; ADS collapses the cone to near-true. Recoil kicks the ACTUAL
// camera (pitch climb + horizontal jitter) and never auto-returns — you fight it by pulling down.
const HIP_SPREAD = 2.2        // deg — base hipfire cone half-angle
const ADS_SPREAD = 0.25       // deg — aimed fire is near-true
const BLOOM_PER_SHOT = 0.45   // deg of cone added per round fired
const BLOOM_MAX = 2.6         // deg — bloom cap (hip cone tops out ~4.8°)
const BLOOM_DECAY = 5         // deg/sec cone recovery while not firing
const ADS_BLOOM_SCALE = 0.35  // aimed fire blooms much less
const KICK_PITCH = 0.0075     // rad of camera climb per round
const KICK_YAW = 0.0035       // rad max random horizontal drift per round
const DEG = Math.PI / 180
// ── damage model ── the DEFAULT range is peaceful (targets never shoot). Danger is opt-in via the
// range console (T): target drift, or a ground HUNTER that chases the player and returns fire — that's
// when HP/shield matter. Shield drains first + recharges out of combat; HP does NOT regen (healing
// arrives later as items — that's what makes them matter). HP empty → systems reset (full refill).
const AM_DAMAGE = 7           // AM Riser damage per round, body (it's a SIDEARM — no two-shot deletes)
const AM_CRIT = 11            // crit — bullseye core on boards, head zone on the hunter
const CRIT_Y = 0.25           // hunter: hit above center + this = the head zone
const TARGET_R = 0.6          // target board radius (white disc; red ring inside it)
const TARGET_CRIT_R = 0.2     // the gold core — a round landing inside it is the bullseye crit
const TARGET_HP = 21          // 3 body rounds / 2 crits to pop a board (rescaled to the 7-dmg round)
const DRONE_DMG = 11          // hunter orb damage to the player
const DRONE_SPEED = 9         // tiles/sec — slow on purpose, dodging is the counterplay
const DRONE_LIFE = 6          // seconds before an orb fizzles
// ⚠ HUNTER_SPEED and HUNTER_FIRE_CD USED TO LIVE HERE AND ARE NOW `RANGE_HUNTER` in
// `engine/hunter-ai.ts`. They were deleted rather than left behind: a constant that still looks
// like a dial but no longer reaches anything is the worst kind of stale — the next person tunes it,
// sees no change, and concludes the FEEL is unfixable rather than the knob unplugged. The hunter's
// HP stays here because the host owns damage and death; the module never touches either.
const HUNTER_HP = 35          // ground hunter takes 5 body rounds (rescaled)
const HUNTER_HIT_R2 = 0.8 * 0.8
const HUNTER_RESPAWN = 4      // seconds after a kill before it re-spawns (while the console toggle is on)
const DRIFT_AMP = 2.4         // moving-targets strafe amplitude (tiles)
const PLAYER_HIT_R2 = 0.6 * 0.6
const MAX_HP = 100            // health and shields each count 100 — 200 effective, Apex-style
const MAX_SHIELD = 100
const BARRIER_SHIELD_BONUS = 25  // the Barrier birth rune's extra shield (125 total for that mage).
// shieldMaxRef carries the live max — birth-rune selection just writes MAX_SHIELD + BARRIER_SHIELD_BONUS.
// NO auto-regen on HP or shield — Shimmer Salve mends HP, Crystal Elixir re-forms the shield
// (HEAL_POTIONS above). Resource discipline is the game: mana is the clip, potions are the comeback.
const CLIP_SIZE = 24          // rounds per recharge of the AM Riser's clip
const RELOAD_TIME = 1.4       // seconds — the recharge channel
const RELOAD_MANA = 10        // mana for a FULL clip recharge (partial recharges cost proportionally)
// ★ CANON COLOUR LAW (game/weapons.md): "colour is never part of a weapon — the colour is whose hand
// it answers." A manabox is dead grey metal; the compacted-mana round trails the WIELDER's own
// soul-frequency colour, ONE colour across every gun they hold. Placeholder player-cyan (Kael's
// frequency) until birth-rune selection sets the player's frequency → then this reads from it.
const SOUL_COLOR = S.soul
// ── MANABOX TABLE ── the two Crucible casters share the FiringRange sim; the live weapon's stats
// drive fire behaviour, round SHAPE, AND the movement penalty (weaponIdxRef selects — Q swaps, F
// holsters). Weapon 0 REUSES the shortbarrel consts above so there is one source of truth.
// hipMove/adsMove = ground-speed multipliers vs RUN_SPEED — holstered is always 1.0, so stowing is
// how you run full-speed. ADS < hip < holstered, and the heavy Lance slows you more than the SMG.
// ── CANON (game/pyramid-zero.md › Manaboxes, RULED 2026-07-24): these are Manalic-tier manaboxes,
// named by SLATE+MODEL from game/weapons.md. The two starters are the code-less baseline anchors:
// SPITTER (shortbarrel/SMG, full-auto) + LANCE (reacher/sniper, single-shot). ★ COLOUR LAW: colour is
// never part of a weapon — the gun is dead grey metal and the round trails the WIELDER's soul-colour
// (SOUL_COLOR below), ONE colour across both guns. Weapons read distinct by silhouette + round shape
// (headR/trailR) + fire behaviour, NEVER by tracer colour. So no per-weapon `color` field exists.
// ★ THE TABLE MOVED OUT 2026-08-07 → `engine/weapons.ts`, so voxel3d and play3d share one
// definition of what a Lance is. It was extracted, not copied: two tables would have drifted the
// first time either was tuned, and a gun that behaves differently depending on which walker you
// are in is the kind of bug nobody files because it just feels wrong. Values are unchanged —
// `engine/weapons.test.ts` asserts the three feels stay distinct so a future tune cannot flatten
// them silently.
//
// The FiringRange rig below stays here. It resolves collision against `gridRef` (a tile grid) and
// carries four other systems besides gunplay; voxel3d owns its own, voxel-DDA hit detection.
// Downrange targets for the range — floating orbs at varied spots/heights in Alex's 50×50.
const RANGE_TARGETS: [number, number, number][] = [
  [15, 1.8, 26], [20, 2.5, 31], [25, 1.6, 23], [30, 2.9, 33],
  [35, 2.0, 27], [12, 2.3, 35], [38, 1.7, 21], [22, 3.1, 39],
]
// Gun benches — the practice-range armory. Walk up (E) to open the loadout editor and build your two
// slots from the arsenal. Placed at the NEAR side of the range (the firing line is low-z; targets are
// downrange z 21-39). [x, y, z] — TUNABLE like RANGE_TARGETS; nudge y to sit them on the arena floor.
const GUN_BENCHES: [number, number, number][] = [
  [14, 0, 12], [24, 0, 10], [34, 0, 12],
]
const BENCH_NEAR_R = 2.4  // tiles — how close you must stand to open a bench
// Cast-iron/bronze manabox armory bench — a real GLB prop (Meshy image-to-3d off the ruled concept),
// rendered through the shared StationProp pipeline (Suspense + error boundary → blockout on any GLB
// failure; height auto-fit; Draco). Dead grey per the colour law. Positions are the tunable GUN_BENCHES.
const BENCH_DEF = { name: 'Gun Bench', color: S.crucible.bench, accent: SOUL_COLOR, h: 2.0 }
function GunBenches() {
  return (
    <>
      {GUN_BENCHES.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <StationProp id="gun_bench" def={BENCH_DEF} />
        </group>
      ))}
    </>
  )
}
/**
 * How often Tremor Sense re-reads the ground, seconds. ~10Hz.
 * ★ Derived, not taste: the fastest body that walks covers under half a world unit in this window,
 * which is a fraction of a degree on a ring 24 units wide. A faster sense would burn frames to
 * report a difference that cannot be seen.
 */
const SENSE_TICK = 0.1

// ── THE HOLD's picture (`hold.ts`) ────────────────────────────────────────────────────────────
// Draws only: the flooded, the seals, the shut gates and the three fixtures. Reads the run the
// parent owns and never writes it. A blockout for feel — the flooded are wet dark mass because what
// the host raised is shown and what made the host is not (guardrail 1); real bodies are a later pass.
const HOLD_BODY_MAX = 40
const HOLD_DROP_MAX = 8
const HOLD_FLOOD_COLOR = { drift: new THREE.Color(S.hold.body), swift: new THREE.Color(S.hold.swift), bulk: new THREE.Color(S.hold.bulk) }
// THE HOLD's building (`hold-building.ts`): every floor's slab, walls, rails and ramps, drawn once.
// Cells are merged into runs along each row, so a 50-block wall is one box, not fifty.
type HoldBox = [number, number, number, number, number, number]  // centre x y z, size x y z
function HoldBoxes({ boxes, color }: { boxes: HoldBox[]; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3()
    boxes.forEach(([x, y, z, sx, sy, sz], i) => { v.set(x, y, z); sc.set(sx, sy, sz); m.compose(v, q, sc); mesh.setMatrixAt(i, m) })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [boxes])
  if (!boxes.length) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </instancedMesh>
  )
}
function HoldBuilding() {
  const b = HOLD_MAP.building
  const built = useMemo(() => {
    const { cols, rows } = b
    const SLAB = 0.3
    // windows whose run ends against a wall (vs a gap in a rail)
    const inWall = new Set<number>()
    for (const w of HOLD_MAP.windows) {
      const L = b.levels[w.lv]
      const walled = w.cells.some(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => L.kind[(c.z + dz) * cols + c.x + dx] === HB.WALL))
      if (walled) for (const c of w.cells) inWall.add(w.lv * cols * rows + c.z * cols + c.x)
    }
    // runs of cells along each row that pass `pick`, as boxes spanning y0..y1
    const runs = (pick: (i: number) => boolean, y0: number, y1: number, out: HoldBox[]) => {
      for (let z = 0; z < rows; z++) {
        let x = 0
        while (x < cols) {
          if (!pick(z * cols + x)) { x++; continue }
          const x0 = x
          while (x < cols && pick(z * cols + x)) x++
          out.push([(x0 + x - 1) / 2, (y0 + y1) / 2, z, x - x0, y1 - y0, 1])
        }
      }
    }
    const levels = b.levels.map((L, li) => {
      const floor: HoldBox[] = [], garden: HoldBox[] = [], pad: HoldBox[] = [], wall: HoldBox[] = [], rail: HoldBox[] = [], lintel: HoldBox[] = [], unit: HoldBox[] = []
      const k = L.kind
      const solidUnder = (i: number) => k[i] !== HB.VOID && k[i] !== HB.RAMP && k[i] !== HB.LANDING
      runs(i => solidUnder(i) && !L.tone[i], L.y - SLAB, L.y, floor)
      runs(i => solidUnder(i) && L.tone[i] === 1, L.y - SLAB, L.y, garden)
      runs(i => solidUnder(i) && L.tone[i] === 2, L.y - SLAB, L.y + 0.02, pad)
      runs(i => k[i] === HB.BLOCK && L.tone[i] !== 1, L.y, L.y + BLOCK_H, unit)
      // in a garden a unit is a hedge or a shrub, and a wall is a tree
      const hedge: HoldBox[] = [], tree: HoldBox[] = []
      runs(i => k[i] === HB.BLOCK && L.tone[i] === 1, L.y, L.y + BLOCK_H, hedge)
      runs(i => k[i] === HB.WALL && L.tone[i] === 1, L.y, L.y + STOREY_H - 0.3, tree)   // as tall as it is solid
      runs(i => k[i] === HB.WALL && L.tone[i] !== 1, L.y, L.y + STOREY_H - SLAB, wall)
      runs(i => k[i] === HB.RAIL, L.y, L.y + 1.0, rail)
      // over a window and a gate the wall carries on as a lintel, so the opening reads as a hole in it
      // …but only over a window set in a WALL: a gap in a rail (the rooftop's edge, a garden's) is open sky
      runs(i => k[i] === HB.WINDOW && inWall.has(li * cols * rows + i), L.y + 2.4, L.y + STOREY_H - SLAB, lintel)
      runs(i => k[i] === HB.WINDOW && inWall.has(li * cols * rows + i), L.y, L.y + 0.35, lintel)
      runs(i => k[i] === HB.GATE, L.y + 2.4, L.y + STOREY_H - SLAB, lintel)
      // the top floor carries the roof — unless it is open to the sky (the rooftop)
      const roof: HoldBox[] = []
      if (li === b.levels.length - 1 && !L.open) runs(i => k[i] !== HB.VOID && L.tone[i] !== 1, L.y + STOREY_H - SLAB, L.y + STOREY_H, roof)
      return { floor, garden, pad, wall, rail, lintel, roof, unit, hedge, tree, colors: S.hold.levels[li] ?? S.hold.levels[0] }
    })
    // ramps: one tilted slab per run, from its low edge to its high edge
    const ramps = b.ramps.map(r => {
      const along = (c: { x: number; z: number }) => c.x * r.dir[0] + c.z * r.dir[1]
      const lo = Math.min(...r.cells.map(along)), hi = Math.max(...r.cells.map(along)), len = hi - lo + 1
      const xs = r.cells.map(c => c.x), zs = r.cells.map(c => c.z)
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2
      const width = r.dir[0] !== 0 ? Math.max(...zs) - Math.min(...zs) + 1 : Math.max(...xs) - Math.min(...xs) + 1
      const rise = r.y1 - r.y0, slope = Math.hypot(len, rise), tilt = Math.atan2(rise, len)
      // the slab's length runs along the ramp; tilt it so its far (uphill) end rises
      const rot: [number, number, number] = r.dir[0] !== 0 ? [0, 0, r.dir[0] * tilt] : [-r.dir[1] * tilt, 0, 0]
      const size: [number, number, number] = r.dir[0] !== 0 ? [slope, 0.25, width] : [width, 0.25, slope]
      return { key: `${r.lv}-${cx}-${cz}`, pos: [cx, (r.y0 + r.y1) / 2 - 0.12, cz] as [number, number, number], rot, size }
    })
    // landings: flat, at the height the stair reaches the turn
    const landings: HoldBox[] = b.landings.flatMap(l => l.cells.map(c => [c.x, l.y - 0.125, c.z, 1, 0.25, 1] as HoldBox))
    return { levels, ramps, landings }
  }, [b])
  return (
    <>
      {built.levels.map((l, i) => (
        <group key={i}>
          <HoldBoxes boxes={l.floor} color={l.colors.floor} />
          <HoldBoxes boxes={l.roof} color={l.colors.floor} />
          <HoldBoxes boxes={l.garden} color={S.hold.garden} />
          <HoldBoxes boxes={l.pad} color={S.hold.pad} />
          <HoldBoxes boxes={l.unit} color={S.hold.unit} />
          <HoldBoxes boxes={l.hedge} color={S.hold.hedge} />
          <HoldBoxes boxes={l.tree} color={S.hold.tree} />
          <HoldBoxes boxes={l.wall} color={l.colors.wall} />
          <HoldBoxes boxes={l.rail} color={S.hold.rail} />
          <HoldBoxes boxes={l.lintel} color={S.hold.lintel} />
        </group>
      ))}
      <HoldBoxes boxes={built.landings} color={S.hold.ramp} />
      {built.ramps.map(r => (
        <mesh key={r.key} position={r.pos} rotation={r.rot}>
          <boxGeometry args={r.size} />
          <meshStandardMaterial color={S.hold.ramp} roughness={0.85} />
        </mesh>
      ))}
    </>
  )
}

function HoldScene({ holdRef }: { holdRef: React.RefObject<HoldState | null> }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const planks = useRef<THREE.InstancedMesh>(null)
  const gates = useRef<THREE.InstancedMesh>(null)
  const drops = useRef<THREE.InstancedMesh>(null)
  // the landing is one fixed map (the zone's grid and heights are generated from it), so sizing the
  // pools off it never waits on a run existing — a run that starts after mount still has meshes
  const map = HOLD_MAP
  const plankMax = map.windows.length * HOLD_TUNING.seals
  const gateMax = map.gates.reduce((n, g) => n + g.cells.length, 0)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  const zero = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  useFrame((state) => {
    const s = holdRef.current
    if (!s) return
    const t = state.clock.elapsedTime
    if (bodies.current) {
      let i = 0
      for (const b of s.flood) {
        if (!b.alive || i >= HOLD_BODY_MAX) continue
        const size = b.kind === 'bulk' ? 1.35 : b.kind === 'swift' ? 0.8 : 1
        // a body at a window heaves at the sill; one inside rolls as it comes
        const heave = b.phase === 'tear' ? 0.12 * Math.sin(t * 7 + b.id) : 0.05 * Math.sin(t * 4 + b.id)
        v.set(b.x, b.y * STEP + 0.45 * size + heave, b.z)
        sc.set(size * (1 + heave), size * (0.9 - heave), size * (1 + heave))
        m.compose(v, q.identity(), sc)
        bodies.current.setMatrixAt(i, m)
        bodies.current.setColorAt(i, HOLD_FLOOD_COLOR[b.kind])
        i++
      }
      for (let k = i; k < HOLD_BODY_MAX; k++) { m.compose(zero, q.identity(), zero); bodies.current.setMatrixAt(k, m) }
      bodies.current.instanceMatrix.needsUpdate = true
      if (bodies.current.instanceColor) bodies.current.instanceColor.needsUpdate = true
    }
    if (planks.current) {
      let i = 0
      for (const w of s.map.windows) {
        const alongX = w.cells[0].z === w.cells[w.cells.length - 1].z
        const ix = (w.inside.x - w.mid.x) * 0.3, iz = (w.inside.z - w.mid.z) * 0.3
        for (let k = 0; k < HOLD_TUNING.seals; k++) {
          const up = k < s.planks[w.id]
          // planks bar the gap from the sill up — the parapet's own height and a little over
          v.set(w.mid.x + ix, w.h * STEP + 0.12 + k * 0.2, w.mid.z + iz)
          q.setFromAxisAngle(UP, alongX ? 0 : Math.PI / 2)
          sc.setScalar(up ? 1 : 0)
          m.compose(v, q, sc)
          planks.current.setMatrixAt(i++, m)
        }
      }
      planks.current.instanceMatrix.needsUpdate = true
    }
    if (drops.current) {
      let i = 0
      for (const d of s.drops) {
        if (i >= HOLD_DROP_MAX) break
        const on = d.ttl > 5 || Math.sin(t * 14) > 0
        v.set(d.x, d.y * STEP + 0.9 + 0.12 * Math.sin(t * 2.5 + d.id), d.z)
        q.setFromAxisAngle(UP, t * 1.8)
        sc.setScalar(on ? 1 : 0)
        m.compose(v, q, sc)
        drops.current.setMatrixAt(i++, m)
      }
      for (let k = i; k < HOLD_DROP_MAX; k++) { m.compose(zero, q.identity(), zero); drops.current.setMatrixAt(k, m) }
      drops.current.instanceMatrix.needsUpdate = true
    }
    if (gates.current) {
      let i = 0
      for (const g of s.map.gates) for (const c of g.cells) {
        const shut = !s.gatesOpen[g.id]
        v.set(c.x, g.h * STEP + 1.2, c.z)
        sc.setScalar(shut ? 1 : 0)
        m.compose(v, q.identity(), sc)
        gates.current.setMatrixAt(i++, m)
      }
      gates.current.instanceMatrix.needsUpdate = true
    }
  })
  const at = (f: { x: number; z: number; h: number }): [number, number, number] => [f.x, f.h * STEP, f.z]
  return (
    <>
      <HoldBuilding />
      <instancedMesh ref={bodies} args={[undefined, undefined, HOLD_BODY_MAX]} frustumCulled={false}>
        <sphereGeometry args={[0.45, 14, 12]} />
        <meshStandardMaterial color={S.white} emissive={S.hold.bodySheen} emissiveIntensity={0.18} roughness={0.25} metalness={0.1} />
      </instancedMesh>
      <instancedMesh ref={drops} args={[undefined, undefined, HOLD_DROP_MAX]} frustumCulled={false}>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color={S.hold.glimmer} emissive={S.hold.glimmer} emissiveIntensity={1.4} toneMapped={false} />
      </instancedMesh>
      {plankMax > 0 && (
        <instancedMesh ref={planks} args={[undefined, undefined, plankMax]} frustumCulled={false}>
          <boxGeometry args={[2.1, 0.16, 0.12]} />
          <meshStandardMaterial color={S.hold.plank} roughness={0.9} />
        </instancedMesh>
      )}
      {gateMax > 0 && (
        <instancedMesh ref={gates} args={[undefined, undefined, gateMax]} frustumCulled={false}>
          <boxGeometry args={[1, 2.4, 1]} />
          <meshStandardMaterial color={S.hold.gate} emissive={S.hold.gateRim} emissiveIntensity={0.08} metalness={0.3} roughness={0.7} />
        </instancedMesh>
      )}
      {/* the rack: a dark board with the weapon laid across it */}
      <group position={at(map.rack)}>
        <mesh position={[0.35, 1.2, 0]}><boxGeometry args={[0.12, 1.1, 1.4]} /><meshStandardMaterial color={S.hold.rack} /></mesh>
        <mesh position={[0.27, 1.2, 0]}><boxGeometry args={[0.1, 0.16, 1.0]} /><meshStandardMaterial color={S.viewmodel.spitterBronze} /></mesh>
      </group>
      {/* the font: a stone basin with lit water — mana is the clip, so this is where ammo lives */}
      <group position={at(map.font)}>
        <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.45, 0.55, 0.8, 16]} /><meshStandardMaterial color={S.hold.gate} /></mesh>
        <mesh position={[0, 0.81, 0]}><cylinderGeometry args={[0.38, 0.38, 0.04, 16]} /><meshStandardMaterial color={S.hold.font} emissive={S.hold.font} emissiveIntensity={0.9} /></mesh>
      </group>
      {/* the cache: a crate of draught with a violet glint */}
      <group position={at(map.cache)}>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[0.7, 0.7, 0.7]} /><meshStandardMaterial color={S.hold.plank} /></mesh>
        <mesh position={[0, 0.75, 0]}><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial color={S.hold.cache} emissive={S.hold.cache} emissiveIntensity={1.1} /></mesh>
      </group>
    </>
  )
}

function FiringRange({ zoneId, firingRef, adsRef, weaponIdxRef, gridRef, recoilRef, bloomRef, posRef, hpRef, hpMaxRef, shieldRef, shieldMaxRef, rangeCfgRef, ammoRef, reloadingRef, pendingCastRef, castMultRef, resistRef, senseRadiusRef, tremorRef, birthRuneRef, infusionRef, fieldsRef, conjuredRef, holdRef, statusRef, onHeal, onNeedReload, onHit, onShot, onPlayerDamage, onPlayerDown, onTrial, onMatch }: {
  firingRef: React.RefObject<boolean>   // held while left-click is down → full-auto (semi-auto weapons fire once per press)
  adsRef: React.RefObject<boolean>      // aiming → muzzle offset moves to center (ADS tracer runs flat)
  weaponIdxRef: React.RefObject<number> // which WEAPONS entry is live — drives fire stats + tracer look
  gridRef: React.RefObject<number[][]>
  recoilRef: React.MutableRefObject<{ p: number; y: number }>  // pending camera kick; CameraRig drains it
  bloomRef: React.MutableRefObject<number>  // current spread bloom (deg); WeaponReticle reads it too
  /** the worn sense's reach in world units — `spec.senseRadius`, 0 when the keeper wears no sense */
  senseRadiusRef: React.RefObject<number>
  /** where the scene POSTS what the keeper feels; `TremorSenseHud` is the only reader. See below. */
  tremorRef: React.MutableRefObject<TremorReadout>
  posRef: React.RefObject<THREE.Vector3>    // player position — hunter orbs aim at + collide with it
  hpRef: React.MutableRefObject<number>     // player HP; ResourceBars reads, this sim writes
  shieldRef: React.MutableRefObject<number> // player shield; drains first — mend potions refill it
  hpMaxRef: React.RefObject<number>         // live HP cap (100, +bonus with the Life birth rune)
  shieldMaxRef: React.RefObject<number>     // live shield cap (100, +25 with the Barrier birth rune)
  rangeCfgRef: React.RefObject<RangeCfg>  // range console (T) settings — incl. live guard tuning
  /** which zone this sim is running in. The SAME component serves the range and the Crucible —
   *  `realm: outside` + not peaceful is both — so anything belonging to only one of them (the
   *  bot fleet) has to ask. */
  zoneId: string
  ammoRef: React.MutableRefObject<number>       // rounds left in the clip; this sim decrements
  reloadingRef: React.MutableRefObject<number>  // >0 while the recharge channel runs — fire is blocked
  // The cast layer resolves slot → move → spec in the PARENT (where mana/hp/stance live) and hands
  // this sim only the projectile it should spawn. Non-projectile archetypes never reach here.
  pendingCastRef: React.MutableRefObject<CastSpec | null>
  castMultRef: React.RefObject<number>   // held-stance multiplier on cast damage (Flame Manipulation)
  resistRef: React.RefObject<number>     // held-stance fraction of incoming damage absorbed (Barrier/Iron Skin)
  birthRuneRef: React.RefObject<string | null>  // what the keeper IS — for attunement resistance (canon v3)
  infusionRef: React.RefObject<{ until: number; mult: number }>  // Flame Infusion — a WEAPON-damage window
  fieldsRef: React.MutableRefObject<Field[]>       // SYSTEM 1 — area entities (this sim ticks them)
  conjuredRef: React.MutableRefObject<Conjured[]>  // SYSTEM 2 — runtime terrain (blocks everything)
  /** THE HOLD's run, owned by the parent (the HUD and E/G read it); this sim steps it and lands rounds on it */
  holdRef: React.MutableRefObject<HoldState | null>
  statusRef: React.MutableRefObject<StatusBag>     // SYSTEM 3 — options removed from enemies
  onHeal: (amount: number) => void   // a healing field restores the player; HP lives in the parent
  onNeedReload: () => void  // dry trigger on an empty clip → parent starts the recharge
  onHit: (crit: boolean) => void  // landed round; crit = head-zone hit (gold hitmarker)
  onShot: () => void
  onPlayerDamage: () => void  // vignette flash
  onPlayerDown: () => void    // HP hit zero → systems reset (longer flash)
  onTrial: (say: string) => void  // a trial was cleared — the line for the banner (the range has none of its own)
  /** the match HUD line, or null when no match is running. ⚠ CALLED ONLY WHEN THE STRING CHANGES —
   *  a per-frame setState here is a re-render per frame, which is the one thing this file must not do. */
  onMatch: (line: string | null) => void
}) {
  const MAX = 20
  const SEG = TRAIL_N + 1  // instances per round = head + trail
  const pool = useMemo(() => Array.from({ length: MAX }, () => ({
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0,
    trail: Array.from({ length: TRAIL_N }, () => new THREE.Vector3()),
  })), [])
  const EMAX = 16  // enemy orb pool (fired by the hunter)
  const orbs = useMemo(() => Array.from({ length: EMAX }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0 })), [])
  // cast-projectile pool. Each bolt carries the damage + chain of the MOVE that fired it — two
  // different projectile moves can be in flight at once, so damage can't come from a global spec.
  const CMAX = 12
  const castPool = useMemo(() => Array.from({ length: CMAX }, () => ({
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, dmg: 0, chain: 0, chainRange: 0,
  })), [])
  const targets = useMemo(() => RANGE_TARGETS.map(([x, y, z], i) => ({
    pos: new THREE.Vector3(x, y, z), ax: x, az: z,  // anchor — drift mode oscillates around it
    phase: i * 1.7, spd: 0.55 + (i % 3) * 0.25,     // varied phase/speed so the wall doesn't move in lockstep
    alive: true, down: 0, hp: TARGET_HP,
  })), [])
  // the ground hunter — spawned by the console's HOSTILE toggle; chases, strafes, returns fire
  // `x`/`z` are the hunter's truth (they are what `engine/hunter-ai.ts` steps); `pos` is the
  // render/hit-test mirror, written one-way from them once per frame. Everything else in this file
  // reads `pos` and nothing outside the hunter block writes it, so the two cannot drift.
  // ⚠ `castCd` is present but the range hunter never casts: it is handed no `castBands`, so
  // `stepHunter` returns `castBand: null` for it every tick. The range keeps exactly the feel
  // Alex tuned — the field exists because a Crucible challenger and a range hunter share one brain.
  const hunter = useRef({ pos: new THREE.Vector3(), x: 0, z: 0, hp: 0, alive: false, respawn: 0, fireCd: 0, castCd: 0, strafe: 0 })
  /** frame clock the hunter's `blocked` probe needs for conjured terrain — set each frame */
  const hunterNow = useRef(0)
  /**
   * Rebuilt never: one ctx object, mutated per frame. A fresh object per tick for 60 Crucible bots
   * is precisely what `render-audit` exists to catch, so the range models the shape the fleet needs.
   *
   * ⚠ `blocked` answers for BOTH the spawn ring and each step. The inline version tested only the
   * tile grid when spawning and grid+conjured when moving — one predicate is the deliberate
   * unification, and it can only ever refuse *more*, never place a hunter somewhere the old code
   * would have refused.
   */
  const hunterCtx = useRef<HunterCtx>({
    targetX: 0, targetZ: 0, rooted: false, disarmed: false, fallbackX: 0, fallbackZ: 0,
    // Seeded, where this used to be `Math.random()`. Single-player, so nothing depended on the old
    // non-determinism, and a repeatable range makes a tuning change judgeable.
    rng: hunterRng(0xC0FFEE, 0),
    blocked: (x, z) => {
      const cell = gridRef.current?.[Math.round(z)]?.[Math.round(x)]
      if (cell === undefined || (cell & 0xFF) === WALL_ID) return true
      return conjuredBlockedAt(conjuredRef.current, x, z, hunterNow.current)
    },
  })

  // ── THE CRUCIBLE FLEET (#302) ───────────────────────────────────────────────────────────────
  // Built lazily on first frame in the crucible with the toggle on, and dropped on the way out, so
  // no hook has to know about the zone and no roster is built for a zone nobody is standing in.
  //
  // ⚠ THE SEED IS FIXED, AND THAT IS THE POINT. `fillRoster` and every bot's stream descend from
  // it, so this match is the SAME match on every client and re-runnable while tuning. A clock-based
  // seed would make the fleet unreproducible the moment anyone tried to compare two runs.
  const CRUCIBLE_SEED = 0x0C0DE
  const fleetRef = useRef<Fleet | null>(null)
  const botMeshRef = useRef<THREE.InstancedMesh>(null)
  /** rebuilt in place each frame — one array for the fleet, not one per bot */
  const botBodies = useRef<FleetTarget[]>([])
  const botMat = useRef(new THREE.Matrix4())
  const botCtx = useRef<HunterCtx>({
    targetX: 0, targetZ: 0, rooted: false, disarmed: false, fallbackX: 0, fallbackZ: 0,
    rng: hunterRng(CRUCIBLE_SEED, 0),   // replaced per-member by stepFleet; never actually read
    blocked: (x, z) => {
      const cell = gridRef.current?.[Math.round(z)]?.[Math.round(x)]
      if (cell === undefined || (cell & 0xFF) === WALL_ID) return true
      return conjuredBlockedAt(conjuredRef.current, x, z, hunterNow.current)
    },
  })
  // ── THE THREE PUPPET GUARDS (console toggle) ────────────────────────────────────────────────
  // Canon's Level 3 encounter, fought here because the range IS the combat lab and the pyramid's
  // floors do not exist yet. BEHAVIOUR LIVES IN puppet-guards.ts — this ref holds only bodies.
  // The sim decides who leads, who claims ground and who counters; the frame just moves meshes and
  // fires orbs, so the encounter stays provable headless.
  // ⚠ `prized` IS GONE, NOT RENAMED. It latched a payout that happened here; the payout moved to the
  // Vault on 2026-09-05 and the latch went with it (`crucible-prize.ts` › `paid`). Leaving the field
  // would have been dead state carrying a comment that still described the old design — which is the
  // thing that makes a later reader confident about a rule that no longer exists.
  // `viaMatch` is the WON door's whole gate: the Three summoned by the T console are the same
  // encounter and earn nothing, because a practice zone is not the Throne. See `crucible-prize.ts`.
  const guardSim = useRef({ enc: initEncounter(), spawned: false, orbit: 0, fireCd: [0, 0, 0], viaMatch: false })
  // ── THE HOLD (`hold.ts`) ────────────────────────────────────────────────────────────────────
  // The parent owns the run (its HUD and the E/G keys read it); this sim steps it, lands rounds on
  // it and turns its strikes into damage. Every body carries its own height (`b.y`, tiers): the tower
  // has three floors, and a body climbing the face is at neither.
  const inHold = zoneId === HOLD_ZONE
  // ── ★ THE MATCH ────────────────────────────────────────────────────────────────────────────
  // One number: when the glyph lit. Everything else — which floor is open, what is sealing, when
  // the Vault opens — is `crucibleAt(elapsed)`, derived fresh every frame from that alone, so the
  // HUD, the guards and the prize cannot disagree and a reload lands on the same second.
  // ⚠ NEVER cache a phase in a ref. `crucible-phases`' header is explicit that a per-client clock
  // that drifts is unshippable, and a cached phase IS a second clock.
  const matchStart = useRef<number | null>(null)
  const matchLine = useRef<string | null>(null)
  const prize = useRef<PrizeState>(resetPrize())
  const guardBodies = useMemo(() => GUARDS.map((g) => ({ id: g.id, pos: new THREE.Vector3() })), [])
  const guardMeshRef = useRef<THREE.InstancedMesh>(null)
  const shotRef = useRef<THREE.InstancedMesh>(null)
  const orbRef = useRef<THREE.InstancedMesh>(null)
  const castMeshRef = useRef<THREE.InstancedMesh>(null)  // cast bolts
  const fieldMeshRef = useRef<THREE.InstancedMesh>(null)     // SYSTEM 1 — area entities (flat discs)
  const conjuredMeshRef = useRef<THREE.InstancedMesh>(null)  // SYSTEM 2 — conjured terrain slabs
  const FIELD_MAX = 8, CONJ_MAX = 220  // a Cordon ring at radius 4 is ~28 cells; 220 covers the cap
  const castCd = useRef(0)                                // v2 cast cooldown timer (s)
  const boardRef = useRef<THREE.InstancedMesh>(null)  // target-board layers: white disc / red ring / gold core
  const ringRef = useRef<THREE.InstancedMesh>(null)
  const coreRef = useRef<THREE.InstancedMesh>(null)
  const huntRef = useRef<THREE.Mesh>(null)
  const toPlayer = useMemo(() => new THREE.Vector3(), [])
  const step = useMemo(() => new THREE.Vector3(), [])
  const cd = useRef(0)
  const firedThisPress = useRef(false)  // semi-auto: a weapon with auto=false fires once per trigger press
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const zero = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  const scl = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const camRight = useMemo(() => new THREE.Vector3(), [])
  const camUp = useMemo(() => new THREE.Vector3(), [])
  const aim = useMemo(() => new THREE.Vector3(), [])
  const seg = useMemo(() => new THREE.Vector3(), [])
  const mid = useMemo(() => new THREE.Vector3(), [])
  const qSeg = useMemo(() => new THREE.Quaternion(), [])
  const AXIS_Z = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const pEye = useMemo(() => new THREE.Vector3(), [])  // player body-center; drones aim + collide here
  const rel = useMemo(() => new THREE.Vector3(), [])   // projectile→board offset, for the bullseye radial
  const vhat = useMemo(() => new THREE.Vector3(), [])  // projectile flight direction, normalized
  const qT = useMemo(() => new THREE.Quaternion(), []) // per-board billboard rotation (face the player)
  const AXIS_Y = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  // ── the ONE place the player takes damage ────────────────────────────────────────────────────
  // A held stance (Barrier / Bulwark / Iron Skin) absorbs its fraction FIRST, then the shield soaks,
  // then the spill hits HP. Both damage sources (drone/guard orbs, Wren's returned hit) route here so
  // the stance can never apply to one and not the other. Side effect of unifying them: Wren's counter
  // now triggers the down/reset like every other hit — it used to leave HP at 0 with the run still live.
  // ── ★ THE SOURCE'S RUNE — the wiring point for attunement resistance (canon v3, 2026-08-26) ──
  // `sourceRune` is what the hit IS. Attunement resistance folds in beside the held stance, and it
  // folds MULTIPLICATIVELY (`combineResist`) so the pair can approach total immunity and never reach
  // it — canon's "modest, never immunity" as arithmetic rather than as a comment.
  //
  // ⚠⚠ EVERY CALLER PASSES NOTHING TODAY, AND THAT IS ACCURATE, NOT AN OVERSIGHT. Nothing in the
  // shipped game deals elemental damage: the two sources below are a firing-range training drone and
  // Wren's reflected shot, and neither has a rune. This parameter exists so the day a world enemy
  // CASTS (focus row 294) the resistance lands here for free instead of being rediscovered. An
  // omitted source resists nothing, which is the fail-open direction and the correct one — an
  // untyped hit must not be silently treated as the keeper's own attunement.
  const hurtPlayer = useCallback((raw: number, sourceRunes?: string | readonly string[] | null) => {
    const resist = combineResist(resistRef.current ?? 0, attunementResist(birthRuneRef.current, sourceRunes))
    const dmg = raw * (1 - resist)
    const sh = shieldRef.current
    shieldRef.current = Math.max(0, sh - dmg)
    const spill = dmg - (sh - shieldRef.current)
    if (spill > 0) hpRef.current = Math.max(0, hpRef.current - spill)
    if (hpRef.current <= 0) { hpRef.current = hpMaxRef.current ?? MAX_HP; shieldRef.current = shieldMaxRef.current ?? MAX_SHIELD; onPlayerDown() }
    else onPlayerDamage()
  }, [resistRef, birthRuneRef, shieldRef, hpRef, hpMaxRef, shieldMaxRef, onPlayerDamage, onPlayerDown])
  // Tremor Sense scratch. Reused across frames — a sense that allocated a fresh array 10x a second
  // would be the only allocating thing in this loop.
  const senseAcc = useRef(0)
  const senseBodies = useMemo<SensedBody[]>(() => [], [])
  const senseFacing = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const W = WEAPONS[weaponIdxRef.current] ?? WEAPONS[0]   // live weapon — stats + tracer look
    const nowFrame = performance.now()  // ONE clock per frame — fields, terrain and statuses all read it
    const hs = inHold ? holdRef.current : null

    // ── TREMOR SENSE ────────────────────────────────────────────────────────────────────────────
    // The scene owns this because the scene is what knows where the bodies are; the HUD half draws
    // and knows nothing. ★ THROTTLED TO ~10Hz ON PURPOSE, and the cadence is derived rather than
    // taste: the fastest thing that can walk covers well under half a world unit in 100ms, which is
    // a fraction of a degree on a 24-unit ring, so a faster sense would cost frames to report a
    // difference nobody can see. ⚠ It writes into a REF and never into state — a HUD that re-renders
    // the tree every frame is how a readout costs more than the world it reports on.
    senseAcc.current -= dt
    if (senseAcc.current <= 0) {
      senseAcc.current = SENSE_TICK
      const radius = senseRadiusRef.current ?? 0
      const p = posRef.current
      if (radius > 0 && p) {
        // Every body in the range stands on the floor, so `hover` is 0 across the board here and the
        // canon predicate has nothing to bite on. ⚠ THAT IS A PROPERTY OF THIS WORLD, NOT A LICENCE
        // TO DROP THE FIELD: the voxel world's caster floats, and the day a floating body reaches
        // the range this is already correct. Mapping it explicitly is what keeps that true.
        senseBodies.length = 0
        for (const t of targets) senseBodies.push({ x: t.pos.x, y: t.pos.y, z: t.pos.z, hover: 0, present: t.alive })
        const h = hunter.current
        senseBodies.push({ x: h.pos.x, y: h.pos.y, z: h.pos.z, hover: 0, present: h.alive })
        if (guardSim.current.spawned) {
          for (let gi = 0; gi < guardBodies.length; gi++) {
            const st = guardSim.current.enc.guards[gi]
            const b = guardBodies[gi]
            senseBodies.push({ x: b.pos.x, y: b.pos.y, z: b.pos.z, hover: 0, present: !!st?.alive })
          }
        }
        state.camera.getWorldDirection(senseFacing)
        const r = tremorRef.current
        r.contacts = senseGround(senseBodies, p.x, p.z, radius)
        r.px = p.x; r.pz = p.z
        // The facing is the camera's, FLATTENED. A keeper looking at the sky has not turned around,
        // and an unflattened direction shrinks toward zero as you look up — which would swing every
        // bearing wildly for a player doing nothing but glancing upward.
        r.fx = senseFacing.x; r.fz = senseFacing.z
        r.radius = radius
        r.rev++
      } else if (tremorRef.current.contacts.length > 0) {
        // Sense dropped (or the keeper is gone). Clear ONCE rather than every tick, so the HUD's
        // change detector is not woken by a readout that has been empty for a minute.
        const r = tremorRef.current
        r.contacts = []; r.radius = 0; r.rev++
      }
    }
    // Flame Infusion sheathes the weapon in fire: the only cast that makes the GUN better rather than
    // doing what a gun cannot. Resolved once so every damage site downstream reads the same number.
    const inf = infusionRef.current
    const wMult = nowFrame < inf.until ? inf.mult : 1
    const wDmg = W.damage * wMult, wCrit = W.crit * wMult
    cd.current -= dt
    if (!firingRef.current) firedThisPress.current = false   // trigger released → re-arm a semi-auto
    bloomRef.current = Math.max(0, bloomRef.current - W.bloomDecay * dt)  // cone recovers while not firing
    // full-auto weapons fire while held; semi-auto (auto=false) fires once per press. The clip gates it:
    // recharge channel blocks fire, a dry trigger auto-starts the recharge.
    const wantFire = firingRef.current && (W.auto || !firedThisPress.current)
    if (wantFire && cd.current <= 0 && reloadingRef.current <= 0) {
      if (ammoRef.current <= 0) { cd.current = 0.25; onNeedReload() }
      else {
      cd.current = W.fireCd
      firedThisPress.current = true
      const p = pool.find((pr) => pr.life <= 0)
      if (p) {
        ammoRef.current -= 1
        // Apex muzzle model: spawn at the weapon (low-right of the eye), aim the velocity at the point
        // the crosshair ray hits at the converge range — the tracer rises up-and-in to the reticle.
        state.camera.getWorldDirection(dir)
        camRight.setFromMatrixColumn(state.camera.matrixWorld, 0)
        camUp.setFromMatrixColumn(state.camera.matrixWorld, 1)
        const ads = adsRef.current
        const [mr, md, mf] = ads ? MUZZLE_ADS : MUZZLE_HIP
        p.pos.copy(state.camera.position)
          .addScaledVector(camRight, mr).addScaledVector(camUp, -md).addScaledVector(dir, mf)
        aim.copy(state.camera.position).addScaledVector(dir, W.converge)
        // spread: uniform random point in the current cone's disc, perpendicular to the flight line
        const spread = (ads ? W.adsSpread : W.hipSpread) + bloomRef.current * (ads ? W.adsBloomScale : 1)
        const r = Math.tan(spread * DEG) * Math.sqrt(Math.random())
        const th = Math.random() * Math.PI * 2
        p.vel.copy(aim).sub(p.pos).normalize()
          .addScaledVector(camRight, Math.cos(th) * r).addScaledVector(camUp, Math.sin(th) * r)
          .normalize().multiplyScalar(W.projSpeed)
        p.life = W.projLife
        for (const t of p.trail) t.copy(p.pos)  // collapse the trail onto the muzzle at spawn
        bloomRef.current = Math.min(W.bloomMax, bloomRef.current + W.bloomPerShot)
        recoilRef.current.p += W.kickPitch
        recoilRef.current.y += (Math.random() * 2 - 1) * W.kickYaw
        onShot()
      }
      }
    }
    // ── the cast lands. The parent resolved slot → move → spec and already paid mana + cooldown, so
    // what arrives here is "this shape, now". Every PLACED archetype shares one aim resolution:
    // camera-forward, flattened to the ground plane, at the move's own range. One rule, four shapes.
    const pending = pendingCastRef.current
    if (pending) {
      pendingCastRef.current = null
      state.camera.getWorldDirection(dir)
      const nowMs = performance.now()
      if (pending.archetype === 'projectile') {
        const cp = castPool.find((pr) => pr.life <= 0)
        if (cp) {
          camRight.setFromMatrixColumn(state.camera.matrixWorld, 0)
          camUp.setFromMatrixColumn(state.camera.matrixWorld, 1)
          const [mr, md, mf] = adsRef.current ? MUZZLE_ADS : MUZZLE_HIP
          cp.pos.copy(state.camera.position).addScaledVector(camRight, mr).addScaledVector(camUp, -md).addScaledVector(dir, mf)
          aim.copy(state.camera.position).addScaledVector(dir, 40)  // converge point ~40u down the reticle
          cp.vel.copy(aim).sub(cp.pos).normalize().multiplyScalar(pending.projSpeed)
          cp.life = pending.projLife
          cp.dmg = pending.damage; cp.chain = pending.chain; cp.chainRange = pending.chainRange
          recoilRef.current.p += 0.008  // a little heft on release
          onShot()
        }
      } else {
        // THE AIM POINT for every placed cast: flatten the camera forward, walk `castRange` along it
        // from the player's feet. Flattening is deliberate — looking at the sky must not put your
        // Stonewall in orbit. Falls back to straight ahead when you're staring at your own boots.
        const flatX = dir.x, flatZ = dir.z
        const flatLen = Math.hypot(flatX, flatZ) || 1
        const px = posRef.current?.x ?? 0, pz = posRef.current?.z ?? 0
        const ax = px + (flatX / flatLen) * pending.castRange
        const az = pz + (flatZ / flatLen) * pending.castRange
        if (pending.archetype === 'field') {
          fieldsRef.current = spawnField(fieldsRef.current, {
            moveId: pending.moveId, x: ax, z: az, radius: pending.areaSize, secs: pending.areaSecs,
            dps: pending.fieldDps, hps: pending.fieldHps, stopsShots: pending.fieldStopsShots, hp: pending.fieldHp,
            // y/height are new (the voxel port made a field a slab). play3d's own readers stay 2D,
            // so these change nothing here — they are recorded truthfully rather than faked.
            y: posRef.current?.y ?? 0, height: FIELD_HEIGHT,
          }, nowMs)
        } else if (pending.archetype === 'terrain') {
          const cells = shapeCells(pending.shape, ax, az, flatX / flatLen, flatZ / flatLen, pending.areaSize)
          conjuredRef.current = conjure(conjuredRef.current, pending.moveId, cells, pending.areaSecs, pending.shapeHeight, nowMs)
        }
        // A terrain cast that ALSO carries statuses applies them (Cordon: stone rises AND all metal
        // locks). That is why this is not an `else if` — canon writes both halves in one sentence.
        if (pending.statuses.length > 0) {
          const r2 = pending.areaSize * pending.areaSize
          let bag = statusRef.current
          const h = hunter.current
          if (h.alive && (h.pos.x - ax) ** 2 + (h.pos.z - az) ** 2 <= r2) bag = applyStatuses(bag, 'hunter', pending.statuses, pending.areaSecs, nowMs)
          if (guardSim.current.spawned) {
            for (let gi = 0; gi < guardBodies.length; gi++) {
              const b = guardBodies[gi], st = guardSim.current.enc.guards[gi]
              if (!st?.alive) continue
              if ((b.pos.x - ax) ** 2 + (b.pos.z - az) ** 2 <= r2) bag = applyStatuses(bag, `guard:${st.id}`, pending.statuses, pending.areaSecs, nowMs)
            }
          }
          statusRef.current = bag
        }
      }
    }
    // ── SYSTEM 1 tick: fields apply their effect on their own clock, not per frame ────────────────
    {
      const nowMs = performance.now()
      const res = tickFields(fieldsRef.current, nowMs)
      fieldsRef.current = res.fields
      for (const f of res.fired) {
        if (f.dps > 0) {
          // burn everything standing in it — range targets, the hunter, the guards
          for (const t of targets) {
            if (t.alive && (t.pos.x - f.x) ** 2 + (t.pos.z - f.z) ** 2 <= f.radius * f.radius) {
              t.hp -= f.dps
              if (t.hp <= 0) { t.alive = false; t.down = TARGET_RESPAWN }
            }
          }
          const h = hunter.current
          if (h.alive && (h.pos.x - f.x) ** 2 + (h.pos.z - f.z) ** 2 <= f.radius * f.radius) {
            h.hp -= f.dps
            if (h.hp <= 0) { h.alive = false; h.respawn = HUNTER_RESPAWN; statusRef.current = clearTarget(statusRef.current, 'hunter') }
          }
          if (guardSim.current.spawned) {
            for (let gi = 0; gi < guardBodies.length; gi++) {
              const b = guardBodies[gi], st = guardSim.current.enc.guards[gi]
              if (!st?.alive || (b.pos.x - f.x) ** 2 + (b.pos.z - f.z) ** 2 > f.radius * f.radius) continue
              guardSim.current.enc = damageGuard(guardSim.current.enc, st.id, f.dps, rangeCfgRef.current.tune).state
            }
          }
          // the flooded (THE HOLD) — capped to the nearest few, see `hold.ts` › fieldStrike
          if (hs) fieldStrike(hs, f.x, f.z, f.radius, f.dps, posRef.current ? posRef.current.y / STEP : undefined)
        }
        if (f.hps > 0 && posRef.current) {
          const dx = posRef.current.x - f.x, dz = posRef.current.z - f.z
          if (dx * dx + dz * dz <= f.radius * f.radius) onHeal(f.hps)
        }
      }
      conjuredRef.current = expireConjured(conjuredRef.current, nowMs)
      statusRef.current = pruneStatuses(statusRef.current, nowMs)
    }
    // advance + trail + collide
    for (const p of pool) {
      if (p.life <= 0) continue
      p.life -= dt
      for (let k = TRAIL_N - 1; k > 0; k--) p.trail[k].copy(p.trail[k - 1])  // age the trail
      p.trail[0].copy(p.pos)
      p.pos.addScaledVector(p.vel, dt)
      const cx = Math.round(p.pos.x), cz = Math.round(p.pos.z)
      const cell = gridRef.current?.[cz]?.[cx]
      // wall / OOB / a conjured slab stops it — Stonewall is cover for BOTH sides, or it isn't cover.
      // A Firewall eats what crosses it, which is the "cover" half of its canon line.
      if (cell === undefined || (cell & 0xFF) === WALL_ID) { p.life = 0; continue }
      if (conjuredBlockedAt(conjuredRef.current, p.pos.x, p.pos.z, nowFrame)) { p.life = 0; continue }
      // the hold's walls are the mortal block (103), which this predicate cannot see — the hold says
      // what stops a round there: a wall or a shut gate, never a window (you shoot out of them)
      if (hs && roundBlocked(hs, p.pos.x, p.pos.z, p.pos.y / STEP)) { p.life = 0; continue }
      { const ab = absorbShotAt(fieldsRef.current, p.pos.x, p.pos.z, wDmg); if (ab.hit) { fieldsRef.current = ab.fields; p.life = 0; continue } }
      for (const t of targets) {
        if (t.alive && p.pos.distanceToSquared(t.pos) < TARGET_HIT_R2) {
          // bullseye: radial miss-distance of the flight line from the board center. Inside the gold
          // core = crit — dead center means dead center, whatever angle the board is facing.
          vhat.copy(p.vel).normalize()
          rel.copy(p.pos).sub(t.pos)
          rel.addScaledVector(vhat, -rel.dot(vhat))  // strip the along-flight component → radial offset
          const crit = rel.lengthSq() < TARGET_CRIT_R * TARGET_CRIT_R
          t.hp -= crit ? wCrit : wDmg; p.life = 0; onHit(crit)  // hitmarker on every landed round
          if (t.hp <= 0) { t.alive = false; t.down = TARGET_RESPAWN }
          break
        }
      }
      const h = hunter.current
      if (p.life > 0 && h.alive && p.pos.distanceToSquared(h.pos) < HUNTER_HIT_R2) {
        const crit = p.pos.y > h.pos.y + CRIT_Y
        h.hp -= crit ? wCrit : wDmg; p.life = 0; onHit(crit)
        if (h.hp <= 0) { h.alive = false; h.respawn = HUNTER_RESPAWN; statusRef.current = clearTarget(statusRef.current, 'hunter') }
      }
      // ── the fleet takes fire too (#302) ──────────────────────────────────────────────────────
      // ⚠ A DEAD CHALLENGER STAYS DEAD — `respawn = Infinity`, not a timer. Canon has 60 enter and
      // the squads thin each other out until one stands; a respawning arena would never converge
      // and `aliveCount`, the match-over read, would never fall.
      // 2D test plus a height band: the fleet carries only x/z, and a round passing well over a
      // challenger's head should miss.
      if (p.life > 0 && fleetRef.current) {
        const botY = (posRef.current.y ?? 0) + 0.95
        if (Math.abs(p.pos.y - botY) < 1.2) {
          for (const m of fleetRef.current.members) {
            if (!m.state.alive) continue
            const bdx = p.pos.x - m.state.x, bdz = p.pos.z - m.state.z
            if (bdx * bdx + bdz * bdz >= HUNTER_HIT_R2) continue
            const bcrit = p.pos.y > botY + CRIT_Y
            m.state.hp -= bcrit ? wCrit : wDmg; p.life = 0; onHit(bcrit)
            if (m.state.hp <= 0) { m.state.alive = false; m.state.respawn = Number.POSITIVE_INFINITY }
            break
          }
        }
      }
      // rounds vs the Puppet Guards. Damage goes through damageGuard() so a raised barrier blunts
      // it and Wren's counter can turn it back — the canon behaviours live in the sim, not here.
      if (p.life > 0 && guardSim.current.spawned) {
        for (let gi = 0; gi < guardBodies.length; gi++) {
          const b = guardBodies[gi]
          const st = guardSim.current.enc.guards[gi]
          if (!st?.alive || p.pos.distanceToSquared(b.pos) >= HUNTER_HIT_R2) continue
          const crit = p.pos.y > b.pos.y + CRIT_Y
          const r = damageGuard(guardSim.current.enc, st.id, crit ? wCrit : wDmg, rangeCfgRef.current.tune)
          guardSim.current.enc = r.state
          p.life = 0; onHit(crit)
          // Wren turning a hit back is real damage to the shooter, not a miss.
          if (r.returned > 0) hurtPlayer(r.returned)  // Wren's reflect — carries no rune
          break
        }
      }
      // rounds vs the flooded (THE HOLD). Crit = the upper third of the body, same rule as the hunter.
      if (p.life > 0 && hs?.running) {
        for (const b of hs.flood) {
          if (!b.alive) continue
          const by = b.y * STEP + 0.5
          if (Math.abs(p.pos.y - by) >= 0.9) continue
          const bdx = p.pos.x - b.x, bdz = p.pos.z - b.z, br = b.kind === 'bulk' ? 0.7 : 0.5
          if (bdx * bdx + bdz * bdz >= br * br) continue
          const crit = p.pos.y > by + CRIT_Y
          hitBody(hs, b.id, crit ? wCrit : wDmg, crit)
          p.life = 0; onHit(crit)
          break
        }
      }
    }
    // cast bolts: same collide as the weapon rounds (wall / target / hunter), but damage comes off the
    // BOLT (the move that fired it), and a chaining move jumps to nearby targets on impact.
    for (const p of castPool) {
      if (p.life <= 0) continue
      p.life -= dt
      p.pos.addScaledVector(p.vel, dt)
      const cx = Math.round(p.pos.x), cz = Math.round(p.pos.z)
      const cell = gridRef.current?.[cz]?.[cx]
      if (cell === undefined || (cell & 0xFF) === WALL_ID) { p.life = 0; continue }
      if (conjuredBlockedAt(conjuredRef.current, p.pos.x, p.pos.z, nowFrame)) { p.life = 0; continue }
      const dmg = p.dmg * castMultRef.current  // a held stance (Flame Manipulation) shapes what you throw
      let hit = false
      if (hs) {
        if (roundBlocked(hs, p.pos.x, p.pos.z, p.pos.y / STEP)) { p.life = 0; continue }
        let struck = false
        if (hs.running) for (const b of hs.flood) {
          if (!b.alive || Math.abs(p.pos.y - (b.y * STEP + 0.5)) >= 1.1) continue
          const bdx = p.pos.x - b.x, bdz = p.pos.z - b.z, br = b.kind === 'bulk' ? 0.8 : 0.6
          if (bdx * bdx + bdz * bdz >= br * br) continue
          hitBody(hs, b.id, dmg, false); struck = true; break
        }
        if (struck) { p.life = 0; onHit(true); continue }
      }
      for (const t of targets) {
        if (t.alive && p.pos.distanceToSquared(t.pos) < TARGET_HIT_R2) {
          t.hp -= dmg; p.life = 0; hit = true; onHit(true)  // gold hitmarker — a cast reads as a heavy hit
          if (t.hp <= 0) { t.alive = false; t.down = TARGET_RESPAWN }
          // Chain Lightning: arc to the nearest live targets in range, half damage per jump. Canon's
          // "arcs between every target and conductor in range" — bounded so an ultimate stays an ultimate.
          if (p.chain > 0) {
            const r2 = p.chainRange * p.chainRange
            const struck = t
            const near = targets
              .filter((o) => o !== struck && o.alive && o.pos.distanceToSquared(struck.pos) < r2)
              .sort((a, b) => a.pos.distanceToSquared(struck.pos) - b.pos.distanceToSquared(struck.pos))
              .slice(0, p.chain)
            for (const o of near) {
              o.hp -= dmg * 0.5
              if (o.hp <= 0) { o.alive = false; o.down = TARGET_RESPAWN }
            }
          }
          break
        }
      }
      if (!hit && p.life > 0) {
        const h = hunter.current
        if (h.alive && p.pos.distanceToSquared(h.pos) < HUNTER_HIT_R2) {
          h.hp -= dmg; p.life = 0; onHit(true)
          if (h.hp <= 0) { h.alive = false; h.respawn = HUNTER_RESPAWN; statusRef.current = clearTarget(statusRef.current, 'hunter') }
        }
        // ── the fleet takes cast damage too (#302). Same death rule: a challenger stays down.
        if (p.life > 0 && fleetRef.current) {
          const botY2 = (posRef.current.y ?? 0) + 0.95
          if (Math.abs(p.pos.y - botY2) < 1.2) {
            for (const m of fleetRef.current.members) {
              if (!m.state.alive) continue
              const bdx = p.pos.x - m.state.x, bdz = p.pos.z - m.state.z
              if (bdx * bdx + bdz * bdz >= HUNTER_HIT_R2) continue
              m.state.hp -= dmg; p.life = 0; hit = true; onHit(true)
              if (m.state.hp <= 0) { m.state.alive = false; m.state.respawn = Number.POSITIVE_INFINITY }
              break
            }
          }
        }
      }
    }
    for (const t of targets) {
      if (!t.alive) { t.down -= dt; if (t.down <= 0) { t.alive = true; t.hp = TARGET_HP } }
    }
    // ── THE HOLD steps here: no boards in the landing, and the flooded strike through `hurtPlayer`
    // so resist, shield-first and the down flash are the same rules the range already plays by.
    // ⚠ `down = 1`, not Infinity: this component stays mounted when the keeper walks back to the
    // range, and a board parked at Infinity would never come back there.
    if (inHold) for (const t of targets) { t.alive = false; t.down = 1 }
    if (hs?.running && posRef.current) {
      const o = stepHold(hs, dt, posRef.current.x, posRef.current.z, posRef.current.y / STEP)
      if (o.strike > 0) hurtPlayer(o.strike)
    }
    // drift mode (console): targets strafe around their anchors — varied phase/speed per target
    const cfg = rangeCfgRef.current
    if (cfg?.moving) {
      const now = state.clock.elapsedTime
      for (const t of targets) t.pos.x = t.ax + Math.sin(now * t.spd + t.phase) * DRIFT_AMP
    } else {
      for (const t of targets) t.pos.x = t.ax
    }
    if (posRef.current) {
      pEye.set(posRef.current.x, posRef.current.y + 1.1, posRef.current.z)
      // ── ground hunter (console HOSTILE toggle): spawn → chase to mid-range → strafe → return fire ──
      const h = hunter.current
      if (cfg?.hostile) {
        // ── THE BRAIN LIVES IN `engine/hunter-ai.ts` NOW (2026-08-12, #302) ──────────────────
        // It was written here, inline, and it was good — but a roster of 60 Crucible bots needs the
        // same behaviour and could not reach it. Extracting it also forced out three things that
        // were invisible while only one hunter in a private range ran it: it drew from
        // `Math.random()` (fatal for a deterministic lobby), it read `gridRef` directly (the
        // dependency that trapped the GUNS extraction), and its status gates were a lookup rather
        // than an input. This block is now the HOST: it answers what is solid, supplies the
        // randomness, and owns the consequences (orbs, damage, death). It does not decide.
        //
        // ⚠ The rng is SEEDED, where this used to call `Math.random()`. Single-player, so nothing
        // depended on the old non-determinism — and a repeatable range is strictly easier to judge
        // a tuning change in.
        const hRooted = hasStatus(statusRef.current, 'hunter', 'rooted', nowFrame)
        const hDisarmed = hasStatus(statusRef.current, 'hunter', 'disarmed', nowFrame)
        const hBlinded = hasStatus(statusRef.current, 'hunter', 'blinded', nowFrame)
        hunterNow.current = nowFrame
        const hc = hunterCtx.current
        hc.targetX = pEye.x; hc.targetZ = pEye.z
        hc.rooted = hRooted; hc.disarmed = hDisarmed
        hc.fallbackX = targets[0].ax; hc.fallbackZ = targets[0].az
        const hIntent = stepHunter(h, hc, dt, RANGE_HUNTER)
        // State → the render/hit-test vector. One-way, one place: everything else in this file
        // reads `h.pos` and nothing outside this block writes it.
        if (hIntent.spawnedAt) h.pos.y = (posRef.current.y ?? 0) + 0.55
        h.pos.x = h.x; h.pos.z = h.z
        if (hIntent.fire) {
          const o = orbs.find((or) => or.life <= 0)
          if (o) {
            o.pos.copy(h.pos); o.pos.y += 0.4
            o.vel.copy(pEye).sub(o.pos).normalize()
            // blinded: it still shoots, it just doesn't know where you are. A flash-bang buys you
            // the fight, it doesn't end it — deliberately not a hard silence. Stays HERE rather
            // than in the module: where a shot goes is the host's business, and the module has no
            // opinion about orbs.
            if (hBlinded) { o.vel.x += Math.sin(h.strafe * 7.3) * 0.85; o.vel.z += Math.cos(h.strafe * 5.1) * 0.85; o.vel.normalize() }
            o.vel.multiplyScalar(DRONE_SPEED)
            o.life = DRONE_LIFE
          }
        }
      } else if (h.alive || h.respawn > 0) { h.alive = false; h.respawn = 0 }  // toggle off = despawn now

      // ── THE CRUCIBLE FLEET (#302) ─────────────────────────────────────────────────────────
      // 59 challengers on the same brain the range runs. This block is the HOST, exactly as the
      // hunter's is: it answers what is solid, supplies the bodies, and owns orbs and death. The
      // fleet decides who fights whom; `stepHunter` decides how.
      if (cfg?.bots && zoneId === 'crucible') {
        if (!fleetRef.current) {
          fleetRef.current = createFleet(fillRoster([{ id: 'you', name: 'You' }], CRUCIBLE_SEED), CRUCIBLE_SEED)
          // ── ★★★ WARP THE SIXTY TO THEIR ENTRANCES — canon's *"all 60 warped to starting
          // positions"*, and the reason arena size is now a question you can answer by walking in.
          //
          // ⚠ WITHOUT THIS THE SIXTY SPAWN ON A RING AROUND THE PLAYER. `stepHunter` places a
          // member on its first live tick at 12–16 tiles from whatever it is hunting, and on frame
          // one the only living body is you — so every challenger arrived in one annulus centred on
          // the keeper, AT THE SAME DENSITY AT EVERY ARENA SIZE. Resizing could not have changed how
          // crowded the floor felt, and a judgement made from resizing would have measured nothing.
          // ⚠ It also did not FIT: 39.6% of that ring fell off a 30-row grid and every one of those
          // snapped to the single fallback tile — about 24 of the 60 on one square. ★ Enlarging the
          // map alone would have made that pile vanish and been read as evidence about SIZE.
          //
          // ★ Setting `alive` is what does the work: `hunter-ai.ts`'s ring is inside `if (!alive)`,
          // so a member that arrives already standing somewhere never asks for a ring at all.
          const g = gridRef.current
          const starts = startingPositions(g[0]?.length ?? 0, g.length)
          fleetRef.current.members.forEach((m, i) => {
            const p = starts[i]
            if (!p) return
            m.state.x = p.x + 0.5; m.state.z = p.z + 0.5; m.state.alive = true
          })
        }
        const fleet = fleetRef.current
        const bodies = botBodies.current
        bodies.length = 0
        // The player stands in the roster as squad -1: nobody's squadmate, so everyone's enemy.
        bodies.push({ x: pEye.x, z: pEye.z, squad: -1, alive: true, index: -1 })
        for (const m of fleet.members) {
          bodies.push({ x: m.state.x, z: m.state.z, squad: m.challenger.squad, alive: m.state.alive, index: m.index })
        }
        hunterNow.current = nowFrame
        const bc = botCtx.current
        bc.rooted = false; bc.disarmed = false
        bc.fallbackX = targets[0].ax; bc.fallbackZ = targets[0].az
        const results = stepFleet(fleet, bodies, bc, dt, RANGE_HUNTER)
        for (const r of results) {
          // ── ★★★ A CHALLENGER'S CAST (row 294) — the first rune-tagged damage in the game ──────
          // This is the whole point of the row: a bot casts from its PREMADE LOADOUT, the move is a
          // real registered keeper move, and the hit carries the move's runes. That is what makes
          // "runes ARE the combat" true rather than aspirational, and it is what finally gives
          // attunement resistance an input — a Star-born player meeting a Star-born challenger's
          // Firewall takes less from it, through `hurtPlayer`'s own fold.
          //
          // ⚠ ONLY CASTS AIMED AT THE PLAYER LAND, for exactly the reason the orb budget note below
          // gives: bot-on-bot casting resolves as nothing so sixty challengers cannot spend the
          // frame on each other.
          if (r.intent.castBand !== null && r.target.index === -1) {
            const moveId = r.member.loadout[r.intent.castBand]
            const cs = moveId ? castForMove(moveId) : null
            const mv = moveId ? moveById(moveId) : undefined
            // ⚠ DAMAGING CASTS ONLY, AND THE GAP IS NAMED RATHER THAN HIDDEN. A challenger whose
            // band holds a wall, a field or a stance has nothing the host can stage against the
            // player yet — bot-conjured terrain and bot-owned fields are not built. Skipping is the
            // honest half; pretending it hit would be worse. It reads as that challenger casting
            // less often, and when those archetypes can be staged this branch grows, it does not move.
            if (cs && mv && cs.damage > 0) hurtPlayer(cs.damage, mv.runes)
          }
          if (!r.intent.fire) continue
          // ⚠ ONLY shots aimed at the PLAYER get an orb. Sixty bots trading fire would drain the
          // pool in a frame and the player would face an arena that never shoots back — the pool is
          // a rendering budget, not the sim. Bot-on-bot fire resolves without a projectile.
          if (r.target.index !== -1) continue
          const o = orbs.find((or) => or.life <= 0)
          if (!o) continue
          o.pos.set(r.member.state.x, (posRef.current.y ?? 0) + 0.95, r.member.state.z)
          o.vel.copy(pEye).sub(o.pos).normalize().multiplyScalar(DRONE_SPEED)
          o.life = DRONE_LIFE
        }
        // Instanced, one matrix per LIVING challenger, `count` trimmed to the survivors — the
        // same shape the Puppet Guards use. Sixty separate meshes is what `render-audit` exists
        // to prevent.
        const bm = botMeshRef.current
        if (bm) {
          let n = 0
          const by = (posRef.current.y ?? 0) + 0.95
          for (const m of fleet.members) {
            if (!m.state.alive) continue
            botMat.current.makeTranslation(m.state.x, by, m.state.z)
            bm.setMatrixAt(n++, botMat.current)
          }
          bm.count = n
          bm.instanceMatrix.needsUpdate = true
        }
      } else if (fleetRef.current) {
        fleetRef.current = null   // left the zone or flipped the toggle — the match is over
        if (botMeshRef.current) botMeshRef.current.count = 0
      }

      // ── the Three Puppet Guards ────────────────────────────────────────────────────────────
      // The formation is canon: Seren holds the line, Cade flanks and traps, Wren hangs back and
      // counters. So the bodies are placed by ROLE around the player, not by a chase heuristic —
      // Seren dead ahead, Cade and Wren on the shoulders. The sim owns the loop; this owns motion.
      // ── ★★★ THE MATCH CLOCK — the Crucible stops being a firing range with extra bots ────────
      // The match runs while you stand in the zone. `crucibleAt` owns every phase; nothing here
      // re-derives a window, a seal or the Vault from a literal.
      // ⚠ THE FLOORS ARE TIME WINDOWS IN ONE ARENA UNTIL THE GEOMETRY EXISTS (`zones.ts` carries
      // the TODO). That is a staging decision, not a claim: the HUD names the floor that is open
      // and NEVER says you ascended, because you did not. When the three maps land they hang off
      // this same clock and nothing here changes.
      // ⛔ AND PRESSURE IS DELIBERATELY NOT WIRED YET. `TUNING.pressureDps` exists and canon wants
      // a sealed floor "slowly killing" — but pressure is escapable only by CLIMBING, and there is
      // nowhere to climb. Wiring it now would be an unavoidable death timer wearing a canon
      // citation, which is worse than an absent feature. It arrives with the floors.
      // ⚠ ONE CLOCK, `state.clock.elapsedTime`, in SECONDS — the same frame clock the drift targets
      // read. Not `performance.now()`: mixing a ms clock and a seconds clock in one file is how a
      // match ends 1000× early, and `crucibleAt` takes seconds.
      const tNow = state.clock.elapsedTime
      const inMatch = zoneId === 'crucible'
      if (inMatch && matchStart.current === null) { matchStart.current = tNow; prize.current = resetPrize() }
      if (!inMatch && matchStart.current !== null) { matchStart.current = null; prize.current = resetPrize() }
      const match = matchStart.current !== null ? crucibleAt(tNow - matchStart.current) : null
      // The Throne is L3 and canon puts the Three on it — read off the level DATA, never an id
      // string here, so the day a floor's guards flag moves this follows it.
      const throneOpen = match?.activeLevel?.guards === true

      // ── the HUD line ────────────────────────────────────────────────────────────────────────
      // ⚠ IT NAMES THE FLOOR THAT IS OPEN AND NEVER SAYS YOU CLIMBED. The floors are time windows
      // in one arena until the geometry lands, and a HUD that said "Level 2" would be asserting an
      // ascent that did not happen — a claim the player would believe and the world would not honour.
      {
        const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, '0')}`
        let line: string | null = null
        if (match) {
          if (match.matchPhase === 'glyph') line = `THE GLYPH HOLDS · ${mmss(match.nextEventIn)}`
          else if (match.matchPhase === 'vault') line = `THE VAULT IS OPEN · ${mmss(match.nextEventIn)}`
          else if (match.matchPhase === 'over') line = 'THE MATCH IS OVER'
          else if (match.activeLevel) {
            const lv = match.levels.find(l => l.level.id === match.activeLevel!.id)
            const sealing = lv?.phase === 'sealing' ? ' · SEALING' : ''
            line = `${match.activeLevel.name.toUpperCase()}${sealing} · ${mmss(match.nextEventIn)}`
          }
        }
        // Latched on the STRING, so a re-render happens about once a second rather than 60 times.
        if (line !== matchLine.current) { matchLine.current = line; onMatch(line) }
      }

      const gs = guardSim.current
      if (cfg?.guards || throneOpen) {
        if (!gs.spawned) {
          gs.enc = initEncounter(cfg.tune); gs.spawned = true; gs.orbit = 0; gs.fireCd = [1.0, 1.6, 2.2]
          // ★ WHO SUMMONED THEM decides whether clearing them is worth anything.
          gs.viaMatch = throneOpen
          const base = (posRef.current?.y ?? 0) + 0.55
          guardBodies.forEach((b, i) => {
            const a = -Math.PI / 2 + (i - 1) * 0.7
            b.pos.set(pEye.x + Math.cos(a) * 11, base, pEye.z + Math.sin(a) * 11)
          })
        }
        const hpFrac = (hpRef.current ?? 1) / (hpMaxRef.current || 1)
        gs.enc = stepEncounter(gs.enc, dt, hpFrac, cfg.tune)
        // ⚠ THE PRIZE IS NO LONGER PAID HERE. It was, until 2026-09-05, on the edge into `cleared` —
        // which paid wherever the Three were summoned, so the game's top reward was a keypress away
        // in the practice range. Clearing the Throne now only ARMS it; the Vault pays, below.
        // See `crucible-prize.ts` for why the room and the earning are kept apart.
        gs.orbit += dt * 0.5
        guardBodies.forEach((b, i) => {
          const st = gs.enc.guards[i]
          if (!st?.alive) return
          // each guard holds its own standoff on its own bearing — the box the sim is tightening
          const bearing = gs.orbit + (i - 1) * 1.15
          const want = Math.min(st.standoff, gs.enc.boxRadius)
          const tx = pEye.x + Math.cos(bearing) * want
          const tz = pEye.z + Math.sin(bearing) * want
          const spd = specOf(st.id).speed * (st.staggerFor > 0 ? 0 : 1) * dt
          const dx = tx - b.pos.x, dz = tz - b.pos.z
          const d = Math.hypot(dx, dz) || 1
          const nx = b.pos.x + (dx / d) * Math.min(spd, d)
          const nz = b.pos.z + (dz / d) * Math.min(spd, d)
          const cell = gridRef.current?.[Math.round(nz)]?.[Math.round(nx)]
          // A puppet obeys the same three statuses. Shackling Seren mid-squeeze is the whole point:
          // her formation is canon, and taking her ability to hold the line is a keeper's answer to it.
          const gKey = `guard:${st.id}`
          const gRooted = hasStatus(statusRef.current, gKey, 'rooted', nowFrame)
          const gDisarmed = hasStatus(statusRef.current, gKey, 'disarmed', nowFrame)
          const gBlinded = hasStatus(statusRef.current, gKey, 'blinded', nowFrame)
          if (cell !== undefined && (cell & 0xFF) !== WALL_ID && !gRooted && !conjuredBlockedAt(conjuredRef.current, nx, nz, nowFrame)) { b.pos.x = nx; b.pos.z = nz }
          // the leading guard presses; the supports fire slower. Wren, least aggressive, slowest.
          gs.fireCd[i] -= dt
          if (gs.fireCd[i] <= 0 && st.staggerFor <= 0 && !gDisarmed) {
            gs.fireCd[i] = st.leading ? 1.5 : 2.8
            const o = orbs.find((or) => or.life <= 0)
            if (o) {
              o.pos.copy(b.pos); o.pos.y += 0.4
              o.vel.copy(pEye).sub(o.pos).normalize()
              if (gBlinded) { o.vel.x += Math.sin(gs.orbit * 6.1 + i) * 0.85; o.vel.z += Math.cos(gs.orbit * 4.7 + i) * 0.85; o.vel.normalize() }
              o.vel.multiplyScalar(DRONE_SPEED)
              o.life = DRONE_LIFE
            }
          }
        })
      } else if (gs.spawned) { gs.spawned = false; gs.enc = initEncounter(rangeCfgRef.current.tune) }  // toggle off = gone

      // ── ★★★ THE VAULT PAYS ──────────────────────────────────────────────────────────────────
      // Canon's WON road, finally at its own door. `stepPrize` is pure and tested: clearing the
      // Three on the Throne inside a match ARMS it, the Vault window PAYS it, exactly once.
      // ⚠ Runs whether or not the guards block ran this frame — the Vault opens after the Throne
      // has sealed and the Three are long gone, so gating this on their block would pay nobody.
      if (match) {
        const step = stepPrize(prize.current, match.matchPhase, gs.enc.cleared, gs.viaMatch)
        prize.current = step.next
        if (step.pay) {
          const rinv = loadRuneInventory()
          onTrial(clearTrial('puppet-guards', rinv.owned, rinv.birth).say)
        }
      }
      for (const o of orbs) {
        if (o.life <= 0) continue
        o.life -= dt
        o.pos.addScaledVector(o.vel, dt)
        const cx = Math.round(o.pos.x), cz = Math.round(o.pos.z)
        const cell = gridRef.current?.[cz]?.[cx]
        if (cell === undefined || (cell & 0xFF) === WALL_ID) { o.life = 0; continue }
        // incoming fire is stopped by your own terrain + firewall. That symmetry IS the move.
        if (conjuredBlockedAt(conjuredRef.current, o.pos.x, o.pos.z, nowFrame)) { o.life = 0; continue }
        { const ab = absorbShotAt(fieldsRef.current, o.pos.x, o.pos.z, DRONE_DMG); if (ab.hit) { fieldsRef.current = ab.fields; o.life = 0; continue } }
        if (o.pos.distanceToSquared(pEye) < PLAYER_HIT_R2) {
          o.life = 0
          hurtPlayer(DRONE_DMG)  // a training drone — carries no rune
        }
      }
    }
    // render each round as a small head + trail LINKS: each link is a unit sphere stretched along the
    // gap between consecutive trail points → one continuous thin tracer line, tapering to the tail.
    // (Shrinking-ball trails read as orbs; a stretched line is the Apex tracer read.)
    if (shotRef.current) {
      // COLOUR LAW: the tracer is the WIELDER's soul-colour, never the weapon's — one colour across
      // both guns (cheap in-place .set, no alloc). The Lance reads distinct from the Spitter by its
      // fatter/slower ROUND (headR/trailR), not by colour.
      const mat = shotRef.current.material as THREE.MeshBasicMaterial
      if (mat?.color) mat.color.set(SOUL_COLOR)
      pool.forEach((p, i) => {
        const base = i * SEG
        if (p.life > 0) { scl.set(W.headR, W.headR, W.headR); m.compose(p.pos, q, scl) } else m.compose(zero, q, zero)
        shotRef.current!.setMatrixAt(base, m)
        for (let j = 0; j < TRAIL_N; j++) {
          const a = p.trail[j], b = j === 0 ? p.pos : p.trail[j - 1]
          seg.copy(b).sub(a)
          const len = seg.length()
          if (p.life > 0 && len > 1e-4) {
            qSeg.setFromUnitVectors(AXIS_Z, seg.multiplyScalar(1 / len))
            const r = W.trailR * (1 - j / TRAIL_N)  // taper toward the tail
            mid.copy(a).add(b).multiplyScalar(0.5)
            scl.set(r, r, len / 2 + r)  // half-length + radius so links overlap into a continuous line
            m.compose(mid, qSeg, scl)
          } else m.compose(zero, q, zero)
          shotRef.current!.setMatrixAt(base + 1 + j, m)
        }
      })
      shotRef.current.instanceMatrix.needsUpdate = true
    }
    // target boards: three stacked disc layers (board/ring/core) sharing one transform per target —
    // billboarded to face the player (a range target you can always square up on), shrinking with damage
    if (boardRef.current && ringRef.current && coreRef.current) {
      targets.forEach((t, i) => {
        const s = t.alive ? 0.68 + 0.32 * (t.hp / TARGET_HP) : 0
        if (t.alive && posRef.current) {
          rel.set(posRef.current.x, t.pos.y, posRef.current.z).sub(t.pos)  // yaw-only facing — boards stay upright
          if (rel.lengthSq() > 1e-4) qT.setFromUnitVectors(AXIS_Y, rel.normalize()); else qT.identity()
          scl.setScalar(s)
          m.compose(t.pos, qT, scl)
        } else m.compose(zero, q, zero)
        boardRef.current!.setMatrixAt(i, m)
        ringRef.current!.setMatrixAt(i, m)
        coreRef.current!.setMatrixAt(i, m)
      })
      boardRef.current.instanceMatrix.needsUpdate = true
      ringRef.current.instanceMatrix.needsUpdate = true
      coreRef.current.instanceMatrix.needsUpdate = true
    }
    if (orbRef.current) {
      orbs.forEach((o, i) => { m.compose(o.life > 0 ? o.pos : zero, q, o.life > 0 ? one : zero); orbRef.current!.setMatrixAt(i, m) })
      orbRef.current.instanceMatrix.needsUpdate = true
    }
    if (castMeshRef.current) {
      castPool.forEach((p, i) => { m.compose(p.life > 0 ? p.pos : zero, q, p.life > 0 ? one : zero); castMeshRef.current!.setMatrixAt(i, m) })
      castMeshRef.current.instanceMatrix.needsUpdate = true
    }
    // ── SYSTEM 1 render: a field is a flat disc on the ground, scaled to its own radius. Unused
    // instances collapse to zero scale (the pool pattern used by every other instanced mesh here). ──
    if (fieldMeshRef.current) {
      const fl = fieldsRef.current
      const py = posRef.current?.y ?? 0
      for (let i = 0; i < FIELD_MAX; i++) {
        const f = fl[i]
        if (!f) { m.compose(zero, q, zero); fieldMeshRef.current.setMatrixAt(i, m); continue }
        scl.set(f.radius, 1, f.radius)
        seg.set(f.x, py + 0.06, f.z)
        m.compose(seg, q, scl)
        fieldMeshRef.current.setMatrixAt(i, m)
      }
      fieldMeshRef.current.instanceMatrix.needsUpdate = true
    }
    // ── SYSTEM 2 render: one box per conjured CELL, so what you see is exactly what blocks you.
    // Drawing the collision set itself means the wall can never look different from where it is. ──
    if (conjuredMeshRef.current) {
      const cells = liveCells(conjuredRef.current, nowFrame)
      const py = posRef.current?.y ?? 0
      for (let i = 0; i < CONJ_MAX; i++) {
        const c = cells[i]
        if (!c) { m.compose(zero, q, zero); conjuredMeshRef.current.setMatrixAt(i, m); continue }
        scl.set(1, c.height, 1)
        seg.set(c.x, py + c.height / 2, c.z)
        m.compose(seg, q, scl)
        conjuredMeshRef.current.setMatrixAt(i, m)
      }
      conjuredMeshRef.current.instanceMatrix.needsUpdate = true
    }
    // the guards' bodies. Scale carries HP the same way the targets and the hunter read, and a
    // staggered guard sits lower — the posture breaking is the tell that it is a puppet.
    if (guardMeshRef.current) {
      const gs = guardSim.current
      guardBodies.forEach((b, i) => {
        const st = gs.enc.guards[i]
        const live = gs.spawned && !!st?.alive
        const spec = GUARDS[i]
        const hpFrac = live ? st.hp / spec.hp : 0
        const s = live ? 0.85 + 0.35 * hpFrac - (st.staggerFor > 0 ? 0.15 : 0) : 0
        m.compose(live ? b.pos : zero, q, one.clone().setScalar(s))
        guardMeshRef.current!.setMatrixAt(i, m)
      })
      guardMeshRef.current.instanceMatrix.needsUpdate = true
    }
    if (huntRef.current) {
      const h = hunter.current
      huntRef.current.visible = h.alive
      if (h.alive) {
        huntRef.current.position.copy(h.pos)
        huntRef.current.rotation.y += dt * 2.2  // menace spin
        const s = 0.75 + 0.25 * (h.hp / HUNTER_HP)  // same shrink-with-damage read as the targets
        huntRef.current.scale.setScalar(s)
      }
    }
  })
  return (
    <>
      {/* frustumCulled=false: instances scatter far from the mesh origin, so the default origin-centered
          bounding sphere would cull the whole mesh whenever you look downrange. Unit sphere, scaled per-instance. */}
      <instancedMesh ref={shotRef} args={[undefined, undefined, MAX * SEG]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={SOUL_COLOR} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {/* the Three Puppet Guards — blockout bodies. Dead grey CAST metal per the colour law: they
          are constructs, and no colour of their own is exactly the point. Alex's call on the real
          look (TODO(puppet-guard-art) — canon gives stances + "armor that fits like it grew there"
          for Seren, quality leather for Cade, forgettable-by-design for Wren). */}
      {/* Crucible challengers (#302) — capacity is the canon roster, `count` is who is still up. */}
      <instancedMesh ref={botMeshRef} args={[undefined, undefined, ROSTER_SIZE]} frustumCulled={false}>
        <capsuleGeometry args={[0.34, 0.82, 4, 8]} />
        <meshStandardMaterial color={S.crucible.challenger} metalness={0.15} roughness={0.72} />
      </instancedMesh>
      <instancedMesh ref={guardMeshRef} args={[undefined, undefined, GUARDS.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.42, 0.9, 4, 10]} />
        <meshStandardMaterial color={S.crucible.guard} metalness={0.55} roughness={0.62} />
      </instancedMesh>
      {/* target boards — cylinder axis aligns to the billboard facing, so each reads as a bullseye
          disc squared up on the player. Layer heights differ slightly so the rings never z-fight. */}
      <instancedMesh ref={boardRef} args={[undefined, undefined, targets.length]} frustumCulled={false}>
        <cylinderGeometry args={[TARGET_R, TARGET_R, 0.07, 24]} />
        <meshStandardMaterial color={S.crucible.target.face} emissive={S.crucible.target.face} emissiveIntensity={0.25} />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[undefined, undefined, targets.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.38, 0.38, 0.11, 24]} />
        <meshStandardMaterial color={S.crucible.target.ring} emissive={S.crucible.target.ring} emissiveIntensity={0.45} />
      </instancedMesh>
      <instancedMesh ref={coreRef} args={[undefined, undefined, targets.length]} frustumCulled={false}>
        <cylinderGeometry args={[TARGET_CRIT_R, TARGET_CRIT_R, 0.15, 16]} />
        <meshStandardMaterial color={S.crucible.target.bull} emissive={S.crucible.target.bull} emissiveIntensity={0.9} />
      </instancedMesh>
      {/* hunter return-fire orbs — hot amber so they read as INCOMING vs the player's cyan tracers */}
      <instancedMesh ref={orbRef} args={[undefined, undefined, EMAX]} frustumCulled={false}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshBasicMaterial color={S.crucible.returnFire} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {/* cast bolts. ★ COLOUR LAW (moves.md:5): a move has no colour — colour is the MAGE's own
          soul-frequency. So the bolt is SOUL_COLOR, the same as the tracers, and it never re-tints
          per rune. It reads as a heavier, slower version of your own light, which is the point. */}
      <instancedMesh ref={castMeshRef} args={[undefined, undefined, CMAX]} frustumCulled={false}>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshBasicMaterial color={SOUL_COLOR} transparent opacity={0.96} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {/* SYSTEM 1 — field discs. Amber + additive so a Firewall reads as heat on the floor; a
          Healing Grove uses the same disc (one material) and is told apart by where it sits and
          what it does. Per-field tinting is a follow-on once there is more than one field colour. */}
      <instancedMesh ref={fieldMeshRef} args={[undefined, undefined, FIELD_MAX]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 0.08, 28]} />
        <meshBasicMaterial color={S.crucible.fieldDisc} transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {/* SYSTEM 2 — conjured terrain. Dead grey stone with a faint soul-tinted rim: it is MADE, not
          native, and the art-medium law keeps conjured rock grey rather than glowing. */}
      <instancedMesh ref={conjuredMeshRef} args={[undefined, undefined, CONJ_MAX]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={S.crucible.conjured} emissive={SOUL_COLOR} emissiveIntensity={0.12} metalness={0.15} roughness={0.85} />
      </instancedMesh>
      {inHold && <HoldScene holdRef={holdRef} />}
      {/* the ground hunter — magenta spinning octahedron, unmistakably NOT a range target */}
      <mesh ref={huntRef} visible={false} frustumCulled={false}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={S.crucible.hunter} emissive={S.crucible.hunter} emissiveIntensity={0.85} />
      </mesh>
    </>
  )
}

// Weapon crosshair — replaces the interact reticle while the weapon is drawn. White core + dark
// outline + faint cyan glow reads on any background. The four arms sit at the CURRENT spread cone's
// edge — rAF reads bloomRef/adsRef and writes CSS vars directly, so the reticle tells the truth about
// accuracy (blooms as you spray, snaps tight on ADS) with zero React renders while firing.
function WeaponReticle({ bloomRef, adsRef, weaponIdxRef }: {
  bloomRef: React.MutableRefObject<number>
  adsRef: React.RefObject<boolean>
  weaponIdxRef: React.RefObject<number>
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0, cur = 8
    const tick = () => {
      const el = ref.current
      if (el) {
        const W = WEAPONS[weaponIdxRef.current] ?? WEAPONS[0]
        const ads = adsRef.current
        const spread = (ads ? W.adsSpread : W.hipSpread) + bloomRef.current * (ads ? W.adsBloomScale : 1)
        cur += (3 + spread * 9 - cur) * 0.25  // lerp so the hip↔ADS jump glides instead of snapping
        el.style.setProperty('--gap', `${cur.toFixed(2)}px`)
        el.style.setProperty('--arm', ads ? '5px' : '8px')
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bloomRef, adsRef, weaponIdxRef])
  const ink = '0 0 0 1px rgba(8,12,18,0.85), 0 0 5px rgba(143,224,255,0.7)'
  const arm = (s: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', background: S.gun.reticle, borderRadius: 4, boxShadow: ink, ...s,
  })
  return (
    <div ref={ref} style={{ position: 'fixed', left: '50%', top: '50%', zIndex: 30, pointerEvents: 'none',
      ['--gap' as string]: '8px', ['--arm' as string]: '8px' }}>
      <div style={{ position: 'absolute', left: -1.75, top: -1.75, width: 3.5, height: 3.5, borderRadius: '50%', background: S.gun.reticle, boxShadow: ink }} />
      <div style={arm({ left: -1, bottom: 'var(--gap)', width: 2, height: 'var(--arm)' })} />
      <div style={arm({ left: -1, top: 'var(--gap)', width: 2, height: 'var(--arm)' })} />
      <div style={arm({ top: -1, right: 'var(--gap)', height: 2, width: 'var(--arm)' })} />
      <div style={arm({ top: -1, left: 'var(--gap)', height: 2, width: 'var(--arm)' })} />
    </div>
  )
}

// HP + Shield — two vertical percent bars, right edge, vertically centered (clear of the top-right
// menu stack above and the hotbar below, whatever either grows into). Combat mutates
// hpRef/shieldRef at frame rate, so rAF reads the refs and writes fill-height + text directly — same
// zero-React-churn pattern as WeaponReticle. Shield bar dims while cracked; HP tints red when low.
function ResourceBars({ hpRef, hpMaxRef, shieldRef, shieldMaxRef }: {
  hpRef: React.MutableRefObject<number>
  hpMaxRef: React.RefObject<number>
  shieldRef: React.MutableRefObject<number>
  shieldMaxRef: React.RefObject<number>
}) {
  const shFill = useRef<HTMLDivElement>(null), shTxt = useRef<HTMLDivElement>(null)
  const hpFill = useRef<HTMLDivElement>(null), hpTxt = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const sh = Math.max(0, Math.round((shieldRef.current / (shieldMaxRef.current || MAX_SHIELD)) * 100))
      const hp = Math.max(0, Math.round((hpRef.current / (hpMaxRef.current || MAX_HP)) * 100))
      if (shFill.current) { shFill.current.style.height = `${sh}%`; shFill.current.style.opacity = sh === 0 ? '0.25' : '1' }
      if (shTxt.current) shTxt.current.textContent = `${sh}`
      if (hpFill.current) { hpFill.current.style.height = `${hp}%`; hpFill.current.style.background = hp <= 30 ? S.gun.hpLow : S.gun.hp }
      if (hpTxt.current) { hpTxt.current.textContent = `${hp}`; hpTxt.current.style.color = hp <= 30 ? S.gun.hpTextLow : S.gun.hpText }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hpRef, hpMaxRef, shieldRef, shieldMaxRef])
  const barShell: React.CSSProperties = {
    width: 14, height: 118, borderRadius: 7, overflow: 'hidden', position: 'relative',
    background: 'rgba(10,16,26,0.72)', border: `1px solid ${S.gun.barEdge}`, display: 'flex', alignItems: 'flex-end',
  }
  const fill: React.CSSProperties = { width: '100%', transition: 'height 0.15s ease-out' }
  const pct: React.CSSProperties = { font: '800 11px ui-monospace, monospace', color: S.gun.hpText, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }
  const lbl: React.CSSProperties = { font: '700 9px ui-monospace, monospace', color: S.gun.label, letterSpacing: '0.1em' }
  return (
    <div style={{ position: 'fixed', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 34, display: 'flex', gap: 7, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={barShell}><div ref={shFill} style={{ ...fill, background: S.gun.shield, boxShadow: `0 0 8px ${S.gun.shield}88` }} /></div>
        <div ref={shTxt} style={{ ...pct, color: S.gun.shieldText }}>100</div>
        <div style={lbl}>SH</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={barShell}><div ref={hpFill} style={{ ...fill, background: S.gun.hp, boxShadow: `0 0 8px ${S.gun.hp}66` }} /></div>
        <div ref={hpTxt} style={pct}>100</div>
        <div style={lbl}>HP</div>
      </div>
    </div>
  )
}

// Ammo — the AM Riser clip readout, bottom-right corner. Recharge draws from MANA (RELOAD_MANA per
// full clip), so this and the mana vial are two views of one economy. rAF off refs, zero React churn.
function AmmoCounter({ ammoRef, reloadingRef, weaponIdxRef }: {
  ammoRef: React.MutableRefObject<number>
  reloadingRef: React.MutableRefObject<number>
  weaponIdxRef: React.RefObject<number>
}) {
  const num = useRef<HTMLDivElement>(null), sub = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const a = ammoRef.current, rel = reloadingRef.current > 0
      const clip = (WEAPONS[weaponIdxRef.current] ?? WEAPONS[0]).clip
      const lowAt = Math.max(2, Math.ceil(clip * 0.25))  // "low" is relative to the clip (the Lance's 8 warns sooner)
      if (num.current) {
        num.current.textContent = rel ? '——' : String(a)
        num.current.style.color = rel ? S.gun.ammoReload : a === 0 ? S.gun.ammoEmpty : a <= lowAt ? S.gun.ammoLow : S.gun.ammo
      }
      if (sub.current) {
        sub.current.textContent = rel ? 'RECHARGING' : a === 0 ? 'R — RECHARGE' : `/ ${clip}`
        sub.current.style.color = rel ? `${S.gun.ammoReload}aa` : a === 0 ? S.gun.ammoEmpty : S.gun.label
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ammoRef, reloadingRef, weaponIdxRef])
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 16, zIndex: 35, pointerEvents: 'none', textAlign: 'right' }}>
      <div ref={num} style={{ font: '800 30px ui-monospace, monospace', color: S.gun.ammo, textShadow: '0 2px 4px rgba(0,0,0,0.8)', lineHeight: 1 }}>{CLIP_SIZE}</div>
      <div ref={sub} style={{ font: '700 10px ui-monospace, monospace', color: S.gun.label, letterSpacing: '0.12em', marginTop: 3 }}>/ {CLIP_SIZE}</div>
    </div>
  )
}

// ── THE CAST BAR: what your hands actually hold ────────────────────────────────────────────────
// Four slots, typed by canon tier (1 passive · 2 tacticals · 1 ultimate) and bound G/Z/X/C. The bar
// is the loadout made visible — the answer to "the birth rune sets the tone, it doesn't decide the
// tactical or the special": what you throw is a MOVE off your book, and the bar says which.
//
// It is honest about three things, deliberately:
//   · an EMPTY slot reads "—" with its tier name. Your book has no move of that tier for the runes
//     you hold — the coverage gap in moves.md, rendered where the player meets it.
//   · an UNBUILT move is dimmed and struck. Canon has written it; the sim can't run it yet. Better
//     a visible "not built" than a key that silently does nothing.
//   · the HELD stance lights up and stays lit, because mana recovery is paused the whole time.
// Cooldowns sweep on a rAF off the ref — no per-frame React render.
function CastBar({ slots, stance, cdRef }: {
  slots: (string | null)[]
  stance: string | null
  cdRef: React.RefObject<number[]>
}) {
  const cells = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const now = performance.now()
      cells.current.forEach((el, i) => {
        if (!el) return
        const until = cdRef.current?.[i] ?? 0
        el.style.opacity = now < until ? '0.4' : '1'
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cdRef])
  return (
    <div style={{ position: 'fixed', left: 18, bottom: 16, zIndex: 35, pointerEvents: 'none', display: 'flex', gap: 6 }}>
      {ALL_BANDS.map((kind, i) => {
        const moveId = slots[i]
        const spec = castForMove(moveId)
        const held = !!moveId && stance === moveId
        const built = !!moveId && spec.archetype !== 'unbuilt'
        const tint = held ? S.gun.castHeld : built ? S.gun.castBuilt : S.gun.castIdle
        // Since 2026-08-26 the bar is the cast bands alone (Z/C) — the passive left the bar to become
        // an always-on derived trait shown in the loadout menu, so there is no stance cell to set apart.
        return (
          <div key={i} ref={(el) => { cells.current[i] = el }} style={{
            minWidth: 92, padding: '6px 9px', borderRadius: 7,
            background: held ? 'rgba(60,44,12,0.88)' : 'rgba(10,14,22,0.78)',
            border: `1px solid ${held ? `${S.gun.castHeld}88` : S.gun.castEdge}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ font: '800 10px ui-monospace, monospace', color: tint, letterSpacing: '0.14em' }}>{BAND_KEYS[i].toUpperCase()}</span>
              <span style={{ font: '700 8px ui-monospace, monospace', color: S.gun.castKind, letterSpacing: '0.12em' }}>{kind.toUpperCase()}</span>
            </div>
            <div style={{
              font: '700 11px ui-monospace, monospace', color: moveId ? (built ? S.gun.ammo : S.gun.castUnbuilt) : S.gun.castEmpty,
              marginTop: 3, textDecoration: moveId && !built ? 'line-through' : 'none', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 118,
            }}>{spec.label || '—'}</div>
          </div>
        )
      })}
    </div>
  )
}

// Visible EXIT markers at a zone's warp tiles — for outside-Ather zones, where warps aren't painted
// into the grid (no gold beacon), so the way back stays obvious. Green pillar + floating EXIT label.
//
// Gate-derived warps are SKIPPED here (`w.gate` is set): a gate draws its own single marker below.
// Without that filter a 2x2 gate would stack four identical pillars and four EXIT signs on one
// door — which is exactly the mess that made gates worth having.
function ExitMarkers({ warps, heights }: { warps: Warp[]; heights: number[][] }) {
  return (
    <>
      {warps.filter(w => !w.gate).map((w, i) => {
        const y = (heights[w.fromY]?.[w.fromX] ?? 0) * STEP
        return (
          <group key={i} position={[w.fromX, y, w.fromY]}>
            <mesh position={[0, 1.4, 0]}>
              <cylinderGeometry args={[0.3, 0.42, 2.8, 6]} />
              <meshStandardMaterial color={S.exit.pillar} emissive={S.exit.pillar} emissiveIntensity={0.85} transparent opacity={0.55} />
            </mesh>
            <Html zIndexRange={[20, 0]} position={[0, 3.2, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
              <div style={{ font: '800 11px ui-monospace, monospace', color: S.exit.glow, background: S.exit.labelPlate, padding: '2px 7px', borderRadius: 7, whiteSpace: 'nowrap', border: `1px solid ${S.exit.labelEdge}` }}>EXIT</div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

// ⚠ EVERY IN-WORLD `<Html>` LABEL PINS `zIndexRange={[20, 0]}` (2026-09-16). drei's default range
// starts at 16,777,271, so a gate name floated over the satchel the day the shared panel landed
// (`hud/satchel.tsx` sits at z-30, as it does in the Ather). The HUD is above the world, always;
// a label is part of the world.
/**
 * A GATE — one 2x2 (or NxN) door, drawn once, with its name over it.
 *
 * Deliberately louder than `ExitMarkers`: a gate is a destination you decide to walk to from
 * across a square, an EXIT is a way out you look for once you want to leave. So the gate gets a
 * lit threshold pad the size of its whole footprint, a post at each corner rather than one in the
 * middle (a centre post would stand exactly where you walk), and a nametag at ~2.4x the EXIT
 * label's size, hung high enough to clear the posts.
 *
 * Everything comes from the Gate data — including the text — so renaming a door is a one-field
 * edit in `zones.ts` and never a change in here. Owner-only gates are dimmed and tagged rather
 * than hidden: the owner should be able to see at a glance which doors the players cannot use.
 */
function GateMarkers({ gates, heights, isOwner, posRef }: { gates: Gate[]; heights: number[][]; isOwner: boolean; posRef: React.RefObject<THREE.Vector3> }) {
  return (
    <>
      {gates.map((g, i) => (g.ownerOnly && !isOwner) ? null : <GateMarker key={`gate-${i}`} g={g} heights={heights} posRef={posRef} />)}
    </>
  )
}

/**
 * ── ★ THE NAME SHOWS WHEN YOU LOOK AT THE DOOR, OR STAND IN IT (Alex, 2026-09-17) ──────────────
 * Same rule as the Ather's gate station (`voxel3d/seam.ts` › tick): an always-on nameplate over
 * every door was a signpost, not a hint. Each frame the eye's ray is cast at an invisible box
 * the size of the door's footprint and the posts' height — the volume a walker reads as "that
 * door" — within `GATE_TAG_REACH`; the nearest hit shows its plate. Standing on the threshold pad
 * shows it too: you are choosing it. React state flips only on change, so the walker never
 * re-renders at 60Hz for this.
 */
const GATE_TAG_REACH = 30
function GateMarker({ g, heights, posRef }: { g: Gate; heights: number[][]; posRef: React.RefObject<THREE.Vector3> }) {
  const { w: fw, h: fh } = gateFootprint(g)
  // Anchor is the footprint's top-left TILE; the visual centre is half a footprint in, minus
  // the half-tile that separates a tile's corner from its middle.
  const cx = g.x + fw / 2 - 0.5
  const cz = g.y + fh / 2 - 0.5
  const y = (heights[g.y]?.[g.x] ?? 0) * STEP
  const tint = g.ownerOnly ? S.gate.owner : S.gate.open
  const glow = g.ownerOnly ? S.gate.ownerGlow : S.gate.openGlow
  // corner posts sit on the footprint's outline, offset from the centre we're grouped at
  const hw = fw / 2, hh = fh / 2
  const corners: Array<[number, number]> = [[-hw, -hh], [-hw, hh], [hw, -hh], [hw, hh]]
  const hit = useRef<THREE.Mesh>(null)
  const [shown, setShown] = useState(false)
  const camera = useThree(s => s.camera)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const p = posRef.current
    const standing = !!p && Math.abs(p.x - cx) <= hw + 0.3 && Math.abs(p.z - cz) <= hh + 0.3
    let looked = false
    if (!standing && hit.current) {
      camera.getWorldDirection(dir)
      ray.set(camera.position, dir)
      ray.far = GATE_TAG_REACH
      looked = ray.intersectObject(hit.current, false).length > 0
    }
    const next = standing || looked
    if (next !== shown) setShown(next)
  })
  return (
    <group position={[cx, y, cz]}>
      {/* the threshold — a lit pad covering the whole footprint, so the door reads as one thing */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[fw, fh]} />
        <meshStandardMaterial color={tint} emissive={glow} emissiveIntensity={0.5} transparent opacity={0.4} />
      </mesh>
      {corners.map(([dx, dz], k) => (
        <mesh key={k} position={[dx, 1.6, dz]}>
          <cylinderGeometry args={[0.16, 0.24, 3.2, 6]} />
          <meshStandardMaterial color={tint} emissive={glow} emissiveIntensity={0.9} transparent opacity={0.65} />
        </mesh>
      ))}
      {/* the look-box: never drawn, only cast at */}
      <mesh ref={hit} position={[0, 1.6, 0]} visible={false}>
        <boxGeometry args={[fw + 0.4, 3.2, fh + 0.4]} />
        <meshBasicMaterial />
      </mesh>
      {shown && (
        <Html zIndexRange={[20, 0]} position={[0, 4.1, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
          <div style={{
            font: '800 26px ui-monospace, monospace', color: glow, letterSpacing: '0.08em',
            background: 'rgba(8,14,10,0.78)', padding: '7px 18px', borderRadius: 10,
            whiteSpace: 'nowrap', border: `2px solid ${tint}88`, textShadow: `0 0 12px ${glow}66`,
          }}>
            {g.label}
            {g.ownerOnly && <div style={{ font: '700 11px ui-monospace, monospace', color: S.gate.ownerGlow, opacity: 0.8, letterSpacing: '0.14em', marginTop: 2 }}>OWNER ONLY</div>}
          </div>
        </Html>
      )}
    </group>
  )
}

// Owner-only test-hub gate markers — glowing labeled pillars at the Crucible + Rune Hold gate tiles
// in Greg's home. Rendered only when isOwner (players never see them); tiles match the ownerOnly warps.


// ── The hour, on the HUD ────────────────────────────────────────────────────
// Self-ticking on its own interval so the clock moving never re-renders the walker. 4s is plenty:
// at a 64-minute day one game-minute is 2.7 real seconds, so the readout advances every tick.
const PHASE_GLYPH: Record<string, { g: string; c: string }> = {
  dawn:  { g: '◐', c: S.dayGlyph.dawn },
  day:   { g: '☀', c: S.dayGlyph.day },
  dusk:  { g: '◑', c: S.dayGlyph.dusk },
  night: { g: '☾', c: S.dayGlyph.night },
}

// ── THE CLOCK IS SHARED NOW (`hud/clock.tsx`, 2026-09-16 HUD port). What stays here is what only
// the mortal side knows: its zones re-deal on a timer, and the board can be pinned. Those chips
// ride under the dial as its `note`.
/** The Sound tab. ONE master volume for the keeper: read and written through the same persisted
 *  settings the Ather uses (`voxel3d/settings.ts`, a device key), driving `audio/bus.ts`'s single
 *  master gain — so a level set in Rune Hold is the level in the Glade. */
function PlaySound() {
  const [v, setV] = useState(() => loadSettings().volume)
  return (
    <OptionSlider label="volume" value={v} format={x => `${Math.round(x * 100)}%`}
      onChange={x => { setV(x); setMasterVolume(x); saveSettings({ ...loadSettings(), volume: x }) }} />
  )
}

function DayNotes({ zoneId }: { zoneId: string }) {
  const [, bump] = useState(0)
  useEffect(() => { const id = setInterval(() => bump(n => n + 1), 4000); return () => clearInterval(id) }, [])
  // The world-reset tell. Only shown once the re-deal is inside the fade window, so it is a warning
  // rather than permanent furniture — and it is what makes a dimming tree read as "the garden is
  // about to turn over" instead of as a graphical fault. The chip refreshes every 4s, so this
  // counts in whole minutes; a seconds readout would visibly jump and look broken.
  // Never claimed while the board is pinned: with `?window=` the world is deliberately NOT going to
  // turn over, so a countdown to a re-deal that will not happen is just a lie on the HUD.
  const toReset = msUntilZoneReset(Date.now(), regionSpawnConfig(zoneId))
  const renewing = !isBoardPinned && toReset < FADE_OUT_MS
  const chip = 'mt-1 px-1.5 py-0.5 rounded border border-white/15 bg-black/45 text-[9px] font-mono whitespace-nowrap'
  return (<>
    {isBoardPinned && <div title="spawn board pinned by ?window= — drop the param for the live board" className={`${chip} text-fuchsia-300/80`}>BOARD PINNED</div>}
    {/* ★ Loud on purpose, and in a warning colour. `?fadetest=1` cycles EVERY node through the
        dissolve on a 12s loop, which is indistinguishable from the world being broken. */}
    {isFadeTest && <div title="?fadetest=1 is ON — every node is cycling the fade for inspection. Drop the param for the real world." className={`${chip} text-red-300`}>FADE TEST</div>}
    {renewing && (
      <div title="the garden is re-dealing — fading resources are on their way out" className={`${chip} text-emerald-200/80`}>
        🍃 {toReset < 60_000 ? 'RENEWING' : `${Math.ceil(toReset / 60_000)}m`}
      </div>
    )}
  </>)
}

// ── The sun, and the moon it becomes ────────────────────────────────────────
// One directional light does both. Two lights would mean two shadow maps for a garden that never
// has two shadow-casters up at once, and the handover at the horizon is exactly where a crossfade
// between two rigs would show its seam.
//
// Everything here reads the global clock directly (`dayProgress` is pure over wall time) and
// mutates the light in place — no state, no re-render, no prop plumbing. At a 64-minute day the sun
// moves about a tenth of a degree per second, so per-frame mutation is both cheap and invisible.
//
// Canon (design-briefs/shimmer-garden-atmosphere.md, RULED 2026-07-21): day is honey-gold, night is
// the Moonwell hour in SATURATED silver — never a desaturation. The colours below are that ruling;
// the intensities are build tuning.
const SUN_LOW = new THREE.Color(S.sunlight.sunLow)     // horizon gold — dawn and dusk, the seams
const SUN_HIGH = new THREE.Color(S.sunlight.sunHigh)    // noon
const MOON = new THREE.Color(S.sunlight.moon)        // the Moonwell hour, cool and still luminous
const AMBIENT_DAY = new THREE.Color(S.sunlight.ambientDay)
const AMBIENT_NIGHT = new THREE.Color(S.sunlight.ambientNight)

function SkyLight({ shadowMap, under = false }: { shadowMap: number | null; under?: boolean }) {
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const ambRef = useRef<THREE.AmbientLight>(null)
  const tint = useRef(new THREE.Color())

  useFrame(() => {
    const p = dayProgress()
    const elev = sunElevation(p)
    const azi = sunAzimuth(p)
    const dl = daylight(p)

    const sun = sunRef.current
    if (sun) {
      // Below the horizon the rig flips to the moon — mirrored, so moonlight rakes from the
      // opposite side and night reads as a different time of day rather than a dimmer noon.
      const night = elev < 0
      const e = night ? -elev : elev
      const a = night ? -azi : azi
      sun.position.set(a * 30, Math.max(0.18, e) * 34 + 4, (night ? -1 : 1) * 14)

      // Warm at the horizon, white overhead — the low sun is what makes dawn and dusk read.
      tint.current.copy(SUN_LOW).lerp(SUN_HIGH, Math.max(0, Math.min(1, e)))
      sun.color.copy(night ? MOON : tint.current)
      // Moonlight is a real light, not a token one: canon's night is luminous and cozy-safe, and a
      // garden you cannot see is not restful, it is just dark. First pass at 0.34 rendered the
      // benches and chests as near-black silhouettes — readable as "night", useless as a place.
      sun.intensity = night ? 0.62 : 0.30 + 1.05 * dl
      // Under the mountain no sun reaches: a faint cold spill stays so a face turned from every lantern
      // is dark, not black. The lanterns (`PassageScene`) and the UNDERGROUND mood carry the room.
      if (under) { sun.color.set(S.passage.noSun); sun.intensity = 0.12 }
    }

    const amb = ambRef.current
    if (amb) {
      amb.color.copy(AMBIENT_NIGHT).lerp(AMBIENT_DAY, dl)
      amb.intensity = 0.50 + 0.20 * dl   // night floor is what keeps unlit faces legible
      if (under) { amb.color.set(S.passage.ambient); amb.intensity = 0.8 }
    }
  })

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.65} />
      {/* Shadow map size is player-set (gfx.ts). Keyed on the size so a change reallocates the map
          instead of leaving three.js holding the old one — the prop alone would not resize it. */}
      <directionalLight
        ref={sunRef}
        key={`sun-${shadowMap ?? 'off'}`}
        position={[18, 26, 12]} intensity={1.25} castShadow={shadowMap !== null}
        shadow-mapSize-width={shadowMap ?? 1024} shadow-mapSize-height={shadowMap ?? 1024}
        shadow-camera-left={-40} shadow-camera-right={40}
        shadow-camera-top={40} shadow-camera-bottom={-40}
        shadow-camera-near={0.5} shadow-camera-far={160}
      />
    </>
  )
}

function HubGateMarkers({ heights }: { heights: number[][] }) {
  const gates = [
    { c: 10, r: 7, color: S.hubGate.range, label: 'RANGE' },
    { c: 16, r: 7, color: S.hubGate.runeHold, label: 'RUNE HOLD' },
  ]
  return (
    <>
      {gates.map((g) => {
        const y = (heights[g.r]?.[g.c] ?? 0) * STEP
        return (
          <group key={g.label} position={[g.c, y, g.r]}>
            <mesh position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.32, 0.5, 3, 6]} />
              <meshStandardMaterial color={g.color} emissive={g.color} emissiveIntensity={0.9} transparent opacity={0.5} />
            </mesh>
            <Html zIndexRange={[20, 0]} position={[0, 3.4, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
              <div style={{ font: '800 12px ui-monospace, monospace', color: g.color, background: 'rgba(8,8,14,0.7)', padding: '2px 7px', borderRadius: 7, whiteSpace: 'nowrap', border: `1px solid ${g.color}66` }}>{g.label}</div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

// ── THE GUIDE TRAIL, on the mortal side (2026-09-16). The SAME motes the Ather draws
// (`voxel3d/guide-trail.ts`); only the aim differs — `play3d/fork.ts` decides where, from the
// save's flags, and this ticks the points each frame with the tile heights as the surface. The
// target ref is written by the host on every render (cheap: a few comparisons), read here at 60Hz.
function GuideTrail({ posRef, heightsRef, targetRef }: {
  posRef: React.RefObject<THREE.Vector3>; heightsRef: React.RefObject<number[][]>; targetRef: React.RefObject<GuideTarget | null>
}) {
  const guide = useMemo(() => createGuideTrail(), [])
  useEffect(() => () => guide.dispose(), [guide])
  const last = useRef(performance.now() / 1000)
  const surfaceY = useCallback((x: number, z: number) => {
    const h = heightsRef.current?.[z]?.[x]
    return h === undefined ? null : h * STEP
  }, [heightsRef])
  useFrame(() => {
    const now = performance.now() / 1000
    const dt = Math.min(0.1, now - last.current); last.current = now
    const p = posRef.current
    if (!p) return
    guide.tick(p.x, p.z, targetRef.current, dt, now, surfaceY)
  })
  return <primitive object={guide.points} />
}

const Scene = memo(function Scene(props: {
  zone: Zone; gridRef: React.RefObject<number[][]>; heights: number[][]; version: number; dims: string
  posRef: React.RefObject<THREE.Vector3>; heightsRef: React.RefObject<number[][]>; zoneIdRef: React.RefObject<string>
  editFocusRef: React.RefObject<THREE.Vector3>
  onWarp: (w: Warp) => void; yawRef: React.RefObject<number>; editRef: React.RefObject<boolean>
  eyeRef: React.RefObject<number>
  jumpRef: React.RefObject<boolean>; slideRef: React.RefObject<boolean>
  /** The hands read this; the walker writes it. Optional so a harness need not care. */
  bodyOut?: BodyOut
  speedMultRef: React.RefObject<number>; dreamwalkRef: React.RefObject<boolean>
  weaponMoveRef: React.RefObject<number>; weaponIdxRef: React.RefObject<number>
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
  battleRef: React.RefObject<boolean>; partyLevelRef: React.RefObject<number>
  onEncounter: (enc: WildEncounter) => void
  joyRef: React.RefObject<{ x: number; y: number }>
  talkingRef: React.RefObject<boolean>; hasPartyRef: React.RefObject<boolean>
  onNearChange: (n: NPC3D | null) => void
  defeatedRef: React.RefObject<Record<string, boolean>>; defeated: Record<string, boolean>
  flagsRef: React.RefObject<Record<string, boolean>>
  guideTargetRef: React.RefObject<GuideTarget | null>
  nodes: ResourceNode[]
  spawners: SpawnerPlacement[]; spawnerReady: (sp: SpawnerPlacement) => boolean
  spawnerKeyFor: (sp: SpawnerPlacement) => string
  restingSpirits: Spirit[]
  harvestNodesRef: React.RefObject<ResourceNode[]>; onNearNode: (n: ResourceNode | null) => void
  channel: { nodeId: string; hp: number } | null
  structures: PlacedStruct[]; placing: { itemId: string; facing: number } | null
  placeTargetRef: React.RefObject<{ x: number; y: number } | null>; structuresRef: React.RefObject<PlacedStruct[]>
  onNearStation: (s: PlacedStruct | null) => void
  companionColor: string | null
  fishing: boolean; fishBite: boolean
  harvestPop: { x: number; y: number; z: number; glyph: string; key: number } | null
  atmosZone: string
  isOwner: boolean
  firingRef: React.RefObject<boolean>
  onRangeHit: (crit: boolean) => void
  onRangeShot: () => void
  adsRef: React.RefObject<boolean>
  recoilRef: React.MutableRefObject<{ p: number; y: number }>
  bloomRef: React.MutableRefObject<number>
  hpRef: React.MutableRefObject<number>
  hpMaxRef: React.RefObject<number>
  shieldRef: React.MutableRefObject<number>
  shieldMaxRef: React.RefObject<number>
  rangeCfgRef: React.RefObject<RangeCfg>
  ammoRef: React.MutableRefObject<number>
  reloadingRef: React.MutableRefObject<number>
  pendingCastRef: React.MutableRefObject<CastSpec | null>
  castMultRef: React.RefObject<number>
  senseRadiusRef: React.RefObject<number>
  tremorRef: React.MutableRefObject<TremorReadout>
  resistRef: React.RefObject<number>
  birthRuneRef: React.RefObject<string | null>
  infusionRef: React.RefObject<{ until: number; mult: number }>
  fieldsRef: React.MutableRefObject<Field[]>
  conjuredRef: React.MutableRefObject<Conjured[]>
  holdRef: React.MutableRefObject<HoldState | null>
  statusRef: React.MutableRefObject<StatusBag>
  onHeal: (amount: number) => void
  onNeedReload: () => void
  onPlayerDamage: () => void
  onPlayerDown: () => void
  onTrial: (say: string) => void
  onMatch: (line: string | null) => void
  mpPeers: React.RefObject<Map<string, RemotePlayer>>
  /** Directional-light shadow map edge, or null for shadows off. Player-set — see gfx.ts. */
  shadowMap: number | null
}) {
  // Pure-prop filter → safe to memo, so a channel tick doesn't re-allocate the structure list.
  // The NPC filter below is deliberately NOT memoized: npcInWorld() reads flagsRef.current, which is
  // mutated in place, so any dep list would go stale the moment a story flag flips. It's a ~20-item
  // filter — recomputing it is cheaper than a subtle "the NPC never disappeared" bug.
  const structuresInZone = useMemo(
    () => structuresView(props.structures, props.zone.id),
    [props.structures, props.zone.id],
  )
  // The Home Plot is per-keeper personal space (canon: Greg's gate opens "a personal shimmer").
  // A peer whose position lies in the plot rect is standing in their OWN plot, so they are not
  // drawn in yours. Symmetric on every client — nobody is ever visible inside a plot, including
  // you to others — which makes the plot per-player TODAY at the presence layer, ahead of any
  // server-side instancing. In the garden zone-room every peer is by definition in their own plot.
  // ── STREAMING CENTRE ──────────────────────────────────────────────────────────────────
  // Sampled every frame but stored as a CHUNK, and the setter returns the previous object when
  // the chunk is unchanged — so this re-renders once per 64 tiles walked, not 60 times a second.
  // That identity check is the whole reason streaming can key off the player without costing
  // more than it saves.
  // ── THE WILDS MOUNT ───────────────────────────────────────────────────────────────────
  // The Wilds are ONE zone spanning many region files, and its grid arrives holding nothing.
  // Regions are blitted in as the player's load window reaches them, and handed back when it
  // does not — which is why the overland can grow without the client growing with it.
  //
  // It runs off the same chunk-crossing signal as streaming, and deliberately BEFORE
  // `setCenter`: the geometry memo rebuilds on the new centre, so the tiles have to already be
  // there when it does, or the player gets one frame of cloud where the next region should be.
  //
  // ★ EVERY REF IN HERE OUTLIVES THE ZONE. `Scene` is rendered without a key, so it does NOT
  // remount when the player warps — which broke this twice:
  //   1. `performWarp` sets `posRef` SYNCHRONOUSLY but queues `setZoneId`. So for one frame this
  //      callback sees the NEW position with the OLD zone id: it correctly skips the mount (not
  //      the Wilds yet) and then writes the destination chunk into `centerRef` anyway. Next frame
  //      the zone is right, the chunk guard says "nothing changed", and the mount never runs —
  //      the player stands in an overland that holds nothing until they walk 64 tiles.
  //   2. A stale `loaded` set would claim regions are present in a grid that was just rebuilt
  //      empty, so leaving the Wilds and coming back would land in the same nothing.
  // Both are the same root: streaming state is per-ZONE, so it has to be keyed on the zone.
  const wildsMount = useRef<WildsMount | null>(null)
  const mountedZone = useRef<string | null>(null)
  const [mountTick, setMountTick] = useState(0)
  const mountWilds = (tx: number, tz: number) => {
    if (mountedZone.current !== props.zone.id) {
      mountedZone.current = props.zone.id
      wildsMount.current = null       // the grid is new; what was loaded into the old one is gone
    }
    if (props.zone.id !== WILDS_ZONE || !props.gridRef.current) return
    wildsMount.current ??= newMount(WILDS_GEO)
    const r = syncWilds(wildsMount.current, props.gridRef.current, tx, tz, loadWildsRegion)
    // The geometry memo keys on the CENTRE, and an arrival mount happens at a centre it has
    // already rendered — so without this the tiles land in the grid and nothing redraws them.
    if (r.mounted.length || r.released.length) setMountTick(t => t + 1)
  }
  // ★ The centre is seeded on the FIRST RENDER, never left null, and the first mount happens
  // right here with it. A null centre means "mount every chunk" — correct for a small zone and
  // ruinous for a world-sized one, where it would bucket the entire overland (as solid cloud,
  // no less) before the player has taken a step. Seeding it also means the region under their
  // feet is already blitted in when the geometry memo runs for the first time.
  const [center, setCenter] = useState<ChunkCoord | null>(() => {
    const p = props.posRef.current
    const tx = p ? Math.round(p.x) : (props.zone.playerStart?.tileX ?? 0)
    const tz = p ? Math.round(p.z) : (props.zone.playerStart?.tileY ?? 0)
    mountWilds(tx, tz)
    return chunkOf(tx, tz)
  })
  const centerRef = useRef<ChunkCoord | null>(center)
  useFrame(() => {
    const p = props.posRef.current
    if (!p) return
    const c = chunkOf(Math.round(p.x), Math.round(p.z))
    // The zone half of this guard is NOT redundant with the chunk half — see the note above.
    // A warp can leave `centerRef` already holding the destination chunk, so chunk-equality
    // alone would suppress the arrival mount entirely.
    if (mountedZone.current === props.zone.id && sameChunk(centerRef.current, c)) return
    centerRef.current = c
    // BEFORE setCenter: the memo rebuilds on the new centre, so the tiles must already be there
    // or the player gets a frame of cloud where the next region should be.
    mountWilds(Math.round(p.x), Math.round(p.z))
    setCenter(c)
  })

  const plotHide = useMemo(() => {
    if (props.zone.id === HOME_PLOT_ZONE || props.zone.id === 'r-home-plot') return () => true
    if (props.zone.id === WORLD_ZONE_ID) {
      return (x: number, z: number) => fromWorld(Math.round(x), Math.round(z))?.zoneId === HOME_PLOT_ZONE
    }
    return undefined
  }, [props.zone.id])
  return (
    <>
      <GardenAtmosphere zoneId={props.atmosZone} />
      <SkyLight shadowMap={props.shadowMap} under={props.zone.id === PASSAGE_ZONE} />
      <ZoneGeometry key={`${props.zone.id}-${props.dims}`} gridRef={props.gridRef} heights={props.heights} version={props.version} paint={props.paint} editing={props.editing} center={center} mountTick={mountTick} ownSolids={props.zone.id === HOLD_ZONE || props.zone.id === PASSAGE_ZONE} />
      <NPCMarkers npcs={ALL_NPCS.filter((n) => n.zone === props.zone.id && n.kind !== 'stall' && n.kind !== 'cabinet' && npcInWorld(n, props.defeated, props.flagsRef.current))} heights={props.heights} />
      {props.zone.id === PASSAGE_ZONE && <PassageScene isOwner={props.isOwner} />}
      <GuideTrail posRef={props.posRef} heightsRef={props.heightsRef} targetRef={props.guideTargetRef} />
      {props.isOwner && props.zone.id === 'moonwell-glade-gregory-s-home' && <HubGateMarkers heights={props.heights} />}
      {props.zone.realm === 'outside' && !props.zone.peaceful && <FiringRange zoneId={props.zone.id} firingRef={props.firingRef} adsRef={props.adsRef} weaponIdxRef={props.weaponIdxRef} gridRef={props.gridRef} recoilRef={props.recoilRef} bloomRef={props.bloomRef} posRef={props.posRef} hpRef={props.hpRef} hpMaxRef={props.hpMaxRef} shieldRef={props.shieldRef} shieldMaxRef={props.shieldMaxRef} rangeCfgRef={props.rangeCfgRef} ammoRef={props.ammoRef} reloadingRef={props.reloadingRef} pendingCastRef={props.pendingCastRef} castMultRef={props.castMultRef} senseRadiusRef={props.senseRadiusRef} tremorRef={props.tremorRef} resistRef={props.resistRef} birthRuneRef={props.birthRuneRef} infusionRef={props.infusionRef} fieldsRef={props.fieldsRef} conjuredRef={props.conjuredRef} holdRef={props.holdRef} statusRef={props.statusRef} onHeal={props.onHeal} onNeedReload={props.onNeedReload} onHit={props.onRangeHit} onShot={props.onRangeShot} onPlayerDamage={props.onPlayerDamage} onPlayerDown={props.onPlayerDown} onTrial={props.onTrial} onMatch={props.onMatch} />}
      {props.zone.realm === 'outside' && !props.zone.peaceful && props.zone.id !== HOLD_ZONE && <GunBenches />}
      {props.zone.realm === 'outside' && <ExitMarkers warps={props.zone.warps} heights={props.heights} />}
      {/* gates render in EVERY realm, not just outside: a gate is a named destination, and the
          Ather has doors worth naming too. ExitMarkers stays outside-only — it is a fallback for
          zones whose warps were never painted into the grid. */}
      {!!props.zone.gates?.length && <GateMarkers gates={props.zone.gates} heights={props.heights} isOwner={props.isOwner} posRef={props.posRef} />}
      <NodeMarkers nodes={props.nodes} heights={props.heights} editing={props.editing} channel={props.channel} zoneId={props.zone.id} />
      <BurrowMarkers spawners={props.spawners} heights={props.heights} editing={props.editing} defeated={props.defeated} ready={props.spawnerReady} gridRef={props.gridRef} keyFor={props.spawnerKeyFor} />
      {/* the plot ring: resting spirits wander the Home Plot, visible + greetable */}
      {PLOT_ZONES.has(props.zone.id) && !props.editing && props.restingSpirits.length > 0 && (
        <PlotSpirits spirits={props.restingSpirits} anchor={{ x: props.zone.playerStart?.tileX ?? 16, z: props.zone.playerStart?.tileY ?? 16 }} heights={props.heights} gridRef={props.gridRef} />
      )}
      {props.zone.id === WORLD_ZONE_ID ? <WorldFlora heights={props.heights} /> : <FloraDressing zoneId={props.zone.id} heights={props.heights} />}
      <StructureMarkers structures={structuresInZone} heights={props.heights} />
      <PlacementGhost placing={props.placing} posRef={props.posRef} heights={props.heights} gridRef={props.gridRef} placeTargetRef={props.placeTargetRef} structuresRef={props.structuresRef} zoneIdRef={props.zoneIdRef} />
      <Player posRef={props.posRef} gridRef={props.gridRef} heightsRef={props.heightsRef} zoneIdRef={props.zoneIdRef} editRef={props.editRef} onWarp={props.onWarp} battleRef={props.battleRef} partyLevelRef={props.partyLevelRef} onEncounter={props.onEncounter} joyRef={props.joyRef} talkingRef={props.talkingRef} hasPartyRef={props.hasPartyRef} onNearChange={props.onNearChange} defeatedRef={props.defeatedRef} flagsRef={props.flagsRef} harvestNodesRef={props.harvestNodesRef} onNearNode={props.onNearNode} stationsRef={props.structuresRef} onNearStation={props.onNearStation} eyeRef={props.eyeRef} jumpRef={props.jumpRef} slideRef={props.slideRef} speedMultRef={props.speedMultRef} weaponMoveRef={props.weaponMoveRef} dreamwalkRef={props.dreamwalkRef} conjuredRef={props.conjuredRef} holdRef={props.holdRef} bodyOut={props.bodyOut} />
      {/* presence: other players in this zone (socket lives in the page comp — shared with the panel) */}
      <RemotePlayers peers={props.mpPeers} hideAt={plotHide} />
      {props.companionColor && !props.editing && <Follower posRef={props.posRef} heightsRef={props.heightsRef} color={props.companionColor} />}
      {props.fishing && <FishTell posRef={props.posRef} heightsRef={props.heightsRef} bite={props.fishBite} />}
      <HarvestPop pop={props.harvestPop} />
      <CameraRig posRef={props.posRef} editFocusRef={props.editFocusRef} yawRef={props.yawRef} editRef={props.editRef} eyeRef={props.eyeRef} adsRef={props.adsRef} recoilRef={props.recoilRef} />
    </>
  )
})

// Floating touch joystick (bottom-left). Writes an analog {x,y} (camera-relative: y up = forward) into
// joyRef, which Player reads alongside WASD. Captures its own pointer so the camera never sees the drag.
function TouchJoystick({ joyRef, bottom = 30 }: { joyRef: React.RefObject<{ x: number; y: number }>; bottom?: number }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const active = useRef(false)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const R = 44 // max knob travel (px)
  const update = (cx: number, cy: number) => {
    const r = baseRef.current!.getBoundingClientRect()
    const ox = r.left + r.width / 2, oy = r.top + r.height / 2
    let dx = cx - ox, dy = cy - oy
    const len = Math.hypot(dx, dy)
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R }
    setKnob({ x: dx, y: dy })
    joyRef.current.x = dx / R
    joyRef.current.y = -dy / R // screen-down is forward-negative
  }
  const end = () => { active.current = false; setKnob({ x: 0, y: 0 }); joyRef.current.x = 0; joyRef.current.y = 0 }
  // If the stick unmounts mid-drag (an encounter fires, edit mode opens…), onPointerUp never
  // runs, so joyRef keeps its last vector and the player walks off in that direction once the
  // stick remounts. Zero it on unmount so movement always stops cleanly.
  useEffect(() => () => { joyRef.current.x = 0; joyRef.current.y = 0 }, [joyRef])
  return (
    <div
      ref={baseRef}
      onPointerDown={(e) => { e.stopPropagation(); active.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); update(e.clientX, e.clientY) }}
      onPointerMove={(e) => { if (active.current) { e.stopPropagation(); update(e.clientX, e.clientY) } }}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        position: 'fixed', bottom, left: 30, width: 116, height: 116, borderRadius: '50%', zIndex: 30,
        background: 'rgba(245,235,213,.35)', border: `3px solid ${H.inkSoft}`, touchAction: 'none', boxShadow: 'inset 0 2px 6px rgba(58,39,22,.35)',
      }}
    >
      <div style={{
        position: 'absolute', left: '50%', top: '50%', width: 54, height: 54, marginLeft: -27, marginTop: -27,
        borderRadius: '50%', transform: `translate(${knob.x}px, ${knob.y}px)`,
        background: `linear-gradient(180deg, ${H.paperHi}, ${H.paperLo})`, border: `3px solid ${H.ember}`, boxShadow: '0 3px 8px rgba(20,10,4,.45)', pointerEvents: 'none',
      }} />
    </div>
  )
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'floor', label: 'Land' }, { id: 'raise', label: 'Raise' }, { id: 'lower', label: 'Lower' },
  { id: 'wall', label: 'Cloud' }, { id: 'water', label: 'Water' }, { id: 'mist', label: 'Mist' },
  { id: 'warp', label: 'Warp' }, { id: 'void', label: 'Erase' },
]

// ── Account block — Google sign-in + the one-time username claim ──────────────
//
// Signing in is OPTIONAL and always will be: the whole game runs anonymously. What an
// account buys is a name nobody else can wear — the trusted arcade row today, friends and
// garden visits next. So this block never blocks; it sits above the party controls and
// offers.
// ── Region transition — phase B of the world pivot (Alex: "a loading screen of sorts to
// help the transition go smoother"). Plays when ARRIVING at a region map: fade to cloud,
// region title, land under cover, fade back in. What it actually covers is the one-frame
// hitch of mounting a 400x400 zone's instanced geometry — the grid itself is already in
// memory, so this is presentation, not loading. Interior doors stay instant on purpose:
// a title splash on Gregory's doorway would turn a door into a ceremony.
export type TransitPhase = 'out' | 'hold' | 'in'
const TRANSIT_OUT_MS = 320
const TRANSIT_HOLD_MS = 900
const TRANSIT_IN_MS = 650

function RegionTransition({ label, phase }: { label: string; phase: TransitPhase }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 42%, ${S.transit.washIn} 0%, ${S.transit.washMid} 45%, ${S.transit.washOut} 100%)`,
      opacity: phase === 'in' ? 0 : 1,
      transition: phase === 'in' ? `opacity ${TRANSIT_IN_MS}ms ease-in` : `opacity ${TRANSIT_OUT_MS}ms ease-out`,
    }}>
      <div style={{ textAlign: 'center', opacity: phase === 'out' ? 0 : 1, transition: 'opacity 380ms ease-out' }}>
        <div style={{ font: '800 11px ui-monospace, monospace', letterSpacing: '0.34em', color: S.transit.kicker, marginBottom: 10 }}>ENTERING</div>
        <div style={{ font: '800 30px ui-monospace, monospace', letterSpacing: '0.12em', color: S.transit.name, textShadow: `0 2px 14px ${S.transit.nameGlow}` }}>{label.toUpperCase()}</div>
        <div style={{ marginTop: 14, font: '700 15px ui-monospace, monospace', color: S.transit.mark, letterSpacing: '0.3em' }}>· ⛅ ·</div>
      </div>
    </div>
  )
}

// ── The Carved Hearth on the play-together panel (2026-09-23) ─────────────────────────────────
// Mounted inside a HearthFrame by the host (wood frame, parchment, a plaque, the close knob), so the
// body is ink on paper: the house's `hk-*` vocabulary, not the old teal-on-slate.
function PanelLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="hk-label text-[13px] hk-soft" style={style}>{children}</div>
}
const hearthInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: 7,
  border: `1px solid ${H.rule}`, background: H.paperHi, color: H.ink,
  ...hearthBody, fontWeight: 700, fontSize: 13, outline: 'none',
}
const hearthHint = 'text-[11px] leading-snug hk-faint mt-1.5'

function AccountBlock({ account }: { account: UseAccount }) {
  const { session, loading, signIn, signOut, claimName } = account
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const claim = async () => {
    setBusy(true); setError(null)
    const res = await claimName(draft.trim())
    if (!res.ok) setError(res.error ?? 'Could not claim that name')
    setBusy(false)
  }

  if (loading) return null

  return (
    <>
      <PanelLabel style={{ marginBottom: 4 }}>Account</PanelLabel>
      {!session && (
        <>
          <button onClick={signIn} className="hk-btn w-full py-1.5 text-[12px]">◆ Sign in with Google</button>
          <div className={hearthHint}>
            Optional. Claims a name only you can use, keeps your garden safe beyond this browser,
            and puts your real name on the arcade board.{' '}
            <a href="/privacy" target="_blank" rel="noopener" className="hk-sky underline">What we store</a>
          </div>
        </>
      )}
      {session && !session.username && (
        <>
          <input
            value={draft} placeholder="pick a name" maxLength={16} style={hearthInput}
            onChange={(e) => setDraft(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && draft.length >= 3 && !busy) claim() }}
          />
          <button
            onClick={claim} disabled={draft.length < 3 || busy}
            className={`hk-btn w-full py-1.5 mt-1.5 text-[12px] ${draft.length < 3 || busy ? 'hk-dim' : ''}`}
          >
            {busy ? 'Claiming...' : 'Claim this name'}
          </button>
          {error && <div className={`${hearthHint} hk-rust`}>{error}</div>}
        </>
      )}
      {session?.username && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span className="hk-title text-[15px] hk-ember">◆ {session.username}</span>
            <button onClick={signOut} className="hk-btn px-3 py-1 text-[12px]">Sign out</button>
          </div>
          <div className={hearthHint}>☁ Your garden follows this account — sign in anywhere and it comes with you.</div>
        </>
      )}
    </>
  )
}

// ── Play Together panel — party codes + invite links + who's here ─────────────
//
// A party is a shared code, not an account (see multiplayer.ts). This panel is the whole
// social UI: sign in, name yourself, make/join/leave a party, copy the invite link, see the
// roster.
function PlayTogetherPanel({ name, onName, party, onParty, peers, account, inPlot }: {
  name: string
  onName: (n: string) => void
  party: string | null
  onParty: (code: string | null) => void
  peers: React.RefObject<Map<string, RemotePlayer>>
  account: UseAccount
  /** True at a position inside a Home Plot: those peers read 'in their garden', not vanished. */
  inPlot?: (x: number, z: number) => boolean
}) {
  const roster = useRoster(peers)
  // The rows re-render on membership changes only; a peer stepping into their plot should
  // flip the label without waiting for a join/leave, so tick the labels at a low rate.
  const [, setLabelTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setLabelTick(v => v + 1), 2000); return () => clearInterval(t) }, [])
  const [nameDraft, setNameDraft] = useState(name)
  const [joinDraft, setJoinDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const commitName = () => {
    const clean = storeName(nameDraft)
    setNameDraft(clean)
    if (clean !== name) onName(clean)
  }
  const joinParty = () => {
    const code = sanitizePartyCode(joinDraft)
    if (!code) return
    setJoinDraft('')
    onParty(code)
  }
  const copyInvite = async () => {
    if (!party) return
    try { await navigator.clipboard.writeText(inviteUrl(party, '/shimmer/play3d')) } catch { /* clipboard denied — code is visible to copy by hand */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  return (
    // The plaque says "Play together" now (HearthFrame, at the host); the body is the parchment.
    <div className="px-3.5 pt-6 pb-3.5 hk-ink" style={{ ...hearthBody }}>
      <AccountBlock account={account} />

      <PanelLabel style={{ margin: '12px 0 4px' }}>Your name</PanelLabel>
      {account.session?.username ? (
        // A claimed name IS your display name — editing a second, local one here would only
        // create two answers to "who is that", which is the whole thing accounts fix.
        <div style={{ ...hearthInput, color: H.moss }}>{account.session.username}</div>
      ) : (
        <input
          value={nameDraft} maxLength={24} style={hearthInput}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
      )}

      <PanelLabel style={{ margin: '12px 0 4px' }}>Party</PanelLabel>
      {party ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="hk-ember tabular-nums font-extrabold text-[19px] tracking-[.18em]">{party}</span>
            <button onClick={() => onParty(null)} title="Leave party" className="hk-btn px-3 py-1 text-[12px]">Leave</button>
          </div>
          <button onClick={copyInvite} className={`hk-btn w-full py-1.5 text-[12px] ${copied ? 'hk-fill-moss' : ''}`}>
            {copied ? '✓ Link copied' : '⧉ Copy invite link'}
          </button>
          <div className={hearthHint}>
            Friends who open the link (or enter the code) land in your world.
          </div>
        </>
      ) : (
        <>
          <button onClick={() => onParty(newPartyCode())} className="hk-btn w-full py-1.5 text-[12px]">⚑ Start a party</button>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              value={joinDraft} placeholder="CODE" maxLength={12} style={{ ...hearthInput, letterSpacing: '0.14em' }}
              onChange={(e) => setJoinDraft(e.target.value.toUpperCase())}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') joinParty() }}
            />
            <button onClick={joinParty} className="hk-btn px-3.5 py-1 text-[12px]">Join</button>
          </div>
        </>
      )}

      <PanelLabel style={{ margin: '12px 0 4px' }}>In your world</PanelLabel>
      <div className="text-[12px] leading-[1.7] font-bold hk-ink">
        <div>{name} <span className="hk-soft font-semibold">(you)</span></div>
        {roster.map(p => (
          <div key={p.id}>{p.name}{inPlot?.(p.tx, p.tz) && <span className="hk-moss font-semibold"> · ⛅ in their garden</span>}</div>
        ))}
        {roster.length === 0 && <div className="hk-faint font-semibold italic">no one else yet</div>}
      </div>
    </div>
  )
}

export default function Shimmer3D() {
  const [zoneId, setZoneId] = useState(START_ZONE)
  // Where the player ACTUALLY loaded in, once the save has been read and migrated — which is not
  // known at mount, because `zoneId` starts at START_ZONE and the save resolves afterwards.
  // Anything that wants to announce the boot zone must wait for this, not for mount.
  const [bootZone, setBootZone] = useState<string | null>(null)
  const zone = getZone(ALL_ZONES, zoneId) ?? getZone(ALL_ZONES, START_ZONE)!

  // Edit mode lives up here because the resource board below is gated on it — see the deal.
  const [editMode, setEditMode] = useState(false)
  const editRef = useRef(false); editRef.current = editMode

  // Resource nodes for this zone — seeded from the authored ZONE_NODES layer; the editor
  // adds/removes them and the Save button writes them back to node-placements.ts.
  //
  // ★ `nodes` stays the AUTHORED layer, always, complete. The spawn board is derived from it
  // downstream and never replaces it. That separation is not tidiness: the editor's Save writes
  // this array straight back to node-placements.ts, so if `nodes` ever held the dealt subset, one
  // Save in play would permanently delete every authored location that happened not to be standing
  // that window — silently, and looking exactly like a successful save.
  const [nodes, setNodes] = useState<NodePlacement[]>(() => nodePlacementsFor(zone.id))
  const nodesRef = useRef(nodes); nodesRef.current = nodes
  useEffect(() => { setNodes(nodePlacementsFor(zone.id)) }, [zone.id])

  // ── The spawn board: which of those locations are actually standing this window. ──
  // Re-dealt on the world-reset boundary (every 32 real min, on midnight/noon) by the coarse tick.
  // In EDIT MODE the deal is bypassed entirely and the full authored layer renders, so you are
  // always placing against the real set rather than against one window's hand.
  const [boardWindow, setBoardWindow] = useState(() => zoneWindow(Date.now(), regionSpawnConfig(zoneId)).index)
  const boardWindowRef = useRef(boardWindow); boardWindowRef.current = boardWindow

  // ── Stripped slots: the Home Plot's one-way door. ──
  // The plot does not re-deal, so harvesting one of its nodes to depletion removes that slot for
  // good and the player has to go out for more. This is the ONLY thing about the board that has to
  // be remembered — the derived deal can reconstruct everything else from the clock, but it cannot
  // know what you already took. Keyed on `slotKey` (zone + skill + logical tile) so it survives
  // both a tier re-roll and a layout nudge in the editor. Loaded from the save alongside patrolBeaten.
  const [stripped, setStripped] = useState<ReadonlySet<string>>(() => new Set())
  const strippedRef = useRef<ReadonlySet<string>>(stripped); strippedRef.current = stripped

  const board = useMemo<DealtNode[]>(
    () => (editMode
      ? nodes.map(n => ({ ...n, key: slotKey(zone.id, n), leaving: false, arriving: false }))
      : dealtNodesFor(zone.id, boardWindow, stripped)),
    [editMode, nodes, zone.id, boardWindow, stripped],
  )
  const boardRef = useRef<DealtNode[]>(board); boardRef.current = board

  // Moglin-patrol spawners for this zone (world coords in world mode) — editor places/removes,
  // Save writes them to spawn-placements.ts, the runtime arms them while their hold stands.
  const [spawners, setSpawners] = useState<SpawnerPlacement[]>(() => spawnerPlacementsFor(zone.id))
  const spawnersRef = useRef(spawners); spawnersRef.current = spawners
  useEffect(() => { setSpawners(spawnerPlacementsFor(zone.id)) }, [zone.id])

  // ── Skilling: the forestry harvest loop. The real engine state (skills / mana / inventory) lives
  // in refs, persisted via the merge-save; small mirrors drive the HUD. Nodes get a runtime state
  // layer (harvestable ⇄ depleted+respawn timer) derived from the authored placements. ──
  const skillsRef = useRef<SkillSet>(createSkillSet())
  const manaRef = useRef<ManaPool>(createManaPool(1))
  const invRef = useRef<Inventory>(createInventory())
  // ── THE KEEPER'S HANDS CROSS THE DOOR (2026-09-16, play lane). One rig, one tune, both engines:
  //    `voxel3d/hands.ts` copies the camera pose so it mounts anywhere; this side feeds it its own
  //    verbs — a channel instead of a swing, the walker's `bodyOut`, a placeable in the palm. ────
  const hands = useMemo(() => createHands(), [])
  const bodyOut = useRef(newBodyOut())
  useEffect(() => { void hands.loadGlove(GLOVE_MODEL_URL); return () => hands.dispose() }, [hands])
  const [invSlots, setInvSlots] = useState<(ItemStack | null)[]>(() => invRef.current.slots)
  const [manaFrac, setManaFrac] = useState(1)
  const [forestry, setForestry] = useState(() => ({ level: 1, xp: 0, next: xpForSkillLevel(1), pulse: 0 }))
  const syncSkillHud = useCallback(() => {
    const f = skillsRef.current.forestry
    setForestry(p => ({ level: f.level, xp: f.xp, next: xpForSkillLevel(f.level), pulse: p.pulse + 1 }))
    setInvSlots([...invRef.current.slots])
    setManaFrac(manaRef.current.current / manaMax())
  }, [])
  // runtime nodes (with harvest state) rebuilt whenever the authored layer or zone changes
  const [runtimeNodes, setRuntimeNodes] = useState<ResourceNode[]>([])
  const runtimeNodesRef = useRef<ResourceNode[]>([]); runtimeNodesRef.current = runtimeNodes
  // Built from the BOARD, not the authored layer — a location that did not come up this window has
  // no runtime node at all, so it cannot be walked up to, harvested, or counted as near.
  useEffect(() => {
    setRuntimeNodes(board.map(n => ({
      ...createResourceNode(n.type, n.tileX, n.tileY, zone.id),
      leaving: n.leaving, arriving: n.arriving, slotKey: n.key,
    })))
  }, [board, zone.id])
  const [nearNode, setNearNode] = useState<ResourceNode | null>(null)
  const nearNodeRef = useRef<ResourceNode | null>(null); nearNodeRef.current = nearNode

  // Working copies — init ONCE per zone (not every render) so paint/resize edits persist.
  const gridRef = useRef<number[][]>([])
  const heightsRef = useRef<number[][]>([])
  const initedZone = useRef('')
  if (initedZone.current !== zone.id) {
    initedZone.current = zone.id
    // ★ cloneSparseGrid, not `.map(row => [...row])`. In the Wilds the zone grid is world-sized
    // but holds only the rows near the player (world/wilds-world.ts); a naive deep copy would
    // materialize the entire overland on the first frame and hand back exactly the memory
    // streaming exists to save. For every ordinary zone this IS the old deep copy.
    gridRef.current = cloneSparseGrid(zone.grid)
    heightsRef.current = zone.id === WORLD_ZONE_ID
      ? getGardenWorld().heights.map((row) => [...row]) // composed terrain — per-zone sculpts already blitted in
      : getHeightGrid(zone.id, zone.grid.length, zone.grid[0].length)
    // TEMP mantle/climb test scaffold — six wall blocks of rising height (1..6 tiers), 2 wide x 2 deep at
    // rows 10-11, spaced across the open grass. Approach each from row 9. Heights 1-3 mantle off a jump,
    // 4-5 need a wall-climb to reach the lip, 6 is beyond reach (confirms a too-tall wall just blocks).
    if (TEST_WALL_MOONWELL && zone.id === 'moonwell-glade') {
      const H = heightsRef.current
      for (let i = 0; i < 6; i++) {
        const h = i + 1, c0 = 2 + i * 3
        for (let r = 10; r <= 11; r++) for (let c = c0; c <= c0 + 1; c++) if (H[r] && c < H[r].length) H[r][c] = h
      }
    }
  }
  const zoneIdRef = useRef(zone.id); zoneIdRef.current = zone.id
  // ★ THE ONE ANSWER TO "how much mana can this keeper hold". Everywhere else in the walker it is the
  // mana skill's pool; in THE HOLD it is a FIXED pool, because mana is the clip there and a skill
  // level carried in from outside is exactly the out-of-run power the mode is built to refuse (Alex,
  // 2026-09-24). The birth rune's bonus still applies in both: what a keeper IS may lean the fight a
  // little; what they ground for may not. Called only from callbacks and effects, so reading refs
  // declared further down is safe.
  const manaMax = () => (zoneIdRef.current === HOLD_ZONE ? HOLD_TUNING.manaPool : getMaxPool(skillsRef.current.mana.level)) + affinityRef.current.manaBonus
  // Realm mirror for callbacks (bank reach, and anything else that keys on ather-vs-outside without
  // wanting `zone` as a dependency). Same flag that drives weapons-vs-spirits.
  const zoneRealmRef = useRef(zone.realm); zoneRealmRef.current = zone.realm
  // The district under the player's feet (world mode) — drives atmosphere mood + the HUD
  // name. Sampled at 0.8s; setState only on change, so play frames never re-render for it.
  const [districtZone, setDistrictZone] = useState(zone.id)
  useEffect(() => {
    const id = setInterval(() => {
      const p = posRef.current
      if (!p) return
      const d = logicalZoneAt(zoneIdRef.current, p.x, p.z)
      setDistrictZone(prev => (prev === d ? prev : d))
    }, 800)
    return () => clearInterval(id)
  }, [])
  const posRef = useRef<THREE.Vector3 | null>(null)
  if (!posRef.current) {
    const ps = zone.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current = new THREE.Vector3(ps.tileX, 0, ps.tileY)
  }
  const camYaw = useRef(0)
  // Live eye height — Player writes it (dips mid-slide), CameraRig reads it for the FPS eye position.
  const eyeRef = useRef(EYE_H)

  // ── Play Together: one socket for the whole page (scene avatars + DOM panel). Party/name
  // changes flow through the hook's effect deps = clean reconnect into the right instance. ──
  const [mpName, setMpName] = useState('')            // '' until mount — storedName touches localStorage
  const [mpNameReady, setMpNameReady] = useState(false)
  useEffect(() => { setMpName(storedName()); setMpNameReady(true) }, [])
  // The party is site-level state now (`@/lib/party`): the same group carries to the card
  // table, an invite link is consumed on whatever page it lands on, and leaving from the
  // account widget updates this panel without a reload.
  const { party: mpParty, ready: mpPartyReady, leave: leaveParty, join: joinParty } = useParty()
  const mpReady = mpNameReady && mpPartyReady   // gates the socket until identity is loaded
  // A signed-in player's claimed username outranks the local one — it is the name the rest
  // of the site (arcade board, friends, garden visits) already knows them by. Mirrored into
  // localStorage so the next boot shows it before the session fetch resolves.
  const account = useAccount()
  const accountRef = useRef(account); accountRef.current = account
  const accountName = account.session?.username ?? null
  useEffect(() => {
    if (!accountName) return
    storeName(accountName)
    setMpName(accountName)
  }, [accountName])
  const { peers: mpPeers } = useMultiplayer({
    enabled: mpReady, zoneId: zone.id, posRef, yawRef: camYaw, party: mpParty, playerName: mpName,
  })
  // Touch triggers for jump/slide (mobile). jumpRef = edge (button sets true, Player consumes+clears);
  // slideRef = held (true while the slide button is pressed). Keyboard uses Space/Shift directly.
  const jumpRef = useRef(false)
  const slideRef = useRef(false)
  // World map overlay (M / HUD button). Closed during battles — the arena owns the screen.
  const [showMap, setShowMap] = useState(false)
  // The mouse-handoff pair, reached through refs because the helpers are defined further down
  // (they need canvasElRef/isTouch) and this effect would otherwise touch them before init.
  const openCursorUIRef = useRef<() => void>(() => {})
  const closeCursorUIRef = useRef<() => void>(() => {})
  useEffect(() => {
    // M toggles the map, and the map is a cursor surface — same handoff as the station menus, or
    // it opens with the pointer still captured and its close button is unclickable.
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM' || curBattleRef.current) return
      setShowMap(v => { if (v) closeCursorUIRef.current(); else openCursorUIRef.current(); return !v })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // Pointer-lock state → drives the "click to look" nudge (shown only when first-person + uncaptured).
  const [pointerLocked, setPointerLocked] = useState(false)
  const [showLookHint, setShowLookHint] = useState(true)  // the "click to look" nudge fades a few seconds after spawn
  useEffect(() => { const t = setTimeout(() => setShowLookHint(false), 5000); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const onLock = () => {
      const locked = document.pointerLockElement instanceof Element
      setPointerLocked(locked)
      if (!locked) {  // Esc/unlock stops fire+ADS; drop the ADS speed penalty back to the hip mult
        firingRef.current = false; adsRef.current = false; setAds(false)
        weaponMoveRef.current = (!weaponDrawnRef.current || holsteredRef.current) ? 1 : WEAPONS[weaponIdxRef.current].hipMove
      }
    }
    document.addEventListener('pointerlockchange', onLock)
    return () => document.removeEventListener('pointerlockchange', onLock)
  }, [])
  const editFocusRef = useRef(new THREE.Vector3())
  const joyRef = useRef({ x: 0, y: 0 }) // touch-joystick analog input → Player movement

  // ── Party + save. ather.games saves are per-browser localStorage (no login); the 3D walker shares
  // Shimmer's slot (`ather:save:shimmer`) and MERGES on write so it never clobbers 2D-only fields. ──
  // saveRaw/loadSync (not save/load) — the save path dirty-checks its own JSON, so it must write a
  // string it already has rather than hand an object back to be stringified a second time.
  const { load, saveRaw, loadSync } = useCloudSave('shimmer')
  const wallet = useWallet()
  const partyRef = useRef<Spirit[] | null>(null)
  if (!partyRef.current) partyRef.current = [] // empty until Greg's starter handoff; load() may replace it
  const hasPartyRef = useRef(false); hasPartyRef.current = (partyRef.current?.length ?? 0) > 0
  // ★ partyRef holds every spirit you OWN — `inParty` decides which of them is your party. Those
  // were the same list until the Home Plot landed (the flag shipped on the Spirit type long ago and
  // was never once written or read here). Anything that means "who fights" or "how strong are you"
  // reads the ACTIVE set; anything that means "what do I have" reads the whole ref.
  const partyLevelRef = useRef(0)
  {
    const active = activeSpirits(partyRef.current)
    partyLevelRef.current = active.length
      ? Math.round(active.reduce((s, x) => s + x.level, 0) / active.length)
      : 5
  }
  // Mana'mal companions — earned at skill 15 (canon Companion-tier bond). The overworld follower
  // renders (see `Follower`); its perk is granted in the harvest/brew loops. No CARE loop yet, so
  // happiness is pinned at full and the perk runs at full strength.
  const beastsRef = useRef<ManaBeast[]>([])
  const activeBeastIdRef = useRef<string | null>(null)
  const [companionTick, setCompanionTick] = useState(0)  // HUD refresh when companions change
  // Gathering tools — basics (worn blade/spike/rinstick) always equipped; improved craftable ones
  // gather higher tiers without the under-tooled mana penalty. ensureBasicTools keeps a floor.
  const equippedToolsRef = useRef<EquippedTools>(ensureBasicTools({}))
  const [toolTick, setToolTick] = useState(0)  // HUD refresh when a tool breaks / changes
  const flagsRef = useRef<Record<string, boolean>>({})
  // ── THE FORK (`play3d/fork.ts`): where the guide trail points on the square. Recomputed on every
  // render of the host (zone changes and the two flags all re-render), read by the trail at 60Hz.
  const guideTargetRef = useRef<GuideTarget | null>(null)
  const battleRef = useRef(false)
  const talkingRef = useRef(false)
  const [hasStarter, setHasStarter] = useState(false) // reactive mirror of "party has ≥1 spirit" for HUD
  const [defeated, setDefeated] = useState<Record<string, boolean>>({}) // NPCs cleared from the world (by id)
  const defeatedRef = useRef(defeated); defeatedRef.current = defeated
  // Moglin patrols beaten THIS WINDOW — { logicalKey: windowIndex }, persisted in the save.
  // The window clock replaced the old 10-min real-time cooldown (engine/burrows.ts): a beaten
  // patrol is down for the rest of the current spawn-board window and presses again at the
  // next deal, same clock as every other living thing.
  const patrolBeatenRef = useRef<BeatenRecord>({})
  const patrolKeyRef = useRef<string | null>(null)
  const [battle, setBattle] = useState<{ allies: Spirit[]; enemies: Spirit[]; aiTier: AITier; zoneId: string; kind?: 'wild' | 'thistle' | 'vetch' | 'brack' | 'patrol'; title?: string; collared?: number[] } | null>(null)
  const curBattleRef = useRef(battle); curBattleRef.current = battle
  // Wild encounters play a brief "drawn to you" approach beat before the arena mounts (see below).
  const [approach, setApproach] = useState<{ enc: WildEncounter; battle: NonNullable<typeof battle> } | null>(null)
  // Post-win spoils reveal (wild fights): per-spirit XP/level breakdown + gold, shown before returning.
  type RewardRow = { name: string; element: Element; fromLevel: number; toLevel: number; xpGained: number; curXp: number; needXp: number; evolved: boolean; statsBefore: PartyStats; statsAfter: PartyStats; learned: string[] }
  const [rewards, setRewards] = useState<{ gold: number; rows: RewardRow[] } | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  /**
   * ── ★ THE EVOLUTION QUEUE (#262 slice ④, 2026-08-18) ────────────────────────────────────────
   * The spirit is evolved and PERSISTED the moment it is owed a form; this only holds what to show
   * once the screen is free. Splitting them is deliberate: an overlay is dismissable and a tab is
   * closable, and a form that only lands if the keeper watches the animation is a form that goes
   * missing. State first, ceremony second.
   */
  const [evolving, setEvolving] = useState<{ spirit: Spirit; evolution: PendingEvolution } | null>(null)
  const [nearNpc, setNearNpc] = useState<NPC3D | null>(null)
  const [dialogue, setDialogue] = useState<{ name: string; lines: string[]; speakers?: string[]; idx: number; grantAt?: number; onDone: () => void } | null>(null)
  const dialogueRef = useRef(dialogue); dialogueRef.current = dialogue
  useEffect(() => { talkingRef.current = !!dialogue }, [dialogue])
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 2600); return () => clearTimeout(t) }, [banner])

  // ── SAVING, AND WHY IT LOOKS LIKE THIS ────────────────────────────────────────────────────────
  // This used to be one `async` function that read the whole save back, parsed it, rebuilt it,
  // re-serialized it and wrote it — every 30 seconds and after every harvest. The `async` was
  // decorative: localStorage is synchronous, so all of it landed on the RENDER THREAD, and a save
  // big enough to matter turned into a dropped frame. That was a real hitch on top of the GPU one
  // (2026-07-23; see gfx.ts for the other half of that day).
  //
  // Three changes, in order of how much they bought:
  //   1. MIRROR the last-known save in memory, so a write no longer reads+parses the old one first.
  //      The read only happens once at mount, or after another tab writes (storage event).
  //   2. DIRTY-CHECK the serialized payload. Standing still costs a compare, not a write.
  //   3. DEFER to idle. The work is the same size; it just stops landing mid-frame.
  // Call sites are unchanged — persist() still means "save now-ish".

  /** Last full save object we know about. null = must re-read before merging (see storage event). */
  const saveMirrorRef = useRef<Record<string, unknown> | null>(null)
  /** Exact JSON of the last write, so an unchanged world skips the write entirely. */
  const lastWrittenRef = useRef<string>('')
  const persistIdleRef = useRef<number | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Surfaced in the ⚙ panel — proves the fix instead of asserting it. */
  const saveStatsRef = useRef<SaveStats>({ ms: 0, kb: 0, writes: 0, skipped: 0 })

  // Merge-save: preserve any 2D-only fields (furniture/crops/quests…) the 2D game may have written.
  // `replaceFlags` — New Game must not inherit the old run's story flags. Normal saves merge
  // (the 2D walker writes flags this save path doesn't know about); a fresh start replaces.
  const buildSave = useCallback((prev: Record<string, unknown>, opts?: { replaceFlags?: boolean }) => {
    return ({
      ...prev,
      spirits: spiritsToSave(partyRef.current ?? []),
      beasts: beastsToSave(beastsRef.current),
      activeBeastId: activeBeastIdRef.current,
      tools: toolsToSave(equippedToolsRef.current),
      flags: opts?.replaceFlags ? { ...flagsRef.current } : { ...(prev.flags ?? {}), ...flagsRef.current },
      patrolBeaten: { ...patrolBeatenRef.current },
      // The one part of the spawn board that cannot be derived: which Home Plot slots you have
      // already stripped. Everything else about the board falls out of the clock.
      strippedSlots: [...strippedRef.current],
      ...(() => {
        // World saves store the logical district + local tile, so LAYOUT_TWEAKS can move
        // districts without stranding saved players in the clouds. Corridor spots (no
        // district) fall back to world coords.
        const px = Math.round(posRef.current!.x), pz = Math.round(posRef.current!.z)
        const l = zoneIdRef.current === WORLD_ZONE_ID ? fromWorld(px, pz) : null
        return l ? { zoneId: l.zoneId, playerTileX: l.x, playerTileY: l.y } : { zoneId: zoneIdRef.current, playerTileX: px, playerTileY: pz }
      })(),
      skills: skillSetToSave(skillsRef.current),
      mana: manaToSave(manaRef.current),
      inventory: inventoryToSave(invRef.current),
      built: structuresRef.current,
      chests: Object.values(chestsRef.current).map(c => chestToSave(c)),
      bank: bankToSave(bankRef.current),
      ge: geToSave(geRef.current),
      plantedCrops: plantedCropsToSave(plantedCropsRef.current),
      buffs: pruneBuffs(buffsRef.current, Date.now()),
    })
  }, [])

  /**
   * Do the write, right now, on this thread. Everything expensive lives here so there is exactly
   * one copy of it — the deferred path just decides *when* to call this.
   */
  const flushPersist = useCallback((opts?: { replaceFlags?: boolean }) => {
    if (!posRef.current) return   // pre-spawn; nothing meaningful to save yet
    const t0 = performance.now()
    // Mirror miss (first write, or another tab wrote) — pay the read once to merge correctly.
    if (!saveMirrorRef.current) {
      const raw = loadSync()
      try { saveMirrorRef.current = raw ? JSON.parse(raw) as Record<string, unknown> : {} } catch { saveMirrorRef.current = {} }
      if (raw) lastWrittenRef.current = raw
    }
    const data = buildSave(saveMirrorRef.current, opts)
    const json = JSON.stringify(data)
    const s = saveStatsRef.current
    if (json === lastWrittenRef.current) {
      // Nothing changed since the last write — standing still costs a compare, not a disk write.
      s.skipped++
      s.ms = performance.now() - t0
      return
    }
    // Only record it as written if it actually landed. A quota failure that updated the cache
    // would make every later identical save skip as a no-op — saving would stop, silently.
    if (saveRaw(json)) {
      saveMirrorRef.current = data
      lastWrittenRef.current = json
      s.writes++
      s.kb = json.length / 1024
      // Cloud copy (stage 2 per-keeper plots): debounced, fire-and-forget, gated on a live
      // session so anonymous play never spends a request. Signed out → local-only, as ever.
      // ⚠ TWO CONDITIONS, NOT ONE (#682). A live session says "somebody is signed in"; it does NOT
      // say the blob in hand belongs to them. Before the slot was keyed, those came apart exactly
      // when it mattered — the session was B's and the bytes were A's — and this line uploaded one
      // keeper's garden into another's row. `saveOwner()` is who the slot we just wrote belongs to,
      // so requiring the two to agree is the difference between "signed in" and "this is mine".
      if (accountRef.current?.session && accountRef.current.session.user_id === saveOwner()) {
        pushCloudSave('shimmer', json)
      }
    }
    s.ms = performance.now() - t0
    logPerf('autosave', s.ms)   // surfaces in the lag log — a 30s save that lands mid-frame shows here
  }, [buildSave, loadSync, saveRaw])

  /**
   * The call every site uses. Coalesces into one idle flush instead of writing inline.
   *
   * `replaceFlags` (New Game) flushes IMMEDIATELY and deliberately: it is a destructive wipe, and
   * deferring it risks the old run's flags surviving a tab close. It is also the only caller that
   * passes options, so coalescing never has to merge conflicting intents.
   */
  const persist = useCallback((opts?: { replaceFlags?: boolean }) => {
    if (opts?.replaceFlags) {
      if (persistIdleRef.current !== null) { cancelIdleCallback?.(persistIdleRef.current); persistIdleRef.current = null }
      if (persistTimerRef.current) { clearTimeout(persistTimerRef.current); persistTimerRef.current = null }
      flushPersist(opts)
      return
    }
    if (persistIdleRef.current !== null || persistTimerRef.current) return   // already queued
    const run = () => { persistIdleRef.current = null; persistTimerRef.current = null; flushPersist() }
    // requestIdleCallback puts the work in the browser's slack instead of the middle of a frame.
    // The timeout is the safety net: under sustained load idle never arrives, and a save that
    // never runs is worse than one that costs a frame. Safari lacks rIC — fall back to a timer.
    if (typeof requestIdleCallback === 'function') {
      persistIdleRef.current = requestIdleCallback(run, { timeout: 2000 })
    } else {
      persistTimerRef.current = setTimeout(run, 250)
    }
  }, [flushPersist])
  // ★ THE STATION IS CHOSEN BY WALKING. First step into the Travelers Station flips the branch
  // flag; the trail stops pointing back at Greg's corner (fork.ts). Nothing is barred by it.
  const [forkTick, setForkTick] = useState(0)
  useEffect(() => {
    if (zoneId === 'travelers-station' && !flagsRef.current[STATION_FLAG]) {
      flagsRef.current[STATION_FLAG] = true
      setForkTick(t => t + 1)
      persist()
    }
  }, [zoneId, persist])
  // The fork, resolved on every host render (zone changes, Greg's flag via setDefeated, the
  // station via forkTick all re-render). The door spot is the tile the keeper steps INTO the Spirit
  // Corner from — the warp block's east face is (22-23, 48-49), so (23,49) is the threshold.
  const fork = forkFlags(flagsRef.current); void forkTick
  guideTargetRef.current = forkTarget(zoneId, fork, { x: GREG_SQUARE.tileX, z: GREG_SQUARE.tileY }, SPIRIT_CORNER_STEP)
  const forkChip = forkObjective(zoneId, fork)

  // Another tab wrote the same save — our mirror is stale, so drop it and re-read before the next
  // merge. Without this we would happily clobber whatever that tab saved with our own `...prev`.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === saveKey()) { saveMirrorRef.current = null; lastWrittenRef.current = '' }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Drop any queued save on unmount. The autosave effect flushes synchronously on its way out, so
  // the data is already safe — this just stops a stale idle callback firing into a dead component.
  useEffect(() => () => {
    if (persistIdleRef.current !== null) cancelIdleCallback?.(persistIdleRef.current)
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
  }, [])

  // Grant any skill-15 companion the player has newly earned (canon @15 unlock). Idempotent —
  // skips species already owned. Auto-selects the first companion as active. Returns the granted
  // species (for a banner), or null. Call after a level-up and once on load.
  const checkCompanionUnlocks = useCallback((): BeastSpecies | null => {
    let granted: BeastSpecies | null = null
    for (const sp of BEAST_SPECIES) {
      if (BEAST_DEFS[sp].unlockType !== 'skill') continue
      if (beastsRef.current.some(b => b.species === sp)) continue
      if (checkBeastUnlock(sp, skillsRef.current, flagsRef.current)) {
        const b = createBeast(sp, posRef.current?.x ?? 0, posRef.current?.z ?? 0)
        b.happiness = 100  // no care loop in the walker yet — keep the perk fully active
        beastsRef.current.push(b)
        if (!activeBeastIdRef.current) activeBeastIdRef.current = b.id
        granted = sp
      }
    }
    if (granted) setCompanionTick(t => t + 1)
    return granted
  }, [])

  // Load once on mount: restore party + zone + position, or bank the starter party on first visit.
  const loadedRef = useRef(false)
  // Start the lag log's long-task observer once, on mount. Cheap and idempotent (see perflog.ts).
  useEffect(() => { startPerfLog() }, [])

  // ── ★ BIRTH IS NOT DECIDED HERE ANY MORE (2026-08-07) ──────────────────────────────────────
  // This component used to open the ritual itself, off a synchronous localStorage read at mount.
  // The read was correct; what broke it was the async cloud fallback below RE-deciding a few
  // hundred ms later — a pulled save closed the modal and cleared the `birthPending` latch, so a
  // reset keeper ended up with a save, no rune and no latch, the one shape that never re-prompts.
  // It landed them in the world unborn, and because it hung on a fetch it flapped run to run.
  //
  // Both halves now live in `page.tsx`'s boot gate, which hydrates from the cloud FIRST and then
  // decides once against settled storage — so this component mounts only for a keeper who is
  // already born, and cannot revise that. The `birthOpen` state below is still real: it serves the
  // in-game New Game flow, which genuinely is a ritual over a running world.

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    let alive = true
    let landed: string = START_ZONE   // overwritten by whichever save branch places the player
    // Cloud fallback for a blank device is the boot gate's job now (hydrateFromCloud in page.tsx),
    // precisely so nothing down here can answer a question about identity. By this point
    // localStorage is the whole truth: a plain local read.
    load().then((data) => {
      if (!alive) return
      if (data?.skills) skillsRef.current = skillSetFromSave(data.skills)
      if (data?.mana) manaRef.current = manaFromSave(data.mana, skillsRef.current.mana.level)
      // Tools: restore, then guarantee every gathering skill has at least its basic (Greg's, infinite).
      equippedToolsRef.current = ensureBasicTools(toolsFromSave(data?.tools as Parameters<typeof toolsFromSave>[0]))
      if (data?.inventory) invRef.current = inventoryFromSave(data.inventory)
      if (Array.isArray(data?.built)) setStructures(data.built as PlacedStruct[])
      if (Array.isArray(data?.chests)) {
        const byId: Record<string, ChestStorage> = {}
        for (const cs of data.chests as ChestSave[]) { const c = chestFromSave(cs); byId[c.furnitureInstanceId] = c }
        chestsRef.current = byId
        setChestsTick(t => t + 1)
      }
      // Garden Bank restore. The bank save is authoritative once written; the one-time migration
      // off the old per-chest storage runs AFTER flags are restored (below), so its guard flag reads
      // the real saved value instead of the fresh-mount default.
      bankRef.current = bankFromSave(data?.bank as BankSave | undefined)
      if (data?.ge) geRef.current = geFromSave(data.ge as GESave)
      if (Array.isArray(data?.plantedCrops)) {
        plantedCropsRef.current = plantedCropsFromSave(data.plantedCrops as PlantedCrop[])
        setCropsTick(t => t + 1)
      }
      if (data?.buffs && typeof data.buffs === 'object') {
        buffsRef.current = pruneBuffs(data.buffs as ActiveBuffs, Date.now())
        setBuffHud(activeBuffList(buffsRef.current, Date.now()))
      }
      syncSkillHud()
      // Loaded OUTSIDE the flags block on purpose — the old `spawnerCds` sat inside it and so
      // silently failed to restore on any save that had no flags. Both fields are independent
      // of flags. (Legacy `spawnerCds` timestamps are simply dropped: worst case a patrol
      // beaten just before deploy is back one window early, once.)
      if (Array.isArray(data?.strippedSlots)) setStripped(new Set(data.strippedSlots as string[]))
      if (data?.patrolBeaten) patrolBeatenRef.current = data.patrolBeaten as BeatenRecord
      if (data?.flags) {
        flagsRef.current = data.flags
        // re-hide any NPC whose defeated-flag is already set in the save (e.g. Thistle, once freed)
        const cleared: Record<string, boolean> = {}
        for (const n of NPCS_3D) if (n.defeatedFlag && data.flags[n.defeatedFlag]) cleared[n.id] = true
        if (Object.keys(cleared).length) setDefeated(cleared)
      }
      // ── ONE-TIME Garden Bank migration off the old per-chest storage ──
      // Now that flags are restored, the guard reads the real saved value. On a pre-bank save, drain
      // every chest (placed AND carried in the satchel — carried chestData was unreachable until
      // re-placed, so banking it hands items back) into the pool exactly once. migrateChestsToBank is
      // force-deposit (over-cap tolerant) and STRICTLY non-lossy — see engine/bank.ts. persist() at
      // the end of load writes the result, so it runs at most once per save.
      if (!flagsRef.current.bankMigratedV1) {
        const grids: (ItemStack | null)[][] = []
        for (const c of Object.values(chestsRef.current)) grids.push(c.slots)
        for (const slot of invRef.current.slots) if (slot?.chestData) grids.push(slot.chestData.slots)
        const moved = migrateChestsToBank(bankRef.current, grids)
        // Empty the old stores so nothing is double-counted (the bank is the store now).
        for (const c of Object.values(chestsRef.current)) c.slots = c.slots.map(() => null)
        for (const slot of invRef.current.slots) if (slot?.chestData) slot.chestData.slots = slot.chestData.slots.map(() => null)
        flagsRef.current.bankMigratedV1 = true
        setBankTick(t => t + 1)
        if (moved > 0) setBanner(`✦ ${moved} materials moved into your Garden Bank`)
      }
      if (Array.isArray(data?.beasts)) {
        beastsRef.current = beastsFromSave(data.beasts as Parameters<typeof beastsFromSave>[0], posRef.current?.x ?? 0, posRef.current?.z ?? 0)
        // Data hygiene: drop any skill-companion the current skills no longer justify (a skill level
        // never drops, so this only removes bad/stale grants — never a legitimately earned one).
        beastsRef.current = beastsRef.current.filter(b => {
          const def = BEAST_DEFS[b.species]
          if (def.unlockType === 'skill' && def.unlockSkill && def.unlockLevel) {
            return skillsRef.current[def.unlockSkill].level >= def.unlockLevel
          }
          return true
        })
        activeBeastIdRef.current = beastsRef.current.some(b => b.id === (data.activeBeastId as string))
          ? (data.activeBeastId as string) : beastsRef.current[0]?.id ?? null
      }
      checkCompanionUnlocks()  // grant any companion already earned by a skill ≥15 in this save
      setCompanionTick(t => t + 1)
      if (data?.spirits?.length) {
        partyRef.current = spiritsFromSave(data.spirits)
        // Every save written before the Home Plot existed has all its spirits flagged active,
        // however many there were — the cap was only ever applied at fight time. Land them in a
        // legal shape on load so the roster and the battlefield finally agree.
        normalizeRoster(partyRef.current, MAX_PARTY)
        setHasStarter(true)
      }

      // ── ★★★ WHERE A KEEPER STANDS IS NOT A FACT ABOUT THEIR PARTY (2026-08-27, play lane) ─────
      // This whole resolution used to live INSIDE the `data.spirits.length` block above, so a
      // keeper who owns no spirit had no position restored and no zone restored — every reload put
      // them back at `START_ZONE` at the spawn tile, however far they had walked. Not a crossing
      // bug: it is every spirit-less keeper, on every load, and Greg's gift is the only way to get
      // a first spirit, so it is precisely the newest keepers who had it.
      //
      // ⚠⚠ FOUND BY THE CROSSING, BECAUSE THE CROSSING IS WHERE IT STOPS LOOKING COSMETIC. A
      // staged arrival placed the keeper in Rune Hold correctly and the save recorded `rune-hold`
      // 48,50 — and the NEXT load threw it away and stood them in the Home Plot. That is the
      // contract's Rule 1 (`engine/crossing.ts`) broken one load late: *"a keeper has a real
      // position in BOTH and should return to the one they left."* A crossing that undoes itself on
      // reload is worse than one that never fired, because the player watched it work.
      //
      // ★ MEASURED, NOT REASONED. Against the BUILT artifact on :3200 with a fresh profile: born →
      // stage the one-shot → reload lands `zoneId: rune-hold, 48,50, pending cleared` → reload
      // again → `r-home-plot, 89,68`. The arrival block below was already written outside the
      // spirits block for exactly this reason, and its comment says so; the restore it has to beat
      // was still inside it, so half the precedence chain could not run at all.
      if (data) {
        if (typeof data.playerTileX === 'number' && typeof data.playerTileY === 'number') {
          posRef.current!.set(data.playerTileX, posRef.current!.y, data.playerTileY)
        }
        // ── The world pivot's save migration: a save standing in an absorbed legacy zone
        // lands at the SAME spot of its region canvas (sources table). One-way; the legacy
        // world stays reachable via ?zone= until cutover. Unmapped spots (route saves,
        // corridor world-coords) keep their legacy behavior below.
        const mig = data.zoneId ? migrateLegacyPosition(data.zoneId, data.playerTileX ?? 1, data.playerTileY ?? 1) : null
        if (mig) {
          posRef.current!.set(mig.x, posRef.current!.y, mig.y)
          setZoneId(mig.zoneId); landed = mig.zoneId
        } else if (data.zoneId && isStitched(data.zoneId)) {
          // logical save (or a pre-continent save) → its composed-world spot
          const wp = getGardenWorld().toWorld(data.zoneId, data.playerTileX ?? 1, data.playerTileY ?? 1)
          if (wp) posRef.current!.set(wp.x, posRef.current!.y, wp.y)
          setZoneId(WORLD_ZONE_ID); landed = WORLD_ZONE_ID
        } else if (data.zoneId && getZone(ALL_ZONES, data.zoneId)) { setZoneId(data.zoneId); landed = data.zoneId }
      }

      // ── ★★★ THE ATHER CROSSING ARRIVES HERE (2026-08-27) ──────────────────────────────────
      // `engine/crossing.ts` has had `consumeArrival` and a full oracle since 08-24 and NO caller
      // on either side, so a keeper stepping into the Rune Hold gate had nowhere to arrive. This is
      // the receiving half. The departing half is still refused — see `voxel3d/crossing-out.ts`;
      // it needs a landing painted AND an anchor tile, and the anchor is Alex's map knowledge, not
      // something to derive. Until then nothing stages anything, `consumeArrival` returns null on
      // every load, and this block is inert. That is the intended dormant state, not a gap.
      //
      // ⚠⚠ IT RUNS AFTER THE SAVE BRANCHES AND OVERRIDES THEM, WHICH IS THE PRECEDENCE THE
      // CONTRACT NAMES: staged beats saved beats landing. It also sits OUTSIDE the `data.spirits`
      // block above on purpose — those branches never run for a save with no spirits, and an
      // arrival must not depend on whether the keeper happens to own one.
      //
      // ⚠ AND IT IS THE PLAIN-ZONE BRANCH, MEASURED NOT ASSUMED. `rune-hold` is neither stitched
      // (`isStitched('rune-hold')` is false — it is not in SURFACE_ZONES) nor legacy-migrated
      // (`migrateLegacyPosition('rune-hold', …)` returns null at every tile tried). Routing an
      // arrival through `toWorld` would return null and the arrival would be silently eaten while
      // the keeper stood wherever their save left them — a crossing that looks like it did nothing.
      //
      // ★ `arrivalFor` is deliberately NOT used here even though it models exactly this precedence.
      // Its `saved` argument is a `TilePos`, and this file's saved position is not one — it resolves
      // through three branches (legacy migration, the stitched composed world, a plain zone). Making
      // it fit would mean restating that resolution, which is the hand-kept mirror this repo keeps
      // paying for. The helper stays honest about the simpler world it models; the precedence is
      // expressed by running last.
      const staged = consumeArrival(localStorage)
      if (staged) {
        // A staged zone that no longer exists is a dropped arrival, never a crash and never (0,0)
        // — the contract bans that coordinate by name because it is legal and meaningless.
        if (getZone(ALL_ZONES, staged.zone)) {
          posRef.current!.set(staged.x, posRef.current!.y, staged.y)
          setZoneId(staged.zone)
          landed = staged.zone
          // ★ AND FACING AWAY FROM THE DOOR (Alex, 2026-09-16: "when exiting a gate it spawns us
          // facing away from the entry point"). The tile is beside a door; the heading is
          // door → tile, so the square is ahead and the door one step behind. Same YXZ convention
          // as the warps' `DIR_YAW`: looking along (-sin yaw, -cos yaw), so facing (dx, dy) is
          // `atan2(-dx, -dy)` — "down" (+y) is π, which is what a door on the north side gives.
          // ⚠ THE NEAREST DOOR, NOT THE LANDING: two doors let out on this square now (the landing
          // and Greg's shopfront), and the arrival tile is beside whichever one was used.
          const g = nearestGate(staged.zone, staged.x, staged.y)
          if (g) {
            const { w, h } = gateFootprint(g)
            const dx = staged.x + 0.5 - (g.x + w / 2), dy = staged.y + 0.5 - (g.y + h / 2)
            if (Math.hypot(dx, dy) > 0.1) camYaw.current = Math.atan2(-dx, -dy)
          }
        }
      }
      // ★ THE LOAD-PATH STARTER GRANT IS GONE, ON PURPOSE. It used to backfill stations and mats
      // into any save missing the flag. That made sense when the kit was a pile of materials; it
      // does not now that the bag is Greg's gift and its centrepiece is a Mana Seed. Left in place
      // across the V2→V3 rename it would have posted a seed into EVERY existing save on load —
      // handing a first spirit to keepers who already have one, without Greg ever speaking.
      // There is exactly one way to receive the bag now, and it is meeting him.
      // One-time mend-potion grant for saves that predate HP/shield (starter kit already has them,
      // but its flag is burned on returning saves) — same idempotent-flag pattern.
      if (!flagsRef.current.mendKitV1) {
        addItems(invRef.current, 'shimmer_salve', 2); addItems(invRef.current, 'crystal_elixir', 1)
        flagsRef.current.mendKitV1 = true
        setInvSlots([...invRef.current.slots])
        persist()
      }
      // Announce the zone the player actually landed in. Defaulting to START_ZONE covers the
      // fresh-save path, where no branch above runs and the boot really is the Home Plot.
      if (alive) setBootZone(landed)
    }).catch(() => { if (alive) setBootZone(START_ZONE) })
    return () => { alive = false }
  }, [load, persist])

  // Auto-save every 30s + on page close (the walker can be left mid-stride).
  //
  // The tick goes through persist() so it lands in idle slack. The LEAVE paths call flushPersist
  // directly and synchronously — a deferred save on beforeunload never runs, the page is already
  // gone. `pagehide` is there because mobile Safari/Chrome often background-kill a tab without
  // ever firing beforeunload, which is exactly the phone-in-pocket case.
  useEffect(() => {
    const id = setInterval(() => { persist() }, 30_000)
    const onLeave = () => flushPersist()
    window.addEventListener('beforeunload', onLeave)
    window.addEventListener('pagehide', onLeave)
    return () => {
      clearInterval(id)
      window.removeEventListener('beforeunload', onLeave)
      window.removeEventListener('pagehide', onLeave)
      flushPersist()
    }
  }, [persist, flushPersist])

  // Mana regen + node respawn — a coarse tick (the real engine runs 15 TPS; 2 Hz is plenty for the
  // vial and the minutes-long respawn timers).
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      const max = manaMax()
      if (manaRef.current.current < max) {
        // ★ THE COST IS PER-MOVE, NOT PER-TIER (RULED 2026-08-26, Alex — world-wide). The blanket law
        // "holding any passive pauses recovery" is retired; a passive is a layer you wear. Only the
        // shell pair (Barrier/Bulwark) drains, because canon writes that drain on the page.
        //
        // ⚠ ONE MULTIPLIER, NOT AN ABSOLUTE. This was a ternary over an absolute `manaPerSec` that
        // stood IN for normal regen, so once nothing paused, Moisture Gathering's trickle became
        // unreachable — a number that shipped, read correctly, and could never apply. It was also
        // 60× mis-scaled between the two worlds the moment it did apply. See `CastSpec.regenMult`.
        const stance = stanceRef.current
        // THE HOLD: a fixed DRIP (Alex: "not enough but a drip") — no potion buff rides on it, because
        // nothing was carried in; a held stance still shapes it, the way it shapes regen everywhere
        const perSec = (zoneIdRef.current === HOLD_ZONE ? HOLD_TUNING.manaDrip : MANA_REGEN_PER_SEC * manaRegenMult(buffsRef.current, now)) * (stance?.regenMult ?? 1)
        if (perSec > 0) {
          manaRef.current.current = Math.min(max, manaRef.current.current + perSec * 0.5)  // 0.5s tick
          setManaFrac(manaRef.current.current / max)
        }
      }
      // potion buffs — refresh the HUD chips + the frame-loop mirrors (speed/dreamwalk). A live Static
      // Burst surge and a held stance both fold in here, so speed has ONE derivation.
      const surge = surgeRef.current
      const surgeMult = performance.now() < surge.until ? surge.mult : 1
      speedMultRef.current = speedMult(buffsRef.current, now) * affinityRef.current.speedMult * surgeMult * stanceMoveRef.current
      dreamwalkRef.current = suppressEncounters(buffsRef.current, now)
      setBuffHud(prev => {
        const next = activeBuffList(buffsRef.current, now)
        // only re-render when the visible list actually changes (ids or the shown second)
        const key = (l: typeof next) => l.map(b => `${b.id}:${Math.ceil(b.remainMs / 1000)}`).join('|')
        return key(prev) === key(next) ? prev : next
      })
      // Spirits knit themselves back together as you walk — slowly. This is the anti-softlock
      // valve, NOT a strategy: at REGEN_FRAC_PER_MIN a full bar takes ~50 minutes, so brewing is
      // always the better answer. Skipped mid-fight, where the arena owns the HP and the
      // write-back would overwrite this anyway.
      if (!battleRef.current && partyRef.current?.length) tickRecovery(partyRef.current, 0.5)
      setWoundHud(prev => {
        // Active party only — a spirit resting at home is not a problem you need nagging about,
        // and the chips are a "deal with this" surface, not a roster.
        const hurt = activeSpirits(partyRef.current ?? [])
          .filter(sp => hpFracOf(sp) < 1)
          .map(sp => ({ name: sp.name, frac: hpFracOf(sp), downed: isDowned(sp) }))
        // The trickle moves every tick, so compare at display resolution or this re-renders at 2 Hz forever.
        const key = (l: typeof hurt) => l.map(h => `${h.name}:${Math.round(h.frac * 100)}`).join('|')
        return key(prev) === key(hurt) ? prev : hurt
      })
      let respawned = false
      for (const n of runtimeNodesRef.current) if (tickNodeRespawn(n)) respawned = true
      if (respawned) setRuntimeNodes([...runtimeNodesRef.current])
      // The world turns over. Everything else about the board is derived, so this is the only line
      // that has to notice — bump the window and the deal re-runs.
      const win = zoneWindow(now, regionSpawnConfig(zoneIdRef.current)).index
      if (win !== boardWindowRef.current) { boardWindowRef.current = win; setBoardWindow(win) }
      tickPriceDrift(geRef.current) // Exchange prices drift toward base every 30s (no-op otherwise)
    }, 500)
    return () => clearInterval(id)
  }, [])

  // ── Channelled harvest: link to a node, the mana-powered tool auto-chops (its HP bar drains) until
  // done — but the link breaks if you walk out of range or run dry of mana. Toggle on/off with 🪓/E. ──
  const CHANNEL_RANGE = 1.8
  const [harvestToast, setHarvestToast] = useState<string | null>(null)
  // Re-keys the say line so a new sentence replays its slide (the Ather's `toast.at`).
  const sayAt = useMemo(() => Date.now(), [banner, harvestToast])
  const [harvestPop, setHarvestPop] = useState<{ x: number; y: number; z: number; glyph: string; key: number } | null>(null) // transient node-pop
  const popKeyRef = useRef(0)
  useEffect(() => { if (!harvestToast) return; const t = setTimeout(() => setHarvestToast(null), 2400); return () => clearTimeout(t) }, [harvestToast])
  useEffect(() => { if (!harvestPop) return; const t = setTimeout(() => setHarvestPop(null), 850); return () => clearTimeout(t) }, [harvestPop])
  const channelRef = useRef<{ node: ResourceNode; progress: number; durSec: number; manaCost: number } | null>(null)
  const chopClockRef = useRef(0) // accumulates dt to space out the chop/mine tick sound
  const [channel, setChannel] = useState<{ nodeId: string; label: string; hp: number; family: string } | null>(null)

  // ★ A re-deal replaces every runtime node object, and the harvest link holds one by REFERENCE.
  // Left alone, a channel that spans a boundary would keep chopping an orphan: mana would drain,
  // the bar would fill, and the drop would land on a tree that is no longer in the world. So on
  // every board change the link is re-pointed to the new object of the same id (ids are stable —
  // type + tile + zone), keeping the progress you had, or cut cleanly if the node did not survive.
  // The 3-minute fade is what makes the second case fair rather than a snatch.
  // Keyed on `runtimeNodes`, NOT on `board`: the rebuild is itself a state update, so an effect
  // watching the board would still be reading the previous frame's node objects and re-point the
  // link to the very orphans it is meant to catch.
  useEffect(() => {
    const ch = channelRef.current
    if (!ch) return
    const still = runtimeNodes.find(n => n.id === ch.node.id)
    if (still) { ch.node = still; return }
    channelRef.current = null
    setChannel(null)
    // Silent when the list changed because you left the zone — that is not the world moving on.
    if (ch.node.zoneId === zoneIdRef.current) setHarvestToast('The shimmer moved on')
  }, [runtimeNodes])
  // Rinning: casting LOCKS the walker to the node (reuse battleRef as the movement freeze); a `!`
  // pops over the mote's head at the bite — strike (E/tap) during it to hook, early/late = it slips.
  const fishRef = useRef<{ node: ResourceNode; manaCost: number; cast: RinCast; bitten: boolean } | null>(null)
  const [fish, setFish] = useState<{ label: string; bite: boolean } | null>(null) // drives HUD + the world-space `!`
  const fishBiteRef = useRef(false); fishBiteRef.current = !!fish?.bite
  const hookFishRef = useRef<() => void>(() => {}) // set below (needs grantHarvest, defined later)
  const [menuOpen, setMenuOpen] = useState(false)     // ☰ — edit terrain / new game
  const [runeDevOpen, setRuneDevOpen] = useState(false)  // owner-only: swap birth rune live to test all archetypes
  const [skillsOpen, setSkillsOpen] = useState(false) // skills panel
  const [mpOpen, setMpOpen] = useState(false)         // 👥 — play together (party / invite)
  const [gfxOpen, setGfxOpen] = useState(false)       // ⚙ — graphics quality + frame readout
  const [bookOpen, setBookOpen] = useState(false)     // ✦ — the move book (moves indexed by your rune)

  // ── Graphics quality. Read once from localStorage (lazy init, so SSR never touches it), and
  // every change is persisted so the player rules once, not every session.
  const [gfx, setGfxState] = useState<GfxSettings>(loadGfx)
  const setGfx = useCallback((next: GfxSettings) => { setGfxState(next); storeGfx(next) }, [])
  const frameStats = useRef<FrameStats>({
    fps: 0, worstMs: 0, spikes: 0, dpr: 1,
    geometries: 0, textures: 0, programs: 0, calls: 0, triangles: 0, heapMB: 0, base: null,
  })

  // Live resolution scale. Starts at the ceiling; PerformanceMonitor walks it down toward
  // DPR_FLOOR while the GPU is behind and back up when it catches up — but ONLY when the player
  // has asked for adaptive. With it off, dpr is pinned so the look is exactly what they chose.
  const [dpr, setDpr] = useState(1)
  useEffect(() => { setDpr(dprCeiling()) }, [])
  useEffect(() => { if (!gfx.adaptiveDpr) setDpr(dprCeiling()) }, [gfx.adaptiveDpr])
  const toggleChannel = useCallback(() => {
    if (fishRef.current) { hookFishRef.current(); return }   // fishing: this press is the strike (hook or slip)
    if (channelRef.current) { channelRef.current = null; setChannel(null); return }   // unlink
    const node = nearNodeRef.current
    if (!node || node.state !== 'harvestable') return
    // Tool-gate: you gather with the skill's tool (Greg gives you a basic one, so this always holds).
    const skillId = getNodeSkill(node.type)
    const tool = getEquippedTool(equippedToolsRef.current, skillId)
    if (!tool) { setHarvestToast(`Need a ${SKILL_META[skillId].name.toLowerCase()} tool`); return }
    const toolDef = TOOL_DEFS[tool.toolId]
    // Soft under-tooled penalty: pushing a tool above its tier costs extra mana (double per tier over).
    const overTier = Math.max(0, nodeTier(node.type) - (toolDef?.tier ?? 0))
    const manaCost = nodeManaCost(node.type) * (1 + overTier)
    if (manaRef.current.current < manaCost) {
      setHarvestToast(overTier > 0 ? `${toolDef?.name} strains here — need ${manaCost} mana` : `Not enough mana (need ${manaCost})`)
      return
    }
    // Rinning is a cast-and-catch, not a hold-to-channel — cast locks you to the node and waits
    // for the bite (see the fishing driver below). A catch drains mana + grants drops; a miss is free.
    if (skillId === 'rinning') {
      // Angler's Eye (glowfin_brew): bites land sooner + the `!` window stays up longer
      const cast = newRinCast(performance.now(), Math.random)
      const tune = rinTune(buffsRef.current, Date.now())
      cast.biteMs *= tune.bite; cast.windowMs *= tune.window
      fishRef.current = { node, manaCost, cast, bitten: false }
      battleRef.current = true // lock the walker to the node while the line's out
      setFish({ label: prettyItem(node.type), bite: false })
      return
    }
    // A gathering_speed companion + the tool's speedBonus both shorten the channel.
    // (No species grants gathering_speed today — reserved for a future admin/endgame beast.)
    const speedBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current) ?? null
    const durSec = nodeChannelSec(node.type) * (toolDef?.speedBonus ?? 1) / (1 + getSpeedBonus(speedBeast))
    channelRef.current = { node, progress: 0, durSec, manaCost }
    chopClockRef.current = 0.42 // fire the first thunk on the next tick (immediate feedback)
    setChannel({ nodeId: node.id, label: prettyItem(node.type), hp: 1, family: skillId })
  }, [])

  // ── Build placement: double-tap a placeable → ghost on the tile in front → rotate → confirm/cancel ──
  const [placing, setPlacing] = useState<{ itemId: string; facing: number } | null>(null)
  const placingRef = useRef(placing); placingRef.current = placing
  const selSlotRef = useRef(0)  // live hotbar slot (the hud bar drives it via onSelect / 1-8 / wheel); right-click uses this item
  const placeTargetRef = useRef<{ x: number; y: number } | null>(null)     // front tile, updated by the ghost
  const [structures, setStructures] = useState<PlacedStruct[]>([])
  const structuresRef = useRef(structures); structuresRef.current = structures
  // World-VIEW mirror of the placed structures — collision, the interact prompt, and placement
  // checks all compare against the PLAYER's coordinate space, which on the continent is world
  // coords, not the logical district coords structures are SAVED in. structuresRef stays logical
  // (that's what persists); this ref is what the Scene (Player + PlacementGhost) reads. Without
  // it, stations placed in a district were ghosts in world mode: walk-through + no menu.
  const structuresViewRef = useRef<PlacedStruct[]>([])
  structuresViewRef.current = structuresView(structures, zoneId)
  const [nearStation, setNearStation] = useState<PlacedStruct | null>(null)
  const nearStationRef = useRef<PlacedStruct | null>(null); nearStationRef.current = nearStation
  const [openMenu, setOpenMenu] = useState<{ kind: StationKind; struct: PlacedStruct } | null>(null)
  // Ref mirror so the interact-key handler can ask "is a menu open?" without taking openMenu as a
  // dependency and re-binding the listener every time a menu opens or closes.
  const openMenuRef = useRef(false); openMenuRef.current = !!openMenu

  // ── Chest storage (keyed by stationInstanceId) · shared Exchange market · planted crops ──
  // Save fields (`chests`/`ge`/`plantedCrops`) are the SAME ones the 2D game already writes
  // (page.tsx) — reusing the exact names + engine types keeps both walkers' economies in sync
  // instead of forking a parallel, orphaned save shape.
  const chestsRef = useRef<Record<string, ChestStorage>>({})
  const [chestsTick, setChestsTick] = useState(0) // bump to re-render the open chest menu after a transfer

  // ── The Garden Bank — one pooled material store for the homeplot (all Ather zones; not the
  // Crucible). Replaces per-chest storage: placed chests contribute capacity, gathered materials
  // pool here, and stations draw satchel-first then bank. See engine/bank.ts. chestsRef stays for
  // the one-time migration and for any dungeon-chest decoration, but is no longer the store.
  const bankRef = useRef<BankState>(createBank())
  const [bankTick, setBankTick] = useState(0)   // bump to re-render the open bank panel
  // Capacity from PLACED chests, garden-wide (structuresRef holds every zone's placements).
  const bankCapacityNow = useCallback(() => {
    const chestIds = (structuresRef.current ?? []).filter(s => isChestFurniture(s.itemId)).map(s => s.itemId)
    return bankCapacity(chestIds)
  }, [])
  // The bank a station action should see RIGHT NOW: the real pool on your land, null in the Crucible
  // (realm 'outside'), where only the satchel counts. One flag, same one that gates weapons/spirits.
  const bankForZone = useCallback((): BankState | null => {
    return bankReachable(zoneRealmRef.current) ? bankRef.current : null
  }, [])
  const geRef = useRef<GEMarketState>(createGEState())
  const plantedCropsRef = useRef<PlantedCrop[]>([])
  const [cropsTick, setCropsTick] = useState(0) // bump to re-render the open planter menu (plant/harvest)

  // Timed potion buffs (engine/potion-effects) — the ref is truth, the HUD list re-renders on the
  // 0.5s coarse tick. speedMultRef/dreamwalkRef are plain-value mirrors updated on that same tick
  // so the Player frame loop reads a number, not the buff table.
  const buffsRef = useRef<ActiveBuffs>({})
  const [buffHud, setBuffHud] = useState<ReturnType<typeof activeBuffList>>([])
  // Wounded-party readout. Only populated while something is actually hurt, so a healthy party
  // costs no HUD space — and a wound announces itself the moment you walk out of a fight.
  const [woundHud, setWoundHud] = useState<{ name: string; frac: number; downed: boolean }[]>([])
  const speedMultRef = useRef(1)
  const weaponMoveRef = useRef(1)   // weapon-state ground-speed mult (Player reads): 1 holstered / hipMove drawn / adsMove aiming
  const dreamwalkRef = useRef(false)

  // Double-tap use: drink a mana potion, or enter placement for a placeable.
  const useItem = useCallback((itemId?: string) => {
    if (!itemId) return
    // ★ THE HOLD: a keeper walks in carrying NOTHING (Alex, 2026-09-24). The inventory is not emptied
    // — the save runs mid-run, and an emptied bag saved on a closed tab would be a real loss — it is
    // simply out of reach: the hotbar draws empty and no item can be used until the keeper leaves.
    if (zoneIdRef.current === HOLD_ZONE) return
    if (itemId in PLACEABLES) {
      if (countItem(invRef.current, itemId) < 1) return
      battleRef.current = true                       // freeze the walker while aiming the ghost
      setPlacing({ itemId, facing: 0 })
      return
    }
    // mend potions — the ONLY way HP/shield come back (no auto-regen in outside-Ather combat)
    const heal = HEAL_POTIONS[itemId]
    if (heal) {
      if (countItem(invRef.current, itemId) < 1) return
      // Inside the Ather the salve goes to a SPIRIT, not the Keeper — arena wounds persist now, so
      // this is the loop: gather → brew → put your party back together → fight again.
      if (!weaponDrawnRef.current) {
        const mend = SPIRIT_MEND_POTIONS[itemId]
        if (!mend) { setHarvestToast('Nothing to mend inside the Ather'); return }
        const party = partyRef.current ?? []
        const target = pickMendTarget(party)
        if (!target) { setHarvestToast('Your spirits are unhurt'); return }
        const wasDowned = isDowned(target)
        // Revive first (a body on its feet beats a topped-up one), then spend the rest of the salve
        // mending it — otherwise a downed spirit gets back up at a sliver and the item feels wasted.
        if (wasDowned) reviveSpirit(target)
        const healed = healSpirit(target, mend)
        if (!wasDowned && healed <= 0) { setHarvestToast(`${target.name} is unhurt`); return }
        removeItems(invRef.current, itemId, 1)
        setInvSlots([...invRef.current.slots])
        setHarvestToast(wasDowned
          ? `${target.name} is back on its feet · ${currentHpOf(target)}/${maxHpOf(target)}`
          : `${target.name} mended · ${currentHpOf(target)}/${maxHpOf(target)}`)
        persist()
        return
      }
      const needHp = (heal.hp ?? 0) > 0 && hpRef.current < hpMaxRef.current
      const needSh = (heal.sh ?? 0) > 0 && shieldRef.current < shieldMaxRef.current
      if (!needHp && !needSh) { setHarvestToast(heal.hp ? 'HP already full' : 'Shield already full'); return }
      removeItems(invRef.current, itemId, 1)
      if (heal.hp) hpRef.current = Math.min(hpMaxRef.current, hpRef.current + heal.hp)
      if (heal.sh) shieldRef.current = Math.min(shieldMaxRef.current, shieldRef.current + heal.sh)
      setInvSlots([...invRef.current.slots])
      setHarvestToast(`${prettyItem(itemId)} · ${heal.hp ? `+${heal.hp} HP` : `+${heal.sh} shield`}`)
      persist()
      return
    }
    // timed buff potions — drink to set/refresh the effect (engine owns durations + magnitudes)
    if (POTION_BUFFS[itemId]) {
      if (countItem(invRef.current, itemId) < 1) return
      removeItems(invRef.current, itemId, 1)
      const buff = drinkBuff(buffsRef.current, itemId, Date.now())!
      setBuffHud(activeBuffList(buffsRef.current, Date.now()))
      setInvSlots([...invRef.current.slots])
      setHarvestToast(`${BUFF_DEFS[buff].glyph} ${BUFF_DEFS[buff].name} — ${potionBuffLine(itemId) ?? BUFF_DEFS[buff].line}`)
      persist()
      return
    }
    // harvest brew — instant: every planted crop jumps ahead in its growth
    if (itemId === 'harvest_brew') {
      if (countItem(invRef.current, itemId) < 1) return
      const growing = plantedCropsRef.current.filter(c => !isCropReady(c))
      if (growing.length === 0) { setHarvestToast('Nothing growing to hurry along'); return }
      removeItems(invRef.current, itemId, 1)
      for (const c of growing) c.plantedAt -= HARVEST_BREW_ADVANCE_MS
      setCropsTick(t => t + 1)
      setInvSlots([...invRef.current.slots])
      setHarvestToast(`🌱 Harvest Brew — ${growing.length} crop${growing.length > 1 ? 's' : ''} surge ahead`)
      persist()
      return
    }
    const restore = MANA_POTIONS[itemId]
    if (restore == null || countItem(invRef.current, itemId) < 1) return   // not a drinkable mana potion / none held
    const max = manaMax()
    if (manaRef.current.current >= max - 0.5) { setHarvestToast('Mana already full'); return }
    removeItems(invRef.current, itemId, 1)
    manaRef.current.current = Math.min(max, manaRef.current.current + restore)
    setManaFrac(manaRef.current.current / max)
    setInvSlots([...invRef.current.slots])
    setHarvestToast(`Drank ${prettyItem(itemId)} · +${restore} mana`)
    persist()
  }, [persist])
  const rotatePlacing = useCallback(() => setPlacing(p => p && ({ ...p, facing: (p.facing + 90) % 360 })), [])
  const cancelPlacing = useCallback(() => { setPlacing(null); battleRef.current = false }, [])
  const confirmPlacing = useCallback(() => {
    const pl = placingRef.current, t = placeTargetRef.current
    if (!pl || !t) return
    const gr = gridRef.current
    // check occupancy in VIEW space — the target tile is in the player's (possibly world) coords
    const blocked = !walkable(gr, t.x, t.y) || structuresViewRef.current.some(s => s.tileX === t.x && s.tileY === t.y)
    if (blocked) { setHarvestToast('Can’t build there'); return }
    if (countItem(invRef.current, pl.itemId) < 1) { cancelPlacing(); return }
    removeItems(invRef.current, pl.itemId, 1)
    hands.sig.placeAt = performance.now()
    setStructures(prev => [...prev, logicalStruct({ itemId: pl.itemId, tileX: t.x, tileY: t.y, facing: pl.facing, zoneId: zoneIdRef.current })])
    setInvSlots([...invRef.current.slots])
    setHarvestToast(`Placed ${PLACEABLES[pl.itemId].name}`)
    setPlacing(null); battleRef.current = false
    persist()
  }, [cancelPlacing, persist])
  useEffect(() => {
    if (!placing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); confirmPlacing() }
      else if (e.key === 'Escape') { e.preventDefault(); cancelPlacing() }
      else if (e.key.startsWith('Arrow')) { e.preventDefault(); rotatePlacing() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [placing, confirmPlacing, cancelPlacing, rotatePlacing])

  // ── Station menus (open at any placed station — brew/craft/chest/exchange/farm, keyed by kind) ──
  const brew = useCallback((potionId: string) => {
    const before = skillsRef.current.alchemy.level
    // Active companion @15 perk — Sporebloom bonus draught (Sporeling, ×2 under Kindred)
    const brewBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current) ?? null
    const brewFind = getBonusFindChance(brewBeast, 'alchemy') * kindredMult(buffsRef.current, Date.now())
    if (!mark('brewPotion', () => brewPotion(potionId, invRef.current, skillsRef.current, manaRef.current, brewFind, bankForZone()))) { setHarvestToast('Missing ingredients or mana'); return }
    syncSkillHud()
    const def = POTION_DEFS[potionId]
    setHarvestToast(`Brewed ${def.name} ×${def.resultCount}`)
    if (skillsRef.current.alchemy.level > before) setBanner(`✦ Alchemy Lv ${skillsRef.current.alchemy.level}!`)
    persist()
  }, [syncSkillHud, persist])

  const craft = useCallback((recipeId: string) => {
    if (!mark('craftItem', () => craftItem(recipeId, invRef.current, manaRef.current, bankForZone()))) { setHarvestToast('Missing materials or mana'); return }
    syncSkillHud() // refreshes the mana pie (craft drained mana)
    setInvSlots([...invRef.current.slots])
    const def = RECIPE_DEFS[recipeId]
    setHarvestToast(`Crafted ${def.name}${def.resultCount > 1 ? ` ×${def.resultCount}` : ''} — hold ${prettyItem(def.id)} to place`)
    persist()
  }, [syncSkillHud, persist])

  // Craft a tiered tool (blade/spike/rinstick) — consumes gathered mats, auto-equips it for its
  // skill (replacing the basic/current). It wears out and breaks; the basic is always the fallback.
  const craftToolAction = useCallback((toolId: string) => {
    const newTool = craftTool(toolId, invRef.current, bankForZone())
    if (!newTool) { setHarvestToast('Missing materials'); return }
    const def = TOOL_DEFS[toolId]
    equippedToolsRef.current[def.skillId] = newTool
    setToolTick(t => t + 1)
    setInvSlots([...invRef.current.slots])
    setHarvestToast(`Crafted ${def.name} — equipped (${def.durability} uses)`)
    persist()
  }, [persist])

  // Repair the equipped tool back to full — spends a wear-scaled slice of its recipe (maintenance,
  // so you keep a tool going instead of running it to break + re-crafting from scratch).
  const repairToolAction = useCallback((skillId: SkillId) => {
    const tool = equippedToolsRef.current[skillId]
    if (!tool || !repairTool(tool, invRef.current, bankForZone())) { setHarvestToast('Missing materials to repair'); return }
    setToolTick(t => t + 1)
    setInvSlots([...invRef.current.slots])
    setHarvestToast(`Repaired ${TOOL_DEFS[tool.toolId]?.name} — full again (${TOOL_DEFS[tool.toolId]?.durability} uses)`)
    persist()
  }, [persist])

  // ── Chest (open at a placed chest) — per-instance storage, lazy-created on first open ──
  const getChest = useCallback((struct: PlacedStruct): ChestStorage => {
    const id = stationInstanceId(struct)
    let c = chestsRef.current[id]
    if (!c) { c = createChestStorage(id); chestsRef.current[id] = c }
    return c
  }, [])
  // Tap-to-transfer: move ONE stack between the chest and the player inventory (no drag needed —
  // mobile-first). `toChest` picks the direction.
  const transferChestSlot = useCallback((struct: PlacedStruct, idx: number, toChest: boolean) => {
    const chest = getChest(struct)
    if (toChest) {
      const dst = findEmptyOrMatch(chest.slots, invRef.current.slots[idx])
      if (dst === -1) { setHarvestToast('Chest is full'); return }
      transferItem(invRef.current.slots, idx, chest.slots, dst)
    } else {
      const dst = findEmptyOrMatch(invRef.current.slots, chest.slots[idx])
      if (dst === -1) { setHarvestToast('Inventory is full'); return }
      transferItem(chest.slots, idx, invRef.current.slots, dst)
    }
    setInvSlots([...invRef.current.slots])
    setChestsTick(t => t + 1)
    persist()
  }, [getChest, persist])

  // ── Garden Bank actions — deposit/withdraw against the pooled store. Only RESOURCES bank; tools,
  // potions, seeds and furniture stay in hand (you don't want your axe or your last mend potion
  // silently vacuumed into a materials pool).
  const BANK_ITEM_IDS = useMemo(() => new Set(ITEMS.filter(i => i.type === 'resource').map(i => i.id)), [])
  const depositStack = useCallback((itemId: string, count: number): number => {
    // Deposit through the real capacity; returns how many landed so the caller reports partials.
    return bankDeposit(bankRef.current, itemId, count, bankCapacityNow())
  }, [bankCapacityNow])

  const bankDepositSlot = useCallback((slotIdx: number) => {
    const slot = invRef.current.slots[slotIdx]
    if (!slot) return
    if (!BANK_ITEM_IDS.has(slot.itemId)) { setHarvestToast('Only gathered materials bank here'); return }
    const landed = depositStack(slot.itemId, slot.count)
    if (landed <= 0) { setHarvestToast('Bank is full — place another chest'); return }
    removeItems(invRef.current, slot.itemId, landed)
    setInvSlots([...invRef.current.slots])
    setBankTick(t => t + 1)
    if (landed < slot.count) setHarvestToast(`Banked ${landed} — the rest didn't fit`)
    persist()
  }, [BANK_ITEM_IDS, depositStack, persist])

  const bankDepositAllMaterials = useCallback(() => mark('bank deposit-all', () => {
    let moved = 0, hitCap = false
    for (const slot of invRef.current.slots) {
      if (!slot || !BANK_ITEM_IDS.has(slot.itemId)) continue
      const landed = depositStack(slot.itemId, slot.count)
      if (landed > 0) { removeItems(invRef.current, slot.itemId, landed); moved += landed }
      if (landed < slot.count) { hitCap = true; break }   // cap reached — stop, nothing more will fit
    }
    if (moved === 0) { setHarvestToast(hitCap ? 'Bank is full — place another chest' : 'No materials to deposit'); return }
    setInvSlots([...invRef.current.slots])
    setBankTick(t => t + 1)
    setHarvestToast(hitCap ? `Banked ${moved} — bank is now full` : `Banked ${moved} materials`)
    persist()
  }), [BANK_ITEM_IDS, depositStack, persist])

  const bankWithdrawItem = useCallback((itemId: string, qty: number) => {
    const got = bankWithdraw(bankRef.current, itemId, qty)
    if (got <= 0) return
    const leftover = addItems(invRef.current, itemId, got)   // returns what DIDN'T fit the satchel
    if (leftover > 0) {
      // Satchel couldn't hold it all — put the overflow back rather than deleting it. Force is safe:
      // it was in the bank a moment ago, so it fits the count it just left.
      bankForceDeposit(bankRef.current, itemId, leftover)
      setHarvestToast(`Satchel full — withdrew ${got - leftover}`)
    }
    setInvSlots([...invRef.current.slots])
    setBankTick(t => t + 1)
    persist()
  }, [persist])

  // ── Hotbar/satchel drag-reorder → swap the REAL inventory slots so it persists and survives
  // the next inventory update. (Kept for the party panel's drag; the satchel moves slots via moveSlot.) ──
  const reorderSlots = useCallback((from: number, to: number) => {
    const s = invRef.current.slots
    if (from < 0 || to < 0 || from >= s.length || to >= s.length || from === to) return
    const tmp = s[to]; s[to] = s[from]; s[from] = tmp
    setInvSlots([...s])
    persist()
  }, [persist])

  // ── ★ THE BOTTOM IS THE KEEPER'S, NOT THE ENGINE'S (2026-09-16, HUD port stage 2) ─────────────
  // `hud/hotbar.tsx` + `hud/satchel.tsx` + `hud/hud-corner.tsx` — the same objects the Ather mounts
  // — replace `HotBar.tsx` (6 emoji slots, its own tool gauges and mana vial). The satchel's slot-lift
  // model (click-then-click, half/one splits) needs three movers over the SAME 24-slot grid the bar
  // reads; there is no chest on the mortal side, so the chest half of each is inert here.
  const [hotSel, setHotSel] = useState(0)
  const selectSlot = useCallback((i: number) => {
    // A tap on the slot already selected is the old double-tap: use what is in it.
    if (selSlotRef.current === i) { useItem(invRef.current.slots[i]?.itemId); return }
    selSlotRef.current = i; setHotSel(i)
  }, [useItem])
  // 1-8 select, as the Ather does — not while a text field or a blocking overlay owns the keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (editRef.current || curBattleRef.current || dialogueRef.current) return
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= HOTBAR_SLOTS) { selSlotRef.current = n - 1; setHotSel(n - 1) }
    }
    // The wheel cycles the bar in play (the old HotBar's listener went with it); in edit it zooms.
    const onWheel = (e: WheelEvent) => {
      if (editRef.current || bagOpenRef.current || curBattleRef.current || dialogueRef.current) return
      if (Math.abs(e.deltaY) < 1) return
      const next = (selSlotRef.current + (e.deltaY > 0 ? 1 : -1) + HOTBAR_SLOTS) % HOTBAR_SLOTS
      selSlotRef.current = next; setHotSel(next)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('wheel', onWheel) }
  }, [])
  const [bagTick, setBagTick] = useState(0)
  const [dragFrom, setDragFrom] = useState<Lift | null>(null)
  const moveSlot = useCallback((from: SlotRef, to: SlotRef) => {
    if (from.g !== 'bag' || to.g !== 'bag') return
    moveBetween(invRef.current.slots, from.i, invRef.current.slots, to.i, getMaxStack)
    setInvSlots([...invRef.current.slots]); setBagTick(t => t + 1); persist()
  }, [persist])
  const splitSlot = useCallback((from: SlotRef, to: SlotRef, mode: 'half' | 'one') => {
    if (from.g !== 'bag' || to.g !== 'bag') return
    const src = invRef.current.slots
    const stack = src[from.i]
    if (!stack) { setDragFrom(null); return }
    const moved = moveCount(src, from.i, src, to.i, mode === 'one' ? 1 : halfOf(stack.count), getMaxStack)
    if (moved > 0) { setInvSlots([...src]); setBagTick(t => t + 1); persist() }
    if (mode === 'half' || !src[from.i]) setDragFrom(null)
  }, [persist])
  // The corner's gauge polls a `{cur,max,regen}` ref; the mortal side keeps a `ManaPool` + a skill
  // level + an affinity bonus. A getter is the adapter — read live, never copied.
  /** wide / compact / phone — the hearth HUD's size, from the real window. */
  const hudSize = useHudSize()
  // The top-right column hangs LEFT of the minimap, so its panels have the screen minus the map's
  // footprint, not the whole screen. On a 390 phone that is ~258px — a 300px book ran off the left.
  const colRoom = typeof window === 'undefined' ? 300
    : window.innerWidth - (hudMapBox(hudSize).right + hudMapBox(hudSize).size + 10) - 16
  const manaCornerRef = useMemo(() => ({
    get current() { return { cur: manaRef.current.current, max: manaMax(), regen: 1 } },
  }), [])
  const partyForBag = useMemo(() => ({ get current() { return partyRef.current ?? [] } }), [])
  const spiritIndexRef = useRef(createSpiritIndex())
  const hotbarEntries: (HotbarEntry | null)[] = Array.from({ length: HOTBAR_SLOTS }, (_, i) => {
    const st = zoneId === HOLD_ZONE ? null : invSlots[i]   // the hold: you came in with nothing
    return st ? { itemId: st.itemId, count: st.count } : null
  })
  const heldName = zoneId !== HOLD_ZONE && invSlots[hotSel] ? { text: itemLabel(invSlots[hotSel]!.itemId), out: false } : null

  // ── Exchange Booth (open at a placed booth) — buy/sell vs the single shared GE market ──
  const [tradeToast, setTradeToast] = useState<string | null>(null)
  useEffect(() => { if (!tradeToast) return; const t = setTimeout(() => setTradeToast(null), 2400); return () => clearTimeout(t) }, [tradeToast])
  const tradeBuy = useCallback((itemId: string, qty: number) => {
    const res = buyFromGE(geRef.current, wallet.marks, invRef.current, itemId, qty)
    if (!res.success) { setTradeToast(res.error ?? 'Trade failed'); return }
    wallet.spend(res.totalMarks)
    setInvSlots([...invRef.current.slots])
    setTradeToast(`Bought ${res.received ?? qty}× ${prettyItem(itemId)} for ${res.totalMarks} marks`)
    persist()
  }, [wallet, persist])
  const tradeSell = useCallback((itemId: string, qty: number) => {
    const res = sellToGE(geRef.current, invRef.current, itemId, qty)
    if (!res.success) { setTradeToast(res.error ?? 'Trade failed'); return }
    wallet.earn(res.totalMarks)
    setInvSlots([...invRef.current.slots])
    setTradeToast(`Sold ${qty}× ${prettyItem(itemId)} for ${res.totalMarks} marks (−${res.tax} tax)`)
    persist()
  }, [wallet, persist])

  // ── Farm Planter (open at a placed planter) — ONE crop slot per planter, keyed by tile+zone ──
  const plantAt = useCallback((struct: PlacedStruct, cropId: string) => {
    const before = skillsRef.current.farming.level
    const crop = plantCrop(cropId, invRef.current, skillsRef.current, manaRef.current, struct.srcTileX ?? struct.tileX, struct.srcTileY ?? struct.tileY, struct.srcZoneId ?? struct.zoneId)
    if (!crop) { setHarvestToast('Missing seed, level, or mana'); return }
    plantedCropsRef.current = [...plantedCropsRef.current, crop]
    setCropsTick(t => t + 1)
    syncSkillHud()
    setInvSlots([...invRef.current.slots])
    setHarvestToast(`Planted ${CROP_DEFS[cropId].name}`)
    if (skillsRef.current.farming.level > before) setBanner(`✦ Farming Lv ${skillsRef.current.farming.level}!`)
    persist()
  }, [syncSkillHud, persist])
  const harvestAt = useCallback((crop: PlantedCrop) => {
    const before = skillsRef.current.farming.level
    // Active companion @15 perk — Tuberfind bonus crop (Dustwhisker, ×2 under Kindred) + potion buffs
    const activeBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current) ?? null
    const now = Date.now()
    const find = getBonusFindChance(activeBeast, 'farming') * kindredMult(buffsRef.current, now) + bonusFind(buffsRef.current, now)
    const result = harvestCrop(crop, invRef.current, skillsRef.current, find, gatherXpMult(buffsRef.current, now))
    plantedCropsRef.current = plantedCropsRef.current.filter(c => c.id !== crop.id)
    setCropsTick(t => t + 1)
    syncSkillHud()
    setInvSlots([...invRef.current.slots])
    // ★ A Mana Seed pays out a SPIRIT. This is the moment the game actually starts — canon has the
    // seed choose you, so there is no prompt and no pick here, only an announcement.
    if (result.bloomed) {
      const born = makeSpiritOfSpecies(result.bloomed)
      partyRef.current = [...(partyRef.current ?? []), born]
      flagsRef.current.gotStarter = true
      setHasStarter(true)
      setHarvestToast(`✦ your Mana Seed bloomed   ·   Farming +${result.xpGained} XP`)
      setBanner(`✦ a young ${speciesDisplayName(born.species)} chose you!`)
    } else
    setHarvestToast(`+ ${result.items.map(i => prettyItem(i.itemId)).join(' · ') || 'nothing'}   ·   Farming +${result.xpGained} XP`)
    if (skillsRef.current.farming.level > before) {
      setBanner(`✦ Farming Lv ${skillsRef.current.farming.level}!`)
      const got = checkCompanionUnlocks()
      if (got) setBanner(`✦ ${BEAST_DEFS[got].name} joined you — ${PERK_INFO[BEAST_PERKS[got]].label} unlocked!`)
    }
    persist()
  }, [syncSkillHud, persist, checkCompanionUnlocks])

  // Grant a completed harvest: roll drops + XP, wear the tool, deplete the node, HUD/toast/banner,
  // persist. Shared by the channel completion (forestry/prospecting) and the rinning catch.
  const grantHarvest = useCallback((node: ResourceNode) => {
    const skillId = getNodeSkill(node.type)
    const tool = getEquippedTool(equippedToolsRef.current, skillId)
    const now = Date.now()
    const xp = Math.round(NODE_DEFS[node.type].xp * (tool?.xpBonus ?? 1) * gatherXpMult(buffsRef.current, now))
    // Find chance = companion @15 perk (Grovekin/Gemsense/Truesight, ×2 under Kindred) + potion buffs
    const activeBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current) ?? null
    const find = getBonusFindChance(activeBeast, skillId) * kindredMult(buffsRef.current, now) + bonusFind(buffsRef.current, now)
    const added = addHarvestItems(invRef.current, rollDrops(node.type, find * affinityRef.current.gatherMult))
    const xpr = addSkillXP(skillsRef.current[skillId], xp)
    // Wear the tool — basics never break; when an improved tool breaks, fall back to the basic.
    if (tool && !useTool(tool)) {
      delete equippedToolsRef.current[skillId]
      ensureBasicTools(equippedToolsRef.current)
      setToolTick(t => t + 1)
      setHarvestToast(`${TOOL_DEFS[tool.toolId]?.name} broke — back to your ${TOOL_DEFS[equippedToolsRef.current[skillId]!.toolId]?.name}`)
    }
    depleteNode(node)
    // ★ The Home Plot's one-way door (Alex, 2026-07-30: "the home plot should clear the resource so
    // the player has to go out for more"). Everywhere else a depleted node is on a respawn timer;
    // here it is gone for good, so the plot trends empty and the world is where you gather. Only on
    // FULL depletion — a pond with catches left is not stripped yet.
    if (isHomeSlot(node) && node.state === 'depleted') {
      setStripped(prev => prev.has(node.slotKey!) ? prev : new Set(prev).add(node.slotKey!))
    }
    syncSkillHud(); setRuntimeNodes([...runtimeNodesRef.current]); setNearNode(null)
    setHarvestToast(`+ ${added.map(prettyItem).join(' · ') || 'nothing'}   ·   ${SKILL_META[skillId].name} +${xp} XP`)
    // the payoff: a resource glyph bursts off the node + a bright pop (parity with the rinning catch)
    const gy = (heightsRef.current[node.tileY]?.[node.tileX] ?? 0) * STEP
    setHarvestPop({ x: node.tileX, y: gy, z: node.tileY, glyph: HARVEST_GLYPH[skillId] ?? '✦', key: ++popKeyRef.current })
    gatherPop()
    if (xpr.leveled) {
      setBanner(`✦ ${SKILL_META[skillId].name} Lv ${xpr.newLevel}!`)
      const got = checkCompanionUnlocks()
      if (got) setBanner(`✦ ${BEAST_DEFS[got].name} joined you — ${PERK_INFO[BEAST_PERKS[got]].label} unlocked!`)
    }
    persist()
  }, [syncSkillHud, persist, checkCompanionUnlocks])

  // rinning strike (E/tap while the line's out): hook only while the `!` is up. A catch drains
  // the mana + grants the drops; striking early or letting the bite lapse slips the line. Either
  // way the walker unlocks from the node.
  const endFishing = useCallback(() => { fishRef.current = null; battleRef.current = false; setFish(null) }, [])
  const hookFish = useCallback(() => {
    const f = fishRef.current; if (!f) return
    if (rinHook(f.cast, performance.now())) {
      manaRef.current.current = Math.max(0, manaRef.current.current - f.manaCost)
      setManaFrac(manaRef.current.current / manaMax())
      rinCatch(); grantHarvest(f.node)
    } else {
      rinMiss(); setHarvestToast('…it slipped the line')
    }
    endFishing()
  }, [grantHarvest, endFishing])
  hookFishRef.current = hookFish

  // fishing driver — while the line's out, raise the `!` at the bite and slip it if the window lapses.
  useEffect(() => {
    const id = setInterval(() => {
      const f = fishRef.current; if (!f) return
      const ph = rinPhaseAt(f.cast, performance.now())
      if (ph === 'bite' && !f.bitten) { f.bitten = true; setFish(s => (s ? { ...s, bite: true } : s)); rinBite() }
      else if (ph === 'gotaway') { rinMiss(); setHarvestToast('…it slipped the line'); endFishing() }
    }, 60)
    return () => clearInterval(id)
  }, [endFishing])

  // channel driver — advances progress + drains mana each tick; breaks on distance / no-mana; completes at full.
  useEffect(() => {
    const dt = 0.09
    const id = setInterval(() => {
      const ch = channelRef.current
      if (!ch) return
      const p = posRef.current!
      const dist = Math.max(Math.abs(ch.node.tileX - p.x), Math.abs(ch.node.tileY - p.z))
      const drain = (ch.manaCost / ch.durSec) * dt         // spread the (tool-penalized) tier cost over the chop
      if (dist > CHANNEL_RANGE || ch.node.state !== 'harvestable') { channelRef.current = null; setChannel(null); return }
      if (manaRef.current.current < drain) { channelRef.current = null; setChannel(null); setHarvestToast('Out of mana'); return }
      manaRef.current.current -= drain
      setManaFrac(manaRef.current.current / manaMax())
      chopClockRef.current += dt
      if (chopClockRef.current >= 0.42) { chopClockRef.current = 0; gatherTick(getNodeSkill(ch.node.type)) } // working rhythm
      ch.progress += dt / ch.durSec
      if (ch.progress >= 1) {
        grantHarvest(ch.node)
        channelRef.current = null; setChannel(null)
      } else {
        setChannel({ nodeId: ch.node.id, label: prettyItem(ch.node.type), hp: 1 - ch.progress, family: getNodeSkill(ch.node.type) })
      }
    }, dt * 1000)
    return () => clearInterval(id)
  }, [syncSkillHud, persist, grantHarvest])

  // Show on-screen touch controls (joystick + A/B) on touch devices; desktop keeps WASD + drag-look.
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => { setIsTouch((window.matchMedia?.('(pointer: coarse)').matches ?? false) || 'ontouchstart' in window) }, [])

  // ── Pointer-lock handoff (shared by satchel / range console / BATTLE) ────────────────────────
  // Overlays own the cursor; play owns the look. Every overlay opening releases the pointer and
  // every return to play re-captures it — the player should NEVER have to Esc + re-click at a seam.
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const relockPointer = useCallback(() => {
    if (editRef.current || isTouch) return
    const c = canvasElRef.current
    if (c) { try { const r = c.requestPointerLock?.() as unknown as Promise<void> | undefined; r?.catch?.(() => {}) } catch { /* re-lock cooldown — a canvas click resumes look */ } }
  }, [isTouch])

  // ── THE MOUSE HANDOFF ─────────────────────────────────────────────────────────────────────────
  // Every cursor-driven surface (station menus, the map) borrows the mouse from first-person look
  // and must hand it BACK on close. Before this, closing a crafting menu left the player looking at
  // a dead screen until they clicked it again — and worse, opening a station with the E key never
  // released the lock at all, so the menu appeared with the cursor still captured and unclickable.
  //
  // Whether to re-lock is remembered from OPEN time rather than assumed. A player who was already
  // cursor-free (never clicked in, or on a trackpad) should not have their mouse seized just
  // because they closed a menu — the handoff gives back exactly what it borrowed.
  const lockOnCloseRef = useRef(false)
  const openCursorUI = useCallback(() => {
    lockOnCloseRef.current = !!document.pointerLockElement
    document.exitPointerLock?.()
  }, [])
  const closeCursorUI = useCallback(() => {
    const relock = lockOnCloseRef.current
    lockOnCloseRef.current = false
    // The close is itself a user gesture (button click or keypress), which is what the browser
    // requires to grant pointer lock. relockPointer already swallows the rare cooldown rejection,
    // and a canvas click is always the fallback.
    if (relock) relockPointer()
  }, [relockPointer])
  // Publish for the surfaces defined above this point (the map's M-key effect).
  openCursorUIRef.current = openCursorUI
  closeCursorUIRef.current = closeCursorUI

  const openStation = useCallback(() => {
    const s = nearStationRef.current; if (!s) return
    mark(`open ${STATIONS[s.itemId].kind}`, () => {
      battleRef.current = true
      openCursorUI()
      setOpenMenu({ kind: STATIONS[s.itemId].kind, struct: s })
    })
  }, [openCursorUI])
  const closeStation = useCallback(() => {
    mark('close station', () => {
      battleRef.current = false
      setOpenMenu(null)
      closeCursorUI()
    })
  }, [closeCursorUI])

  const onEncounter = useCallback((enc: WildEncounter) => {
    battleRef.current = true   // freeze the walker through the approach beat AND the fight
    document.exitPointerLock?.()  // free the cursor DURING the approach beat — arena mounts click-ready
    const size = partyRef.current?.length ?? 1
    // Stage the fight, but show the approach beat first — the arena mounts when it commits.
    setApproach({ enc, battle: { allies: partyRef.current!, enemies: buildWildParty(enc, size), aiTier: enc.aiTier, zoneId: logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z), kind: 'wild' } })
  }, [])

  // Approach beat → arena: hold the "drawn to you" flash ~1.3s, then mount the real fight.
  const commitApproach = useCallback(() => {
    setApproach(a => { if (a) setBattle(a.battle); return null })
  }, [])
  useEffect(() => {
    if (!approach) return
    const t = setTimeout(commitApproach, 1300)
    return () => clearTimeout(t)
  }, [approach, commitApproach])

  // DEV: force a wild Keeper's Arena fight in-world, ignoring the party/zone/RNG gates —
  // so the arena can be feel-tested without owning a starter or being in an encounter zone.
  // Uses the real party if present; otherwise a throwaway test trio (never persisted).
  const forceFight = useCallback(() => {
    const real = partyRef.current ?? []
    // A real party goes through the same downed-gate as every other fight; only a player with NO
    // party at all gets the throwaway trio (dev feel-testing, never persisted).
    if (real.length > 0 && !fieldParty()) return
    const allies = real.length > 0
      ? fieldableSpirits(activeSpirits(real)).slice(0, MAX_PARTY)
      : (['fox', 'owl', 'water-bear'] as const).map((sp, i) => {
          const s = createSpirit(sp, ['Kit', 'Sage', 'Tor'][i], 0, 0)
          s.level = 12; s.bond = 60; s.happiness = 128
          return s
        })
    const enc = rollEncounter(logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z))
    const enemies = enc
      ? buildWildParty(enc, allies.length)
      : (['frog', 'bat'] as const).map((sp, i) => {
          const s = createSpirit(sp, ['Blightling', 'Gnash'][i], 0, 0)
          s.level = Math.max(10, partyLevelRef.current || 12)
          return s
        })
    battleRef.current = true
    document.exitPointerLock?.()
    setBattle({ allies, enemies, aiTier: enc?.aiTier ?? 'wild', zoneId: logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z), kind: 'wild' })
  }, [])

  // ONE gate in front of every fight-start path. A downed spirit sits the fight out; a party with
  // nothing left standing cannot pick a fight at all. Returns null when the fight must not start.
  // The returned array holds the SAME Spirit objects as the party, so the post-fight wound
  // write-back (which indexes into it) lands on the real save.
  const fieldParty = useCallback((): Spirit[] | null => {
    const active = activeSpirits(partyRef.current ?? [])
    const ready = fieldableSpirits(active).slice(0, MAX_PARTY)
    if (ready.length === 0) {
      // "Everyone with you is down" is a different problem from "you have nobody with you", and a
      // reserve resting at home makes it a third — the fix is a swap, so say so.
      const resting = restingSpirits(partyRef.current ?? [])
      setBanner(!partyAllDowned(active)
        ? '✦ You have no spirits to send in'
        : resting.some(canFight)
          ? '✦ Your party is down — swap in one resting at home (P)'
          : '✦ Your whole party is down — mend them before you fight')
      return null
    }
    return ready
  }, [])

  // Battle end: on a win, split rewards across the party (XP / bond / happiness / gold), then save.
  const endBattle = useCallback((outcome: 'win' | 'lose', result: BattleResult = { allies: [], bagUsed: 0 }) => {
    battleRef.current = false
    const bd = curBattleRef.current
    let spoils: { gold: number; rows: RewardRow[] } | null = null

    // WOUNDS FIRST, and on every exit path. Win, loss and flight all leave the party as the fight
    // left it — that persistence is the whole point of the healing loop, and a loss used to
    // short-circuit this entire function, which would have made losing the cheapest way to fight.
    // Write to the exact objects that fought (`bd.allies`, which the ids index) rather than the
    // live party: on a dev forceFight those are throwaways and must not touch the save.
    if (bd) {
      for (const r of result.allies) {
        const spirit = bd.allies[r.index]
        if (spirit) applyFightResult(spirit, r.hp, r.maxHp)
      }
      // BAG drank real salves mid-fight — take them out of the satchel now.
      if (result.bagUsed > 0) {
        removeItems(invRef.current, MEND_POTION_ID, result.bagUsed)
        setInvSlots([...invRef.current.slots])
      }
      const felled = result.allies.filter(r => r.hp <= 0).length
      if (felled > 0) setBanner(felled === 1 ? '✦ A spirit went down — mend it before the next fight' : `✦ ${felled} spirits went down — mend them before the next fight`)
    }
    if (outcome === 'win' && bd) {
      // The spirits that actually FOUGHT, not the whole roster — a downed spirit sat this one out
      // and doesn't share the victory. (Everyone who was on the field still splits nothing: the
      // XP below is per-ally, not divided.)
      const allies = bd.allies.slice(0, MAX_PARTY)
      // XP scales with the LEVEL RELATION, not just the enemy's level: punching up pays up to
      // 2×, stomping something far below you pays a quarter. avg ally level is the yardstick.
      const avgAlly = Math.max(1, allies.reduce((s, a) => s + a.level, 0) / Math.max(1, allies.length))
      // …and it pays as a FRACTION of the level bar, not a flat chunk. xpForLevel is
      // quadratic (L22 needs 11,440), so the old flat `level*12` gains stopped visibly
      // moving the bar past ~L15 (caught by Alex's dew bear). A same-level enemy now pays
      // ~XP_FRAC of the CURRENT bar to EVERY party member (shared victory, no split), so
      // progression keeps pace with the curve at any level.
      const XP_FRAC = 0.08   // dial: bar-fraction one same-level enemy pays each ally
      const perXp = Math.max(4, Math.round(bd.enemies.reduce((s, e) => {
        const diff = Math.min(2, Math.max(0.25, e.level / avgAlly))  // 0.25×..2× dial
        return s + xpForLevel(avgAlly) * XP_FRAC * diff
      }, 0)))
      // Marks come from the liberation holds (a stronghold's spoils), never from wild spirits —
      // a wild spirit carries no purse. Wild pays in XP/bond only.
      const gold = bd.kind && bd.kind !== 'wild' ? bd.enemies.reduce((s, e) => s + e.level * 3, 0) : 0
      if (gold > 0) wallet.earn(gold)
      const rows: RewardRow[] = []
      for (const spirit of allies) {
        const fromLevel = spirit.level
        // Snapshot BEFORE the level lands — stats are recomputed from `level` on every read
        // (derivePartyStats), so once addXP bumps it the old numbers are gone. This snapshot is
        // the whole reason a level-up can show its work: growth is otherwise invisible, which is
        // exactly what "my L6 Dewbear feels the same" was about.
        const statsBefore = derivePartyStats(spirit)
        const movesBefore = new Set(getMovesForSpirit(spirit.species, spirit.element, spirit.level, spirit.bond).map(m => m.id))
        const xpResult = addXP(spirit, perXp)
        spirit.bond = Math.min(255, spirit.bond + 4)
        spirit.happiness = Math.min(255, spirit.happiness + 3)
        // …and after, with the bond bump applied, since kits key off bond as well as level.
        const statsAfter = derivePartyStats(spirit)
        const learned = getMovesForSpirit(spirit.species, spirit.element, spirit.level, spirit.bond)
          .filter(m => !movesBefore.has(m.id)).map(m => m.name)
        // ── ★★ THIS LINE WAS CANON'S COMPLAINT, WORD FOR WORD (fixed 2026-08-18, #262 slice ④) ──
        // It read: "Full evolution is the 2D EvolutionScene's job — not ported yet. We just
        // celebrate the threshold here." So the build announced `✦ ready to evolve!` and then
        // nothing happened, forever, which is exactly what `game/alchemy.md` names. The sweep after
        // this loop takes the form for real; the banner now only says a threshold was crossed, and
        // `addXP` no longer raises it for a spirit that has no infusion to read.
        if (xpResult.evolved) setBanner(`✦ ${spirit.name} is changing…`)
        rows.push({ name: spirit.name, element: spirit.element, fromLevel, toLevel: spirit.level, xpGained: perXp, curXp: spirit.xp, needXp: xpForLevel(spirit.level), evolved: !!xpResult.evolved, statsBefore, statsAfter, learned })
      }
      // Wild + patrol fights get the spoils reveal; the scripted holds keep their narrative payoff (dialogue below).
      if (!bd.kind || bd.kind === 'wild' || bd.kind === 'patrol') spoils = { gold, rows }
      // ★ After every spirit has its XP, not inside the loop — evolving mid-loop would mutate a
      // spirit whose stats-before snapshot has already been taken for the rewards row.
      runEvolutions()
    }
    // A beaten patrol's spawner sleeps on the long clock (win only — a loss leaves it prowling).
    if (bd?.kind === 'patrol' && patrolKeyRef.current) {
      if (outcome === 'win') {
        const win = currentWindow()
        patrolBeatenRef.current = markBeaten(pruneBeaten(patrolBeatenRef.current, win), patrolKeyRef.current, win)
      }
      patrolKeyRef.current = null
    }
    setBattle(null)
    if (spoils) { battleRef.current = true; setRewards(spoils) }   // stay frozen behind the reveal
    else relockPointer()   // scripted/loss paths return straight to play — look re-captures itself
    // Liberation beat: freeing Thistle's collared spirit clears Hold 1 — he deflates and retreats east.
    if (outcome === 'win' && bd?.kind === 'thistle') {
      flagsRef.current.freedThistle = true
      setDefeated((d) => ({ ...d, thistle: true }))
      // Canon (ruled 2026-07-04): win = free. The old freed-vs-forced beat was dropped, so the
      // collar just breaks on the win — one freeing path.
      setDialogue({ name: 'Thistle', lines: [...THISTLE_DEFEAT, FREED_SPIRIT_BEAT], idx: 0, onDone: () => setBanner('✦ Hold 1 cleared — Spirit Meadows is open') })
    }
    // Hold 2: Vetch's stronghold falls — both collars break, he retreats up to Brack, and a Mana Seed
    // is left behind. Canon reward = the Mana Seed blooms into a new companion (party growth = seeds/bloom).
    if (outcome === 'win' && bd?.kind === 'vetch') {
      flagsRef.current.freedVetch = true
      setDefeated((d) => ({ ...d, vetch: true }))
      const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
      const bloom = createSpirit(sp, speciesDisplayName(sp), 0, 0)
      bloom.level = Math.max(5, partyLevelRef.current)
      // A bloom into a FULL party used to append silently — the spirit was owned, fed and levelled
      // forever, and never once fielded, because the cap only existed at fight time. It rests at
      // the Home Plot now, and the dialogue below says which of the two happened.
      bloom.inParty = activeSpirits(partyRef.current ?? []).length < MAX_PARTY
      partyRef.current = [...(partyRef.current ?? []), bloom]
      setDialogue({ name: 'Vetch', lines: [...VETCH_DEFEAT, FREED_PAIR_BEAT, `A Mana Seed sits where the leashes were. It blooms — a young ${speciesDisplayName(sp)} ${bloom.inParty ? 'joins you' : 'joins you, and waits at the Home Plot — your party is full'}.`], idx: 0, onDone: () => setBanner('✦ Hold 2 cleared — the Mana Springs are free') })
    }
    // Hold 3 — the climax. Brack's stronghold falls; all three collars break at once and the three Moglins
    // deflate together (the four-voice finale). Mana Seed reward blooms a companion; the arc closes.
    if (outcome === 'win' && bd?.kind === 'brack') {
      flagsRef.current.freedBrack = true
      setDefeated((d) => ({ ...d, brack: true }))
      const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
      const bloom = createSpirit(sp, speciesDisplayName(sp), 0, 0)
      bloom.level = Math.max(5, partyLevelRef.current)
      // A bloom into a FULL party used to append silently — the spirit was owned, fed and levelled
      // forever, and never once fielded, because the cap only existed at fight time. It rests at
      // the Home Plot now, and the dialogue below says which of the two happened.
      bloom.inParty = activeSpirits(partyRef.current ?? []).length < MAX_PARTY
      partyRef.current = [...(partyRef.current ?? []), bloom]
      const finale = [...BRACK_FINALE, { speaker: '—', text: `A Mana Seed rests in the cracked-open grass. It blooms — a young ${speciesDisplayName(sp)} ${bloom.inParty ? 'joins you' : 'joins you, and waits at the Home Plot — your party is full'}.` }]
      setDialogue({
        name: 'Brack',
        lines: finale.map(l => l.text),
        speakers: finale.map(l => l.speaker),
        idx: 0,
        onDone: () => setBanner('✦ The holds are free — the three come home'),
      })
    }
    persist()
  }, [wallet, persist, relockPointer])

  // New Game: empty party back at the start zone — the player meets Gregory again for a fresh starter.
  const newGame = useCallback(() => {
    partyRef.current = []
    flagsRef.current = {}
    // fresh skilling state: reset skills/mana, EMPTY bag — the builder kit is Gregory's gift now
    skillsRef.current = createSkillSet()
    manaRef.current = createManaPool(1)
    invRef.current = createInventory()
    equippedToolsRef.current = ensureBasicTools({})  // Greg's basic blade/spike/rinstick
    flagsRef.current[STARTER_KIT_FLAG] = true // suppress the load-path migration so a fresh player stays empty until Gregory
    flagsRef.current.mendKitV1 = true // ditto for the mend-potion migration (Gregory's kit carries them)
    // The rest of the run's economy. persist() writes every one of these refs, so anything left
    // un-reset here gets saved straight back into the "new" game.
    beastsRef.current = []
    activeBeastIdRef.current = null
    chestsRef.current = {}
    bankRef.current = createBank()
    setBankTick(t => t + 1)
    // New Game uses replaceFlags, so bankMigratedV1 is dropped with every other flag — which is
    // correct: a fresh save has no old chests to migrate, and the empty-chest migration on next load
    // is a harmless no-op that just re-sets the flag.
    geRef.current = createGEState()
    plantedCropsRef.current = []
    buffsRef.current = {}
    setBuffHud([])
    setChestsTick(t => t + 1)
    setCropsTick(t => t + 1)
    setStructures([])
    syncSkillHud()
    setHasStarter(false)
    setDefeated({})
    // The Home Plot's strips are one-way and permanent, so a fresh save MUST clear them or the new
    // player inherits a garden someone else already stripped bare — and, per the note above, the
    // very next persist() would write the old set straight back into the "new" game.
    setStripped(new Set())
    strippedRef.current = new Set()
    const z = getZone(ALL_ZONES, START_ZONE)!
    const ps = z.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current!.set(ps.tileX, posRef.current!.y, ps.tileY)
    setZoneId(START_ZONE)
    setBanner('new game — find Gregory in the glade')
    persist({ replaceFlags: true })
  }, [persist, syncSkillHud])

  // Gregory's gift — a Mana Seed and the bag to work it. NOT a spirit.
  //
  // ★ `gotStarter` is deliberately NOT set here any more. It means "this keeper has a spirit", and
  // they do not yet — it is set when the seed blooms (see harvestAt). Setting it on the handoff
  // would tell the HUD a keeper with an empty party is fully equipped.
  const grantStarter = useCallback(() => {
    // ⚠ The repeat guard MOVED to this flag. It used to lean on `gotStarter`, which no longer gets
    // set here — without this check, re-running Greg's dialogue would hand out seed after seed.
    if (flagsRef.current[STARTER_KIT_FLAG]) return
    grantStarterKit(invRef.current)
    flagsRef.current[STARTER_KIT_FLAG] = true
    // The bag carries no potions (canon: "nothing a new keeper does not"), and this flag suppresses
    // the load-path mend-kit migration — so a new keeper is not quietly handed the potions the bag
    // deliberately leaves out.
    flagsRef.current.mendKitV1 = true
    setInvSlots([...invRef.current.slots])
    setBanner('✦ a Mana Seed — plant it in the pot and tend it')
    persist()
  }, [persist])

  // Advance the active dialogue. Greg's intro grants the starter as the "here it is" line appears.
  const advanceDialogue = useCallback(() => {
    const d = dialogueRef.current
    if (!d) return
    const next = d.idx + 1
    if (next >= d.lines.length) { setDialogue(null); d.onDone(); return }
    if (d.grantAt !== undefined && next === d.grantAt) grantStarter()
    setDialogue({ ...d, idx: next })
  }, [grantStarter])

  // A spawner's cooldown key must be LOGICAL (zone-local), so layout tweaks never orphan it.
  const spawnerKeyFor = useCallback((sp: SpawnerPlacement) => {
    const l = zoneIdRef.current === WORLD_ZONE_ID ? fromWorld(sp.tileX, sp.tileY) : null
    return l ? `${l.zoneId}:${l.x},${l.y}` : `${zoneIdRef.current}:${sp.tileX},${sp.tileY}`
  }, [])
  const spawnerReady = useCallback((sp: SpawnerPlacement) =>
    !patrolDown(patrolBeatenRef.current, spawnerKeyFor(sp), currentWindow()), [spawnerKeyFor])

  // Lesser-moglin patrol — the grind-ladder fight (Alex 07-22): a moglin handler's pair of
  // collared spirits at party level +1. Trained tier (they coordinate), collared render +
  // FREED beat, and unlike wilds the HANDLER pays marks (a moglin has pockets). Its spawner
  // then sleeps on a long clock; freeing the hold retires it for good.
  const startPatrolBattle = useCallback((sp: SpawnerPlacement, key: string) => {
    const lvl = Math.max(4, partyLevelRef.current + 1)
    const mkCaptive = () => {
      const species = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
      const c = createSpirit(species, `Collared ${speciesDisplayName(species)}`, 0, 0)
      c.level = lvl
      c.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
      return c
    }
    const fielded = fieldParty()
    if (!fielded) return
    battleRef.current = true
    patrolKeyRef.current = key
    document.exitPointerLock?.()
    setBattle({ allies: fielded, enemies: [mkCaptive(), mkCaptive()], aiTier: 'trained', zoneId: logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z), kind: 'patrol', collared: [0, 1] })
  }, [fieldParty])

  // Arm the patrols: you meet the BODY on its walk now, not an invisible radius around the
  // burrow tile — the fight triggers on the patrol's derived position, so you can see it
  // coming and choose the engagement. The pose is recomputed here independently of the
  // renderer (both are pure functions of the same clock, so they cannot disagree), and the
  // loop rebuild per tick is a few hundred ops — cheaper than caching it correctly.
  useEffect(() => {
    const iv = setInterval(() => {
      if (battleRef.current || editRef.current || dialogueRef.current) return
      if (!(partyRef.current?.length)) return
      const pos = posRef.current
      if (!pos) return
      const now = Date.now()
      const win = currentWindow(now)
      for (const sp of spawnersRef.current) {
        if (defeatedRef.current[sp.gate]) continue
        const key = spawnerKeyFor(sp)
        if (patrolDown(patrolBeatenRef.current, key, win)) continue
        const loop = patrolLoop(sp.tileX, sp.tileY, (x, y) => walkable(gridRef.current, x, y), key)
        const pose = patrolPose(loop, sp.tileX, sp.tileY, now, win)
        if (pose.emerge < 1) continue  // still climbing out of the mouth — not fair game yet
        const dx = pos.x - pose.x, dz = pos.z - pose.y
        if (dx * dx + dz * dz > 2.6) continue
        startPatrolBattle(sp, key)
        break
      }
    }, 600)
    return () => clearInterval(iv)
  }, [spawnerKeyFor, startPatrolBattle])

  // Thistle's collared captive — the spirit you free in the Reach battle (enemy index 0, auto-collared by
  // createPartyBattle's reach mode, which also dims it and hands your party the calming moves).
  const startThistleBattle = useCallback(() => {
    const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
    const captive = createSpirit(sp, `Collared ${speciesDisplayName(sp)}`, 0, 0)
    // ABSOLUTE, like the zone bands (Alex 2026-07-23). Hold 1 sits just under the Spirit
    // Meadows wild band (Lv 7-8) so the boss reads as the area's gatekeeper, not a spike.
    captive.level = HOLD_LEVELS.thistle
    captive.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
    const fielded = fieldParty()
    if (!fielded) return
    battleRef.current = true
    document.exitPointerLock?.()
    setBattle({ allies: fielded, enemies: [captive], aiTier: 'wild', zoneId: logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z), kind: 'thistle', title: 'HOLD 1 — THISTLE', collared: [0] })
  }, [fieldParty])

  // Vetch — Hold 2, the stronghold. Enemies = [guard, captive, captive]. The guard (no collar) SHIELDS
  // the two collared captives: you break the brute first, then reach BOTH to free them. KO'ing either
  // captive = "forced" (you broke who you came to save). Tougher than Thistle (champion AI, higher levels).
  const startVetchBattle = useCallback(() => {
    const pick = () => LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
    const guard = createSpirit(pick(), 'Vetch’s Brute', 0, 0)
    guard.level = HOLD_LEVELS.vetch.guard
    guard.seeds = Array.from({ length: 6 }, () => 16 + Math.floor(Math.random() * 16))
    const mkCaptive = () => {
      const sp = pick()
      const c = createSpirit(sp, `Collared ${speciesDisplayName(sp)}`, 0, 0)
      c.level = HOLD_LEVELS.vetch.captive
      c.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
      return c
    }
    const fielded = fieldParty()
    if (!fielded) return
    battleRef.current = true
    document.exitPointerLock?.()
    setBattle({ allies: fielded, enemies: [guard, mkCaptive(), mkCaptive()], aiTier: 'champion', zoneId: logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z), kind: 'vetch', title: "HOLD 2 — VETCH'S STRONGHOLD", collared: [1, 2] })
  }, [fieldParty])

  // Brack — Hold 3, the climax. The pooled force: TWO enforcers (guards) shielding THREE collared
  // captives. Break both guards, then reach all three. The wall of the arc — canon wants a real team.
  const startBrackBattle = useCallback(() => {
    const pick = () => LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
    const mkGuard = (name: string, lv: number) => {
      const g = createSpirit(pick(), name, 0, 0)
      g.level = lv
      g.seeds = Array.from({ length: 6 }, () => 18 + Math.floor(Math.random() * 14))
      return g
    }
    const mkCaptive = () => {
      const sp = pick()
      const c = createSpirit(sp, `Collared ${speciesDisplayName(sp)}`, 0, 0)
      c.level = HOLD_LEVELS.brack.captive
      c.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
      return c
    }
    const fielded = fieldParty()
    if (!fielded) return
    battleRef.current = true
    document.exitPointerLock?.()
    setBattle({ allies: fielded, enemies: [mkGuard('Brack’s Muscle', HOLD_LEVELS.brack.muscle), mkGuard('Brack’s Enforcer', HOLD_LEVELS.brack.enforcer), mkCaptive(), mkCaptive(), mkCaptive()], aiTier: 'champion', zoneId: zoneIdRef.current, kind: 'brack', title: "HOLD 3 — BRACK'S GAUNTLET", collared: [2, 3, 4] })
  }, [fieldParty])

  // Talk to an NPC. Gregory: no spirit → intro + starter handoff; else a sendoff. Thistle: no spirit → he
  // sneers you off; with a bonded spirit → pre-fight swagger, then the Reach battle to free his captive.
  const talk = useCallback((npc: NPC3D) => {
    const hasSpirit = (partyRef.current?.length ?? 0) > 0
    // ── THE PASSAGE (2026-09-25): stalls open their own shelves, cabinets open a game ─────────────
    // The panel opens straight away. The trader's three lines are said ONCE, at the first stall a keeper
    // browses (`passageVouched`): they are a greeting to someone who was shown the way down, and a
    // greeting every visit is a toll. Same freeze-the-walker shape the old lone trader used.
    // (Not the dialogue ACTION system: `openShop` exists in dialogue-schema.ts but NOTHING calls
    // `consumeActions`, so an authored action is queued and dropped. Recorded on GBOARD.)
    if (npc.id.startsWith('stall:')) {
      const stall = PASSAGE.stalls.find(s => s.id === npc.id)
      if (!stall) return
      const open = () => {
        battleRef.current = true
        openCursorUI()
        setRackStall({ shelves: stall.shelves, title: stall.name.replace(/^the /, 'The ') })
        setRackOpen(Date.now())
      }
      if (!flagsRef.current.passageVouched) {
        setDialogue({ name: 'A trader', lines: TRADER_LINES, idx: 0, onDone: () => {
          flagsRef.current.passageVouched = true
          persist()
          open()
        } })
      } else open()
      return
    }
    if (npc.id.startsWith('cabinet:')) {
      const c = PASSAGE.cabinets.find(k => k.id === npc.id)
      if (!c) return
      battleRef.current = true
      openCursorUI()
      setCabinet(c.game)
      return
    }
    if (npc.id === 'gregory-square') {
      // Beat 0. He speaks, he goes in, the door is the way after him. The flag persists so a reload
      // finds him gone and the trail on the door; nothing locks the door before he has spoken.
      setDialogue({ name: 'Gregory', lines: GREG_SQUARE_LINES, idx: 0, onDone: () => {
        flagsRef.current[MET_GREG_FLAG] = true
        setDefeated((d) => ({ ...d, 'gregory-square': true }))
        persist()
      } })
      return
    }
    if (npc.id === 'gregory') {
      if (!hasSpirit) setDialogue({ name: 'Gregory', lines: [...GREG_INTRO_LINES, GREG_NUDGE], idx: 0, grantAt: GREG_INTRO_LINES.length, onDone: () => {} })
      else setDialogue({ name: 'Gregory', lines: [GREG_RETURN], idx: 0, onDone: () => {} })
    } else if (npc.id === 'thistle') {
      if (!hasSpirit) setDialogue({ name: 'Thistle', lines: THISTLE_TAUNT_NO_SPIRIT, idx: 0, onDone: () => {} })
      else setDialogue({ name: 'Thistle', lines: THISTLE_PREFIGHT, idx: 0, onDone: startThistleBattle })
    } else if (npc.id === 'vetch') {
      // Vetch only stands here once Thistle has fled to him (gated by requiredFlag), so the player
      // always has a party by now — straight to the swagger, then the stronghold Reach battle.
      setDialogue({ name: 'Vetch', lines: VETCH_PREFIGHT, idx: 0, onDone: startVetchBattle })
    } else if (npc.id === 'brack') {
      setDialogue({ name: 'Brack', lines: BRACK_PREFIGHT, idx: 0, onDone: startBrackBattle })
    }
  }, [startThistleBattle, startVetchBattle, startBrackBattle, persist])

  const [version, setVersion] = useState(0)
  const [confirmNew, setConfirmNew] = useState(false)
  // Birth Rune gate — New Game opens this before resetting; choosing a rune is the player's
  // one "who am I" moment (play3d is first-person, so birth IS the character moment).
  const [birthOpen, setBirthOpen] = useState(false)
  const [birthCancelable, setBirthCancelable] = useState(true) // New Game birth is escapable; first-entry birth is not
  const birthRuneRef = useRef<string | null>(null)  // chosen rune id (also in localStorage ather:shimmer:birthRune)
  // v1 affinity LEAN granted by the birth rune (CANON/game/shimmer-birth-rune.md) — a permanent
  // stat lean, NOT a passive move: it costs no socket and does not pause mana recovery
  // (ruled 2026-08-25). Resolved on
  // load/birth by applyAffinity(); read by the stat hooks (shield/hp caps, speed, mana, gather).
  const affinityRef = useRef<Affinity>(NEUTRAL_AFFINITY)
  // ── THE CAST LAYER: rune inventory → known moves → a typed loadout slot → an archetype ────────
  // v2 mapped birthRune → bolt, which Alex corrected: the birth rune is the innate PASSIVE, not the
  // moveset. So the rune only decides which moves your book contains; the loadout decides what your
  // hands do. Slots are typed by canon tier (1 passive · 2 tacticals · 1 ultimate) and bound G/Z/X/C.
  const runeInvRef = useRef<RuneInventory>(EMPTY_INVENTORY)
  const castLoadoutRef = useRef<(string | null)[]>(ALL_BANDS.map(() => null))  // move id per band slot
  /**
   * Why each empty slot is empty, from the SAME `resolveLoadout` pass that filled `castLoadoutRef`
   * (`no-move` / `cleared` / `dropped`; null on a bound slot). This host predates `engine/cast-dispatch`
   * and still dispatches inline, so it carried the engine's old false clause — *"your book has none
   * for your runes"* — as its own literal. Same lie, second copy; see `CastEnv.emptyWhy` for the cost.
   */
  const castWhyRef = useRef<(EmptyReason | null)[]>(ALL_BANDS.map(() => null))
  const castCdRef = useRef<number[]>(ALL_BANDS.map(() => 0))   // per-slot ready-at wall clock (ms)
  const pendingCastRef = useRef<CastSpec | null>(null)  // a projectile waiting for FiringRange to spawn it
  // the HELD stance (slot 0). Its effects are read live by the sim; holding it pauses mana recovery.
  const stanceRef = useRef<CastSpec | null>(null)
  const resistRef = useRef(0)     // incoming damage absorbed by the stance
  const castMultRef = useRef(1)   // stance multiplier on cast damage
  // Tremor Sense. `senseRadiusRef` is set from the worn passive exactly where resist/castMult are —
  // one place decides what the stance grants, so a new stance field cannot be wired in only half the
  // sites. `tremorRef` is the scene→HUD bridge; nothing else may write it.
  const senseRadiusRef = useRef(0)
  const tremorRef = useRef<TremorReadout>(emptyReadout())
  const stanceMoveRef = useRef(1) // stance multiplier on move speed
  const surgeRef = useRef({ until: 0, mult: 1 })  // Static Burst — a short self-buff window
  const infusionRef = useRef({ until: 0, mult: 1 })  // Flame Infusion — a WEAPON-damage window
  // ── the three systems. All three live as refs on the parent so the walker (collision) and the
  // sim (effects + render) read ONE source; neither owns them. ──
  const fieldsRef = useRef<Field[]>([])          // SYSTEM 1 — persistent area entities
  const conjuredRef = useRef<Conjured[]>([])     // SYSTEM 2 — runtime terrain
  const holdRef = useRef<HoldState | null>(null)  // THE HOLD's run — set on entering its zone, cleared on leaving
  const statusRef = useRef<StatusBag>(emptyBag())  // SYSTEM 3 — options removed from enemies
  const [castHud, setCastHud] = useState<{ slots: (string | null)[]; stance: string | null }>({ slots: ALL_BANDS.map(() => null), stance: null })

  // The walker is public; the terrain editor is owner-only. ather.games has no cloud auth, so owner
  // status comes from the httpOnly `ather_owner` cookie via /api/owner (set it at /owner?key=OWNER_KEY).
  const [isOwner, setIsOwner] = useState(false)
  const isOwnerRef = useRef(isOwner); isOwnerRef.current = isOwner  // stable read for onWarp's owner-only gate
  // Weapon (outside-Ather only): drawn when the current zone's realm is 'outside'. firingRef bridges
  // the DOM click → the FiringRange useFrame (which spawns from the live camera). Spirits stay holstered.
  // Armed only where the realm is outside the Ather AND the zone isn't a town — Rune Hold is
  // outside (spirits dormant) but peaceful, so the manabox stays holstered in the square.
  const weaponDrawn = zone.realm === 'outside' && !zone.peaceful
  const weaponDrawnRef = useRef(weaponDrawn); weaponDrawnRef.current = weaponDrawn
  const firingRef = useRef(false)  // held while left-click is down → FiringRange auto-fires at the cadence
  const shotsRef = useRef(0)   // hot-path counters live in refs — NO per-shot/per-hit React re-render
  const hitsRef = useRef(0)
  const casterRef = useRef<HTMLDivElement>(null)  // viewmodel node; recoil kicked imperatively (no key remount)
  const [hudStats, setHudStats] = useState({ shots: 0, hits: 0 })  // display only, synced on a throttle
  const adsRef = useRef(false)  // aim-down-sights (right-click hold); CameraRig reads it for fov + sensitivity
  const [ads, setAds] = useState(false)  // drives the viewmodel raise (toggles ~twice per aim, not per-frame)
  const recoilRef = useRef({ p: 0, y: 0 })  // pending camera kick (rad); FiringRange writes, CameraRig drains
  const bloomRef = useRef(0)  // current spread bloom (deg); FiringRange writes, WeaponReticle reads
  const hpRef = useRef(MAX_HP)        // player HP/shield — combat sim writes, ResourceBars reads
  const shieldRef = useRef(MAX_SHIELD)
  const shieldMaxRef = useRef(MAX_SHIELD)  // birth-rune hook: Barrier/Stone (defense) sets MAX_SHIELD + shieldBonus
  const hpMaxRef = useRef(MAX_HP)          // birth-rune hook: Life (vitality) sets MAX_HP + hpBonus. Mirrors shieldMaxRef.
  // Resolve the birth rune → its v1 affinity and push the flat caps (hp/shield). speed/mana/gather
  // read affinityRef live at their own hooks. Called on mount (returning keeper) and on choose.
  const applyAffinity = useCallback(() => {
    const a = birthAffinity(birthRuneRef.current)
    affinityRef.current = a
    shieldMaxRef.current = MAX_SHIELD + a.shieldBonus
    hpMaxRef.current = MAX_HP + a.hpBonus
  }, [])
  // Re-derive the loadout from the runes held. Called on load and whenever the inventory changes.
  // Any stance held through the change is dropped — you cannot keep holding a move you no longer own.
  //
  // ★ The keeper's CHOICE outranks the starting kit (2026-08-12). This used to call
  // `defaultLoadout` unconditionally, which recomputed the automatic kit on every load and every
  // inventory change — so a keeper could never pick a loadout, only receive one. `loadLoadout`
  // returns the saved choice when there is one and the same default kit when there is not, and it
  // re-validates every bind against the runes held NOW. That last part is what keeps this call site
  // correct on a rune change: a move whose rune just went away comes back null rather than staying
  // bound, which is exactly the drop this function already promises for stances.
  /** What this keeper has LEARNED. Re-read by `applyLoadout`; written by a Passage purchase. */
  const bookRef = useRef<Book>(EMPTY_BOOK)
  /** The scroll rack, open. Holds the instant it opened so the stock cannot rotate under the cursor. */
  const [rackOpen, setRackOpen] = useState<number | null>(null)
  /** which stall opened the Passage panel: its shelves + name. Null = every shelf (the `/market` door). */
  const [rackStall, setRackStall] = useState<{ shelves: ShelfKey[]; title: string } | null>(null)
  /** the arcade cabinet a keeper is stood at, coin plate or game up */
  const [cabinet, setCabinet] = useState<GameEntry | null>(null)
  const applyLoadout = useCallback(() => {
    // The book is re-read here rather than held from mount: this runs on every rune change, and a
    // scroll bought in the Passage between two rune changes must be in hand by the next resolve.
    bookRef.current = keeperBook(runeInvRef.current.owned)
    const res = resolveLoadout(runeInvRef.current.owned, runeInvRef.current.birth, bookRef.current)
    castLoadoutRef.current = res.slots
    castWhyRef.current = res.why
    castCdRef.current = ALL_BANDS.map(() => 0)
    // The passive is always-on and DERIVED (capped at one), never cast — since Alex's 2026-08-26
    // ruling it holds no key, so it is applied HERE from the runes rather than set by a keypress. Its
    // resist / castMult / moveMult live from load; a null passive leaves the neutral refs.
    const pspec = (() => { const p = derivePassive(runeInvRef.current.owned, runeInvRef.current.birth, bookRef.current); return p ? castForMove(p.id) : null })()
    stanceRef.current = pspec; resistRef.current = pspec?.resist ?? 0; castMultRef.current = pspec?.castMult ?? 1; stanceMoveRef.current = pspec?.moveMult ?? 1
    senseRadiusRef.current = pspec?.senseRadius ?? 0
    surgeRef.current = { until: 0, mult: 1 }; infusionRef.current = { until: 0, mult: 1 }
    fieldsRef.current = []; conjuredRef.current = []; statusRef.current = emptyBag()
    setCastHud({ slots: castLoadoutRef.current, stance: pspec?.moveId ?? null })
  }, [])
  useEffect(() => {
    const inv = loadRuneInventory()
    runeInvRef.current = inv
    birthRuneRef.current = inv.birth
    applyAffinity()
    applyLoadout()
    // The boot gate births first-entry keepers now, so the "Born of X" greeting would be lost with
    // the modal that used to set it. It hands the rune over in a one-shot key instead — read and
    // cleared here, after the affinity resolves, so the banner can quote it. Storage rather than a
    // module flag on purpose: page.tsx and this component are separate code-split chunks and do not
    // share module state (measured 2026-08-07 — a `wasJustReset` flag never arrived).
    try {
      const bornWith = localStorage.getItem('ather:shimmer:justBorn')
      if (bornWith) {
        localStorage.removeItem('ather:shimmer:justBorn')
        const rn = RUNES.find(r => r.id === bornWith)?.name ?? 'your rune'
        // Half the carousel currently opens a book with no move the sim can run — that is the real
        // authoring gap (moves.md), so the banner tells the truth instead of promising a cast.
        const bound = loadLoadout(inv.owned, inv.birth, bookRef.current).filter((m) => m && isBuilt(m)).length
        const castHint = bound > 0 ? ` · ${bound} move${bound > 1 ? 's' : ''} in hand (Z/C)` : ''
        setBanner(`Born of ${rn} — ${affinityRef.current.label || 'find Gregory in the glade'}${castHint}`)
      }
    } catch { /* private mode — no greeting, but the keeper still plays */ }
  }, [applyAffinity, applyLoadout])
  const ammoRef = useRef<number>(WEAPONS[0].clip)   // the LIVE weapon's clip; FiringRange decrements, AmmoCounter reads
  const reloadingRef = useRef(0)      // >0 while the recharge channel runs
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ── weapon slots: 0 = Riser sidearm, 1 = Lance primary. Q swaps, F holsters (stow → full run speed).
  // ── LOADOUT: two slots, each holding any arsenal weapon (built at a gun bench). Q swaps the active
  // slot; benches reassign a slot from the full arsenal. weaponIdxRef stays the DERIVED active weapon
  // index (= loadout[slot]) so the sim/HUD read one source; it's re-pointed whenever slot/loadout change.
  const loadoutRef = useRef<number[]>([0, 1])   // [slot0 weapon idx, slot1 weapon idx] — default Spitter + Lance
  const slotRef = useRef(0)                      // active loadout slot (0 or 1)
  const weaponIdxRef = useRef(0)                 // DERIVED: loadoutRef.current[slotRef.current]
  const holsteredRef = useRef(false)  // stowed → no fire/ADS, full move speed (weaponMoveRef = 1)
  const ammoStashRef = useRef<number[]>([WEAPONS[0].clip, WEAPONS[1].clip])  // per-SLOT magazines; swap parks/loads them
  const [weaponUi, setWeaponUi] = useState<{ idx: number; holstered: boolean }>({ idx: 0, holstered: false })  // drives viewmodel + HUD label
  const [loadoutUi, setLoadoutUi] = useState<number[]>([0, 1])  // mirrors loadoutRef for the bench panel render
  const hitmarkRef = useRef<HTMLDivElement>(null)   // × flash at the reticle on a landed round
  const vignetteRef = useRef<HTMLDivElement>(null)  // red edge flash when the player takes damage
  const onRangeHit = useCallback((crit: boolean) => {
    hitsRef.current++
    const el = hitmarkRef.current
    if (el) {
      el.style.setProperty('--hm', crit ? S.gun.hitmarkCrit : S.gun.hitmark)  // gold ticks on a headshot
      el.style.animation = 'none'; void el.offsetHeight; el.style.animation = 'hitFlash 0.22s ease-out'
    }
  }, [])
  const onPlayerDamage = useCallback(() => {
    const el = vignetteRef.current
    if (el) { el.style.animation = 'none'; void el.offsetHeight; el.style.animation = 'dmgFlash 0.45s ease-out' }
  }, [])
  const onPlayerDown = useCallback(() => {
    const el = vignetteRef.current
    if (el) { el.style.animation = 'none'; void el.offsetHeight; el.style.animation = 'downFlash 1s ease-out' }
    // in the hold a fall ENDS the run (the range just resets you). The record is the round reached.
    const hs = holdRef.current
    if (hs?.running) {
      const r = endHold(hs)
      try { if (r.round > Number(localStorage.getItem(keeperKey(HOLD_BEST_KEY)) ?? 0)) localStorage.setItem(keeperKey(HOLD_BEST_KEY), String(r.round)) } catch { /* no storage: no record */ }
    }
  }, [])
  // called by FiringRange per actual spawn (full-auto): bump the counter + kick the recoil, no re-render
  const onRangeShot = useCallback(() => {
    shotsRef.current++
    const el = casterRef.current
    if (el) { el.style.animation = 'none'; void el.offsetHeight; el.style.animation = 'casterKick 0.13s ease-out' }
  }, [])
  // Sync the HUD counters at ~5fps while the weapon is out, so firing never touches the (huge) component's
  // render path — that churn was stuttering the movement rAF. Reset counters when the weapon holsters.
  useEffect(() => {
    if (!weaponDrawn) {
      shotsRef.current = 0; hitsRef.current = 0; setHudStats({ shots: 0, hits: 0 }); firingRef.current = false; adsRef.current = false; setAds(false)
      recoilRef.current.p = 0; recoilRef.current.y = 0; bloomRef.current = 0; hpRef.current = hpMaxRef.current; shieldRef.current = shieldMaxRef.current
      // Leaving the outside realm: reset combat state to slot 0 with full mags, drop the movement
      // penalty to 1 (inside-Ather walking is never slowed by a stale weapon state). The bench-built
      // LOADOUT is PRESERVED (loadoutRef survives) so a configured loadout carries across Crucible visits.
      slotRef.current = 0; holsteredRef.current = false
      const w0 = loadoutRef.current[0], w1 = loadoutRef.current[1]
      weaponIdxRef.current = w0
      ammoRef.current = WEAPONS[w0].clip; ammoStashRef.current = [WEAPONS[w0].clip, WEAPONS[w1].clip]; reloadingRef.current = 0
      weaponMoveRef.current = 1; setWeaponUi({ idx: w0, holstered: false }); setLoadoutUi([w0, w1])
      if (reloadTimer.current) { clearTimeout(reloadTimer.current); reloadTimer.current = null }
      return
    }
    // entered the outside realm → the weapon draws; apply its hip movement penalty right away.
    // Inlined (not syncWeaponMove()) on purpose: this effect is defined ABOVE that helper, so naming it
    // in the dep array would be a TDZ crash at render. Fresh entry = drawn, not holstered, not aiming.
    weaponMoveRef.current = holsteredRef.current ? 1 : WEAPONS[weaponIdxRef.current].hipMove
    const id = setInterval(() => setHudStats((s) => (s.shots === shotsRef.current && s.hits === hitsRef.current) ? s : { shots: shotsRef.current, hits: hitsRef.current }), 200)
    return () => clearInterval(id)
  }, [weaponDrawn])
  useEffect(() => {
    let alive = true
    fetch('/api/owner', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { owner: false }))
      .then((d) => { if (alive && d.owner) setIsOwner(true) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  // ── Inventory (satchel) open/close, hijacking the mouse while it's up ──────────────────────────
  // First-person play captures the pointer, so the satchel's drag-and-drop is unreachable mid-play.
  // Opening the bag RELEASES the pointer (free cursor to click/drag); closing hands look back.
  // Runs through the shared mouse handoff (openCursorUI/closeCursorUI) so every cursor surface in
  // the game behaves identically. Bag state lives here (not in HotBar) so the "I" key and the
  // pointer-lock toggle stay in one place.
  const [bagOpen, setBagOpen] = useState(false)
  const bagOpenRef = useRef(false); bagOpenRef.current = bagOpen
  const toggleBag = useCallback((open: boolean) => {
    setBagOpen(open)
    // Same handoff as the station menus — and via openCursorUI rather than a bare relock, so a
    // player who was already cursor-free doesn't get the mouse seized on close.
    if (open) openCursorUI(); else closeCursorUI()
  }, [openCursorUI, closeCursorUI])
  // "I" toggles the bag (not while a blocking overlay owns the screen); Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'i') {
        // battleRef.current = walker frozen by a station menu / rinning / placing; curBattleRef = real battle
        if (editRef.current || battleRef.current || curBattleRef.current || dialogueRef.current) return
        if (zoneIdRef.current === HOLD_ZONE) return  // no bag in the hold — nothing was carried in
        e.preventDefault(); toggleBag(!bagOpenRef.current)
      } else if (k === 'escape' && bagOpenRef.current) { e.preventDefault(); toggleBag(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleBag])
  // ── The options frame (O / Esc / the ☰ door). The panel's own close button reads "esc / O", and
  // on this side neither key did anything — the frame was click-only, and it never borrowed the
  // mouse, so opening it by the door left the pointer wherever the last surface had put it. Same
  // handoff as the bag now. ⚠ The rows that hand off to a SUB-PANEL (skills / party / book / gfx)
  // keep a plain `setMenuOpen(false)` on purpose: closeOptions relocks the pointer, and a relock under
  // a panel that is just opening is a panel you cannot click.
  const menuOpenRef = useRef(false); menuOpenRef.current = menuOpen
  const birthOpenRef = useRef(false); birthOpenRef.current = birthOpen  // the rune choice owns the screen
  const openOptions = useCallback(() => {
    setMenuOpen(true); setSkillsOpen(false); setMpOpen(false); setGfxOpen(false); setBookOpen(false)
    openCursorUI()
  }, [openCursorUI])
  const closeOptions = useCallback(() => { setMenuOpen(false); setConfirmNew(false); closeCursorUI() }, [closeCursorUI])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'o') {
        if (menuOpenRef.current) { e.preventDefault(); closeOptions(); return }
        if (editRef.current || battleRef.current || curBattleRef.current || dialogueRef.current || bagOpenRef.current || birthOpenRef.current) return
        e.preventDefault(); openOptions()
      } else if (k === 'escape' && menuOpenRef.current) { e.preventDefault(); closeOptions() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openOptions, closeOptions])
  // ── Party panel (P) — the lineup. Same ownership rule as the bag: state lives here so the key,
  // the pointer-lock handoff and the HotBar button can never disagree about whether it's open.
  // partyTick forces a re-render after a mend, since the party is a ref mutated in place.
  const [partyOpen, setPartyOpen] = useState(false)
  // The plot ring's interact target: nearest resting spirit within reach, derived on the
  // same 400ms cadence and the same pure-position math the renderer uses.
  const [nearPlotSpirit, setNearPlotSpirit] = useState<Spirit | null>(null)
  const nearPlotSpiritRef = useRef<Spirit | null>(null); nearPlotSpiritRef.current = nearPlotSpirit
  const partyInitialSelRef = useRef<string | null>(null)
  useEffect(() => {
    const iv = setInterval(() => {
      const clear = () => setNearPlotSpirit(prev => (prev === null ? prev : null))
      if (battleRef.current || editRef.current || dialogueRef.current) { clear(); return }
      const zid = zoneIdRef.current
      if (!PLOT_ZONES.has(zid)) { clear(); return }
      const pos = posRef.current
      if (!pos) { clear(); return }
      const zone = getZone(ALL_ZONES, zid)
      const ax = zone?.playerStart?.tileX ?? 16, az = zone?.playerStart?.tileY ?? 16
      const now = Date.now()
      let best: Spirit | null = null, bestD = 2.1 * 2.1
      for (const sp of restingSpirits(partyRef.current ?? [])) {
        const built = plotSpiritLoop(sp, ax, az, gridRef.current)
        const pose = patrolPose(built.loop, built.c.x, built.c.z, now, PLOT_WIN)
        const dx = pos.x - pose.x, dz = pos.z - pose.y
        const d = dx * dx + dz * dz
        if (d < bestD) { bestD = d; best = sp }
      }
      setNearPlotSpirit(prev => (prev?.id === best?.id ? prev : best))
    }, 400)
    return () => clearInterval(iv)
  }, [])

  const partyOpenRef = useRef(false); partyOpenRef.current = partyOpen
  const [partyTick, setPartyTick] = useState(0)
  const toggleParty = useCallback((open: boolean) => {
    setPartyOpen(open)
    if (open) { setPartyTick(t => t + 1); openCursorUI() } else closeCursorUI()
  }, [openCursorUI, closeCursorUI])
  // Greeting a wandering plot spirit = the party panel opening ON that spirit's dossier.
  const greetPlotSpirit = useCallback((sp: Spirit) => {
    partyInitialSelRef.current = sp.id
    toggleParty(true)
  }, [toggleParty])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'p') return
      if (editRef.current || battleRef.current || curBattleRef.current || dialogueRef.current) return
      e.preventDefault(); toggleParty(!partyOpenRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleParty])

  // Spend a salve on ONE named spirit — the deliberate counterpart to the hotbar's auto-pick
  // (which takes the worst-off). Reviving a downed spirit also mends it with the same salve,
  // or the item would be spent putting something on its feet at a sliver.
  /**
   * Take any second form the party is owed, one at a time.
   *
   * ⚠ ASKED OF THE WHOLE PARTY, NOT OF THE SPIRIT THAT JUST CHANGED, and asked at every moment that
   * could have made one due — after a fight's XP and after a pour. `pendingEvolution` is a STANDING
   * condition precisely so this can be a sweep: a spirit that crossed level 34 un-infused months ago
   * is owed its form the instant the pour lands, and nothing about that pour knows it was the last
   * thing missing.
   *
   * ⚠ ONE AT A TIME. Two spirits crossing together would otherwise race one overlay; the second is
   * still owed and the next sweep takes it.
   */
  const runEvolutions = useCallback(() => {
    for (const s of partyRef.current ?? []) {
      const due = pendingEvolution(s)
      if (!due) continue
      evolveSpirit(s)
      persist()
      setPartyTick(t => t + 1)
      setEvolving({ spirit: s, evolution: due })
      return
    }
  }, [persist])

  /**
   * ── ★ POURING AN INFUSION (#262 slice ③, 2026-08-18) ────────────────────────────────────────
   * Mirrors `mendSpirit` exactly, because it is the same shape: spend one bottle from the satchel
   * on one spirit, tell the keeper, persist. The rules all live in `applyInfusion` — this only
   * routes the answer to a toast and writes the save.
   *
   * ⚠ THE SAVE IS WRITTEN ONLY ON SUCCESS, and `applyInfusion` removes the bottle only on success
   * too, so a refusal is genuinely a no-op on both sides. A refusal that persisted a half-change is
   * how a keeper loses a tier-2 brew to a button that "did nothing".
   */
  const infuseSpirit = useCallback((spirit: Spirit, element: Exclude<Element, 'base'>) => {
    const r = applyInfusion(invRef.current, spirit, INFUSION_BREWS[element])
    if (!r.ok) {
      setHarvestToast(
        r.reason === 'none-in-bag' ? `No ${element} infusion in the satchel`
        : r.reason === 'element-full' ? `${spirit.name} will hold no more ${element}`
        : r.reason === 'spirit-full' ? `${spirit.name} has taken all the infusion they can hold`
        : 'That is not an infusion')
      return
    }
    setInvSlots([...invRef.current.slots])
    setPartyTick(t => t + 1)
    setHarvestToast(`${spirit.name} takes the ${element} infusion · ${r.inElement} ${element}, ${r.total}/11`)
    persist()
    // ★ The pour may have been the last thing missing — a spirit sitting past 34 with no lean, or
    // with a tie this bottle just broke. Ask immediately; the keeper poured to make this happen.
    runEvolutions()
  }, [persist, runEvolutions])

  const mendSpirit = useCallback((spirit: Spirit) => {
    const amount = SPIRIT_MEND_POTIONS[MEND_POTION_ID]
    if (!amount) return
    if (countItem(invRef.current, MEND_POTION_ID) < 1) { setHarvestToast('No Shimmer Salve in the satchel'); return }
    const wasDowned = isDowned(spirit)
    if (wasDowned) reviveSpirit(spirit)
    const healed = healSpirit(spirit, amount)
    if (!wasDowned && healed <= 0) { setHarvestToast(`${spirit.name} is unhurt`); return }
    removeItems(invRef.current, MEND_POTION_ID, 1)
    setInvSlots([...invRef.current.slots])
    setPartyTick(t => t + 1)
    setHarvestToast(wasDowned
      ? `${spirit.name} is back on its feet · ${currentHpOf(spirit)}/${maxHpOf(spirit)}`
      : `${spirit.name} mended · ${currentHpOf(spirit)}/${maxHpOf(spirit)}`)
    persist()
  }, [persist])

  // Lead order is load-bearing, not cosmetic: a wiped party recovers its LEAD (spirit-health's
  // anti-softlock valve), and the lineup is the order spirits take the field in.
  // Takes the SPIRIT, not an index: the panel shows two lists that reorder under it, so an index
  // into "the active party" is not an index into `partyRef` and would move the wrong one.
  const setPartyLead = useCallback((spirit: Spirit) => {
    const owned = partyRef.current
    if (!owned) return
    const at = owned.indexOf(spirit)
    if (at < 0) return
    owned.splice(at, 1)
    owned.unshift(spirit)
    spirit.inParty = true
    setPartyTick(t => t + 1)
    setHarvestToast(`${spirit.name} leads the party`)
    persist()
  }, [persist])

  // Send a spirit to rest at the Home Plot, or call one back. The engine owns the rules (cap,
  // never-empty-the-lineup) and hands back a reason string when it refuses.
  const setSpiritActiveIn = useCallback((spirit: Spirit, active: boolean) => {
    const owned = partyRef.current
    if (!owned) return
    const refused = setSpiritActive(owned, spirit, active, MAX_PARTY)
    if (refused) { setHarvestToast(refused); return }
    setPartyTick(t => t + 1)
    setHarvestToast(active ? `${spirit.name} joins you` : `${spirit.name} stays at the Home Plot`)
    persist()
  }, [persist])

  // ── Range console (T, weapon out only) — new-player controls for the firing range: target drift,
  // hostile ground hunter, stats reset. Same cursor dance as the satchel: open frees the pointer,
  // close re-locks. Settings live in a ref so FiringRange reads them at frame rate with no re-render.
  const [rangeOpen, setRangeOpen] = useState(false)
  /** the Crucible match HUD line, or null outside a match. Set only when the string changes. */
  const [matchHud, setMatchHud] = useState<string | null>(null)
  // ── ⚠⚠ CLEARED ON ZONE CHANGE, AND IT HAS TO BE HERE RATHER THAN IN THE FRAME LOOP ──────────
  // Found by walking out of the Crucible and watching "THE CITY · 2:29" keep counting down in the
  // home plot (2026-09-06). `FiringRange` emits this line, and it MOUNTS ONLY IN AN OUTDOOR,
  // NON-PEACEFUL ZONE — so leaving the arena unmounts the one thing that could ever clear it. The
  // line's own latch is correct and irrelevant: `onMatch(null)` would fire on the frame the match
  // ended, and there are no more frames.
  // ★ The general shape, and it is this session's own lesson wearing UI: state whose clearing
  // depends on a consumer that has just been removed. A value that only one component can retract
  // outlives that component, and looks exactly like a live reading.
  useEffect(() => { setMatchHud(null) }, [zoneId])
  const rangeOpenRef = useRef(false); rangeOpenRef.current = rangeOpen
  const [rangeCfg, setRangeCfg] = useState<RangeCfg>({
    moving: false, hostile: false, guards: false, bots: false,
    // a COPY, never the module object: the sliders write to this and GUARD_TUNING is the
    // shipped default the oracle asserts against. Sharing one object would let a drag in the
    // console silently redefine what "default" means for the rest of the session.
    tune: { ...GUARD_TUNING },
  })
  const rangeCfgRef = useRef(rangeCfg); rangeCfgRef.current = rangeCfg
  const toggleRange = useCallback((open: boolean) => {
    setRangeOpen(open)
    if (open) openCursorUI(); else closeCursorUI()
  }, [openCursorUI, closeCursorUI])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 't') {
        if (!weaponDrawnRef.current || editRef.current || battleRef.current || curBattleRef.current || dialogueRef.current || benchOpenRef.current) return
        e.preventDefault(); toggleRange(!rangeOpenRef.current)
      } else if (k === 'escape' && rangeOpenRef.current) { e.preventDefault(); toggleRange(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleRange])
  // Holstering (leaving the outside realm) closes the console and resets the range to peaceful
  // defaults. `tune` deliberately SURVIVES: what this reset exists for is that danger is never
  // sprung on you on re-entry, and a slider position is not danger. Wiping it would also mean a
  // tuning pass lost its numbers every time you walked back through the station door, which is
  // the exact loop this panel was built to make cheap.
  useEffect(() => {
    if (!weaponDrawn) { setRangeOpen(false); setRangeCfg((c) => ({ ...c, moving: false, hostile: false, guards: false })) }
  }, [weaponDrawn])
  // ── Gun bench (the armory) — walk up to a GUN_BENCH (E) to open the loadout editor. Proximity is
  // polled off posRef (benches are static; a 200ms tick is plenty). Opening releases the cursor via the
  // shared handoff, same as the range console / stations.
  const [benchOpen, setBenchOpen] = useState(false)
  const benchOpenRef = useRef(false); benchOpenRef.current = benchOpen
  // ── the hands' signal, from this side's own verbs. Refs only, so the callback is stable and the
  //    Canvas child never re-renders for it. The focus comes up only while a channel runs (the
  //    Ather's rule: a tool with the work, never on aim); the rod stays out while the line is. ──
  const handsWasAirborne = useRef(false); const handsLastVy = useRef(0)
  const feedHands = useCallback(() => {
    const sg = hands.sig, b = bodyOut.current
    const ch = channelRef.current, fs = fishRef.current
    sg.family = ch ? getNodeSkill(ch.node.type) : fs ? 'rinning' : null
    sg.tier = 0
    sg.breaking = !!ch
    sg.hidden = editRef.current || !!curBattleRef.current || !!dialogueRef.current || bagOpenRef.current || menuOpenRef.current
      || birthOpenRef.current || !!openMenuRef.current || rangeOpenRef.current || benchOpenRef.current
    // the fist: a placeable being placed, else the selected slot if it is one
    const pl = placingRef.current?.itemId ?? invRef.current.slots[selSlotRef.current]?.itemId
    const pdef = pl ? PLACEABLES[pl] : undefined
    sg.held = pdef ? { colour: parseInt(pdef.color.slice(1), 16), piece: true } : null
    // the body, and the landing edge
    if (handsWasAirborne.current && !b.airborne && !b.hanging) { sg.landAt = performance.now(); sg.landVy = Math.max(0, -handsLastVy.current) }
    handsWasAirborne.current = b.airborne; handsLastVy.current = b.vy
    sg.airborne = b.airborne; sg.sliding = b.sliding; sg.crouching = b.crouching; sg.climbing = b.climbing
    sg.hanging = b.hanging; sg.mantle = b.mantle; sg.wallCatch = false; sg.swimming = false
  }, [hands])
  const [nearBench, setNearBench] = useState(false)
  const nearBenchRef = useRef(false); nearBenchRef.current = nearBench
  const [benchSlot, setBenchSlot] = useState(0)  // which loadout slot the bench is assigning into
  useEffect(() => {
    // ★ no bench in the hold: the benches are placed by position, and one of them sits on the landing's
    // gallery gate — E there would open the arsenal and walk the bench loadout into an in-run-only fight
    if (!weaponDrawn || zoneId === HOLD_ZONE) { setNearBench(false); return }
    const tick = () => {
      const p = posRef.current
      if (!p) return
      let near = false
      for (const [bx, , bz] of GUN_BENCHES) {
        const dx = p.x - bx, dz = p.z - bz
        if (dx * dx + dz * dz <= BENCH_NEAR_R * BENCH_NEAR_R) { near = true; break }
      }
      setNearBench(n => n === near ? n : near)
    }
    tick(); const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [weaponDrawn, zoneId])
  const toggleBench = useCallback((open: boolean) => {
    if (open) setBenchSlot(slotRef.current)  // default the assign target to the weapon you're holding
    setBenchOpen(open)
    if (open) openCursorUI(); else closeCursorUI()
  }, [openCursorUI, closeCursorUI])
  // close the bench if the player leaves the range or a blocking mode takes over
  useEffect(() => { if (benchOpen && (!weaponDrawn || editMode || battle || dialogue)) toggleBench(false) }, [benchOpen, weaponDrawn, editMode, battle, dialogue, toggleBench])
  // ── Clip recharge (R, or a dry trigger) — the clip refills FROM MANA: RELOAD_MANA for a full clip,
  // partial recharges cost proportionally. Low mana = a short clip; none = drink a draught first.
  // The weapon runs on the same resource economy as the tools — nothing in the Crucible is free.
  const dryToastAt = useRef(0)
  const startReload = useCallback(() => {
    const W = WEAPONS[weaponIdxRef.current] ?? WEAPONS[0]   // recharge the LIVE weapon's clip
    if (!weaponDrawnRef.current || holsteredRef.current || reloadingRef.current > 0 || ammoRef.current >= W.clip) return
    const missing = W.clip - ammoRef.current
    const rounds = Math.min(missing, Math.floor((manaRef.current.current / W.reloadMana) * W.clip))
    if (rounds < 1) {
      const t = performance.now()  // dry-fire calls this every 0.25s — don't toast-spam
      if (t - dryToastAt.current > 1500) { dryToastAt.current = t; setHarvestToast('No mana to recharge — drink a Mana Draught') }
      return
    }
    reloadingRef.current = 1
    const el = casterRef.current
    if (el) { el.style.animation = 'none'; void el.offsetHeight; el.style.animation = `casterReload ${W.reloadTime}s ease-in-out` }
    reloadTimer.current = setTimeout(() => {
      reloadingRef.current = 0
      ammoRef.current = Math.min(W.clip, ammoRef.current + rounds)
      manaRef.current.current = Math.max(0, manaRef.current.current - (W.reloadMana * rounds) / W.clip)
      setManaFrac(manaRef.current.current / manaMax())
    }, W.reloadTime * 1000)
  }, [])
  // A healing field restores the player from inside the sim; HP + its cap live out here.
  const healPlayer = useCallback((amount: number) => {
    hpRef.current = Math.min(hpMaxRef.current, hpRef.current + amount)
  }, [])
  // Spend mana for one cast, or refuse.
  const dryCastToastAt = useRef(0)
  const tryCast = useCallback((cost: number): boolean => {
    if (manaRef.current.current < cost) {
      const t = performance.now()  // don't toast-spam a mashed cast key
      if (t - dryCastToastAt.current > 1500) { dryCastToastAt.current = t; setHarvestToast('Not enough mana to cast') }
      return false
    }
    manaRef.current.current = Math.max(0, manaRef.current.current - cost)
    setManaFrac(manaRef.current.current / manaMax())
    return true
  }, [])
  // ── weapon-state → movement mult, and the swap / holster actions. syncWeaponMove is the single rule:
  // holstered or inside-Ather = full speed; drawn = the weapon's hip mult; aiming = its (lower) ADS mult.
  const syncWeaponMove = useCallback(() => {
    weaponMoveRef.current = (!weaponDrawnRef.current || holsteredRef.current) ? 1
      : adsRef.current ? WEAPONS[weaponIdxRef.current].adsMove
      : WEAPONS[weaponIdxRef.current].hipMove
  }, [])
  // ── THE CAST DISPATCH: slot → move → archetype ────────────────────────────────────────────────
  // One entry point for every bound key. It resolves the slot's move, gates on cooldown + mana, then
  // runs the archetype. SELF archetypes (stance/restore/surge/infusion) complete right here — they
  // touch hp/mana/speed, which live in this component. PLACED archetypes (projectile/field/terrain/
  // status) are handed to the sim via pendingCastRef, because only the frame loop has the live
  // camera, and every one of them needs an aim point.
  //
  // An 'unbuilt' move SAYS SO. Canon has 61 registered keeper moves and the sim can run 47 of them
  // (24/17 before the Great Registration, 2026-08-14); a silent no-op on the other 14 reads as a
  // broken cast, so the toast names the move and the reason. ⚠ Counts here are a comment and rot —
  // `cast.test.ts` prints the live pair on every run, which is the number to believe.
  const castSlot = useCallback((slot: number) => {
    const moveId = castLoadoutRef.current[slot]
    if (!moveId) {
      // A cause only when the resolve supplied one; a symptom alone otherwise. Never a guessed cause.
      const why = castWhyRef.current[slot]
      setHarvestToast(why ? emptySlotSentence(ALL_BANDS[slot], why) : `No ${ALL_BANDS[slot]} bound`)
      return
    }
    const spec = castForMove(moveId)
    if (spec.archetype === 'unbuilt') { setHarvestToast(`${spec.label} — not built yet (${spec.why})`); return }

    // A held stance toggles OFF for free and instantly; everything else waits out its cooldown.
    const now = performance.now()
    const isDroppingStance = spec.archetype === 'stance' && stanceRef.current?.moveId === moveId
    if (!isDroppingStance && now < castCdRef.current[slot]) return

    const syncStance = (s: CastSpec | null) => {
      stanceRef.current = s
      resistRef.current = s?.resist ?? 0
      castMultRef.current = s?.castMult ?? 1
      stanceMoveRef.current = s?.moveMult ?? 1
      senseRadiusRef.current = s?.senseRadius ?? 0
      syncWeaponMove()
      setCastHud((h) => ({ ...h, stance: s?.moveId ?? null }))
    }

    hands.sig.castAt = performance.now()
    switch (spec.archetype) {
      case 'stance': {
        // Canon (runes.md, the mana economy): holding a passive PAUSES mana recovery. That pause is
        // the cost — a stance is a stance, not a permanent state, and dropping it is always allowed.
        if (isDroppingStance) { syncStance(null); setHarvestToast(`${spec.label} released`); break }
        syncStance(spec)
        castCdRef.current[slot] = now + spec.cooldownMs
        setHarvestToast(`${spec.label} held — mana recovery paused`)
        break
      }
      // Everything PLACED goes down the same wire: pay, hand the spec to the sim, start the cooldown.
      // The sim resolves the aim point once, so a bolt, a firewall, a stonewall and a shackle all
      // land where you were looking by ONE rule instead of four.
      case 'projectile':
      case 'field':
      case 'terrain':
      case 'status': {
        if (!tryCast(spec.manaCost)) return
        pendingCastRef.current = spec
        castCdRef.current[slot] = now + spec.cooldownMs
        if (spec.archetype !== 'projectile') setHarvestToast(spec.label)
        break
      }
      case 'infusion': {
        if (!tryCast(spec.manaCost)) return
        infusionRef.current = { until: now + spec.surgeSecs * 1000, mult: spec.surgeMult }
        castCdRef.current[slot] = now + spec.cooldownMs
        setHarvestToast(`${spec.label} — your shots burn`)
        break
      }
      case 'restore': {
        if (hpRef.current >= (hpMaxRef.current ?? MAX_HP)) { setHarvestToast('Already whole'); return }
        if (!tryCast(spec.manaCost)) return
        hpRef.current = Math.min(hpMaxRef.current ?? MAX_HP, hpRef.current + spec.heal)
        castCdRef.current[slot] = now + spec.cooldownMs
        setHarvestToast(`${spec.label} — mended`)
        break
      }
      case 'surge': {
        if (!tryCast(spec.manaCost)) return
        surgeRef.current = { until: now + spec.surgeSecs * 1000, mult: spec.surgeMult }
        speedMultRef.current *= spec.surgeMult   // apply NOW; the 2 Hz tick re-derives it from surgeRef
        castCdRef.current[slot] = now + spec.cooldownMs
        setHarvestToast(spec.label)
        break
      }
    }
  }, [tryCast, syncWeaponMove])
  // Owner dev tool: swap the birth rune LIVE (affinity + book + loadout all re-resolve) without a New
  // Game wipe, so the whole cast system is testable from one save. Persists so a reload keeps the pick.
  const setDevRune = useCallback((id: string) => {
    const inv = setBirthRune(runeInvRef.current, id)
    runeInvRef.current = inv
    birthRuneRef.current = id
    saveRuneInventory(inv)
    try { localStorage.removeItem('ather:shimmer:birthPending') } catch { /* private mode */ }
    applyAffinity()
    applyLoadout()
    hpRef.current = hpMaxRef.current; shieldRef.current = shieldMaxRef.current  // reflect the new caps at once
    const rn = RUNES.find(r => r.id === id)?.name ?? id
    const bound = castLoadoutRef.current.filter((m) => m && isBuilt(m)).length
    setBanner(`⟳ dev · born of ${rn} — ${affinityRef.current.label} · ${bound} castable`)
    persist()
  }, [applyAffinity, applyLoadout, persist])
  // Owner dev tool: grant/drop a SECOND rune.
  //
  // ★ CORRECTED 2026-08-17 — this said "rune acquisition is an [OPEN] canon gap". It is RULED, and
  // was on 2026-08-03: *"a rune is identity: born, or trained off the birth rune (the lane law),
  // never bought"* (CANON_GAPS.md). What is missing is the BUILD — nothing implements the focused
  // practice that walks a keeper along their row/column — so this is a build gap wearing a canon
  // gap's label, and the label is the part that makes the next reader park instead of build it.
  // ⚠ The tool grants ANY rune, which the lane law would not: a real second rune must sit on the
  // birth rune's row or column. That is deliberate for testing the cross-hatch, and it is exactly
  // why it stays owner-only — it is not a preview of how acquisition will work.
  const toggleDevRune = useCallback((id: string) => {
    const held = runeInvRef.current.owned.includes(id)
    const inv = held ? revokeRune(runeInvRef.current, id) : grantRune(runeInvRef.current, id)
    if (inv === runeInvRef.current) return  // refused (the birth rune can't be dropped)
    runeInvRef.current = inv
    saveRuneInventory(inv)
    applyLoadout()
    setBanner(`⟳ dev · ${held ? 'dropped' : 'developed'} ${RUNES.find(r => r.id === id)?.name ?? id} · ${inv.owned.length} runes held`)
  }, [applyLoadout])
  // Q — swap the ACTIVE loadout slot (0↔1); each slot keeps its own weapon + magazine.
  const swapWeapon = useCallback(() => {
    if (!weaponDrawnRef.current) return
    const oldSlot = slotRef.current, newSlot = oldSlot === 0 ? 1 : 0
    ammoStashRef.current[oldSlot] = ammoRef.current   // park the current slot's magazine
    slotRef.current = newSlot
    const next = loadoutRef.current[newSlot]
    weaponIdxRef.current = next
    ammoRef.current = ammoStashRef.current[newSlot]    // load the new slot's magazine
    holsteredRef.current = false                       // drawing a weapon un-holsters
    if (reloadTimer.current) { clearTimeout(reloadTimer.current); reloadTimer.current = null }
    reloadingRef.current = 0
    syncWeaponMove()
    setWeaponUi({ idx: next, holstered: false })
  }, [syncWeaponMove])
  // Gun bench — assign an arsenal weapon into a loadout slot (fresh magazine). If it's the active slot,
  // it becomes the live weapon immediately. This is the only way to reach the arsenal beyond the two slots.
  const equipWeapon = useCallback((slot: number, arsenalIdx: number) => {
    if (slot < 0 || slot > 1 || arsenalIdx < 0 || arsenalIdx >= WEAPONS.length) return
    loadoutRef.current[slot] = arsenalIdx
    ammoStashRef.current[slot] = WEAPONS[arsenalIdx].clip   // new gun → fresh mag
    if (slot === slotRef.current) {
      weaponIdxRef.current = arsenalIdx
      ammoRef.current = WEAPONS[arsenalIdx].clip
      if (reloadTimer.current) { clearTimeout(reloadTimer.current); reloadTimer.current = null }
      reloadingRef.current = 0
      holsteredRef.current = false
      syncWeaponMove()
      setWeaponUi({ idx: arsenalIdx, holstered: false })
    }
    setLoadoutUi([...loadoutRef.current])
  }, [syncWeaponMove])
  // ── THE HOLD (GBOARD 🌊 SEASON EXPEDITIONS) ─────────────────────────────────────────────────
  // ★ ALL POWER IS IN-RUN: whatever the keeper built at a bench waits outside. Both slots become the
  // REPEATER (the sidearm everyone walks in with), the rack sells the next gun, and the bench loadout
  // comes back on the way out. The run itself is `hold.ts`; FiringRange steps it.
  const holdSavedLoadout = useRef<number[] | null>(null)
  const holdEHeld = useRef(false)
  const [holdHud, setHoldHud] = useState<{ round: number; salvage: number; hush: number; loud: boolean; surge: number; kills: number; over: boolean; prompt: HoldPrompt | null; best: number } | null>(null)
  const [holdFlash, setHoldFlash] = useState<string | null>(null)
  useEffect(() => { if (!holdFlash) return; const t = setTimeout(() => setHoldFlash(null), 2200); return () => clearTimeout(t) }, [holdFlash])
  const beginHold = useCallback(() => {
    holdRef.current = startHold(HOLD_MAP, (Date.now() & 0xffff) || 1)
    const rep = WEAPONS.findIndex(w => w.id === 'repeater')
    if (!holdSavedLoadout.current) holdSavedLoadout.current = [...loadoutRef.current]
    equipWeapon(0, rep); equipWeapon(1, rep)
    hpRef.current = hpMaxRef.current; shieldRef.current = shieldMaxRef.current
    manaRef.current.current = manaMax(); setManaFrac(1)
    setHoldFlash('Round 1')
  }, [equipWeapon])
  useEffect(() => {
    if (zoneId === HOLD_ZONE) { beginHold(); return }
    if (!holdRef.current && !holdSavedLoadout.current) return
    holdRef.current = null; holdEHeld.current = false; setHoldHud(null)
    // the hold's pool can sit above a new keeper's own; never walk out holding more than you can
    manaRef.current.current = Math.min(manaRef.current.current, manaMax()); setManaFrac(manaRef.current.current / manaMax())
    const saved = holdSavedLoadout.current
    holdSavedLoadout.current = null
    // the holster effect (declared earlier, so it ran first) re-pointed the live weapon at the run's
    // REPEATER; point it back at the bench loadout too, or slot 0 would read one gun and fire another
    if (saved) {
      loadoutRef.current = saved; slotRef.current = 0; weaponIdxRef.current = saved[0]
      ammoRef.current = WEAPONS[saved[0]].clip; ammoStashRef.current = [WEAPONS[saved[0]].clip, WEAPONS[saved[1]].clip]
      setLoadoutUi([...saved]); setWeaponUi({ idx: saved[0], holstered: false })
    }
  }, [zoneId, beginHold])
  // the HUD reads the run at ~7fps (never per frame — this component must not re-render per frame);
  // held-E mending ticks on the same clock, so a plank takes the same time at any frame rate
  useEffect(() => {
    if (zoneId !== HOLD_ZONE) return
    let lastRound = 1, lastKey = ''
    const DT = 0.15
    const id = setInterval(() => {
      const hs = holdRef.current, p = posRef.current
      if (!hs || !p) return
      const prompt = hs.running ? promptAt(hs, p.x, p.z, p.y / STEP) : null
      // boosters the run picked up: the sim queues them, the page applies them (it owns the mana)
      while (hs.pickups.length) {
        const kind = hs.pickups.shift()!
        if (kind === 'glimmer') { manaRef.current.current = manaMax(); setManaFrac(1) }
        setHoldFlash(DROP_NAME[kind])
      }
      if (holdEHeld.current && prompt?.kind === 'mend') mendTick(hs, prompt.win, DT)
      if (hs.round !== lastRound) { lastRound = hs.round; setHoldFlash(`Round ${hs.round}`) }
      let best = 0
      try { best = Number(localStorage.getItem(keeperKey(HOLD_BEST_KEY)) ?? 0) } catch { /* none */ }
      const next = { round: hs.round, salvage: hs.salvage, hush: Math.ceil(hs.hush), loud: isLoud(hs), surge: Math.round(hs.surge * 20) / 20, kills: hs.kills, over: hs.over, prompt, best }
      const key = JSON.stringify(next)
      if (key !== lastKey) { lastKey = key; setHoldHud(next) }
    }, DT * 1000)
    return () => clearInterval(id)
  }, [zoneId])
  useEffect(() => {
    if (zoneId !== HOLD_ZONE) return
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || editRef.current || dialogueRef.current) return
      const k = e.key.toLowerCase()
      const hs = holdRef.current, p = posRef.current
      if (!hs || !p) return
      if (k === 'g' && hs.running) {
        if (hs.surge < 1) { setHarvestToast('The surge is not charged — crush more of the flooded'); return }
        releaseSurge(hs, p.x, p.z, p.y / STEP); setHoldFlash('Surge')
        return
      }
      if (k !== 'e') return
      if (hs.over) { beginHold(); return }
      const pr = promptAt(hs, p.x, p.z, p.y / STEP)
      if (!pr) return
      if (pr.kind === 'mend') { holdEHeld.current = true; return }
      const short = () => setHarvestToast('Not enough salvage')
      if (pr.kind === 'gate') { if (buyGate(hs, pr.gate)) setHoldFlash('The gate opens'); else short() }
      else if (pr.kind === 'rack') {
        const got = buyRack(hs)
        const idx = WEAPONS.findIndex(w => w.id === HOLD_TUNING.rackWeapon)
        if (got === 'weapon') equipWeapon(slotRef.current, idx)
        else if (got === 'refill') {
          const slot = loadoutRef.current.indexOf(idx)
          if (slot === slotRef.current) ammoRef.current = WEAPONS[idx].clip
          else if (slot >= 0) ammoStashRef.current[slot] = WEAPONS[idx].clip
        } else short()
      } else if (pr.kind === 'font') {
        if (buyFont(hs)) { manaRef.current.current = manaMax(); setManaFrac(1) } else short()
      } else if (pr.kind === 'cache') { if (buyCache(hs)) setHoldFlash(`+${HOLD_TUNING.cacheSec}s hush`); else short() }
    }
    const onUp = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'e') holdEHeld.current = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [zoneId, beginHold, equipWeapon])
  const toggleHolster = useCallback(() => {
    if (!weaponDrawnRef.current) return
    const h = !holsteredRef.current
    holsteredRef.current = h
    if (h) { firingRef.current = false; adsRef.current = false; setAds(false) }  // stow drops fire + aim
    syncWeaponMove()
    setWeaponUi({ idx: weaponIdxRef.current, holstered: h })
  }, [syncWeaponMove])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r') return
      if (!weaponDrawnRef.current || editRef.current || battleRef.current || curBattleRef.current || dialogueRef.current) return
      e.preventDefault(); startReload()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startReload])
  // Q = swap weapon (Riser ⇄ Lance, also un-holsters), F = holster toggle (stow → run at full speed).
  // Both are inert unless a weapon is drawn (outside-Ather) and no menu/battle owns input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!weaponDrawnRef.current || editRef.current || battleRef.current || curBattleRef.current || dialogueRef.current || openMenuRef.current || placingRef.current || benchOpenRef.current) return
      const k = e.key.toLowerCase()
      if (k === 'q') { e.preventDefault(); swapWeapon() }
      else if (k === 'f') { e.preventDefault(); toggleHolster() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [swapWeapon, toggleHolster])
  // ── the binds: Z throws the tactical · C is the signature · G holds the stance ────────────────
  // One key per band slot, cast bar first then the stance sockets (BAND_KEYS). ★ Read BAND_KEYS, not
  // SLOT_KEYS: SLOT_KEYS covers the CAST BAR ONLY, so indexing with it silently makes G unbindable
  // and the held stance unreachable — the exact orphaning the stance band exists to prevent.
  // Digits are NOT usable here — the
  // hud bar owns 1-8 for item quick-slots and its listener is global. Same input-ownership guard as
  // the weapon keys. Holstered is fine: casting is your magic, not the weapon.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!weaponDrawnRef.current || editRef.current || battleRef.current || curBattleRef.current || dialogueRef.current || openMenuRef.current || placingRef.current || benchOpenRef.current || bagOpenRef.current) return
      const slot = BAND_KEYS.indexOf(e.key.toLowerCase())
      if (slot < 0) return
      e.preventDefault(); castSlot(slot)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [castSlot])
  // If a blocking mode takes over while the bag is open (battle/dialogue/edit/placing/reward), drop the
  // bag — those own the cursor themselves, so no re-lock (plain setBagOpen, not toggleBag).
  useEffect(() => { if (bagOpen && (battle || editMode || dialogue || placing || approach || rewards || openMenu)) setBagOpen(false) }, [bagOpen, battle, editMode, dialogue, placing, approach, rewards, openMenu])

  // Desktop interact key: E / Enter (or left-click) — advance dialogue, talk, harvest, open a station.
  // Space is JUMP, never an interact initiator (jumping next to an NPC/node/station used to fire it).
  // The one exception: Space still ADVANCES an open dialogue, where the walker is frozen so there's no
  // jump to collide with.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editMode || battle) return
      // A station menu is open: E and Escape CLOSE it, and the handoff gives look straight back.
      // This is the seamless half of the loop — open with E, craft, close with E, keep walking,
      // never touching the mouse to re-capture the camera.
      if (openMenuRef.current) {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'e') { e.preventDefault(); closeStation() }
        return
      }
      // Gun bench open: E and Escape close it, same seamless handoff as a station menu.
      if (benchOpenRef.current) {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'e') { e.preventDefault(); toggleBench(false) }
        return
      }
      const k = e.key.toLowerCase()
      if (k !== 'e' && k !== ' ' && k !== 'enter') return
      if (dialogueRef.current) { e.preventDefault(); advanceDialogue(); return }
      if (k === ' ') return  // Space outside dialogue = jump only; E/Enter initiate interactions
      if (nearBenchRef.current) { e.preventDefault(); toggleBench(true) }  // at a gun bench → open the armory
      else if (nearNpc) { e.preventDefault(); talk(nearNpc) }
      else if (nearPlotSpiritRef.current) { e.preventDefault(); greetPlotSpirit(nearPlotSpiritRef.current) }
      else if (fishRef.current || nearNodeRef.current || channelRef.current) { e.preventDefault(); toggleChannel() }
      else if (nearStationRef.current) { e.preventDefault(); openStation() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editMode, battle, nearNpc, advanceDialogue, talk, toggleChannel, openStation, closeStation, toggleBench])

  // ── Mouse-look controls (FPS model): once the pointer is CAPTURED (first canvas click locks it),
  //    left-click = interact with what's in front, right-click = use/place the selected hotbar item,
  //    scroll = cycle the hotbar (handled in HotBar). Before capture, the first click just locks — so
  //    we no-op unless pointerLockElement is set. Keyboard (E/Space/Enter) stays a parallel interact. ──
  useEffect(() => {
    // mousedown/mouseup, NOT pointerdown/pointerup: Pointer Events fire pointerdown only for the FIRST
    // button of a chord — a second button pressed while one is held arrives as pointermove. That made
    // ADS-hold (right) swallow fire (left). Mouse events fire per button, so aim+fire chords work.
    const onDown = (e: MouseEvent) => {
      if (editMode) return
      if (!(document.pointerLockElement instanceof Element)) return  // pre-capture click just locks; ignore (also gates out touch)
      // Aiming a build ghost: right-click plants it, left-click rotates it (Enter/arrows/Esc still work).
      if (placingRef.current) {
        e.preventDefault()
        if (e.button === 2) confirmPlacing()
        else if (e.button === 0) rotatePlacing()
        return
      }
      if (battleRef.current) return  // a menu/battle overlay owns input
      if (e.button === 0) {
        // outside the Ather with a weapon DRAWN (not holstered): left-click FIRES (the FiringRange's
        // useFrame reads firingRef). Holstered = weapon stowed, so left-click falls through to interact.
        if (weaponDrawnRef.current && !holsteredRef.current) { e.preventDefault(); firingRef.current = true; return }  // hold = auto / press = semi
        // interact — same priority ladder as the E key
        if (dialogueRef.current) advanceDialogue()
        else if (nearNpc) talk(nearNpc)
        else if (nearPlotSpiritRef.current) greetPlotSpirit(nearPlotSpiritRef.current)
        else if (fishRef.current || nearNodeRef.current || channelRef.current) toggleChannel()
        else if (nearStationRef.current) openStation()  // openStation owns the cursor handoff for every entry path
      } else if (e.button === 1) {
        // middle-click (scroll-wheel press) = use/place the selected hotbar item (moved off right-click)
        e.preventDefault()
        useItem(invRef.current.slots[selSlotRef.current]?.itemId)
      } else if (e.button === 2 && weaponDrawnRef.current && !holsteredRef.current) {
        // right-click HOLD = aim down sights (weapon only). Aiming slows you the most (syncWeaponMove).
        e.preventDefault(); adsRef.current = true; setAds(true); syncWeaponMove()
      }
    }
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) firingRef.current = false  // release = stop fire (also re-arms a semi-auto)
      if (e.button === 2 && adsRef.current) { adsRef.current = false; setAds(false); syncWeaponMove() }  // lower aim → back to hip speed
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('mouseup', onUp) }
  }, [editMode, nearNpc, advanceDialogue, talk, toggleChannel, openStation, useItem, confirmPlacing, rotatePlacing, syncWeaponMove])
  // Numpad0 = use the selected hotbar item (keyboard alt to middle-click). e.code (not e.key) so it
  // binds to the NUMPAD zero specifically — the number ROW / numpad digits still select slots.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editMode || battleRef.current) return
      if (e.code === 'Numpad0') { e.preventDefault(); useItem(invRef.current.slots[selSlotRef.current]?.itemId) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editMode, useItem])

  // entering edit mode: start the spectator camera where the player is standing
  useEffect(() => { if (editMode) editFocusRef.current.copy(posRef.current!) }, [editMode])
  const [tool, setTool] = useState<Tool>('raise')
  const toolRef = useRef<Tool>('raise'); toolRef.current = tool
  const [brush, setBrush] = useState(1)
  const brushRef = useRef(1); brushRef.current = brush
  const [saveMsg, setSaveMsg] = useState('')
  // `paint` has empty deps (it is called from render-hot handlers), so it reads the zone's wiring
  // through a ref rather than closing over a value that would go stale on the first zone change.
  const zoneWarpsRef = useRef<Warp[]>(zone.warps); zoneWarpsRef.current = zone.warps
  // recomputed each render; resize bumps version → re-render → fresh dims (drives the geometry key)
  const dims = `${gridRef.current[0]?.length ?? 0}x${gridRef.current.length}`

  const paint = useCallback((c: number, r: number, shift: boolean) => {
    const t = toolRef.current, b = brushRef.current
    // Spawner tools drop/remove a moglin-patrol spawner (its own layer; one per tile).
    if (SPAWNER_TOOL_IDS.has(t)) {
      const gate = SPAWNER_TOOLS.find(x => x.id === t)!.gate
      setSpawners(prev => {
        const here = prev.find(sp => sp.tileX === c && sp.tileY === r)
        const without = prev.filter(sp => !(sp.tileX === c && sp.tileY === r))
        if (shift) return without
        if (here?.gate === gate) return without                    // same gate again = toggle off
        return [...without, { kind: 'moglin' as const, gate, tileX: c, tileY: r }]  // place / swap gate
      })
      return
    }
    // Node tools drop/remove a single resource node in the node layer (not the tile grid).
    if (NODE_TOOL_IDS.has(t)) {
      setNodes(prev => {
        const here = prev.find(n => n.tileX === c && n.tileY === r)
        const without = prev.filter(n => !(n.tileX === c && n.tileY === r))
        if (shift) return without                                  // shift-click erases any node here
        if (here?.type === t) return without                       // same type again = toggle off
        return [...without, { type: t as NodeType, tileX: c, tileY: r }]  // place / swap type
      })
      return
    }
    const H = heightsRef.current, G = gridRef.current
    const rows = G.length, cols = G[0].length
    // A streaming zone's untouched rows are ONE shared frozen row (world/wilds-world.ts), so
    // painting into them would either throw or — without the freeze — smear one tile across
    // every unloaded row in the world. Give the brush's rows their own storage first. No-op on
    // rows that are already real, which is every row of every ordinary zone.
    materializeRows(G, r - b, r + b)
    materializeRows(H, r - b, r + b)
    for (let dr = -b; dr <= b; dr++) for (let dc = -b; dc <= b; dc++) {
      const rr = r + dr, cc = c + dc
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue
      if (t === 'raise') H[rr][cc] = Math.min(MAX_TIER, H[rr][cc] + (shift ? -1 : 1))
      else if (t === 'lower') H[rr][cc] = Math.max(0, H[rr][cc] - 1)
      else if (t === 'wall') G[rr][cc] = WALL_ID
      else if (t === 'water') G[rr][cc] = WATER_ID
      else if (t === 'floor') G[rr][cc] = FLOOR_ID
      else if (t === 'mist') G[rr][cc] = MIST_ID
      else if (t === 'warp') G[rr][cc] = WARP_ID
      else if (t === 'void') { G[rr][cc] = VOID; H[rr][cc] = 0 }
      if (t === 'raise') H[rr][cc] = Math.max(0, H[rr][cc])
    }
    // Erase means ERASE — the void tool also clears any nodes/spawners under the brush
    // (they're separate layers; leaving them floating on erased ground read as "erase is broken").
    if (t === 'void') {
      const inBrush = (x: number, y: number) => Math.abs(x - c) <= b && Math.abs(y - r) <= b
      setNodes(prev => prev.some(n => inBrush(n.tileX, n.tileY)) ? prev.filter(n => !inBrush(n.tileX, n.tileY)) : prev)
      setSpawners(prev => prev.some(sp => inBrush(sp.tileX, sp.tileY)) ? prev.filter(sp => !inBrush(sp.tileX, sp.tileY)) : prev)
      // ★ SAY SO WHEN THE ERASE CANNOT STICK. This editor's save posts grid/heights/nodes/spawners
      // and deliberately NOT warps — it has no destination UI, so an unconditional `warps: []` here
      // would wipe every door in the zone. The consequence is that erasing a gate/warp TILE clears
      // the paint but not the wiring: the door still fires, and a gate still draws its nametag
      // (gates render from data, not tiles). That used to fail silently and read as "it won't let
      // me delete this". Now it points at the editor that owns them.
      const hitWarp = zoneWarpsRef.current.find(w => inBrush(w.fromX, w.fromY))
      if (hitWarp) setSaveMsg(hitWarp.gate
        ? `"${hitWarp.gate}" is a GATE — erase it in the 2D map editor (/shimmer/dev?mode=map). The tiles cleared; the door did not.`
        : 'that tile carries a WARP — wiring lives in the 2D map editor (/shimmer/dev?mode=map). The tile cleared; the door did not.')
    }
    setVersion((v) => v + 1)
  }, [])

  // Empty the whole zone to a blank grid — then draw the land's shape onto it.
  const clearZone = useCallback(() => {
    const G = gridRef.current, H = heightsRef.current
    materializeRows(G, 0, G.length - 1); materializeRows(H, 0, H.length - 1)  // see the note in `paint`
    for (let r = 0; r < G.length; r++) for (let c = 0; c < G[0].length; c++) { G[r][c] = VOID; H[r][c] = 0 }
    setVersion((v) => v + 1)
  }, [])

  // Grow/shrink the zone. New cells = floor at height 0; existing content keeps its NW origin.
  // (Resizing shifts the zone's edges → its warps need re-aligning afterward; Jin re-wires.)
  const resize = useCallback((dCols: number, dRows: number) => {
    const G = gridRef.current, H = heightsRef.current
    const oldRows = G.length, oldCols = G[0].length
    const rows = Math.max(8, Math.min(160, oldRows + dRows))
    const cols = Math.max(8, Math.min(160, oldCols + dCols))
    const ng: number[][] = [], nh: number[][] = []
    for (let r = 0; r < rows; r++) {
      const gr: number[] = [], hr: number[] = []
      for (let c = 0; c < cols; c++) {
        if (r < oldRows && c < oldCols) { gr.push(G[r][c]); hr.push(H[r]?.[c] ?? 0) }
        else { gr.push(VOID); hr.push(0) } // new space is empty — draw land into it
      }
      ng.push(gr); nh.push(hr)
    }
    gridRef.current = ng; heightsRef.current = nh
    const p = posRef.current!
    p.x = Math.max(1, Math.min(p.x, cols - 2))
    p.z = Math.max(1, Math.min(p.z, rows - 2))
    setVersion((v) => v + 1)
  }, [])

  // Region-transition state (phase B of the world pivot). `transitRef` guards double-fires:
  // the warp tile keeps colliding while the fade runs, and a second timeline would strand
  // the overlay opaque. Timers are cleared on unmount so a mid-fade tab close leaks nothing.
  const [transit, setTransit] = useState<{ label: string; phase: TransitPhase } | null>(null)
  const transitRef = useRef(false)
  const transitTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { transitTimers.current.forEach(clearTimeout) }, [])

  // Arriving DIRECTLY into a region (?zone=r-… deep link) gets the same beat, already at
  // 'hold' — there is no old scene to fade out of, just the title over the mount hitch.
  //
  // ★ THIS FIRES ON THE RESOLVED BOOT ZONE, NOT ON MOUNT. It used to run with `[]` deps and read
  // `zoneIdRef.current`, which at mount is still START_ZONE — the save loads afterwards and
  // calls setZoneId. So the card announced "Home Plot" no matter where you actually loaded in,
  // every single boot, while the world behind it was somewhere else entirely.
  useEffect(() => {
    if (!bootZone) return
    const label = regionDisplayName(bootZone)
    if (!label || transitRef.current) return
    transitRef.current = true
    setTransit({ label, phase: 'hold' })
    const t = transitTimers.current
    t.push(setTimeout(() => setTransit({ label, phase: 'in' }), TRANSIT_HOLD_MS))
    t.push(setTimeout(() => { setTransit(null); transitRef.current = false }, TRANSIT_HOLD_MS + TRANSIT_IN_MS))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootZone])

  // Which side of the pivot the player is on. Entering a region sets it; explicitly
  // entering a legacy zone (?zone=, editor jump) clears it. Interiors leave it alone —
  // that is the whole point: an interior's exit warp still targets the LEGACY surface id,
  // and this flag is how the exit knows to land in the region instead.
  const newWorldRef = useRef(false)
  // Kept honest by zone, not by call sites: any path into a region (deep link, migrated
  // load, warp) flips it on; any explicit landing on the legacy surface flips it off.
  // Interiors deliberately change nothing — they belong to the side you entered from.
  useEffect(() => {
    if (isRegionZone(zoneId)) newWorldRef.current = true
    else if (zoneId === WORLD_ZONE_ID || isStitched(zoneId)) newWorldRef.current = false
  }, [zoneId])
  // ★ CHANGING ZONE CLEARS THE THREE SYSTEMS. Fields, conjured terrain and statuses are all keyed by
  // WORLD coordinates with no zone on them, so a Stonewall raised in the range would still occupy
  // those tiles after a warp — and FiringRange only renders in an armed zone, so in town it would be
  // an INVISIBLE wall you walk into. Enemy statuses are per-encounter and must not ride along either.
  // Cheap and total: nothing conjured survives leaving the place you conjured it.
  useEffect(() => {
    fieldsRef.current = []
    conjuredRef.current = []
    statusRef.current = emptyBag()
  }, [zoneId])
  const performWarp = useCallback((w: Warp) => {
    let toZone = w.toZone, toX = w.toX, toY = w.toY
    if (isRegionZone(toZone)) newWorldRef.current = true
    else if (newWorldRef.current) {
      const mig = migrateLegacyPosition(toZone, toX, toY)
      if (mig) { toZone = mig.zoneId; toX = mig.x; toY = mig.y }
    }
    // Doors back onto the continent land at the zone's composed-world spot; interiors mount as before.
    const world = !isRegionZone(toZone) && isStitched(toZone) ? getGardenWorld().toWorld(toZone, toX, toY) : null
    posRef.current!.set(world?.x ?? toX, posRef.current!.y, world?.y ?? toY)
    if (w.direction && DIR_YAW[w.direction] !== undefined) camYaw.current = DIR_YAW[w.direction]
    setZoneId(world ? WORLD_ZONE_ID : toZone)
  }, [])

  const onWarp = useCallback((w: Warp) => {
    if (w.ownerOnly && !isOwnerRef.current) return  // dev/test gate — silent no-op for players
    if (transitRef.current) return  // mid-transition: the world is covered, nothing may warp

    // ── ★★★ THE HOME-GATE IS A CHANGE OF ROUTE, NOT OF ZONE (2026-09-03) ───────────────────────
    // THE LANDING is the one door in the town that does not lead anywhere in the town. It crosses
    // OUT of the waking world back into the Ather, and the Ather is a separate Next route — so no
    // amount of `performWarp` can express it and the transit cinematic below would play a title
    // card for a place this warp never reaches.
    //
    // ★ CAUGHT BY `gate`, WHICH IS THE LABEL `expandGate` STAMPS ON EVERY TILE OF A DOOR. Matching
    // on the label rather than on coordinates means the door can be re-painted anywhere in the
    // square and this keeps working — the same reason `crossing-out.ts` asks the map for a label
    // instead of keeping a tile constant.
    //
    // ⚠⚠ `performWarp` RUNS FIRST, AND IT IS NOT DECORATION. It is a same-zone warp onto
    // `LANDING_ARRIVAL`, the open plaza tile one south of the door, so the keeper's TOWN record
    // ends up standing BESIDE the gate rather than inside it. Skip it and the record keeps the
    // keeper on a warp tile: the next ordinary load of the town fires that gate again and throws
    // them straight back to the Ather, every load, forever. That is exactly the self-feeding state
    // the 2026-08-15 space-less save autopsy cost a day of — a record whose own value re-triggers
    // the thing that wrote it. The contract's rule 1 permits this: neither record is cleared, and
    // *"a keeper has a real position in BOTH"*. Standing next to the door you just used is true.
    // ★ GREG'S DOOR IS THE SAME CROSSING (2026-09-15). Canon (`rune-hold.md` › NO INTERIOR OPENS,
    // `rune-hold-doors.test` › THE SPIRIT CORNER: "stepping through IS the crossing") — the shop
    // doorway "does not go where a doorway should". It led to the tile Home Plot, i.e. play3d's
    // own copy of the Ather; under the ruling the Ather is voxel3d, so both doors leave the route.
    // `performWarp` still runs first for the same reason as below: the town record must not be
    // left standing on a warp tile.
    if (w.gate?.toUpperCase() === LANDING_LABEL || w.gate?.toUpperCase() === 'THE SPIRIT CORNER') {
      performWarp(w)
      // ★ TWO DOORS, TWO DESTINATIONS (Alex, 2026-09-16: "the spirit corner should lead to moonwell
      // glade tutorial area.. no?"). Canon's crossing table (`world/gates.md`, 08-12): Greg's door is
      // private and lets out on his ground in the Glade; the square's landing is the town's civic
      // gate and lets out at the station's centre socket in the court. Staged as a one-shot the
      // Ather consumes on restore; without it both doors led to wherever the keeper last stood.
      stageEntry(localStorage, w.gate.toUpperCase() === 'THE SPIRIT CORNER' ? 'glade' : 'court')
      window.location.href = '/shimmer/voxel3d'
      return
    }

    const label = regionDisplayName(w.toZone)
    // The cinematic plays only when ARRIVING at a region map (interior doors stay instant),
    // and never re-fires for a warp inside the same region. Keyed on the DISPLAY NAME, not on a
    // backing file — the Wilds are one zone over many files and had no name to show, so stepping
    // into the overland was the one arrival that got no title card at all.
    if (!label || w.toZone === zoneIdRef.current) { performWarp(w); return }
    transitRef.current = true
    talkingRef.current = true  // freeze movement under the cover (same gate dialogue uses)
    setTransit({ label, phase: 'out' })
    const t = transitTimers.current
    t.push(setTimeout(() => {
      performWarp(w)             // land under full cover — the geometry hitch hides here
      setTransit({ label, phase: 'hold' })
    }, TRANSIT_OUT_MS))
    t.push(setTimeout(() => setTransit({ label, phase: 'in' }), TRANSIT_OUT_MS + TRANSIT_HOLD_MS))
    t.push(setTimeout(() => {
      setTransit(null)
      transitRef.current = false
      talkingRef.current = false
    }, TRANSIT_OUT_MS + TRANSIT_HOLD_MS + TRANSIT_IN_MS))
  }, [performWarp])

  // Jump straight to a zone to edit it (no walking/warping). Resets the player + camera focus
  // to its spawn. NOTE: unsaved edits in the current zone are dropped — save before switching.
  const selectZone = useCallback((id: string) => {
    const z = getZone(ALL_ZONES, id)
    if (!z) return
    const ps = z.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current!.set(ps.tileX, 0, ps.tileY)
    editFocusRef.current.set(ps.tileX, 0, ps.tileY)
    setZoneId(id)
  }, [])

  const save = useCallback(async () => {
    setSaveMsg('saving…')
    try {
      if (zone.id === WORLD_ZONE_ID) {
        // World-mode save: split the composed edit back to its SOURCE zones (the authored
        // truth). Only districts whose slice actually changed get POSTed. Edits to the
        // derived mortar/corridor cells can't be owned by any zone — counted + reported.
        const w = getGardenWorld()
        const posts: Promise<Response>[] = []
        let touched = 0
        for (const p of w.placements.values()) {
          const gSlice = gridRef.current.slice(p.oy, p.oy + p.rows).map(row => row.slice(p.ox, p.ox + p.cols))
          const hSlice = heightsRef.current.slice(p.oy, p.oy + p.rows).map(row => row.slice(p.ox, p.ox + p.cols))
          // ★ The composer mutates cells INSIDE zone rects too, not just warp cells: the corridor
          // carver writes its L-path floor into a zone's authored voids, and its cloud flanking
          // turns authored sky at zone edges into WALL (the -1 → 34 bake-back). Restore the
          // authored value at every cell this session did NOT touch — diffed against `w` (the
          // world as composed), same convention as the overlay diff below — so a save-back
          // records the player's edits and nothing the composer drew.
          const zh = getHeightGrid(p.zone.id, p.rows, p.cols)
          for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
            if (gridRef.current[p.oy + r][p.ox + c] === w.grid[p.oy + r][p.ox + c]) gSlice[r][c] = p.zone.grid[r][c]
            if (heightsRef.current[p.oy + r][p.ox + c] === w.heights[p.oy + r][p.ox + c]) hSlice[r][c] = zh[r][c]
          }
          // Warp cells stay authored even when touched — stitched warps render demoted in world
          // view, so a paint over one is an edit to a derived cell, not the source.
          for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++)
            if ((p.zone.grid[r][c] & 0xFF) === WARP_ID && gSlice[r][c] !== p.zone.grid[r][c]) gSlice[r][c] = p.zone.grid[r][c]
          for (const wz of p.zone.warps)
            if ((gSlice[wz.fromY]?.[wz.fromX] & 0xFF) === WARP_ID && gSlice[wz.fromY][wz.fromX] !== p.zone.grid[wz.fromY][wz.fromX])
              gSlice[wz.fromY][wz.fromX] = p.zone.grid[wz.fromY][wz.fromX]
          const zNodes = nodesRef.current
            .filter(nd => w.zoneAt(nd.tileX, nd.tileY) === p.zone.id)
            .map(nd => ({ nodeType: nd.type, x: nd.tileX - p.ox, y: nd.tileY - p.oy }))
          const zSpawners = spawnersRef.current
            .filter(sp => w.zoneAt(sp.tileX, sp.tileY) === p.zone.id)
            .map(sp => ({ gate: sp.gate, x: sp.tileX - p.ox, y: sp.tileY - p.oy }))
          const gChanged = JSON.stringify(gSlice) !== JSON.stringify(p.zone.grid)
          const hChanged = JSON.stringify(hSlice) !== JSON.stringify(zh)
          const nChanged = JSON.stringify(zNodes) !== JSON.stringify((ZONE_NODES[p.zone.id] ?? []).map(nd => ({ nodeType: nd.type, x: nd.tileX, y: nd.tileY })))
          const sChanged = JSON.stringify(zSpawners) !== JSON.stringify((ZONE_SPAWNERS[p.zone.id] ?? []).map(sp => ({ gate: sp.gate, x: sp.tileX, y: sp.tileY })))
          if (!gChanged && !hChanged && !nChanged && !sChanged) continue
          touched++
          if (hChanged) posts.push(fetch('/shimmer/save-heights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId: p.zone.id, heights: hSlice }) }))
          if (gChanged) posts.push(fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grid: gSlice, mapId: p.zone.id }) }))
          if (nChanged) posts.push(fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes: zNodes, mapId: p.zone.id }) }))
          if (sChanged) posts.push(fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spawners: zSpawners, mapId: p.zone.id }) }))
        }
        // ★ Everything OUTSIDE a district — the cloudscape and the routes cut through it. This
        // used to be the branch that detected such edits only to report that they could not be
        // saved; that message was the honest face of the bug, not a fix for it. They now go to the
        // world overlay, which the composer paints on last so a hand-carved route survives the
        // generated one.
        //
        // Diffed against `w` (the world as composed, overlay already included), so only what this
        // session actually changed is sent and the server merges it. Sending the whole out-of-zone
        // region instead would be ~100k entries per save and would make every save a full rewrite
        // of everyone else's work.
        const ovTiles: Record<string, number> = {}
        const ovHeights: Record<string, number> = {}
        for (let r = 0; r < w.rows; r++) for (let c = 0; c < w.cols; c++) {
          if (w.zoneAt(c, r)) continue
          if (gridRef.current[r][c] !== w.grid[r][c]) ovTiles[`${c},${r}`] = gridRef.current[r][c]
          if (heightsRef.current[r][c] !== w.heights[r][c]) ovHeights[`${c},${r}`] = heightsRef.current[r][c]
        }
        const ovCount = Object.keys(ovTiles).length + Object.keys(ovHeights).length
        if (ovCount) {
          touched++
          posts.push(fetch('/shimmer/save-map', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ overlay: { fingerprint: w.fingerprint, tiles: ovTiles, heights: ovHeights } }),
          }))
        }
        // Resource nodes still cannot live out there — a node has no slot key without a zone, and
        // the spawn board deals per district. Worth saying rather than dropping in silence.
        const orphanNodes = nodesRef.current.some(nd => !w.zoneAt(nd.tileX, nd.tileY))
        const rs = await Promise.all(posts)
        const bad = rs.find(r => !r.ok)
        const detail = bad ? `save failed — ${bad.status}: ${(await bad.text()).slice(0, 140)}` : null
        setSaveMsg(!touched ? 'no changes to save'
          : !detail ? `saved ${touched} layer${touched > 1 ? 's' : ''} ✓${ovCount ? ` · ${Object.keys(ovTiles).length} cloud tiles` : ''} — live on next refresh${orphanNodes ? ' · nodes outside a district were NOT saved' : ''}`
          : detail)
        setTimeout(() => setSaveMsg(''), 4500)
        return
      }
      const id = zone.id
      const [h, g, n, sp] = await Promise.all([
        fetch('/shimmer/save-heights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId: id, heights: heightsRef.current }) }),
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grid: gridRef.current, mapId: id }) }),
        // node layer → node-placements.ts (same endpoint, `nodes` payload; {nodeType,x,y} shape)
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes: nodesRef.current.map(nd => ({ nodeType: nd.type, x: nd.tileX, y: nd.tileY })), mapId: id }) }),
        // spawner layer → spawn-placements.ts ({gate,x,y} shape)
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spawners: spawnersRef.current.map(x => ({ gate: x.gate, x: x.tileX, y: x.tileY })), mapId: id }) }),
      ])
      const zbad = [h, g, n, sp].find(r => !r.ok)
      setSaveMsg(!zbad ? 'saved ✓ — live on next refresh' : `save failed — ${zbad.status}: ${(await zbad.text()).slice(0, 140)}`)
    } catch { setSaveMsg('save failed') }
    setTimeout(() => setSaveMsg(''), 3500)
  }, [zone.id])

  const Btn = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className={`hk-btn px-2.5 py-1 text-[12px]${active ? ' hk-ember' : ''}`}
      style={{ pointerEvents: 'auto', ...(active ? { boxShadow: `inset 0 0 0 2px ${H.ember}` } : null) }}>{children}</button>
  )

  return (
    // HEARTH_FONT_VARS on the root: the hearth HUD pieces mounted directly here (objective, clock, frame)
    // have no HearthFrame root of their own to carry the faces, and without the vars they fall back to Georgia.
    <div className={HEARTH_FONT_VARS} style={{ position: 'fixed', inset: 0, background: S.sky, cursor: editMode ? 'crosshair' : 'default', touchAction: 'none', overscrollBehavior: 'none' }}>
      {/* key: antialias is a WebGL CONTEXT flag and shadowMap.enabled needs every shader recompiled,
          so a quality change remounts the canvas rather than half-applying. Position/yaw survive —
          they live in this component's refs, not the scene graph. See gfx.ts gfxKey(). */}
      <CanvasBoundary fallback={
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', color: S.fallbackInk, font: '600 14px ui-monospace, monospace', padding: 24 }}>
          <div>the garden hit a snag rendering.<br />reload the page to step back in.</div>
        </div>
      }>
      <Canvas key={gfxKey(gfx)}
        shadows={gfx.shadows !== 'off'}
        dpr={dpr}
        // ★ far plane is derived from the streaming radius, not chosen: drawing past the last
        // mounted chunk shows the player the world ending in mid-air. See world/chunk-stream.ts.
        camera={{ fov: 45, position: [1, 6, 14], near: 0.1, far: viewFar() }}
        gl={{ antialias: gfx.antialias }}
        onCreated={(state) => { canvasElRef.current = state.gl.domElement }}>
        {/* ★ The fog this file's chunk comment has claimed since the streaming core landed, and
            which was never actually configured. It is not decoration: the streaming window
            unmounts chunks past `viewFar()`, so without haze the player watches the world end at
            a hard line. Colour matches the page background so geometry fades into sky. */}
        <fog attach="fog" args={[S.sky, fogNear(), viewFar()]} />
        <FrameProbe statsRef={frameStats} />
        {gfx.adaptiveDpr && (
          <PerformanceMonitor
            onDecline={() => setDpr(d => Math.max(DPR_FLOOR, +(d - 0.2).toFixed(2)))}
            onIncline={() => setDpr(d => Math.min(dprCeiling(), +(d + 0.2).toFixed(2)))}
            // Oscillation guard: if it keeps crossing the line, stop chasing and settle at the
            // floor. Without this a borderline GPU ping-pongs the resolution, which reads WORSE
            // than simply running soft — the image would breathe every couple of seconds.
            flipflops={3}
            onFallback={() => setDpr(DPR_FLOOR)}
          />
        )}
        <Scene
          guideTargetRef={guideTargetRef}
          zone={zone} gridRef={gridRef} heights={heightsRef.current} version={version} dims={dims}
          posRef={posRef as React.RefObject<THREE.Vector3>} heightsRef={heightsRef} zoneIdRef={zoneIdRef}
          editFocusRef={editFocusRef}
          onWarp={onWarp} yawRef={camYaw} editRef={editRef} eyeRef={eyeRef} jumpRef={jumpRef} slideRef={slideRef} speedMultRef={speedMultRef} weaponMoveRef={weaponMoveRef} weaponIdxRef={weaponIdxRef} dreamwalkRef={dreamwalkRef} paint={paint} editing={editMode}
          battleRef={battleRef} partyLevelRef={partyLevelRef} onEncounter={onEncounter} joyRef={joyRef}
          talkingRef={talkingRef} hasPartyRef={hasPartyRef} onNearChange={setNearNpc}
          harvestNodesRef={runtimeNodesRef} onNearNode={setNearNode} channel={channel}
          structures={structures} placing={placing} placeTargetRef={placeTargetRef} structuresRef={structuresViewRef} onNearStation={setNearStation}
          defeatedRef={defeatedRef} defeated={defeated} flagsRef={flagsRef}
          nodes={runtimeNodes}
          spawners={spawners} spawnerReady={spawnerReady} spawnerKeyFor={spawnerKeyFor}
          restingSpirits={(void partyTick, restingSpirits(partyRef.current ?? []))}
          companionColor={(() => { const b = beastsRef.current.find(x => x.id === activeBeastIdRef.current); void companionTick; return b ? (BEAST_COLOR[b.species] ?? S.beastFallback) : null })()}
          fishing={!!fish} fishBite={!!fish?.bite}
          harvestPop={harvestPop}
          atmosZone={districtZone}
          isOwner={isOwner}
          firingRef={firingRef}
          birthRuneRef={birthRuneRef}
          onRangeHit={onRangeHit}
          onRangeShot={onRangeShot}
          adsRef={adsRef}
          recoilRef={recoilRef}
          bloomRef={bloomRef}
          hpRef={hpRef}
          shieldRef={shieldRef}
          hpMaxRef={hpMaxRef}
          shieldMaxRef={shieldMaxRef}
          rangeCfgRef={rangeCfgRef}
          ammoRef={ammoRef}
          reloadingRef={reloadingRef}
          pendingCastRef={pendingCastRef}
          castMultRef={castMultRef} senseRadiusRef={senseRadiusRef} tremorRef={tremorRef}
          resistRef={resistRef}
          infusionRef={infusionRef}
          fieldsRef={fieldsRef}
          conjuredRef={conjuredRef}
          holdRef={holdRef}
          bodyOut={bodyOut.current}
          statusRef={statusRef}
          onHeal={healPlayer}
          onNeedReload={startReload}
          onPlayerDamage={onPlayerDamage}
          onPlayerDown={onPlayerDown}
          onTrial={(say) => setBanner(`✦ ${say}`)}
          onMatch={setMatchHud}
          mpPeers={mpPeers}
          shadowMap={SHADOW_MAP_SIZE[gfx.shadows]}
        />
        {/* ⚠ AFTER the Scene, so its useFrame subscribes after the walker's and ticks once the camera
            has moved this frame — before it, the hands wore last frame's pose and lagged on the walk. */}
        <HandsMount hands={hands} feed={feedHands} />
      </Canvas>
      </CanvasBoundary>

      {/* edit-mode keeps a minimal zone/controls strip; play HUD is clean (marks moved to the top-right stack) */}
      {editMode && (
        <HudPlate face={HUD_FACE} style={{ position: 'fixed', top: 12, left: 12 }}>
          <div style={{ padding: '6px 11px', fontSize: 13, lineHeight: 1.5, ...hearthBody }}>
          <b>Shimmer 3D — {zone.id === WORLD_ZONE_ID ? (getZone(ALL_ZONES, districtZone)?.name ?? zone.name) : zone.name}</b>  ·  <span className="hk-ember">edit</span><br />
          <span className="hk-soft">left-drag paint · WASD fly · Q/E down·up · right-drag look · scroll zoom</span>
          </div>
        </HudPlate>
      )}

      {/* free-look nudge: first-person play, before the pointer is captured. Fades out a few seconds after
          spawn (showLookHint) so it's a welcome, not permanent chrome. */}
      {!editMode && !pointerLocked && !isTouch && !dialogue && !battle && showLookHint && (
        <HearthPill face={HUD_FACE} style={{ position: 'fixed', left: '50%', bottom: 108, transform: 'translateX(-50%)', zIndex: 34, animation: 'lookHintFade 5s ease-out forwards' }}>
          <style>{`@keyframes lookHintFade { 0%,70% { opacity: 1 } 100% { opacity: 0 } }`}</style>
          click to look around <HearthPillSoft face={HUD_FACE}>· Esc releases</HearthPillSoft></HearthPill>
      )}

      {/* minimap — persistent, click (or M) expands to the full map */}
      {!battle && !editMode && !showMap && !menuOpen && (
        <>
          <MiniMap box={hudMapBox(hudSize)} zoneId={zone.id} gridRef={gridRef} posRef={posRef} yawRef={camYaw} onExpand={() => { openCursorUI(); setShowMap(true) }} />
          <HearthMapFrame face={HUD_FACE} box={hudMapBox(hudSize)} />
        </>
      )}
      {/* The fork's objective — the same chip the Ather's tutorial wears (`hud/objective-chip.tsx`). */}
      {forkChip && !battle && !editMode && !dialogue && !menuOpen && <HearthObjective face={HUD_FACE} value={forkChip} anchor={hudSize === 'phone' ? 'left' : 'center'}
        // Phone: the top row is the map and, left of it, this side's clock/companion column — measured
        // 2026-09-23, the pill ran under the clock. Under the map row the left side is empty.
        style={hudSize === 'phone' ? { top: hudMapBox(hudSize).top + hudMapBox(hudSize).size + 8 } : undefined} />}
      {/* The ☰ under the minimap, on the minimap's own rule; `hud/options-door.tsx`. */}
      {!battle && !editMode && !showMap && !menuOpen && (
        <OptionsDoor face={HUD_FACE} top={hudDoorTop(hudSize)} onOpen={openOptions} />
      )}
      {menuOpen && (
        <OptionsPanel isOwner={isOwner} onClose={closeOptions}
          game={<>
            <OptionRow onClick={() => { setMenuOpen(false); setMpOpen(true) }} label="👥 Play together" tail="party" />
            <OptionRow onClick={() => { setMenuOpen(false); setSkillsOpen(true) }} label="⬡ Skills" tail="levels" />
            <OptionRow onClick={() => { setMenuOpen(false); setBookOpen(true) }} label="✦ The book" tail="your rune" />
            {confirmNew ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] hk-ink">reset?</span>
                <button onClick={() => { setConfirmNew(false); setMenuOpen(false); setBirthCancelable(true); setBirthOpen(true) }} className="hk-btn px-2 py-1 text-[12px] hk-rust">Yes, start over</button>
                <button onClick={() => setConfirmNew(false)} className="hk-btn px-2 py-1 text-[12px]">No</button>
              </div>
            ) : <OptionRow onClick={() => setConfirmNew(true)} label="↺ New Game" tail="rebirth" />}
          </>}
          video={<>
            {/* play3d's levers live in `GfxPanel` (quality toggles + the live frame readout). It is a
                surface of its own, so the Video tab opens it rather than nesting one frame in another. */}
            <OptionRow onClick={() => { setMenuOpen(false); setGfxOpen(true) }} label="⚙ Graphics & frame meter" tail="open" />
          </>}
          sound={<PlaySound />}
          controls={<>
            <OptionHead>Keyboard</OptionHead>
            {([['WASD', 'move'], ['mouse', 'look (click to lock)'], ['E / A', 'talk · advance'], ['I', 'satchel'], ['M', 'map'], ['Z', 'cast the worn word'], ['Esc', 'release the cursor']] as const).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-[12px] hk-soft"><span className="tabular-nums">{k}</span><span className="hk-faint">{v}</span></div>
            ))}
          </>}
          dev={<div className="space-y-1">
            <OptionHead tone="hk-ember">Keeper of the realm</OptionHead>
            <OptionRow onClick={() => { setMenuOpen(false); setEditMode(true) }} label="✎ Edit terrain" tail="this map" />
            <OptionRow onClick={() => setRuneDevOpen(o => !o)} label="✦ Rune (dev)" tail={runeDevOpen ? 'hide' : 'show'} />
            {runeDevOpen && (
                <div className="hk-rule" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2, maxWidth: 268, borderTopWidth: 1, borderTopStyle: 'solid', paddingTop: 6 }}>
                  <span className="hk-soft" style={{ fontSize: 11, fontWeight: 700, textAlign: 'right' }}>Birth rune — click to be born of it</span>
                  {['mana', 'storm', 'earth', 'water'].map(el => (
                    <div key={el} style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'flex-end' }}>
                      {RUNES.filter(r => r.element === el).map(r => (
                        <button key={r.id} onClick={() => setDevRune(r.id)} title={`${r.name} — ${r.essence}`}
                          className="hk-btn" style={{ padding: '1px 7px', fontSize: 11, boxShadow: birthRuneRef.current === r.id ? `inset 0 0 0 2px ${r.glow}` : undefined }}>{r.name}</button>
                      ))}
                    </div>
                  ))}
                  {/* ⚠ Rune acquisition is RULED (trained off the birth rune, never bought) but not
                      BUILT — nothing in the game walks a keeper along their lane yet. This grants one
                      anyway so the cross-hatch (two-rune moves like Healing Grove, Cordon, Flame
                      Barrage) is playable meanwhile. Owner-only, and it ignores the lane law. */}
                  <span className="hk-ember" style={{ fontSize: 11, fontWeight: 700, textAlign: 'right', marginTop: 4 }}>+ Developed runes — unbuilt path, dev-only</span>
                  {['mana', 'storm', 'earth', 'water'].map(el => (
                    <div key={`dev-${el}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'flex-end' }}>
                      {RUNES.filter(r => r.element === el).map(r => {
                        const held = runeInvRef.current.owned.includes(r.id)
                        const isBirth = birthRuneRef.current === r.id
                        return (
                          <button key={r.id} onClick={() => toggleDevRune(r.id)} disabled={isBirth}
                            title={isBirth ? `${r.name} — your birth rune` : `${held ? 'drop' : 'develop'} ${r.name}`}
                            className={`hk-btn${held ? '' : ' hk-faint'}`}
                            style={{ padding: '1px 7px', fontSize: 11, opacity: isBirth ? 0.35 : 1, boxShadow: held ? `inset 0 0 0 2px ${r.glow}` : undefined }}>
                            {held ? '✦' : '+'}{r.name}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
            )}
            <OptionRow href="/shimmer/dev/worktable" label="⚒ Build structures" tail="worktable" />
          <OptionRow href="/shimmer/dev/worktable?load=gate_station" label="⌂ Gate station" tail="worktable" />
            <OptionRow href="/shimmer/dev" label="✧ Dev hub" tail="editors" />
            <OptionRow href="/shimmer/voxel3d" label="◈ The Ather" tail="voxel3d" />
          </div>}
        />
      )}
      {showMap && <WorldMap zoneId={zone.id} gridRef={gridRef} posRef={posRef} yawRef={camYaw} onClose={() => { setShowMap(false); closeCursorUI() }} />}

      {/* talk prompt when standing by an NPC */}
      {nearNpc && !dialogue && !battle && !editMode && <Prompt text={`${isTouch ? 'tap ✦' : 'E'} — ${nearNpc.verb ?? 'talk to'} ${nearNpc.name}`} />}

      {/* rinning prompt — locked at the pool: watch, then strike when the `!` pops (early/late slips) */}
      {fish && !editMode && (
        <HearthPill face={HUD_FACE} style={PILL_LOW} accent={fish.bite ? H.ember : undefined}>{fish.bite
          ? <>❗ Hook it! <HearthPillSoft face={HUD_FACE}>({isTouch ? 'tap' : 'E'})</HearthPillSoft></>
          : <>🎣 rinning {fish.label} · watch the water… <HearthPillSoft face={HUD_FACE}>({isTouch ? 'tap' : 'E'})</HearthPillSoft></>}</HearthPill>
      )}

      {/* greet prompt by a wandering plot spirit (NPCs win; nodes yield to the spirit) */}
      {nearPlotSpirit && !nearNpc && !dialogue && !battle && !editMode && !partyOpen && (
        <HearthPill face={HUD_FACE} style={PILL_LOW} accent={ELEMENT_COLORS[nearPlotSpirit.element]}>✨ Greet {nearPlotSpirit.name} <HearthPillSoft face={HUD_FACE}>({isTouch ? 'tap' : 'E'})</HearthPillSoft></HearthPill>
      )}

      {/* harvest prompt when standing by a node (hidden once you link in or start fishing) */}
      {nearNode && !channel && !fish && !nearNpc && !dialogue && !battle && !editMode && (
        <HearthPill face={HUD_FACE} style={PILL_LOW}>{getNodeSkill(nearNode.type) === 'rinning'
          ? <>🎣 Cast at {prettyItem(nearNode.type)} <HearthPillSoft face={HUD_FACE}>({isTouch ? 'tap 🎣' : 'E'})</HearthPillSoft></>
          : <>🪓 Channel {prettyItem(nearNode.type)} <HearthPillSoft face={HUD_FACE}>({isTouch ? 'tap 🪓' : 'E'})</HearthPillSoft></>}</HearthPill>
      )}
      {/* station prompt — generic over brew/craft/chest/exchange/farm, driven by the STATIONS registry */}
      {nearStation && !openMenu && !nearNode && !nearNpc && !dialogue && !battle && !editMode && !placing && (() => {
        const st = STATIONS[nearStation.itemId]
        return (
          <HearthPill face={HUD_FACE} style={PILL_LOW} accent={H.ember}>{st.emoji} {st.verb} at the {st.name} <HearthPillSoft face={HUD_FACE}>({isTouch ? `tap ${st.emoji}` : 'E'})</HearthPillSoft></HearthPill>
        )
      })()}
      {/* channeling indicator — mana is powering the tool; the node's HP bar drains over it */}
      {channel && !battle && !editMode && (
        <HearthPill face={HUD_FACE} style={PILL_LOW} accent={H.sky}>⚡ Channeling into {channel.label}… <HearthPillSoft face={HUD_FACE}>(stay close · {isTouch ? 'tap ⏹' : 'E'} to stop)</HearthPillSoft></HearthPill>
      )}

      {/* PLACEMENT MODE — ghost is in the 3D scene; this is the confirm/cancel/rotate control ring */}
      {placing && (
        <>
          <HearthPill face={HUD_FACE} style={{ position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 36 }}>
            Placing {PLACEABLES[placing.itemId].name} — face where you want it{isTouch ? '' : <HearthPillSoft face={HUD_FACE}> · ← → rotate · Enter place · Esc cancel</HearthPillSoft>}
          </HearthPill>
          <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 36, display: 'flex', gap: 14, alignItems: 'center' }}>
            <button onClick={rotatePlacing} aria-label="rotate" style={placeIconBtn(H.sky)}>⟳</button>
            <button onClick={cancelPlacing} aria-label="cancel" style={placeIconBtn(H.rust)}>✗</button>
            <button onClick={confirmPlacing} aria-label="confirm" style={placeIconBtn(H.moss)}>✓</button>
          </div>
        </>
      )}

      {/* harvest toast — the drops + XP you just collected */}
      {/* THE SAY LINE (`hud/say-line.tsx`): the harvest readout and the milestone banner were two plates
          in two places; the Ather has one line for everything the world says. Banner wins when both. */}
      {(banner || (harvestToast && !battle)) && <SayLine text={(banner ?? harvestToast)!} at={sayAt} />}

      {/* ── TOP-RIGHT COLUMN: what only the mortal side has, plus the panels the options open ──
          ★ THE KEEPER'S CHROME IS SHARED (2026-09-16, HUD port stage 1): the dial, the ☰ door and
            the options frame come from `shimmer/hud/`, the same objects the Ather mounts. The minimap
            sits at the voxel rule (top 12 / right 12) with the door under it; this column hangs to
            its LEFT and holds what only the mortal side has (companion, wounded, buffs) plus the
            panels the options Game tab opens. Marks and the mana pie left with it — one HUD, and the
            Ather shows neither up here (mana is the vessel at bottom-right; stage 2 brings it). */}
      {!battle && !approach && !rewards && !editMode && !dialogue && !menuOpen && (
        <div data-ct={companionTick} style={{ position: 'fixed', top: hudMapBox(hudSize).top, right: hudMapBox(hudSize).right + hudMapBox(hudSize).size + 10, zIndex: 34, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
          <HearthClock face={HUD_FACE} placed={false} note={<DayNotes zoneId={zoneId} />} />

          {/* Companion chip — active Mana'mal + its @15 perk; tap to switch (when you own >1) */}
          {beastsRef.current.length > 0 && (() => {
            const owned = beastsRef.current
            const active = owned.find(b => b.id === activeBeastIdRef.current) ?? owned[0]
            const info = PERK_INFO[BEAST_PERKS[active.species]]
            return (
              <HearthChip face={HUD_FACE} glyph="🐾" name={active.name} maxWidth={200}
                sub={<>{info.label}{owned.length > 1 ? ` ⟳${owned.length}` : ''}</>}
                title={`${active.name} — ${info.blurb}${owned.length > 1 ? ' · tap to switch' : ''}`}
                onClick={owned.length > 1 ? () => {
                  const i = owned.findIndex(b => b.id === activeBeastIdRef.current)
                  activeBeastIdRef.current = owned[(i + 1) % owned.length].id
                  setCompanionTick(t => t + 1); persist()
                } : undefined} />
            )
          })()}

          {/* Wounded spirits — arena damage persists, so this is where you notice you need to brew.
              Absent entirely when the party is whole. */}
          {woundHud.map(w => (
            <HearthChip key={w.name} face={HUD_FACE} glyph={w.downed ? '✖' : '✚'} glyphColor={w.downed ? H.rust : H.ember}
              name={w.name} nameColor={w.downed ? H.rust : H.ember} value={w.downed ? 'down' : `${Math.round(w.frac * 100)}%`}
              title={w.downed ? `${w.name} is down — a Shimmer Salve puts it back on its feet` : `${w.name} is hurt — a Shimmer Salve mends it`} />
          ))}

          {/* Active potion buffs — glyph + name + countdown, one chip per live effect */}
          {buffHud.map(b => (
            <HearthChip key={b.id} face={HUD_FACE} glyph={b.glyph} glyphColor={b.color} name={b.name}
              value={fmtRemain(b.remainMs)} title={BUFF_DEFS[b.id].line} />
          ))}


          {/* ★ THE COLUMN'S PANELS WEAR THE HEARTH (2026-09-23): each is a HearthFrame card — carved
              frame, parchment, a plaque, and the close knob these panels never had (they could only be
              shut by reopening the menu). `mt-5` leaves the plaque room above the card. */}
          {skillsOpen && (
            <HearthFrame title="Skills" maxWidth={Math.min(200, colRoom)} backdrop={false} className="mt-5" onClose={() => setSkillsOpen(false)}>
              <div className="px-3.5 pt-6 pb-3">
                {(['forestry', 'prospecting', 'rinning', 'farming', 'alchemy'] as const).map(id => {
                  const sk = skillsRef.current[id]
                  const next = xpForSkillLevel(sk.level)
                  return (
                    <div key={id} className="mb-2.5 last:mb-0">
                      <div className="flex justify-between items-baseline">
                        <span className="hk-label text-[13px] hk-ink">{SKILL_META[id].name}</span>
                        <span className="text-[12px] font-extrabold tabular-nums hk-soft">lv {sk.level}</span>
                      </div>
                      <div className="mt-1"><HearthProgress value={Math.min(1, sk.xp / Math.max(1, next))} /></div>
                    </div>
                  )
                })}
              </div>
            </HearthFrame>
          )}

          {mpOpen && (
            <HearthFrame title="Play together" maxWidth={Math.min(240, colRoom)} backdrop={false} className="mt-5" onClose={() => setMpOpen(false)}>
            <PlayTogetherPanel
              name={mpName} onName={setMpName}
              party={mpParty} onParty={(code) => { if (code) joinParty(code); else leaveParty() }}
              inPlot={zoneId === HOME_PLOT_ZONE || zoneId === 'r-home-plot' ? () => true : zoneId === WORLD_ZONE_ID ? (x: number, z: number) => fromWorld(Math.round(x), Math.round(z))?.zoneId === HOME_PLOT_ZONE : undefined}
              peers={mpPeers}
              account={account}
            />
            </HearthFrame>
          )}

          {gfxOpen && (
            <HearthFrame title="Graphics" maxWidth={Math.min(260, colRoom)} backdrop={false} className="mt-5" onClose={() => setGfxOpen(false)}>
              <GfxPanel gfx={gfx} onGfx={setGfx} statsRef={frameStats} saveRef={saveStatsRef} />
            </HearthFrame>
          )}

          {/* The book is handed what the keeper has LEARNED and what they CARRY, so each row can
              say where it stands instead of stamping one status on all of them. Both come off refs
              that `applyLoadout` rewrites, and every path that changes either (birth, a Passage
              purchase, a dev rune grant) calls it — so the panel re-reads on the render that
              follows, the same way this call site already reads `birthRuneRef` during render. */}
          {bookOpen && (
            <HearthFrame title="The book" maxWidth={Math.min(300, colRoom)} backdrop={false} className="mt-5" onClose={() => setBookOpen(false)}>
            <MoveBook
              runeId={birthRuneRef.current}
              isOwner={isOwner}
              book={bookRef.current}
              owned={runeInvRef.current.owned}
            />
            </HearthFrame>
          )}
        </div>
      )}

      {/* dialogue box — tap/click anywhere on it (or A / E) to advance; last line closes */}
      {/* The same frame the Ather reads its script in (`hud/dialogue-box.tsx`); here one line per tap. */}
      {dialogue && (
        <DialogueBox name={dialogue.speakers?.[dialogue.idx] ?? dialogue.name} panelId="talk" onPlate={advanceDialogue}
                     footer={<div className="hk-label mt-3 hk-faint text-[12px] text-right">
                       {dialogue.idx >= dialogue.lines.length - 1 ? 'tap to close' : 'tap to continue ▸'}
                     </div>}>
          <div className="hk-ink text-[13px] leading-relaxed">{dialogue.lines[dialogue.idx]}</div>
        </DialogueBox>
      )}

      {/* Birth Rune gate — opened by New Game; choose a rune, then reset into a fresh run carrying it */}
      {birthOpen && (
        <BirthScreen
          onChoose={(id) => {
            setBirthOpen(false)
            // Birth is rune #1 of the inventory, not the whole character — the moves come from the book.
            const inv = setBirthRune(EMPTY_INVENTORY, id)  // a fresh run starts with exactly one rune
            runeInvRef.current = inv
            birthRuneRef.current = id
            saveRuneInventory(inv)
            try { localStorage.removeItem('ather:shimmer:birthPending') } catch { /* private mode */ }  // birth is done; stop re-prompting
            newGame()                  // fresh run — sets its own banner; we override below
            applyAffinity()            // grant this rune's v1 affinity lean (caps + affinityRef)
            applyLoadout()             // derive the cast slots from the book this rune opens
            hpRef.current = hpMaxRef.current; shieldRef.current = shieldMaxRef.current  // start the new run at full, bonuses included
            const rn = RUNES.find(r => r.id === id)?.name ?? 'your rune'
            // Half the carousel currently opens a book with no move the sim can run — that is the real
            // authoring gap (moves.md), so the banner tells the truth instead of promising a cast.
            const bound = loadLoadout(inv.owned, inv.birth, keeperBook(inv.owned)).filter((m) => m && isBuilt(m)).length
            const castHint = bound > 0 ? ` · ${bound} move${bound > 1 ? 's' : ''} in hand (Z/C)` : ''
            setBanner(`Born of ${rn} — ${affinityRef.current.label || 'find Gregory in the glade'}${castHint}`)
          }}
          onCancel={birthCancelable ? () => setBirthOpen(false) : undefined}
        />
      )}

      {/* milestone toast (evolution-ready, new game) */}
      {transit && <RegionTransition label={transit.label} phase={transit.phase} />}



      {editMode && (
        <HudPlate face={HUD_FACE} style={{ position: 'fixed', top: 70, left: 12 }}>
          <div className="hearth-root" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '7px 9px', ...hearthBody }}>
          <select
            value={zoneId}
            onChange={(e) => selectZone(e.target.value)}
            className="hk-btn"
            style={{ padding: '5px 8px', fontSize: 13, cursor: 'pointer', pointerEvents: 'auto', maxWidth: 260 }}
          >
            {ALL_ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}{z.id !== z.name ? ` (${z.id})` : ''}</option>)}
          </select>
          <span className="hk-faint" style={{ fontSize: 12 }}>jump to a map · save before switching</span>
          </div>
        </HudPlate>
      )}

      {editMode && (
        <HudPlate face={HUD_FACE} style={{ position: 'fixed', top: 12, right: 12 }}>
        <div className="hearth-root" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', padding: '9px 10px', ...hearthBody }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 480 }}>
            {TOOLS.map((t) => <Btn key={t.id} active={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</Btn>)}
          </div>
          {/* resource-node blocks — click places, shift-click erases (single node per tile) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', maxWidth: 480 }}>
            <span className="hk-label hk-moss" style={{ fontSize: 13 }}>Nodes</span>
            {NODE_TOOLS.map((t) => <Btn key={t.id} active={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</Btn>)}
          </div>
          <BandReadout zoneId={districtZone} nodes={nodesRef.current} tick={nodes.length} />
          {/* moglin-patrol spawners — click places, shift-click erases; gate = the hold that retires it */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', maxWidth: 480 }}>
            <span className="hk-label hk-rust" style={{ fontSize: 13 }}>Spawners</span>
            {SPAWNER_TOOLS.map((t) => <Btn key={t.id} active={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</Btn>)}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="hk-ink" style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>brush {brush * 2 + 1}×{brush * 2 + 1}</span>
            <Btn onClick={() => setBrush((b) => Math.max(0, b - 1))}>−</Btn>
            <Btn onClick={() => setBrush((b) => Math.min(5, b + 1))}>+</Btn>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="hk-ink" style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>size {dims}</span>
            <Btn onClick={() => resize(-2, 0)}>W−</Btn>
            <Btn onClick={() => resize(2, 0)}>W+</Btn>
            <Btn onClick={() => resize(0, -2)}>H−</Btn>
            <Btn onClick={() => resize(0, 2)}>H+</Btn>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn onClick={clearZone}>Clear to empty</Btn>
            <HearthButton small primary onClick={save}>Save zone</HearthButton>
          </div>
          {/* DEV: drop straight into the in-world Keeper's Arena (bypasses party/zone/RNG gates) */}
          <HearthButton small onClick={() => { setEditMode(false); forceFight() }}>⚔ Force Fight (arena)</HearthButton>
          {saveMsg && <span className="hk-soft" style={{ fontSize: 12 }}>{saveMsg}</span>}
        </div>
        </HudPlate>
      )}

      {/* edit-mode Done button (enter is top-right; touch controls are hidden while editing) */}
      {editMode && isOwner && (
        <span style={{ position: 'fixed', bottom: 12, right: 12 }}><HearthButton primary onClick={() => setEditMode(false)}>Done editing</HearthButton></span>
      )}

      {/* First-person reticle — the aim point for left-click interact / right-click use. Lights up and
          names the action when an interactable sits under it (proximity-driven, reusing the near* state
          that already drives the bottom prompts). Desktop only; touch drives interaction via the A/B pad. */}
      {!isTouch && !editMode && !battle && !approach && !rewards && !dialogue && !openMenu && !placing && !weaponDrawn && (() => {
        const t = fish ? { c: fish.bite ? S.cue.bite : S.cue.water, verb: fish.bite ? 'Strike!' : 'Fishing' }
          : channel ? { c: S.cue.water, verb: 'Gathering' }
          : nearNpc ? { c: S.cue.talk, verb: `${nearNpc.verb ? nearNpc.verb[0].toUpperCase() + nearNpc.verb.slice(1) : 'Talk to'} ${nearNpc.name}` }
          : nearNode ? { c: S.cue.harvest, verb: 'Harvest' }
          : nearStation ? { c: STATIONS[nearStation.itemId]?.accent ?? mint.base, verb: STATIONS[nearStation.itemId]?.verb ?? 'Use' }
          : null
        const on = !!t, c = t?.c ?? S.cue.idle
        return (
          <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 30, pointerEvents: 'none' }}>
            <div style={{ position: 'relative', width: on ? 26 : 13, height: on ? 26 : 13, transition: 'width 0.12s ease-out, height 0.12s ease-out' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${c}`, opacity: on ? 0.95 : 0.32, boxShadow: on ? `0 0 9px ${c}88` : 'none', transition: 'opacity 0.12s' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 3, height: 3, borderRadius: '50%', background: c, opacity: on ? 1 : 0.55, transform: 'translate(-50%,-50%)' }} />
            </div>
            {on && t && (
              <HearthPill face={HUD_FACE} style={{ position: 'absolute', left: '50%', top: 'calc(100% + 9px)', transform: 'translateX(-50%)' }}>
                {t.verb} <HearthPillSoft face={HUD_FACE}>· click</HearthPillSoft>
              </HearthPill>
            )}
          </div>
        )
      })()}

      {/* Hotbar HUD — bag + 6 quick-slots + tool gauges + mana vial. Only while walking the world. */}
      {/* click-catcher — while the satchel is open, swallow canvas clicks (so a stray click can't re-lock
          the pointer under the panel) and let clicking outside the bag close it. Below the hotbar (z35)
          + satchel (z37), above the canvas. */}
      {bagOpen && <div onPointerDown={() => toggleBag(false)} style={{ position: 'fixed', inset: 0, zIndex: 34, background: 'transparent' }} />}

      {/* ── ★ THE CRUCIBLE MATCH CLOCK ────────────────────────────────────────────────────────
          The floor that is open and the seconds left in it, straight off `crucibleAt`. Sits above
          the weapon HUD because it governs it: a sealing floor is the reason to stop shooting and
          move. Shown on touch as well — the match runs whatever you are holding.
          ⚠ It NAMES the open floor and never claims an ascent; the floors are time windows in one
          arena until the geometry lands. */}
      {matchHud && !editMode && !dialogue && !battle && (
        <HearthPill face={HUD_FACE} accent={H.ember} style={{ position: 'fixed', top: 44, left: '50%', transform: 'translateX(-50%)', zIndex: 36 }}>{matchHud}</HearthPill>
      )}

      {/* ── THE HOLD's HUD: round · salvage · hush · surge, what E does here, and the fall ── */}
      {zoneId === HOLD_ZONE && holdHud && !editMode && (
        <>
          <HearthPill face={HUD_FACE} style={{ position: 'fixed', top: 54, left: '50%', transform: 'translateX(-50%)', zIndex: 35 }}>
            <span style={{ display: 'flex', gap: 13, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
              <span>Round <span className="hk-ember">{holdHud.round}</span></span>
              <HearthPillSoft face={HUD_FACE}>·</HearthPillSoft>
              <span>Salvage <span className="hk-sky">{holdHud.salvage}</span></span>
              <HearthPillSoft face={HUD_FACE}>·</HearthPillSoft>
              {holdHud.loud
                ? <span className="hk-ember" style={{ fontWeight: 800 }}>LOUD — they can hear you</span>
                : <span>Hush <span className={holdHud.hush < 30 ? 'hk-ember' : 'hk-moss'}>{fmtHush(holdHud.hush)}</span></span>}
              <HearthPillSoft face={HUD_FACE}>·</HearthPillSoft>
              <span>Surge <span className={holdHud.surge >= 1 ? 'hk-ember' : 'hk-soft'}>{holdHud.surge >= 1 ? 'READY (G)' : `${Math.round(holdHud.surge * 100)}%`}</span></span>
            </span>
          </HearthPill>
          {holdFlash && !holdHud.over && (
            <HearthPill face={HUD_FACE} style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)', zIndex: 35, fontSize: 22 }}>{holdFlash}</HearthPill>
          )}
          {holdHud.prompt && !holdHud.over && (
            <HearthPill face={HUD_FACE} style={{ position: 'fixed', bottom: 150, left: '50%', transform: 'translateX(-50%)', zIndex: 35 }}>
              {holdHud.prompt.kind === 'mend' && <span>Hold E — mend the seal <HearthPillSoft face={HUD_FACE}>{holdHud.prompt.planks}/{HOLD_TUNING.seals}</HearthPillSoft></span>}
              {holdHud.prompt.kind === 'gate' && <span>E — open the gate <HearthPillSoft face={HUD_FACE}>{holdHud.prompt.cost} salvage</HearthPillSoft></span>}
              {holdHud.prompt.kind === 'rack' && <span>E — {holdHud.prompt.bought ? 'refill the SPITTER' : 'take the SPITTER off the wall'} <HearthPillSoft face={HUD_FACE}>{holdHud.prompt.bought ? Math.round(holdHud.prompt.cost / 2) : holdHud.prompt.cost} salvage</HearthPillSoft></span>}
              {holdHud.prompt.kind === 'font' && <span>E — drink from the font (full mana) <HearthPillSoft face={HUD_FACE}>{holdHud.prompt.cost} salvage</HearthPillSoft></span>}
              {holdHud.prompt.kind === 'cache' && <span>E — a draught from the cache (+{HOLD_TUNING.cacheSec}s hush) <HearthPillSoft face={HUD_FACE}>{holdHud.prompt.cost} salvage</HearthPillSoft></span>}
            </HearthPill>
          )}
          {holdHud.over && (
            <HearthPill face={HUD_FACE} style={{ position: 'fixed', top: '32%', left: '50%', transform: 'translateX(-50%)', zIndex: 36, fontSize: 18 }}>
              <span>The hold fell at round <span className="hk-ember">{holdHud.round}</span> <HearthPillSoft face={HUD_FACE}>· {holdHud.kills} crushed · best {Math.max(holdHud.best, holdHud.round)} · E to go again</HearthPillSoft></span>
            </HearthPill>
          )}
        </>
      )}
      {/* ── Weapon viewmodel + firing-range HUD — outside the Ather only, desktop (click = fire) ── */}
      {weaponDrawn && !editMode && !dialogue && !battle && !placing && !isTouch && (
        <>
          <HearthPill face={HUD_FACE} style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 35 }}>
            <span style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
            {weaponUi.holstered
              ? <span className="hk-ember">Holstered <HearthPillSoft face={HUD_FACE}>· running</HearthPillSoft></span>
              : <span>{WEAPONS[weaponUi.idx].name} <HearthPillSoft face={HUD_FACE}>{WEAPONS[weaponUi.idx].slot}</HearthPillSoft></span>}
            <HearthPillSoft face={HUD_FACE}>·</HearthPillSoft>
            <span>shots <span className="hk-sky">{hudStats.shots}</span></span>
            <span>hits <span className="hk-moss">{hudStats.hits}</span></span>
            <HearthPillSoft face={HUD_FACE}>{weaponUi.holstered ? 'Q draw · F ready weapon' : 'Q swap · F holster · r-click aim · T console'}</HearthPillSoft>
            </span>
          </HearthPill>
          {/* range console — new-player range controls; opt-in danger lives here, never sprung on you */}
          {rangeOpen && (
            <HearthFrame title="Range console" maxWidth={320} fixed backdropClass="z-[40]" onClose={() => toggleRange(false)} dataPanel="range"
                         bodyClass="px-4 pt-6 pb-3" footer={<div className="text-center text-[12px]">T / Esc — close</div>}>
                {([
                  ['Target drift', 'floating targets strafe side to side', 'moving'],
                  ['Hostile hunter', 'ground drone hunts you + returns fire', 'hostile'],
                  ['The Puppet Guards', 'Seren · Cade · Wren — squeeze, trap, counter', 'guards'],
                  ['Crucible bots', '59 challengers fill the roster — Crucible zone only', 'bots'],
                ] as const).map(([label, desc, key]) => (
                  <button key={key} onClick={() => setRangeCfg((c) => ({ ...c, [key]: !c[key] }))}
                    className={`hk-plate hk-hover-fill${rangeCfg[key] ? ' is-lit' : ''}`} style={{
                    display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '9px 11px', marginBottom: 8, cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span>
                      <span className="hk-ink" style={{ display: 'block', font: `600 15px ${hearthDisplay.fontFamily}` }}>{label}</span>
                      <span className="hk-soft" style={{ fontSize: 12 }}>{desc}</span>
                    </span>
                    <span className={rangeCfg[key] ? 'hk-moss' : 'hk-faint'} style={{ fontWeight: 800, fontSize: 12 }}>{rangeCfg[key] ? 'On' : 'Off'}</span>
                  </button>
                ))}
                {/* ── live guard tuning — OWNER ONLY ──────────────────────────────────────────
                    Owner-gated because this is a tuning surface, not a game control: the console's
                    own header calls itself "new-player range controls", and six sliders of boss
                    internals is the opposite of that. Shown only while the guards are ON, so it
                    cannot be read as settings for a fight that is not happening. */}
                {isOwner && rangeCfg.guards && (
                  <div className="hk-plate" style={{ marginBottom: 8, padding: '9px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                      <span className="hk-label hk-ember" style={{ fontSize: 13 }}>Guard tuning</span>
                      <button onClick={() => setRangeCfg((c) => ({ ...c, tune: { ...GUARD_TUNING } }))} className="hk-btn px-2 py-0.5 text-[11px]">Reset</button>
                    </div>
                    {GUARD_KNOBS.map((k) => (
                      <label key={k.key} style={{ display: 'block', marginBottom: 7 }}>
                        <span className="hk-ink" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                          <span>{k.label}</span>
                          <span className={rangeCfg.tune[k.key] === GUARD_TUNING[k.key] ? 'hk-faint' : 'hk-moss'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {rangeCfg.tune[k.key].toFixed(k.dp)}{k.unit}
                          </span>
                        </span>
                        <input
                          type="range" min={k.min} max={k.max} step={k.step} value={rangeCfg.tune[k.key]}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            setRangeCfg((c) => ({ ...c, tune: { ...c.tune, [k.key]: v } }))
                          }}
                          style={{ width: '100%', accentColor: H.ember, cursor: 'pointer' }}
                        />
                      </label>
                    ))}
                    <div className="hk-faint" style={{ fontSize: 11, lineHeight: 1.45 }}>
                      live on the running fight. moss = moved off default. toggle the guards
                      off then on to re-arm three fresh puppets.
                    </div>
                  </div>
                )}
                {/* THE HOLD's layout-walk shortcuts — owner-only: every floor below the roof sits behind
                    salvage a real run takes rounds to earn, and a layout pass is a walk (`hold.ts`). */}
                {isOwner && zoneId === HOLD_ZONE && holdRef.current && (
                  <div className="hk-plate" style={{ marginBottom: 8, padding: '9px 10px' }}>
                    <div className="hk-faint" style={{ fontSize: 11, marginBottom: 7 }}>The Hold — layout walk (owner)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 7 }}>
                      <HearthButton small onClick={() => { if (holdRef.current) { ownerOpenAll(holdRef.current); setHoldFlash('Every gate open') } }}>Open every gate</HearthButton>
                      <HearthButton small onClick={() => { if (holdRef.current) { holdRef.current.salvage += 5000; setHoldFlash('+5000 salvage') } }}>+5000 salvage</HearthButton>
                      <HearthButton small onClick={() => { if (holdRef.current) { ownerCalm(holdRef.current); setHoldFlash('The tide is calm') } }}>Calm the tide</HearthButton>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {holdSpots(HOLD_MAP).map(sp => (
                        <HearthButton key={sp.label} small onClick={() => { posRef.current?.set(sp.x, sp.y * STEP, sp.z); toggleRange(false) }}>{sp.label}</HearthButton>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <HearthButton small onClick={() => { shotsRef.current = 0; hitsRef.current = 0; setHudStats({ shots: 0, hits: 0 }) }}>Reset stats</HearthButton>
                </div>
            </HearthFrame>
          )}
          {!weaponUi.holstered && <WeaponReticle bloomRef={bloomRef} adsRef={adsRef} weaponIdxRef={weaponIdxRef} />}
          <ResourceBars hpRef={hpRef} hpMaxRef={hpMaxRef} shieldRef={shieldRef} shieldMaxRef={shieldMaxRef} />
          <AmmoCounter ammoRef={ammoRef} reloadingRef={reloadingRef} weaponIdxRef={weaponIdxRef} />
          <CastBar slots={castHud.slots} stance={castHud.stance} cdRef={castCdRef} />
          <TremorSenseHud tremorRef={tremorRef} />
          <style>{`@keyframes hitFlash{0%{opacity:1}100%{opacity:0}}@keyframes dmgFlash{0%{opacity:1}100%{opacity:0}}@keyframes downFlash{0%{opacity:1}55%{opacity:0.85}100%{opacity:0}}`}</style>
          {/* hitmarker — four outward diagonal ticks around the reticle, flashed per landed round */}
          <div ref={hitmarkRef} style={{ position: 'fixed', left: '50%', top: '50%', zIndex: 31, pointerEvents: 'none', opacity: 0 }}>
            {[45, 135, 225, 315].map((a) => (
              <div key={a} style={{ position: 'absolute', left: -1, top: -3.5, width: 2, height: 7, background: `var(--hm, ${S.gun.hitmark})`,
                boxShadow: '0 0 0 1px rgba(8,12,18,0.8)', transform: `rotate(${a}deg) translateY(-11px)` }} />
            ))}
          </div>
          {/* damage vignette — red edge pulse on hit; longer, heavier pulse on a down/reset */}
          <div ref={vignetteRef} style={{ position: 'fixed', inset: 0, zIndex: 29, pointerEvents: 'none', opacity: 0,
            background: 'radial-gradient(ellipse at center, transparent 52%, rgba(255,58,44,0.5) 100%)' }} />
          {/* caster viewmodel — outer div raises it to the sighted pose on ADS (React, transitioned);
              inner casterRef keeps the imperative recoil kick, so the two transforms don't fight.
              ★ CANON: a manabox is dead grey CAST metal (iron-grey + dull bronze, Roman-bones/mana-veins).
              It only lights IN A HAND — so the emitter core glows the wielder's SOUL_COLOR (channels
              running), never the body. Weapons differ by SILHOUETTE (thin Spitter vs heavy Lance), not
              colour. Hidden while holstered. */}
          {!weaponUi.holstered && (
          <div style={{ position: 'fixed', right: '17%', bottom: 0, zIndex: 33, pointerEvents: 'none',
            transform: ads ? 'translate(-150px, -30px) scale(1.14)' : 'translate(0,0) scale(1)', transition: 'transform 0.14s ease-out' }}>
            <div ref={casterRef}>
              <style>{`@keyframes casterKick { 0% { transform: translateY(16px) } 60% { transform: translateY(-3px) } 100% { transform: translateY(0) } }
@keyframes casterReload { 0% { transform: translateY(0) rotate(0deg) } 30% { transform: translateY(36px) rotate(-7deg) } 70% { transform: translateY(30px) rotate(-5deg) } 100% { transform: translateY(0) rotate(0deg) } }`}</style>
              {weaponUi.idx === 1 ? (
                // LANCE (reacher) — a longer, heavier cast body: thick receiver, long barrel, bronze trim.
                // Dead grey/bronze metal; the focusing core lights SOUL_COLOR (in-hand).
                <svg width="272" height="176" viewBox="0 0 272 176" style={{ display: 'block' }}>
                  <polygon points="40,176 60,84 178,120 158,176" fill={S.viewmodel.lanceStock} stroke={S.viewmodel.lanceTrim} strokeWidth="2" />
                  <polygon points="54,92 96,58 236,96 150,120" fill={S.viewmodel.lanceBody} stroke={S.viewmodel.bronze} strokeWidth="2" />
                  <rect x="150" y="86" width="96" height="12" rx="5" fill={S.viewmodel.lanceBarrel} stroke={S.viewmodel.bronze} strokeWidth="2" transform="rotate(-8 150 92)" />
                  <circle cx="92" cy="88" r="20" fill="none" stroke={SOUL_COLOR} strokeOpacity="0.4" strokeWidth="3" />
                  <circle cx="92" cy="88" r="12" fill={SOUL_COLOR} />
                  <circle cx="240" cy="80" r="6" fill={SOUL_COLOR} opacity="0.9" />
                </svg>
              ) : (
                // SPITTER (shortbarrel) — the thin light SMG silhouette. Dead grey/bronze; emitter glows SOUL_COLOR.
                <svg width="240" height="168" viewBox="0 0 240 168" style={{ display: 'block' }}>
                  <polygon points="46,168 66,92 158,122 138,168" fill={S.viewmodel.spitterStock} stroke={S.viewmodel.spitterTrim} strokeWidth="2" />
                  <polygon points="58,98 100,70 126,96 104,122" fill={S.viewmodel.spitterBody} stroke={S.viewmodel.spitterBronze} strokeWidth="2" />
                  <circle cx="94" cy="96" r="17" fill="none" stroke={SOUL_COLOR} strokeOpacity="0.35" strokeWidth="2" />
                  <circle cx="94" cy="96" r="10" fill={SOUL_COLOR} />
                  <rect x="100" y="90" width="52" height="6" rx="3" fill={SOUL_COLOR} opacity="0.9" />
                </svg>
              )}
            </div>
          </div>
          )}
        </>
      )}

      {/* ── Gun bench prompt — shown when standing at a bench, weapon out, panel closed ── */}
      {weaponDrawn && nearBench && !benchOpen && !editMode && !dialogue && !battle && !placing && !isTouch && (
        <HearthPill face={HUD_FACE} style={{ position: 'fixed', left: '50%', bottom: 92, transform: 'translateX(-50%)', zIndex: 34 }}>
          <span className="hk-ember">E</span> — Armory <HearthPillSoft face={HUD_FACE}>· build loadout</HearthPillSoft>
        </HearthPill>
      )}

      {/* ── Gun bench — the loadout editor: two slots you fill from the arsenal ── */}
      {benchOpen && (
        <HearthFrame title="Armory" maxWidth={460} fixed backdropClass="z-[45]" onClose={() => toggleBench(false)} dataPanel="armory"
                     bodyClass="px-4 pt-6 pb-3" footer={<div className="text-center text-[12px]">E / Esc — close</div>}>
            <div className="hk-soft" style={{ fontSize: 13, fontStyle: 'italic', marginBottom: 12, fontFamily: hearthDisplay.fontFamily }}>Pick a slot, then a manabox. The round always trails your own colour.</div>
            {/* the two loadout slots */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[0, 1].map(s => {
                const w = WEAPONS[loadoutUi[s]] ?? WEAPONS[0]
                const sel = benchSlot === s
                return (
                  <button key={s} onClick={() => setBenchSlot(s)} className={`hk-plate hk-hover-fill${sel ? ' is-lit' : ''}`} style={{
                    flex: 1, textAlign: 'left', cursor: 'pointer', padding: '9px 11px',
                  }}>
                    <div className="hk-faint" style={{ fontWeight: 700, fontSize: 11 }}>Slot {s + 1}{s === 0 ? '  ·  Q' : ''}</div>
                    <div className="hk-ink" style={{ font: `600 17px ${hearthDisplay.fontFamily}`, marginTop: 2 }}>{w.name}</div>
                    <div className="hk-soft" style={{ fontWeight: 600, fontSize: 11 }}>{w.slot}</div>
                  </button>
                )
              })}
            </div>
            <div className="hk-label hk-soft" style={{ fontSize: 13, marginBottom: 7 }}>Arsenal → slot {benchSlot + 1}</div>
            {/* the arsenal — click to equip into the selected slot */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {WEAPONS.map((w, i) => {
                const equipped = loadoutUi[benchSlot] === i
                return (
                  <button key={w.id} onClick={() => equipWeapon(benchSlot, i)} className={`hk-plate hk-hover-fill${equipped ? ' is-lit' : ''}`} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left',
                    cursor: 'pointer', padding: '9px 11px',
                  }}>
                    <span>
                      <span className="hk-ink" style={{ font: `600 15px ${hearthDisplay.fontFamily}` }}>{w.name}</span>
                      <span className="hk-faint" style={{ fontWeight: 600, fontSize: 11, marginLeft: 8 }}>{w.slot} · {w.auto ? 'auto' : 'semi'}</span>
                    </span>
                    <span className="hk-soft" style={{ display: 'flex', gap: 12, fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                      <span>dmg <b className="hk-ink">{w.damage}</b></span>
                      <span>clip <b className="hk-ink">{w.clip}</b></span>
                      {equipped && <span className="hk-ember">◄ equipped</span>}
                    </span>
                  </button>
                )
              })}
            </div>
        </HearthFrame>
      )}

      {/* ── ★ THE REVEAL — shown only once the screen is free ──────────────────────────────────
          The spirit is ALREADY evolved and persisted by `runEvolutions`; this is the ceremony. It
          waits behind the spoils reveal and any dialogue rather than stacking on top of them, which
          is why the two are split: the state cannot be lost by a queue that never gets its turn. */}
      {evolving && !battle && !approach && !rewards && !dialogue && (
        <EvolutionOverlay
          spirit={evolving.spirit}
          evolution={evolving.evolution}
          onComplete={() => {
            setEvolving(null)
            // A second spirit may have crossed in the same fight — one overlay at a time, so ask
            // again on the way out rather than dropping the rest of the party's forms.
            runEvolutions()
          }}
        />
      )}

      {partyOpen && (
        <PartyPanel
          key={partyTick}
          owned={partyRef.current ?? []}
          maxParty={MAX_PARTY}
          salves={countItem(invRef.current, MEND_POTION_ID)}
          infusionsHeld={{
            mana:  countItem(invRef.current, INFUSION_BREWS.mana),
            storm: countItem(invRef.current, INFUSION_BREWS.storm),
            earth: countItem(invRef.current, INFUSION_BREWS.earth),
            water: countItem(invRef.current, INFUSION_BREWS.water),
          }}
          isTouch={isTouch}
          onMend={mendSpirit}
          onInfuse={infuseSpirit}
          onSetLead={setPartyLead}
          onSetActive={setSpiritActiveIn}
          initialSelId={partyInitialSelRef.current}
          onClose={() => { partyInitialSelRef.current = null; toggleParty(false) }}
        />
      )}

      {!battle && !approach && !rewards && !editMode && !dialogue && !placing && (<>
        {/* The bar + the corner: `shimmer/hud/`, the Ather's own. `onSelect` because the mortal side has
            touch play; the name over the bar is the registry's label for what is selected. */}
        {/* `activeTool` is the Ather's "which family is mining right now" — here it is the channel's
            family, or rinning while the line is out. `toolTick` is read so a break re-renders the arch.
            No vitals / buffs / clock / map frame: see the Phase 9 note at the imports. */}
        <HearthHudLayer face={HUD_FACE} size={hudSize} entries={hotbarEntries} sel={hotSel} held={heldName} dimmed={false} onSelect={selectSlot}
          objective={null} mana={manaCornerRef} tools={equippedToolsRef} skills={skillsRef}
          activeTool={(void toolTick, channel?.family ?? (fish ? 'rinning' : null))}
          glyph={f => <ToolGlyph family={f} />} clock={false} mapFrame={false} />
      </>)}
      {bagOpen && (
        <BagPanel inv={invRef} spiritIndex={spiritIndexRef} chest={null} tick={bagTick} sel={hotSel}
                  dragFrom={dragFrom} setDragFrom={setDragFrom}
                  onMove={moveSlot} onSplit={splitSlot} onQuick={() => {}}
                  onClose={() => toggleBag(false)} tools={equippedToolsRef} skills={skillsRef}
                  party={partyForBag} onParty={() => { persist(); setBagTick(t => t + 1) }}
                  onLetters={() => { setBagTick(t => t + 1); applyLoadout() }}
                  castKeys={BAND_KEYS} />
      )}

      {/* ── Mobile controls: joystick (move) bottom-left · A interact / B cancel bottom-right ── */}
      {isTouch && !battle && !editMode && !placing && (
        <>
          {/* ★ ON THE BAR'S CLEARANCE, not a fixed 96: the hearth bar (with its lip on a phone) reaches
              ~125px, and 96 put the joystick and the A/B buttons ON it. Measured in `hearth-hud-layer`. */}
          <TouchJoystick joyRef={joyRef} bottom={HUD_BAR_CLEAR[hudSize] + 8} />
          <div style={{ position: 'fixed', bottom: HUD_BAR_CLEAR[hudSize] + 8, right: 30, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {/* B — cancel/back (upper, smaller). Backs out of the New Game prompt / dismisses a toast. */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); if (confirmNew) setConfirmNew(false); else if (banner) setBanner(null) }}
              aria-label="cancel"
              style={touchKnob(56, H.rust)}
            >✕</button>
            {/* A — interact/confirm (lower, bigger, where the thumb rests): advance dialogue / talk to an NPC / confirm New Game. */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); if (dialogue) advanceDialogue(); else if (nearNpc) talk(nearNpc); else if (fish || nearNode || channel) toggleChannel(); else if (nearStation) openStation(); else if (confirmNew) { setConfirmNew(false); setBirthCancelable(true); setBirthOpen(true) } }}
              aria-label="interact"
              style={touchKnob(76, fish || channel ? H.sky : nearNpc || dialogue ? H.ember : nearNode ? H.moss : nearStation ? H.ember : undefined)}
            >{fish ? (fish.bite ? '❗' : '🎣') : channel ? '⏹' : nearNode && !nearNpc && !dialogue ? '🪓' : nearStation && !nearNpc && !dialogue ? STATIONS[nearStation.itemId].emoji : '✦'}</button>
          </div>
          {/* Jump (edge) + Slide (held) — left of the A/B column. Only meaningful in first-person play. */}
          <div style={{ position: 'fixed', bottom: HUD_BAR_CLEAR[hudSize] + 8, right: 118, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <button
              onPointerDown={(e) => { e.stopPropagation(); slideRef.current = true }}
              onPointerUp={(e) => { e.stopPropagation(); slideRef.current = false }}
              onPointerCancel={() => { slideRef.current = false }}
              aria-label="crouch / slide"
              style={touchKnob(56)}
            >⇊</button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); jumpRef.current = true }}
              aria-label="jump"
              style={touchKnob(68)}
            >⤒</button>
          </div>
        </>
      )}

      {/* B hotkey (keyboard) — owner only, and not while a battle overlay is up */}
      <KeyToggle onB={() => { if (isOwner && !battleRef.current) setEditMode((e) => !e) }} />

      {/* Combat, mounted over the 3D world. ALL fights — wild and the scripted liberation holds
          (thistle/vetch/brack) — run the real-time Keeper's Arena. The collar breaks on the win
          (freed-vs-forced was ruled non-canon 2026-07-04: win = free). */}
      {/* wild-encounter approach beat — the mist stirs and a spirit is drawn to you, then the ring
          materializes. Tap to skip straight into the fight. */}
      {approach && !battle && (
        <EncounterApproach name={approach.enc.name} element={approach.enc.element} onSkip={commitApproach} />
      )}

      {/* post-win spoils reveal — the payoff: gold + per-spirit XP/level breakdown. Unfreezes on close. */}
      {rewards && !battle && (
        <BattleRewards gold={rewards.gold} rows={rewards.rows} onClose={() => { setRewards(null); battleRef.current = false; relockPointer() }} />
      )}

      {/* The five placeable-station menus (alchemy / craft / chest / exchange / farm).
          Extracted to StationMenus.tsx — the walker keeps every ref + action, and hands them down. */}
      <StationMenus
        openMenu={openMenu} closeStation={closeStation}
        skillsRef={skillsRef} invRef={invRef} manaRef={manaRef} equippedToolsRef={equippedToolsRef}
        geRef={geRef} plantedCropsRef={plantedCropsRef}
        toolTick={toolTick} chestsTick={chestsTick} cropsTick={cropsTick}
        wallet={wallet} tradeToast={tradeToast}
        brew={brew} craft={craft} craftToolAction={craftToolAction} repairToolAction={repairToolAction}
        bankRef={bankRef} bankTick={bankTick} bankCapacityNow={bankCapacityNow}
        bankDepositSlot={bankDepositSlot} bankDepositAllMaterials={bankDepositAllMaterials} bankWithdrawItem={bankWithdrawItem}
        getChest={getChest} transferChestSlot={transferChestSlot}
        tradeSell={tradeSell} tradeBuy={tradeBuy}
        harvestAt={harvestAt} plantAt={plantAt}
      />

      {cabinet && (
        <ArcadeCabinet game={cabinet} isOwner={isOwner}
          onClose={() => { setCabinet(null); battleRef.current = false; closeCursorUI() }} />
      )}

      {rackOpen !== null && (
        <PassagePanel
          items={invRef}
          owned={runeInvRef.current.owned}
          birth={runeInvRef.current.birth}
          nowMs={rackOpen}
          dayOverride={null}
          shelves={rackStall?.shelves}
          title={rackStall?.title}
          onChange={() => {
            // A scroll or a lesson changes the book; a sale changes the bag; a gem changes the letters.
            // Re-read the book from the one door (`keeperBook`) and re-resolve immediately: a word you
            // just bought must be bindable without a reload, and `applyLoadout` re-reads by design.
            bookRef.current = keeperBook(runeInvRef.current.owned)
            syncSkillHud()
            applyLoadout()
          }}
          onClose={() => { setRackOpen(null); setRackStall(null); battleRef.current = false; closeCursorUI() }}
        />
      )}

      {battle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: S.arenaFloor }}>
          {/* All fights — wild AND the scripted liberation holds — run the Keeper's Arena now.
              (The old turn-based PartyBattleScene + reach/captive mechanic was retired when the
              freed-vs-forced beat was ruled non-canon: win = free, the collar breaks on the win.) */}
          <ArenaBattle
            allies={battle.allies}
            enemies={battle.enemies}
            enemyTier={battle.aiTier}
            collaredIndices={battle.collared}
            title={battle.title}
            bagCharges={countItem(invRef.current, MEND_POTION_ID)}
            onEnd={(o, result) => endBattle(o === 'win' ? 'win' : 'lose', result)}
          />
        </div>
      )}

      {/* Rinning cast-and-catch — the water-node minigame (opens instead of channelling) */}
    </div>
  )
}

// The wild-encounter approach beat — a short, canon-true "a spirit drifts toward you out of
// curiosity" flourish that eases the jump from overworld to the arena (no hard cut). Element-tinted
// bloom + the spirit's name, ~1.3s, tap anywhere to skip.
function EncounterApproach({ name, element, onSkip }: { name: string; element: Element; onSkip: () => void }) {
  const col = ELEMENT_COLORS[element] ?? mint.base
  return (
    <div onPointerDown={onSkip} style={{
      position: 'fixed', inset: 0, zIndex: 50, background: S.approach.ground, overflow: 'hidden', cursor: 'pointer',
      touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'encFade 0.22s ease-out',
    }}>
      <style>{`
        @keyframes encFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes encBloom { 0% { transform: scale(0.2); opacity: 0 } 45% { opacity: 0.95 } 100% { transform: scale(1.7); opacity: 0.5 } }
        @keyframes encRise { 0% { transform: translateY(16px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes encFlash { 0%, 72% { opacity: 0 } 88% { opacity: 0.8 } 100% { opacity: 0 } }
      `}</style>
      {/* element bloom drawing inward */}
      <div style={{
        position: 'absolute', width: '82vmin', height: '82vmin', borderRadius: '50%', filter: 'blur(2px)',
        background: `radial-gradient(circle, ${col}cc 0%, ${col}44 42%, transparent 70%)`, animation: 'encBloom 1.15s ease-out forwards',
      }} />
      <div style={{ position: 'relative', textAlign: 'center', animation: 'encRise 0.5s ease-out 0.12s both' }}>
        <div style={{ font: '700 12px ui-monospace, monospace', color: S.approach.kicker, letterSpacing: '0.28em', opacity: 0.7, marginBottom: 8 }}>✦ THE MIST STIRS</div>
        <div style={{ font: '900 30px ui-monospace, monospace', color: col, letterSpacing: '0.04em', textShadow: `0 0 22px ${col}88, 0 2px 6px ${S.approach.shadow}` }}>{name}</div>
        <div style={{ font: '600 14px ui-monospace, monospace', color: S.approach.line, marginTop: 8, opacity: 0.85 }}>is drawn to you…</div>
      </div>
      {/* end flash — snaps into the arena */}
      <div style={{ position: 'absolute', inset: 0, background: S.approach.flash, pointerEvents: 'none', animation: 'encFlash 1.3s ease-in forwards' }} />
    </div>
  )
}

// Post-win spoils reveal — the loop's payoff. Gold + a per-spirit row: level (with a Lv↑ jump when
// they leveled), XP gained, and an animated bar filling toward the next level. Tap CONTINUE to return.
// ── Level-up card ──────────────────────────────────────────────────────────────
// Alex, on his level-6 Dewbear: "I don't see much difference." He was right twice over —
// the arena ignored level entirely (fixed in engine/arena.ts), and NOTHING ever showed the
// growth, because stats are recomputed from `level` on every read and never announced.
//
// Design note, and it is load-bearing: a real level-up here is +1 to a couple of stats and
// +0 to the rest (water-bear L6→7 = +1 pwr/grd/foc/res/agi/vig, +1 HP). So the CURRENT VALUE
// is the hero and the delta is an accent chip — a card built the other way round renders
// "+0 +0 +1 +0" and reads worse than showing nothing at all. Unchanged stats stay dim rather
// than shouting a zero. If the deltas ever deserve top billing, that is a growth-curve change
// (party-stats.ts `1 + level/60`), not a card change.
const STAT_LABELS: [keyof PartyStats, string][] = [
  ['maxHp', 'HP'], ['pwr', 'PWR'], ['grd', 'GRD'], ['foc', 'FOC'], ['res', 'RES'], ['agi', 'AGI'], ['vig', 'VIG'],
]

function StatTick({ label, from, to, delay }: { label: string; from: number; to: number; delay: number }) {
  const [v, setV] = useState(from)
  const gained = to - from
  useEffect(() => {
    if (gained === 0) { setV(to); return }
    let raf = 0, t0 = 0
    const DUR = 620
    const start = (ts: number) => {
      if (!t0) t0 = ts
      const p = Math.min(1, (ts - t0) / DUR)
      const ease = 1 - Math.pow(1 - p, 3)
      setV(Math.round(from + (to - from) * ease))
      if (p < 1) raf = requestAnimationFrame(start)
    }
    const timer = setTimeout(() => { raf = requestAnimationFrame(start) }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [from, to, gained, delay])
  const hot = gained > 0
  return (
    <div className={hot ? 'hk-fill' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '4px 2px', borderRadius: 7 }}>
      <span className={hot ? 'hk-ink' : 'hk-faint'} style={{ font: `700 10px ${hearthBody.fontFamily}`, letterSpacing: '0.06em' }}>{label}</span>
      <span className={hot ? 'hk-ink' : 'hk-soft'} style={{ font: `800 15px ${hearthBody.fontFamily}`, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
      <span className={hot ? 'hk-moss' : 'hk-faint'} style={{ font: `800 11px ${hearthBody.fontFamily}` }}>
        {hot ? `+${gained}` : '·'}
      </span>
    </div>
  )
}

function BattleRewards({ gold, rows, onClose }: {
  gold: number
  rows: { name: string; element: Element; fromLevel: number; toLevel: number; xpGained: number; curXp: number; needXp: number; evolved: boolean; statsBefore: PartyStats; statsAfter: PartyStats; learned: string[] }[]
  onClose: () => void
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), 70); return () => clearTimeout(t) }, [])
  // ★ ON THE HEARTH (2026-09-23): the spoils are a parchment card in the carved frame, like every
  // other menu. The element hue survives as each spirit's dot and its XP groove (ELEMENT_COLORS is
  // per-element DATA); everything else is `hk-*` / `H`. No close knob: the one way on is Continue,
  // which is what unfreezes the world.
  return (
    <HearthFrame title="Spoils" maxWidth={430} fixed backdropClass="z-[50]" closable={false} onClose={() => {}} dataPanel="spoils" bodyClass="px-4 pt-6 pb-4">
      <style>{`
        @keyframes lvlPop { from { transform: scale(0.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes lvlSlide { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
      `}</style>
        {gold > 0 && (
          <div className="hk-ember" style={{ textAlign: 'center', font: `600 18px ${hearthDisplay.fontFamily}` }}>+{gold} ✦ marks</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: gold > 0 ? 12 : 0 }}>
          {rows.map((r, i) => {
            const pct = Math.min(100, Math.round((r.curXp / Math.max(1, r.needXp)) * 100))
            const leveled = r.toLevel > r.fromLevel
            const col = ELEMENT_COLORS[r.element] ?? ELEMENT_COLORS.base
            return (
              <div key={i} className={`hk-plate${leveled ? ' is-lit' : ''}`} style={{ padding: '9px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <span className="hk-ink" style={{ font: `600 16px ${hearthDisplay.fontFamily}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, font: `700 12px ${hearthBody.fontFamily}`, fontVariantNumeric: 'tabular-nums' }}>
                    <span className="hk-moss">+{r.xpGained} XP</span>
                    <span className={leveled ? 'hk-ember' : 'hk-soft'} style={{ fontWeight: 800 }}>
                      {leveled ? `Lv ${r.fromLevel}→${r.toLevel}` : `Lv ${r.toLevel}`}
                    </span>
                  </span>
                </div>
                {/* XP groove toward next level — fills in on reveal */}
                <div style={{ height: 7, background: H.paperLo, borderRadius: 999, overflow: 'hidden', marginTop: 8, boxShadow: 'inset 0 1px 2px rgba(58,39,22,.35)' }}>
                  <div style={{ height: '100%', width: shown ? `${pct}%` : '0%', background: col, borderRadius: 999, transition: 'width 0.7s cubic-bezier(0.2,0.8,0.2,1)' }} />
                </div>
                {(leveled || r.evolved) && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                    {leveled && <span style={{ font: `800 11px ${hearthBody.fontFamily}`, color: H.paperHi, background: H.ember, borderRadius: 999, padding: '2px 9px', animation: 'lvlPop 0.45s cubic-bezier(0.2,1.4,0.4,1) both' }}>Level up</span>}
                    {r.evolved && <span className="hk-ember hk-rule-ember" style={{ font: `800 11px ${hearthBody.fontFamily}`, borderWidth: 1, borderStyle: 'solid', borderRadius: 999, padding: '2px 9px' }}>✦ Ready to evolve</span>}
                  </div>
                )}
                {/* The growth itself — the half that was never shown. */}
                {leveled && shown && (
                  <div className="hk-rule" style={{ marginTop: 8, borderTopWidth: 1, borderTopStyle: 'solid', paddingTop: 8, animation: 'lvlSlide 0.4s ease-out both' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                      {STAT_LABELS.map(([k, lab], si) => (
                        <StatTick key={k} label={lab} from={r.statsBefore[k]} to={r.statsAfter[k]} delay={120 + si * 55} />
                      ))}
                    </div>
                    {r.learned.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                        <span className="hk-label hk-soft" style={{ fontSize: 13, flexShrink: 0 }}>Learned</span>
                        {r.learned.map((mv) => (
                          <span key={mv} className="hk-ink hk-fill-ember" style={{ font: `700 12px ${hearthBody.fontFamily}`, borderRadius: 999, padding: '2px 9px', boxShadow: `inset 0 0 0 1px ${col}` }}>{mv}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <HearthButton primary onClick={onClose}>Continue</HearthButton>
        </div>
    </HearthFrame>
  )
}

// Tap-to-transfer slot grid — used by the Chest menu for both the chest's storage and the
// player's satchel. No drag needed (mobile-first): tap a filled slot to move that stack.

function KeyToggle({ onB }: { onB: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'b') onB() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onB])
  return null
}
