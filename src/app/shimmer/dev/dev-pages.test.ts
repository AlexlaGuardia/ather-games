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
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DEV_PAGES, DEV_GROUPS, DEV_GROUP_ORDER, type DevPage } from './templates/dev-pages'

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

// ── REPORT ────────────────────────────────────────────────────────────────────────────────────
console.log(`dev-pages: ${pass} pass, ${fails.length} fail`)
console.log(`  discovered ${shimmerDevRoutes.length} under /shimmer/dev + ${outOfTreeDevRoutes.length} out-of-tree, ${DEV_PAGES.length} registered`)
if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
