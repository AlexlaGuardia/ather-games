// ── M155 s2: MOMO BESIDE BONN + MOREL AT THE NODES ── READ ONLY: the keepers are served the live Glade layer with three nodes ADDED IN
// THE BROWSER (the GET answered here), a POST to save-builder is aborted and fails. No owner key needed.
//   npx tsx scripts/m155-momo-morel-check.mts [--url https://ather.games] [--out dir] [--desktop] [--only MHO]
// M Momo by Bonn's boots, drawn (3 meshes), his box + line after the greet and before stay, none after the first talk.
// H First Steps: no tool = its line with the caption above it, once; a reload keeps that; too tough; not grown back; one at a time.
// O a finished keeper and an old save: no caption, no hint, today's toasts.
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { aimAt } from './lib/aim.mts'
import { line } from '../src/app/shimmer/open/ather/glade-tutorial-lines'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
import { MOREL_INTRO, MOREL_NODE_HINT } from '../src/app/shimmer/open/shared/morel-lines'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m155-check'), only = flag('--only', 'MHO'), desk = process.argv.includes('--desktop')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const TREE = { x: -100, z: 116 }, TOUGH = { x: -112, z: 124 }, CRY = { x: -92, z: 120 }   // Greg's garden
const nodes = [{ id: 'nm155aaaa', k: 'node:goldwood', ...TREE, q: 0, s: 1 }, { id: 'nm155bbbb', k: 'node:starwillow', ...TOUGH, q: 0, s: 1 }, { id: 'nm155cccc', k: 'node:raw', ...CRY, q: 0, s: 1 }]
const SENT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['grimoire'], b2: 'none', baitDay: null, folded: false }
const OLD = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
type W = any
async function keeper(tut: unknown, fast = true) {   // fast = the hints' clock x20; O runs on the real one (M33's errand hints are today's, and stay)
  const ctx = await br.createBrowserContext(); let g: Page | null = null
  const load = async () => {
    const was = g; g = await ctx.newPage(); if (was) await was.close().catch(() => {})
    const p = g as Page; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    await p.setViewport(desk ? { width: 1280, height: 800 } : { width: 390, height: 844, isMobile: true, hasTouch: true }); await p.evaluateOnNewDocument('window.__name = (f) => f')
    await p.evaluateOnNewDocument((t: string) => {
      if (location.protocol === 'about:') return
      if (!localStorage.getItem('chk')) { localStorage.setItem('chk', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', t) }
      // every Morel line and caption that ever goes up, in order
      ;(window as W).__up = []; const seen = new Set<Element>()
      setInterval(() => document.querySelectorAll('[data-say="morel"],[data-say="caption"]').forEach(e => { if (!seen.has(e)) { seen.add(e); (window as W).__up.push(`${e.getAttribute('data-say')}|${(e.textContent ?? '').replace(/^Morel:\s*/, '')}`) } }), 30)
    }, JSON.stringify(tut))
    await p.setRequestInterception(true)
    p.on('request', async r => {
      if (r.method() === 'POST' && r.url().includes('save-builder')) { errs.push('a POST to save-builder'); r.abort(); return }
      if (r.url().includes('/shimmer/open/glade-edits')) { const j: any = await (await fetch(`${url}/shimmer/open/glade-edits`)).json(); r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...j, props: [...(j.props ?? []), ...nodes] }) }) }
      else r.continue()
    })
    await p.goto(`${url}/shimmer/open/ather?hour=13${fast ? '&morel=fast' : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 })
    await p.waitForFunction(() => typeof (window as W).__ather?.travel === 'function' && !!(window as W).__ather?.gather, { timeout: 240000 })
    for (let i = 0; i < 40 && !(await p.evaluate(() => (window as W).__ather?.zone?.() === 'glade')); i++) { await p.evaluate(() => (window as W).__ather.travel({ kind: 'glade' })); await sleep(4000) }
    await sleep(8000); if (!desk) await p.touchscreen.tap(195, 500); await sleep(1500)
    return p
  }
  return { load }
}
const frame = (g: Page) => g.evaluate('new Promise(r => { let k = 3; (function t() { if (--k <= 0) r(0); else requestAnimationFrame(t) })() })')
const up = (g: Page) => g.evaluate(() => [...(window as W).__up]) as Promise<string[]>
const text = (g: Page) => g.evaluate(() => document.body.innerText) as Promise<string>
const until = async (f: () => Promise<boolean>, ms = 15000) => { for (let t = 0; t < ms; t += 250) { if (await f()) return true; await sleep(250) } return false }
const ls = (g: Page, k: string) => g.evaluate(q => { const n = Object.keys(localStorage).find(x => x.endsWith(q)); return n ? localStorage.getItem(n) : null }, k) as Promise<string | null>
const tp = async (g: Page, x: number, z: number) => { await g.evaluate((a, b) => (window as W).__ather.tp(a, b, 0), x, z); await sleep(1500); await frame(g) }
const face = async (g: Page, at: { x: number; z: number }, c: boolean) => { await tp(g, at.x, at.z + 5); for (let i = 0; i < 14; i++) { await aimAt(g, at.x, at.z, c ? 0.6 : 1.2); await frame(g); if (await g.evaluate((q: boolean) => { const a = (window as W).__ather; return q ? a.crystal()?.id : a.aim() }, c)) return true; await sleep(500) } return false }
const E = async (g: Page) => { await g.keyboard.press('KeyE'); await frame(g); await frame(g); await sleep(600) }
const shot = async (g: Page, f: string) => { await g.screenshot({ path: `${out}/${f}${desk ? '-desk' : ''}.png` as `${string}.png` }).catch(() => {}) }
const M = (k: keyof typeof MOREL_NODE_HINT, w = '') => `morel|${MOREL_NODE_HINT[k].replace('{REGROW}', w)}`, CAP = `caption|${MOREL_INTRO.caption}`
const bubble = (g: Page) => g.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return null; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return { sc, l: (b.firstElementChild?.textContent ?? '').slice(sc.length) } }) as Promise<{ sc: string; l: string } | null>
const pick = (g: Page) => g.evaluate(() => { const b = document.querySelector<HTMLButtonElement>('[data-talk-option]'); const t = (b?.textContent ?? '').replace(/^\s*›\s*/, '').trim(); b?.click(); return t }) as Promise<string>
const talk = async (g: Page, n: string) => {
  const B = await g.evaluate(() => (window as W).__glade.keepers.find((k: any) => k.id === 'bonn')) as { x: number; z: number; yaw: number }
  await g.evaluate((x, z, y) => { const a = (window as W).__ather; a.gladeAt(x, z, y); a.look?.(y, -0.3) }, B.x + Math.sin(B.yaw) * 4.5, B.z + Math.cos(B.yaw) * 4.5, Math.atan2(Math.sin(B.yaw), Math.cos(B.yaw))); await sleep(4000); await shot(g, `${n}-far`)
  const px = B.x + Math.sin(B.yaw) * 2.3, pz = B.z + Math.cos(B.yaw) * 2.3
  await g.evaluate((x, z, y) => { const a = (window as W).__ather; a.gladeAt(x, z, y); a.look?.(y, -0.42) }, px, pz, Math.atan2(px - B.x, pz - B.z)); await sleep(5000); await shot(g, n)
  for (let k = 0; k < 4 && !(await bubble(g)); k++) { await g.keyboard.press('KeyE'); await until(async () => !!(await bubble(g)), 4000) }
  const r: { sc: string; l: string }[] = []
  for (let k = 0; k < 14; k++) { const b = await bubble(g); if (!b) break; r.push(b); if (b.l === line('bonn.b1.momo.1')) await shot(g, `${n}-line`); const t = await pick(g); if (t !== ANSWERS.more) break; await until(async () => (await bubble(g))?.l !== b.l, 5000) }
  return { r, B }
}
try {
  if (only.includes('M')) {
    const k = await keeper(SENT), g = await k.load(), { r, B } = await talk(g, 'momo-bonn')
    const m = await g.evaluate(() => (window as W).__glade.momo) as { x: number; z: number } | null
    ok(m && Math.hypot(m.x - B.x, m.z - B.z) < 0.7, `M. Momo stands by Bonn's boots (${m && Math.hypot(m.x - B.x, m.z - B.z).toFixed(2)} m)`)
    const i = r.findIndex(b => b.l === line('bonn.b1.momo.1'))
    ok(i > 0 && r[i].sc.includes(line('bonn.b1.momo.scene')) && r[i - 1].l === line('bonn.b1.greet.2') && r[i + 1]?.l === line('bonn.b1.stay.1'), `M. greet, his box + line, stay (${r.map(b => b.l.slice(0, 18)).join(' / ')})`)
    ok(r.filter(b => /Momo|Duskpuff/.test(b.l + b.sc)).length === 1, 'M. said once'); await sleep(1500)
    const again = await talk(g, 'momo-again'); ok(again.r.length === 1 && again.r[0].l === line('bonn.b1.bark') && !again.r[0].sc, 'M. after the first talk: her bark, no Momo line')
    await g.close()
  }
  if (only.includes('H')) {
    const k = await keeper(SENT); let g = await k.load()
    ok((await up(g)).length === 0, 'H. nothing said before a try'); ok(await face(g, TREE, false), 'H. the Goldwood, no pruner')
    await E(g); ok(await until(async () => (await up(g)).length >= 2), 'H. it speaks'); const u1 = await up(g)
    ok(u1.join() === [CAP, M('tool_missing')].join(), `H. the caption, then the tool line (${u1})`); await shot(g, 'hint-tool'); ok(!/You have no Forestry focus/.test(await text(g)), 'H. in the toast\'s place')
    await E(g); await sleep(1500); ok((await up(g)).length === 2, 'H. again at once: not repeated')
    ok((await ls(g, 'open.morelintro.v1')) === '1', 'H. the caption is kept')
    await g.evaluate(() => { const n = Object.keys(localStorage).find(x => x.endsWith('open.tutorial.v1'))!; const t = JSON.parse(localStorage.getItem(n)!); t.gifts.push('pruner', 'spike'); localStorage.setItem(n, JSON.stringify(t)) })
    g = await k.load(); ok(await face(g, TOUGH, false), 'H. the pruner lit, the Starwillow'); const c0 = await g.evaluate(() => (window as W).__ather.chan()); await E(g)
    ok(await until(async () => (await up(g)).length >= 1), 'H. it warns'); ok((await up(g)).join() === M('too_tough') && !c0, `H. too tough, and no second caption (${await up(g)})`); await shot(g, 'hint-tough')
    ok(!!(await g.evaluate(() => (window as W).__ather.chan())), 'H. a warning only: the work goes on'); await E(g); await sleep(8000)
    await g.evaluate(() => (window as W).__ather.setMana(100)); ok(await face(g, TREE, false), 'H. the Goldwood, with the tool'); const n0 = (await up(g)).length; await E(g); for (let i = 0; i < 200 && await g.evaluate(() => (window as W).__ather.chan()); i++) { await frame(g); await sleep(60) }
    ok((await up(g)).length === n0, 'H. a node you can work: no hint'); await face(g, TREE, false); await E(g)
    ok(await until(async () => (await up(g)).at(-1) === M('regrowing', 'a day')), `H. not grown back: "${(await up(g)).at(-1)}"`); await shot(g, 'hint-regrow')
    await g.close()
  }
  if (only.includes('O')) for (const [n, t] of [['an old save', OLD], ['a finished keeper', { ...SENT, gifts: OLD.gifts, heard: OLD.heard, b2: 'accepted', m70: 'thanked', fs: 'done' }]] as const) {
    const k = await keeper(t, false), g = await k.load(); ok(await face(g, TOUGH, false), `O. ${n}: the Starwillow`); await E(g); await sleep(2000); ok(!!(await g.evaluate(() => (window as W).__ather.chan())), `O. ${n}: it works as before`); await E(g)
    await g.evaluate(() => (window as W).__ather.setMana(100)); await face(g, TREE, false); await E(g); for (let i = 0; i < 200 && await g.evaluate(() => (window as W).__ather.chan()); i++) { await frame(g); await sleep(60) }
    await face(g, TREE, false); await E(g); ok(await until(async () => /Goldwood, regrowing \(/.test(await text(g)), 6000), `O. ${n}: today's line`)
    ok((await up(g)).length === 0 && (await ls(g, 'open.morelintro.v1')) === null, `O. ${n}: no hint, no caption (${await up(g)})`); await g.close()
  }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 400)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
