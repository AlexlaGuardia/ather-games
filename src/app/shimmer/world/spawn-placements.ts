// Moglin patrol spawners per zone — the grind-ladder to the liberation holds.
// Direction (Alex, 2026-07-22): until a hold's boss falls, LESSER MOGLINS patrol its
// territory on long-cooldown spawners. They pay better XP and (unlike wild spirits,
// who carry no purse) real MARKS — a moglin has pockets. Worth grinding until your
// spirits can take the hold; the moment the hold is freed, its patrols stop.
//
// Placed via the play3d map editor (spawner tools) → saved back here by
// /shimmer/save-map (`spawners` payload) → served live by /shimmer/world-data.
// A spawner's GATE names the hold that retires it: freeing that boss ends its patrols.

export interface SpawnerPlacement {
  kind: 'moglin'
  gate: 'thistle' | 'sorrel' | 'brack'
  tileX: number
  tileY: number
}

export const SPAWNER_COOLDOWN_MS = 10 * 60_000   // long clock — a beaten patrol stays gone a while

const THE_OUTFIELDS_SPAWNERS: SpawnerPlacement[] = [
  { kind: 'moglin', gate: 'thistle', tileX: 7, tileY: 16 },
  { kind: 'moglin', gate: 'sorrel', tileX: 17, tileY: 10 },
  { kind: 'moglin', gate: 'brack', tileX: 27, tileY: 14 },
]

export const ZONE_SPAWNERS: Record<string, SpawnerPlacement[]> = {
  'the-outfields': THE_OUTFIELDS_SPAWNERS,
}

export function spawnersFor(zoneId: string): SpawnerPlacement[] {
  return (ZONE_SPAWNERS[zoneId] ?? []).map(s => ({ ...s }))
}
