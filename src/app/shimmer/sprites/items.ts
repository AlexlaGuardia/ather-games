// Game items — definitions + 16x16 pixel art icons
// Palette: 0=transparent, 1=gold, 2=dark brown, 3=cream, 4=outline, 5=red, 6=green, 7=blue, 8=purple

import { px, SpriteAnim } from './sprite-data'
import type { Species } from '../spirits/spirit'

const S = 32

// Item palette — shared fallback for items without per-entity palettes
const SEED_FOX = px(32, 32, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000044044044000000000000
  00000000000433422433400000000000
  00000000000041322314000000000000
  00000000000042222224000000000000
  00000000000042288224000000000000
  00000000000048888874000000000000
  00000000000043888714000000000000
  00000000000433777711400000000000
  00000000000041177114000000000000
  00000000000004111140000000000000
  00000000000000444400000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

const SEED_AXOLOTL = px(32, 32, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000004004000000000000000
  00000000004041441404000000000000
  00000000041421221241400000000000
  00000000004122112214000000000000
  00000000004211221124000000000000
  00000000041128228211400000000000
  00000000414488887744140000000000
  00000000040478877740400000000000
  00000000000477777740000000000000
  00000000000477337740000000000000
  00000000000043333400000000000000
  00000000000004334000000000000000
  00000000000000440000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

const SEED_WATER_BEAR = px(32, 32, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000004440000444000000000000
  00000000041114004111400000000000
  00000000042214444122400000000000
  00000000004211111124000000000000
  00000000000411111140000000000000
  00000000000411111140000000000000
  00000000004118888114000000000000
  00000000004178887714000000000000
  00000000004177777714000000000000
  00000000000417777140000000000000
  00000000000041111400000000000000
  00000000000004444000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

const GOLDWOOD_BARK = px(32, 32, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000044000000000000000
  00000000000000411400000000000000
  00000000000000411240000000000000
  00000000000004112440000000000000
  00000000000041124300000000000000
  00000000004411243400000000000000
  00000000042112434000000000000000
  00000000004224340000000000000000
  00000000000441400000000000000000
  00000000004114000000000000000000
  00000000041140000000000000000000
  00000000044400000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

export const ITEM_PALETTE = ['#d544c8', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'] as const

// Per-node palettes — each node type gets its own (max 14 colors, 0=transparent)
// Initialized from ITEM_PALETTE, expand per node as needed
export const NODE_PALETTES: Record<string, string[]> = {
  // Forestry
  goldwood:             ['#dbb761', '#eac575', '#f4e1a9', '#b89956', '#1a1a2e', '#5a3a10', '#3c280b', '#81acd9'],
  shimmeroak:           ['#50a040', '#6eb361', '#49923a', '#5a3a10', '#402b0c', '#1a1a2e', '#f4eab8', '#eee711'],
  starwillow:           ['#4080c0', '#6495c9', '#36679b', '#1a1a2e', '#5a3a10', '#3c280b', '#ebfaff', '#8060b0'],
  dawnwood:             ['#8259c0', '#8f69c9', '#634393', '#1a1a2e', '#5a3a10', '#3c280b', '#4080c0', '#3669a1'],
  // Prospecting
  raw_mana_node:        ['#2d9c16', '#288014', '#19540d', '#1a1a2e', '#6d5a22', '#8e7033', '#59437a', '#8060b0', '#a970ff', '#ffffff', '#0c0a04'],
  element_crystal_node: ['#d4a843', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  pure_core_node:       ['#d4a843', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  ather_crystal_node:   ['#d4a843', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  // Rinning
  small_pond:           ['#d4a843', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#7aaee6', '#4080c0', '#2c5581'],
  stream:               ['#d4a843', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  lake:                 ['#d4a843', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  // Farming
  ather_soil:           ['#d4a843', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
}

export type ItemType = 'fruit' | 'seed' | 'crop_seed' | 'consumable' | 'key' | 'resource' | 'tool' | 'furniture'
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface ItemDef {
  id: string
  name: string
  type: ItemType
  rarity: ItemRarity
  description: string
  stackable: boolean
  maxStack: number
  sellPrice?: number     // Marks earned when sold to vendor. undefined = not sellable
  buyPrice?: number      // Marks to buy from vendor. undefined = not buyable
  tradeable?: boolean    // can be listed on Ather Exchange
  species?: Species      // which spirit this seed hatches
  effect?: {
    stat?: 'happiness' | 'bond' | 'xp' | 'mana' | 'mana_full' | 'harvest_speed' | 'xp_boost' | 'combo'
    amount?: number
    duration?: number  // seconds (for timed buffs)
    subEffects?: { stat: string; amount: number; duration?: number }[]  // for combo potions
  }
  giftable?: boolean     // can be given to NPCs as a gift (default: true for fruits/consumables/resources)
}

export const ITEMS: ItemDef[] = [
  {
    id: 'sunfruit',
    name: 'Sunfruit',
    type: 'fruit',
    rarity: 'common',
    description: 'A warm golden fruit that glows faintly. Fox spirits love these.',
    stackable: true,
    maxStack: 10,
    sellPrice: 2,
    buyPrice: 5,
    tradeable: true,
    effect: { stat: 'happiness', amount: 15 },
  },
  {
    id: 'moonberry',
    name: 'Moonberry',
    type: 'fruit',
    rarity: 'common',
    description: 'Cool blue berries that shimmer in moonlight. Axolotl favorite.',
    stackable: true,
    maxStack: 10,
    sellPrice: 2,
    buyPrice: 5,
    tradeable: true,
    effect: { stat: 'happiness', amount: 15 },
  },
  {
    id: 'stonemelon',
    name: 'Stonemelon',
    type: 'fruit',
    rarity: 'common',
    description: 'A dense, earthy melon with a tough rind. Water-bears go wild for these.',
    stackable: true,
    maxStack: 10,
    sellPrice: 3,
    buyPrice: 8,
    tradeable: true,
    effect: { stat: 'happiness', amount: 15 },
  },
  // --- Mana Seeds (10 species, all named "Mana Seed") ---
  { id: 'seed_fox',         name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed humming with warm energy.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'fox' },
  { id: 'seed_axolotl',     name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed pulsing with soft light.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'axolotl' },
  { id: 'seed_water_bear',  name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed dense with quiet power.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'water-bear' },
  { id: 'seed_turtle',      name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed rooted in deep patience.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'turtle' },
  { id: 'seed_owl',         name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed flickering with knowing.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'owl' },
  { id: 'seed_frog',        name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed damp with morning dew.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'frog' },
  { id: 'seed_firefly',     name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed faintly glowing from within.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'firefly' },
  { id: 'seed_rabbit',      name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed light as a whisper.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'rabbit' },
  { id: 'seed_hummingbird',  name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed vibrating with tiny heartbeats.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'hummingbird' },
  { id: 'seed_bat',         name: 'Mana Seed', type: 'seed', rarity: 'uncommon', description: 'A crystallized seed cool to the touch.', stackable: true, maxStack: 3, sellPrice: 15, tradeable: true, species: 'bat' },
  {
    id: 'spirit_treat',
    name: 'Spirit Treat',
    type: 'consumable',
    rarity: 'common',
    description: 'A handmade treat that strengthens the bond with any spirit.',
    stackable: true,
    maxStack: 20,
    sellPrice: 4,
    buyPrice: 10,
    tradeable: true,
    effect: { stat: 'bond', amount: 10 },
  },
  {
    id: 'shimmer_dust',
    name: 'Shimmer Dust',
    type: 'consumable',
    rarity: 'rare',
    description: 'Sparkling dust that grants a burst of experience.',
    stackable: true,
    maxStack: 3,
    sellPrice: 10,
    buyPrice: 25,
    tradeable: true,
    effect: { stat: 'xp', amount: 50 },
  },
  // --- Gathering Resources (Tier 1) ---
  // Forestry
  { id: 'goldwood_plank', name: 'Goldwood Plank', type: 'resource', rarity: 'common', description: 'Light, warm-toned wood. Easy to work with.', stackable: true, maxStack: 50, sellPrice: 3, tradeable: true },
  { id: 'goldwood_bark', name: 'Goldwood Bark', type: 'resource', rarity: 'common', description: 'Papery golden bark, mildly aromatic.', stackable: true, maxStack: 50, sellPrice: 2, tradeable: true },
  // Prospecting
  { id: 'raw_mana_shard', name: 'Raw Mana Shard', type: 'resource', rarity: 'common', description: 'Common, unrefined crystal. The foundation of every potion.', stackable: true, maxStack: 50, sellPrice: 5, tradeable: true },
  // Rinning
  { id: 'shimmerscale', name: 'Shimmerscale', type: 'resource', rarity: 'common', description: 'Tiny, warm-scaled fish. Schools of them catch the light.', stackable: true, maxStack: 30, sellPrice: 2, tradeable: true },
  { id: 'clickclaw', name: 'Clickclaw', type: 'resource', rarity: 'common', description: 'Small Ather crab. Clicks when annoyed. Surprisingly tasty.', stackable: true, maxStack: 30, sellPrice: 3, tradeable: true },
  // --- Gathering Resources (Tier 2) ---
  // Forestry T2
  { id: 'shimmeroak_plank', name: 'Shimmeroak Plank', type: 'resource', rarity: 'uncommon', description: 'Dense wood with a rippled grain that catches light.', stackable: true, maxStack: 50, sellPrice: 7, tradeable: true },
  { id: 'amber_sap', name: 'Amber Sap', type: 'resource', rarity: 'uncommon', description: 'Thick golden resin. Smells like warm honey.', stackable: true, maxStack: 30, sellPrice: 8, tradeable: true },
  // Prospecting T2
  { id: 'violet_crystal', name: 'Violet Crystal', type: 'resource', rarity: 'uncommon', description: 'Hums at a frequency you feel in your teeth.', stackable: true, maxStack: 30, sellPrice: 8, tradeable: true },
  { id: 'storm_crystal', name: 'Storm Crystal', type: 'resource', rarity: 'uncommon', description: 'Static jumps between your fingers when you hold it.', stackable: true, maxStack: 30, sellPrice: 8, tradeable: true },
  { id: 'earth_crystal', name: 'Earth Crystal', type: 'resource', rarity: 'uncommon', description: 'Feels like it weighs twice what it should. Warm.', stackable: true, maxStack: 30, sellPrice: 8, tradeable: true },
  { id: 'water_crystal', name: 'Water Crystal', type: 'resource', rarity: 'uncommon', description: 'Surface is always slightly damp.', stackable: true, maxStack: 30, sellPrice: 8, tradeable: true },
  // Rinning T2
  { id: 'glowfin', name: 'Glowfin', type: 'resource', rarity: 'uncommon', description: 'Soft bioluminescent scales. Spirits love it raw.', stackable: true, maxStack: 30, sellPrice: 6, tradeable: true },
  { id: 'ribboneel', name: 'Ribboneel', type: 'resource', rarity: 'uncommon', description: 'Long, slippery, iridescent. Prized for potion-making.', stackable: true, maxStack: 30, sellPrice: 7, tradeable: true },
  // --- Gathering Resources (Tier 3) ---
  // Forestry T3
  { id: 'starwillow_branch', name: 'Starwillow Branch', type: 'resource', rarity: 'rare', description: 'Bends without breaking. Glows faintly at the tips.', stackable: true, maxStack: 30, sellPrice: 18, tradeable: true },
  { id: 'starwillow_sap', name: 'Starwillow Sap', type: 'resource', rarity: 'rare', description: 'Luminescent sap with mana properties.', stackable: true, maxStack: 20, sellPrice: 22, tradeable: true },
  // Prospecting T3
  { id: 'pure_mana_core', name: 'Pure Mana Core', type: 'resource', rarity: 'rare', description: 'Rings like a bell when tapped.', stackable: true, maxStack: 20, sellPrice: 20, tradeable: true },
  // Rinning T3
  { id: 'moonkoi', name: 'Moonkoi', type: 'resource', rarity: 'rare', description: 'Beautiful silver-gold. Slow, patient catch.', stackable: true, maxStack: 20, sellPrice: 15, tradeable: true },
  { id: 'pearlshell', name: 'Pearlshell', type: 'resource', rarity: 'rare', description: 'Occasionally contains a small Ather pearl.', stackable: true, maxStack: 20, sellPrice: 18, tradeable: true },
  // --- Gathering Resources (Tier 4) ---
  // Forestry T4
  { id: 'dawnwood_plank', name: 'Dawnwood Plank', type: 'resource', rarity: 'legendary', description: 'Ancient wood that holds warmth. Building with it feels permanent.', stackable: true, maxStack: 20, sellPrice: 45, tradeable: true },
  { id: 'crystallized_sap', name: 'Crystallized Sap', type: 'resource', rarity: 'legendary', description: 'Sap so old it hardened into amber crystal. Contains raw mana.', stackable: true, maxStack: 10, sellPrice: 55, tradeable: true },
  // Prospecting T4
  { id: 'ather_crystal', name: 'Ather Crystal', type: 'resource', rarity: 'legendary', description: 'Pure dream-stuff crystallized. Looking into it feels like distance.', stackable: true, maxStack: 10, sellPrice: 60, tradeable: true },
  // Rinning T4
  { id: 'crystal_rinn', name: 'Crystal Rinn', type: 'resource', rarity: 'legendary', description: 'A Rinn made partly of crystallized mana. Like holding a wish.', stackable: true, maxStack: 5, sellPrice: 50, tradeable: true },
  // --- Gathering Tools ---
  // Forestry — Blades
  { id: 'goldwood_blade', name: 'Goldwood Blade', type: 'tool', rarity: 'common', description: 'A simple blade carved from Goldwood. Cuts clean.', stackable: false, maxStack: 1, sellPrice: 12, tradeable: false },
  { id: 'shimmeroak_blade', name: 'Shimmeroak Blade', type: 'tool', rarity: 'uncommon', description: 'Dense and sharp. The grain catches light as you swing.', stackable: false, maxStack: 1, sellPrice: 30, tradeable: false },
  { id: 'starwillow_blade', name: 'Starwillow Blade', type: 'tool', rarity: 'rare', description: 'Bends slightly with each cut, never dulls. Glows at the edge.', stackable: false, maxStack: 1, sellPrice: 75, tradeable: false },
  // Prospecting — Spikes
  { id: 'mana_spike', name: 'Mana Spike', type: 'tool', rarity: 'common', description: 'Crude crystalline pick. Gets the job done.', stackable: false, maxStack: 1, sellPrice: 15, tradeable: false },
  { id: 'crystal_spike', name: 'Crystal Spike', type: 'tool', rarity: 'uncommon', description: 'Resonates with nodes. Finds fault lines faster.', stackable: false, maxStack: 1, sellPrice: 35, tradeable: false },
  { id: 'pure_spike', name: 'Pure Spike', type: 'tool', rarity: 'rare', description: 'Hums when near rich veins. Extracts without waste.', stackable: false, maxStack: 1, sellPrice: 80, tradeable: false },
  // Rinning — Rinsticks
  { id: 'basic_rinstick', name: 'Basic Rinstick', type: 'tool', rarity: 'common', description: 'A simple rod with mana-threaded line. Patient fish only.', stackable: false, maxStack: 1, sellPrice: 10, tradeable: false },
  { id: 'glowfin_rinstick', name: 'Glowfin Rinstick', type: 'tool', rarity: 'uncommon', description: 'The lure glows softly. Attracts curious Rinns.', stackable: false, maxStack: 1, sellPrice: 28, tradeable: false },
  { id: 'moonkoi_rinstick', name: 'Moonkoi Rinstick', type: 'tool', rarity: 'rare', description: 'Silver-thread line that sings in water. They come to it.', stackable: false, maxStack: 1, sellPrice: 70, tradeable: false },
  // --- Potions (brewed via Alchemy) ---
  { id: 'mana_draught', name: 'Mana Draught', type: 'consumable', rarity: 'common', description: 'A cloudy blue vial. Restores a burst of mana.', stackable: true, maxStack: 5, sellPrice: 8, tradeable: true, effect: { stat: 'mana', amount: 30 } },
  { id: 'shard_tonic', name: 'Shard Tonic', type: 'consumable', rarity: 'common', description: 'Gritty crystal-infused tonic. Hands move faster.', stackable: true, maxStack: 5, sellPrice: 10, tradeable: true, effect: { stat: 'harvest_speed', amount: 0.15, duration: 60 } },
  { id: 'shimmer_salve', name: 'Shimmer Salve', type: 'consumable', rarity: 'common', description: 'Warm shimmering paste. Spirits brighten when they smell it.', stackable: true, maxStack: 5, sellPrice: 12, tradeable: true, effect: { stat: 'happiness', amount: 25 } },
  { id: 'glowfin_brew', name: 'Glowfin Brew', type: 'consumable', rarity: 'uncommon', description: 'Bioluminescent brew. Knowledge sinks in faster.', stackable: true, maxStack: 5, sellPrice: 20, tradeable: true, effect: { stat: 'xp_boost', amount: 0.2, duration: 90 } },
  { id: 'crystal_elixir', name: 'Crystal Elixir', type: 'consumable', rarity: 'uncommon', description: 'Clear crystalline liquid. Mana surges and lingers.', stackable: true, maxStack: 5, sellPrice: 25, tradeable: true, effect: { stat: 'mana', amount: 50 } },
  { id: 'bond_philter', name: 'Bond Philter', type: 'consumable', rarity: 'uncommon', description: 'Rose-tinted draught. Spirits feel closer after drinking it.', stackable: true, maxStack: 5, sellPrice: 22, tradeable: true, effect: { stat: 'bond', amount: 15 } },
  { id: 'starlight_tincture', name: 'Starlight Tincture', type: 'consumable', rarity: 'rare', description: 'Starwillow extract. Everything you learn sticks.', stackable: true, maxStack: 5, sellPrice: 40, tradeable: true, effect: { stat: 'xp_boost', amount: 0.3, duration: 120 } },
  { id: 'deep_essence', name: 'Deep Essence', type: 'consumable', rarity: 'rare', description: 'Abyssal concentrate. Fully restores your mana pool.', stackable: true, maxStack: 5, sellPrice: 50, tradeable: true, effect: { stat: 'mana_full', amount: 0 } },
  { id: 'ather_infusion', name: 'Ather Infusion', type: 'consumable', rarity: 'legendary', description: 'Pure Ather distillate. The world moves slower around you.', stackable: true, maxStack: 3, sellPrice: 80, tradeable: true, effect: { stat: 'combo', amount: 0, subEffects: [{ stat: 'harvest_speed', amount: 0.5, duration: 120 }, { stat: 'xp_boost', amount: 0.3, duration: 120 }] } },
  { id: 'dawn_cordial', name: 'Dawn Cordial', type: 'consumable', rarity: 'legendary', description: 'Ancient recipe. Like drinking a sunrise.', stackable: true, maxStack: 3, sellPrice: 120, tradeable: true, effect: { stat: 'combo', amount: 0, subEffects: [{ stat: 'happiness', amount: 50 }, { stat: 'bond', amount: 25 }, { stat: 'mana_full', amount: 0 }] } },
  // --- Crop Seeds (planted for harvestable items, not spirits) ---
  { id: 'seed_shimmerwheat', name: 'Shimmerwheat Seed', type: 'crop_seed', rarity: 'common', description: 'Golden grain that thrives in mana-rich soil.', stackable: true, maxStack: 20, sellPrice: 3, buyPrice: 8, tradeable: true },
  { id: 'seed_glowroot', name: 'Glowroot Seed', type: 'crop_seed', rarity: 'common', description: 'A bulb that pulses faintly underground as it grows.', stackable: true, maxStack: 20, sellPrice: 3, buyPrice: 8, tradeable: true },
  { id: 'seed_sunpetal', name: 'Sunpetal Seed', type: 'crop_seed', rarity: 'common', description: 'Tiny golden seed. Blooms into warm petals.', stackable: true, maxStack: 20, sellPrice: 5, buyPrice: 12, tradeable: true },
  { id: 'seed_moonvine', name: 'Moonvine Seed', type: 'crop_seed', rarity: 'uncommon', description: 'Grows best at night. Pale tendrils reach toward starlight.', stackable: true, maxStack: 20, sellPrice: 8, buyPrice: 20, tradeable: true },
  { id: 'seed_crystalcap', name: 'Crystalcap Spore', type: 'crop_seed', rarity: 'uncommon', description: 'Crystalline mushroom spore. Hums when warm.', stackable: true, maxStack: 20, sellPrice: 10, buyPrice: 25, tradeable: true },
  { id: 'seed_starbean', name: 'Starbean Seed', type: 'crop_seed', rarity: 'uncommon', description: 'Dense bean that rattles when shaken. Full of potential.', stackable: true, maxStack: 20, sellPrice: 9, buyPrice: 22, tradeable: true },
  { id: 'seed_dreamroot', name: 'Dreamroot Cutting', type: 'crop_seed', rarity: 'rare', description: 'A gnarled root fragment that smells faintly of sleep.', stackable: true, maxStack: 20, sellPrice: 18, buyPrice: 45, tradeable: true },
  { id: 'seed_shimmerbloom', name: 'Shimmerbloom Bulb', type: 'crop_seed', rarity: 'rare', description: 'Iridescent bulb that shifts color in different light.', stackable: true, maxStack: 20, sellPrice: 22, buyPrice: 55, tradeable: true },
  { id: 'seed_atherwheat', name: 'Atherwheat Seed', type: 'crop_seed', rarity: 'rare', description: 'Grain from the deep Ather. Slightly warm to the touch.', stackable: true, maxStack: 20, sellPrice: 30, buyPrice: 75, tradeable: true },
  { id: 'seed_dawncap', name: 'Dawncap Spore', type: 'crop_seed', rarity: 'legendary', description: 'Glows at dawn. Ancient gardeners called it the first light.', stackable: true, maxStack: 20, sellPrice: 40, buyPrice: 100, tradeable: true },
  // --- Crop Harvest Items (produced by farming) ---
  { id: 'shimmerwheat_grain', name: 'Shimmerwheat Grain', type: 'resource', rarity: 'common', description: 'Warm golden grain with mild mana resonance.', stackable: true, maxStack: 50, sellPrice: 4, tradeable: true },
  { id: 'glowroot_bulb', name: 'Glowroot Bulb', type: 'resource', rarity: 'common', description: 'Soft-glowing root bulb. Faintly bioluminescent.', stackable: true, maxStack: 50, sellPrice: 4, tradeable: true },
  { id: 'sunpetal_bloom', name: 'Sunpetal Bloom', type: 'resource', rarity: 'common', description: 'Golden petal that holds warmth long after picking.', stackable: true, maxStack: 50, sellPrice: 6, tradeable: true },
  { id: 'moonvine_leaf', name: 'Moonvine Leaf', type: 'resource', rarity: 'uncommon', description: 'Pale silver leaf. Cool to the touch even in sunlight.', stackable: true, maxStack: 50, sellPrice: 10, tradeable: true },
  { id: 'crystalcap_spore', name: 'Crystalcap Spore', type: 'resource', rarity: 'uncommon', description: 'Translucent mushroom cap fragment. Refracts light.', stackable: true, maxStack: 50, sellPrice: 12, tradeable: true },
  { id: 'starbean_pod', name: 'Starbean Pod', type: 'resource', rarity: 'uncommon', description: 'Dense pod full of energy. Cracks when pressed.', stackable: true, maxStack: 50, sellPrice: 11, tradeable: true },
  { id: 'dreamroot_essence', name: 'Dreamroot Essence', type: 'resource', rarity: 'rare', description: 'Concentrated root extract. The air shimmers around it.', stackable: true, maxStack: 50, sellPrice: 22, tradeable: true },
  { id: 'shimmerbloom_petal', name: 'Shimmerbloom Petal', type: 'resource', rarity: 'rare', description: 'Iridescent petal that shifts between violet and gold.', stackable: true, maxStack: 50, sellPrice: 28, tradeable: true },
  { id: 'atherwheat_grain', name: 'Atherwheat Grain', type: 'resource', rarity: 'rare', description: 'Grain from the Ather. Warm and heavy for its size.', stackable: true, maxStack: 50, sellPrice: 35, tradeable: true },
  { id: 'dawncap_spore', name: 'Dawncap Spore', type: 'resource', rarity: 'legendary', description: 'Glows faintly gold. Alchemists pay dearly for these.', stackable: true, maxStack: 50, sellPrice: 50, tradeable: true },
  // --- Crop Potions (brewed from farmed ingredients) ---
  { id: 'harvest_brew', name: 'Harvest Brew', type: 'consumable', rarity: 'common', description: 'Hearty grain brew. Restores a steady flow of mana.', stackable: true, maxStack: 5, sellPrice: 10, tradeable: true, effect: { stat: 'mana', amount: 25 } },
  { id: 'moonvine_tonic', name: 'Moonvine Tonic', type: 'consumable', rarity: 'uncommon', description: 'Silvery tonic. Sharpens the mind for learning.', stackable: true, maxStack: 5, sellPrice: 22, tradeable: true, effect: { stat: 'xp_boost', amount: 0.15, duration: 120 } },
  { id: 'dreamroot_elixir', name: 'Dreamroot Elixir', type: 'consumable', rarity: 'rare', description: 'Thick violet elixir. Mana surges and the world slows.', stackable: true, maxStack: 5, sellPrice: 45, tradeable: true, effect: { stat: 'combo', amount: 0, subEffects: [{ stat: 'mana', amount: 40 }, { stat: 'harvest_speed', amount: 0.25, duration: 90 }] } },
  // --- Beast Food (feed to active mana'mal) ---
  { id: 'mana_berry', name: 'Mana Berry', type: 'consumable', rarity: 'common', description: 'Glowing berry that mana\'mals love. Fills hunger and lifts mood.', stackable: true, maxStack: 20, sellPrice: 3, buyPrice: 8, tradeable: true },
  { id: 'glow_moss', name: 'Glow Moss', type: 'consumable', rarity: 'common', description: 'Soft luminescent moss. Calms mana\'mals and strengthens your bond.', stackable: true, maxStack: 20, sellPrice: 4, buyPrice: 10, tradeable: true },
  { id: 'ember_fruit', name: 'Ember Fruit', type: 'consumable', rarity: 'uncommon', description: 'Warm fruit that radiates heat. Very filling for mana\'mals.', stackable: true, maxStack: 20, sellPrice: 6, buyPrice: 15, tradeable: true },
  { id: 'spirit_morsel', name: 'Spirit Morsel', type: 'consumable', rarity: 'rare', description: 'Rare treat infused with pure mana. Boosts all care stats.', stackable: true, maxStack: 10, sellPrice: 20, buyPrice: 50, tradeable: true },
  // --- Spirit Held Items (equip to spirit, affects battles) ---
  { id: 'mending_berry', name: 'Mending Berry', type: 'consumable', rarity: 'uncommon', description: 'Auto-heals 25% HP when spirit drops below 30%.', stackable: true, maxStack: 10, sellPrice: 15, buyPrice: 30, tradeable: true },
  { id: 'vigor_berry', name: 'Vigor Berry', type: 'consumable', rarity: 'uncommon', description: 'Cures status effects when afflicted in battle.', stackable: true, maxStack: 10, sellPrice: 15, buyPrice: 30, tradeable: true },
  { id: 'rush_berry', name: 'Rush Berry', type: 'consumable', rarity: 'uncommon', description: 'Boosts Agility when spirit HP drops below 50%.', stackable: true, maxStack: 10, sellPrice: 15, buyPrice: 30, tradeable: true },
  { id: 'power_gem', name: 'Power Gem', type: 'consumable', rarity: 'rare', description: 'Increases Power by 10% in battle. Equip to spirit.', stackable: true, maxStack: 5, sellPrice: 50, buyPrice: 100, tradeable: true },
  { id: 'guard_gem', name: 'Guard Gem', type: 'consumable', rarity: 'rare', description: 'Increases Guard by 10% in battle. Equip to spirit.', stackable: true, maxStack: 5, sellPrice: 50, buyPrice: 100, tradeable: true },
  { id: 'agility_gem', name: 'Agility Gem', type: 'consumable', rarity: 'rare', description: 'Increases Agility by 10% in battle. Equip to spirit.', stackable: true, maxStack: 5, sellPrice: 50, buyPrice: 100, tradeable: true },
  { id: 'element_charm', name: 'Element Charm', type: 'consumable', rarity: 'rare', description: 'Boosts same-type attack bonus to 1.40x.', stackable: true, maxStack: 5, sellPrice: 75, buyPrice: 150, tradeable: true },
  { id: 'endurance_charm', name: 'Endurance Charm', type: 'consumable', rarity: 'rare', description: 'Doubles chance to endure a lethal hit.', stackable: true, maxStack: 5, sellPrice: 75, buyPrice: 150, tradeable: true },
  { id: 'focus_charm', name: 'Focus Charm', type: 'consumable', rarity: 'rare', description: 'Increases move accuracy by 10 in battle.', stackable: true, maxStack: 5, sellPrice: 75, buyPrice: 150, tradeable: true },
]

/** Check if an item is giftable to NPCs. Tools, keys, and furniture are not giftable. */
export function isGiftable(item: ItemDef): boolean {
  if (item.giftable !== undefined) return item.giftable
  // Default: non-giftable types
  if (item.type === 'tool' || item.type === 'key' || item.type === 'furniture') return false
  return true
}

// Seed ID → species mapping (convenience lookup)
export const SEED_SPECIES: Record<string, Species> = Object.fromEntries(
  ITEMS.filter(i => i.species).map(i => [i.id, i.species!])
) as Record<string, Species>

// All seed item IDs
export const SEED_IDS = Object.keys(SEED_SPECIES)

// Crop seed item IDs (type='crop_seed' — plant for items, not spirits)
export const CROP_SEED_IDS = ITEMS.filter(i => i.type === 'crop_seed').map(i => i.id)

// Default names for newly hatched spirits
export const DEFAULT_SPIRIT_NAMES: Record<string, string> = {
  fox: 'Kit',
  axolotl: 'Nubs',
  'water-bear': 'Grub',
  turtle: 'Shell',
  owl: 'Hoot',
  frog: 'Ribbit',
  firefly: 'Glow',
  rabbit: 'Pip',
  hummingbird: 'Zip',
  bat: 'Dusk',
}

// =============================================================
// SUNFRUIT — golden fruit with leaf
// =============================================================

const SUNFRUIT = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000001000000000000
  00000000000000000016100000000000
  00000000000000000001610000000000
  00000000000000000016611100000000
  00000000000000111116166610000000
  00000000000001242211516661000000
  00000000000012242245111110000000
  00000000000122422234100000000000
  00000000000144222333100000000000
  00000000000133344433100000000000
  00000000000133433341000000000000
  00000000000013433110000000000000
  00000000000001111000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// =============================================================
// MOONBERRY — cluster of blue berries
// =============================================================

const MOONBERRY = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000044000000000000
  00000000000000000466400000000000
  00000000000000004640000000000000
  00000000000000046564000000000000
  00000000000004045446400000000000
  00000000000042412124000000000000
  00000000000412121412400000000000
  00000000004141412143400000000000
  00000000000414121434000000000000
  00000000000041232340000000000000
  00000000000434323400000000000000
  00000000000043434000000000000000
  00000000000004040000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// =============================================================
// STONEMELON — chunky earthy melon
// =============================================================

const STONEMELON = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000044000000000000000
  00000000000000422400000000000000
  00000000000044444444000000000000
  00000000000411311311400000000000
  00000000004113111131840000000000
  00000000041131111113884000000000
  00000000041131111117884000000000
  00000000041131111187884000000000
  00000000041131111887884000000000
  00000000048138888887884000000000
  00000000048878888887884000000000
  00000000004887888878840000000000
  00000000000488788788400000000000
  00000000000044444444000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// =============================================================
// MANA SEED — glowing crystal seed (shared shape, palette-swapped per species)
// Uses indices: 4=outline, 7=body glow, 8=core accent
// =============================================================

const MANA_SEED = px(S, S, `
  0000000000000000
  0000000000000000
  0000000040000000
  0000000484000000
  0000004787400000
  0000004787400000
  0000004787400000
  0000004878400000
  0000004787400000
  0000000484000000
  0000000040000000
  0000000000000000
  0000000000000000
  0000000044000000
  0000000044400000
  0000000004400000
`)

// Frame const name mapping (for save-sprite API)
const MANA_SEED_1 = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000040000000
  0000000484000000
  0000004787400000
  0000004787400000
  0000004787400000
  0000004878400000
  0000004787400000
  0000000484000000
  0000000040000000
  0000000044000000
  0000000044400000
  0000000004400000
  0000000000000000
`)

// =============================================================
// SPIRIT TREAT — diamond-shaped treat
// =============================================================

const SPIRIT_TREAT = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000444400000000000000
  00000000000004111240000000000000
  00000000000041111124000000000000
  00000000000041111124000000000000
  00000000004442111224000000000000
  00000000041142222224000000000000
  00000000004414222240000000000000
  00000000000421444400000000000000
  00000000004344240000000000000000
  00000000043404240000000000000000
  00000000434000400000000000000000
  00000004340000000000000000000000
  00000004400000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// =============================================================
// SHIMMER DUST — scattered sparkles
// =============================================================

const SHIMMER_DUST = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000300000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000003000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000003000000000000000000
  00000000000000440000000000000000
  00000000000044734000000000000000
  00000000004431311440000000000000
  00000000041117111134000000000000
  00000000004131111440000000000000
  00000000000444444000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// =============================================================
// RESOURCE ITEM INVENTORY ICONS — placeholder art for bag display
// =============================================================

// Goldwood Plank — simple plank shape (gold/brown)
const GOLDWOOD_PLANK = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000044440000000000000000
  00000000044422244400000000000000
  00000000421422241140000000000000
  00000000422422241140000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422444441240000000000000
  00000000444433344440000000000000
  00000000433344433340000000000000
  00000000044400044400000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// Raw Mana Shard — small cloudy crystal (cream/outline)
const RAW_MANA_SHARD = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000004440000000000000000000
  00000000048740000000000000000000
  00000000487740000444400000000000
  00000000477400004887400000000000
  00000000444000048847400000000000
  00000000000000488477400000000000
  00000000000000484774000000000000
  00000000000000477740000000000000
  00000000000000444400000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000044400000000000
  00000000000000000487400000000000
  00000000000000004877400000000000
  00000000000000004774000000000000
  00000000000000004440000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// Shimmerscale — tiny golden fish
const SHIMMERSCALE = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000044000000000000000000
  00000000000411400000000000000000
  00000000004124000400000000000000
  00000000041224004140000000000000
  00000000411124041240000000000000
  00000004133112412400000000000000
  00000041143111124000000000000000
  00000042111124112400000000000000
  00000004211244442400000000000000
  00000000412414004240000000000000
  00000000042440000400000000000000
  00000000004000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// Clickclaw — small crab (red/outline)
const CLICKCLAW = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000004400044044000440000000000
  00000042240433433404224000000000
  00000042424435453442024000000000
  00000042240444444404224000000000
  00000004240424442404240000000000
  00000000424121112142400000000000
  00000000042111111124000000000000
  00000000042221112224000000000000
  00000000004222222240000000000000
  00000000042444444424000000000000
  00000000041414041414000000000000
  00000000004040004040000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// =============================================================
// T2+ RESOURCE ITEM ICONS — placeholder art for bag display
// Each item has its own const so the sprite editor can save to it individually.
// Alex replaces these with proper pixel art via the editor.
// Palette: 1=gold, 2=dark brown, 3=cream, 4=outline, 5=red, 6=green, 7=blue, 8=purple
// =============================================================

// --- Forestry T2 ---
// Shimmeroak Plank — denser plank with ripple grain (gold+cream)
const SHIMMEROAK_PLANK = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000044440000000000000000
  00000000044422244400000000000000
  00000000421422241140000000000000
  00000000422422241140000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422422241240000000000000
  00000000422444441240000000000000
  00000000444433344440000000000000
  00000000433344433340000000000000
  00000000044400044400000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// Amber Sap — golden droplet
const AMBER_SAP = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000040000000000000000
  00000000000000424000000000000000
  00000000000004424400000000000000
  00000000000000404000000000000000
  00000000000000404000000000000000
  00000000000004000400000000000000
  00000000000041111340000000000000
  00000000000041113340000000000000
  00000000000004333400000000000000
  00000000000000444000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// --- Prospecting T2 (element crystals — diamond shape, palette-differentiated) ---
// Violet Crystal — purple diamond
const VIOLET_CRYSTAL = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000004000000000
  0000043400000000
  0000438340000000
  0004344434000000
  0000438340000000
  0000043400000000
  0000004000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Storm Crystal — blue diamond
const STORM_CRYSTAL = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000004000000
  0000000043400000
  0000000435340000
  0000004344434000
  0000000435340000
  0000000043400000
  0000000004000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Earth Crystal — brown diamond
const EARTH_CRYSTAL = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000040000000000
  0000434000000000
  0004363400000000
  0043444340000000
  0004363400000000
  0000434000000000
  0000040000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Water Crystal — teal diamond
const WATER_CRYSTAL = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000004000000
  0000000043400000
  0000000437340000
  0000004344434000
  0000000437340000
  0000000043400000
  0000000004000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Rinning T2 ---
// Glowfin — medium fish with glow (blue+cream)
const GLOWFIN = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000400000000000
  0004844444400000
  0048773333340044
  0473737734344434
  0447744777443340
  0004777377733400
  0000433344434000
  0000043334043400
  0000004440004400
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Ribboneel — long iridescent eel (purple+cream)
const RIBBONEEL = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000044000
  0000000000438400
  0000000040488840
  0000004004888340
  0000040448484400
  0000404888840000
  0000048488404000
  0004488840040000
  0044888404000000
  0488444040000000
  0448400000000000
  0044000000000000
  0000000000000000
`)

// --- Forestry T3 ---
// Starwillow Branch — flexible glowing branch (green+cream tips)
const STARWILLOW_BRANCH = px(S, S, `
  0000000000000000
  0000000000400000
  0000000004240000
  0000000042740000
  0004400427400000
  0042244274000000
  0047242740000000
  0004227400000000
  0004224444400000
  0004224222400000
  0042222274000000
  0042222740000000
  0004227400000000
  0000427400000000
  0000042740000000
  0000004400000000
`)

// Starwillow Sap — luminescent glowing drop (green+cream)
const STARWILLOW_SAP = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000040000000
  0000000434000000
  0000004340000000
  0000004344400000
  0000004737340000
  0000004373774000
  0000004737334000
  0000004737374000
  0000000477740000
  0000000044400000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Prospecting T3 ---
// Pure Mana Core — bright crystal (cream+purple glow)
const PURE_MANA_CORE = px(S, S, `
  0000000000000000
  0000000000000000
  0000400000400000
  0004344444340000
  0043433333434000
  0004348884340000
  0004384848340000
  0043444444434000
  0004384848340000
  0004348884340000
  0043433333434000
  0004344444340000
  0000400000400000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Rinning T3 ---
// Moonkoi — large silver-gold fish (cream+gold)
const MOONKOI = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0440000000000000
  4334004000000000
  4353441400000000
  4354041540000000
  0454444444400000
  0045555555540000
  0004315552554000
  0000415555554000
  0000415333340000
  0004155444400000
  0000444000000000
  0000000000000000
  0000000000000000
`)

// Pearlshell — oval shell (cream+blue accent)
const PEARLSHELL = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000044440000000
  0000433734000000
  0004337733400000
  0004373373400000
  0004337733400000
  0000433734000000
  0000044440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Forestry T4 ---
// Dawnwood Plank — thick ancient plank (gold+cream grain)
const DAWNWOOD_PLANK = px(S, S, `
  0000000000000000
  0000000044000000
  0000000083400000
  0000004483340000
  0000043483340000
  0000043483340000
  0000043483340000
  0000043483340000
  0000043483340000
  0000043483340000
  0000043483340000
  0000043483340000
  0000043483340000
  0000043348340000
  0000048844840000
  0000044440440000
`)

// Crystallized Sap — amber crystal (gold+cream+purple)
const CRYSTALLIZED_SAP = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000444400000
  0000004338440000
  0000048333840000
  0000043383840000
  0000004333840000
  0000000838400000
  0000000438400000
  0000000484000000
  0000000044000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Prospecting T4 ---
// Ather Crystal — golden translucent crystal (gold+cream)
const ATHER_CRYSTAL = px(S, S, `
  0000000000000000
  0080440000000000
  0004834000000000
  0004884000000080
  0004440000000000
  0000000000044400
  0000000000438400
  0000000000488400
  0040004400044000
  0804448840000040
  0000483884000000
  0004883888400800
  0004848888400000
  0400484484044000
  0000048840444400
  0000444444000000
`)

// --- Rinning T4 ---
// Crystal Rinn — translucent dream-fish (cream+purple shimmer)
const CRYSTAL_RINN = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000440
  0000000044004840
  0000000434004840
  0000044334048340
  0000433388483400
  0004338833333400
  0004348388483400
  0004888384043400
  0000444334004340
  0000043434000440
  0000004044000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// =============================================================
// GROWTH PHASE SPRITES — planted seed progression (placeholder art)
// Rendered on the world map. Generic green — species revealed at hatch.
// 0=transparent, 4=outline, 6=green body, 2=brown earth
// =============================================================

export const GROWTH_SPRITES: SpriteAnim[] = [
  // Phase 0: Seed (just planted — small mound)
  { frames: [px(S, S, `
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000440000000
    0000004224000000
    0000042224000000
    0000422224000000
    0000044440000000
  `)], rate: 1 },
  // Phase 1: Sprout (tiny green shoot)
  { frames: [px(S, S, `
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000400000000
    0000004640000000
    0000000460000000
    0000000400000000
    0000000440000000
    0000004224000000
    0000042224000000
    0000422224000000
    0000044440000000
  `)], rate: 1 },
  // Phase 2: Bud (taller stem, closed bud on top)
  { frames: [px(S, S, `
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000460000000
    0000004664000000
    0000004664000000
    0000000460000000
    0000000400000000
    0000004640000000
    0000000460000000
    0000000400000000
    0000004224000000
    0000042224000000
    0000422224000000
    0000044440000000
  `)], rate: 1 },
  // Phase 3: Bloom (opening, sparkle hints — ready to hatch)
  { frames: [px(S, S, `
    0000000000000000
    0000000300000000
    0000000060000000
    0000006464000000
    0000046664000000
    0000466166400000
    0000466316400000
    0000046664000000
    0000004640000000
    0000000460000000
    0000004640000000
    0000000400000000
    0000004224000000
    0000042224000000
    0000422224000000
    0000044440000000
  `), px(S, S, `
    0000030000000000
    0000000000030000
    0000000060000000
    0000006464000000
    0000046664000000
    0000466166400000
    0000466316400000
    0000046664000000
    0000004640000000
    0000000460000000
    0000004640000000
    0000000400000000
    0000004224000000
    0000042224000000
    0000422224000000
    0000044440000000
  `)], rate: 8 },
]

// =============================================================
// CROP GROWTH SPRITES — planted crop progression
// Same shape as spirit growth but gold/brown tones (palette: 1=gold, 2=brown)
// =============================================================

export const CROP_GROWTH_SPRITES: SpriteAnim[] = [
  // Phase 0: Seed (small mound, brown)
  { frames: [px(S, S, `
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000140000000
    0000001221000000
    0000012221000000
    0000122221000000
    0000011110000000
  `)], rate: 1 },
  // Phase 1: Sprout (gold-green shoot)
  { frames: [px(S, S, `
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000100000000
    0000001610000000
    0000000160000000
    0000000100000000
    0000000140000000
    0000001221000000
    0000012221000000
    0000122221000000
    0000011110000000
  `)], rate: 1 },
  // Phase 2: Growing (taller with closed bud)
  { frames: [px(S, S, `
    0000000000000000
    0000000000000000
    0000000000000000
    0000000000000000
    0000000160000000
    0000001661000000
    0000001661000000
    0000000160000000
    0000000100000000
    0000001610000000
    0000000160000000
    0000000100000000
    0000001221000000
    0000012221000000
    0000122221000000
    0000011110000000
  `)], rate: 1 },
  // Phase 3: Ready to harvest (open, golden sparkle)
  { frames: [px(S, S, `
    0000000000000000
    0000000300000000
    0000000010000000
    0000001161000000
    0000011661000000
    0000166116100000
    0000166316100000
    0000011661000000
    0000001610000000
    0000000160000000
    0000001610000000
    0000000100000000
    0000001221000000
    0000012221000000
    0000122221000000
    0000011110000000
  `), px(S, S, `
    0000030000000000
    0000000000030000
    0000000010000000
    0000001161000000
    0000011661000000
    0000166116100000
    0000166316100000
    0000011661000000
    0000001610000000
    0000000160000000
    0000001610000000
    0000000100000000
    0000001221000000
    0000012221000000
    0000122221000000
    0000011110000000
  `)], rate: 8 },
]

// Per-crop growth sprites — when painted, each crop type gets its own 4-phase sprites.
// Falls back to generic CROP_GROWTH_SPRITES when empty/undefined.
// Keyed by crop ID from farming.ts (shimmerwheat, glowroot, etc.)
export const CROP_SPRITES_BY_TYPE: Record<string, SpriteAnim[] | undefined> = {
  // Uncomment and paint per-crop sprites as needed:
  // shimmerwheat: [phase0Anim, phase1Anim, phase2Anim, phase3Anim],
  // glowroot: [...],
}

// Per-crop palettes — overrides ITEM_PALETTE for crops with custom sprites
export const CROP_PALETTES: Record<string, string[] | undefined> = {
  // shimmerwheat: ['#...', '#...', ...],
}

// =============================================================
// CROP SEED + HARVEST ITEM SPRITES — 16x16 placeholder icons
// =============================================================

// --- Crop Seed (small dot with ring — generic, Alex draws per-crop) ---
const CROP_SEED_ICON = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000440000000
  0000004114000000
  0000004114000000
  0000000440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Grain (small wheat bundle) ---
const SHIMMERWHEAT_GRAIN = px(S, S, `
  0000000000000000
  0000000000000000
  0000010000100000
  0000010001000000
  0000011010000000
  0000001110000000
  0000001110000000
  0000001110000000
  0000000100000000
  0000000100000000
  0000000100000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Bulb (glowing root) ---
const GLOWROOT_BULB = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000600000000
  0000000600000000
  0000006160000000
  0000061160000000
  0000016610000000
  0000016610000000
  0000001100000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Petal (golden flower petal) ---
const SUNPETAL_BLOOM = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000100000000
  0000001310000000
  0000013310000000
  0000011310000000
  0000001110000000
  0000000100000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Silver leaf ---
const MOONVINE_LEAF = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000040000000
  0000000740000000
  0000007740000000
  0000077340000000
  0000007740000000
  0000000740000000
  0000000040000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Crystal mushroom cap ---
const CRYSTALCAP_SPORE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000004440000000
  0000048840000000
  0000488384000000
  0000483384000000
  0000044440000000
  0000004000000000
  0000004000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Bean pod ---
const STARBEAN_POD = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000006400000000
  0000066640000000
  0000066640000000
  0000066640000000
  0000006400000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Purple essence vial ---
const DREAMROOT_ESSENCE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000440000000
  0000000440000000
  0000004884000000
  0000048884000000
  0000048884000000
  0000048884000000
  0000004884000000
  0000000440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Iridescent petal ---
const SHIMMERBLOOM_PETAL = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000800000000
  0000008380000000
  0000083380000000
  0000088180000000
  0000008880000000
  0000000800000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Warm grain (ather) ---
const ATHERWHEAT_GRAIN = px(S, S, `
  0000000000000000
  0000000000000000
  0000050000500000
  0000050005000000
  0000055050000000
  0000005550000000
  0000005550000000
  0000005550000000
  0000000500000000
  0000000500000000
  0000000500000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Dawn spore (gold glow) ---
const DAWNCAP_SPORE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000004440000000
  0000041140000000
  0000411314000000
  0000413314000000
  0000044440000000
  0000004000000000
  0000004000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Crop Potion sprites (bottle shapes) ---
const HARVEST_BREW = px(S, S, `
  0000000000000000
  0000000000000000
  0000000440000000
  0000000440000000
  0000004114000000
  0000041114000000
  0000041114000000
  0000041114000000
  0000041614000000
  0000041614000000
  0000004114000000
  0000000440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

const MOONVINE_TONIC = px(S, S, `
  0000000000000000
  0000000000000000
  0000000440000000
  0000000440000000
  0000004774000000
  0000047774000000
  0000047774000000
  0000047774000000
  0000047374000000
  0000047374000000
  0000004774000000
  0000000440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

const DREAMROOT_ELIXIR = px(S, S, `
  0000000000000000
  0000000000000000
  0000000440000000
  0000000440000000
  0000004884000000
  0000048884000000
  0000048884000000
  0000048884000000
  0000048384000000
  0000048384000000
  0000004884000000
  0000000440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// =============================================================
// TOOL SPRITES — 16x16 icons for gathering tools (blank — Alex draws)
// =============================================================

const GOLDWOOD_BLADE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000440000000000
  0004224000000000
  0004332400000000
  0004443240000000
  0000004240000000
  0000004240000000
  0000000424000000
  0000000044000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

const SHIMMEROAK_BLADE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000040000
  0000000000414000
  0004400000414000
  0004340004134000
  0004314441334000
  0004331224440000
  0000433112400000
  0000042444400000
  0000004000000000
  0000000000440000
  0000000004400000
  0000444000000000
  0000044400000000
  0000000000000000
`)

const STARWILLOW_BLADE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000004000000
  0000000042400000
  0000000043340000
  0000000423334000
  0000004274433400
  0000044240043400
  0000422740004400
  0004274400000000
  0004440000000000
  0044000000000000
  0000000000000000
  0000000000000000
`)

const MANA_SPIKE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000440
  0000000000044334
  0000000000438334
  0000000000438840
  0000000004333340
  0000000004834400
  0000000043440000
  0000000044000000
  0000000000000000
  0000000000000000
  0000000004400000
  0000000000444000
  0000000000000000
`)

const CRYSTAL_SPIKE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0440000000000000
  4434400000000000
  4374740000000000
  0444340000000000
  0473344000000000
  0044744000000000
  0000443400000000
  0000004400000000
  0000000000000000
  0000000000000000
  0000044000000000
  0004440000000000
  0000000000000000
`)

const PURE_SPIKE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

const BASIC_RINSTICK = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000004000000
  0000000042400000
  0000000424300000
  0000004240030000
  0000042400030300
  0000041840003000
  0000048810000000
  0000042400000000
  0000044000000000
  0000000000000000
`)

const GLOWFIN_RINSTICK = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000004400000
  0000000047740000
  0000000472430000
  0000004724030000
  0000047240300000
  0000042433000000
  0000041840000000
  0000048810000000
  0000042400000000
  0000044000000000
  0000000000000000
`)

const MOONKOI_RINSTICK = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// =============================================================
// POTION SPRITES — 16x16 bottle shapes (placeholder art)
// Palette: 1=gold, 2=brown, 3=cream, 4=outline, 5=red, 6=green, 7=blue, 8=purple
// =============================================================

// Mana Draught — round blue flask
const MANA_DRAUGHT = px(S, S, `
  0000000000000000
  0000000000000000
  0000000440000000
  0000000440000000
  0000004444000000
  0000047774000000
  0000477777400000
  0000477737400000
  0000477773400000
  0000477777400000
  0000047774000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Shard Tonic — tall thin flask (gold tint)
const SHARD_TONIC = px(S, S, `
  0000000000000000
  0000000000000000
  0000000440000000
  0000000110000000
  0000004444000000
  0000041114000000
  0000041314000000
  0000041114000000
  0000041114000000
  0000041314000000
  0000041114000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Shimmer Salve — wide jar (warm red)
const SHIMMER_SALVE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000004444000000
  0000045554000000
  0000455555400000
  0000455535400000
  0000455555400000
  0000455535400000
  0000455555400000
  0000045554000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Glowfin Brew — round flask (purple glow)
const GLOWFIN_BREW = px(S, S, `
  0000000000000000
  0000000000000000
  0000000440000000
  0000000440000000
  0000004444000000
  0000048884000000
  0000488888400000
  0000488838400000
  0000488888400000
  0000488838400000
  0000048884000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Crystal Elixir — pointed flask (blue+cream)
const CRYSTAL_ELIXIR = px(S, S, `
  0000000000000000
  0000000000000000
  0000000440000000
  0000000440000000
  0000004444000000
  0000047774000000
  0000477377400000
  0000477777400000
  0000477377400000
  0000477777400000
  0000477377400000
  0000047774000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Bond Philter — heart-like flask (purple+cream)
const BOND_PHILTER = px(S, S, `
  0000000000000000
  0000000000000000
  0000000440000000
  0000000440000000
  0000004444000000
  0000048884000000
  0000488388400000
  0000488888400000
  0000488388400000
  0000048884000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Starlight Tincture — tall flask (green glow)
const STARLIGHT_TINCTURE = px(S, S, `
  0000000000000000
  0000000300000000
  0000000440000000
  0000000440000000
  0000004444000000
  0000046664000000
  0000466366400000
  0000466666400000
  0000466366400000
  0000466666400000
  0000466366400000
  0000046664000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Deep Essence — dark round flask (blue+purple)
const DEEP_ESSENCE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000440000000
  0000000440000000
  0000004444000000
  0000047874000000
  0000478787400000
  0000478878400000
  0000478787400000
  0000047874000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Ather Infusion — ornate golden flask
const ATHER_INFUSION = px(S, S, `
  0000000000000000
  0000000300000000
  0000000440000000
  0000001441000000
  0000014444100000
  0000041314000000
  0000413131400000
  0000413313400000
  0000413131400000
  0000413313400000
  0000041314000000
  0000014441000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Dawn Cordial — ornate golden flask with glow
const DAWN_CORDIAL = px(S, S, `
  0000000000000000
  0000003030000000
  0000000440000000
  0000001441000000
  0000014444100000
  0000041514000000
  0000415151400000
  0000415515400000
  0000415151400000
  0000415515400000
  0000041514000000
  0000014441000000
  0000004440000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

export const TOOL_SPRITES: Record<string, SpriteAnim> = {
  goldwood_blade:    { frames: [GOLDWOOD_BLADE], rate: 4 },
  shimmeroak_blade:  { frames: [SHIMMEROAK_BLADE], rate: 4 },
  starwillow_blade:  { frames: [STARWILLOW_BLADE], rate: 4 },
  mana_spike:        { frames: [MANA_SPIKE], rate: 4 },
  crystal_spike:     { frames: [CRYSTAL_SPIKE], rate: 4 },
  pure_spike:        { frames: [PURE_SPIKE], rate: 4 },
  basic_rinstick:    { frames: [BASIC_RINSTICK], rate: 4 },
  glowfin_rinstick:  { frames: [GLOWFIN_RINSTICK], rate: 4 },
  moonkoi_rinstick:  { frames: [MOONKOI_RINSTICK], rate: 4 },
}


// Per-item palettes — each item can have its own colors (0=transparent, 1-N=palette index)
// Items without an entry here fall back to ITEM_PALETTE
export const ITEM_PALETTES: Record<string, string[]> = {
  sunfruit: ['#1a1a2e', '#c89832', '#ae852d', '#dfe859', '#805814', '#236417'],
  moonberry: ['#64c0e8', '#58a5c6', '#4a8aa5', '#1a1a2e', '#865c2d', '#50a040', '#4080c0', '#8060b0'],
  stonemelon: ['#caa5c7', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#e0d6be', '#b493b1'],
  seed_fox: ['#b08e5e', '#546f63', '#dcb173', '#1a1a2e', '#d06040', '#50a040', '#71549c', '#8060b0'],
  seed_axolotl: ['#e87a9a', '#a65970', '#ddb9a6', '#1a1a2e', '#d06040', '#50a040', '#71549c', '#8060b0'],
  seed_water_bear: ['#5b6b78', '#8a9aaa', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#694f92', '#8060b0'],
  spirit_treat: ['#7357db', '#654fb5', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  shimmer_dust: ['#c2ddea', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  goldwood_plank: ['#342718', '#47311a', '#bc9749', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  goldwood_bark: ['#623f12', '#4c310f', '#ceae61', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  raw_mana_shard: ['#d544c8', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#604983', '#8060b0'],
  shimmerscale: ['#d544c8', '#e599df', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  clickclaw: ['#939509', '#a01c5c', '#eae0c2', '#1a1a2e', '#050505', '#50a040', '#4080c0', '#8060b0'],
  shimmeroak_plank: ['#3c280b', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],
  amber_sap: ['#c98c36', '#5a3a10', '#86612d', '#1a1a2e', '#d06040', '#50a040', '#4080c0', '#8060b0'],}

const SHIMMER_DUST_1 = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

export const ITEM_FRAME_MAP: Record<string, string[]> = {
  sunfruit:     ['SUNFRUIT'],
  moonberry:    ['MOONBERRY'],
  stonemelon:   ['STONEMELON'],
  mana_seed:    ['MANA_SEED', 'MANA_SEED_1'],
  // Per-spirit mana seeds — unique art per species (auto-creates const on first save)
  seed_fox:         ['SEED_FOX'],
  seed_axolotl:     ['SEED_AXOLOTL'],
  seed_water_bear:  ['SEED_WATER_BEAR'],
  seed_turtle:      ['SEED_TURTLE'],
  seed_owl:         ['SEED_OWL'],
  seed_frog:        ['SEED_FROG'],
  seed_firefly:     ['SEED_FIREFLY'],
  seed_rabbit:      ['SEED_RABBIT'],
  seed_hummingbird: ['SEED_HUMMINGBIRD'],
  seed_bat:         ['SEED_BAT'],
  spirit_treat: ['SPIRIT_TREAT'],
  shimmer_dust: ['SHIMMER_DUST', 'SHIMMER_DUST_1'],
  // T1 resources
  goldwood_plank:  ['GOLDWOOD_PLANK'],
  raw_mana_shard:  ['RAW_MANA_SHARD'],
  shimmerscale:    ['SHIMMERSCALE'],
  clickclaw:       ['CLICKCLAW'],
  // T2 resources
  shimmeroak_plank: ['SHIMMEROAK_PLANK'],
  amber_sap:        ['AMBER_SAP'],
  violet_crystal:   ['VIOLET_CRYSTAL'],
  storm_crystal:    ['STORM_CRYSTAL'],
  earth_crystal:    ['EARTH_CRYSTAL'],
  water_crystal:    ['WATER_CRYSTAL'],
  glowfin:          ['GLOWFIN'],
  ribboneel:        ['RIBBONEEL'],
  // T3 resources
  starwillow_branch: ['STARWILLOW_BRANCH'],
  starwillow_sap:    ['STARWILLOW_SAP'],
  pure_mana_core:    ['PURE_MANA_CORE'],
  moonkoi:           ['MOONKOI'],
  pearlshell:        ['PEARLSHELL'],
  // T4 resources
  dawnwood_plank:    ['DAWNWOOD_PLANK'],
  crystallized_sap:  ['CRYSTALLIZED_SAP'],
  ather_crystal:     ['ATHER_CRYSTAL'],
  crystal_rinn:      ['CRYSTAL_RINN'],
  // Tools
  goldwood_blade:    ['GOLDWOOD_BLADE'],
  shimmeroak_blade:  ['SHIMMEROAK_BLADE'],
  starwillow_blade:  ['STARWILLOW_BLADE'],
  mana_spike:        ['MANA_SPIKE'],
  crystal_spike:     ['CRYSTAL_SPIKE'],
  pure_spike:        ['PURE_SPIKE'],
  basic_rinstick:    ['BASIC_RINSTICK'],
  glowfin_rinstick:  ['GLOWFIN_RINSTICK'],
  moonkoi_rinstick:  ['MOONKOI_RINSTICK'],
  // Potions
  mana_draught:        ['MANA_DRAUGHT'],
  shard_tonic:         ['SHARD_TONIC'],
  shimmer_salve:       ['SHIMMER_SALVE'],
  glowfin_brew:        ['GLOWFIN_BREW'],
  crystal_elixir:      ['CRYSTAL_ELIXIR'],
  bond_philter:        ['BOND_PHILTER'],
  starlight_tincture:  ['STARLIGHT_TINCTURE'],
  deep_essence:        ['DEEP_ESSENCE'],
  ather_infusion:      ['ATHER_INFUSION'],
  dawn_cordial:        ['DAWN_CORDIAL'],
  // Crop seeds
  seed_shimmerwheat:   ['CROP_SEED_ICON'],
  seed_glowroot:       ['CROP_SEED_ICON'],
  seed_sunpetal:       ['CROP_SEED_ICON'],
  seed_moonvine:       ['CROP_SEED_ICON'],
  seed_crystalcap:     ['CROP_SEED_ICON'],
  seed_starbean:       ['CROP_SEED_ICON'],
  seed_dreamroot:      ['CROP_SEED_ICON'],
  seed_shimmerbloom:   ['CROP_SEED_ICON'],
  seed_atherwheat:     ['CROP_SEED_ICON'],
  seed_dawncap:        ['CROP_SEED_ICON'],
  // Crop harvests
  shimmerwheat_grain:  ['SHIMMERWHEAT_GRAIN'],
  glowroot_bulb:       ['GLOWROOT_BULB'],
  sunpetal_bloom:      ['SUNPETAL_BLOOM'],
  moonvine_leaf:       ['MOONVINE_LEAF'],
  crystalcap_spore:    ['CRYSTALCAP_SPORE'],
  starbean_pod:        ['STARBEAN_POD'],
  dreamroot_essence:   ['DREAMROOT_ESSENCE'],
  shimmerbloom_petal:  ['SHIMMERBLOOM_PETAL'],
  atherwheat_grain:    ['ATHERWHEAT_GRAIN'],
  dawncap_spore:       ['DAWNCAP_SPORE'],
  // Crop potions
  harvest_brew:        ['HARVEST_BREW'],
  moonvine_tonic:      ['MOONVINE_TONIC'],
  dreamroot_elixir:    ['DREAMROOT_ELIXIR'],
  goldwood_bark: ['GOLDWOOD_BARK'],
}

// Per-seed species palettes — same shape, different colors at index 7 (body) and 8 (core)
// Colors pulled from each species' base palette for subtle tinting
const seedPal = (body: string, core: string): readonly string[] => [
  '#d4a843', '#5a3a10', '#f0e6c8', '#1a1a2e', '#d06040', '#50a040', body, core,
]

export const SEED_PALETTES: Record<string, readonly string[]> = {
  seed_fox:         seedPal('#dcb273', '#694126'),   // sandy gold / dark brown
  seed_axolotl:     seedPal('#e87a9a', '#a65970'),   // pink / muted rose
  seed_water_bear:  seedPal('#8a9aaa', '#5a6a78'),   // steel / slate
  seed_turtle:      seedPal('#5a8a4a', '#3a5a30'),   // green / deep green
  seed_owl:         seedPal('#8a6848', '#d8a030'),    // warm brown / golden
  seed_frog:        seedPal('#4a8a3a', '#2a5a20'),    // bright green / forest
  seed_firefly:     seedPal('#e8c830', '#d89020'),    // warm glow / amber
  seed_rabbit:      seedPal('#e8d8c0', '#8a6040'),    // cream / brown
  seed_hummingbird: seedPal('#30a050', '#c83030'),    // iridescent green / ruby
  seed_bat:         seedPal('#584868', '#8858a8'),    // dark purple / violet
}

// Export as SpriteAnims (single frame each, except mana_seed variants which animate)
export const ITEM_ICONS: Record<string, SpriteAnim> = {
  sunfruit:         { frames: [SUNFRUIT], rate: 1 },
  moonberry:        { frames: [MOONBERRY], rate: 1 },
  stonemelon:       { frames: [STONEMELON], rate: 1 },
  // All 10 seeds share the same pixel shape — palette swap in ItemIcon
  seed_fox:         { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  seed_axolotl:     { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  seed_water_bear:  { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  seed_turtle:      { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  seed_owl:         { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  seed_frog:        { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  seed_firefly:     { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  seed_rabbit:      { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  seed_hummingbird: { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  seed_bat:         { frames: [MANA_SEED, MANA_SEED_1], rate: 8 },
  spirit_treat:     { frames: [SPIRIT_TREAT], rate: 1 },
  shimmer_dust:     { frames: [SHIMMER_DUST, SHIMMER_DUST_1], rate: 8 },
  // Resource items — T1
  goldwood_plank:   { frames: [GOLDWOOD_PLANK], rate: 1 },
  raw_mana_shard:   { frames: [RAW_MANA_SHARD], rate: 1 },
  shimmerscale:     { frames: [SHIMMERSCALE], rate: 1 },
  clickclaw:        { frames: [CLICKCLAW], rate: 1 },
  // Resource items — T2
  shimmeroak_plank: { frames: [SHIMMEROAK_PLANK], rate: 1 },
  amber_sap:        { frames: [AMBER_SAP], rate: 1 },
  violet_crystal:   { frames: [VIOLET_CRYSTAL], rate: 1 },
  storm_crystal:    { frames: [STORM_CRYSTAL], rate: 1 },
  earth_crystal:    { frames: [EARTH_CRYSTAL], rate: 1 },
  water_crystal:    { frames: [WATER_CRYSTAL], rate: 1 },
  glowfin:          { frames: [GLOWFIN], rate: 1 },
  ribboneel:        { frames: [RIBBONEEL], rate: 1 },
  // Resource items — T3
  starwillow_branch: { frames: [STARWILLOW_BRANCH], rate: 1 },
  starwillow_sap:    { frames: [STARWILLOW_SAP], rate: 1 },
  pure_mana_core:    { frames: [PURE_MANA_CORE], rate: 1 },
  moonkoi:           { frames: [MOONKOI], rate: 1 },
  pearlshell:        { frames: [PEARLSHELL], rate: 1 },
  // Resource items — T4
  dawnwood_plank:    { frames: [DAWNWOOD_PLANK], rate: 1 },
  crystallized_sap:  { frames: [CRYSTALLIZED_SAP], rate: 1 },
  ather_crystal:     { frames: [ATHER_CRYSTAL], rate: 1 },
  crystal_rinn:      { frames: [CRYSTAL_RINN], rate: 1 },
  // Tools
  goldwood_blade:    { frames: [GOLDWOOD_BLADE], rate: 1 },
  shimmeroak_blade:  { frames: [SHIMMEROAK_BLADE], rate: 1 },
  starwillow_blade:  { frames: [STARWILLOW_BLADE], rate: 1 },
  mana_spike:        { frames: [MANA_SPIKE], rate: 1 },
  crystal_spike:     { frames: [CRYSTAL_SPIKE], rate: 1 },
  pure_spike:        { frames: [PURE_SPIKE], rate: 1 },
  basic_rinstick:    { frames: [BASIC_RINSTICK], rate: 1 },
  glowfin_rinstick:  { frames: [GLOWFIN_RINSTICK], rate: 1 },
  moonkoi_rinstick:  { frames: [MOONKOI_RINSTICK], rate: 1 },
  // Potions
  mana_draught:        { frames: [MANA_DRAUGHT], rate: 1 },
  shard_tonic:         { frames: [SHARD_TONIC], rate: 1 },
  shimmer_salve:       { frames: [SHIMMER_SALVE], rate: 1 },
  glowfin_brew:        { frames: [GLOWFIN_BREW], rate: 1 },
  crystal_elixir:      { frames: [CRYSTAL_ELIXIR], rate: 1 },
  bond_philter:        { frames: [BOND_PHILTER], rate: 1 },
  starlight_tincture:  { frames: [STARLIGHT_TINCTURE], rate: 1 },
  deep_essence:        { frames: [DEEP_ESSENCE], rate: 1 },
  ather_infusion:      { frames: [ATHER_INFUSION], rate: 1 },
  dawn_cordial:        { frames: [DAWN_CORDIAL], rate: 1 },
  // Crop seeds (all share same icon for now)
  seed_shimmerwheat:   { frames: [CROP_SEED_ICON], rate: 1 },
  seed_glowroot:       { frames: [CROP_SEED_ICON], rate: 1 },
  seed_sunpetal:       { frames: [CROP_SEED_ICON], rate: 1 },
  seed_moonvine:       { frames: [CROP_SEED_ICON], rate: 1 },
  seed_crystalcap:     { frames: [CROP_SEED_ICON], rate: 1 },
  seed_starbean:       { frames: [CROP_SEED_ICON], rate: 1 },
  seed_dreamroot:      { frames: [CROP_SEED_ICON], rate: 1 },
  seed_shimmerbloom:   { frames: [CROP_SEED_ICON], rate: 1 },
  seed_atherwheat:     { frames: [CROP_SEED_ICON], rate: 1 },
  seed_dawncap:        { frames: [CROP_SEED_ICON], rate: 1 },
  // Crop harvest items
  shimmerwheat_grain:  { frames: [SHIMMERWHEAT_GRAIN], rate: 1 },
  glowroot_bulb:       { frames: [GLOWROOT_BULB], rate: 1 },
  sunpetal_bloom:      { frames: [SUNPETAL_BLOOM], rate: 1 },
  moonvine_leaf:       { frames: [MOONVINE_LEAF], rate: 1 },
  crystalcap_spore:    { frames: [CRYSTALCAP_SPORE], rate: 1 },
  starbean_pod:        { frames: [STARBEAN_POD], rate: 1 },
  dreamroot_essence:   { frames: [DREAMROOT_ESSENCE], rate: 1 },
  shimmerbloom_petal:  { frames: [SHIMMERBLOOM_PETAL], rate: 1 },
  atherwheat_grain:    { frames: [ATHERWHEAT_GRAIN], rate: 1 },
  dawncap_spore:       { frames: [DAWNCAP_SPORE], rate: 1 },
  // Crop potions
  harvest_brew:        { frames: [HARVEST_BREW], rate: 1 },
  moonvine_tonic:      { frames: [MOONVINE_TONIC], rate: 1 },
  dreamroot_elixir:    { frames: [DREAMROOT_ELIXIR], rate: 1 },
  goldwood_bark: { frames: [GOLDWOOD_BARK], rate: 1 },
}

// =============================================================
// RESOURCE NODE WORLD SPRITES — rendered on the map (like planted seeds)
// Placeholder art — Alex replaces with proper pixel art
// =============================================================

// --- Goldwood Tree (harvestable) — golden canopy, brown trunk ---
const GOLDWOOD_NODE = px(S, S, `
  00000000000055555500000000000000
  00000000000532222350000000000000
  00000000005555335555555000000000
  00000055552223553222223550000000
  00000532221123343211111235000000
  00005321111112432111111113500000
  00053211111144224111111112500000
  00532111111411111441411552500000
  00521111111111441111111445500000
  05211112551114114111111114550000
  05211135441114114111111111145000
  05211254111114114411111111113500
  05211251111114111441111111114500
  05312541111141111114111111111350
  00525411111411111111411111111450
  00054111114111111111141111221450
  00054111141111111111111111152450
  00054111141111121111114111152450
  00541111411111152111114111145350
  00541111111111152111111411115500
  00541111111111152111111111115000
  00541111111511152111111111115000
  00545111111511145111111111115000
  00054111111511115411111115415000
  00051111135411114534111114545000
  00054111454111414555444443550000
  00055443505444545777555555000000
  00005555000555755777500000000000
  00000000000577777767500000000000
  00000000000566666667550000000000
  00000000005566666677575000000000
  00000000057566666777777500000000
`)

// --- Goldwood Tree (depleted) — bare stump ---
const GOLDWOOD_DEPLETED = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000005550555000000000000
  00000000000053225223555550000000
  00000005555525222225222235500000
  00000053222222222222211122350000
  00000532111111122542111111225000
  00005321111111245421111111125000
  00005252111511124211111111115000
  00000521455111112111111111545000
  00005214551111111111511141155000
  00005145511115111111451114150000
  00005455311154115211451115150000
  00000505151154114511451115450000
  00000000511454114511454111500000
  00000005414554415414455411350000
  00000005415505414514450541500000
  00000005445005441144500051500000
  00000000545000544445000053500000
  00000000545005754455000005000000
  00000000050005775575000000000000
  00000000000005767777500000000000
  00000000000057566677500000000000
  00000000000576666667500000000000
  00000000000566666667550000000000
  00000000005566666677575000000000
  00000000057566666777777500000000
`)

// --- Shimmeroak (harvestable) ---
const SHIMMEROAK_NODE = px(S, S, `
  00000000000000000000000000000000
  00000666006666666666000000000000
  00006222662222222222668066000000
  00062116221111111111226622600000
  00621662711111111111112611266000
  00626211111111111111111111111600
  00262111111111111111111111111600
  00621111111211111111111211111360
  06211111112811111111111121113600
  06111131111211111111111111111160
  63111111111111111111111111131276
  63111111111111111111111111111126
  63111111111111111111111211113136
  63111111111111111111111211111136
  62131111111111111111112711111136
  68211111111211111111111111131136
  66113111111721111111111111113636
  06613111111111111111111111113360
  63661111111111111111111111113336
  06331111111111111111111111113336
  06311111111111111111111111133336
  00631111811111111111111111333336
  00633331611111111111611133333360
  00066633631111111111633333333680
  00000066063331111111363333336000
  00000000076663333333606666660000
  00000000000056666666000000000000
  00000000000045555555000000000000
  00000000000044444455000000000000
  00000000000044444445000000000000
  00000000000044444445000000000000
  00000000000044444455000000000000
`)

// --- Shimmeroak (depleted) ---
const SHIMMEROAK_DEPLETED = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000866666666000000000000
  00000000000622222227600000000000
  00000000066222222222266000000000
  00000000622221112222222600000000
  00000006221111111111122260000000
  00000006211111121111111268000000
  00000062111111112111111126000000
  00000621111111111111111113600000
  00006211111111111111111111360000
  00006211111211111111111111360000
  00008212112711111111111111360000
  00006112111111111111111111360000
  00006111211111111111111111360000
  00006111111111111111111113360000
  00006111111111118211111133360000
  00000611111111111111111333600000
  00000061111111111133333336000000
  00000006211111133333333367000000
  00000007633333333333333600000000
  00000000066333333333336000000000
  00000000000633333233660000000000
  00000000000666666866600000000000
  00000000000655555445600000000000
  00000000000644445555600000000000
  00000000000644444455600000000000
  00000000000644444445600000000000
  00000000000644444455600000000000
`)

// --- Starwillow (harvestable) ---
const STARWILLOW_NODE = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000044000000000000000
  00000040044044422404440000000000
  00000424422422222442224000000000
  00004212411142222422224044000000
  00042111241111124211242422400000
  00042111111111212112411211240000
  00042111124113424311122111124000
  00421111243111343111144211112400
  00411112431111134411113442111400
  04241114311111111111111134111400
  04241114311111111111111113411400
  04141114311112411111111111411340
  04241134311114111111111111341340
  04141134311114111111111111141340
  00741347311124111111111111141340
  00041341431141111111113111141340
  00043433431411114111111311711340
  00433433414111143111111311113400
  00413433434111431111111141113400
  00473433431714311111111131114700
  00044433431114341114113141314000
  00000433431334343113414141434000
  00000041334343344313414141431400
  00000004134344746433414474047400
  00000004334404446433414000004000
  00000007440404666643474000000000
  00000000000004555664040000000000
  00000000000004555564000000000000
  00000000000004555564000000000000
`)

// --- Starwillow (depleted) ---
const STARWILLOW_DEPLETED = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000004404404400000000000000
  00000000044442242244444000000000
  00000004422224424422222400000000
  00000044211112242211444240000000
  00000042414411222111133400000000
  00000044141112424211111340000000
  00000411411111343111411340000000
  00000411111141131111341134000000
  00004111114411143111134334000000
  00004111141111114111113434000000
  00004144433111114111111343400000
  00004744311111114111131143400000
  00000043111411143311143114700000
  00000041114311114314143114400000
  00000043434114414334134314000000
  00000041434114311434134414000000
  00000007434143341434714070000000
  00000000014143441434314040000000
  00000000014143414434414000000000
  00000000074143474434314000000000
  00000000004104446744470000000000
  00000000000704666444400000000000
  00000000000004555664000000000000
  00000000000004555564000000000000
  00000000000004555564000000000000
`)

// --- Dawnwood (harvestable) ---
const DAWNWOOD_NODE = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000444440044444440444440000000
  00007821224422222224422224000000
  00048311124221112222242114400000
  00423112242111111222224113870000
  00421124431111112111224111340000
  00421243111788111111124111344000
  00413431111771111111112413334000
  00444444444111111111112433434000
  00042222111421111111112444344000
  00421111113412111111112433134000
  00431811111421111111124211113400
  00431881113412111111242111188700
  00433778113421111111421111877340
  00433111113411118711421111181340
  00433311133411117731411111133340
  00044333334441113331411111333400
  00000443334341111111343333334000
  00000434443341111111434443340000
  00000433331341111114311134400000
  00000433181143111114111134000000
  00000041878134311134118334000000
  00000048783333431341187840000000
  00000000044444433333338700000000
  00000000000004644433344000000000
  00000000000004666644400000000000
  00000000000004555640000000000000
  00000000000044555644000000000000
  00000000000454556646400000000000
  00000000004664566666640000000000
`)

// --- Dawnwood (depleted) ---
const DAWNWOOD_DEPLETED = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000004555640000000000000
  00000000000044555644000000000000
  00000000000454556646400000000000
  00000000004664566666640000000000
`)

// --- Mana Crystal (harvestable) — white/cream crystal with purple core ---
const CRYSTAL_NODE = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000088000000000
  00000000000087044140878800000000
  00000000000888711214777800000000
  00000000000887772222377700000000
  00000000444777762226357540000000
  00000044212477666262632214000000
  00004421121213666665361223440000
  00041212222223666555663222314000
  00428822222223666556632322234000
  00088722222236666556612833343400
  00887773223236665566322388534000
  00877776363663666661222388734000
  00777766663666366632233888734000
  00004668655363666632388877534300
  00004688885536666663887755553400
  00004678875536668565355555553400
  00034557755355687553555555535400
  00043555553555677553555555535240
  00435555553555577755355555553540
  04553552555335557755535555555354
  00113322555235555755523555252310
  00001232522235525555223525521230
  00000001122311112112131221100000
  00000000000000000000000000000000
`)

// --- Mana Crystal (depleted) — dim, cracked ---
const CRYSTAL_DEPLETED = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000044140000000000000
  00000000000000411214470000000000
  00000000000444742222347400000000
  000000004447bb462226354540000000
  00000044212444666262632214000000
  00004421121213666665361223440000
  00041212222223666555663222314000
  00424422222223666556632322234000
  00048b22222236666556612433343400
  0004bb4322323666556632234b534000
  00004b4636366366666122234bb34000
  0000046666366636663223348bb34000
  00004664655363666632344bbb534300
  0000464bbb553666666348bbb5553400
  0000464b8b55366645653bbb55553400
  0003455bb5535564b553555555535400
  0004355555355564b553555555535240
  00435555553555547b55355555553540
  04553552555335554b55535555555354
  00113322555235555455523555252310
  00001232522235525555223525521230
  00000001122311112112131221100000
  00000000000000000000000000000000
`)

// --- Element Crystal (harvestable) ---
const ELEMENT_CRYSTAL_NODE = px(S, S, `
  0000000000000000
  0000000440000000
  0000004774044000
  0004443333477400
  0043774333477340
  0433774333344340
  0433443333334774
  0434333044334774
  4377433477434444
  4377433477433444
  0434333044333340
  0434443333333340
  0040004333443400
  0000000444004440
  0000000000000000
  0000000000000000
`)

// --- Element Crystal (depleted) ---
const ELEMENT_CRYSTAL_DEPLETED = px(S, S, `
  0000000000000000
  0000000000000000
  0000004004040000
  0004443443434400
  0043434333473340
  0433334333344340
  0433443333334334
  0434333044334374
  4333433473434444
  4333433433433444
  0434333044333340
  0434443333333340
  0040004333443400
  0000000444004440
  0000000000000000
  0000000000000000
`)

// --- Pure Core Node (harvestable) ---
const PURE_CORE_NODE = px(S, S, `
  0000000000000000
  0000000000000000
  0000044440000000
  0000444444400000
  0000444884440000
  0004448888844000
  0044888888884400
  0048888888888440
  0488888888888440
  0488888888884444
  0048888888844444
  0048888888444444
  0004484444444440
  0000044444440000
  0000000000000000
  0000000000000000
`)

// --- Pure Core Node (depleted) ---
const PURE_CORE_DEPLETED = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000044000000000
  0000448400000000
  0004888840000000
  0048888884000000
  0004444444000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Ather Crystal (harvestable) ---
const ATHER_CRYSTAL_NODE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000400000000
  0000003840000000
  0000038384000000
  0000383834000000
  0000388834000000
  0000383834000000
  0000038384000000
  0000003840000000
  0000000400000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Ather Crystal (depleted) ---
const ATHER_CRYSTAL_DEPLETED = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000400000000
  0000004240000000
  0000042424000000
  0000042424000000
  0000004240000000
  0000000400000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Fishing Spot — water ripple circles ---
const FISHING_NODE = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000060000000000000000
  00000000000000000000000000000000
  00000060000000000000000000000000
  00000000000000000000000060000000
  00000000000066666000000000000000
  00060000000677777660000000000000
  00000000006788888776600000000000
  00000000067888888887760000000000
  00000000678888888888876000060000
  00000006788888888888887600000000
  00000006788888866888888760000000
  00000006788888677688888876000000
  00000067888886787768888876000000
  00000067888867888768888887600000
  06000067888867888768888887600000
  00000006788886788768888876000000
  00000067888888677768888876000000
  00000006788888866688888876000000
  00000067888888888888888876000000
  00000006788888888888888760000600
  00000000678888888887777600000000
  00000000067778888776666000000000
  00600000006667777660000000000000
  00000000000006666000000000000000
  00000006000000000000006000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000006000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

// --- Fishing Spot (depleted) — faint single ripple ---
const FISHING_DEPLETED = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000007700000000
  0000770077000000
  0000700007000000
  0000770077000000
  0000007700000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Stream (harvestable) ---
const STREAM_NODE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000007700000000
  0000770077000000
  0007000000700000
  0007000000700000
  0000770077000000
  0000007700000000
  0000000000000000
  0000770077000000
  0007000000700000
  0000770077000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Stream (depleted) ---
const STREAM_DEPLETED = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000007700000000
  0000770077000000
  0000700007000000
  0000770077000000
  0000007700000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Lake (harvestable) ---
const LAKE_NODE = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000007700000000
  0000770077000000
  0007000000700000
  0007000000700000
  0000770077000000
  0000007700000000
  0000000000000000
  0000770077000000
  0007000000700000
  0000770077000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- Lake (depleted) ---
const LAKE_DEPLETED = px(S, S, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000007700000000
  0000770077000000
  0000700007000000
  0000770077000000
  0000007700000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Node type → sprite mapping (harvestable and depleted states)
// Each node type has its own unique sprite constants for independent editing
export type NodeSpriteState = 'harvestable' | 'depleted'

const CRYSTAL_NODE_1 = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000088000000000
  00000000000987044140878800000000
  00000000000888711214777800000000
  00000000000887772222377700000000
  00000000444777762226357540000000
  00000044212477666262632214000000
  00004421121213666665361223440000
  00041212222223666555663222314000
  00428822222223666556632322234000
  00088722222236666556612833343400
  00887773223236665566322388534000
  00877776363663666661222388734000
  00777766663666366632233888734000
  00004668655363666632388877534300
  00004688885536666663887755553400
  00004678875536668565355555553400
  00034557755355687553555555535400
  00043555553555677553555555535240
  00435555553555577755355555553540
  04553552555335557755535555555354
  00113322555235555755523555252310
  00001232522235525555223525521230
  00000001122311112112131221100000
  00000000000000000000000000000000
`)

const PURE_CORE_NODE_1 = px(S, S, `
  0000000000000000
  0000000000000000
  0000044440000000
  0000444884400000
  0000448888440000
  0004888888884000
  0048888888888400
  0088888888888440
  0488888888888440
  0488888888888444
  0048888888884444
  0048888888844444
  0004484444444440
  0000044444440000
  0000000000000000
  0000000000000000
`)

const PURE_CORE_NODE_2 = px(S, S, `
  0000000000000000
  0000000000000000
  0000044440000000
  0000444444400000
  0000444884440000
  0004448888844000
  0044888888884400
  0048888888888440
  0488888888888440
  0488888888884444
  0048888888844444
  0048888888444444
  0004484444444440
  0000044444440000
  0000000000000000
  0000000000000000
`)

const PURE_CORE_NODE_3 = px(S, S, `
  0000000000000000
  0000000000000000
  0000044440000000
  0000444444400000
  0000444884440000
  0004448888844000
  0044888888884400
  0048888888888440
  0488888888888440
  0488888888884444
  0048888888844444
  0048888888444444
  0004484444444440
  0000044444440000
  0000000000000000
  0000000000000000
`)


// Ather Soil — glowing earth patch where mana seeds can be planted
const ATHER_SOIL_NODE = px(S, S, `
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000044400000000000000000
  0000000004422244000000000000000
  0000000042211122400000000000000
  0000004422111111224000000000000
  0000042211111111112400000000000
  0004422111111111111224000000000
  0004211111111111111112400000000
  0042111111111111111111240000000
  0421111111111111111111124000000
  0042211111111111111111240000000
  0004422111111111111224000000000
  0000044222111112224400000000000
`)

// Ather Soil (occupied — seed planted, soil darkens)
const ATHER_SOIL_PLANTED = px(S, S, `
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000000000000000000000000
  0000000000044400000000000000000
  0000000004433344000000000000000
  0000000043311133400000000000000
  0000004433111111334000000000000
  0000043311111111113400000000000
  0004433111111111111334000000000
  0004311111111111111113400000000
  0043111111111111111111340000000
  0431111111111111111111134000000
  0043311111111111111111340000000
  0004433111111111111334000000000
  0000044333111113334400000000000
`)

const SHIMMEROAK_NODE_1 = px(S, S, `
  00000000000000000000000000000000
  00000666006666666666000000000000
  00006222662222222222667066000000
  00062116221111111111226622600000
  00621662811111111111112611266000
  00626211111111111111111111111600
  00262111111111111111111111111600
  00621111111211111111111211111360
  06211111112811111111111121113600
  06111131111211111111111111111160
  63111111111111111111111111131286
  63111111111111111111111111111126
  63111111111111111111111211113136
  63111111111111111111111211111136
  62131111111111111111112811111136
  67211111111211111111111111131136
  66113111111821111111111111113636
  06613111111111111111111111113360
  63661111111111111111111111113336
  06331111111111111111111111113336
  06311111111111111111111111133336
  00631111711111111111111111333336
  00633331611111111111611133333360
  00066633631111111111633333333670
  00000066063331111111363333336000
  00000000086663333333606666660000
  00000000000056666666000000000000
  00000000000045555555000000000000
  00000000000044444455000000000000
  00000000000044444445000000000000
  00000000000044444445000000000000
  00000000000044444455000000000000
`)

const FISHING_NODE_1 = px(S, S, `
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000060000000000000000
  00000000000000000000000000000000
  00000060000000000000000000000000
  00000000000000000000000060000000
  00000000000066666000000000000000
  00060000000677777660000000000000
  00000000006788888776600000000000
  00000000067888888887760000000000
  00000000678888888888876000060000
  00000006788888888888887600000000
  00000006788888866888888760000000
  00000006788888677688888876000000
  00000067888886787768888876000000
  06000066788886788768888876600000
  00000067888888677768888876000000
  00000006788888866688888876000000
  00000067888888888888888876000000
  00000006788888888888888760000600
  00000000678888888887777600000000
  00000000067778888776666000000000
  00600000006667777660000000000000
  00000000000006666000000000000000
  00000006000000000000006000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000006000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
  00000000000000000000000000000000
`)

export const NODE_SPRITES: Record<string, Record<NodeSpriteState, SpriteAnim>> = {
  // Forestry
  goldwood:    { harvestable: { frames: [GOLDWOOD_NODE], rate: 8 }, depleted: { frames: [GOLDWOOD_DEPLETED], rate: 1 } },
  shimmeroak:  { harvestable: { frames: [SHIMMEROAK_NODE, SHIMMEROAK_NODE_1], rate: 8 }, depleted: { frames: [SHIMMEROAK_DEPLETED], rate: 8 } },
  starwillow:  { harvestable: { frames: [STARWILLOW_NODE], rate: 8 }, depleted: { frames: [STARWILLOW_DEPLETED], rate: 1 } },
  dawnwood:    { harvestable: { frames: [DAWNWOOD_NODE], rate: 8 }, depleted: { frames: [DAWNWOOD_DEPLETED], rate: 1 } },
  // Prospecting
  raw_mana_node:        { harvestable: { frames: [CRYSTAL_NODE, CRYSTAL_NODE_1], rate: 8 }, depleted: { frames: [CRYSTAL_DEPLETED], rate: 1 } },
  element_crystal_node: { harvestable: { frames: [ELEMENT_CRYSTAL_NODE], rate: 1 }, depleted: { frames: [ELEMENT_CRYSTAL_DEPLETED], rate: 1 } },
  pure_core_node:       { harvestable: { frames: [PURE_CORE_NODE, PURE_CORE_NODE_1, PURE_CORE_NODE_2, PURE_CORE_NODE_3], rate: 8 }, depleted: { frames: [PURE_CORE_DEPLETED], rate: 1 } },
  ather_crystal_node:   { harvestable: { frames: [ATHER_CRYSTAL_NODE], rate: 1 }, depleted: { frames: [ATHER_CRYSTAL_DEPLETED], rate: 1 } },
  // Rinning
  small_pond: { harvestable: { frames: [FISHING_NODE, FISHING_NODE_1], rate: 8 }, depleted: { frames: [FISHING_DEPLETED], rate: 1 } },
  stream:     { harvestable: { frames: [STREAM_NODE], rate: 1 }, depleted: { frames: [STREAM_DEPLETED], rate: 1 } },
  lake:       { harvestable: { frames: [LAKE_NODE], rate: 1 }, depleted: { frames: [LAKE_DEPLETED], rate: 1 } },
  // Farming
  ather_soil: { harvestable: { frames: [ATHER_SOIL_NODE], rate: 1 }, depleted: { frames: [ATHER_SOIL_PLANTED], rate: 1 } },
}

// Node type labels for editor UI
export const NODE_TYPE_LABELS: Record<string, { name: string; category: string; above: boolean }> = {
  goldwood:             { name: 'Goldwood Tree', category: 'Forestry', above: true },
  shimmeroak:           { name: 'Shimmeroak', category: 'Forestry', above: true },
  starwillow:           { name: 'Starwillow', category: 'Forestry', above: true },
  dawnwood:             { name: 'Dawnwood', category: 'Forestry', above: true },
  raw_mana_node:        { name: 'Raw Mana Crystal', category: 'Prospecting', above: false },
  element_crystal_node: { name: 'Element Crystal', category: 'Prospecting', above: false },
  pure_core_node:       { name: 'Pure Core Node', category: 'Prospecting', above: false },
  ather_crystal_node:   { name: 'Ather Crystal', category: 'Prospecting', above: false },
  small_pond:           { name: 'Small Pond', category: 'Rinning', above: false },
  stream:               { name: 'Stream', category: 'Rinning', above: false },
  lake:                 { name: 'Lake', category: 'Rinning', above: false },
  ather_soil:           { name: 'Ather Soil', category: 'Farming', above: false },
}

// Frame const name mapping for save-sprite API (nodes use species='nodes')
// Every node type has its own unique harvestable (_h) and depleted (_d) sprite
export const NODE_FRAME_MAP: Record<string, string[]> = {
  // Forestry
  goldwood_h:             ['GOLDWOOD_NODE'],
  goldwood_d:             ['GOLDWOOD_DEPLETED'],
  shimmeroak_h:           ['SHIMMEROAK_NODE', 'SHIMMEROAK_NODE_1'],
  shimmeroak_d:           ['SHIMMEROAK_DEPLETED'],
  starwillow_h:           ['STARWILLOW_NODE'],
  starwillow_d:           ['STARWILLOW_DEPLETED'],
  dawnwood_h:             ['DAWNWOOD_NODE'],
  dawnwood_d:             ['DAWNWOOD_DEPLETED'],
  // Prospecting
  raw_mana_node_h:        ['CRYSTAL_NODE', 'CRYSTAL_NODE_1'],
  raw_mana_node_d:        ['CRYSTAL_DEPLETED'],
  element_crystal_node_h: ['ELEMENT_CRYSTAL_NODE'],
  element_crystal_node_d: ['ELEMENT_CRYSTAL_DEPLETED'],
  pure_core_node_h:       ['PURE_CORE_NODE', 'PURE_CORE_NODE_1', 'PURE_CORE_NODE_2', 'PURE_CORE_NODE_3'],
  pure_core_node_d:       ['PURE_CORE_DEPLETED'],
  ather_crystal_node_h:   ['ATHER_CRYSTAL_NODE'],
  ather_crystal_node_d:   ['ATHER_CRYSTAL_DEPLETED'],
  // Rinning
  small_pond_h:           ['FISHING_NODE', 'FISHING_NODE_1'],
  small_pond_d:           ['FISHING_DEPLETED'],
  stream_h:               ['STREAM_NODE'],
  stream_d:               ['STREAM_DEPLETED'],
  lake_h:                 ['LAKE_NODE'],
  lake_d:                 ['LAKE_DEPLETED'],
  // Farming
  ather_soil_h:           ['ATHER_SOIL_NODE'],
  ather_soil_d:           ['ATHER_SOIL_PLANTED'],
}
