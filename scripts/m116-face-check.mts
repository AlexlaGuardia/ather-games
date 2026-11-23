// ── M116 FACE SETS IN THE CREATOR (sprites-M116b, 11-23). Copied from creator-check.mts. 390 x 844, real clicks.
//   npx tsx scripts/m116-face-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { OPT, LOOK_KEY, FRAME_STATS } from '../src/app/shimmer/open/shared/keeper-look'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
async function fresh(w: number, h: number): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  return p
}
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
  await p.mouse.click(box.x, box.y); return true
}
const creatorUp = (p: Page) => p.evaluate(() => !!document.querySelector('[data-panel="keeper-creator"]'))
const pick = (p: Page, row: string, i: number) => p.evaluate((r: string, n: number) => { const b = document.querySelector<HTMLElement>(`[data-creator-row="${r}"] [data-opt="${n}"]`); b?.click(); return !!b }, row, i)
const pressed = (p: Page, row: string) => p.evaluate((r: string) => Number(document.querySelector(`[data-creator-row="${r}"] [aria-pressed="true"]`)?.getAttribute('data-opt') ?? -1), row)
const saved = (p: Page) => p.evaluate((k: string) => JSON.parse(localStorage.getItem(k) ?? 'null'), LOOK_KEY) as Promise<Record<string, number> | null>
const born = async (p: Page, tag: string) => {
  await sleep(6000)
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))), `${tag}: the birth gate shows`)
  ok(await tapText(p, /^BE BORN/), `${tag}: tapped BE BORN`)
}

// ── M116: the Face row, at 390 x 844: a new keeper picks a face set, it persists over a reload, Change look shows it ──
const p = await fresh(390, 844)
await born(p, 'M116')
ok(await poll(() => creatorUp(p), 30000), 'creator shows after the born moment')
const labels = await p.evaluate(() => [...document.querySelectorAll('[data-creator-row="face"] [data-opt]')].map(e => (e.textContent ?? '').trim()))
ok(JSON.stringify(labels) === JSON.stringify([...OPT.face]) && labels.length === 5, `the Face row offers Classic + 4 face sets (${labels.join(', ')})`)
ok((await pressed(p, 'face')) === 0, 'a new keeper starts on Classic')
const STRONG = OPT.face.indexOf('Strong')
ok(await pick(p, 'face', STRONG) && (await pressed(p, 'face')) === STRONG, 'pick Strong')
const fits = await p.evaluate(() => { const r = document.querySelector('[data-creator-row="face"]')!.getBoundingClientRect(); return r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1 })
ok(fits, 'the Face row fits 390 with no sideways scroll')
await p.evaluate(() => (document.querySelector('[data-creator-done]') as HTMLElement | null)?.click())
ok(await poll(async () => !(await creatorUp(p)), 20000), 'Looks good closes the creator')
ok((await saved(p))?.face === STRONG, `saved per keeper: face ${(await saved(p))?.face}`)
await p.reload({ waitUntil: 'load', timeout: 240000 }); await sleep(6000)
ok(!(await creatorUp(p)) && (await saved(p))?.face === STRONG, 'after a reload the face is kept')
await p.keyboard.press('KeyP')
await poll(() => p.evaluate(() => !!document.querySelector('[data-change-look]')), 20000)
await p.evaluate(() => (document.querySelector('[data-change-look]') as HTMLElement | null)?.click())
ok(await poll(() => creatorUp(p), 10000) && (await pressed(p, 'face')) === STRONG, 'Change look opens on Strong')
// an OLD save (no face field) reads as Classic
await p.evaluate((k: string) => { const v = JSON.parse(localStorage.getItem(k)!); delete v.face; localStorage.setItem(k, JSON.stringify(v)) }, LOOK_KEY)
await p.reload({ waitUntil: 'load', timeout: 240000 }); await sleep(6000)
await p.keyboard.press('KeyP'); await poll(() => p.evaluate(() => !!document.querySelector('[data-change-look]')), 20000)
await p.evaluate(() => (document.querySelector('[data-change-look]') as HTMLElement | null)?.click())
ok(await poll(() => creatorUp(p), 10000) && (await pressed(p, 'face')) === 0, 'an old save (no face) opens on Classic')
ok(errs.length === 0, `0 page errors (${errs.slice(0, 3).join(' | ')})`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0)
