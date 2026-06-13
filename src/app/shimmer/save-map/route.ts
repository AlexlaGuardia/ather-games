import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'

const WORLD_DIR = join(process.cwd(), 'src/app/shimmer/world')
const TILES_FILE = join(WORLD_DIR, 'tiles.ts')
const TILEMAP_FILE = join(WORLD_DIR, 'tilemap.ts')
const NODES_FILE = join(WORLD_DIR, 'node-placements.ts')
const STRUCTURES_FILE = join(WORLD_DIR, 'structure-placements.ts')
const FURNITURE_FILE = join(WORLD_DIR, 'furniture-placements.ts')
const PICKUPS_FILE = join(WORLD_DIR, 'static-pickups.ts')
const ZONE_CHESTS_FILE = join(WORLD_DIR, 'zone-chests.ts')
const ZONES_FILE = join(WORLD_DIR, 'zones.ts')
const ENCOUNTERS_FILE = join(WORLD_DIR, '../engine/encounters.ts')
const EXCHANGE_FILE = join(WORLD_DIR, '../engine/exchange.ts')
const ALCHEMY_FILE = join(WORLD_DIR, '../engine/alchemy.ts')
const QUESTS_FILE = join(WORLD_DIR, '../engine/quests.ts')
const FARMING_FILE = join(WORLD_DIR, '../engine/farming.ts')
const EVOLUTION_FILE = join(WORLD_DIR, '../spirits/evolution-config.ts')
const RESOURCES_FILE = join(WORLD_DIR, 'resources.ts')
const TOOLS_FILE = join(WORLD_DIR, '../engine/tools.ts')
const SKILLS_FILE = join(WORLD_DIR, '../engine/skills.ts')
const HARVESTING_FILE = join(WORLD_DIR, '../engine/harvesting.ts')
const MOVES_FILE = join(WORLD_DIR, '../engine/moves.ts')
const VOICE_FILE = join(WORLD_DIR, '../data/voice-profiles.ts')
const NPCS_FILE = join(WORLD_DIR, 'npcs.ts')
const DAY_CYCLE_FILE = join(WORLD_DIR, '../engine/day-cycle.ts')
const MANA_FILE = join(WORLD_DIR, '../engine/mana.ts')
const WEATHER_FILE = join(WORLD_DIR, '../engine/weather.ts')

/** Derive TypeScript const name from zone ID: 'mycelial-path' → 'MYCELIAL_PATH' */
function zoneConstName(id: string): string {
  return id.replace(/-/g, '_').toUpperCase()
}

/** Parse a zone grid from tilemap.ts source (works for plain number[][] declarations) */
async function parseZoneGridFromSource(constName: string): Promise<number[][] | null> {
  const content = await readFile(TILEMAP_FILE, 'utf-8')
  // Match: export const NAME: number[][] = [ ... ] or export const NAME = [ ... ]
  const declStart = content.indexOf(`export const ${constName}`)
  if (declStart === -1) return null
  const bracketStart = content.indexOf('[', declStart)
  if (bracketStart === -1) return null
  // Check if this is a createStubMap call (not a plain array)
  const between = content.substring(declStart, bracketStart)
  if (between.includes('createStubMap')) return null // can't parse stub maps from source

  // Find matching closing bracket
  let depth = 0, pos = bracketStart
  while (pos < content.length) {
    if (content[pos] === '[') depth++
    else if (content[pos] === ']') { depth--; if (depth === 0) break }
    pos++
  }
  const arrayStr = content.substring(bracketStart, pos + 1)
  const rows = arrayStr.match(/\[([^\]]+)\]/g)
  if (!rows || rows.length < 2) return null // first match is outer bracket
  // Skip first match (outer bracket) — actually the regex matches inner brackets too
  return rows.slice(1).map(row =>
    row.replace(/[\[\]]/g, '').split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
  )
}

/** Generate a stub grid (bordered with grass interior) */
function generateStubGrid(cols: number, rows: number): number[][] {
  const TL = 12, TOP = 267, TR = 268
  const LEFT = 11, RIGHT = 523
  const BL = 780, BOTTOM = 779, BR = 524

  const grid: number[][] = []
  for (let y = 0; y < rows; y++) {
    const row: number[] = []
    for (let x = 0; x < cols; x++) {
      if (y === 0) row.push(x === 0 ? TL : x === cols - 1 ? TR : TOP)
      else if (y === rows - 1) row.push(x === 0 ? BL : x === cols - 1 ? BR : BOTTOM)
      else if (x === 0) row.push(LEFT)
      else if (x === cols - 1) row.push(RIGHT)
      else row.push(((x * 7 + y * 13) % 8 === 0) ? 1 : 0)
    }
    grid.push(row)
  }
  return grid
}

interface TileData {
  name: string
  palette: string[] // 1-9 colors
  digits: string    // 16 lines of 16 digits (frame 0)
  solid: boolean
  above?: boolean
  veil?: boolean
  veilDense?: boolean
  category?: string
  frames?: string[] // all frame digit strings (animated tiles)
  animRate?: number  // ticks per frame (animated tiles)
}

