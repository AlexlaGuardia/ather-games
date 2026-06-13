// NPC Reputation & Gifting — social progression system
// Pure functions — no side effects. Game loop manages state.
// Reputation unlocks dialogue branches, shop discounts, rare items, exclusive rewards.

// ============================================
// Types
// ============================================

export type RepTier = 'stranger' | 'acquaintance' | 'friendly' | 'trusted' | 'beloved'

export interface NPCReputation {
  points: number         // 0-255, clamped
  lastTalkCycle: number  // day-cycle count when last daily talk bonus was given
  lastGiftCycle: number  // day-cycle count when last gift was given
  giftsGiven: number     // total gifts given to this NPC
}

export interface GiftPreferences {
  loves: string[]        // +10 rep
  likes: string[]        // +5 rep
  dislikes: string[]     // -2 rep
  // everything else is neutral (+3)
}

export type GiftReaction = 'love' | 'like' | 'neutral' | 'dislike' | 'cooldown'

export interface GiftResult {
  accepted: boolean
  repChange: number
  reaction: GiftReaction
  message: string
}

// ============================================
// Tier Definitions
// ============================================

export const REP_TIERS: { tier: RepTier; threshold: number; label: string }[] = [
  { tier: 'stranger',      threshold: 0,   label: 'Stranger' },
  { tier: 'acquaintance',  threshold: 25,  label: 'Acquaintance' },
  { tier: 'friendly',      threshold: 50,  label: 'Friendly' },
  { tier: 'trusted',       threshold: 100, label: 'Trusted' },
  { tier: 'beloved',       threshold: 200, label: 'Beloved' },
]

/** Get current reputation tier */
export function getRepTier(points: number): RepTier {
  for (let i = REP_TIERS.length - 1; i >= 0; i--) {
    if (points >= REP_TIERS[i].threshold) return REP_TIERS[i].tier
  }
  return 'stranger'
}

/** Get tier info with progress toward next tier */
export function getRepTierInfo(points: number): {
  tier: RepTier
  label: string
  progress: number       // 0-1 progress to next tier
  nextThreshold: number  // points needed for next tier (255 if max)
} {
  let currentIdx = 0
  for (let i = REP_TIERS.length - 1; i >= 0; i--) {
    if (points >= REP_TIERS[i].threshold) { currentIdx = i; break }
  }

  const current = REP_TIERS[currentIdx]
  const next = REP_TIERS[currentIdx + 1]

  if (!next) {
    return { tier: current.tier, label: current.label, progress: 1.0, nextThreshold: 255 }
  }

  const range = next.threshold - current.threshold
  const progress = Math.min(1.0, (points - current.threshold) / range)

  return { tier: current.tier, label: current.label, progress, nextThreshold: next.threshold }
}

// ============================================
// NPC Gift Preferences
// ============================================

export const NPC_GIFT_PREFS: Record<string, GiftPreferences> = {
  gregory: {
    loves: ['moonberry', 'shimmer_dust'],
    likes: ['sunfruit', 'stonemelon', 'dewdrop'],
    dislikes: ['bronze_pick', 'bronze_axe', 'bronze_rod'],
  },
  bramble: {
    loves: ['goldwood_log', 'shimmeroak_log'],
    likes: ['seed_shimmerwheat', 'seed_glowroot', 'seed_moonvine'],
    dislikes: ['element_crystal', 'raw_mana_shard'],
  },
  ember: {
    loves: ['ember_fruit', 'sunfruit'],
    likes: ['harvest_brew', 'moonvine_tonic', 'dreamroot_elixir'],
    dislikes: ['small_fish', 'stream_fish'],
  },
  rootweaver: {
    loves: ['raw_mana_shard', 'element_crystal'],
    likes: ['copper_ore', 'iron_ore', 'mithril_ore'],
    dislikes: ['sunfruit', 'moonberry', 'mana_berry'],
  },
  echo: {
    loves: ['spirit_morsel', 'moonberry'],
    likes: ['shimmer_dust', 'dreamroot_elixir', 'dawncap_spore'],
    dislikes: ['shimmerwheat_grain', 'glowroot_bulb'],
  },
  dusk: {
    loves: ['moonberry', 'glow_moss'],
    likes: ['dawncap_spore', 'dreamroot_essence'],
    dislikes: ['sunfruit', 'ember_fruit'],
  },
  moss: {
    loves: ['mana_berry', 'harvest_brew'],
    likes: ['glowroot_bulb', 'moonvine_leaf', 'shimmerbloom_petal'],
    dislikes: ['bronze_pick', 'iron_axe'],
  },
  glint: {
    loves: ['element_crystal', 'pure_core'],
    likes: ['copper_ore', 'iron_ore', 'raw_mana_shard'],
    dislikes: ['sunfruit', 'moonberry', 'glowroot_bulb'],
  },
}

