// runes.data.ts — Birth Rune carousel data, transcribed from CANON/game/runes.md.
// 20 runes = 4 elements x 5 states (grey/impossible cells omitted). Colors + one-line
// "Feel" are pulled straight from each rune's canon Visual/Feel entry so the birth screen
// art-directs itself off the world, not off invention.
//
// CANON, NOT JIN'S TO EDIT: rune names, elements, states, and their meanings are Magii's.
// This file only *presents* them. If a rune's roster/look ever needs changing, that's a
// canon call (CANON_GAPS.md), not a tweak here.

export type ElementId = 'mana' | 'storm' | 'earth' | 'water'

export interface Element {
  id: ElementId
  name: string
  /** page background tint while this element's wheel is active */
  bg: string
  /** accent for the element orb + ambient glow */
  accent: string
}

export interface Rune {
  id: string
  name: string
  element: ElementId
  /** the State axis of the canon matrix (Solid/Compact/Expanding/Ignite/Flow/Scatter/Bind) */
  state: string
  /** primary glow color (from canon Visual) */
  glow: string
  /** bright inner core (defaults toward white where canon says "core") */
  core: string
  /** one-line Feel, verbatim-ish from canon */
  feel: string
  /** one-line Core essence */
  essence: string
}

export const ELEMENTS: Element[] = [
  { id: 'mana',  name: 'Mana',  bg: '#0a1730', accent: '#5a8fe0' },
  { id: 'storm', name: 'Storm', bg: '#120f22', accent: '#b49cff' },
  { id: 'earth', name: 'Earth', bg: '#191006', accent: '#d59a4c' },
  { id: 'water', name: 'Water', bg: '#04191f', accent: '#46c6d6' },
]

