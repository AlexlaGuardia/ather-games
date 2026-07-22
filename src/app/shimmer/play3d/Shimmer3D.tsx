'use client'
// Phase 1 foundation: the blockout map walkable in 3D, blocky tiered terrain, and an in-3D
// BLOCKOUT TOOL — press B for edit mode, pick a tool (Raise/Lower/Wall/Water/Floor) + brush size
// from the on-screen palette, click/drag the terrain, then Save. Height tools edit the per-zone
// height grid; cell tools edit the tile grid (so you can remove water/walls). Save persists both
// (heights→/shimmer/save-heights, grid→/shimmer/save-map). Warps/collision reuse the 2D engine.
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback, memo } from 'react'
import * as THREE from 'three'
import { walkable } from '../engine/player'
import { resolveStand, canStandAt, surfacesAt, EMPTY_SEGS, type CollisionCtx } from '../engine/segs-collision'
import { SOLID } from '../world/tiles'
import { ZONES, getZone, checkWarp, type Zone, type Warp } from '../world/zones'
import { getHeightGrid } from '../world/heightmaps'
import { GardenAtmosphere } from '../world/atmosphere'
import { FloraTree, FloraDressing } from '../world/flora'
import { rollEncounter, type WildEncounter } from '../engine/encounters'
import { createSpirit, addXP, xpForLevel, speciesDisplayName, ELEMENT_COLORS, type Spirit, type Species, type Element } from '../spirits/spirit'
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
import { createBeast, checkBeastUnlock, beastsToSave, beastsFromSave, BEAST_SPECIES, BEAST_DEFS, BEAST_PERKS, PERK_INFO, getBonusFindChance, getSpeedBonus, type ManaBeast, type BeastSpecies } from '../beasts/beast'
import { createInventory, inventoryToSave, inventoryFromSave, addItems, removeItems, countItem, transferItem, createChestStorage, chestToSave, chestFromSave, type Inventory, type ItemStack, type ChestStorage, type ChestSave } from '../engine/inventory'
import { createManaPool, manaToSave, manaFromSave, getMaxPool, type ManaPool } from '../engine/mana'
import { brewPotion, POTION_DEFS } from '../engine/alchemy'
import { canCraft, craftItem, RECIPE_DEFS } from '../engine/crafting'
import { createGEState, buyFromGE, sellToGE, tickPriceDrift, GE_ITEM_IDS, geToSave, geFromSave, type GEMarketState, type GESave } from '../engine/exchange'
import { CROP_DEFS, plantCrop, harvestCrop, plantedCropsToSave, plantedCropsFromSave, type PlantedCrop } from '../engine/farming'
import type { AITier } from '../engine/battle-ai'
import ArenaBattle from '../components/ArenaBattle'
import HotBar from './HotBar'
import { NPCS_3D, GREG_INTRO_LINES, GREG_NUDGE, GREG_RETURN, THISTLE_TAUNT_NO_SPIRIT, THISTLE_PREFIGHT, THISTLE_DEFEAT, FREED_SPIRIT_BEAT, SORREL_PREFIGHT, SORREL_DEFEAT, FREED_PAIR_BEAT, BRACK_PREFIGHT, BRACK_FINALE, type NPC3D } from './npcs3d'
import { useCloudSave } from '@/lib/use-cloud-save'
import { useWallet } from '@/lib/use-wallet'
import { StationMenus, type PlacedStruct, type StationKind } from './StationMenus'
import { prettyItem, menuBtn, TOOL_HUD } from './ui'
import { WorldMap, MiniMap } from './WorldMap'
import { WORLD_ZONE_ID, registerGardenWorld, getGardenWorld, isStitched, fromWorld } from '../world/garden-world'
import { allNpcs, nodePlacementsFor, logicalZoneAt, structuresView, logicalStruct } from './world-adapter'

// The composed continent registers as a zone before any getZone/save-load runs.
registerGardenWorld()
const ALL_NPCS = allNpcs()

const START_ZONE = WORLD_ZONE_ID // the continent IS the overworld; old zones stay editable via the dropdown
const WATER_ID = 8, FLOOR_ID = 97, WALL_ID = 34, WARP_ID = 14, MIST_ID = 31
// Encounters: stepping onto a fresh MIST tile can draw a wild spirit. Per-zone odds live in
// ENCOUNTER_TABLES (engine/encounters.ts → `rate`); these dials shape it for the 3D walker so a
// 888-mist zone isn't wall-to-wall battles.
const ENCOUNTER_GRACE = 1.3 // seconds after a battle / zone-entry before mist can roll again
const MAX_PARTY = 4         // active party size (matches the 2D game)
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
type Tool = 'raise' | 'lower' | 'floor' | 'wall' | 'water' | 'mist' | 'warp' | 'void' | NodeType
// Node-placing tools exposed in the editor (place = click, erase = shift-click). Terrain tools
// paint the tile grid; node tools drop/remove a resource node in the separate node layer.
const NODE_TOOLS: { id: NodeType; label: string }[] = [
  { id: 'shimmeroak', label: 'Shimmeroak' },
]
const NODE_TOOL_IDS = new Set<string>(NODE_TOOLS.map(t => t.id))
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
const placeIconBtn = (accent: string): React.CSSProperties => ({ width: 60, height: 60, borderRadius: '50%', border: `2px solid ${accent}`, background: 'rgba(12,16,26,0.92)', color: '#eafff6', font: '800 24px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' })
// Chop cost + time, scaling by node tier (its minLevel). Base pool is 100 and regen is slow
// (see MANA_REGEN_PER_SEC), so mana is a real budget. Shimmeroak (Lv4): 12 mana over 3s = 4/s.
// Pure feel — tune here. goldwood(1): 6 mana / 2s · shimmeroak(4): 12 / 2.9s · dawnwood(10): 24 / 4.7s.
const nodeManaCost = (type: NodeType) => 6 + (NODE_DEFS[type].minLevel - 1) * 2
const nodeChannelSec = (type: NodeType) => 2 + (NODE_DEFS[type].minLevel - 1) * 0.3
const MANA_REGEN_PER_SEC = 1 / 60   // 1 mana per minute by design — the real refill is Alchemy-brewed potions
// Mana-restore potions (Alchemy-brewed; canon economy — see project_shimmer_mana_economy). Drink to
// refill the pool. Restore amounts are the feel knob. Only ids listed here are drinkable-for-mana.
const MANA_POTIONS: Record<string, number> = { mana_draught: 40, shard_tonic: 65 }
// Placeable stations — double-tap in the hotbar to enter placement mode, then confirm to build.
// Placeholder blockout look (real models later, per the art rule). w/d = footprint tiles, h = height.
const PLACEABLES: Record<string, { name: string; color: string; accent: string; h: number }> = {
  alchemy_station: { name: 'Alchemy Station', color: '#5a3f74', accent: '#c88ae6', h: 1.1 },
  crafting_table:  { name: 'Crafting Table',  color: '#7a5a34', accent: '#d9b84a', h: 0.85 },
  chest:           { name: 'Chest',           color: '#7a521a', accent: '#c9a86a', h: 0.6 },
  exchange_booth:  { name: 'Exchange Booth',  color: '#2f4a3f', accent: '#6ad0a0', h: 1.0 },
  farm_planter:    { name: 'Planter',         color: '#4a3a1e', accent: '#8fd06a', h: 0.4 },
}

// Placed-station menu kinds, generalized over ALL 5 station itemIds (brew/craft/chest/exchange/farm).
// A station's `kind` drives which menu opens on interact + the prompt/tap-button look. `chest` and
// `exchange_booth` reuse the SAME itemIds as the 2D game's furniture (sprites/furniture.ts) — same
// item, same look, coherent across both walkers.
const STATIONS: Record<string, { kind: StationKind; verb: string; emoji: string; name: string; accent: string; bg: string }> = {
  alchemy_station: { kind: 'brew',     verb: 'Brew',  emoji: '⚗', name: 'Alchemy Station', accent: '#a679ff', bg: 'rgba(17,12,24,0.92)' },
  crafting_table:  { kind: 'craft',    verb: 'Craft', emoji: '🔨', name: 'Crafting Table',  accent: '#d9b84a', bg: 'rgba(24,18,10,0.92)' },
  chest:           { kind: 'chest',    verb: 'Open',  emoji: '📦', name: 'Chest',           accent: '#c9a86a', bg: 'rgba(22,17,9,0.92)' },
  exchange_booth:  { kind: 'exchange', verb: 'Trade', emoji: '💰', name: 'Exchange Booth',  accent: '#6ad0a0', bg: 'rgba(9,22,17,0.92)' },
  farm_planter:    { kind: 'farm',     verb: 'Tend',  emoji: '🌱', name: 'Planter',         accent: '#8fd06a', bg: 'rgba(15,22,9,0.92)' },
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
const STARTER_KIT_FLAG = 'starterKitV2'
function grantStarterKit(inv: Inventory) {
  addItems(inv, 'mana_draught', 3)                                              // refill potions
  addItems(inv, 'alchemy_station', 1); addItems(inv, 'crafting_table', 1)       // the two seed stations
  addItems(inv, 'raw_mana_shard', 12)                                           // brew fuel + station mats
  addItems(inv, 'goldwood_plank', 6); addItems(inv, 'goldwood_bark', 3); addItems(inv, 'shimmeroak_plank', 6) // build mats
}
// hotbar double-tap hints (drinkable potions + placeable stations)
const USE_HINTS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(MANA_POTIONS).map(([k, v]) => [k, `+${v} mana · double-tap to drink`])),
  ...Object.fromEntries(Object.keys(PLACEABLES).map(k => [k, 'double-tap to place'])),
}

function bucketsRect(grid: number[][], r0: number, c0: number, r1: number, c1: number) {
  const floors: Cell[] = [], walls: Cell[] = [], waters: Cell[] = [], voids: Cell[] = [], warps: Cell[] = [], mists: Cell[] = []
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    const v = grid[r][c]
    if (v === VOID) { voids.push([c, r]); continue }
    const id = v & 0xFF
    if (id === WARP_ID) warps.push([c, r])
    else if (id === MIST_ID) mists.push([c, r])
    else if (id === WATER_ID) waters.push([c, r])
    else if (walkable(grid, c, r)) floors.push([c, r])
    else walls.push([c, r])
  }
  return { floors, walls, waters, voids, warps, mists }
}

// The world renders in CHUNK×CHUNK blocks, one instanced-mesh set each, so three.js frustum-
// culls what's behind the camera and the fog hides the far edge. This is the streaming core's
// render layer: preload mounts every chunk (fine — the data is tiny); a streaming realm later
// just mounts a radius instead. Small zones land in 1-2 chunks ≈ the old single-bucket path.
const CHUNK = 64
function chunkBuckets(grid: number[][]) {
  const rows = grid.length, cols = grid[0].length
  const out: { key: string; b: ReturnType<typeof bucketsRect> }[] = []
  for (let r0 = 0; r0 < rows; r0 += CHUNK) for (let c0 = 0; c0 < cols; c0 += CHUNK) {
    const b = bucketsRect(grid, r0, c0, Math.min(r0 + CHUNK, rows), Math.min(c0 + CHUNK, cols))
    if (b.floors.length || b.walls.length || b.waters.length || b.voids.length || b.warps.length || b.mists.length)
      out.push({ key: `${r0}:${c0}`, b })
  }
  return out
}

function lerpAngle(a: number, b: number, t: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
}

