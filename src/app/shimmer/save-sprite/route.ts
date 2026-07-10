import { NextRequest, NextResponse } from 'next/server'
import { readFile, access } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { BadRequest, safeId, safeInt, safeEnum, safeColors, lookup } from '../lib/safe'

/** Map a guard failure to 400, anything else to 500. */
function errorResponse(e: unknown) {
  if (e instanceof BadRequest) return NextResponse.json({ error: e.message }, { status: 400 })
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
}

// Grid size per animation (default 32 for overworld, 96 for battle)
const ANIM_GRID_SIZE: Record<string, number> = {
  battle_front: 96,
  battle_back: 96,
}

// 96x96 battle sprite const names (not in source files yet — created on first save)
const BATTLE_96_MAP: Record<string, string[]> = {
  battle_front: ['BF96_0', 'BF96_1'],
  battle_back:  ['BB96_0', 'BB96_1'],
}

// Spirit frame const names per animation
const SPIRIT_FRAME_MAP: Record<string, string[]> = {
  // Battle frames
  battle_front:     ['BATTLE_FRONT_0', 'BATTLE_FRONT_1'],
  battle_back:      ['BATTLE_BACK_0', 'BATTLE_BACK_1'],
  battle_attack:    ['BATTLE_ATK_0', 'BATTLE_ATK_1', 'BATTLE_ATK_2'],
  battle_hit_front: ['BATTLE_HIT_FRONT_0'],
  battle_hit_back:  ['BATTLE_HIT_BACK_0'],
  battle_faint:     ['BATTLE_FAINT_0', 'BATTLE_FAINT_1'],
  happy:            ['HAPPY_0', 'HAPPY_1'],
  // Legacy overworld (kept for backward compat)
  idle:       ['RIGHT_IDLE_0', 'RIGHT_IDLE_1'],
  idle_blink: ['IDLE_BLINK'],
  walk:       ['RIGHT_IDLE_0', 'RIGHT_STEP_L', 'RIGHT_IDLE_0', 'RIGHT_STEP_R'],
  eat:        ['EAT_0', 'EAT_1'],
  sleep:      ['SLEEP_0', 'SLEEP_1'],
  seed:       ['SEED'],
  down_idle:  ['DOWN_IDLE_0', 'DOWN_IDLE_1'],
  down_walk:  ['DOWN_IDLE_0', 'DOWN_STEP_L', 'DOWN_IDLE_0', 'DOWN_STEP_R'],
  up_idle:    ['UP_IDLE_0', 'UP_IDLE_1'],
  up_walk:    ['UP_IDLE_0', 'UP_STEP_L', 'UP_IDLE_0', 'UP_STEP_R'],
  right_idle: ['RIGHT_IDLE_0', 'RIGHT_IDLE_1'],
  right_walk: ['RIGHT_IDLE_0', 'RIGHT_STEP_L', 'RIGHT_IDLE_0', 'RIGHT_STEP_R'],
}

// Player character frame const names (all directional, RIGHT uses RIGHT_ prefix)
const PLAYER_FRAME_MAP: Record<string, string[]> = {
  // Cardinal movement
  down_idle:  ['DOWN_IDLE_0', 'DOWN_IDLE_1'],
  down_walk:  ['DOWN_IDLE_0', 'DOWN_STEP_L', 'DOWN_IDLE_0', 'DOWN_STEP_R'],
  down_run:   ['DOWN_RUN_0', 'DOWN_RUN_1', 'DOWN_RUN_2', 'DOWN_RUN_3'],
  up_idle:    ['UP_IDLE_0', 'UP_IDLE_1'],
  up_walk:    ['UP_IDLE_0', 'UP_STEP_L', 'UP_IDLE_0', 'UP_STEP_R'],
  up_run:     ['UP_RUN_0', 'UP_RUN_1', 'UP_RUN_2', 'UP_RUN_3'],
  right_idle: ['RIGHT_IDLE_0', 'RIGHT_IDLE_1'],
  right_walk: ['RIGHT_IDLE_0', 'RIGHT_STEP_L', 'RIGHT_IDLE_0', 'RIGHT_STEP_R'],
  right_run:  ['RIGHT_RUN_0', 'RIGHT_RUN_1', 'RIGHT_RUN_2', 'RIGHT_RUN_3'],
  // Staged movement phases — play-once transitions
  down_start_run:  ['DOWN_START_RUN_0', 'DOWN_START_RUN_1', 'DOWN_START_RUN_2'],
  down_special:    ['DOWN_SPECIAL_0', 'DOWN_SPECIAL_1', 'DOWN_SPECIAL_2'],
  down_end_run:    ['DOWN_END_RUN_0', 'DOWN_END_RUN_1', 'DOWN_END_RUN_2'],
  up_start_run:    ['UP_START_RUN_0', 'UP_START_RUN_1', 'UP_START_RUN_2'],
  up_special:      ['UP_SPECIAL_0', 'UP_SPECIAL_1', 'UP_SPECIAL_2'],
  up_end_run:      ['UP_END_RUN_0', 'UP_END_RUN_1', 'UP_END_RUN_2'],
  right_start_run: ['RIGHT_START_RUN_0', 'RIGHT_START_RUN_1', 'RIGHT_START_RUN_2'],
  right_special:   ['RIGHT_SPECIAL_0', 'RIGHT_SPECIAL_1', 'RIGHT_SPECIAL_2'],
  right_end_run:   ['RIGHT_END_RUN_0', 'RIGHT_END_RUN_1', 'RIGHT_END_RUN_2'],
  // Diagonal movement (left variants = horizontal flip)
  downright_idle:      ['DOWNRIGHT_IDLE_0', 'DOWNRIGHT_IDLE_1'],
  downright_walk:      ['DOWNRIGHT_IDLE_0', 'DOWNRIGHT_STEP_L', 'DOWNRIGHT_IDLE_0', 'DOWNRIGHT_STEP_R'],
  downright_run:       ['DOWNRIGHT_RUN_0', 'DOWNRIGHT_RUN_1', 'DOWNRIGHT_RUN_2', 'DOWNRIGHT_RUN_3'],
  downright_start_run: ['DOWNRIGHT_START_RUN_0', 'DOWNRIGHT_START_RUN_1', 'DOWNRIGHT_START_RUN_2'],
  downright_special:   ['DOWNRIGHT_SPECIAL_0', 'DOWNRIGHT_SPECIAL_1', 'DOWNRIGHT_SPECIAL_2'],
  downright_end_run:   ['DOWNRIGHT_END_RUN_0', 'DOWNRIGHT_END_RUN_1', 'DOWNRIGHT_END_RUN_2'],
  upright_idle:        ['UPRIGHT_IDLE_0', 'UPRIGHT_IDLE_1'],
  upright_walk:        ['UPRIGHT_IDLE_0', 'UPRIGHT_STEP_L', 'UPRIGHT_IDLE_0', 'UPRIGHT_STEP_R'],
  upright_run:         ['UPRIGHT_RUN_0', 'UPRIGHT_RUN_1', 'UPRIGHT_RUN_2', 'UPRIGHT_RUN_3'],
  upright_start_run:   ['UPRIGHT_START_RUN_0', 'UPRIGHT_START_RUN_1', 'UPRIGHT_START_RUN_2'],
  upright_special:     ['UPRIGHT_SPECIAL_0', 'UPRIGHT_SPECIAL_1', 'UPRIGHT_SPECIAL_2'],
  upright_end_run:     ['UPRIGHT_END_RUN_0', 'UPRIGHT_END_RUN_1', 'UPRIGHT_END_RUN_2'],
  // Generic channel (forestry, prospecting — tools spawn at node)
  channel_down:  ['CHANNEL_DOWN_0', 'CHANNEL_DOWN_1'],
  channel_up:    ['CHANNEL_UP_0', 'CHANNEL_UP_1'],
  channel_right: ['CHANNEL_RIGHT_0', 'CHANNEL_RIGHT_1'],
  // Mana channel (per-character unique)
  mana_down:  ['MANA_DOWN_0', 'MANA_DOWN_1'],
  mana_up:    ['MANA_UP_0', 'MANA_UP_1'],
  mana_right: ['MANA_RIGHT_0', 'MANA_RIGHT_1'],
  // Rinning channel (per-character unique, with rinstick)
  rinning_down:  ['RINNING_DOWN_0', 'RINNING_DOWN_1'],
  rinning_up:    ['RINNING_UP_0', 'RINNING_UP_1'],
  rinning_right: ['RINNING_RIGHT_0', 'RINNING_RIGHT_1'],
}

const SPRITE_DIR = join(process.cwd(), 'src/app/shimmer/sprites')

const SPIRIT_FILES: Record<string, string> = {
  fox: 'fox.ts',
  axolotl: 'axolotl.ts',
  'water-bear': 'water-bear.ts',
  turtle: 'turtle.ts',
  owl: 'owl.ts',
  frog: 'frog.ts',
  firefly: 'firefly.ts',
  rabbit: 'rabbit.ts',
  hummingbird: 'hummingbird.ts',
  bat: 'bat.ts',
}

const PLAYER_FILES: Record<string, string> = {
  alkin: 'player.ts',
  kael: 'kael.ts',
  gregory: 'gregory.ts',
  jin: 'jin.ts',
  alex: 'alex.ts',
}

// Beast species — all live in beasts.ts, each with prefixed const names
const BEAST_FILES: Record<string, string> = {
  drifthorn: 'beasts.ts',
  dustwhisker: 'beasts.ts',
  sporeling: 'beasts.ts',
  glowmite: 'beasts.ts',
  embermole: 'beasts.ts',
}

