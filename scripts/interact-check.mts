// ── BETA M60: E ONLY ON WHAT THE CROSSHAIR IS ON, WITHIN 3 m (Alex 11-21, hub #15626; shared/aim-pick.ts) ─────────────
// Per target: (a) 2 m off, crosshair on it -> its prompt; (b) same spot, turned round -> no prompt; (c) crosshair on it but
// past reach -> no prompt. Targets: the planning table + the starter Keepstone (a station) + the gate on the plot; a Moglin
// at Moonwell Glade (and E opens the talk on it); a Rune Hold door on the continent (__market.reach). 0 page errors.
//   npx tsx scripts/interact-check.mts [--url https://ather.games] [--phone]   (--phone = 390x844, touch)
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
import { gunzipSync } from 'zlib'
import { TABLE, STARTER_CHEST } from '../src/app/shimmer/open/ather/rooms'
import { GATE } from '../src/app/shimmer/open/ather/plot'
import { GLADE_ID } from '../src/app/shimmer/open/ather/moonwell-glade'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: string[] = [], fails: string[] = [], pageErrs: string[] = []
const ok = (c: boolean, m: string) => { res.push(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m) }
const EYE = 1.6
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = async () => {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1100, height: 680 })
  p.on('pageerror', e => pageErrs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  return p
}
const text = (p: any, s: string) => p.evaluate((q: string) => document.body.innerText.includes(q), s) as Promise<boolean>
const anyE = (p: any) => p.evaluate(() => /E · /.test(document.body.innerText)) as Promise<boolean>

// ── the Ather: stand at (sx, sz), look at (tx, ty above ground, tz) ──
async function atherLook(p: any, sx: number, sz: number, tx: number, tz: number, ty: number, turn = false) {
  await p.evaluate((a: number, b: number, c: number, d: number, e: number, t: boolean, eye: number) => {
    const g = (window as any).__ather, gs = g.ground(a, b), gt = g.ground(c, d)
    const dx = c - a, dz = d - b, yaw = Math.atan2(-dx, -dz) + (t ? Math.PI : 0), pitch = t ? -0.1 : Math.atan2(gt + e - (gs + eye), Math.hypot(dx, dz))
    g.tp(a, b, yaw); g.look(yaw, pitch)
  }, sx, sz, tx, tz, ty, turn, EYE)
  await frames(p, 10)   // ten real frames (the HUD prompt refreshes on the frame loop; a SwiftShader Glade frame can take > 1 s)
}
const frames = (p: any, n: number) => p.evaluate((k: number) => new Promise<void>(r => { const f = () => (--k <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f) }), n)
/** presence polls (up to 8 s); absence is read after the frames above have run */
const shows = async (p: any, s: string) => { for (let t = 0; t < 8000; t += 400) { if (await text(p, s)) return true; await sleep(400) } return false }
/** the three legs for one Ather target: from direction (ux, uz) out of the target, near side `r` */
async function atherLegs(p: any, name: string, prompt: string, tx: number, tz: number, r: number, ty: number, ux: number, uz: number) {
  const L = Math.hypot(ux, uz) || 1; ux /= L; uz /= L
  const near = r + 1.6, far = r + 3.6
  await atherLook(p, tx + ux * near, tz + uz * near, tx, tz, ty)
  ok(await shows(p, prompt), `${name}: crosshair on it ${near.toFixed(1)} m off its centre -> '${prompt}'`)
  await atherLook(p, tx + ux * near, tz + uz * near, tx, tz, ty, true)
  ok(!(await text(p, prompt)), `${name}: same spot, turned round -> no prompt`)
  await atherLook(p, tx + ux * far, tz + uz * far, tx, tz, ty)
  ok(!(await text(p, prompt)), `${name}: crosshair on it, near side 3.6 m away -> no prompt (reach 3 m)`)
}

