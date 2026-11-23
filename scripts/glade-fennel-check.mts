// ── FENNEL IN THE GLADE, PLAYED (BETA M68 s3b, play lane 11-23) ─────────────────────────────────────────────────────────
// A live tutorial keeper Greg has sent out, who has heard Otto, Bonn and Tess but not Fennel, with NO Rinnshop and the
// first-rinstick quest not started (open.rinquest.v1 none), in the real page:
//   1. Fennel stands in the Glade (__glade.folk has moonwell:fennel)
//   2. set down in front of her (check-only warp): the real prompt 'E · Fennel', the real E, every "And then?" clicked:
//      the bubbles are greet .1-.2 + gift .1-.5 (no stick, so not done .1); the talk ends on lark's goodbye
//   3. the quest is ACTIVE at step 2 (the Moonwell wait: 'meet' done) with no Rinnshop; the bag gained JAR_BAIT bait;
//      the tutorial counts Fennel heard (all four) with gifts rinquest + bait and today's baitDay
//   4. E again the same day = bait.empty; 'Something else.' opens her ordinary Moglin talk (on moonwell:fennel)
//   5. a reload: Fennel still in the Glade (no Rinnshop), the quest still at the wait, no second jar
//   6. 0 page errors
//   npx tsx scripts/glade-fennel-check.mts [--url https://ather.games] [--phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { aimAt } from './lib/aim.mts'   // M60: E only on what the crosshair is on (a chibi is under a level ray)
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'   // the labels lark writes; a reword never stales the check
import { line } from '../src/app/shimmer/open/ather/glade-tutorial-lines'
import { fennelBye, FENNEL_MORE } from '../src/app/shimmer/open/ather/glade-fennel-talk'
import { JAR_BAIT } from '../src/app/shimmer/open/ather/glade-tutorial'
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
    for (const e of document.querySelectorAll<HTMLElement>('[data-talk-option]')) {
      if ((e.textContent ?? '').replace(/^\s*›\s*/, '').trim() !== t) continue   // the option's › marker is in its text
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
type Pl = { id: string; x: number; z: number; yaw: number }
const SENT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'bonn', 'tess'], gifts: ['grimoire', 'spike', 'pruner', 'seeds'], b2: 'none', baitDay: null }
const L = (id: string) => line(id)
const FEN = 'moonwell:fennel'
try {
  const p = await (await br.createBrowserContext()).newPage()
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((t: string) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('open.tutorial.v1', t); localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'none', step: 0 })) }
  }, JSON.stringify(SENT))
  const arrive = async () => {
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
    if ((await A(p, 'zone')) !== 'glade') await A(p, 'travel', { kind: 'glade' })
    ok(await poll(async () => (await A(p, 'zone')) === 'glade', 60000), `0. in the Glade (zone ${await A(p, 'zone')})`)
    await poll(() => p.evaluate(() => !!(window as any).__glade?.folk), 30000)
  }
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await arrive()
  const fennel = async () => ((await p.evaluate(() => (window as any).__glade.folk)) as Pl[]).find(f => f.id === FEN)
  const f0 = await fennel()
  ok(!!f0, `1. Fennel stands in the Glade (${f0 ? `${f0.x.toFixed(1)},${f0.z.toFixed(1)}` : 'absent'})`)
  if (!f0) throw new Error('no Fennel')
  const bait = async () => ((await p.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots)) as ({ id: string; n: number } | null)[]).filter(s => s?.id === 'bait').reduce((a, s) => a + s!.n, 0)
  const quest = () => p.evaluate(() => (window as any).__rinquest?.quest()) as Promise<{ state: string; step: number }>
  const tut = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.tutorial.v1') ?? 'null'))
  const bubble = () => p.evaluate(() => document.body.innerText)
  const faceAt = async (t: Pl, dist: number) => { const x = t.x + Math.sin(t.yaw) * dist, z = t.z + Math.cos(t.yaw) * dist
    await A(p, 'gladeAt', x, z, Math.atan2(-(t.x - x), -(t.z - z))) }
  const openFennel = async (tag: string) => {
    await faceAt(f0, 1.8); await sleep(2500); await aimAt(p, f0.x, f0.z, 0.6)
    ok(await poll(() => p.evaluate(() => /E · Fennel/.test(document.body.innerText) || !!document.querySelector('[data-touch="use"][data-touch-near]')), 15000), `${tag} the prompt 'E · Fennel'`)
    await pressE(p)
  }
  const b0 = await bait()
  await openFennel('2.')
  const ids = ['fennel.b1.greet.1', 'fennel.b1.greet.2', 'fennel.b1.gift.1', 'fennel.b1.gift.2', 'fennel.b1.gift.3', 'fennel.b1.gift.4', 'fennel.b1.gift.5']
  const seen: string[] = []
  for (const lid of ids) {
    if (await poll(async () => (await bubble()).includes(L(lid)), 10000)) seen.push(lid)
    await tapText(p, lid === ids[ids.length - 1] ? fennelBye : ANSWERS.more); await sleep(700)
  }
  ok(seen.length === 7, `2. all seven signed bubbles in order (${seen.length}/7: ${seen.join(' ')})`)
  ok(!(await bubble()).includes(L('fennel.b1.done.1')), '2. no stick: done .1 not said')
  ok(await poll(async () => !(await bubble()).includes(L('fennel.b1.gift.5')), 5000), "2. lark's goodbye closes the talk")
  const q1 = await quest()
  ok(q1?.state === 'active' && q1?.step === 1, `3. the quest is active at the Moonwell wait (${q1?.state} step ${q1?.step})`)
  const b1 = await bait()
  ok(b1 - b0 === JAR_BAIT, `3. today's jar: +${b1 - b0} bait (want ${JAR_BAIT})`)
  const t1 = await tut()
  ok(['otto', 'bonn', 'tess', 'fennel'].every(f => t1?.heard?.includes(f)), `3. all four heard (${t1?.heard?.join(',')})`)
  ok(t1?.gifts?.includes('rinquest') && t1?.gifts?.includes('bait') && Number.isInteger(t1?.baitDay), `3. gifts rinquest + bait, baitDay ${t1?.baitDay}`)
  // 4 · again, the same day
  await sleep(800); await openFennel('4.')
  ok(await poll(async () => (await bubble()).includes(L('fennel.bait.empty')), 10000), '4. the same day: bait.empty')
  await tapText(p, FENNEL_MORE)
  ok(await poll(() => p.evaluate((id: string) => (window as any).__folkTalk?.on === id, FEN), 10000), "4. 'Something else.' opens her Moglin talk")
  ok((await bait()) === b1, '4. no second jar')
  await p.keyboard.press('Escape'); await sleep(600)
  // 5 · reload
  await p.reload({ waitUntil: 'load', timeout: 240000 })
  await arrive()
  ok(!!(await fennel()), '5. after a reload Fennel is still in the Glade (no Rinnshop)')
  const q2 = await quest()
  ok(q2?.state === 'active' && q2?.step === 1, `5. the quest still waits at the Moonwell (${q2?.state} step ${q2?.step})`)
  ok((await bait()) === b1, '5. no jar on reload')
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `6. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
