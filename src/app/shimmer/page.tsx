'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import RoomReturn from '../_components/RoomReturn'
import { useCloudSave } from '@/lib/use-cloud-save'
import { useWallet } from '@/lib/use-wallet'
import { Renderer, TILE, WIDTH, HEIGHT } from './engine/renderer'
import { TokenRenderer } from './engine/token-renderer'
import { createGameLoop } from './engine/game-loop'
import { createInputManager } from './engine/input'
import { Player, createPlayer, updatePlayer, facingTile, setPath, clearPath, walkable, spriteDir, channelDir, isPlayOncePhase, MovementStyle } from './engine/player'
import { findPath, nearestAdjacent, nearestInRange, smoothPath } from './engine/pathfinder'
import { PLAYER_SPRITES, PLAYER_PALETTE } from './sprites/player'
import frameDurations from './data/frame-durations.json'
import { KAEL_SPRITES, KAEL_PALETTE } from './sprites/kael'
import { ALEX_SPRITES, ALEX_PALETTE } from './sprites/alex'
import { TILES, ABOVE, VEIL, VEIL_DENSE } from './world/tiles'
import { PLAYER_START } from './world/tilemap'
import { ZONES, START_ZONE, Zone, checkWarp, getZone } from './world/zones'
import { FOX_SPRITES } from './sprites/fox'
import { AXOLOTL_SPRITES } from './sprites/axolotl'
import { WATER_BEAR_SPRITES } from './sprites/water-bear'
import { TURTLE_SPRITES } from './sprites/turtle'
import { OWL_SPRITES } from './sprites/owl'
import { FROG_SPRITES } from './sprites/frog'
import { FIREFLY_SPRITES } from './sprites/firefly'
import { RABBIT_SPRITES } from './sprites/rabbit'
import { HUMMINGBIRD_SPRITES } from './sprites/hummingbird'
import { BAT_SPRITES } from './sprites/bat'
import { PALETTES, getEvolvedPalette } from './sprites/palette'
import { Spirit, Species, Temperament, Element, Variant, Infusions, createSpirit, createInfusions, addXP, hasFruitBoost, xpForLevel, formStage, FAVORITE_FRUIT, PlantedSeed, createPlantedSeed, getGrowthPhase, isReadyToHatch, ELEMENTS, ELEMENT_COLORS, SECOND_FORM_NAMES, getSecondFormName, speciesDisplayName } from './spirits/spirit'
import { AWAKENED_FORM_NAMES } from './spirits/evolution-config'
import { rollVariant } from './sprites/variants'
import { updateSpirit, petSpirit, spiritAtTile, followWithPath } from './spirits/ai'
import { ParticleSystem } from './sprites/particles'
import { SpriteAnim } from './sprites/sprite-data'
import { createRuntimeState, startDialogue, advanceDialogue, selectChoice, tickDialogue, getVisibleText, getCurrentSpeaker, consumeActions, getChoices, getChoicePrompt, getGraph, type GameContext } from './engine/dialogue-runtime'
import type { DialogueAction, ChoiceOption } from './engine/dialogue-schema'
import { loadAllDialogues } from './data/dialogues'
import { DIALOGUES } from './world/dialogue-data'
import { getNPCsForZone, npcAtTile, getBlockedTiles, NPCDef } from './world/npcs'
// MinimapPanel removed — replaced with world map globe button
import InventoryBar from './components/InventoryBar'
import InventoryGrid from './components/InventoryGrid'
import ChestPanel from './components/ChestPanel'
import ExchangePanel from './components/ExchangePanel'
import ItemIcon from './components/ItemIcon'
import { ITEMS, DEFAULT_SPIRIT_NAMES, SEED_SPECIES, SEED_IDS, CROP_SEED_IDS, GROWTH_SPRITES, CROP_GROWTH_SPRITES, CROP_SPRITES_BY_TYPE, CROP_PALETTES, ITEM_PALETTE, ITEM_ICONS, SEED_PALETTES, NODE_SPRITES, NODE_PALETTES, TOOL_SPRITES, NODE_TYPE_LABELS } from './sprites/items'
import { FURNITURE, FURNITURE_SPRITES, FURNITURE_DEFS } from './sprites/furniture'
import { drawSprite as drawSpriteToCtx } from './components/SpriteRenderers'
import { PlacedStructure, createPlacedStructure, structuresToSave, structuresFromSave, structureOccupiesTile, type StructureSave } from './engine/structures'
import HomePlotPanel from './components/HomePlotPanel'
import { createResourceNode, ResourceNode, tickAllNodeRespawns, respawnNodesBySkill, nodesToSave, mergeNodesFromSave, ResourceNodeSave, getNodeSkill, NodeType } from './world/resources'
import { DayCycleState, createDayCycle, dayCycleFromSave, tickDayCycle, getPhase, getAmbientOverlay, getDisplayTime } from './engine/day-cycle'
import { createSkillSet, SkillSet, addSkillXP, skillSetToSave, skillSetFromSave, SkillSave, SKILL_META, SKILL_IDS, xpForSkillLevel, getMilestone, SkillId } from './engine/skills'
import { createManaPool, ManaPool, regenManaTick, flushManaSpent, getMaxPool, manaToSave, manaFromSave, ManaSave } from './engine/mana'
import { findAdjacentNode, canHarvest, startChannel, tickChannel, channelProgress, completeHarvest, addHarvestItems, ChannelState } from './engine/harvesting'
import { WorldItem, spawnWorldItems, dropWorldItem, tickWorldItems, removeExpired, collectNearby, getVisualY, getDespawnAlpha } from './engine/world-items'
import { ZONE_PICKUPS, PICKUP_BAG_ICON, pickupId } from './world/static-pickups'
import { ZONE_CHESTS, lootToSlots } from './world/zone-chests'
import { Inventory, createInventory, migrateFromBag, addItems, removeItems, countItem, findItem, moveSlot, splitStack, transferItem, createChestStorage, CHEST_SLOTS, HOTBAR_START, MAX_CHESTS, inventoryToSave, inventoryFromSave, InventorySave, ChestStorage, ChestSave, chestToSave, chestFromSave, isChestItem, countChestsInInventory } from './engine/inventory'
import { EquippedTools, getEquippedTool, useTool, toolsToSave, toolsFromSave, ToolsSave } from './engine/tools'
import { getSwingProfile, getToolAngle, getToolOffset, rotatePixels } from './engine/tool-swing'
import { PlacedFurniture, createFurniture, findAdjacentFurniture, furnitureAtTile, furnitureToSave, furnitureFromSave, FurnitureSave } from './engine/furniture'
import { TOOL_DEFS, craftTool, canCraft } from './engine/tools'
import { POTION_DEFS, canBrew, brewPotion, getVisiblePotions } from './engine/alchemy'
import { CROP_DEFS, canPlantCrop, plantCrop, harvestCrop, isCropReady, getCropGrowthPhase, cropForSeed, PlantedCrop, plantedCropsToSave, plantedCropsFromSave, getVisibleCrops } from './engine/farming'
import { createGEState, buyFromGE, sellToGE, tickPriceDrift, GEMarketState, GE_CONFIGS, geToSave, geFromSave, type GESave } from './engine/exchange'
import { ZONE_NODES, GARDEN_SHOP_SLOTS } from './world/node-placements'
import { FURNITURE_PLACEMENTS } from './world/furniture-placements'
import { STRUCTURE_PLACEMENTS } from './world/structure-placements'
import type { TileGroup } from './world/structures'
import { unlockAudio, setZoneMusic, stopMusic } from './engine/music'
import { createVoice, playChar, stopSpeaking, unlockChatter, type VoiceInstance } from './engine/chatterbox'
import { getVoiceProfile } from './data/voice-profiles'
import { ManaBeast, BeastSpecies, BEAST_DEFS, BEAST_SPECIES, createBeast, checkBeastUnlock, beastsToSave, beastsFromSave, BeastSave } from './beasts/beast'
import { BEAST_SPRITES, BEAST_PALETTES } from './sprites/beasts'
import PartyBattleScene from './components/PartyBattleScene'
import EvolutionOverlay from './components/EvolutionOverlay'
import Grimoire from './components/Grimoire'
import SpiritConsole from './components/SpiritConsole'
import WorldMapOverlay from './components/WorldMapOverlay'
import type { AITier } from './engine/battle-ai'
import type { KeeperArchetype } from './engine/party-battle'
import { rollEncounter, createTrainerSpirit, type WildEncounter } from './engine/encounters'
import { MultiplayerClient, RemotePlayer } from './engine/multiplayer'
import UsernamePicker from './components/UsernamePicker'
import FriendsPanel from './components/FriendsPanel'
import { SpiritIndex, createSpiritIndex, markSeen, markStudied, indexToSave, indexFromSave, IndexSave, LAUNCHED_SPECIES } from './engine/spirit-index'
import { type QuestState, type QuestStateSave, QUEST_DEFS, tickQuestProgress, startQuest, grantQuestRewards, questToSave, questFromSave } from './engine/quests'
import QuestPanel from './components/QuestPanel'
import { useGameFeed, NotificationStack, XpFloaterLayer } from './components/GameNotifications'
import { resolveNPCDialogue } from './world/npcs'
import { type WeatherState, type WeatherType, DEFAULT_WEATHER_CONFIGS, createWeatherState, tickWeather, getWeatherAmbient } from './engine/weather'

// Dev account — exclusive content only visible to this user
const DEV_USER_ID = '784bdeb1-000c-40c4-a9b4-d1349e44e44e'

// Apply per-frame durations from editor to sprite anims
function applyDurations(sprites: Record<string, SpriteAnim>, charId: string): Record<string, SpriteAnim> {
  const charDurations = (frameDurations as Record<string, Record<string, number[]>>)[charId]
  if (!charDurations) return sprites
  const patched: Record<string, SpriteAnim> = {}
  for (const [key, anim] of Object.entries(sprites)) {
    patched[key] = charDurations[key] ? { ...anim, durations: charDurations[key] } : anim
  }
  return patched
}

// Playable characters — each has sprites + palette from editor
const PLAYABLE_CHARACTERS = [
  { id: 'alkin', name: 'Alkin', sprites: applyDurations(PLAYER_SPRITES, 'alkin'), palette: PLAYER_PALETTE, unlock: undefined as string | undefined, exclusive: undefined as string | undefined },
  { id: 'kael',  name: 'Kael',  sprites: applyDurations(KAEL_SPRITES, 'kael'),    palette: KAEL_PALETTE,   unlock: 'talked_kael', exclusive: undefined as string | undefined },
  { id: 'alex',  name: 'Alex',  sprites: applyDurations(ALEX_SPRITES, 'alex'),    palette: ALEX_PALETTE,   unlock: undefined as string | undefined, exclusive: DEV_USER_ID },
] as const

const SKILL_COLORS: Record<SkillId, string> = {
  farming: '#50a040',
  forestry: '#6b8e4e',
  prospecting: '#8060b0',
  rinning: '#4080c0',
  alchemy: '#d06040',
  mana: '#5090d0',
}

const SPRITE_MAP: Record<string, Record<string, SpriteAnim>> = {
  fox: FOX_SPRITES,
  axolotl: AXOLOTL_SPRITES,
  'water-bear': WATER_BEAR_SPRITES,
  turtle: TURTLE_SPRITES,
  owl: OWL_SPRITES,
  frog: FROG_SPRITES,
  firefly: FIREFLY_SPRITES,
  rabbit: RABBIT_SPRITES,
  hummingbird: HUMMINGBIRD_SPRITES,
  bat: BAT_SPRITES,
}

interface SpiritSave {
  species: Species
  name: string
  x: number
  y: number
  level: number
  xp: number
  seeds: number[]
  temperament: Temperament
  variant?: Variant
  element?: Element
  infusions?: Infusions
  happiness: number
  bond: number
  fruitBoostUntil: number
  inParty?: boolean
}

interface GameSave {
  spirits?: SpiritSave[]
  playerTileX?: number
  playerTileY?: number
  zoneId?: string
  bag?: Record<string, number>        // legacy format — auto-migrates to inventory
  inventory?: InventorySave           // new slot-based format
  chests?: ChestSave[]                // placed chest contents
  plantedSeeds?: PlantedSeed[]
  flags?: Record<string, boolean>
  nodes?: ResourceNodeSave[]
  skills?: SkillSave[]
  mana?: ManaSave
  dayElapsed?: number
  equippedTools?: ToolsSave
  furniture?: FurnitureSave
  beasts?: BeastSave
  activeBeastId?: string | null
  playerCharId?: string
  spiritIndex?: IndexSave
  plantedCrops?: PlantedCrop[]
  ge?: GESave
  quests?: QuestStateSave
  collectedPickups?: string[]  // IDs of one-time pickups already collected
  lootedZoneChests?: string[]  // IDs of zone chests fully looted
  zoneChestStates?: { id: string; slots: (import('./engine/inventory').ItemStack | null)[] }[]  // partially looted zone chests
  playerStructures?: StructureSave  // player-placed structures (home plot)
}

const MAX_PARTY = 4

function spiritsToSave(spirits: Spirit[]): SpiritSave[] {
  return spirits.map(s => ({
    species: s.species, name: s.name, x: s.x, y: s.y,
    level: s.level, xp: s.xp, seeds: s.seeds,
    temperament: s.temperament, variant: s.variant, element: s.element,
    infusions: s.infusions,
    happiness: s.happiness,
    bond: s.bond, fruitBoostUntil: s.fruitBoostUntil,
    inParty: s.inParty,
  }))
}

function spiritsFromSave(saves: SpiritSave[]): Spirit[] {
  return saves.map(s => ({
    ...createSpirit(s.species, s.name, 0, 0),
    x: s.x,
    y: s.y,
    level: s.level ?? 1,
    xp: s.xp ?? 0,
    seeds: s.seeds ?? Array.from({ length: 6 }, () => Math.floor(Math.random() * 32)),
    temperament: s.temperament ?? 'neutral',
    variant: s.variant ?? 'base',
    element: s.element ?? 'base',
    infusions: s.infusions ?? createInfusions(),
    happiness: s.happiness ?? 128,
    bond: s.bond ?? 0,
    fruitBoostUntil: s.fruitBoostUntil ?? 0,
    inParty: s.inParty ?? true,
  }))
}

type MenuView = 'main' | 'spirits' | 'bag' | 'shop' | 'gregory-shop' | 'settings'
type SidePanel = 'spirits' | 'bag' | 'profile' | 'skills' | 'options' | 'console' | 'crafting' | 'chest' | 'beasts' | 'alchemy' | 'exchange' | 'quests' | 'friends' | null

const BANK_SLOTS = 30

/** Renders a spirit's idle sprite on a tiny canvas at 2x scale */
function SpriteIcon({ species, variant = 'base', element = 'base', size = 32 }: { species: Species; variant?: string; element?: Element; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 32, 32)
    const sprites = SPRITE_MAP[species]
    const anim = sprites?.battle_front ?? sprites?.down_idle ?? sprites?.idle
    if (anim) {
      const palette = element !== 'base'
        ? getEvolvedPalette(species, element)
        : (PALETTES[species]?.[variant] ?? PALETTES[species]?.base ?? PALETTES.fox.base)
      drawSpriteToCtx(ctx, anim.frames[0], palette, 0, 0)
    }
  }, [species, variant, element])
  return <canvas ref={ref} style={{ imageRendering: 'pixelated' as const, width: size, height: size }} />
}

