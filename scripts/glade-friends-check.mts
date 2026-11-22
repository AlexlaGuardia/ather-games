// ── THE FRIENDS' GIFTS, PLAYED (BETA M68 s3a, play lane 11-22) ───────────────────────────────────────────────────────────
// A live tutorial keeper whom Greg has just sent to the four (open.tutorial.v1: Greg's branches heard, no friend yet), in the
// real page:
//   1. the spike + pruner sockets start EMPTY (__ather.tools(): no forestry, no prospecting)
//   2. Otto, Tess, Bonn: set down in front of each (check-only warp), the real prompt 'E · <name>', the real E, every
//      "And then?" clicked: the bubbles are greet .1-.2 + gift .1-.3; the talk ends on the goodbye
//   3. Otto lights the Worn Spike, Bonn the Worn Pruner (__ather.tools()), Tess puts 8 starter seeds in the bag, exactly ONE grade-A
//   4. the tutorial save counts all three heard + their gifts; Fennel is still owed
//   5. a reload keeps both sockets lit and the seeds; Otto again = his bark only, no second gift
//   6. 0 page errors
// Hooks: __ather.gladeAt (warp) + tools/zone/travel (read / arrive in the Glade). --phone = 390 x 844 with taps.
//   npx tsx scripts/glade-friends-check.mts [--url https://ather.games] [--phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'   // the labels lark writes; a reword never stales the check
import { line } from '../src/app/shimmer/open/ather/glade-tutorial-lines'
import { friendBye } from '../src/app/shimmer/open/ather/glade-friend-talk'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const A = (p: Page, fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
const tapText = async (p: Page, text: string) => {
  const box = await p.evaluate((t: string) => {
    for (const e of document.querySelectorAll<HTMLElement>('button')) {
      if ((e.innerText ?? '').trim() !== t) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }
    return null
  }, text)
  if (!box) return false
  if (phone) await p.touchscreen.tap(box.x, box.y); else await p.mouse.click(box.x, box.y)
  return true
}
const pressE = async (p: Page) => {
  if (phone) { const u = await p.$('[data-touch="use"]'); if (u) { await u.tap(); return } }
  await p.keyboard.press('KeyE')
}
type Pl = { id: string; name: string; x: number; z: number; yaw: number }
const SENT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['grimoire'], b2: 'none', baitDay: null }
const MORE = ANSWERS.more
const L = (id: string) => line(id)
try {
  const p = await (await br.createBrowserContext()).newPage()
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((t: string) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('open.tutorial.v1', t) }
  }, JSON.stringify(SENT))
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  if ((await A(p, 'zone')) !== 'glade') await A(p, 'travel', { kind: 'glade' })
  ok(await poll(async () => (await A(p, 'zone')) === 'glade', 60000), `0. in the Glade (zone ${await A(p, 'zone')})`)
  await poll(() => p.evaluate(() => !!(window as any).__glade?.keepers), 30000)
  const tools = () => A(p, 'tools') as Promise<Record<string, { toolId: string } | undefined>>
  const t0 = await tools()
  ok(!t0.forestry && !t0.prospecting, `1. sockets start empty (forestry ${t0.forestry?.toolId ?? '-'}, prospecting ${t0.prospecting?.toolId ?? '-'})`)
  const keepers = Object.fromEntries(((await p.evaluate(() => (window as any).__glade.keepers)) as Pl[]).map(k => [k.id, k]))
  const faceAt = async (t: Pl, dist: number) => { const x = t.x + Math.sin(t.yaw) * dist, z = t.z + Math.cos(t.yaw) * dist
    await A(p, 'gladeAt', x, z, Math.atan2(-(t.x - x), -(t.z - z))) }
  const bubble = () => p.evaluate(() => document.body.innerText)
  /** Talk to a friend: the prompt, E, click every answer; returns the signed bubbles seen, in order. */
  const talk = async (id: string, name: string, ids: string[]) => {
    await faceAt(keepers[id], 2)
    ok(await poll(() => p.evaluate((n: string) => new RegExp(`E · ${n}`).test(document.body.innerText) || !!document.querySelector('[data-touch="use"][data-touch-near]'), name), 15000), `2. ${name}: the prompt 'E · ${name}'`)
    await pressE(p)
    const seen: string[] = []
    for (const lid of ids) {
      const hit = await poll(async () => (await bubble()).includes(L(lid)), 10000)
      if (hit) seen.push(lid)
      const last = lid === ids[ids.length - 1]
      await tapText(p, last ? friendBye(id as 'otto') : MORE); await sleep(700)
    }
    return seen
  }
  const script = (f: string) => [`${f}.b1.greet.1`, `${f}.b1.greet.2`, `${f}.b1.gift.1`, `${f}.b1.gift.2`, `${f}.b1.gift.3`]
  for (const [id, name] of [['otto', 'Otto'], ['bonn', 'Bonn'], ['tess', 'Tess']]) {
    const seen = await talk(id, name, script(id))
    ok(seen.length === 5, `2. ${name}: all five signed bubbles in order (${seen.length}/5)`)
  }
  const t1 = await tools()
  ok(t1.prospecting?.toolId === 'worn_spike', `3. Otto lit the Worn Spike (${t1.prospecting?.toolId ?? '-'})`)
  ok(t1.forestry?.toolId === 'worn_blade', `3. Bonn lit the Worn Pruner (${t1.forestry?.toolId ?? '-'})`)
  const seeds = async () => ((await p.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots)) as ({ id: string; n: number } | null)[]).filter(s => s?.id.startsWith('seed:')) as { id: string; n: number }[]
  const s1 = await seeds(), n1 = s1.reduce((a, s) => a + s.n, 0), a1 = s1.filter(s => s.id.endsWith(':A')).reduce((a, s) => a + s.n, 0)
  ok(n1 === 8 && a1 === 1, `3. Tess: 8 starter seeds, one grade-A (${s1.map(s => `${s.id}x${s.n}`).join(', ')})`)
  const tut = await p.evaluate(() => JSON.parse(localStorage.getItem('open.tutorial.v1') ?? 'null'))
  ok(['otto', 'bonn', 'tess'].every(f => tut?.heard?.includes(f)) && !tut?.heard?.includes('fennel'), `4. heard: ${tut?.heard?.join(',')} (Fennel owed)`)
  ok(['spike', 'pruner', 'seeds'].every(g => tut?.gifts?.includes(g)), `4. gifts recorded: ${tut?.gifts?.join(',')}`)
  // 5 · reload
  await p.reload({ waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  if ((await A(p, 'zone')) !== 'glade') await A(p, 'travel', { kind: 'glade' })
  await poll(async () => (await A(p, 'zone')) === 'glade', 60000); await poll(() => p.evaluate(() => !!(window as any).__glade?.keepers), 30000)
  const t2 = await tools()
  ok(t2.prospecting?.toolId === 'worn_spike' && t2.forestry?.toolId === 'worn_blade', '5. after a reload both sockets stay lit')
  const seen = await talk('otto', 'Otto', ['otto.b1.bark'])
  ok(seen.length === 1, "5. Otto again = his bark")
  const s2 = await seeds()
  ok(s2.reduce((a, s) => a + s.n, 0) === 8, '5. no second seed packet / gift')
  const tut2 = await p.evaluate(() => JSON.parse(localStorage.getItem('open.tutorial.v1') ?? 'null'))
  ok(tut2?.gifts?.length === tut?.gifts?.length, '5. no gift recorded twice')
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `6. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
