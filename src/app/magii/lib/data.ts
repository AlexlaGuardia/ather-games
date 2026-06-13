// Magii Card Game — Collection-Based Data
// Each collection: 8 runes (2 per element), 3 spirits each, 4 copies = 96 cards

export type Element = 'Mana' | 'Storm' | 'Earth' | 'Water'

export interface Card {
  id: string
  element: Element
  rune: string      // phenomenon name: "Barrier", "Lightning", etc.
  spirit: string    // spirit species: "turtle", "fox", etc.
  color: string
}

export const ELEMENTS: Record<Element, { color: string }> = {
  Mana:  { color: '#8b5cf6' },
  Storm: { color: '#fbbf24' },
  Earth: { color: '#10b981' },
  Water: { color: '#3b82f6' },
}

export interface RuneSlot {
  element: Element
  rune: string
  spirits: string[]  // exactly 3 spirit species
}

export interface Collection {
  name: string
  runes: RuneSlot[]  // exactly 8 (2 per element)
}

// Base collection — the Tavern Standard deck
export const TAVERN_STANDARD: Collection = {
  name: 'Tavern Standard',
  runes: [
    // Mana
    { element: 'Mana',  rune: 'Barrier',   spirits: ['turtle', 'waterbear', 'owl'] },
    { element: 'Mana',  rune: 'Enchant',   spirits: ['fox', 'bat', 'firefly'] },
    // Storm
    { element: 'Storm', rune: 'Lightning', spirits: ['fox', 'rabbit', 'hummingbird'] },
    { element: 'Storm', rune: 'Tempest',   spirits: ['owl', 'frog', 'turtle'] },
    // Earth
    { element: 'Earth', rune: 'Stone',     spirits: ['turtle', 'waterbear', 'axolotl'] },
    { element: 'Earth', rune: 'Magma',     spirits: ['fox', 'frog', 'bat'] },
    // Water
    { element: 'Water', rune: 'Freeze',    spirits: ['waterbear', 'turtle', 'rabbit'] },
    { element: 'Water', rune: 'Mist',      spirits: ['fox', 'owl', 'axolotl'] },
  ],
}

// Wildwood — verdant, living magic. Growth and weather over stone halls.
export const WILDWOOD: Collection = {
  name: 'Wildwood',
  runes: [
    // Mana
    { element: 'Mana',  rune: 'Life',       spirits: ['firefly', 'fox', 'owl'] },
    { element: 'Mana',  rune: 'Illuminate', spirits: ['firefly', 'hummingbird', 'bat'] },
    // Storm
    { element: 'Storm', rune: 'Breeze',     spirits: ['hummingbird', 'rabbit', 'fox'] },
    { element: 'Storm', rune: 'Static',     spirits: ['bat', 'firefly', 'rabbit'] },
    // Earth
    { element: 'Earth', rune: 'Gem',        spirits: ['turtle', 'axolotl', 'waterbear'] },
    { element: 'Earth', rune: 'Dust',       spirits: ['frog', 'bat', 'fox'] },
    // Water
    { element: 'Water', rune: 'Hydro',      spirits: ['axolotl', 'frog', 'waterbear'] },
    { element: 'Water', rune: 'Vapor',      spirits: ['owl', 'frog', 'turtle'] },
  ],
}

// Aeterna Court — celestial, refined, the old machine's own deck.
export const AETERNA_COURT: Collection = {
  name: 'Aeterna Court',
  runes: [
    // Mana
    { element: 'Mana',  rune: 'Manalic',    spirits: ['owl', 'fox', 'bat'] },
    { element: 'Mana',  rune: 'Star',       spirits: ['firefly', 'hummingbird', 'owl'] },
    // Storm
    { element: 'Storm', rune: 'Lightning',  spirits: ['fox', 'rabbit', 'hummingbird'] },
    { element: 'Storm', rune: 'Tempest',    spirits: ['owl', 'frog', 'turtle'] },
    // Earth
    { element: 'Earth', rune: 'Metallurgy', spirits: ['turtle', 'waterbear', 'axolotl'] },
    { element: 'Earth', rune: 'Magma',      spirits: ['fox', 'frog', 'bat'] },
    // Water
    { element: 'Water', rune: 'Fluid',      spirits: ['waterbear', 'axolotl', 'rabbit'] },
    { element: 'Water', rune: 'Mist',       spirits: ['fox', 'owl', 'axolotl'] },
  ],
}

// Registry — drives the start-screen picker. Tavern is free; the rest are Marks sinks.
export interface CollectionEntry {
  id: string
  collection: Collection
  cost: number       // Marks to unlock; 0 = always owned
  blurb: string
  accent: string     // hex accent for the picker card
}

export const COLLECTIONS: CollectionEntry[] = [
  { id: 'tavern',   collection: TAVERN_STANDARD, cost: 0,   blurb: 'The house deck. Barriers, storms, stone and frost.', accent: '#d4a843' },
  { id: 'wildwood', collection: WILDWOOD,         cost: 80,  blurb: 'Living magic — light, breeze, gemstone and vapor.',  accent: '#10b981' },
  { id: 'aeterna',  collection: AETERNA_COURT,    cost: 200, blurb: "The old machine's own deck. Starlight and alloy.",   accent: '#8b5cf6' },
]

export function getCollectionEntry(id: string): CollectionEntry {
  return COLLECTIONS.find(c => c.id === id) ?? COLLECTIONS[0]
}

export function buildDeck(collection: Collection = TAVERN_STANDARD): Card[] {
  const deck: Card[] = []
  for (const slot of collection.runes) {
    for (const spirit of slot.spirits) {
      for (let copy = 0; copy < 4; copy++) {
        deck.push({
          id: `${slot.element}-${slot.rune}-${spirit}-${copy}`.toLowerCase().replace(/\s+/g, '-'),
          element: slot.element,
          rune: slot.rune,
          spirit,
          color: ELEMENTS[slot.element].color,
        })
      }
    }
  }
  // 8 runes × 3 spirits × 4 copies = 96
  return shuffle(deck)
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
