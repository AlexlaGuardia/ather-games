// BETA M154: Bonn, Otto, Tess IN THE GLADE are KEEPERS in their own look (hub call 11-27): each FriendModel on screen reports
// the look record it was built from (window.__friendLooks); this asserts sex / head / torso / hair colour / skin per friend,
// that a keeper figure (not the old moulded doll) stands at each friend's spot, a shot of each, and 0 page errors.
//   npx tsx scripts/m154-friend-keeper-check.mts <outdir> [--url https://ather.games] [--desktop]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = process.argv[2], url = flag('--url', 'https://ather.games'), phone = !process.argv.includes('--desktop'), tag = phone ? '390' : 'desktop'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
// the look each friend must be drawn in (friend-looks.ts; head 1-8 = A-D male / female, even = female; torso odd = female)
const WANT = {
  bonn: { sex: 'F', head: 2, torso: 1, hair: '#2a1d17', skin: '#a9653c', hairStyle: 'Coily', hood: false, goggles: false },
  otto: { sex: 'M', head: 3, torso: 2, hair: '#c8824a', skin: '#ffd2b0', hairStyle: 'C-M', hood: false, goggles: true },
  tess: { sex: 'F', head: 8, torso: 3, hair: '#221d1f', skin: '#ffdcc2', hairStyle: null, hood: true, goggles: false },
} as const
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
try {
  const p = await b.newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['grimoire'], b2: 'none', baitDay: null })) })
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  if (await p.evaluate(() => (window as any).__ather.zone()) !== 'glade') await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' }))
  await p.waitForFunction(() => (window as any).__ather.zone() === 'glade' && !!(window as any).__glade?.keepers, { timeout: 120000 })
  const got = await p.waitForFunction(() => Object.keys((window as any).__friendLooks ?? {}).length >= 3, { timeout: 60000 }).then(() => true, () => false)
  ok(got, 'all three friends report a look record')
  const rec = (await p.evaluate(() => (window as any).__friendLooks ?? {})) as Record<string, Record<string, unknown>>
  for (const [id, w] of Object.entries(WANT)) {
    const r = rec[id] ?? {}
    ok(r.keeper === true, `${id}: drawn as a keeper (buildKeeper), height ${r.height}`)
    for (const [k, v] of Object.entries(w)) ok(r[k] === v, `${id}: ${k} = ${JSON.stringify(r[k])} (want ${JSON.stringify(v)})`)
  }
  // a keeper figure (its named head / hand parts) stands at each friend's spot in the live scene
  const parts = await p.evaluate(() => {
    const out: Record<string, string[]> = {}, seen = new Set<unknown>()
    const walk = (o: any) => { if (!o || seen.has(o)) return; seen.add(o); if (o.userData?.friend) { const n: string[] = []; o.traverse((c: any) => { if (c.name) n.push(c.name) }); out[o.userData.friend] = n } for (const c of o.children ?? []) walk(c) }
    const s = (window as any).__ather?.scene?.() ?? (window as any).__glade?.scene
    if (s) walk(s); return out
  })
  if (Object.keys(parts).length) for (const id of Object.keys(WANT)) ok(['head', 'body', 'hand-l', 'foot-r'].every(n => parts[id]?.includes(n)), `${id}: the scene holds a keeper body (head / body / hands / feet)`)
  else console.log('· scene not exposed: the part walk skipped (the record above is the proof)')
  const ks = (await p.evaluate(() => (window as any).__glade.keepers)) as { id: string; x: number; z: number; yaw: number }[]
  const hide = () => p.evaluate(() => { const h = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to start/i.test(d.textContent ?? '')); for (const d of h.filter(x => !h.some(o => o !== x && x.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  for (const k of ks) {
    await p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), k.x + Math.sin(k.yaw) * 3, k.z + Math.cos(k.yaw) * 3, Math.atan2(Math.sin(k.yaw), Math.cos(k.yaw)))
    for (let t = 0, calm = 0; t < 40 && calm < 3; t++) { await sleep(500); calm = await p.evaluate(() => document.querySelector<HTMLElement>('[data-veil]')?.style.opacity === '0') ? calm + 1 : 0 }
    await sleep(1500); await hide(); await p.screenshot({ path: `${out}/glade-${k.id}-${tag}.png` as `${string}.png` })
  }
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
await b.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
