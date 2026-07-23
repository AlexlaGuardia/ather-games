// Live world data — serves the CURRENT on-disk zone sources (tilemap.ts grids, heightmaps.json,
// node-placements.ts) parsed at request time. This is what makes "edit → Save → refresh" work
// with no rebuild: the save routes write these files, the play3d boot fetches this instead of
// trusting the compiled bundle. Zones still authored in createStubMap (never editor-saved)
// parse as null — the client keeps its compiled grid for those, so fallback is seamless.
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const WORLD_DIR = join(process.cwd(), 'src/app/shimmer/world')

function parseGrid(content: string, name: string): number[][] | null {
  const declStart = content.indexOf(`export const ${name}`)
  if (declStart === -1) return null
  // anchor on the '=' — the first '[' after the declaration is the TYPE's (number[][])
  const eq = content.indexOf('=', declStart)
  if (eq === -1) return null
  const bracketStart = content.indexOf('[', eq)
  if (bracketStart === -1) return null
  if (content.substring(eq, bracketStart).includes('createStubMap')) return null
  let depth = 0, pos = bracketStart
  while (pos < content.length) {
    if (content[pos] === '[') depth++
    else if (content[pos] === ']') { depth--; if (depth === 0) break }
    pos++
  }
  // strip the outer brackets, then every remaining [...] is exactly one row
  const rows = content.substring(bracketStart + 1, pos).match(/\[([^\]]*)\]/g)
  if (!rows || rows.length < 2) return null
  return rows.map(row =>
    row.replace(/[\[\]]/g, '').split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)))
}

function parseSpawnerBlocks(content: string): Record<string, { kind: string; gate: string; tileX: number; tileY: number }[]> {
  const out: Record<string, { kind: string; gate: string; tileX: number; tileY: number }[]> = {}
  const blockRe = /const (\w+)_SPAWNERS: SpawnerPlacement\[\] = \[([\s\S]*?)\n\]/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(content)) !== null) {
    const zoneId = m[1].toLowerCase().replace(/_/g, '-')
    const rows: { kind: string; gate: string; tileX: number; tileY: number }[] = []
    const rowRe = /\{ kind: '(\w+)', gate: '(\w+)', tileX: (\d+), tileY: (\d+) \}/g
    let n: RegExpExecArray | null
    while ((n = rowRe.exec(m[2])) !== null) rows.push({ kind: n[1], gate: n[2], tileX: +n[3], tileY: +n[4] })
    out[zoneId] = rows
  }
  return out
}

function parseNodeBlocks(content: string): Record<string, { type: string; tileX: number; tileY: number }[]> {
  const out: Record<string, { type: string; tileX: number; tileY: number }[]> = {}
  const blockRe = /const (\w+)_NODES: NodePlacement\[\] = \[([\s\S]*?)\n\]/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(content)) !== null) {
    const zoneId = m[1].toLowerCase().replace(/_/g, '-')
    const nodes: { type: string; tileX: number; tileY: number }[] = []
    const nodeRe = /\{ type: '([\w-]+)' as NodeType, tileX: (\d+), tileY: (\d+) \}/g
    let n: RegExpExecArray | null
    while ((n = nodeRe.exec(m[2])) !== null) nodes.push({ type: n[1], tileX: +n[2], tileY: +n[3] })
    out[zoneId] = nodes
  }
  return out
}

export async function GET() {
  try {
    const [tilemap, nodesSrc, heightsRaw, spawnersSrc] = await Promise.all([
      readFile(join(WORLD_DIR, 'tilemap.ts'), 'utf-8'),
      readFile(join(WORLD_DIR, 'node-placements.ts'), 'utf-8'),
      readFile(join(WORLD_DIR, 'heightmaps.json'), 'utf-8').catch(() => '{}'),
      readFile(join(WORLD_DIR, 'spawn-placements.ts'), 'utf-8').catch(() => ''),
    ])
    // every exported grid const in tilemap.ts, keyed by zone id
    const grids: Record<string, number[][]> = {}
    const declRe = /export const (\w+): number\[\]\[\]/g
    let d: RegExpExecArray | null
    while ((d = declRe.exec(tilemap)) !== null) {
      const g = parseGrid(tilemap, d[1])
      if (g && g.length > 1) grids[d[1].toLowerCase().replace(/_/g, '-')] = g
    }
    return NextResponse.json(
      { grids, nodes: parseNodeBlocks(nodesSrc), heights: JSON.parse(heightsRaw), spawners: parseSpawnerBlocks(spawnersSrc) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