/** Generate frame map for a beast species based on its naming convention */
function beastFrameMap(species: string): Record<string, string[]> {
  const p = species.toUpperCase()
  return {
    idle:       [`${p}_IDLE_0`, `${p}_IDLE_1`],
    walk:       [`${p}_IDLE_0`, `${p}_STEP_L`, `${p}_IDLE_0`, `${p}_STEP_R`],
    down_idle:  [`${p}_DOWN_0`],
    down_walk:  [`${p}_DOWN_0`, `${p}_DOWN_STEP_0`],
    up_idle:    [`${p}_UP_0`],
    up_walk:    [`${p}_UP_0`, `${p}_UP_STEP_0`],
    right_idle: [`${p}_IDLE_0`, `${p}_IDLE_1`],
    right_walk: [`${p}_IDLE_0`, `${p}_STEP_L`, `${p}_IDLE_0`, `${p}_STEP_R`],
    // Diagonal directions
    downright_idle: [`${p}_DOWNRIGHT_IDLE_0`, `${p}_DOWNRIGHT_IDLE_1`],
    downright_walk: [`${p}_DOWNRIGHT_IDLE_0`, `${p}_DOWNRIGHT_STEP_L`, `${p}_DOWNRIGHT_IDLE_0`, `${p}_DOWNRIGHT_STEP_R`],
    upright_idle:   [`${p}_UPRIGHT_IDLE_0`, `${p}_UPRIGHT_IDLE_1`],
    upright_walk:   [`${p}_UPRIGHT_IDLE_0`, `${p}_UPRIGHT_STEP_L`, `${p}_UPRIGHT_IDLE_0`, `${p}_UPRIGHT_STEP_R`],
    // Run phases
    down_run:        [`${p}_DOWN_RUN_0`, `${p}_DOWN_RUN_1`, `${p}_DOWN_RUN_2`, `${p}_DOWN_RUN_3`],
    up_run:          [`${p}_UP_RUN_0`, `${p}_UP_RUN_1`, `${p}_UP_RUN_2`, `${p}_UP_RUN_3`],
    right_run:       [`${p}_RIGHT_RUN_0`, `${p}_RIGHT_RUN_1`, `${p}_RIGHT_RUN_2`, `${p}_RIGHT_RUN_3`],
    downright_run:   [`${p}_DOWNRIGHT_RUN_0`, `${p}_DOWNRIGHT_RUN_1`, `${p}_DOWNRIGHT_RUN_2`, `${p}_DOWNRIGHT_RUN_3`],
    upright_run:     [`${p}_UPRIGHT_RUN_0`, `${p}_UPRIGHT_RUN_1`, `${p}_UPRIGHT_RUN_2`, `${p}_UPRIGHT_RUN_3`],
    // Run sub-phases
    down_start_run:      [`${p}_DOWN_START_RUN_0`, `${p}_DOWN_START_RUN_1`, `${p}_DOWN_START_RUN_2`],
    down_special:        [`${p}_DOWN_SPECIAL_0`, `${p}_DOWN_SPECIAL_1`, `${p}_DOWN_SPECIAL_2`],
    down_end_run:        [`${p}_DOWN_END_RUN_0`, `${p}_DOWN_END_RUN_1`, `${p}_DOWN_END_RUN_2`],
    up_start_run:        [`${p}_UP_START_RUN_0`, `${p}_UP_START_RUN_1`, `${p}_UP_START_RUN_2`],
    up_special:          [`${p}_UP_SPECIAL_0`, `${p}_UP_SPECIAL_1`, `${p}_UP_SPECIAL_2`],
    up_end_run:          [`${p}_UP_END_RUN_0`, `${p}_UP_END_RUN_1`, `${p}_UP_END_RUN_2`],
    right_start_run:     [`${p}_RIGHT_START_RUN_0`, `${p}_RIGHT_START_RUN_1`, `${p}_RIGHT_START_RUN_2`],
    right_special:       [`${p}_RIGHT_SPECIAL_0`, `${p}_RIGHT_SPECIAL_1`, `${p}_RIGHT_SPECIAL_2`],
    right_end_run:       [`${p}_RIGHT_END_RUN_0`, `${p}_RIGHT_END_RUN_1`, `${p}_RIGHT_END_RUN_2`],
    downright_start_run: [`${p}_DOWNRIGHT_START_RUN_0`, `${p}_DOWNRIGHT_START_RUN_1`, `${p}_DOWNRIGHT_START_RUN_2`],
    downright_special:   [`${p}_DOWNRIGHT_SPECIAL_0`, `${p}_DOWNRIGHT_SPECIAL_1`, `${p}_DOWNRIGHT_SPECIAL_2`],
    downright_end_run:   [`${p}_DOWNRIGHT_END_RUN_0`, `${p}_DOWNRIGHT_END_RUN_1`, `${p}_DOWNRIGHT_END_RUN_2`],
    upright_start_run:   [`${p}_UPRIGHT_START_RUN_0`, `${p}_UPRIGHT_START_RUN_1`, `${p}_UPRIGHT_START_RUN_2`],
    upright_special:     [`${p}_UPRIGHT_SPECIAL_0`, `${p}_UPRIGHT_SPECIAL_1`, `${p}_UPRIGHT_SPECIAL_2`],
    upright_end_run:     [`${p}_UPRIGHT_END_RUN_0`, `${p}_UPRIGHT_END_RUN_1`, `${p}_UPRIGHT_END_RUN_2`],
    happy:      [`${p}_HAPPY_0`],
    // Care-loop frames. These exist in BeastEditor's DEFAULT_FRAME_CONST_MAP; without them here the
    // POST resolves no const names and 400s "Unknown animation" — painting them silently lost the work.
    // Keep the frame counts in lockstep with the editor (pet 2, eat 2, sleep 1).
    pet:        [`${p}_PET_0`, `${p}_PET_1`],
    eat:        [`${p}_EAT_0`, `${p}_EAT_1`],
    sleep:      [`${p}_SLEEP_0`],
  }
}

// HUD icon frame const names (single frame each)
const ICON_FRAME_MAP: Record<string, string[]> = {
  save:    ['SAVE'],
  bag:     ['BAG'],
  options: ['OPTIONS'],
  quit:    ['QUIT'],
}

const ICON_FILES: Record<string, string> = {
  icons: 'icons.ts',
}

// Item frame map is dynamic (frames can be added at runtime)
function parseItemFrameMap(content: string): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  const mapMatch = content.match(/ITEM_FRAME_MAP[^{]*\{([\s\S]*?)\}/)
  if (!mapMatch) return map
  const entries = mapMatch[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)
  for (const m of entries) {
    const names = m[2].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
    map[m[1]] = names
  }
  return map
}

async function resolveItems(species: string) {
  if (species !== 'items') return null
  try {
    const filePath = join(SPRITE_DIR, 'items.ts')
    const content = await readFile(filePath, 'utf-8')
    return { file: 'items.ts', frameMap: parseItemFrameMap(content), isPlayer: false }
  } catch { return null }
}

// Furniture frame map — parsed dynamically from furniture.ts
function parseFurnitureFrameMap(content: string): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  const mapMatch = content.match(/FURNITURE_FRAME_MAP[^{]*\{([\s\S]*?)\}/)
  if (!mapMatch) return map
  const entries = mapMatch[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)
  for (const m of entries) {
    const names = m[2].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
    map[m[1]] = names
  }
  return map
}

async function resolveFurniture(species: string) {
  if (species !== 'furniture') return null
  try {
    const filePath = join(SPRITE_DIR, 'furniture.ts')
    const content = await readFile(filePath, 'utf-8')
    return { file: 'furniture.ts', frameMap: parseFurnitureFrameMap(content), isPlayer: false }
  } catch { return null }
}

// Node frame map — parsed dynamically from items.ts (frames can be added at runtime)
function parseNodeFrameMap(content: string): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  const mapMatch = content.match(/NODE_FRAME_MAP[^{]*\{([\s\S]*?)\n\}/)
  if (!mapMatch) return map
  const entries = mapMatch[1].matchAll(/([\w]+):\s*\[([^\]]*)\]/g)
  for (const m of entries) {
    const names = m[2].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
    map[m[1]] = names
  }
  return map
}

async function resolveNodes(species: string) {
  if (species !== 'nodes') return null
  try {
    const filePath = join(SPRITE_DIR, 'items.ts')
    const content = await readFile(filePath, 'utf-8')
    return { file: 'items.ts', frameMap: parseNodeFrameMap(content), isPlayer: false }
  } catch { return null }
}


// Map species → SPRITES export name in its source file
// Player files: alkin uses PLAYER_SPRITES (legacy), others use ${UPPER}_SPRITES
// Spirit files: ${UPPER}_SPRITES with hyphens → underscores (water-bear → WATER_BEAR_SPRITES)
function getSpritesExportName(species: string): string | null {
  if (species === 'alkin') return 'PLAYER_SPRITES'
  if (lookup(PLAYER_FILES, species)) return `${species.toUpperCase()}_SPRITES`
  if (lookup(SPIRIT_FILES, species)) return `${species.toUpperCase().replace(/-/g, '_')}_SPRITES`
  return null
}

// Pick a default rate for an animation key. Editor-tuned per-frame durations
// override this at runtime, so the value is just a starting point.
function pickDefaultRate(animKey: string): number {
  if (animKey.includes('idle')) return 4
  if (animKey === 'down_run' || animKey === 'up_run' || animKey === 'right_run' ||
      animKey === 'downright_run' || animKey === 'upright_run') return 2
  if (animKey.startsWith('channel_') || animKey.startsWith('mana_') || animKey.startsWith('rinning_')) return 6
  return 3
}

