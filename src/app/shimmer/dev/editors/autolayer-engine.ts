// Auto-layer engine — evaluates rules against an IntGrid to produce visual tile output
// Inspired by LDtk's auto-layer system

export interface AutoLayerRule {
  id: string
  name: string
  intValue: number           // which semantic value triggers this rule
  pattern: (number | -1)[]   // 3x3 neighbor check (-1 = any, 0 = empty, N = specific value)
  outputTileIdx: number      // visual tile to place
  outputRotation: number     // 0-3
  priority: number           // higher = checked first
  enabled: boolean
}

// 3x3 pattern layout (index positions):
// [0] [1] [2]
// [3] [4] [5]   <-- center is [4]
// [6] [7] [8]

const NEIGHBOR_OFFSETS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0], [0,  0], [1,  0],
  [-1,  1], [0,  1], [1,  1],
]

/**
 * Evaluate auto-layer rules for a single cell.
 * Returns the output tile index (with rotation encoded) or null if no rule matches.
 */
export function evaluateCell(
  intGrid: number[][],
  x: number,
  y: number,
  rules: AutoLayerRule[],
): { tileIdx: number; rotation: number } | null {
  const cellValue = intGrid[y]?.[x] ?? 0
  if (cellValue === 0) return null

  // Sort rules by priority (higher first)
  const sorted = rules
    .filter(r => r.enabled && r.intValue === cellValue)
    .sort((a, b) => b.priority - a.priority)

  for (const rule of sorted) {
    if (matchesPattern(intGrid, x, y, rule.pattern)) {
      return { tileIdx: rule.outputTileIdx, rotation: rule.outputRotation }
    }
  }

  return null
}

function matchesPattern(
  intGrid: number[][],
  cx: number,
  cy: number,
  pattern: (number | -1)[],
): boolean {
  for (let i = 0; i < 9; i++) {
    const expected = pattern[i]
    if (expected === -1) continue // wildcard

    const [dx, dy] = NEIGHBOR_OFFSETS[i]
    const nx = cx + dx, ny = cy + dy
    const actual = intGrid[ny]?.[nx] ?? 0

    if (expected === 0 && actual !== 0) return false
    if (expected > 0 && actual !== expected) return false
  }
  return true
}

/**
 * Evaluate all cells affected by a change at (cx, cy).
 * Returns a list of visual tile updates to apply.
 */
export function evaluateAffected(
  intGrid: number[][],
  cx: number,
  cy: number,
  rules: AutoLayerRule[],
): { x: number; y: number; tileIdx: number; rotation: number }[] {
  const updates: { x: number; y: number; tileIdx: number; rotation: number }[] = []

  // Check the cell itself and all 8 neighbors
  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const nx = cx + dx, ny = cy + dy
    if (ny < 0 || ny >= intGrid.length) continue
    if (nx < 0 || nx >= (intGrid[0]?.length ?? 0)) continue

    const result = evaluateCell(intGrid, nx, ny, rules)
    if (result) {
      updates.push({ x: nx, y: ny, ...result })
    }
  }

  return updates
}

/**
 * Evaluate the entire intGrid to produce a visual tile grid.
 * Returns the visual grid with rule results applied.
 */
export function evaluateFullGrid(
  intGrid: number[][],
  rules: AutoLayerRule[],
): (number | null)[][] {
  const rows = intGrid.length
  const cols = intGrid[0]?.length ?? 0
  const output: (number | null)[][] = []

  for (let y = 0; y < rows; y++) {
    output[y] = []
    for (let x = 0; x < cols; x++) {
      const result = evaluateCell(intGrid, x, y, rules)
      output[y][x] = result ? (result.tileIdx | (result.rotation << 8)) : null
    }
  }

  return output
}

// Built-in rule templates
let _ruleCounter = 0
function ruleId() { return `rule_${++_ruleCounter}` }

export const BUILTIN_RULE_TEMPLATES: AutoLayerRule[] = [
  // Water center
  {
    id: ruleId(), name: 'Water Center', intValue: 2,
    pattern: [-1, 2, -1, 2, 2, 2, -1, 2, -1],
    outputTileIdx: 8, outputRotation: 0, priority: 1, enabled: true,
  },
  // Water top edge
  {
    id: ruleId(), name: 'Water Top Edge', intValue: 2,
    pattern: [-1, 0, -1, -1, 2, -1, -1, 2, -1],
    outputTileIdx: 7, outputRotation: 0, priority: 10, enabled: true,
  },
  // Water bottom edge
  {
    id: ruleId(), name: 'Water Bottom Edge', intValue: 2,
    pattern: [-1, 2, -1, -1, 2, -1, -1, 0, -1],
    outputTileIdx: 7, outputRotation: 2, priority: 10, enabled: true,
  },
  // Water left edge
  {
    id: ruleId(), name: 'Water Left Edge', intValue: 2,
    pattern: [-1, -1, -1, 0, 2, 2, -1, -1, -1],
    outputTileIdx: 7, outputRotation: 3, priority: 10, enabled: true,
  },
  // Water right edge
  {
    id: ruleId(), name: 'Water Right Edge', intValue: 2,
    pattern: [-1, -1, -1, 2, 2, 0, -1, -1, -1],
    outputTileIdx: 7, outputRotation: 1, priority: 10, enabled: true,
  },
  // Path center
  {
    id: ruleId(), name: 'Path Center', intValue: 1,
    pattern: [-1, 1, -1, 1, 1, 1, -1, 1, -1],
    outputTileIdx: 2, outputRotation: 0, priority: 1, enabled: true,
  },
  // Path edge (horizontal)
  {
    id: ruleId(), name: 'Path H-Edge', intValue: 1,
    pattern: [-1, 0, -1, -1, 1, -1, -1, 1, -1],
    outputTileIdx: 30, outputRotation: 0, priority: 10, enabled: true,
  },
]

/**
 * Create a new empty rule for a given int value
 */
export function createEmptyRule(intValue: number): AutoLayerRule {
  return {
    id: ruleId(),
    name: 'New Rule',
    intValue,
    pattern: [-1, -1, -1, -1, intValue, -1, -1, -1, -1],
    outputTileIdx: 0,
    outputRotation: 0,
    priority: 5,
    enabled: true,
  }
}
