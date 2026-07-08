'use client'
// Phase 1 foundation: the blockout map walkable in 3D, blocky tiered terrain, and an in-3D
// BLOCKOUT TOOL — press B for edit mode, pick a tool (Raise/Lower/Wall/Water/Floor) + brush size
// from the on-screen palette, click/drag the terrain, then Save. Height tools edit the per-zone
// height grid; cell tools edit the tile grid (so you can remove water/walls). Save persists both
// (heights→/shimmer/save-heights, grid→/shimmer/save-map). Warps/collision reuse the 2D engine.
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { walkable } from '../engine/player'
import { ZONES, getZone, checkWarp, type Zone, type Warp } from '../world/zones'
import { getHeightGrid } from '../world/heightmaps'
import { rollEncounter, type WildEncounter } from '../engine/encounters'
import { createSpirit, addXP, xpForLevel, speciesDisplayName, ELEMENT_COLORS, type Spirit, type Species, type Element } from '../spirits/spirit'
import { spiritsToSave, spiritsFromSave } from '../spirits/spirit-save'
import { LAUNCHED_SPECIES } from '../engine/spirit-index'
import { ZONE_NODES, type NodePlacement } from '../world/node-placements'
import { createResourceNode, depleteNode, tickNodeRespawn, rollDrops, getNodeSkill, nodeTier, NODE_DEFS, type NodeType, type ResourceNode } from '../world/resources'
import { TOOL_DEFS, getEquippedTool, useTool, toolsToSave, toolsFromSave, ensureBasicTools, craftTool, canCraft as canCraftTool, type EquippedTools } from '../engine/tools'
import { findAdjacentNode, addHarvestItems } from '../engine/harvesting'
import { newCast as newRinCast, phaseAt as rinPhaseAt, hook as rinHook, type RinCast } from '../engine/rinning'
import { rinBite, rinCatch, rinMiss } from './rin-fx'
import { createSkillSet, skillSetToSave, skillSetFromSave, addSkillXP, xpForSkillLevel, SKILL_META, type SkillSet } from '../engine/skills'
import { createBeast, checkBeastUnlock, beastsToSave, beastsFromSave, BEAST_SPECIES, BEAST_DEFS, BEAST_PERKS, PERK_INFO, getBonusFindChance, getSpeedBonus, type ManaBeast, type BeastSpecies } from '../beasts/beast'
import { createInventory, inventoryToSave, inventoryFromSave, addItems, removeItems, countItem, transferItem, createChestStorage, chestToSave, chestFromSave, type Inventory, type ItemStack, type ChestStorage, type ChestSave } from '../engine/inventory'
import { createManaPool, manaToSave, manaFromSave, getMaxPool, type ManaPool } from '../engine/mana'
import { canBrew, brewPotion, getVisiblePotions, POTION_DEFS } from '../engine/alchemy'
import { canCraft, craftItem, getRecipes, RECIPE_DEFS } from '../engine/crafting'
import { createGEState, buyFromGE, sellToGE, tickPriceDrift, getMarketPrice, GE_ITEM_IDS, TAX_RATE, geToSave, geFromSave, type GEMarketState, type GESave } from '../engine/exchange'
import { CROP_DEFS, canPlantCrop, plantCrop, harvestCrop, getCropGrowthPhase, isCropReady, getVisibleCrops, plantedCropsToSave, plantedCropsFromSave, type PlantedCrop } from '../engine/farming'
import type { AITier } from '../engine/battle-ai'
import ArenaBattle from '../components/ArenaBattle'
import HotBar from './HotBar'
import { NPCS_3D, GREG_INTRO_LINES, GREG_NUDGE, GREG_RETURN, THISTLE_TAUNT_NO_SPIRIT, THISTLE_PREFIGHT, THISTLE_DEFEAT, FREED_SPIRIT_BEAT, SORREL_PREFIGHT, SORREL_DEFEAT, FREED_PAIR_BEAT, BRACK_PREFIGHT, BRACK_FINALE, type NPC3D } from './npcs3d'
import { useCloudSave } from '@/lib/use-cloud-save'
import { useWallet } from '@/lib/use-wallet'

const START_ZONE = 'moonwell-glade'
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
const prettyItem = (id: string) => id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
// Tap-to-transfer destination pick: a slot already holding the same item (merge target) wins,
// else the first empty slot. -1 = no room (transferChestSlot no-ops rather than dropping items).
function findEmptyOrMatch(dest: (ItemStack | null)[], item: ItemStack | null): number {
  if (!item) return -1
  const match = dest.findIndex(s => s?.itemId === item.itemId)
  if (match !== -1) return match
  return dest.findIndex(s => s === null)
}
const menuBtn: React.CSSProperties = { padding: '6px 11px', borderRadius: 7, border: '1px solid #ffffff2a', background: '#16142a', color: '#e9dfc8', font: '700 11px ui-monospace, monospace', cursor: 'pointer', whiteSpace: 'nowrap' }
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
type PlacedStruct = { itemId: string; tileX: number; tileY: number; facing: number; zoneId: string }

// Placed-station menu kinds, generalized over ALL 5 station itemIds (brew/craft/chest/exchange/farm).
// A station's `kind` drives which menu opens on interact + the prompt/tap-button look. `chest` and
// `exchange_booth` reuse the SAME itemIds as the 2D game's furniture (sprites/furniture.ts) — same
// item, same look, coherent across both walkers.
type StationKind = 'brew' | 'craft' | 'chest' | 'exchange' | 'farm'
const STATIONS: Record<string, { kind: StationKind; verb: string; emoji: string; name: string; accent: string; bg: string }> = {
  alchemy_station: { kind: 'brew',     verb: 'Brew',  emoji: '⚗', name: 'Alchemy Station', accent: '#a679ff', bg: 'rgba(17,12,24,0.92)' },
  crafting_table:  { kind: 'craft',    verb: 'Craft', emoji: '🔨', name: 'Crafting Table',  accent: '#d9b84a', bg: 'rgba(24,18,10,0.92)' },
  chest:           { kind: 'chest',    verb: 'Open',  emoji: '📦', name: 'Chest',           accent: '#c9a86a', bg: 'rgba(22,17,9,0.92)' },
  exchange_booth:  { kind: 'exchange', verb: 'Trade', emoji: '💰', name: 'Exchange Booth',  accent: '#6ad0a0', bg: 'rgba(9,22,17,0.92)' },
  farm_planter:    { kind: 'farm',     verb: 'Tend',  emoji: '🌱', name: 'Planter',         accent: '#8fd06a', bg: 'rgba(15,22,9,0.92)' },
}
// Stable per-placement instance id — used to key chest contents + planted crops to a specific
// station in the world (survives save/load since it's derived, not stored).
const stationInstanceId = (s: PlacedStruct) => `${s.zoneId}:${s.tileX},${s.tileY}`

