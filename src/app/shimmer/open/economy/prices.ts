// THE PRICE LADDER — one place every price on the waking continent reads (Alex 11-15, after seeing the tycoon's
// earnings: "i dont think thats alot.. what we should do is raise the parts costs.. lower end 3 or 5k but the high end
// should raise up to 50k to 150k and then coursers should be up there in price with the low end cars around 80 to 100k
// and then the high end touches into the millions ..shipyards are 250k and up ocean bound ships around 200k and the sky
// ships start at 500k").
//
// ★ ONE LADDER, NOT SIX GUESSES. The trade (courser parts, contract pay, the starting purse), the tycoon (what a
// business costs and earns) and, later, coursers / ships / shipyards all read these numbers, so a retune happens here
// once and every shop moves together. Marks are canon's one coin; every figure is Jin's balance off Alex's ranges.
//
// ★ PURE.

export const LADDER = {
  /** Courser parts by tier (trade.ts › TIER_PRICE). Alex: the low end 3-5k, the high end 50-150k. */
  coursePart: { 1: 4_000, 2: 20_000, 3: 90_000 } as const,
  /** Coursers themselves (not for sale yet). Alex: low-end cars 80-100k, the high end into the millions. */
  courser: { low: 90_000, high: 2_500_000 },
  /** Alex: shipyards 250k and up (the inherited one is free; more cost this). */
  shipyard: { from: 250_000 },
  /** Alex: ocean-bound ships around 200k. */
  oceanShip: { around: 200_000 },
  /** Alex: sky ships start at 500k. */
  skyShip: { from: 500_000 },
} as const

/** What a new keeper starts with on the continent (was 60 before the ladder). */
export const STARTING_MARKS = 1_500
/** Contract pay scale (trade.ts): a run pays ~2-8k, so a tier I part is a run or two and a tier III ~15-30. */
export const PAY_SCALE = 20
/** The ledger's scale version. A ledger saved before the ladder (no `scale`) is multiplied up by OLD_TO_NEW so nobody's
 *  progress shrinks against the new prices. */
export const LEDGER_SCALE = 2
export const OLD_TO_NEW = 25