// Upsert `animKey: <body>,` inside an object-literal export block.
// `blockRegex` must capture (head, inner, tail) where `inner` is the body
// between `{` and `\n}`. If the key already exists on a single line, its
// value is replaced in place; otherwise the entry is appended before the
// closing `}`. Returns content unchanged when the block can't be located.
//
// Why upsert (not skip-if-present): a placeholder entry like
// `goldwood_bark: { frames: [GOLDWOOD_PLANK], rate: 1 },` plus the
// auto-wire firing once Alex paints real frames used to leave a duplicate
// key behind, which TS rejects at build. Replacing the existing line keeps
// the file valid whether or not a placeholder was there first.
function upsertExportEntry(
  content: string,
  blockRegex: RegExp,
  animKey: string,
  entryBody: string,
): string {
  const match = blockRegex.exec(content)
  if (!match || match.index === undefined) return content
  const [full, head, inner, tail] = match
  const escapedKey = animKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lineRegex = new RegExp(
    `^([ \\t]*)${escapedKey}[ \\t]*:[^\\n]*?,[^\\n]*$`,
    'm',
  )
  let nextInner: string
  const lineMatch = lineRegex.exec(inner)
  if (lineMatch) {
    const indent = lineMatch[1]
    nextInner =
      inner.slice(0, lineMatch.index) +
      `${indent}${animKey}: ${entryBody},` +
      inner.slice(lineMatch.index + lineMatch[0].length)
  } else {
    nextInner = inner.replace(/\s*$/, '') + `\n  ${animKey}: ${entryBody},`
  }
  const start = match.index
  return content.slice(0, start) + head + nextInner + tail + content.slice(start + full.length)
}

// Upsert an `animKey: { frames: [...], rate: N }` entry into a SPRITES export.
function upsertSpritesExportEntry(
  content: string,
  exportName: string,
  animKey: string,
  constNames: string[],
  rate: number,
): string {
  const escapedExport = exportName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blockRegex = new RegExp(
    `(export const ${escapedExport}\\b[^=]*=\\s*\\{)([\\s\\S]*?)(\\n\\})`,
  )
  const body = `{ frames: [${constNames.join(', ')}], rate: ${rate} }`
  return upsertExportEntry(content, blockRegex, animKey, body)
}

// Parse frame arrays from sprite export: animKey: { frames: [CONST_A, CONST_B], rate: N }
// Overrides defaultMap entries when explicit entries found in the source file
function parseSpriteExportFrameMap(content: string, defaultMap: Record<string, string[]>): Record<string, string[]> {
  const map: Record<string, string[]> = { ...defaultMap }
  const entries = content.matchAll(/(\w+):\s*\{\s*frames:\s*\[([^\]]+)\]\s*,\s*rate:\s*\d+\s*\}/g)
  for (const m of entries) {
    const animKey = m[1]
    if (!(animKey in defaultMap)) continue
    const constNames = m[2].split(',').map(s => s.trim()).filter(Boolean)
    if (constNames.length > 0) {
      map[animKey] = constNames
    }
  }
  return map
}

async function resolve(species: string) {
  const spiritFile = lookup(SPIRIT_FILES, species)
  if (spiritFile) {
    try {
      const content = await readFile(join(SPRITE_DIR, spiritFile), 'utf-8')
      return { file: spiritFile, frameMap: parseSpriteExportFrameMap(content, SPIRIT_FRAME_MAP), isPlayer: false }
    } catch {
      return { file: spiritFile, frameMap: SPIRIT_FRAME_MAP, isPlayer: false }
    }
  }
  const playerFile = lookup(PLAYER_FILES, species)
  if (playerFile) {
    try {
      const content = await readFile(join(SPRITE_DIR, playerFile), 'utf-8')
      return { file: playerFile, frameMap: parseSpriteExportFrameMap(content, PLAYER_FRAME_MAP), isPlayer: true }
    } catch {
      return { file: playerFile, frameMap: PLAYER_FRAME_MAP, isPlayer: true }
    }
  }
  const beastFile = lookup(BEAST_FILES, species)
  if (beastFile) {
    return { file: beastFile, frameMap: beastFrameMap(species), isPlayer: false }
  }
  const iconFile = lookup(ICON_FILES, species)
  if (iconFile) return { file: iconFile, frameMap: ICON_FRAME_MAP, isPlayer: false }

  // Dynamic form files — any grimoire entry (evolution forms, etc.)
  // File is {id}.ts in sprites dir, created on first save
  // Skip reserved species — they have dedicated resolvers (items, tools, furniture, nodes)
  if (RESERVED_SPECIES.has(species)) return null
  // Past this point `species` names a file. Anything but a bare id escapes SPRITE_DIR.
  safeId(species, 'species')
  const formFile = `${species}.ts`
  const formPath = join(SPRITE_DIR, formFile)
  try {
    await access(formPath)
    const content = await readFile(formPath, 'utf-8')
    return { file: formFile, frameMap: parseSpriteExportFrameMap(content, SPIRIT_FRAME_MAP), isPlayer: false }
  } catch {
    // File doesn't exist yet — return null for GET, will be created on POST
    return null
  }
}

// Frame map for new spirit forms (icon + battle_front + battle_back)
const FORM_FRAME_MAP: Record<string, string[]> = {
  battle_front: ['BATTLE_FRONT_0', 'BATTLE_FRONT_1'],
  battle_back:  ['BATTLE_BACK_0', 'BATTLE_BACK_1'],
}

/** Generate a blank spirit form file from template */
function generateFormTemplate(id: string): string {
  const constPrefix = id.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const blank32 = Array(32).fill('  ' + '0'.repeat(32)).join('\n')
  const blank96 = Array(96).fill('  ' + '0'.repeat(96)).join('\n')

  return `// ${id} sprite — spirit form
import { px, SpriteAnim } from './sprite-data'

const S = 32

const BATTLE_FRONT_0 = px(S, S, \`
${blank32}
\`)

const BATTLE_FRONT_1 = px(S, S, \`
${blank32}
\`)

const BF96_0 = px(96, 96, \`
${blank96}
\`)

const BF96_1 = px(96, 96, \`
${blank96}
\`)

const BB96_0 = px(96, 96, \`
${blank96}
\`)

const BB96_1 = px(96, 96, \`
${blank96}
\`)

export const ${constPrefix}_PALETTE: string[] = ['#555555', '#888888', '#333333', '#111111', '#eeeeee', '#666666', '#444444', '#777777', '#999999', '#aaaaaa']

export const ${constPrefix}_SPRITES: Record<string, SpriteAnim> = {
  battle_front: { frames: [BATTLE_FRONT_0, BATTLE_FRONT_1], rate: 8 },
  battle_back:  { frames: [BB96_0, BB96_1], rate: 8 },
}
`
}

/** Ensure a form's sprite file exists, creating from template if needed */
async function ensureFormFile(species: string): Promise<string> {
  safeId(species, 'species')
  const file = `${species}.ts`
  const filePath = join(SPRITE_DIR, file)
  try {
    await access(filePath)
  } catch {
    await writeFile(filePath, generateFormTemplate(species), 'utf-8')
  }
  return file
}

/** Resolve a form species — creates file if needed (for write ops) */
// Species handled by their own resolvers — don't create form files for these
const RESERVED_SPECIES = new Set(['nodes', 'tools', 'furniture', 'items'])

async function resolveOrCreate(species: string) {
  // Reserved species have dedicated resolvers — skip form file matching entirely
  if (RESERVED_SPECIES.has(species)) return null

  // Try standard resolve first
  const std = await resolve(species)
  if (std) return std

  // Create form file and resolve
  const file = await ensureFormFile(species)
  const content = await readFile(join(SPRITE_DIR, file), 'utf-8')
  return { file, frameMap: parseSpriteExportFrameMap(content, SPIRIT_FRAME_MAP), isPlayer: false }
}

const VARIANTS_PATH = join(process.cwd(), 'src/app/shimmer/sprites/variants.ts')

