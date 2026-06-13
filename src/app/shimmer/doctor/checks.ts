// Shimmer Doctor — read-only consistency checker.
// Scans sprite sources, editor maps, save-route maps, sidecar JSON, and world data
// for the desync bug classes we've hit repeatedly (frame-map drift, orphan frames,
// duplicate keys, palette range overflows, stale deploys, broken warps).
// Never mutates anything.

import { promises as fs } from 'fs'
import path from 'path'

const SHIMMER = path.join(process.cwd(), 'src/app/shimmer')

export interface Finding {
  severity: 'error' | 'warn' | 'info'
  domain: string
  check: string
  message: string
  file?: string
}

export interface DoctorReport {
  generatedAt: string
  counts: { error: number; warn: number; info: number }
  findings: Finding[]
}

// ---------- file cache ----------

const cache = new Map<string, string | null>()

async function read(rel: string): Promise<string | null> {
  if (cache.has(rel)) return cache.get(rel)!
  try {
    const content = await fs.readFile(path.join(SHIMMER, rel), 'utf8')
    cache.set(rel, content)
    return content
  } catch {
    cache.set(rel, null)
    return null
  }
}

// ---------- parsing helpers ----------

/** Extract a brace-matched block starting at the first `open` char at/after startIdx. */
function braceBlock(content: string, startIdx: number, open = '{', close = '}'): string | null {
  const first = content.indexOf(open, startIdx)
  if (first === -1) return null
  let depth = 0
  let inStr: string | null = null
  for (let i = first; i < content.length; i++) {
    const ch = content[i]
    if (inStr) {
      if (ch === '\\') i++
      else if (ch === inStr) inStr = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return content.slice(first, i + 1)
    }
  }
  return null
}

/** Block of `export const NAME` / `const NAME` (object or array literal). */
function exportBlock(content: string, name: string, open = '{', close = '}'): string | null {
  const m = content.match(new RegExp(`(?:export )?const ${name}\\b[^=]*=`))
  if (!m || m.index === undefined) return null
  return braceBlock(content, m.index + m[0].length, open, close)
}

/** Top-level keys of an object literal block — a key counts if its line STARTS at depth 1,
 *  so `fox: { ...multi-line... }` is captured (the brace it opens doesn't hide it). */
function objectKeys(block: string): string[] {
  const keys: string[] = []
  let depth = 0
  let inStr: string | null = null
  for (const line of block.split('\n')) {
    const startDepth = depth
    const startedInStr = inStr !== null
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inStr) {
        if (ch === '\\') i++
        else if (ch === inStr) inStr = null
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') inStr = ch
      else if (ch === '/' && line[i + 1] === '/') break
      else if (ch === '{' || ch === '[') depth++
      else if (ch === '}' || ch === ']') depth--
    }
    if (startDepth === 1 && !startedInStr) {
      const m = line.match(/^\s*['"]?([\w-]+)['"]?\s*:/)
      if (m) keys.push(m[1])
    }
  }
  return keys
}

/** Parse `key: 'value'` string pairs from an object block. */
function stringPairs(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(block))) out[m[1]] = m[2]
  return out
}

/** Parse `anim: { frames: [A, B], ... }` entries from a SPRITES-style block. Returns anim -> const names. */
function framesEntries(block: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const re = /([\w-]+)\s*:\s*\{\s*frames:\s*\[([^\]]*)\]/g
  let m
  while ((m = re.exec(block))) {
    out[m[1]] = m[2].split(',').map(s => s.trim()).filter(s => /^[A-Z_][A-Z0-9_]*$/.test(s))
  }
  return out
}

/** All `const NAME = px(W, H, \`digits\`)` declarations in a file. */
interface PxConst { name: string; w: number; h: number; rows: string[]; index: number }

