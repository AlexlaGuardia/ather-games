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
  showWhenFlag?: string    // NPC only appears when this flag is set (gate-in)
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

// Moglin placeholder sprites — Gregory base with collar accent (col 5 = red = collar)
// TODO: replace with proper Thistle/Sorrel/Brack renders (Alex's art pipeline)
const MOGLIN_SPRITE = px(16, 16, `
  0000000000000000
  0000003330000000
  0000033333000000
  0000032223000000
  0000032323000000
  0000002220000000
  0000011111000000
  0000015151000000
  0000011111000000
  0000011111000000
  0000011011000000
  0000011011000000
  0000033033000000
  0000000000000000
  0000000000000000
  0000000000000000
`)

// --- NPC registry ---

export const NPCS: NPCDef[] = [
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
      { dialogueId: 'gregory-tending', requiresFlag: 'tutorialComplete' },
      { dialogueId: 'gregory-sendoff', requiresFlag: 'tendingTaughtComplete' },
      { dialogueId: 'gregory-challenge', requiresFlag: 'gregorySentToMeadows' },
    ],
    sprite: GREGORY_SPRITE,
    palette: GREGORY_PALETTE,
  },
  {
    id: 'thistle',
    name: 'Thistle',
    zone: 'spirit-meadow',
    tileX: 15, tileY: 5,
    direction: 'down',
    dialogueId: 'thistle-prefight',
    dialogueChain: [
      { dialogueId: 'thistle-prefight' },
      { dialogueId: 'thistle-return', requiresFlag: 'sawThistle' },
      { dialogueId: 'thistle-defeat', requiresFlag: 'defeated_thistle' },
    ],
    hideWhenFlag: 'thistleDefeated',
    sprite: MOGLIN_SPRITE,
    palette: ['#2a5a20', '#50a038', '#c8e8b0', '#1a1a2e', '#c03030'],
    blocking: true,
    trainer: {
      species: 'rabbit',
      name: "Thistle's Rabbit",
      levelOffset: 0,
      element: 'mana',
      aiTier: 'trained',
    },
  },
  {
    id: 'sorrel',
    name: 'Sorrel',
    zone: 'sorrel-hold',
    tileX: 20, tileY: 15,
    direction: 'down',
    dialogueId: 'sorrel-prefight',
    dialogueChain: [
      { dialogueId: 'sorrel-prefight' },
      { dialogueId: 'sorrel-defeat', requiresFlag: 'defeated_sorrel' },
    ],
    hideWhenFlag: 'sorrelDefeated',
    sprite: MOGLIN_SPRITE,
    palette: ['#8a6a20', '#c8a040', '#f0e8b0', '#1a1a2e', '#c03030'],
    blocking: true,
    trainer: {
      species: 'fox',
      name: "Sorrel's Fox",
      levelOffset: 3,
      element: 'earth',
      aiTier: 'trained',
    },
  },
  {
    id: 'brack',
    name: 'Brack',
    zone: 'brack-hold',
    tileX: 20, tileY: 15,
    direction: 'down',
    dialogueId: 'brack-prefight',
    dialogueChain: [
      { dialogueId: 'brack-prefight' },
      { dialogueId: 'brack-defeat', requiresFlag: 'defeated_brack' },
    ],
    hideWhenFlag: 'brackDefeated',
    sprite: MOGLIN_SPRITE,
    palette: ['#4a2a70', '#8050c0', '#d0b8f0', '#1a1a2e', '#c03030'],
    blocking: true,
    trainer: {
      species: 'water-bear',
      name: "Brack's Water Bear",
      levelOffset: 6,
      element: 'storm',
      aiTier: 'trained',
    },
  },
  // Reformed Moglins — appear at Home Plot only after moglinsReformed flag (set on Brack's defeat)
  {
    id: 'thistle-home',
    name: 'Thistle',
    zone: 'garden',
    tileX: 5, tileY: 14,
    direction: 'down',
    dialogueId: 'thistle-home',
    showWhenFlag: 'moglinsReformed',
    sprite: MOGLIN_SPRITE,
    palette: ['#2a5a20', '#50a038', '#c8e8b0', '#1a1a2e', '#88cc88'],
  },
  {
    id: 'sorrel-home',
    name: 'Sorrel',
    zone: 'garden',
    tileX: 7, tileY: 14,
    direction: 'down',
    dialogueId: 'sorrel-home',
    showWhenFlag: 'moglinsReformed',
    sprite: MOGLIN_SPRITE,
    palette: ['#8a6a20', '#c8a040', '#f0e8b0', '#1a1a2e', '#eec888'],
  },
  {
    id: 'brack-home',
    name: 'Brack',
    zone: 'garden',
    tileX: 9, tileY: 14,
    direction: 'down',
    dialogueId: 'brack-home',
    showWhenFlag: 'moglinsReformed',
    sprite: MOGLIN_SPRITE,
    palette: ['#4a2a70', '#8050c0', '#d0b8f0', '#1a1a2e', '#c0a0f0'],
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

/** Check if an NPC is currently visible given the flag state */
function npcVisible(n: NPCDef, flags?: Record<string, boolean>): boolean {
  if (n.hideWhenFlag && flags?.[n.hideWhenFlag]) return false
  if (n.showWhenFlag && !flags?.[n.showWhenFlag]) return false
  return true
}

/** Get NPCs for a specific zone (respects hideWhenFlag + showWhenFlag) */
export function getNPCsForZone(zoneId: string, flags?: Record<string, boolean>): NPCDef[] {
  return NPCS.filter(n => {
    if (n.zone !== zoneId) return false
    return npcVisible(n, flags)
  })
}

/** Find NPC at a specific tile in a zone (respects hideWhenFlag + showWhenFlag) */
export function npcAtTile(zoneId: string, tx: number, ty: number, flags?: Record<string, boolean>): NPCDef | null {
  return NPCS.find(n => {
    if (n.zone !== zoneId || n.tileX !== tx || n.tileY !== ty) return false
    return npcVisible(n, flags)
  }) ?? null
}

/** Get set of "tx,ty" strings for blocking NPCs in a zone */
export function getBlockedTiles(zoneId: string, flags?: Record<string, boolean>): Set<string> {
  const blocked = new Set<string>()
  for (const n of NPCS) {
    if (n.zone !== zoneId) continue
    if (!n.blocking) continue
    if (!npcVisible(n, flags)) continue
    blocked.add(`${n.tileX},${n.tileY}`)
  }
  return blocked
}