// Ordered by the canon State rows so each wheel reads top-to-bottom in a consistent logic.
export const RUNES: Rune[] = [
  // ── Mana ──────────────────────────────────────────────
  { id: 'manalic', name: 'Manalic', element: 'mana', state: 'Solid',
    glow: '#a9d0f5', core: '#eaf4ff',
    feel: 'Like pushing through thick honey until it clicks into shape.',
    essence: 'Raw magic made tangible — shaped into constructs, platforms, projectiles.' },
  { id: 'barrier', name: 'Barrier', element: 'mana', state: 'Compact',
    glow: '#cfe0ee', core: '#ffffff',
    feel: 'A second skin. Pressure pushing outward from within.',
    essence: 'The classic shield — disperses force across the whole surface.' },
  { id: 'star', name: 'Star', element: 'mana', state: 'Ignite',
    glow: '#ffb15a', core: '#eaf1ff',
    feel: 'A sun in my chest. The more you push, the hotter it gets.',
    essence: 'Ignited mana that burns — hotter than flame, harder to douse.' },
  { id: 'life', name: 'Life', element: 'mana', state: 'Flow',
    glow: '#7fe6a6', core: '#e6fff0',
    feel: 'Warm water running through your veins. Fatigue lifts like fog.',
    essence: 'Flowing mana that restores — follows the body’s natural currents.' },
  { id: 'enchant', name: 'Enchant', element: 'mana', state: 'Bind',
    glow: '#a6b6ff', core: '#eef0ff',
    feel: 'Like threading a needle with your mind. Patience required.',
    essence: 'Mana bound to objects — the bridge between magic and matter.' },

  // ── Storm ─────────────────────────────────────────────
  { id: 'lightning', name: 'Lightning', element: 'storm', state: 'Expanding',
    glow: '#bcd0ff', core: '#ffffff',
    feel: 'A jolt in your spine. Everything speeds up.',
    essence: 'Arcing electricity that chains between targets, jumps conductors.' },
  { id: 'tempest', name: 'Tempest', element: 'storm', state: 'Ignite',
    glow: '#8fbf9a', core: '#dfeee2',
    feel: 'Rage given form. Your emotions feed it.',
    essence: 'Weather as a weapon — wind that wants to destroy.' },
  { id: 'breeze', name: 'Breeze', element: 'storm', state: 'Flow',
    glow: '#cfeede', core: '#f2fff8',
    feel: 'Weightlessness. The air an extension of your lungs.',
    essence: 'Wind in motion under your direction — the thinking mage’s storm.' },
  { id: 'static', name: 'Static', element: 'storm', state: 'Scatter',
    glow: '#d9c7ff', core: '#ffffff',
    feel: 'Hair stands on end. Patience becomes power.',
    essence: 'Scattered charge that accumulates — the longer you wait, the bigger the payoff.' },
  { id: 'illuminate', name: 'Illuminate', element: 'storm', state: 'Bind',
    glow: '#ffd98a', core: '#fff6e0',
    feel: 'Clarity. Like cleaning a dirty window.',
    essence: 'Light bound in place — reveals hidden things, exposes illusion.' },

  // ── Earth ─────────────────────────────────────────────
  { id: 'stone', name: 'Stone', element: 'earth', state: 'Solid',
    glow: '#b8a892', core: '#e8dcc8',
    feel: 'Heavy. Grounded. Stone doesn’t ask, it insists.',
    essence: 'Solid rock under command — the foundation rune. Simple, reliable, brutal.' },
  { id: 'gem', name: 'Gem', element: 'earth', state: 'Compact',
    glow: '#a8eccf', core: '#f0fff6',
    feel: 'Precision. Pressure focused to a single point.',
    essence: 'Minerals compressed to crystalline density — harder, sharper, holds enchantment.' },
  { id: 'magma', name: 'Magma', element: 'earth', state: 'Ignite',
    glow: '#ff7a3c', core: '#ffd8a0',
    feel: 'Fever heat radiating from your core. Blood thick and glowing.',
    essence: 'Molten earth given purpose — slow but unstoppable, melts through anything.' },
  { id: 'dust', name: 'Dust', element: 'earth', state: 'Scatter',
    glow: '#d8c9a8', core: '#f2ead6',
    feel: 'Grit between your teeth. An itch beneath the skin.',
    essence: 'Erosion as a weapon — relentless, death by a thousand cuts.' },
  { id: 'metalergy', name: 'Metalergy', element: 'earth', state: 'Bind',
    glow: '#c8d0d8', core: '#f4f7fa',
    feel: 'Cold recognition. The metal knows you.',
    essence: 'Metal bonded to your will — responds to thought, remembers your touch.' },

  // ── Water ─────────────────────────────────────────────
  { id: 'freeze', name: 'Freeze', element: 'water', state: 'Solid',
    glow: '#bfe6ff', core: '#ffffff',
    feel: 'A stillness spreading outward. Your breath fogs.',
    essence: 'Water crystallized to ice — instant, sharp, unforgiving.' },
  { id: 'hydro', name: 'Hydro', element: 'water', state: 'Compact',
    glow: '#6fc8e6', core: '#daf4ff',
    feel: 'Tension in your forearms, like gripping a fire hose.',
    essence: 'Pressurized water condensed to striking force — a punch, not a splash.' },
  { id: 'mist', name: 'Mist', element: 'water', state: 'Expanding',
    glow: '#d6e2e6', core: '#f4fafc',
    feel: 'Soft. Yielding. Like breathing in a cloud.',
    essence: 'Vapor expanding to fill space — obscures, dampens, carries other runes.' },
  { id: 'fluid', name: 'Fluid', element: 'water', state: 'Flow',
    glow: '#58c4e0', core: '#dbf6ff',
    feel: 'Loose. Adaptive. You move like a dancer standing still.',
    essence: 'Water in motion, answering to you — the most versatile water rune.' },
  { id: 'vapor', name: 'Vapor', element: 'water', state: 'Scatter',
    glow: '#b8d4d8', core: '#eef7f8',
    feel: 'Damp skin. Heavy air. A presence you sense before you see.',
    essence: 'Moisture scattered at the edge of perception — the support rune.' },
]

export const runesOf = (el: ElementId): Rune[] => RUNES.filter((r) => r.element === el)