// Gregory's gift — ONE young spirit, RNG from the launched roster (the canon starter mechanic). The new
// player gets this from Greg's first-quest handoff, not at spawn, so they have a reason to meet him.
function makeStarterSpirit(): Spirit {
  const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
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
            <mesh position={[0, 1.55, 0]} castShadow><sphereGeometry args={[0.26, 14, 14]} /><meshStandardMaterial color="#ecdab4" /></mesh>
            {moglin && <mesh position={[0.9, 0.5, 0.25]} castShadow><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color="#6b6675" emissive="#241f2e" emissiveIntensity={0.4} /></mesh>}
            <mesh position={[0, 3.1, 0]}><boxGeometry args={[0.13, 2.2, 0.13]} /><meshStandardMaterial color={moglin ? '#b58adf' : '#ffe08a'} emissive={moglin ? '#7a4fc0' : '#ffcf4d'} emissiveIntensity={0.92} transparent opacity={0.8} /></mesh>
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
  goldwood:   { kind: 'tree', trunk: '#8a6a3c', canopy: '#d9b84a', scale: 1 },
  shimmeroak: { kind: 'tree', trunk: '#6f5330', canopy: '#4fc79a', scale: 1.35, glow: 0.35 },
  starwillow: { kind: 'tree', trunk: '#9a8f7a', canopy: '#cfe6d0', scale: 1.15 },
  dawnwood:   { kind: 'tree', trunk: '#7a4a34', canopy: '#f0a86a', scale: 1.2, glow: 0.5 },
  // Prospecting — cloudy raw shard → violet element → clear pure core → golden ather (glow climbs with tier)
  raw_mana_node:        { kind: 'crystal', trunk: '#4a5568', canopy: '#bcd4ea', scale: 0.85, glow: 0.4 },
  element_crystal_node: { kind: 'crystal', trunk: '#4a3a5e', canopy: '#c88ae6', scale: 1.0,  glow: 0.6 },
  pure_core_node:       { kind: 'crystal', trunk: '#3e5a58', canopy: '#a6efe2', scale: 1.1,  glow: 0.8 },
  ather_crystal_node:   { kind: 'crystal', trunk: '#6a5a34', canopy: '#f0d986', scale: 1.25, glow: 1.0 },
  // Rinning — still luminescent pools; larger spots = bigger water
  small_pond: { kind: 'water', trunk: '#31505e', canopy: '#6fbcd9', scale: 1.0, glow: 0.3 },
  stream:     { kind: 'water', trunk: '#31505e', canopy: '#82cce4', scale: 1.25, glow: 0.3 },
  lake:       { kind: 'water', trunk: '#2b4552', canopy: '#5fa8d0', scale: 1.6, glow: 0.35 },
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
function NodeMarkers({ nodes, heights, editing, channel }: { nodes: ResourceNode[]; heights: number[][]; editing: boolean; channel?: { nodeId: string; hp: number } | null }) {
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
              <Html position={[0, s + 1.55, 0]} center distanceFactor={11} pointerEvents="none">
                <div style={{ width: 60, textAlign: 'center', userSelect: 'none' }}>
                  <div style={{ font: '800 9px ui-monospace, monospace', color: '#bfe0ff', textShadow: '0 1px 2px #000', marginBottom: 2, whiteSpace: 'nowrap' }}>⚡ {prettyItem(n.type)}</div>
                  <div style={{ height: 6, background: '#0009', borderRadius: 3, border: '1px solid #0007', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(0, chan.hp * 100)}%`, background: 'linear-gradient(90deg,#e0607a,#f0a86a)', transition: 'width 0.1s linear' }} />
                  </div>
                </div>
              </Html>
            )}
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
              {!depleted && <mesh position={[0.16 * s, 0.14, 0.1 * s]} castShadow><sphereGeometry args={[0.07 * s, 8, 8]} /><meshStandardMaterial color="#e0607a" emissive="#e0607a" emissiveIntensity={0.25} roughness={0.5} /></mesh>}
            </>}
            {editing && (
              <Html position={[0, s + 1.2, 0]} center distanceFactor={12} pointerEvents="none">
                <div style={{ font: '700 10px ui-monospace, monospace', color: '#0d1a17', background: '#eafff6d0', border: '1px solid #2f5c4f', borderRadius: 5, padding: '1px 5px', whiteSpace: 'nowrap' }}>{n.type}</div>
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
            <mesh position={[0, def.h / 2 + 0.05, 0]} castShadow><boxGeometry args={[0.82, def.h, 0.82]} /><meshStandardMaterial color={def.color} roughness={0.7} /></mesh>
            <mesh position={[0, def.h + 0.12, 0]}><boxGeometry args={[0.5, 0.12, 0.5]} /><meshStandardMaterial color={def.accent} emissive={def.accent} emissiveIntensity={0.35} /></mesh>
            <mesh position={[0.35, def.h * 0.6, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
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
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null)
  const fwd = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    if (!placing || !grp.current) { if (grp.current) grp.current.visible = false; return }
    state.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize()
    const p = posRef.current!
    const tx = Math.round(p.x + fwd.x * 1.4), tz = Math.round(p.z + fwd.z * 1.4)
    placeTargetRef.current = { x: tx, y: tz }
    const y = (heights[tz]?.[tx] ?? 0) * STEP
    const blocked = !walkable(gridRef.current, tx, tz) || structuresRef.current!.some(s => s.zoneId === zoneIdRef.current && s.tileX === tx && s.tileY === tz)
    grp.current.visible = true
    grp.current.position.set(tx, y, tz)
    grp.current.rotation.y = -placing.facing * Math.PI / 180
    if (ringMat.current) ringMat.current.color.setStyle(blocked ? '#ff5a4d' : '#7fe3c8')
    if (bodyMat.current) { bodyMat.current.color.setStyle(blocked ? '#ff5a4d' : (PLACEABLES[placing.itemId]?.accent ?? '#7fe3c8')) }
  })
  const def = placing ? PLACEABLES[placing.itemId] : null
  return (
    <group ref={grp} visible={false}>
      {def && <>
        <mesh position={[0, def.h / 2 + 0.05, 0]}><boxGeometry args={[0.82, def.h, 0.82]} /><meshStandardMaterial ref={bodyMat} color={def.accent} transparent opacity={0.45} emissive={def.accent} emissiveIntensity={0.5} /></mesh>
        <mesh position={[0.35, def.h * 0.6, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><ringGeometry args={[0.44, 0.54, 4]} /><meshBasicMaterial ref={ringMat} color="#7fe3c8" transparent opacity={0.85} side={THREE.DoubleSide} /></mesh>
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

function FloorTerrain({ floors, heights, version, paint, editing, color = '#7cc46a', emissive = '#000000' }: {
  floors: Cell[]; heights: number[][]; version: number
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean; color?: string; emissive?: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    const pos = new THREE.Vector3(), scl = new THREE.Vector3()
    floors.forEach(([c, r], i) => {
      const top = (heights[r]?.[c] ?? 0) * STEP
      pos.set(c, (top - 1) / 2, r)
      scl.set(1, top + 1, 1)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere() // instances sit at absolute tile coords — per-chunk culling needs real bounds
  }, [floors, heights, version])
  const h = usePaint(floors, paint, editing)
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(floors.length, 1)]} receiveShadow castShadow {...h}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.6} />
    </instancedMesh>
  )
}

// Wispy translucent cloud over mist cells — encounter areas you walk through.
function MistOverlay({ mists, heights }: { mists: Cell[]; heights: number[][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(0.98, 0.8, 0.98)
    mists.forEach(([c, r], i) => { pos.set(c, (heights[r]?.[c] ?? 0) * STEP + 0.55, r); m.compose(pos, q, scl); mesh.setMatrixAt(i, m) })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [mists, heights])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(mists.length, 1)]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#eef4ff" transparent opacity={0.42} emissive="#ffffff" emissiveIntensity={0.12} depthWrite={false} />
    </instancedMesh>
  )
}

// A tall glowing beacon over each warp marker so doors/exits read from any angle.
function WarpBeacons({ warps, heights }: { warps: Cell[]; heights: number[][] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1)
    warps.forEach(([c, r], i) => { pos.set(c, (heights[r]?.[c] ?? 0) * STEP + 1.5, r); m.compose(pos, q, scl); mesh.setMatrixAt(i, m) })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [warps, heights])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(warps.length, 1)]}>
      <boxGeometry args={[0.18, 3, 0.18]} />
      <meshStandardMaterial color="#ffe08a" emissive="#ffcf4d" emissiveIntensity={0.9} />
    </instancedMesh>
  )
}

function Tiles({ cells, size, y, color, opacity = 1, paint, editing }: {
  cells: Cell[]; size: [number, number, number]; y: number; color: string; opacity?: number
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4()
    cells.forEach(([c, r], i) => { m.setPosition(c, y, r); mesh.setMatrixAt(i, m) })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells, y])
  const h = usePaint(cells, paint, editing)
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(cells.length, 1)]} receiveShadow castShadow {...h}>
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
const ZoneGeometry = memo(function ZoneGeometry({ gridRef, heights, version, paint, editing }: {
  gridRef: React.RefObject<number[][]>; heights: number[][]; version: number
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
}) {
  const chunks = useMemo(() => chunkBuckets(gridRef.current), [version, gridRef])
  return (
    <>
      {chunks.map(({ key, b: { floors, walls, waters, voids, warps, mists } }) => (
        <group key={key}>
          <FloorTerrain floors={floors} heights={heights} version={version} paint={paint} editing={editing} />
          {/* solid clouds = the walls */}
          <Tiles cells={walls} size={[1, 1.3, 1]} y={0.55} color="#e3e9f4" paint={paint} editing={editing} />
          <Tiles cells={waters} size={[1, 0.3, 1]} y={-0.15} color="#3aa0d6" opacity={0.85} paint={paint} editing={editing} />
          {/* cloud mist = walkable encounter areas: land + a wispy translucent overlay */}
          <FloorTerrain floors={mists} heights={heights} version={version} paint={paint} editing={editing} />
          <MistOverlay mists={mists} heights={heights} />
          {/* warp markers — glowing gold columns + beacons (you place; Jin wires the destinations) */}
          <FloorTerrain floors={warps} heights={heights} version={version} paint={paint} editing={editing} color="#caa233" emissive="#ffcf4d" />
          <WarpBeacons warps={warps} heights={heights} />
          {/* empty cells: invisible in play; a faint clickable grid-canvas to draw land onto while editing */}
          {editing && <Tiles cells={voids} size={[0.92, 0.05, 0.92]} y={-0.02} color="#39406b" opacity={0.5} paint={paint} editing={editing} />}
        </group>
      ))}
    </>
  )
})

// An NPC stands in the world when it hasn't been cleared (defeated) and its gate flag (if any) is set.
// Gating chains the holds: Sorrel only appears once `freedThistle` is true (he fled up here).
function npcInWorld(n: NPC3D, defeated: Record<string, boolean>, flags: Record<string, boolean>): boolean {
  if (defeated[n.id]) return false
  if (n.requiredFlag && !flags[n.requiredFlag]) return false
  return true
}

function Player({ posRef, gridRef, heightsRef, zoneIdRef, editRef, onWarp, battleRef, partyLevelRef, onEncounter, joyRef, talkingRef, hasPartyRef, onNearChange, defeatedRef, flagsRef, harvestNodesRef, onNearNode, stationsRef, onNearStation, eyeRef, jumpRef, slideRef }: {
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
    const ctx: CollisionCtx = { grid, heights, segs: EMPTY_SEGS }
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
        const targetSpeed = crouching ? CROUCH_SPEED : backpedal ? BACK_SPEED : RUN_SPEED
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
        const w = checkWarp(ZONES, zoneIdRef.current, tx, tz)
        if (w) { onWarp(w); warpCd.current = 0.4; encGrace.current = ENCOUNTER_GRACE }
        // No door — a fresh mist tile can draw a wild spirit, but only once you HAVE a spirit (Greg's
        // starter). Before that the mist is just scenery, so a fresh player is never stuck in a fight.
        else if (encGrace.current <= 0 && hasPartyRef.current) {
          const cell = grid[tz]?.[tx]
          if (cell !== undefined && (cell & 0xFF) === MIST_ID) {
            // The FIRST mist a new Keeper crosses is a guaranteed draw so the arena reliably
            // introduces itself (the start zone has no mist, so this lands on the way to Thistle).
            // Every crossing after is the normal per-step rate.
            const force = !flagsRef.current.metFirstWild
            const enc = rollEncounter(logicalZoneAt(zoneIdRef.current, tx, tz), partyLevelRef.current, false, force)
            if (enc) { encGrace.current = ENCOUNTER_GRACE; flagsRef.current.metFirstWild = true; onEncounter(enc) }
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

    const g = group.current!
    // First-person: camera lives at the eye, so the avatar would clip the lens — hide it (still shown
    // in edit/spectator and third-person).
    g.visible = editRef.current  // avatar shows only in edit's spectator view; hidden in first-person play
    g.position.set(p.x, p.y + 0.7, p.z)
    g.rotation.y = lerpAngle(g.rotation.y, yaw.current, 0.3)
  })

  return (
    <group ref={group}>
      <mesh castShadow><capsuleGeometry args={[0.3, 0.55, 4, 10]} /><meshStandardMaterial color="#5ad1e6" /></mesh>
      <mesh position={[0, 0.1, 0.38]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.13, 0.3, 8]} /><meshStandardMaterial color="#f6e9da" />
      </mesh>
    </group>
  )
}

// Per-skill tool HUD look (glyph + tint) for the bottom-bar tool gauges.
// the resource glyph that pops off a node on a completed harvest, per skill.
const HARVEST_GLYPH: Record<string, string> = { forestry: '🪵', prospecting: '💎', rinning: '🐟' }

// Blockout palette for the bonded Mana'mal follower (real sprites/models later, per the art rule).
const BEAST_COLOR: Record<string, string> = {
  drifthorn: '#c9b6ea', dustwhisker: '#e6cf9a', sporeling: '#8fd97f', glowmite: '#8fd0ea', embermole: '#e69a6a',
}

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
      <mesh position={[0, 0.03, 0.2]}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color="#0d1a17" /></mesh>
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
      <Html center distanceFactor={9} pointerEvents="none">
        <style>{`@keyframes fishBang{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.28) translateY(-3px)}}
          @keyframes fishWait{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(4px);opacity:.9}}`}</style>
        <div style={{
          fontSize: bite ? 34 : 20, lineHeight: 1, userSelect: 'none', whiteSpace: 'nowrap',
          filter: bite ? 'drop-shadow(0 0 8px #37e6ff)' : 'none',
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
      <Html center distanceFactor={9} pointerEvents="none">
        <style>{`@keyframes gpop{0%{transform:translateY(8px) scale(.4);opacity:0}28%{opacity:1}100%{transform:translateY(-28px) scale(1.1);opacity:0}}`}</style>
        <div style={{ fontSize: 26, lineHeight: 1, userSelect: 'none', animation: 'gpop .85s ease-out forwards', filter: 'drop-shadow(0 0 6px #ffe9b0)' }}>{pop.glyph}</div>
      </Html>
    </group>
  )
}

function CameraRig({ posRef, editFocusRef, yawRef, editRef, eyeRef, adsRef }: {
  posRef: React.RefObject<THREE.Vector3>; editFocusRef: React.RefObject<THREE.Vector3>
  yawRef: React.RefObject<number>; editRef: React.RefObject<boolean>
  eyeRef: React.RefObject<number>; adsRef: React.RefObject<boolean>
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
    const wh = (e: WheelEvent) => { if (editRef.current) dist.current = Math.max(4, Math.min(40, dist.current + e.deltaY * 0.012)) }  // edit-only orbit zoom; in play the wheel is the hotbar's (HotBar)
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
const PROJECTILE_SPEED = 30   // tiles/sec
const PROJECTILE_LIFE = 2.0   // seconds before it fizzles
const FIRE_COOLDOWN = 0.16    // min seconds between casts (semi-auto)
const TARGET_HIT_R2 = 0.72 * 0.72
const TARGET_RESPAWN = 2.5     // seconds a popped target stays down
// Downrange targets for the range — floating orbs at varied spots/heights in Alex's 50×50.
const RANGE_TARGETS: [number, number, number][] = [
  [15, 1.8, 26], [20, 2.5, 31], [25, 1.6, 23], [30, 2.9, 33],
  [35, 2.0, 27], [12, 2.3, 35], [38, 1.7, 21], [22, 3.1, 39],
]
function FiringRange({ fireReqRef, gridRef, onHit }: {
  fireReqRef: React.MutableRefObject<boolean>
  gridRef: React.RefObject<number[][]>
  onHit: () => void
}) {
  const MAX = 24
  const pool = useMemo(() => Array.from({ length: MAX }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0 })), [])
  const targets = useMemo(() => RANGE_TARGETS.map(([x, y, z]) => ({ pos: new THREE.Vector3(x, y, z), alive: true, down: 0 })), [])
  const shotRef = useRef<THREE.InstancedMesh>(null)
  const tgtRef = useRef<THREE.InstancedMesh>(null)
  const cd = useRef(0)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const zero = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    cd.current -= dt
    // fire: consume the request (even mid-cooldown, so clicks don't queue up)
    if (fireReqRef.current) {
      fireReqRef.current = false
      if (cd.current <= 0) {
        cd.current = FIRE_COOLDOWN
        const p = pool.find((pr) => pr.life <= 0)
        if (p) {
          state.camera.getWorldDirection(dir)
          p.pos.copy(state.camera.position).addScaledVector(dir, 0.7)
          p.vel.copy(dir).multiplyScalar(PROJECTILE_SPEED)
          p.life = PROJECTILE_LIFE
        }
      }
    }
    // advance + collide projectiles
    for (const p of pool) {
      if (p.life <= 0) continue
      p.life -= dt
      p.pos.addScaledVector(p.vel, dt)
      const cx = Math.round(p.pos.x), cz = Math.round(p.pos.z)
      const cell = gridRef.current?.[cz]?.[cx]
      if (cell === undefined || (cell & 0xFF) === WALL_ID) { p.life = 0; continue }  // wall/OOB stops it
      for (const t of targets) {
        if (t.alive && p.pos.distanceToSquared(t.pos) < TARGET_HIT_R2) {
          t.alive = false; t.down = TARGET_RESPAWN; p.life = 0; onHit(); break
        }
      }
    }
    // respawn downed targets
    for (const t of targets) { if (!t.alive) { t.down -= dt; if (t.down <= 0) t.alive = true } }
    // render projectiles
    if (shotRef.current) {
      pool.forEach((p, i) => { m.compose(p.life > 0 ? p.pos : zero, q, p.life > 0 ? one : zero); shotRef.current!.setMatrixAt(i, m) })
      shotRef.current.instanceMatrix.needsUpdate = true
    }
    // render targets (pulse scale slightly for life)
    if (tgtRef.current) {
      targets.forEach((t, i) => { m.compose(t.alive ? t.pos : zero, q, t.alive ? one : zero); tgtRef.current!.setMatrixAt(i, m) })
      tgtRef.current.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <>
      {/* frustumCulled=false: instances move/scatter far from the mesh origin, so the default
          origin-centered bounding sphere would cull the whole mesh whenever you look downrange. */}
      <instancedMesh ref={shotRef} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#8fe0ff" emissive="#8fe0ff" emissiveIntensity={2.4} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={tgtRef} args={[undefined, undefined, targets.length]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 14, 14]} />
        <meshStandardMaterial color="#ff6a52" emissive="#ff6a52" emissiveIntensity={0.9} />
      </instancedMesh>
    </>
  )
}

// Visible EXIT markers at a zone's warp tiles — for outside-Ather zones, where warps aren't painted
// into the grid (no gold beacon), so the way back stays obvious. Green pillar + floating EXIT label.
function ExitMarkers({ warps, heights }: { warps: Warp[]; heights: number[][] }) {
  return (
    <>
      {warps.map((w, i) => {
        const y = (heights[w.fromY]?.[w.fromX] ?? 0) * STEP
        return (
          <group key={i} position={[w.fromX, y, w.fromY]}>
            <mesh position={[0, 1.4, 0]}>
              <cylinderGeometry args={[0.3, 0.42, 2.8, 6]} />
              <meshStandardMaterial color="#5fe0a0" emissive="#5fe0a0" emissiveIntensity={0.85} transparent opacity={0.55} />
            </mesh>
            <Html position={[0, 3.2, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
              <div style={{ font: '800 11px ui-monospace, monospace', color: '#7fffc0', background: 'rgba(8,14,10,0.7)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap', border: '1px solid #5fe0a066' }}>EXIT</div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

// Owner-only test-hub gate markers — glowing labeled pillars at the Crucible + Rune Hold gate tiles
// in Greg's home. Rendered only when isOwner (players never see them); tiles match the ownerOnly warps.
function HubGateMarkers({ heights }: { heights: number[][] }) {
  const gates = [
    { c: 10, r: 7, color: '#ff7a4a', label: 'CRUCIBLE' },
    { c: 16, r: 7, color: '#b07aff', label: 'RUNE HOLD' },
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
            <Html position={[0, 3.4, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
              <div style={{ font: '800 12px ui-monospace, monospace', color: g.color, background: 'rgba(8,8,14,0.7)', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap', border: `1px solid ${g.color}66` }}>{g.label}</div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

const Scene = memo(function Scene(props: {
  zone: Zone; gridRef: React.RefObject<number[][]>; heights: number[][]; version: number; dims: string
  posRef: React.RefObject<THREE.Vector3>; heightsRef: React.RefObject<number[][]>; zoneIdRef: React.RefObject<string>
  editFocusRef: React.RefObject<THREE.Vector3>
  onWarp: (w: Warp) => void; yawRef: React.RefObject<number>; editRef: React.RefObject<boolean>
  eyeRef: React.RefObject<number>
  jumpRef: React.RefObject<boolean>; slideRef: React.RefObject<boolean>
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
  battleRef: React.RefObject<boolean>; partyLevelRef: React.RefObject<number>
  onEncounter: (enc: WildEncounter) => void
  joyRef: React.RefObject<{ x: number; y: number }>
  talkingRef: React.RefObject<boolean>; hasPartyRef: React.RefObject<boolean>
  onNearChange: (n: NPC3D | null) => void
  defeatedRef: React.RefObject<Record<string, boolean>>; defeated: Record<string, boolean>
  flagsRef: React.RefObject<Record<string, boolean>>
  nodes: ResourceNode[]
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
  fireReqRef: React.MutableRefObject<boolean>
  onRangeHit: () => void
  adsRef: React.RefObject<boolean>
}) {
  // Pure-prop filter → safe to memo, so a channel tick doesn't re-allocate the structure list.
  // The NPC filter below is deliberately NOT memoized: npcInWorld() reads flagsRef.current, which is
  // mutated in place, so any dep list would go stale the moment a story flag flips. It's a ~20-item
  // filter — recomputing it is cheaper than a subtle "the NPC never disappeared" bug.
  const structuresInZone = useMemo(
    () => structuresView(props.structures, props.zone.id),
    [props.structures, props.zone.id],
  )
  return (
    <>
      <GardenAtmosphere zoneId={props.atmosZone} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[18, 26, 12]} intensity={1.25} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-40} shadow-camera-right={40}
        shadow-camera-top={40} shadow-camera-bottom={-40}
        shadow-camera-near={0.5} shadow-camera-far={160}
      />
      <ZoneGeometry key={`${props.zone.id}-${props.dims}`} gridRef={props.gridRef} heights={props.heights} version={props.version} paint={props.paint} editing={props.editing} />
      <NPCMarkers npcs={ALL_NPCS.filter((n) => n.zone === props.zone.id && npcInWorld(n, props.defeated, props.flagsRef.current))} heights={props.heights} />
      {props.isOwner && props.zone.id === 'moonwell-glade-gregory-s-home' && <HubGateMarkers heights={props.heights} />}
      {props.zone.realm === 'outside' && <FiringRange fireReqRef={props.fireReqRef} gridRef={props.gridRef} onHit={props.onRangeHit} />}
      {props.zone.realm === 'outside' && <ExitMarkers warps={props.zone.warps} heights={props.heights} />}
      <NodeMarkers nodes={props.nodes} heights={props.heights} editing={props.editing} channel={props.channel} />
      {props.zone.id === WORLD_ZONE_ID ? <WorldFlora heights={props.heights} /> : <FloraDressing zoneId={props.zone.id} heights={props.heights} />}
      <StructureMarkers structures={structuresInZone} heights={props.heights} />
      <PlacementGhost placing={props.placing} posRef={props.posRef} heights={props.heights} gridRef={props.gridRef} placeTargetRef={props.placeTargetRef} structuresRef={props.structuresRef} zoneIdRef={props.zoneIdRef} />
      <Player posRef={props.posRef} gridRef={props.gridRef} heightsRef={props.heightsRef} zoneIdRef={props.zoneIdRef} editRef={props.editRef} onWarp={props.onWarp} battleRef={props.battleRef} partyLevelRef={props.partyLevelRef} onEncounter={props.onEncounter} joyRef={props.joyRef} talkingRef={props.talkingRef} hasPartyRef={props.hasPartyRef} onNearChange={props.onNearChange} defeatedRef={props.defeatedRef} flagsRef={props.flagsRef} harvestNodesRef={props.harvestNodesRef} onNearNode={props.onNearNode} stationsRef={props.structuresRef} onNearStation={props.onNearStation} eyeRef={props.eyeRef} jumpRef={props.jumpRef} slideRef={props.slideRef} />
      {props.companionColor && !props.editing && <Follower posRef={props.posRef} heightsRef={props.heightsRef} color={props.companionColor} />}
      {props.fishing && <FishTell posRef={props.posRef} heightsRef={props.heightsRef} bite={props.fishBite} />}
      <HarvestPop pop={props.harvestPop} />
      <CameraRig posRef={props.posRef} editFocusRef={props.editFocusRef} yawRef={props.yawRef} editRef={props.editRef} eyeRef={props.eyeRef} adsRef={props.adsRef} />
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
        background: 'rgba(18,14,36,0.4)', border: '2px solid #ffffff2e', touchAction: 'none',
      }}
    >
      <div style={{
        position: 'absolute', left: '50%', top: '50%', width: 54, height: 54, marginLeft: -27, marginTop: -27,
        borderRadius: '50%', transform: `translate(${knob.x}px, ${knob.y}px)`,
        background: 'rgba(212,168,67,0.85)', border: '2px solid #ffffff80', boxShadow: '0 2px 10px #0009', pointerEvents: 'none',
      }} />
    </div>
  )
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'floor', label: 'Land' }, { id: 'raise', label: 'Raise' }, { id: 'lower', label: 'Lower' },
  { id: 'wall', label: 'Cloud' }, { id: 'water', label: 'Water' }, { id: 'mist', label: 'Mist' },
  { id: 'warp', label: 'Warp' }, { id: 'void', label: 'Erase' },
]

export default function Shimmer3D() {
  const [zoneId, setZoneId] = useState(START_ZONE)
  const zone = getZone(ZONES, zoneId) ?? getZone(ZONES, START_ZONE)!

  // Resource nodes for this zone — seeded from the authored ZONE_NODES layer; the editor
  // adds/removes them and the Save button writes them back to node-placements.ts.
  const [nodes, setNodes] = useState<NodePlacement[]>(() => nodePlacementsFor(zone.id))
  const nodesRef = useRef(nodes); nodesRef.current = nodes
  useEffect(() => { setNodes(nodePlacementsFor(zone.id)) }, [zone.id])

  // ── Skilling: the forestry harvest loop. The real engine state (skills / mana / inventory) lives
  // in refs, persisted via the merge-save; small mirrors drive the HUD. Nodes get a runtime state
  // layer (harvestable ⇄ depleted+respawn timer) derived from the authored placements. ──
  const skillsRef = useRef<SkillSet>(createSkillSet())
  const manaRef = useRef<ManaPool>(createManaPool(1))
  const invRef = useRef<Inventory>(createInventory())
  const [invSlots, setInvSlots] = useState<(ItemStack | null)[]>(() => invRef.current.slots)
  const [manaFrac, setManaFrac] = useState(1)
  const [forestry, setForestry] = useState(() => ({ level: 1, xp: 0, next: xpForSkillLevel(1), pulse: 0 }))
  const syncSkillHud = useCallback(() => {
    const f = skillsRef.current.forestry
    setForestry(p => ({ level: f.level, xp: f.xp, next: xpForSkillLevel(f.level), pulse: p.pulse + 1 }))
    setInvSlots([...invRef.current.slots])
    setManaFrac(manaRef.current.current / getMaxPool(skillsRef.current.mana.level))
  }, [])
  // runtime nodes (with harvest state) rebuilt whenever the authored layer or zone changes
  const [runtimeNodes, setRuntimeNodes] = useState<ResourceNode[]>([])
  const runtimeNodesRef = useRef<ResourceNode[]>([]); runtimeNodesRef.current = runtimeNodes
  useEffect(() => { setRuntimeNodes(nodes.map(n => createResourceNode(n.type, n.tileX, n.tileY, zone.id))) }, [nodes, zone.id])
  const [nearNode, setNearNode] = useState<ResourceNode | null>(null)
  const nearNodeRef = useRef<ResourceNode | null>(null); nearNodeRef.current = nearNode

  // Working copies — init ONCE per zone (not every render) so paint/resize edits persist.
  const gridRef = useRef<number[][]>([])
  const heightsRef = useRef<number[][]>([])
  const initedZone = useRef('')
  if (initedZone.current !== zone.id) {
    initedZone.current = zone.id
    gridRef.current = zone.grid.map((row) => [...row])
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
  // Touch triggers for jump/slide (mobile). jumpRef = edge (button sets true, Player consumes+clears);
  // slideRef = held (true while the slide button is pressed). Keyboard uses Space/Shift directly.
  const jumpRef = useRef(false)
  const slideRef = useRef(false)
  // World map overlay (M / HUD button). Closed during battles — the arena owns the screen.
  const [showMap, setShowMap] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'KeyM' && !curBattleRef.current) setShowMap(v => !v) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // Pointer-lock state → drives the "click to look" nudge (shown only when first-person + uncaptured).
  const [pointerLocked, setPointerLocked] = useState(false)
  const [showLookHint, setShowLookHint] = useState(true)  // the "click to look" nudge fades a few seconds after spawn
  useEffect(() => { const t = setTimeout(() => setShowLookHint(false), 5000); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const onLock = () => setPointerLocked(document.pointerLockElement instanceof Element)
    document.addEventListener('pointerlockchange', onLock)
    return () => document.removeEventListener('pointerlockchange', onLock)
  }, [])
  const editFocusRef = useRef(new THREE.Vector3())
  const joyRef = useRef({ x: 0, y: 0 }) // touch-joystick analog input → Player movement

  // ── Party + save. ather.games saves are per-browser localStorage (no login); the 3D walker shares
  // Shimmer's slot (`ather:save:shimmer`) and MERGES on write so it never clobbers 2D-only fields. ──
  const { load, save: saveGame } = useCloudSave('shimmer')
  const wallet = useWallet()
  const partyRef = useRef<Spirit[] | null>(null)
  if (!partyRef.current) partyRef.current = [] // empty until Greg's starter handoff; load() may replace it
  const hasPartyRef = useRef(false); hasPartyRef.current = (partyRef.current?.length ?? 0) > 0
  const partyLevelRef = useRef(0)
  partyLevelRef.current = partyRef.current.length
    ? Math.round(partyRef.current.reduce((s, x) => s + x.level, 0) / partyRef.current.length)
    : 5
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
  const battleRef = useRef(false)
  const talkingRef = useRef(false)
  const [hasStarter, setHasStarter] = useState(false) // reactive mirror of "party has ≥1 spirit" for HUD
  const [defeated, setDefeated] = useState<Record<string, boolean>>({}) // NPCs cleared from the world (by id)
  const defeatedRef = useRef(defeated); defeatedRef.current = defeated
  const [battle, setBattle] = useState<{ allies: Spirit[]; enemies: Spirit[]; aiTier: AITier; zoneId: string; kind?: 'wild' | 'thistle' | 'sorrel' | 'brack' } | null>(null)
  const curBattleRef = useRef(battle); curBattleRef.current = battle
  // Wild encounters play a brief "drawn to you" approach beat before the arena mounts (see below).
  const [approach, setApproach] = useState<{ enc: WildEncounter; battle: NonNullable<typeof battle> } | null>(null)
  // Post-win spoils reveal (wild fights): per-spirit XP/level breakdown + gold, shown before returning.
  type RewardRow = { name: string; element: Element; fromLevel: number; toLevel: number; xpGained: number; curXp: number; needXp: number; evolved: boolean }
  const [rewards, setRewards] = useState<{ gold: number; rows: RewardRow[] } | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [nearNpc, setNearNpc] = useState<NPC3D | null>(null)
  const [dialogue, setDialogue] = useState<{ name: string; lines: string[]; speakers?: string[]; idx: number; grantAt?: number; onDone: () => void } | null>(null)
  const dialogueRef = useRef(dialogue); dialogueRef.current = dialogue
  useEffect(() => { talkingRef.current = !!dialogue }, [dialogue])
  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 2600); return () => clearTimeout(t) }, [banner])

  // Merge-save: preserve any 2D-only fields (furniture/crops/quests…) the 2D game may have written.
  // `replaceFlags` — New Game must not inherit the old run's story flags. Normal saves merge
  // (the 2D walker writes flags this save path doesn't know about); a fresh start replaces.
  const persist = useCallback(async (opts?: { replaceFlags?: boolean }) => {
    const prev = (await load()) ?? {}
    await saveGame({
      ...prev,
      spirits: spiritsToSave(partyRef.current ?? []),
      beasts: beastsToSave(beastsRef.current),
      activeBeastId: activeBeastIdRef.current,
      tools: toolsToSave(equippedToolsRef.current),
      flags: opts?.replaceFlags ? { ...flagsRef.current } : { ...(prev.flags ?? {}), ...flagsRef.current },
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
      ge: geToSave(geRef.current),
      plantedCrops: plantedCropsToSave(plantedCropsRef.current),
    })
  }, [load, saveGame])

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
  // Birth on first entry — no save yet ⇒ born before spawn. Reads localStorage synchronously
  // at mount (BEFORE load()'s async .then persist() writes), so a genuinely fresh player reads
  // as fresh. Non-cancelable: a new player must choose a rune. Returning players skip it.
  const bornCheckedRef = useRef(false)
  useEffect(() => {
    if (bornCheckedRef.current) return
    bornCheckedRef.current = true
    try {
      if (!localStorage.getItem('ather:save:shimmer')) {
        setBirthCancelable(false)
        setBirthOpen(true)
      }
    } catch { /* private mode — skip, just spawn */ }
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    let alive = true
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
      if (data?.ge) geRef.current = geFromSave(data.ge as GESave)
      if (Array.isArray(data?.plantedCrops)) {
        plantedCropsRef.current = plantedCropsFromSave(data.plantedCrops as PlantedCrop[])
        setCropsTick(t => t + 1)
      }
      syncSkillHud()
      if (data?.flags) {
        flagsRef.current = data.flags
        // re-hide any NPC whose defeated-flag is already set in the save (e.g. Thistle, once freed)
        const cleared: Record<string, boolean> = {}
        for (const n of NPCS_3D) if (n.defeatedFlag && data.flags[n.defeatedFlag]) cleared[n.id] = true
        if (Object.keys(cleared).length) setDefeated(cleared)
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
        setHasStarter(true)
        if (typeof data.playerTileX === 'number' && typeof data.playerTileY === 'number') {
          posRef.current!.set(data.playerTileX, posRef.current!.y, data.playerTileY)
        }
        if (data.zoneId && isStitched(data.zoneId)) {
          // logical save (or a pre-continent save) → its composed-world spot
          const wp = getGardenWorld().toWorld(data.zoneId, data.playerTileX ?? 1, data.playerTileY ?? 1)
          if (wp) posRef.current!.set(wp.x, posRef.current!.y, wp.y)
          setZoneId(WORLD_ZONE_ID)
        } else if (data.zoneId && getZone(ZONES, data.zoneId)) setZoneId(data.zoneId)
      }
      // One-time starter-kit grant — reaches fresh AND returning saves (older saves with a party
      // never got seeded stations/mats, so the Alchemy Station wasn't obtainable). Idempotent via flag.
      if (!flagsRef.current[STARTER_KIT_FLAG]) {
        grantStarterKit(invRef.current)
        flagsRef.current[STARTER_KIT_FLAG] = true
        setInvSlots([...invRef.current.slots])
        persist()
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [load, persist])

  // Auto-save every 30s + on page close (the walker can be left mid-stride).
  useEffect(() => {
    const id = setInterval(() => { persist() }, 30_000)
    const onLeave = () => { persist() }
    window.addEventListener('beforeunload', onLeave)
    return () => { clearInterval(id); window.removeEventListener('beforeunload', onLeave); persist() }
  }, [persist])

  // Mana regen + node respawn — a coarse tick (the real engine runs 15 TPS; 2 Hz is plenty for the
  // vial and the minutes-long respawn timers).
  useEffect(() => {
    const id = setInterval(() => {
      const max = getMaxPool(skillsRef.current.mana.level)
      if (manaRef.current.current < max) {
        manaRef.current.current = Math.min(max, manaRef.current.current + MANA_REGEN_PER_SEC * 0.5) // 0.5s tick
        setManaFrac(manaRef.current.current / max)
      }
      let respawned = false
      for (const n of runtimeNodesRef.current) if (tickNodeRespawn(n)) respawned = true
      if (respawned) setRuntimeNodes([...runtimeNodesRef.current])
      tickPriceDrift(geRef.current) // Exchange prices drift toward base every 30s (no-op otherwise)
    }, 500)
    return () => clearInterval(id)
  }, [])

  // ── Channelled harvest: link to a node, the mana-powered tool auto-chops (its HP bar drains) until
  // done — but the link breaks if you walk out of range or run dry of mana. Toggle on/off with 🪓/E. ──
  const CHANNEL_RANGE = 1.8
  const [harvestToast, setHarvestToast] = useState<string | null>(null)
  const [harvestPop, setHarvestPop] = useState<{ x: number; y: number; z: number; glyph: string; key: number } | null>(null) // transient node-pop
  const popKeyRef = useRef(0)
  useEffect(() => { if (!harvestToast) return; const t = setTimeout(() => setHarvestToast(null), 2400); return () => clearTimeout(t) }, [harvestToast])
  useEffect(() => { if (!harvestPop) return; const t = setTimeout(() => setHarvestPop(null), 850); return () => clearTimeout(t) }, [harvestPop])
  const channelRef = useRef<{ node: ResourceNode; progress: number; durSec: number; manaCost: number } | null>(null)
  const chopClockRef = useRef(0) // accumulates dt to space out the chop/mine tick sound
  const [channel, setChannel] = useState<{ nodeId: string; label: string; hp: number } | null>(null)
  // Rinning: casting LOCKS the walker to the node (reuse battleRef as the movement freeze); a `!`
  // pops over the mote's head at the bite — strike (E/tap) during it to hook, early/late = it slips.
  const fishRef = useRef<{ node: ResourceNode; manaCost: number; cast: RinCast; bitten: boolean } | null>(null)
  const [fish, setFish] = useState<{ label: string; bite: boolean } | null>(null) // drives HUD + the world-space `!`
  const fishBiteRef = useRef(false); fishBiteRef.current = !!fish?.bite
  const hookFishRef = useRef<() => void>(() => {}) // set below (needs grantHarvest, defined later)
  const [menuOpen, setMenuOpen] = useState(false)     // ☰ — edit terrain / new game
  const [skillsOpen, setSkillsOpen] = useState(false) // skills panel
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
      fishRef.current = { node, manaCost, cast: newRinCast(performance.now(), Math.random), bitten: false }
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
    setChannel({ nodeId: node.id, label: prettyItem(node.type), hp: 1 })
  }, [])

  // ── Build placement: double-tap a placeable → ghost on the tile in front → rotate → confirm/cancel ──
  const [placing, setPlacing] = useState<{ itemId: string; facing: number } | null>(null)
  const placingRef = useRef(placing); placingRef.current = placing
  const selSlotRef = useRef(0)  // live hotbar slot (HotBar drives it via onSelect); right-click uses this item
  const placeTargetRef = useRef<{ x: number; y: number } | null>(null)     // front tile, updated by the ghost
  const [structures, setStructures] = useState<PlacedStruct[]>([])
  const structuresRef = useRef(structures); structuresRef.current = structures
  const [nearStation, setNearStation] = useState<PlacedStruct | null>(null)
  const nearStationRef = useRef<PlacedStruct | null>(null); nearStationRef.current = nearStation
  const [openMenu, setOpenMenu] = useState<{ kind: StationKind; struct: PlacedStruct } | null>(null)

  // ── Chest storage (keyed by stationInstanceId) · shared Exchange market · planted crops ──
  // Save fields (`chests`/`ge`/`plantedCrops`) are the SAME ones the 2D game already writes
  // (page.tsx) — reusing the exact names + engine types keeps both walkers' economies in sync
  // instead of forking a parallel, orphaned save shape.
  const chestsRef = useRef<Record<string, ChestStorage>>({})
  const [chestsTick, setChestsTick] = useState(0) // bump to re-render the open chest menu after a transfer
  const geRef = useRef<GEMarketState>(createGEState())
  const plantedCropsRef = useRef<PlantedCrop[]>([])
  const [cropsTick, setCropsTick] = useState(0) // bump to re-render the open planter menu (plant/harvest)

  // Double-tap use: drink a mana potion, or enter placement for a placeable.
  const useItem = useCallback((itemId?: string) => {
    if (!itemId) return
    if (itemId in PLACEABLES) {
      if (countItem(invRef.current, itemId) < 1) return
      battleRef.current = true                       // freeze the walker while aiming the ghost
      setPlacing({ itemId, facing: 0 })
      return
    }
    const restore = MANA_POTIONS[itemId]
    if (restore == null || countItem(invRef.current, itemId) < 1) return   // not a drinkable mana potion / none held
    const max = getMaxPool(skillsRef.current.mana.level)
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
    const blocked = !walkable(gr, t.x, t.y) || structuresRef.current.some(s => s.tileX === t.x && s.tileY === t.y)
    if (blocked) { setHarvestToast('Can’t build there'); return }
    if (countItem(invRef.current, pl.itemId) < 1) { cancelPlacing(); return }
    removeItems(invRef.current, pl.itemId, 1)
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
  const openStation = useCallback(() => {
    const s = nearStationRef.current; if (!s) return
    battleRef.current = true
    setOpenMenu({ kind: STATIONS[s.itemId].kind, struct: s })
  }, [])
  const closeStation = useCallback(() => { battleRef.current = false; setOpenMenu(null) }, [])

  const brew = useCallback((potionId: string) => {
    const before = skillsRef.current.alchemy.level
    // Active companion @15 perk — Sporebloom bonus draught (Sporeling)
    const brewBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current) ?? null
    if (!brewPotion(potionId, invRef.current, skillsRef.current, manaRef.current, getBonusFindChance(brewBeast, 'alchemy'))) { setHarvestToast('Missing ingredients or mana'); return }
    syncSkillHud()
    const def = POTION_DEFS[potionId]
    setHarvestToast(`Brewed ${def.name} ×${def.resultCount}`)
    if (skillsRef.current.alchemy.level > before) setBanner(`✦ Alchemy Lv ${skillsRef.current.alchemy.level}!`)
    persist()
  }, [syncSkillHud, persist])

  const craft = useCallback((recipeId: string) => {
    if (!craftItem(recipeId, invRef.current, manaRef.current)) { setHarvestToast('Missing materials or mana'); return }
    syncSkillHud() // refreshes the mana pie (craft drained mana)
    setInvSlots([...invRef.current.slots])
    const def = RECIPE_DEFS[recipeId]
    setHarvestToast(`Crafted ${def.name}${def.resultCount > 1 ? ` ×${def.resultCount}` : ''} — hold ${prettyItem(def.id)} to place`)
    persist()
  }, [syncSkillHud, persist])

  // Craft a tiered tool (blade/spike/rinstick) — consumes gathered mats, auto-equips it for its
  // skill (replacing the basic/current). It wears out and breaks; the basic is always the fallback.
  const craftToolAction = useCallback((toolId: string) => {
    const newTool = craftTool(toolId, invRef.current)
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
    if (!tool || !repairTool(tool, invRef.current)) { setHarvestToast('Missing materials to repair'); return }
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

  // ── Hotbar/satchel drag-reorder → swap the REAL inventory slots so it persists and survives
  // the next inventory update (otherwise HotBar only reorders a local mirror and it reverts). ──
  const reorderSlots = useCallback((from: number, to: number) => {
    const s = invRef.current.slots
    if (from < 0 || to < 0 || from >= s.length || to >= s.length || from === to) return
    const tmp = s[to]; s[to] = s[from]; s[from] = tmp
    setInvSlots([...s])
    persist()
  }, [persist])

  // ── Exchange Booth (open at a placed booth) — buy/sell vs the single shared GE market ──
  const [tradeToast, setTradeToast] = useState<string | null>(null)
  useEffect(() => { if (!tradeToast) return; const t = setTimeout(() => setTradeToast(null), 2400); return () => clearTimeout(t) }, [tradeToast])
  const tradeBuy = useCallback((itemId: string, qty: number) => {
    const res = buyFromGE(geRef.current, wallet.marks, invRef.current, itemId, qty)
    if (!res.success) { setTradeToast(res.error ?? 'Trade failed'); return }
    wallet.spend(res.totalMarks)
    setInvSlots([...invRef.current.slots])
    setTradeToast(`Bought ${qty}× ${prettyItem(itemId)} for ${res.totalMarks} marks`)
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
    // Active companion @15 perk — Tuberfind bonus crop (Dustwhisker)
    const activeBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current) ?? null
    const result = harvestCrop(crop, invRef.current, skillsRef.current, getBonusFindChance(activeBeast, 'farming'))
    plantedCropsRef.current = plantedCropsRef.current.filter(c => c.id !== crop.id)
    setCropsTick(t => t + 1)
    syncSkillHud()
    setInvSlots([...invRef.current.slots])
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
    const xp = Math.round(NODE_DEFS[node.type].xp * (tool?.xpBonus ?? 1))
    // Active companion @15 perk — skill-matched bonus find (Grovekin/Gemsense/Truesight)
    const activeBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current) ?? null
    const added = addHarvestItems(invRef.current, rollDrops(node.type, getBonusFindChance(activeBeast, skillId)))
    const xpr = addSkillXP(skillsRef.current[skillId], xp)
    // Wear the tool — basics never break; when an improved tool breaks, fall back to the basic.
    if (tool && !useTool(tool)) {
      delete equippedToolsRef.current[skillId]
      ensureBasicTools(equippedToolsRef.current)
      setToolTick(t => t + 1)
      setHarvestToast(`${TOOL_DEFS[tool.toolId]?.name} broke — back to your ${TOOL_DEFS[equippedToolsRef.current[skillId]!.toolId]?.name}`)
    }
    depleteNode(node)
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
      setManaFrac(manaRef.current.current / getMaxPool(skillsRef.current.mana.level))
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
      setManaFrac(manaRef.current.current / getMaxPool(skillsRef.current.mana.level))
      chopClockRef.current += dt
      if (chopClockRef.current >= 0.42) { chopClockRef.current = 0; gatherTick(getNodeSkill(ch.node.type)) } // working rhythm
      ch.progress += dt / ch.durSec
      if (ch.progress >= 1) {
        grantHarvest(ch.node)
        channelRef.current = null; setChannel(null)
      } else {
        setChannel({ nodeId: ch.node.id, label: prettyItem(ch.node.type), hp: 1 - ch.progress })
      }
    }, dt * 1000)
    return () => clearInterval(id)
  }, [syncSkillHud, persist, grantHarvest])

  const onEncounter = useCallback((enc: WildEncounter) => {
    battleRef.current = true   // freeze the walker through the approach beat AND the fight
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
    const allies = real.length > 0
      ? real
      : (['fox', 'owl', 'water-bear'] as const).map((sp, i) => {
          const s = createSpirit(sp, ['Kit', 'Sage', 'Tor'][i], 0, 0)
          s.level = 12; s.bond = 60; s.happiness = 128
          return s
        })
    const enc = rollEncounter(logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z), partyLevelRef.current || 12)
    const enemies = enc
      ? buildWildParty(enc, allies.length)
      : (['frog', 'bat'] as const).map((sp, i) => {
          const s = createSpirit(sp, ['Blightling', 'Gnash'][i], 0, 0)
          s.level = Math.max(10, partyLevelRef.current || 12)
          return s
        })
    battleRef.current = true
    setBattle({ allies, enemies, aiTier: enc?.aiTier ?? 'wild', zoneId: logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z), kind: 'wild' })
  }, [])

  // Battle end: on a win, split rewards across the party (XP / bond / happiness / gold), then save.
  const endBattle = useCallback((outcome: 'win' | 'lose') => {
    battleRef.current = false
    const bd = curBattleRef.current
    let spoils: { gold: number; rows: RewardRow[] } | null = null
    if (outcome === 'win' && bd) {
      const totalXp = bd.enemies.reduce((s, e) => s + Math.max(8, e.level * 12), 0)
      const gold = bd.enemies.reduce((s, e) => s + e.level * 3, 0)
      const allies = (partyRef.current ?? []).slice(0, MAX_PARTY)
      const perXp = Math.max(1, Math.round(totalXp / Math.max(1, allies.length)))
      if (gold > 0) wallet.earn(gold)
      const rows: RewardRow[] = []
      for (const spirit of allies) {
        const fromLevel = spirit.level
        const xpResult = addXP(spirit, perXp)
        spirit.bond = Math.min(255, spirit.bond + 4)
        spirit.happiness = Math.min(255, spirit.happiness + 3)
        // Full evolution (form/element change) is the 2D EvolutionScene's job — not ported yet. We just
        // celebrate the threshold here; the spirit keeps leveling until it can evolve in the full flow.
        if (xpResult.evolved) setBanner(`✦ ${spirit.name} is ready to evolve!`)
        rows.push({ name: spirit.name, element: spirit.element, fromLevel, toLevel: spirit.level, xpGained: perXp, curXp: spirit.xp, needXp: xpForLevel(spirit.level), evolved: !!xpResult.evolved })
      }
      // Wild fights get the spoils reveal; the scripted holds keep their narrative payoff (dialogue below).
      if (!bd.kind || bd.kind === 'wild') spoils = { gold, rows }
    }
    setBattle(null)
    if (spoils) { battleRef.current = true; setRewards(spoils) }   // stay frozen behind the reveal
    // Liberation beat: freeing Thistle's collared spirit clears Hold 1 — he deflates and retreats east.
    if (outcome === 'win' && bd?.kind === 'thistle') {
      flagsRef.current.freedThistle = true
      setDefeated((d) => ({ ...d, thistle: true }))
      // Canon (ruled 2026-07-04): win = free. The old freed-vs-forced beat was dropped, so the
      // collar just breaks on the win — one freeing path.
      setDialogue({ name: 'Thistle', lines: [...THISTLE_DEFEAT, FREED_SPIRIT_BEAT], idx: 0, onDone: () => setBanner('✦ Hold 1 cleared — Spirit Meadows is open') })
    }
    // Hold 2: Sorrel's stronghold falls — both collars break, he retreats up to Brack, and a Mana Seed
    // is left behind. Canon reward = the Mana Seed blooms into a new companion (party growth = seeds/bloom).
    if (outcome === 'win' && bd?.kind === 'sorrel') {
      flagsRef.current.freedSorrel = true
      setDefeated((d) => ({ ...d, sorrel: true }))
      const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
      const bloom = createSpirit(sp, speciesDisplayName(sp), 0, 0)
      bloom.level = Math.max(5, partyLevelRef.current)
      partyRef.current = [...(partyRef.current ?? []), bloom]
      setDialogue({ name: 'Sorrel', lines: [...SORREL_DEFEAT, FREED_PAIR_BEAT, `A Mana Seed sits where the leashes were. It blooms — a young ${speciesDisplayName(sp)} joins you.`], idx: 0, onDone: () => setBanner('✦ Hold 2 cleared — the Mana Springs are free') })
    }
    // Hold 3 — the climax. Brack's stronghold falls; all three collars break at once and the three Moglins
    // deflate together (the four-voice finale). Mana Seed reward blooms a companion; the arc closes.
    if (outcome === 'win' && bd?.kind === 'brack') {
      flagsRef.current.freedBrack = true
      setDefeated((d) => ({ ...d, brack: true }))
      const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
      const bloom = createSpirit(sp, speciesDisplayName(sp), 0, 0)
      bloom.level = Math.max(5, partyLevelRef.current)
      partyRef.current = [...(partyRef.current ?? []), bloom]
      const finale = [...BRACK_FINALE, { speaker: '—', text: `A Mana Seed rests in the cracked-open grass. It blooms — a young ${speciesDisplayName(sp)} joins you.` }]
      setDialogue({
        name: 'Brack',
        lines: finale.map(l => l.text),
        speakers: finale.map(l => l.speaker),
        idx: 0,
        onDone: () => setBanner('✦ The holds are free — the three come home'),
      })
    }
    persist()
  }, [wallet, persist])

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
    // The rest of the run's economy. persist() writes every one of these refs, so anything left
    // un-reset here gets saved straight back into the "new" game.
    beastsRef.current = []
    activeBeastIdRef.current = null
    chestsRef.current = {}
    geRef.current = createGEState()
    plantedCropsRef.current = []
    setChestsTick(t => t + 1)
    setCropsTick(t => t + 1)
    setStructures([])
    syncSkillHud()
    setHasStarter(false)
    setDefeated({})
    const z = getZone(ZONES, START_ZONE)!
    const ps = z.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current!.set(ps.tileX, posRef.current!.y, ps.tileY)
    setZoneId(START_ZONE)
    setBanner('new game — find Gregory in the glade')
    persist({ replaceFlags: true })
  }, [persist, syncSkillHud])

  // Gregory's gift — the player's first spirit (the kit). One RNG starter → party, flag set, saved.
  const grantStarter = useCallback(() => {
    const s = makeStarterSpirit()
    partyRef.current = [s]
    flagsRef.current.gotStarter = true
    setHasStarter(true)
    // Gregory also sets you up with the builder kit (stations + mats) — the moment the crafting loop opens.
    // Granted unconditionally: this fires exactly once per save (gated by gotStarter, so Gregory's gift can't
    // repeat), and newGame sets STARTER_KIT_FLAG=true purely to suppress the load-path migration, not to record
    // an actual grant — so guarding on that flag here would wrongly skip Gregory's kit.
    grantStarterKit(invRef.current)
    flagsRef.current[STARTER_KIT_FLAG] = true
    setInvSlots([...invRef.current.slots])
    setBanner(`✦ a young ${speciesDisplayName(s.species)} joined you!`)
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

  // Thistle's collared captive — the spirit you free in the Reach battle (enemy index 0, auto-collared by
  // createPartyBattle's reach mode, which also dims it and hands your party the calming moves).
  const startThistleBattle = useCallback(() => {
    const sp = LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
    const captive = createSpirit(sp, `Collared ${speciesDisplayName(sp)}`, 0, 0)
    captive.level = 5
    captive.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
    battleRef.current = true
    setBattle({ allies: partyRef.current!, enemies: [captive], aiTier: 'wild', zoneId: logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z), kind: 'thistle' })
  }, [])

  // Sorrel — Hold 2, the stronghold. Enemies = [guard, captive, captive]. The guard (no collar) SHIELDS
  // the two collared captives: you break the brute first, then reach BOTH to free them. KO'ing either
  // captive = "forced" (you broke who you came to save). Tougher than Thistle (champion AI, higher levels).
  const startSorrelBattle = useCallback(() => {
    const lvl = Math.max(6, partyLevelRef.current)
    const pick = () => LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
    const guard = createSpirit(pick(), 'Sorrel’s Brute', 0, 0)
    guard.level = lvl + 2
    guard.seeds = Array.from({ length: 6 }, () => 16 + Math.floor(Math.random() * 16))
    const mkCaptive = () => {
      const sp = pick()
      const c = createSpirit(sp, `Collared ${speciesDisplayName(sp)}`, 0, 0)
      c.level = lvl
      c.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
      return c
    }
    battleRef.current = true
    setBattle({ allies: partyRef.current!, enemies: [guard, mkCaptive(), mkCaptive()], aiTier: 'champion', zoneId: logicalZoneAt(zoneIdRef.current, posRef.current!.x, posRef.current!.z), kind: 'sorrel' })
  }, [])

  // Brack — Hold 3, the climax. The pooled force: TWO enforcers (guards) shielding THREE collared
  // captives. Break both guards, then reach all three. The wall of the arc — canon wants a real team.
  const startBrackBattle = useCallback(() => {
    const lvl = Math.max(8, partyLevelRef.current)
    const pick = () => LAUNCHED_SPECIES[Math.floor(Math.random() * LAUNCHED_SPECIES.length)]
    const mkGuard = (name: string, bump: number) => {
      const g = createSpirit(pick(), name, 0, 0)
      g.level = lvl + bump
      g.seeds = Array.from({ length: 6 }, () => 18 + Math.floor(Math.random() * 14))
      return g
    }
    const mkCaptive = () => {
      const sp = pick()
      const c = createSpirit(sp, `Collared ${speciesDisplayName(sp)}`, 0, 0)
      c.level = lvl
      c.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
      return c
    }
    battleRef.current = true
    setBattle({ allies: partyRef.current!, enemies: [mkGuard('Brack’s Muscle', 3), mkGuard('Brack’s Enforcer', 2), mkCaptive(), mkCaptive(), mkCaptive()], aiTier: 'champion', zoneId: zoneIdRef.current, kind: 'brack' })
  }, [])

  // Talk to an NPC. Gregory: no spirit → intro + starter handoff; else a sendoff. Thistle: no spirit → he
  // sneers you off; with a bonded spirit → pre-fight swagger, then the Reach battle to free his captive.
  const talk = useCallback((npc: NPC3D) => {
    const hasSpirit = (partyRef.current?.length ?? 0) > 0
    if (npc.id === 'gregory') {
      if (!hasSpirit) setDialogue({ name: 'Gregory', lines: [...GREG_INTRO_LINES, GREG_NUDGE], idx: 0, grantAt: GREG_INTRO_LINES.length, onDone: () => {} })
      else setDialogue({ name: 'Gregory', lines: [GREG_RETURN], idx: 0, onDone: () => {} })
    } else if (npc.id === 'thistle') {
      if (!hasSpirit) setDialogue({ name: 'Thistle', lines: THISTLE_TAUNT_NO_SPIRIT, idx: 0, onDone: () => {} })
      else setDialogue({ name: 'Thistle', lines: THISTLE_PREFIGHT, idx: 0, onDone: startThistleBattle })
    } else if (npc.id === 'sorrel') {
      // Sorrel only stands here once Thistle has fled to him (gated by requiredFlag), so the player
      // always has a party by now — straight to the swagger, then the stronghold Reach battle.
      setDialogue({ name: 'Sorrel', lines: SORREL_PREFIGHT, idx: 0, onDone: startSorrelBattle })
    } else if (npc.id === 'brack') {
      setDialogue({ name: 'Brack', lines: BRACK_PREFIGHT, idx: 0, onDone: startBrackBattle })
    }
  }, [startThistleBattle, startSorrelBattle, startBrackBattle])

  const [version, setVersion] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  // Birth Rune gate — New Game opens this before resetting; choosing a rune is the player's
  // one "who am I" moment (play3d is first-person, so birth IS the character moment).
  const [birthOpen, setBirthOpen] = useState(false)
  const [birthCancelable, setBirthCancelable] = useState(true) // New Game birth is escapable; first-entry birth is not
  const birthRuneRef = useRef<string | null>(null)  // chosen rune id; TODO(mechanics): fold into persist()/load() + grant a starting ability off it
  const editRef = useRef(false); editRef.current = editMode

  // The walker is public; the terrain editor is owner-only. ather.games has no cloud auth, so owner
  // status comes from the httpOnly `ather_owner` cookie via /api/owner (set it at /owner?key=OWNER_KEY).
  const [isOwner, setIsOwner] = useState(false)
  const isOwnerRef = useRef(isOwner); isOwnerRef.current = isOwner  // stable read for onWarp's owner-only gate
  // Weapon (outside-Ather only): drawn when the current zone's realm is 'outside'. fireReqRef bridges
  // the DOM click → the FiringRange useFrame (which spawns from the live camera). Spirits stay holstered.
  const weaponDrawn = zone.realm === 'outside'
  const weaponDrawnRef = useRef(weaponDrawn); weaponDrawnRef.current = weaponDrawn
  const fireReqRef = useRef(false)
  const shotsRef = useRef(0)   // hot-path counters live in refs — NO per-shot/per-hit React re-render
  const hitsRef = useRef(0)
  const casterRef = useRef<HTMLDivElement>(null)  // viewmodel node; recoil kicked imperatively (no key remount)
  const [hudStats, setHudStats] = useState({ shots: 0, hits: 0 })  // display only, synced on a throttle
  const adsRef = useRef(false)  // aim-down-sights (right-click hold); CameraRig reads it for fov + sensitivity
  const [ads, setAds] = useState(false)  // drives the viewmodel raise (toggles ~twice per aim, not per-frame)
  const onRangeHit = useCallback(() => { hitsRef.current++ }, [])
  // Sync the HUD counters at ~5fps while the weapon is out, so firing never touches the (huge) component's
  // render path — that churn was stuttering the movement rAF. Reset counters when the weapon holsters.
  useEffect(() => {
    if (!weaponDrawn) { shotsRef.current = 0; hitsRef.current = 0; setHudStats({ shots: 0, hits: 0 }); adsRef.current = false; setAds(false); return }
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
  // Show on-screen touch controls (joystick + A/B) on touch devices; desktop keeps WASD + drag-look.
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => { setIsTouch((window.matchMedia?.('(pointer: coarse)').matches ?? false) || 'ontouchstart' in window) }, [])

  // ── Inventory (satchel) open/close, hijacking the mouse while it's up ──────────────────────────
  // First-person play captures the pointer, so the satchel's drag-and-drop is unreachable mid-play.
  // Opening the bag RELEASES the pointer (free cursor to click/drag); closing re-captures the look.
  // Same move the station menu already does (exitPointerLock → menu). Bag state lives here (not in
  // HotBar) so the "I" key and the pointer-lock toggle stay in one place. canvasElRef re-locks on close.
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const [bagOpen, setBagOpen] = useState(false)
  const bagOpenRef = useRef(false); bagOpenRef.current = bagOpen
  const toggleBag = useCallback((open: boolean) => {
    setBagOpen(open)
    if (open) { document.exitPointerLock?.() }                       // free the cursor for the satchel
    else if (!editRef.current && !isTouch) {                          // re-capture first-person look on close
      const c = canvasElRef.current
      if (c) { try { const r = c.requestPointerLock?.() as unknown as Promise<void> | undefined; r?.catch?.(() => {}) } catch { /* re-lock cooldown — a canvas click resumes look */ } }
    }
  }, [isTouch])
  // "I" toggles the bag (not while a blocking overlay owns the screen); Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'i') {
        // battleRef.current = walker frozen by a station menu / rinning / placing; curBattleRef = real battle
        if (editRef.current || battleRef.current || curBattleRef.current || dialogueRef.current) return
        e.preventDefault(); toggleBag(!bagOpenRef.current)
      } else if (k === 'escape' && bagOpenRef.current) { e.preventDefault(); toggleBag(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleBag])
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
      const k = e.key.toLowerCase()
      if (k !== 'e' && k !== ' ' && k !== 'enter') return
      if (dialogueRef.current) { e.preventDefault(); advanceDialogue(); return }
      if (k === ' ') return  // Space outside dialogue = jump only; E/Enter initiate interactions
      if (nearNpc) { e.preventDefault(); talk(nearNpc) }
      else if (fishRef.current || nearNodeRef.current || channelRef.current) { e.preventDefault(); toggleChannel() }
      else if (nearStationRef.current) { e.preventDefault(); openStation() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editMode, battle, nearNpc, advanceDialogue, talk, toggleChannel, openStation])

  // ── Mouse-look controls (FPS model): once the pointer is CAPTURED (first canvas click locks it),
  //    left-click = interact with what's in front, right-click = use/place the selected hotbar item,
  //    scroll = cycle the hotbar (handled in HotBar). Before capture, the first click just locks — so
  //    we no-op unless pointerLockElement is set. Keyboard (E/Space/Enter) stays a parallel interact. ──
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (editMode || e.pointerType !== 'mouse') return
      if (!(document.pointerLockElement instanceof Element)) return  // pre-capture click just locks; ignore
      // Aiming a build ghost: right-click plants it, left-click rotates it (Enter/arrows/Esc still work).
      if (placingRef.current) {
        e.preventDefault()
        if (e.button === 2) confirmPlacing()
        else if (e.button === 0) rotatePlacing()
        return
      }
      if (battleRef.current) return  // a menu/battle overlay owns input
      if (e.button === 0) {
        // outside the Ather the weapon is drawn: left-click FIRES a projectile (the FiringRange's
        // useFrame reads fireReqRef and spawns from the camera). Takes priority over interact.
        if (weaponDrawnRef.current) {
          e.preventDefault(); fireReqRef.current = true; shotsRef.current++
          const el = casterRef.current  // restart the recoil kick imperatively (no React state → no re-render)
          if (el) { el.style.animation = 'none'; void el.offsetHeight; el.style.animation = 'casterKick 0.13s ease-out' }
          return
        }
        // interact — same priority ladder as the E key
        if (dialogueRef.current) advanceDialogue()
        else if (nearNpc) talk(nearNpc)
        else if (fishRef.current || nearNodeRef.current || channelRef.current) toggleChannel()
        else if (nearStationRef.current) { document.exitPointerLock?.(); openStation() }  // free the cursor for the menu
      } else if (e.button === 1) {
        // middle-click (scroll-wheel press) = use/place the selected hotbar item (moved off right-click)
        e.preventDefault()
        useItem(invRef.current.slots[selSlotRef.current]?.itemId)
      } else if (e.button === 2 && weaponDrawnRef.current) {
        // right-click HOLD = aim down sights (weapon only). Released in onUp below.
        e.preventDefault(); adsRef.current = true; setAds(true)
      }
    }
    const onUp = (e: PointerEvent) => {
      if (e.button === 2 && adsRef.current) { adsRef.current = false; setAds(false) }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp) }
  }, [editMode, nearNpc, advanceDialogue, talk, toggleChannel, openStation, useItem, confirmPlacing, rotatePlacing])
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
  // recomputed each render; resize bumps version → re-render → fresh dims (drives the geometry key)
  const dims = `${gridRef.current[0]?.length ?? 0}x${gridRef.current.length}`

  const paint = useCallback((c: number, r: number, shift: boolean) => {
    const t = toolRef.current, b = brushRef.current
    // Node tools drop/remove a single resource node in the node layer (not the tile grid).
    if (NODE_TOOL_IDS.has(t)) {
      setNodes(prev => {
        const without = prev.filter(n => !(n.tileX === c && n.tileY === r))
        if (shift) return without                                  // shift-click erases any node here
        if (without.length !== prev.length) return prev            // already a node here — leave it
        return [...prev, { type: t as NodeType, tileX: c, tileY: r }]
      })
      return
    }
    const H = heightsRef.current, G = gridRef.current
    const rows = G.length, cols = G[0].length
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
    setVersion((v) => v + 1)
  }, [])

  // Empty the whole zone to a blank grid — then draw the land's shape onto it.
  const clearZone = useCallback(() => {
    const G = gridRef.current, H = heightsRef.current
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

  const onWarp = useCallback((w: Warp) => {
    if (w.ownerOnly && !isOwnerRef.current) return  // dev/test gate — silent no-op for players
    // Doors back onto the continent land at the zone's composed-world spot; interiors mount as before.
    const world = isStitched(w.toZone) ? getGardenWorld().toWorld(w.toZone, w.toX, w.toY) : null
    posRef.current!.set(world?.x ?? w.toX, posRef.current!.y, world?.y ?? w.toY)
    if (w.direction && DIR_YAW[w.direction] !== undefined) camYaw.current = DIR_YAW[w.direction]
    setZoneId(world ? WORLD_ZONE_ID : w.toZone)
  }, [])

  // Jump straight to a zone to edit it (no walking/warping). Resets the player + camera focus
  // to its spawn. NOTE: unsaved edits in the current zone are dropped — save before switching.
  const selectZone = useCallback((id: string) => {
    const z = getZone(ZONES, id)
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
          // The composer rewrites warp cells in the world view (stitched warps demote to floor,
          // unpainted door mouths force to gold) — restore the authored values at every warp
          // position so a save-back never writes composer artifacts into a zone's source.
          for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++)
            if ((p.zone.grid[r][c] & 0xFF) === WARP_ID && gSlice[r][c] !== p.zone.grid[r][c]) gSlice[r][c] = p.zone.grid[r][c]
          for (const wz of p.zone.warps)
            if ((gSlice[wz.fromY]?.[wz.fromX] & 0xFF) === WARP_ID && gSlice[wz.fromY][wz.fromX] !== p.zone.grid[wz.fromY][wz.fromX])
              gSlice[wz.fromY][wz.fromX] = p.zone.grid[wz.fromY][wz.fromX]
          const zNodes = nodesRef.current
            .filter(nd => w.zoneAt(nd.tileX, nd.tileY) === p.zone.id)
            .map(nd => ({ nodeType: nd.type, x: nd.tileX - p.ox, y: nd.tileY - p.oy }))
          const gChanged = JSON.stringify(gSlice) !== JSON.stringify(p.zone.grid)
          const hChanged = JSON.stringify(hSlice) !== JSON.stringify(getHeightGrid(p.zone.id, p.rows, p.cols))
          const nChanged = JSON.stringify(zNodes) !== JSON.stringify((ZONE_NODES[p.zone.id] ?? []).map(nd => ({ nodeType: nd.type, x: nd.tileX, y: nd.tileY })))
          if (!gChanged && !hChanged && !nChanged) continue
          touched++
          if (hChanged) posts.push(fetch('/shimmer/save-heights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId: p.zone.id, heights: hSlice }) }))
          if (gChanged) posts.push(fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grid: gSlice, mapId: p.zone.id }) }))
          if (nChanged) posts.push(fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes: zNodes, mapId: p.zone.id }) }))
        }
        // Edits landing in the derived mortar/corridors (no owning zone) can't persist — detect
        // grid/height/node changes out there so the save message says so instead of lying "saved".
        let mortarEdits = nodesRef.current.some(nd => !w.zoneAt(nd.tileX, nd.tileY))
        for (let r = 0; r < w.rows && !mortarEdits; r++) for (let c = 0; c < w.cols; c++)
          if (!w.zoneAt(c, r) && (gridRef.current[r][c] !== w.grid[r][c] || heightsRef.current[r][c] !== w.heights[r][c])) { mortarEdits = true; break }
        const rs = await Promise.all(posts)
        const bad = rs.find(r => !r.ok)
        const detail = bad ? `save failed — ${bad.status}: ${(await bad.text()).slice(0, 140)}` : null
        setSaveMsg(!touched ? 'no district changes to save'
          : !detail ? `saved ${touched} district${touched > 1 ? 's' : ''} ✓ — live on next refresh${mortarEdits ? ' · mortar/corridor edits are derived — not saved' : ''}`
          : detail)
        setTimeout(() => setSaveMsg(''), 4500)
        return
      }
      const id = zone.id
      const [h, g, n] = await Promise.all([
        fetch('/shimmer/save-heights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId: id, heights: heightsRef.current }) }),
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grid: gridRef.current, mapId: id }) }),
        // node layer → node-placements.ts (same endpoint, `nodes` payload; {nodeType,x,y} shape)
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes: nodesRef.current.map(nd => ({ nodeType: nd.type, x: nd.tileX, y: nd.tileY })), mapId: id }) }),
      ])
      const zbad = [h, g, n].find(r => !r.ok)
      setSaveMsg(!zbad ? 'saved ✓ — live on next refresh' : `save failed — ${zbad.status}: ${(await zbad.text()).slice(0, 140)}`)
    } catch { setSaveMsg('save failed') }
    setTimeout(() => setSaveMsg(''), 3500)
  }, [zone.id])

  const Btn = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: '6px 10px', borderRadius: 6, border: active ? '2px solid #d4a843' : '1px solid #ffffff33',
      background: active ? '#d4a84333' : '#16142a', color: '#e9dfc8', font: '700 13px ui-monospace, monospace',
      cursor: 'pointer', pointerEvents: 'auto',
    }}>{children}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#bfe3ef', cursor: editMode ? 'crosshair' : 'default', touchAction: 'none', overscrollBehavior: 'none' }}>
      <Canvas shadows camera={{ fov: 45, position: [1, 6, 14], near: 0.1, far: 500 }} gl={{ antialias: true }}
        onCreated={(state) => { canvasElRef.current = state.gl.domElement }}>
        <Scene
          zone={zone} gridRef={gridRef} heights={heightsRef.current} version={version} dims={dims}
          posRef={posRef as React.RefObject<THREE.Vector3>} heightsRef={heightsRef} zoneIdRef={zoneIdRef}
          editFocusRef={editFocusRef}
          onWarp={onWarp} yawRef={camYaw} editRef={editRef} eyeRef={eyeRef} jumpRef={jumpRef} slideRef={slideRef} paint={paint} editing={editMode}
          battleRef={battleRef} partyLevelRef={partyLevelRef} onEncounter={onEncounter} joyRef={joyRef}
          talkingRef={talkingRef} hasPartyRef={hasPartyRef} onNearChange={setNearNpc}
          harvestNodesRef={runtimeNodesRef} onNearNode={setNearNode} channel={channel}
          structures={structures} placing={placing} placeTargetRef={placeTargetRef} structuresRef={structuresRef} onNearStation={setNearStation}
          defeatedRef={defeatedRef} defeated={defeated} flagsRef={flagsRef}
          nodes={runtimeNodes}
          companionColor={(() => { const b = beastsRef.current.find(x => x.id === activeBeastIdRef.current); void companionTick; return b ? (BEAST_COLOR[b.species] ?? '#9fd9c4') : null })()}
          fishing={!!fish} fishBite={!!fish?.bite}
          harvestPop={harvestPop}
          atmosZone={districtZone}
          isOwner={isOwner}
          fireReqRef={fireReqRef}
          onRangeHit={onRangeHit}
          adsRef={adsRef}
        />
      </Canvas>

      {/* edit-mode keeps a minimal zone/controls strip; play HUD is clean (marks moved to the top-right stack) */}
      {editMode && (
        <div style={{
          position: 'fixed', top: 12, left: 12, padding: '8px 12px', borderRadius: 8,
          background: 'rgba(10,8,20,0.66)', color: '#e9dfc8', font: '600 13px ui-monospace, monospace', lineHeight: 1.5,
        }}>
          Shimmer 3D — {zone.id === WORLD_ZONE_ID ? (getZone(ZONES, districtZone)?.name ?? zone.name) : zone.name}  ·  EDIT<br />
          <span style={{ opacity: 0.8 }}>left-drag paint · WASD fly · Q/E down·up · right-drag look · scroll zoom</span>
        </div>
      )}

      {/* free-look nudge: first-person play, before the pointer is captured. Fades out a few seconds after
          spawn (showLookHint) so it's a welcome, not permanent chrome. */}
      {!editMode && !pointerLocked && !isTouch && !dialogue && !battle && showLookHint && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 108, transform: 'translateX(-50%)', zIndex: 34,
          padding: '6px 13px', borderRadius: 999, background: 'rgba(16,14,32,0.8)', border: '1px solid #7fe3c855',
          color: '#cfeee2', font: '700 12px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
          animation: 'lookHintFade 5s ease-out forwards',
        }}>
          <style>{`@keyframes lookHintFade { 0%,70% { opacity: 1 } 100% { opacity: 0 } }`}</style>
          click to look around <span style={{ opacity: 0.6 }}>· Esc releases</span></div>
      )}

      {/* minimap — persistent, click (or M) expands to the full map */}
      {!battle && !editMode && !showMap && (
        <MiniMap zoneId={zone.id} gridRef={gridRef} posRef={posRef} yawRef={camYaw} onExpand={() => setShowMap(true)} />
      )}
      {showMap && <WorldMap zoneId={zone.id} gridRef={gridRef} posRef={posRef} yawRef={camYaw} onClose={() => setShowMap(false)} />}

      {/* talk prompt when standing by an NPC */}
      {nearNpc && !dialogue && !battle && !editMode && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 156, transform: 'translateX(-50%)', zIndex: 35,
          padding: '7px 14px', borderRadius: 999, background: 'rgba(16,14,32,0.92)', border: '1px solid #d4a84366',
          color: '#ffe9b0', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>✦ Talk to {nearNpc.name} <span style={{ opacity: 0.6 }}>({isTouch ? 'tap ✦' : 'E'})</span></div>
      )}

      {/* rinning prompt — locked at the pool: watch, then strike when the `!` pops (early/late slips) */}
      {fish && !editMode && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 156, transform: 'translateX(-50%)', zIndex: 35,
          padding: '7px 14px', borderRadius: 999, background: fish.bite ? 'rgba(20,54,66,0.95)' : 'rgba(11,21,19,0.92)',
          border: `1px solid ${fish.bite ? '#7fe9ff' : '#4fc79a66'}`, boxShadow: fish.bite ? '0 0 18px #37e6ff88' : 'none',
          color: fish.bite ? '#eafcff' : '#cfeee2', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{fish.bite
          ? <>❗ HOOK IT! <span style={{ opacity: 0.7 }}>({isTouch ? 'tap' : 'E'})</span></>
          : <>🎣 rinning {fish.label} · watch the water… <span style={{ opacity: 0.6 }}>({isTouch ? 'tap' : 'E'})</span></>}</div>
      )}

      {/* harvest prompt when standing by a node (hidden once you link in or start fishing) */}
      {nearNode && !channel && !fish && !nearNpc && !dialogue && !battle && !editMode && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 156, transform: 'translateX(-50%)', zIndex: 35,
          padding: '7px 14px', borderRadius: 999, background: 'rgba(11,21,19,0.92)', border: '1px solid #4fc79a66',
          color: '#cfeee2', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{getNodeSkill(nearNode.type) === 'rinning'
          ? <>🎣 Cast at {prettyItem(nearNode.type)} <span style={{ opacity: 0.6 }}>({isTouch ? 'tap 🎣' : 'E'})</span></>
          : <>🪓 Channel {prettyItem(nearNode.type)} <span style={{ opacity: 0.6 }}>({isTouch ? 'tap 🪓' : 'E'})</span></>}</div>
      )}
      {/* station prompt — generic over brew/craft/chest/exchange/farm, driven by the STATIONS registry */}
      {nearStation && !openMenu && !nearNode && !nearNpc && !dialogue && !battle && !editMode && !placing && (() => {
        const st = STATIONS[nearStation.itemId]
        return (
          <div style={{
            position: 'fixed', left: '50%', bottom: 156, transform: 'translateX(-50%)', zIndex: 35,
            padding: '7px 14px', borderRadius: 999, background: st.bg, border: `1px solid ${st.accent}66`,
            color: '#f0e2c4', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>{st.emoji} {st.verb} at the {st.name} <span style={{ opacity: 0.6 }}>({isTouch ? `tap ${st.emoji}` : 'E'})</span></div>
        )
      })()}
      {/* channeling indicator — mana is powering the tool; the node's HP bar drains over it */}
      {channel && !battle && !editMode && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 156, transform: 'translateX(-50%)', zIndex: 35,
          padding: '7px 14px', borderRadius: 999, background: 'rgba(11,21,19,0.94)', border: '1px solid #3a7bd5aa',
          color: '#bfe0ff', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>⚡ Channeling into {channel.label}… <span style={{ opacity: 0.6 }}>(stay close · {isTouch ? 'tap ⏹' : 'E'} to stop)</span></div>
      )}

      {/* PLACEMENT MODE — ghost is in the 3D scene; this is the confirm/cancel/rotate control ring */}
      {placing && (
        <>
          <div style={{ position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 36, pointerEvents: 'none',
            padding: '7px 15px', borderRadius: 999, background: 'rgba(11,21,19,0.92)', border: '1px solid #7fe3c866',
            color: '#cfeee2', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap' }}>
            Placing {PLACEABLES[placing.itemId].name} — face where you want it{isTouch ? '' : ' · ← → rotate · Enter place · Esc cancel'}
          </div>
          <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 36, display: 'flex', gap: 14, alignItems: 'center' }}>
            <button onClick={rotatePlacing} aria-label="rotate" style={placeIconBtn('#3a7bd5')}>⟳</button>
            <button onClick={cancelPlacing} aria-label="cancel" style={placeIconBtn('#b9483f')}>✗</button>
            <button onClick={confirmPlacing} aria-label="confirm" style={placeIconBtn('#2f8f5f')}>✓</button>
          </div>
        </>
      )}

      {/* harvest toast — the drops + XP you just collected */}
      {harvestToast && !battle && (
        <div style={{
          position: 'fixed', left: '50%', top: 118, transform: 'translateX(-50%)', zIndex: 36,
          padding: '8px 16px', borderRadius: 12, background: 'rgba(11,21,19,0.94)', border: '1px solid #4fc79a', whiteSpace: 'nowrap',
          color: '#eafff6', font: '700 13px ui-monospace, monospace', pointerEvents: 'none', boxShadow: '0 6px 20px #0008',
        }}>{harvestToast}</div>
      )}

      {/* ── TOP-RIGHT HUD: mana pie gauge · ☰ menu (edit/new game) · skills panel ── */}
      {!battle && !approach && !rewards && !editMode && !dialogue && (
        <div data-ct={companionTick} style={{ position: 'fixed', top: 12, right: 12, zIndex: 34, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
          {/* marks wallet — moved here from the (now-removed) top-left box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, background: 'rgba(20,20,14,0.82)', border: '1px solid #d4a84340' }}>
            <span style={{ font: '800 14px ui-monospace, monospace', color: '#ffe08a', lineHeight: 1 }}>✦ {wallet.marks}</span>
            <span style={{ font: '700 9px ui-monospace, monospace', color: '#c8b06a', letterSpacing: '0.12em' }}>MARKS</span>
          </div>
          {/* mana pie — 1-100% of the pool; drains live while channeling */}
          <div style={{
            width: 104, height: 104, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `conic-gradient(#4aa3e6 ${manaFrac * 360}deg, rgba(10,20,28,0.72) ${manaFrac * 360}deg)`,
            border: '2px solid #2f5c4f', boxShadow: '0 3px 16px #0008',
          }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', background: '#0b1513', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #ffffff12' }}>
              <span style={{ font: '800 22px ui-monospace, monospace', color: '#bfe0ff', lineHeight: 1 }}>{Math.round(manaFrac * 100)}</span>
              <span style={{ font: '700 8px ui-monospace, monospace', color: '#7fa8c8', letterSpacing: '0.14em', marginTop: 2 }}>MANA</span>
            </div>
          </div>

          {/* Companion chip — active Mana'mal + its @15 perk; tap to switch (when you own >1) */}
          {beastsRef.current.length > 0 && (() => {
            const owned = beastsRef.current
            const active = owned.find(b => b.id === activeBeastIdRef.current) ?? owned[0]
            const info = PERK_INFO[BEAST_PERKS[active.species]]
            return (
              <button
                onClick={() => {
                  const i = owned.findIndex(b => b.id === activeBeastIdRef.current)
                  activeBeastIdRef.current = owned[(i + 1) % owned.length].id
                  setCompanionTick(t => t + 1); persist()
                }}
                title={`${active.name} — ${info.blurb}${owned.length > 1 ? ' · tap to switch' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, maxWidth: 200, padding: '5px 9px', borderRadius: 11,
                  border: '1px solid #d4a84340', background: 'rgba(20,20,14,0.82)', cursor: owned.length > 1 ? 'pointer' : 'default', textAlign: 'left',
                }}>
                <span style={{ font: '16px serif', lineHeight: 1 }}>🐾</span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ font: '800 11px ui-monospace, monospace', color: '#e9dfc8', whiteSpace: 'nowrap' }}>{active.name}</span>
                  <span style={{ font: '600 9px ui-monospace, monospace', color: '#8fd9c4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {info.label}{owned.length > 1 ? ` ⟳${owned.length}` : ''}
                  </span>
                </span>
              </button>
            )
          })()}

          {/* ☰ menu button */}
          <button onClick={() => { setMenuOpen(o => !o); setSkillsOpen(false) }} style={{
            width: 40, height: 40, borderRadius: 10, border: `1px solid ${menuOpen ? '#d4a843' : '#ffffff33'}`,
            background: menuOpen ? '#241d10' : 'rgba(16,20,32,0.86)', color: '#e9dfc8', font: '800 18px ui-monospace, monospace', cursor: 'pointer',
          }}>☰</button>
          {menuOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', background: 'rgba(12,16,26,0.94)', border: '1px solid #ffffff20', borderRadius: 10, padding: 8 }}>
              {/* site nav folded into the walker's own menu — play3d had no exit before this
                  (autosave persists on every change, so a hard nav out never loses progress) */}
              <button onClick={() => { window.location.href = '/room?wall=0' }} style={menuBtn}>⌂ The Room</button>
              <button onClick={() => { window.location.href = '/arcade/all' }} style={menuBtn}>▦ All games</button>
              {isOwner && <button onClick={() => { setMenuOpen(false); setEditMode(true) }} style={menuBtn}>✎ Edit terrain</button>}
              {confirmNew ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: '#e9dfc8', font: '700 11px ui-monospace, monospace' }}>reset?</span>
                  <button onClick={() => { setConfirmNew(false); setMenuOpen(false); setBirthCancelable(true); setBirthOpen(true) }} style={{ ...menuBtn, background: '#b9483f', color: '#fff' }}>Yes</button>
                  <button onClick={() => setConfirmNew(false)} style={menuBtn}>No</button>
                </div>
              ) : <button onClick={() => setConfirmNew(true)} style={menuBtn}>↺ New Game</button>}
            </div>
          )}

          {/* skills button */}
          <button onClick={() => { setSkillsOpen(o => !o); setMenuOpen(false) }} style={{
            width: 40, height: 40, borderRadius: 10, border: `1px solid ${skillsOpen ? '#4fc79a' : '#ffffff33'}`,
            background: skillsOpen ? '#12261f' : 'rgba(16,20,32,0.86)', color: '#cfeee2', font: '800 16px ui-monospace, monospace', cursor: 'pointer',
          }}>⬡</button>
          {skillsOpen && (
            <div style={{ width: 168, background: 'rgba(11,21,19,0.96)', border: '1px solid #2f5c4f', borderRadius: 11, padding: 10 }}>
              <div style={{ font: '800 10px ui-monospace, monospace', color: '#8fd9c4', letterSpacing: '0.12em', marginBottom: 8, textAlign: 'center' }}>SKILLS</div>
              {(['forestry', 'prospecting', 'rinning', 'farming', 'alchemy'] as const).map(id => {
                const sk = skillsRef.current[id]
                const next = xpForSkillLevel(sk.level)
                return (
                  <div key={id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ font: '700 10px ui-monospace, monospace', color: '#cfeee2' }}>{SKILL_META[id].name}</span>
                      <span style={{ font: '800 11px ui-monospace, monospace', color: '#eafff6' }}>Lv {sk.level}</span>
                    </div>
                    <div style={{ height: 4, background: '#0008', borderRadius: 3, overflow: 'hidden', marginTop: 3, border: '1px solid #0006' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.round((sk.xp / Math.max(1, next)) * 100))}%`, background: 'linear-gradient(90deg,#4fc79a,#eafff6)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* dialogue box — tap/click anywhere on it (or A / E) to advance; last line closes */}
      {dialogue && (
        <div
          onPointerDown={(e) => { e.stopPropagation(); advanceDialogue() }}
          style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45, display: 'flex', justifyContent: 'center', padding: '0 16px 20px' }}
        >
          <div style={{ width: 'min(680px, 94vw)', background: 'rgba(12,10,24,0.95)', border: '1px solid #d4a84366', borderRadius: 12, padding: '14px 18px', cursor: 'pointer' }}>
            <div style={{ color: '#ffd98a', font: '800 13px ui-monospace, monospace', marginBottom: 6, letterSpacing: '0.04em' }}>{dialogue.speakers?.[dialogue.idx] ?? dialogue.name}</div>
            <div style={{ color: '#ece3d0', font: '600 15px/1.55 ui-monospace, monospace' }}>{dialogue.lines[dialogue.idx]}</div>
            <div style={{ color: '#ffffff5e', font: '600 11px ui-monospace, monospace', marginTop: 9, textAlign: 'right' }}>
              {dialogue.idx >= dialogue.lines.length - 1 ? 'tap to close' : 'tap to continue ▸'}
            </div>
          </div>
        </div>
      )}

      {/* Birth Rune gate — opened by New Game; choose a rune, then reset into a fresh run carrying it */}
      {birthOpen && (
        <BirthScreen
          onChoose={(id) => {
            setBirthOpen(false)
            birthRuneRef.current = id  // BirthScreen also stashes it in localStorage (ather:shimmer:birthRune)
            newGame()                  // fresh run — sets its own banner; we override below
            const rn = RUNES.find(r => r.id === id)?.name ?? 'your rune'
            setBanner(`Born of ${rn} — find Gregory in the glade`)
          }}
          onCancel={birthCancelable ? () => setBirthOpen(false) : undefined}
        />
      )}

      {/* milestone toast (evolution-ready, new game) */}
      {banner && (
        <div style={{
          position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
          padding: '8px 16px', borderRadius: 999, background: 'rgba(20,16,40,0.92)', border: '1px solid #d4a84366',
          color: '#ffe9b0', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{banner}</div>
      )}


      {editMode && (
        <div style={{ position: 'fixed', top: 70, left: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <select
            value={zoneId}
            onChange={(e) => selectZone(e.target.value)}
            style={{
              padding: '6px 8px', borderRadius: 6, border: '1px solid #ffffff33', background: '#16142a',
              color: '#e9dfc8', font: '700 13px ui-monospace, monospace', cursor: 'pointer', pointerEvents: 'auto', maxWidth: 260,
            }}
          >
            {ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}{z.id !== z.name ? ` (${z.id})` : ''}</option>)}
          </select>
          <span style={{ color: '#e9dfc8', opacity: 0.55, font: '600 11px ui-monospace, monospace' }}>jump to a map · save before switching</span>
        </div>
      )}

      {editMode && (
        <div style={{ position: 'fixed', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 480 }}>
            {TOOLS.map((t) => <Btn key={t.id} active={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</Btn>)}
          </div>
          {/* resource-node blocks — click places, shift-click erases (single node per tile) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', maxWidth: 480 }}>
            <span style={{ color: '#8fd9c4', font: '700 11px ui-monospace, monospace', letterSpacing: '0.06em' }}>NODES</span>
            {NODE_TOOLS.map((t) => <Btn key={t.id} active={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</Btn>)}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#e9dfc8', font: '700 13px ui-monospace, monospace' }}>brush {brush * 2 + 1}×{brush * 2 + 1}</span>
            <Btn onClick={() => setBrush((b) => Math.max(0, b - 1))}>−</Btn>
            <Btn onClick={() => setBrush((b) => Math.min(5, b + 1))}>+</Btn>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#e9dfc8', font: '700 13px ui-monospace, monospace' }}>size {dims}</span>
            <Btn onClick={() => resize(-2, 0)}>W−</Btn>
            <Btn onClick={() => resize(2, 0)}>W+</Btn>
            <Btn onClick={() => resize(0, -2)}>H−</Btn>
            <Btn onClick={() => resize(0, 2)}>H+</Btn>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn onClick={clearZone}>Clear to empty</Btn>
            <button onClick={save} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#d4a843', color: '#1a1a2e', font: '800 13px ui-monospace, monospace', cursor: 'pointer' }}>Save zone</button>
          </div>
          {/* DEV: drop straight into the in-world Keeper's Arena (bypasses party/zone/RNG gates) */}
          <button onClick={() => { setEditMode(false); forceFight() }} style={{ padding: '6px 16px', borderRadius: 6, border: '2px solid #7fe3c8', background: '#12181a', color: '#7fe3c8', font: '800 13px ui-monospace, monospace', cursor: 'pointer' }}>⚔ Force Fight (arena)</button>
          {saveMsg && <span style={{ color: '#e9dfc8', font: '600 12px ui-monospace, monospace' }}>{saveMsg}</span>}
        </div>
      )}

      {/* edit-mode Done button (enter is top-right; touch controls are hidden while editing) */}
      {editMode && isOwner && (
        <button onClick={() => setEditMode(false)} style={{
          position: 'fixed', bottom: 12, right: 12, padding: '8px 16px', borderRadius: 8, border: 'none',
          background: '#b9483f', color: '#1a1a2e', font: '800 14px ui-monospace, monospace', cursor: 'pointer',
        }}>Done editing</button>
      )}

      {/* First-person reticle — the aim point for left-click interact / right-click use. Lights up and
          names the action when an interactable sits under it (proximity-driven, reusing the near* state
          that already drives the bottom prompts). Desktop only; touch drives interaction via the A/B pad. */}
      {!isTouch && !editMode && !battle && !approach && !rewards && !dialogue && !openMenu && !placing && (() => {
        const t = fish ? { c: fish.bite ? '#ff6a5a' : '#5aa9e6', verb: fish.bite ? 'Strike!' : 'Fishing' }
          : channel ? { c: '#5aa9e6', verb: 'Gathering' }
          : nearNpc ? { c: '#e8c86a', verb: `Talk to ${nearNpc.name}` }
          : nearNode ? { c: '#7fd9a0', verb: 'Harvest' }
          : nearStation ? { c: STATIONS[nearStation.itemId]?.accent ?? '#7fe3c8', verb: STATIONS[nearStation.itemId]?.verb ?? 'Use' }
          : null
        const on = !!t, c = t?.c ?? '#dffaf0'
        return (
          <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 30, pointerEvents: 'none' }}>
            <div style={{ position: 'relative', width: on ? 26 : 13, height: on ? 26 : 13, transition: 'width 0.12s ease-out, height 0.12s ease-out' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${c}`, opacity: on ? 0.95 : 0.32, boxShadow: on ? `0 0 9px ${c}88` : 'none', transition: 'opacity 0.12s' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 3, height: 3, borderRadius: '50%', background: c, opacity: on ? 1 : 0.55, transform: 'translate(-50%,-50%)' }} />
            </div>
            {on && t && (
              <div style={{ position: 'absolute', left: '50%', top: 'calc(100% + 9px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                background: 'rgba(11,21,19,0.9)', border: `1px solid ${c}66`, borderRadius: 7, padding: '3px 10px',
                font: '800 11px ui-monospace, monospace', color: '#eafff6' }}>
                {t.verb} <span style={{ opacity: 0.5 }}>· click</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* Hotbar HUD — bag + 6 quick-slots + tool gauges + mana vial. Only while walking the world. */}
      {/* click-catcher — while the satchel is open, swallow canvas clicks (so a stray click can't re-lock
          the pointer under the panel) and let clicking outside the bag close it. Below the hotbar (z35)
          + satchel (z37), above the canvas. */}
      {bagOpen && <div onPointerDown={() => toggleBag(false)} style={{ position: 'fixed', inset: 0, zIndex: 34, background: 'transparent' }} />}

      {/* ── Weapon viewmodel + firing-range HUD — outside the Ather only, desktop (click = fire) ── */}
      {weaponDrawn && !editMode && !dialogue && !battle && !placing && !isTouch && (
        <>
          <div style={{
            position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 35, pointerEvents: 'none',
            padding: '6px 14px', borderRadius: 999, background: 'rgba(16,20,32,0.85)', border: '1px solid #8fe0ff44',
            font: '800 12px ui-monospace, monospace', color: '#cfeeff', letterSpacing: '0.08em', display: 'flex', gap: 13, alignItems: 'center',
          }}>
            <span>FIRING RANGE</span><span style={{ opacity: 0.4 }}>·</span>
            <span>shots <span style={{ color: '#8fe0ff' }}>{hudStats.shots}</span></span>
            <span>hits <span style={{ color: '#7fffa0' }}>{hudStats.hits}</span></span>
            <span style={{ opacity: 0.5, fontWeight: 600 }}>click to fire</span>
          </div>
          {/* caster viewmodel — outer div raises it to the sighted pose on ADS (React, transitioned);
              inner casterRef keeps the imperative recoil kick, so the two transforms don't fight. */}
          <div style={{ position: 'fixed', right: '17%', bottom: 0, zIndex: 33, pointerEvents: 'none',
            transform: ads ? 'translate(-150px, -30px) scale(1.14)' : 'translate(0,0) scale(1)', transition: 'transform 0.14s ease-out' }}>
            <div ref={casterRef}>
              <style>{`@keyframes casterKick { 0% { transform: translateY(16px) } 60% { transform: translateY(-3px) } 100% { transform: translateY(0) } }`}</style>
              <svg width="240" height="168" viewBox="0 0 240 168" style={{ display: 'block' }}>
                <polygon points="46,168 66,92 158,122 138,168" fill="#161d2a" stroke="#3a4a63" strokeWidth="2" />
                <polygon points="58,98 100,70 126,96 104,122" fill="#212b3d" stroke="#4a5d7d" strokeWidth="2" />
                <circle cx="94" cy="96" r="17" fill="none" stroke="#8fe0ff" strokeOpacity="0.35" strokeWidth="2" />
                <circle cx="94" cy="96" r="10" fill="#8fe0ff" />
                <rect x="100" y="90" width="52" height="6" rx="3" fill="#8fe0ff" opacity="0.9" />
              </svg>
            </div>
          </div>
        </>
      )}

      {!battle && !approach && !rewards && !editMode && !dialogue && !placing && <HotBar items={invSlots} bagOpen={bagOpen} onBagChange={toggleBag} onUse={useItem} onReorder={reorderSlots} onSelect={(i) => { selSlotRef.current = i }} usable={USE_HINTS}
        tools={(void toolTick, (['forestry', 'prospecting', 'rinning'] as const).map(skill => {
          const t = equippedToolsRef.current[skill]
          const def = t ? TOOL_DEFS[t.toolId] : null
          const infinite = !!def?.basic
          return { id: skill, label: def?.name ?? TOOL_HUD[skill].label, glyph: TOOL_HUD[skill].glyph, tint: TOOL_HUD[skill].tint, infinite, dur: def && !infinite ? t!.usesRemaining / def.durability : 1 }
        }))} />}

      {/* ── Mobile controls: joystick (move) bottom-left · A interact / B cancel bottom-right ── */}
      {isTouch && !battle && !editMode && !placing && (
        <>
          <TouchJoystick joyRef={joyRef} bottom={96} />
          <div style={{ position: 'fixed', bottom: 96, right: 30, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {/* B — cancel/back (upper, smaller). Backs out of the New Game prompt / dismisses a toast. */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); if (confirmNew) setConfirmNew(false); else if (banner) setBanner(null) }}
              aria-label="cancel"
              style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid #ffffff33', background: 'rgba(70,44,52,0.72)', color: '#f3dada', font: '800 19px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}
            >✕</button>
            {/* A — interact/confirm (lower, bigger, where the thumb rests): advance dialogue / talk to an NPC / confirm New Game. */}
            <button
              onPointerDown={(e) => { e.stopPropagation(); if (dialogue) advanceDialogue(); else if (nearNpc) talk(nearNpc); else if (fish || nearNode || channel) toggleChannel(); else if (nearStation) openStation(); else if (confirmNew) { setConfirmNew(false); setBirthCancelable(true); setBirthOpen(true) } }}
              aria-label="interact"
              style={{ width: 76, height: 76, borderRadius: '50%', border: '2px solid #ffffff4d', background: fish ? (fish.bite ? 'rgba(55,230,255,0.92)' : 'rgba(58,123,213,0.9)') : nearNpc || dialogue ? 'rgba(212,168,67,0.85)' : channel ? 'rgba(58,123,213,0.9)' : nearNode ? 'rgba(79,199,154,0.85)' : nearStation && !nearNpc && !dialogue ? `${STATIONS[nearStation.itemId].accent}d9` : 'rgba(36,84,72,0.8)', color: fish || nearNpc || dialogue || nearNode || channel || nearStation ? '#0d1a17' : '#dffaf0', font: '800 23px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}
            >{fish ? (fish.bite ? '❗' : '🎣') : channel ? '⏹' : nearNode && !nearNpc && !dialogue ? '🪓' : nearStation && !nearNpc && !dialogue ? STATIONS[nearStation.itemId].emoji : '✦'}</button>
          </div>
          {/* Jump (edge) + Slide (held) — left of the A/B column. Only meaningful in first-person play. */}
          <div style={{ position: 'fixed', bottom: 96, right: 118, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <button
              onPointerDown={(e) => { e.stopPropagation(); slideRef.current = true }}
              onPointerUp={(e) => { e.stopPropagation(); slideRef.current = false }}
              onPointerCancel={() => { slideRef.current = false }}
              aria-label="crouch / slide"
              style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid #7fe3c855', background: 'rgba(20,46,54,0.72)', color: '#bfeee2', font: '800 20px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}
            >⇊</button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); jumpRef.current = true }}
              aria-label="jump"
              style={{ width: 68, height: 68, borderRadius: '50%', border: '2px solid #ffffff4d', background: 'rgba(36,84,72,0.8)', color: '#dffaf0', font: '800 24px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}
            >⤒</button>
          </div>
        </>
      )}

      {/* B hotkey (keyboard) — owner only, and not while a battle overlay is up */}
      <KeyToggle onB={() => { if (isOwner && !battleRef.current) setEditMode((e) => !e) }} />

      {/* Combat, mounted over the 3D world. ALL fights — wild and the scripted liberation holds
          (thistle/sorrel/brack) — run the real-time Keeper's Arena. The collar breaks on the win
          (freed-vs-forced was ruled non-canon 2026-07-04: win = free). */}
      {/* wild-encounter approach beat — the mist stirs and a spirit is drawn to you, then the ring
          materializes. Tap to skip straight into the fight. */}
      {approach && !battle && (
        <EncounterApproach name={approach.enc.name} element={approach.enc.element} onSkip={commitApproach} />
      )}

      {/* post-win spoils reveal — the payoff: gold + per-spirit XP/level breakdown. Unfreezes on close. */}
      {rewards && !battle && (
        <BattleRewards gold={rewards.gold} rows={rewards.rows} onClose={() => { setRewards(null); battleRef.current = false }} />
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
        getChest={getChest} transferChestSlot={transferChestSlot}
        tradeSell={tradeSell} tradeBuy={tradeBuy}
        harvestAt={harvestAt} plantAt={plantAt}
      />

      {battle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0a0a12' }}>
          {/* All fights — wild AND the scripted liberation holds — run the Keeper's Arena now.
              (The old turn-based PartyBattleScene + reach/captive mechanic was retired when the
              freed-vs-forced beat was ruled non-canon: win = free, the collar breaks on the win.) */}
          <ArenaBattle
            allies={battle.allies}
            enemies={battle.enemies}
            onEnd={(o) => endBattle(o === 'win' ? 'win' : 'lose')}
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
  const col = ELEMENT_COLORS[element] ?? '#7fe3c8'
  return (
    <div onPointerDown={onSkip} style={{
      position: 'fixed', inset: 0, zIndex: 50, background: '#05070a', overflow: 'hidden', cursor: 'pointer',
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
        <div style={{ font: '700 12px ui-monospace, monospace', color: '#dfeee9', letterSpacing: '0.28em', opacity: 0.7, marginBottom: 8 }}>✦ THE MIST STIRS</div>
        <div style={{ font: '900 30px ui-monospace, monospace', color: col, letterSpacing: '0.04em', textShadow: `0 0 22px ${col}88, 0 2px 6px #000` }}>{name}</div>
        <div style={{ font: '600 14px ui-monospace, monospace', color: '#c9d6d1', marginTop: 8, opacity: 0.85 }}>is drawn to you…</div>
      </div>
      {/* end flash — snaps into the arena */}
      <div style={{ position: 'absolute', inset: 0, background: '#eafff6', pointerEvents: 'none', animation: 'encFlash 1.3s ease-in forwards' }} />
    </div>
  )
}

// Post-win spoils reveal — the loop's payoff. Gold + a per-spirit row: level (with a Lv↑ jump when
// they leveled), XP gained, and an animated bar filling toward the next level. Tap CONTINUE to return.
function BattleRewards({ gold, rows, onClose }: {
  gold: number
  rows: { name: string; element: Element; fromLevel: number; toLevel: number; xpGained: number; curXp: number; needXp: number; evolved: boolean }[]
  onClose: () => void
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), 70); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#05070ae8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none', animation: 'rwdFade 0.25s ease-out' }}>
      <style>{`@keyframes rwdFade { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div style={{ width: 'min(430px, 94vw)', maxHeight: '88vh', overflowY: 'auto', background: '#0d1614', border: '2px solid #2f5c4f', borderRadius: 16, padding: '20px 20px 16px', boxShadow: '0 12px 48px #000a' }}>
        <div style={{ textAlign: 'center', font: '900 20px ui-monospace, monospace', color: '#7fe3c8', letterSpacing: '0.14em', textShadow: '0 0 18px #7fe3c855' }}>SPOILS</div>
        {gold > 0 && (
          <div style={{ textAlign: 'center', font: '700 13px ui-monospace, monospace', color: '#ffd98a', marginTop: 6, letterSpacing: '0.06em' }}>+{gold} ✦ marks</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {rows.map((r, i) => {
            const pct = Math.min(100, Math.round((r.curXp / Math.max(1, r.needXp)) * 100))
            const leveled = r.toLevel > r.fromLevel
            const col = ELEMENT_COLORS[r.element] ?? '#7fe3c8'
            return (
              <div key={i} style={{ background: '#12201d', border: `1px solid ${leveled ? col : '#ffffff18'}`, borderRadius: 10, padding: '9px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: col, flexShrink: 0, boxShadow: `0 0 8px ${col}99` }} />
                    <span style={{ font: '700 13px ui-monospace, monospace', color: '#eafff6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ font: '700 11px ui-monospace, monospace', color: '#8fd9c4' }}>+{r.xpGained} XP</span>
                    <span style={{ font: '800 12px ui-monospace, monospace', color: leveled ? col : '#c9d6d1', letterSpacing: '0.04em', textShadow: leveled ? `0 0 10px ${col}88` : 'none' }}>
                      {leveled ? `Lv ${r.fromLevel}→${r.toLevel}` : `Lv ${r.toLevel}`}
                    </span>
                  </span>
                </div>
                {/* XP bar toward next level — fills in on reveal */}
                <div style={{ height: 6, background: '#0008', borderRadius: 4, overflow: 'hidden', marginTop: 8, border: '1px solid #0006' }}>
                  <div style={{ height: '100%', width: shown ? `${pct}%` : '0%', background: `linear-gradient(90deg, ${col}, #eafff6)`, borderRadius: 4, transition: 'width 0.7s cubic-bezier(0.2,0.8,0.2,1)' }} />
                </div>
                {(leveled || r.evolved) && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                    {leveled && <span style={{ font: '800 9px ui-monospace, monospace', color: '#05070a', background: col, borderRadius: 999, padding: '2px 8px', letterSpacing: '0.08em' }}>LEVEL UP</span>}
                    {r.evolved && <span style={{ font: '800 9px ui-monospace, monospace', color: '#ffe9b0', background: '#0000', border: '1px solid #d4a843', borderRadius: 999, padding: '2px 8px', letterSpacing: '0.08em' }}>✦ READY TO EVOLVE</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button onClick={onClose} style={{ display: 'block', width: '100%', marginTop: 16, padding: '11px 0', borderRadius: 11, border: '2px solid #7fe3c8', background: '#12181a', color: '#eafff6', font: '800 14px ui-monospace, monospace', letterSpacing: '0.1em', cursor: 'pointer', touchAction: 'none' }}>CONTINUE</button>
      </div>
    </div>
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