// GET: read live tile + map data from source files
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') ?? 'all'

    const mapId = req.nextUrl.searchParams.get('map') ?? 'garden'
    const result: Record<string, unknown> = {}

    // Non-garden zones: parse grid from source
    if (type === 'map' && mapId !== 'garden') {
      const constName = zoneConstName(mapId)
      const grid = await parseZoneGridFromSource(constName)
      return NextResponse.json({ grid: grid ?? [] })
    }

    if (type === 'all' || type === 'tiles') {
      const content = await readFile(TILES_FILE, 'utf-8')

      // Extract tile blocks: find all t/t32/ta/ta32(['...'], `...`) calls
      // Use a unified approach: find each "// N: ..." comment + const declaration
      const tiles: TileData[] = []
      const tileBlockPattern = /\/\/\s*(\d+):\s*([^\n]+)\n\s*const\s+\w+\s*=\s*t(a?)(?:32)?\(([^)]*(?:`[^`]*`[^)]*)*)\)/g
      let match
      while ((match = tileBlockPattern.exec(content)) !== null) {
        const commentPart = match[2]
        const isAnimated = match[3] === 'a'
        const argsStr = match[4]

        // Extract [category] tag if present
        const catMatch = commentPart.match(/\[(\w+)\]/)
        const category = catMatch ? catMatch[1] : ''
        // Strip category tag, solid/above notes, animated note from name
        // Only strip em-dashes (—) as separators, NOT regular hyphens which appear in tile names like "H-H Top"
        const rawName = commentPart
          .replace(/\s*\[\w+\]\s*/g, '')
          .replace(/\s*—.*$/, '')
          .replace(/\s*\(SOLID\)/gi, '')
          .replace(/\s*\(ABOVE\)/gi, '')
          .replace(/\s*\(animated:\d+\)/gi, '')
          .trim()

        // Extract palette
        const palMatch = argsStr.match(/\[([^\]]+)\]/)
        const paletteStr = palMatch ? palMatch[1] : ''
        const colors = paletteStr.match(/'(#[0-9a-fA-F]+)'/g)?.map((s: string) => s.replace(/'/g, '')) ?? []

        // Extract backtick frame strings
        const frameStrings: string[] = []
        const btPattern = /`([^`]*)`/g
        let btMatch
        while ((btMatch = btPattern.exec(argsStr)) !== null) {
          frameStrings.push(btMatch[1].trim().split('\n').map((l: string) => l.trim()).join('\n'))
        }

        const tile: TileData = {
          name: rawName,
          palette: colors.length ? colors : ['#888', '#aaa', '#ccc'],
          digits: frameStrings[0] ?? '',
          solid: false,
          category,
        }

        if (isAnimated && frameStrings.length > 1) {
          // Extract rate (first number after palette bracket)
          const rateMatch = argsStr.match(/\],\s*(\d+)/)
          tile.animRate = rateMatch ? parseInt(rateMatch[1]) : 12
          tile.frames = frameStrings
        }

        tiles.push(tile)
      }

      // Extract SOLID array (strip comments before parsing)
      const solidMatch = content.match(/export const SOLID:\s*boolean\[\]\s*=\s*\[([^\]]+)\]/)
      if (solidMatch) {
        const cleaned = solidMatch[1].replace(/\/\/[^\n]*/g, '')
        const solids = cleaned.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        solids.forEach((s: string, i: number) => { if (tiles[i]) tiles[i].solid = s === 'true' })
      }

      // Extract ABOVE array
      const aboveMatch = content.match(/export const ABOVE:\s*boolean\[\]\s*=\s*\[([^\]]+)\]/)
      if (aboveMatch) {
        const cleaned = aboveMatch[1].replace(/\/\/[^\n]*/g, '')
        const aboves = cleaned.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        aboves.forEach((s: string, i: number) => { if (tiles[i]) tiles[i].above = s === 'true' })
      }

      // Extract VEIL array
      const veilMatch = content.match(/export const VEIL:\s*boolean\[\]\s*=\s*\[([^\]]+)\]/)
      if (veilMatch) {
        const cleaned = veilMatch[1].replace(/\/\/[^\n]*/g, '')
        const veils = cleaned.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        veils.forEach((s: string, i: number) => { if (tiles[i]) tiles[i].veil = s === 'true' })
      }

      // Extract VEIL_DENSE array
      const veilDenseMatch = content.match(/export const VEIL_DENSE:\s*boolean\[\]\s*=\s*\[([^\]]+)\]/)
      if (veilDenseMatch) {
        const cleaned = veilDenseMatch[1].replace(/\/\/[^\n]*/g, '')
        const denses = cleaned.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        denses.forEach((s: string, i: number) => { if (tiles[i]) tiles[i].veilDense = s === 'true' })
      }

      result.tiles = tiles
    }

    if (type === 'all' || type === 'map') {
      const content = await readFile(TILEMAP_FILE, 'utf-8')

      // Extract GARDEN array
      const gardenMatch = content.match(/export const GARDEN:\s*number\[\]\[\]\s*=\s*\[([\s\S]*?)\]\s*\n/)
      if (gardenMatch) {
        const rows = gardenMatch[1].match(/\[([^\]]+)\]/g) ?? []
        const grid = rows.map((row: string) =>
          row.replace(/[\[\]]/g, '').split(',').map((n: string) => parseInt(n.trim())).filter((n: number) => !isNaN(n))
        )
        result.grid = grid
      }

      // Extract PLAYER_START
      const startMatch = content.match(/export const PLAYER_START\s*=\s*\{\s*tileX:\s*(\d+),\s*tileY:\s*(\d+)\s*\}/)
      if (startMatch) {
        result.playerStart = { tileX: parseInt(startMatch[1]), tileY: parseInt(startMatch[2]) }
      }
    }

    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST: save tiles and/or map to source files
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const saved: string[] = []

    // Save tiles
    if (body.tiles && Array.isArray(body.tiles)) {
      const tiles: TileData[] = body.tiles
      const hasAnimated = tiles.some(t => t.frames && t.frames.length > 1)

      // Detect if any tiles are 16x16 (legacy) vs 32x32 (native)
      const is32 = (digits: string) => digits.replace(/[^0-9a-fA-F]/g, '').length > 256
      const hasLegacy = tiles.some(t => !is32(t.digits))
      const hasNative = tiles.some(t => is32(t.digits))

      const lines: string[] = [
        '// Garden tile pixel art — 32x32 native or 16x16 upscaled',
        '// Digit 0 = transparent, hex digits 1-f index into palette (up to 15 colors)',
        '',
        "import { TileDef } from '../engine/renderer'",
        '',
      ]

      // Legacy 16x16 functions (only if needed)
      if (hasLegacy) {
        lines.push(
          '// Legacy: 2x nearest-neighbor upscale 16x16 → 32x32',
          'function upscale2x(src: Uint8Array): Uint8Array {',
          '  const dst = new Uint8Array(1024)',
          '  for (let y = 0; y < 16; y++)',
          '    for (let x = 0; x < 16; x++) {',
          '      const v = src[y * 16 + x]',
          '      dst[(y * 2) * 32 + (x * 2)] = v',
          '      dst[(y * 2) * 32 + (x * 2 + 1)] = v',
          '      dst[(y * 2 + 1) * 32 + (x * 2)] = v',
          '      dst[(y * 2 + 1) * 32 + (x * 2 + 1)] = v',
          '    }',
          '  return dst',
          '}',
          '',
          'function parse16(data: string): Uint8Array {',
          "  const digits = data.replace(/[^0-9a-fA-F]/g, '')",
          '  const pixels = new Uint8Array(256)',
          '  for (let i = 0; i < 256; i++) {',
          "    pixels[i] = parseInt(digits[i] || '1', 16)",
          '  }',
          '  return pixels',
          '}',
          '',
          '// Legacy 16x16 source → upscaled to 32x32',
          'function t(palette: string[], data: string): TileDef {',
          '  return { pixels: upscale2x(parse16(data)), palette }',
          '}',
          '',
        )
        if (hasAnimated) {
          lines.push(
            'function ta(palette: string[], rate: number, ...datas: string[]): TileDef {',
            '  const frames = datas.map(data => upscale2x(parse16(data)))',
            '  return { pixels: frames[0], palette, frames, animRate: rate }',
            '}',
            '',
          )
        }
      }

      // Native 32x32 functions (only if needed)
      if (hasNative) {
        lines.push(
          '// Native 32x32 tile parser',
          'function parse32(data: string): Uint8Array {',
          "  const digits = data.replace(/[^0-9a-fA-F]/g, '')",
          '  const pixels = new Uint8Array(1024)',
          '  for (let i = 0; i < 1024; i++) {',
          "    pixels[i] = parseInt(digits[i] || '0', 16)",
          '  }',
          '  return pixels',
          '}',
          '',
          'function t32(palette: string[], data: string): TileDef {',
          '  return { pixels: parse32(data), palette }',
          '}',
          '',
        )
        if (hasAnimated) {
          lines.push(
            'function ta32(palette: string[], rate: number, ...datas: string[]): TileDef {',
            '  const frames = datas.map(data => parse32(data))',
            '  return { pixels: frames[0], palette, frames, animRate: rate }',
            '}',
            '',
          )
        }
      }

      tiles.forEach((tile, i) => {
        const catTag = tile.category ? ` [${tile.category}]` : ''
        const solidNote = tile.solid ? ' (SOLID)' : ''
        const palStr = tile.palette.map((c: string) => `'${c}'`).join(', ')
        const native = is32(tile.digits)

        if (tile.frames && tile.frames.length > 1) {
          // Animated tile
          const animNote = ` (animated:${tile.animRate ?? 12})`
          const fn = native ? 'ta32' : 'ta'
          lines.push(`// ${i}: ${tile.name}${catTag}${solidNote}${animNote}`)
          const frameStrs = tile.frames.map((frameDigits: string) => {
            const digitLines = frameDigits.trim().split('\n').map((l: string) => `  ${l.trim()}`)
            return '`\n' + digitLines.join('\n') + '\n`'
          })
          lines.push(`const T${i} = ${fn}([${palStr}], ${tile.animRate ?? 12}, ${frameStrs.join(', ')})`)
        } else {
          // Single-frame tile
          const fn = native ? 't32' : 't'
          lines.push(`// ${i}: ${tile.name}${catTag}${solidNote}`)
          lines.push(`const T${i} = ${fn}([${palStr}], \``)
          const digitLines = tile.digits.trim().split('\n').map((l: string) => `  ${l.trim()}`)
          lines.push(...digitLines)
          lines.push('`)')
        }
        lines.push('')
      })

      lines.push(`export const TILES: TileDef[] = [${tiles.map((_, i) => `T${i}`).join(', ')}]`)
      lines.push('')
      lines.push('// Collision: true = solid, spirits can\'t walk here')
      lines.push(`export const SOLID: boolean[] = [${tiles.map(t => t.solid ? 'true' : 'false').join(', ')}]`)
      lines.push('')
      lines.push('// Above-player layer: true = renders on top of entities (walk-under effect)')
      lines.push(`export const ABOVE: boolean[] = [${tiles.map(t => t.above ? 'true' : 'false').join(', ')}]`)
      lines.push('')
      lines.push('// Veil tiles: true = Ather mist zone where wild encounters can roll')
      lines.push(`export const VEIL: boolean[] = [${tiles.map(t => t.veil ? 'true' : 'false').join(', ')}]`)
      lines.push('')
      lines.push('// Dense veil: true = higher encounter rate')
      lines.push(`export const VEIL_DENSE: boolean[] = [${tiles.map(t => t.veilDense ? 'true' : 'false').join(', ')}]`)
      lines.push('')

      await writeFile(TILES_FILE, lines.join('\n'), 'utf-8')
      saved.push('tiles')
    }

    // Save map grid
    if (body.grid && Array.isArray(body.grid)) {
      const grid: number[][] = body.grid
      const mapId: string = body.mapId ?? 'garden'

      if (mapId === 'garden') {
        // Replace GARDEN section, preserve zone maps below
        const cols = grid[0]?.length ?? 0
        const rows = grid.length
        const playerStart = body.playerStart ?? { tileX: 14, tileY: 8 }
        const existing = await readFile(TILEMAP_FILE, 'utf-8')

        const header = [
          `// Shimmer Domain — ${cols}x${rows} tiles (${cols * 32}x${rows * 32} world pixels)`,
          '//',
          '// Tile legend (see tiles.ts for definitions)',
          '',
          '/* eslint-disable no-multi-spaces */',
          'export const GARDEN: number[][] = [',
        ]

        const maxVal = Math.max(...grid.flat())
        const padWidth = maxVal > 99 ? (maxVal > 999 ? 4 : 3) : 2
        grid.forEach((row, y) => {
          const padded = row.map(n => n.toString().padStart(padWidth, ' ')).join(',')
          header.push(`  [${padded}],  // ${y}`)
        })

        header.push(']')
        header.push('/* eslint-enable no-multi-spaces */')
        header.push('')
        header.push('// Map dimensions')
        header.push('export const MAP_COLS = GARDEN[0].length')
        header.push('export const MAP_ROWS = GARDEN.length')
        header.push('')
        header.push(`export const PLAYER_START = { tileX: ${playerStart.tileX}, tileY: ${playerStart.tileY} }`)

        const playerStartMatch = existing.match(/export const PLAYER_START\s*=\s*\{[^}]+\}/)
        let restOfFile = ''
        if (playerStartMatch && playerStartMatch.index !== undefined) {
          const endIdx = playerStartMatch.index + playerStartMatch[0].length
          const afterIdx = existing.indexOf('\n', endIdx)
          if (afterIdx >= 0) {
            restOfFile = existing.substring(afterIdx)
          }
        }

        await writeFile(TILEMAP_FILE, header.join('\n') + restOfFile, 'utf-8')
        saved.push('map')
      } else {
        // Save a zone map — replace its constant in tilemap.ts
        const constName = zoneConstName(mapId)

        const existing = await readFile(TILEMAP_FILE, 'utf-8')
        const declStart = existing.indexOf(`export const ${constName}`)
        if (declStart === -1) {
          return NextResponse.json({ error: `${constName} not found in tilemap.ts` }, { status: 400 })
        }

        // Find end of declaration (next export const or end of file)
        const searchFrom = declStart + `export const ${constName}`.length
        const nextExport = existing.indexOf('\nexport const ', searchFrom)
        const declEnd = nextExport === -1 ? existing.length : nextExport + 1

        // Build replacement grid
        const maxVal = Math.max(0, ...grid.flat())
        const padWidth = maxVal > 99 ? (maxVal > 999 ? 4 : 3) : 2
        const gridLines = grid.map((row, y) => {
          const padded = row.map(n => n.toString().padStart(padWidth, ' ')).join(',')
          return `  [${padded}],  // ${y}`
        })
        const newDecl = `export const ${constName}: number[][] = [\n${gridLines.join('\n')}\n]\n`

        const newContent = existing.substring(0, declStart) + newDecl + existing.substring(declEnd)
        await writeFile(TILEMAP_FILE, newContent, 'utf-8')
        saved.push('map')
      }
    }

    // Save node placements for the current map
    if (body.nodes && Array.isArray(body.nodes)) {
      const mapId: string = body.mapId ?? 'garden'
      const nodes: Array<{ nodeType: string, x: number, y: number }> = body.nodes

      // Read existing file
      const existing = await readFile(NODES_FILE, 'utf-8')

      // Build the const name for this zone
      const constName = mapId.replace(/-/g, '_').toUpperCase() + '_NODES'

      // Build replacement block
      const nodeLines = nodes.map(n =>
        `  { type: '${n.nodeType}' as NodeType, tileX: ${n.x}, tileY: ${n.y} },`
      )
      const newBlock = `const ${constName}: NodePlacement[] = [\n${nodeLines.join('\n')}\n]`

      // Find and replace the existing const block
      const constStart = existing.indexOf(`const ${constName}`)
      if (constStart !== -1) {
        // Find end of array (closing bracket + newline)
        const arrayEnd = existing.indexOf('\n]', constStart)
        if (arrayEnd !== -1) {
          const endIdx = arrayEnd + 2 // include \n]
          const updated = existing.substring(0, constStart) + newBlock + existing.substring(endIdx)
          await writeFile(NODES_FILE, updated, 'utf-8')
          saved.push('nodes')
        }
      }
    }

    // Save structure placements for the current map
    if (body.structurePlacements && Array.isArray(body.structurePlacements)) {
      const mapId: string = body.mapId ?? 'garden'
      const placements: Array<{ structureId: string, x: number, y: number }> = body.structurePlacements

      const existing = await readFile(STRUCTURES_FILE, 'utf-8')
      const constName = mapId.replace(/-/g, '_').toUpperCase() + '_STRUCTURES'

      const lines = placements.map(p =>
        `  { structureId: '${p.structureId}', tileX: ${p.x}, tileY: ${p.y} },`
      )
      const newBlock = `const ${constName}: StructurePlacement[] = [\n${lines.join('\n')}\n]`

      const constStart = existing.indexOf(`const ${constName}`)
      if (constStart !== -1) {
        const arrayEnd = existing.indexOf('\n]', constStart)
        if (arrayEnd !== -1) {
          const endIdx = arrayEnd + 2
          const updated = existing.substring(0, constStart) + newBlock + existing.substring(endIdx)
          await writeFile(STRUCTURES_FILE, updated, 'utf-8')
          saved.push('structures')
        }
      }
    }

    // Save furniture placements for the current map
    if (body.furniture && Array.isArray(body.furniture)) {
      const mapId: string = body.mapId ?? 'garden'
      const placements: Array<{ furnitureId: string, x: number, y: number }> = body.furniture

      const existing = await readFile(FURNITURE_FILE, 'utf-8')
      const constName = mapId.replace(/-/g, '_').toUpperCase() + '_FURNITURE'

      const lines = placements.map(p =>
        `  { furnitureId: '${p.furnitureId}', tileX: ${p.x}, tileY: ${p.y} },`
      )
      const newBlock = `const ${constName}: FurniturePlacement[] = [\n${lines.join('\n')}\n]`

      const constStart = existing.indexOf(`const ${constName}`)
      if (constStart !== -1) {
        const arrayEnd = existing.indexOf('\n]', constStart)
        if (arrayEnd !== -1) {
          const endIdx = arrayEnd + 2
          const updated = existing.substring(0, constStart) + newBlock + existing.substring(endIdx)
          await writeFile(FURNITURE_FILE, updated, 'utf-8')
          saved.push('furniture')
        }
      }
    }

    // Save zone chest placements for the current map
    if (body.zoneChests && Array.isArray(body.zoneChests)) {
      const mapId: string = body.mapId ?? 'garden'
      const chests: Array<{ chestType: string, x: number, y: number, claimable?: boolean }> = body.zoneChests

      const existing = await readFile(ZONE_CHESTS_FILE, 'utf-8')
      const constName = mapId.replace(/-/g, '_').toUpperCase() + '_ZONE_CHESTS'

      const lines = chests.map(p => {
        const claimStr = p.claimable ? ', claimable: true' : ''
        return `  { id: zoneChestId('${mapId}', ${p.x}, ${p.y}), tileX: ${p.x}, tileY: ${p.y}, zoneId: '${mapId}', chestType: '${p.chestType}', loot: []${claimStr} },`
      })
      const newBlock = `const ${constName}: ZoneChestPlacement[] = [\n${lines.join('\n')}\n]`

      const constStart = existing.indexOf(`const ${constName}`)
      if (constStart !== -1) {
        const arrayEnd = existing.indexOf('\n]', constStart)
        if (arrayEnd !== -1) {
          const endIdx = arrayEnd + 2
          const updated = existing.substring(0, constStart) + newBlock + existing.substring(endIdx)
          await writeFile(ZONE_CHESTS_FILE, updated, 'utf-8')
          saved.push('zoneChests')
        }
      }
    }

    // Save static pickup placements for the current map
    if (body.pickups && Array.isArray(body.pickups)) {
      const mapId: string = body.mapId ?? 'garden'
      const pickups: Array<{ itemId: string, x: number, y: number }> = body.pickups

      const existing = await readFile(PICKUPS_FILE, 'utf-8')
      const constName = mapId.replace(/-/g, '_').toUpperCase() + '_PICKUPS'

      const lines = pickups.map(p =>
        `  { id: pickupId('${mapId}', ${p.x}, ${p.y}), itemId: '${p.itemId}', count: 1, tileX: ${p.x}, tileY: ${p.y}, zoneId: '${mapId}' },`
      )
      const newBlock = `const ${constName}: StaticPickup[] = [\n${lines.join('\n')}\n]`

      const constStart = existing.indexOf(`const ${constName}`)
      if (constStart !== -1) {
        const arrayEnd = existing.indexOf('\n]', constStart)
        if (arrayEnd !== -1) {
          const endIdx = arrayEnd + 2
          const updated = existing.substring(0, constStart) + newBlock + existing.substring(endIdx)
          await writeFile(PICKUPS_FILE, updated, 'utf-8')
          saved.push('pickups')
        }
      }
    }

    // Save warp placements to zones.ts
    if (body.warps && Array.isArray(body.warps)) {
      const mapId: string = body.mapId ?? 'garden'
      const warps: Array<{ fromX: number, fromY: number, toZone: string, toX: number, toY: number, direction?: string, requiredFlag?: string }> = body.warps

      const existing = await readFile(ZONES_FILE, 'utf-8')

      // Find the zone block by id
      const idPattern = `id: '${mapId}'`
      const idIdx = existing.indexOf(idPattern)
      if (idIdx !== -1) {
        // Find the warps array within this zone block
        const warpsStart = existing.indexOf('warps: [', idIdx)
        if (warpsStart !== -1) {
          // Find the closing ] for the warps array (handle nested brackets)
          const openBracket = existing.indexOf('[', warpsStart + 6)
          let depth = 1
          let pos = openBracket + 1
          while (pos < existing.length && depth > 0) {
            if (existing[pos] === '[') depth++
            else if (existing[pos] === ']') depth--
            pos++
          }
          const warpsEnd = pos // position after the closing ]

          // Build new warps array
          const warpLines = warps.map(w => {
            const parts = [`fromX: ${w.fromX}`, `fromY: ${w.fromY}`, `toZone: '${w.toZone}'`, `toX: ${w.toX}`, `toY: ${w.toY}`]
            if (w.direction) parts.push(`direction: '${w.direction}'`)
            if (w.requiredFlag) parts.push(`requiredFlag: '${w.requiredFlag}'`)
            return `      { ${parts.join(', ')} },`
          })

          const newWarps = warpLines.length > 0
            ? `warps: [\n${warpLines.join('\n')}\n    ]`
            : 'warps: []'

          const updated = existing.substring(0, warpsStart) + newWarps + existing.substring(warpsEnd)
          await writeFile(ZONES_FILE, updated, 'utf-8')
          saved.push('warps')
        }
      }
    }

    // ── Save Encounter Tables ──
    if (body.encounters && typeof body.encounters === 'object') {
      const encounterData: Record<string, { rate: number; entries: { species: string; weight: number; levelRange: [number, number]; element?: string }[]; aiTier: string }> = body.encounters

      // Generate ENCOUNTER_TABLES const block
      const zoneBlocks: string[] = []
      for (const [zoneId, zone] of Object.entries(encounterData)) {
        const entryLines = zone.entries.map(e => {
          const elStr = e.element && e.element !== 'base' ? `, element: '${e.element}'` : ''
          const sp = `'${e.species}'`
          return `      { species: ${sp.padEnd(14)}, weight: ${e.weight}, levelRange: [${e.levelRange[0]}, ${e.levelRange[1]}]${elStr} },`
        })
        const entriesStr = entryLines.length > 0
          ? `[\n${entryLines.join('\n')}\n    ]`
          : '[]'
        zoneBlocks.push(`  '${zoneId}': {\n    rate: ${zone.rate},\n    entries: ${entriesStr},\n    aiTier: '${zone.aiTier}',\n  },`)
      }

      const newTableBlock = `const ENCOUNTER_TABLES: Record<string, ZoneEncounters> = {\n${zoneBlocks.join('\n\n')}\n}`

      let content = await readFile(ENCOUNTERS_FILE, 'utf-8')
      // Replace the entire ENCOUNTER_TABLES block
      const tablePattern = /export const ENCOUNTER_TABLES[^=]*=\s*\{[\s\S]*?\n\}/
      if (tablePattern.test(content)) {
        content = content.replace(tablePattern, `export ${newTableBlock}`)
        await writeFile(ENCOUNTERS_FILE, content, 'utf-8')
        saved.push('encounters')
      } else {
        return NextResponse.json({ error: 'Could not find ENCOUNTER_TABLES in encounters.ts' }, { status: 500 })
      }
    }

    // ── Save Alchemy Recipes ──
    if (body.alchemy && typeof body.alchemy === 'object') {
      const potionData: Record<string, { id: string; name: string; tier: number; minAlchemyLevel: number; manaCost: number; xpGrant: number; resultCount: number; recipe: { itemId: string; count: number }[] }> = body.alchemy

      // Group by tier for comment headers
      const byTier: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] }
      const tierComments: Record<number, string> = { 1: 'Tier 1 — Beginner', 2: 'Tier 2 — Intermediate', 3: 'Tier 3 — Advanced', 4: 'Tier 4 — Master' }

      for (const [key, p] of Object.entries(potionData)) {
        const recipeStr = p.recipe.map(r => `{ itemId: '${r.itemId}', count: ${r.count} }`).join(', ')
        const line = `  ${key}: {\n    id: '${p.id}', name: '${p.name}', tier: ${p.tier},\n    minAlchemyLevel: ${p.minAlchemyLevel}, manaCost: ${p.manaCost}, xpGrant: ${p.xpGrant}, resultCount: ${p.resultCount},\n    recipe: [${recipeStr}],\n  },`
        const tier = p.tier as 1 | 2 | 3 | 4
        if (byTier[tier]) byTier[tier].push(line)
        else byTier[1].push(line)
      }

      const blocks: string[] = []
      for (const tier of [1, 2, 3, 4]) {
        if (byTier[tier].length > 0) {
          blocks.push(`  // ${tierComments[tier]}`)
          blocks.push(...byTier[tier])
          blocks.push('')
        }
      }

      const newBlock = `export const POTION_DEFS: Record<string, PotionDef> = {\n${blocks.join('\n').trimEnd()}\n}`

      let content = await readFile(ALCHEMY_FILE, 'utf-8')
      const potionPattern = /export const POTION_DEFS[^=]*=\s*\{[\s\S]*?\n\}/
      if (potionPattern.test(content)) {
        content = content.replace(potionPattern, newBlock)
        await writeFile(ALCHEMY_FILE, content, 'utf-8')
        saved.push('alchemy')
      } else {
        return NextResponse.json({ error: 'Could not find POTION_DEFS in alchemy.ts' }, { status: 500 })
      }
    }

    // ── Save Quest Definitions ──
    if (body.quests && typeof body.quests === 'object') {
      const questData: Record<string, { id: string; name: string; description: string; category: string; prerequisites: string[]; objectives: Record<string, unknown>[]; rewards: Record<string, unknown>[]; autoStart?: boolean }> = body.quests

      const questEntries = Object.values(questData)
      const mainQuests = questEntries.filter(q => q.category === 'main')
      const sideQuests = questEntries.filter(q => q.category === 'side')

      function serializeObj(o: Record<string, unknown>): string {
        return '{ ' + Object.entries(o)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`)
          .join(', ') + ' }'
      }

      function questBlock(q: typeof questEntries[0]): string {
        const lines = [
          `  ${q.id}: {`,
          `    id: '${q.id}', name: '${q.name.replace(/'/g, "\\'")}', category: '${q.category}',`,
          `    description: '${q.description.replace(/'/g, "\\'")}',`,
          `    prerequisites: [${q.prerequisites.map(p => `'${p}'`).join(', ')}],`,
          `    objectives: [${q.objectives.map(o => serializeObj(o as Record<string, unknown>)).join(', ')}],`,
          `    rewards: [${q.rewards.map(r => serializeObj(r as Record<string, unknown>)).join(', ')}],`,
        ]
        if (q.autoStart) lines.push(`    autoStart: true,`)
        lines.push(`  },`)
        return lines.join('\n')
      }

      const sections: string[] = []
      if (mainQuests.length) {
        sections.push('  // Main quests')
        sections.push(...mainQuests.map(questBlock))
      }
      if (sideQuests.length) {
        sections.push('')
        sections.push('  // Side quests')
        sections.push(...sideQuests.map(questBlock))
      }

      const newBlock = `export const QUEST_DEFS: Record<string, QuestDef> = {\n${sections.join('\n')}\n}`

      let content = await readFile(QUESTS_FILE, 'utf-8')
      const defsPattern = /export const QUEST_DEFS: Record<string, QuestDef> = \{[\s\S]*?\n\}/
      if (defsPattern.test(content)) {
        content = content.replace(defsPattern, newBlock)
        await writeFile(QUESTS_FILE, content, 'utf-8')
        saved.push('quests')
      } else {
        return NextResponse.json({ error: 'Could not find QUEST_DEFS in quests.ts' }, { status: 500 })
      }
    }

    // ── Save GE Base Price Overrides ──
    if (body.geOverrides && typeof body.geOverrides === 'object') {
      const overrides: Record<string, number> = body.geOverrides

      // Build sparse override map (only non-empty entries)
      const entries = Object.entries(overrides)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .sort(([a], [b]) => a.localeCompare(b))

      const mapContent = entries.length > 0
        ? `{\n${entries.map(([id, price]) => `  '${id}': ${price},`).join('\n')}\n}`
        : '{}'

      const newBlock = `export const GE_BASE_OVERRIDES: Record<string, number> = ${mapContent}`

      let content = await readFile(EXCHANGE_FILE, 'utf-8')
      const overridePattern = /export const GE_BASE_OVERRIDES[^=]*=\s*\{[^}]*\}/
      if (overridePattern.test(content)) {
        content = content.replace(overridePattern, newBlock)
        await writeFile(EXCHANGE_FILE, content, 'utf-8')
        saved.push('geOverrides')
      } else {
        return NextResponse.json({ error: 'Could not find GE_BASE_OVERRIDES in exchange.ts' }, { status: 500 })
      }
    }

    // ── Save Farming Crops ──
    if (body.farming && typeof body.farming === 'object') {
      const cropData: Record<string, { id: string; name: string; tier: number; minFarmingLevel: number; manaCost: number; plantXp: number; xpGrant: number; growthMs: number; seedItemId: string; yieldBonusPerLevel: number; yields: { itemId: string; count: number; chance: number }[] }> = body.farming

      const tierComments: Record<number, string> = { 1: 'Tier 1 — Beginner', 2: 'Tier 2 — Intermediate', 3: 'Tier 3 — Advanced', 4: 'Tier 4 — Master' }
      const byTier: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] }

      for (const [key, c] of Object.entries(cropData)) {
        const yieldsStr = c.yields.map(y =>
          `{ itemId: '${y.itemId}', count: ${y.count}, chance: ${y.chance} }`
        ).join(',\n      ')
        const yieldsBlock = c.yields.length > 1
          ? `[\n      ${yieldsStr},\n    ]`
          : `[${c.yields.map(y => `{ itemId: '${y.itemId}', count: ${y.count}, chance: ${y.chance} }`).join(', ')}]`

        const growthExpr = c.growthMs % 60000 === 0
          ? `${c.growthMs / 60000} * 60 * 1000`
          : `${c.growthMs}`

        const line = [
          `  ${key}: {`,
          `    id: '${c.id}', name: '${c.name}', tier: ${c.tier},`,
          `    minFarmingLevel: ${c.minFarmingLevel}, manaCost: ${c.manaCost}, plantXp: ${c.plantXp}, xpGrant: ${c.xpGrant}, growthMs: ${growthExpr},`,
          `    seedItemId: '${c.seedItemId}', yieldBonusPerLevel: ${c.yieldBonusPerLevel},`,
          `    yields: ${yieldsBlock},`,
          `  },`,
        ].join('\n')
        const tier = c.tier as 1 | 2 | 3 | 4
        if (byTier[tier]) byTier[tier].push(line)
        else byTier[1].push(line)
      }

      const blocks: string[] = []
      for (const tier of [1, 2, 3, 4]) {
        if (byTier[tier].length > 0) {
          blocks.push(`  // ${tierComments[tier]}`)
          blocks.push(...byTier[tier])
          blocks.push('')
        }
      }

      const newBlock = `export const CROP_DEFS: Record<string, CropDef> = {\n${blocks.join('\n').trimEnd()}\n}`

      let content = await readFile(FARMING_FILE, 'utf-8')
      const defsPattern = /export const CROP_DEFS: Record<string, CropDef> = \{[\s\S]*?\n\}/
      if (defsPattern.test(content)) {
        content = content.replace(defsPattern, newBlock)
        await writeFile(FARMING_FILE, content, 'utf-8')
        saved.push('farming')
      } else {
        return NextResponse.json({ error: 'Could not find CROP_DEFS in farming.ts' }, { status: 500 })
      }
    }

    // ── Save Evolution Config ──
    if (body.evolution && typeof body.evolution === 'object') {
      const evo = body.evolution as {
        thresholds: { secondFormLevel: number; awakenedFormLevel: number; maxLevel: number }
        infusionCaps: { totalCap: number; perElementCap: number }
        statCaps: { base: number; second: number; awakened: number }
        elementStatMods: Record<string, { stat: string; mod: number }[]>
        runewords: Record<string, Record<string, string>>
        awakenedBranches: Record<string, { name: string; focus: string; prereqSummary: string }>
        awakenedFormNames: Record<string, Record<string, Record<string, string | null>>>
      }

      const lines: string[] = [
        "// Evolution configuration — single source of truth for all evolution mechanics",
        "// Editable via Dev > Evolution editor",
        "//",
        "// Canon source: /root/athernyx/CANON/game/shimmer-master.md",
        "//               /root/athernyx/CANON/game/shimmer-awakened-master.md",
        "",
        "import type { Species, Element } from './spirit'",
        "",
        "// ── Global thresholds ──────────────────────────────────",
        "",
        "export const EVOLUTION_THRESHOLDS = {",
        `  secondFormLevel: ${evo.thresholds.secondFormLevel},       // level at which base → second form triggers`,
        `  awakenedFormLevel: ${evo.thresholds.awakenedFormLevel},     // level at which second → awakened triggers`,
        `  maxLevel: ${evo.thresholds.maxLevel},`,
        "} as const",
        "",
        "export const INFUSION_CAPS = {",
        `  totalCap: ${evo.infusionCaps.totalCap},              // max infusion points across all elements`,
        `  perElementCap: ${evo.infusionCaps.perElementCap},          // max infusion points in any single element`,
        "} as const",
        "",
        "// Stat ceilings per form stage (stats cannot exceed these)",
        "export const STAT_CAPS = {",
        `  base: ${evo.statCaps.base},`,
        `  second: ${evo.statCaps.second},`,
        `  awakened: ${evo.statCaps.awakened},`,
        "} as const",
        "",
        "// ── Element stat modifiers ─────────────────────────────",
        "// Applied when spirit evolves to second form with that element",
        "",
        "export type StatMod = { stat: string; mod: number }",
        "",
        "export const ELEMENT_STAT_MODS: Record<Exclude<Element, 'base'>, StatMod[]> = {",
      ]

      for (const el of ['mana', 'storm', 'earth', 'water']) {
        const mods = evo.elementStatMods[el] ?? []
        const modStr = mods.map(m => `{ stat: '${m.stat}', mod: ${m.mod} }`).join(', ')
        lines.push(`  ${el}: [${modStr}],`)
      }
      lines.push("}")
      lines.push("")

      // Runewords
      lines.push("// ── Runewords per element ──────────────────────────────")
      lines.push("// Each second form has an associated runeword (used in alchemy + lore)")
      lines.push("")
      lines.push("export const RUNEWORDS: Record<Species, Record<Exclude<Element, 'base'>, string>> = {")

      const speciesOrder = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
      const elements = ['mana', 'storm', 'earth', 'water']

      for (const sp of speciesOrder) {
        const rw = evo.runewords[sp] ?? {}
        const key = sp.includes('-') ? `'${sp}'` : `${sp}`
        const rwEntries = elements.map(el => `${el}: '${rw[el] ?? ''}'`).join(', ')
        const pad = key.length < 13 ? ' '.repeat(13 - key.length) : ' '
        lines.push(`  ${key}:${pad}{ ${rwEntries} },`)
      }
      lines.push("}")
      lines.push("")

      // Awakened branches
      lines.push("// ── Awakened branches ──────────────────────────────────")
      lines.push("// 4 branches per second form, each requiring different mastery")
      lines.push("")
      lines.push("export type AwakenedBranch = 'alpha' | 'beta' | 'gamma' | 'delta'")
      lines.push("")
      lines.push("export interface BranchDef {")
      lines.push("  name: string            // branch display name")
      lines.push("  focus: string           // what mastery it represents")
      lines.push("  prereqSummary: string   // short description of requirements")
      lines.push("}")
      lines.push("")
      lines.push("export const AWAKENED_BRANCHES: Record<AwakenedBranch, BranchDef> = {")
      for (const branch of ['alpha', 'beta', 'gamma', 'delta']) {
        const b = evo.awakenedBranches[branch] ?? { name: '', focus: '', prereqSummary: '' }
        lines.push(`  ${branch}: { name: '${b.name}', focus: '${b.focus}',${' '.repeat(Math.max(1, 14 - b.focus.length))}prereqSummary: '${b.prereqSummary.replace(/'/g, "\\'")}' },`)
      }
      lines.push("}")
      lines.push("")

      // Awakened form names
      lines.push("// ── Awakened form names ────────────────────────────────")
      lines.push("// 160 total: 10 species × 4 elements × 4 branches")
      lines.push("// Fill in as Alex designs them; null = not yet named")
      lines.push("")
      lines.push("export type AwakenedNames = Record<AwakenedBranch, string | null>")
      lines.push("")
      lines.push("export const AWAKENED_FORM_NAMES: Record<Species, Record<Exclude<Element, 'base'>, AwakenedNames>> = {")

      const branches = ['alpha', 'beta', 'gamma', 'delta']
      for (const sp of speciesOrder) {
        const key = sp.includes('-') ? `'${sp}'` : sp
        lines.push(`  ${key}: {`)
        for (const el of elements) {
          const names = evo.awakenedFormNames[sp]?.[el] ?? {}
          const nameEntries = branches.map(b => {
            const v = names[b]
            return `${b}: ${v ? `'${v}'` : 'null'}`
          }).join(', ')
          lines.push(`    ${el}:  { ${nameEntries} },`)
        }
        lines.push("  },")
      }
      lines.push("}")
      lines.push("")

      await writeFile(EVOLUTION_FILE, lines.join('\n'), 'utf-8')
      saved.push('evolution')
    }

    // ── Save Resource Nodes ──
    if (body.resources && typeof body.resources === 'object') {
      const nodeData: Record<string, { type: string; skill: string; minLevel: number; respawnMs: number; xp: number; manaCost: number; maxHarvests?: number; drops: { itemId: string; chance: number }[] }> = body.resources

      const skillOrder = ['forestry', 'prospecting', 'rinning']
      const skillComments: Record<string, string> = {
        forestry: 'Forestry — trees (respawn tuned for casual 20-30 min sessions)',
        prospecting: 'Prospecting — crystals',
        rinning: 'Rinning — fishing spots (maxHarvests = catches before depletion)',
      }

      // Rebuild NODE_SKILL
      const nodeSkillLines: string[] = []
      for (const skill of skillOrder) {
        const nodes = Object.entries(nodeData).filter(([, n]) => n.skill === skill)
        if (nodes.length > 0) {
          nodeSkillLines.push('  ' + nodes.map(([key]) => `${key}: '${skill}'`).join(', ') + ',')
        }
      }
      const nodeSkillBlock = `const NODE_SKILL: Record<NodeType, SkillId> = {\n${nodeSkillLines.join('\n')}\n}`

      // Rebuild NODE_DEFS
      const blocks: string[] = []
      for (const skill of skillOrder) {
        const nodes = Object.entries(nodeData).filter(([, n]) => n.skill === skill)
        if (nodes.length === 0) continue
        blocks.push(`  // ${skillComments[skill]}`)
        for (const [key, n] of nodes) {
          const respawnExpr = n.respawnMs % 60000 === 0
            ? `${n.respawnMs / 60000} * 60_000`
            : String(n.respawnMs)
          const dropsStr = n.drops.map(d => `{ itemId: '${d.itemId}', chance: ${d.chance} }`).join(', ')
          const maxH = n.maxHarvests && n.maxHarvests > 1 ? `, maxHarvests: ${n.maxHarvests}` : ''
          blocks.push(`  ${key}: { type: '${key}' as NodeType, skill: '${n.skill}' as SkillId, minLevel: ${n.minLevel}, respawnMs: ${respawnExpr}, xp: ${n.xp}, manaCost: ${n.manaCost}${maxH}, drops: [${dropsStr}] },`)
        }
        blocks.push('')
      }
      const newDefsBlock = `export const NODE_DEFS: Record<NodeType, NodeDef> = {\n${blocks.join('\n').trimEnd()}\n}`

      let content = await readFile(RESOURCES_FILE, 'utf-8')

      // Replace NODE_SKILL
      const skillPattern = /const NODE_SKILL: Record<NodeType, SkillId> = \{[\s\S]*?\n\}/
      if (skillPattern.test(content)) {
        content = content.replace(skillPattern, nodeSkillBlock)
      }

      // Replace NODE_DEFS
      const defsPattern = /export const NODE_DEFS: Record<NodeType, NodeDef> = \{[\s\S]*?\n\}/
      if (defsPattern.test(content)) {
        content = content.replace(defsPattern, newDefsBlock)
        await writeFile(RESOURCES_FILE, content, 'utf-8')
        saved.push('resources')
      } else {
        return NextResponse.json({ error: 'Could not find NODE_DEFS in resources.ts' }, { status: 500 })
      }
    }

    // ── Save Tool Definitions ──
    if (body.tools && typeof body.tools === 'object') {
      const toolData: Record<string, { id: string; name: string; skillId: string; tier: number; durability: number; xpBonus: number; speedBonus: number; recipe: { itemId: string; count: number }[] }> = body.tools

      const skillOrder = ['forestry', 'prospecting', 'rinning']
      const skillToolComments: Record<string, string> = {
        forestry: 'Forestry — Blades',
        prospecting: 'Prospecting — Spikes',
        rinning: 'Rinning — Rinsticks',
      }

      const blocks: string[] = []
      for (const skill of skillOrder) {
        const tools = Object.entries(toolData).filter(([, t]) => t.skillId === skill)
        if (tools.length === 0) continue
        blocks.push(`  // ${skillToolComments[skill]}`)
        for (const [key, t] of tools) {
          const recipeStr = t.recipe.map(r => `{ itemId: '${r.itemId}', count: ${r.count} }`).join(', ')
          blocks.push(`  ${key}: {`)
          blocks.push(`    id: '${t.id}', name: '${t.name}', skillId: '${t.skillId}' as SkillId, tier: ${t.tier} as 1 | 2 | 3,`)
          blocks.push(`    durability: ${t.durability}, xpBonus: ${t.xpBonus}, speedBonus: ${t.speedBonus},`)
          blocks.push(`    recipe: [${recipeStr}],`)
          blocks.push(`  },`)
        }
        blocks.push('')
      }

      const newBlock = `export const TOOL_DEFS: Record<string, ToolDef> = {\n${blocks.join('\n').trimEnd()}\n}`

      let content = await readFile(TOOLS_FILE, 'utf-8')
      const defsPattern = /export const TOOL_DEFS: Record<string, ToolDef> = \{[\s\S]*?\n\}/
      if (defsPattern.test(content)) {
        content = content.replace(defsPattern, newBlock)
        await writeFile(TOOLS_FILE, content, 'utf-8')
        saved.push('tools')
      } else {
        return NextResponse.json({ error: 'Could not find TOOL_DEFS in tools.ts' }, { status: 500 })
      }
    }

    // ── Save Skills Config ──
    if (body.skills && typeof body.skills === 'object') {
      const { meta, channelTicks, milestones } = body.skills as {
        meta?: Record<string, { name: string; manaCost: number; locked?: string }>
        channelTicks?: Record<string, number>
        milestones?: { level: number; label: string }[]
      }

      // Save SKILL_META + SKILL_MILESTONES to skills.ts
      if (meta) {
        const metaEntries = Object.entries(meta).map(([id, m]) => {
          const locked = m.locked ? `, locked: '${m.locked}'` : ''
          const pad = ' '.repeat(Math.max(1, 12 - id.length))
          return `  ${id}:${pad}{ name: '${m.name}',${' '.repeat(Math.max(1, 14 - m.name.length))}manaCost: ${m.manaCost}${locked} },`
        })
        const newMeta = `export const SKILL_META: Record<SkillId, { name: string; manaCost: number; locked?: string }> = {\n${metaEntries.join('\n')}\n}`

        let content = await readFile(SKILLS_FILE, 'utf-8')
        const metaPattern = /export const SKILL_META[^=]*=\s*\{[\s\S]*?\n\}/
        if (metaPattern.test(content)) {
          content = content.replace(metaPattern, newMeta)
        }

        if (milestones && Array.isArray(milestones)) {
          const sorted = [...milestones].sort((a, b) => a.level - b.level)
          const milestoneEntries = sorted.map(m => `  { level: ${m.level}, label: '${m.label}' },`)
          const newMilestones = `export const SKILL_MILESTONES: { level: number; label: string }[] = [\n${milestoneEntries.join('\n')}\n]`
          const milestonePattern = /export const SKILL_MILESTONES[^=]*=\s*\[[\s\S]*?\n\]/
          if (milestonePattern.test(content)) {
            content = content.replace(milestonePattern, newMilestones)
          }
        }

        await writeFile(SKILLS_FILE, content, 'utf-8')
        saved.push('skills')
      }

      // Save BASE_CHANNEL_TICKS to harvesting.ts
      if (channelTicks) {
        const tickEntries = Object.entries(channelTicks).map(([id, ticks]) => {
          const seconds = (Number(ticks) / 15).toFixed(1)
          const pad = ' '.repeat(Math.max(1, 12 - id.length))
          const valPad = ' '.repeat(Math.max(1, 6 - String(ticks).length))
          return `  ${id}:${pad}${ticks},${valPad}// ${seconds}s`
        })
        const newTicks = `export const BASE_CHANNEL_TICKS: Record<SkillId, number> = {\n${tickEntries.join('\n')}\n}`

        let content = await readFile(HARVESTING_FILE, 'utf-8')
        const ticksPattern = /(export )?const BASE_CHANNEL_TICKS: Record<SkillId, number> = \{[\s\S]*?\n\}/
        if (ticksPattern.test(content)) {
          content = content.replace(ticksPattern, newTicks)
          await writeFile(HARVESTING_FILE, content, 'utf-8')
          saved.push('channelTicks')
        }
      }
    }

    // ── Moves (battle moves, state groups, species signatures) ──
    if (body.moves && typeof body.moves === 'object') {
      const { universal, groups, signatures } = body.moves as {
        universal: { constName: string; move: { id: string; name: string; element: string; state: string; power: number; accuracy: number; pp: number; priority: number; description: string; effect?: string; effectChance?: number; selfEffect?: string; selfEffectChance?: number; statChanges?: { target: string; stat: string; stages: number }[] } }[]
        groups: Record<string, Record<string, { id: string; name: string; element: string; state: string; power: number; accuracy: number; pp: number; priority: number; description: string; effect?: string; effectChance?: number; selfEffect?: string; selfEffectChance?: number; statChanges?: { target: string; stat: string; stages: number }[] }>>
        signatures: Record<string, Record<string, { id: string; name: string; element: string; state: string; power: number; accuracy: number; pp: number; priority: number; description: string; effect?: string; effectChance?: number; selfEffect?: string; selfEffectChance?: number; statChanges?: { target: string; stat: string; stages: number }[] }>>
      }

      function escStr(s: string): string { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") }

      function moveToM(mv: typeof universal[0]['move']): string {
        const extras: string[] = []
        if (mv.effect) extras.push(`effect: '${mv.effect}'`)
        if (mv.effect && mv.effectChance != null) extras.push(`effectChance: ${mv.effectChance}`)
        if (mv.selfEffect) extras.push(`selfEffect: '${mv.selfEffect}'`)
        if (mv.selfEffect && mv.selfEffectChance != null) extras.push(`selfEffectChance: ${mv.selfEffectChance}`)
        if (mv.statChanges?.length) {
          const scStr = mv.statChanges.map(sc => `{ target: '${sc.target}', stat: '${sc.stat}', stages: ${sc.stages} }`).join(', ')
          extras.push(`statChanges: [${scStr}]`)
        }
        const base = `m('${mv.id}', '${escStr(mv.name)}', '${mv.element}', '${mv.state}', ${mv.power}, ${mv.accuracy}, ${mv.pp}, ${mv.priority}, '${escStr(mv.description)}'`
        return extras.length > 0 ? `${base}, { ${extras.join(', ')} })` : `${base})`
      }

      let content = await readFile(MOVES_FILE, 'utf-8')

      // 1. Replace universal moves (single-line each)
      for (const u of universal) {
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith(`export const ${u.constName} = m(`)) {
            lines[i] = `export const ${u.constName} = ${moveToM(u.move)}`
            break
          }
        }
        content = lines.join('\n')
      }

      // 2. Replace state groups (MOVES_SOLID etc.)
      const groupConstNames: Record<string, string> = {
        solid: 'MOVES_SOLID', compact: 'MOVES_COMPACT', expanding: 'MOVES_EXPANDING',
        ignite: 'MOVES_IGNITE', flow: 'MOVES_FLOW', scatter: 'MOVES_SCATTER', bind: 'MOVES_BIND',
      }
      for (const [groupId, groupData] of Object.entries(groups)) {
        const constName = groupConstNames[groupId]
        if (!constName) continue
        const keys = Object.keys(groupData)
        const maxKeyLen = Math.max(...keys.map(k => k.length))
        const entries = keys.map(key => {
          const pad = ' '.repeat(maxKeyLen - key.length + 1)
          return `  ${key}:${pad}${moveToM(groupData[key])},`
        })
        const newBlock = `export const ${constName} = {\n${entries.join('\n')}\n} as const`
        const pattern = new RegExp(`export const ${constName} = \\{[\\s\\S]*?\\} as const`)
        content = content.replace(pattern, newBlock)
      }

      // 3. Replace SPECIES_SIGNATURES (brace-counted due to nesting)
      const sigStart = content.indexOf('export const SPECIES_SIGNATURES')
      if (sigStart >= 0) {
        const braceStart = content.indexOf('{', sigStart)
        let depth = 0
        let sigEnd = braceStart
        for (let i = braceStart; i < content.length; i++) {
          if (content[i] === '{') depth++
          else if (content[i] === '}') { depth--; if (depth === 0) { sigEnd = i + 1; break } }
        }
        const sigLines: string[] = []
        sigLines.push('export const SPECIES_SIGNATURES: Record<Species, ElementSigs> = {')
        const speciesKeys = Object.keys(signatures)
        for (let si = 0; si < speciesKeys.length; si++) {
          const sp = speciesKeys[si]
          const elMoves = signatures[sp]
          const els = Object.keys(elMoves)
          const maxElLen = Math.max(...els.map(k => k.length), 0)
          sigLines.push(`  // ${sp.charAt(0).toUpperCase() + sp.slice(1).replace('-', ' ')}`)
          sigLines.push(`  '${sp.includes('-') ? sp : `${sp}`}': {`)
          // Use unquoted key for simple names, quoted for hyphenated
          sigLines.pop()
          if (sp.includes('-')) {
            sigLines.push(`  '${sp}': {`)
          } else {
            sigLines.push(`  ${sp}: {`)
          }
          for (const el of els) {
            const pad = ' '.repeat(maxElLen - el.length + 1)
            sigLines.push(`    ${el}:${pad}${moveToM(elMoves[el])},`)
          }
          sigLines.push(`  },`)
          if (si < speciesKeys.length - 1) sigLines.push('')
        }
        sigLines.push('}')
        content = content.slice(0, sigStart) + sigLines.join('\n') + content.slice(sigEnd)
      }

      await writeFile(MOVES_FILE, content, 'utf-8')
      saved.push('moves')
    }

    // ── Voice Profiles ──
    if (body.voiceProfiles && typeof body.voiceProfiles === 'object') {
      const profiles = body.voiceProfiles as Record<string, { id: string; name: string; pitch: number; pitchVariance: number; speed: number; syllableSet: string; tone: string; volume: number; reverb?: number }>

      let content = await readFile(VOICE_FILE, 'utf-8')

      const profileLines: string[] = []
      profileLines.push('// ── NPC Voice Profiles ──')
      profileLines.push('')

      const registryEntries: string[] = []
      for (const [key, p] of Object.entries(profiles)) {
        const constName = key.toUpperCase()
        profileLines.push(`const ${constName}: VoiceProfile = {`)
        profileLines.push(`  id: '${p.id}',`)
        profileLines.push(`  name: '${p.name.replace(/'/g, "\\'")}',`)
        profileLines.push(`  pitch: ${p.pitch},`)
        profileLines.push(`  pitchVariance: ${p.pitchVariance},`)
        profileLines.push(`  speed: ${p.speed},`)
        profileLines.push(`  syllableSet: '${p.syllableSet}',`)
        profileLines.push(`  tone: '${p.tone}',`)
        profileLines.push(`  volume: ${p.volume},`)
        if (p.reverb != null && p.reverb > 0) {
          profileLines.push(`  reverb: ${p.reverb},`)
        }
        profileLines.push('}')
        profileLines.push('')
        registryEntries.push(`  ${key}: ${constName},`)
      }

      profileLines.push('// ── Registry ──')
      profileLines.push('')
      profileLines.push('export const VOICE_PROFILES: Record<string, VoiceProfile> = {')
      profileLines.push(...registryEntries)
      profileLines.push('}')

      const startMarker = '// ── NPC Voice Profiles ──'
      const startIdx = content.indexOf(startMarker)
      const regIdx = content.indexOf('export const VOICE_PROFILES')
      if (startIdx >= 0 && regIdx >= 0) {
        const braceStart = content.indexOf('{', regIdx)
        let depth = 0, endIdx = braceStart
        for (let i = braceStart; i < content.length; i++) {
          if (content[i] === '{') depth++
          else if (content[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break } }
        }
        content = content.slice(0, startIdx) + profileLines.join('\n') + content.slice(endIdx)
      }

      await writeFile(VOICE_FILE, content, 'utf-8')
      saved.push('voiceProfiles')
    }

    // ── NPCs (metadata only — sprites preserved) ──
    if (body.npcs && Array.isArray(body.npcs)) {
      const npcData = body.npcs as { id: string; name: string; zone: string; tileX: number; tileY: number; direction: string; dialogueId: string; palette: string[]; returnDialogueId?: string; dialogueChain?: { dialogueId: string; requiresFlag?: string }[]; blocking?: boolean; hideWhenFlag?: string; patrolPath?: { tileX: number; tileY: number }[]; trainer?: { species: string; name: string; levelOffset: number; element: string; aiTier: string } }[]

      // Map NPC ids to their sprite const references
      const spriteRef: Record<string, string> = {
        wisp: 'WISP_SPRITE', spore: 'SPORE_SPRITE', 'sleeping-spirit': 'SLEEPING_SPIRIT_SPRITE',
        gregory: 'GREGORY_SPRITE', bramble: 'BRAMBLE_SPRITE', ember: 'EMBER_SPRITE',
        luna_npc: 'LUNA_NPC_SPRITE', rootweaver: 'ROOTWEAVER_SPRITE', echo: 'ECHO_SPRITE',
        dusk: 'DUSK_SPRITE', moss: 'MOSS_SPRITE', glint: 'GLINT_SPRITE',
      }
      const paletteRef: Record<string, string> = { gregory: 'GREGORY_PALETTE' }

      function escNpc(s: string): string { return s.replace(/'/g, "\\'") }

      const entries: string[] = []
      for (const n of npcData) {
        const lines: string[] = []
        lines.push(`  {`)
        lines.push(`    id: '${n.id}',`)
        lines.push(`    name: '${escNpc(n.name)}',`)
        lines.push(`    zone: '${n.zone}',`)
        lines.push(`    tileX: ${n.tileX}, tileY: ${n.tileY},`)
        lines.push(`    direction: '${n.direction}',`)
        lines.push(`    dialogueId: '${n.dialogueId}',`)
        if (n.returnDialogueId) lines.push(`    returnDialogueId: '${n.returnDialogueId}',`)
        if (n.dialogueChain && n.dialogueChain.length > 0) {
          lines.push(`    dialogueChain: [`)
          for (const step of n.dialogueChain) {
            if (step.requiresFlag) {
              lines.push(`      { dialogueId: '${step.dialogueId}', requiresFlag: '${step.requiresFlag}' },`)
            } else {
              lines.push(`      { dialogueId: '${step.dialogueId}' },`)
            }
          }
          lines.push(`    ],`)
        }
        lines.push(`    sprite: ${spriteRef[n.id] ?? `${n.id.toUpperCase().replace(/-/g, '_')}_SPRITE`},`)
        if (paletteRef[n.id]) {
          lines.push(`    palette: ${paletteRef[n.id]},`)
        } else {
          lines.push(`    palette: [${n.palette.map(c => `'${c}'`).join(', ')}],`)
        }
        if (n.blocking) lines.push(`    blocking: true,`)
        if (n.hideWhenFlag) lines.push(`    hideWhenFlag: '${n.hideWhenFlag}',`)
        if (n.patrolPath && n.patrolPath.length > 0) {
          lines.push(`    patrolPath: [`)
          for (const p of n.patrolPath) {
            lines.push(`      { tileX: ${p.tileX}, tileY: ${p.tileY} },`)
          }
          lines.push(`    ],`)
        }
        if (n.trainer) {
          lines.push(`    trainer: {`)
          lines.push(`      species: '${n.trainer.species}',`)
          lines.push(`      name: "${escNpc(n.trainer.name)}",`)
          lines.push(`      levelOffset: ${n.trainer.levelOffset},`)
          lines.push(`      element: '${n.trainer.element}',`)
          lines.push(`      aiTier: '${n.trainer.aiTier}',`)
          lines.push(`    },`)
        }
        lines.push(`  },`)
        entries.push(lines.join('\n'))
      }

      const newBlock = `export const NPCS: NPCDef[] = [\n${entries.join('\n')}\n]`

      let content = await readFile(NPCS_FILE, 'utf-8')
      const pattern = /export const NPCS: NPCDef\[\] = \[[\s\S]*?\n\]/
      if (pattern.test(content)) {
        content = content.replace(pattern, newBlock)
        await writeFile(NPCS_FILE, content, 'utf-8')
        saved.push('npcs')
      }
    }

    // ── Day/Night Cycle ──
    if (body.dayCycle) {
      const dc = body.dayCycle as {
        cycleMins: number
        phases: { id: string; start: number; color: string; alpha: number }[]
        midnight: number
        respawnTriggers: { id: string; threshold: number }[]
      }

      let content = await readFile(DAY_CYCLE_FILE, 'utf-8')

      // Update CYCLE_MS
      content = content.replace(
        /const CYCLE_MS = .+/,
        `const CYCLE_MS = ${dc.cycleMins} * 60 * 1000`
      )

      // Update phase boundaries
      const phaseMap: Record<string, string> = {}
      for (const p of dc.phases) {
        const constName = p.id === 'dawn' ? 'DAWN_START' : p.id === 'day' ? 'DAY_START' : p.id === 'dusk' ? 'DUSK_START' : 'NIGHT_START'
        const frac = p.start
        const mins = frac * dc.cycleMins
        phaseMap[constName] = `const ${constName}${' '.repeat(Math.max(1, 14 - constName.length - 6))}= ${frac === 0 ? '0' : `${mins.toFixed(1).replace(/\.0$/, '')} / ${dc.cycleMins}`}${' '.repeat(10)}// ${mins.toFixed(0)}:00`
      }
      content = content.replace(/const DAWN_START\s*=.+/, phaseMap['DAWN_START'] || 'const DAWN_START  = 0')
      content = content.replace(/const DAY_START\s*=.+/, phaseMap['DAY_START'] || 'const DAY_START   = 3 / 30')
      content = content.replace(/const DUSK_START\s*=.+/, phaseMap['DUSK_START'] || 'const DUSK_START  = 23 / 30')
      content = content.replace(/const NIGHT_START\s*=.+/, phaseMap['NIGHT_START'] || 'const NIGHT_START = 26 / 30')

      // Update MIDNIGHT
      const midMins = dc.midnight * dc.cycleMins
      content = content.replace(
        /const MIDNIGHT\s*=.+/,
        `const MIDNIGHT    = ${midMins.toFixed(1).replace(/\.0$/, '')} / ${dc.cycleMins}${' '.repeat(10)}// ${midMins.toFixed(0)}:00`
      )

      // Update respawn triggers
      const triggerLines = dc.respawnTriggers.map(t => {
        const constRef = t.threshold === 0 ? 'DAWN_START' :
          dc.phases.find(p => Math.abs(p.start - t.threshold) < 0.001)?.id === 'dusk' ? 'DUSK_START' :
          Math.abs(t.threshold - dc.midnight) < 0.001 ? 'MIDNIGHT' :
          `${t.threshold.toFixed(4)}`
        return `  ${t.id}:${' '.repeat(Math.max(1, 13 - t.id.length))}${constRef},`
      })
      content = content.replace(
        /export const RESPAWN_TRIGGERS = \{[\s\S]*?\} as const/,
        `export const RESPAWN_TRIGGERS = {\n${triggerLines.join('\n')}\n} as const`
      )

      // Update ambient overlay colors
      for (const phase of dc.phases) {
        switch (phase.id) {
          case 'dawn':
            content = content.replace(
              /case 'dawn':[\s\S]*?return \{ color: '[^']+', alpha: [^}]+ \}/,
              `case 'dawn':\n      // Warm orange fading out as sun rises\n      return { color: '${phase.color}', alpha: ${phase.alpha} * (1 - pp) }`
            )
            break
          case 'day':
            content = content.replace(
              /case 'day':[\s\S]*?return \{ color: '[^']+', alpha: \d+ \}/,
              `case 'day':\n      // No tint\n      return { color: '${phase.color}', alpha: ${phase.alpha} }`
            )
            break
          case 'dusk':
            content = content.replace(
              /case 'dusk':[\s\S]*?return \{ color: '[^']+', alpha: [^}]+ \}/,
              `case 'dusk':\n      // Purple/orange creeping in\n      return { color: '${phase.color}', alpha: ${phase.alpha} * pp }`
            )
            break
          case 'night':
            content = content.replace(
              /case 'night':[\s\S]*?return \{ color: '[^']+', alpha: [^}]+ \}/,
              `case 'night':\n      // Deep blue, strongest at midnight\n      const nightIntensity = pp < 0.5 ? pp * 2 : 2 - pp * 2\n      return { color: '${phase.color}', alpha: ${phase.alpha} + 0.1 * nightIntensity }`
            )
            break
        }
      }

      await writeFile(DAY_CYCLE_FILE, content, 'utf-8')
      saved.push('dayCycle')
    }

    // ── Mana System ──
    if (body.mana) {
      const mc = body.mana as {
        table: { pool: number; regen: number }[]
        postCurve: { poolBase: number; poolScale: number; poolDecay: number; regenBase: number; regenScale: number; regenDecay: number }
        extraction: { level: number; multiplier: number }[]
        perks: { id: string; level: number }[]
      }

      let content = await readFile(MANA_FILE, 'utf-8')

      // Rebuild MANA_TABLE
      const tableLines = mc.table.map((t, i) =>
        `  /* ${i === 0 ? '0 (unused) */ { pool: ' + t.pool + ', regen: ' + t.regen + ' },' : (i + '') + ' */  { pool: ' + t.pool + ', regen: ' + t.regen + ' },'}`
      )
      // Fix: level 0 mirrors level 1, then levels 1-10
      const entries = [
        `  /* 0 (unused) */ { pool: ${mc.table[0].pool}, regen: ${mc.table[0].regen} },`,
        ...mc.table.map((t, i) => `  /* ${i + 1} */  { pool: ${t.pool}, regen: ${t.regen} },`),
      ]
      content = content.replace(
        /const MANA_TABLE:[\s\S]*?\]/,
        `const MANA_TABLE: { pool: number; regen: number }[] = [\n${entries.join('\n')}\n]`
      )

      // Update post-10 pool formula
      content = content.replace(
        /return Math\.floor\(\d+[\s\S]*?\).*\/\/ Post-10/,
        `// Post-10`
      )
      content = content.replace(
        /\/\/ Post-10: diminishing returns.*\n\s*\/\/ [\d.]+.*\n\s*return Math\.floor\([^)]+\)/,
        `// Post-10: diminishing returns, approaching ~${Math.floor(mc.postCurve.poolBase + mc.postCurve.poolScale)} at 99\n  // ${mc.postCurve.poolBase} + ${mc.postCurve.poolScale} * (1 - e^(-(level-10)/${mc.postCurve.poolDecay}))\n  return Math.floor(${mc.postCurve.poolBase} + ${mc.postCurve.poolScale} * (1 - Math.exp(-(manaLevel - 10) / ${mc.postCurve.poolDecay})))`
      )

      // Update post-10 regen formula
      content = content.replace(
        /\/\/ Post-10: diminishing returns, approaching ~[\d.]+\s+at 99\.\n\s*\/\/ [\d.]+.*\n\s*return \+\([^)]+\)\.toFixed\(2\)/,
        `// Post-10: diminishing returns, approaching ~${(mc.postCurve.regenBase + mc.postCurve.regenScale).toFixed(1)} at 99\n  // ${mc.postCurve.regenBase} + ${mc.postCurve.regenScale} * (1 - e^(-(level-10)/${mc.postCurve.regenDecay}))\n  return +(${mc.postCurve.regenBase} + ${mc.postCurve.regenScale} * (1 - Math.exp(-(manaLevel - 10) / ${mc.postCurve.regenDecay}))).toFixed(2)`
      )

      // Update extraction speed thresholds
      const sortedExt = [...mc.extraction].sort((a, b) => b.level - a.level)
      const extLines = sortedExt.map(e => `  if (manaLevel >= ${e.level}) return ${e.multiplier}`)
      content = content.replace(
        /export function getExtractionSpeed[\s\S]*?return 1\.0\n\}/,
        `export function getExtractionSpeed(manaLevel: number): number {\n${extLines.join('\n')}\n  return 1.0\n}`
      )

      // Update perk unlocks
      const sortedPerks = [...mc.perks].sort((a, b) => a.level - b.level)
      const perkLines = sortedPerks.map(p => `  if (manaLevel >= ${p.level}) perks.push('${p.id}')`)
      content = content.replace(
        /const perks: ManaPerk\[\] = \[\][\s\S]*?return perks/,
        `const perks: ManaPerk[] = []\n${perkLines.join('\n')}\n  return perks`
      )

      await writeFile(MANA_FILE, content, 'utf-8')
      saved.push('mana')
    }

    // ── Save Weather Configs ──
    if (body.weather && typeof body.weather === 'object') {
      const weatherData: Record<string, { allowedWeathers: { type: string; weight: number }[]; transitionTicks: number; minDurationMs: number; maxDurationMs: number }> = body.weather

      const zoneBlocks: string[] = []
      for (const [zoneId, zone] of Object.entries(weatherData)) {
        const weatherLines = zone.allowedWeathers.map(w =>
          `      { type: '${w.type}', weight: ${w.weight} },`
        )
        const weathersStr = weatherLines.length > 0
          ? `[\n${weatherLines.join('\n')}\n    ]`
          : '[]'
        zoneBlocks.push(
          `  '${zoneId}': {\n` +
          `    allowedWeathers: ${weathersStr},\n` +
          `    transitionTicks: ${zone.transitionTicks},\n` +
          `    minDurationMs: ${zone.minDurationMs},\n` +
          `    maxDurationMs: ${zone.maxDurationMs},\n` +
          `  },`
        )
      }

      const newBlock = `const DEFAULT_WEATHER_CONFIGS: Record<string, ZoneWeatherConfig> = {\n${zoneBlocks.join('\n\n')}\n}`

      let content = await readFile(WEATHER_FILE, 'utf-8')
      const pattern = /export const DEFAULT_WEATHER_CONFIGS[^=]*=\s*\{[\s\S]*?\n\}/
      if (pattern.test(content)) {
        content = content.replace(pattern, `export ${newBlock}`)
        await writeFile(WEATHER_FILE, content, 'utf-8')
        saved.push('weather')
      } else {
        return NextResponse.json({ error: 'Could not find DEFAULT_WEATHER_CONFIGS in weather.ts' }, { status: 500 })
      }
    }

    // ── Create Zone ──
    if (body.action === 'createZone') {
      const name: string = body.name
      const cols: number = body.cols ?? 25
      const rows: number = body.rows ?? 20
      if (!name || name.length < 2) {
        return NextResponse.json({ error: 'Zone name required' }, { status: 400 })
      }
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const constName = zoneConstName(id)
      const grid = generateStubGrid(cols, rows)
      const spawnX = Math.floor(cols / 2)
      const spawnY = Math.floor(rows / 2)

      // 1. Append grid to tilemap.ts
      const tilemapContent = await readFile(TILEMAP_FILE, 'utf-8')
      if (tilemapContent.includes(`export const ${constName}`)) {
        return NextResponse.json({ error: `Zone "${constName}" already exists in tilemap.ts` }, { status: 400 })
      }
      const maxVal = Math.max(0, ...grid.flat())
      const padWidth = maxVal > 99 ? (maxVal > 999 ? 4 : 3) : 2
      const gridLines = grid.map((row, y) => {
        const padded = row.map(n => n.toString().padStart(padWidth, ' ')).join(',')
        return `  [${padded}],  // ${y}`
      })
      const gridDecl = `\nexport const ${constName}: number[][] = [\n${gridLines.join('\n')}\n]\n`
      await writeFile(TILEMAP_FILE, tilemapContent.trimEnd() + '\n' + gridDecl, 'utf-8')

      // 2. Update zones.ts — add import + zone entry
      let zonesContent = await readFile(ZONES_FILE, 'utf-8')
      // Add to import line
      const importMatch = zonesContent.match(/(import\s*\{[^}]+)\}\s*from\s*'\.\/tilemap'/)
      if (importMatch) {
        const newImport = importMatch[1] + `, ${constName} } from './tilemap'`
        zonesContent = zonesContent.replace(importMatch[0], newImport)
      }
      // Add zone entry before closing ]
      const zonesArrayEnd = zonesContent.lastIndexOf(']')
      if (zonesArrayEnd !== -1) {
        const zoneEntry = `  {\n    id: '${id}',\n    name: '${name}',\n    grid: ${constName},\n    playerStart: { tileX: ${spawnX}, tileY: ${spawnY} },\n    warps: [],\n  },\n`
        zonesContent = zonesContent.substring(0, zonesArrayEnd) + zoneEntry + zonesContent.substring(zonesArrayEnd)
      }
      await writeFile(ZONES_FILE, zonesContent, 'utf-8')

      // 3. Add empty node entry to node-placements.ts
      let nodesContent = await readFile(NODES_FILE, 'utf-8')
      const zoneNodesEnd = nodesContent.lastIndexOf('}')
      if (zoneNodesEnd !== -1) {
        nodesContent = nodesContent.substring(0, zoneNodesEnd) + `  '${id}': [],\n` + nodesContent.substring(zoneNodesEnd)
      }
      await writeFile(NODES_FILE, nodesContent, 'utf-8')

      // 4. Add empty structure entry to structure-placements.ts
      let structContent = await readFile(STRUCTURES_FILE, 'utf-8')
      const constNameUpper = zoneConstName(id)
      const structEmptyConst = `\nconst ${constNameUpper}_STRUCTURES: StructurePlacement[] = []\n`
      // Insert before the export const STRUCTURE_PLACEMENTS line
      const exportIdx = structContent.indexOf('export const STRUCTURE_PLACEMENTS')
      if (exportIdx !== -1) {
        structContent = structContent.substring(0, exportIdx) + structEmptyConst + '\n' + structContent.substring(exportIdx)
        // Add to the record
        const recordEnd = structContent.lastIndexOf('}')
        if (recordEnd !== -1) {
          structContent = structContent.substring(0, recordEnd) + `  '${id}': ${constNameUpper}_STRUCTURES,\n` + structContent.substring(recordEnd)
        }
        await writeFile(STRUCTURES_FILE, structContent, 'utf-8')
      }

      // 5. Add empty pickup entry to static-pickups.ts
      let pickupsContent = await readFile(PICKUPS_FILE, 'utf-8')
      const pickupEmptyConst = `\nconst ${constNameUpper}_PICKUPS: StaticPickup[] = []\n`
      const pickupExportIdx = pickupsContent.indexOf('export const ZONE_PICKUPS')
      if (pickupExportIdx !== -1) {
        pickupsContent = pickupsContent.substring(0, pickupExportIdx) + pickupEmptyConst + '\n' + pickupsContent.substring(pickupExportIdx)
        const pickupRecordEnd = pickupsContent.lastIndexOf('}')
        if (pickupRecordEnd !== -1) {
          pickupsContent = pickupsContent.substring(0, pickupRecordEnd) + `  '${id}': ${constNameUpper}_PICKUPS,\n` + pickupsContent.substring(pickupRecordEnd)
        }
        await writeFile(PICKUPS_FILE, pickupsContent, 'utf-8')
      }

      // 6. Add empty zone chest entry to zone-chests.ts
      try {
        let zcContent = await readFile(ZONE_CHESTS_FILE, 'utf-8')
        const zcEmptyConst = `\nconst ${constNameUpper}_ZONE_CHESTS: ZoneChestPlacement[] = []\n`
        const zcExportIdx = zcContent.indexOf('export const ZONE_CHESTS')
        if (zcExportIdx !== -1) {
          zcContent = zcContent.substring(0, zcExportIdx) + zcEmptyConst + '\n' + zcContent.substring(zcExportIdx)
          const zcRecordEnd = zcContent.lastIndexOf('}')
          if (zcRecordEnd !== -1) {
            zcContent = zcContent.substring(0, zcRecordEnd) + `  '${id}': ${constNameUpper}_ZONE_CHESTS,\n` + zcContent.substring(zcRecordEnd)
          }
          await writeFile(ZONE_CHESTS_FILE, zcContent, 'utf-8')
        }
      } catch { /* zone-chests file might not exist yet */ }

      return NextResponse.json({ success: true, id, name, constName, grid, playerStart: { tileX: spawnX, tileY: spawnY } })
    }

    // ── Delete Zone ──
    if (body.action === 'deleteZone') {
      const id: string = body.zoneId
      if (!id || id === 'garden') {
        return NextResponse.json({ error: 'Cannot delete garden or missing zone ID' }, { status: 400 })
      }
      const constName = zoneConstName(id)

      // 1. Remove grid from tilemap.ts
      let tilemapContent = await readFile(TILEMAP_FILE, 'utf-8')
      const declStart = tilemapContent.indexOf(`export const ${constName}`)
      if (declStart !== -1) {
        const searchFrom = declStart + constName.length
        // Find next export const or end of file
        const nextExport = tilemapContent.indexOf('\nexport const ', searchFrom)
        const declEnd = nextExport === -1 ? tilemapContent.length : nextExport + 1
        tilemapContent = tilemapContent.substring(0, declStart) + tilemapContent.substring(declEnd)
        // Clean up trailing whitespace
        tilemapContent = tilemapContent.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
        await writeFile(TILEMAP_FILE, tilemapContent, 'utf-8')
      }

      // 2. Update zones.ts — remove import + zone entry
      let zonesContent = await readFile(ZONES_FILE, 'utf-8')
      // Remove from import line
      zonesContent = zonesContent.replace(new RegExp(`,\\s*${constName}`), '')
      zonesContent = zonesContent.replace(new RegExp(`${constName},\\s*`), '')
      // Remove zone entry block (find by id, remove surrounding { ... },)
      const idPattern = `id: '${id}'`
      const idIdx = zonesContent.indexOf(idPattern)
      if (idIdx !== -1) {
        // Walk backward to find opening { of the zone object
        let blockStart = idIdx
        while (blockStart > 0 && zonesContent[blockStart] !== '{') blockStart--
        // Walk backward past whitespace/newlines to include indentation
        while (blockStart > 0 && (zonesContent[blockStart - 1] === ' ' || zonesContent[blockStart - 1] === '\n')) blockStart--
        // Walk forward from the opening { to find matching closing }
        let blockEnd = blockStart
        let depth = 0
        while (blockEnd < zonesContent.length) {
          if (zonesContent[blockEnd] === '{') depth++
          else if (zonesContent[blockEnd] === '}') { depth--; if (depth === 0) break }
          blockEnd++
        }
        // Skip past }, and newline
        blockEnd++ // past }
        if (zonesContent[blockEnd] === ',') blockEnd++
        if (zonesContent[blockEnd] === '\n') blockEnd++
        zonesContent = zonesContent.substring(0, blockStart) + zonesContent.substring(blockEnd)
      }
      await writeFile(ZONES_FILE, zonesContent, 'utf-8')

      // 3. Remove from node-placements.ts ZONE_NODES
      let nodesContent = await readFile(NODES_FILE, 'utf-8')
      // Remove the 'zone-id': [...], entry
      const nodePattern = new RegExp(`\\s*'${id}':\\s*\\[[^\\]]*\\],?\\n?`)
      nodesContent = nodesContent.replace(nodePattern, '\n')
      // Also remove any standalone const block if it exists
      const nodeConstName = id.replace(/-/g, '_').toUpperCase() + '_NODES'
      const nodeConstStart = nodesContent.indexOf(`const ${nodeConstName}`)
      if (nodeConstStart !== -1) {
        const nodeConstEnd = nodesContent.indexOf('\n]', nodeConstStart)
        if (nodeConstEnd !== -1) {
          nodesContent = nodesContent.substring(0, nodeConstStart) + nodesContent.substring(nodeConstEnd + 2)
        }
      }
      nodesContent = nodesContent.replace(/\n{3,}/g, '\n\n')
      await writeFile(NODES_FILE, nodesContent, 'utf-8')

      // 4. Remove from static-pickups.ts
      try {
        let pickupsContent = await readFile(PICKUPS_FILE, 'utf-8')
        const pickupPattern = new RegExp(`\\s*'${id}':\\s*\\[[^\\]]*\\],?\\n?`)
        pickupsContent = pickupsContent.replace(pickupPattern, '\n')
        const pickupConstName = id.replace(/-/g, '_').toUpperCase() + '_PICKUPS'
        const pickupConstStart = pickupsContent.indexOf(`const ${pickupConstName}`)
        if (pickupConstStart !== -1) {
          const pickupConstEnd = pickupsContent.indexOf('\n]', pickupConstStart)
          if (pickupConstEnd !== -1) {
            pickupsContent = pickupsContent.substring(0, pickupConstStart) + pickupsContent.substring(pickupConstEnd + 2)
          }
        }
        pickupsContent = pickupsContent.replace(/\n{3,}/g, '\n\n')
        await writeFile(PICKUPS_FILE, pickupsContent, 'utf-8')
      } catch { /* pickups file might not have this zone */ }

      // 5. Remove from zone-chests.ts
      try {
        let zcContent = await readFile(ZONE_CHESTS_FILE, 'utf-8')
        const zcPattern = new RegExp(`\\s*'${id}':\\s*\\[[^\\]]*\\],?\\n?`)
        zcContent = zcContent.replace(zcPattern, '\n')
        const zcConstName = id.replace(/-/g, '_').toUpperCase() + '_ZONE_CHESTS'
        const zcConstStart = zcContent.indexOf(`const ${zcConstName}`)
        if (zcConstStart !== -1) {
          const zcConstEnd = zcContent.indexOf('\n]', zcConstStart)
          if (zcConstEnd !== -1) {
            zcContent = zcContent.substring(0, zcConstStart) + zcContent.substring(zcConstEnd + 2)
          }
        }
        zcContent = zcContent.replace(/\n{3,}/g, '\n\n')
        await writeFile(ZONE_CHESTS_FILE, zcContent, 'utf-8')
      } catch { /* zone-chests file might not have this zone */ }

      // 6. Remove encounter table entry if it exists
      try {
        let encountersContent = await readFile(ENCOUNTERS_FILE, 'utf-8')
        const encPattern = new RegExp(`\\s*'${id}':\\s*\\{[\\s\\S]*?\\},\\n`)
        encountersContent = encountersContent.replace(encPattern, '\n')
        await writeFile(ENCOUNTERS_FILE, encountersContent, 'utf-8')
      } catch { /* encounters file might not have this zone */ }

      return NextResponse.json({ success: true, deleted: id })
    }

    return NextResponse.json({ success: true, saved })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
