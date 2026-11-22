// BETA M83 p1 s1a: THE WORLD BUILDER STORE's IO (the plan is pure: world/builder.ts). Owner only: the proxy 403s /shimmer/save-*
// for every method, GET included, so a draft is never readable by the public.
//   GET  ?map=wilds|glade                      -> { draft, draftAt, live, index, state }
//   POST { map, action: 'draft', layer }   -> autosave / Save: REPLACES the draft (data/builder/<map>/draft.json, runtime, never built)
//   POST { map, action: 'publish', note? } -> the draft becomes a new version + the live layer
//   POST { map, action: 'rollback', v }    -> version v becomes a new version + the live layer + the draft
// Writes run in the plan's order (version -> live -> index) and are SERIALISED in this process (M62 lesson: parallel read-modify-
// writes lost tiles). Every file write is atomic (safeWriteFile: tmp + rename) and backed up.
import { NextRequest, NextResponse } from 'next/server'
import { readFile, mkdir, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import { isBuilderMap, cleanLayer, cleanIndex, planPublish, planRollback, versionFile, draftState, EMPTY_LAYER, type BuilderMap, type Layer, type Index, type Plan } from '../world/builder'

export const dynamic = 'force-dynamic'
const ROOT = process.cwd()
const LIVE: Record<BuilderMap, string> = {
  wilds: join(ROOT, 'src/app/shimmer/world/wilds-edits.json'),
  glade: join(ROOT, 'src/app/shimmer/world/glade-edits.json'),   // M83 s2a: read by GET /shimmer/open/glade-edits (the game applies it in s2b)
}
const draftPath = (m: BuilderMap) => join(ROOT, 'data/builder', m, 'draft.json')
const versionsDir = (m: BuilderMap) => join(ROOT, 'src/app/shimmer/world/builder', m)

let chain: Promise<unknown> = Promise.resolve()
const serial = <T,>(f: () => Promise<T>): Promise<T> => { const r = chain.then(f, f); chain = r.catch(() => {}); return r }

const readJson = async (p: string): Promise<unknown> => { try { return JSON.parse(await readFile(p, 'utf-8')) } catch { return null } }
const put = async (p: string, j: unknown) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p, JSON.stringify(j) + '\n') }
const readLive = async (m: BuilderMap): Promise<Layer> => { const j = await readJson(LIVE[m]); return j ? cleanLayer(j) : { ...EMPTY_LAYER } }
const readIndex = async (m: BuilderMap): Promise<Index> => cleanIndex(await readJson(join(versionsDir(m), 'index.json')), m)
async function readDraft(m: BuilderMap): Promise<{ layer: Layer; at: number | null }> {
  const j = await readJson(draftPath(m))
  if (!j) return { layer: await readLive(m), at: null }          // no draft yet = start from what players walk
  let at: number | null = null; try { at = (await stat(draftPath(m))).mtimeMs } catch { /* */ }
  return { layer: cleanLayer(j), at }
}
async function run(m: BuilderMap, plan: Plan) {
  for (const w of plan.writes) {
    if (w.kind === 'version') await put(join(versionsDir(m), versionFile(w.v)), w.layer)
    else if (w.kind === 'live') await put(LIVE[m], w.layer)
    else if (w.kind === 'draft') await put(draftPath(m), w.layer)
    else await put(join(versionsDir(m), 'index.json'), w.index)
  }
}
async function snapshot(m: BuilderMap) {
  const [d, live, index] = await Promise.all([readDraft(m), readLive(m), readIndex(m)])
  return { map: m, draft: d.layer, draftAt: d.at, live, index, state: draftState(d.layer, live) }
}

export async function GET(req: NextRequest) {
  const m = req.nextUrl.searchParams.get('map')
  if (!isBuilderMap(m)) return NextResponse.json({ error: 'map must be one of the builder maps' }, { status: 400 })
  return NextResponse.json(await snapshot(m), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  let body: { map?: unknown; action?: unknown; layer?: unknown; note?: unknown; v?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const m = body.map
  if (!isBuilderMap(m)) return NextResponse.json({ error: 'map must be one of the builder maps' }, { status: 400 })
  try {
    return await serial(async () => {
      const at = new Date().toISOString()
      if (body.action === 'draft') {
        if (!body.layer || typeof body.layer !== 'object') return NextResponse.json({ error: 'expected layer' }, { status: 400 })
        await put(draftPath(m), cleanLayer(body.layer))
        return NextResponse.json({ ok: true, ...(await snapshot(m)) })
      }
      if (body.action === 'publish') {
        const [d, live, index] = await Promise.all([readDraft(m), readLive(m), readIndex(m)])
        await run(m, planPublish(index, d.layer, live, at, body.note))
        if (d.at === null) await put(draftPath(m), d.layer)
        return NextResponse.json({ ok: true, ...(await snapshot(m)) })
      }
      if (body.action === 'rollback') {
        const v = Number(body.v), index = await readIndex(m)
        const j = Number.isInteger(v) ? await readJson(join(versionsDir(m), versionFile(v))) : null
        const plan = j ? planRollback(index, v, cleanLayer(j), at) : null
        if (!plan) return NextResponse.json({ error: `no version ${String(body.v)}` }, { status: 404 })
        await run(m, plan)
        return NextResponse.json({ ok: true, ...(await snapshot(m)) })
      }
      return NextResponse.json({ error: "action must be 'draft', 'publish' or 'rollback'" }, { status: 400 })
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
