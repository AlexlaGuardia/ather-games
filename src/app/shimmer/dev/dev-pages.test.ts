/**
 * A DEV PAGE NOBODY CAN NAVIGATE TO IS A TOOL THAT WAS NOT BUILT.
 *
 * ★★★ WHY THIS EXISTS (2026-09-01, hub lane). Sixteen standalone pages under `/shimmer/dev/`, and
 * exactly ONE was linked from anywhere. Fourteen of them were built in nine days, several of them
 * BECAUSE Alex said he was flying blind, and then shipped into a place he could not click to. The
 * palette that would have surfaced them already existed and had two entries in it.
 *
 * ⚠⚠ THE FIX IS NOT "REMEMBER TO REGISTER THE PAGE". That is the shape PATTERNS keeps naming: a
 * hand-kept list is the thing still sitting there a month after its reason expired, and an act of
 * memory separate from shipping is an act that does not happen. So registration is DISCOVERED and
 * MANDATORY — a new dev page is red until it appears in `dev-pages.ts`. It joins the index by
 * EXISTING, the same way `dev-eye.test.ts` enrols a new 3D page by existing.
 *
 * ⚠ AND IT MUST NOT GO BLIND. PATTERNS 2026-08-22: an empty measurement window can only ever
 * return one answer, and a guard that cannot find its subject reports "nothing wrong". If
 * discovery turns up no pages at all, that is a FAILURE here, not a pass — the directory moved, or
 * the glob is wrong, and either way this guard has stopped being able to see what it guards.
 *
 * Run: `npx tsx src/app/shimmer/dev/dev-pages.test.ts` (repo convention — there is no vitest).
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEV_PAGES, DEV_GROUPS, DEV_GROUP_ORDER, DEV_ERAS, DEV_ERA_ORDER, type DevPage } from './templates/dev-pages'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

const APP = join(process.cwd(), 'src/app')
const DEV = join(APP, 'shimmer/dev')

/** `/shimmer/dev/grey` -> `src/app/shimmer/dev/grey/page.tsx` */
const fileFor = (path: string) => join(APP, path.replace(/^\//, ''), 'page.tsx')

// ── DISCOVERY ─────────────────────────────────────────────────────────────────────────────────
// Every directory under /shimmer/dev that ships a route.
const shimmerDevRoutes = readdirSync(DEV, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(n => existsSync(join(DEV, n, 'page.tsx')))
  .map(n => `/shimmer/dev/${n}`)
  .sort()

/**
 * Every OTHER route in the app whose path contains a `dev` segment — `/vault/dev`, `/nolmir/dev`.
 * ★ DERIVED, NOT LISTED. A hand-kept set of out-of-tree dev routes is the exact artefact this
 * guard exists to abolish; the day somebody adds `/squall/dev` it must go red on its own.
 */
function routesUnder(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    // Route groups `(x)` and private folders `_x` do not contribute a path segment we care about.
    if (e.name.startsWith('_') || e.name.startsWith('(') || e.name === 'node_modules') continue
    const p = `${prefix}/${e.name}`
    if (existsSync(join(dir, e.name, 'page.tsx'))) out.push(p)
    out.push(...routesUnder(join(dir, e.name), p))
  }
  return out
}
const outOfTreeDevRoutes = routesUnder(APP)
  .filter(p => p.split('/').includes('dev'))
  .filter(p => !p.startsWith('/shimmer/dev'))
  .sort()

const discovered = [...shimmerDevRoutes, ...outOfTreeDevRoutes]

// ── BLIND CHECK — before anything else ────────────────────────────────────────────────────────
// ⚠ These two asserts are the difference between "I found no drift" and "I could not look".
ok(shimmerDevRoutes.length > 0, `BLIND: no routes discovered under ${DEV} — the glob has stopped seeing its subject`)
ok(outOfTreeDevRoutes.length > 0, 'BLIND: no out-of-tree dev route found anywhere in src/app — /vault/dev and /nolmir/dev both exist')
ok(DEV_PAGES.length > 0, 'BLIND: DEV_PAGES is empty, so every membership check below is vacuous')

const registered = new Set(DEV_PAGES.map(p => p.path))

// ── 1. EVERY DISCOVERED DEV ROUTE IS REGISTERED ───────────────────────────────────────────────
// This is the assert that fires on the next unregistered page. It names the path, because a count
// that goes red without saying why invites the cheapest lie that makes it green.
for (const path of discovered) {
  ok(registered.has(path), `UNREGISTERED: ${path} ships a page but is not in dev-pages.ts — add it, or nobody will ever find it`)
}

// ── 2. EVERY REGISTERED PATH ACTUALLY EXISTS ──────────────────────────────────────────────────
// The other direction, and it is the one that catches a deleted or renamed page still advertised
// on the index — a card that 404s is worse than an absent card.
for (const p of DEV_PAGES) {
  ok(existsSync(fileFor(p.path)), `DEAD LINK: ${p.path} is registered but ${fileFor(p.path)} does not exist`)
}

// ── 3. THE ENTRIES ARE USABLE ─────────────────────────────────────────────────────────────────
const seenPaths = new Set<string>()
const seenBlurbs = new Set<string>()
for (const p of DEV_PAGES) {
  ok(!seenPaths.has(p.path), `DUPLICATE PATH: ${p.path} registered twice`)
  seenPaths.add(p.path)

  ok(p.title.trim().length > 0, `EMPTY TITLE: ${p.path}`)
  // A blurb is the whole reason the index beats a list of URLs. An entry with a stub blurb is a
  // row that tells you a page exists and nothing about whether it is the one you want.
  ok(p.blurb.trim().length >= 20, `THIN BLURB: ${p.path} — "${p.blurb}" says too little to choose by`)
  ok(/[.!?]$/.test(p.blurb.trim()), `BLURB NOT A SENTENCE: ${p.path} — "${p.blurb}"`)

  // ⚠ Two pages with the same blurb means one was copy-pasted and never rewritten, which is how a
  // description stops describing its page.
  const key = p.blurb.trim().toLowerCase()
  ok(!seenBlurbs.has(key), `DUPLICATE BLURB: ${p.path} reuses another page's description verbatim`)
  seenBlurbs.add(key)

  ok(p.path.startsWith('/'), `PATH NOT ABSOLUTE: ${p.path}`)
  ok(DEV_GROUPS[p.group] !== undefined, `UNKNOWN GROUP: ${p.path} is in "${p.group}", which DEV_GROUPS does not define`)
}

// ── 4. THE INDEX CAN RENDER ALL OF THEM ───────────────────────────────────────────────────────
// ★ ERA RULE (2026-11-19): every page names which game it serves, the index leads with the live game,
// and the pages that import the open world's models are the ones in the live era.
const LIVE_PAGES = ['folk', 'guns', 'hands', 'keeper-body', 'moglins', 'sounds', 'sky'].map(n => `/shimmer/dev/${n}`)
const OTHER_PAGES = ['/vault/dev', '/nolmir/dev', '/nolmir/sfx-lab']
for (const p of DEV_PAGES) {
  ok(DEV_ERAS[p.era] !== undefined, `UNKNOWN ERA: ${p.path} is in "${p.era}", which DEV_ERAS does not define`)
}
ok(DEV_ERA_ORDER[0] === 'live', 'LIVE GAME MUST LEAD: DEV_ERA_ORDER[0] is not "live"')
for (const e of DEV_ERA_ORDER) ok(DEV_ERAS[e] !== undefined, `ORDERED ERA UNDEFINED: "${e}"`)
for (const path of LIVE_PAGES) {
  const p = DEV_PAGES.find(x => x.path === path)
  ok(p !== undefined && p.era === 'live', `LIVE PAGE NOT LIVE: ${path} serves the open world but is ${p ? `in era "${p.era}"` : 'unregistered'}`)
}
for (const path of OTHER_PAGES) ok(DEV_PAGES.find(x => x.path === path)?.era === 'other', `OTHER-GAME PAGE MISPLACED: ${path} should be era "other"`)
// ★ M214 (2026-11-26, Alex: 'a graveyard of old tools'). The old era is GONE from the app, not folded: 30
// voxel / play3d / pixel routes were removed with an ordinary commit and DEV_ARCHIVE.md names each one's sha.
// (Replaces the 11-19 asserts "OLD VERSIONS MUST BE LAST" and "an old page may not import the live game":
// their subject, the old era, no longer exists.) Two gates take their place:
//   (a) no dev route imports the archived engines (voxel3d / play3d) - that import IS what made a page old;
//   (b) every route the archive lists stays out of the app and out of the registry, and carries a sha.
const ARCHIVED_ENGINE = /from '(?:(?:\.\.?\/)+|@\/app\/shimmer\/)(voxel3d|play3d)\//
for (const path of shimmerDevRoutes) {
  const dir = join(DEV, path.slice('/shimmer/dev/'.length))
  for (const f of readdirSync(dir).filter(n => /\.tsx?$/.test(n) && !/\.test\./.test(n))) {
    const m = readFileSync(join(dir, f), 'utf8').match(ARCHIVED_ENGINE)
    ok(!m, `ARCHIVED ENGINE: ${path}/${f} imports ${m?.[1]}/ - an old-era page; archive it (DEV_ARCHIVE.md) instead of shipping it`)
  }
}
const ARCHIVE = join(process.cwd(), 'DEV_ARCHIVE.md')
ok(existsSync(ARCHIVE), 'DEV_ARCHIVE.md is missing: the removed routes have no way back')
const archived = existsSync(ARCHIVE)
  ? [...readFileSync(ARCHIVE, 'utf8').matchAll(/^\| `(\/[^`]+)` \| `([0-9a-f]{7,40})` \|/gm)].map(m => ({ path: m[1], sha: m[2] }))
  : []
ok(archived.length >= 30, `BLIND: DEV_ARCHIVE.md lists ${archived.length} routes, the M214 removal was 30 - the row regex has stopped seeing the table`)
for (const a of archived) {
  ok(!registered.has(a.path), `ARCHIVED BUT REGISTERED: ${a.path} is in DEV_ARCHIVE.md and still on the index`)
  ok(!existsSync(fileFor(a.path)), `ARCHIVED BUT SHIPPING: ${a.path} is in DEV_ARCHIVE.md but ${fileFor(a.path)} exists`)
}

// ★ M214: the landing leads with the Creative mode pill (the World Builder, ?mode=terrain).
const indexSrc = readFileSync(join(DEV, 'templates/DevIndex.tsx'), 'utf8')
const pillAt = indexSrc.indexOf('data-creative-pill')
ok(pillAt > 0 && indexSrc.includes("'terrain'"), 'NO CREATIVE PILL: DevIndex no longer renders the Creative mode pill that opens ?mode=terrain')
ok(pillAt > 0 && pillAt < indexSrc.indexOf('data-live-tools'), 'CREATIVE PILL NOT FIRST: the pill must come before the live tools')

// ⚠ A group missing from DEV_GROUP_ORDER does not error — it silently renders NOTHING, so the
// pages in it vanish from the index while still passing every check above. That is this file's own
// failure mode wearing a costume, so it gets an assert of its own.
const groupsInUse = new Set<DevPage['group']>(DEV_PAGES.map(p => p.group))
for (const g of groupsInUse) {
  ok(DEV_GROUP_ORDER.includes(g), `GROUP NOT RENDERED: "${g}" is used by a page but missing from DEV_GROUP_ORDER — those pages would silently vanish from the index`)
}
for (const g of DEV_GROUP_ORDER) {
  ok(DEV_GROUPS[g] !== undefined, `ORDERED GROUP UNDEFINED: "${g}" is in DEV_GROUP_ORDER but not DEV_GROUPS`)
}

// ★ M214 s2: Doctor and Mesh Bench tabs are archived (DEV_ARCHIVE.md). The hub must not offer or load them.
const hubSrc = readFileSync(join(DEV, 'page.tsx'), 'utf8')
const archSrc = readFileSync(ARCHIVE, 'utf8')
for (const [id, file] of [['doctor', 'DoctorPanel.tsx'], ['meshbench', 'MeshBench.tsx']] as const) {
  ok(!new RegExp(`id: '${id}'|^\\s+${id}:`, 'm').test(hubSrc), `ARCHIVED TAB LIVE: ${id} is still a tab / editor entry in dev/page.tsx`)
  ok(!existsSync(join(DEV, 'editors', file)), `ARCHIVED TAB SHIPPING: editors/${file} exists`)
  ok(archSrc.includes('| `' + id + '` |'), `NOT ARCHIVED: DEV_ARCHIVE.md has no row for the ${id} tab`)
}

// ── REPORT ────────────────────────────────────────────────────────────────────────────────────
console.log(`dev-pages: ${pass} pass, ${fails.length} fail`)
console.log(`  discovered ${shimmerDevRoutes.length} under /shimmer/dev + ${outOfTreeDevRoutes.length} out-of-tree, ${DEV_PAGES.length} registered`)
if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
