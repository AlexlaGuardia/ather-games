// NPC definitions — placed entities with dialogue
// Sprites use the same px() encoding as spirit sprites

import { px } from '../sprites/sprite-data'
import type { PlayerDirection } from '../engine/player'
import { GREGORY_PALETTE } from '../sprites/gregory'
import type { TrainerConfig } from '../engine/encounters'
import { DIALOGUES } from './dialogue-data'

export interface NPCDef {
  id: string
  name: string
  zone: string
  tileX: number
  tileY: number
  direction: PlayerDirection
  dialogueId: string
  sprite: Uint8Array
  palette: string[]
  returnDialogueId?: string // use this dialogue after primary is completed (non-repeatable)
  dialogueChain?: { dialogueId: string; requiresFlag?: string }[] // ordered progression, picks first unlocked
  blocking?: boolean       // tile is impassable when NPC present
  hideWhenFlag?: string    // NPC disappears when this flag is set
  trainer?: TrainerConfig  // if set, battle triggers after return dialogue completes
  patrolPath?: { tileX: number; tileY: number }[]  // waypoints for patrol movement
}

/** Resolve which dialogue to use for an NPC given current flags */
export function resolveNPCDialogue(npc: NPCDef, flags: Record<string, boolean>): string {
  // If NPC has a dialogue chain, walk it
  if (npc.dialogueChain && npc.dialogueChain.length > 0) {
    for (const step of npc.dialogueChain) {
      if (!step.requiresFlag || flags[step.requiresFlag]) {
        // This step is unlocked — but check if its dialogue is non-repeatable and already done
        const dlg = DIALOGUES[step.dialogueId]
        if (dlg && !dlg.repeatable && dlg.onComplete && flags[dlg.onComplete]) {
          continue // already completed, try next step
        }
        return step.dialogueId
      }
    }
    // All chain steps exhausted — fall back to last step's dialogue
    return npc.dialogueChain[npc.dialogueChain.length - 1].dialogueId
  }

  // Legacy: simple primary/return pattern
  const primaryDlg = DIALOGUES[npc.dialogueId]
  const useReturn = primaryDlg && !primaryDlg.repeatable && primaryDlg.onComplete && flags[primaryDlg.onComplete]
  return (useReturn && npc.returnDialogueId) ? npc.returnDialogueId : npc.dialogueId
}

// --- NPC sprites (16x16, 1-3 palette indices) ---

