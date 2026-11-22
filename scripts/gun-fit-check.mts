// M81 s2: the Character tab FITS a sight per gun. A keeper with the Backbone primary: drawn (R), it aims through its default
// fitting (the 2x it always had: key backbone:scope2:sscope2). Pack (P) -> Armory -> the primary slot -> Fitted sight -> the
// Issue hood: the Armory window names it, the save holds it; drawn again, the gun in hand is the hood model and aims through
// the 1x (key backbone:reddot:shood). A RELOAD keeps it. Then the 390x844 phone shot of the fitting row. 0 page errors.
//   npx tsx scripts/gun-fit-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/gun-fit')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const LOADOUT = { v: 1, guns: ['repeater', 'backbone'], primary: 'backbone', secondary: 'repeater', kael: true,
  vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const results: [string, boolean, string][] = []
const check = (n: string, c: boolean, d = '') => { results.push([n, c, d]); console.log(c ? '✓' : '✗', n, d) }
const poll = async (fn: () => Promise<boolean>, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
async function open(phone = false): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  if (phone) await p.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
  else await p.setViewport({ width: 1280, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((lo: string) => { if (sessionStorage.getItem('gf')) return; sessionStorage.setItem('gf', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.loadout.v1', lo) }, JSON.stringify(LOADOUT))
  await go(p)
  return p
}
const go = async (p: Page) => {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fpGun, { timeout: 240000 }); await sleep(4000)
}
const G = (p: Page) => p.evaluate(() => { const g = (window as any).__fpGun; return g ? { shown: g.shown(), key: g.key(), optic: g.optic() } : null }) as Promise<{ shown: boolean; key: string; optic: string } | null>
const tapR = async (p: Page) => { await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(600) }
const holdR = async (p: Page) => { await p.keyboard.down('KeyR'); await sleep(800); await p.keyboard.up('KeyR'); await sleep(800) }
const fitSaved = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('open.loadout.v1') ?? '{}')?.fit?.backbone?.sight ?? null)

const p = await open()
await p.mouse.click(640, 380); await sleep(800)
await tapR(p)
check('drawn: the Backbone aims through its default fitting (the 2x it always had)', await poll(async () => (await G(p))?.key === 'backbone:scope2:sscope2'), JSON.stringify(await G(p)))
await p.screenshot({ path: `${out}/1-default-scope2.png` })
await holdR(p)
await p.keyboard.press('KeyP'); await sleep(1200)
await p.click('[data-slot-id="primary"] button'); await sleep(600)
const chips = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-fit="backbone"] [data-fit-sight]')].map(e => ({ id: e.dataset.fitSight, on: e.getAttribute('aria-pressed') })))
check('the fitting row offers the owned sights, the 2x pressed', chips.length === 3 && chips.find(c => c.id === 'scope2')?.on === 'true', JSON.stringify(chips))
await p.click('[data-fit-sight="hood"]'); await sleep(600)
check('fit the hood: the Armory window names it', await poll(async () => (await p.evaluate(() => document.querySelector('[data-gun-stats="backbone"] [data-stat-sight]')?.getAttribute('data-stat-sight'))) === 'hood', 4000))
check('the save holds the fitting', (await fitSaved(p)) === 'hood', String(await fitSaved(p)))
check('the sight-mark picker now reads 1x', await p.evaluate(() => document.querySelector('[data-sight="backbone"]')?.textContent?.includes('1×') ?? false))
await p.screenshot({ path: `${out}/2-fitted-hood-panel.png` })
await p.keyboard.press('KeyP'); await sleep(900)
await p.mouse.click(640, 380); await sleep(800)
await tapR(p)
check('drawn again: the hood model, aiming through the 1x', await poll(async () => { const g = await G(p); return g?.key === 'backbone:reddot:shood' && g.optic === 'reddot' }), JSON.stringify(await G(p)))
await p.screenshot({ path: `${out}/3-hood-in-hand.png` })
// a reload keeps it (the seed only runs once per tab session)
await go(p); await p.mouse.click(640, 380); await sleep(800); await tapR(p)
check('after a reload the fitting holds', await poll(async () => (await G(p))?.key === 'backbone:reddot:shood'), JSON.stringify(await G(p)))
check('and the save still says hood', (await fitSaved(p)) === 'hood')
// phone: the fitting row at 390x844
const ph = await open(true)
await ph.touchscreen.tap(195, 600).catch(() => {}); await sleep(1200)
const packBtn = await ph.$('[data-hud="pack"], [aria-label*="ack"]')
if (packBtn) await packBtn.tap(); else await ph.keyboard.press('KeyP')
await sleep(1200)
await ph.click('[data-slot-id="primary"] button').catch(() => {}); await sleep(700)
await ph.evaluate(() => document.querySelector('[data-fit="backbone"]')?.scrollIntoView({ block: 'center' })); await sleep(500)
const fitBox = await ph.evaluate(() => { const r = document.querySelector('[data-fit="backbone"]')?.getBoundingClientRect(); return r ? { l: r.left, r: r.right, w: innerWidth } : null })
check('phone: the fitting row shows and fits the width', !!fitBox && fitBox.l >= 0 && fitBox.r <= fitBox.w + 0.5, JSON.stringify(fitBox))
await ph.screenshot({ path: `${out}/4-phone-fitting.png` })
check('no page errors', errs.length === 0, errs.join(' | '))
const pass = results.every(r => r[1])
console.log(pass ? `PASS: ${results.length} checks, shots in ${out}` : `FAIL: ${results.filter(r => !r[1]).map(r => r[0]).join(', ')}`)
await br.close(); process.exit(pass ? 0 : 1)
