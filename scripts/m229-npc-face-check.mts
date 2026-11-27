// ── M229 s1: NPCS TURN TO THE KEEPER IN A TALK; FENNEL FACES THE RIGHT WAY IN THE TUTORIAL (2026-11-27) ──────────────────────
// A fresh local tutorial keeper (no account, never Alex's save), sent out by Greg (Fennel's tutorial talk is live), in the Glade:
//   0. Fennel's rest facing: out of her house and toward the open ground, not into a wall (four look shots round her)
//   1. for Fennel, Greg (seated), Otto (a friend) and an Exchange attendant in the Wilds (a plain Moglin): the keeper stands OFF to
//      the figure's side (~80 deg from where it faces), aims, presses E; within 3 s the figure's face (body + head) is on the
//      keeper (< 15 deg) and it really turned (> 30 deg from rest); Esc / walking off: back to rest (< 3 deg) a few seconds later
//   2. 0 page errors
//   npx tsx scripts/m229-npc-face-check.mts [--url https://ather.games] [--phone] [--out docs/looks/m229-s1-2026-11-27/after]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
import { COUNTER, toWorld } from '../src/app/shimmer/open/ather/lingston'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone')
const out = flag('--out', '/tmp/m229') + (phone ? '-390' : '-desk'); mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const deg = (r: number) => (r * 180 / Math.PI).toFixed(0)
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
type Pl = { id: string; x: number; z: number; yaw: number }
type Probe = { body: number; head: number; err: number; rest: number; x: number; z: number }
const SENT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'bonn', 'tess'], gifts: ['grimoire', 'spike', 'pruner', 'seeds'], b2: 'none', baitDay: null }
try {
  const p = await (await br.createBrowserContext()).newPage()
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((t: string) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('open.tutorial.v1', t); localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'none', step: 0 })) }
  }, JSON.stringify(SENT))
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500)
  await dismissStartCard(p).catch(() => false)
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  if ((await A('zone')) !== 'glade') await A('travel', { kind: 'glade' })
  ok(await poll(async () => (await A('zone')) === 'glade', 90000), `in the Glade (zone ${await A('zone')})`)
  await poll(() => p.evaluate(() => !!(window as any).__glade?.folk), 30000)
  // the blueprints land after mount and move Fennel to her door: wait for her spot to hold still
  const fennel = async () => ((await p.evaluate(() => (window as any).__glade.folk)) as Pl[]).find(f => f.id === 'moonwell:fennel')
  let f = await fennel(); for (let k = 0; k < 24; k++) { await sleep(500); const g = await fennel(); if (g && f && g.x === f.x && g.z === f.z && k >= 8) break; f = g }
  if (!f) throw new Error('no Fennel')
  // ── 0. Fennel's rest facing: out of her house (the house is the lot behind her; __glade.lots, else the spot she was given) ──
  const house = await p.evaluate(() => (window as any).__glade?.fennelHouse ?? null) as { x: number; z: number } | null
  const out0 = house ? Math.atan2(f.x - house.x, f.z - house.z) : null
  console.log(`  Fennel at ${f.x.toFixed(1)},${f.z.toFixed(1)} rest yaw ${deg(f.yaw)}${house ? `; house ${house.x.toFixed(1)},${house.z.toFixed(1)}, out-of-house ${deg(out0!)}` : ''}`)
  ok(!!house && Math.abs(wrap(f.yaw - out0!)) < Math.PI / 3, `0. Fennel faces out of her house (rest ${deg(f.yaw)}, out ${out0 === null ? '?' : deg(out0)}, off ${out0 === null ? '?' : deg(Math.abs(wrap(f.yaw - out0)))} deg)`)
  for (const [k, a] of [['front', 0], ['left', Math.PI / 2], ['back', Math.PI], ['right', -Math.PI / 2]] as const) {
    const ang = f.yaw + a, x = f.x + Math.sin(ang) * 6, z = f.z + Math.cos(ang) * 6
    await A('gladeAt', x, z, Math.atan2(-(f.x - x), -(f.z - z))); await sleep(1800); await aimAt(p, f.x, f.z, 0.5); await sleep(600)
    await p.screenshot({ path: `${out}/fennel-rest-${k}.png` })
  }
  // ── 1. the talks ──
  const probe = (kind: string) => p.evaluate((k: string) => (window as any).__npcFace?.[k] ?? null, kind) as Promise<Probe | null>
  const pressE = async () => { if (phone) { const u = await p.$('[data-touch="use"]'); if (u) { await u.tap(); return } } await p.keyboard.press('KeyE') }
  const talkTo = async (name: string, kind: string, t: Pl, aimY: number, stand: (x: number, z: number, yaw: number) => Promise<unknown>, prompt: RegExp) => {
    const ang = t.yaw + 80 * Math.PI / 180, x = t.x + Math.sin(ang) * 1.9, z = t.z + Math.cos(ang) * 1.9
    await stand(x, z, Math.atan2(-(t.x - x), -(t.z - z))); await sleep(2500); await aimAt(p, t.x, t.z, aimY)
    const seen = await poll(() => p.evaluate((s: string) => new RegExp(s).test(document.body.innerText) || !!document.querySelector('[data-touch="use"][data-touch-near]'), prompt.source), 15000)
    ok(seen, `1. ${name}: the prompt (${prompt.source})`)
    await pressE()
    ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-talk-bubble]')), 10000), `1. ${name}: E opens the talk (bubble up)`)
    await sleep(3000)
    const a = await probe(kind)
    ok(!!a && a.err < 15 && Math.abs(a.body + a.head) > 30 * Math.PI / 180, `1. ${name} faces the keeper: off ${a ? a.err.toFixed(1) : '?'} deg (turned body ${a ? deg(a.body) : '?'} + head ${a ? deg(a.head) : '?'})`)
    await p.screenshot({ path: `${out}/talk-${name.toLowerCase().replace(/\W+/g, '-')}.png` })
    // the keeper leaves the talk and walks off a few metres
    for (let i = 0; i < 4 && await p.evaluate(() => !!document.querySelector('[data-talk-bubble]')); i++) { await p.keyboard.press('Escape'); await sleep(500) }
    const bx = t.x + Math.sin(ang) * 9, bz = t.z + Math.cos(ang) * 9
    await stand(bx, bz, Math.atan2(-(t.x - bx), -(t.z - bz))); await sleep(4500)
    const b = await probe(kind)
    ok(!!b && Math.abs(b.body) < 3 * Math.PI / 180 && Math.abs(b.head) < 3 * Math.PI / 180, `1. ${name} eases back to rest (body ${b ? deg(b.body) : '?'} head ${b ? deg(b.head) : '?'})`)
    await aimAt(p, t.x, t.z, aimY); await sleep(500); await p.screenshot({ path: `${out}/after-${name.toLowerCase().replace(/\W+/g, '-')}.png` })
  }
  const gladeAt = (x: number, z: number, yaw: number) => A('gladeAt', x, z, yaw)
  await talkTo('Fennel', 'moglin:fennel', f, 0.5, gladeAt, /E · talk to Fennel/)
  const greg = await p.evaluate(() => (window as any).__glade.greg) as Pl
  await talkTo('Greg', 'greg', greg, 0.9, gladeAt, /E · (talk to )?(Greg|Gregory)/)
  const otto = ((await p.evaluate(() => (window as any).__glade.keepers)) as Pl[]).find(k => k.id === 'otto')!
  await talkTo('Otto', 'friend:otto', otto, 1.0, gladeAt, /E · (talk to )?Otto/)
  // ── the Exchange attendant in the Wilds (a plain chibi Moglin) ──
  const front = toWorld(0, COUNTER.z + 1.5)
  for (let i = 0; i < 6 && (await A('zone')) !== 'wilds'; i++) { await A('travel', { kind: 'waymark', w: { id: 'm229', tile: 'first-wilds', x: front.x, y: 0, z: front.z, biome: 2, made: 0 } }); for (let k = 0; k < 30 && (await A('zone')) !== 'wilds'; k++) await sleep(1000) }
  ok((await A('zone')) === 'wilds', 'in the Wilds for the Exchange')
  await sleep(6000)
  const att = await p.evaluate(() => (window as any).__lingston?.attendants ?? null) as Pl[] | null
  const behind = toWorld(0, COUNTER.z - 1), mid = { id: 'att', x: behind.x, z: behind.z, yaw: Math.atan2(front.x - behind.x, front.z - behind.z) }
  const t = att?.[1] ?? mid
  const tpAt = (x: number, z: number, yaw: number) => p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { x, z, yaw })
  // the attendant stands behind the counter: stand in front of it, off to one side, not round the back
  const ang = t.yaw + 55 * Math.PI / 180, sx = t.x + Math.sin(ang) * 2.2, sz = t.z + Math.cos(ang) * 2.2
  await tpAt(sx, sz, Math.atan2(-(t.x - sx), -(t.z - sz))); await sleep(3000); await aimAt(p, t.x, t.z, 0.6)
  ok(await poll(() => p.evaluate(() => /E · Exchange attendant/.test(document.body.innerText) || !!document.querySelector('[data-touch="use"][data-touch-near]')), 15000), '1. attendant: the prompt')
  await pressE(); await sleep(3000)
  const a = await probe('moglin')
  ok(!!a && a.err < 15 && Math.abs(a.body + a.head) > 20 * Math.PI / 180, `1. Exchange attendant faces the keeper: off ${a ? a.err.toFixed(1) : '?'} deg (turned body ${a ? deg(a.body) : '?'} + head ${a ? deg(a.head) : '?'})`)
  await p.screenshot({ path: `${out}/talk-attendant.png` })
  for (let i = 0; i < 4 && await p.evaluate(() => !!document.querySelector('[data-talk-bubble], [data-panel="exchange"]')); i++) { await p.keyboard.press('Escape'); await sleep(500) }
  const bx = t.x + Math.sin(ang) * 9, bz = t.z + Math.cos(ang) * 9
  await tpAt(bx, bz, Math.atan2(-(t.x - bx), -(t.z - bz))); await sleep(4500)
  const b = await probe('moglin')
  ok(!!b && Math.abs(b.body) < 3 * Math.PI / 180 && Math.abs(b.head) < 3 * Math.PI / 180, `1. attendant eases back to rest (body ${b ? deg(b.body) : '?'} head ${b ? deg(b.head) : '?'})`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `2. 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
