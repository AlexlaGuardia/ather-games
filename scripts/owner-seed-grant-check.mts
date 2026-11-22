// OWNER-ONLY seed grant (Alex 11-22 via hub): Options › Dev › "One of each Mana Seed" puts one of every SEED_IDS seed in the
// keeper's bag, a second press adds none, and a NON-owner sees no Dev tab at all. Runs in a fresh browser profile (an
// anonymous keeper, never Alex's account). OWNER_KEY stays on this box (edesk-check does not carry env), so run it here
// under the box browser lock.   set -a; . ./.env; set +a; npx tsx scripts/owner-seed-grant-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { SEED_IDS } from '../src/app/shimmer/open/ather/seed-items'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY; if (!KEY) { console.log('OWNER_KEY not set (source the repo .env)'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const SEED = JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null })
async function boot(owner: boolean): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((t: string) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', t) }, SEED)
  if (owner) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'load', timeout: 120000 })
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500)
  await p.keyboard.press('KeyO'); await sleep(1500)
  return p
}
const clickText = (p: Page, re: string) => p.evaluate((src: string) => { const rx = new RegExp(src); const b = [...document.querySelectorAll<HTMLElement>('[data-panel="options"] button, [data-panel="options"] a')].find(e => rx.test(e.textContent ?? '')); b?.click(); return !!b }, re)
const seeds = (p: Page) => p.evaluate((ids: string[]) => { const s = (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots ?? []) as ({ id: string; n: number } | null)[]; return ids.map(id => s.reduce((a, x) => a + (x?.id === id ? x.n : 0), 0)) }, [...SEED_IDS])
try {
  const p = await boot(true)
  ok(!!(await p.$('[data-panel="options"]')), 'owner: Options opens (O)')
  ok(await clickText(p, '^Dev$'), 'owner: the Dev tab is there'); await sleep(600)
  const before = await seeds(p)
  ok(await clickText(p, 'One of each Mana Seed'), 'owner: the seed button is there'); await sleep(800)
  const after = await seeds(p)
  ok(after.every((n, i) => n === before[i] + (before[i] ? 0 : 1)) && after.every(n => n >= 1), `owner: one of each of ${SEED_IDS.length} seeds (${after.join(',')})`)
  await clickText(p, 'One of each Mana Seed'); await sleep(800)
  const again = await seeds(p)
  ok(again.join() === after.join(), 'owner: a second press adds none')
  const q = await boot(false)
  ok(!!(await q.$('[data-panel="options"]')), 'player: Options opens')
  ok(!(await clickText(q, '^Dev$')) && !(await clickText(q, 'One of each Mana Seed')), 'player: no Dev tab, no seed button')
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
