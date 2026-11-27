// BETA M233 s3: CLASH, the Thistledown Fair's spirit-battle tents (Alex 11-27). 1v1: a keeper enters ONE spirit of her trio
// and fights the tent's PREGENERATED line-up, one bout at a time, in the turn-based battle we already have (PartyBattleScene,
// engine/party-battle.ts). No leaderboard (boards are Dash's). Each season pitches at least 5 Clash tents (network.ts
// TENT_PLAN: 2 easy, 2 average, 1 difficult).
// The RULES both sides share, PURE and server-safe (api/fair/clash imports this file; the line-up builder is fair-clash.ts).
//  - easy tents field BASE forms, average tents SECOND forms; the difficult tier (awakened) is HELD until awakened spirits are
//    built (Alex 11-27): its tent stays pitched and says it opens later.
//  - THE TENT'S LEVEL EVENS STATS (power = choice): inside a tent every spirit, hers and the line-up's, fights at the tent's
//    level with even seeds and a neutral temperament. What she brings is her species and her form (her element), never her grind.
//  - the prize is Marks, once per tent per season (counted server side), never raw power.
// Numbers are Jin's (flag for Alex's feel): levels, line-up size, the troupe's play per tier, the purse.

export type ClashTier = 'easy' | 'average' | 'difficult'
export const CLASH_TIERS: readonly ClashTier[] = ['easy', 'average', 'difficult']
export const isClashTier = (v: unknown): v is ClashTier => typeof v === 'string' && (CLASH_TIERS as readonly string[]).includes(v)
/** the season (network.ts SEASON, copied: network.ts reaches a client module; fair-clash.test holds them equal) */
export const CLASH_SEASON = 1
/** which tiers are open. DIFFICULT is HELD (Alex 11-27) until awakened spirits exist. */
export const CLASH_OPEN: Readonly<Record<ClashTier, boolean>> = { easy: true, average: true, difficult: false }
/** the tent's level: every spirit in the tent fights at it (easy under the second-form level 34, average past it) */
export const TENT_LEVEL: Readonly<Record<ClashTier, number>> = { easy: 12, average: 40, difficult: 70 }
/** opponents in a tent's line-up; beat them all, one after another, to win the tent */
export const LINEUP_SIZE = 3
/** the troupe's play per tier: an easy tent's spirits swing the free Strike at whoever is there; an average tent's spend mana
 *  and press the weak point */
export const CLASH_AI: Readonly<Record<ClashTier, { focusFire: boolean; spendMana: boolean }>> = {
  easy: { focusFire: false, spendMana: false }, average: { focusFire: true, spendMana: true }, difficult: { focusFire: true, spendMana: true },
}
/** the troupe's mana pool per tier (the keeper's side keeps the battle's default 16/22/5). Tuned by sim (fair-clash.test): at
 *  even stats an average tent's whole line-up falls to roughly two keepers in three; an easy tent's almost always. */
export const CLASH_TROUPE_MANA: Readonly<Record<ClashTier, { start: number; max: number; regen: number }>> = {
  easy: { start: 0, max: 0, regen: 0 }, average: { start: 8, max: 14, regen: 3 }, difficult: { start: 16, max: 22, regen: 5 },
}
/** the purse for beating a tent's whole line-up, once per tent per season (Marks; never raw power) */
export const CLASH_PRIZE: Readonly<Record<ClashTier, number>> = { easy: 300, average: 800, difficult: 0 }
/** how many Clash tents a season can hold (a sanity bound on the tent number the server takes) */
export const MAX_CLASH_TENTS = 12

/** a tent number the server may record: a whole number 0..MAX_CLASH_TENTS-1 */
export function cleanTent(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n < MAX_CLASH_TENTS ? n : null
}

export interface ClashState { season: number; signedIn: boolean; won: number[] }
export interface ClashClaim extends ClashState { first: boolean; prize: number }

/** plain UI labels (@lark may reword) */
export const CLASH_UI = {
  title: (level: string) => `Clash · ${level}`,
  lineup: 'The line-up',
  rules: 'One spirit, one bout at a time. Beat the whole line-up to win the tent.',
  evened: (lv: number) => `Every spirit in this tent fights at level ${lv}.`,
  prize: (n: number) => `Prize: ${n} Marks`,
  held: 'This tent opens later in the season.',
  bout: (i: number, n: number) => `Bout ${i} of ${n}`,
  won: 'You beat the whole line-up!',
  prizeLanded: (n: number) => `+${n} Marks`,
  already: 'You already won this tent this season.',
  lost: 'Your spirit is out. Try the line-up again.',
  signIn: 'Sign in to win the prize.',
  again: 'Fight again',
  wonTag: 'Won',
  // M233 v2a: the load screen, the ring and its tournament panel
  loading: 'Setting the ring...',
  versus: 'The line-up',
  bracket: 'The line-up tree',
  round: (r: number, of: number) => (r === of - 1 ? 'Final' : `Round ${r + 1}`),
  you: 'You',
  yourBout: 'Your bout!',
  champion: (name: string) => `Champion: ${name}`,   // M233 s4 (@lark)
  live: 'Now',
  next: 'Next',
  out: 'Out',
  exit: 'Back to the Fair',
  cheer: 'Cheer!',
  cheered: 'Cheered',
  // M233 v2d ceremony (placeholders, @lark)
  begin: 'Begin!',
  winner: (name: string) => `${name} wins!`,
  skip: 'Skip',
  troupe: 'The troupe',
  champ: 'Champion',
  cue: { hit: 'Hit!', evaded: 'Dodged', guarded: 'Blocked', miss: 'Missed', cheer: 'Cheered on' } as Record<'hit' | 'evaded' | 'guarded' | 'miss' | 'cheer', string>,
} as const