function MenuButton({ label, desc, onClick, disabled, gold }: {
  label: string; desc: string; onClick: () => void; disabled?: boolean; gold?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between group ${
        disabled ? 'opacity-40 cursor-not-allowed' :
        gold ? 'bg-[#d4a843]/12 hover:bg-[#d4a843]/20 border border-[#d4a843]/25' :
        'hover:bg-[#d4a843]/8 border border-transparent hover:border-[#d4a843]/15'
      }`}
    >
      <div>
        <span className={`font-display text-[15px] ${gold ? 'text-[#d4a843]' : 'text-text'}`}>{label}</span>
        <p className="text-[12px] text-text-faint/40 mt-0.5">{desc}</p>
      </div>
      <span className={`text-sm transition-transform group-hover:translate-x-0.5 ${gold ? 'text-[#d4a843]/60' : 'text-text-faint/20'}`}>
        &rsaquo;
      </span>
    </button>
  )
}

// Position trail for companion following
interface TrailPoint { x: number; y: number }
const TRAIL_LENGTH = 2 // how many positions behind the companion follows

// Detect touch/mobile device (coarse pointer = finger, not mouse)
// ?mobile URL param forces mobile mode for QA testing on desktop
function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const forceParam = new URLSearchParams(window.location.search).has('mobile')
    const check = () => setMobile(
      forceParam || window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
    )
    check()
    const mq = window.matchMedia('(pointer: coarse)')
    mq.addEventListener('change', check)
    return () => mq.removeEventListener('change', check)
  }, [])
  return mobile
}

/** Merge design-time furniture placements (from source file) with player save data.
 *  Design-time placements use deterministic IDs so they won't duplicate on reload. */
function mergeDesignFurniture(playerFurniture: PlacedFurniture[], lootedZoneChests?: Set<string>): PlacedFurniture[] {
  const all = [...playerFurniture]
  for (const [zoneId, placements] of Object.entries(FURNITURE_PLACEMENTS)) {
    for (const p of placements) {
      const designId = `design-${zoneId}-${p.furnitureId}-${p.tileX}-${p.tileY}`
      if (!all.some(f => f.id === designId)) {
        all.push({ id: designId, furnitureId: p.furnitureId, tileX: p.tileX, tileY: p.tileY, zoneId })
      }
    }
  }
  // Merge zone chests — skip fully looted ones
  for (const [zoneId, chests] of Object.entries(ZONE_CHESTS)) {
    for (const c of chests) {
      if (lootedZoneChests?.has(c.id)) continue
      if (!all.some(f => f.id === c.id)) {
        all.push({ id: c.id, furnitureId: c.chestType, tileX: c.tileX, tileY: c.tileY, zoneId })
      }
    }
  }
  return all
}

export default function ShimmerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isMobile = useIsMobile()
  const [started, setStarted] = useState(false)
  const [needsShimmerfile, setNeedsShimmerfile] = useState(false)
  const [playerPopup, setPlayerPopup] = useState<{ username: string; playerId: string; screenX: number; screenY: number } | null>(null)
  const shimmerfileRef = useRef<{ user_id: string; username: string; character_id: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState<MenuView>('main')
  const [sidePanel, setSidePanel] = useState<SidePanel>(null)
  // exchangeMode moved into ExchangePanel component
  const [selectedSpiritId, setSelectedSpiritId] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [shopTab, setShopTab] = useState<'buy' | 'sell'>('buy')
  const [activeBeastId, setActiveBeastId] = useState<string | null>(null)
  const activeBeastIdRef = useRef<string | null>(null)
  const [playerCharId, setPlayerCharId] = useState('alkin')
  const playerCharRef = useRef('alkin')
  const movementStylesRef = useRef<{ players: Record<string, MovementStyle>; beasts: Record<string, any> }>({ players: {}, beasts: {} })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inv, setInv] = useState<Inventory>(() => {
    const base = migrateFromBag({ sunfruit: 3, moonberry: 3, stonemelon: 3, spirit_treat: 2, seed_fox: 1 })
    // Starter stash of placeable furniture so build mode is testable before crafting is built
    addItems(base, 'crafting_table', 2)
    addItems(base, 'chest', 3)
    addItems(base, 'alchemy_table', 1)
    addItems(base, 'exchange_booth', 1)
    return base
  })
  const invRef = useRef(inv)
  const [chests, setChests] = useState<ChestStorage[]>([])
  const chestsRef = useRef(chests)
  const [openChestId, setOpenChestId] = useState<string | null>(null)
  const plantedSeedsRef = useRef<PlantedSeed[]>([])
  const [, forceUpdate] = useState(0) // trigger re-renders for XP bar + minimap
  const [playerTile, setPlayerTile] = useState({ x: PLAYER_START.tileX, y: PLAYER_START.tileY })
  // currentGrid + spiritPositions removed — were only used by MinimapPanel
  const spiritsRef = useRef<Spirit[]>([])
  const beastsRef = useRef<ManaBeast[]>([])
  const npcStatesRef = useRef<Map<string, { id: string; x: number; y: number; prevX: number; prevY: number; targetX: number | null; targetY: number | null; direction: string; waypointIdx: number; waitTimer: number }>>(new Map())
  const playerRef = useRef<Player | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const pendingTeleportRef = useRef<{ zoneId: string; tileX: number; tileY: number } | null>(null)
  const particlesRef = useRef(new ParticleSystem())
  const inputRef = useRef(createInputManager())
  const loopRef = useRef<ReturnType<typeof createGameLoop> | null>(null)
  const trailRef = useRef<TrailPoint[]>([])
  const zoneRef = useRef<Zone>(getZone(ZONES, START_ZONE)!)
  const dialogueRef = useRef(createRuntimeState())
  const lastDialogueChars = useRef(-1)
  const voiceRef = useRef<VoiceInstance | null>(null)
  const nodesRef = useRef<ResourceNode[]>([])
  const worldItemsRef = useRef<WorldItem[]>([])
  const collectedPickupsRef = useRef<Set<string>>(new Set())
  const lootedZoneChestsRef = useRef<Set<string>>(new Set())
  const zoneChestStatesRef = useRef<Map<string, (import('./engine/inventory').ItemStack | null)[]>>(new Map())
  const skillsRef = useRef<SkillSet>(createSkillSet())
  const manaRef = useRef<ManaPool>(createManaPool(1))
  const channelRef = useRef<ChannelState | null>(null)
  const clickedNodeIdRef = useRef<string | null>(null)
  const equippedToolsRef = useRef<EquippedTools>({})
  const mpClientRef = useRef<MultiplayerClient | null>(null)
  const activeBuffsRef = useRef<{ stat: string; multiplier: number; expiresAt: number }[]>([])
  const plantedCropsRef = useRef<PlantedCrop[]>([])
  const geRef = useRef<GEMarketState>(createGEState())
  const furnitureRef = useRef<PlacedFurniture[]>([])
  const structureDefsRef = useRef<TileGroup[]>([])
  const playerStructuresRef = useRef<PlacedStructure[]>([])
  const [buildMode, setBuildMode] = useState(false)
  const buildModeRef = useRef(false)
  const [isOwner, setIsOwner] = useState(false) // Alex-only: gates the in-game "Edit Map" pill
  // ather.games has no cloud auth (the DEV_USER_ID shimmerfile path can't fire here), so owner
  // status comes from the httpOnly `ather_owner` cookie via /api/owner. Set it via /owner?key=OWNER_KEY.
  useEffect(() => {
    let alive = true
    fetch('/api/owner', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { owner: false }))
      .then(d => { if (alive && d.owner) setIsOwner(true) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const [selectedBuildItem, setSelectedBuildItem] = useState<{ type: 'furniture' | 'structure'; id: string } | null>(null)
  const selectedBuildItemRef = useRef(selectedBuildItem) // mirror: handleCanvasClick has [] deps
  const [buildHoverTile, setBuildHoverTile] = useState<{ x: number; y: number } | null>(null)
  const buildHoverTileRef = useRef<{ x: number; y: number } | null>(null) // mirror for game loop (stale closure safe)
  const [selectedPlacedFurnId, setSelectedPlacedFurnId] = useState<string | null>(null)
  const [selectedPlacedStructId, setSelectedPlacedStructId] = useState<string | null>(null)
  // Camera zoom — 0.75=out, 1=normal, 1.5=in. Shown only in build mode.
  const [cameraZoom, setCameraZoom] = useState<0.75 | 1 | 1.5>(1)
  const cameraZoomRef = useRef<0.75 | 1 | 1.5>(1)
  // Two-step placement: pending tile before commit
  const [pendingPlacement, setPendingPlacement] = useState<{ tileX: number; tileY: number } | null>(null)
  const pendingPlacementRef = useRef<{ tileX: number; tileY: number } | null>(null)
  const dayCycleRef = useRef<DayCycleState>(createDayCycle())
  const weatherStatesRef = useRef<Record<string, WeatherState>>({})
  const flagsRef = useRef<Record<string, boolean>>({})
  const spiritIndexRef = useRef<SpiritIndex>(createSpiritIndex())
  const questStateRef = useRef<QuestState>({})
  const globalTickRef = useRef(0)
  const [dialogueUI, setDialogueUI] = useState<{ speaker: string; text: string; complete: boolean; choices: ChoiceOption[] | null; choicePrompt: string | null } | null>(null)
  const [manaDisplay, setManaDisplay] = useState({ current: 100, max: 100 })
  const [dayPhase, setDayPhase] = useState<{ phase: string; time: string }>({ phase: 'dawn', time: '06:00' })
  const { notifications, floaters, notify, floatXp } = useGameFeed()
  const [levelUpPulse, setLevelUpPulse] = useState<{ skillId: SkillId; ts: number } | null>(null)
  const notifyLevelUp = useCallback((skillId: SkillId, newLevel: number) => {
    const color = SKILL_COLORS[skillId]
    const skillName = SKILL_META[skillId].name
    notify('level_up', `${skillName} leveled up to ${newLevel}!`, { color })
    setLevelUpPulse({ skillId, ts: Date.now() })
    if (newLevel === 25 || newLevel === 50 || newLevel === 75 || newLevel === 99) {
      const title = getMilestone(newLevel)
      if (title) {
        setTimeout(() => {
          notify('milestone', `${skillName} — ${title}!`, { color, duration: 5000 })
        }, 800)
      }
    }
  }, [notify])
  const [battleData, setBattleData] = useState<{ allyParty: Spirit[]; enemyParty: Spirit[]; aiTier: AITier; zoneId: string; reach?: boolean; keeper?: KeeperArchetype } | null>(null)
  const battleDataRef = useRef(battleData)
  battleDataRef.current = battleData
  const inBattleRef = useRef(false) // game loop safe flag — avoids stale closure on battleData state
  const [encounterChoice, setEncounterChoice] = useState<{ encounter: WildEncounter; playerSpirit: Spirit; selected: number } | null>(null)
  const encounterChoiceRef = useRef(false) // game loop safe flag for encounter choice overlay
  const [seedChoice, setSeedChoice] = useState<{ seeds: string[]; selected: number } | null>(null)
  const [evolutionPending, setEvolutionPending] = useState<Spirit | null>(null)
  const [grimoireOpen, setGrimoireOpen] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [bagOpen, setBagOpen] = useState(false)
  const [showWorldMap, setShowWorldMap] = useState(false)
  const lastTrainerRef = useRef<string | null>(null) // NPC id that triggered the current trainer battle
  const { load, save, isSignedIn } = useCloudSave('shimmer')
  const wallet = useWallet()
  const loadedRef = useRef(false)

  // Ref for selected hotbar item (accessible in callbacks)
  const selectedItemRef = useRef<{ id: string; name: string; count: number } | null>(null)

  // Sync refs with state so game loop closure can read current values
  buildModeRef.current = buildMode
  selectedBuildItemRef.current = selectedBuildItem
  buildHoverTileRef.current = buildHoverTile
  cameraZoomRef.current = cameraZoom
  pendingPlacementRef.current = pendingPlacement
  activeBeastIdRef.current = activeBeastId
  playerCharRef.current = playerCharId
  // Apply movement style when character changes
  if (playerRef.current) {
    const charStyle = movementStylesRef.current.players[playerCharId]
    if (charStyle) playerRef.current.movementStyle = charStyle
  }
  invRef.current = inv
  chestsRef.current = chests

  // Create default resource nodes from zone placement data
  const initDefaultNodes = useCallback((): ResourceNode[] => {
    const nodes: ResourceNode[] = []
    for (const [zoneId, placements] of Object.entries(ZONE_NODES)) {
      for (const p of placements) {
        nodes.push(createResourceNode(p.type, p.tileX, p.tileY, zoneId))
      }
    }
    return nodes
  }, [])

  /** Spawn uncollected static pickups for a zone into worldItemsRef */
  const spawnZonePickups = useCallback((zoneId: string) => {
    const pickups = ZONE_PICKUPS[zoneId] ?? []
    for (const p of pickups) {
      if (collectedPickupsRef.current.has(p.id)) continue
      worldItemsRef.current.push({
        id: p.id,
        itemId: p.itemId,
        count: p.count,
        x: p.tileX * TILE + 8,
        y: p.tileY * TILE + 8,
        vx: 0,
        vy: 0,
        groundY: p.tileY * TILE + 8,
        life: 0,
        settled: true,
        bobPhase: Math.random() * Math.PI * 2,
        pickupDelay: 0,
        slide: false,
        isStatic: true,
      })
    }
  }, [])

  // ?zone= debug override — force a zone + its spawn (F2P scale-test maps)
  const applyZoneOverride = useCallback((charId: string) => {
    const zoneParam = new URLSearchParams(window.location.search).get('zone')
    if (!zoneParam) return
    const z = getZone(ZONES, zoneParam)
    if (!z) return
    zoneRef.current = z
    const ps = z.playerStart ?? PLAYER_START
    playerRef.current = createPlayer(ps.tileX, ps.tileY, movementStylesRef.current.players[charId])
    setPlayerTile({ x: ps.tileX, y: ps.tileY })
  }, [])

  const startGame = useCallback(async () => {
    // Load editor-configured movement styles
    try {
      const stylesRes = await fetch('/shimmer/save-movement-style')
      if (stylesRes.ok) movementStylesRef.current = await stylesRes.json()
    } catch { /* use defaults */ }

    // Check shimmerfile for signed-in users
    if (isSignedIn && !shimmerfileRef.current) {
      try {
        const res = await fetch('/api/shimmerfile')
        const data = await res.json()
        if (data.shimmerfile) {
          shimmerfileRef.current = data.shimmerfile
          if (data.shimmerfile.user_id === DEV_USER_ID) setIsOwner(true)
          // Apply character choice from shimmerfile
          if (data.shimmerfile.character_id) {
            setPlayerCharId(data.shimmerfile.character_id)
          }
        } else {
          // No shimmerfile — show username picker
          setNeedsShimmerfile(true)
          return
        }
      } catch {
        // Network error — allow offline play
      }
    }

    // Try loading from cloud first
    if (isSignedIn && !loadedRef.current) {
      loadedRef.current = true
      const data: GameSave | null = await load()
      if (data) {
        if (data.spirits?.length) spiritsRef.current = spiritsFromSave(data.spirits)
        // Restore zone
        if (data.zoneId) {
          const savedZone = getZone(ZONES, data.zoneId)
          if (savedZone) zoneRef.current = savedZone
        }
        const charId = data.playerCharId ?? 'alkin'
        playerRef.current = createPlayer(
          data.playerTileX ?? PLAYER_START.tileX,
          data.playerTileY ?? PLAYER_START.tileY,
          movementStylesRef.current.players[charId],
        )
        // Restore beasts
        const playerPos = { x: (data.playerTileX ?? PLAYER_START.tileX) * TILE, y: (data.playerTileY ?? PLAYER_START.tileY) * TILE }
        beastsRef.current = beastsFromSave(data.beasts, playerPos.x, playerPos.y, movementStylesRef.current.beasts)
        setActiveBeastId(data.activeBeastId ?? beastsRef.current[0]?.id ?? null)
        if (data.playerCharId) setPlayerCharId(data.playerCharId)
        // Load inventory — migrate from old bag format if needed
        if (data.inventory) {
          setInv(inventoryFromSave(data.inventory))
        } else if (data.bag) {
          setInv(migrateFromBag(data.bag))
        }
        if (data.chests) {
          setChests(data.chests.map(c => chestFromSave(c)))
        }
        if (data.plantedSeeds) plantedSeedsRef.current = data.plantedSeeds
        // Restore skilling state
        nodesRef.current = data.nodes?.length ? mergeNodesFromSave(initDefaultNodes(), data.nodes) : initDefaultNodes()
        skillsRef.current = data.skills?.length ? skillSetFromSave(data.skills) : createSkillSet()
        const manaLevel = skillsRef.current.mana.level
        manaRef.current = data.mana ? manaFromSave(data.mana, manaLevel) : createManaPool(manaLevel)
        setManaDisplay({ current: Math.floor(manaRef.current.current), max: getMaxPool(manaLevel) })
        dayCycleRef.current = data.dayElapsed != null ? dayCycleFromSave(data.dayElapsed) : createDayCycle()
        // Initialize weather for all zones (fresh each session — weather is transient)
        const ws: Record<string, WeatherState> = {}
        for (const [zoneId, config] of Object.entries(DEFAULT_WEATHER_CONFIGS)) ws[zoneId] = createWeatherState(config)
        weatherStatesRef.current = ws
        equippedToolsRef.current = toolsFromSave(data.equippedTools)
        if (data.lootedZoneChests) lootedZoneChestsRef.current = new Set(data.lootedZoneChests)
        if (data.zoneChestStates) {
          zoneChestStatesRef.current = new Map(data.zoneChestStates.map(s => [s.id, s.slots]))
        }
        furnitureRef.current = mergeDesignFurniture(furnitureFromSave(data.furniture), lootedZoneChestsRef.current)
        playerStructuresRef.current = structuresFromSave(data.playerStructures)
        // Load structure definitions for overlay rendering
        fetch('/shimmer/save-structure').then(r => r.json()).then(d => {
          structureDefsRef.current = d.structures || []
        }).catch(() => {})
        if (data.plantedCrops) plantedCropsRef.current = plantedCropsFromSave(data.plantedCrops)
        if (data.ge) geRef.current = geFromSave(data.ge)
        if (data.flags) flagsRef.current = data.flags
        // Dev account exclusive content
        if (shimmerfileRef.current?.user_id === DEV_USER_ID) { flagsRef.current['admin_beast'] = true; setIsOwner(true) }
        if (data.collectedPickups) collectedPickupsRef.current = new Set(data.collectedPickups)
        if (data.spiritIndex) spiritIndexRef.current = indexFromSave(data.spiritIndex)
        if (data.quests) questStateRef.current = questFromSave(data.quests)
        applyZoneOverride(playerCharId)
        spawnZonePickups(zoneRef.current.id)
        setStarted(true)
        return
      }
    }
    // New player — start directly (no starter picker, beasts unlock through gameplay)
    playerRef.current = createPlayer(PLAYER_START.tileX, PLAYER_START.tileY, movementStylesRef.current.players[playerCharId])
    nodesRef.current = initDefaultNodes()
    skillsRef.current = createSkillSet()
    manaRef.current = createManaPool(1)
    dayCycleRef.current = createDayCycle()
    // Initialize weather for all zones
    const ws: Record<string, WeatherState> = {}
    for (const [zoneId, config] of Object.entries(DEFAULT_WEATHER_CONFIGS)) ws[zoneId] = createWeatherState(config)
    weatherStatesRef.current = ws
    beastsRef.current = []
    setActiveBeastId(null)
    furnitureRef.current = mergeDesignFurniture([])
    playerStructuresRef.current = []
    // Load structure definitions for overlay rendering
    fetch('/shimmer/save-structure').then(r => r.json()).then(d => {
      structureDefsRef.current = d.structures || []
    }).catch(() => {})
    // Dev account exclusive content
    if (shimmerfileRef.current?.user_id === DEV_USER_ID) { flagsRef.current['admin_beast'] = true; setIsOwner(true) }
    applyZoneOverride(playerCharId)
    spawnZonePickups(zoneRef.current.id)
    setStarted(true)
  }, [isSignedIn, load, initDefaultNodes, spawnZonePickups, applyZoneOverride])

  // Toggle menu with ESC
  const toggleMenu = useCallback(() => {
    setMenuOpen(prev => {
      const next = !prev
      if (next) {
        loopRef.current?.pause()
        setMenuView('main')
        setSaveStatus('idle')
      } else {
        loopRef.current?.resume()
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!started) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !battleData && !encounterChoice && !grimoireOpen) toggleMenu()
      // Grimoire toggle (T key) — only after receiving the grimoire from Gregory
      if ((e.key === 't' || e.key === 'T') && !battleData && !encounterChoice && flagsRef.current['spiritTabletReceived']) {
        e.preventDefault()
        setGrimoireOpen(prev => !prev)
      }
      // Spirit Console toggle (C key)
      if ((e.key === 'c' || e.key === 'C') && !battleData && !encounterChoice && !grimoireOpen) {
        e.preventDefault()
        setConsoleOpen(prev => !prev)
      }
      // Bag toggle (B key)
      if ((e.key === 'b' || e.key === 'B') && !battleData && !encounterChoice) {
        e.preventDefault()
        setBagOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, toggleMenu, battleData, encounterChoice, grimoireOpen])

  // ── Party-combat helpers (the overworld now fields your bonded party, not one spirit) ──

  const PARTY_SPECIES: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'bat', 'rabbit', 'turtle', 'firefly', 'hummingbird', 'water-bear']

  // Build an enemy party from a lead spirit + auto-genned members scaled to it (kind sets the count).
  const buildEnemyParty = useCallback((lead: Spirit, count: number): Spirit[] => {
    const out = [lead]
    for (let i = 1; i < count; i++) {
      const sp = PARTY_SPECIES[Math.floor(Math.random() * PARTY_SPECIES.length)]
      const e = createSpirit(sp, `Wild ${sp.charAt(0).toUpperCase() + sp.slice(1)}`, 0, 0)
      e.level = Math.max(1, lead.level + Math.floor(Math.random() * 5) - 2)
      e.element = lead.element !== 'base' && Math.random() < 0.5 ? lead.element : (['mana', 'storm', 'earth', 'water'] as Element[])[Math.floor(Math.random() * 4)]
      e.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
      out.push(e)
    }
    return out
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Central entry: your bonded party vs an enemy party built from `enemyLead`.
  // kind sets enemy count (wild = light, trainer = matched, stronghold = +1 & harder).
  const beginBattle = useCallback((enemyLead: Spirit, aiTier: AITier, opts?: { kind?: 'wild' | 'trainer' | 'stronghold'; reach?: boolean; trainerId?: string; keeper?: KeeperArchetype }) => {
    const allies = spiritsRef.current.slice(0, MAX_PARTY)
    if (!allies.length) return
    const kind = opts?.kind ?? 'wild'
    const n = allies.length
    let enemyCount = kind === 'wild' ? Math.min(n, 2) : kind === 'stronghold' ? n + 1 : n
    if (opts?.keeper) enemyCount += 1 // a Keeper joins your side → scale the enemy so it stays a fair fight
    const enemies = buildEnemyParty(enemyLead, Math.max(1, enemyCount))
    if (opts?.trainerId) lastTrainerRef.current = opts.trainerId
    inBattleRef.current = true
    loopRef.current?.pause()
    stopMusic()
    setBattleData({ allyParty: allies, enemyParty: enemies, aiTier, zoneId: zoneRef.current.id, reach: opts?.reach, keeper: opts?.keeper })
  }, [buildEnemyParty])

  // Debug 'B' key — quick wild fight
  const startBattle = useCallback(() => {
    const mySpirit = spiritsRef.current[0]
    if (!mySpirit) return
    const pick = PARTY_SPECIES[Math.floor(Math.random() * PARTY_SPECIES.length)]
    const enemy = createSpirit(pick, `Wild ${pick.charAt(0).toUpperCase() + pick.slice(1)}`, 0, 0)
    enemy.level = Math.max(1, mySpirit.level + Math.floor(Math.random() * 5) - 2)
    enemy.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
    beginBattle(enemy, 'wild', { kind: 'wild' })
  }, [beginBattle]) // eslint-disable-line react-hooks/exhaustive-deps

  // Party battle end — distribute rewards across the bonded party, resume overworld, trainer dialogue.
  const handleBattleEnd = useCallback((outcome: 'win' | 'lose') => {
    const bd = battleDataRef.current
    inBattleRef.current = false
    setBattleData(null)
    loopRef.current?.resume()
    setZoneMusic(zoneRef.current.id)

    if (outcome === 'win' && bd) {
      // Rewards scale with the enemy party; XP is split across your party, gold/bond shared.
      const totalXp = bd.enemyParty.reduce((s, e) => s + Math.max(8, e.level * 12), 0)
      const gold = bd.enemyParty.reduce((s, e) => s + e.level * 3, 0)
      const allies = spiritsRef.current.slice(0, MAX_PARTY)
      const perXp = Math.max(1, Math.round(totalXp / Math.max(1, allies.length)))
      if (gold > 0) wallet.earn(gold)
      let evolveShown = false
      for (const spirit of allies) {
        const xpResult = addXP(spirit, perXp)
        spirit.bond = Math.min(255, spirit.bond + 4)
        spirit.happiness = Math.min(255, spirit.happiness + 3)
        // Evolution: first ally to hit a form threshold shows the overlay (others next fight).
        if (xpResult.evolved === 'second' && spirit.element === 'base' && !evolveShown) {
          evolveShown = true
          loopRef.current?.pause()
          setEvolutionPending(spirit)
        }
        if (xpResult.evolved === 'awakened' && spirit.element !== 'base') {
          const awakenedName = AWAKENED_FORM_NAMES[spirit.species]?.[spirit.element]?.alpha
          if (awakenedName) { spirit.name = awakenedName; notify('milestone', `${awakenedName} has awakened!`, { duration: 4000 }) }
        }
      }
    }

    // Trainer post-battle dialogue
    const trainerId = lastTrainerRef.current
    if (trainerId) {
      lastTrainerRef.current = null
      if (outcome === 'win' && !flagsRef.current[`${trainerId}FirstWin`]) {
        flagsRef.current[`${trainerId}FirstWin`] = true
        flagsRef.current[`defeated_${trainerId}`] = true
      }
      const dlgId = outcome === 'win' ? `${trainerId}-post-win` : `${trainerId}-post-lose`
      if (getGraph(dlgId)) startDialogue(dialogueRef.current, dlgId, buildCtx())
    }

    // Mark every enemy species seen in the Spirit Index
    if (bd) for (const e of bd.enemyParty) markSeen(spiritIndexRef.current, e.species)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Encounter choice handler — Avoid / Study / Challenge
  const handleEncounterChoice = useCallback((choice: 'avoid' | 'study' | 'challenge') => {
    const data = encounterChoice
    if (!data) return
    encounterChoiceRef.current = false
    setEncounterChoice(null)

    if (choice === 'avoid') {
      // Walk away — resume overworld
      loopRef.current?.resume()
    } else if (choice === 'study') {
      // Study the spirit — fill Spirit Index
      markStudied(spiritIndexRef.current, data.encounter.species, data.encounter.element !== 'base' ? data.encounter.element : undefined)
      loopRef.current?.resume()
      // Brief study observation dialogue
      startDialogue(dialogueRef.current, 'study-observation', buildCtx())
    } else {
      // Challenge — proceed to a party battle (your bonded party vs a wild pack)
      const enemy = createSpirit(data.encounter.species, data.encounter.name, 0, 0)
      enemy.level = data.encounter.level
      enemy.element = data.encounter.element
      enemy.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
      beginBattle(enemy, data.encounter.aiTier, { kind: 'wild' })
    }
  }, [encounterChoice, beginBattle])

  // Encounter choice keyboard nav
  useEffect(() => {
    if (!encounterChoice) return
    const CHOICES: ('avoid' | 'study' | 'challenge')[] = ['avoid', 'study', 'challenge']
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault()
        setEncounterChoice(prev => prev ? { ...prev, selected: Math.max(0, prev.selected - 1) } : null)
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault()
        setEncounterChoice(prev => prev ? { ...prev, selected: Math.min(2, prev.selected + 1) } : null)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleEncounterChoice(CHOICES[encounterChoice.selected])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleEncounterChoice('avoid')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [encounterChoice, handleEncounterChoice])

  // Seed choice keyboard nav + confirmation
  useEffect(() => {
    if (!seedChoice) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault()
        setSeedChoice(prev => prev ? { ...prev, selected: Math.max(0, prev.selected - 1) } : null)
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault()
        setSeedChoice(prev => prev ? { ...prev, selected: Math.min(2, prev.selected + 1) } : null)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        const picked = seedChoice.seeds[seedChoice.selected]
        // Add seed to inventory
        addItems(invRef.current, picked, 1)
        setInv({ ...invRef.current })
        setSeedChoice(null)
        // Start the tablet dialogue
        const ds = dialogueRef.current
        startDialogue(ds, 'gregory-tablet', buildCtx())
        loopRef.current?.resume()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seedChoice])

  // Evolution complete — apply chosen element to spirit
  const handleEvolutionComplete = useCallback((chosenElement: Exclude<Element, 'base'>) => {
    const spirit = evolutionPending
    if (spirit) {
      spirit.element = chosenElement
      // Update name to second form name
      const formName = getSecondFormName(spirit.species, chosenElement)
      if (formName) spirit.name = formName
      // Resume overworld
      loopRef.current?.resume()
    }
    setEvolutionPending(null)
  }, [evolutionPending])

  // Manual save
  const doSave = useCallback(async () => {
    if (!isSignedIn) return
    setSaveStatus('saving')
    const p = playerRef.current
    await save({
      spirits: spiritsToSave(spiritsRef.current),
      playerTileX: p?.tileX,
      playerTileY: p?.tileY,
      zoneId: zoneRef.current.id,
      activeBeastId: activeBeastIdRef.current,
      playerCharId: playerCharRef.current,
      beasts: beastsToSave(beastsRef.current),
      inventory: inventoryToSave(invRef.current),
      chests: chestsRef.current.map(c => chestToSave(c)),
      plantedSeeds: plantedSeedsRef.current,
      plantedCrops: plantedCropsToSave(plantedCropsRef.current),
      ge: geToSave(geRef.current),
      flags: flagsRef.current,
      collectedPickups: [...collectedPickupsRef.current],
      lootedZoneChests: [...lootedZoneChestsRef.current],
      zoneChestStates: [...zoneChestStatesRef.current.entries()].map(([id, slots]) => ({ id, slots })),
      spiritIndex: indexToSave(spiritIndexRef.current),
      quests: questToSave(questStateRef.current),
      nodes: nodesToSave(nodesRef.current),
      skills: skillSetToSave(skillsRef.current),
      mana: manaToSave(manaRef.current),
      dayElapsed: dayCycleRef.current.elapsed,
      equippedTools: toolsToSave(equippedToolsRef.current),
      furniture: furnitureToSave(furnitureRef.current),
      playerStructures: structuresToSave(playerStructuresRef.current),
    })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [isSignedIn, save])

  // Quit: save and return to title
  const handleQuit = useCallback(() => {
    if (isSignedIn) {
      const p = playerRef.current
      save({
        spirits: spiritsToSave(spiritsRef.current),
        playerTileX: p?.tileX, playerTileY: p?.tileY,
        zoneId: zoneRef.current.id,
        activeBeastId: activeBeastIdRef.current,
        beasts: beastsToSave(beastsRef.current),
        inventory: inventoryToSave(invRef.current),
        chests: chestsRef.current.map(c => chestToSave(c)),
        plantedSeeds: plantedSeedsRef.current,
        plantedCrops: plantedCropsToSave(plantedCropsRef.current),
        ge: geToSave(geRef.current),
        flags: flagsRef.current,
        collectedPickups: [...collectedPickupsRef.current],
        lootedZoneChests: [...lootedZoneChestsRef.current],
        zoneChestStates: [...zoneChestStatesRef.current.entries()].map(([id, slots]) => ({ id, slots })),
        spiritIndex: indexToSave(spiritIndexRef.current),
        quests: questToSave(questStateRef.current),
        nodes: nodesToSave(nodesRef.current),
        skills: skillSetToSave(skillsRef.current),
        mana: manaToSave(manaRef.current),
        dayElapsed: dayCycleRef.current.elapsed,
        equippedTools: toolsToSave(equippedToolsRef.current),
        furniture: furnitureToSave(furnitureRef.current),
        playerStructures: structuresToSave(playerStructuresRef.current),
      })
    }
    stopMusic()
    setStarted(false)
  }, [isSignedIn, save])

  // Hatch a planted seed — called when growth timer completes
  const hatchPlantedSeed = useCallback((planted: PlantedSeed) => {
    const bankCount = spiritsRef.current.filter(s => !s.inParty).length
    if (bankCount >= BANK_SLOTS) return // no room

    const newSpirit = createSpirit(planted.species, DEFAULT_SPIRIT_NAMES[planted.species] ?? planted.species, planted.tileX, planted.tileY)
    // Roll visual variant from encounter rates
    newSpirit.variant = rollVariant(planted.species) as Variant
    // Always add to storage — player manages party via Spirit Console
    newSpirit.inParty = false
    spiritsRef.current.push(newSpirit)

    // Remove from planted seeds and free the ather soil node
    plantedSeedsRef.current = plantedSeedsRef.current.filter(p => p.id !== planted.id)
    const soilNode = nodesRef.current.find(
      n => n.zoneId === planted.zoneId && n.tileX === planted.tileX && n.tileY === planted.tileY && n.type === 'ather_soil'
    )
    if (soilNode) soilNode.state = 'harvestable'

    // Sparkle burst at hatch location
    particlesRef.current.burst(planted.tileX * TILE + 8, planted.tileY * TILE + 8, 'sparkle', 16)
    const displayName = speciesDisplayName(planted.species)
    notify('level_up', `A new ${displayName} Scroll has been added to the Spirit Console!`, { duration: 3500 })
    forceUpdate(n => n + 1)
  }, [])

  // Toggle a spirit between party and storage via Spirit Console
  const handleSwapParty = useCallback((spiritId: string) => {
    const spirit = spiritsRef.current.find(s => s.id === spiritId)
    if (!spirit) return
    if (spirit.inParty) {
      // Move to storage
      spirit.inParty = false
    } else {
      // Move to party — check limit
      const partyCount = spiritsRef.current.filter(s => s.inParty).length
      if (partyCount >= MAX_PARTY) return // party full
      spirit.inParty = true
    }
    forceUpdate(n => n + 1)
  }, [])

  // Plant a seed at a specific tile (used by hotbar selection + tap)
  const plantSeedAt = useCallback((seedItemId: string, tx: number, ty: number) => {
    const itemDef = ITEMS.find(i => i.id === seedItemId)
    if (!itemDef || countItem(invRef.current, seedItemId) <= 0) return

    const currentZone = zoneRef.current
    if (itemDef.type === 'crop_seed') {
      const cropId = cropForSeed(seedItemId)
      if (cropId && canPlantCrop(cropId, invRef.current, skillsRef.current.farming.level, manaRef.current)) {
        const prevLvl = skillsRef.current.farming.level
        const crop = plantCrop(cropId, invRef.current, skillsRef.current, manaRef.current, tx, ty, currentZone.id)
        if (crop) {
          plantedCropsRef.current.push(crop)
          setInv({ ...invRef.current })
          setManaDisplay({ current: Math.floor(manaRef.current.current), max: getMaxPool(skillsRef.current.mana.level) })
          particlesRef.current.burst(tx * TILE + 8, ty * TILE + 8, 'sparkle', 6)
          floatXp(tx * TILE + 16, ty * TILE, CROP_DEFS[cropId].plantXp, SKILL_COLORS.farming)
          if (skillsRef.current.farming.level > prevLvl) {
            particlesRef.current.burst(playerRef.current!.x + 16, playerRef.current!.y - 4, 'sparkle', 16)
            notifyLevelUp('farming', skillsRef.current.farming.level)
          }
          forceUpdate(n => n + 1)
        }
      }
    } else if (itemDef.type === 'seed') {
      // Mana seed — plant in ather soil, hatches into a spirit after bloom
      const species = SEED_SPECIES[seedItemId]
      const manaCost = SKILL_META.farming.manaCost
      const soilNode = nodesRef.current.find(
        n => n.zoneId === currentZone.id && n.tileX === tx && n.tileY === ty && n.type === 'ather_soil'
      )
      if (species && soilNode && manaRef.current.current >= manaCost) {
        manaRef.current.current -= manaCost
        manaRef.current.manaSpent += manaCost
        addSkillXP(skillsRef.current.farming, 10)
        removeItems(invRef.current, seedItemId, 1)
        setInv({ ...invRef.current })
        setManaDisplay({ current: Math.floor(manaRef.current.current), max: getMaxPool(skillsRef.current.mana.level) })
        plantedSeedsRef.current.push(createPlantedSeed(species, tx, ty, currentZone.id))
        // Mark soil as occupied (shows planted sprite)
        soilNode.state = 'depleted'
        particlesRef.current.burst(tx * TILE + 8, ty * TILE + 8, 'sparkle', 6)
        floatXp(tx * TILE + 16, ty * TILE, 10, SKILL_COLORS.farming)
        forceUpdate(n => n + 1)
      }
    }
  }, [])

  // Drop one item from hotbar slot (double-tap)
  const handleDropOne = useCallback((slotIndex: number) => {
    const player = playerRef.current
    if (!player) return
    const slot = invRef.current.slots[HOTBAR_START + slotIndex]
    if (!slot) return
    removeItems(invRef.current, slot.itemId, 1)
    dropWorldItem(worldItemsRef.current, slot.itemId, 1, player.x, player.y + TILE)
    setInv({ ...invRef.current })
    forceUpdate(n => n + 1)
    if (countItem(invRef.current, slot.itemId) <= 0) setSelectedSlot(null)
  }, [])

  // Drop entire stack from hotbar slot (long-press)
  const handleDropStack = useCallback((slotIndex: number) => {
    const player = playerRef.current
    if (!player) return
    const slot = invRef.current.slots[HOTBAR_START + slotIndex]
    if (!slot) return
    removeItems(invRef.current, slot.itemId, slot.count)
    dropWorldItem(worldItemsRef.current, slot.itemId, slot.count, player.x, player.y + TILE)
    setInv({ ...invRef.current })
    setSelectedSlot(null)
    forceUpdate(n => n + 1)
  }, [])

  // Handle canvas click -> spirit interaction or click-to-move
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    unlockAudio()
    unlockChatter()
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    const player = playerRef.current
    if (!canvas || !renderer || !player) return
    // Dismiss player popup on any canvas click
    if (playerPopup) { setPlayerPopup(null); return }
    const rect = canvas.getBoundingClientRect()
    // Zoom-aware coord transform:
    //   CSS px → offscreen px (960×640): multiply by WIDTH/rect.width
    //   offscreen px → world px: divide by zoom (at zoom>1 fewer world px fill the offscreen)
    const zoom = cameraZoomRef.current
    const offX = (e.clientX - rect.left) * (WIDTH / rect.width)
    const offY = (e.clientY - rect.top) * (HEIGHT / rect.height)
    const worldX = offX / zoom + renderer.camX
    const worldY = offY / zoom + renderer.camY
    const clickTileX = Math.floor(worldX / TILE)
    const clickTileY = Math.floor(worldY / TILE)

    // Build mode — intercept all clicks in the Garden
    if (buildModeRef.current && zoneRef.current.id === 'garden') {
      const sel = selectedBuildItemRef.current
      if (sel) {
        // Two-step placement: tap sets pending ghost, confirm bar commits it.
        // Re-tapping while pending moves the ghost to the new tile.
        setPendingPlacement({ tileX: clickTileX, tileY: clickTileY })
      } else {
        // No item selected — check if clicked on a placed item to select it for removal
        const furnHere = furnitureRef.current.find(f =>
          f.tileX === clickTileX && f.tileY === clickTileY && f.zoneId === 'garden' && !f.id.startsWith('design-')
        )
        if (furnHere) {
          setSelectedPlacedFurnId(furnHere.id)
          setSelectedPlacedStructId(null)
        } else {
          const structHere = playerStructuresRef.current.find(sp => {
            if (sp.zoneId !== 'garden') return false
            const def = structureDefsRef.current.find(s => s.id === sp.structureId)
            if (!def) return false
            return clickTileX >= sp.tileX && clickTileX < sp.tileX + def.cols &&
              clickTileY >= sp.tileY && clickTileY < sp.tileY + def.rows
          })
          if (structHere) {
            setSelectedPlacedStructId(structHere.id)
            setSelectedPlacedFurnId(null)
          } else {
            setSelectedPlacedFurnId(null)
            setSelectedPlacedStructId(null)
          }
        }
      }
      return
    }

    const grid = zoneRef.current.grid
    const clickBlockedTiles = getBlockedTiles(zoneRef.current.id, flagsRef.current)
    // Add resource node positions to blocked tiles for pathfinding
    for (const node of nodesRef.current) {
      if (node.zoneId !== zoneRef.current.id) continue
      clickBlockedTiles.add(`${node.tileX},${node.tileY}`)
    }

    // Check if clicked on active beast
    let clickedBeast: ManaBeast | null = null
    const activeBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current)
    if (activeBeast && worldX >= activeBeast.x && worldX < activeBeast.x + TILE && worldY >= activeBeast.y && worldY < activeBeast.y + TILE) {
      clickedBeast = activeBeast
    }

    // Check if clicked on Spirit Console (tile 6)
    const clickedConsole = (grid[clickTileY]?.[clickTileX] & 0xFF) === 6

    if (clickedConsole) {
      // Console is adjacent — open immediately
      const dx = Math.abs(clickTileX - player.tileX)
      const dy = Math.abs(clickTileY - player.tileY)
      if (dx + dy <= 1) {
        setConsoleOpen(true)
        return
      }
      // Console is far — path to adjacent tile and auto-open on arrival
      const adj = nearestAdjacent(grid, clickTileX, clickTileY, player.tileX, player.tileY, clickBlockedTiles)
      if (adj) {
        const rawPath = findPath(grid, player.tileX, player.tileY, adj.x, adj.y, clickBlockedTiles)
        if (rawPath) {
          const path = smoothPath(grid, rawPath, player.tileX, player.tileY, clickBlockedTiles)
          setPath(player, path, { x: adj.x, y: adj.y, interactConsole: true })
        }
      }
    } else if (clickedBeast) {
      // Beast is adjacent — pet immediately
      const dx = Math.abs(clickedBeast.x / TILE - player.tileX)
      const dy = Math.abs(clickedBeast.y / TILE - player.tileY)
      if (dx + dy <= 1) {
        petSpirit(clickedBeast)
        particlesRef.current.burst(clickedBeast.x + 16, clickedBeast.y, 'heart', 4)
        return
      }
      // Beast is far — path to adjacent tile and auto-pet on arrival
      const beastTileX = Math.floor(clickedBeast.x / TILE)
      const beastTileY = Math.floor(clickedBeast.y / TILE)
      const adj = nearestAdjacent(grid, beastTileX, beastTileY, player.tileX, player.tileY, clickBlockedTiles)
      if (adj) {
        const rawPath = findPath(grid, player.tileX, player.tileY, adj.x, adj.y, clickBlockedTiles)
        if (rawPath) {
          const path = smoothPath(grid, rawPath, player.tileX, player.tileY, clickBlockedTiles)
          setPath(player, path, { x: adj.x, y: adj.y, interactSpiritId: clickedBeast.id })
        }
      }
    } else {
      // Check if clicked on a remote player — show social popup
      if (mpClientRef.current?.connected) {
        const rp = mpClientRef.current.getRemotePlayers().find(p => {
          const rpTileX = Math.floor(p.x / TILE)
          const rpTileY = Math.floor(p.y / TILE)
          return rpTileX === clickTileX && rpTileY === clickTileY
        })
        if (rp) {
          setPlayerPopup({
            username: rp.name,
            playerId: rp.playerId,
            screenX: e.clientX,
            screenY: e.clientY,
          })
          return
        }
      }

      // Check if clicked tile has an NPC — auto-interact on arrival
      const clickedNpc = npcAtTile(zoneRef.current.id, clickTileX, clickTileY, flagsRef.current)
        ?? (() => {
          const zNpcs = getNPCsForZone(zoneRef.current.id, flagsRef.current)
          for (const n of zNpcs) {
            const ps = npcStatesRef.current.get(n.id)
            if (ps && Math.round(ps.x / TILE) === clickTileX && Math.round(ps.y / TILE) === clickTileY) return n
          }
          return null
        })()
      if (clickedNpc) {
        const dx = Math.abs(clickTileX - player.tileX)
        const dy = Math.abs(clickTileY - player.tileY)
        if (dx + dy <= 1) {
          // Adjacent — interact immediately
          const ds = dialogueRef.current
          const ctx = buildCtx()
          const dlgId = resolveNPCDialogue(clickedNpc, flagsRef.current)
          flagsRef.current[`talked_${clickedNpc.id}`] = true
          startDialogue(ds, dlgId, ctx)
          return
        }
        const adj = nearestAdjacent(grid, clickTileX, clickTileY, player.tileX, player.tileY, clickBlockedTiles)
        if (adj) {
          const rawPath = findPath(grid, player.tileX, player.tileY, adj.x, adj.y, clickBlockedTiles)
          if (rawPath) {
            const path = smoothPath(grid, rawPath, player.tileX, player.tileY, clickBlockedTiles)
            setPath(player, path, { x: adj.x, y: adj.y, interactNpcId: clickedNpc.id })
          }
        }
        return
      }

      // Check if clicked tile has a resource node — auto-channel within 3 tiles
      // Skip ather_soil nodes when a seed is selected (let planting handler below take over)
      const clickedNode = nodesRef.current.find(
        n => n.zoneId === zoneRef.current.id && n.tileX === clickTileX && n.tileY === clickTileY
      )
      if (clickedNode && !(clickedNode.type === 'ather_soil' && selectedItemRef.current)) {
        const dx = Math.abs(clickTileX - player.tileX)
        const dy = Math.abs(clickTileY - player.tileY)
        if (Math.max(dx, dy) <= 3) {
          // Within range — fire interact directly, store which node was clicked
          clickedNodeIdRef.current = clickedNode.id
          inputRef.current.state.interact = true
          return
        }
        const target = nearestInRange(grid, clickTileX, clickTileY, player.tileX, player.tileY, 3, clickBlockedTiles)
        if (target) {
          const rawPath = findPath(grid, player.tileX, player.tileY, target.x, target.y, clickBlockedTiles)
          if (rawPath) {
            const path = smoothPath(grid, rawPath, player.tileX, player.tileY, clickBlockedTiles)
            setPath(player, path, { x: target.x, y: target.y, interactNodeId: clickedNode.id })
          }
        }
        return
      }

      // Check if clicked tile has a static pickup — click to collect
      const clickedPickup = worldItemsRef.current.find(
        wi => wi.isStatic && Math.floor(wi.x / TILE) === clickTileX && Math.floor(wi.y / TILE) === clickTileY
      )
      if (clickedPickup) {
        const dx = Math.abs(clickTileX - player.tileX)
        const dy = Math.abs(clickTileY - player.tileY)
        if (dx <= 1 && dy <= 1) {
          // Adjacent or standing on it — collect immediately
          const leftover = addItems(invRef.current, clickedPickup.itemId, clickedPickup.count)
          if (leftover === 0) {
            collectedPickupsRef.current.add(clickedPickup.id)
            worldItemsRef.current.splice(worldItemsRef.current.indexOf(clickedPickup), 1)
            setInv({ ...invRef.current })
            const name = ITEMS.find(i => i.id === clickedPickup.itemId)?.name ?? clickedPickup.itemId
            notify('item', `+${name}`)
          } else {
            notify('warning', 'Inventory full!')
          }
          return
        }
        // Far away — path to it and auto-collect on arrival
        const rawPath = findPath(grid, player.tileX, player.tileY, clickTileX, clickTileY, clickBlockedTiles)
        if (rawPath) {
          const path = smoothPath(grid, rawPath, player.tileX, player.tileY, clickBlockedTiles)
          setPath(player, path, { x: clickTileX, y: clickTileY, interactPickupId: clickedPickup.id })
        }
        return
      }

      // Check if clicked tile has interactive furniture (alchemy table, exchange booth, etc.)
      const clickedFurn = furnitureRef.current.find(
        f => f.tileX === clickTileX && f.tileY === clickTileY && f.zoneId === zoneRef.current.id
      )
      if (clickedFurn) {
        const furnDef = FURNITURE_DEFS[clickedFurn.furnitureId]
        if (furnDef && furnDef.interactionPanel && furnDef.interactionPanel !== 'chest') {
          const dx = Math.abs(clickTileX - player.tileX)
          const dy = Math.abs(clickTileY - player.tileY)
          if (dx <= 1 && dy <= 1) {
            // Adjacent — open panel immediately
            setSidePanel(furnDef.interactionPanel as SidePanel)
            return
          }
          // Far — path to adjacent tile and auto-open on arrival
          const adj = nearestAdjacent(grid, clickTileX, clickTileY, player.tileX, player.tileY, clickBlockedTiles)
          if (adj) {
            const rawPath = findPath(grid, player.tileX, player.tileY, adj.x, adj.y, clickBlockedTiles)
            if (rawPath) {
              const path = smoothPath(grid, rawPath, player.tileX, player.tileY, clickBlockedTiles)
              setPath(player, path, { x: adj.x, y: adj.y, interactFurniture: clickedFurn.id })
            }
          }
          return
        }
      }

      // Check if a seed is selected and clicked tile is valid for planting
      const selItem = selectedItemRef.current
      if (selItem) {
        const itemDef = ITEMS.find(i => i.id === selItem.id)
        if (itemDef && (itemDef.type === 'crop_seed' || itemDef.type === 'seed')) {
          const tileOk = walkable(grid, clickTileX, clickTileY)
          const occupied = !!npcAtTile(zoneRef.current.id, clickTileX, clickTileY, flagsRef.current)
          const seedOnTile = plantedSeedsRef.current.some(p => p.tileX === clickTileX && p.tileY === clickTileY && p.zoneId === zoneRef.current.id)
            || plantedCropsRef.current.some(p => p.tileX === clickTileX && p.tileY === clickTileY && p.zoneId === zoneRef.current.id)
          // Mana seeds require an ather_soil node on the target tile
          const needsSoil = itemDef.type === 'seed'
          const hasSoil = needsSoil ? nodesRef.current.some(
            n => n.zoneId === zoneRef.current.id && n.tileX === clickTileX && n.tileY === clickTileY && n.type === 'ather_soil' && n.state === 'harvestable'
          ) : true
          if (tileOk && !occupied && !seedOnTile && hasSoil) {
            const dx = Math.abs(clickTileX - player.tileX)
            const dy = Math.abs(clickTileY - player.tileY)
            if (dx <= 1 && dy <= 1) {
              // Adjacent — plant immediately (handled by interact system)
              plantSeedAt(selItem.id, clickTileX, clickTileY)
              return
            }
            // Far away — path there, then plant on arrival
            const rawPath = findPath(grid, player.tileX, player.tileY, clickTileX, clickTileY, clickBlockedTiles)
            if (rawPath) {
              const path = smoothPath(grid, rawPath, player.tileX, player.tileY, clickBlockedTiles)
              setPath(player, path, { x: clickTileX, y: clickTileY, interactPlant: { seedItemId: selItem.id, tileX: clickTileX, tileY: clickTileY } })
            }
            return
          }
        }
      }

      // Click on empty tile — path to it (free-pixel final positioning)
      const rawPath = findPath(grid, player.tileX, player.tileY, clickTileX, clickTileY, clickBlockedTiles)
      if (rawPath) {
        const path = smoothPath(grid, rawPath, player.tileX, player.tileY, clickBlockedTiles)
        setPath(player, path, { x: clickTileX, y: clickTileY, pixelX: worldX, pixelY: worldY })
      }
    }
  }, [])

  // Build mode hover — tracks tile under pointer for ghost preview
  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!buildModeRef.current) return
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (!canvas || !renderer) return
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) {
      if (e.touches.length === 0) return
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    // Zoom-aware: CSS px → offscreen px → world px (same as handleCanvasClick)
    const zoom = cameraZoomRef.current
    const offX = (clientX - rect.left) * (WIDTH / rect.width)
    const offY = (clientY - rect.top) * (HEIGHT / rect.height)
    const worldX = offX / zoom + renderer.camX
    const worldY = offY / zoom + renderer.camY
    const tile = { x: Math.floor(worldX / TILE), y: Math.floor(worldY / TILE) }
    setBuildHoverTile(tile)
    buildHoverTileRef.current = tile // sync immediately so game loop sees current frame
  }, [])

  // Commit the pending placement (called from the confirm bar ✓ button)
  const confirmPlacement = useCallback(() => {
    const pending = pendingPlacementRef.current
    const sel = selectedBuildItemRef.current
    if (!pending || !sel) return
    const { tileX, tileY } = pending
    const grid = zoneRef.current.grid
    if (sel.type === 'furniture') {
      // Inventory check — must own at least 1
      if (countItem(invRef.current, sel.id) < 1) {
        notify('warning', 'You don\'t have any of that item')
        return
      }
      const tileOk = walkable(grid, tileX, tileY)
      const furnOnTile = furnitureAtTile(tileX, tileY, 'garden', furnitureRef.current)
      const structOnTile = structureOccupiesTile(tileX, tileY, 'garden', playerStructuresRef.current, structureDefsRef.current)
      if (tileOk && !furnOnTile && !structOnTile) {
        // Consume 1 from inventory
        removeItems(invRef.current, sel.id, 1)
        setInv({ ...invRef.current })
        const placed = createFurniture(sel.id, tileX, tileY, 'garden')
        furnitureRef.current.push(placed)
        particlesRef.current.burst(tileX * TILE + 16, tileY * TILE + 8, 'sparkle', 5)
        forceUpdate(n => n + 1)
        setPendingPlacement(null)
        // If we're out of this item, deselect it
        if (countItem(invRef.current, sel.id) < 1) setSelectedBuildItem(null)
      } else {
        notify('warning', 'Cannot place here')
      }
    } else {
      // Structure — validate entire footprint
      const def = structureDefsRef.current.find(s => s.id === sel.id)
      if (def) {
        let valid = true
        for (let fr = 0; fr < def.rows && valid; fr++) {
          for (let fc = 0; fc < def.cols && valid; fc++) {
            const tx = tileX + fc
            const ty = tileY + fr
            if (!walkable(grid, tx, ty)) valid = false
            else if (furnitureAtTile(tx, ty, 'garden', furnitureRef.current)) valid = false
            else if (structureOccupiesTile(tx, ty, 'garden', playerStructuresRef.current, structureDefsRef.current)) valid = false
          }
        }
        if (valid) {
          const placed = createPlacedStructure(sel.id, tileX, tileY, 'garden')
          playerStructuresRef.current.push(placed)
          particlesRef.current.burst(tileX * TILE + 16, tileY * TILE + 8, 'sparkle', 5)
          forceUpdate(n => n + 1)
          setPendingPlacement(null)
          setSelectedBuildItem(null)
        } else {
          notify('warning', 'Cannot place here')
        }
      }
    }
  }, [notify])

  // Build game context for dialogue condition evaluation
  const buildCtx = useCallback((): GameContext => ({
    flags: flagsRef.current,
    countItem: (id: string) => countItem(invRef.current, id),
    getSkillLevel: (id: string) => (skillsRef.current as unknown as Record<string, { level: number }>)[id]?.level ?? 0,
    getReputation: () => 0,
    spirits: spiritsRef.current.map(s => ({ species: s.species })),
    timePhase: getPhase(dayCycleRef.current),
  }), [])

  // Process dialogue actions — handles all 9 action types from dialogue graphs
  const processDialogueActions = useCallback((actions: DialogueAction[]) => {
    for (const act of actions) {
      switch (act.type) {
        case 'setFlag':
          flagsRef.current[act.flag] = act.value
          break
        case 'giveItem':
          addItems(invRef.current, act.itemId, act.count)
          setInv({ ...invRef.current })
          break
        case 'removeItem':
          removeItems(invRef.current, act.itemId, act.count)
          setInv({ ...invRef.current })
          break
        case 'heal':
          // Spirits don't have persistent HP (battles are self-contained)
          // Show a heal message as feedback
          notify('generic', 'Your spirits feel refreshed.')
          break
        case 'openShop':
          // Open the shop panel after dialogue ends
          setTimeout(() => setSidePanel('crafting'), 100)
          break
        case 'teleport':
          // Schedule zone teleport — consumed by game loop next tick
          pendingTeleportRef.current = { zoneId: act.zoneId, tileX: act.tileX, tileY: act.tileY }
          break
        case 'startBattle': {
          // Trigger battle from dialogue (e.g. NPC challenge)
          const mySpirit = spiritsRef.current[0]
          if (mySpirit) {
            const cfg = act.config as { species?: string; name?: string; level?: number; element?: string; aiTier?: string }
            const species = (cfg.species ?? 'fox') as Species
            const enemy = createSpirit(species, cfg.name ?? `Wild ${species}`, 0, 0)
            enemy.level = cfg.level ?? Math.max(1, mySpirit.level)
            if (cfg.element) enemy.element = cfg.element as Element
            enemy.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
            const reach = (act.config as { reach?: boolean }).reach
            beginBattle(enemy, (cfg.aiTier ?? 'wild') as AITier, { kind: reach ? 'stronghold' : 'trainer', reach })
          }
          break
        }
        case 'playSound':
          // No SFX engine yet — silently skip
          break
        case 'setEmotion':
          // No NPC emotion system yet — silently skip
          break
      }
    }
  }, [])

  useEffect(() => {
    if (!started || !canvasRef.current) return

    // Register all dialogue graphs on first mount
    loadAllDialogues()

    // Token renderer (flat colour fields + glowing tokens) is the default skin —
    // pixels are retired pending the 3D pass. `?render=pixel` falls back to the
    // old pixel renderer for A/B during the transition.
    const usePixel = new URLSearchParams(window.location.search).get('render') === 'pixel'
    const renderer = usePixel
      ? new Renderer(canvasRef.current)
      : new TokenRenderer(canvasRef.current)
    rendererRef.current = renderer

    // Resize display canvas when container size changes (responsive + window resize)
    const resizeObs = new ResizeObserver(() => {
      if (canvasRef.current) renderer.resize(canvasRef.current)
    })
    resizeObs.observe(canvasRef.current)

    const zone = zoneRef.current
    setZoneMusic(zone.id)
    renderer.cacheTilemap(zone.grid, TILES)
    renderer.cacheOverlay(zone.grid, TILES, ABOVE)
    renderer.buildAnimMap(zone.grid, TILES)

    const particles = particlesRef.current
    const input = inputRef.current
    input.attach()

    const player = playerRef.current!
    const spirits = spiritsRef.current
    const trail = trailRef.current
    const uiUpdateFn = () => forceUpdate(n => n + 1)
    let xpTickCounter = 0

    // Multiplayer — connect to shimmer-server
    const sf = shimmerfileRef.current
    const playerId = sf?.username ?? `guest_${Math.random().toString(36).slice(2, 8)}`
    const charName = sf?.username ?? (PLAYABLE_CHARACTERS.find(c => c.id === playerCharRef.current) ?? PLAYABLE_CHARACTERS[0]).name
    const mpClient = new MultiplayerClient(playerId, charName, zone.id, playerCharRef.current)
    mpClientRef.current = mpClient
    // Connect to shimmer-server (only for signed-in players with a shimmerfile)
    if (sf) {
      const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
      const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3100'
      const wsUrl = `${isSecure ? 'wss' : 'ws'}://${host}/shimmer-ws/ws`
      mpClient.connect(wsUrl)
    }
    let uiSyncCounter = 0

    // --- NPC Patrol System ---
    const NPC_WALK_SPEED = 2 // pixels per tick, matches spirit wander speed

    function initNPCPatrolStates(zoneId: string) {
      const states = npcStatesRef.current
      states.clear()
      const zoneNPCs = getNPCsForZone(zoneId, flagsRef.current)
      for (const npc of zoneNPCs) {
        if (npc.patrolPath && npc.patrolPath.length > 0) {
          const startX = npc.tileX * TILE
          const startY = npc.tileY * TILE
          states.set(npc.id, {
            id: npc.id,
            x: startX, y: startY,
            prevX: startX, prevY: startY,
            targetX: null, targetY: null,
            direction: npc.direction,
            waypointIdx: 0,
            waitTimer: 30, // ~2 sec pause before starting
          })
        }
      }
    }

    function updateNPCPatrols() {
      const states = npcStatesRef.current
      const currentZone = zoneRef.current
      const zoneNPCs = getNPCsForZone(currentZone.id, flagsRef.current)

      // Freeze NPC the player is pathing to interact with (prevents race condition)
      const targetNpcId = playerRef.current?.pathTarget?.interactNpcId
      for (const npc of zoneNPCs) {
        if (!npc.patrolPath || npc.patrolPath.length === 0) continue
        const st = states.get(npc.id)
        if (!st) continue
        if (npc.id === targetNpcId) { st.prevX = st.x; st.prevY = st.y; continue }  // freeze target NPC while player approaches

        // Snapshot previous position for interpolation
        st.prevX = st.x
        st.prevY = st.y

        if (st.targetX === null || st.targetY === null) {
          // Waiting at waypoint
          if (st.waitTimer > 0) {
            st.waitTimer--
            continue
          }
          // Pick next waypoint
          const wp = npc.patrolPath[st.waypointIdx]
          st.targetX = wp.tileX * TILE
          st.targetY = wp.tileY * TILE
          // Update direction toward target
          const dx = st.targetX - st.x
          const dy = st.targetY - st.y
          if (Math.abs(dx) > Math.abs(dy)) {
            st.direction = dx > 0 ? 'right' : 'left'
          } else if (dy !== 0) {
            st.direction = dy > 0 ? 'down' : 'up'
          }
        } else {
          // Moving toward target waypoint
          const dx = st.targetX - st.x
          const dy = st.targetY - st.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist <= NPC_WALK_SPEED) {
            // Arrived
            st.x = st.targetX
            st.y = st.targetY
            st.targetX = null
            st.targetY = null
            st.waypointIdx = (st.waypointIdx + 1) % npc.patrolPath.length
            st.waitTimer = 30 + Math.floor(Math.random() * 30) // 2-4 sec pause
          } else {
            // Step toward target
            const nx = (dx / dist) * NPC_WALK_SPEED
            const ny = (dy / dist) * NPC_WALK_SPEED
            st.x += nx
            st.y += ny
            // Update direction as NPC moves
            if (Math.abs(dx) > Math.abs(dy)) {
              st.direction = dx > 0 ? 'right' : 'left'
            } else {
              st.direction = dy > 0 ? 'down' : 'up'
            }
          }
        }
      }
    }

    // Init patrol states and mobs for starting zone
    initNPCPatrolStates(zone.id)
    const loop = createGameLoop(
      // Update (15 TPS — retro logic tick)
      () => {
        globalTickRef.current++

        // Process pending dialogue teleport
        const pendingTp = pendingTeleportRef.current
        if (pendingTp) {
          pendingTeleportRef.current = null
          const nextZone = getZone(ZONES, pendingTp.zoneId)
          if (nextZone) {
            zoneRef.current = nextZone
            flagsRef.current[`visited_${nextZone.id}`] = true
            mpClient.changeZone(nextZone.id)
            setZoneMusic(nextZone.id)
            renderer.cacheTilemap(nextZone.grid, TILES)
            renderer.cacheOverlay(nextZone.grid, TILES, ABOVE)
            renderer.buildAnimMap(nextZone.grid, TILES)
            // (minimap grid update removed)
            player.x = pendingTp.tileX * TILE
            player.y = pendingTp.tileY * TILE
            player.prevX = player.x
            player.prevY = player.y
            player.tileX = pendingTp.tileX
            player.tileY = pendingTp.tileY
            player.targetX = player.x
            player.targetY = player.y
            player.moving = false
            clearPath(player)
            worldItemsRef.current.length = 0
            spawnZonePickups(nextZone.id)
            const comp = beastsRef.current.find(b => b.id === activeBeastIdRef.current)
            if (comp) { comp.x = player.x; comp.y = player.y }
            trailRef.current.length = 0
            initNPCPatrolStates(nextZone.id)
          }
        }

        const prevTileX = player.tileX
        const prevTileY = player.tileY
        const currentZone = zoneRef.current

        // Player movement (locked during dialogue, evolution, or channeling)
        const blockedTiles = getBlockedTiles(currentZone.id, flagsRef.current)
        // Add dynamic patrol NPC positions to blocked tiles
        for (const [, st] of npcStatesRef.current) {
          const dtx = Math.round(st.x / TILE)
          const dty = Math.round(st.y / TILE)
          blockedTiles.add(`${dtx},${dty}`)
        }
        // Add resource node positions to blocked tiles
        for (const node of nodesRef.current) {
          if (node.zoneId !== currentZone.id) continue
          blockedTiles.add(`${node.tileX},${node.tileY}`)
        }
        if (!dialogueRef.current.active && !channelRef.current) {
          updatePlayer(player, input.state, currentZone.grid, blockedTiles)
        }

        // Update NPC patrols (paused during dialogue to prevent NPC walking away mid-conversation)
        if (!dialogueRef.current.active) {
          updateNPCPatrols()
        }

        // Record player trail when arriving at new tile
        if (player.tileX !== prevTileX || player.tileY !== prevTileY) {
          trail.push({ x: prevTileX * TILE, y: prevTileY * TILE })
          if (trail.length > TRAIL_LENGTH + 2) trail.shift()

          // Check for zone warp
          const warp = checkWarp(ZONES, currentZone.id, player.tileX, player.tileY, flagsRef.current)
          if (warp) {
            const nextZone = getZone(ZONES, warp.toZone)
            if (nextZone) {
              zoneRef.current = nextZone
              flagsRef.current[`visited_${nextZone.id}`] = true
              mpClient.changeZone(nextZone.id)
              setZoneMusic(nextZone.id)
              renderer.cacheTilemap(nextZone.grid, TILES)
              renderer.cacheOverlay(nextZone.grid, TILES, ABOVE)
              renderer.buildAnimMap(nextZone.grid, TILES)
              // (minimap grid update removed)
              player.x = warp.toX * TILE
              player.y = warp.toY * TILE
              player.prevX = player.x
              player.prevY = player.y
              player.tileX = warp.toX
              player.tileY = warp.toY
              player.targetX = player.x
              player.targetY = player.y
              player.moving = false
              if (warp.direction) player.direction = warp.direction
              clearPath(player)
              // Clear world items on zone change (they don't persist)
              worldItemsRef.current.length = 0
              spawnZonePickups(nextZone.id)
              // Teleport active beast with player
              const comp = beastsRef.current.find(b => b.id === activeBeastIdRef.current)
              if (comp) {
                comp.x = player.x
                comp.y = player.y
              }
              trail.length = 0
              initNPCPatrolStates(nextZone.id)
              }
          } else {
            // Wild encounter roll — only on veil tiles (Ather mist zones)
            const currentTileId = currentZone.grid[player.tileY]?.[player.tileX] & 0xFF
            const mySpirit = spiritsRef.current[0]
            if (VEIL[currentTileId] && mySpirit && !inBattleRef.current && !encounterChoiceRef.current) {
              const encounter = rollEncounter(currentZone.id, mySpirit.level, VEIL_DENSE[currentTileId])
              if (encounter) {
                markSeen(spiritIndexRef.current, encounter.species)
                if (flagsRef.current['spiritTabletReceived']) {
                  // Post-tablet: show encounter choice (Avoid / Study / Challenge)
                  encounterChoiceRef.current = true
                  loopRef.current?.pause()
                  setEncounterChoice({ encounter, playerSpirit: mySpirit, selected: 2 })
                } else {
                  // Pre-tablet: auto-battle (party vs a wild pack)
                  const enemy = createSpirit(encounter.species, encounter.name, 0, 0)
                  enemy.level = encounter.level
                  enemy.element = encounter.element
                  enemy.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
                  beginBattle(enemy, encounter.aiTier, { kind: 'wild' })
                }
                return // skip rest of tick
              }
            }
          }
        }

        // Spacebar interaction: dialogue > NPC > spirit pet (blocked during evolution)
        if (input.state.interact) { unlockAudio(); unlockChatter() }
        if (input.state.interact && !player.moving) {
          const ds = dialogueRef.current
          const ctx = buildCtx()
          if (ds.active) {
            // If choices are showing, ignore space — player must click a choice button
            if (ds.choices && ds.choices.length > 0) {
              // no-op
            } else {
              advanceDialogue(ds, ctx)
            }

            // Process any pending actions from action nodes
            const actions = consumeActions(ds)
            if (actions) processDialogueActions(actions)

            if (!ds.active) {
              setDialogueUI(null)
              lastDialogueChars.current = -1
              voiceRef.current = null

              // Gregory seed choice — moglin warning ends, present 3 random seeds
              if (flagsRef.current['gregorySeedChoice'] && !flagsRef.current['_gregorySeedOffered']) {
                flagsRef.current['_gregorySeedOffered'] = true
                const pool = SEED_IDS.filter(id => id !== 'seed_fox' && LAUNCHED_SPECIES.includes(SEED_SPECIES[id]))
                const shuffled = pool.sort(() => Math.random() - 0.5)
                const picks = shuffled.slice(0, 3)
                loopRef.current?.pause()
                setSeedChoice({ seeds: picks, selected: 0 })
                return // skip rest of tick
              }

              // Check if completed dialogue was a trainer challenge
              const { tx, ty } = facingTile(player)
              let facingNpc = npcAtTile(currentZone.id, tx, ty, flagsRef.current)
              if (!facingNpc) {
                const zNpcs = getNPCsForZone(currentZone.id, flagsRef.current)
                for (const n of zNpcs) {
                  const ps = npcStatesRef.current.get(n.id)
                  if (ps && Math.round(ps.x / TILE) === tx && Math.round(ps.y / TILE) === ty) { facingNpc = n; break }
                }
              }
              if (facingNpc?.trainer && ds.graphId === facingNpc.returnDialogueId) {
                const mySpirit = spiritsRef.current[0]
                if (mySpirit) {
                  const enemyLead = createTrainerSpirit(facingNpc.trainer, mySpirit.level)
                  beginBattle(enemyLead, facingNpc.trainer.aiTier, { kind: 'trainer', trainerId: facingNpc.id })
                }
              }

              // Gregory's shop — opens after his post-tablet dialogue
              if (facingNpc?.id === 'gregory' && ds.graphId === 'gregory-post-tablet') {
                loopRef.current?.pause()
                setMenuOpen(true)
                setMenuView('gregory-shop')
              }
            }
          } else {
            const { tx, ty } = facingTile(player)
            // Check NPC first (static position, then dynamic patrol position)
            let npc = npcAtTile(currentZone.id, tx, ty, flagsRef.current)
            if (!npc) {
              // Check patrol NPCs at dynamic tile position
              const zNpcs = getNPCsForZone(currentZone.id, flagsRef.current)
              for (const n of zNpcs) {
                const ps = npcStatesRef.current.get(n.id)
                if (ps && Math.round(ps.x / TILE) === tx && Math.round(ps.y / TILE) === ty) {
                  npc = n
                  break
                }
              }
            }
            if (npc) {
              const dlgId = resolveNPCDialogue(npc, flagsRef.current)
              flagsRef.current[`talked_${npc.id}`] = true
              startDialogue(ds, dlgId, ctx)
            } else if ((currentZone.grid[ty]?.[tx] & 0xFF) === 6) {
              // Spirit Console (tile 6) — open console popup
              setConsoleOpen(true)
            } else if (channelRef.current) {
              // Cancel active channel on Space press
              channelRef.current = null
              manaRef.current.channeling = false
              player.animFrame = 0
              player.animTimer = 0
            } else {
              // Check for adjacent furniture
              const furn = findAdjacentFurniture(player.tileX, player.tileY, currentZone.id, furnitureRef.current)
              if (furn) {
                const furnDef = FURNITURE_DEFS[furn.furnitureId]
                if (furnDef) {
                  if (furnDef.chestSlots) {
                    // Ensure chest storage exists (any chest type)
                    if (!chestsRef.current.find(c => c.furnitureInstanceId === furn.id)) {
                      const newChest = createChestStorage(furn.id, furnDef.chestSlots)
                      // Zone chests: pre-fill with loot on first open
                      if (furn.id.startsWith('zonechest_')) {
                        const saved = zoneChestStatesRef.current.get(furn.id)
                        if (saved) {
                          // Restore partially-looted state
                          for (let i = 0; i < Math.min(saved.length, newChest.slots.length); i++) {
                            newChest.slots[i] = saved[i] ? { ...saved[i]! } : null
                          }
                        } else {
                          // First open — fill from zone placement loot table
                          const zcList = Object.values(ZONE_CHESTS).flat()
                          const zc = zcList.find(z => z.id === furn.id)
                          if (zc) {
                            newChest.slots = lootToSlots(zc.loot, furnDef.chestSlots)
                          }
                        }
                      }
                      chestsRef.current.push(newChest)
                      setChests([...chestsRef.current])
                    }
                    setOpenChestId(furn.id)
                  }
                  setSidePanel(furnDef.interactionPanel as SidePanel)
                }
              } else {
                // Check for adjacent ready crop (harvest on interact)
                const { tx: cropTx, ty: cropTy } = facingTile(player)
                const readyCrop = plantedCropsRef.current.find(
                  c => c.tileX === cropTx && c.tileY === cropTy && c.zoneId === currentZone.id && isCropReady(c)
                )
                if (readyCrop) {
                  const prevFarmLvl = skillsRef.current.farming.level
                  const result = harvestCrop(readyCrop, invRef.current, skillsRef.current)
                  plantedCropsRef.current = plantedCropsRef.current.filter(c => c.id !== readyCrop.id)
                  setInv({ ...invRef.current })
                  particles.burst(cropTx * TILE + 8, cropTy * TILE + 8, 'sparkle', 10)
                  if (result.xpGained > 0) floatXp(cropTx * TILE + 16, cropTy * TILE, result.xpGained, SKILL_COLORS.farming)
                  if (skillsRef.current.farming.level > prevFarmLvl) {
                    particles.burst(player.x + 16, player.y - 4, 'sparkle', 16)
                    notifyLevelUp('farming', skillsRef.current.farming.level)
                  } else if (result.items.length > 0) {
                    const names = result.items.map(i => `${ITEMS.find(d => d.id === i.itemId)?.name ?? i.itemId} x${i.count}`)
                    notify('item', `+${names.join(', ')}`)
                  }
                  forceUpdate(n => n + 1)
                } else {
                // Check for adjacent resource node — prefer clicked target over nearest
                const clickedTargetId = clickedNodeIdRef.current
                clickedNodeIdRef.current = null
                const zoneNodes = nodesRef.current.filter(n => n.zoneId === currentZone.id && n.type !== 'ather_soil')
                const node = (clickedTargetId && zoneNodes.find(n => n.id === clickedTargetId))
                  || findAdjacentNode(player.tileX, player.tileY, currentZone.id, zoneNodes)
                if (node) {
                  const check = canHarvest(node, skillsRef.current, manaRef.current)
                  if (check.ok) {
                    const nodeSkill = getNodeSkill(node.type)
                    const tool = getEquippedTool(equippedToolsRef.current, nodeSkill)
                    channelRef.current = startChannel(node, skillsRef.current.mana.level, tool?.speedBonus)
                    manaRef.current.channeling = true
                    player.animFrame = 0
                    player.animTimer = 0
                    // Face the node
                    const dx = node.tileX - player.tileX
                    const dy = node.tileY - player.tileY
                    if (dx !== 0 || dy !== 0) {
                      if (Math.abs(dx) > Math.abs(dy)) player.direction = dx > 0 ? 'right' : 'left'
                      else player.direction = dy > 0 ? 'down' : 'up'
                    }
                  } else {
                    // Show feedback for failed harvest
                    const msg = check.reason === 'no_mana' ? 'Not enough mana'
                      : check.reason === 'depleted' ? 'Depleted'
                      : check.reason === 'level_too_low' ? (check.detail ?? 'Level too low')
                      : 'Cannot harvest'
                    notify('warning', msg)
                  }
                } else {
                  // Check for furniture or seed placement
                  const tileOk = walkable(currentZone.grid, tx, ty)
                  const occupied = !!npcAtTile(currentZone.id, tx, ty, flagsRef.current) || !!spiritAtTile(spiritsRef.current, tx, ty)
                  const seedOnTile = plantedSeedsRef.current.some(p => p.tileX === tx && p.tileY === ty && p.zoneId === currentZone.id)
                    || plantedCropsRef.current.some(p => p.tileX === tx && p.tileY === ty && p.zoneId === currentZone.id)
                  const furnOnTile = furnitureAtTile(tx, ty, currentZone.id, furnitureRef.current)
                  // Check for furniture in bag first (priority over seeds)
                  const furnId = Object.keys(FURNITURE_DEFS).find(fid => countItem(invRef.current, fid) > 0)
                  if (furnId && tileOk && !occupied && !seedOnTile && !furnOnTile) {
                    // For chests — extract chestData from the inventory item before removing
                    const furnDef = FURNITURE_DEFS[furnId]
                    const isChest = !!furnDef?.chestSlots
                    let pickedChestData: ChestStorage | undefined
                    if (isChest) {
                      const slotIdx = findItem(invRef.current, furnId)
                      if (slotIdx !== null) {
                        pickedChestData = invRef.current.slots[slotIdx]?.chestData
                      }
                    }
                    removeItems(invRef.current, furnId, 1)
                    setInv({ ...invRef.current })
                    const placed = createFurniture(furnId, tx, ty, currentZone.id)
                    furnitureRef.current.push(placed)
                    // Restore chest contents if placing a chest with data
                    if (isChest) {
                      if (pickedChestData) {
                        pickedChestData.furnitureInstanceId = placed.id
                        chestsRef.current.push(pickedChestData)
                      } else {
                        chestsRef.current.push(createChestStorage(placed.id, furnDef.chestSlots))
                      }
                      setChests([...chestsRef.current])
                    }
                    particles.burst(tx * TILE + 8, ty * TILE + 8, 'sparkle', 6)
                    forceUpdate(n => n + 1)
                  } else {
                    // Check for crop seed first (crop_seed type → PlantedCrop for items)
                    const cropSeedId = CROP_SEED_IDS.find(id => countItem(invRef.current, id) > 0)
                    const cropId = cropSeedId ? cropForSeed(cropSeedId) : null
                    if (cropId && tileOk && !occupied && !seedOnTile && canPlantCrop(cropId, invRef.current, skillsRef.current.farming.level, manaRef.current)) {
                      const crop = plantCrop(cropId, invRef.current, skillsRef.current, manaRef.current, tx, ty, currentZone.id)
                      if (crop) {
                        plantedCropsRef.current.push(crop)
                        setInv({ ...invRef.current })
                        setManaDisplay({ current: Math.floor(manaRef.current.current), max: getMaxPool(skillsRef.current.mana.level) })
                        particles.burst(tx * TILE + 8, ty * TILE + 8, 'sparkle', 6)
                        forceUpdate(n => n + 1)
                      }
                    } else {
                    // Find first mana seed in bag — requires ather_soil node on tile
                    const seedId = SEED_IDS.find(id => countItem(invRef.current, id) > 0)
                    const hasSoilNode = nodesRef.current.some(
                      n => n.zoneId === currentZone.id && n.tileX === tx && n.tileY === ty && n.type === 'ather_soil' && n.state === 'harvestable'
                    )
                    if (seedId && tileOk && !occupied && !seedOnTile && hasSoilNode) {
                      plantSeedAt(seedId, tx, ty)
                    } else {
                      // Pet active beast
                      const activeBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current)
                      if (activeBeast) {
                        const compTx = Math.floor(activeBeast.x / TILE)
                        const compTy = Math.floor(activeBeast.y / TILE)
                        if (compTx === tx && compTy === ty) {
                          petSpirit(activeBeast)
                          particles.burst(activeBeast.x + 16, activeBeast.y, 'heart', 4)
                        }
                      }
                    }
                    } // close crop seed else
                  }
                }
                } // close readyCrop else
              }
            }
          }
          input.consumeInteract()
        }

        // Click-to-move arrival handlers
        if (player.arrivedAtPath && player.pathTarget?.interactConsole) {
          // Arrived at Spirit Console — open console popup
          setConsoleOpen(true)
          player.arrivedAtPath = false
          player.pathTarget = null
        } else if (player.arrivedAtPath && player.pathTarget?.interactSpiritId) {
          const target = beastsRef.current.find(b => b.id === player.pathTarget!.interactSpiritId)
          if (target) {
            const stx = Math.floor(target.x / TILE)
            const sty = Math.floor(target.y / TILE)
            const dx = stx - player.tileX
            const dy = sty - player.tileY
            if (Math.abs(dx) > Math.abs(dy)) player.direction = dx > 0 ? 'right' : 'left'
            else player.direction = dy > 0 ? 'down' : 'up'
            petSpirit(target)
            particles.burst(target.x + 16, target.y, 'heart', 4)
          }
          player.arrivedAtPath = false
          player.pathTarget = null
        } else if (player.arrivedAtPath && player.pathTarget?.interactNpcId) {
          // Arrived near NPC — face them and start dialogue (or open panel for special NPCs)
          const npc = getNPCsForZone(currentZone.id, flagsRef.current).find(n => n.id === player.pathTarget!.interactNpcId)
          if (npc) {
            const npcTx = npcStatesRef.current.get(npc.id) ? Math.round(npcStatesRef.current.get(npc.id)!.x / TILE) : npc.tileX
            const npcTy = npcStatesRef.current.get(npc.id) ? Math.round(npcStatesRef.current.get(npc.id)!.y / TILE) : npc.tileY
            const dx = npcTx - player.tileX
            const dy = npcTy - player.tileY
            if (Math.abs(dx) > Math.abs(dy)) player.direction = dx > 0 ? 'right' : 'left'
            else player.direction = dy > 0 ? 'down' : 'up'
            // Community Gate opens friends panel instead of dialogue
            if (npc.id === 'community-gate') {
              setSidePanel('friends')
            } else {
              const dlgId = resolveNPCDialogue(npc, flagsRef.current)
              flagsRef.current[`talked_${npc.id}`] = true
              const ds = dialogueRef.current
              const ctx = buildCtx()
              startDialogue(ds, dlgId, ctx)
            }
          }
          player.arrivedAtPath = false
          player.pathTarget = null
        } else if (player.arrivedAtPath && player.pathTarget?.interactNodeId) {
          // Arrived within range of resource node — start channel directly
          const node = nodesRef.current.find(n => n.id === player.pathTarget!.interactNodeId)
          if (node && node.state === 'harvestable') {
            const dx = node.tileX - player.tileX
            const dy = node.tileY - player.tileY
            if (Math.abs(dx) > Math.abs(dy)) player.direction = dx > 0 ? 'right' : 'left'
            else player.direction = dy > 0 ? 'down' : 'up'
            const check = canHarvest(node, skillsRef.current, manaRef.current)
            if (check.ok) {
              const nodeSkill = getNodeSkill(node.type)
              const tool = getEquippedTool(equippedToolsRef.current, nodeSkill)
              channelRef.current = startChannel(node, skillsRef.current.mana.level, tool?.speedBonus)
              manaRef.current.channeling = true
              player.animFrame = 0
              player.animTimer = 0
            } else {
              const msg = check.reason === 'no_mana' ? 'Not enough mana'
                : check.reason === 'depleted' ? 'Depleted'
                : check.reason === 'level_too_low' ? (check.detail ?? 'Level too low')
                : 'Cannot harvest'
              notify('warning', msg)
            }
          }
          player.arrivedAtPath = false
          player.pathTarget = null
        } else if (player.arrivedAtPath && player.pathTarget?.interactPlant) {
          // Arrived at tile — plant selected seed
          const { seedItemId, tileX, tileY } = player.pathTarget.interactPlant
          plantSeedAt(seedItemId, tileX, tileY)
          player.arrivedAtPath = false
          player.pathTarget = null
        } else if (player.arrivedAtPath && player.pathTarget?.interactPickupId) {
          // Arrived at static pickup — collect it
          const pickupIdx = worldItemsRef.current.findIndex(wi => wi.id === player.pathTarget!.interactPickupId)
          if (pickupIdx !== -1) {
            const wi = worldItemsRef.current[pickupIdx]
            const leftover = addItems(invRef.current, wi.itemId, wi.count)
            if (leftover === 0) {
              collectedPickupsRef.current.add(wi.id)
              worldItemsRef.current.splice(pickupIdx, 1)
              setInv({ ...invRef.current })
              const name = ITEMS.find(i => i.id === wi.itemId)?.name ?? wi.itemId
              notify('item', `+${name}`)
            } else {
              notify('warning', 'Inventory full!')
            }
          }
          player.arrivedAtPath = false
          player.pathTarget = null
        } else if (player.arrivedAtPath && player.pathTarget?.interactFurniture) {
          // Arrived near furniture — open its interaction panel
          const furn = furnitureRef.current.find(f => f.id === player.pathTarget!.interactFurniture)
          if (furn) {
            const furnDef = FURNITURE_DEFS[furn.furnitureId]
            if (furnDef) {
              // Face toward the furniture
              const dx = furn.tileX - player.tileX
              const dy = furn.tileY - player.tileY
              if (Math.abs(dx) > Math.abs(dy)) player.direction = dx > 0 ? 'right' : 'left'
              else player.direction = dy > 0 ? 'down' : 'up'
              setSidePanel(furnDef.interactionPanel as SidePanel)
            }
          }
          player.arrivedAtPath = false
          player.pathTarget = null
        } else if (player.arrivedAtPath) {
          player.arrivedAtPath = false
          player.pathTarget = null
        }

        // Beast AI — active beast follows player on overworld
        const activeCompanion = beastsRef.current.find(b => b.id === activeBeastIdRef.current)
        if (activeCompanion) {
          if (trail.length >= TRAIL_LENGTH) {
            const followPoint = trail[trail.length - TRAIL_LENGTH]
            followWithPath(activeCompanion, followPoint.x, followPoint.y, currentZone.grid, player.x, player.y)
          } else {
            updateSpirit(activeCompanion, currentZone.grid, player.x, player.y)
          }
        }

        // Tick active harvest channel
        if (channelRef.current) {
          // Emit skill-colored channel particles every 3 ticks
          if (channelRef.current.ticksElapsed % 3 === 0) {
            const skillColor = SKILL_COLORS[channelRef.current.skillId] ?? '#d4a843'
            particles.channelStream(player.x + 8, player.y, skillColor)
          }
          // Apply harvest speed buff — extra ticks per game tick
          const speedBuff = activeBuffsRef.current.find(b => b.stat === 'harvest_speed')
          if (speedBuff) {
            const extraTicks = Math.floor(speedBuff.multiplier * 2)  // 0.15 = 0 extra, 0.5 = 1 extra
            for (let i = 0; i < extraTicks; i++) channelRef.current.ticksElapsed++
          }
          const done = tickChannel(channelRef.current)
          if (done) {
            const node = nodesRef.current.find(n => n.id === channelRef.current!.nodeId)
            if (node) {
              // Look up equipped tool + potion XP buff
              const chSkill = channelRef.current!.skillId
              const chTool = getEquippedTool(equippedToolsRef.current, chSkill)
              const xpBuff = activeBuffsRef.current.find(b => b.stat === 'xp_boost')
              const totalXpBonus = (chTool?.xpBonus ?? 1) * (1 + (xpBuff?.multiplier ?? 0))
              const result = completeHarvest(node, skillsRef.current, manaRef.current, totalXpBonus)
              // XP floaters per skill gained
              for (const xp of result.xp) {
                if (xp.amount > 0) {
                  floatXp(node.tileX * TILE + 16, node.tileY * TILE, xp.amount, SKILL_COLORS[xp.skillId])
                }
              }
              // Decrement tool durability
              if (chTool) {
                if (!useTool(chTool)) {
                  delete equippedToolsRef.current[chSkill]
                  notify('warning', 'Tool broke!')
                }
              }
              // Add drops to inventory — overflow spawns as world items
              const added = addHarvestItems(invRef.current, result.items)
              const overflow = result.items.filter(id => !added.includes(id))
              if (overflow.length > 0) {
                spawnWorldItems(worldItemsRef.current, overflow, node.tileX * TILE + 4, node.tileY * TILE)
              }
              if (added.length > 0) {
                setInv({ ...invRef.current })
                const names = added.map(id => ITEMS.find(i => i.id === id)?.name ?? id)
                notify('item', `+${names.join(', ')}`)
              }
              // Level-up notification
              for (const lu of result.levelUps) {
                particles.burst(player.x + 16, player.y - 4, 'sparkle', 16)
                notifyLevelUp(lu.skillId, lu.newLevel)
              }
              // Node depletion particles
              if (result.nodeDepleted) {
                particles.burst(node.tileX * TILE + 8, node.tileY * TILE + 8, 'sparkle', 4)
              }
            }
            channelRef.current = null
            manaRef.current.channeling = false
            player.animFrame = 0
            player.animTimer = 0
          }
        }

        // Mana regen (every tick)
        regenManaTick(manaRef.current, skillsRef.current.mana.level)

        // Prune expired buffs (every 15 ticks = 1 second)
        if (xpTickCounter === 14) {
          const now = Date.now()
          activeBuffsRef.current = activeBuffsRef.current.filter(b => b.expiresAt > now)
        }

        // Flush mana XP (every 15 ticks = 1 second)
        if (xpTickCounter === 14) {
          const spent = flushManaSpent(manaRef.current)
          if (spent > 0) {
            const prevManaLvl = skillsRef.current.mana.level
            addSkillXP(skillsRef.current.mana, spent)
            floatXp(player.x + 16, player.y, spent, SKILL_COLORS.mana)
            if (skillsRef.current.mana.level > prevManaLvl) {
              particles.burst(player.x + 16, player.y - 4, 'sparkle', 16)
              notifyLevelUp('mana', skillsRef.current.mana.level)
            }
          }
        }

        // Day/night cycle tick (every tick for smooth ambient, respawns on phase transitions)
        const dtMs = (1 / 15) * 1000  // 15 TPS
        const respawnSkills = tickDayCycle(dayCycleRef.current, dtMs)
        for (const skillId of respawnSkills) {
          respawnNodesBySkill(nodesRef.current, skillId)
        }

        // Weather tick — advance weather state for current zone
        const weatherConfig = DEFAULT_WEATHER_CONFIGS[currentZone.id]
        const weatherState = weatherStatesRef.current[currentZone.id]
        if (weatherConfig && weatherState) {
          tickWeather(weatherState, weatherConfig)
        }

        // Individual node respawn timers (cheap Date.now() checks)
        tickAllNodeRespawns(nodesRef.current)

        // World item physics + auto-collect
        const wiExpired = tickWorldItems(worldItemsRef.current)
        removeExpired(worldItemsRef.current, wiExpired)
        const collected = collectNearby(worldItemsRef.current, player.x, player.y)
        if (collected.length > 0) {
          const names: string[] = []
          for (const wi of collected) {
            const leftover = addItems(invRef.current, wi.itemId, wi.count)
            if (leftover === 0) {
              names.push(ITEMS.find(i => i.id === wi.itemId)?.name ?? wi.itemId)
              // Mark static pickups as permanently collected
              if (wi.isStatic) collectedPickupsRef.current.add(wi.id)
            } else {
              // Inventory still full — push original item back (preserves life so it eventually despawns)
              wi.settled = true
              wi.vx = 0
              wi.vy = 0
              worldItemsRef.current.push(wi)
            }
          }
          if (names.length > 0) {
            setInv({ ...invRef.current })
            notify('item', `+${names.join(', ')}`)
          }
        }

        // Check planted seeds for hatching (every 15 ticks to save perf)
        if (xpTickCounter === 0) {
          const ready = plantedSeedsRef.current.filter(p => p.zoneId === currentZone.id && isReadyToHatch(p))
          for (const planted of ready) {
            hatchPlantedSeed(planted)
          }
        }

        // GE price drift (every 60 ticks = ~4 seconds)
        if (xpTickCounter === 5) {
          tickPriceDrift(geRef.current)
        }

        // Quest progress check (every 15 ticks = 1/sec)
        if (xpTickCounter === 10) {
          const justCompleted = tickQuestProgress(questStateRef.current, invRef.current, flagsRef.current, skillsRef.current, spiritIndexRef.current, currentZone.id)
          for (const qid of justCompleted) {
            const earned = grantQuestRewards(qid, invRef.current, skillsRef.current, flagsRef.current)
            if (earned > 0) wallet.earn(earned)
            // Quest completion notification
            const qdef = QUEST_DEFS[qid]
            if (qdef) {
              particles.burst(player.x + 16, player.y - 4, 'sparkle', 12)
              notify('milestone', `Quest complete: ${qdef.name}!`, { duration: 4000 })
            }
          }
          if (justCompleted.length > 0) {
            setInv({ ...invRef.current })
            uiUpdateFn()
          }
        }

        // Beast unlock check (every 15 ticks = 1/sec)
        xpTickCounter++
        if (xpTickCounter >= 15) {
          xpTickCounter = 0
          // Check each beast species for unlock
          for (const species of BEAST_SPECIES) {
            const alreadyOwned = beastsRef.current.some(b => b.species === species)
            if (!alreadyOwned && checkBeastUnlock(species, skillsRef.current, flagsRef.current)) {
              const newBeast = createBeast(species, player.x, player.y, movementStylesRef.current.beasts?.[species])
              beastsRef.current.push(newBeast)
              particles.burst(player.x + 8, player.y - 4, 'sparkle', 16)
              notify('milestone', `A ${BEAST_DEFS[species].name} has joined you!`, { duration: 4000 })
              if (!activeBeastIdRef.current) {
                setActiveBeastId(newBeast.id)
              }
              uiUpdateFn()
            }
          }
        }

        // Multiplayer: send local position + update remote player animations
        mpClient.tick(player.x, player.y, player.direction, player.moving)
        mpClient.updateAnimations()
      },
      // Render (60fps — smooth particles, alpha = tick fraction for interpolation)
      (dt, alpha) => {
        // Interpolate player position between logic ticks for smooth 60fps movement
        const visualX = player.prevX + (player.x - player.prevX) * alpha
        const visualY = player.prevY + (player.y - player.prevY) * alpha

        // Camera follows interpolated player position
        const rz = zoneRef.current
        // Apply zoom before centerOn so clamp bounds use zoomed window size
        renderer.zoom = cameraZoomRef.current
        renderer.centerOn(visualX, visualY, rz.grid[0]?.length ?? 30, rz.grid.length)

        // Layer 0: Tilemap
        renderer.drawBackground()

        // Layer 0.1: Animated tile overdraw (below-entity layer)
        renderer.drawAnimatedTiles(TILES, ABOVE, globalTickRef.current, false)

        // Layer 0.5: Planted seeds (ground-level, render before entities)
        const growthPalette = [...ITEM_PALETTE] as string[]
        for (const planted of plantedSeedsRef.current) {
          if (planted.zoneId !== rz.id) continue
          const phase = getGrowthPhase(planted)
          // Phase 0: species-specific seed sprite + spirit palette
          // Phases 1-3: generic growth sprites + item palette
          let seedAnim: SpriteAnim | undefined
          let seedPalette: string[]
          if (phase === 0) {
            const specSprites = SPRITE_MAP[planted.species]
            seedAnim = specSprites?.seed
            seedPalette = [...(PALETTES[planted.species]?.base ?? ITEM_PALETTE)] as string[]
          } else {
            seedAnim = GROWTH_SPRITES[phase]
            seedPalette = growthPalette
          }
          if (!seedAnim) continue
          const gFrame = seedAnim.frames.length > 1
            ? seedAnim.frames[Math.floor(Date.now() / (seedAnim.rate * 67)) % seedAnim.frames.length]
            : seedAnim.frames[0]
          const gKey = `growth-${planted.id}-${phase}-${seedAnim.frames.length > 1 ? Math.floor(Date.now() / (seedAnim.rate * 67)) % seedAnim.frames.length : 0}`
          const growthCanvas = renderer.getSprite(gKey, gFrame, seedPalette, 32, 32)
          renderer.drawSprite(growthCanvas, planted.tileX * TILE, planted.tileY * TILE, false)
        }

        // Layer 0.55: Planted crops (same ground level as spirit seeds)
        for (const crop of plantedCropsRef.current) {
          if (crop.zoneId !== rz.id) continue
          const cropPhase = getCropGrowthPhase(crop)
          // Per-crop sprites if painted, else generic fallback
          const perCropSprites = CROP_SPRITES_BY_TYPE[crop.cropId]
          const cropAnim = perCropSprites?.[cropPhase] ?? CROP_GROWTH_SPRITES[cropPhase]
          if (!cropAnim) continue
          const cFrame = cropAnim.frames.length > 1
            ? cropAnim.frames[Math.floor(Date.now() / (cropAnim.rate * 67)) % cropAnim.frames.length]
            : cropAnim.frames[0]
          const cKey = `crop-${crop.cropId}-${cropPhase}-${cropAnim.frames.length > 1 ? Math.floor(Date.now() / (cropAnim.rate * 67)) % cropAnim.frames.length : 0}`
          const cropPalette = perCropSprites ? [...(CROP_PALETTES[crop.cropId] ?? ITEM_PALETTE)] as string[] : growthPalette
          const cropCanvas = renderer.getSprite(cKey, cFrame, cropPalette, 32, 32)
          renderer.drawSprite(cropCanvas, crop.tileX * TILE, crop.tileY * TILE, false)
          // Ready-crop sparkle — periodic green sparkle when harvestable
          if (cropPhase === 3 && globalTickRef.current % 30 === ((crop.tileX * 7 + crop.tileY * 13) % 30)) {
            particles.burst(crop.tileX * TILE + 16, crop.tileY * TILE + 8, 'sparkle', 2)
          }
        }

        // Layer 0.65: Placed structure overlays (non-ABOVE cells, behind entities)
        const zoneStructures = STRUCTURE_PLACEMENTS[rz.id] ?? []
        for (const sp of zoneStructures) {
          const def = structureDefsRef.current.find(s => s.id === sp.structureId)
          if (!def) continue
          for (let r = 0; r < def.rows; r++) {
            for (let c = 0; c < def.cols; c++) {
              const cell = def.cells[r]?.[c]
              if (!cell) continue
              if (ABOVE[cell.tileIdx]) continue // ABOVE cells drawn later
              const tile = TILES[cell.tileIdx]
              if (!tile) continue
              const px = tile.pixels
              const rotated = cell.rotation > 0 ? Renderer.rotateTilePixels(px, cell.rotation) : px
              const sKey = `struct-${sp.structureId}-${r}-${c}-${cell.rotation}`
              const sCanvas = renderer.getSprite(sKey, rotated, tile.palette, TILE, TILE)
              renderer.drawSprite(sCanvas, (sp.tileX + c) * TILE, (sp.tileY + r) * TILE, false)
            }
          }
        }

        // Layer 0.65b: Player-placed structures (home plot, non-ABOVE cells)
        for (const sp of playerStructuresRef.current) {
          if (sp.zoneId !== rz.id) continue
          const def = structureDefsRef.current.find(s => s.id === sp.structureId)
          if (!def) continue
          for (let r = 0; r < def.rows; r++) {
            for (let c = 0; c < def.cols; c++) {
              const cell = def.cells[r]?.[c]
              if (!cell) continue
              if (ABOVE[cell.tileIdx]) continue
              const tile = TILES[cell.tileIdx]
              if (!tile) continue
              const ppx = tile.pixels
              const rotated = cell.rotation > 0 ? Renderer.rotateTilePixels(ppx, cell.rotation) : ppx
              const sKey = `pstruct-${sp.structureId}-${r}-${c}-${cell.rotation}`
              const sCanvas = renderer.getSprite(sKey, rotated, tile.palette, TILE, TILE)
              renderer.drawSprite(sCanvas, (sp.tileX + c) * TILE, (sp.tileY + r) * TILE, false)
            }
          }
        }

        // Layer 1: Y-sorted middleground — entities, nodes, furniture, world items
        // Sort by feet position (sortY = y + spriteHeight) for correct top-down depth
        type Drawable = { x: number; y: number; sortY: number; type: 'beast'; beast: ManaBeast }
          | { x: number; y: number; sortY: number; type: 'player' }
          | { x: number; y: number; sortY: number; type: 'remote-player'; remote: RemotePlayer }
          | { x: number; y: number; sortY: number; type: 'npc'; npc: NPCDef }
          | { x: number; y: number; sortY: number; type: 'node'; node: ResourceNode }
          | { x: number; y: number; sortY: number; type: 'furniture'; furn: PlacedFurniture }
          | { x: number; y: number; sortY: number; type: 'world-item'; item: WorldItem }
        const DRAW_PRIORITY: Record<Drawable['type'], number> = {
          'world-item': 0, node: 1, furniture: 2, beast: 3, npc: 4, 'remote-player': 5, player: 6,
        }

        const drawables: Drawable[] = []
        // Render active beast on the overworld
        const companionBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current)
        if (companionBeast) {
          drawables.push({ x: companionBeast.x, y: companionBeast.y, sortY: companionBeast.y + TILE, type: 'beast' as const, beast: companionBeast })
        }
        // Add zone NPCs (patrol NPCs use interpolated position)
        const zoneNPCs = getNPCsForZone(rz.id, flagsRef.current)
        const npcStates = npcStatesRef.current
        for (const npc of zoneNPCs) {
          const ps = npcStates.get(npc.id)
          if (ps) {
            // Interpolate between prevX/prevY and x/y for smooth patrol movement
            const ix = ps.prevX + (ps.x - ps.prevX) * alpha
            const iy = ps.prevY + (ps.y - ps.prevY) * alpha
            drawables.push({ x: ix, y: iy, sortY: iy + TILE, type: 'npc', npc })
          } else {
            drawables.push({ x: npc.tileX * TILE, y: npc.tileY * TILE, sortY: npc.tileY * TILE + TILE, type: 'npc', npc })
          }
        }
        // Resource nodes
        const nodeAnimRate = 12
        const nodeAnimRadius = 8
        for (const node of nodesRef.current) {
          if (node.zoneId !== rz.id) continue
          drawables.push({ x: node.tileX * TILE, y: node.tileY * TILE, sortY: node.tileY * TILE + TILE, type: 'node', node })
        }
        // Furniture
        for (const furn of furnitureRef.current) {
          if (furn.zoneId !== rz.id) continue
          drawables.push({ x: furn.tileX * TILE, y: furn.tileY * TILE, sortY: furn.tileY * TILE + TILE, type: 'furniture', furn })
        }
        // World items (dropped loot)
        for (const wi of worldItemsRef.current) {
          drawables.push({ x: wi.x, y: getVisualY(wi), sortY: wi.groundY + TILE - 4, type: 'world-item', item: wi })
        }
        // Remote players (multiplayer) — position already smoothed in updateAnimations()
        for (const rp of mpClient.getRemotePlayers()) {
          drawables.push({ x: rp.x, y: rp.y, sortY: rp.y + TILE, type: 'remote-player', remote: rp })
        }
        drawables.push({ x: visualX, y: visualY, sortY: visualY + TILE, type: 'player' })
        drawables.sort((a, b) => a.sortY - b.sortY || DRAW_PRIORITY[a.type] - DRAW_PRIORITY[b.type])

        for (const d of drawables) {
          if (d.type === 'beast') {
            const beast = d.beast
            const sprites = BEAST_SPRITES[beast.species] ?? BEAST_SPRITES.drifthorn
            const palette = BEAST_PALETTES[beast.species] ?? BEAST_PALETTES.drifthorn

            // Direction mapping — use movementPhase for sprite key (like player)
            const beastAnimState = beast.animState
            const beastPhase = beast.movementPhase
            const isDirectional = beastAnimState === 'idle' || beastAnimState === 'walk' || beastAnimState === 'run'
            // Map mirrored directions to sprite directions + flip flag
            const flipDirs: Record<string, string> = { left: 'right', downleft: 'downright', upleft: 'upright' }
            const beastFlip = beast.direction in flipDirs
            const dir = flipDirs[beast.direction] ?? beast.direction

            let animKey: string
            if (isDirectional) {
              // Use movementPhase for sprite key (matches player renderer)
              animKey = `${dir}_${beastPhase}`
            } else {
              animKey = beastAnimState
            }
            // Graceful fallback chain: start_run/end_run/special → run → walk → idle
            let anim = sprites[animKey]
            if (!anim && isDirectional) {
              if (beastPhase === 'start_run' || beastPhase === 'end_run' || beastPhase === 'special') {
                anim = sprites[`${dir}_run`]
              }
              if (!anim && beastPhase !== 'walk' && beastPhase !== 'idle') {
                anim = sprites[`${dir}_walk`]
              }
              if (!anim) anim = sprites[`${dir}_idle`]
            }
            anim = anim ?? sprites.idle
            const holdTime = anim.durations?.[beast.animFrame % anim.frames.length] ?? anim.rate

            if (beast.animTimer >= holdTime) {
              const nextFrame = beast.animFrame + 1
              if (isDirectional && isPlayOncePhase(beastPhase) && nextFrame >= anim.frames.length) {
                // Play-once phase finished — hold last frame, signal state machine
                beast.animFrame = anim.frames.length - 1
                beast.phaseAnimDone = true
              } else {
                beast.animFrame = nextFrame % anim.frames.length
              }
              beast.animTimer = 0
            }

            const frame = anim.frames[beast.animFrame % anim.frames.length]
            const key = `beast-${beast.species}-${animKey}-${beast.animFrame}`
            const spriteCanvas = renderer.getSprite(key, frame, [...palette], 32, 32)

            // Shadow (centered under 32px sprite)
            renderer.drawPixel(beast.x + 8,  beast.y + 30, '#000000', 0.1)
            renderer.drawPixel(beast.x + 10, beast.y + 30, '#000000', 0.15)
            renderer.drawPixel(beast.x + 12, beast.y + 30, '#000000', 0.2)
            renderer.drawPixel(beast.x + 14, beast.y + 30, '#000000', 0.25)
            renderer.drawPixel(beast.x + 16, beast.y + 30, '#000000', 0.25)
            renderer.drawPixel(beast.x + 18, beast.y + 30, '#000000', 0.2)
            renderer.drawPixel(beast.x + 20, beast.y + 30, '#000000', 0.15)
            renderer.drawPixel(beast.x + 22, beast.y + 30, '#000000', 0.1)

            // Squash & stretch (scaled for 32px sprites)
            let dw: number | undefined
            let dh: number | undefined
            if (beast.state === 'pet') {
              dw = 36; dh = 30
            } else if (beast.state === 'happy') {
              if (beast.animFrame % 2 === 0) {
                dw = 30; dh = 34
              }
            }

            renderer.drawSprite(spriteCanvas, beast.x, beast.y, beastFlip, dw, dh)

            if (beast.state === 'happy' && Math.random() < 0.08) {
              particles.burst(beast.x + 16, beast.y - 4, 'sparkle', 1)
            }
          } else if (d.type === 'npc') {
            // NPC rendering — uses interpolated position for patrol NPCs
            const npc = d.npc
            const nx = d.x
            const ny = d.y
            const key = `npc-${npc.id}`
            const spriteCanvas = renderer.getSprite(key, npc.sprite, [...npc.palette], 32, 32)
            // Shadow (centered under 32x32 sprite)
            renderer.drawPixel(nx + 10, ny + 31, '#000000', 0.1)
            renderer.drawPixel(nx + 12, ny + 31, '#000000', 0.15)
            renderer.drawPixel(nx + 14, ny + 31, '#000000', 0.2)
            renderer.drawPixel(nx + 16, ny + 31, '#000000', 0.25)
            renderer.drawPixel(nx + 18, ny + 31, '#000000', 0.2)
            renderer.drawPixel(nx + 20, ny + 31, '#000000', 0.15)
            renderer.drawPixel(nx + 22, ny + 31, '#000000', 0.1)
            renderer.drawSprite(spriteCanvas, nx, ny)
          } else if (d.type === 'node') {
            // Resource node — staggered animation near player
            const node = d.node
            const spriteSet = NODE_SPRITES[node.type]
            if (spriteSet) {
              const anim = spriteSet[node.state]
              if (anim) {
                let frameIdx = 0
                if (anim.frames.length > 1) {
                  const dx = Math.abs(node.tileX - player.tileX)
                  const dy = Math.abs(node.tileY - player.tileY)
                  if (dx <= nodeAnimRadius && dy <= nodeAnimRadius) {
                    const tick = Math.floor((globalTickRef.current + node.animOffset) / nodeAnimRate)
                    frameIdx = tick % anim.frames.length
                  }
                }
                const frame = anim.frames[frameIdx]
                const nPal = (NODE_PALETTES[node.type] ?? [...ITEM_PALETTE]) as string[]
                const nKey = `node-${node.type}-${node.state}-f${frameIdx}`
                const nodeCanvas = renderer.getSprite(nKey, frame, nPal, 32, 32)
                renderer.drawSprite(nodeCanvas, d.x, d.y, false)
              }
            }
          } else if (d.type === 'furniture') {
            const furnAnim = FURNITURE_SPRITES[d.furn.furnitureId]
            if (furnAnim) {
              const fFrame = furnAnim.frames[0]
              const fKey = `furn-${d.furn.furnitureId}`
              const fCanvas = renderer.getSprite(fKey, fFrame, [...ITEM_PALETTE] as string[], 32, 32)
              renderer.drawSprite(fCanvas, d.x, d.y, false)
            }
          } else if (d.type === 'world-item') {
            const wi = d.item
            // Static pickups render as bag sprite; regular items use their own icon
            const iconAnim = wi.isStatic ? PICKUP_BAG_ICON : ITEM_ICONS[wi.itemId]
            if (iconAnim) {
              const frameIdx = Math.floor(wi.life / (iconAnim.rate || 1)) % iconAnim.frames.length
              const frame = iconAnim.frames[frameIdx]
              const wiKey = wi.isStatic ? `wi-bag-${frameIdx}` : `wi-${wi.itemId}`
              const wiCanvas = renderer.getSprite(wiKey, frame, [...ITEM_PALETTE] as string[], 32, 32)
              const wiAlpha = getDespawnAlpha(wi)
              if (wiAlpha < 1) renderer.setAlpha(wiAlpha)
              renderer.drawSprite(wiCanvas, d.x, d.y, false)
              if (wiAlpha < 1) renderer.resetAlpha()
            }
          } else if (d.type === 'remote-player') {
            // Remote player rendering (multiplayer)
            const rp = d.remote
            const rpState = rp.moving ? 'walk' : 'idle'
            const rpSd = spriteDir(rp.direction)
            const rpAnimKey = `${rpSd.dir}_${rpState}`
            const rpChar = PLAYABLE_CHARACTERS.find(c => c.id === rp.sprite) ?? PLAYABLE_CHARACTERS[0]
            const rpAnim = rpChar.sprites[rpAnimKey] ?? rpChar.sprites.down_idle ?? PLAYER_SPRITES.down_idle
            const rpFrameIdx = rp.animFrame % rpAnim.frames.length
            const rpFrame = rpAnim.frames[rpFrameIdx]
            const rpKey = `rp-${rp.playerId}-${rpChar.id}-${rpAnimKey}-${rpFrameIdx}`
            const rpCanvas = renderer.getSprite(rpKey, rpFrame, [...rpChar.palette], 32, 32)

            // Shadow (centered under 32x32 sprite)
            renderer.drawPixel(d.x + 10, d.y + 31, '#000000', 0.1)
            renderer.drawPixel(d.x + 12, d.y + 31, '#000000', 0.15)
            renderer.drawPixel(d.x + 14, d.y + 31, '#000000', 0.2)
            renderer.drawPixel(d.x + 16, d.y + 31, '#000000', 0.25)
            renderer.drawPixel(d.x + 18, d.y + 31, '#000000', 0.2)
            renderer.drawPixel(d.x + 20, d.y + 31, '#000000', 0.15)
            renderer.drawPixel(d.x + 22, d.y + 31, '#000000', 0.1)

            renderer.drawSprite(rpCanvas, d.x, d.y, rpSd.flip)
          } else {
            // Player rendering — movement phase drives sprite selection
            const phase = player.movementPhase
            const isChannel = !!channelRef.current
            let animKey: string
            let pFlip: boolean
            if (isChannel) {
              // Channels use cardinal directions only (no diagonal channel art)
              const cd = channelDir(player.direction)
              pFlip = cd.flip
              const skill = channelRef.current!.skillId
              if (skill === 'mana') animKey = `mana_${cd.dir}`
              else if (skill === 'rinning') animKey = `rinning_${cd.dir}`
              else animKey = `channel_${cd.dir}` // forestry, prospecting use generic
            } else {
              const sd = spriteDir(player.direction)
              pFlip = sd.flip
              animKey = `${sd.dir}_${phase}`
            }
            const charSprites = (PLAYABLE_CHARACTERS.find(c => c.id === playerCharRef.current) ?? PLAYABLE_CHARACTERS[0]).sprites
            // Graceful fallback chain: start_run/end_run → run → walk → idle
            let anim = charSprites[animKey]
            if (!anim && !isChannel) {
              const sd = spriteDir(player.direction)
              if (phase === 'start_run' || phase === 'end_run' || phase === 'special') {
                anim = charSprites[`${sd.dir}_run`]
              }
              if (!anim && phase !== 'walk' && phase !== 'idle') {
                anim = charSprites[`${sd.dir}_walk`]
              }
              if (!anim) anim = charSprites[`${sd.dir}_idle`]
            }
            anim = anim ?? charSprites.down_idle ?? PLAYER_SPRITES.down_idle
            const holdTime = anim.durations?.[player.animFrame % anim.frames.length] ?? anim.rate

            if (player.animTimer >= holdTime) {
              const nextFrame = player.animFrame + 1
              if (isPlayOncePhase(phase) && nextFrame >= anim.frames.length) {
                // Play-once phase finished — hold last frame, signal state machine
                player.animFrame = anim.frames.length - 1
                player.phaseAnimDone = true
              } else {
                player.animFrame = nextFrame % anim.frames.length
              }
              player.animTimer = 0
            }

            const frameIdx = player.animFrame % anim.frames.length
            const frame = anim.frames[frameIdx]
            const activeChar = PLAYABLE_CHARACTERS.find(c => c.id === playerCharRef.current) ?? PLAYABLE_CHARACTERS[0]
            const key = `player-${activeChar.id}-${animKey}-${frameIdx}`
            const spriteCanvas = renderer.getSprite(key, frame, [...activeChar.palette], 32, 32)

            // Channel bob offset (1px sine wave during harvesting)
            const channelBobY = channelRef.current
              ? Math.round(Math.sin(channelRef.current.ticksElapsed * 0.15) * 1)
              : 0

            // Shadow (centered under 32x32 sprite — stays grounded, no bob)
            const px = d.x, py = d.y
            renderer.drawPixel(px + 10, py + 31, '#000000', 0.1)
            renderer.drawPixel(px + 12, py + 31, '#000000', 0.15)
            renderer.drawPixel(px + 14, py + 31, '#000000', 0.2)
            renderer.drawPixel(px + 16, py + 31, '#000000', 0.25)
            renderer.drawPixel(px + 18, py + 31, '#000000', 0.2)
            renderer.drawPixel(px + 20, py + 31, '#000000', 0.15)
            renderer.drawPixel(px + 22, py + 31, '#000000', 0.1)

            renderer.drawSprite(spriteCanvas, px, py + channelBobY, pFlip)

            // Aura glow during channeling (skill-colored edge pixels)
            if (channelRef.current) {
              const skillColor = SKILL_COLORS[channelRef.current.skillId] ?? '#d4a843'
              const pulse = 0.2 + 0.15 * Math.sin(channelRef.current.ticksElapsed * 0.12)
              const glowY = py + channelBobY
              // Left edge
              renderer.drawPixel(px - 1, glowY + 4, skillColor, pulse)
              renderer.drawPixel(px - 1, glowY + 8, skillColor, pulse)
              // Right edge
              renderer.drawPixel(px + 16, glowY + 4, skillColor, pulse)
              renderer.drawPixel(px + 16, glowY + 8, skillColor, pulse)
              // Top edge
              renderer.drawPixel(px + 6, glowY - 1, skillColor, pulse * 0.8)
              renderer.drawPixel(px + 9, glowY - 1, skillColor, pulse * 0.8)
            }

            // Tool swing animation during channeling
            if (channelRef.current) {
              const chToolRender = getEquippedTool(equippedToolsRef.current, channelRef.current.skillId)
              if (chToolRender) {
                const toolAnim = TOOL_SPRITES[chToolRender.toolId]
                if (toolAnim) {
                  const tFrame = Math.floor(channelRef.current.ticksElapsed / toolAnim.rate) % toolAnim.frames.length
                  const toolPixels = toolAnim.frames[tFrame]
                  const progress = channelProgress(channelRef.current)
                  const profile = getSwingProfile(channelRef.current.skillId)
                  const facingLeft = player.direction === 'left'
                  const angle = getToolAngle(profile, progress, facingLeft)
                  // Snap angle to nearest 5° for cache efficiency
                  const snapAngle = Math.round(angle / 5) * 5
                  const rotated = rotatePixels(toolPixels, 32, snapAngle)
                  const tKey = `tool-${chToolRender.toolId}-${tFrame}-r${snapAngle}`
                  const tc = renderer.getSprite(tKey, rotated, [...ITEM_PALETTE] as string[], 32, 32, false)
                  const offset = getToolOffset(profile, progress, facingLeft)
                  renderer.drawSprite(tc, player.x + offset.dx, player.y + offset.dy, false)
                }
              }
            }

            // Channel progress bar (above player during harvesting)
            if (channelRef.current) {
              const progress = channelProgress(channelRef.current)
              const bobY = Math.round(Math.sin(channelRef.current.ticksElapsed * 0.15) * 1)
              const skillColor2 = SKILL_COLORS[channelRef.current.skillId] ?? '#d4a843'
              const barX = px + 1
              const barY2 = py - 3 + bobY
              const barW = 14
              for (let i = 0; i < barW; i++) {
                renderer.drawPixel(barX + i, barY2, '#000000', 0.5)
                renderer.drawPixel(barX + i, barY2 + 1, '#000000', 0.5)
              }
              const fillW = Math.floor(barW * progress)
              for (let i = 0; i < fillW; i++) {
                renderer.drawPixel(barX + i, barY2, skillColor2, 0.9)
                renderer.drawPixel(barX + i, barY2 + 1, skillColor2, 0.9)
              }
            }
          }
        }

        // Layer 1.5: Foreground overlay (above-player tiles like cloud caps)
        renderer.drawOverlay()
        renderer.drawAnimatedTiles(TILES, ABOVE, globalTickRef.current, true)

        // Layer 1.6: Placed structure ABOVE cells (walk-under effect for arches)
        for (const sp of zoneStructures) {
          const def = structureDefsRef.current.find(s => s.id === sp.structureId)
          if (!def) continue
          for (let r = 0; r < def.rows; r++) {
            for (let c = 0; c < def.cols; c++) {
              const cell = def.cells[r]?.[c]
              if (!cell) continue
              if (!ABOVE[cell.tileIdx]) continue // Only ABOVE cells here
              const tile = TILES[cell.tileIdx]
              if (!tile) continue
              const px = tile.pixels
              const rotated = cell.rotation > 0 ? Renderer.rotateTilePixels(px, cell.rotation) : px
              const sKey = `struct-above-${sp.structureId}-${r}-${c}-${cell.rotation}`
              const sCanvas = renderer.getSprite(sKey, rotated, tile.palette, TILE, TILE)
              renderer.drawSprite(sCanvas, (sp.tileX + c) * TILE, (sp.tileY + r) * TILE, false)
            }
          }
        }

        // Layer 1.6b: Player-placed structure ABOVE cells (home plot)
        for (const sp of playerStructuresRef.current) {
          if (sp.zoneId !== rz.id) continue
          const def = structureDefsRef.current.find(s => s.id === sp.structureId)
          if (!def) continue
          for (let r = 0; r < def.rows; r++) {
            for (let c = 0; c < def.cols; c++) {
              const cell = def.cells[r]?.[c]
              if (!cell) continue
              if (!ABOVE[cell.tileIdx]) continue
              const tile = TILES[cell.tileIdx]
              if (!tile) continue
              const ppx = tile.pixels
              const rotated = cell.rotation > 0 ? Renderer.rotateTilePixels(ppx, cell.rotation) : ppx
              const sKey = `pstruct-above-${sp.structureId}-${r}-${c}-${cell.rotation}`
              const sCanvas = renderer.getSprite(sKey, rotated, tile.palette, TILE, TILE)
              renderer.drawSprite(sCanvas, (sp.tileX + c) * TILE, (sp.tileY + r) * TILE, false)
            }
          }
        }

        // Build mode ghost preview — uses refs (not state) to avoid stale closure
        // Pending placement (from two-step confirm) takes priority over hover tile.
        if (buildModeRef.current) {
          const selRef = selectedBuildItemRef.current
          const ghostSource = pendingPlacementRef.current
            ? { x: pendingPlacementRef.current.tileX, y: pendingPlacementRef.current.tileY }
            : buildHoverTileRef.current
          if (ghostSource && selRef) {
            const gx = ghostSource.x
            const gy = ghostSource.y
            const isPending = !!pendingPlacementRef.current
            // Determine footprint
            let footprintCols = 1
            let footprintRows = 1
            if (selRef.type === 'structure') {
              const def = structureDefsRef.current.find(s => s.id === selRef.id)
              if (def) { footprintCols = def.cols; footprintRows = def.rows }
            }
            // Validate footprint
            const grid = rz.grid
            let valid = true
            for (let fr = 0; fr < footprintRows && valid; fr++) {
              for (let fc = 0; fc < footprintCols && valid; fc++) {
                const tx = gx + fc
                const ty = gy + fr
                if (!walkable(grid, tx, ty)) valid = false
                else if (furnitureAtTile(tx, ty, rz.id, furnitureRef.current)) valid = false
                else if (structureOccupiesTile(tx, ty, rz.id, playerStructuresRef.current, structureDefsRef.current)) valid = false
              }
            }
            // Pending = brighter / more opaque; hover = subtle
            const ghostColor = valid ? '#44ff88' : '#ff4444'
            const ghostAlpha = isPending ? 0.5 : 0.25
            for (let fr = 0; fr < footprintRows; fr++) {
              for (let fc = 0; fc < footprintCols; fc++) {
                for (let px2 = 0; px2 < TILE; px2++) {
                  for (let py2 = 0; py2 < TILE; py2++) {
                    renderer.drawPixel((gx + fc) * TILE + px2, (gy + fr) * TILE + py2, ghostColor, ghostAlpha)
                  }
                }
              }
            }
          }
        }

        // Dialogue typewriter tick (runs at 60fps for smooth text reveal)
        const ds = dialogueRef.current
        if (ds.active) {
          const changed = tickDialogue(ds)
          if (changed || ds.choices) {
            const chars = Math.floor(ds.charProgress)
            if (chars !== lastDialogueChars.current || ds.lineComplete || ds.choices) {
              // Chatterbox: play mumble note for each newly revealed character
              const prevChars = lastDialogueChars.current
              if (prevChars >= 0 && chars > prevChars && chars - prevChars <= 3) {
                const speaker = getCurrentSpeaker(ds)
                const speakerId = speaker?.toLowerCase() ?? 'narrator'
                if (!voiceRef.current || voiceRef.current.profile.id !== speakerId) {
                  voiceRef.current = createVoice(getVoiceProfile(speakerId))
                }
                const visText = getVisibleText(ds)
                if (visText.length > 0) playChar(voiceRef.current, visText[visText.length - 1])
              }
              lastDialogueChars.current = chars
              const ctx = buildCtx()
              setDialogueUI({
                speaker: getCurrentSpeaker(ds) ?? '',
                text: ds.choices ? (getChoicePrompt(ds) ?? '') : getVisibleText(ds),
                complete: ds.lineComplete || !!ds.choices,
                choices: ds.choices ? getChoices(ds, ctx) : null,
                choicePrompt: getChoicePrompt(ds),
              })
            }
          }
        }

        // Layer 2: Ather particles + weather particles
        const rWeather = weatherStatesRef.current[rz.id]
        const rWeatherType: WeatherType = rWeather?.current ?? 'clear'
        const rWeatherTransition = rWeather?.transitionProgress ?? 1
        particles.weatherEmit(rWeatherType, dt, renderer.camX, renderer.camY, rWeatherTransition)
        particles.update(dt, renderer.camX, renderer.camY)
        particles.render((x, y, c, a) => renderer.drawPixel(x, y, c, a))

        // Layer 2.5: Storm lightning flash (full-screen white flash, decays fast)
        if (particles.stormFlash > 0) {
          renderer.drawAmbient('#ffffff', particles.stormFlash * 0.35)
        }

        // Layer 3: Weather ambient overlay (composites with day/night)
        if (rWeather) {
          const weatherAmb = getWeatherAmbient(rWeatherType, rWeatherTransition)
          if (weatherAmb.alpha > 0) renderer.drawAmbient(weatherAmb.color, weatherAmb.alpha)
        }

        // Layer 3.5: Ambient day/night overlay
        const ambient = getAmbientOverlay(dayCycleRef.current)
        renderer.drawAmbient(ambient.color, ambient.alpha)

        // Blit offscreen game canvas to display canvas (eliminates CSS upscale wobble)
        renderer.present()

        // Sync player/spirit positions to React state for HTML panels (throttled)
        uiSyncCounter++
        if (uiSyncCounter >= 8) { // ~7.5fps UI updates (every 8 frames at 60fps)
          uiSyncCounter = 0
          setPlayerTile({ x: player.tileX, y: player.tileY })
          const compBeast = beastsRef.current.find(b => b.id === activeBeastIdRef.current)
          // (minimap spirit positions removed)
          // Sync mana display
          const ml = skillsRef.current.mana.level
          setManaDisplay({ current: Math.floor(manaRef.current.current), max: getMaxPool(ml) })
          // Sync day cycle display
          setDayPhase({ phase: getPhase(dayCycleRef.current), time: getDisplayTime(dayCycleRef.current) })
        }
      },
    )

    loopRef.current = loop
    loop.start()

    // Auto-save every 30s
    let saveInterval: ReturnType<typeof setInterval> | undefined
    if (isSignedIn) {
      saveInterval = setInterval(() => {
        const p = playerRef.current
        save({
          spirits: spiritsToSave(spiritsRef.current),
          playerTileX: p?.tileX,
          playerTileY: p?.tileY,
          zoneId: zoneRef.current.id,
          activeBeastId: activeBeastIdRef.current,
          beasts: beastsToSave(beastsRef.current),
          inventory: inventoryToSave(invRef.current),
          chests: chestsRef.current.map(c => chestToSave(c)),
          plantedSeeds: plantedSeedsRef.current,
          plantedCrops: plantedCropsToSave(plantedCropsRef.current),
          ge: geToSave(geRef.current),
          flags: flagsRef.current,
          collectedPickups: [...collectedPickupsRef.current],
          lootedZoneChests: [...lootedZoneChestsRef.current],
          zoneChestStates: [...zoneChestStatesRef.current.entries()].map(([id, slots]) => ({ id, slots })),
          spiritIndex: indexToSave(spiritIndexRef.current),
          quests: questToSave(questStateRef.current),
          nodes: nodesToSave(nodesRef.current),
          skills: skillSetToSave(skillsRef.current),
          mana: manaToSave(manaRef.current),
          dayElapsed: dayCycleRef.current.elapsed,
          equippedTools: toolsToSave(equippedToolsRef.current),
          furniture: furnitureToSave(furnitureRef.current),
          playerStructures: structuresToSave(playerStructuresRef.current),
        })
      }, 30_000)
    }

    return () => {
      loop.stop()
      input.detach()
      stopMusic()
      resizeObs.disconnect()
      if (saveInterval) clearInterval(saveInterval)
      mpClient.disconnect()
    }
  }, [started, isSignedIn, save])

  // --- Username Picker ---
  const handleShimmerfileCreated = useCallback((username: string, characterId: string, userId?: string) => {
    shimmerfileRef.current = { user_id: userId ?? '', username, character_id: characterId }
    if (userId === DEV_USER_ID) setIsOwner(true)
    setPlayerCharId(characterId)
    setNeedsShimmerfile(false)
    startGame()
  }, [startGame])

  if (needsShimmerfile) {
    return <UsernamePicker onComplete={handleShimmerfileCreated} />
  }

  // --- Title Screen ---
  if (!started) {
    return (
      <div className={isMobile
        ? 'fixed inset-0 z-50 flex items-start justify-center px-6 pt-20 pb-8 overflow-y-auto'
        : 'min-h-[calc(100vh-80px)] flex items-start sm:items-center justify-center px-6 pt-20 sm:pt-0 pb-8'
      }>
        {/* Stepped through the Shimmer TV → you're standing IN the world-vista the
            screen showed (room/shimmer-beyond, the same image). Dimmed so the gold
            title + intro card read on top. */}
        <div
          aria-hidden
          className="fixed inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: 'url(/room/shimmer-beyond.webp)' }}
        />
        <div
          aria-hidden
          className="fixed inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 55% at 50% 44%, rgba(10,8,20,0.74), transparent 76%),' +
              'linear-gradient(rgba(8,6,16,0.5), rgba(6,5,12,0.64))',
          }}
        />
        <RoomReturn wall={0} />
        <div className="relative text-center max-w-2xl">
          <div className="mb-10">
            <h1 className="font-display text-5xl sm:text-7xl font-bold text-gold tracking-wide mb-3">
              Shimmer
            </h1>
            <p className="text-text-dim text-lg sm:text-[26px] leading-snug">
              A pocket of the Ather that belongs to you alone.
            </p>
            <p className="text-text-faint text-base sm:text-[20px] mt-2 italic font-display">
              What you find here depends on how far you wander.
            </p>
          </div>

          <button
            onClick={startGame}
            className="px-8 sm:px-12 py-3 sm:py-4 rounded-lg bg-[#d4a843] text-[#1a1a2e] font-display font-semibold text-xl sm:text-2xl hover:brightness-110 transition-all shadow-lg shadow-[#d4a843]/25 mb-10"
          >
            Enter the Shimmer
          </button>

          <div className="text-left bg-[#16142a]/60 rounded-xl p-4 sm:p-6 border border-[#d4a843]/15">
            <p className="font-display font-semibold text-text text-lg sm:text-[22px] mb-3 sm:mb-4">What is Shimmer?</p>
            <div className="space-y-2 sm:space-y-2.5 text-base sm:text-[20px] text-text-dim leading-relaxed">
              <p>A pixel sandbox set in the Ather — the dream realm of Athernyx. Golden dust, ancient creatures, and land that hasn&apos;t been touched in centuries.</p>
              <p>Tend the soil. Learn the skills the Ather teaches. Discover spirits and companions wandering the mist. Every zone has its own rhythm, its own secrets.</p>
              <p>There&apos;s no rush. No quest marker pointing you forward. Just a world — and whatever you make of it.</p>
              <p><strong className="text-text">Click</strong> to walk. <strong className="text-text">Click</strong> to interact. Progress saves to the cloud.</p>
              <p className="text-text-faint pt-1 italic">Hand-drawn pixels. Hand-built systems. No engine — just canvas and code.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Inventory items for the hotbar ---
  const inventoryItems = ITEMS
    .filter(item => countItem(inv, item.id) > 0)
    .map(item => ({ id: item.id, name: item.name, count: countItem(inv, item.id) }))

  // Effective selection — read from actual hotbar slot, not filtered ITEMS list
  const effectiveSlot = selectedSlot !== null && inv.slots[HOTBAR_START + selectedSlot] ? selectedSlot : null
  const selectedItem = effectiveSlot !== null ? (() => {
    const slot = inv.slots[HOTBAR_START + effectiveSlot]!
    const itemDef = ITEMS.find(i => i.id === slot.itemId)
    return { id: slot.itemId, name: itemDef?.name ?? slot.itemId, count: slot.count }
  })() : null
  selectedItemRef.current = selectedItem

  // --- Game View ---
  return (
    <div className={isMobile ? 'fixed inset-0 z-50 bg-[#050508]' : 'fixed inset-0 z-50 bg-[#050508] flex items-center justify-center p-4'}>
      {/* Athernyx game frame */}
      <div className={isMobile
        ? 'relative flex flex-col h-full bg-[#16142a] overflow-hidden font-semibold'
        : 'relative border border-[#d4a843]/35 rounded-xl bg-[#16142a] shadow-2xl shadow-black/60 overflow-hidden font-semibold'
      } style={isMobile ? { userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' } : undefined}>
        {/* Corner accents (desktop only) */}
        {!isMobile && <>
          <div className="absolute -top-px -left-px w-4 h-4 border-t-2 border-l-2 border-[#d4a843]/50 rounded-tl-xl" />
          <div className="absolute -top-px -right-px w-4 h-4 border-t-2 border-r-2 border-[#d4a843]/50 rounded-tr-xl" />
          <div className="absolute -bottom-px -left-px w-4 h-4 border-b-2 border-l-2 border-[#d4a843]/50 rounded-bl-xl" />
          <div className="absolute -bottom-px -right-px w-4 h-4 border-b-2 border-r-2 border-[#d4a843]/50 rounded-br-xl" />
        </>}

        {/* Frame header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#d4a843]/15">
          <div className="flex items-center gap-3">
            <span className="font-display text-[13px] text-[#d4a843]/60 tracking-[0.25em] uppercase">Shimmer</span>
            {wallet.marks > 0 && (
              <span className="text-[13px] text-[#d4a843]/40 font-display">{wallet.marks} Marks</span>
            )}
          </div>
          {isMobile ? (
            <div className="flex items-center gap-1">
              <button onClick={doSave} disabled={!isSignedIn || saveStatus === 'saving'} className="p-1.5 rounded-md active:bg-white/5 transition-colors disabled:opacity-30">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={saveStatus === 'saved' ? 'text-[#d4a843]/60' : 'text-text-faint/40'}>
                  <path d="M12 14H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6l3 3v9a1 1 0 0 1-1 1Z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6 2v3h4M6 11h4M6 9h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>
              <button onClick={toggleMenu} className="p-1.5 -mr-1 rounded-md active:bg-white/5 transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-faint/40">
                  <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <span className="text-[12px] text-text-faint/30 font-display">
              esc: menu
            </span>
          )}
        </div>

        {/* Main content area */}
        <div className={isMobile ? 'flex flex-col flex-1 min-h-0' : 'flex gap-0'}>
          {/* Canvas centering wrapper (mobile: flex-grow + center; desktop: grow into free width, center the letterboxed canvas box without vertical stretch).
              Background = the Ather: shows through the canvas's transparent margins (beyond the cloud-bordered island) + the letterbox, so the void beyond a map is dream-cosmos, not dead black. */}
          <div
            className={isMobile ? 'flex-1 min-h-0 flex items-center justify-center' : 'flex-1 min-w-0 flex justify-center items-center p-3'}
            style={{ background: 'radial-gradient(ellipse 120% 85% at 50% 38%, #2a2348 0%, #1a1730 46%, #0e0c1c 100%)' }}
          >
          {/* Canvas area — sized to the canvas itself so all overlays (mana, dialogue, etc.) anchor to the canvas edges */}
          <div
            className={isMobile ? 'relative w-full' : 'relative'}
            style={isMobile
              ? { aspectRatio: '960 / 640', maxHeight: '100%' }
              // Letterbox box: width caps at the smaller of container width or what the height budget allows.
              : { width: 'min(100%, calc((100vh - 160px) * 960 / 640))', aspectRatio: '960 / 640' }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMove}
              onTouchMove={handleCanvasMove}
              className={isMobile ? 'w-full h-full cursor-pointer' : 'w-full h-full block border border-white/5 rounded cursor-pointer'}
              style={{
                imageRendering: 'pixelated',
                ...(isMobile ? { touchAction: 'manipulation' } : {}),
              }}
              tabIndex={0}
            />

            {/* Home Plot build panel */}
            {buildMode && zoneRef.current.id === 'garden' && (
              <HomePlotPanel
                furniture={FURNITURE}
                structures={structureDefsRef.current}
                inventoryCounts={Object.fromEntries(FURNITURE.map(f => [f.id, countItem(inv, f.id)]))}
                selectedItem={selectedBuildItem}
                selectedPlacedFurnId={selectedPlacedFurnId}
                selectedPlacedStructId={selectedPlacedStructId}
                onSelectItem={(item) => { setPendingPlacement(null); setSelectedBuildItem(item) }}
                onRemoveFurniture={(id) => {
                  const placed = furnitureRef.current.find(f => f.id === id)
                  if (placed) {
                    addItems(invRef.current, placed.furnitureId, 1)
                    setInv({ ...invRef.current })
                  }
                  furnitureRef.current = furnitureRef.current.filter(f => f.id !== id)
                  setSelectedPlacedFurnId(null)
                  forceUpdate(n => n + 1)
                }}
                onRemoveStructure={(id) => {
                  playerStructuresRef.current = playerStructuresRef.current.filter(s => s.id !== id)
                  setSelectedPlacedStructId(null)
                  forceUpdate(n => n + 1)
                }}
                onClose={() => {
                  setBuildMode(false)
                  buildModeRef.current = false
                  setSelectedBuildItem(null)
                  setPendingPlacement(null)
                  setSelectedPlacedFurnId(null)
                  setSelectedPlacedStructId(null)
                  setCameraZoom(1)
                }}
                isMobile={isMobile}
              />
            )}

            {/* Build mode: zoom toggle (only in garden build mode).
                Mobile palette is a bottom sheet (z-30), so on mobile anchor top-right
                (below the clock) to stay clear of it; desktop palette is a left panel
                so bottom-right is fine. z-40 to sit above the panel either way. */}
            {buildMode && zoneRef.current.id === 'garden' && (
              <div className={`absolute right-2 z-40 flex flex-col items-center gap-0.5 ${isMobile ? 'top-14' : 'bottom-[72px]'}`}>
                <button
                  onClick={() => setCameraZoom(z => z === 0.75 ? 1 : z === 1 ? 1.5 : 0.75)}
                  className="w-10 h-10 rounded-lg bg-[#16142a]/90 border border-[#d4a843]/30 flex items-center justify-center text-[#d4a843] text-[18px] font-display hover:border-[#d4a843]/60 active:bg-[#d4a843]/15 transition-all shadow-lg"
                  title={cameraZoom === 0.75 ? 'Zoom: Out — tap to reset' : cameraZoom === 1 ? 'Zoom: Normal — tap to zoom in' : 'Zoom: In — tap to zoom out'}
                >
                  {cameraZoom === 0.75 ? '−' : cameraZoom === 1 ? '□' : '+'}
                </button>
                <span className="text-[9px] text-[#d4a843]/50 font-display leading-none">
                  {cameraZoom === 0.75 ? 'OUT' : cameraZoom === 1 ? '1×' : 'IN'}
                </span>
              </div>
            )}

            {/* Build mode: confirm / cancel / nudge bar (two-step placement) */}
            {buildMode && pendingPlacement && selectedBuildItem && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#16142a]/95 border border-[#d4a843]/30 rounded-xl px-3 py-2 shadow-xl shadow-black/40">
                {/* Nudge arrows: 3×3 grid with arrows at N/S/E/W */}
                <div className="grid grid-cols-3 gap-0.5">
                  <div />
                  <button
                    onClick={() => setPendingPlacement(p => p ? { ...p, tileY: p.tileY - 1 } : p)}
                    className="w-7 h-7 flex items-center justify-center rounded text-[#d4a843]/70 hover:bg-[#d4a843]/15 active:bg-[#d4a843]/25 text-[16px] transition-colors"
                  >↑</button>
                  <div />
                  <button
                    onClick={() => setPendingPlacement(p => p ? { ...p, tileX: p.tileX - 1 } : p)}
                    className="w-7 h-7 flex items-center justify-center rounded text-[#d4a843]/70 hover:bg-[#d4a843]/15 active:bg-[#d4a843]/25 text-[16px] transition-colors"
                  >←</button>
                  {/* Center: rotate placeholder — art not yet available */}
                  {/* TODO: add rotate button here once furniture rotation frames exist */}
                  <div className="w-7 h-7 flex items-center justify-center rounded opacity-20 text-[#d4a843]/30 text-[10px] font-display" title="Rotate — coming soon">⟳</div>
                  <button
                    onClick={() => setPendingPlacement(p => p ? { ...p, tileX: p.tileX + 1 } : p)}
                    className="w-7 h-7 flex items-center justify-center rounded text-[#d4a843]/70 hover:bg-[#d4a843]/15 active:bg-[#d4a843]/25 text-[16px] transition-colors"
                  >→</button>
                  <div />
                  <button
                    onClick={() => setPendingPlacement(p => p ? { ...p, tileY: p.tileY + 1 } : p)}
                    className="w-7 h-7 flex items-center justify-center rounded text-[#d4a843]/70 hover:bg-[#d4a843]/15 active:bg-[#d4a843]/25 text-[16px] transition-colors"
                  >↓</button>
                  <div />
                </div>
                {/* Divider */}
                <div className="w-px h-10 bg-[#d4a843]/15 mx-1" />
                {/* Cancel */}
                <button
                  onClick={() => setPendingPlacement(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-red-400/60 hover:bg-red-400/10 hover:text-red-400 active:bg-red-400/20 transition-colors text-[18px]"
                  title="Cancel placement"
                >✗</button>
                {/* Confirm */}
                <button
                  onClick={confirmPlacement}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-green-400/60 hover:bg-green-400/10 hover:text-green-400 active:bg-green-400/20 transition-colors text-[18px]"
                  title="Confirm placement"
                >✓</button>
              </div>
            )}

            {/* Mana bar */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5">
              <div className="w-[80px] h-[6px] bg-black/50 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full bg-blue-400/80 transition-all duration-200"
                  style={{ width: `${Math.max(0, (manaDisplay.current / manaDisplay.max) * 100)}%` }}
                />
              </div>
              <span className="text-[13px] text-blue-300/60 font-mono tabular-nums">
                {manaDisplay.current}/{manaDisplay.max}
              </span>
            </div>

            {/* Day/night time display */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
              <span className="text-[13px] font-mono tabular-nums" style={{
                color: dayPhase.phase === 'night' ? '#8090c0' : dayPhase.phase === 'dusk' ? '#c090d0' : dayPhase.phase === 'dawn' ? '#e0a060' : '#d0d0a0',
                opacity: 0.7,
              }}>
                {dayPhase.time}
              </span>
              <span className="text-[12px] uppercase tracking-wider" style={{
                color: dayPhase.phase === 'night' ? '#6070a0' : dayPhase.phase === 'dusk' ? '#a070b0' : dayPhase.phase === 'dawn' ? '#c08040' : '#a0a080',
                opacity: 0.5,
              }}>
                {dayPhase.phase}
              </span>
            </div>

            {/* XP floaters (world-positioned) */}
            <XpFloaterLayer
              floaters={floaters}
              cameraRef={rendererRef as React.RefObject<{ camX: number; camY: number } | null>}
              worldWidth={WIDTH}
              worldHeight={HEIGHT}
            />

            {/* Notification toast stack */}
            <NotificationStack notifications={notifications} />

            {/* Dialogue textbox — stone bubble (tappable to advance) */}
            {dialogueUI && (
              <div className="absolute bottom-5 left-3 right-3 z-10">
                <div
                  className="bg-[#16142a]/95 border border-[#d4a843]/40 rounded-lg px-4 py-3 shadow-lg shadow-black/40"
                  onClick={(e) => {
                    // Tap to advance dialogue (don't interfere with choice buttons)
                    if (dialogueUI.choices && dialogueUI.choices.length > 0) return
                    if (!dialogueUI.complete) return
                    e.stopPropagation()
                    const ds = dialogueRef.current
                    const ctx = buildCtx()
                    advanceDialogue(ds, ctx)
                    const actions = consumeActions(ds)
                    if (actions) processDialogueActions(actions)
                    if (!ds.active) {
                      setDialogueUI(null)
                      lastDialogueChars.current = -1
                      voiceRef.current = null
                    }
                  }}
                >
                  {dialogueUI.speaker && dialogueUI.speaker !== 'narrator' && (
                    <p className="text-[#d4a843] font-display text-[12px] mb-1 tracking-wide">{dialogueUI.speaker}</p>
                  )}
                  <p className="text-white/90 text-[14px] leading-relaxed min-h-[1.4em]">
                    {dialogueUI.text}
                    {!dialogueUI.complete && <span className="text-white/40 animate-pulse">|</span>}
                  </p>
                  {/* Choice buttons */}
                  {dialogueUI.choices && dialogueUI.choices.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                      {dialogueUI.choices.map((opt, i) => (
                        <button
                          key={i}
                          className="text-left text-[13px] font-display px-4 py-2 rounded-lg border border-[#d4a843]/25 text-white/80 hover:bg-[#d4a843]/15 hover:text-[#d4a843] hover:border-[#d4a843]/40 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            const ds = dialogueRef.current
                            const ctx = buildCtx()
                            selectChoice(ds, i, ctx)
                            const actions = consumeActions(ds)
                            if (actions) processDialogueActions(actions)
                            if (!ds.active) {
                              setDialogueUI(null)
                              lastDialogueChars.current = -1
                              voiceRef.current = null
                            }
                          }}
                        >
                          ▸ {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Advance prompt (only when no choices) */}
                  {dialogueUI.complete && !dialogueUI.choices && (
                    <p className="text-[#d4a843]/40 text-[12px] text-right mt-1">{isMobile ? 'Tap ▼' : 'Space ▼'}</p>
                  )}
                </div>
              </div>
            )}

            {/* Encounter choice overlay */}
            {encounterChoice && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                <div className="bg-[#16142a]/95 border border-[#d4a843]/40 rounded-xl px-6 py-5 shadow-lg shadow-black/50 min-w-[280px]">
                  <p className="text-[#d4a843] font-display text-[13px] tracking-wide mb-1">Wild Spirit Appeared</p>
                  <p className="text-white/80 text-[15px] mb-4">
                    {encounterChoice.encounter.name}
                    <span className="text-white/40 text-[12px] ml-2">Lv.{encounterChoice.encounter.level}</span>
                    {encounterChoice.encounter.element !== 'base' && (
                      <span className="text-[13px] ml-2 px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                        {encounterChoice.encounter.element}
                      </span>
                    )}
                  </p>
                  {(['Avoid', 'Study', 'Challenge'] as const).map((label, i) => {
                    const descriptions = [
                      'Walk away quietly',
                      'Observe and record data',
                      'Engage in battle',
                    ]
                    const colors = ['#8090a0', '#60c0e0', '#e08040']
                    return (
                      <div
                        key={label}
                        className="flex items-center gap-3 py-1.5 px-3 rounded cursor-pointer transition-colors"
                        style={{
                          background: encounterChoice.selected === i ? 'rgba(212,168,67,0.15)' : 'transparent',
                          borderLeft: encounterChoice.selected === i ? '2px solid #d4a843' : '2px solid transparent',
                        }}
                        onClick={() => handleEncounterChoice(label.toLowerCase() as 'avoid' | 'study' | 'challenge')}
                        onMouseEnter={() => setEncounterChoice(prev => prev ? { ...prev, selected: i } : null)}
                      >
                        <span className="text-[14px] font-display tracking-wide" style={{ color: colors[i] }}>
                          {label}
                        </span>
                        <span className="text-white/30 text-[13px]">{descriptions[i]}</span>
                      </div>
                    )
                  })}
                  <p className="text-white/20 text-[12px] text-right mt-3">{isMobile ? 'Tap to choose' : '↑↓ select · Space confirm'}</p>
                </div>
              </div>
            )}

            {/* Seed choice overlay — Gregory presents 3 random seeds */}
            {seedChoice && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                <div className="bg-[#16142a]/95 border border-[#d4a843]/40 rounded-xl px-6 py-5 shadow-lg shadow-black/50 min-w-[280px]">
                  <p className="text-[#d4a843] font-display text-[13px] tracking-wide mb-1">Choose a Mana Seed</p>
                  <p className="text-white/50 text-[13px] mb-4">Each holds the essence of a spirit</p>
                  <div className="flex gap-3 justify-center">
                    {seedChoice.seeds.map((seedId, i) => {
                      const item = ITEMS.find(it => it.id === seedId)
                      const species = SEED_SPECIES[seedId]
                      const speciesName = species ? speciesDisplayName(species) : seedId
                      const selected = seedChoice.selected === i
                      const pal = SEED_PALETTES[seedId]
                      return (
                        <div
                          key={seedId}
                          className="flex flex-col items-center gap-1 p-2 rounded cursor-pointer transition-all"
                          style={{
                            background: selected ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.03)',
                            border: selected ? '1px solid #d4a843' : '1px solid rgba(255,255,255,0.08)',
                            transform: selected ? 'scale(1.05)' : 'scale(1)',
                          }}
                          onClick={() => {
                            const picked = seedChoice.seeds[i]
                            addItems(invRef.current, picked, 1)
                            setInv({ ...invRef.current })
                            setSeedChoice(null)
                            const ds = dialogueRef.current
                            startDialogue(ds, 'gregory-tablet', buildCtx())
                            loopRef.current?.resume()
                          }}
                          onMouseEnter={() => setSeedChoice(prev => prev ? { ...prev, selected: i } : null)}
                        >
                          {/* Seed color swatch */}
                          <div
                            className="w-8 h-8 rounded-full border border-white/10"
                            style={{ background: pal ? `radial-gradient(circle, ${pal[0]}, ${pal[1]})` : '#555' }}
                          />
                          <span className="text-white/90 text-[12px] font-display tracking-wide">{speciesName}</span>
                          <span className="text-white/40 text-[13px] text-center leading-tight max-w-[80px]">
                            {item?.description?.replace('A crystallized seed ', '') ?? ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-white/20 text-[12px] text-right mt-3">{isMobile ? 'Tap to choose' : '←→ select · Space confirm'}</p>
                </div>
              </div>
            )}

            {/* Battle overlay — party turn-based combat (1v1 retired) */}
            {battleData && (
              <PartyBattleScene
                allySpirits={battleData.allyParty}
                enemySpirits={battleData.enemyParty}
                zoneId={battleData.zoneId}
                reach={battleData.reach}
                keeper={battleData.keeper}
                ai={{ focusFire: battleData.aiTier !== 'wild', spendMana: battleData.aiTier !== 'wild' }}
                onEnd={handleBattleEnd}
              />
            )}

            {/* Evolution overlay */}
            {evolutionPending && (
              <EvolutionOverlay
                spirit={evolutionPending}
                sprites={SPRITE_MAP}
                onComplete={handleEvolutionComplete}
              />
            )}

            {/* Grimoire overlay */}
            {grimoireOpen && (
              <Grimoire
                spirits={spiritsRef.current}
                index={spiritIndexRef.current}
                sprites={SPRITE_MAP}
                onClose={() => setGrimoireOpen(false)}
              />
            )}

            {/* Spirit Console overlay */}
            {consoleOpen && (
              <SpiritConsole
                spirits={spiritsRef.current}
                sprites={SPRITE_MAP}
                onClose={() => setConsoleOpen(false)}
                onSwapParty={handleSwapParty}
              />
            )}

            {/* World Map Overlay */}
            {/* Remote player social popup */}
            {playerPopup && (
              <div
                className="fixed z-[55] animate-in fade-in"
                style={{ left: playerPopup.screenX + 8, top: playerPopup.screenY - 8 }}
              >
                <div className="bg-[#16142a] border border-[#d4a843]/30 rounded-lg shadow-xl shadow-black/50 p-3 min-w-[140px]">
                  <p className="text-[13px] text-[#d4a843] font-display mb-2">{playerPopup.username}</p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={async () => {
                        await fetch('/api/friends', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'add', username: playerPopup.username }),
                        })
                        setPlayerPopup(null)
                        notify('generic', `Friend request sent to ${playerPopup.username}`, { duration: 3000 })
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded text-[12px] text-text hover:bg-[#d4a843]/15 hover:text-[#d4a843] transition-colors"
                    >
                      Add Friend
                    </button>
                    {zoneRef.current.id === 'garden' && (
                      <button
                        onClick={() => {
                          // TODO: send garden invite via WebSocket
                          setPlayerPopup(null)
                          notify('generic', `Invited ${playerPopup.username} to your garden`, { duration: 3000 })
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded text-[12px] text-text hover:bg-[#d4a843]/15 hover:text-[#d4a843] transition-colors"
                      >
                        Invite to Garden
                      </button>
                    )}
                    <button
                      onClick={() => setPlayerPopup(null)}
                      className="w-full text-left px-2.5 py-1.5 rounded text-[12px] text-text-faint hover:bg-white/5 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showWorldMap && (
              <WorldMapOverlay
                currentZoneId={zoneRef.current.id}
                flags={flagsRef.current}
                onClose={() => setShowWorldMap(false)}
                onWarp={(zoneId) => {
                  if (!flagsRef.current['atherGateReceived']) return
                  if (zoneId === zoneRef.current.id) return
                  const visited = zoneId === 'garden' || flagsRef.current[`visited_${zoneId}`]
                  if (!visited) return
                  const target = getZone(ZONES, zoneId)
                  if (!target) return
                  const spawn = target.playerStart ?? { tileX: 10, tileY: 8 }
                  pendingTeleportRef.current = { zoneId, tileX: spawn.tileX, tileY: spawn.tileY }
                  setShowWorldMap(false)
                }}
              />
            )}
          </div>
          </div>{/* close canvas centering wrapper */}

          {/* Right panel: world map button + sidebar buttons (desktop only) */}
          <div className={`flex flex-col gap-2 p-3 pl-0 min-w-[130px] ${isMobile ? 'hidden' : ''}`}>
            {/* World Map button — replaces minimap */}
            <button
              onClick={() => setShowWorldMap(true)}
              className="group bg-[#16142a]/90 border border-[#d4a843]/30 rounded-xl p-3 flex flex-col items-center gap-2 hover:border-[#d4a843]/50 hover:bg-[#d4a843]/8 transition-all cursor-pointer"
            >
              <div className="relative w-10 h-10 flex items-center justify-center">
                {/* Compass / globe icon */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[#d4a843]/70 group-hover:text-[#d4a843] transition-colors">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 3c-2 3-3 6-3 9s1 6 3 9M12 3c2 3 3 6 3 9s-1 6-3 9" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
                  <path d="M3 12h18" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
                  <path d="M4.5 7.5h15M4.5 16.5h15" stroke="currentColor" strokeWidth="0.75" opacity="0.25"/>
                  <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3"/>
                </svg>
                {/* Subtle glow pulse */}
                <div className="absolute inset-0 rounded-full bg-[#d4a843]/5 group-hover:bg-[#d4a843]/15 transition-colors" />
              </div>
              <div className="text-center">
                <span className="text-[12px] font-display text-[#d4a843]/60 group-hover:text-[#d4a843]/90 transition-colors block">{zoneRef.current.name}</span>
              </div>
            </button>

            {/* Sidebar buttons */}
            <div className="bg-[#16142a]/90 border border-[#d4a843]/30 rounded-xl p-2 flex flex-col gap-0.5">
              {/* Collapse toggle */}
              <button
                onClick={() => setSidebarCollapsed(prev => !prev)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-all hover:bg-[#d4a843]/10 text-text-dim/50"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`flex-shrink-0 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}>
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[12px] font-display">{sidebarCollapsed ? 'Menu' : 'Collapse'}</span>
              </button>

              {!sidebarCollapsed && <>
              {/* Save */}
              <button
                onClick={doSave}
                disabled={!isSignedIn || saveStatus === 'saving'}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-[#d4a843]/12 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M12 14H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6l3 3v9a1 1 0 0 1-1 1Z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6 2v3h4M6 11h4M6 9h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span className="text-sm font-display text-text-dim">
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save'}
                </span>
              </button>

              {/* Build (garden only) */}
              {zoneRef.current.id === 'garden' && (
                <button
                  onClick={() => {
                    setBuildMode(prev => {
                      const next = !prev
                      buildModeRef.current = next
                      if (!next) {
                        setSelectedBuildItem(null)
                        setPendingPlacement(null)
                        setSelectedPlacedFurnId(null)
                        setSelectedPlacedStructId(null)
                        setCameraZoom(1)
                      }
                      return next
                    })
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                    buildMode ? 'bg-[#d4a843]/18 text-[#d4a843]' : 'hover:bg-[#d4a843]/10 text-text-dim'
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                    <path d="M3 13l3-3 7-7-3-3-7 7-3 3h3ZM10 3l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-sm font-display">Build</span>
                </button>
              )}

              {/* Bag */}
              <button
                onClick={() => { setBagOpen(prev => !prev); if (sidePanel === 'bag') setSidePanel(null) }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                  bagOpen ? 'bg-[#d4a843]/18 text-[#d4a843]' : 'hover:bg-[#d4a843]/10 text-text-dim'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M5 5V4a3 3 0 0 1 6 0v1M3 5h10l-1 9H4L3 5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm font-display">Bag</span>
              </button>

              {/* Character */}
              <button
                onClick={() => setSidePanel(sidePanel === 'profile' ? null : 'profile')}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                  sidePanel === 'profile' ? 'bg-[#d4a843]/18 text-[#d4a843]' : 'hover:bg-[#d4a843]/10 text-text-dim'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3 14c0-3 2-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span className="text-sm font-display">Character</span>
              </button>

              {/* Options */}
              <button
                onClick={() => setSidePanel(sidePanel === 'options' ? null : 'options')}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                  sidePanel === 'options' ? 'bg-[#d4a843]/18 text-[#d4a843]' : 'hover:bg-[#d4a843]/10 text-text-dim'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span className="text-sm font-display">Options</span>
              </button>
              <button
                onClick={() => setSidePanel(sidePanel === 'skills' ? null : 'skills')}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                  sidePanel === 'skills' ? 'bg-[#d4a843]/18 text-[#d4a843]' : 'hover:bg-[#d4a843]/10 text-text-dim'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M2 13V7l3-2v8M7 13V5l3-2v10M12 13V3l3-2v12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm font-display">Skills</span>
              </button>

              {/* Quests */}
              <button
                onClick={() => setSidePanel(sidePanel === 'quests' ? null : 'quests')}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                  sidePanel === 'quests' ? 'bg-[#d4a843]/18 text-[#d4a843]' : 'hover:bg-[#d4a843]/10 text-text-dim'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6 5.5l1 1 2-2M6 9.5l1 1 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm font-display">Quests</span>
              </button>

              {/* Grimoire — spirit index + party viewer */}
              <button
                onClick={() => setGrimoireOpen(prev => !prev)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                  grimoireOpen ? 'bg-[#d4a843]/18 text-[#d4a843]' : 'hover:bg-[#d4a843]/10 text-text-dim'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M3 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V2Z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M3 12h8M6 5h4M6 7.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
                <span className="text-sm font-display">Grimoire</span>
              </button>
              </>}
            </div>
          </div>

          {/* Side panel popup */}
          {sidePanel && (
            <div className={`${isMobile
              ? 'fixed inset-0 bg-[#1e1c38] z-[60] flex flex-col overflow-hidden'
              : 'absolute right-[150px] top-3 bottom-3 w-[320px] bg-[#1e1c38]/95 border border-[#d4a843]/35 rounded-xl shadow-2xl shadow-black/40 backdrop-blur-sm z-20 flex flex-col overflow-hidden'
            }`}>
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4a843]/15">
                {sidePanel === 'spirits' && selectedSpiritId ? (
                  <button
                    onClick={() => setSelectedSpiritId(null)}
                    className="flex items-center gap-1.5 text-text-faint/60 hover:text-[#d4a843] transition-colors font-display text-xs"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Party
                  </button>
                ) : (
                  <span className="font-display text-[#d4a843] text-xs tracking-widest uppercase">
                    {sidePanel === 'beasts' ? "Mana'mals" : sidePanel === 'console' ? 'Spirit Console' : sidePanel === 'skills' ? 'Skills' : sidePanel === 'crafting' ? 'Crafting Table' : sidePanel === 'alchemy' ? 'Alchemy Table' : sidePanel === 'exchange' ? 'Ather Exchange' : sidePanel === 'quests' ? 'Quests' : sidePanel === 'profile' ? 'Character' : sidePanel}
                  </span>
                )}
                <button
                  onClick={() => {
                    setSidePanel(null); setSelectedSpiritId(null)
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors text-sm font-bold"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto p-4 shimmer-scroll">
                {/* Spirits panel — list or detail view */}
                {sidePanel === 'spirits' && (() => {
                  const selected = selectedSpiritId ? spiritsRef.current.find(s => s.id === selectedSpiritId) : null

                  // --- Detail view ---
                  if (selected) {
                    const xpNeeded = xpForLevel(selected.level)
                    const xpPct = xpNeeded > 0 ? Math.min(100, (selected.xp / xpNeeded) * 100) : 0
                    const boosted = hasFruitBoost(selected)
                    const stage = formStage(selected.level)
                    const seedNames = ['Vigor', 'Grace', 'Grit', 'Wit', 'Heart', 'Luck']
                    return (
                      <div className="space-y-4">
                        {/* Sprite + identity */}
                        <div className="flex items-center gap-4">
                          <div className="rounded-lg p-1 bg-white/[0.03] border border-[#d4a843]/10">
                            <SpriteIcon species={selected.species} variant={selected.variant} element={selected.element} size={48} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display text-base text-text">{selected.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[12px] text-text-faint/50">{speciesDisplayName(selected.species)}</span>
                              <span className="text-[13px] text-text-faint/30">-</span>
                              <span className="text-[13px] text-text-faint/40 capitalize">{selected.temperament}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {selected.element !== 'base' ? (
                                <>
                                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ELEMENT_COLORS[selected.element] }} />
                                  <span className="text-[13px] font-display" style={{ color: ELEMENT_COLORS[selected.element] }}>
                                    {getSecondFormName(selected.species, selected.element)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[13px] text-text-faint/50 capitalize">{stage} form</span>
                              )}
                              {boosted && <span className="text-[13px] text-[#90d870] font-display">BOOSTED</span>}
                            </div>
                          </div>
                        </div>

                        {/* Seeds (IVs) */}
                        <div className="bg-white/[0.02] rounded-lg p-3 border border-[#d4a843]/10">
                          <span className="text-[12px] text-text-faint/50 font-display uppercase tracking-wider">Seeds</span>
                          <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 mt-2">
                            {seedNames.map((name, i) => {
                              const val = selected.seeds[i] ?? 0
                              const pct = (val / 31) * 100
                              return (
                                <div key={name} className="flex items-center gap-1.5">
                                  <span className="text-[12px] text-text-faint/40 w-[32px]">{name}</span>
                                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#8b9dc3]/50 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[13px] text-text-faint/30 w-[14px] text-right">{val}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // --- List view ---
                  return (
                    <div className="space-y-2">
                      {spiritsRef.current.filter(s => s.inParty).map(s => {
                        const xpNeeded = xpForLevel(s.level)
                        const xpPct = xpNeeded > 0 ? Math.min(100, (s.xp / xpNeeded) * 100) : 0
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSpiritId(s.id)}
                            className="w-full text-left rounded-lg p-2.5 transition-colors bg-white/[0.03] border border-[#d4a843]/10 hover:bg-[#d4a843]/[0.06]"
                          >
                            <div className="flex items-center gap-2.5">
                              <SpriteIcon species={s.species} variant={s.variant} element={s.element} size={32} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-display text-[12px] text-text">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[13px] text-text-faint/60">Lv.{s.level}</span>
                                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#d4a843]/60 rounded-full transition-all" style={{ width: `${xpPct}%` }} />
                                  </div>
                                </div>
                              </div>
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-text-faint/20 flex-shrink-0"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Bag panel */}
                {/* Bag moved to bottom hotbar area */}

                {/* Character panel — player + companion selection */}
                {sidePanel === 'profile' && (
                  <div className="space-y-5">
                    {/* Player Characters — horizontal sprite bar */}
                    <div>
                      <span className="text-[13px] text-text-faint/50 font-display uppercase tracking-wider block mb-3">Character</span>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {PLAYABLE_CHARACTERS.filter(c => !c.exclusive || c.exclusive === shimmerfileRef.current?.user_id).map(char => {
                          const isActive = playerCharId === char.id
                          const locked = char.unlock ? !flagsRef.current[char.unlock] : false
                          const sprite = char.sprites.down_idle
                          const frame = sprite?.frames[0]
                          return (
                            <button
                              key={char.id}
                              onClick={() => { if (!locked) setPlayerCharId(char.id) }}
                              className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-w-[72px] ${
                                isActive ? 'bg-[#d4a843]/15 border-[#d4a843]/40' : locked ? 'bg-white/[0.02] border-white/5' : 'bg-white/[0.03] border-white/10 hover:border-[#d4a843]/25'
                              }`}
                            >
                              {/* Sprite preview — blacked out if locked */}
                              <canvas
                                width={32} height={32}
                                style={{ imageRendering: 'pixelated', width: 48, height: 48 }}
                                ref={el => {
                                  if (!el || !frame) return
                                  const ctx = el.getContext('2d')!
                                  ctx.clearRect(0, 0, 32, 32)
                                  const pal = locked ? char.palette.map(() => '#111118') : [...char.palette]
                                  const ss = Math.sqrt(frame.length)
                                  for (let y = 0; y < ss; y++)
                                    for (let x = 0; x < ss; x++) {
                                      const v = frame[y * ss + x]
                                      if (v > 0 && v <= pal.length) {
                                        ctx.fillStyle = pal[v - 1]
                                        ctx.fillRect(x, y, 1, 1)
                                      }
                                    }
                                }}
                              />
                              <span className={`text-[12px] font-display ${locked ? 'text-text-faint/25' : isActive ? 'text-[#d4a843]' : 'text-text'}`}>
                                {locked ? '???' : char.name}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Mana'mal Companions — horizontal sprite bar */}
                    <div>
                      <span className="text-[13px] text-text-faint/50 font-display uppercase tracking-wider block mb-3">Companion</span>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {/* No companion option */}
                        <button
                          onClick={() => { setActiveBeastId(null); forceUpdate(n => n + 1) }}
                          className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-w-[72px] ${
                            !activeBeastId ? 'bg-white/[0.05] border-white/20' : 'bg-white/[0.02] border-white/8 hover:border-white/15'
                          }`}
                        >
                          <div className="w-[48px] h-[48px] flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="text-text-faint/30">
                              <path d="M4 12l8-8M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <span className={`text-[12px] font-display ${!activeBeastId ? 'text-text-faint/60' : 'text-text-faint/30'}`}>None</span>
                        </button>
                        {BEAST_SPECIES.map(species => {
                          const owned = beastsRef.current.find(b => b.species === species)
                          const isActive = owned?.id === activeBeastId
                          const def = BEAST_DEFS[species]
                          const beastSprites = BEAST_SPRITES[species]
                          const beastPalette = BEAST_PALETTES[species]
                          const anim = beastSprites?.idle ?? beastSprites?.down_idle
                          const frame = anim?.frames[0]
                          return (
                            <button
                              key={species}
                              onClick={() => { if (owned) { setActiveBeastId(owned.id); forceUpdate(n => n + 1) } }}
                              className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-w-[72px] ${
                                isActive ? 'bg-[#d4a843]/15 border-[#d4a843]/40' : !owned ? 'bg-white/[0.02] border-white/5' : 'bg-white/[0.03] border-white/10 hover:border-[#d4a843]/25'
                              }`}
                            >
                              {/* Beast sprite — silhouette if not owned */}
                              <canvas
                                width={16} height={16}
                                style={{ imageRendering: 'pixelated', width: 48, height: 48 }}
                                ref={el => {
                                  if (!el || !frame || !beastPalette) return
                                  const ctx = el.getContext('2d')!
                                  ctx.clearRect(0, 0, 16, 16)
                                  const pal = !owned ? beastPalette.map(() => '#111118') : [...beastPalette]
                                  const ss = Math.sqrt(frame.length)
                                  for (let y = 0; y < ss; y++)
                                    for (let x = 0; x < ss; x++) {
                                      const v = frame[y * ss + x]
                                      if (v > 0 && v <= pal.length) {
                                        ctx.fillStyle = pal[v - 1]
                                        ctx.fillRect(x, y, 1, 1)
                                      }
                                    }
                                }}
                              />
                              <span className={`text-[12px] font-display ${!owned ? 'text-text-faint/25' : isActive ? 'text-[#d4a843]' : 'text-text'}`}>
                                {owned ? def.name : '???'}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex gap-3">
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2 border border-[#d4a843]/10 flex-1">
                        <span className="text-[12px] text-text-faint/40 font-display">Marks</span>
                        <p className="font-display text-[#d4a843] text-sm">{wallet.marks}</p>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg px-3 py-2 border border-[#d4a843]/10 flex-1">
                        <span className="text-[12px] text-text-faint/40 font-display">Zone</span>
                        <p className="font-display text-text text-sm">{zoneRef.current.name}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Options panel */}
                {sidePanel === 'options' && (
                  <div className="space-y-3">
                    {isOwner && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-text-faint/40 font-display uppercase tracking-wider">Dev · Map Tools</div>
                        <button
                          onClick={() => { window.location.href = `/shimmer/dev?mode=map&zone=${zoneRef.current.id}` }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left bg-white/[0.03] border border-[#d4a843]/20 hover:bg-[#d4a843]/10 transition-all"
                        >
                          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-[#d4a843]">
                            <path d="M2 11.5V14h2.5l7-7L9 4.5l-7 7ZM10 3.5L12.5 6 14 4.5 11.5 2 10 3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-display text-text">Edit Map</span>
                            <span className="block text-[12px] text-text-faint/40 truncate">Draw &ldquo;{zoneRef.current.name}&rdquo; in the editor</span>
                          </span>
                        </button>
                      </div>
                    )}
                    <div className="text-center py-6">
                      <p className="text-text-faint/40 text-[13px] font-display">Nothing else to configure yet</p>
                      <p className="text-text-faint/25 text-[13px] mt-1">Sound and controls coming soon</p>
                    </div>
                  </div>
                )}

                {/* Friends panel (Community Gate) */}
                {sidePanel === 'friends' && (
                  <FriendsPanel
                    onClose={() => setSidePanel(null)}
                    onVisitGarden={(friendUserId) => {
                      // Teleport to friend's garden
                      const gardenZone = getZone(ZONES, 'garden')
                      if (!gardenZone) return
                      const spawn = gardenZone.playerStart ?? { tileX: 14, tileY: 8 }
                      mpClientRef.current?.changeZone('garden', friendUserId)
                      pendingTeleportRef.current = { zoneId: 'garden', tileX: spawn.tileX, tileY: spawn.tileY }
                      setSidePanel(null)
                    }}
                    onInviteToGarden={(friendUserId) => {
                      // TODO: send invite via WebSocket (friend gets notification)
                      notify('generic', `Invited friend to your garden`, { duration: 3000 })
                    }}
                  />
                )}

                {/* Skills panel */}
                {sidePanel === 'skills' && (() => {
                  const skills = skillsRef.current
                  const mana = manaRef.current
                  const manaLevel = skills.mana.level
                  return (
                    <div className="space-y-2">
                      {/* Mana pool summary */}
                      <div className="bg-white/[0.03] rounded-lg p-3 border border-[#d4a843]/10 mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] text-text-faint/40 font-display uppercase tracking-wider">Mana Pool</span>
                          <span className="text-[13px] text-blue-300/70 font-mono tabular-nums">
                            {Math.floor(mana.current)}/{getMaxPool(manaLevel)}
                          </span>
                        </div>
                        <div className="w-full h-[6px] bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400/60 rounded-full transition-all duration-300"
                            style={{ width: `${(mana.current / getMaxPool(manaLevel)) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Skill rows */}
                      {SKILL_IDS.map(id => {
                        const skill = skills[id]
                        const meta = SKILL_META[id]
                        const needed = xpForSkillLevel(skill.level)
                        const progress = needed > 0 ? (skill.xp / needed) * 100 : 100
                        const milestone = getMilestone(skill.level)
                        const color = SKILL_COLORS[id] ?? '#d4a843'

                        if (meta.locked) {
                          return (
                            <div key={id} className="bg-white/[0.02] rounded-lg p-3 border border-[#d4a843]/8 opacity-40">
                              <div className="flex items-center justify-between">
                                <span className="font-display text-[12px] text-text-faint">{meta.name}</span>
                                <span className="text-[13px] text-text-faint/50 italic">{meta.locked} — coming soon</span>
                              </div>
                            </div>
                          )
                        }

                        const isPulsing = levelUpPulse?.skillId === id && Date.now() - levelUpPulse.ts < 1400
                        return (
                          <div key={id} className="bg-white/[0.03] rounded-lg p-3 border border-[#d4a843]/10">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-display text-[12px] text-text">{meta.name}</span>
                                {milestone && (
                                  <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-[#d4a843]/10 text-[#d4a843]/70 font-display">
                                    {milestone}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[13px] font-display tabular-nums ${isPulsing ? 'shimmer-level-pulse' : ''}`}
                                style={{ color, ...(isPulsing ? { textShadow: `0 0 8px ${color}` } : null) }}
                              >
                                Lv {skill.level}
                              </span>
                            </div>
                            <div className="w-full h-[5px] bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, progress)}%`, backgroundColor: color }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[13px] text-text-faint/30 font-mono tabular-nums">
                                {skill.xp}/{needed} XP
                              </span>
                              {id !== 'mana' && (
                                <span className="text-[13px] text-text-faint/25">
                                  {meta.manaCost} mana/use
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Crafting panel */}
                {sidePanel === 'crafting' && (() => {
                  const allTools = Object.entries(TOOL_DEFS)
                  return (
                    <div className="space-y-3">
                      <p className="text-[12px] text-text-faint/40 font-display">Combine materials to craft tools. Tools boost harvesting speed and XP.</p>
                      {allTools.map(([toolId, def]) => {
                        const craftable = canCraft(toolId, inv)
                        const equipped = equippedToolsRef.current[def.skillId]?.toolId === toolId
                        return (
                          <div key={toolId} className="bg-white/[0.03] rounded-lg p-3 border border-[#d4a843]/10">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-display text-[12px] text-text">{def.name}</span>
                                <p className="text-[13px] text-text-faint/40 mt-0.5 capitalize">{def.skillId} tool &middot; Tier {def.tier}</p>
                              </div>
                              {equipped && <span className="text-[13px] text-[#d4a843] font-display border border-[#d4a843]/30 rounded px-1 py-0.5">EQUIPPED</span>}
                            </div>
                            <div className="mb-2">
                              <p className="text-[13px] text-text-faint/40 mb-1">Requires:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {def.recipe.map(({ itemId, count }) => {
                                  const have = countItem(inv, itemId)
                                  const enough = have >= count
                                  const itemDef = ITEMS.find(i => i.id === itemId)
                                  return (
                                    <span key={itemId} className={`text-[13px] font-display px-1.5 py-0.5 rounded border ${enough ? 'border-white/10 text-text-faint/60' : 'border-red-500/30 text-red-400/60'}`}>
                                      {itemDef?.name ?? itemId} {have}/{count}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const tool = craftTool(toolId, invRef.current)
                                if (tool) {
                                  setInv({ ...invRef.current })
                                  equippedToolsRef.current[def.skillId] = tool
                                  forceUpdate(n => n + 1)
                                }
                              }}
                              disabled={!craftable}
                              className="w-full text-[13px] font-display py-1.5 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-[#d4a843]/20 hover:border-[#d4a843]/40 text-[#d4a843]/70 hover:text-[#d4a843]"
                            >
                              Craft &amp; Equip
                            </button>
                          </div>
                        )
                      })}
                      {allTools.length === 0 && (
                        <p className="text-text-faint/30 text-[12px] font-display text-center py-6">No tools available yet</p>
                      )}

                      {/* Furniture crafting */}
                      {(() => {
                        const craftableFurniture = FURNITURE.filter(f => f.recipe && f.recipe.length > 0)
                        if (craftableFurniture.length === 0) return null
                        return (
                          <>
                            <div className="border-t border-white/5 pt-3 mt-1">
                              <p className="text-[12px] text-text-faint/40 font-display mb-2">Furniture — place in the world for storage and crafting.</p>
                            </div>
                            {craftableFurniture.map(f => {
                              const hasAll = f.recipe!.every(r => countItem(inv, r.itemId) >= r.count)
                              const isChest = !!f.chestSlots
                              const totalChests = isChest ? countChestsInInventory(invRef.current) + furnitureRef.current.filter(pf => isChestItem(pf.furnitureId)).length : 0
                              const atChestCap = isChest && totalChests >= MAX_CHESTS
                              return (
                                <div key={f.id} className="bg-white/[0.03] rounded-lg p-3 border border-[#d4a843]/10">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <span className="font-display text-[12px] text-text">{f.name}</span>
                                      <p className="text-[13px] text-text-faint/40 mt-0.5">{f.description}</p>
                                    </div>
                                    {isChest && (
                                      <span className="text-[13px] text-text-faint/30 font-display">{totalChests}/{MAX_CHESTS}</span>
                                    )}
                                  </div>
                                  <div className="mb-2">
                                    <p className="text-[13px] text-text-faint/40 mb-1">Requires:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {f.recipe!.map(({ itemId: rid, count: rcount }) => {
                                        const have = countItem(inv, rid)
                                        const enough = have >= rcount
                                        const rDef = ITEMS.find(i => i.id === rid)
                                        return (
                                          <span key={rid} className={`text-[13px] font-display px-1.5 py-0.5 rounded border ${enough ? 'border-white/10 text-text-faint/60' : 'border-red-500/30 text-red-400/60'}`}>
                                            {rDef?.name ?? rid} {have}/{rcount}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (!hasAll || atChestCap) return
                                      for (const r of f.recipe!) removeItems(invRef.current, r.itemId, r.count)
                                      addItems(invRef.current, f.id, 1)
                                      setInv({ ...invRef.current })
                                      forceUpdate(n => n + 1)
                                    }}
                                    disabled={!hasAll || atChestCap}
                                    className="w-full text-[13px] font-display py-1.5 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-[#d4a843]/20 hover:border-[#d4a843]/40 text-[#d4a843]/70 hover:text-[#d4a843]"
                                  >
                                    {atChestCap ? `Chest limit (${MAX_CHESTS})` : 'Craft'}
                                  </button>
                                </div>
                              )
                            })}
                          </>
                        )
                      })()}
                    </div>
                  )
                })()}

                {/* Alchemy panel */}
                {sidePanel === 'alchemy' && (() => {
                  const visiblePotions = getVisiblePotions(skillsRef.current.alchemy.level)
                  const alchLvl = skillsRef.current.alchemy.level
                  return (
                    <div className="space-y-3">
                      <p className="text-[12px] text-text-faint/40 font-display">Brew potions from gathered resources. Costs mana and grants Alchemy XP.</p>
                      {visiblePotions.map(def => {
                        const brewable = canBrew(def.id, inv, alchLvl, manaRef.current)
                        const locked = alchLvl < def.minAlchemyLevel
                        return (
                          <div key={def.id} className={`bg-white/[0.03] rounded-lg p-3 border border-[#d4a843]/10 ${locked ? 'opacity-40' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-display text-[12px] text-text">{def.name}</span>
                                <p className="text-[13px] text-text-faint/40 mt-0.5">Tier {def.tier} &middot; Lvl {def.minAlchemyLevel} &middot; {def.manaCost} mana{def.resultCount > 1 ? ` · ×${def.resultCount}` : ''}</p>
                              </div>
                              {locked && <span className="text-[13px] text-red-400/60 font-display">Lvl {def.minAlchemyLevel}</span>}
                            </div>
                            <div className="mb-2">
                              <p className="text-[13px] text-text-faint/40 mb-1">Requires:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {def.recipe.map(({ itemId, count }) => {
                                  const have = countItem(inv, itemId)
                                  const enough = have >= count
                                  const itemDef = ITEMS.find(i => i.id === itemId)
                                  return (
                                    <span key={itemId} className={`text-[13px] font-display px-1.5 py-0.5 rounded border ${enough ? 'border-white/10 text-text-faint/60' : 'border-red-500/30 text-red-400/60'}`}>
                                      {itemDef?.name ?? itemId} {have}/{count}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const prevAlchLvl = skillsRef.current.alchemy.level
                                if (brewPotion(def.id, invRef.current, skillsRef.current, manaRef.current)) {
                                  flagsRef.current[`brewed_${def.id}`] = true
                                  setInv({ ...invRef.current })
                                  forceUpdate(n => n + 1)
                                  const p = playerRef.current
                                  if (p) floatXp(p.x + 16, p.y, def.xpGrant, SKILL_COLORS.alchemy)
                                  if (skillsRef.current.alchemy.level > prevAlchLvl) {
                                    if (p) particlesRef.current.burst(p.x + 16, p.y - 4, 'sparkle', 16)
                                    notifyLevelUp('alchemy', skillsRef.current.alchemy.level)
                                  } else {
                                    if (p) particlesRef.current.burst(p.x + 16, p.y - 4, 'sparkle', 8)
                                    notify('item', `Brewed ${def.name}!`)
                                  }
                                }
                              }}
                              disabled={!brewable || locked}
                              className="w-full text-[13px] font-display py-1.5 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-[#d06040]/20 hover:border-[#d06040]/40 text-[#d06040]/70 hover:text-[#d06040]"
                            >
                              Brew{def.resultCount > 1 ? ` (×${def.resultCount})` : ''}
                            </button>
                          </div>
                        )
                      })}
                      {visiblePotions.length === 0 && (
                        <p className="text-text-faint/30 text-[12px] font-display text-center py-6">No recipes available yet</p>
                      )}
                    </div>
                  )
                })()}

                {/* Exchange panel */}
                {sidePanel === 'exchange' && (
                  <ExchangePanel
                    ge={geRef.current}
                    inv={inv}
                    marks={wallet.marks}
                    onBuy={(itemId, qty) => {
                      const result = buyFromGE(geRef.current, wallet.marks, invRef.current, itemId, qty)
                      if (result.success) {
                        wallet.spend(result.totalMarks)
                        setInv({ ...invRef.current })
                        flagsRef.current.ge_first_trade = true
                        const item = ITEMS.find(i => i.id === itemId)
                        notify('item', `+${qty} ${item?.name ?? itemId} (−${result.totalMarks}m)`)
                        forceUpdate(n => n + 1)
                      } else if (result.error) {
                        notify('warning', result.error)
                      }
                    }}
                    onSell={(itemId, qty) => {
                      const result = sellToGE(geRef.current, invRef.current, itemId, qty)
                      if (result.success) {
                        wallet.earn(result.totalMarks)
                        setInv({ ...invRef.current })
                        flagsRef.current.ge_first_trade = true
                        const item = ITEMS.find(i => i.id === itemId)
                        notify('item', `Sold ${qty}x ${item?.name ?? itemId} — +${result.totalMarks}m`)
                        forceUpdate(n => n + 1)
                      } else if (result.error) {
                        notify('warning', result.error)
                      }
                    }}
                  />
                )}

                {/* Quest panel */}
                {sidePanel === 'quests' && (
                  <QuestPanel
                    questState={questStateRef.current}
                    flags={flagsRef.current}
                    inv={inv}
                    skills={skillsRef.current}
                    spiritIndex={spiritIndexRef.current}
                    zoneId={zoneRef.current.id}
                    onStart={(questId) => { startQuest(questStateRef.current, questId); forceUpdate(n => n + 1) }}
                  />
                )}

                {/* Chest panel */}
                {sidePanel === 'chest' && openChestId && (() => {
                  const chest = chestsRef.current.find(c => c.furnitureInstanceId === openChestId)
                  if (!chest) return null
                  const isZoneChest = openChestId.startsWith('zonechest_')
                  // Check if this zone chest is claimable (player can take it as furniture)
                  const zcDef = isZoneChest ? Object.values(ZONE_CHESTS).flat().find(z => z.id === openChestId) : null
                  const isClaimable = zcDef?.claimable ?? false
                  const chestEmpty = chest.slots.every(s => s === null)

                  // Pickup handler for regular chests AND claimable zone chests
                  const pickupHandler = (isZoneChest && !isClaimable) ? undefined : () => {
                    const hasStorageRoom = invRef.current.slots.slice(0, HOTBAR_START).some(s => s === null)
                    if (!hasStorageRoom) {
                      notify('warning', 'No room in storage!')
                      return
                    }
                    // Remove from world
                    const furnIdx = furnitureRef.current.findIndex(f => f.id === openChestId)
                    if (furnIdx === -1) return
                    const pickedFurn = furnitureRef.current[furnIdx]
                    furnitureRef.current.splice(furnIdx, 1)
                    // Remove from chests state
                    const chestIdx = chestsRef.current.findIndex(c => c.furnitureInstanceId === openChestId)
                    const pickedChest = chestIdx !== -1 ? chestsRef.current.splice(chestIdx, 1)[0] : undefined
                    // Add chest item to inventory with chestData
                    const chestItemId = pickedFurn.furnitureId
                    const hasContents = pickedChest?.slots.some(s => s !== null)
                    const leftover = addItems(invRef.current, chestItemId, 1)
                    if (leftover === 0 && hasContents && pickedChest) {
                      for (let i = invRef.current.slots.length - 1; i >= 0; i--) {
                        const slot = invRef.current.slots[i]
                        if (slot?.itemId === chestItemId && !slot.chestData) {
                          slot.chestData = pickedChest
                          break
                        }
                      }
                    }
                    // Zone chest: mark as looted so it doesn't respawn
                    if (isZoneChest) {
                      lootedZoneChestsRef.current.add(openChestId)
                      zoneChestStatesRef.current.delete(openChestId)
                    }
                    setInv({ ...invRef.current })
                    setChests([...chestsRef.current])
                    setSidePanel(null)
                    setOpenChestId(null)
                    forceUpdate(n => n + 1)
                  }

                  return (
                    <ChestPanel
                      chestSlots={chest.slots}
                      invSlots={invRef.current.slots}
                      chestLabel={isZoneChest ? (FURNITURE_DEFS[zcDef?.chestType ?? '']?.name ?? 'Treasure Chest') : chest.label}
                      onChanged={() => {
                        setInv({ ...invRef.current })
                        setChests([...chestsRef.current])
                        // Zone chest: track remaining items, auto-remove non-claimable when empty
                        if (isZoneChest) {
                          const isEmpty = chest.slots.every(s => s === null)
                          if (isEmpty && !isClaimable) {
                            lootedZoneChestsRef.current.add(openChestId)
                            zoneChestStatesRef.current.delete(openChestId)
                            furnitureRef.current = furnitureRef.current.filter(f => f.id !== openChestId)
                            chestsRef.current = chestsRef.current.filter(c => c.furnitureInstanceId !== openChestId)
                            setChests([...chestsRef.current])
                            setSidePanel(null)
                            setOpenChestId(null)
                            forceUpdate(n => n + 1)
                          } else {
                            zoneChestStatesRef.current.set(openChestId, chest.slots.map(s => s ? { ...s } : null))
                          }
                        }
                      }}
                      onPickupChest={pickupHandler}
                    />
                  )
                })()}

                {/* Mana'mals panel */}
                {sidePanel === 'beasts' && (
                  <div className="space-y-3">
                    <p className="text-[12px] text-text-faint/40 font-display">Rare companions earned through skill mastery.</p>
                    {BEAST_SPECIES.map(species => {
                      const def = BEAST_DEFS[species]
                      const owned = beastsRef.current.find(b => b.species === species)
                      const isActive = owned?.id === activeBeastId
                      return (
                        <div key={species} className={`rounded-lg p-3 border transition-colors ${
                          owned
                            ? isActive ? 'bg-[#d4a843]/10 border-[#d4a843]/20' : 'bg-white/[0.03] border-[#d4a843]/10'
                            : 'bg-white/[0.02] border-[#d4a843]/[0.05] opacity-50'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                              {owned ? (
                                <span className="text-[14px]">{species === 'drifthorn' ? '🦌' : species === 'dustwhisker' ? '🐇' : species === 'sporeling' ? '🍄' : species === 'glowmite' ? '✨' : '🐾'}</span>
                              ) : (
                                <span className="text-[14px] opacity-30">?</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-display text-[12px] text-text">{owned ? owned.name : def.name}</span>
                                {isActive && <span className="text-[13px] text-[#d4a843] font-display">ACTIVE</span>}
                              </div>
                              <p className="text-[13px] text-text-faint/40 mt-0.5">
                                {owned ? def.description : def.unlockType === 'admin' ? 'Special unlock' : def.unlockType === 'endgame' ? 'Complete the game' : `${def.unlockSkill} Lv.${def.unlockLevel}`}
                              </p>
                            </div>
                            {owned && !isActive && (
                              <button
                                onClick={() => {
                                  setActiveBeastId(owned.id)
                                  forceUpdate(n => n + 1)
                                }}
                                className="text-[13px] text-text-faint/50 hover:text-[#d4a843] transition-colors font-display px-1.5 py-0.5 rounded border border-[#d4a843]/15 hover:border-[#d4a843]/30"
                              >
                                Set Active
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}



              </div>
            </div>
          )}
        </div>

        {/* Inventory bar + tool gauges */}
        <div className={`relative border-t border-[#d4a843]/15 px-3 py-2 flex justify-center items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
          <InventoryBar
            slots={inv.slots}
            bagOpen={bagOpen}
            onToggleBag={() => setBagOpen(prev => !prev)}
            selectedIndex={effectiveSlot}
            onSelectSlot={(i) => setSelectedSlot(selectedSlot === i ? null : i)}
            onDropOne={handleDropOne}
            onDropStack={handleDropStack}
            onMoveSlot={(from, to) => {
              moveSlot(invRef.current.slots, from, to)
              setInv({ ...invRef.current })
            }}
            onSplitStack={(slot) => {
              splitStack(invRef.current.slots, slot)
              setInv({ ...invRef.current })
            }}
            onUseItem={(slot) => {
              const stack = invRef.current.slots[slot]
              if (!stack) return
              const itemDef = ITEMS.find(i => i.id === stack.itemId)
              if (!itemDef?.effect) return
              const eff = itemDef.effect
              const applyEffect = (stat: string | undefined, amount: number | undefined) => {
                if (!stat) return
                const mana = manaRef.current
                const maxPool = getMaxPool(skillsRef.current.mana.level)
                if (stat === 'mana') { mana.current = Math.min(maxPool, mana.current + (amount ?? 0)); return }
                if (stat === 'mana_full') { mana.current = maxPool; return }
                if (stat === 'happiness') {
                  for (const sp of spiritsRef.current) sp.happiness = Math.min(100, sp.happiness + (amount ?? 0))
                  return
                }
                if (stat === 'bond') {
                  for (const sp of spiritsRef.current) sp.bond = Math.min(100, sp.bond + (amount ?? 0))
                  return
                }
                if (stat === 'harvest_speed' || stat === 'xp_boost') {
                  activeBuffsRef.current.push({ stat, multiplier: amount ?? 0, expiresAt: Date.now() + (eff.duration ?? 60) * 1000 })
                  return
                }
              }
              if (eff.stat === 'combo' && eff.subEffects) {
                for (const sub of eff.subEffects) {
                  if (sub.stat === 'harvest_speed' || sub.stat === 'xp_boost') {
                    activeBuffsRef.current.push({ stat: sub.stat, multiplier: sub.amount, expiresAt: Date.now() + (sub.duration ?? 60) * 1000 })
                  } else {
                    applyEffect(sub.stat, sub.amount)
                  }
                }
              } else {
                applyEffect(eff.stat, eff.amount)
              }
              removeItems(invRef.current, stack.itemId, 1)
              setInv({ ...invRef.current })
              forceUpdate(n => n + 1)
            }}
          />
          {/* Tool gauges (desktop only — too small for mobile) */}
          {!isMobile && (['forestry', 'prospecting', 'rinning'] as const).map(skillId => {
            const tool = equippedToolsRef.current[skillId]
            const def = tool ? TOOL_DEFS[tool.toolId] : null
            const pct = tool && def ? (tool.usesRemaining / def.durability) * 100 : 0
            const color = SKILL_COLORS[skillId]
            return (
              <div key={skillId} className="flex items-center gap-1.5 bg-[#16142a]/80 rounded-lg px-2 py-1.5 border border-[#d4a843]/15" title={tool && def ? `${def.name} — ${tool.usesRemaining}/${def.durability}` : `No ${skillId} tool`}>
                <div className="w-[4px] h-3.5 rounded-full" style={{ backgroundColor: tool ? color : 'rgba(212,168,67,0.1)' }} />
                <div className="w-12">
                  <div className="h-[4px] bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  {tool ? (
                    <span className="text-[13px] text-text-faint/35 font-mono leading-none">{tool.usesRemaining}</span>
                  ) : (
                    <span className="text-[13px] text-text-faint/20 font-mono leading-none">---</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Mobile quick-access toolbar (replaces sidebar) */}
        {isMobile && (
          <div className="border-t border-[#d4a843]/15 px-1 py-1.5 flex items-center gap-px" style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}>
            {([
              { id: 'bag' as const, label: 'Bag', icon: 'M5 5V4a3 3 0 0 1 6 0v1M3 5h10l-1 9H4L3 5Z' },
              { id: 'spirits' as const, label: 'Spirits', icon: 'M8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM5 6c-1-1-2 0-2 1M11 6c1-1 2 0 2 1' },
              { id: 'skills' as const, label: 'Skills', icon: 'M2 13V7l3-2v8M7 13V5l3-2v10M12 13V3l3-2v12' },
              { id: 'quests' as const, label: 'Quests', icon: 'M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z' },
              { id: 'profile' as const, label: 'Character', icon: 'M8 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 14c0-3 2-5 5-5s5 2 5 5' },
            ] as const).map(btn => (
              <button
                key={btn.id}
                onClick={() => setSidePanel(sidePanel === btn.id ? null : btn.id)}
                className={`flex flex-col flex-1 min-w-0 items-center gap-0.5 px-0.5 py-1 rounded-md transition-all ${
                  sidePanel === btn.id ? 'text-[#d4a843]' : 'text-text-faint/40 active:text-text-faint/70'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d={btn.icon} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[11px] font-display truncate max-w-full">{btn.label}</span>
              </button>
            ))}
            {zoneRef.current.id === 'garden' && (
              <button
                onClick={() => {
                  setBuildMode(prev => {
                    const next = !prev
                    buildModeRef.current = next
                    if (!next) {
                      setSelectedBuildItem(null)
                      setPendingPlacement(null)
                      setSelectedPlacedFurnId(null)
                      setSelectedPlacedStructId(null)
                      setCameraZoom(1)
                    }
                    return next
                  })
                }}
                className={`flex flex-col flex-1 min-w-0 items-center gap-0.5 px-0.5 py-1 rounded-md transition-all ${
                  buildMode ? 'text-[#d4a843]' : 'text-text-faint/40 active:text-text-faint/70'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M3 13l3-3 7-7-3-3-7 7-3 3h3ZM10 3l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[11px] font-display truncate max-w-full">Build</span>
              </button>
            )}
          </div>
        )}
      </div>


      {/* Menu overlay (kept for spirits/shop/settings views) */}
      {menuOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={toggleMenu} />
          <div className={`relative bg-[#1e1c38] border border-[#d4a843]/35 rounded-xl shadow-2xl shadow-black/50 max-h-[80vh] overflow-hidden ${isMobile ? 'w-[calc(100%-2rem)] max-w-[420px]' : 'w-[420px]'}`}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#d4a843]/15">
              <span className="font-display text-[#d4a843] text-sm tracking-widest uppercase">
                {menuView === 'main' ? 'Menu' : menuView === 'spirits' ? 'Spirits' : menuView === 'bag' ? 'Bag' : menuView === 'shop' ? 'Shop' : menuView === 'gregory-shop' ? "Gregory's Shop" : 'Settings'}
              </span>
              {menuView !== 'main' ? (
                <button onClick={() => menuView === 'gregory-shop' ? toggleMenu() : setMenuView('main')} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-faint/40 hover:text-[#d4a843] hover:bg-[#d4a843]/10 transition-all font-display text-xs">{menuView === 'gregory-shop' ? '✕' : '←'}</button>
              ) : (
                <button onClick={toggleMenu} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-faint/40 hover:text-[#d4a843] hover:bg-[#d4a843]/10 transition-all font-display text-xs">{isMobile ? '✕' : 'ESC'}</button>
              )}
            </div>
            <div className="p-4">
              {menuView === 'main' && (
                <div className="space-y-1">
                  <MenuButton label="Spirits" desc="View your companions" onClick={() => setMenuView('spirits')} />
                  <MenuButton label="Shop" desc={wallet.marks > 0 ? `${wallet.marks} Marks` : 'Earn Marks in Magii'} onClick={() => setMenuView('shop')} />
                  <MenuButton label="Settings" desc="Preferences" onClick={() => setMenuView('settings')} />
                  <div className="pt-2">
                    <MenuButton label="Resume" desc="Back to the Shimmer" onClick={toggleMenu} gold />
                  </div>
                </div>
              )}
              {menuView === 'spirits' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-text-faint/50 font-display">Collection</span>
                    <span className="text-[13px] text-text-faint/30 font-display">{spiritsRef.current.length} spirits</span>
                  </div>
                  {spiritsRef.current.filter(s => s.inParty).map(s => {
                    const xpNeeded = xpForLevel(s.level)
                    const xpPct = xpNeeded > 0 ? Math.min(100, (s.xp / xpNeeded) * 100) : 0
                    return (
                      <div key={s.id} className="rounded-lg p-2.5 transition-colors bg-white/[0.03] border border-[#d4a843]/10">
                        <div className="flex items-center gap-2.5">
                          <SpriteIcon species={s.species} variant={s.variant} element={s.element} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-display text-[12px] text-text">{s.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[13px] text-text-faint/60">Lv.{s.level}</span>
                              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-[#d4a843]/60 rounded-full transition-all" style={{ width: `${xpPct}%` }} />
                              </div>
                              <span className="text-[13px] text-text-faint/30">{s.xp}/{xpNeeded}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {menuView === 'shop' && (() => {
                const shopStock = ITEMS
                  .filter(item => item.buyPrice !== undefined)
                  .map(item => ({ id: item.id, price: item.buyPrice! }))
                const sellableItems = ITEMS
                  .filter(item => item.sellPrice && countItem(inv, item.id) > 0)
                  .map(item => ({ id: item.id, count: countItem(inv, item.id), def: item }))
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-text-faint/50 font-display">Your purse</span>
                      <span className="text-[12px] text-[#d4a843] font-display font-semibold">{wallet.marks} Marks</span>
                    </div>
                    <div className="flex gap-1 mb-1">
                      <button
                        onClick={() => setShopTab('buy')}
                        className={`flex-1 text-[12px] font-display py-1.5 rounded-md border transition-colors ${
                          shopTab === 'buy'
                            ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843]'
                            : 'border-[#d4a843]/10 text-text-faint/40 hover:text-text-faint/60'
                        }`}
                      >Buy</button>
                      <button
                        onClick={() => setShopTab('sell')}
                        className={`flex-1 text-[12px] font-display py-1.5 rounded-md border transition-colors ${
                          shopTab === 'sell'
                            ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843]'
                            : 'border-[#d4a843]/10 text-text-faint/40 hover:text-text-faint/60'
                        }`}
                      >Sell</button>
                    </div>
                    {shopTab === 'buy' && shopStock.map(stock => {
                      const itemDef = ITEMS.find(i => i.id === stock.id)
                      if (!itemDef) return null
                      const canAfford = wallet.marks >= stock.price
                      const owned = countItem(inv, stock.id)
                      const atMax = itemDef.stackable && owned >= itemDef.maxStack
                      return (
                        <div key={stock.id} className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-3">
                          <ItemIcon itemId={stock.id} scale={2} />
                          <div className="flex-1">
                            <span className="font-display text-sm text-text">{itemDef.name}</span>
                            <p className="text-[12px] text-text-faint/40">{stock.price} Marks{GE_CONFIGS[stock.id] ? <span className="text-[13px] text-white/15 ml-1">GE ~{GE_CONFIGS[stock.id].basePrice}m</span> : null}</p>
                          </div>
                          {owned > 0 && <span className="text-[12px] text-text-faint/30">x{owned}</span>}
                          <button
                            onClick={() => { if (!atMax && wallet.spend(stock.price)) { addItems(invRef.current, stock.id, 1); setInv({ ...invRef.current }); forceUpdate(n => n + 1) } }}
                            disabled={!canAfford || atMax}
                            className="text-[13px] font-display px-2.5 py-1 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-[#d4a843]/20 hover:border-[#d4a843]/40 text-[#d4a843]/70 hover:text-[#d4a843]"
                          >{atMax ? 'Full' : 'Buy'}</button>
                        </div>
                      )
                    })}
                    {shopTab === 'sell' && (sellableItems.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-text-faint/30 text-[12px] font-display">Nothing to sell</p>
                        <p className="text-text-faint/20 text-[13px] mt-1">Gather resources or buy items first</p>
                      </div>
                    ) : (
                      <>
                        {sellableItems.map(({ id, count, def }) => (
                          <div key={id} className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-3">
                            <ItemIcon itemId={id} scale={2} />
                            <div className="flex-1">
                              <span className="font-display text-sm text-text">{def.name}</span>
                              <p className="text-[13px] text-text-faint/40">{def.sellPrice} Marks each</p>
                            </div>
                            <span className="text-[12px] text-text-faint/30">x{count}</span>
                            <button
                              onClick={() => {
                                wallet.earn(def.sellPrice!)
                                removeItems(invRef.current, id, 1)
                                setInv({ ...invRef.current })
                                forceUpdate(n => n + 1)
                              }}
                              className="text-[13px] font-display px-2.5 py-1 rounded border transition-colors border-[#d4a843]/20 hover:border-[#d4a843]/40 text-[#d4a843]/70 hover:text-[#d4a843]"
                            >Sell</button>
                            {count > 1 && (
                              <button
                                onClick={() => {
                                  wallet.earn(def.sellPrice! * count)
                                  removeItems(invRef.current, id, count)
                                  setInv({ ...invRef.current })
                                  forceUpdate(n => n + 1)
                                }}
                                className="text-[13px] font-display px-2 py-1 rounded border transition-colors border-white/10 hover:border-[#d4a843]/30 text-text-faint/50 hover:text-[#d4a843]/70"
                              >All</button>
                            )}
                          </div>
                        ))}
                        <p className="text-[13px] text-text-faint/20 text-center pt-1">Vendor rates. Better prices at the Exchange.</p>
                      </>
                    ))}
                  </div>
                )
              })()}
              {menuView === 'gregory-shop' && (() => {
                const GREGORY_STOCK: { nodeType: NodeType; price: number }[] = [
                  { nodeType: 'goldwood', price: 50 },
                  { nodeType: 'shimmeroak', price: 120 },
                  { nodeType: 'starwillow', price: 250 },
                  { nodeType: 'raw_mana_node', price: 60 },
                  { nodeType: 'element_crystal_node', price: 150 },
                  { nodeType: 'small_pond', price: 75 },
                  { nodeType: 'stream', price: 175 },
                ]
                const gardenNodes = nodesRef.current.filter(n => n.zoneId === 'garden')
                const gardenCount = gardenNodes.length
                const MAX_GARDEN = 12
                const isFull = gardenCount >= MAX_GARDEN
                // Find occupied positions in garden
                const occupiedSet = new Set(gardenNodes.map(n => `${n.tileX},${n.tileY}`))
                const nextSlot = GARDEN_SHOP_SLOTS.find(s => !occupiedSet.has(`${s.tileX},${s.tileY}`))
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-text-faint/50 font-display">Garden Nodes</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] text-text-faint/40 font-display">{gardenCount} / {MAX_GARDEN}</span>
                        <span className="text-[12px] text-[#d4a843] font-display font-semibold">{wallet.marks} Marks</span>
                      </div>
                    </div>
                    {isFull && (
                      <div className="text-center py-2 bg-white/[0.03] rounded-lg">
                        <p className="text-[12px] text-[#d4a843]/60 font-display">Garden Full</p>
                      </div>
                    )}
                    <div className="max-h-[50vh] overflow-y-auto space-y-2">
                      {GREGORY_STOCK.map(stock => {
                        const label = NODE_TYPE_LABELS[stock.nodeType]
                        if (!label) return null
                        const canAfford = wallet.marks >= stock.price
                        const nodeSprite = NODE_SPRITES[stock.nodeType]?.harvestable
                        return (
                          <div key={stock.nodeType} className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-3">
                            <canvas
                              ref={el => {
                                if (!el) return
                                const ctx = el.getContext('2d')
                                if (!ctx) return
                                el.width = 16; el.height = 16
                                ctx.imageSmoothingEnabled = false
                                ctx.clearRect(0, 0, 32, 32)
                                if (nodeSprite) drawSpriteToCtx(ctx, nodeSprite.frames[0], (NODE_PALETTES[stock.nodeType] ?? ITEM_PALETTE) as unknown as readonly string[], 0, 0)
                              }}
                              style={{ imageRendering: 'pixelated', width: 32, height: 32 }}
                            />
                            <div className="flex-1">
                              <span className="font-display text-sm text-text">{label.name}</span>
                              <p className="text-[13px] text-text-faint/40">{label.category} &middot; {stock.price} Marks</p>
                            </div>
                            <button
                              onClick={() => {
                                if (isFull || !nextSlot || !wallet.spend(stock.price)) return
                                const node = createResourceNode(stock.nodeType, nextSlot.tileX, nextSlot.tileY, 'garden')
                                nodesRef.current.push(node)
                                forceUpdate(n => n + 1)
                              }}
                              disabled={!canAfford || isFull || !nextSlot}
                              className="text-[13px] font-display px-2.5 py-1 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-[#d4a843]/20 hover:border-[#d4a843]/40 text-[#d4a843]/70 hover:text-[#d4a843]"
                            >{isFull ? 'Full' : 'Buy'}</button>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[13px] text-text-faint/20 text-center pt-1">Nodes appear in your garden. Walk over and harvest them.</p>
                  </div>
                )
              })()}
              {menuView === 'settings' && (
                <div className="space-y-3">
                  {isOwner && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-text-faint/40 font-display uppercase tracking-wider">Dev · Map Tools</div>
                      <button
                        onClick={() => { window.location.href = `/shimmer/dev?mode=map&zone=${zoneRef.current.id}` }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left bg-white/[0.03] border border-[#d4a843]/20 hover:bg-[#d4a843]/10 transition-all"
                      >
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-[#d4a843]">
                          <path d="M2 11.5V14h2.5l7-7L9 4.5l-7 7ZM10 3.5L12.5 6 14 4.5 11.5 2 10 3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-display text-text">Edit Map</span>
                          <span className="block text-[12px] text-text-faint/40 truncate">Draw &ldquo;{zoneRef.current.name}&rdquo; in the editor</span>
                        </span>
                      </button>
                    </div>
                  )}
                  <div className="text-center py-6">
                    <p className="text-text-faint/40 text-[13px] font-display">Nothing else to configure yet</p>
                    <p className="text-text-faint/25 text-[13px] mt-1">Sound and controls coming soon</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
