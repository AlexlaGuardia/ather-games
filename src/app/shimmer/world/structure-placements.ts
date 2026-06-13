// Placed structure overlays per zone
// Structures render on top of base tiles — ABOVE-flagged cells render over entities
// Managed via Map Editor structure brush

export interface StructurePlacement {
  structureId: string
  tileX: number
  tileY: number
}

const GARDEN_STRUCTURES: StructurePlacement[] = []

const MYCELIAL_PATH_STRUCTURES: StructurePlacement[] = []

const MOONWELL_GLADE_STRUCTURES: StructurePlacement[] = []

const SPORE_HOLLOW_STRUCTURES: StructurePlacement[] = []

const TWILIGHT_THICKET_STRUCTURES: StructurePlacement[] = []

const THE_THRESHOLD_STRUCTURES: StructurePlacement[] = []

const MANA_SPRINGS_STRUCTURES: StructurePlacement[] = []

const SPIRIT_MEADOW_STRUCTURES: StructurePlacement[] = []

const MOONWELL_GLADE_GREGORY_S_HOME_STRUCTURES: StructurePlacement[] = []


const TEST_SANDBOX_STRUCTURES: StructurePlacement[] = []

export const STRUCTURE_PLACEMENTS: Record<string, StructurePlacement[]> = {
  garden: GARDEN_STRUCTURES,
  'mycelial-path': MYCELIAL_PATH_STRUCTURES,
  'moonwell-glade': MOONWELL_GLADE_STRUCTURES,
  'spore-hollow': SPORE_HOLLOW_STRUCTURES,
  'twilight-thicket': TWILIGHT_THICKET_STRUCTURES,
  'the-threshold': THE_THRESHOLD_STRUCTURES,
  'mana-springs': MANA_SPRINGS_STRUCTURES,
  'spirit-meadow': SPIRIT_MEADOW_STRUCTURES,
  'moonwell-glade-gregory-s-home': MOONWELL_GLADE_GREGORY_S_HOME_STRUCTURES,
  'test-sandbox': TEST_SANDBOX_STRUCTURES,
}