// 1. the plot: the planning table, the starter Keepstone, the gate
{
  const p = await page()
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'plot' && !!(window as any).__ather?.ground, { timeout: 240000 }); await sleep(5000)
  if (!phone) { await p.mouse.click(550, 340); await sleep(600) }
  await atherLegs(p, 'planning table', 'E · the planning table', TABLE.x, TABLE.z, 1.1, 0.8, -1, 0.3)
  await atherLegs(p, 'starter Keepstone', 'E · the Keepstone', STARTER_CHEST.x, STARTER_CHEST.z, 0.55, 0.6, 1, 0.2)
  await atherLegs(p, 'gate', 'E · the gate (fold map)', GATE.x, GATE.z, 1.4, 1.4, -GATE.x, -GATE.z)
  // nothing under the crosshair anywhere: a bare patch of meadow, looking at the sky
  await p.evaluate((x: number, z: number) => { const g = (window as any).__ather; g.tp(x, z, 0); g.look(0, 0.6) }, TABLE.x - 6, TABLE.z + 6); await sleep(1200)
  ok(!(await anyE(p)), 'plot: crosshair on the sky -> no E prompt at all')
  await p.close()
}

// 2. Moonwell Glade: a Moglin, and E opens the talk on it
{
  const p = await page()
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(6000)
  if (!phone) { await p.mouse.click(550, 340); await sleep(600) }
  let F: { id: string; x: number; z: number }[] = []
  for (let t = 0; t < 30000; t += 1000) { F = await p.evaluate((id: string) => ((window as any).__folk?.drawn?.() ?? {})[id] ?? [], GLADE_ID); if (F.length) break; await sleep(1000) }
  ok(F.length > 0, `Moonwell Glade: ${F.length} Moglins drawn`)
  if (F.length) {
    const cx = F.reduce((a, f) => a + f.x, 0) / F.length, cz = F.reduce((a, f) => a + f.z, 0) / F.length
    const m = F.slice().sort((a, b) => Math.hypot(b.x - GREG_WAYMARK.x, b.z - GREG_WAYMARK.z) - Math.hypot(a.x - GREG_WAYMARK.x, a.z - GREG_WAYMARK.z))[0]
    await atherLegs(p, `Glade Moglin ${m.id}`, 'talk to the folk', m.x, m.z, 0.4, 0.5, m.x - cx, m.z - cz)
    const L = Math.hypot(m.x - cx, m.z - cz) || 1
    await atherLook(p, m.x + (m.x - cx) / L * 2, m.z + (m.z - cz) / L * 2, m.x, m.z, 0.5)
    await p.keyboard.press('KeyE'); await sleep(2500)
    const talk = await p.evaluate(() => (window as any).__folkTalk ?? null) as { on: string | null } | null
    ok(!!talk?.on, `E opens the folk talk on a Moglin (on=${talk?.on})`)
  }
  await p.close()
}

// 3. the continent: a Rune Hold door
{
  const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
  const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
  const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
  const door = doorsCached(R, 'rune-hold')[0]
  ok(!!door, `Rune Hold has a door (${door?.key})`)
  if (door) {
    const p = await page()
    await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__drive?.footTp && !!(window as any).__market, { timeout: 240000, polling: 1000 }); await sleep(3000)
    if (!phone) { await p.mouse.click(500, 320).catch(() => {}); await sleep(500) }
    const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz), at = door.at
    const reach = () => p.evaluate(() => (window as any).__market.reach()) as Promise<string | null>
    await p.evaluate((x: number, z: number) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), at.x, at.z); await sleep(6000)
    const foot = async (d: number, y: number, pitch: number) => { await p.evaluate((x: number, z: number, a: number, q: number) => (window as any).__drive.footTp(x, z, a, q), at.x + fx * d, at.z + fz * d, y, pitch); await sleep(2500) }
    await foot(1.4, yaw, -0.08)
    let r: string | null = null
    for (let t = 0; t < 20000 && (r = await reach()) !== door.key; t += 1000) await sleep(1000)
    ok(r === door.key, `Rune Hold door: crosshair on it 1.4 m off the step -> reach ${r}`)
    await foot(1.4, yaw + Math.PI, -0.08)
    ok((await reach()) === null, `Rune Hold door: same spot, turned round -> no reach (${await reach()})`)
    await foot(4.4, yaw, -0.05)
    ok((await reach()) === null, `Rune Hold door: crosshair on it, 4.4 m off the step -> no reach (${await reach()})`)
    await p.close()
  }
}

ok(!pageErrs.length, `0 page errors (${pageErrs.join(' | ')})`)
console.log(res.join('\n'))
console.log(fails.length ? `FAIL (${phone ? 'phone' : 'desktop'}): ${fails.join('; ')}` : `PASS (${phone ? 'phone 390x844' : 'desktop'}): E only on what the crosshair is on, within 3 m`)
await br.close(); process.exit(fails.length ? 1 : 0)
