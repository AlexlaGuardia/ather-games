// ── The walker's design vocabulary ─────────────────────────────────────────────────────────────
//
// WHY THIS FILE EXISTS. A census of `src/app/shimmer` on 2026-08-23 found **761 distinct hex
// colours, 459 of them used exactly once**, against 52 in Nolmir — the sibling game whose look
// reads as deliberate. The gap is not craft. Nolmir made about five colour decisions and restated
// them; Shimmer re-decided the look in every panel, so no two panels are obliged to agree and the
// look cannot land no matter how good any single panel is.
//
// ⚠ AND `ui.tsx` ALREADY REACHED FOR THE FIX AND MISSED BY ONE LAYER. Its header says the station
// menus live there "so the five menus can't drift" — but `StationShell` takes `accent`/`border`/`bg`
// as PROPS, so five callers passed five hand-picked triplets. It prevented STRUCTURAL drift and
// PERMITTED colour drift, by construction. A primitive with no vocabulary underneath it
// parameterises exactly the thing that should have been fixed. That is the bug this file closes.
//
// The values below are EXTRACTED, not invented: every one was already load-bearing in the tree.
// `#d4a843` alone had 328 uses. This is a census promoted to a contract, which is why adopting it
// moves so few pixels.
//
// ⚠ SCOPE — this is play3d-owned on purpose, not a claim about the whole game. The `play` lane owns
// `play3d/`; `components/` and `lib/` are the hub's shared surface and the hub was live when this
// landed. It is deliberately import-clean so the hub can lift it to `lib/` unchanged and widen the
// guard's root. Do NOT quietly fork a second copy for another lane — mirrors agree with each other
// while both go stale, which is worse than the drift they replace.
//
// THE RULE, and it is the whole point: no raw colour literal anywhere else in `play3d/`.
// `tokens.test.ts` enforces it and fails on a second spelling. A hand-kept style guide rots; this
// repo already has a March-era one nobody follows.

/**
 * Surfaces, darkest first. The walker's world is dark and its chrome sits ON it, so these read as
 * depth rather than as five greys: `void` is the scrim between the player and the world, `raised`
 * is the nearest thing to the eye.
 */
export const ink = {
  void:   '#0a0a1a',
  deep:   '#0d0d1a',
  panel:  '#16142a',
  raised: '#1a1a2e',
  scrim:  '#05070ae8',
  /** A dark wash for a slot that is present but empty — reads as a hole, not as a surface. */
  wash:   '#00000022',
} as const

/**
 * Gold — the primary accent and the most-used colour in the entire build (328 uses). It carries
 * value, currency and the crafting family. `parchment` is its text weight, not a sixth gold.
 */
export const gold = {
  base:      '#d4a843',
  bright:    '#f0a526',
  dim:       '#c9a86a',
  parchment: '#e9dfc8',
  /** Gold a price is shown in when the player cannot afford it. Disabled state, not a sixth gold. */
  faded:     '#8a7550',
} as const

/**
 * Mint — the secondary family: growth, nature, the garden. `text` is the brightest and is what
 * reads as "white" on a dark panel without actually being white.
 */
export const mint = {
  text: '#eafff6',
  base: '#7fe3c8',
  soft: '#8fd9c4',
  pale: '#cfeee2',
  deep: '#2f5c4f',
} as const

/**
 * Muted body/label text.
 *
 * ⚠ THIS TOKEN EXISTS BECAUSE THE CENSUS FOUND `#8fa8a0` AND `#8aa9a0` — nine uses each, one
 * transposition apart. Nobody chose two greens that close on purpose; one is a typo of the other
 * that then propagated. Two spellings of one intent is the cheapest possible proof that the tree
 * had no vocabulary, and it is exactly what the guard now forbids.
 */
export const muted = '#8aa9a0'

/**
 * The hues that are neither ink nor gold nor mint. Each one identifies a THING — a station, a
 * skill — so they are named for what they mean, not for what they look like. `tone` below is built
 * from these; nothing else should reach past them for a raw hue.
 */
export const accent = {
  arcane: '#c88ae6',
  water:  '#6fb8d9',
  leaf:   '#8fd06a',
  teal:   '#6ad0a0',
} as const

