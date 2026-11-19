// ── SOLO FIGHT, UNCHANGED BY SHARED FIGHTS (BETA M28 slice 2 proof, play / Jin 2 16e8df5e, 11-19) ──────────────────────
// A keeper ALONE in the Wilds (no party): the fight is local exactly as before M28.
//   1. not sharing, its own host (__fight)
//   2. Hollows spawn around it (the local populate still runs)
//   3. a real click on the drawn Repeater, aimed at the nearest Hollow's body, LOWERS that Hollow's hp (the local sim decides)
//   4. 0 page errors
// Hooks: __fight (read), __ather.tp / look (MOVEMENT + aim only, stated), real R + real clicks.
//   npx tsx scripts/solo-fight-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
type H = { id: number; x: number; z: number; hp: number }
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('ather:mp:party')
    localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['repeater', 'charred-rifle'], primary: 'repeater', secondary: 'charred-rifle', kael: true,
      vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
  })
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fight), 240000), 'in the Wilds, fight hook up')
  await sleep(3000); await p.mouse.click(550, 380); await sleep(800)
  const F = (k: string) => p.evaluate((f: string) => (window as any).__fight[f](), k)
  ok((await F('sharing')) === false && (await F('host')) === true, '1. alone: not sharing, its own host')
  ok(await poll(async () => ((await F('ids')) as H[]).length > 0, 120000), `2. Hollows spawn round a lone keeper (${((await F('ids')) as H[]).length})`)
  await p.keyboard.down('KeyR'); await sleep(150); await p.keyboard.up('KeyR')
  ok(await poll(async () => (await p.evaluate(() => (window as any).__ather.stance()?.kind)) === 'weapon', 10000), '   R drew the Repeater')
  // 3 · stand 7 m off the nearest Hollow, aim at its body, click until its hp drops
  let hit: string | null = null
  for (let i = 0; i < 40 && !hit; i++) {
    const s = await p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, y: a.py ?? 0, z: a.pz } })
    const hs = (await F('ids')) as H[]; if (!hs.length) { await sleep(1000); continue }
    const t = [...hs].sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0]
    const dx = t.x - s.x, dz = t.z - s.z, d = Math.hypot(dx, dz) || 1, yaw = Math.atan2(-dx, -dz)
    if (d > 9 || d < 4) { await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), t.x - dx / d * 7, t.z - dz / d * 7, yaw); await sleep(1500) }
    const s2 = await p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, y: a.py ?? 0, z: a.pz } })
    const hs2 = (await F('ids')) as H[]; const t2 = hs2.find(h => h.id === t.id); if (!t2) continue
    const ex = t2.x - s2.x, ez = t2.z - s2.z, dd = Math.hypot(ex, ez) || 1
    await p.evaluate((yw: number, pt: number) => (window as any).__ather.look(yw, pt), Math.atan2(-ex, -ez), -Math.atan2(0.75, dd))   // eye ~1.6 m, body ~0.85 m
    const hp0 = t2.hp
    await p.mouse.down(); await sleep(200); await p.mouse.up()
    const dropped = await poll(async () => { const h = ((await F('ids')) as H[]).find(o => o.id === t.id); return !h || h.hp < hp0 }, 3000)
    if (dropped) { const h = ((await F('ids')) as H[]).find(o => o.id === t.id); hit = `Hollow ${t.id}: ${hp0} -> ${h ? h.hp : 'dispersed'} at ${dd.toFixed(1)} m (shot ${i + 1})` }
  }
  ok(!!hit, `3. a real shot lowers a Hollow's hp locally: ${hit ?? 'never hit in 40 shots'}`)
  ok(errs.length === 0, `4. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