function pxConsts(content: string): PxConst[] {
  const out: PxConst[] = []
  const sMatch = content.match(/const S\s*=\s*(\d+)/)
  const S = sMatch ? parseInt(sMatch[1], 10) : 32
  const re = /(?:export )?const ([A-Z][A-Z0-9_]*)\s*=\s*px\(\s*(\w+)\s*,\s*(\w+)\s*,\s*`([^`]*)`/g
  let m
  while ((m = re.exec(content))) {
    const dim = (t: string) => (/^\d+$/.test(t) ? parseInt(t, 10) : S)
    const rows = m[4].split('\n').map(r => r.replace(/[^0-9a-fA-F]/g, '')).filter(r => r.length > 0)
    out.push({ name: m[1], w: dim(m[2]), h: dim(m[3]), rows, index: m.index })
  }
  return out
}

function paletteLength(content: string, name: string): number | null {
  const block = exportBlock(content, name, '[', ']')
  if (!block) return null
  return (block.match(/['"]#?[0-9a-fA-F]{3,8}['"]/g) || []).length
}

function setDiff(a: string[], b: string[]): string[] {
  const bs = new Set(b)
  return a.filter(x => !bs.has(x))
}

// ---------- checks ----------

type Add = (f: Finding) => void

async function checkPlayerFrameMaps(add: Add) {
  const route = await read('save-sprite/route.ts')
  const editor = await read('dev/editors/PlayerEditor.tsx')
  if (!route || !editor) return
  const routeKeys = objectKeys(exportBlock(route, 'PLAYER_FRAME_MAP') ?? '')
  const editorKeys = objectKeys(exportBlock(editor, 'FRAME_CONST_MAP') ?? '')
  if (!routeKeys.length || !editorKeys.length) {
    add({ severity: 'info', domain: 'framemaps', check: 'player-map-sync', message: 'Could not parse PLAYER_FRAME_MAP or FRAME_CONST_MAP — parser drift, update doctor.' })
    return
  }
  for (const k of setDiff(editorKeys, routeKeys))
    add({ severity: 'error', domain: 'framemaps', check: 'player-map-sync', file: 'save-sprite/route.ts', message: `Anim '${k}' exists in PlayerEditor FRAME_CONST_MAP but not route PLAYER_FRAME_MAP — saving it returns "Unknown animation".` })
  for (const k of setDiff(routeKeys, editorKeys))
    add({ severity: 'warn', domain: 'framemaps', check: 'player-map-sync', file: 'dev/editors/PlayerEditor.tsx', message: `Anim '${k}' exists in route PLAYER_FRAME_MAP but not PlayerEditor FRAME_CONST_MAP — invisible in the editor.` })
}

async function checkBeastFrameMaps(add: Add) {
  const route = await read('save-sprite/route.ts')
  const editor = await read('dev/editors/BeastEditor.tsx')
  if (!route || !editor) return
  const fnMatch = route.match(/function beastFrameMap\s*\([^)]*\)/)
  const fnBlock = fnMatch && fnMatch.index !== undefined ? braceBlock(route, fnMatch.index) : null
  const retBlock = fnBlock ? braceBlock(fnBlock, fnBlock.indexOf('return')) : null
  const routeKeys = retBlock ? objectKeys(retBlock) : []
  const editorKeys = objectKeys(exportBlock(editor, 'DEFAULT_FRAME_CONST_MAP') ?? '')
  if (!routeKeys.length || !editorKeys.length) {
    add({ severity: 'info', domain: 'framemaps', check: 'beast-map-sync', message: 'Could not parse beastFrameMap or DEFAULT_FRAME_CONST_MAP — parser drift, update doctor.' })
    return
  }
  for (const k of setDiff(editorKeys, routeKeys))
    add({ severity: 'error', domain: 'framemaps', check: 'beast-map-sync', file: 'save-sprite/route.ts', message: `Beast anim '${k}' in BeastEditor map but not route beastFrameMap() — saving it fails.` })
  for (const k of setDiff(routeKeys, editorKeys))
    add({ severity: 'warn', domain: 'framemaps', check: 'beast-map-sync', file: 'dev/editors/BeastEditor.tsx', message: `Beast anim '${k}' in route beastFrameMap() but not BeastEditor map — invisible in the editor.` })
}

async function checkCharacterRegistries(add: Add) {
  const route = await read('save-sprite/route.ts')
  const editor = await read('dev/editors/PlayerEditor.tsx')
  const page = await read('page.tsx')
  if (!route || !editor || !page) return
  const routeIds = Object.keys(stringPairs(exportBlock(route, 'PLAYER_FILES') ?? ''))
  const charBlock = exportBlock(editor, 'CHARACTERS', '[', ']') ?? ''
  const editorIds = [...charBlock.matchAll(/\bid:\s*'([\w-]+)'/g)].map(m => m[1])
  const pageBlock = exportBlock(page, 'PLAYABLE_CHARACTERS', '[', ']') ?? ''
  const pageIds = [...pageBlock.matchAll(/\bid:\s*'([\w-]+)'/g)].map(m => m[1])
  if (!routeIds.length) return
  for (const id of setDiff(editorIds, routeIds))
    add({ severity: 'error', domain: 'registries', check: 'character-registry', file: 'save-sprite/route.ts', message: `Character '${id}' is in PlayerEditor CHARACTERS but not route PLAYER_FILES — all saves for it fail.` })
  for (const id of setDiff(pageIds, routeIds))
    add({ severity: 'error', domain: 'registries', check: 'character-registry', file: 'page.tsx', message: `Character '${id}' is playable in page.tsx but missing from route PLAYER_FILES.` })
  for (const id of setDiff(routeIds, editorIds))
    add({ severity: 'warn', domain: 'registries', check: 'character-registry', file: 'dev/editors/PlayerEditor.tsx', message: `Character '${id}' is in route PLAYER_FILES but not editable in PlayerEditor.` })
  // file existence
  const files = stringPairs(exportBlock(route, 'PLAYER_FILES') ?? '')
  for (const [id, f] of Object.entries(files))
    if ((await read(`sprites/${f}`)) === null)
      add({ severity: 'error', domain: 'registries', check: 'sprite-file-exists', message: `PLAYER_FILES maps '${id}' to sprites/${f} which does not exist.` })
  const spiritFiles = stringPairs(exportBlock(route, 'SPIRIT_FILES') ?? '')
  for (const [id, f] of Object.entries(spiritFiles))
    if ((await read(`sprites/${f}`)) === null)
      add({ severity: 'error', domain: 'registries', check: 'sprite-file-exists', message: `SPIRIT_FILES maps '${id}' to sprites/${f} which does not exist.` })
}

/** Per sprite file: duplicate keys, orphan px consts, undefined frame refs, px dimension sanity, palette digit range. */
async function checkSpriteFile(add: Add, rel: string, spritesExport: string, paletteExport: string | null) {
  const content = await read(rel)
  if (!content) return
  const consts = pxConsts(content)
  const constNames = new Set(consts.map(c => c.name))
  const block = exportBlock(content, spritesExport)
  const entries = block ? framesEntries(block) : {}

  // duplicate keys in the sprites export
  if (block) {
    const keys = objectKeys(block)
    const seen = new Set<string>()
    for (const k of keys) {
      if (seen.has(k))
        add({ severity: 'error', domain: 'sprites', check: 'duplicate-key', file: rel, message: `Duplicate key '${k}' in ${spritesExport} — TypeScript build will fail or silently drop one.` })
      seen.add(k)
    }
  }

  // frames referencing consts that don't exist
  const referenced = new Set<string>()
  for (const [anim, frames] of Object.entries(entries))
    for (const f of frames) {
      referenced.add(f)
      if (!constNames.has(f) && !content.includes(`const ${f} `) && !content.includes(`import`) /* keep simple */)
        add({ severity: 'error', domain: 'sprites', check: 'undefined-frame-ref', file: rel, message: `${spritesExport}.${anim} references '${f}' but no such const exists in ${rel}.` })
    }

  // orphan painted consts (defined, never referenced anywhere else in the file)
  for (const c of consts) {
    const uses = (content.match(new RegExp(`\\b${c.name}\\b`, 'g')) || []).length
    if (uses <= 1)
      add({ severity: 'warn', domain: 'sprites', check: 'orphan-frame', file: rel, message: `'${c.name}' is painted but referenced nowhere — it will never render in game.` })
  }

  // px dimension sanity: row widths / counts vs declared size
  for (const c of consts) {
    const total = c.rows.reduce((n, r) => n + r.length, 0)
    if (total === 0) continue
    if (total !== c.w * c.h) {
      const widths = [...new Set(c.rows.map(r => r.length))].join('/')
      const wired = referenced.has(c.name)
      add({
        severity: wired ? 'error' : 'warn', domain: 'sprites', check: 'px-size-mismatch', file: rel,
        message: `'${c.name}' declares ${c.w}x${c.h} (${c.w * c.h} px) but contains ${total} digits (row widths: ${widths}) — ${wired ? 'wired into an animation, renders garbled in game.' : 'unwired (16px-era leftover), would garble if wired.'}`,
      })
    }
  }

  // palette digit range
  if (paletteExport) {
    const palLen = paletteLength(content, paletteExport)
    if (palLen !== null) {
      for (const c of consts) {
        let max = 0
        for (const row of c.rows)
          for (const ch of row) {
            const v = parseInt(ch, 16)
            if (v > max) max = v
          }
        if (max > palLen)
          add({ severity: referenced.has(c.name) ? 'error' : 'warn', domain: 'palettes', check: 'palette-range', file: rel, message: `'${c.name}' uses color index ${max} but ${paletteExport} has only ${palLen} colors — out-of-range pixels render in the previous draw color (the "colors look wrong" bug).` })
      }
    }
  }
}

async function checkBeastPalettes(add: Add) {
  const content = await read('sprites/beasts.ts')
  if (!content) return
  const palBlock = exportBlock(content, 'BEAST_PALETTES')
  if (!palBlock) return
  const species = objectKeys(palBlock)
  const consts = pxConsts(content)
  for (const sp of species) {
    const m = palBlock.match(new RegExp(`${sp}\\s*:\\s*\\[([^\\]]*)\\]`))
    const palLen = m ? (m[1].match(/['"]/g) || []).length / 2 : null
    if (!palLen) continue
    const prefix = sp.toUpperCase().replace(/-/g, '_') + '_'
    for (const c of consts.filter(c => c.name.startsWith(prefix))) {
      let max = 0
      for (const row of c.rows) for (const ch of row) max = Math.max(max, parseInt(ch, 16))
      if (max > palLen)
        add({ severity: 'error', domain: 'palettes', check: 'palette-range', file: 'sprites/beasts.ts', message: `'${c.name}' uses color index ${max} but BEAST_PALETTES.${sp} has only ${palLen} colors.` })
    }
  }
}

async function checkItemMaps(add: Add) {
  const content = await read('sprites/items.ts')
  if (!content) return
  const frameMap = objectKeys(exportBlock(content, 'ITEM_FRAME_MAP') ?? '')
  const icons = objectKeys(exportBlock(content, 'ITEM_ICONS') ?? '')
  const palettes = objectKeys(exportBlock(content, 'ITEM_PALETTES') ?? '')
  const itemsBlock = exportBlock(content, 'ITEMS', '[', ']') ?? ''
  const itemIds = [...itemsBlock.matchAll(/\bid:\s*'([\w-]+)'/g)].map(m => m[1])
  for (const k of setDiff(frameMap, icons))
    add({ severity: 'warn', domain: 'items', check: 'item-map-sync', file: 'sprites/items.ts', message: `'${k}' has ITEM_FRAME_MAP frames but no ITEM_ICONS entry — painted but won't show as an icon.` })
  for (const k of setDiff(icons, frameMap))
    add({ severity: 'warn', domain: 'items', check: 'item-map-sync', file: 'sprites/items.ts', message: `'${k}' is in ITEM_ICONS but missing from ITEM_FRAME_MAP — the editor can't load its frames.` })
  for (const k of setDiff(palettes, [...frameMap, ...itemIds]))
    add({ severity: 'warn', domain: 'items', check: 'orphan-palette', file: 'sprites/items.ts', message: `ITEM_PALETTES has '${k}' which matches no item id or frame-map key.` })
  if (itemIds.length)
    for (const k of setDiff(icons, itemIds))
      add({ severity: 'info', domain: 'items', check: 'icon-without-itemdef', file: 'sprites/items.ts', message: `ITEM_ICONS '${k}' has no ItemDef in ITEMS — fine if it's a node/decoration sprite, otherwise it's unobtainable.` })
}