async function readVariantConfig() {
  const content = await readFile(VARIANTS_PATH, 'utf-8')
  const config: Record<string, Record<string, { rarity: string; encounterRate: number }>> = {}
  // Scope to VARIANT_CONFIG block only (avoid matching VARIANT_CLASS_DEFS etc.)
  const configMatch = content.match(/export const VARIANT_CONFIG[\s\S]*?= \{([\s\S]*)\n\}/)
  if (!configMatch) return config
  const configBlock = configMatch[1]
  const speciesBlocks = configBlock.matchAll(/['"]?([\w-]+)['"]?:\s*\{([\s\S]*?)\n  \}/g)
  for (const block of speciesBlocks) {
    const species = block[1]
    config[species] = {}
    const entries = block[2].matchAll(/(\w+):\s*\{\s*rarity:\s*'(\w+)',\s*encounterRate:\s*(\d+)\s*\}/g)
    for (const entry of entries) {
      config[species][entry[1]] = { rarity: entry[2], encounterRate: parseInt(entry[3], 10) }
    }
  }
  return config
}

// Mirrors the `Rarity` union in sprites/variants.ts.
const VARIANT_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
// Mirrors the `CharRole` union in dev/editors/PlayerEditor.tsx.
const CHAR_ROLES = ['player', 'npc'] as const

async function writeVariantConfig(species: string, variants: Record<string, { rarity: string; encounterRate: number }>) {
  safeId(species, 'species')
  let content = await readFile(VARIANTS_PATH, 'utf-8')
  const variantEntries = Object.entries(variants)
    .map(([rawKey, raw]) => {
      const key = safeId(rawKey, 'variant key')
      const v = raw as { rarity: unknown; encounterRate: unknown }
      const rarity = safeEnum(v.rarity, VARIANT_RARITIES, `variants.${key}.rarity`)
      const encounterRate = safeInt(v.encounterRate, `variants.${key}.encounterRate`, 0, 1000)
      const pad = key.length < 6 ? ' '.repeat(6 - key.length) : ''
      return `    ${key}:${pad} { rarity: '${rarity}',${' '.repeat(Math.max(1, 10 - rarity.length))}encounterRate: ${encounterRate} },`
    })
    .join('\n')
  const newBlock = `{\n${variantEntries}\n  }`
  // Match species block including nested braces: "species: {\n  ...entries with {}\n  }"
  const escaped = species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(['"]?${escaped}['"]?:\\s*)\\{[\\s\\S]*?\\n  \\}`, 'm')
  if (!pattern.test(content)) return false
  content = content.replace(pattern, `$1${newBlock}`)
  await writeFile(VARIANTS_PATH, content, 'utf-8')
  return true
}

// GET: read all sprite frames from source .ts files, or variant config
export async function GET(req: NextRequest) {
  try {
    const species = req.nextUrl.searchParams.get('species')
    if (!species) return NextResponse.json({ error: 'Missing species' }, { status: 400 })

    // Variant config endpoint
    if (species === 'variants') {
      const config = await readVariantConfig()
      return NextResponse.json({ config })
    }

    const info = await resolve(species) ?? await resolveFurniture(species) ?? await resolveNodes(species) ?? await resolveItems(species)

    // Form file doesn't exist yet — return blank data so editor shows empty canvas
    if (!info) {
      const blankFrameMap = { ...SPIRIT_FRAME_MAP }
      return NextResponse.json({
        species,
        frames: {},
        palettes: { base: ['#555555', '#888888', '#333333', '#111111', '#eeeeee', '#666666', '#444444', '#777777', '#999999', '#aaaaaa'] },
        frameMap: blankFrameMap,
      })
    }

    const filePath = join(SPRITE_DIR, info.file)
    const content = await readFile(filePath, 'utf-8')

    // Fallback: legacy spirit const names (fox/axolotl use IDLE_0 instead of RIGHT_IDLE_0)
    // Battle frames fall back to directional idle poses until hand-painted
    const SPIRIT_FALLBACKS: Record<string, string> = {
      RIGHT_IDLE_0: 'IDLE_0', RIGHT_IDLE_1: 'IDLE_1',
      RIGHT_STEP_L: 'WALK_1', RIGHT_STEP_R: 'WALK_3',
      BATTLE_FRONT_0: 'DOWN_IDLE_0', BATTLE_FRONT_1: 'DOWN_IDLE_1',
      BATTLE_BACK_0: 'UP_IDLE_0', BATTLE_BACK_1: 'UP_IDLE_1',
    }

    // Extract all const NAME = px(...) blocks (supports both px(S, S, ...) and px(32, 32, ...))
    const frames: Record<string, string> = {}
    // Include standard frameMap consts + 32x32 battle consts
    const allConsts = [...new Set([...Object.values(info.frameMap).flat(), ...Object.values(BATTLE_96_MAP).flat()])]
    for (const name of allConsts) {
      // Match px(S, S, `...`) or px(N, N, `...`) where N is any number
      const pattern = new RegExp(
        `const ${name} = px\\(\\s*(?:S|\\d+)\\s*,\\s*(?:S|\\d+)\\s*,\\s*\`([^]*?)\`\\)`,
      )
      const match = content.match(pattern)
      if (match) {
        frames[name] = match[1]
          .trim()
          .split('\n')
          .map((l: string) => l.trim())
          .join('\n')
      } else if (SPIRIT_FALLBACKS[name]) {
        // Try legacy const name
        const fbPattern = new RegExp(
          `const ${SPIRIT_FALLBACKS[name]} = px\\(\\s*(?:S|\\d+)\\s*,\\s*(?:S|\\d+)\\s*,\\s*\`([^]*?)\`\\)`,
        )
        const fbMatch = content.match(fbPattern)
        if (fbMatch) {
          frames[name] = fbMatch[1].trim().split('\n').map((l: string) => l.trim()).join('\n')
        }
      }
    }

    // Extract palette
    let palettes: Record<string, string[]> | undefined
    // Check if file has inline palette (form files, player files)
    const isFormFile = !lookup(SPIRIT_FILES, species) && !lookup(PLAYER_FILES, species) && !lookup(BEAST_FILES, species) && !lookup(ICON_FILES, species)
    if (species === 'furniture') {
      // Furniture palettes: per-furniture entries in FURNITURE_PALETTES export in furniture.ts
      const furnPalMatch = content.match(/export const FURNITURE_PALETTES[^{]*\{([^}]*)(\})/)
      if (furnPalMatch) {
        palettes = {}
        const entries = furnPalMatch[1].matchAll(/([\w]+):\s*\[([^\]]*)\]/g)
        for (const m of entries) {
          const colors = m[2].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
          palettes[m[1]] = colors
        }
      }
    } else if (species === 'nodes') {
      // Node palettes: per-node entries in NODE_PALETTES export in items.ts
      const nodePalMatch = content.match(/export const NODE_PALETTES[^{]*\{([\s\S]*?)\n\}/)
      if (nodePalMatch) {
        palettes = {}
        const entries = nodePalMatch[1].matchAll(/([\w]+):\s*\[([^\]]*)\]/g)
        for (const m of entries) {
          const colors = m[2].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
          palettes[m[1]] = colors
        }
      }
    } else if (species === 'items') {
      // Item palettes: per-item entries in ITEM_PALETTES export in items.ts
      const itemPalMatch = content.match(/export const ITEM_PALETTES[^{]*\{([^}]*)(\})/)
      if (itemPalMatch) {
        palettes = {}
        const entries = itemPalMatch[1].matchAll(/([\w]+):\s*\[([^\]]*)\]/g)
        for (const m of entries) {
          const colors = m[2].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
          palettes[m[1]] = colors
        }
      }
    } else if (lookup(BEAST_FILES, species)) {
      // Beast palettes are in beasts.ts — BEAST_PALETTES export
      const escaped = species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const palMatch = content.match(new RegExp(`${escaped}:\\s*\\[([^\\]]+)\\]`))
      if (palMatch) {
        const colors = palMatch[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
        palettes = { base: colors }
      }
    } else if (info.isPlayer || isFormFile) {
      // Player files and form files have inline _PALETTE exports
      const palMatch = content.match(/export const \w+_PALETTE[^=]*=\s*\[([^\]]*)\]/)
      if (palMatch) {
        const colors = palMatch[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
        palettes = { base: colors }
      }
    } else {
      // Spirit: read palettes from palette.ts
      const palettePath = join(SPRITE_DIR, 'palette.ts')
      const palContent = await readFile(palettePath, 'utf-8')
      const escaped = species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const speciesMatch = palContent.match(
        new RegExp(`['"]?${escaped}['"]?:\\s*\\{([^}]*?)\\}`, 's')
      )
      if (speciesMatch) {
        palettes = {}
        const entries = speciesMatch[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)
        for (const m of entries) {
          const colors = m[2].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? []
          palettes[m[1]] = colors
        }
      }
    }

    return NextResponse.json({ species, frames, palettes, frameMap: info.frameMap })
  } catch (e: unknown) {
    return errorResponse(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.species) return NextResponse.json({ error: 'Missing species' }, { status: 400 })
    const species = safeId(body.species, 'species')

    // Variant config save
    if (body.variants) {
      const ok = await writeVariantConfig(species, body.variants)
      if (!ok) return NextResponse.json({ error: `Species ${species} not found in variants.ts` }, { status: 400 })
      return NextResponse.json({ success: true, species })
    }

    // Palette save
    if (!Array.isArray(body.colors) || body.colors.length === 0)
      return NextResponse.json({ error: 'Invalid palette data' }, { status: 400 })
    const colors = safeColors(body.colors, 'colors')
    const paletteKey = body.paletteKey === undefined || body.paletteKey === ''
      ? undefined
      : safeId(body.paletteKey, 'paletteKey')

    // Furniture palettes: per-furniture entries in FURNITURE_PALETTES in furniture.ts
    if (species === 'furniture' && paletteKey) {
      const filePath = join(SPRITE_DIR, 'furniture.ts')
      let content = await readFile(filePath, 'utf-8')
      const colorStr = colors.map((c: string) => `'${c}'`).join(', ')
      const escaped = paletteKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`(${escaped}:\\s*\\[)[^\\]]*?(\\])`)
      const blockMatch = content.match(/(export const FURNITURE_PALETTES[^{]*\{)([^}]*)(\})/)
      if (!blockMatch) {
        return NextResponse.json({ error: 'Could not find FURNITURE_PALETTES in furniture.ts' }, { status: 400 })
      }
      let block = blockMatch[2]
      if (pattern.test(block)) {
        block = block.replace(pattern, `$1${colorStr}$2`)
      } else {
        block += `\n  ${paletteKey}: [${colorStr}],`
      }
      content = content.replace(blockMatch[0], `${blockMatch[1]}${block}${blockMatch[3]}`)
      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, species, paletteKey, colors })
    }

    // Node palettes: per-node entries in NODE_PALETTES in items.ts
    if (species === 'nodes' && paletteKey) {
      const filePath = join(SPRITE_DIR, 'items.ts')
      let content = await readFile(filePath, 'utf-8')
      const colorStr = colors.map((c: string) => `'${c}'`).join(', ')
      const escaped = paletteKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`(${escaped}:\\s*\\[)[^\\]]*?(\\])`)
      // Find NODE_PALETTES block and replace within it
      const blockMatch = content.match(/(export const NODE_PALETTES[^{]*\{)([\s\S]*?)(\n\})/)
      if (!blockMatch) {
        return NextResponse.json({ error: 'Could not find NODE_PALETTES in items.ts' }, { status: 400 })
      }
      let block = blockMatch[2]
      if (pattern.test(block)) {
        block = block.replace(pattern, `$1${colorStr}$2`)
      } else {
        // New node entry — append before closing brace
        block += `\n  ${paletteKey}: [${colorStr}],`
      }
      content = content.replace(blockMatch[0], `${blockMatch[1]}${block}${blockMatch[3]}`)
      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, species, paletteKey, colors })
    }

    // Item palettes: per-item entries in ITEM_PALETTES in items.ts
    if (species === 'items' && paletteKey) {
      const filePath = join(SPRITE_DIR, 'items.ts')
      let content = await readFile(filePath, 'utf-8')
      const colorStr = colors.map((c: string) => `'${c}'`).join(', ')
      const escaped = paletteKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`(${escaped}:\\s*\\[)[^\\]]*?(\\])`)
      const blockMatch = content.match(/(export const ITEM_PALETTES[^{]*\{)([^}]*)(\})/)
      if (!blockMatch) {
        return NextResponse.json({ error: 'Could not find ITEM_PALETTES in items.ts' }, { status: 400 })
      }
      let block = blockMatch[2]
      if (pattern.test(block)) {
        block = block.replace(pattern, `$1${colorStr}$2`)
      } else {
        block += `\n  ${paletteKey}: [${colorStr}],`
      }
      content = content.replace(blockMatch[0], `${blockMatch[1]}${block}${blockMatch[3]}`)
      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, species, paletteKey, colors })
    }

    const info = await resolveOrCreate(species)
    if (!info) return NextResponse.json({ error: 'Unknown species' }, { status: 400 })

    // Form files and player files have inline _PALETTE exports
    const isFormFile = !lookup(SPIRIT_FILES, species) && !lookup(PLAYER_FILES, species) && !lookup(BEAST_FILES, species)
    if (info.isPlayer || isFormFile) {
      const filePath = join(SPRITE_DIR, info.file)
      let content = await readFile(filePath, 'utf-8')

      const colorStr = colors.map((c: string) => `'${c}'`).join(', ')
      // Match: export const XXX_PALETTE: [type] = [colors]
      const pattern = /(export const \w+_PALETTE[^=]*=\s*\[)[^\]]*(\])/
      if (!pattern.test(content)) {
        return NextResponse.json({ error: 'Could not find palette in file' }, { status: 400 })
      }
      content = content.replace(pattern, `$1${colorStr}$2`)
      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, species, colors })
    }

    // Beast: palette lives in beasts.ts — BEAST_PALETTES export
    if (lookup(BEAST_FILES, species)) {
      const filePath = join(SPRITE_DIR, 'beasts.ts')
      let content = await readFile(filePath, 'utf-8')

      const colorStr = colors.map((c: string) => `'${c}'`).join(', ')
      const escaped = species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`(${escaped}:\\s*\\[)[^\\]]*?(\\])`)
      if (!pattern.test(content)) {
        return NextResponse.json({ error: `Could not find ${species} palette in beasts.ts` }, { status: 400 })
      }
      content = content.replace(pattern, `$1${colorStr}$2`)
      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, species, colors })
    }

    // Spirit: palette lives in palette.ts
    if (!paletteKey)
      return NextResponse.json({ error: 'Missing paletteKey for spirit' }, { status: 400 })

    const palettePath = join(SPRITE_DIR, 'palette.ts')
    let content = await readFile(palettePath, 'utf-8')

    const escaped = paletteKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(
      `(${escaped}:\\s*\\[)[^\\]]*?(\\])`,
    )

    const speciesPattern = new RegExp(
      `(['"]?${species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?:\\s*\\{)([^}]*?)(\\})`,
      's',
    )
    const speciesMatch = content.match(speciesPattern)
    if (!speciesMatch) {
      return NextResponse.json({ error: `Could not find ${species} in palette.ts` }, { status: 400 })
    }

    let block = speciesMatch[2]
    const colorStr = colors.map((c: string) => `'${c}'`).join(', ')

    if (pattern.test(block)) {
      // Update existing palette key
      block = block.replace(pattern, `$1${colorStr}$2`)
    } else {
      // Insert new palette key after the last existing entry
      const newEntry = `\n    ${paletteKey}: [${colorStr}],`
      // Find the last palette entry (line ending with ],) and insert after it
      const lastBracket = block.lastIndexOf('],')
      if (lastBracket >= 0) {
        block = block.slice(0, lastBracket + 2) + newEntry + block.slice(lastBracket + 2)
      } else {
        // Empty block — just add the entry
        block = newEntry + '\n  '
      }
    }

    content = content.replace(speciesPattern, `$1${block}$3`)

    await writeFile(palettePath, content, 'utf-8')
    return NextResponse.json({ success: true, species, paletteKey, colors })
  } catch (e: unknown) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const species = safeId(body.species, 'species')
    const anim = safeId(body.anim, 'anim')
    const frameIndex = safeInt(body.frameIndex, 'frameIndex', 0, 999)
    const digits = body.digits
    if (typeof digits !== 'string') return NextResponse.json({ error: 'Invalid digits: expected string' }, { status: 400 })

    const info = await resolveOrCreate(species) ?? await resolveFurniture(species) ?? await resolveNodes(species) ?? await resolveItems(species)
    if (!info) return NextResponse.json({ error: 'Unknown species' }, { status: 400 })

    // Detect items that need auto-seeding (items added to ITEMS but missing from
    // ITEM_FRAME_MAP/ITEM_ICONS). Defer the actual write until after digit
    // validation passes — otherwise a bad request would leave orphan refs to a
    // non-existent const and break the build.
    const needsItemSeed = species === 'items'
      && !lookup(info.frameMap, anim) && /^[a-z][a-z0-9_]*$/.test(anim)
      && anim !== 'icon' && !lookup(BATTLE_96_MAP, anim)
    if (needsItemSeed) {
      info.frameMap[anim] = [anim.toUpperCase()]
    }

    // Resolve animation to the right const names:
    // - 'icon' → source's battle_front const names (32x32, overworld art)
    // - 'battle_front'/'battle_back' → 96x96 BF96/BB96 consts
    // - everything else → standard frameMap lookup
    let constNames: string[] | undefined
    if (anim === 'icon') {
      constNames = info.frameMap['battle_front']
    } else {
      constNames = lookup(BATTLE_96_MAP, anim) ?? lookup(info.frameMap, anim)
    }
    if (!constNames || constNames.length === 0) return NextResponse.json({ error: 'Unknown animation' }, { status: 400 })

    // For animations that reuse frames (walk uses [idle,stepL,idle,stepR]), map to unique const
    const constIdx = frameIndex % constNames.length
    const constName = constNames[constIdx]
    if (!constName) return NextResponse.json({ error: 'Invalid frame index' }, { status: 400 })

    // Sprite size depends on animation type (32x32 for battle, 16x16 for everything else)
    const spriteSize = lookup(ANIM_GRID_SIZE, anim) ?? 32
    const lines = digits.trim().split('\n').map((l: string) => l.trim())
    if (lines.length !== spriteSize || lines.some((l: string) => l.length !== spriteSize || !/^[0-9a-f]+$/i.test(l)))
      return NextResponse.json({ error: `Invalid digit format (expected ${spriteSize}x${spriteSize})` }, { status: 400 })

    const formatted = lines.map((l: string) => `  ${l}`).join('\n')
    const sizeArg = spriteSize === 16 ? 'S, S' : `${spriteSize}, ${spriteSize}`

    // Read the file
    const filePath = join(SPRITE_DIR, info.file)
    let content = await readFile(filePath, 'utf-8')

    // Find and replace the const's px() content (try both S,S and literal size)
    const patternS = new RegExp(
      `(const ${constName} = px\\(S, S, \`)([^]*?)(\`\\))`,
    )
    const patternLiteral = new RegExp(
      `(const ${constName} = px\\(${spriteSize}, ${spriteSize}, \`)([^]*?)(\`\\))`,
    )

    if (patternS.test(content)) {
      content = content.replace(patternS, `$1\n${formatted}\n$3`)
    } else if (patternLiteral.test(content)) {
      content = content.replace(patternLiteral, `$1\n${formatted}\n$3`)
    } else {
      // Const doesn't exist yet — create it before first export
      const exportIdx = content.indexOf('export const ')
      if (exportIdx < 0) {
        return NextResponse.json({ error: `Could not find ${constName} in ${info.file}` }, { status: 400 })
      }
      const lineStart = content.lastIndexOf('\n', exportIdx) + 1
      const newConst = `const ${constName} = px(${sizeArg}, \`\n${formatted}\n\`)\n\n`
      content = content.slice(0, lineStart) + newConst + content.slice(lineStart)
    }

    // Seed ITEM_FRAME_MAP and ITEM_ICONS for items added to ITEMS but never wired.
    // This runs only after the const has been created above, so the file is always
    // valid even if the request fails earlier in the flow.
    if (needsItemSeed) {
      content = upsertExportEntry(
        content,
        /(export const ITEM_FRAME_MAP[^{]*\{)([\s\S]*?)(\n\})/,
        anim,
        `['${constName}']`,
      )
      content = upsertExportEntry(
        content,
        /(export const ITEM_ICONS[^{]*\{)([\s\S]*?)(\n\})/,
        anim,
        `{ frames: [${constName}], rate: 1 }`,
      )
    }

    // Ensure SPRITES export references this animKey so the runtime can find it.
    // Without this, painted run/special phases save pixels but the game falls
    // back to walk because PLAYER_SPRITES/SPIRIT_SPRITES never gets the entry.
    if (anim !== 'icon' && !lookup(BATTLE_96_MAP, anim)) {
      const exportName = getSpritesExportName(species)
      const constNames = lookup(info.frameMap, anim)
      if (exportName && constNames && constNames.length > 0) {
        content = upsertSpritesExportEntry(content, exportName, anim, constNames, pickDefaultRate(anim))
      }
    }

    await writeFile(filePath, content, 'utf-8')

    return NextResponse.json({ success: true, saved: constName, file: info.file })
  } catch (e: unknown) {
    return errorResponse(e)
  }
}