// Exchange Booth "Buy" shelf — a curated shortlist (the full GE_ITEM_IDS is ~80 items; showing
// all of them on a phone-sized menu isn't usable). "Sell" already covers everything tradeable
// the player is holding, so this is just the early-game staples worth buying on demand.
const GE_BUY_CURATED = ['mana_draught', 'shard_tonic', 'goldwood_plank', 'goldwood_bark', 'raw_mana_shard', 'shimmeroak_plank', 'seed_shimmerwheat', 'seed_glowroot', 'seed_sunpetal']

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

function buckets(grid: number[][]) {
  const floors: Cell[] = [], walls: Cell[] = [], waters: Cell[] = [], voids: Cell[] = [], warps: Cell[] = [], mists: Cell[] = []
  const rows = grid.length, cols = grid[0].length
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
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
            {look.kind === 'tree' && <>
              {/* trunk — a lone stump when depleted (canopy harvested, regrowing) */}
              <mesh position={[0, (depleted ? 0.18 : 0.5) * s, 0]} castShadow><cylinderGeometry args={[0.13 * s, 0.17 * s, (depleted ? 0.36 : 1) * s, 7]} /><meshStandardMaterial color={look.trunk} roughness={0.9} opacity={depleted ? 0.7 : 1} transparent={depleted} /></mesh>
              {!depleted && <mesh position={[0, s + 0.35 * s, 0]} castShadow><icosahedronGeometry args={[0.62 * s, 0]} /><meshStandardMaterial color={look.canopy} emissive={look.canopy} emissiveIntensity={look.glow ?? 0} roughness={0.8} flatShading /></mesh>}
            </>}

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
function StructureMarkers({ structures, heights }: { structures: PlacedStruct[]; heights: number[][] }) {
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
}

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
  }, [cells, y])
  const h = usePaint(cells, paint, editing)
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(cells.length, 1)]} receiveShadow castShadow {...h}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  )
}

function ZoneGeometry({ gridRef, heights, version, paint, editing }: {
  gridRef: React.RefObject<number[][]>; heights: number[][]; version: number
  paint: (c: number, r: number, shift: boolean) => void; editing: boolean
}) {
  const { floors, walls, waters, voids, warps, mists } = useMemo(() => buckets(gridRef.current), [version, gridRef])
  return (
    <>
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
    </>
  )
}

// An NPC stands in the world when it hasn't been cleared (defeated) and its gate flag (if any) is set.
// Gating chains the holds: Sorrel only appears once `freedThistle` is true (he fled up here).
function npcInWorld(n: NPC3D, defeated: Record<string, boolean>, flags: Record<string, boolean>): boolean {
  if (defeated[n.id]) return false
  if (n.requiredFlag && !flags[n.requiredFlag]) return false
  return true
}

function Player({ posRef, gridRef, heightsRef, zoneIdRef, editRef, onWarp, battleRef, partyLevelRef, onEncounter, joyRef, talkingRef, hasPartyRef, onNearChange, defeatedRef, flagsRef, harvestNodesRef, onNearNode, stationsRef, onNearStation }: {
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

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true }
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false }
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  useFrame((state, dt) => {
    const k = keys.current
    const grid = gridRef.current
    const heights = heightsRef.current
    const p = posRef.current
    const curH = heights[Math.round(p.z)]?.[Math.round(p.x)] ?? 0
    const canStand = (cx: number, cz: number) => {
      if (cz < 0 || cz >= grid.length || cx < 0 || cx >= grid[0].length) return false
      if (editRef.current) return true // roam freely while editing (so you can paint anywhere)
      if (grid[cz][cx] === VOID) return false
      return walkable(grid, cx, cz) && (heights[cz]?.[cx] ?? 0) - curH <= 1
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

      if (move.lengthSq() > 0) {
        move.normalize()
        const dstep = Math.min(dt, 0.05) * 5
        const nx = p.x + move.x * dstep
        if (canStand(Math.round(nx), Math.round(p.z))) p.x = nx
        const nz = p.z + move.z * dstep
        if (canStand(Math.round(p.x), Math.round(nz))) p.z = nz
        yaw.current = Math.atan2(move.x, move.z)
      }

      const standTop = (heights[Math.round(p.z)]?.[Math.round(p.x)] ?? 0) * STEP
      p.y += (standTop - p.y) * 0.25

      const tx = Math.round(p.x), tz = Math.round(p.z)
      const tileKey = `${tx},${tz}`
      const tileChanged = tileKey !== lastTile.current
      lastTile.current = tileKey
      if (encGrace.current > 0) encGrace.current -= dt
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
            const enc = rollEncounter(zoneIdRef.current, partyLevelRef.current, false, force)
            if (enc) { encGrace.current = ENCOUNTER_GRACE; flagsRef.current.metFirstWild = true; onEncounter(enc) }
          }
        }
      }

      // Nearest interactable NPC in this zone (within ~1.7 tiles) → drive the "talk" prompt. Fires
      // onNearChange only on enter/leave so we don't churn React state every frame.
      let near: NPC3D | null = null
      let best = 1.7
      for (const n of NPCS_3D) {
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
const TOOL_HUD: Record<string, { glyph: string; tint: string; label: string }> = {
  forestry:    { glyph: '🪓', tint: '#8fd97f', label: 'Forestry' },
  prospecting: { glyph: '⛏️', tint: '#d9b56a', label: 'Prospecting' },
  rinning:     { glyph: '🎣', tint: '#6fb8d9', label: 'Rinning' },
}

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

function CameraRig({ posRef, editFocusRef, yawRef, editRef }: {
  posRef: React.RefObject<THREE.Vector3>; editFocusRef: React.RefObject<THREE.Vector3>
  yawRef: React.RefObject<number>; editRef: React.RefObject<boolean>
}) {
  const yaw = yawRef
  const pitch = useRef(0.6)
  const dist = useRef(11)
  const keys = useRef<Record<string, boolean>>({})
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    let dragging = false, lx = 0, ly = 0
    // non-edit: left-drag orbits (follow-cam). edit (spectator): right-drag looks (left = brush).
    const dn = (e: PointerEvent) => {
      const ok = editRef.current ? e.button === 2 : e.button === 0
      if (!ok) return
      // only orbit from drags that START on the 3D canvas — touches on the joystick / buttons / HUD
      // are theirs, not the camera's.
      if (!(e.target instanceof HTMLCanvasElement)) return
      dragging = true; lx = e.clientX; ly = e.clientY
    }
    const mv = (e: PointerEvent) => {
      if (!dragging) return
      yaw.current -= (e.clientX - lx) * 0.005
      pitch.current = Math.max(0.2, Math.min(1.45, pitch.current - (e.clientY - ly) * 0.004))
      lx = e.clientX; ly = e.clientY
    }
    const up = () => { dragging = false }
    const wh = (e: WheelEvent) => { dist.current = Math.max(4, Math.min(40, dist.current + e.deltaY * 0.012)) }
    const ctx = (e: Event) => { if (editRef.current) e.preventDefault() } // no menu during right-drag
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
    const s = Math.sin(pitch.current), c = Math.cos(pitch.current)
    state.camera.position.set(
      target.x + dist.current * s * Math.sin(yaw.current),
      target.y + dist.current * c,
      target.z + dist.current * s * Math.cos(yaw.current),
    )
    state.camera.lookAt(target.x, target.y + 0.4, target.z)
  })
  return null
}