async function checkSpiritPalettes(add: Add) {
  const route = await read('save-sprite/route.ts')
  const pal = await read('sprites/palette.ts')
  if (!route || !pal) return
  const spiritIds = Object.keys(stringPairs(exportBlock(route, 'SPIRIT_FILES') ?? ''))
  const paletteSpecies = objectKeys(exportBlock(pal, 'PALETTES') ?? '')
  for (const id of setDiff(spiritIds, paletteSpecies))
    add({ severity: 'warn', domain: 'palettes', check: 'spirit-palette-missing', file: 'sprites/palette.ts', message: `Spirit '${id}' has no entry in PALETTES — variant palettes will be undefined.` })
  for (const id of setDiff(paletteSpecies, spiritIds))
    add({ severity: 'info', domain: 'palettes', check: 'spirit-palette-orphan', file: 'sprites/palette.ts', message: `PALETTES has '${id}' which is not a registered spirit species.` })
}

async function checkSidecars(add: Add) {
  const route = await read('save-sprite/route.ts')
  if (!route) return
  const playerFiles = stringPairs(exportBlock(route, 'PLAYER_FILES') ?? '')

  // frame-durations.json
  const durRaw = await read('data/frame-durations.json')
  if (durRaw) {
    let durations: Record<string, Record<string, number[]>> = {}
    try { durations = JSON.parse(durRaw) } catch {
      add({ severity: 'error', domain: 'sidecars', check: 'durations-json', file: 'data/frame-durations.json', message: 'frame-durations.json is not valid JSON.' })
    }
    for (const [charId, anims] of Object.entries(durations)) {
      const file = playerFiles[charId]
      if (!file) {
        add({ severity: 'warn', domain: 'sidecars', check: 'durations-unknown-character', file: 'data/frame-durations.json', message: `frame-durations.json has '${charId}' which is not a registered character.` })
        continue
      }
      const content = await read(`sprites/${file}`)
      if (!content) continue
      const exportName = charId === 'alkin' ? 'PLAYER_SPRITES' : `${charId.toUpperCase().replace(/-/g, '_')}_SPRITES`
      const entries = framesEntries(exportBlock(content, exportName) ?? '')
      for (const [anim, durs] of Object.entries(anims)) {
        if (!entries[anim]) {
          add({ severity: 'warn', domain: 'sidecars', check: 'durations-unknown-anim', file: 'data/frame-durations.json', message: `Durations for '${charId}.${anim}' but ${exportName} has no such animation.` })
        } else if (Array.isArray(durs) && durs.length !== entries[anim].length) {
          add({ severity: 'error', domain: 'sidecars', check: 'durations-length', file: 'data/frame-durations.json', message: `'${charId}.${anim}' has ${durs.length} durations but ${entries[anim].length} frames — timing misaligned.` })
        }
      }
    }
  }

  // movement-styles.json
  const mvRaw = await read('data/movement-styles.json')
  if (mvRaw) {
    let mv: { players?: Record<string, unknown>; beasts?: Record<string, unknown> } = {}
    try { mv = JSON.parse(mvRaw) } catch {
      add({ severity: 'error', domain: 'sidecars', check: 'movement-json', file: 'data/movement-styles.json', message: 'movement-styles.json is not valid JSON.' })
    }
    const beastFiles = stringPairs(exportBlock(route, 'BEAST_FILES') ?? '')
    for (const id of Object.keys(mv.players ?? {}))
      if (!playerFiles[id])
        add({ severity: 'warn', domain: 'sidecars', check: 'movement-unknown-character', file: 'data/movement-styles.json', message: `movement-styles.json players has '${id}' which is not a registered character.` })
    for (const id of Object.keys(mv.beasts ?? {}))
      if (!beastFiles[id])
        add({ severity: 'warn', domain: 'sidecars', check: 'movement-unknown-beast', file: 'data/movement-styles.json', message: `movement-styles.json beasts has '${id}' which is not a registered beast species.` })
  }
}