// PATCH: add a new animation frame, rename a frame, or create a character
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()

    // --- Create a new character from template ---
    if (body.action === 'createCharacter') {
      const rawName = (body.name as string ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
      // Interpolated into PlayerEditor.tsx as `role: '${role}' as CharRole`.
      const role = safeEnum(body.role ?? 'npc', CHAR_ROLES, 'role')
      if (!rawName || rawName.length < 2)
        return NextResponse.json({ error: 'Name must be at least 2 characters (a-z only)' }, { status: 400 })
      if (lookup(PLAYER_FILES, rawName) || lookup(SPIRIT_FILES, rawName))
        return NextResponse.json({ error: `Character "${rawName}" already exists` }, { status: 400 })

      const constPrefix = rawName.toUpperCase()
      const fileName = `${rawName}.ts`
      const label = rawName.charAt(0).toUpperCase() + rawName.slice(1)

      // 1. Copy character-template.ts with renamed exports
      const templatePath = join(SPRITE_DIR, 'character-template.ts')
      let template = await readFile(templatePath, 'utf-8')
      // Replace comment header (first two lines)
      template = template.replace(
        /\/\/ Character template[^\n]*\n\/\/ Copy this file[^\n]*\n/,
        `// ${label} sprite — 16x16 pixel art\n`
      )
      template = template.replace(/TEMPLATE_PALETTE/g, `${constPrefix}_PALETTE`)
      template = template.replace(/TEMPLATE_SPRITES/g, `${constPrefix}_SPRITES`)
      await writeFile(join(SPRITE_DIR, fileName), template, 'utf-8')

      // 2. Add to PLAYER_FILES in this route file
      const routePath = join(process.cwd(), 'src/app/shimmer/save-sprite/route.ts')
      let routeContent = await readFile(routePath, 'utf-8')
      // Insert before closing } of PLAYER_FILES
      routeContent = routeContent.replace(
        /(const PLAYER_FILES[^{]*\{[^}]*)(^\})/m,
        `$1  ${rawName}: '${fileName}',\n$2`
      )
      await writeFile(routePath, routeContent, 'utf-8')

      // 3. Update PlayerEditor.tsx — add import + CHARACTERS entry
      const editorPath = join(process.cwd(), 'src/app/shimmer/dev/editors/PlayerEditor.tsx')
      let editor = await readFile(editorPath, 'utf-8')

      // Add import after last '../../sprites/' import
      const importLine = `import { ${constPrefix}_SPRITES, ${constPrefix}_PALETTE } from '../../sprites/${rawName}'`
      const lastSpriteImport = editor.lastIndexOf("from '../../sprites/")
      const lineEnd = editor.indexOf('\n', lastSpriteImport)
      editor = editor.slice(0, lineEnd + 1) + importLine + '\n' + editor.slice(lineEnd + 1)

      // Add character entry before the closing ] of CHARACTERS array
      const charsIdx = editor.indexOf('const CHARACTERS')
      if (charsIdx >= 0) {
        // Find the ']' that closes the array — scan for balanced brackets
        let depth = 0
        let arrayEnd = -1
        const startBracket = editor.indexOf('[', editor.indexOf('=', charsIdx))
        for (let i = startBracket; i < editor.length; i++) {
          if (editor[i] === '[') depth++
          else if (editor[i] === ']') { depth--; if (depth === 0) { arrayEnd = i; break } }
        }
        if (arrayEnd > 0) {
          const entry = `  { id: '${rawName}', label: '${label}', sprites: ${constPrefix}_SPRITES, palette: ${constPrefix}_PALETTE, role: '${role}' as CharRole },\n`
          editor = editor.slice(0, arrayEnd) + entry + editor.slice(arrayEnd)
        }
      }

      await writeFile(editorPath, editor, 'utf-8')

      return NextResponse.json({ success: true, id: rawName, file: fileName })
    }

    // --- Delete a character ---
    if (body.action === 'deleteCharacter') {
      const rawName = (body.name as string ?? '').toLowerCase()
      const fileName = lookup(PLAYER_FILES, rawName)
      if (!rawName || !fileName)
        return NextResponse.json({ error: `Character "${rawName}" not found` }, { status: 400 })
      // Protect built-in characters
      if (['alkin', 'kael', 'gregory'].includes(rawName))
        return NextResponse.json({ error: 'Cannot delete built-in characters' }, { status: 400 })

      const constPrefix = rawName.toUpperCase()

      // 1. Delete sprite file
      const spritePath = join(SPRITE_DIR, fileName)
      try { await readFile(spritePath, 'utf-8'); const { unlink } = await import('fs/promises'); await unlink(spritePath) } catch {}

      // 2. Remove from PLAYER_FILES in route
      const routePath = join(process.cwd(), 'src/app/shimmer/save-sprite/route.ts')
      let routeContent = await readFile(routePath, 'utf-8')
      routeContent = routeContent.replace(new RegExp(`\\s*${rawName}: '${fileName.replace('.', '\\.')}',?\\n?`), '\n')
      await writeFile(routePath, routeContent, 'utf-8')

      // 3. Remove import + CHARACTERS entry from PlayerEditor.tsx
      const editorPath = join(process.cwd(), 'src/app/shimmer/dev/editors/PlayerEditor.tsx')
      let editor = await readFile(editorPath, 'utf-8')
      // Remove import line
      editor = editor.replace(new RegExp(`import \\{ ${constPrefix}_SPRITES, ${constPrefix}_PALETTE \\} from '../../sprites/${rawName}'\\n`), '')
      // Remove CHARACTERS entry
      editor = editor.replace(new RegExp(`\\s*\\{ id: '${rawName}'[^}]*\\},?\\n?`), '\n')
      await writeFile(editorPath, editor, 'utf-8')

      return NextResponse.json({ success: true, deleted: rawName })
    }

    // --- Toggle spirit species launch status ---
    if (body.action === 'toggleLaunch') {
      const sp = body.species as string
      if (!sp || !lookup(SPIRIT_FILES, sp))
        return NextResponse.json({ error: 'Invalid species' }, { status: 400 })

      const indexPath = join(process.cwd(), 'src/app/shimmer/engine/spirit-index.ts')
      let content = await readFile(indexPath, 'utf-8')

      // Parse current LAUNCHED_SPECIES array
      const match = content.match(/export const LAUNCHED_SPECIES: Species\[\] = \[([^\]]*)\]/)
      if (!match) return NextResponse.json({ error: 'Could not find LAUNCHED_SPECIES' }, { status: 500 })

      const current = match[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean)
      const isLaunched = current.includes(sp)

      if (isLaunched) {
        // Remove
        const updated = current.filter(s => s !== sp)
        content = content.replace(match[0], `export const LAUNCHED_SPECIES: Species[] = [${updated.map(s => `'${s}'`).join(', ')}]`)
      } else {
        // Add
        current.push(sp)
        content = content.replace(match[0], `export const LAUNCHED_SPECIES: Species[] = [${current.map(s => `'${s}'`).join(', ')}]`)
      }

      await writeFile(indexPath, content, 'utf-8')
      return NextResponse.json({ success: true, launched: !isLaunched })
    }

    // Everything below names a sprite file, a frame const, or a frame-map key.
    const species = safeId(body.species, 'species')
    const anim = body.anim === undefined || body.anim === '' ? undefined : safeId(body.anim, 'anim')
    const item = body.item === undefined || body.item === '' ? undefined : safeId(body.item, 'item')
    const node = body.node === undefined || body.node === '' ? undefined : safeId(body.node, 'node')
    const frameName = body.frameName === undefined || body.frameName === '' ? undefined : safeId(body.frameName, 'frameName')
    const newName = body.newName === undefined || body.newName === '' ? undefined : safeId(body.newName, 'newName')
    const insertAt = body.insertAt === undefined ? undefined : safeInt(body.insertAt, 'insertAt', 0, 999)
    const renameIdx = body.renameFrame === undefined ? undefined : safeInt(body.renameFrame, 'renameFrame', 0, 999)

    const speciesSpiritFile = lookup(SPIRIT_FILES, species)
    const speciesPlayerFile = lookup(PLAYER_FILES, species)

    // --- Rename an existing frame ---
    const renameInfo = (speciesSpiritFile || speciesPlayerFile) ? null : await resolve(species)
    if (((speciesSpiritFile || speciesPlayerFile) || renameInfo) && anim && typeof renameIdx === 'number' && newName) {
      const file = speciesSpiritFile ?? speciesPlayerFile ?? renameInfo!.file
      const filePath = join(SPRITE_DIR, file)
      let content = await readFile(filePath, 'utf-8')

      const defaultMap = speciesPlayerFile ? PLAYER_FRAME_MAP : SPIRIT_FRAME_MAP
      const frameMap = parseSpriteExportFrameMap(content, defaultMap)
      const currentFrames = anim === 'icon' ? frameMap['battle_front']
        : lookup(BATTLE_96_MAP, anim) ?? lookup(frameMap, anim)
      if (!currentFrames || renameIdx >= currentFrames.length)
        return NextResponse.json({ error: `Frame ${renameIdx} out of range` }, { status: 400 })

      const oldName = currentFrames[renameIdx]
      const safeName = newName.replace(/[^A-Z0-9_]/g, '')
      if (!safeName || safeName === oldName)
        return NextResponse.json({ error: 'Invalid or unchanged name' }, { status: 400 })

      // Check no collision with existing const
      if (new RegExp(`\\bconst ${safeName}\\b`).test(content))
        return NextResponse.json({ error: `Name ${safeName} already exists` }, { status: 400 })

      // Rename const declaration and all references
      content = content.replace(new RegExp(`\\b${oldName}\\b`, 'g'), safeName)

      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, oldName, newName: safeName })
    }

    // --- Spirits/Players/Forms: add frame to an animation ---
    const addFrameInfo = (speciesSpiritFile || speciesPlayerFile) ? null : await resolveOrCreate(species)
    if (((speciesSpiritFile || speciesPlayerFile) || addFrameInfo) && anim) {
      const file = speciesSpiritFile ?? speciesPlayerFile ?? addFrameInfo!.file
      const filePath = join(SPRITE_DIR, file)
      let content = await readFile(filePath, 'utf-8')

      // Only hand-built species (no deriveSprites)
      if (content.includes('deriveSprites(')) {
        return NextResponse.json({ error: 'Cannot add frames to derived species yet' }, { status: 400 })
      }

      const defaultMap = speciesPlayerFile ? PLAYER_FRAME_MAP : SPIRIT_FRAME_MAP
      const frameMap = parseSpriteExportFrameMap(content, defaultMap)
      const resolvedAnim = anim === 'icon' ? 'battle_front' : anim
      const currentFrames = anim === 'icon' ? frameMap['battle_front']
        : lookup(BATTLE_96_MAP, anim) ?? lookup(frameMap, anim)
      if (!currentFrames)
        return NextResponse.json({ error: `Unknown animation: ${anim}` }, { status: 400 })

      // Use custom name if provided, otherwise auto-generate
      const gridSize = lookup(ANIM_GRID_SIZE, anim) ?? 32
      let newConstName: string
      if (frameName) {
        const safeName = frameName.toUpperCase().replace(/[^A-Z0-9_]/g, '')
        if (!safeName) return NextResponse.json({ error: 'Invalid frame name' }, { status: 400 })
        if (new RegExp(`\\bconst ${safeName}\\b`).test(content))
          return NextResponse.json({ error: `Name ${safeName} already exists` }, { status: 400 })
        newConstName = safeName
      } else {
        const prefix = resolvedAnim.toUpperCase()
        let nameIdx = currentFrames.length
        newConstName = `${prefix}_${nameIdx}`
        while (new RegExp(`\\bconst ${newConstName}\\b`).test(content)) {
          nameIdx++
          newConstName = `${prefix}_${nameIdx}`
        }
      }

      // Create blank const before the export
      const sizeArg = gridSize === 16 ? 'S, S' : `${gridSize}, ${gridSize}`
      const blankLines = Array(gridSize).fill('  ' + '0'.repeat(gridSize)).join('\n')
      const newConst = `const ${newConstName} = px(${sizeArg}, \`\n${blankLines}\n\`)\n\n`
      const exportIdx = content.indexOf('export const ')
      if (exportIdx < 0)
        return NextResponse.json({ error: 'Could not find export in file' }, { status: 500 })
      const lineStart = content.lastIndexOf('\n', exportIdx) + 1
      content = content.slice(0, lineStart) + newConst + content.slice(lineStart)

      // Update the animation entry: insert new const into frames array at position
      // Use \b word boundary to avoid matching inside longer animation names (e.g. idle inside down_idle)
      const escaped = resolvedAnim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const insertIdx = insertAt
      const animPattern = new RegExp(
        `(\\b${escaped}:\\s*\\{\\s*frames:\\s*\\[)([^\\]]*)(\\],\\s*rate:\\s*)(\\d+)`
      )
      content = content.replace(animPattern, (_match, prefix, framesList, suffix, rate) => {
        const frames = framesList.split(',').map((f: string) => f.trim()).filter(Boolean)
        if (insertIdx !== undefined && insertIdx >= 0 && insertIdx <= frames.length) {
          frames.splice(insertIdx, 0, newConstName)
        } else {
          frames.push(newConstName)
        }
        return `${prefix}${frames.join(', ')}${suffix}${rate}`
      })

      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, frameCount: currentFrames.length + 1, constName: newConstName })
    }

    // --- Nodes: add frame to a resource node sprite ---
    if (species === 'nodes' && node) {
      const filePath = join(SPRITE_DIR, 'items.ts')
      let content = await readFile(filePath, 'utf-8')

      const frameMap = parseNodeFrameMap(content)
      const currentFrames = lookup(frameMap, node)
      if (!currentFrames || currentFrames.length === 0)
        return NextResponse.json({ error: `Unknown node: ${node}` }, { status: 400 })

      const baseName = currentFrames[0]
      // Find next unused suffix (handles gaps from deleted frames)
      let newIndex = currentFrames.length
      while (content.includes(`const ${baseName}_${newIndex} `)) newIndex++
      const newConstName = `${baseName}_${newIndex}`

      // Create blank 16x16 frame
      const blankLines = Array(16).fill('  0000000000000000').join('\n')
      const newConst = `const ${newConstName} = px(S, S, \`\n${blankLines}\n\`)\n\n`

      // Insert before NODE_SPRITES export
      const spritesIdx = content.indexOf('export const NODE_SPRITES')
      if (spritesIdx < 0)
        return NextResponse.json({ error: 'Could not find NODE_SPRITES' }, { status: 500 })
      content = content.slice(0, spritesIdx) + newConst + content.slice(spritesIdx)

      // Update NODE_FRAME_MAP: append new const name to array
      const escaped = node.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const fmapPattern = new RegExp(`(${escaped}:\\s*\\[[^\\]]*)\\]`)
      content = content.replace(fmapPattern, `$1, '${newConstName}']`)

      // Update NODE_SPRITES: add new frame ref and set rate for animation
      const nodeType = node.replace(/_[hd]$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const state = node.endsWith('_d') ? 'depleted' : 'harvestable'
      const spritePattern = new RegExp(
        `(${nodeType}:.*?${state}:\\s*\\{\\s*frames:\\s*\\[[^\\]]*)\\](,\\s*rate:\\s*)\\d+`
      )
      content = content.replace(spritePattern, `$1, ${newConstName}]$28`)

      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, frameCount: newIndex + 1, constName: newConstName })
    }

    // --- Furniture: add frame to a furniture sprite ---
    if (species === 'furniture' && anim) {
      const filePath = join(SPRITE_DIR, 'furniture.ts')
      let content = await readFile(filePath, 'utf-8')

      const frameMap = parseFurnitureFrameMap(content)
      const currentFrames = lookup(frameMap, anim)
      if (!currentFrames || currentFrames.length === 0)
        return NextResponse.json({ error: `Unknown furniture: ${anim}` }, { status: 400 })

      const baseName = currentFrames[0]
      let newIndex = currentFrames.length
      while (content.includes(`const ${baseName}_${newIndex} `)) newIndex++
      const newConstName = `${baseName}_${newIndex}`

      // Create blank 32x32 frame
      const blankLines = Array(32).fill('  ' + '0'.repeat(32)).join('\n')
      const newConst = `const ${newConstName} = px(S, S, \`\n${blankLines}\n\`)\n\n`

      // Insert before FURNITURE_SPRITES export
      const spritesIdx = content.indexOf('export const FURNITURE_SPRITES')
      if (spritesIdx < 0)
        return NextResponse.json({ error: 'Could not find FURNITURE_SPRITES' }, { status: 500 })
      content = content.slice(0, spritesIdx) + newConst + content.slice(spritesIdx)

      // Update FURNITURE_FRAME_MAP: append new const name
      const escaped = anim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const fmapPattern = new RegExp(`(${escaped}:\\s*\\[[^\\]]*)\\]`)
      content = content.replace(fmapPattern, `$1, '${newConstName}']`)

      // Update FURNITURE_SPRITES and FURNITURE_ICONS (both use { frames: [...], rate: N } format)
      const spriteIconPattern = new RegExp(
        `(${escaped}:\\s*\\{\\s*frames:\\s*\\[[^\\]]*)\\](,\\s*rate:\\s*)\\d+`,
        'g'
      )
      content = content.replace(spriteIconPattern, `$1, ${newConstName}]$28`)

      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, frameCount: newIndex + 1, constName: newConstName })
    }

    // --- Items: add frame to an item sprite ---
    if (species !== 'items' || !item)
      return NextResponse.json({ error: 'Invalid PATCH params' }, { status: 400 })

    const filePath = join(SPRITE_DIR, 'items.ts')
    let content = await readFile(filePath, 'utf-8')

    const frameMap = parseItemFrameMap(content)
    const currentFrames = lookup(frameMap, item)
    if (!currentFrames || currentFrames.length === 0)
      return NextResponse.json({ error: `Unknown item: ${item}` }, { status: 400 })

    const baseName = currentFrames[0]
    let newIndex = currentFrames.length
    while (content.includes(`const ${baseName}_${newIndex} `)) newIndex++
    const newConstName = `${baseName}_${newIndex}`

    // Create blank 16x16 frame
    const blankLines = Array(16).fill('  0000000000000000').join('\n')
    const newConst = `const ${newConstName} = px(S, S, \`\n${blankLines}\n\`)\n\n`

    // Insert before ITEM_FRAME_MAP export
    const mapIdx = content.indexOf('export const ITEM_FRAME_MAP')
    if (mapIdx < 0)
      return NextResponse.json({ error: 'Could not find ITEM_FRAME_MAP' }, { status: 500 })
    content = content.slice(0, mapIdx) + newConst + content.slice(mapIdx)

    // Update ITEM_FRAME_MAP: append new const name to array.
    // CRITICAL: scope to ITEM_FRAME_MAP block. The unscoped regex matched
    // ITEM_PALETTES first (same `<item>: [...]` shape) and corrupted palette
    // arrays with const-name strings.
    const escapedItem = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const fmapBlock = content.match(/(export const ITEM_FRAME_MAP[^{]*\{)([\s\S]*?)(\n\})/)
    if (!fmapBlock) {
      return NextResponse.json({ error: 'Could not find ITEM_FRAME_MAP block' }, { status: 500 })
    }
    const fmapPattern = new RegExp(`(\\b${escapedItem}:\\s*\\[[^\\]]*)\\]`)
    if (!fmapPattern.test(fmapBlock[2])) {
      return NextResponse.json({ error: `Item ${item} not in ITEM_FRAME_MAP` }, { status: 400 })
    }
    const newFmapBody = fmapBlock[2].replace(fmapPattern, `$1, '${newConstName}']`)
    content = content.replace(fmapBlock[0], `${fmapBlock[1]}${newFmapBody}${fmapBlock[3]}`)

    // Update ITEM_ICONS: append new frame ref. Scoped via the `frames: [` token
    // which only appears in ITEM_ICONS. Preserves existing rate (was hardcoded to 8).
    const iconBlock = content.match(/(export const ITEM_ICONS[^{]*\{)([\s\S]*?)(\n\})/)
    if (iconBlock) {
      const iconPattern = new RegExp(`(\\b${escapedItem}:\\s*\\{\\s*frames:\\s*\\[[^\\]]*)\\]`)
      if (iconPattern.test(iconBlock[2])) {
        const newIconBody = iconBlock[2].replace(iconPattern, `$1, ${newConstName}]`)
        content = content.replace(iconBlock[0], `${iconBlock[1]}${newIconBody}${iconBlock[3]}`)
      }
    }

    await writeFile(filePath, content, 'utf-8')

    return NextResponse.json({ success: true, frameCount: newIndex + 1, constName: newConstName })
  } catch (e: unknown) {
    return errorResponse(e)
  }
}

