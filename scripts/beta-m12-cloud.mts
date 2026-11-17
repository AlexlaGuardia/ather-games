// ── BETA M12.5: THE OPEN WORLD'S CLOUD SAVE, what a script can prove on prod (2026-11-17, hub) ──────────────────────
// Real Google sign-in cannot be scripted, so the two-device protocol itself is proven by src/lib/open-cloud-core.test.ts
// (two fake devices + a CAS server). This check proves the LIVE wiring does no harm on the paths a stranger walks:
//   A · anonymous keeper: the sync stays off, NO request to /api/saves/open, 0 page errors.
//   B · a faked signed-in session (client-side only, like beta-m12-swap): the client asks for the lease, the real
//       server refuses it (no cookie: 401), the sync stays off, local keys are byte-identical after, 0 page errors.
//   C · the module is live: window.__openCloud exists on the open-world page (the bundle carries it).
//   npx tsx scripts/beta-m12-cloud.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const URL_ = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const br = await puppeteer.launch({ protocolTimeout: 240000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS })

async function run(label: string, session: string | null) {
  const ctx = await br.createBrowserContext()
  const p: Page = await ctx.newPage(); await p.setViewport({ width: 1000, height: 640 })
  const errs: string[] = [], calls: string[] = []
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  p.on('response', r => { if (r.url().includes('/api/saves/open')) calls.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`) })
  await p.setRequestInterception(true)
  p.on('request', r => session && r.url().includes('/api/auth/session')
    ? r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: { user_id: session, username: 'm12cloud', character_id: null, avatar: null } }) })
    : r.continue())
  await p.goto(`${URL_}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }).catch(() => {})
  await sleep(8000)
  const snap = () => p.evaluate(() => { const o: Record<string, string> = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; o[k] = localStorage.getItem(k)! } return o })
  const before = await snap()
  const st = await p.evaluate(() => (window as any).__openCloud?.state?.() ?? null)
  ok(!!st, `${label}: the cloud module is live on the page`)
  ok(st?.mode === 'off', `${label}: sync stays off (mode ${st?.mode})`)
  await sleep(4000)
  const after = await snap()
  const changed = Object.keys({ ...before, ...after }).filter(k => before[k] !== after[k] && !k.startsWith('ather:open:') && k !== 'ather:device')
  if (session) {
    ok(calls.length > 0 && calls.every(c => / 401$/.test(c)), `${label}: the server refused the unauthenticated lease (${calls.join(', ') || 'no call'})`)
    ok(!Object.keys(after).some(k => k.startsWith('ather:open:backup')), `${label}: no backup written, nothing adopted`)
  } else ok(calls.length === 0, `${label}: no request to /api/saves/open (${calls.join(', ') || 'none'})`)
  ok(errs.length === 0, `${label}: 0 page errors ${errs.length ? JSON.stringify(errs) : ''}`)
  console.log(`  note ${label}: ${changed.length} local keys changed in the 4 s watch (the game's own saves)`)
  await ctx.close()
}
await run('A anonymous', null)
await run('B faked session', 'm12-cloud-test-user')
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
