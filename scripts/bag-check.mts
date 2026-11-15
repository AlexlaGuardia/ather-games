// ── Prod check for the open world's bag + hearth menus (2026-11-15, hub) ────────────────────────────────────
// Opens the bag (I), moves the Repeater from hotbar slot 1 into the bag by click-click, checks the hotbar emptied and
// the saved bag agrees, shift-clicks it back, closes on the RED X (the camera relock path), and shoots the bag, the
// fold map and Gregory. Fresh profile: never a keeper's real save.   npx tsx scripts/bag-check.mts [--url] [--out]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 120000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await b.newPage()
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))   // a fresh profile is born first (birth-gate.tsx); seed a rune so the ritual does not take the screen; await p.setViewport({ width: 1280, height: 800 })
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2000)
const hotbar0 = () => p.evaluate(() => !!document.querySelector('[data-hud="hotbar"] .rounded-\\[11px\\] img'))
const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')?.slots?.map((s: any) => s?.id ?? null))
const res: Record<string, unknown> = { hotbarHasRepeaterAtStart: await hotbar0() }
await p.keyboard.press('KeyI'); await sleep(800)
res.bagOpens = !!(await p.$('[data-panel="bag"]'))
res.redX = await p.evaluate(() => { const x = document.querySelector('[data-panel="bag"] button[aria-label="close"]') as HTMLElement; return x ? getComputedStyle(x).backgroundImage.includes('224, 96, 79') : false })
await shot('bag-1-open')
await p.click('[data-panel="bag"] [data-slot="0"]'); await sleep(200)
await p.click('[data-panel="bag"] [data-slot="12"]'); await sleep(500)
const s1 = await saved()
res.moved = s1?.[0] === null && s1?.[12] === 'repeater'
await shot('bag-2-moved')
await p.click('[data-panel="bag"] [data-slot="12"]', { modifiers: undefined } as any).catch(() => {})
await p.keyboard.down('Shift'); await p.click('[data-panel="bag"] [data-slot="12"]'); await p.keyboard.up('Shift'); await sleep(500)
const s2 = await saved()
res.quickBack = s2?.slice(0, 8).includes('repeater') && s2?.[12] === null
await p.click('[data-panel="bag"] button[aria-label="close"]'); await sleep(600)
res.closesOnX = !(await p.$('[data-panel="bag"]'))
await p.evaluate(() => (window as any).__ather.open('gate')); await sleep(1200)
res.foldMapHearth = !!(await p.$('[data-panel="fold-map"] button[aria-label="close"]'))
await shot('bag-3-foldmap')
await p.click('[data-panel="fold-map"] button[aria-label="close"]'); await sleep(500)
await p.evaluate(() => (window as any).__ather.open('greg')); await sleep(1000)
res.gregHearth = !!(await p.$('[data-panel="greg"] button[aria-label="close"]'))
await shot('bag-4-greg')
console.log(JSON.stringify(res))
const pass = Object.values(res).every(v => v === true)
console.log(pass ? 'PASS' : 'FAIL')
await b.close(); process.exit(pass ? 0 : 1)
async function shot(n: string) { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch (e) { console.log('shot skipped', n) } }
