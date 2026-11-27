// ── BETA M247 s1: THE DASH COURSE EDITOR (owner desktop 1280x900) ──
// SCRATCH ONLY against prod (ather.games is Alex's live save): every request to save-builder (GET + POST) is answered IN THE PAGE
// from a scratch store this check keeps in memory (draft / publish / index), so nothing reaches the real store; the REAL 'dash'
// store is read before + after (a marked GET that passes through) and must hash the same.
//   owner: Creative mode, map 'Dash course': spray a loop (a real mouse drag), 3 sections (Swim / Climb / Blocks) + start + finish
//   clicked on the line; no tight turn on the loop; Play: the dash-cam canvas renders and the test Vulnyx's place on the course
//   advances every second; Save draft, reload: the course is kept (from the scratch store); a crafted hairpin stroke is flagged
//   (map ring + list line); Undo clears it; Publish lands on the scratch store (v2 live, v1 'as shipped'); 0 page errors.
//   OWNER_KEY=... npx tsx scripts/m247-course-editor-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type HTTPRequest } from 'puppeteer-core'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m247-s1-2026-11-27')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.log('no OWNER_KEY'); process.exit(2) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
type W = any
const errs: string[] = [], posts: string[] = []
// the scratch store (the route's plan, enough of it: draft replace, publish = v1 'as shipped' + vN, live = draft)
const EMPTY = { v: 1, tiles: {}, water: {}, falls: {} }
const S: { draft: any; draftAt: number | null; live: any; index: { map: string; live: number | null; versions: any[] } } = { draft: EMPTY, draftAt: null, live: EMPTY, index: { map: 'dash', live: null, versions: [] } }
const snapOf = () => ({ map: 'dash', draft: S.draft, draftAt: S.draftAt, live: S.live, index: S.index, state: JSON.stringify(S.draft.course ?? null) === JSON.stringify(S.live.course ?? null) ? 'matches live' : 'unpublished changes' })
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  const ctx = await br.createBrowserContext(), o: Page = await ctx.newPage()
  o.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await o.setViewport({ width: 1280, height: 900 }); await o.evaluateOnNewDocument('window.__name = (f) => f')
  await o.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.goto(`${url}/shimmer/open/wilds-edits`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  const store = () => o.evaluate(async () => { const r = await fetch('/shimmer/save-builder?map=dash', { cache: 'no-store', headers: { 'x-m247-real': '1' } }); return { status: r.status, j: r.ok ? await r.json() : null } }) as Promise<{ status: number; j: any }>
  const hashes = (s: any) => s ? ({ draft: hash(s.draft), live: hash(s.live), v: s.index?.live, n: s.index?.versions?.length }) : null
  const real0 = await store(); const h0 = hashes(real0.j)
  console.log(`  real 'dash' store before: HTTP ${real0.status} ${JSON.stringify(h0)}`)
  await o.setRequestInterception(true)
  o.on('request', (r: HTTPRequest) => {
    if (r.url().includes('/shimmer/save-builder') && !r.headers()['x-m247-real']) {   // the scratch store answers; never the real one
      if (r.method() === 'POST') {
        const b = JSON.parse(r.postData() ?? '{}'); posts.push(`${b.map}:${b.action}`)
        if (b.map === 'dash' && b.action === 'draft') { S.draft = b.layer; S.draftAt = Date.now() }
        else if (b.map === 'dash' && b.action === 'publish') {
          const at = new Date().toISOString()
          if (!S.index.versions.length) S.index.versions.push({ v: 1, at, note: 'as shipped before the builder', size: {} })
          const v = S.index.versions.length + 1; S.index.versions.push({ v, at, note: b.note ?? 'publish', size: {} }); S.index.live = v; S.live = S.draft
        }
      }
      r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...snapOf(), ok: true }) }); return
    }
    r.continue()
  })
  const open = async () => {
    await o.goto(`${url}/shimmer/dev?mode=terrain&map=dash`, { waitUntil: 'load', timeout: 240000 })
    await o.waitForFunction('window.__dashCourse?.ready === true', { timeout: 120000, polling: 300 })
    await sleep(800)
  }
  await open()
  ok(!!(await o.$('[data-testid="dash-course-editor"]')) && !!(await o.$('[data-testid="map-dash"]')), '0. Creative mode opens the Dash course workspace (map picker: Dash course)')
  const box = async () => (await (await o.$('[data-testid="dash-map"]'))!.boundingBox())!
  let bb = await box()
  const px = (x: number, z: number) => ({ x: bb.x + ((x + 45) / 90) * bb.width, y: bb.y + ((z + 45) / 90) * bb.height })
  const drag = async (pts: [number, number][]) => {
    const a = px(...pts[0]); await o.mouse.move(a.x, a.y); await o.mouse.down()
    for (const p of pts.slice(1)) { const q = px(...p); await o.mouse.move(q.x, q.y, { steps: 2 }) }
    await o.mouse.up(); await sleep(300)
  }
  // 1. spray a loop (an oval 25 x 18 m)
  await o.click('[data-testid="dash-tool-spray"]')
  await drag(Array.from({ length: 49 }, (_, i) => [25 * Math.cos(i / 48 * 2 * Math.PI), 18 * Math.sin(i / 48 * 2 * Math.PI)] as [number, number]))
  const line = await o.evaluate(() => (window as W).__dashCourse.line()) as [number, number][]
  const L = line.length
  ok(L > 100, `1. the spray drag painted a course line (${L} points, 1 m apart)`)
  // 2. sections + start + finish, clicked on the line
  const clickAt = async (i: number) => { bb = await box(); const q = px(line[i][0], line[i][1]); await o.mouse.click(q.x, q.y); await sleep(250) }
  for (const [k, f] of [['swim', 0.25], ['climb', 0.5], ['blocks', 0.72]] as const) { await o.select('[data-testid="dash-kind"]', k); await clickAt(Math.round(L * f)) }
  await o.click('[data-testid="dash-tool-start"]'); await clickAt(3)
  await o.click('[data-testid="dash-tool-finish"]'); await clickAt(L - 4)
  const c1 = await o.evaluate(() => (window as W).__dashCourse.course()) as any
  const secs = await o.evaluate(() => (window as W).__dashCourse.sections()) as { kind: string; len: number }[]
  ok(c1.marks.length === 3 && c1.marks.map((m: any) => m.kind).join() === 'swim,climb,blocks', `2. three section markers placed (${c1.marks.map((m: any) => m.kind).join()})`)
  ok(!!c1.start && !!c1.finish && !!(await o.$('[data-testid="dash-start"]')) && !!(await o.$('[data-testid="dash-finish"]')), '2. start + finish placed and drawn')
  ok(secs.map(s => s.kind).join() === 'run,swim,climb,blocks', `2. the course runs ${secs.map(s => `${s.kind} ${Math.round(s.len)} m`).join(', ')}`)
  const ck0 = await o.evaluate(() => (window as W).__dashCourse.checks()) as any
  ok(ck0.tight.length === 0, `2. the loop has no tight turn (${ck0.tight.length}); cam spots ${ck0.cam.length}`)
  // 3. Play: the dash cam renders and she advances each second
  await o.click('[data-testid="dash-play"]')
  const ds: number[] = []
  for (let k = 0; k < 4; k++) { await sleep(1000); ds.push(await o.evaluate(() => (window as W).__dashCourse.preview().d) as number) }
  const pv = await o.evaluate(() => (window as W).__dashCourse.preview()) as any
  console.log(`  play button '${await o.$eval('[data-testid="dash-play"]', e => e.textContent)}', preview ${JSON.stringify({ t: pv.t, d: pv.d, s: pv.s, playing: pv.playing, kind: pv.kind })}`)
  ok(ds.every((d, i) => i === 0 ? d > 0 : d > ds[i - 1] + 1), `3. Play: the Vulnyx advances every second (${ds.map(d => d.toFixed(1)).join(' -> ')} m of ${pv.T.toFixed(1)} s)`)
  const cv = await o.$eval('[data-testid="dash-preview"] canvas', (c: any) => ({ w: c.width, h: c.height })).catch(() => null)
  ok(!!cv && cv.w > 200 && cv.h > 100, `3. the dash-cam preview canvas renders (${cv?.w}x${cv?.h})`)
  const model = await o.evaluate(() => (window as W).__spiritModel?.species?.fox ?? (window as W).__spiritModel?.mounted ?? 0)
  ok(Number(model) > 0, `3. her real model is mounted (${model})`)
  await o.screenshot({ path: `${out}/desk-editor-play.png` })
  await o.click('[data-testid="dash-play"]')   // pause
  // 4. save draft + reload keeps it
  await o.click('[data-testid="dash-save"]'); await sleep(800)
  ok(posts.includes('dash:draft') && JSON.stringify(S.draft.course?.marks) === JSON.stringify(c1.marks), `4. Save draft posted the course (${posts.join(', ')})`)
  await open()
  const c2 = await o.evaluate(() => (window as W).__dashCourse.course()) as any
  ok(c2.strokes.length === c1.strokes.length && JSON.stringify(c2.marks) === JSON.stringify(c1.marks) && JSON.stringify(c2.start) === JSON.stringify(c1.start), `4. reload keeps it (${c2.strokes.length} stroke, ${c2.marks.length} markers, start + finish)`)
  // 5. a crafted hairpin is flagged
  bb = await box()
  await o.click('[data-testid="dash-tool-spray"]')
  await drag([[30, -6], [30, -2], [30, 2], [30, 6], [30, 10], [30.8, 11], [31.6, 10], [31.6, 6], [31.6, 2], [31.6, -2], [31.6, -6]])
  await sleep(400)
  { const l2 = await o.evaluate(() => (window as W).__dashCourse.line()) as [number, number][]; bb = await box(); await o.click('[data-testid="dash-tool-finish"]'); const q = px(...l2[l2.length - 2]); await o.mouse.click(q.x, q.y); await sleep(400) }   // the finish moves to the hairpin's end (it is raced)
  const ck1 = await o.evaluate(() => (window as W).__dashCourse.checks()) as any
  const ring = await o.$$eval('[data-testid="dash-map"] [data-spot="tight"]', e => e.length), listed = await o.$$eval('[data-check="tight"]', e => e.map(x => x.textContent))
  const hp = ck1.tight.find((s: any) => Math.abs(s.x - 30.8) < 4 && s.z > 6)
  ok(!!hp && ring > 0 && listed.length > 0, `5. the hairpin is flagged (radius ${hp?.r} m at ${hp?.x?.toFixed(1)},${hp?.z?.toFixed(1)}; ${ring} ring, '${listed[0]}')`)
  await o.screenshot({ path: `${out}/desk-hairpin-flagged.png` })
  await o.click('[data-testid="dash-undo"]'); await sleep(300); await o.click('[data-testid="dash-undo"]'); await sleep(400)   // the finish move, then the stroke
  ok((await o.evaluate(() => (window as W).__dashCourse.checks().tight.length)) === 0, '5. Undo (x2) takes the finish move + the hairpin stroke back (no tight turn)')
  // 6. Publish (scratch store only)
  await o.click('[data-testid="dash-publish"]'); await sleep(1200)
  ok(posts.includes('dash:publish') && S.index.live === 2 && JSON.stringify(S.live.course?.marks) === JSON.stringify(c1.marks), `6. Publish lands on the SCRATCH store (live v${S.index.live}, ${S.index.versions.length} versions)`)
  const st = await o.$eval('[data-testid="dash-status"]', e => e.textContent ?? '')
  ok(/matches live/.test(st), `6. the editor says it matches live ('${st}')`)
  const real1 = await store(); const h1 = hashes(real1.j)
  ok(JSON.stringify(h0) === JSON.stringify(h1), `7. the REAL store is untouched (${JSON.stringify(h1)}; ${posts.length} POSTs answered by the scratch store)`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `8. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
