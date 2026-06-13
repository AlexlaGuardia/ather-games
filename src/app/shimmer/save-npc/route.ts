import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'

const NPCS_PATH = join(process.cwd(), 'src/app/shimmer/world/npcs.ts')
const SPRITE_DIR = join(process.cwd(), 'src/app/shimmer/sprites')

interface NPCSummary {
  id: string
  name: string
  zone: string
  tileX: number
  tileY: number
  direction: string
  dialogueId: string
  blocking?: boolean
  hideWhenFlag?: string
  patrolPath?: { tileX: number; tileY: number }[]
}

/** Parse NPC entries from npcs.ts source */
function parseNPCs(content: string): NPCSummary[] {
  const npcs: NPCSummary[] = []
  // Find the NPCS array
  const arrayMatch = content.match(/export const NPCS:\s*NPCDef\[\]\s*=\s*\[([\s\S]*)\]/)
  if (!arrayMatch) return npcs

  const arrayContent = arrayMatch[1]
  // Match each { ... } block in the array
  const blocks = arrayContent.matchAll(/\{\s*\n([\s\S]*?)\n\s*\}/g)
  for (const block of blocks) {
    const text = block[1]
    const id = text.match(/id:\s*'([^']+)'/)?.[1] ?? ''
    const name = text.match(/name:\s*'([^']+)'/)?.[1] ?? ''
    const zone = text.match(/zone:\s*'([^']+)'/)?.[1] ?? ''
    const tileX = parseInt(text.match(/tileX:\s*(\d+)/)?.[1] ?? '0')
    const tileY = parseInt(text.match(/tileY:\s*(\d+)/)?.[1] ?? '0')
    const direction = text.match(/direction:\s*'([^']+)'/)?.[1] ?? 'down'
    const dialogueId = text.match(/dialogueId:\s*'([^']+)'/)?.[1] ?? ''
    const blocking = /blocking:\s*true/.test(text)
    const hideWhenFlag = text.match(/hideWhenFlag:\s*'([^']+)'/)?.[1]

    // Parse patrolPath if present
    let patrolPath: { tileX: number; tileY: number }[] | undefined
    const pathMatch = text.match(/patrolPath:\s*\[([\s\S]*?)\]/)
    if (pathMatch) {
      patrolPath = []
      const points = pathMatch[1].matchAll(/\{\s*tileX:\s*(\d+)\s*,\s*tileY:\s*(\d+)\s*\}/g)
      for (const p of points) {
        patrolPath.push({ tileX: parseInt(p[1]), tileY: parseInt(p[2]) })
      }
    }

    if (id) npcs.push({ id, name, zone, tileX, tileY, direction, dialogueId, blocking: blocking || undefined, hideWhenFlag, patrolPath })
  }
  return npcs
}

