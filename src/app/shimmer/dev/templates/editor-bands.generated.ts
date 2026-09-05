/**
 * GENERATED — DO NOT EDIT BY HAND. Run `npm run gen:bands`.
 *
 * Which game's data each dev editor authors, computed from the real transitive import graph of
 * the two shipped entry points. `editor-bands.test.ts` re-derives this and goes red if it has
 * drifted, so this file is a CACHE OF A COMPUTATION rather than a hand-kept list somebody has to
 * remember to update. `band-derive.ts` says why that distinction is the entire point.
 *
 * Derived against: voxel3d closure 221 files, play3d closure 136 files.
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
  { id: "banner", file: "BannerEditor.tsx", band: "tool", deployable: false,
    live: [], legacy: [], orphan: [] },
  { id: "battle", file: "BattleTester.tsx", band: "orphan", deployable: false,
    live: ["engine/battle","engine/battle-ai","engine/moves","engine/party-stats","spirits/spirit","sprites/palette","sprites/registry","sprites/sprite-data"], legacy: [], orphan: ["engine/party-battle"] },
  { id: "daycycle", file: "DayCycleEditor.tsx", band: "opaque", deployable: true,
    live: [], legacy: [], orphan: [] },
  { id: "doctor", file: "DoctorPanel.tsx", band: "tool", deployable: false,
    live: [], legacy: [], orphan: [] },
  { id: "encounters", file: "EncounterEditor.tsx", band: "live", deployable: true,
    live: ["engine/battle-ai","engine/encounters","engine/spirit-index","spirits/spirit","world/zones"], legacy: [], orphan: [] },
  { id: "evolution", file: "EvolutionEditor.tsx", band: "live", deployable: true,
    live: ["spirits/evolution-config","spirits/spirit"], legacy: [], orphan: [] },
  { id: "exchange", file: "GEEditor.tsx", band: "legacy", deployable: true,
    live: ["sprites/items"], legacy: ["engine/exchange"], orphan: [] },
  { id: "farming", file: "FarmingEditor.tsx", band: "live", deployable: true,
    live: ["engine/farming","sprites/items"], legacy: [], orphan: [] },
  { id: "furniture", file: "FurnitureEditor.tsx", band: "live", deployable: true,
    live: ["sprites/furniture","sprites/items","sprites/sprite-data"], legacy: [], orphan: [] },
  { id: "grimoire", file: "GrimoireEditor.tsx", band: "orphan", deployable: false,
    live: ["engine/moves","engine/spirit-index","spirits/evolution-config","spirits/spirit"], legacy: [], orphan: ["spirits/grimoire","sprites/variants"] },
  { id: "items", file: "ItemEditor.tsx", band: "live", deployable: true,
    live: ["sprites/items","sprites/sprite-data"], legacy: [], orphan: [] },
  { id: "mana", file: "ManaEditor.tsx", band: "opaque", deployable: true,
    live: [], legacy: [], orphan: [] },
  { id: "map", file: "MapEditor.tsx", band: "orphan", deployable: false,
    live: ["engine/spawn-board","sprites/furniture","sprites/items","world/all-zones","world/node-placements","world/region-maps","world/resources","world/spawn-placements","world/static-pickups","world/structure-placements","world/tilemap","world/zone-chests","world/zones"], legacy: ["engine/renderer","world/garden-world","world/tiles"], orphan: ["world/autolayer-rules","world/intgrids","world/structures"] },
  { id: "meshbench", file: "MeshBench.tsx", band: "live", deployable: false,
    live: ["voxel/greedy","voxel/section"], legacy: [], orphan: [] },
  { id: "moves", file: "MovesEditor.tsx", band: "live", deployable: true,
    live: ["engine/moves"], legacy: [], orphan: [] },
  { id: "nodes", file: "NodeEditor.tsx", band: "live", deployable: true,
    live: ["sprites/items","sprites/sprite-data"], legacy: [], orphan: [] },
  { id: "npcs", file: "NPCEditor.tsx", band: "orphan", deployable: true,
    live: ["engine/battle-ai","spirits/spirit","world/zones"], legacy: ["engine/player","world/tiles"], orphan: ["world/npcs"] },
  { id: "player", file: "PlayerEditor.tsx", band: "orphan", deployable: true,
    live: ["sprites/sprite-data"], legacy: [], orphan: ["sprites/alex","sprites/gregory","sprites/kael","sprites/player"] },
  { id: "puppet", file: "PuppetEditor.tsx", band: "orphan", deployable: false,
    live: ["sprites/registry","sprites/sprite-data"], legacy: [], orphan: ["engine/puppet","sprites/player"] },
  { id: "quests", file: "QuestEditor.tsx", band: "orphan", deployable: true,
    live: ["engine/alchemy","engine/skills","sprites/items","world/zones"], legacy: [], orphan: ["engine/quests","world/npcs"] },
  { id: "resources", file: "ResourcesEditor.tsx", band: "live", deployable: true,
    live: ["sprites/items","world/resources"], legacy: [], orphan: [] },
  { id: "skills", file: "SkillsEditor.tsx", band: "legacy", deployable: true,
    live: ["engine/skills"], legacy: ["engine/harvesting"], orphan: [] },
  { id: "spinner", file: "SpinnerEditor.tsx", band: "tool", deployable: false,
    live: [], legacy: [], orphan: [] },
  { id: "sprites", file: "SpriteEditor.tsx", band: "orphan", deployable: true,
    live: ["engine/spirit-index","spirits/spirit","sprites/palette","sprites/registry","sprites/sprite-data"], legacy: [], orphan: ["spirits/grimoire","sprites/variants"] },
  { id: "structures", file: "StructureBuilder.tsx", band: "orphan", deployable: false,
    live: [], legacy: ["engine/renderer","world/tiles"], orphan: ["world/structures"] },
  { id: "tools", file: "ToolsEditor.tsx", band: "live", deployable: true,
    live: ["engine/tools","sprites/items"], legacy: [], orphan: [] },
  { id: "weather", file: "WeatherEditor.tsx", band: "orphan", deployable: true,
    live: ["world/zones"], legacy: [], orphan: ["engine/weather"] },
]

export const bandOf = (id: string): EditorBand | undefined => EDITOR_BANDS.find(b => b.id === id)
