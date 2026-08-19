// Shimmer Doctor — read-only consistency checker.
// Scans sprite sources, editor maps, save-route maps, sidecar JSON, and world data
// for the desync bug classes we've hit repeatedly (frame-map drift, orphan frames,
// duplicate keys, palette range overflows, stale deploys, broken warps).
// Never mutates anything.
//
// ══ ★★★ THE DOCTOR'S OWN RECURRING BUG: CHECKING AGAINST A REGISTRY THAT IS NO LONGER THE WHOLE
// REGISTRY (three faces found in one evening, 2026-08-19) ═════════════════════════════════════
// It went 198 errors / 161 warns -> 7 / 29. Almost none of that was fixing the game; it was the
// doctor being wrong three times in the same shape, and the volume is what made it believable.
//   1. `objectKeys` on a block that FAILED TO PARSE. One apostrophe in a comment broke
//      `braceBlock`, ITEM_ICONS read as {}, and all 92 items were reported as unwired art. The
//      two maps were in perfect sync.
//   2. `checkWorld` against `ZONES` alone. The region world registers in `world/region-maps.ts`
//      under an `r-` prefix, so 7 warps to real zones — including play3d's START ZONE — were
//      reported as dead ends.
//   3. `px-size-mismatch` against a RETIRED pipeline. 228 findings claimed "renders garbled in
//      game" for sprite sheets no live 3D surface loads.
//
// The lesson is not "fix these three". It is that a check is a comparison against a model of what
// exists, and the model rots silently while the code keeps answering confidently. So:
//   • DERIVE the reference set from its source, never restate it here. A hardcoded list is how (2)
//     happened, and it is why `registeredZoneIds` and `liveSpriteImports` read the real registries.
//   • A special case needs its REASON attached (see the Wilds note) or the next reader deletes it.
//   • FAIL LOUD WHEN YOU CANNOT LOOK. A parse failure must surface as `unparsed-block`, never as an
//     empty set — an empty set is indistinguishable from a real answer and scores as one.
//   • SEVERITY IS REACHABILITY. "Is it wired in its own file" is not "does the running game draw
//     it". Assert an in-game consequence only for something a live surface actually loads.
//   • A check that stops reporting must still be ABLE to report. Both quiet checks above are
//     mutation-tested: a truly unresolvable warp id still errors, and a retired sprite module
//     re-escalates the moment a live surface imports it.

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

/** Blocks whose braces could not be matched. A parse failure MUST be reported, never
 *  returned as an empty set — see `unparsed-block` in runDoctor. Drained per run. */
const parseFailures: { name: string; file: string }[] = []

/** Which cached file a content string came from, for naming a parse failure. */
function fileForContent(content: string): string {
  for (const [rel, c] of cache) if (c === content) return rel
  return '(unknown file)'
}

