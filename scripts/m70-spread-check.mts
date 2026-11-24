// BETA M70 s2: the SPREAD MAP on prod, 390x844, a FRESH profile. npx tsx scripts/m70-spread-check.mts [--url ...] [--out ...]
// Canon: CANON/game/shimmer-quest-glade-tutorial.md › the spread, as the player sees it (SIGNED). Lines compared with the canon
// file's own text, read here. The opening (born -> the gate) is the s1 check's.
//   1 the fold map's legend reads 'Unseen · Clear · Hollow ground'; spread.map.first (Chamomile) on the first open, never again
//   2 a far area is Unseen before the keeper goes there, Clear once they stand in it
//   3 the settlement's big one down -> its area Clear + 'This ground is clear.'
//   4 a forced 3-day skip (__ather.skipDays) -> the neglected far area reads Hollow ground + the grow toast with its place name
//   5 reload keeps every state; 0 page errors
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { SETTLEMENT } from '../src/app/shimmer/open/ather/first-settlement'
import { ZONE_NAME } from '../src/app/shimmer/open/ather/forestry'
import { SETTLERS } from '../src/app/shimmer/open/ather/first-settlement'
import { INV_KEY } from '../src/app/shimmer/open/shared/inventory'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m70s2')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const canon = readFileSync('/root/athernyx/CANON/game/shimmer-quest-glade-tutorial.md', 'utf8').split('\n')
const L = (id: string) => canon.find(l => l.startsWith(`- \`${id}\``))!.replace(/^- `[^`]+`\s*(\[[^\]]*\]\s*)?/, '').replace(/^[A-Z]+:\s*/, '')
const tiles = (JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { id: string; x: number; z: number }[] }[] }).tiles
const fw = tiles.find(t => t.name === 'first-wilds')!
const FAR = fw.nodes.find(n => n.id === 'first-wilds:1,0')!   // ~690 m off the settlement, the far side of the tile
const BIG = [...fw.nodes].sort((a, b) => Math.hypot(a.x - SETTLEMENT.x, a.z - SETTLEMENT.z) - Math.hypot(b.x - SETTLEMENT.x, b.z - SETTLEMENT.z))[0]
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
try {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
  const tapText = async (re: RegExp) => {
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
    await p.mouse.click(box.x, box.y); return true
  }
  const bubble = () => p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return null; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return { line: (b.firstElementChild?.textContent ?? '').slice(sc.length), name: b.querySelector('[data-talk-name]')?.textContent ?? '' } }) as Promise<{ line: string; name: string } | null>
  const opts = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim())) as Promise<string[]>
  const pickFirst = () => p.evaluate(() => { const b = document.querySelector<HTMLButtonElement>('[data-talk-option]'); b?.click(); return !!b })
  const tut = () => p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.endsWith('open.tutorial.v1')); return JSON.parse(k ? localStorage.getItem(k) ?? 'null' : 'null') }) as Promise<{ m70: string; m70node: string | null; gifts: string[] } | null>
  const countIn = (id: string) => p.evaluate((k, i) => { const key = Object.keys(localStorage).find(x => x === k || x.endsWith(k)) ?? k; return ((JSON.parse(localStorage.getItem(key) ?? 'null')?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, x) => a + (x?.id === i ? x.n : 0), 0) }, INV_KEY, id) as Promise<number>
  const settlement = () => p.evaluate(() => (window as any).__settlement?.() ?? null) as Promise<{ y: number | null; lit: boolean; settlers: string[]; lamps: number } | null>
  const journalHas = async (t: string) => { await p.keyboard.press('KeyJ'); await sleep(900); const has = (await p.evaluate(() => document.body.innerText)).includes(t); await p.keyboard.press('KeyJ'); await sleep(500); return has }
  /** stand 2.2 m in front of a settler, facing them, press E; resolves once the talk is open */
  const talkTo = async (id: string) => {
    const s = SETTLERS.find(x => x.id === id)!, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), px = s.x + fx * 2.2, pz = s.z + fz * 2.2
    for (let k = 0; k < 3; k++) {
      await p.evaluate((x, z, y) => { const g = (window as any).__ather; g.tp(x, z, y); g.look?.(y, -Math.atan2(0.8, 2.2)) }, px, pz, Math.atan2(px - s.x, pz - s.z)); await sleep(1500)
      await p.keyboard.press('KeyE'); await p.mouse.move(5, 5)
      if (await poll(async () => !!(await p.$('[data-talk-choices]')), 6000)) return true
    }
    return false
  }
  /** read the talk line by line, picking the only answer each time; returns the lines + the labels */
  const readTalk = async () => {
    const lines: string[] = [], labels: string[] = []
    for (let k = 0; k < 12 && await p.$('[data-talk-choices]'); k++) {
      await poll(async () => !!(await bubble())?.line, 4000)
      const b = await bubble(), o = await opts(); lines.push(b?.line ?? ''); labels.push(o[0] ?? '')
      await pickFirst(); await sleep(700)
    }
    return { lines, labels }
  }

  // ── 1 · born -> the Glade -> the gate -> the settlement ──
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 90000), '1. fresh profile: the birth gate')
  await tapText(/^BE BORN/)
  ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-creator-done]')), 45000), '1. the creator')
  await (await p.$('[data-creator-done]'))?.click()
  ok(await poll(async () => (await A('zone')) === 'glade', 60000), `1. born in the Glade (zone ${await A('zone')})`)
  const gate = { x: -212, z: 212 }, sx = gate.x + 2.4, sz = gate.z - 0.4
  await A('gladeAt', sx, sz, Math.atan2(-(gate.x - sx), -(gate.z - sz)))
  await poll(() => p.evaluate(() => /the gate \(the Wilds\)/.test(document.body.innerText)), 15000)
  await p.keyboard.press('KeyE')
  ok(await poll(async () => (await A('zone')) === 'wilds', 120000), `1. through the gate: the Wilds (zone ${await A('zone')})`)
  await sleep(6000)
  const SM = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => { const s = (window as any).__spreadMap?.(); return s ? (typeof s[f] === 'function' ? s[f](...args) : s[f]) : null }, fn, a)
  ok(await poll(async () => ((await SM('seen')) as string[] | null)?.length! > 0, 30000), `0. the arrival's area is uncovered (${JSON.stringify(await SM('seen'))})`)
  const homeId = await SM('here') as string
  ok((await SM('state', homeId)) === 'clear', `0. the settlement's area reads Clear on arrival (${homeId}: ${await SM('state', homeId)})`)
  // ── 1 · the legend + the first look ──
  await A('open', 'gate'); await sleep(1500)
  const legend = await p.evaluate(() => (document.querySelector('[data-spread-legend]') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? null)
  ok(legend === L('spread.map.legend'), `1. legend word for word: "${legend}"`)
  const firstSay = `Chamomile: ${L('spread.map.first')}`
  ok(await poll(async () => (await p.evaluate(() => document.body.innerText)).includes(L('spread.map.first')), 6000), `1. spread.map.first on the first open ("${firstSay}")`)
  await p.screenshot({ path: `${out}/s2-1-map-390.png` })
  await p.keyboard.press('Escape'); await sleep(9000)
  await A('open', 'gate'); await sleep(2500)
  ok(!(await p.evaluate(() => document.body.innerText)).includes(L('spread.map.first')) && (await SM('first')) === true, '1. ...and never again')
  await p.keyboard.press('Escape'); await sleep(800)
  // ── 2 · unseen -> clear ──
  ok((await SM('state', FAR.id)) === 'unseen', `2. ${FAR.id} is Unseen before the keeper goes there (${await SM('state', FAR.id)})`)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), FAR.x, FAR.z + 45)
  ok(await poll(async () => (await SM('state', FAR.id)) === 'clear', 30000), `2. stood in it: Clear (${await SM('state', FAR.id)}; here ${await SM('here')})`)
  // ── 3 · the big one down -> Clear + toast ──
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 18, 0), BIG.x, BIG.z)
  ok(await poll(() => p.evaluate(() => !!(window as any).__ather.combat().champ), 60000), `3. ${BIG.id}'s champion wakes`)
  await poll(() => p.evaluate(() => (window as any).__ather.combat().champ?.state !== 'rise'), 90000)
  const breakIt = async () => {
    await p.evaluate(() => { const c = (window as any).__ather.combat(); c.keeper.hp = c.keeper.maxHp; const ch = c.champ; ch.hp = 1; ch.state = 'recover'; ch.t = 30 })
    await p.waitForFunction(() => {
      const c = (window as any).__ather.combat(), ch = c.champ
      if (!ch || ch.state === 'submerge') return true
      c.keeper.hp = c.keeper.maxHp; c.keeper.sinceShot = 99; c.keeper.ammo = 12; c.keeper.reloading = 0; c.keeper.bloom = 0
      c.rounds.push({ x: ch.x, y: ch.y + 1.7, z: ch.z + 6, vx: 0, vy: 0, vz: -40, life: 1, dmg: 10, crit: 16 })
      return false
    }, { timeout: 60000, polling: 400 })
  }
  await breakIt()
  await p.waitForFunction(() => { const ch = (window as any).__ather.combat().champ; return ch && ch.state !== 'submerge' }, { timeout: 90000 })
  await breakIt()
  await p.waitForFunction(() => { const ch = (window as any).__ather.combat().champ; return ch && ch.state !== 'submerge' && ch.bar === 2 }, { timeout: 90000 })
  await breakIt()
  ok(await poll(() => p.evaluate(() => !(window as any).__ather.combat().champ), 60000), '3. the big one is down')
  ok(await poll(async () => (await p.evaluate(() => document.body.innerText)).includes(L('spread.hud.clear')), 8000), `3. toast "${L('spread.hud.clear')}"`)
  ok(await poll(async () => (await SM('state', BIG.id)) === 'clear', 10000), `3. ${BIG.id} reads Clear (${await SM('state', BIG.id)})`)
  // ── 4 · neglect: skip 3 game days -> the far area grows ──
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), SETTLEMENT.x + 3, SETTLEMENT.z + 3); await sleep(9000)
  const place = await SM('place', FAR.id) as string
  ok(Object.values(ZONE_NAME).includes(place), `4. the far area's place name is a real zone (${place})`)
  await A('skipDays', 3)
  const grow = L('spread.hud.grow').replace('{PLACE}', place)
  ok(await poll(async () => (await SM('state', FAR.id)) === 'hollow', 15000), `4. neglected 3 days: ${FAR.id} reads Hollow ground (${await SM('state', FAR.id)})`)
  ok(await poll(async () => (await p.evaluate(() => document.body.innerText)).includes('Hollow ground is spreading near '), 10000), `4. grow toast ("${grow}")`)
  const toast = await p.evaluate(() => (document.body.innerText.match(/Hollow ground is spreading near [^\n]*\./) ?? [''])[0])
  ok(Object.values(ZONE_NAME).some(z => toast === L('spread.hud.grow').replace('{PLACE}', z)), `4. the toast names a real place: "${toast}"`)
  await A('open', 'gate'); await sleep(1500); await p.screenshot({ path: `${out}/s2-4-map-hollow-390.png` }); await p.keyboard.press('Escape')
  const before = { far: await SM('state', FAR.id), big: await SM('state', BIG.id), home: await SM('state', homeId), seen: ((await SM('seen')) as string[]).sort().join() }
  // ── 5 · reload ──
  await p.reload({ waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  ok(await poll(async () => (await A('zone')) === 'wilds', 120000), '5. reload: the Wilds')
  await poll(async () => (await SM('seen')) !== null, 60000); await sleep(5000)
  const after = { far: await SM('state', FAR.id), big: await SM('state', BIG.id), home: await SM('state', homeId), seen: ((await SM('seen')) as string[]).sort().join() }
  ok(JSON.stringify(after) === JSON.stringify(before), `5. reload keeps the states (${JSON.stringify(before)} -> ${JSON.stringify(after)})`)
  ok(errs.length === 0, `Z. page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