/** Get gift reaction for an NPC + item combo */
export function getGiftReaction(npcId: string, itemId: string): { reaction: GiftReaction; repChange: number } {
  const prefs = NPC_GIFT_PREFS[npcId]
  if (!prefs) return { reaction: 'neutral', repChange: 3 }

  if (prefs.loves.includes(itemId))    return { reaction: 'love',    repChange: 10 }
  if (prefs.likes.includes(itemId))    return { reaction: 'like',    repChange: 5 }
  if (prefs.dislikes.includes(itemId)) return { reaction: 'dislike', repChange: -2 }
  return { reaction: 'neutral', repChange: 3 }
}

// ============================================
// Reputation Actions
// ============================================

/** Create a fresh reputation for an NPC */
export function createReputation(): NPCReputation {
  return { points: 0, lastTalkCycle: -1, lastGiftCycle: -1, giftsGiven: 0 }
}

/** Clamp reputation points to 0-255 */
function clampRep(points: number): number {
  return Math.max(0, Math.min(255, points))
}

/**
 * Give a gift to an NPC. Returns result with reaction and rep change.
 * Respects daily gift cooldown (one gift per NPC per day-cycle).
 */
export function giveGift(
  rep: NPCReputation,
  itemId: string,
  npcId: string,
  currentCycle: number,
): GiftResult {
  // Cooldown check: one gift per day-cycle
  if (rep.lastGiftCycle === currentCycle) {
    return {
      accepted: false,
      repChange: 0,
      reaction: 'cooldown',
      message: 'Already received a gift today.',
    }
  }

  const { reaction, repChange } = getGiftReaction(npcId, itemId)

  rep.points = clampRep(rep.points + repChange)
  rep.lastGiftCycle = currentCycle
  rep.giftsGiven++

  const messages: Record<GiftReaction, string> = {
    love: 'This is wonderful! Thank you so much!',
    like: 'Oh, how nice of you. Thank you!',
    neutral: 'Thanks, I appreciate it.',
    dislike: 'Oh... this isn\'t really my thing.',
    cooldown: '',
  }

  return {
    accepted: true,
    repChange,
    reaction,
    message: messages[reaction],
  }
}

/**
 * Apply daily talk bonus (+1 rep for first interaction each day-cycle).
 * Returns the rep gained (0 or 1).
 */
export function dailyTalkBonus(rep: NPCReputation, currentCycle: number): number {
  if (rep.lastTalkCycle === currentCycle) return 0
  rep.lastTalkCycle = currentCycle
  rep.points = clampRep(rep.points + 1)
  return 1
}

/**
 * Add reputation points directly (e.g. quest completion reward).
 */
export function addRepPoints(rep: NPCReputation, amount: number): void {
  rep.points = clampRep(rep.points + amount)
}

/**
 * Get shop discount multiplier based on reputation.
 * Stranger-Acquaintance: 0%, Friendly-Trusted: 10%, Beloved: 15%
 */
export function getShopDiscount(points: number): number {
  if (points >= 200) return 0.15
  if (points >= 50) return 0.10
  return 0
}

// ============================================
// Save / Load
// ============================================

export interface RepSave {
  points: number
  lastTalkCycle: number
  lastGiftCycle: number
  giftsGiven: number
}

export function repToSave(reps: Record<string, NPCReputation>): Record<string, RepSave> {
  const result: Record<string, RepSave> = {}
  for (const [npcId, rep] of Object.entries(reps)) {
    if (rep.points > 0 || rep.giftsGiven > 0) {
      result[npcId] = {
        points: rep.points,
        lastTalkCycle: rep.lastTalkCycle,
        lastGiftCycle: rep.lastGiftCycle,
        giftsGiven: rep.giftsGiven,
      }
    }
  }
  return result
}

export function repFromSave(saved: Record<string, RepSave> | undefined): Record<string, NPCReputation> {
  const result: Record<string, NPCReputation> = {}
  if (!saved) return result
  for (const [npcId, s] of Object.entries(saved)) {
    result[npcId] = {
      points: s.points ?? 0,
      lastTalkCycle: s.lastTalkCycle ?? -1,
      lastGiftCycle: s.lastGiftCycle ?? -1,
      giftsGiven: s.giftsGiven ?? 0,
    }
  }
  return result
}

/** Get or create reputation for an NPC */
export function getOrCreateRep(reps: Record<string, NPCReputation>, npcId: string): NPCReputation {
  if (!reps[npcId]) {
    reps[npcId] = createReputation()
  }
  return reps[npcId]
}
