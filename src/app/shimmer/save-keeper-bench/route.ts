// The body bench's try-on choice per keeper model (BETA M116c): face set, mouth M1-M5, female torso T1-T3. BENCH ONLY:
// nothing in the game reads this file. Named `save-*` to inherit the owner gate (proxy.ts 403s /shimmer/save-* without the
// owner cookie). Written to data/ (gitignored, runtime): it never ships in a build and never blocks `coord build`.
import { NextRequest, NextResponse } from 'next/server'
import { readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { MODELS } from '../open/shared/keeper-proportions'
import { parseBench, parseBenchFile, isDefaultBench } from '../dev/keeper-body/bench-looks'

const FILE = join(process.cwd(), 'data/keeper-bench.json')

async function load(): Promise<Record<string, unknown>> {
  try { return JSON.parse(await readFile(FILE, 'utf-8')) as Record<string, unknown> } catch { return {} }
}

/** GET: every model's bench choice, clamped (all 6 present) */
export async function GET() {
  try { return NextResponse.json({ models: parseBenchFile(await load()) }) }
  catch (e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 }) }
}

/** POST {model, bench}: replace one model's choice (a model at the default is left out of the file) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { model?: unknown; bench?: unknown }
    if (typeof body.model !== 'string' || !MODELS.includes(body.model))
      return NextResponse.json({ error: `need model (one of ${MODELS.join(', ')})` }, { status: 400 })
    const all = parseBenchFile(await load()), bench = parseBench(body.model, body.bench)
    all[body.model] = bench
    const out = Object.fromEntries(Object.entries(all).filter(([, b]) => !isDefaultBench(b)))
    await mkdir(join(process.cwd(), 'data'), { recursive: true })
    await writeFile(FILE, JSON.stringify(out, null, 1) + '\n')
    return NextResponse.json({ ok: true, model: body.model, bench })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