function Scene(props: {
  zone: Zone; gridRef: React.RefObject<number[][]>; heights: number[][]; version: number; dims: string
  posRef: React.RefObject<THREE.Vector3>; heightsRef: React.RefObject<number[][]>; zoneIdRef: React.RefObject<string>
  editFocusRef: React.RefObject<THREE.Vector3>
  onWarp: (w: Warp) => void; yawRef: React.RefObject<number>; editRef: React.RefObject<boolean>
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
}) {
  return (
    <>
      <color attach="background" args={['#bfe3ef']} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[18, 26, 12]} intensity={1.25} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-40} shadow-camera-right={40}
        shadow-camera-top={40} shadow-camera-bottom={-40}
        shadow-camera-near={0.5} shadow-camera-far={160}
      />
      <ZoneGeometry key={`${props.zone.id}-${props.dims}`} gridRef={props.gridRef} heights={props.heights} version={props.version} paint={props.paint} editing={props.editing} />
      <NPCMarkers npcs={NPCS_3D.filter((n) => n.zone === props.zone.id && npcInWorld(n, props.defeated, props.flagsRef.current))} heights={props.heights} />
      <NodeMarkers nodes={props.nodes} heights={props.heights} editing={props.editing} channel={props.channel} />
      <StructureMarkers structures={props.structures.filter(s => s.zoneId === props.zone.id)} heights={props.heights} />
      <PlacementGhost placing={props.placing} posRef={props.posRef} heights={props.heights} gridRef={props.gridRef} placeTargetRef={props.placeTargetRef} structuresRef={props.structuresRef} zoneIdRef={props.zoneIdRef} />
      <Player posRef={props.posRef} gridRef={props.gridRef} heightsRef={props.heightsRef} zoneIdRef={props.zoneIdRef} editRef={props.editRef} onWarp={props.onWarp} battleRef={props.battleRef} partyLevelRef={props.partyLevelRef} onEncounter={props.onEncounter} joyRef={props.joyRef} talkingRef={props.talkingRef} hasPartyRef={props.hasPartyRef} onNearChange={props.onNearChange} defeatedRef={props.defeatedRef} flagsRef={props.flagsRef} harvestNodesRef={props.harvestNodesRef} onNearNode={props.onNearNode} stationsRef={props.structuresRef} onNearStation={props.onNearStation} />
      {props.companionColor && !props.editing && <Follower posRef={props.posRef} heightsRef={props.heightsRef} color={props.companionColor} />}
      {props.fishing && <FishTell posRef={props.posRef} heightsRef={props.heightsRef} bite={props.fishBite} />}
      <CameraRig posRef={props.posRef} editFocusRef={props.editFocusRef} yawRef={props.yawRef} editRef={props.editRef} />
    </>
  )
}

