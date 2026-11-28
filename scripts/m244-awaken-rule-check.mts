// ── BETA M244 RULE s1: THE AWAKENING ENGINE, OWNER DEV TRIGGER (2026-11-28, world-M244rule) ──────────────────────────────
// A fresh keeper (seeded save, owner cookie, ?spirits=3d) with one bloomed Vulnara (fox, Mana): Steep 4 Mana + 3 Earth, bond 255,
// no training (so the stat gate is NOT met). Her panel's owner block:
//  1. shows the four keys for Champion: form met, steep met (4+3), stat UNMET, bond met; the branch is named Vulnarok
//  2. Enigma (pure): steep UNMET (4 of 8 Mana)
//  3. Force Vulnarok: the pot saves awakened=champion, and the garden draws her Vulnarok model (vulnarok-rigged.glb mounted)
//  1b. (RULE s2) the readout line: 'Points at: Vulnarok (champion) / Missing: Stat gate'
//  4. a reload keeps it (the save parser keeps `awakened`)
//  0 page errors. FAIL before = prod has no [data-awaken-dev] block.
//   npx tsx scripts/m244-awaken-rule-check.mts [--phone] [--url http://localhost:3203] [--out docs/looks/m244-rule-2026-11-28]
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const phone = process.argv.includes('--phone')
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m244-rule-2026-11-28') + (phone ? '/390' : '/desk')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PLANTER = { id: 'vx-m244r', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(phone ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); process.exit(1) }
  await p.evaluateOnNewDocument((at: number, planter: unknown) => {
    if (sessionStorage.getItem('m244r')) return; sessionStorage.setItem('m244r', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [planter] }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], met: [],
      pots: { 'vx-m244r': { seed: 'mana_seed_fox', at, bloomed: true, element: 'mana', meals: ['mana', 'mana', 'mana', 'mana', 'earth', 'earth', 'earth'], bond: 255 } } }))
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-m244r']))
  }, Date.now() - BLOOM_MS - 60000, PLANTER)
  const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const click = async (sel: string) => p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true }, sel)
  const load = async () => {
    await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500)
    try { await dismissStartCard(p) } catch { /* best effort */ }
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
    for (let i = 0; i < 90; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
  }
  const urls = () => p.evaluate(() => Object.keys((window as any).__spiritModel?.urls ?? {})) as Promise<string[]>
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].length)
  async function openPanel(): Promise<boolean> {
    for (let k = 0; k < 10; k++) {
      await sleep(2500)
      const t = await p.evaluate(() => { const q = (window as any).__spiritModel?.trots?.fox; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }) as { x: number; z: number; y: number; h: number } | null
      if (!t) continue
      await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
      await p.keyboard.press('e'); await sleep(900)
      if (await opts()) {
        const picked = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace('›', '').trim().startsWith('Open')) as HTMLButtonElement | undefined; b?.click(); return !!b })
        if (!picked) return false
        for (let i = 0; i < 20; i++) { await sleep(500); if (await p.evaluate(() => !!document.querySelector('[data-panel="spirit"]'))) return true }
        return false
      }
      await p.keyboard.press('Escape'); await sleep(400)
    }
    return false
  }
  type Dev = { branch: string; met: string; name: string; awakened: string; keys: Record<string, string> } | null
  const readDev = () => p.evaluate(() => {
    const d = document.querySelector('[data-awaken-dev]'); if (!d) return null
    return { branch: d.getAttribute('data-awaken-dev')!, met: d.getAttribute('data-awaken-met')!, name: d.getAttribute('data-awaken-name')!, awakened: d.getAttribute('data-awakened')!,
      keys: Object.fromEntries([...d.querySelectorAll('[data-awaken-key]')].map(k => [k.getAttribute('data-awaken-key')!, k.getAttribute('data-awaken-key-met')!])) }
  }) as Promise<Dev>

  await load()
  const u0 = await urls()
  ok(u0.some(u => u.includes('vulnara')) && !u0.some(u => u.includes('vulnarok')), `0 the garden draws her as Vulnara, not awakened (${u0.join()})`)
  ok(await openPanel(), '0 her panel opens')
  const d1 = await readDev()
  ok(!!d1, '1 the owner awakening block is in her panel [data-awaken-dev]')
  ok(d1?.branch === 'champion' && d1.name === 'Vulnarok', `1 Champion = Vulnarok (${d1?.branch} ${d1?.name})`)
  ok(d1?.keys.form === '1' && d1.keys.steep === '1' && d1.keys.stat === '0' && d1.keys.bond === '1' && d1.met === '0', `1 Champion keys: form met, Steep 4+3 met, stat UNMET, bond met, not open (${JSON.stringify(d1?.keys)} met=${d1?.met})`)
  const lean = await p.evaluate(() => { const e = document.querySelector('[data-awaken-lean]'); return e ? { b: e.getAttribute('data-awaken-lean'), n: e.getAttribute('data-awaken-lean-name'), m: e.getAttribute('data-awaken-lean-missing'), t: e.textContent ?? '' } : null })
  ok(lean?.b === 'champion' && lean.n === 'Vulnarok' && lean.m === 'stat' && /Points at: Vulnarok/.test(lean.t) && /Missing: Stat gate/.test(lean.t), `1b Steep readout: points at Champion = Vulnarok, missing only the stat gate (${JSON.stringify(lean)})`)
  await shot('1-champion-keys')
  await click('[data-awaken-branch="enigma"]'); await sleep(600)
  const d2 = await readDev()
  ok(d2?.branch === 'enigma' && d2.name === 'Vulnamyr' && d2.keys.steep === '0', `2 Enigma (pure) = Vulnamyr, Steep UNMET (4 of 8 Mana) (${JSON.stringify(d2)})`)
  await click('[data-awaken-branch="champion"]'); await sleep(600)
  await click('[data-awaken-force="champion"]'); await sleep(1500)
  const d3 = await readDev()
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('ather.grimoire.v1') ?? 'null')?.pots?.['vx-m244r']?.awakened)
  ok(d3?.awakened === 'champion' && saved === 'champion', `3 Force: she is awakened (block ${d3?.awakened}, save ${saved})`)
  await shot('3-forced')
  await p.keyboard.press('Escape'); await sleep(600)
  let u3: string[] = []
  for (let i = 0; i < 60; i++) { await sleep(1000); u3 = await urls(); if (u3.some(u => u.includes('vulnarok'))) break }
  ok(u3.some(u => u.includes('vulnarok-rigged.glb')), `3 the garden draws Vulnarok (${u3.join()})`)
  await shot('3-garden-vulnarok')
  await load()
  const u4 = await urls()
  ok(u4.some(u => u.includes('vulnarok-rigged.glb')), `4 after a reload she is still Vulnarok (${u4.join()})`)
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
