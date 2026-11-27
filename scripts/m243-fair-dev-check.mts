// BETA M243: THE FAIR BENCH on prod, /shimmer/dev?mode=fair. OWNER (the /shimmer/dev gate). Run it on THIS box (it reads the prod
// accounts.db read-only for the before/after rows). Desktop 1440x900 by default; --w 390 --h 844 for the phone.
//  1 a non-owner is refused (403, no bench)          2 the mode opens with its three tabs; the Clash odds finish (200 fights a foe)
//  3 CLASH: chosen spirits (you = owl, foes picked), seed, 4x, Run -> the REAL ring (data-clash-ring) plays the line to a result,
//    the engine log scrolls (lines, hits, ends); Replay (same seed) -> the same bout winners
//  4 DASH: picked heat, seed, 4x -> the real race (data-dash-race) to a result = the headless prediction for that seed; Replay = same
//  5 SMASH: water-bear earth Lv40, seed -> the real pole rises, a hit; Replay = the same hit
//  6 NO WRITES: 0 non-GET /api requests left the page, the bench refused 0, the fair_* + exchange_claims rows are unchanged
//  7 0 page errors
//   OWNER_KEY=... npx tsx scripts/m243-fair-dev-check.mts [--w 1440 --h 900] [--shots dir] [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { DatabaseSync } from 'node:sqlite'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY
const W = Number(flag('--w', '1440')), Hh = Number(flag('--h', '900'))
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const errs: string[] = [], writes: string[] = []

// the server rows the bench must never touch (prize, Marks claim box, boards, tries)
const TABLES = ['fair_clash', 'fair_dash', 'fair_dash_tries', 'fair_smash', 'fair_smash_tries', 'exchange_claims']
function rows() {
  const d = new DatabaseSync('/root/ather-games/data/accounts.db', { readOnly: true })
  const out: Record<string, string> = {}
  for (const t of TABLES) { const r = d.prepare(`SELECT * FROM ${t}`).all(); out[t] = `${r.length}:${createHash('sha1').update(JSON.stringify(r)).digest('hex').slice(0, 10)}` }
  d.close(); return out
}
const before = rows()
console.log('rows before', JSON.stringify(before))

