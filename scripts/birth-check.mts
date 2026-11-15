// ── Check for the open world's birth rune (2026-11-15, play lane) ──────────────────────────────────────────────
// A keeper with no birth rune is born on first entry (continent): the ritual shows, cannot be skipped, its arrows do
// not roll the courser; Enter chooses; the "Born of" beat holds, then the world; the Character tab says who you are;
// a reload does not ask again.   npx tsx scripts/birth-check.mts [--url] [--out]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const b = await puppeteer.launch({ protocolTimeout: 180000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const until = async (f: () => Promise<boolean>, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(150) } return false }
const res: Record<string, unknown> = {}
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`${url}/shimmer/open/continent?hour=13`, { waitUntil: 'domcontentloaded', timeout: 180000 })
await p.evaluate(() => localStorage.removeItem('ather:shimmer:birthRune'))
await p.reload({ waitUntil: 'load', timeout: 180000 })
await p.waitForFunction('!!window.__drive', { timeout: 180000 })
const gate = () => p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))
res.gateShows = await until(gate)
await p.screenshot({ path: `${out}/birth-1-ritual.png` })
const pos0 = await p.evaluate(() => { const s = (window as any).__drive.state(); return [s.x, s.z] })
for (const k of ['ArrowUp', 'ArrowDown', 'ArrowRight']) { await p.keyboard.down(k as any); await sleep(900); await p.keyboard.up(k as any) }
const pos1 = await p.evaluate(() => { const s = (window as any).__drive.state(); return [s.x, s.z] })
res.courserStill = Math.hypot(pos1[0] - pos0[0], pos1[1] - pos0[1]) < 0.5
res.noBack = await p.evaluate(() => !document.querySelector('[aria-label="back"]'))
await p.keyboard.press('Enter')
res.saved = await until(() => p.evaluate(() => !!localStorage.getItem('ather:shimmer:birthRune')), 4000)
res.rune = await p.evaluate(() => localStorage.getItem('ather:shimmer:birthRune'))
await sleep(600); await p.screenshot({ path: `${out}/birth-2-born.png` })
res.gateCloses = await until(async () => !(await gate()), 9000)
await p.keyboard.press('KeyP')
await until(() => p.evaluate(() => !!document.querySelector('[data-born]')))
res.characterSays = await p.evaluate(() => document.querySelector('[data-born]')?.textContent)
await p.screenshot({ path: `${out}/birth-3-character.png` })
await p.reload({ waitUntil: 'load', timeout: 180000 }); await p.waitForFunction('!!window.__drive', { timeout: 180000 }); await sleep(3000)
res.noGateOnReload = !(await gate())
res.errors = errs.slice(0, 5)
console.log(JSON.stringify(res, null, 1))
await b.close()