// DELETE: remove an animation frame from a sprite
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const species = safeId(body.species, 'species')
    const anim = body.anim === undefined || body.anim === '' ? undefined : safeId(body.anim, 'anim')
    const item = body.item === undefined || body.item === '' ? undefined : safeId(body.item, 'item')
    const node = body.node === undefined || body.node === '' ? undefined : safeId(body.node, 'node')
    const fi = safeInt(body.frameIndex, 'frameIndex', 0, 999)

    const speciesSpiritFile = lookup(SPIRIT_FILES, species)
    const speciesPlayerFile = lookup(PLAYER_FILES, species)

    // --- Spirits/Players/Forms ---
    const deleteInfo = (speciesSpiritFile || speciesPlayerFile) ? null : await resolve(species)
    if (((speciesSpiritFile || speciesPlayerFile) || deleteInfo) && anim) {
      const file = speciesSpiritFile ?? speciesPlayerFile ?? deleteInfo!.file
      const filePath = join(SPRITE_DIR, file)
      let content = await readFile(filePath, 'utf-8')

      const defaultMap = speciesPlayerFile ? PLAYER_FRAME_MAP : SPIRIT_FRAME_MAP
      const frameMap = parseSpriteExportFrameMap(content, defaultMap)
      // Resolve animation key: 'icon' maps to source's battle_front, 32x32 battle uses BATTLE_96_MAP
      const resolvedAnim = anim === 'icon' ? 'battle_front' : anim
      const currentFrames = anim === 'icon' ? frameMap['battle_front']
        : lookup(BATTLE_96_MAP, anim) ?? lookup(frameMap, anim)
      if (!currentFrames || fi >= currentFrames.length)
        return NextResponse.json({ error: `Frame ${fi} out of range` }, { status: 400 })
      if (currentFrames.length <= 1)
        return NextResponse.json({ error: 'Cannot delete the last frame' }, { status: 400 })

      const constName = currentFrames[fi]

      // Remove from animation frames array — use resolvedAnim to match source file key
      const escaped = resolvedAnim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const animPattern = new RegExp(
        `(\\b${escaped}:\\s*\\{\\s*frames:\\s*\\[)([^\\]]*)(\\])`
      )
      content = content.replace(animPattern, (_match, prefix, framesList, suffix) => {
        const frames = framesList.split(',').map((f: string) => f.trim()).filter(Boolean)
        frames.splice(fi, 1)
        return `${prefix}${frames.join(', ')}${suffix}`
      })

      // If const no longer used anywhere, delete the definition
      const usageCount = (content.match(new RegExp(`\\b${constName}\\b`, 'g')) || []).length
      if (usageCount <= 1) {
        // Remove const block: const NAME = px(S, S, `...`)
        const constPattern = new RegExp(`const ${constName} = px\\([^)]*,\\s*[^)]*,\\s*\`[^]*?\`\\)\\n*`, '')
        content = content.replace(constPattern, '')
      }

      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, frameCount: currentFrames.length - 1 })
    }

    // --- Nodes ---
    if (species === 'nodes' && node) {
      const filePath = join(SPRITE_DIR, 'items.ts')
      let content = await readFile(filePath, 'utf-8')

      const frameMap = parseNodeFrameMap(content)
      const currentFrames = lookup(frameMap, node)
      if (!currentFrames || fi >= currentFrames.length)
        return NextResponse.json({ error: `Frame ${fi} out of range` }, { status: 400 })
      if (currentFrames.length <= 1)
        return NextResponse.json({ error: 'Cannot delete the last frame' }, { status: 400 })

      const constName = currentFrames[fi]

      // Remove from NODE_FRAME_MAP
      const fmapEscaped = node.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const fmapPattern = new RegExp(`(${fmapEscaped}:\\s*\\[)([^\\]]*)(\\])`)
      content = content.replace(fmapPattern, (_m, pre, list, suf) => {
        const names = list.match(/'([^']+)'/g)?.map((s: string) => s.replace(/'/g, '')) ?? []
        names.splice(fi, 1)
        return `${pre}${names.map((n: string) => `'${n}'`).join(', ')}${suf}`
      })

      // Remove from NODE_SPRITES frames array
      const nodeType = node.replace(/_[hd]$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const state = node.endsWith('_d') ? 'depleted' : 'harvestable'
      const spritePattern = new RegExp(
        `(${nodeType}:.*?${state}:\\s*\\{\\s*frames:\\s*\\[)([^\\]]*)(\\])`
      )
      content = content.replace(spritePattern, (_m, pre, list, suf) => {
        const frames = list.split(',').map((f: string) => f.trim()).filter(Boolean)
        const idx = frames.indexOf(constName)
        if (idx >= 0) frames.splice(idx, 1)
        return `${pre}${frames.join(', ')}${suf}`
      })

      // Delete const if unused (definition itself counts as 1 reference)
      const usageCount = (content.match(new RegExp(`\\b${constName}\\b`, 'g')) || []).length
      if (usageCount <= 1) {
        const constPattern = new RegExp(`const ${constName} = px\\([^)]*,\\s*[^)]*,\\s*\`[^]*?\`\\)\\n*`, '')
        content = content.replace(constPattern, '')
      }

      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, frameCount: currentFrames.length - 1 })
    }

    // --- Items ---
    if (species === 'items' && item) {
      const filePath = join(SPRITE_DIR, 'items.ts')
      let content = await readFile(filePath, 'utf-8')

      const frameMap = parseItemFrameMap(content)
      const currentFrames = lookup(frameMap, item)
      if (!currentFrames || fi >= currentFrames.length)
        return NextResponse.json({ error: `Frame ${fi} out of range` }, { status: 400 })
      if (currentFrames.length <= 1)
        return NextResponse.json({ error: 'Cannot delete the last frame' }, { status: 400 })

      const constName = currentFrames[fi]

      // Remove from ITEM_FRAME_MAP
      const fmapPattern = new RegExp(`(${item}:\\s*\\[)([^\\]]*)(\\])`)
      content = content.replace(fmapPattern, (_m, pre, list, suf) => {
        const names = list.match(/'([^']+)'/g)?.map((s: string) => s.replace(/'/g, '')) ?? []
        names.splice(fi, 1)
        return `${pre}${names.map((n: string) => `'${n}'`).join(', ')}${suf}`
      })

      // Remove from ITEM_ICONS frames array
      const iconPattern = new RegExp(`(${item}:\\s*\\{\\s*frames:\\s*\\[)([^\\]]*)(\\])`)
      content = content.replace(iconPattern, (_m, pre, list, suf) => {
        const frames = list.split(',').map((f: string) => f.trim()).filter(Boolean)
        const idx = frames.indexOf(constName)
        if (idx >= 0) frames.splice(idx, 1)
        return `${pre}${frames.join(', ')}${suf}`
      })

      // Delete const if unused (definition itself counts as 1 reference)
      const usageCount = (content.match(new RegExp(`\\b${constName}\\b`, 'g')) || []).length
      if (usageCount <= 1) {
        const constPattern = new RegExp(`const ${constName} = px\\([^)]*,\\s*[^)]*,\\s*\`[^]*?\`\\)\\n*`, '')
        content = content.replace(constPattern, '')
      }

      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, frameCount: currentFrames.length - 1 })
    }

    // --- Furniture ---
    if (species === 'furniture' && anim) {
      const filePath = join(SPRITE_DIR, 'furniture.ts')
      let content = await readFile(filePath, 'utf-8')

      const frameMap = parseFurnitureFrameMap(content)
      const currentFrames = lookup(frameMap, anim)
      if (!currentFrames || fi >= currentFrames.length)
        return NextResponse.json({ error: `Frame ${fi} out of range` }, { status: 400 })
      if (currentFrames.length <= 1)
        return NextResponse.json({ error: 'Cannot delete the last frame' }, { status: 400 })

      const constName = currentFrames[fi]

      // Remove from FURNITURE_FRAME_MAP
      const escaped = anim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const fmapPattern = new RegExp(`(${escaped}:\\s*\\[)([^\\]]*)(\\])`)
      content = content.replace(fmapPattern, (_m: string, pre: string, list: string, suf: string) => {
        const names = list.match(/'([^']+)'/g)?.map((s: string) => s.replace(/'/g, '')) ?? []
        names.splice(fi, 1)
        return `${pre}${names.map((n: string) => `'${n}'`).join(', ')}${suf}`
      })

      // Remove from FURNITURE_SPRITES and FURNITURE_ICONS frames arrays (both use same format)
      const spriteIconPattern = new RegExp(
        `(${escaped}:\\s*\\{\\s*frames:\\s*\\[)([^\\]]*)(\\])`,
        'g'
      )
      content = content.replace(spriteIconPattern, (_m: string, pre: string, list: string, suf: string) => {
        const frames = list.split(',').map((f: string) => f.trim()).filter(Boolean)
        const idx = frames.indexOf(constName)
        if (idx >= 0) frames.splice(idx, 1)
        return `${pre}${frames.join(', ')}${suf}`
      })

      // Delete const if unused
      const usageCount = (content.match(new RegExp(`\\b${constName}\\b`, 'g')) || []).length
      if (usageCount <= 1) {
        const constPattern = new RegExp(`const ${constName} = px\\([^)]*,\\s*[^)]*,\\s*\`[^]*?\`\\)\\n*`, '')
        content = content.replace(constPattern, '')
      }

      await writeFile(filePath, content, 'utf-8')
      return NextResponse.json({ success: true, frameCount: currentFrames.length - 1 })
    }

    return NextResponse.json({ error: 'Invalid DELETE params' }, { status: 400 })
  } catch (e: unknown) {
    return errorResponse(e)
  }
}