async function checkWorld(add: Add) {
  const zones = await read('world/zones.ts')
  if (zones) {
    const zonesBlock = exportBlock(zones, 'ZONES', '[', ']') ?? zones
    const zoneIds = [...zonesBlock.matchAll(/^\s*id:\s*'([\w-]+)'/gm)].map(m => m[1])
    const idSet = new Set(zoneIds)
    // associate warps with their containing zone by walking zone object boundaries
    const re = /\bid:\s*'([\w-]+)'|toZone:\s*'([\w-]+)'/g
    let currentZone = ''
    let m
    while ((m = re.exec(zonesBlock))) {
      if (m[1]) currentZone = m[1]
      else if (m[2]) {
        if (!idSet.has(m[2]))
          add({ severity: 'error', domain: 'world', check: 'warp-dead-zone', file: 'world/zones.ts', message: `Zone '${currentZone}' has a warp to '${m[2]}' which is not a registered zone.` })
        else if (m[2] === currentZone)
          add({ severity: 'error', domain: 'world', check: 'warp-self-loop', file: 'world/zones.ts', message: `Zone '${currentZone}' has a warp pointing back to itself (the stale-toZone editor bug).` })
      }
    }
  }

  // zone chests: chestType must be furniture, loot must be real items
  const chests = await read('world/zone-chests.ts')
  const furniture = await read('sprites/furniture.ts')
  const items = await read('sprites/items.ts')
  if (chests && furniture && items) {
    const furnKeys = new Set(objectKeys(exportBlock(furniture, 'FURNITURE_SPRITES') ?? ''))
    const itemsBlock = exportBlock(items, 'ITEMS', '[', ']') ?? ''
    const itemIds = new Set([...itemsBlock.matchAll(/\bid:\s*'([\w-]+)'/g)].map(m => m[1]))
    for (const m of chests.matchAll(/chestType:\s*'([\w-]+)'/g))
      if (furnKeys.size && !furnKeys.has(m[1]))
        add({ severity: 'error', domain: 'world', check: 'chest-bad-furniture', file: 'world/zone-chests.ts', message: `Chest type '${m[1]}' is not in FURNITURE_SPRITES — renders nothing.` })
    for (const m of chests.matchAll(/itemId:\s*'([\w-]+)'/g))
      if (itemIds.size && !itemIds.has(m[1]))
        add({ severity: 'error', domain: 'world', check: 'chest-bad-loot', file: 'world/zone-chests.ts', message: `Chest loot '${m[1]}' is not a registered item id.` })
  }
}