/** Extract a brace-matched block starting at the first `open` char at/after startIdx.
 *
 * ⚠ COMMENTS ARE SKIPPED, AND THAT IS NOT A TIDINESS FIX. This scanner treats `'` as opening
 * a string, so ONE apostrophe in a `//` comment opens a string that never closes at the right
 * place and the brace count silently goes wrong. `sprites/items.ts` had exactly that — a comment
 * reading "the doctor's `item-map-sync`" sat inside ITEM_ICONS, the block failed to match, and
 * every one of the 92 items was reported as "painted but won't show as an icon" when the two maps
 * were in perfect sync. The comment naming the check is what broke the check.
 */
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
    // Comments first — their contents are text, not code, and an apostrophe in one is prose.
    if (ch === '/' && content[i + 1] === '/') {
      const nl = content.indexOf('\n', i)
      if (nl === -1) return null
      i = nl
      continue
    }
    if (ch === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2)
      if (end === -1) return null
      i = end + 1
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
  const block = braceBlock(content, m.index + m[0].length, open, close)
  // ★ A block that exists but will not parse is a DIFFERENT fact from one that is absent, and
  // every caller here does `?? ''` — so without this ledger a failed parse reads as an empty
  // object and the check scores a confident zero. Record it; runDoctor reports it as its own
  // finding rather than letting it masquerade as data.
  if (block === null) parseFailures.push({ name, file: fileForContent(content) })
  return block
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
      else if (ch === '/' && line[i + 1] === '*') {
        // Same reason as braceBlock: a `{` or an apostrophe inside a block comment is prose.
        const end = line.indexOf('*/', i + 2)
        if (end === -1) break
        i = end + 1
      }
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

  // Reachability decides severity for everything below — see liveSpriteImports().
  const liveModules = await liveSpriteImports()
  const moduleName = rel.replace(/^sprites\//, '').replace(/\.tsx?$/, '')
  const onLiveSurface = liveModules.has(moduleName)

  // orphan painted consts (defined, never referenced anywhere else in the file)
  for (const c of consts) {
    const uses = (content.match(new RegExp(`\\b${c.name}\\b`, 'g')) || []).length
    if (uses <= 1)
      add({
        severity: onLiveSurface ? 'warn' : 'info', domain: 'sprites', check: 'orphan-frame', file: rel,
        message: onLiveSurface
          ? `'${c.name}' is painted but referenced nowhere — it will never render in game.`
          : `'${c.name}' is painted but referenced nowhere — RETIRED 2D pipeline, so nothing in this module renders in game either way.`,
      })
  }

  // px dimension sanity: row widths / counts vs declared size
  for (const c of consts) {
    const total = c.rows.reduce((n, r) => n + r.length, 0)
    if (total === 0) continue
    if (total !== c.w * c.h) {
      const widths = [...new Set(c.rows.map(r => r.length))].join('/')
      const wired = referenced.has(c.name)
      // ★ SEVERITY COMES FROM REACHABILITY, NOT FROM WIRING. `wired` only ever asked whether a
      // const is named in its own file's _SPRITES export — true of plenty of art in a pipeline
      // nothing renders. A malformed frame in a retired module is a fact about the data; it is
      // not a bug in the running game, and calling it one for 185 frames is what taught everyone
      // to scroll past this check.
      const severity = onLiveSurface ? (wired ? 'error' : 'warn') : 'info'
      const consequence = onLiveSurface
        ? (wired ? 'wired into an animation, renders garbled in game.' : 'unwired (16px-era leftover), would garble if wired.')
        : 'RETIRED 2D pipeline — no live 3D surface imports this module, so it renders nowhere in game. Real only if the 2D surface is revived, or in the dev editors that still load it.'
      add({
        severity, domain: 'sprites', check: 'px-size-mismatch', file: rel,
        message: `'${c.name}' declares ${c.w}x${c.h} (${c.w * c.h} px) but contains ${total} digits (row widths: ${widths}) — ${consequence}`,
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
  // ★★ DIFF ONLY THE MAPS WE ACTUALLY READ. A null block means "could not look", which is already
  // reported as `unparsed-block` — diffing against it turns ONE parser failure into 92 confident
  // findings about items that are perfectly fine, and the volume is what makes them believable.
  // This is why the guards are on the BLOCKS and not on the key arrays: `objectKeys(null ?? '')`
  // and `objectKeys('{}')` are both `[]`, so by the time it is an array the distinction between
  // "empty" and "unreadable" is gone.
  const frameMapBlock = exportBlock(content, 'ITEM_FRAME_MAP')
  const iconsBlock = exportBlock(content, 'ITEM_ICONS')
  const palettesBlock = exportBlock(content, 'ITEM_PALETTES')
  const itemsBlock = exportBlock(content, 'ITEMS', '[', ']') ?? ''
  const frameMap = objectKeys(frameMapBlock ?? '')
  const icons = objectKeys(iconsBlock ?? '')
  const palettes = objectKeys(palettesBlock ?? '')
  const itemIds = [...itemsBlock.matchAll(/\bid:\s*'([\w-]+)'/g)].map(m => m[1])
  if (frameMapBlock && iconsBlock) {
    for (const k of setDiff(frameMap, icons))
      add({ severity: 'warn', domain: 'items', check: 'item-map-sync', file: 'sprites/items.ts', message: `'${k}' has ITEM_FRAME_MAP frames but no ITEM_ICONS entry — painted but won't show as an icon.` })
    for (const k of setDiff(icons, frameMap))
      add({ severity: 'warn', domain: 'items', check: 'item-map-sync', file: 'sprites/items.ts', message: `'${k}' is in ITEM_ICONS but missing from ITEM_FRAME_MAP — the editor can't load its frames.` })
  }
  if (palettesBlock && frameMapBlock)
    for (const k of setDiff(palettes, [...frameMap, ...itemIds]))
      add({ severity: 'warn', domain: 'items', check: 'orphan-palette', file: 'sprites/items.ts', message: `ITEM_PALETTES has '${k}' which matches no item id or frame-map key.` })
  if (iconsBlock && itemIds.length)
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
          // Same reachability rule as px-size-mismatch: misaligned timing for a sheet no live
          // surface draws is sidecar drift, not a bug in the running game. frame-durations.json
          // has no consumer outside the dev editors and SandboxPreview.
          const liveDur = (await liveSpriteImports()).has(file.replace(/\.tsx?$/, ''))
          add({
            severity: liveDur ? 'error' : 'info', domain: 'sidecars', check: 'durations-length', file: 'data/frame-durations.json',
            message: `'${charId}.${anim}' has ${durs.length} durations but ${entries[anim].length} frames — ${liveDur ? 'timing misaligned.' : 'stale sidecar for a RETIRED 2D sheet; read only by the dev editors, renders nowhere.'}`,
          })
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

/**
 * Every zone id a warp may legally name.
 *
 * ★★ `ZONES` IN `world/zones.ts` IS NO LONGER THE WHOLE REGISTRY, AND A CHECK THAT STILL THINKS
 * IT IS REPORTS THE LIVE WORLD AS BROKEN. The region world registers separately, in
 * `world/region-maps.ts`, under the `r-` prefix (`REGION_WIP_PREFIX`) — and it is not a side
 * experiment: `r-home-plot` is play3d's START_ZONE, the zone players actually spawn into. All
 * seven `warp-dead-zone` errors this check was raising named region zones that exist, including
 * the one `zones.ts:487` documents as "the door names its real destination".
 *
 * Read off the json imports rather than a hardcoded list, so adding a region map cannot silently
 * age this check back into wrongness. `r-wilds` is the composite overland — it is a real zone with
 * no single backing file, which is exactly the trap `isRegionZone` warns about in region-maps.ts.
 */
async function registeredZoneIds(): Promise<Set<string>> {
  const zones = await read('world/zones.ts')
  const zonesBlock = zones ? (exportBlock(zones, 'ZONES', '[', ']') ?? zones) : ''
  const ids = new Set([...zonesBlock.matchAll(/^\s*id:\s*'([\w-]+)'/gm)].map(m => m[1]))
  const regions = await read('world/region-maps.ts')
  if (regions) {
    const prefix = regions.match(/REGION_WIP_PREFIX\s*=\s*'([^']+)'/)?.[1] ?? 'r-'
    for (const m of regions.matchAll(/from '\.\/region-maps\/([\w-]+)\.json'/g)) ids.add(prefix + m[1])
    // THE ONE NAMED EXCEPTION: the Wilds are a real zone with NO backing file — the region maps
    // `wilds-N-N.json` are tiles composed into a single overland zone, so the loop above adds the
    // tiles and never the zone players are actually in. This is the same trap region-maps.ts warns
    // about on `isRegionZone`: anything written as "does a file exist for this" silently answers
    // "not a zone" for the whole overland. Read the id from its source so a rename cannot orphan it.
    const wilds = await read('world/wilds-world.ts')
    const wildsId = wilds?.match(/WILDS_ZONE_ID\s*=\s*'([^']+)'/)?.[1]
    if (wildsId) ids.add(prefix + wildsId)
  }
  return ids
}

/**
 * Sprite modules a LIVE surface imports, by module basename ('items', 'player', ...).
 *
 * ★★ THE 2D SPRITE-SHEET PIPELINE IS RETIRED (Alex, 2026-08-19) AND `px-size-mismatch` WAS STILL
 * REPORTING IT AS "renders garbled in game". Neither 3D surface loads a sprite sheet: voxel3d's
 * `grimoire-tab.tsx` says so in its own header, and `InventoryGrid` / `ChestPanel` / `ItemIcon`
 * are mounted nowhere at all. 228 findings claimed an in-game consequence on surfaces that never
 * draw the data.
 *
 * DERIVED, NOT LISTED, and that is the point — a hardcoded "retired" list is how `checkWorld`
 * ended up calling the live world's start zone a dead warp. This walks the live surfaces and asks
 * what they import, so wiring any sprite module back into voxel3d or play3d re-escalates its
 * findings to errors on the next run with nothing to remember.
 */
let liveSpriteModules: Set<string> | null = null

async function liveSpriteImports(): Promise<Set<string>> {
  if (liveSpriteModules) return liveSpriteModules
  const found = new Set<string>()
  const walk = async (dir: string): Promise<void> => {
    let entries: import('fs').Dirent[]
    try { entries = await fs.readdir(path.join(SHIMMER, dir), { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) { await walk(rel); continue }
      if (!/\.tsx?$/.test(e.name)) continue
      const content = await read(rel)
      if (!content) continue
      for (const m of content.matchAll(/from '[^']*\bsprites\/([\w-]+)'/g)) found.add(m[1])
    }
  }
  await walk('voxel3d')
  await walk('play3d')
  liveSpriteModules = found
  return found
}

async function checkWorld(add: Add) {
  const zones = await read('world/zones.ts')
  if (zones) {
    const zonesBlock = exportBlock(zones, 'ZONES', '[', ']') ?? zones
    const idSet = await registeredZoneIds()
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
  parseFailures.length = 0
  liveSpriteModules = null
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

  // ★ A CHECK THAT COULD NOT SEE MUST SAY SO, NOT SCORE ZERO. Reported after the checks so it
  // reads as the explanation for whatever nonsense they just produced. Deduped: one line per
  // block, however many checks asked for it.
  for (const key of new Set(parseFailures.map(f => `${f.file}\u0000${f.name}`))) {
    const [file, name] = key.split('\u0000')
    add({
      severity: 'error', domain: 'doctor', check: 'unparsed-block', file,
      message: `Could not brace-match '${name}' in ${file}, so every check reading it saw an EMPTY set — which scores as "nothing is wired" rather than "the doctor could not look". Treat findings naming ${name} as unproven until this parses. Usual cause: a construct braceBlock mis-scans (an unbalanced quote or brace somewhere it reads as code).`,
    })
  }

  const counts = { error: 0, warn: 0, info: 0 }
  for (const f of findings) counts[f.severity]++
  return { generatedAt: new Date().toISOString(), counts, findings }
}
