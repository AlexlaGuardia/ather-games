// M76: the Mana Seed's IDENTITY as a bag row: ten ids, one name, one icon each. Split out of spirit-seeds.ts so the bag
// (shared/inventory.ts) can read it without dragging in the Wilds/forestry chain that the bloom clock lives beside.
// Canon + rules: see spirit-seeds.ts. ★ PURE, one import.
import { SPECIES_NAMES, type Species } from '../../spirits/spirit'

export const SPECIES: readonly Species[] = Object.keys(SPECIES_NAMES) as Species[]
export const SEED_PREFIX = 'mana_seed_'
export type SeedId = `mana_seed_${Species}`
export const seedOf = (s: Species) => `${SEED_PREFIX}${s}` as SeedId
export const SEED_IDS: readonly SeedId[] = SPECIES.map(seedOf)
export const isSeed = (id: string): id is SeedId => id.startsWith(SEED_PREFIX) && SPECIES.includes(id.slice(SEED_PREFIX.length) as Species)
/** The species a seed already is. The ONLY thing that decides what blooms. */
export const speciesOf = (id: SeedId): Species => id.slice(SEED_PREFIX.length) as Species
export const SEED_NAME = 'Mana Seed'
// TODO @lark: the seed's bag line (placeholder, functional).
export const SEED_BLURB = 'A seed the Bloom let go of. It already knows what it will be. Plant it in a spirit planter.'
/** One icon per species, each a gold seed with a small tell (an ear notch, a frill...). Code-drawn: tools/art/seed_icons.py. */
export const seedIcon = (id: SeedId) => `/open/icons/seed-${speciesOf(id)}.svg`

