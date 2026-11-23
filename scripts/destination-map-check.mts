// ── BETA M108: THE DESTINATION MAP gate at Franky (owner-only ?ship=gate; continent/destination-map.ts) ─────────────────
// SETUP (stated): fresh keepers (real BE BORN tap) in their own browser contexts, never a real keeper's save.
//   A · OWNER + ?ship=gate (needs OWNER_KEY: source .env): at Kael's yard, set down beside Franky's hull: the E verb reads
//       'board'; real E opens the destination map; its list = canon's three, word for word, in order; Hask and the Starforge
//       each show ONE 'not yet' zone, and tapping it does nothing (same URL, panel still open); Athernyx shows Rune Hold
//       (a fresh keeper's only pitstop); tapping it travels (?at=rune-hold, through the load screen) and the keeper ARRIVES
//       on foot within 40 m of Rune Hold's centre. Shots: the open map at 390x844 + at desk.
//   B · OWNER, no flag: same spot, no 'board' verb, E opens nothing.
//   C · NOT OWNER + ?ship=gate: same spot, no 'board' verb, E opens nothing.
// PASS = all of that + 0 page errors. Hooks MOVE (__drive.footTp / look) and READ (__shipyards, __drive.foot).
//   npx tsx scripts/destination-map-check.mts [origin, default https://ather.games] [--out /tmp/destmap] [--shot path.png]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'node:fs'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'https://ather.games').replace(/\/$/, '')
const out = flag('--out', '/tmp/destmap'), shot = flag('--shot', ''), only = flag('--only', '')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('OWNER_KEY not set: source /root/ather-games/.env first'); process.exit(2) }
const CANON = ['the Starforge', 'Athernyx', 'Hask (moon of Orrun): unidentified signal']
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as { places: { id: string; x: number; z: number }[] }
const RUNE = meta.places.find(q => q.id === 'rune-hold')!
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const KAEL = 'front:shipyard'
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] })
const errs: string[] = []
const res: Record<string, any> = { url }
const t00 = Date.now(), say = (m: string) => console.log(`[${((Date.now() - t00) / 1000).toFixed(0)}s] ${m}`)
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; console.log(JSON.stringify(res, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
const fail = (step: string, why: string) => done(false, `FAIL at "${step}": ${why}`)
const poll = async (fn: () => Promise<boolean>, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(400) } return false }
const toW = (s: any, lx: number, lz: number) => ({ x: s.x + s.ax[0] * lx + s.az[0] * lz, z: s.z + s.ax[1] * lx + s.az[1] * lz })
const yawTo = (dx: number, dz: number) => Math.atan2(-dx, -dz)

async function keeper(owner: boolean): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1000, height: 640 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'networkidle2', timeout: 60000 })
  // (the unlock redirects to the site's public origin, so ask /api/owner on OUR origin, after landing back on it)
  await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
  const own = await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner).catch(() => false))
  if (own !== owner) await fail('owner', `/api/owner says ${own}, wanted ${owner}`)
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
  const born = await p.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>('button, div, span')].filter(e => /^BE BORN/i.test((e.innerText ?? '').trim()) && (e.innerText ?? '').length < 40).sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0]; if (!b) return false; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  if (!born) await fail('born', 'BE BORN tap not found')
  await p.mouse.click((born as any).x, (born as any).y); await sleep(6000)
  return p
}
async function continent(p: Page, q: string) {
  await p.goto(`${url}/shimmer/open/continent?hour=12${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__shipyards?.sites, { timeout: 240000 }); await sleep(2500)
  await p.keyboard.press('KeyW'); await sleep(500)
  if (/click to resume/i.test(await p.evaluate(() => document.body.innerText))) { await p.mouse.click(500, 320); await sleep(800) }
}
/** set down 1.5 m off Franky's starboard beam, facing her; returns the yard's E verb */
async function besideFranky(p: Page) {
  const s = (await p.evaluate(() => (window as any).__shipyards.sites()) as any[]).find(q => q.key === KAEL); if (!s) await fail('yard', 'no Kael plot')
  const g = toW(s, 3 + s.ramp.L + 2.5, -52)
  await p.evaluate((a, b, w) => { (window as any).__drive.footTp(a, b, w, -0.2) }, g.x, g.z, 0)
  if (!await poll(async () => !!(await p.evaluate((k: string) => (window as any).__shipyards?.[k]?.ship?.(), KAEL)), 240000)) {
    await p.screenshot({ path: `${out}/yard-fail.png` }).catch(() => {})
    await fail('yard', `Kael plot did not mount: ${JSON.stringify(await p.evaluate(() => { const f = (window as any).__drive?.foot?.(); return { f: f && [f.px, f.pz], sites: Object.keys((window as any).__shipyards ?? {}), href: location.href } }).catch(e => String(e)))}`)
  }
  const ship = await p.evaluate((k: string) => (window as any).__shipyards[k].ship(), KAEL)
  const at = toW(s, ship.lx + 3.5 + 1.5, ship.lz), mid = toW(s, ship.lx, ship.lz)
  await p.evaluate((a, b, w) => { (window as any).__drive.footTp(a, b, w, -0.1); (window as any).__drive.look(w, -0.1) }, at.x, at.z, yawTo(mid.x - at.x, mid.z - at.z))
  await sleep(2500)
  res.dbg = await p.evaluate((k: string) => { const y = (window as any).__shipyards?.[k]; const f = (window as any).__drive.foot(); return { aim: y?.aim?.(), own: y?.own?.(), foot: { x: f.px, y: f.py, z: f.pz }, mode: (window as any).__drive.state?.()?.mode ?? null, q: location.search } }, KAEL).catch(e => String(e))
  return p.evaluate(() => document.querySelector('[data-yard-prompt]')?.getAttribute('data-yard-prompt') ?? null)
}
const tapE = async (p: Page) => { await p.keyboard.down('KeyE'); await sleep(80); await p.keyboard.up('KeyE'); await sleep(1200) }
const panelOpen = (p: Page) => p.evaluate(() => !!document.querySelector('[data-panel="destination-map"]'))
const click = async (p: Page, sel: string) => { const ok = await p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return false; e.click(); return true }, sel); await sleep(600); return ok }

if (only !== 'C') {
// ── A · owner + flag ──
say('A: owner keeper'); const A = await keeper(true)
await continent(A, '&ship=gate')
const verbA = await besideFranky(A); res.A = { verb: verbA }
if (verbA !== 'board') await fail('A verb', `beside Franky the E verb should be 'board', got ${verbA}`)
await tapE(A)
if (!await panelOpen(A)) await fail('A open', 'E at Franky did not open the destination map')
const list = await A.evaluate(() => [...document.querySelectorAll('[data-dest]')].map(e => e.textContent))
res.A.list = list
if (JSON.stringify(list) !== JSON.stringify(CANON)) await fail('A list', `list is not canon word for word: ${JSON.stringify(list)}`)
await A.screenshot({ path: `${out}/desk-open.png` })
for (const d of ['hask', 'starforge']) {
  await click(A, `[data-dest="${d}"]`)
  const z = await A.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-zone]')].map(e => ({ id: e.dataset.zone, open: e.dataset.zoneOpen, label: e.getAttribute('aria-label') })))
  const rows = await A.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-zone-row]')].map(e => e.innerText.trim()))
  res.A[d] = { zones: z, rows }
  if (z.length !== 1 || z[0].open !== '0' || rows.join() !== 'not yet') await fail(`A ${d}`, `want ONE 'not yet' zone: ${JSON.stringify(res.A[d])}`)
  const before = await A.evaluate(() => location.href)
  await click(A, '[data-zone]'); await sleep(1500)
  const after = await A.evaluate(() => location.href)
  if (after !== before || !await panelOpen(A)) await fail(`A ${d} not yet`, `a 'not yet' zone did something: ${before} -> ${after}`)
}
await click(A, '[data-dest="athernyx"]')
const zn = await A.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-zone-row]')].map(e => ({ id: e.dataset.zoneRow, text: e.innerText.trim() })))
res.A.athernyx = zn
if (zn.length !== 1 || zn[0].id !== 'rune-hold') await fail('A athernyx', `a fresh keeper's zones should be Rune Hold only: ${JSON.stringify(zn)}`)
// the shots: desk + 390 x 844
await A.screenshot({ path: `${out}/desk-athernyx.png` })
await A.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); await sleep(1500)
const fit = await A.evaluate(() => { const r = document.querySelector('[data-panel="destination-map"]')!.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sw: document.documentElement.scrollWidth } })
res.A.phoneFit = fit
if (fit.l < 0 || fit.r > fit.w || fit.sw > fit.w) await fail('A 390', `panel spills at 390: ${JSON.stringify(fit)}`)
await A.screenshot({ path: `${out}/phone-athernyx.png` })
if (shot) await A.screenshot({ path: shot })
await A.setViewport({ width: 1000, height: 640 }); await sleep(800)
// travel: tap the zone point, the page goes through ?at=, the keeper arrives at Rune Hold
await click(A, '[data-zone="rune-hold"]')
if (!await poll(async () => /[?&]at=rune-hold/.test(await A.evaluate(() => location.href)), 15000)) await fail('A travel', 'no navigation to ?at=rune-hold')
await A.waitForFunction(() => !!(window as any).__drive?.state, { timeout: 240000 }); await sleep(4000)
const href = await A.evaluate(() => location.href), f = await A.evaluate(() => { const f = (window as any).__drive.foot(); return { x: f.px, z: f.pz } })
const dist = Math.hypot(f.x - RUNE.x, f.z - RUNE.z)
res.A.arrive = { href, foot: { x: +f.x.toFixed(1), z: +f.z.toFixed(1) }, rune: { x: RUNE.x, z: RUNE.z }, dist: +dist.toFixed(1) }
if (dist > 40) await fail('A arrive', `not at Rune Hold: ${JSON.stringify(res.A.arrive)}`)
if (!/ship=gate/.test(href)) await fail('A arrive', 'the flag was dropped on the trip')
// ── B · owner, no flag ──
say('B: owner, no flag'); await continent(A, '')
const verbB = await besideFranky(A); await tapE(A); res.B = { verb: verbB, open: await panelOpen(A) }
if (verbB === 'board' || res.B.open) await fail('B', `no flag must mean no gate: ${JSON.stringify(res.B)}`)
}
// ── C · not owner + flag ──
say('C: not owner'); const C = await keeper(false)
await continent(C, '&ship=gate')
const verbC = await besideFranky(C); await tapE(C); res.C = { verb: verbC, open: await panelOpen(C) }
if (verbC === 'board' || res.C.open) await fail('C', `a non-owner must get no gate: ${JSON.stringify(res.C)}`)
await done(errs.length === 0, errs.length ? `FAIL: page errors ${errs[0]}` : `PASS: owner+flag E at Franky opens the map (3 canon entries), not-yet zones inert, Rune Hold arrive ${res.A?.arrive?.dist ?? "(skipped)"} m; no flag / non-owner = no gate`)
