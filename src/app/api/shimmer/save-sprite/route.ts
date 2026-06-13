import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// Frame const names per animation
const FRAME_MAP: Record<string, string[]> = {
  idle:       ['IDLE_0', 'IDLE_1'],
  idle_blink: ['IDLE_BLINK'],
  walk:       ['WALK_0', 'WALK_1', 'WALK_2', 'WALK_3'],
  happy:      ['HAPPY_0', 'HAPPY_1'],  // happy anim reuses 0,1,0,1
  eat:        ['EAT_0', 'EAT_1'],
  sleep:      ['SLEEP_0', 'SLEEP_1'],
}

const SPRITE_DIR = join(process.cwd(), 'src/app/shimmer/sprites')

const SPECIES_FILES: Record<string, string> = {
  fox: 'fox.ts',
  axolotl: 'axolotl.ts',
  'water-bear': 'water-bear.ts',
}

export async function POST(req: NextRequest) {
  try {
    const { species, anim, frameIndex, digits } = await req.json()

    // Validate
    const file = SPECIES_FILES[species]
    if (!file) return NextResponse.json({ error: 'Unknown species' }, { status: 400 })

    const constNames = FRAME_MAP[anim]
    if (!constNames) return NextResponse.json({ error: 'Unknown animation' }, { status: 400 })

    // For animations that reuse frames (happy uses [0,1,0,1]), map to unique const
    const constIdx = frameIndex % constNames.length
    const constName = constNames[constIdx]
    if (!constName) return NextResponse.json({ error: 'Invalid frame index' }, { status: 400 })

    // Validate digits: should be 16 lines of 16 digits
    const lines = digits.trim().split('\n').map((l: string) => l.trim())
    if (lines.length !== 16 || lines.some((l: string) => l.length !== 16 || !/^[0-9a-f]+$/i.test(l)))
      return NextResponse.json({ error: 'Invalid digit format' }, { status: 400 })

    const formatted = lines.map((l: string) => `  ${l}`).join('\n')

    // Read the file
    const filePath = join(SPRITE_DIR, file)
    let content = await readFile(filePath, 'utf-8')

    // Find and replace the const's px() content
    // Pattern: const CONST_NAME = px(S, S, `...`)
    const pattern = new RegExp(
      `(const ${constName} = px\\(S, S, \`)([^]*?)(\`\\))`,
    )

    if (!pattern.test(content)) {
      return NextResponse.json({ error: `Could not find ${constName} in ${file}` }, { status: 400 })
    }

    content = content.replace(pattern, `$1\n${formatted}\n$3`)

    // Write back
    await writeFile(filePath, content, 'utf-8')

    return NextResponse.json({ success: true, saved: constName, file })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
