// BETA M154 follow-up (keeper merge, 11-27): the three friends in the Glade draw as MERGED keepers (keeper-merge.ts):
// each friend's figure holds <= CAP meshes (it was 75-150), the renderer's draw calls standing at each friend, a shot of
// each (before / after the deploy go side by side), and 0 page errors. Prints the numbers so a run before the deploy is the
// baseline.   npx tsx scripts/m154-keeper-merge-check.mts <outdir> <tag> [--url https://ather.games] [--desktop]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = process.argv[2], tag = process.argv[3] ?? 'after', url = flag('--url', 'https://ather.games'), phone = !process.argv.includes('--desktop'), view = phone ? '390' : 'desktop'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const CAP = 20
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
try {
  const p = await b.newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { const t = new EventTarget() as any, w = window as any; w.__THREE_DEVTOOLS__ = t; w.__scenes = []; w.__gls = []; t.addEventListener('observe', (e: any) => { const d = e.detail; if (d?.isScene) w.__scenes.push(d); else if (d?.info) w.__gls.push(d) }) })
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['grimoire'], b2: 'none', baitDay: null })) })
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  if (await p.evaluate(() => (window as any).__ather.zone()) !== 'glade') await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' }))
  await p.waitForFunction(() => (window as any).__ather.zone() === 'glade' && !!(window as any).__glade?.keepers, { timeout: 120000 })
  await p.waitForFunction(() => Object.keys((window as any).__friendLooks ?? {}).length >= 3, { timeout: 60000 }).catch(() => null)
  await sleep(1500)
  // meshes (= draw calls) in each friend's figure, walked in every scene the page showed the devtools hook
  const meshes = (await p.evaluate(() => {
    const w = window as any, res: Record<string, number> = {}, seen = new Set<unknown>()
    const walk = (o: any) => { if (!o || seen.has(o)) return; seen.add(o); if (o.userData?.friend) { let n = 0; o.traverse((c: any) => { if (c.isMesh) n++ }); res[o.userData.friend] = n } for (const c of o.children ?? []) walk(c) }
    for (const s of [...(w.__scenes ?? []), w.__ather?.scene?.(), w.__glade?.scene]) if (s) walk(s)
    return res
  })) as Record<string, number>
  for (const id of ['bonn', 'otto', 'tess']) ok((meshes[id] ?? 999) <= CAP, `${id}: ${meshes[id]} meshes in the figure (cap ${CAP})`)
  const calls = () => p.evaluate(async () => {
    const w = window as any, gl = w.__gls[w.__gls.length - 1]; if (!gl) return -1
    const proto = gl.render, got: number[] = []; let c = 0
    gl.render = function (...a: any[]) { const r = proto.apply(gl, a); c += gl.info.render.calls; return r }
    for (let i = 0; i < 12; i++) { c = 0; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); got.push(c) }
    gl.render = proto; return [...got].sort((x, y) => x - y)[got.length >> 1]
  })
  const hide = () => p.evaluate(() => { const h = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to start/i.test(d.textContent ?? '')); for (const d of h.filter(x => !h.some(o => o !== x && x.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  const ks = (await p.evaluate(() => (window as any).__glade.keepers)) as { id: string; x: number; z: number; yaw: number }[]
  const per: string[] = []
  for (const k of ks.filter(k => ['bonn', 'otto', 'tess'].includes(k.id))) {
    await p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), k.x + Math.sin(k.yaw) * 3, k.z + Math.cos(k.yaw) * 3, Math.atan2(Math.sin(k.yaw), Math.cos(k.yaw)))
    for (let t = 0, calm = 0; t < 40 && calm < 3; t++) { await sleep(500); calm = await p.evaluate(() => document.querySelector<HTMLElement>('[data-veil]')?.style.opacity === '0') ? calm + 1 : 0 }
    await sleep(1500); await hide()
    const n = await calls(); per.push(`${k.id} ${n}`)
    await p.screenshot({ path: `${out}/${tag}-${k.id}-${view}.png` as `${string}.png` })
  }
  console.log(`· ${tag} draw calls per frame standing at each friend (median of 12): ${per.join(', ')}`)
  console.log(`· ${tag} meshes per friend figure: ${JSON.stringify(meshes)}`)
  ok(per.length === 3, 'stood at all three friends')
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
await b.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