const WISP_SPRITE = px(16, 16, `
  0000000000000000
  0000000000000000
  0000000330000000
  0000003223000000
  0000032112300000
  0000321111230000
  0000321131230000
  0000032112300000
  0000003223000000
  0000000330000000
  0000000300000000
  0000000030000000
  0000000300000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

const SPORE_SPRITE = px(16, 16, `
  0000000330000000
  0000003223000000
  0000032222300000
  0000322222300000
  0000322122300000
  0000032222300000
  0000003223000000
  0000000330000000
  0000000110000000
  0000000110000000
  0000001111000000
  0000000110000000
  0000000110000000
  0000001001000000
  0000010000100000
  0000000000000000
`)

// Sleeping spirit — small curled-up blob, Gregory's companion
const SLEEPING_SPIRIT_SPRITE = px(16, 16, `
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000330000000
  0000003223000000
  0000032112300000
  0000031111300000
  0000032112300000
  0000003223000000
  0000000330000000
  0000000300000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Gregory — uses down_idle frame 0 from gregory.ts
const GREGORY_SPRITE = px(16, 16, `
  0000000000000000
  0000003330000000
  0000033333000000
  0000032223000000
  0000032323000000
  0000002220000000
  0000011111000000
  0000011111000000
  0000021112000000
  0000011111000000
  0000011011000000
  0000011011000000
  0000033033000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Bramble — stocky farmer NPC, brown/green palette
const BRAMBLE_SPRITE = px(16, 16, `
  0000000000000000
  0000003330000000
  0000033333000000
  0000032223000000
  0000032323000000
  0000002220000000
  0000011111000000
  0000011211000000
  0000011111000000
  0000011111000000
  0000011011000000
  0000011011000000
  0000022022000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Ember — small fiery trader NPC, orange/red palette
const EMBER_SPRITE = px(16, 16, `
  0000000000000000
  0000000330000000
  0000003223000000
  0000032112300000
  0000032132300000
  0000032112300000
  0000003223000000
  0000000330000000
  0000001111000000
  0000001111000000
  0000001111000000
  0000001001000000
  0000010000100000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Luna NPC — serene healer, blue/silver palette
const LUNA_NPC_SPRITE = px(16, 16, `
  0000000000000000
  0000003330000000
  0000033333000000
  0000031113000000
  0000031313000000
  0000001110000000
  0000022222000000
  0000022222000000
  0000022122000000
  0000022222000000
  0000022022000000
  0000022022000000
  0000033033000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Rootweaver — hunched alchemist, purple/green palette
const ROOTWEAVER_SPRITE = px(16, 16, `
  0000000000000000
  0000033330000000
  0000322233000000
  0000321123000000
  0000032223000000
  0000033330000000
  0000011110000000
  0000011110000000
  0000021120000000
  0000011110000000
  0000011010000000
  0000011010000000
  0000022020000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Echo — mysterious floating orb, teal/white palette
const ECHO_SPRITE = px(16, 16, `
  0000000000000000
  0000000000000000
  0000000330000000
  0000003113000000
  0000031111300000
  0000311331130000
  0000311111130000
  0000031111300000
  0000003113000000
  0000000330000000
  0000000300000000
  0000000030000000
  0000000300000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Dusk — cloaked scout, dark blue/gray palette
const DUSK_SPRITE = px(16, 16, `
  0000000000000000
  0000003330000000
  0000033333000000
  0000032223000000
  0000032323000000
  0000002220000000
  0000111111100000
  0000112211100000
  0000111111100000
  0000011111000000
  0000011011000000
  0000011011000000
  0000011011000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// Community Gate — stone archway with golden shimmer
const GATE_SPRITE = px(16, 16, `
  0000011111000000
  0000122222100000
  0001233333210000
  0012300000321000
  0123000000032100
  0123000000032100
  0123000030032100
  0123000303032100
  0123003030032100
  0123030300032100
  0123303000032100
  0123000000032100
  0123000000032100
  0123000000032100
  1230000000003210
  1111111111111110
`)

// Moss — slow-moving tree spirit, deep green/brown palette
const MOSS_SPRITE = px(16, 16, `
  0000000000000000
  0000033333000000
  0000333333300000
  0000332223300000
  0000033333000000
  0000003330000000
  0000002220000000
  0000002220000000
  0000002220000000
  0000022222000000
  0000002220000000
  0000002220000000
  0000022022000000
  0000220002200000
  0000000000000000
  0000000000000000
`)

// Glint — tiny mana sprite, bright cyan/white palette
const GLINT_SPRITE = px(16, 16, `
  0000000000000000
  0000000000000000
  0000000300000000
  0000003130000000
  0000031113000000
  0000311311300000
  0000031113000000
  0000003130000000
  0000000300000000
  0000000300000000
  0000000030000000
  0000000300000000
  0000000000000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- NPC registry ---

export const NPCS: NPCDef[] = [
  {
    id: 'wisp',
    name: 'Wisp',
    zone: 'garden',
    tileX: 7, tileY: 2,
    direction: 'down',
    dialogueId: 'wisp-intro',
    sprite: WISP_SPRITE,
    palette: ['#d4a843', '#f0e0a0', '#ffffff'],
  },
  {
    id: 'spore',
    name: 'Spore',
    zone: 'mycelial-path',
    tileX: 10, tileY: 14,
    direction: 'down',
    dialogueId: 'mycelial-keeper',
    sprite: SPORE_SPRITE,
    palette: ['#6b4e71', '#9b7fa0', '#c8b8d0'],
  },
  {
    id: 'sleeping-spirit',
    name: 'Sleeping Spirit',
    zone: 'garden',
    tileX: 25, tileY: 16,
    direction: 'down',
    dialogueId: 'sleeping-spirit',
    sprite: SLEEPING_SPIRIT_SPRITE,
    palette: ['#607898', '#90b0c8', '#d0e0f0'],
    blocking: true,
    hideWhenFlag: 'tutorialComplete',
  },
  {
    id: 'gregory',
    name: 'Gregory',
    zone: 'moonwell-glade-gregory-s-home',
    tileX: 2, tileY: 5,
    direction: 'down',
    dialogueId: 'gregory-intro',
    returnDialogueId: 'gregory-challenge',
    dialogueChain: [
      { dialogueId: 'gregory-intro' },
      { dialogueId: 'gregory-challenge', requiresFlag: 'tutorialComplete' },
      { dialogueId: 'gregory-moglin-warning', requiresFlag: 'gregoryFirstWin' },
      { dialogueId: 'gregory-tablet', requiresFlag: 'gregorySeedChoice' },
      { dialogueId: 'gregory-post-tablet', requiresFlag: 'spiritTabletReceived' },
    ],
    sprite: GREGORY_SPRITE,
    palette: GREGORY_PALETTE,
    trainer: {
      species: 'owl',
      name: "Gregory\'s Owl",
      levelOffset: 2,
      element: 'mana',
      aiTier: 'trained',
    },
  },
  {
    id: 'bramble',
    name: 'Bramble',
    zone: 'spirit-meadow',
    tileX: 20, tileY: 12,
    direction: 'down',
    dialogueId: 'bramble-intro',
    dialogueChain: [
      { dialogueId: 'bramble-intro' },
      { dialogueId: 'bramble-return', requiresFlag: 'metBramble' },
    ],
    sprite: BRAMBLE_SPRITE,
    palette: ['#5a3e28', '#7a9a4a', '#c8b088'],
  },
  {
    id: 'ember',
    name: 'Ember',
    zone: 'spirit-meadow',
    tileX: 8, tileY: 15,
    direction: 'down',
    dialogueId: 'ember-intro',
    dialogueChain: [
      { dialogueId: 'ember-intro' },
      { dialogueId: 'ember-return', requiresFlag: 'metEmber' },
    ],
    sprite: EMBER_SPRITE,
    palette: ['#d45a20', '#f0a040', '#ffe080'],
  },
  {
    id: 'luna_npc',
    name: 'Luna',
    zone: 'moonwell-glade',
    tileX: 12, tileY: 8,
    direction: 'down',
    dialogueId: 'luna-intro',
    dialogueChain: [
      { dialogueId: 'luna-intro' },
      { dialogueId: 'luna-heal', requiresFlag: 'metLuna' },
    ],
    sprite: LUNA_NPC_SPRITE,
    palette: ['#607898', '#90b0d8', '#d0e0f8'],
  },
  {
    id: 'rootweaver',
    name: 'Rootweaver',
    zone: 'moonwell-glade',
    tileX: 16, tileY: 11,
    direction: 'left',
    dialogueId: 'rootweaver-intro',
    sprite: ROOTWEAVER_SPRITE,
    palette: ['#4a3060', '#7a5a8a', '#a0c870'],
  },
  {
    id: 'echo',
    name: 'Echo',
    zone: 'spore-hollow',
    tileX: 8, tileY: 8,
    direction: 'down',
    dialogueId: 'echo-riddle',
    sprite: ECHO_SPRITE,
    palette: ['#40a0a0', '#80d0d0', '#e0f8f8'],
  },
  {
    id: 'dusk',
    name: 'Dusk',
    zone: 'spore-hollow',
    tileX: 15, tileY: 5,
    direction: 'left',
    dialogueId: 'dusk-intro',
    sprite: DUSK_SPRITE,
    palette: ['#303850', '#506080', '#8898b0'],
  },
  {
    id: 'moss',
    name: 'Moss',
    zone: 'twilight-thicket',
    tileX: 3, tileY: 4,
    direction: 'down',
    dialogueId: 'moss-intro',
    sprite: MOSS_SPRITE,
    palette: ['#2a4020', '#4a7038', '#88a860'],
  },
  {
    id: 'glint',
    name: 'Glint',
    zone: 'mana-springs',
    tileX: 10, tileY: 8,
    direction: 'down',
    dialogueId: 'glint-intro',
    sprite: GLINT_SPRITE,
    palette: ['#3090c0', '#60c0e0', '#c0f0ff'],
  },
  {
    id: 'community-gate',
    name: 'Community Gate',
    zone: 'garden',
    tileX: 23, tileY: 3,
    direction: 'down',
    dialogueId: 'community-gate',
    sprite: GATE_SPRITE,
    palette: ['#8a7a60', '#b8a878', '#d4a843'],
    blocking: true,
  },
]

/** Summary data for editors (avoids importing heavy sprite data) */
export const NPC_SUMMARY = NPCS.map(n => ({ id: n.id, name: n.name, zone: n.zone }))

/** Get NPCs for a specific zone (respects hideWhenFlag) */
export function getNPCsForZone(zoneId: string, flags?: Record<string, boolean>): NPCDef[] {
  return NPCS.filter(n => {
    if (n.zone !== zoneId) return false
    if (n.hideWhenFlag && flags?.[n.hideWhenFlag]) return false
    return true
  })
}

/** Find NPC at a specific tile in a zone (respects hideWhenFlag) */
export function npcAtTile(zoneId: string, tx: number, ty: number, flags?: Record<string, boolean>): NPCDef | null {
  return NPCS.find(n => {
    if (n.zone !== zoneId || n.tileX !== tx || n.tileY !== ty) return false
    if (n.hideWhenFlag && flags?.[n.hideWhenFlag]) return false
    return true
  }) ?? null
}

/** Get set of "tx,ty" strings for blocking NPCs in a zone */
export function getBlockedTiles(zoneId: string, flags?: Record<string, boolean>): Set<string> {
  const blocked = new Set<string>()
  for (const n of NPCS) {
    if (n.zone !== zoneId) continue
    if (!n.blocking) continue
    if (n.hideWhenFlag && flags?.[n.hideWhenFlag]) continue
    blocked.add(`${n.tileX},${n.tileY}`)
  }
  return blocked
}