/** Status colours. Semantic, never decorative — a caller reaching for `danger` to mean "red" is drift. */
export const status = {
  danger:  '#e05a4d',
  good:    '#40d060',
  info:    '#37e6ff',
  warning: '#f0a526',
} as const

/**
 * Hairlines and washes. These were ALREADY a coherent ladder in the tree (`#ffffff14`/`22`/`33`/
 * `55`/`66`) — one of the few things that had not drifted, so it is promoted verbatim rather than
 * re-picked.
 */
export const hair = {
  faint:  '#ffffff14',
  weak:   '#ffffff22',
  medium: '#ffffff33',
  strong: '#ffffff55',
  bright: '#ffffff66',
} as const

/**
 * The radius ladder.
 *
 * The tree was using 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 999 and 50%. Nobody picks 7 and 9 and 11 as a
 * system; that spread is the fingerprint of each panel being eyeballed on its own. Five rungs cover
 * every real use.
 */
export const radius = {
  xs:   4,
  sm:   7,
  md:   10,
  lg:   16,
  pill: 999,
  dot:  '50%',
} as const

/**
 * Type.
 *
 * The walker's HUD is monospace on purpose — it is an instrument panel, and the numbers in it tick.
 * That is a decision worth keeping, so it is recorded here rather than re-typed per component.
 *
 * ⚠ `tabular-nums` was ALREADY used 158 times in the tree and is NOT one of this file's fixes; it
 * is folded into `value` so it stops being something each caller has to remember. Anything that
 * ticks must use `value`, or digits change width as they change and the row jitters.
 *
 * ⚠ AND THE ONE DECISION THIS FILE DOES NOT MAKE: Shimmer declares no display face at all, so it
 * inherits `--font-display: Cormorant Garamond` — a literary serif — from the site's `globals.css`.
 * Nolmir declares Chakra Petch locally and that is a large part of why it reads as a game. Choosing
 * Shimmer's display face is an ART CALL and belongs to Alex, so it is deliberately absent here
 * rather than guessed at. See NEXT in the session note.
 */
export const type = {
  hud:   '700 11px ui-monospace, monospace',
  label: '600 9px/1.4 ui-monospace, monospace',
  value: { font: '800 11px ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' },
  title: '900 16px ui-monospace, monospace',
} as const

/** Tracking for short ALL-CAPS strings. Labels and titles only — body text never takes this. */
export const tracking = '0.1em'

/**
 * Text over the world.
 *
 * Trick six of the game-UI set, and the one this build kept re-typing: text must never sit raw on a
 * rendered scene. Anything drawn over the 3D canvas takes this, so the rule is a token rather than
 * something each component has to remember.
 */
export const textShadow = '0 1px 2px #000'

/**
 * Station tones.
 *
 * Five stations kept five DIFFERENT hand-picked triplets at their call sites. Hue-per-station is
 * real information design — the player learns where they are by colour — so the fix is not to
 * flatten them, it is to name them once and derive them from the palette above.
 *
 * ⚠ THE ONE DELIBERATE PIXEL CHANGE, and it is a merge of THREE call sites into one. Crafting, the
 * bank and the Passage were all gold and all spelled it differently: accents `#e0b64e`, `#c9a86a`
 * and `#ffe08a` over borders `#6b5220`/`#6b5220`/`#5c4a2a` and backgrounds `#171205`/`#171205`/
 * `#171208`. Three units apart in the blue channel is not a decision anyone made; craft and bank
 * were ALREADY pixel-identical apart from the accent, so the distinction was one the player could
 * not use. All three now take `gold`, whose accent is the 328-use anchor. Each station still says
 * what it is through its title and glyph. This is the only visible change in here — judge it on the
 * screen, not in the diff.
 */
export const tone = {
  alchemy:  { accent: accent.arcane, border: '#5a3f74', bg: '#130f1c' },
  gold:     { accent: gold.base,     border: '#6b5220', bg: '#171205' },
  exchange: { accent: accent.teal,   border: mint.deep, bg: '#0b1613' },
  planter:  { accent: accent.leaf,   border: '#4a6b2f', bg: '#0f1608' },
} as const

export type ToneName = keyof typeof tone
