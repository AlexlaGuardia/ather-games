/**
 * THE RECIPE BOOK — which brews THIS keeper knows, and how the book grows.
 *
 * ★ CANON (`game/alchemy.md` › THE FIRST RECIPE, ruled 2026-09-22; § 4 *Recipes unlock over time*):
 * Yarrow teaches the FIRST recipe — the Mana Draught — once, at the counter, and nothing after it.
 * *"After that it is your hands or nobody's."* Every later rung is worked out at the keeper's own pot.
 * A brewing (the party) lets a guest DRINK ahead, never LEARN ahead: bottle only. The known set, the
 * ladder, its gates and its pace are the build's — this file.
 *
 * ── THE LADDER (Jin's call) ─────────────────────────────────────────────────────────────────────
 * **One brew at your own pot works out one page.** After each brew the keeper learns the next
 * recipe in ladder order that their alchemy level already reaches. The pot is the teacher, the pace
 * is how often you use it, and the level still gates what the next page can be — so a keeper who
 * brews a lot at level 3 has everything level 3 allows, and nothing past it.
 *
 * ── ⚠ OLD SAVES ARE GRANDFATHERED, ON FIRST READ, ONCE ─────────────────────────────────────────
 * Before this file the cauldron showed every recipe within three levels of yours. A keeper who has
 * already FINISHED the tutorial when the book first loads has been brewing off that window, so the
 * book starts as exactly that window: nobody opens their cauldron to find recipes gone. A keeper
 * still in the tutorial starts empty and meets Yarrow's page the way canon wrote it. The record is
 * written on first read either way, so the grandfather clause can only ever fire once.
 */
import { POTION_DEFS } from '../engine/alchemy'
import { keeperKey } from '@/lib/keeper-local'

/** The first recipe, canon's (§ 1 — the restore-mana brew, the HAND class's plainest bottle). */
export const FIRST_RECIPE = 'mana_draught'

/**
 * Yarrow's herb pair (`<RIGHT>` / `<WRONG>` in the locked scene — Jin's to fill).
 *
 * RIGHT is canon's Mana element herb. WRONG is **Shimmerbloom**: a canon crop (adopted 07-30),
 * *"iridescent petal that shifts between violet and gold"* — violet petals in the hand, NO element.
 * That is the ruling's whole constraint, *"shares its look, never its element"*, met by two plants
 * the world already has, so nothing is named here that Magii did not.
 * Both are single words with no article, so they drop into the bare-noun slots cleanly.
 */
export const HERB_PAIR = {
  right: { name: 'Violetbloom', itemId: 'violetbloom_petal' },
  wrong: { name: 'Shimmerbloom', itemId: 'shimmerbloom_petal' },
} as const

/** Fill the scene's two slots. Pure string work; the script keeps its placeholders verbatim. */
export const fillHerbs = (s: string): string =>
  s.split('<RIGHT>').join(HERB_PAIR.right.name).split('<WRONG>').join(HERB_PAIR.wrong.name)

/** Every recipe, in the order the book fills. Same order the cauldron menu has always used. */
export const LADDER: readonly string[] = Object.values(POTION_DEFS)
  .sort((a, b) => a.minAlchemyLevel - b.minAlchemyLevel || a.tier - b.tier)
  .map(d => d.id)

export interface RecipeBook {
  known: string[]
  /** A cauldron has stood on this keeper's own plot (placed or opened there). Half of Yarrow's gate. */
  cauldron?: boolean
}

/** The next page a brew would work out, or null when the level reaches nothing new. */
export function nextRung(known: readonly string[], alchemyLevel: number): string | null {
  for (const id of LADDER) {
    if (known.includes(id)) continue
    if (POTION_DEFS[id].minAlchemyLevel <= alchemyLevel) return id
  }
  return null
}

/**
 * A brew finished at the keeper's own pot: the book gains one page, if the level reaches one.
 * ⚠ ONLY AFTER THE FIRST PAGE. An empty book learns nothing from the pot — the first recipe is
 * Yarrow's to give, and a keeper who somehow brews before it (a brewing, a harness) must not skip
 * the counter scene by the back door.
 */
export function learnFromBrew(book: RecipeBook, alchemyLevel: number): string | null {
  if (!book.known.includes(FIRST_RECIPE)) return null
  const id = nextRung(book.known, alchemyLevel)
  if (id) book.known.push(id)
  return id
}

/** Yarrow's page. Idempotent. */
export function learnFirst(book: RecipeBook): boolean {
  if (book.known.includes(FIRST_RECIPE)) return false
  book.known.unshift(FIRST_RECIPE)
  return true
}

/** The old cauldron window, exactly: every recipe within three levels (`getVisiblePotions`). */
export const legacyKnown = (alchemyLevel: number): string[] =>
  LADDER.filter(id => POTION_DEFS[id].minAlchemyLevel <= alchemyLevel + 3)

/** Is Yarrow ready to teach? A cauldron of their own, and the page not yet given. */
export const yarrowReady = (book: RecipeBook, taught: boolean): boolean => !!book.cauldron && !taught

// ── persistence (same failure discipline as tutorial.ts: every bad path returns a safe value) ──

/** Per keeper, per world. Family prefix, listed in `KEEPER_KEY_SPECS`. */
export const RECIPES_BASE = 'voxel3d:recipes:'
const storageKey = (seed: number) => keeperKey(`${RECIPES_BASE}${seed}`)

export function parseBook(raw: unknown): RecipeBook | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { known?: unknown; cauldron?: unknown }
  if (!Array.isArray(r.known)) return null
  const known = r.known.filter((k): k is string => typeof k === 'string' && k in POTION_DEFS)
  return { known: [...new Set(known)], ...(r.cauldron === true ? { cauldron: true } : {}) }
}

/**
 * Load, creating the record on first read. `tutorialDone` + `alchemyLevel` decide the grandfather
 * clause (see the header) and are consulted ONLY when no record exists yet.
 */
export function loadBook(seed: number, tutorialDone: boolean, alchemyLevel: number): RecipeBook {
  const fresh = (): RecipeBook => ({ known: tutorialDone ? legacyKnown(alchemyLevel) : [] })
  if (typeof localStorage === 'undefined') return fresh()
  try {
    const got = parseBook(JSON.parse(localStorage.getItem(storageKey(seed)) ?? 'null'))
    if (got) return got
    const b = fresh()
    saveBook(seed, b)
    return b
  } catch { return fresh() }
}

export function saveBook(seed: number, b: RecipeBook): void {
  try { localStorage.setItem(storageKey(seed), JSON.stringify(b)) } catch { /* private mode: run unpersisted */ }
}