// GET: read NPC entries from npcs.ts
export async function GET() {
  try {
    const content = await readFile(NPCS_PATH, 'utf-8')
    const npcs = parseNPCs(content)
    return NextResponse.json({ npcs })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

// POST: create or update NPC entry in npcs.ts
export async function POST(req: NextRequest) {
  try {
    const { id, name, zone, tileX, tileY, direction, dialogueId, blocking, patrolPath, spriteFile } = await req.json()
    if (!id || !zone) return NextResponse.json({ error: 'Missing id or zone' }, { status: 400 })

    let content = await readFile(NPCS_PATH, 'utf-8')
    const existing = parseNPCs(content)
    const npc = existing.find(n => n.id === id)

    if (npc) {
      // Update existing NPC — find its block and replace fields
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Match the full NPC object block
      const blockPattern = new RegExp(`(\\{[^}]*id:\\s*'${escaped}'[\\s\\S]*?)(\\n\\s*\\})`)
      content = content.replace(blockPattern, (match, body, close) => {
        // Update zone
        body = body.replace(/zone:\s*'[^']*'/, `zone: '${zone}'`)
        // Update position
        body = body.replace(/tileX:\s*\d+/, `tileX: ${tileX ?? npc.tileX}`)
        body = body.replace(/tileY:\s*\d+/, `tileY: ${tileY ?? npc.tileY}`)
        // Update direction
        body = body.replace(/direction:\s*'[^']*'/, `direction: '${direction ?? npc.direction}'`)
        // Update dialogueId
        if (dialogueId) body = body.replace(/dialogueId:\s*'[^']*'/, `dialogueId: '${dialogueId}'`)
        // Update patrolPath
        if (patrolPath !== undefined) {
          // Remove existing patrolPath if any
          body = body.replace(/\s*patrolPath:\s*\[[\s\S]*?\],?/, '')
          // Add new patrolPath before the closing
          if (Array.isArray(patrolPath) && patrolPath.length > 0) {
            const pathStr = patrolPath.map((p: { tileX: number; tileY: number }) =>
              `      { tileX: ${p.tileX}, tileY: ${p.tileY} }`
            ).join(',\n')
            body += `\n    patrolPath: [\n${pathStr},\n    ],`
          }
        }
        return body + close
      })
    } else {
      // Create new NPC entry
      const label = name || (id.charAt(0).toUpperCase() + id.slice(1))
      const constPrefix = id.toUpperCase().replace(/[^A-Z0-9]/g, '_')

      // Read the character's DOWN_IDLE_0 sprite data from their sprite file
      let spriteConstName = `${constPrefix}_SPRITE`
      let spriteConst = ''
      let importLine = ''

      if (spriteFile) {
        try {
          const spriteContent = await readFile(join(SPRITE_DIR, spriteFile), 'utf-8')
          // Extract DOWN_IDLE_0 px data
          const frameMatch = spriteContent.match(/const DOWN_IDLE_0 = px\(S, S, `\n([\s\S]*?)\n`\)/)
          if (frameMatch) {
            spriteConst = `const ${spriteConstName} = px(32, 32, \`\n${frameMatch[1]}\n\`)\n\n`
          }
          // Import palette
          const paletteExport = spriteContent.match(/export const (\w+_PALETTE)/)
          if (paletteExport) {
            importLine = `import { ${paletteExport[1]} } from '../sprites/${spriteFile.replace('.ts', '')}'`
          }
        } catch { /* no sprite file, use blank */ }
      }

      // If no sprite data found, create a blank sprite
      if (!spriteConst) {
        const blank = Array(32).fill('  00000000000000000000000000000000').join('\n')
        spriteConst = `const ${spriteConstName} = px(32, 32, \`\n${blank}\n\`)\n\n`
      }

      // Add import if needed
      if (importLine && !content.includes(importLine)) {
        const lastImport = content.lastIndexOf("import ")
        const lineEnd = content.indexOf('\n', lastImport)
        content = content.slice(0, lineEnd + 1) + importLine + '\n' + content.slice(lineEnd + 1)
      }

      // Add sprite const before NPCS array
      const npcsArrayIdx = content.indexOf('export const NPCS:')
      const insertPoint = content.lastIndexOf('\n', npcsArrayIdx) + 1
      content = content.slice(0, insertPoint) + spriteConst + content.slice(insertPoint)

      // Build NPC entry
      const paletteRef = importLine
        ? importLine.match(/(\w+_PALETTE)/)?.[1] ?? `['#3a4a6a', '#e0c890', '#2a1a30']`
        : `['#3a4a6a', '#e0c890', '#2a1a30']`

      let entry = `  {\n    id: '${id}',\n    name: '${label}',\n    zone: '${zone}',\n    tileX: ${tileX ?? 10}, tileY: ${tileY ?? 10},\n    direction: '${direction ?? 'down'}',\n    dialogueId: '${dialogueId || `${id}-intro`}',\n    sprite: ${spriteConstName},\n    palette: ${paletteRef},`
      if (blocking) entry += `\n    blocking: true,`
      if (patrolPath && patrolPath.length > 0) {
        const pathStr = patrolPath.map((p: { tileX: number; tileY: number }) =>
          `      { tileX: ${p.tileX}, tileY: ${p.tileY} }`
        ).join(',\n')
        entry += `\n    patrolPath: [\n${pathStr},\n    ],`
      }
      entry += `\n  },`

      // Insert before closing ] of NPCS array
      const arrayEnd = content.lastIndexOf(']')
      content = content.slice(0, arrayEnd) + entry + '\n' + content.slice(arrayEnd)
    }

    await writeFile(NPCS_PATH, content, 'utf-8')
    return NextResponse.json({ success: true, id })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

// DELETE: remove NPC entry from npcs.ts
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    let content = await readFile(NPCS_PATH, 'utf-8')
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Find the NPC block and its sprite const name
    const spriteRef = content.match(new RegExp(`id:\\s*'${escaped}'[\\s\\S]*?sprite:\\s*(\\w+)`))?.[1]

    // Remove the NPC entry from array (match entire { ... }, block)
    const idIdx = content.indexOf(`id: '${id}'`)
    if (idIdx < 0) return NextResponse.json({ error: `NPC "${id}" not found` }, { status: 400 })

    // Walk backward to find the opening { of this entry
    let blockStart = idIdx
    while (blockStart > 0 && content[blockStart] !== '{') blockStart--
    // Include any preceding whitespace/newline
    while (blockStart > 0 && (content[blockStart - 1] === ' ' || content[blockStart - 1] === '\n')) blockStart--
    if (blockStart > 0) blockStart++ // keep one newline

    // Walk forward to find the closing },
    let depth = 0
    let blockEnd = blockStart
    for (let i = blockStart; i < content.length; i++) {
      if (content[i] === '{') depth++
      else if (content[i] === '}') {
        depth--
        if (depth === 0) {
          blockEnd = i + 1
          // Consume trailing comma and whitespace
          if (content[blockEnd] === ',') blockEnd++
          if (content[blockEnd] === '\n') blockEnd++
          break
        }
      }
    }

    content = content.slice(0, blockStart) + content.slice(blockEnd)

    // Remove sprite const if no longer referenced
    if (spriteRef) {
      const usageCount = (content.match(new RegExp(`\\b${spriteRef}\\b`, 'g')) ?? []).length
      if (usageCount <= 0) {
        content = content.replace(new RegExp(`const ${spriteRef} = px\\([^)]*,\\s*[^)]*,\\s*\`[\\s\\S]*?\`\\)\\n*`), '')
      }
    }

    await writeFile(NPCS_PATH, content, 'utf-8')
    return NextResponse.json({ success: true, deleted: id })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
