/**
 * EVERY DEV PAGE LEADS BACK TO THE INDEX.
 *
 * ★★★ WHY THIS EXISTS (2026-09-02, hub lane). The 09-01 index made twenty-two dev pages reachable
 * for the first time, and the count of them that could get you BACK was **zero**. Navigation was
 * one-directional: the browser Back button was the entire model, and on a page you deep-linked to
 * there is nothing behind it. Alex: *"lets make sure its easily navigable.. so each page and editor
 * leads back to the main dev page."*
 *
 * ⚠⚠ THE FIX IS NOT "ADD THE LINK TO THE PAGE". That is twenty-two acts of memory, and the entry
 * this whole surface was built from says an act of memory separate from shipping is an act that
 * does not happen — it is exactly how sixteen pages got built unlinked in nine days. So the link is
 * mounted by LAYOUT: a page under `/shimmer/dev` inherits it by existing. This guard exists for the
 * gap a layout cannot close — a dev page registered in a tree no layout covers, which is precisely
 * how the six out-of-tree pages (`/vault/dev`, `/nolmir/dev`, `/shimmer/arena`, …) arrived.
 *
 * ⚠ AND IT MUST NOT GO BLIND. PATTERNS 2026-08-22: a guard that cannot find its subject reports
 * "nothing wrong". If `DEV_PAGES` is empty, or `DevBack` stops linking to the index, every
 * coverage check below is vacuously true — so those are asserted FIRST and as failures.
 *
 * Run: `npx tsx src/app/shimmer/dev/dev-back.test.ts`
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { DEV_PAGES } from './templates/dev-pages'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

const APP = join(process.cwd(), 'src/app')
const BACK = join(APP, 'shimmer/dev/templates/DevBack.tsx')

/** Comments stripped, so a guard never matches the prose that documents it (PATTERNS 2026-08-22). */
const codeOnly = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

// ── BLIND CHECKS — before anything else ───────────────────────────────────────────────────────
ok(DEV_PAGES.length > 0, 'BLIND: DEV_PAGES is empty, so every coverage check below is vacuous')
ok(existsSync(BACK), `BLIND: DevBack.tsx is missing at ${BACK} — nothing can be covered by it`)

const backSrc = existsSync(BACK) ? codeOnly(readFileSync(BACK, 'utf8')) : ''
ok(backSrc.includes("'/shimmer/dev'"), 'BLIND: DevBack no longer references /shimmer/dev — it is not a way back to anything')
ok(/href=/.test(backSrc), 'BLIND: DevBack renders no href, so mounting it navigates nowhere')

// ★ The owner probe is load-bearing, not decoration: /vault/dev, /shimmer/arena and
// /shimmer/voxel3d/tex answer 200 to the public (proxy.ts), so an ungated link advertises the dev
// surface to players. It gates a LINK, not a route — the index stays 403 at the proxy regardless.
ok(backSrc.includes('/api/owner'), 'DevBack no longer checks /api/owner — the link would show to players on the four ungated pages')

// ── COVERAGE ──────────────────────────────────────────────────────────────────────────────────
/** Does this file mount DevBack? Import + usage, both, so a stale import does not count. */
function mountsBack(file: string): boolean {
  if (!existsSync(file)) return false
  const src = codeOnly(readFileSync(file, 'utf8'))
  return /import\s+DevBack\s+from/.test(src) && /<DevBack\b/.test(src)
}

/**
 * A page is covered if it mounts DevBack itself, or ANY layout at or above it does — stopping at
 * `src/app`, because the root layout is shared with the public site and must never carry it.
 */
