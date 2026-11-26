// M187: the fruit the loader's Dewbear runs to. Every item of type 'fruit' in the game (sprites/items.ts; canon adopted
// Sunfruit, Moonberry and Stonemelon 08-22, world/cuisine.md), one per load screen in turn so a player sees them all.
// Picture only (public/open/load/fruit-<id>.png, drawn from the item's own icon): no name goes on screen.
// Pure: no React, no storage, so load-fruit.test.ts runs under plain tsx.
export const LOAD_FRUIT = ['sunfruit', 'moonberry', 'stonemelon'] as const
export type LoadFruit = typeof LOAD_FRUIT[number]
/** the fruit a pick falls back to (Magii: Sunfruit, "warm golden fruit that glows faintly") */
export const DEFAULT_FRUIT: LoadFruit = 'sunfruit'
export const fruitSrc = (f: LoadFruit) => `/open/load/fruit-${f}.png`
/** The next fruit after the last one shown (rotates through all of them). No memory (a first load, private mode) starts
 *  at a random one; a stored value that is not a fruit, or a broken random, falls back to Sunfruit. */
export function pickFruit(last: string | null | undefined, rnd: () => number = Math.random): LoadFruit {
  if (last == null) return LOAD_FRUIT[Math.floor(rnd() * LOAD_FRUIT.length)] ?? DEFAULT_FRUIT
  const i = LOAD_FRUIT.indexOf(last as LoadFruit)
  return i < 0 ? DEFAULT_FRUIT : LOAD_FRUIT[(i + 1) % LOAD_FRUIT.length]
}
