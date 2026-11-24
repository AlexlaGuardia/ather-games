// ── BETA M126 s3: THE MANA'MAL GIVES ROOM ON THE CONTINENT TOO (M91's 3-6 m gap), 390x844, NON-OWNER ────────────────────
// SETUP (stated): a Gemdigger out; on foot in Rune Hold's square (__drive.seat-out by E + footTp, as continent-stance-check).
// Walk 6 m by footTp steps, stop 6 s: the Mana'mal rests 3-4.5 m out, behind and to one side; 1 m ahead = it stays; 0 page errors.
//   npx tsx scripts/m126-continent-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
const i = process.argv.indexOf('--url'), url = i > 0 ? process.argv[i + 1] : 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
type V = { x: number; z: number }
type F = { keeper: V & { yaw: number }; pos: Record<string, V>; layout: string }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.companion.v1', JSON.stringify({ active: 'gemdigger', met: ['gemdigger'], sentHome: false })) })
  await p.goto(`${url}/shimmer/open/continent?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.foot, { timeout: 240000 }); await sleep(4000)
  await p.mouse.click(195, 420).catch(() => {}); await sleep(500); await p.keyboard.press('KeyE'); await sleep(3000)
  let K = { x: 244, z: 31 }
  const at = (x: number, z: number) => p.evaluate((a: number, b: number) => { (window as any).__drive.footTp(a, b, 0); return JSON.parse(JSON.stringify((window as any).__formation ?? null)) }, x, z) as Promise<F | null>
  for (let t = 0; t < 60; t++) { const f = await at(K.x, K.z); if (f?.pos.manamal) break; await sleep(500) }
  const walk = async (z: number) => { const n = Math.ceil(Math.abs(z - K.z) / 0.25); for (let j = 1; j <= n; j++) { await at(K.x, K.z + (z - K.z) * j / n); await sleep(90) } K = { x: K.x, z } }
  const rest = async (s: number) => { const u = Date.now() + s * 1000; let f: F | null = null; while (Date.now() < u) { f = await p.evaluate(() => JSON.parse(JSON.stringify((window as any).__formation ?? null))) as F | null; await sleep(250) } return f }
  await walk(25)
  // swiftshader draws this page at 1-2 fps and the game caps a frame at 0.05 s: 8 s is under half a second of game time, so
  // wait in FRAMES (60 = 3 s of game time), not seconds
  await p.evaluate(() => { const w = window as any; w.__fr = 0; const t = () => { w.__fr++; requestAnimationFrame(t) }; requestAnimationFrame(t) })
  let f = await rest(8); console.log(`frames drawn in the first 8 s of rest: ${await p.evaluate(() => (window as any).__fr)}`)
  for (let t = 0; t < 300 && await p.evaluate(() => (window as any).__fr) < 60; t++) await sleep(250)
  f = await rest(1)
  ok(!!f?.pos.manamal, `1. on foot with a Mana'mal (${JSON.stringify(f?.keeper)})`)
  if (f?.pos.manamal) {
    const k = f.keeper, q = f.pos.manamal, fw = { x: -Math.sin(k.yaw), z: -Math.cos(k.yaw) }
    const d = Math.hypot(q.x - k.x, q.z - k.z), back = -((q.x - k.x) * fw.x + (q.z - k.z) * fw.z), side = (q.x - k.x) * -fw.z + (q.z - k.z) * fw.x
    ok(d >= 3 && d <= 4.5, `2. the Mana'mal rests 3-4.5 m out (${d.toFixed(2)})`)
    ok(back > 1 && Math.abs(side) > 1, `2. behind and off to one side (back ${back.toFixed(2)}, side ${side.toFixed(2)})`)
    await walk(24); const g = (await rest(8))!
    const kd = Math.hypot(g.keeper.x - k.x, g.keeper.z - k.z), mv = Math.hypot(g.pos.manamal.x - q.x, g.pos.manamal.z - q.z)
    ok(kd > 0.8 && mv < 0.05, `3. the keeper steps ${kd.toFixed(2)} m: the Mana'mal stays (moved ${mv.toFixed(2)})`)
  }
  ok(errs.length === 0, `4. 0 page errors (${errs.slice(0, 3).join(' | ')})`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
await br.close()
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