async function checkStaleness(add: Add) {
  let buildTime: number | null = null
  try {
    buildTime = (await fs.stat(path.join(process.cwd(), '.next/BUILD_ID'))).mtimeMs
  } catch {
    add({ severity: 'info', domain: 'deploy', check: 'build-id', message: 'No .next/BUILD_ID found — cannot determine deploy staleness.' })
    return
  }
  const stale: string[] = []
  async function walk(dir: string) {
    let names: string[] = []
    try { names = await fs.readdir(path.join(SHIMMER, dir)) } catch { return }
    for (const n of names) {
      const rel = dir ? `${dir}/${n}` : n
      const full = path.join(SHIMMER, rel)
      const st = await fs.stat(full)
      if (st.isDirectory()) {
        if (!['node_modules', '.next'].includes(n)) await walk(rel)
      } else if (/\.(ts|tsx|json)$/.test(n) && st.mtimeMs > buildTime!) {
        stale.push(rel)
      }
    }
  }
  for (const d of ['sprites', 'world', 'engine', 'data', 'spirits', 'beasts']) await walk(d)
  if (stale.length) {
    const shown = stale.slice(0, 8).join(', ')
    add({
      severity: 'warn', domain: 'deploy', check: 'undeployed-changes',
      message: `${stale.length} source file(s) modified since the last build — edits are saved but NOT live in game until you Deploy: ${shown}${stale.length > 8 ? ', …' : ''}`,
    })
  }
}

