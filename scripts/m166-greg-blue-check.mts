// BETA M166: Greg and Blue IN THE GLADE, real page: Greg sits at his bench in the locked look's figure, Blue lies at the bench's
// end (the page publishes his spot only since M166: red on the build before), the talk opens on E / tap. Shots front / side /
// back of the bench + the talk, and the frame's draw calls. 390x844 (--phone) or desktop.
//   npx tsx scripts/m166-greg-blue-check.mts <outdir> [--url https://ather.games] [--phone] [--save sent|newborn|finished] [--no-press]
// --save (M166b): whose talk it is. 'newborn' = nothing heard: E / tap opens Greg's FIRST bubble (greg.b1.welcome.1, word for
// word). --no-press (the check's own red): everything but the press, so 'the talk opens' has to fail.
import puppeteer from 'puppeteer-core'
import { freshTut, legacyTut, parseTut, type Tut } from '../src/app/shimmer/open/ather/glade-tutorial'
import { line } from '../src/app/shimmer/open/ather/glade-tutorial-lines'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = process.argv[2], url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone'), save = flag('--save', 'sent'), tag = (phone ? 'phone' : 'desktop') + (save === 'sent' ? '' : `-${save}`)
const SAVES: Record<string, Tut> = { newborn: freshTut(), finished: legacyTut(), sent: parseTut({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['grimoire'], b2: 'none', baitDay: null })! }
if (!SAVES[save]) { console.error(`no save '${save}'`); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
try {
  const p = await b.newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  const glbs: number[] = []; p.on('response', r => { if (r.url().includes('/open/spirits/dewbear-rigged.glb')) glbs.push(r.status()) })
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((t: string) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', t) }, JSON.stringify(SAVES[save]))
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  if (await p.evaluate(() => (window as any).__ather.zone()) !== 'glade') await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' }))
  await p.waitForFunction(() => (window as any).__ather.zone() === 'glade' && !!(window as any).__greg, { timeout: 120000 }); await sleep(3000)
  if (phone) {   // the start card covers the view and takes the first tap
    const c = await p.evaluate(() => { const e = [...document.querySelectorAll('div')].filter(d => /tap to start/i.test(d.textContent ?? '')).pop(); const r = e?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })
    if (c) { await p.touchscreen.tap(c.x, c.y); await sleep(1500) }
    ok(!await p.evaluate(() => /tap to start/i.test(document.body.innerText)), 'the start card is away')
  }
  // his spot, read till two reads agree (a layer landing moves the bench)
  type G = { x: number; z: number; pose: string; look: string; blue?: { x: number; z: number } }
  let g = await p.evaluate(() => (window as any).__greg) as G
  for (let t = 0; t < 20; t++) { await sleep(1500); const n = await p.evaluate(() => (window as any).__greg) as G; const same = Math.hypot(n.x - g.x, n.z - g.z) < 0.01; g = n; if (same) break }
  ok(g.look === 'gregory' && g.pose === 'sit', `Greg sits at his bench (${g.x.toFixed(2)}, ${g.z.toFixed(2)})`)
  ok(!!g.blue && Math.hypot(g.blue.x - g.x, g.blue.z - g.z) > 0.9 && Math.hypot(g.blue.x - g.x, g.blue.z - g.z) < 2, `Blue lies by the bench${g.blue ? ` (${Math.hypot(g.blue.x - g.x, g.blue.z - g.z).toFixed(2)} m from Greg)` : ': the page publishes no Blue'}`)
  const yaw = g.blue ? Math.atan2(g.blue.x - g.x, g.blue.z - g.z) - Math.atan2(1.3, 0.3) : 0   // the bench's facing: Blue lies at (1.3, 0.3) in its frame (blue-look.ts BLUE_AT)
  const hide = () => p.evaluate(() => { const h = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of h.filter(x => !h.some(o => o !== x && x.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const cx = g.blue ? (g.x * 2 + g.blue.x) / 3 : g.x, cz = g.blue ? (g.z * 2 + g.blue.z) / 3 : g.z
  const at = (a: number, d: number) => p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), cx + Math.sin(yaw + a) * d, cz + Math.cos(yaw + a) * d, yaw + a)
  for (const [name, a] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]] as const) {
    await at(a, 4.2); await sleep(5000); await hide()
    console.log(`${name}: ${await p.evaluate(() => (window as any).__ather.calls())} draw calls at 4.2 m`)
    await p.screenshot({ path: `${out}/glade-greg-blue-${name}-${tag}.png` as `${string}.png` })
  }
  ok(glbs.length > 0 && glbs.every(s => s === 200 || s === 304), `Blue's Dewbear glb was served (${glbs.join(', ') || 'never asked for'})`)
  await p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), g.x + Math.sin(yaw) * 2, g.z + Math.cos(yaw) * 2, yaw)
  for (let t = 0, calm = 0; t < 60 && calm < 4; t++) { await sleep(500); calm = await p.evaluate(() => document.querySelector<HTMLElement>('[data-veil]')?.style.opacity === '0') ? calm + 1 : 0 }
  // Greg's near button carries HIS name (page.tsx: prompt 'E · Gregory' -> label 'Gregory', every other E prompt -> 'use'). Asking for
  // 'use' here found no button, so the phone run never tapped at all (M166b): no button, or a layer over it, is a red of its own now.
  const up = await p.waitForFunction(() => /E · (Greg|Gregory)/.test(document.body.innerText), { timeout: 30000 }).then(() => true, () => false)
  ok(up, 'Greg in reach at 2 m, the prompt up')
  if (phone) {
    const q = await p.evaluate(() => { const e = document.querySelector<HTMLElement>('[data-touch="Gregory"][data-touch-near]'); if (!e) return null; const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, t = document.elementFromPoint(x, y); return { x, y, top: !!t && e.contains(t) } })
    ok(!!q, `the phone's 'Gregory' button is up (near buttons: ${await p.evaluate(() => [...document.querySelectorAll('[data-touch-near]')].map(e => e.getAttribute('data-touch')).join(', '))})`)
    ok(!!q?.top, 'nothing lies over it')
    ok(!await p.$('[data-talk-bubble]'), 'no talk before the press')
    if (q && !process.argv.includes('--no-press')) await p.touchscreen.tap(q.x, q.y)
  } else if (!process.argv.includes('--no-press')) await p.keyboard.press('KeyE')
  ok(await p.waitForFunction(() => !!document.querySelector('[data-talk-option]') || !!document.querySelector('[data-talk-bubble]'), { timeout: 30000 }).then(() => true, () => false), 'the talk opens')
  ok(await p.waitForFunction(() => !!document.querySelector('[data-talk-bubble]')?.textContent, { timeout: 15000 }).then(() => true, () => false), "Greg's bubble is up")   // drei's Html mounts it a frame after the answers
  console.log(`bubble: ${await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '(none)')}`)
  if (save === 'newborn') ok((await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')).includes(line('greg.b1.welcome.1')), "a newborn's first talk starts on Greg's signed welcome")
  await sleep(3000); await hide(); await p.screenshot({ path: `${out}/glade-greg-talk-${tag}.png` as `${string}.png` })
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
await b.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
