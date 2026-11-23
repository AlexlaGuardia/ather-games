// Save one keeper model's proportions (BETA M103) into open/shared/keeper-proportions.json, from the body bench (dev/keeper-body).
//
// ★ NAMED `save-keeper-proportions` TO INHERIT THE OWNER GATE: `proxy.ts` hard-403s `/shimmer/save-*` without the owner cookie,
// and this writes a file the build reads. Listed in tools/dev-written.txt (M94), so `coord build` refuses while a save sits
// uncommitted instead of silently shipping without it.
// ⚠ LIVE IN THE GAME AT THE NEXT DEPLOY, NOT ON SAVE: the JSON is imported by the bundle. The bench GETs the file live.
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { MODELS, parseFile, parseProportions, changedOnly } from '../open/shared/keeper-proportions'

const FILE = join(process.cwd(), 'src/app/shimmer/open/shared/keeper-proportions.json')

async function load(): Promise<Record<string, unknown>> {
  try { return JSON.parse(await readFile(FILE, 'utf-8')) as Record<string, unknown> } catch { return {} }
}

/** GET: every model's dials, clamped (all 6 present) */
export async function GET() {
  try { return NextResponse.json({ models: parseFile(await load()) }) }
  catch (e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 }) }
}

/** POST {model, dials}: replace one model's entry (clamped; only dials that differ from today's body are stored) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { model?: unknown; dials?: unknown }
    if (typeof body.model !== 'string' || !MODELS.includes(body.model))
      return NextResponse.json({ error: `need model (one of ${MODELS.join(', ')})` }, { status: 400 })
    if (!body.dials || typeof body.dials !== 'object') return NextResponse.json({ error: 'need dials' }, { status: 400 })
    const all = await load(), dials = parseProportions(body.dials), stored = changedOnly(dials)
    const out: Record<string, unknown> = {}
    for (const m of MODELS) {   // file keeps the model order; a model at today's body is left out
      const v = m === body.model ? stored : (all[m] && typeof all[m] === 'object' ? changedOnly(parseProportions(all[m])) : {})
      if (Object.keys(v).length) out[m] = v
    }
    await writeFile(FILE, JSON.stringify(out, null, 1) + '\n')
    return NextResponse.json({ ok: true, model: body.model, dials, live: 'at the next deploy (coord build)' })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
