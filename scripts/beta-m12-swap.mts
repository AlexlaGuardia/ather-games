// ── BETA M12 step 4: SWAP UI (keepers list + New keeper)
//   npx tsx scripts/beta-m12-swap.mts [--url http://localhost:3201]
// (header below borrowed from beta-m7-saves; the old M7 notes do not apply)
// ── was: BETA M7 ───────────────────────────────────────────────────────────────────────────────────────
// A keeper is born at /shimmer/open/ather, makes progress (garden ledger, journal choice, a business bought on the
// continent), and the progress must still be there after: (a) a reload, (b) closing the page and opening a new one in
// the same profile, (c) closing the browser and relaunching on the SAME userDataDir, (d) "next day" (the page's clock
// shifted +26 h on relaunch; the open world's only time-based state is the tycoon catch-up and the forestry/spread
// timestamps), and the keeper must never be sent back through the birth gate. Phase E is anonymous -> signed-in:
// real Google OAuth cannot be scripted, so the client's own /api/auth/session answer is faked at the network layer
// (page-side interception only; no server, cookie or backdoor is touched) to exercise the client adoption path.
//   npx tsx scripts/beta-m7-saves.mts [--url http://localhost:3201] [--out /tmp/m7]
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { marketFor } from '../src/app/shimmer/open/business/market'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const URL_ = flag('--url', 'https://ather.games'), OUT = flag('--out', '/tmp/m12')
mkdirSync(OUT, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const offer = marketFor(R, 'rune-hold').find(x => x.kind === 'mine')!

let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const note = (m: string) => console.log('  note', m)
const errs: string[] = []
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

const launch = (dir: string) => puppeteer.launch({ protocolTimeout: 240000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS, userDataDir: dir })
async function page(b: Browser, o: { shiftMs?: number; session?: string } = {}): Promise<Page> {
  const p = await b.newPage()
  await p.setUserAgent(UA)
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  if (o.shiftMs) await p.evaluateOnNewDocument(`(() => {   // a real clock advance: Date.now() and new Date() both
    const off = ${o.shiftMs}, D = Date
    class Dx extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off) } static now() { return D.now() + off } }
    window.Date = Dx
  })()`)
  if (o.session) {   // client-side fake of "the session endpoint says this keeper is signed in". Nothing server-side changes.
    await p.setRequestInterception(true)
    p.on('request', r => r.url().includes('/api/auth/session')
      ? r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: { user_id: o.session, username: 'm12test', character_id: null, avatar: null } }) })
      : r.continue())
  }
  return p
}
const ready = async (p: Page, path: string, hook = '__ather') => {
  await p.goto(`${URL_}${path}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction((h: string) => !!(window as any)[h]?.state || !!(window as any)[h], { timeout: 240000 }, hook).catch(() => {})
  await sleep(6000)   // the owner resolves a few frames late; the gate waits for it, so wait past it before judging
}
const gateUp = (p: Page) => p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))
const tapText = async (p: Page, re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 40) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  await p.touchscreen.tap(box.x, box.y); return true
}

const store = (p: Page) => p.evaluate(() => {
  const o: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; o[k] = localStorage.getItem(k)! }
  return o
})
const SIGNED = 'm12-test-user'
const openCharacter = async (p: Page) => {
  await p.evaluate(() => document.querySelector<HTMLElement>('[data-touch="menu"]')?.click()); await sleep(600)
  await tapText(p, /PACK$/); await sleep(1500)
  await p.evaluate(() => document.querySelector<HTMLElement>('[data-pack-tab="character"]')?.click()); await sleep(1000)
}
const rows = (p: Page) => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-keeper]')].map(e => ({ id: e.dataset.keeper!, active: e.dataset.active === '1', text: e.innerText.replace(/\s+/g, ' ').trim() })))
const birthAs = async (p: Page, tag: string) => {
  ok(await poll(() => gateUp(p), 30000), `${tag}: the birth gate shows`)
  ok(await tapText(p, /^BE BORN/), `${tag}: tapped BE BORN`)
  ok(await poll(async () => !(await gateUp(p)), 30000), `${tag}: gate closes`)
  await sleep(2500); await tapText(p, /^Tap to start$/); await sleep(1000)
}
const bagSwap = async (p: Page, a: number, b: number) => {
  await p.evaluate(() => document.querySelector<HTMLElement>('[data-touch="menu"]')?.click()); await sleep(600)
  await tapText(p, /PACK$/); await sleep(1500)
  await p.evaluate(() => document.querySelector<HTMLElement>('[data-pack-tab="bag"]')?.click()); await sleep(800)
  const click = (n: number) => p.evaluate((i: number) => { const e = document.querySelector<HTMLElement>(`[data-slot="${i}"]`); e?.click(); return !!e }, n)
  await click(a); await sleep(600); await click(b); await sleep(1000)
  await p.keyboard.press('Escape'); await sleep(500)
}
const keeperKeys = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([k]) => /birthRune$|open\.inv\.v1$/.test(k) && !/:k:/.test(k)))
const gardenOf = (o: Record<string, string>) => Object.entries(o).filter(([k]) => /ather\.garden\.v1$/.test(k)).map(([, v]) => v)

console.log(`M12 swap  url=${URL_}\n`)
const profile = mkdtempSync(join(tmpdir(), 'm12-profile-'))
const b = await launch(profile)
const p = await page(b, { session: SIGNED })
await ready(p, '/shimmer/open/ather')
await birthAs(p, 'keeper A')
await p.evaluate(() => (window as any).__ather.grant(400, 2)); await sleep(1500)
await bagSwap(p, 0, 9)
const A0 = await store(p)
const Akeys = keeperKeys(A0), Agarden = gardenOf(A0)
note(`A: ${JSON.stringify(Object.keys(Akeys).map(k => k.replace(/^u:[^:]+:/, '')))}`)
ok(Object.keys(Akeys).some(k => k.endsWith('open.inv.v1')) && Object.keys(Akeys).some(k => k.endsWith('birthRune')), 'A has a rune and a pack P')
ok(Agarden.length === 1, 'A: a garden key exists')

await openCharacter(p)
let r = await rows(p)
ok(r.length === 1 && r[0].active && /active/.test(r[0].text), `Character lists 1 keeper, active (${r[0]?.text})`)
await p.screenshot({ path: `${OUT}/1-one-keeper.png` })
const idA = r[0]?.id
ok(await p.evaluate(() => { const e = [...document.querySelectorAll<HTMLElement>('[data-keepers] button')].find(x => /New keeper/.test(x.innerText)); e?.click(); return !!e }), 'pressed New keeper')
await sleep(1500)
await p.waitForFunction(() => !!(window as any).__ather, { timeout: 240000 }).catch(() => {}); await sleep(6000)
await birthAs(p, 'keeper B')
await sleep(1500)
await bagSwap(p, 1, 8)   // B's pack differs from A's
await openCharacter(p)
r = await rows(p)
ok(r.length === 2, `Character shows 2 keepers (${r.map(x => x.text).join(' | ')})`)
ok(r.filter(x => x.active).length === 1 && r.find(x => x.id === idA)?.active === false, 'B is active, A is not')
ok(r.every(x => !/not yet born/.test(x.text)), 'both keepers show a rune name')
await p.screenshot({ path: `${OUT}/2-two-keepers.png` })
const B0 = await store(p)
ok(keeperKeys(B0)[Object.keys(keeperKeys(B0)).find(k => k.endsWith('open.inv.v1')) ?? ''] !== Akeys[Object.keys(Akeys).find(k => k.endsWith('open.inv.v1')) ?? ''], 'B live pack differs from A pack')

ok(await p.evaluate((id: string) => { const e = document.querySelector<HTMLElement>(`[data-keeper="${id}"] [data-keeper-pick]`); e?.click(); return !!e }, idA), 'tapped keeper A')
await sleep(1500)
await p.waitForFunction(() => !!(window as any).__ather, { timeout: 240000 }).catch(() => {}); await sleep(6000)
ok(!(await gateUp(p)), 'A is not sent through the birth gate')
const A1 = await store(p)
ok(JSON.stringify(keeperKeys(A1)) === JSON.stringify(Akeys), 'A: rune + pack P back byte-identical')
ok(JSON.stringify(gardenOf(A1)) === JSON.stringify(Agarden), 'garden key unchanged')
await openCharacter(p); r = await rows(p)
ok(r.length === 2 && r.find(x => x.id === idA)?.active === true, 'Character: A active again, 2 keepers')
await p.screenshot({ path: `${OUT}/3-back-to-A.png` })

ok(errs.length === 0, `no page errors${errs.length ? ': ' + [...new Set(errs)].slice(0, 4).join(' | ') : ''}`)
await b.close(); try { rmSync(profile, { recursive: true, force: true }) } catch { /* tmp */ }
console.log(fails ? `\nbeta-m12-swap: ${fails} FAIL` : '\nbeta-m12-swap: PASS')
process.exit(fails ? 1 : 0)
