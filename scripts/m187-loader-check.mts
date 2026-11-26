// M187: the loader's Dewbear runs on REAL bytes. Fresh anonymous contexts, cache off, a throttled network, 390 phone + desktop:
//   continent (`!R`): the shown % tracks the bytes CDP sees arriving for continent.json + .bin.gz (not a timer), the Dewbear
//   moves left to right with it and stands at the fruit at 100, the tip plate never moves and stays readable above the
//   track, the screen is gone when the scene is up (a canvas, no load screen); a reload shows a different fruit.
//   Ather resume (a saved Wilds spot): the same Dewbear over the Wilds tiles, reaching 100 before the veil lifts.
//   npx tsx scripts/m187-loader-check.mts [origin] [shotDir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { makeSpot } from '../src/app/shimmer/open/ather/last-spot'
const origin = process.argv[2] ?? 'https://ather.games', shots = process.argv[3] ?? 'docs/looks/m187-2026-11-26'
mkdirSync(shots, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const REGION = { '/open/continent.json': 692973, '/open/continent.bin.gz': 2577643 } as Record<string, number>
interface Sample { t: number; pct: number; bytes: number; dew: { l: number; r: number } | null; fruit: { l: number } | null; tip: { t: number; b: number; fs: number } | null; runTop: number; fruitId: string | null; canvas: boolean }
async function watch(p: Page, region: boolean, until: number) {
  const cdp = await p.createCDPSession()
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 120, downloadThroughput: 2_000_000 / 8, uploadThroughput: 500_000 / 8 })
  const ids = new Map<string, string>(); let bytes = 0
  cdp.on('Network.requestWillBeSent', (e: any) => { const path = new URL(e.request.url).pathname; if (region ? REGION[path] : /\/open\/wilds\//.test(path)) ids.set(e.requestId, path) })
  cdp.on('Network.dataReceived', (e: any) => { if (ids.has(e.requestId)) bytes += e.dataLength })
  const out: Sample[] = []
  const t0 = Date.now()
  while (Date.now() - t0 < until) {
    const s = await p.evaluate(() => {
      const r = document.querySelector('[data-load-runner]') as HTMLElement | null
      const rect = (q: string) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom } }
      const tip = document.querySelector('[data-load-tip]') as HTMLElement | null
      const tipText = tip?.children[1] as HTMLElement | undefined
      return { pct: r ? Number(r.dataset.loadRunner) : -1, dew: rect('[data-load-dewbear]'), fruit: rect('[data-load-fruit-img]'), runTop: rect('[data-load-runner]')?.t ?? -1,
        tip: tip ? { t: tip.getBoundingClientRect().top, b: tip.getBoundingClientRect().bottom, fs: tipText ? parseFloat(getComputedStyle(tipText).fontSize) : 0 } : null,
        fruitId: r?.dataset.loadFruit ?? null, canvas: !!document.querySelector('canvas'), screen: !!document.querySelector('[data-load-screen]') }
    }).catch(() => null)
    if (s) { out.push({ t: Date.now() - t0, bytes, ...s }); if (!s.screen && out.some(x => x.pct >= 0)) break }
    await sleep(120)
  }
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  return out
}
function judge(tag: string, ss: Sample[], total: number | null, vw: number) {
  const on = ss.filter(s => s.pct >= 0)
  ok(on.length >= 5, `${tag}: the load screen was up for ${on.length} samples`)
  if (on.length < 2) return
  const pcts = on.map(s => s.pct)
  ok(pcts.every((v, i) => i === 0 || v >= pcts[i - 1]), `${tag}: the % never goes back (${[...new Set(pcts)].join(' ')})`)
  ok(new Set(pcts.filter(v => v > 0 && v < 100)).size >= 4, `${tag}: it moves through the middle (${new Set(pcts.filter(v => v > 0 && v < 100)).size} distinct values)`)
  ok(pcts.includes(100), `${tag}: it reaches 100 while the screen is still up`)
  if (total) {   // the % against bytes CDP saw arrive for the region's two files
    const errs = on.filter(s => s.pct > 0 && s.pct < 100).map(s => Math.abs(s.pct - 100 * Math.min(1, s.bytes / total)))
    ok(errs.length > 0 && Math.max(...errs) <= 15, `${tag}: % tracks the bytes on the wire (max gap ${errs.length ? Math.max(...errs).toFixed(1) : '-'} pts)`)
  }
  const d = on.filter(s => s.dew)
  const lefts = d.map(s => s.dew!.l)
  ok(lefts[0] <= 16 + 24 && lefts[lefts.length - 1] > lefts[0] + vw * 0.35, `${tag}: the Dewbear runs left to right (${lefts[0].toFixed(0)} -> ${lefts[lefts.length - 1].toFixed(0)} px)`)
  const at100 = d.filter(s => s.pct === 100 && s.fruit).slice(-1)[0]
  ok(at100 && Math.abs(at100.dew!.r - at100.fruit!.l) <= 6, `${tag}: at 100 it is at the fruit (gap ${at100 ? (at100.fruit!.l - at100.dew!.r).toFixed(1) : '-'} px)`)
  const tips = on.filter(s => s.tip).map(s => s.tip!)
  ok(tips.length && Math.max(...tips.map(t => t.t)) - Math.min(...tips.map(t => t.t)) <= 1, `${tag}: no layout jump (tip top ${Math.min(...tips.map(t => t.t)).toFixed(0)}..${Math.max(...tips.map(t => t.t)).toFixed(0)})`)
  ok(on.every(s => !s.tip || (s.tip.b <= s.runTop + 0.5 && s.tip.t >= 0 && s.tip.fs >= 14)), `${tag}: the tip is readable, above the track (${tips[0]?.fs}px)`)
  const last = ss[ss.length - 1]
  ok(last.pct < 0 && last.canvas, `${tag}: gone once the scene is up (canvas ${last.canvas})`)
}
const phone = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, desk = { width: 1280, height: 800, deviceScaleFactor: 1 }
const fruits: string[] = []
for (const [vtag, vp] of [['390', phone], ['desktop', desk]] as const) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(vp)
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* */ } })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  await p.goto(`${origin}/shimmer/open/continent?hour=14`, { waitUntil: 'domcontentloaded', timeout: 240000 })
  let shot = false
  p.waitForFunction(() => Number((document.querySelector('[data-load-runner]') as HTMLElement | null)?.dataset.loadRunner) >= 40, { timeout: 120000, polling: 100 })
    .then(() => p.screenshot({ path: `${shots}/continent-${vtag}-mid.png` })).then(() => { shot = true }).catch(() => {})
  const ss = await watch(p, true, 150000)
  ok(shot, `${vtag}: mid-load shot saved`)
  judge(`continent ${vtag}`, ss, REGION['/open/continent.json'] + REGION['/open/continent.bin.gz'], vp.width)
  const f1 = ss.find(s => s.fruitId)?.fruitId ?? null; fruits.push(f1 ?? '?')
  ok(!errs.some(e => /Hydration|#418|did not match/i.test(e)), `${vtag}: no hydration mismatch ${errs.slice(0, 1).join('')}`)
  // the same keeper loads again: the next fruit
  await p.reload({ waitUntil: 'domcontentloaded' })
  const f2 = await p.waitForFunction(() => (document.querySelector('[data-load-runner]') as HTMLElement | null)?.dataset.loadFruit, { timeout: 120000, polling: 50 }).then(h => h.jsonValue()).catch(() => null)
  ok(f1 && f2 && f1 !== f2, `${vtag}: a reload shows a different fruit (${f1} -> ${f2})`)
  await p.close()
}
// the Ather resume veil, phone: a saved Wilds spot far from Greg's ring
{
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(phone)
  await p.evaluateOnNewDocument((s: string) => { try { if (sessionStorage.getItem('m187')) return; sessionStorage.setItem('m187', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.lastspot.v1', s) } catch { /* */ } }, JSON.stringify(makeSpot('w-3_-3', -3000, -3000, 0)))
  await p.goto(`${origin}/shimmer/open/ather?hour=14`, { waitUntil: 'domcontentloaded', timeout: 240000 })
  p.waitForFunction(() => Number((document.querySelector('[data-load-runner]') as HTMLElement | null)?.dataset.loadRunner) >= 30, { timeout: 120000, polling: 100 })
    .then(() => p.screenshot({ path: `${shots}/ather-resume-390-mid.png` })).catch(() => {})
  const ss = await watch(p, false, 150000)
  const on = ss.filter(s => s.pct >= 0)
  ok(on.length >= 3, `ather resume: the loader was up (${on.length} samples, fruit ${on[0]?.fruitId})`)
  ok(on.map(s => s.pct).every((v, i, a) => i === 0 || v >= a[i - 1]) && new Set(on.map(s => s.pct).filter(v => v > 0 && v < 100)).size >= 3, `ather resume: % climbs with the tiles (${[...new Set(on.map(s => s.pct))].join(' ')})`)
  ok(on.some(s => s.pct === 100) || (await p.evaluate(() => (window as any).__loadMeter?.percent())) === 100, 'ather resume: reaches 100')
  await p.close()
}
console.log(`fruits seen on the first loads: ${fruits.join(', ')}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