// Compass — a needle that points to grid-north on screen. Driven by the live camera yaw via rAF
// (no React re-render). North = world -z; the rose rotates with the camera so N tracks the map.
function Compass({ yawRef }: { yawRef: React.RefObject<number> }) {
  const rose = useRef<HTMLDivElement>(null)
  const nlabel = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let id = 0
    const tick = () => {
      const y = yawRef.current
      if (rose.current) rose.current.style.transform = `rotate(${y}rad)`
      if (nlabel.current) nlabel.current.style.transform = `translate(-50%, -50%) rotate(${-y}rad)`
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [yawRef])
  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', marginLeft: -30, width: 60, height: 60, borderRadius: '50%',
      background: 'rgba(10,8,20,0.7)', border: '1px solid #ffffff44', pointerEvents: 'none',
    }}>
      <div ref={rose} style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0,
          borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '12px solid #e8584a',
        }} />
        <div style={{
          position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0,
          borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '12px solid #cdd4e3',
        }} />
        <span ref={nlabel} style={{ position: 'absolute', top: '24%', left: '50%', color: '#ffd9d2', font: '800 11px ui-monospace, monospace' }}>N</span>
      </div>
    </div>
  )
}

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
  const [nodes, setNodes] = useState<NodePlacement[]>(() => (ZONE_NODES[zone.id] ?? []).map(n => ({ ...n })))
  const nodesRef = useRef(nodes); nodesRef.current = nodes
  useEffect(() => { setNodes((ZONE_NODES[zone.id] ?? []).map(n => ({ ...n }))) }, [zone.id])

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
    heightsRef.current = getHeightGrid(zone.id, zone.grid.length, zone.grid[0].length)
  }
  const zoneIdRef = useRef(zone.id); zoneIdRef.current = zone.id
  const posRef = useRef<THREE.Vector3 | null>(null)
  if (!posRef.current) {
    const ps = zone.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current = new THREE.Vector3(ps.tileX, 0, ps.tileY)
  }
  const camYaw = useRef(0)
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
  // Mana'mal companions — earned at skill 15 (canon two-tier @15 tier). Grant its perk in the
  // harvest loop. No overworld follower render / care loop in the walker yet (a follow-up); the
  // companion is treated as content so its perk is fully active.
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
  const persist = useCallback(async () => {
    const prev = (await load()) ?? {}
    await saveGame({
      ...prev,
      spirits: spiritsToSave(partyRef.current ?? []),
      beasts: beastsToSave(beastsRef.current),
      activeBeastId: activeBeastIdRef.current,
      tools: toolsToSave(equippedToolsRef.current),
      flags: { ...(prev.flags ?? {}), ...flagsRef.current },
      zoneId: zoneIdRef.current,
      playerTileX: Math.round(posRef.current!.x),
      playerTileY: Math.round(posRef.current!.z),
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
        if (data.zoneId && getZone(ZONES, data.zoneId)) setZoneId(data.zoneId)
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
  useEffect(() => { if (!harvestToast) return; const t = setTimeout(() => setHarvestToast(null), 2400); return () => clearTimeout(t) }, [harvestToast])
  const channelRef = useRef<{ node: ResourceNode; progress: number; durSec: number; manaCost: number } | null>(null)
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
    // Drifthorn's gathering_speed perk + the tool's speedBonus both shorten the channel.
    const speedBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current) ?? null
    const durSec = nodeChannelSec(node.type) * (toolDef?.speedBonus ?? 1) / (1 + getSpeedBonus(speedBeast))
    channelRef.current = { node, progress: 0, durSec, manaCost }
    setChannel({ nodeId: node.id, label: prettyItem(node.type), hp: 1 })
  }, [])

  // ── Build placement: double-tap a placeable → ghost on the tile in front → rotate → confirm/cancel ──
  const [placing, setPlacing] = useState<{ itemId: string; facing: number } | null>(null)
  const placingRef = useRef(placing); placingRef.current = placing
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
    setStructures(prev => [...prev, { itemId: pl.itemId, tileX: t.x, tileY: t.y, facing: pl.facing, zoneId: zoneIdRef.current }])
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
    if (!brewPotion(potionId, invRef.current, skillsRef.current, manaRef.current)) { setHarvestToast('Missing ingredients or mana'); return }
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
    const crop = plantCrop(cropId, invRef.current, skillsRef.current, manaRef.current, struct.tileX, struct.tileY, struct.zoneId)
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
    setApproach({ enc, battle: { allies: partyRef.current!, enemies: buildWildParty(enc, size), aiTier: enc.aiTier, zoneId: zoneIdRef.current, kind: 'wild' } })
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
    const enc = rollEncounter(zoneIdRef.current, partyLevelRef.current || 12)
    const enemies = enc
      ? buildWildParty(enc, allies.length)
      : (['frog', 'bat'] as const).map((sp, i) => {
          const s = createSpirit(sp, ['Blightling', 'Gnash'][i], 0, 0)
          s.level = Math.max(10, partyLevelRef.current || 12)
          return s
        })
    battleRef.current = true
    setBattle({ allies, enemies, aiTier: enc?.aiTier ?? 'wild', zoneId: zoneIdRef.current, kind: 'wild' })
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
    // fresh skilling state: reset skills/mana/inventory, seed a few starter mana potions
    skillsRef.current = createSkillSet()
    manaRef.current = createManaPool(1)
    invRef.current = createInventory()
    grantStarterKit(invRef.current)
    equippedToolsRef.current = ensureBasicTools({})  // Greg's basic blade/spike/rinstick
    flagsRef.current[STARTER_KIT_FLAG] = true // already granted; keep the load-path migration from re-seeding
    setStructures([])
    syncSkillHud()
    setHasStarter(false)
    setDefeated({})
    const z = getZone(ZONES, START_ZONE)!
    const ps = z.playerStart ?? { tileX: 1, tileY: 1 }
    posRef.current!.set(ps.tileX, posRef.current!.y, ps.tileY)
    setZoneId(START_ZONE)
    setBanner('new game — find Gregory in the glade')
    persist()
  }, [persist, syncSkillHud])

  // Gregory's gift — the player's first spirit (the kit). One RNG starter → party, flag set, saved.
  const grantStarter = useCallback(() => {
    const s = makeStarterSpirit()
    partyRef.current = [s]
    flagsRef.current.gotStarter = true
    setHasStarter(true)
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
    setBattle({ allies: partyRef.current!, enemies: [captive], aiTier: 'wild', zoneId: zoneIdRef.current, kind: 'thistle' })
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
    setBattle({ allies: partyRef.current!, enemies: [guard, mkCaptive(), mkCaptive()], aiTier: 'champion', zoneId: zoneIdRef.current, kind: 'sorrel' })
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
  const editRef = useRef(false); editRef.current = editMode

  // The walker is public; the terrain editor is owner-only. ather.games has no cloud auth, so owner
  // status comes from the httpOnly `ather_owner` cookie via /api/owner (set it at /owner?key=OWNER_KEY).
  const [isOwner, setIsOwner] = useState(false)
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

  // Desktop interact key (E / Space / Enter): advance dialogue, or talk to a nearby NPC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editMode || battle) return
      const k = e.key.toLowerCase()
      if (k !== 'e' && k !== ' ' && k !== 'enter') return
      if (dialogueRef.current) { e.preventDefault(); advanceDialogue() }
      else if (nearNpc) { e.preventDefault(); talk(nearNpc) }
      else if (fishRef.current || nearNodeRef.current || channelRef.current) { e.preventDefault(); toggleChannel() }
      else if (nearStationRef.current) { e.preventDefault(); openStation() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editMode, battle, nearNpc, advanceDialogue, talk, toggleChannel, openStation])
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
    posRef.current!.set(w.toX, posRef.current!.y, w.toY)
    if (w.direction && DIR_YAW[w.direction] !== undefined) camYaw.current = DIR_YAW[w.direction]
    setZoneId(w.toZone)
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
      const id = zone.id
      const [h, g, n] = await Promise.all([
        fetch('/shimmer/save-heights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId: id, heights: heightsRef.current }) }),
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grid: gridRef.current, mapId: id }) }),
        // node layer → node-placements.ts (same endpoint, `nodes` payload; {nodeType,x,y} shape)
        fetch('/shimmer/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes: nodesRef.current.map(nd => ({ nodeType: nd.type, x: nd.tileX, y: nd.tileY })), mapId: id }) }),
      ])
      setSaveMsg(h.ok && g.ok && n.ok ? 'saved ✓ (ping Jin to build it live)' : 'save failed')
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
      <Canvas shadows camera={{ fov: 45, position: [1, 6, 14], near: 0.1, far: 500 }} gl={{ antialias: true }}>
        <Scene
          zone={zone} gridRef={gridRef} heights={heightsRef.current} version={version} dims={dims}
          posRef={posRef as React.RefObject<THREE.Vector3>} heightsRef={heightsRef} zoneIdRef={zoneIdRef}
          editFocusRef={editFocusRef}
          onWarp={onWarp} yawRef={camYaw} editRef={editRef} paint={paint} editing={editMode}
          battleRef={battleRef} partyLevelRef={partyLevelRef} onEncounter={onEncounter} joyRef={joyRef}
          talkingRef={talkingRef} hasPartyRef={hasPartyRef} onNearChange={setNearNpc}
          harvestNodesRef={runtimeNodesRef} onNearNode={setNearNode} channel={channel}
          structures={structures} placing={placing} placeTargetRef={placeTargetRef} structuresRef={structuresRef} onNearStation={setNearStation}
          defeatedRef={defeatedRef} defeated={defeated} flagsRef={flagsRef}
          nodes={runtimeNodes}
          companionColor={(() => { const b = beastsRef.current.find(x => x.id === activeBeastIdRef.current); void companionTick; return b ? (BEAST_COLOR[b.species] ?? '#9fd9c4') : null })()}
          fishing={!!fish} fishBite={!!fish?.bite}
        />
      </Canvas>

      <div style={{
        position: 'fixed', top: 12, left: 12, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(10,8,20,0.66)', color: '#e9dfc8', font: '600 13px ui-monospace, monospace', lineHeight: 1.5,
      }}>
        Shimmer 3D — {zone.name}{editMode ? '  ·  EDIT' : ''}<br />
        <span style={{ opacity: 0.8 }}>
          {editMode ? 'left-drag paint · WASD fly · Q/E down·up · right-drag look · scroll zoom' : `WASD · drag look · scroll zoom · edges warp · ${hasStarter ? 'mist = wild spirits' : 'meet Gregory first'}${isOwner ? ' · B to edit' : ''}`}
        </span>
        {!editMode && <><br /><span style={{ color: '#ffe08a' }}>✦ {wallet.marks} marks</span></>}
      </div>

      <Compass yawRef={camYaw} />

      {/* quest objective nudge — advances with the full hold chain (Greg → Thistle → Sorrel → Brack).
          Goes quiet once Hold 3 clears — the liberation arc is done. */}
      {!dialogue && !nearNpc && !battle && !editMode && (!hasStarter || !defeated.thistle || !defeated.sorrel || !defeated.brack) && (
        <div style={{
          position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 35,
          padding: '7px 15px', borderRadius: 999, background: 'rgba(16,14,32,0.88)', border: '1px solid #d4a84355',
          color: '#ffe9b0', font: '700 13px ui-monospace, monospace', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{!hasStarter ? '✦ Find Gregory — follow the glow in the glade' : !defeated.thistle ? '✦ Spirit Meadows — free the spirit Thistle holds' : !defeated.sorrel ? '✦ Mana Springs — climb to the spirits Sorrel holds' : '✦ Mana Springs — climb to the top hold, where Brack waits'}</div>
      )}

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
                  <button onClick={() => { setConfirmNew(false); setMenuOpen(false); newGame() }} style={{ ...menuBtn, background: '#b9483f', color: '#fff' }}>Yes</button>
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

      {/* Hotbar HUD — bag + 6 quick-slots + tool gauges + mana vial. Only while walking the world. */}
      {!battle && !approach && !rewards && !editMode && !dialogue && !placing && <HotBar items={invSlots} onUse={useItem} onReorder={reorderSlots} usable={USE_HINTS}
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
              onPointerDown={(e) => { e.stopPropagation(); if (dialogue) advanceDialogue(); else if (nearNpc) talk(nearNpc); else if (fish || nearNode || channel) toggleChannel(); else if (nearStation) openStation(); else if (confirmNew) { setConfirmNew(false); newGame() } }}
              aria-label="interact"
              style={{ width: 76, height: 76, borderRadius: '50%', border: '2px solid #ffffff4d', background: fish ? (fish.bite ? 'rgba(55,230,255,0.92)' : 'rgba(58,123,213,0.9)') : nearNpc || dialogue ? 'rgba(212,168,67,0.85)' : channel ? 'rgba(58,123,213,0.9)' : nearNode ? 'rgba(79,199,154,0.85)' : nearStation && !nearNpc && !dialogue ? `${STATIONS[nearStation.itemId].accent}d9` : 'rgba(36,84,72,0.8)', color: fish || nearNpc || dialogue || nearNode || channel || nearStation ? '#0d1a17' : '#dffaf0', font: '800 23px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}
            >{fish ? (fish.bite ? '❗' : '🎣') : channel ? '⏹' : nearNode && !nearNpc && !dialogue ? '🪓' : nearStation && !nearNpc && !dialogue ? STATIONS[nearStation.itemId].emoji : '✦'}</button>
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

      {/* ALCHEMY STATION brew menu */}
      {openMenu?.kind === 'brew' && (() => {
        const alch = skillsRef.current.alchemy.level
        const potions = getVisiblePotions(alch)
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 47, background: '#05070ae8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none' }}>
            <div style={{ width: 'min(440px, 95vw)', maxHeight: '86vh', overflowY: 'auto', background: '#130f1c', border: '2px solid #5a3f74', borderRadius: 16, padding: '18px 18px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ font: '900 16px ui-monospace, monospace', color: '#c88ae6', letterSpacing: '0.1em' }}>⚗ ALCHEMY STATION</span>
                <button onClick={closeStation} style={{ ...menuBtn, padding: '4px 10px' }}>✕</button>
              </div>
              <div style={{ font: '600 10px ui-monospace, monospace', color: '#9b86b8', marginBottom: 12 }}>Alchemy Lv {alch}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {potions.map(def => {
                  const locked = alch < def.minAlchemyLevel
                  const ok = !locked && canBrew(def.id, invRef.current, alch, manaRef.current)
                  return (
                    <div key={def.id} style={{ background: '#1c1730', border: '1px solid #ffffff14', borderRadius: 10, padding: '9px 11px', opacity: locked ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ font: '800 13px ui-monospace, monospace', color: '#eadcff' }}>{def.name}</span>
                        <span style={{ font: '700 10px ui-monospace, monospace', color: '#9b86b8' }}>{locked ? `Lv ${def.minAlchemyLevel}` : `${def.manaCost}◈ · +${def.xpGrant}xp`}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                        {def.recipe.map(r => {
                          const have = countItem(invRef.current, r.itemId)
                          const short = have < r.count
                          return <span key={r.itemId} style={{ font: '700 10px ui-monospace, monospace', color: short ? '#ff8a7a' : '#9fd9c4', background: '#0007', border: `1px solid ${short ? '#ff5a4d55' : '#2f5c4f'}`, borderRadius: 6, padding: '2px 7px' }}>{prettyItem(r.itemId)} {have}/{r.count}</span>
                        })}
                        <span style={{ flex: 1 }} />
                        <button onClick={() => brew(def.id)} disabled={!ok} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: ok ? '#7a4fc0' : '#2a2540', color: ok ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ok ? 'pointer' : 'default', touchAction: 'none' }}>Brew{def.resultCount > 1 ? ` ×${def.resultCount}` : ''}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* CRAFTING TABLE menu — skill-less: gated by materials + mana only */}
      {openMenu?.kind === 'craft' && (() => {
        const recipes = getRecipes()
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 47, background: '#05070ae8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none' }}>
            <div style={{ width: 'min(440px, 95vw)', maxHeight: '86vh', overflowY: 'auto', background: '#171205', border: '2px solid #6b5220', borderRadius: 16, padding: '18px 18px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ font: '900 16px ui-monospace, monospace', color: '#e0b64e', letterSpacing: '0.1em' }}>🔨 CRAFTING TABLE</span>
                <button onClick={closeStation} style={{ ...menuBtn, padding: '4px 10px' }}>✕</button>
              </div>
              <div style={{ font: '600 10px ui-monospace, monospace', color: '#b09660', marginBottom: 12 }}>Build stations from gathered materials</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {recipes.map(def => {
                  const ok = canCraft(def.id, invRef.current, manaRef.current)
                  return (
                    <div key={def.id} style={{ background: '#241b09', border: '1px solid #ffffff14', borderRadius: 10, padding: '9px 11px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ font: '800 13px ui-monospace, monospace', color: '#f0e2c4' }}>{def.name}</span>
                        <span style={{ font: '700 10px ui-monospace, monospace', color: '#b09660' }}>{def.manaCost}◈</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                        {def.recipe.map(r => {
                          const have = countItem(invRef.current, r.itemId)
                          const short = have < r.count
                          return <span key={r.itemId} style={{ font: '700 10px ui-monospace, monospace', color: short ? '#ff8a7a' : '#d9c78a', background: '#0007', border: `1px solid ${short ? '#ff5a4d55' : '#5c4f2f'}`, borderRadius: 6, padding: '2px 7px' }}>{prettyItem(r.itemId)} {have}/{r.count}</span>
                        })}
                        <span style={{ flex: 1 }} />
                        <button onClick={() => craft(def.id)} disabled={!ok} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: ok ? '#b0862a' : '#3a3018', color: ok ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ok ? 'pointer' : 'default', touchAction: 'none' }}>Craft{def.resultCount > 1 ? ` ×${def.resultCount}` : ''}</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* TOOLS — the tiered blades / spikes / rinsticks. Better than Greg's free basics
                  (faster + more XP + no under-tooled mana penalty at their tier) but they wear out
                  and break, dropping you back to the basic. Crafting one equips it for its skill. */}
              {(() => {
                void toolTick // re-render after a craft/break changes the equipped set
                const craftable = (['forestry', 'prospecting', 'rinning'] as const).flatMap(skill =>
                  Object.values(TOOL_DEFS).filter(t => t.skillId === skill && !t.basic).sort((a, b) => a.tier - b.tier))
                return <>
                  <div style={{ font: '800 11px ui-monospace, monospace', color: '#e0b64e', margin: '18px 0 4px', letterSpacing: '0.08em' }}>⚒ TOOLS</div>
                  <div style={{ font: '600 10px ui-monospace, monospace', color: '#b09660', marginBottom: 10 }}>Sharper than Greg&apos;s basics — but they wear out</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {craftable.map(def => {
                      const ok = canCraftTool(def.id, invRef.current)
                      const equipped = equippedToolsRef.current[def.skillId]?.toolId === def.id
                      return (
                        <div key={def.id} style={{ background: '#241b09', border: `1px solid ${equipped ? '#7fe3c855' : '#ffffff14'}`, borderRadius: 10, padding: '9px 11px', opacity: equipped ? 0.85 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span style={{ font: '800 13px ui-monospace, monospace', color: '#f0e2c4' }}>
                              <span style={{ marginRight: 5 }}>{TOOL_HUD[def.skillId]?.glyph}</span>{def.name}
                              <span style={{ marginLeft: 6, font: '700 9px ui-monospace, monospace', color: '#0d1a17', background: TOOL_HUD[def.skillId]?.tint, borderRadius: 5, padding: '1px 5px' }}>T{def.tier}</span>
                            </span>
                            <span style={{ font: '700 10px ui-monospace, monospace', color: '#8fd9c4', whiteSpace: 'nowrap' }}>
                              +{Math.round((def.xpBonus - 1) * 100)}% XP · {def.durability} uses
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                            {def.recipe.map(r => {
                              const have = countItem(invRef.current, r.itemId)
                              const short = have < r.count
                              return <span key={r.itemId} style={{ font: '700 10px ui-monospace, monospace', color: short ? '#ff8a7a' : '#d9c78a', background: '#0007', border: `1px solid ${short ? '#ff5a4d55' : '#5c4f2f'}`, borderRadius: 6, padding: '2px 7px' }}>{prettyItem(r.itemId)} {have}/{r.count}</span>
                            })}
                            <span style={{ flex: 1 }} />
                            <button onClick={() => craftToolAction(def.id)} disabled={!ok || equipped} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: equipped ? '#2a3a2f' : ok ? '#b0862a' : '#3a3018', color: equipped ? '#7fe3c8' : ok ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ok && !equipped ? 'pointer' : 'default', touchAction: 'none' }}>{equipped ? 'Equipped' : 'Craft'}</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              })()}
              <div style={{ font: '600 9px ui-monospace, monospace', color: '#7d6a3e', marginTop: 12, textAlign: 'center' }}>Crafted stations go to your hotbar — double-tap to place them.</div>
            </div>
          </div>
        )
      })()}

      {/* CHEST menu — tap a slot to move that stack (chest ⇄ satchel); no drag needed */}
      {openMenu?.kind === 'chest' && (() => {
        const chest = getChest(openMenu.struct)
        void chestsTick // subscribe: re-render this menu after a transfer bumps the tick
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 47, background: '#05070ae8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none' }}>
            <div style={{ width: 'min(440px, 95vw)', maxHeight: '86vh', overflowY: 'auto', background: '#171205', border: '2px solid #6b5220', borderRadius: 16, padding: '18px 18px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ font: '900 16px ui-monospace, monospace', color: '#c9a86a', letterSpacing: '0.1em' }}>📦 CHEST</span>
                <button onClick={closeStation} style={{ ...menuBtn, padding: '4px 10px' }}>✕</button>
              </div>
              <div style={{ font: '600 10px ui-monospace, monospace', color: '#b09660', marginBottom: 12 }}>Tap an item to move it — chest ⇄ satchel</div>
              <div style={{ font: '800 11px ui-monospace, monospace', color: '#d9c78a', marginBottom: 6 }}>CHEST ({chest.slots.filter(Boolean).length}/{chest.slots.length})</div>
              <SlotGrid slots={chest.slots} onTap={(i) => transferChestSlot(openMenu.struct, i, false)} accent="#c9a86a" />
              <div style={{ font: '800 11px ui-monospace, monospace', color: '#d9c78a', margin: '14px 0 6px' }}>SATCHEL</div>
              <SlotGrid slots={invRef.current.slots} onTap={(i) => transferChestSlot(openMenu.struct, i, true)} accent="#7fd0e6" />
            </div>
          </div>
        )
      })()}

      {/* EXCHANGE BOOTH menu — instant buy/sell vs the single shared market (Sell = whatever's
          tradeable in your satchel; Buy = the early-game staple shortlist) */}
      {openMenu?.kind === 'exchange' && (() => {
        const sellIds = Array.from(new Set(invRef.current.slots.filter((s): s is ItemStack => !!s).map(s => s.itemId))).filter(id => GE_ITEM_IDS.includes(id))
        const buyIds = GE_BUY_CURATED.filter(id => GE_ITEM_IDS.includes(id))
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 47, background: '#05070ae8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none' }}>
            <div style={{ width: 'min(440px, 95vw)', maxHeight: '86vh', overflowY: 'auto', background: '#0b1613', border: '2px solid #2f5c4f', borderRadius: 16, padding: '18px 18px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ font: '900 16px ui-monospace, monospace', color: '#6ad0a0', letterSpacing: '0.1em' }}>💰 EXCHANGE BOOTH</span>
                <button onClick={closeStation} style={{ ...menuBtn, padding: '4px 10px' }}>✕</button>
              </div>
              <div style={{ font: '600 10px ui-monospace, monospace', color: '#8fc4ae', marginBottom: 8 }}>✦ {wallet.marks} marks · {Math.round(TAX_RATE * 100)}% tax on sales</div>
              {tradeToast && <div style={{ font: '700 11px ui-monospace, monospace', color: '#ffe08a', marginBottom: 8 }}>{tradeToast}</div>}
              <div style={{ font: '800 11px ui-monospace, monospace', color: '#8fd9c4', marginBottom: 6 }}>SELL</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                {sellIds.length === 0 && <span style={{ font: '600 11px ui-monospace, monospace', color: '#5a7a6e' }}>Nothing tradeable in your satchel.</span>}
                {sellIds.map(id => {
                  const have = countItem(invRef.current, id)
                  const price = getMarketPrice(geRef.current, id)
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#12201d', border: '1px solid #ffffff14', borderRadius: 9, padding: '7px 10px' }}>
                      <span style={{ flex: 1, font: '700 12px ui-monospace, monospace', color: '#eafff6' }}>{prettyItem(id)}</span>
                      <span style={{ font: '700 10px ui-monospace, monospace', color: '#8fd9c4' }}>{price}◆ ×{have}</span>
                      <button onClick={() => tradeSell(id, 1)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#2f8f5f', color: '#fff', font: '800 11px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}>Sell 1</button>
                      {have > 1 && <button onClick={() => tradeSell(id, have)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#1c5c3f', color: '#fff', font: '800 11px ui-monospace, monospace', cursor: 'pointer', touchAction: 'none' }}>All</button>}
                    </div>
                  )
                })}
              </div>
              <div style={{ font: '800 11px ui-monospace, monospace', color: '#8fd9c4', marginBottom: 6 }}>BUY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {buyIds.map(id => {
                  const price = getMarketPrice(geRef.current, id)
                  const afford = wallet.marks >= price
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#12201d', border: '1px solid #ffffff14', borderRadius: 9, padding: '7px 10px' }}>
                      <span style={{ flex: 1, font: '700 12px ui-monospace, monospace', color: '#eafff6' }}>{prettyItem(id)}</span>
                      <span style={{ font: '700 10px ui-monospace, monospace', color: '#8fd9c4' }}>{price}◆</span>
                      <button onClick={() => tradeBuy(id, 1)} disabled={!afford} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: afford ? '#2f8f5f' : '#1a2a24', color: afford ? '#fff' : '#ffffff55', font: '800 11px ui-monospace, monospace', cursor: afford ? 'pointer' : 'default', touchAction: 'none' }}>Buy 1</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* FARM PLANTER menu — plant a seed → watch it grow (real time) → harvest when ready.
          ONE crop per planter, keyed by tile+zone (matches the 2D game's farming save shape). */}
      {openMenu?.kind === 'farm' && (() => {
        const struct = openMenu.struct
        void cropsTick // subscribe: re-render on plant/harvest
        const crop = plantedCropsRef.current.find(c => c.tileX === struct.tileX && c.tileY === struct.tileY && c.zoneId === struct.zoneId) ?? null
        const farmLvl = skillsRef.current.farming.level
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 47, background: '#05070ae8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, touchAction: 'none' }}>
            <div style={{ width: 'min(440px, 95vw)', maxHeight: '86vh', overflowY: 'auto', background: '#0f1608', border: '2px solid #4a6b2f', borderRadius: 16, padding: '18px 18px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ font: '900 16px ui-monospace, monospace', color: '#8fd06a', letterSpacing: '0.1em' }}>🌱 PLANTER</span>
                <button onClick={closeStation} style={{ ...menuBtn, padding: '4px 10px' }}>✕</button>
              </div>
              <div style={{ font: '600 10px ui-monospace, monospace', color: '#94b073', marginBottom: 12 }}>Farming Lv {farmLvl}</div>
              {crop ? (() => {
                const def = CROP_DEFS[crop.cropId]
                const ready = isCropReady(crop)
                const phase = getCropGrowthPhase(crop)
                const phaseLabel = ['seed', 'sprout', 'growth', 'ready'][phase]
                const pct = Math.min(100, Math.round(((Date.now() - crop.plantedAt) / crop.growthDuration) * 100))
                return (
                  <div style={{ background: '#182410', border: '1px solid #ffffff14', borderRadius: 10, padding: 12 }}>
                    <div style={{ font: '800 13px ui-monospace, monospace', color: '#eafff6', marginBottom: 6 }}>{def.name}</div>
                    <div style={{ font: '700 11px ui-monospace, monospace', color: ready ? '#8fd06a' : '#c9d6bd', marginBottom: 8 }}>{ready ? 'Ready to harvest!' : `Growing — ${phaseLabel}`}</div>
                    <div style={{ height: 6, background: '#0008', borderRadius: 4, overflow: 'hidden', border: '1px solid #0006' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#4a6b2f,#8fd06a)' }} />
                    </div>
                    <button onClick={() => harvestAt(crop)} disabled={!ready} style={{ marginTop: 12, width: '100%', padding: '9px 0', borderRadius: 9, border: 'none', background: ready ? '#4a8f3f' : '#25301c', color: ready ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ready ? 'pointer' : 'default', touchAction: 'none' }}>Harvest</button>
                  </div>
                )
              })() : (() => {
                const plantable = getVisibleCrops(farmLvl).filter(def => countItem(invRef.current, def.seedItemId) > 0)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {plantable.length === 0 && <span style={{ font: '600 11px ui-monospace, monospace', color: '#5a7a4a' }}>No plantable seeds in your satchel.</span>}
                    {plantable.map(def => {
                      const ok = canPlantCrop(def.id, invRef.current, farmLvl, manaRef.current)
                      const have = countItem(invRef.current, def.seedItemId)
                      return (
                        <div key={def.id} style={{ background: '#182410', border: '1px solid #ffffff14', borderRadius: 10, padding: '9px 11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span style={{ font: '800 13px ui-monospace, monospace', color: '#eafff6' }}>{def.name}</span>
                            <span style={{ font: '700 10px ui-monospace, monospace', color: '#94b073' }}>{def.manaCost}◈ · seed ×{have}</span>
                          </div>
                          <button onClick={() => plantAt(struct, def.id)} disabled={!ok} style={{ marginTop: 8, width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', background: ok ? '#4a8f3f' : '#25301c', color: ok ? '#fff' : '#ffffff55', font: '800 12px ui-monospace, monospace', cursor: ok ? 'pointer' : 'default', touchAction: 'none' }}>Plant</button>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })()}

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
function SlotGrid({ slots, onTap, cols = 5, accent }: { slots: (ItemStack | null)[]; onTap: (idx: number) => void; cols?: number; accent: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
      {slots.map((s, i) => (
        <button key={i} onClick={() => s && onTap(i)} disabled={!s} style={{
          position: 'relative', aspectRatio: '1', minHeight: 40, borderRadius: 7,
          border: `1px solid ${s ? accent + '66' : '#ffffff14'}`, background: s ? '#1c1730' : '#00000022',
          cursor: s ? 'pointer' : 'default', touchAction: 'none', padding: 0,
        }}>
          {s && (
            <>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 8px ui-monospace, monospace', color: '#eadcff', textAlign: 'center', overflow: 'hidden', padding: 2, lineHeight: 1.1 }}>
                {prettyItem(s.itemId).split(' ').map(w => w.slice(0, 3)).join(' ')}
              </span>
              {s.count > 1 && <span style={{ position: 'absolute', right: 2, bottom: 1, font: '800 9px ui-monospace, monospace', color: '#fff', textShadow: '0 1px 2px #000' }}>{s.count}</span>}
            </>
          )}
        </button>
      ))}
    </div>
  )
}

function KeyToggle({ onB }: { onB: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'b') onB() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onB])
  return null
}
