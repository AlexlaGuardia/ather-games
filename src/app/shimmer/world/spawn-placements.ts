// Moglin incursion BURROWS per zone — the grind-ladder to the liberation holds.
// Direction (Alex, 2026-07-22): until a hold's boss falls, LESSER MOGLINS patrol its
// territory. They pay better XP and (unlike wild spirits, who carry no purse) real
// MARKS — a moglin has pockets. Worth grinding until your spirits can take the hold;
// the moment the hold is freed, its patrols stop.
//
// Canon (RULED 2026-07-30, shimmer-geography.md): each placement is a BURROW MOUTH —
// the collar-culture tunnels in and keeps pressing while the hold stands. The patrol
// that walks it lives on the spawn-board window clock now (engine/burrows.ts), not a
// stored cooldown: beaten = down for the rest of the window, back at the next deal.
//
// Placed via the play3d map editor (spawner tools) → saved back here by
// /shimmer/save-map (`spawners` payload) → served live by /shimmer/world-data.
// A burrow's GATE names the hold that quiets it: freeing that boss ends its patrols.

export interface SpawnerPlacement {
  kind: 'moglin'
  gate: 'thistle' | 'vetch' | 'brack'
  tileX: number
  tileY: number
}

const THE_OUTFIELDS_SPAWNERS: SpawnerPlacement[] = [
  { kind: 'moglin', gate: 'thistle', tileX: 7, tileY: 16 },
  { kind: 'moglin', gate: 'vetch', tileX: 17, tileY: 10 },
  { kind: 'moglin', gate: 'brack', tileX: 27, tileY: 14 },
]

const RUNE_HOLD_SPAWNERS: SpawnerPlacement[] = [

]

export const ZONE_SPAWNERS: Record<string, SpawnerPlacement[]> = {
  'rune-hold': RUNE_HOLD_SPAWNERS,
  'the-outfields': THE_OUTFIELDS_SPAWNERS,
}

export function spawnersFor(zoneId: string): SpawnerPlacement[] {
  return (ZONE_SPAWNERS[zoneId] ?? []).map(s => ({ ...s }))
}
