/**
 * GENERATED — DO NOT EDIT BY HAND. Run `npm run gen:bands`.
 *
 * Which game's data each dev editor authors, computed from the real transitive import graph of
 * the two shipped entry points. `editor-bands.test.ts` re-derives this and goes red if it has
 * drifted, so this file is a CACHE OF A COMPUTATION rather than a hand-kept list somebody has to
 * remember to update. `band-derive.ts` says why that distinction is the entire point.
 *
 * Derived against: voxel3d closure 445 files, play3d closure 369 files.
 */
export type Band = 'live' | 'legacy' | 'orphan' | 'tool' | 'opaque'

export interface EditorBand {
  id: string
  file: string
  band: Band
  deployable: boolean
  live: string[]
  legacy: string[]
  orphan: string[]
}

export const BAND_LABELS: Record<Band, { label: string; note: string }> = {
  live:   { label: 'Live',     note: 'Authors data the shipped voxel game imports.' },
  legacy: { label: 'Legacy',   note: 'Authors data only play3d imports — the legacy route the voxel port still mines.' },
  orphan: { label: 'Orphaned', note: 'Authors at least one module no shipped game imports. The card names them.' },
  opaque: { label: 'Opaque',   note: 'Deploys, but writes through a save route the import graph cannot see.' },
  tool:   { label: 'Tool',     note: 'Not a data editor. Its usefulness does not depend on any game.' },
}

export const EDITOR_BANDS: EditorBand[] = [
  { id: "alchemy", file: "AlchemyEditor.tsx", band: "live", deployable: true,
    live: ["engine/alchemy","sprites/items"], legacy: [], orphan: [] },
  { id: "daycycle", file: "DayCycleEditor.tsx", band: "opaque", deployable: true,
    live: [], legacy: [], orphan: [] },
  { id: "evolution", file: "EvolutionEditor.tsx", band: "live", deployable: true,
    live: ["spirits/evolution-config","spirits/spirit"], legacy: [], orphan: [] },
  { id: "fair", file: "FairDev.tsx", band: "live", deployable: false,
    live: ["spirits/spirit"], legacy: [], orphan: [] },
  { id: "farming", file: "FarmingEditor.tsx", band: "live", deployable: true,
    live: ["engine/farming","sprites/items"], legacy: [], orphan: [] },
  { id: "items", file: "ItemEditor.tsx", band: "live", deployable: true,
    live: ["sprites/items","sprites/sprite-data"], legacy: [], orphan: [] },
  { id: "mana", file: "ManaEditor.tsx", band: "opaque", deployable: true,
    live: [], legacy: [], orphan: [] },
  { id: "moves", file: "MovesEditor.tsx", band: "live", deployable: true,
    live: ["engine/moves"], legacy: [], orphan: [] },
  { id: "resources", file: "ResourcesEditor.tsx", band: "live", deployable: true,
    live: ["sprites/items","world/resources"], legacy: [], orphan: [] },
  { id: "skills", file: "SkillsEditor.tsx", band: "legacy", deployable: true,
    live: ["engine/skills"], legacy: ["engine/harvesting"], orphan: [] },
  { id: "spirits", file: "SpiritGallery.tsx", band: "live", deployable: false,
    live: ["spirits/spirit"], legacy: [], orphan: [] },
  { id: "terrain", file: "TerrainEditor.tsx", band: "orphan", deployable: false,
    live: ["world/builder-props","world/glade-builder"], legacy: [], orphan: ["world/builder","world/builder-flush","world/builder-zones","world/nyx-builder"] },
  { id: "tools", file: "ToolsEditor.tsx", band: "live", deployable: true,
    live: ["engine/tools","sprites/items"], legacy: [], orphan: [] },
]

export const bandOf = (id: string): EditorBand | undefined => EDITOR_BANDS.find(b => b.id === id)
