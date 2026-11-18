// folk-check: Moglin recruiting, played. Into the Wilds, stand in a settlement, press the real E, the folk panel lists this
// season's Moglins; ask a FREE one -> it comes (the garden village holds it); ask an EMPLOYED one -> it names its goods
// and the give rows show. Hooks are used for MOVEMENT (travel / tp) and READING only.
//   npx tsx scripts/folk-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { folkOf } from '../src/app/shimmer/open/ather/settlement-folk'
import type { Network } from '../src/app/shimmer/open/ather/network'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
// a settlement with at least one free Moglin and one with a job
const st = net.settlements.find(s => { const f = folkOf(s, net.season); return f.some(x => !x.employed) && f.some(x => x.employed) })!
const folk = folkOf(st, net.season), free = folk.find(f => !f.employed)!, emp = folk.find(f => f.employed)!
console.log(`settlement ${st.name} (${st.biome}) · free ${free.name} the ${free.profession} · employed ${emp.name} wants ${emp.wants.map(w => `${w.n} ${w.id}`).join(', ')}`)
const tx = Math.floor((st.x + 500) / 1000), tz = Math.floor((st.z + 500) / 1000)
const tiles = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }
const tile = tiles.tiles.find(t => t.tx === tx && t.ty === tz)!
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: 1000, height: 700 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.village.v1'); localStorage.removeItem('open.trust.v1') })
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(2000)
for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
  await p.evaluate((T, x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'folk-check', tile: T, x, y: 0, z, biome: 2, made: 0 } }), tile.name, st.x - tx * 1000, st.z - tz * 1000)
  await sleep(4000)
}
ok((await p.evaluate(() => (window as any).__ather.zone())) === 'wilds', 'in the Wilds')
await sleep(8000)
await p.evaluate((x, z) => (window as any).__ather.tp(x, z), st.x, st.z); await sleep(4000)
await p.mouse.click(500, 350); await sleep(800)
await p.keyboard.press('KeyE')
const open = await (async () => { for (let i = 0; i < 30; i++) { if (await p.$('[data-panel="folk"]')) return true; await sleep(500) } return false })()
ok(open, `E in ${st.name} opens the folk panel`)
if (open) {
  const cards = await p.$$eval('[data-folk]', es => es.map(e => e.getAttribute('data-folk')))
  ok(cards.length === folk.length && folk.every(f => cards.includes(f.id)), `the panel lists this season's ${folk.length} Moglins`)
  const clickIn = (id: string, re: string) => p.evaluate((id, re) => { const c = document.querySelector(`[data-folk="${id}"]`); const b = [...(c?.querySelectorAll('button') ?? [])].find(x => new RegExp(re).test(x.textContent ?? '')) as HTMLButtonElement | undefined; if (!b || b.disabled) return false; b.click(); return true }, id, re)
  ok(await clickIn(emp.id, '^Ask to come'), `ask ${emp.name} (has work)`); await sleep(800)
  const empText = await p.$eval(`[data-folk="${emp.id}"]`, e => e.textContent ?? '')
  ok(/Give/.test(empText) && /still wanted/.test(empText), `${emp.name} names its goods and the give rows show`)
  ok(await clickIn(free.id, '^Ask to come'), `ask ${free.name} (free)`); await sleep(1200)
  const village = await p.evaluate(() => JSON.parse(localStorage.getItem('open.village.v1') ?? 'null'))
  ok(!!village && village.moglins?.some((m: { id: string }) => m.id === free.id), `${free.name} is in the garden village`)
  ok(!(await p.$(`[data-folk="${free.id}"]`)), `${free.name} has left the settlement's list`)
}
ok(errs.length === 0, `0 page errors ${errs.length ? JSON.stringify(errs) : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
