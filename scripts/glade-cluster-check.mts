// ── THE CLOSED GLADE, PLAYED (BETA M67 s1a, world lane 11-22; plan docs/tutorial-cluster.md) ─────────────────────────────
// A NEWBORN keeper opens their eyes in the closed Glade (four gardens round the Green), not at Moonwell in the Wilds. In the
// real page, a fresh profile:
//   1. the birth gate, the real BE BORN tap, the creator, the real Looks good tap
//   2. the first frame is zone 'glade', in Greg's garden, within 6 m of Greg and FACING him (within 30 deg); his marker is up;
//      the message line names Greg's garden
//   3. the four gardens' keepers + the five Glade Moglins are drawn where glade-cluster.ts says (Fennel/Greg, Sax/Otto,
//      Yarrow + Mallow/Tess, Hazel/Bonn)
//   4. a reload keeps the keeper in the Glade, where they stood (no birth gate again)
//   5. no exit but the gate: set down beside the gate (check-only warp, the walk there is the unit test's), the real E (a tap
//      on the phone's Use button) takes them to the Wilds
//   6. an existing save stays where it was: a reload now resumes in the Wilds, not the Glade
//   7. 0 page errors
//   8. (s1b-1) the fold map's 'Moonwell Glade' stop, right under 'Your plot', sets an existing keeper down facing Greg
// Hooks READ only except __ather.gladeAt (the warp in 5). --phone = 390 x 844 with taps. --out <dir> = shots to LOOK at.
//   npx tsx scripts/glade-cluster-check.mts [--url https://ather.games] [--phone] [--out dir]
import { mkdirSync } from 'node:fs'
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone'), out = flag('--out', '')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
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
  if (phone) await p.touchscreen.tap(box.x, box.y); else await p.mouse.click(box.x, box.y)
  return true
}
const A = (p: Page, fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
const shot = async (p: Page, name: string) => { if (out) { mkdirSync(out, { recursive: true }); await p.screenshot({ path: `${out}/${name}-${phone ? 'phone' : 'desk'}.png` }) } }
type Pl = { id: string; name: string; x: number; z: number; yaw: number }
try {
  const p = await (await br.createBrowserContext()).newPage()
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  // 1 · born, then the creator
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 90000), '1. the birth gate shows')
  ok(await tapText(p, /^BE BORN/), '1. tapped BE BORN')
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-creator-done]')), 45000), '1. the creator follows the birth')
  const done = await p.$('[data-creator-done]'); if (done) { if (phone) await done.tap(); else await done.click() }
  ok(await poll(() => p.evaluate(() => !document.querySelector('[data-creator-done]')), 15000), '1. Looks good closes the creator')
  // 2 · the first frame: the closed Glade, in Greg's garden, facing him
  ok(await poll(async () => (await A(p, 'zone')) === 'glade', 60000), `2. first frame is the closed Glade (zone ${await A(p, 'zone')})`)
  ok(await poll(() => p.evaluate(() => !!(window as any).__glade), 30000), '2. the Glade is drawn')
  await sleep(2500)
  const G = await p.evaluate(() => (window as any).__glade) as { keepers: Pl[]; folk: Pl[]; greg: Pl; marker: boolean }
  const s = await A(p, 'state') as { px: number; pz: number; yaw: number }
  const g = G.greg, d = Math.hypot(g.x - s.px, g.z - s.pz)
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), off = Math.acos(Math.max(-1, Math.min(1, (fx * (g.x - s.px) + fz * (g.z - s.pz)) / Math.max(d, 1e-6)))) * 180 / Math.PI
  ok(d < 6, `2. within 6 m of Greg: ${d.toFixed(1)} m (keeper ${s.px.toFixed(1)},${s.pz.toFixed(1)}; Greg ${g.x.toFixed(1)},${g.z.toFixed(1)})`)
  ok(off < 30, `2. facing Greg: ${off.toFixed(0)} deg off`)
  ok(G.marker, '2. the marker over Greg is up')
  ok(await poll(() => p.evaluate(() => /Greg's garden/.test(document.body.innerText)), 8000), "2. the message line names Greg's garden")
  await shot(p, 'glade-spawn')
  // 3 · who is where
  const keepers = Object.fromEntries(G.keepers.map(k => [k.id, k])), folk = Object.fromEntries(G.folk.map(f => [f.id.split(':')[1], f]))
  ok(['greg', 'otto', 'tess', 'bonn'].every(k => keepers[k]), `3. four garden-keepers drawn: ${G.keepers.map(k => k.name).join(', ')}`)
  const near = (a: Pl, b: Pl) => Math.hypot(a.x - b.x, a.z - b.z) < 8
  const pairs: [string, string][] = [['fennel', 'greg'], ['sax', 'otto'], ['yarrow', 'tess'], ['mallow', 'tess'], ['hazel', 'bonn']]
  for (const [f, k] of pairs) ok(!!folk[f] && near(folk[f], keepers[k]), `3. ${f} is at ${keepers[k]?.name}'s garden`)
  ok(G.keepers.every((a, i) => G.keepers.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) > 100)), '3. the four gardens stand apart (one each)')
  // 4 · a reload keeps them in the Glade, where they stood
  await sleep(4000)   // the spot saves every 3 s
  const before = await A(p, 'state') as { px: number; pz: number }
  await p.reload({ waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  ok(await poll(async () => (await A(p, 'zone')) === 'glade', 30000), `4. reload: still in the Glade (zone ${await A(p, 'zone')})`)
  await sleep(2500)
  ok(!(await p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))), '4. reload: no birth gate (born already)')
  const after = await A(p, 'state') as { px: number; pz: number }
  const moved = Math.hypot(after.px - before.px, after.pz - before.pz)
  ok(moved < 3, `4. reload: where they stood (${moved.toFixed(1)} m off)`)
  // 5 · the gate: set down 2.4 m short of it, facing it, then the real E / Use tap
  const gate = { x: -212, z: 212 }, sx = gate.x + 2.4, sz = gate.z - 0.4
  await A(p, 'gladeAt', sx, sz, Math.atan2(-(gate.x - sx), -(gate.z - sz)))
  ok(await poll(() => p.evaluate(() => /the gate \(the Wilds\)/.test(document.body.innerText) || !!document.querySelector('[data-touch="use"][data-touch-near]')), 15000), "5. at the gate: 'E · the gate (the Wilds)'")
  await shot(p, 'glade-gate')
  if (phone) { const b = await p.$('[data-touch="use"][data-touch-near]'); if (b) await b.tap(); else ok(false, '5. the Use button is there to tap') }
  else await p.keyboard.press('KeyE')
  ok(await poll(async () => (await A(p, 'zone')) === 'wilds', 90000), `5. through the gate: the Wilds (zone ${await A(p, 'zone')})`)
  await sleep(4000)
  await shot(p, 'glade-out')
  // 6 · an existing save: from now on a reload resumes in the Wilds, not the Glade
  await p.reload({ waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  ok(await poll(async () => (await A(p, 'zone')) === 'wilds', 120000), `6. reload after the gate: the Wilds, where they were (zone ${await A(p, 'zone')})`)
  // 8 · s1b-1: the Glade stays on the Ather map. The fold map (the gate's, opened by hook; the stop is a REAL tap) lists
  //     'Moonwell Glade' right under 'Your plot', and it sets an existing keeper down in Greg's garden facing him
  await A(p, 'open', 'gate')
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="fold-map"]')), 10000), '8. the fold map opens')
  const order = await p.evaluate(() => [...document.querySelectorAll('[data-panel="fold-map"] button')].map(b => (b as HTMLElement).innerText.split('\n')[0].trim()).filter(t => /^(Your plot|Moonwell Glade)$/.test(t)))
  ok(order.join('|') === 'Your plot|Moonwell Glade', `8. 'Moonwell Glade' sits right under 'Your plot' (${order.join(' > ')})`)
  await shot(p, 'glade-foldmap')
  { // scoped to the panel: the Wilds' own region label behind it also reads 'Moonwell Glade'
    let btn = null; for (const e of await p.$$('[data-panel="fold-map"] button')) if (/^Moonwell Glade/.test(await e.evaluate(n => (n as HTMLElement).innerText.trim()))) { btn = e; break }
    ok(!!btn, '8. the Moonwell Glade stop is a button in the fold map'); if (btn) { if (phone) await btn.tap(); else await btn.click() } }
  ok(await poll(async () => (await A(p, 'zone')) === 'glade', 30000), `8. the stop lands in the Glade (zone ${await A(p, 'zone')})`)
  await sleep(2500)
  { const s8 = await A(p, 'state') as { px: number; pz: number; yaw: number }, g8 = G.greg, d8 = Math.hypot(g8.x - s8.px, g8.z - s8.pz)
    const o8 = Math.acos(Math.max(-1, Math.min(1, (-Math.sin(s8.yaw) * (g8.x - s8.px) - Math.cos(s8.yaw) * (g8.z - s8.pz)) / Math.max(d8, 1e-6)))) * 180 / Math.PI
    ok(d8 < 6 && o8 < 30, `8. in Greg's garden facing him (${d8.toFixed(1)} m, ${o8.toFixed(0)} deg)`) }
  await shot(p, 'glade-visit')
  ok(errs.length === 0, `7. page errors: ${errs.length} ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