const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  // 1 non-owner
  { const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: Hh })
    const r = await p.goto(`${url}/shimmer/dev?mode=fair`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await sleep(1500)
    const has = await p.$('[data-fair-dev]')
    ok(r?.status() === 403 && !has, `1 non-owner refused (status ${r?.status()}, bench ${has ? 'SHOWN' : 'absent'})`)
    await p.close() }

  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: Hh })
  p.on('pageerror', e => errs.push(String(e).slice(0, 240)))
  p.on('request', q => { const u = q.url(); if (u.startsWith(url) && new URL(u).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(q.method())) writes.push(`${q.method()} ${u}`) })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${url}/shimmer/dev?mode=fair`, { waitUntil: 'load', timeout: 240000 })
  await dismissStartCard(p, 3000).catch(() => false)
  await p.waitForSelector('[data-fair-dev]', { timeout: 120000 })
  const shot = async (n: string) => { if (shots) await p.screenshot({ path: `${shots}/${W}-${n}.png` }) }
  const tabs = await p.$$eval('[data-fair-tab]', es => es.map(e => e.getAttribute('data-fair-tab')))
  ok(tabs.join() === 'clash,dash,smash', `2 the bench opens with its tabs (${tabs.join()})`)

  // a React number input: the native value setter + an input event (typing into it appended to the old value)
  const setNum = async (sel: string, v: number) => {
    await p.$eval(sel, (e, val) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; set.call(e, String(val)); e.dispatchEvent(new Event('input', { bubbles: true })) }, v)
    await sleep(200)
    const got = await p.$eval(sel, e => (e as HTMLInputElement).value); if (got !== String(v)) console.log(`  (set ${sel} = ${v}, reads ${got})`)
  }
  const pick = async (row: string, species: string, form: string, level?: number) => {
    await p.select(`[data-fair-pick="${row}"] [data-fair-species]`, species); await p.select(`[data-fair-pick="${row}"] [data-fair-form]`, form)
    if (level !== undefined) await setNum(`[data-fair-pick="${row}"] [data-fair-level]`, level)
  }
  const result = async (tab: string, notSig: string | null, ms: number) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const r = await p.evaluate(t => { const e = document.querySelector(`[data-fair-result="${t}"]`); return e ? { sig: e.getAttribute('data-fair-sig')!, seed: e.getAttribute('data-fair-result-seed'), text: (e as HTMLElement).innerText } : null }, tab)
      if (r && r.sig !== notSig) return r
      await sleep(1000)
    }
    return null
  }

  // 3 CLASH
  await pick('you', 'owl', 'base', 12)
  await pick('foe-0', 'fox', 'base', 12); await pick('foe-1', 'turtle', 'base', 12); await pick('foe-2', 'frog', 'base', 12)
  await setNum('[data-fair-seed]', 4242); await p.click('[data-fair-speed="4"]')
  // the odds for the chosen pairs finish first (paused while a run plays)
  let odds: { k: string; n: number; w: string }[] = []
  for (let k = 0; k < 120; k++) { odds = await p.$$eval('[data-fair-odds-row]', es => es.map(e => ({ k: e.getAttribute('data-fair-odds-row')!, n: Number(e.getAttribute('data-odds-n')), w: e.getAttribute('data-odds-win')! }))); if (odds.length === 3 && odds.every(o => o.n >= 200)) break; await sleep(1000) }
  ok(odds.length === 3 && odds.every(o => o.n >= 200 && o.w !== ''), `2b Clash odds for the chosen pairs: ${odds.map(o => `${o.k} ${o.w} (${o.n})`).join(' · ')}`)
  await shot('a-clash-bench')
  await p.click('[data-fair-run]')
  await p.waitForSelector('[data-clash-ring]', { timeout: 30000 }).catch(() => null)
  const ringUp = await p.$('[data-clash-ring]'); ok(!!ringUp, '3a Run mounts the REAL Clash ring')
  await sleep(9000); await shot('b-clash-ring')
  const c1 = await result('clash', null, 300000)
  const log = await p.evaluate(() => { const e = document.querySelector('[data-fair-log]'); return { n: Number(e?.getAttribute('data-log-lines') ?? 0), txt: [...(e?.children ?? [])].map(c => c.textContent).join('\n') } })
  ok(!!c1 && c1.seed === '4242', `3b the line plays to a result: ${c1?.sig}`)
  const bouts = (c1?.sig.split('|')[1] ?? '').split('>').filter(Boolean).length, ends = (log.txt.match(/end: .* wins/g) ?? []).length
  ok(log.n > 50 && /hits/.test(log.txt) && bouts >= 2 && ends === bouts && log.txt.includes(`bout ${bouts}:`), `3c the engine log scrolls (${log.n} lines; hits, ${ends} ends for ${bouts} bouts played)`)
  await shot('c-clash-result')
  await p.click('[data-clash-exit]').catch(() => p.click('[data-fair-stop]'))
  await sleep(800)
  await p.click('[data-fair-replay]')
  await sleep(800)
  const c2 = await result('clash', null, 300000)
  ok(!!c2 && c2.sig === c1?.sig, `3d Replay seed 4242 = the same bouts (${c2?.sig})`)
  await p.click('[data-clash-exit]').catch(() => p.click('[data-fair-stop]').catch(() => {}))
  await sleep(800)

  // 4 DASH
  await p.click('[data-fair-tab="dash"]'); await sleep(500)
  await p.click('[data-fair-dash-mode="picked"]'); await sleep(300)
  await pick('you', 'fox', 'base', 12)
  await pick('dash-0', 'owl', 'base', 12); await pick('dash-1', 'axolotl', 'water', 40); await pick('dash-2', 'turtle', 'base', 12); await pick('dash-3', 'rabbit', 'earth', 40)
  await setNum('[data-fair-seed]', 777); await p.click('[data-fair-speed="4"]')
  const predict = await p.$eval('[data-fair-dash-predict]', e => e.getAttribute('data-fair-dash-predict'))
  await p.click('[data-fair-run]')
  await p.waitForSelector('[data-dash-race]', { timeout: 30000 }).catch(() => null)
  ok(!!(await p.$('[data-dash-race]')), '4a Run mounts the REAL Dash race')
  await sleep(5000); await shot('d-dash-race')
  const d1 = await result('dash', null, 240000)
  // the result's order maps back to lanes: compare times as a set with the headless prediction
  ok(!!d1 && d1.seed === '777', `4b the race runs to a result: ${d1?.sig}`)
  ok(!!d1 && (d1.sig.split('>').map(x => x.split(':').pop()!).filter(m => m !== 'dnf').every(m => (predict ?? '').split(',').includes(m))), `4c the real race = the headless heat for seed 777 (${predict})`)
  await p.click('[data-fair-stop]').catch(() => {}); await sleep(600)
  await p.click('[data-fair-replay]'); await sleep(800)
  await p.waitForSelector('[data-dash-race]', { timeout: 30000 }).catch(() => null)
  const d2 = await result('dash', null, 240000)
  ok(!!d2 && d2.sig === d1?.sig, `4d Replay seed 777 = the same times (${d2?.sig})`)
  await p.click('[data-fair-stop]').catch(() => {}); await sleep(600)

  // 5 SMASH
  await p.click('[data-fair-tab="smash"]'); await sleep(500)
  await pick('you', 'water-bear', 'earth', 40)
  await setNum('[data-fair-seed]', 99); await p.click('[data-fair-speed="2"]')
  await p.click('[data-fair-run]')
  const s1 = await result('smash', null, 30000)
  const rise = await p.$eval('[data-smash-pole]', e => Number(e.getAttribute('data-rise'))).catch(() => 0)
  ok(!!s1 && Number.parseInt(s1.sig) > 0 && rise > 0, `5a the real pole: a hit ${s1?.sig}, striker rise ${rise}`)
  await shot('e-smash')
  await p.click('[data-fair-replay]'); await sleep(300)
  const s2 = await result('smash', null, 30000)
  const hist = await p.$$eval('[data-fair-history] div', es => es.map(e => e.textContent))
  ok(!!s2 && s2.sig === s1?.sig && hist.length >= 2, `5b Replay seed 99 = the same hit (${s2?.sig}; history ${hist.join(' | ')})`)

  // 6 no writes
  const blocked = await p.$eval('[data-fair-dev]', e => Number(e.getAttribute('data-fair-blocked')))
  ok(writes.length === 0 && blocked === 0, `6a no write left the page (${writes.length} non-GET /api: ${writes.slice(0, 3).join(', ')}; refused ${blocked})`)
  const after = rows()
  ok(JSON.stringify(after) === JSON.stringify(before), `6b server rows unchanged (${JSON.stringify(after)})`)
  ok(errs.length === 0, `7 0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