function coveredBy(pagePath: string): string | null {
  const file = join(APP, pagePath.replace(/^\//, ''), 'page.tsx')
  if (mountsBack(file)) return 'page'
  let dir = dirname(file)
  while (dir.startsWith(APP) && dir !== APP) {
    const layout = join(dir, 'layout.tsx')
    if (mountsBack(layout)) return layout.slice(APP.length + 1)
    dir = dirname(dir)
  }
  return null
}

let covered = 0
for (const p of DEV_PAGES) {
  const file = join(APP, p.path.replace(/^\//, ''), 'page.tsx')
  if (!existsSync(file)) {
    // dev-pages.test.ts owns the registered-but-missing case; not this guard's job to duplicate it.
    continue
  }
  const by = coveredBy(p.path)
  ok(by !== null, `NO WAY BACK: ${p.path} is registered in the index but nothing at or above it mounts DevBack — add a layout.tsx in its tree`)
  if (by) covered++
}

ok(covered > 0, 'BLIND: not one registered page resolved to a DevBack mount — the resolver is looking in the wrong place')

// ── THE ROOT LAYOUT MUST NOT CARRY IT ─────────────────────────────────────────────────────────
// ⚠ The cheapest wrong answer that satisfies every check above is to mount DevBack in
// `src/app/layout.tsx`, which would put it on the arcade, the bookstore and every public game.
// The owner probe would hide it, but a hidden link is not a design — it is 22 correct pages and a
// hundred wrong ones sharing an accident. (PATTERNS 2026-08-23: ask what the cheapest wrong answer
// that still satisfies a guard would be.)
ok(!mountsBack(join(APP, 'layout.tsx')), 'ROOT LAYOUT MOUNTS DevBack: every public page on the site would carry the dev back-link')

// ── THE NODE-ONLY DERIVER MUST STAY OUT OF THE CLIENT ─────────────────────────────────────────
// `band-derive.ts` reads the filesystem. If a client component ever imports it the dev index stops
// building, with an error that points at `node:fs` rather than at the import that caused it.
const clientImporters: string[] = []
for (const f of ['templates/DevIndex.tsx', 'templates/DevBack.tsx', 'page.tsx']) {
  const p = join(APP, 'shimmer/dev', f)
  if (existsSync(p) && /from\s+'[^']*band-derive'/.test(readFileSync(p, 'utf8'))) clientImporters.push(f)
}
ok(clientImporters.length === 0, `CLIENT IMPORTS band-derive (node:fs): ${clientImporters.join(', ')} — import editor-bands.generated instead`)

// ── AN EDITOR THE PUBLIC CAN REACH IS AN EDITOR THE PUBLIC CAN USE ───────────────────────────
/**
 * ★★★ FOUND 2026-09-02 WHILE WIRING THE BACK-LINKS, WHICH IS THE ONLY REASON IT WAS FOUND.
 * Probing which registered pages were owner-gated (so `DevBack` would not advertise the dev surface
 * to players) turned up `/vault/dev` answering **200 to anybody**. `/vault` is tier `live`, so it
 * never entered `GATED_GAME_PREFIXES`, and `classify` returned null for everything beneath it —
 * while `/vault/dev/save` has no owner check of its own. An unauthenticated POST with a valid slot
 * key overwrites or DELETES an authored level in `public/vault/authored-levels.json` on prod.
 *
 * ⚠ AND THE THING THAT WOULD HAVE STOPPED ANYONE CHECKING WAS A COMMENT. `vault/dev/layout.tsx`
 * reads "Owner tool — keep it out of the index (mirrors /shimmer/dev)" — accurate-sounding prose
 * describing a relationship that never held for a second. PATTERNS 09-01: a note does not rot into
 * nonsense, it rots into something plausible, and the confident ones cancel the look.
 *
 * So the rule is asserted from the REGISTRY rather than remembered: a registered page that AUTHORS
 * (group `editor`) must be gated. Play harnesses and spikes are deliberately public and are not
 * claimed here — the rule is about writing, not about secrecy.
 */
const proxySrc = readFileSync(join(process.cwd(), 'src/proxy.ts'), 'utf8')
const toolPrefixes = [...proxySrc.matchAll(/path\.startsWith\("([^"]+)"\)/g)].map(m => m[1])

// ⚠ A textual reader over a file it does not own — so it gets both controls before it is believed.
ok(toolPrefixes.length > 0, 'BLIND: no tool prefixes parsed out of proxy.ts — this check cannot see its subject')
ok(toolPrefixes.includes('/shimmer/dev'), 'CONTROL FAILED: /shimmer/dev is not among the parsed tool prefixes, but proxy.ts gates it — the parse is wrong')
ok(!toolPrefixes.includes('/arcade'), 'CONTROL FAILED: /arcade parsed as a gated tool prefix — the parse is matching too much')

const gated = (p: string) => toolPrefixes.some(t => p === t || p.startsWith(t + '/') || p.startsWith(t))
for (const p of DEV_PAGES.filter(p => p.group === 'editor')) {
  ok(gated(p.path), `UNGATED EDITOR: ${p.path} authors source and is not owner-gated in proxy.ts — anyone can reach it, and its save route may not check either`)
}

// ── REPORT ────────────────────────────────────────────────────────────────────────────────────
console.log(`dev-back: ${pass} pass, ${fails.length} fail`)
console.log(`  ${covered}/${DEV_PAGES.length} registered pages have a way back to the index`)
if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