// ---------- runner ----------

export async function runDoctor(): Promise<DoctorReport> {
  cache.clear()
  const findings: Finding[] = []
  const add: Add = f => findings.push(f)

  const route = await read('save-sprite/route.ts')
  const playerFiles = route ? stringPairs(exportBlock(route, 'PLAYER_FILES') ?? '') : {}
  const spiritFiles = route ? stringPairs(exportBlock(route, 'SPIRIT_FILES') ?? '') : {}

  const checks: [string, () => Promise<void>][] = [
    ['player-framemaps', () => checkPlayerFrameMaps(add)],
    ['beast-framemaps', () => checkBeastFrameMaps(add)],
    ['character-registries', () => checkCharacterRegistries(add)],
    ['beast-palettes', () => checkBeastPalettes(add)],
    ['item-maps', () => checkItemMaps(add)],
    ['spirit-palettes', () => checkSpiritPalettes(add)],
    ['sidecars', () => checkSidecars(add)],
    ['world', () => checkWorld(add)],
    ['staleness', () => checkStaleness(add)],
  ]
  for (const [id, file] of Object.entries(playerFiles)) {
    const exportName = id === 'alkin' ? 'PLAYER_SPRITES' : `${id.toUpperCase().replace(/-/g, '_')}_SPRITES`
    const paletteName = id === 'alkin' ? 'PLAYER_PALETTE' : `${id.toUpperCase().replace(/-/g, '_')}_PALETTE`
    checks.push([`sprite-file:${id}`, () => checkSpriteFile(add, `sprites/${file}`, exportName, paletteName)])
  }
  for (const [id, file] of Object.entries(spiritFiles)) {
    const upper = id.toUpperCase().replace(/-/g, '_')
    checks.push([`sprite-file:${id}`, () => checkSpriteFile(add, `sprites/${file}`, `${upper}_SPRITES`, `${upper}_PALETTE`)])
  }
  checks.push(['sprite-file:furniture', () => checkSpriteFile(add, 'sprites/furniture.ts', 'FURNITURE_SPRITES', null)])

  for (const [name, fn] of checks) {
    try { await fn() } catch (e) {
      add({ severity: 'info', domain: 'doctor', check: name, message: `Check crashed (doctor needs an update, the game is fine): ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const counts = { error: 0, warn: 0, info: 0 }
  for (const f of findings) counts[f.severity]++
  return { generatedAt: new Date().toISOString(), counts, findings }
}
