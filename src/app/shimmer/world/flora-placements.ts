// Decorative flora placements per zone — pure world dressing (world lane).
// These are NON-harvest, NON-colliding scenery trees (distinct from resource nodes in
// node-placements.ts). They exist to make the outdoor zones feel populated in play3d. Alex can
// retune coords/looks freely; nothing gameplay-bearing hangs off them.
//
// If Alex later wants a dressing tree to be solid (block the player), that's a play3d/engine
// collision call — leave these visual and flag it on the [coord] thread; the world lane does not
// touch collision files.

export type FloraLook = { trunk: string; canopy: string; scale: number; glow?: number }
export interface FloraPlacement {
  tileX: number
  tileY: number
  look?: keyof typeof FLORA_LOOKS   // defaults to 'grove'
  scaleJitter?: number              // ±fraction applied to look.scale (default small stable jitter)
}

// Scenery palettes — deliberately calmer/greener than the harvest-node trees so dressing reads as
// background, not "something to chop". Canon-neutral outdoor greens; the Ather glow stays subtle.
export const FLORA_LOOKS = {
  grove:     { trunk: '#5f4a2e', canopy: '#3f7a52', scale: 1.15 },              // deep forest green
  pale:      { trunk: '#7a6a4e', canopy: '#7fb089', scale: 1.0 },               // lighter, airy
  shimmer:   { trunk: '#6f5330', canopy: '#4fc79a', scale: 1.3, glow: 0.22 },   // faint Ather shimmer
  dusk:      { trunk: '#4a3f30', canopy: '#356b6a', scale: 1.2 },               // teal, cooler zones
} satisfies Record<string, FloraLook>

// Per-zone dressing. Keep clusters off the main walked lanes (edges / corners read as treeline).
// Coords are tile positions; Y comes from the zone heightmap at render time.
export const ZONE_FLORA: Record<string, FloraPlacement[]> = {
  garden: [
    { tileX: 1, tileY: 2, look: 'grove' },
    { tileX: 0, tileY: 6, look: 'pale' },
    { tileX: 27, tileY: 1, look: 'grove' },
    { tileX: 29, tileY: 5, look: 'pale' },
    { tileX: 28, tileY: 28, look: 'grove' },
    { tileX: 24, tileY: 29, look: 'shimmer' },
  ],
  'mycelial-path': [
    { tileX: 0, tileY: 4, look: 'dusk' },
    { tileX: 2, tileY: 8, look: 'grove' },
    { tileX: 0, tileY: 12, look: 'pale' },
    { tileX: 49, tileY: 3, look: 'grove' },
    { tileX: 48, tileY: 9, look: 'dusk' },
    { tileX: 49, tileY: 27, look: 'shimmer' },
  ],
  'wooded-trail': [
    { tileX: 1, tileY: 3, look: 'grove' },
    { tileX: 0, tileY: 9, look: 'dusk' },
    { tileX: 2, tileY: 16, look: 'grove' },
    { tileX: 1, tileY: 24, look: 'pale' },
    { tileX: 28, tileY: 5, look: 'grove' },
    { tileX: 29, tileY: 13, look: 'shimmer' },
    { tileX: 27, tileY: 22, look: 'grove' },
    { tileX: 29, tileY: 30, look: 'dusk' },
    { tileX: 26, tileY: 44, look: 'grove' },
    { tileX: 3, tileY: 47, look: 'pale' },
  ],
  'twilight-thicket': [
    { tileX: 2, tileY: 4, look: 'dusk' },
    { tileX: 6, tileY: 2, look: 'grove' },
    { tileX: 1, tileY: 20, look: 'dusk' },
    { tileX: 3, tileY: 40, look: 'shimmer' },
    { tileX: 96, tileY: 6, look: 'grove' },
    { tileX: 98, tileY: 22, look: 'dusk' },
    { tileX: 94, tileY: 55, look: 'grove' },
    { tileX: 50, tileY: 2, look: 'shimmer' },
    { tileX: 70, tileY: 78, look: 'dusk' },
    { tileX: 20, tileY: 77, look: 'grove' },
  ],
}
