// Per-zone semantic IntGrid store — the 3D-ready source of truth for region layers.
// Keys are zone IDs; values are number[][] where each cell holds an int value:
//   0 = unset, 1 = Grass, 2 = Path, 3 = Water
//
// Populated automatically by the Map Editor save flow (save-map/route.ts).
// DO NOT hand-edit — the save route upserts entries by zoneId via regex.
// Format rule: each zone entry is ONE key per line with trailing comma so the
// upsert regex can reliably find and replace it.

export const ZONE_INTGRIDS: Record<string, number[][]> = {
}
