// Read, write and delete authored blueprints. The worktable's disk.
//
// ★ NAMED `save-blueprint` TO INHERIT THE OWNER GATE, NOT FOR TIDINESS. `proxy.ts:20` hard-403s
// `/shimmer/save-*` for anyone without the owner cookie, so a route that writes files into the repo
// is protected by the same rule as every other source-mutating endpoint. ⚠ A blueprint editor
// reachable at `/api/blueprints` would have been an unauthenticated arbitrary file write into a
// directory the build reads. The convention IS the security here — do not "clean this up" onto a
// different prefix without moving the gate first.
//
// ★ IT VALIDATES THROUGH `blueprintProblems`, THE SAME FUNCTION THE EDITOR CALLS. One definition of
// what a blueprint is, checked on the way in AND on the way out — a file hand-edited in the repo is
// refused by `parseBlueprint` on read rather than loading as a subtly different building.
import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { safeWriteFile as writeFile } from '../lib/backup'
import {
  blueprintProblems, parseBlueprint, serializeBlueprint, SAFE_BLUEPRINT_ID, type BlueprintDef,
} from '../voxel/blueprints'

const DIR = join(process.cwd(), 'src/app/shimmer/data/blueprints')

/** GET — every blueprint's summary, or one whole blueprint by `?id=`. */
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    await mkdir(DIR, { recursive: true })

    if (id) {
      if (!SAFE_BLUEPRINT_ID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
      const raw = await readFile(join(DIR, `${id}.json`), 'utf-8').catch(() => null)
      if (raw === null) return NextResponse.json({ error: `no blueprint '${id}'` }, { status: 404 })
      // ⚠ Parsed, not passed through. A file edited by hand in the repo must fail HERE, loudly, and
      // not reach the editor as a building that is quietly not what its author drew.
      return NextResponse.json(parseBlueprint(raw))
    }

    const files = (await readdir(DIR)).filter(f => f.endsWith('.json'))
    const blueprints = []
    // ⚠ ONE BAD FILE MUST NOT EMPTY THE LIST. A listing that 500s because a single blueprint is
    // malformed hides the other nine and reads as "you have no blueprints" — so a broken entry is
    // REPORTED as an entry, with its reason, and the author can see which one to fix.
    for (const f of files.sort()) {
      const raw = await readFile(join(DIR, f), 'utf-8').catch(() => null)
      if (raw === null) continue
      try {
        const s = parseBlueprint(raw)
        blueprints.push({ id: s.id, name: s.name, w: s.w, h: s.h, d: s.d, blocks: s.cells.length / 4 })
      } catch (e) {
        blueprints.push({ id: f.replace(/\.json$/, ''), name: '(broken)', w: 0, h: 0, d: 0, blocks: 0,
                          error: e instanceof Error ? e.message : String(e) })
      }
    }
    return NextResponse.json({ blueprints })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

/** PUT — save one blueprint, whole. */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    // ★ EVERY REASON AT ONCE. The editor prints these verbatim; a save that fails one rule at a time
    // makes the author guess, and guessing is what put a tower in dirt brown.
    const problems = blueprintProblems(body)
    if (problems.length) return NextResponse.json({ error: 'invalid blueprint', problems }, { status: 400 })

    const s = body as BlueprintDef
    await mkdir(DIR, { recursive: true })
    // ★ The layout comes from the FORMAT module, not from string concatenation here — see
    // `serializeBlueprint`. A route that invents its own file layout is a second definition of it.
    await writeFile(join(DIR, `${s.id}.json`), serializeBlueprint(s))
    return NextResponse.json({ ok: true, id: s.id, blocks: s.cells.length / 4 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

/** DELETE — remove one blueprint by `?id=`. */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id || !SAFE_BLUEPRINT_ID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    await unlink(join(DIR, `${id}.json`)).catch(() => null)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
