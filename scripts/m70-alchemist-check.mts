// BETA M70 s3: Angelica's side quest A Proper Batch on prod, 390x844, a FRESH profile. npx tsx scripts/m70-alchemist-check.mts [--url ...] [--out ...]
// Canon: CANON/game/shimmer-quest-glade-tutorial.md › alchemist.side (SIGNED). Lines are compared with the generated table
// (m70-alchemist.test.ts pins that table to the canon file word for word).
//   1-4 the s1 route (m70-settlement-check): born -> gate -> Lamps Out -> the big one down -> Chamomile's thanks
//   6 Angelica: offer.1, offer.2 + 'Show me.' / 'Later.' -> Later -> alchemist.no, no quest
//   7 again -> Show me -> alchemist.yes; A Proper Batch in the journal (step gather); bark.open while open
//   8 gather: the batch's raw makings put in the bag (CHECK SHORTCUT: farming + fishing are their own checks), reload -> step brew
//   9 brew at Angelica's Desk (the real E + the panel's button) -> 2 Health Draughts, the makings spent, step hand
//   10 hand the bottle -> reward.1-3 in order, the alchemy set in the bag once, the done line in the journal
//   11 reload: Angelica has nothing more, no second set; 0 page errors
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { GLADE_LINES } from '../src/app/shimmer/open/ather/glade-tutorial-lines'
import { SETTLERS, M70_GIFT, SETTLEMENT } from '../src/app/shimmer/open/ather/first-settlement'
import { GLEANER_POST } from '../src/app/shimmer/open/ather/gleaner'
import { INV_KEY } from '../src/app/shimmer/open/shared/inventory'
import { BATCH_NEEDS, ALC_SET_ITEMS, ANGELICA_DESK, HAND_SCRIPT, M70SIDE_TEXT } from '../src/app/shimmer/open/ather/m70-alchemist'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m70s3')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const L = (id: string) => GLADE_LINES[id].text
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
  const pos0 = await p.evaluate(() => (window as any).__folk?.keeper?.() ?? null) as { x: number; z: number } | null
  ok(await poll(async () => (await settlement())?.y != null, 60000), `1. the settlement is drawn round the arrival (${JSON.stringify(await settlement())}; keeper ${JSON.stringify(pos0)})`)
  const st0 = await settlement()
  ok(!!st0 && ['chamomile', 'borage', 'feverfew', 'angelica'].every(x => st0.settlers.includes(x)), `1. Chamomile, Borage, Feverfew, Angelica (${st0?.settlers})`)
  ok(!!st0 && st0.lamps >= 6 && st0.lit === false, `1. ${st0?.lamps} lamps, DARK while the big one stands`)
  await sleep(3000)
  const stall = await p.evaluate(id => (window as any).__folk?.stalls?.()?.[id] ?? null, GLEANER_POST.id) as { name: string; x: number; z: number } | null
  ok(stall?.name === 'Gleaner' && Math.hypot(stall.x - SETTLEMENT.x, stall.z - SETTLEMENT.z) < SETTLEMENT.r, `1. Gleaner's stall at the settlement, for a player (${JSON.stringify(stall)})`)
  
  // ── 2 · Chamomile's arrival -> Lamps Out ──
  ok(await talkTo('chamomile'), '2. E at Chamomile opens a talk')
  const nm = (await bubble())?.name
  const arr = await readTalk()
  const want = ['settler.arrive.1', 'settler.arrive.2', 'settler.arrive.3', 'settler.arrive.4', 'settler.go'].map(L)
  ok(nm === 'Chamomile' && arr.lines.join('|') === want.join('|'), `2. Chamomile's arrival lines in order (${nm}: ${arr.lines.join(' | ')})`)
  ok(arr.labels[3] === L('settler.choice.go'), `2. the choice "${L('settler.choice.go')}" (${arr.labels[3]})`)
  const t1 = await tut()
  ok(t1?.m70 === 'open' && !!t1.m70node, `2. Lamps Out open on node ${t1?.m70node}`)
  ok(await poll(() => journalHas(L('quest.m70.title')), 12000), '2. "Lamps Out" in the journal')
  ok(await talkTo('borage'), '2. E at Borage')
  const b1 = await bubble(); await readTalk()
  ok(b1?.name === 'Borage' && b1.line === L('settler.bark.open'), `2. Borage: bark.open (${JSON.stringify(b1)})`)
  ok(await talkTo('feverfew'), '2. E at Feverfew')
  const f1 = await bubble(); await readTalk()
  ok(f1?.name === 'Feverfew' && f1.line === L('settler.bark.tired'), `2. Feverfew: bark.tired (${JSON.stringify(f1)})`)

  // ── 3 · the big one, down (node-check's kill: the sim is slow on swiftshader, so the bars are dropped to 1 hp and a real round lands) ──
  const n = (await p.evaluate(() => (window as any).__ather.nodes()) as { id: string; x: number; z: number }[]).find(x => x.id === t1?.m70node)
  ok(!!n, `3. the picked node is infected and on the map (${JSON.stringify(n)}; ${n ? Math.round(Math.hypot(n.x - SETTLEMENT.x, n.z - SETTLEMENT.z)) : '?'} m from the settlement)`)
  if (n) {
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 18, 0), n.x, n.z)
    ok(await poll(() => p.evaluate(() => !!(window as any).__ather.combat().champ), 60000), '3. its champion wakes')
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
  }
  ok(await poll(async () => (await tut())?.m70 === 'down', 15000), `3. Lamps Out: down (${(await tut())?.m70})`)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), SETTLEMENT.x + 3, SETTLEMENT.z + 3); await sleep(4000)
  ok(await poll(async () => (await settlement())?.lit === true, 15000), '3. the lamps are LIT')
  ok(await talkTo('borage'), '3. E at Borage')
  const b2 = await bubble(); await readTalk()
  ok(b2?.line === L('settler.after.bark'), `3. Borage: after.bark (${JSON.stringify(b2)})`)
  
  // ── 4 · the thanks: potions + the pack, once ──
  const before = await Promise.all(M70_GIFT.map(g => countIn(g.id)))
  ok(await talkTo('chamomile'), '4. E at Chamomile')
  const th = await readTalk()
  ok(th.lines.join('|') === ['settler.thanks.1', 'settler.thanks.2', 'settler.thanks.3', 'settler.thanks.4', 'settler.thanks.5'].map(L).join('|'), `4. the thanks in order (${th.lines.join(' | ')})`)
  const after = await Promise.all(M70_GIFT.map(g => countIn(g.id)))
  ok(M70_GIFT.every((g, k) => after[k] - before[k] === g.n), `4. the gift landed: ${M70_GIFT.map((g, k) => `${g.id} +${after[k] - before[k]}/${g.n}`).join(', ')}`)
  ok((await tut())?.m70 === 'thanked', '4. Lamps Out: thanked')
  ok(await poll(() => journalHas(L('quest.m70.after')), 12000), `4. journal: "${L('quest.m70.after')}"`)

  // ── 6 · Angelica's offer -> Later ──
  const pickLabel = (label: string) => p.evaluate((l: string) => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim() === l); b?.click(); return !!b }, label)
  const side = () => p.evaluate(() => (window as any).__m70side?.() ?? null) as Promise<{ side: string; step: string | null } | null>
  ok(await talkTo('angelica'), '6. E at Angelica opens a talk (after the thanks)')
  const a1 = await bubble(); ok(a1?.name === 'Angelica' && a1.line === L('alchemist.offer.1'), `6. offer.1 (${JSON.stringify(a1)})`)
  await pickFirst(); await sleep(700)
  const a2 = await bubble(), o2 = await opts()
  ok(a2?.line === L('alchemist.offer.2'), `6. offer.2 (${a2?.line})`)
  ok(o2.join('|') === [L('alchemist.choice.yes'), L('alchemist.choice.no')].join('|'), `6. both choices: ${o2.join(' / ')}`)
  await p.screenshot({ path: `${out}/m70s3-1-offer-390.png` })
  ok(await pickLabel(L('alchemist.choice.no')), '6. picked Later.'); await sleep(700)
  const a3 = await bubble(); ok(a3?.line === L('alchemist.no'), `6. alchemist.no (${a3?.line})`)
  await readTalk()
  ok((await tut() as any)?.m70side === 'later', `6. side quest: later (${(await tut() as any)?.m70side})`)
  ok(!(await journalHas(L('quest.m70side.title'))), '6. no A Proper Batch in the journal after Later')

  // ── 7 · again -> Show me ──
  ok(await talkTo('angelica'), '7. E at Angelica again')
  const y1 = await bubble(); await pickFirst(); await sleep(700)
  const y2 = await bubble(); ok(y1?.line === L('alchemist.offer.1') && y2?.line === L('alchemist.offer.2'), '7. the offer again, in order')
  ok(await pickLabel(L('alchemist.choice.yes')), '7. picked Show me.'); await sleep(700)
  const y3 = await bubble(); ok(y3?.line === L('alchemist.yes'), `7. alchemist.yes (${y3?.line})`)
  await readTalk()
  ok(await poll(async () => (await side())?.side === 'open' && (await side())?.step === 'gather', 8000), `7. open, step gather (${JSON.stringify(await side())})`)
  ok(await poll(() => journalHas(L('quest.m70side.title')), 12000), '7. "A Proper Batch" in the journal')
  ok(await talkTo('angelica'), '7. E at Angelica while open')
  const bk = await bubble(); await readTalk()
  ok(bk?.line === L('alchemist.bark.open'), `7. bark.open (${bk?.line})`)

  // ── 8 · gather (shortcut: the makings into the bag) ──
  const GOT = BATCH_NEEDS.map(x => ({ id: x.id.startsWith('crop:') ? `${x.id}:C` : x.id, n: x.n }))
  await p.evaluate((k: string, add: { id: string; n: number }[]) => {
    const key = Object.keys(localStorage).find(x => x === k || x.endsWith(k)) ?? k, inv = JSON.parse(localStorage.getItem(key) ?? 'null')
    for (const a of add) { const i = inv.slots.findIndex((s: unknown) => s === null); inv.slots[i] = { id: a.id, n: a.n } }
    localStorage.setItem(key, JSON.stringify(inv))
  }, INV_KEY, GOT)
  await p.reload({ waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  ok(await poll(async () => (await A('zone')) === 'wilds', 120000), '8. reload: in the Wilds')
  await poll(async () => (await settlement())?.y != null, 60000)
  ok(await poll(async () => (await side())?.step === 'brew', 15000), `8. the makings in the bag: step brew (${JSON.stringify(await side())})`)

  // ── 9 · brew at Angelica's Desk ──
  const potBefore = await countIn('potion:health:C')
  const D = ANGELICA_DESK, px = D.x + Math.sin(D.yaw) * 2.2, pz = D.z + Math.cos(D.yaw) * 2.2
  let opened = false
  for (let k = 0; k < 3 && !opened; k++) {
    await p.evaluate((x, z, y) => { const g = (window as any).__ather; g.tp(x, z, y); g.look?.(y, -Math.atan2(0.9, 2.2)) }, px, pz, Math.atan2(px - D.x, pz - D.z)); await sleep(1500)
    await p.keyboard.press('KeyE'); await p.mouse.move(5, 5)
    opened = await poll(async () => !!(await p.$('[data-panel="angelica-desk"]')), 6000)
  }
  ok(opened, `9. E at Angelica's Desk opens it (near ${JSON.stringify(await A('near'))})`)
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-desk-need]')].every(e => e.getAttribute('data-desk-ok') === '1')), '9. the Desk shows every making held')
  await p.screenshot({ path: `${out}/m70s3-2-desk-390.png` })
  await p.evaluate(() => document.querySelector<HTMLButtonElement>('[data-desk-brew] button')?.click()); await sleep(1200)
  ok(await poll(async () => (await countIn('potion:health:C')) - potBefore === 2, 8000), `9. 2 Health Draughts poured (${(await countIn('potion:health:C')) - potBefore})`)
  const left = await Promise.all(GOT.map(g => countIn(g.id)))
  ok(left.every(n => n === 0), `9. the makings spent (${GOT.map((g, k) => g.id + ' ' + left[k])})`)
  ok(await poll(async () => (await side())?.side === 'brewed' && (await side())?.step === 'hand', 8000), `9. brewed, step hand (${JSON.stringify(await side())})`)
  await p.keyboard.press('Escape'); await sleep(500)
  await p.evaluate(() => (document.querySelector('[data-panel="angelica-desk"] button[aria-label="Close"]') as HTMLElement | null)?.click())

  // ── 10 · hand -> reward + the set once ──
  const setBefore = await Promise.all(ALC_SET_ITEMS.map(id => countIn(id)))
  const allPot = async () => (await countIn('potion:health:C')) + (await countIn('potion:health:D'))
  const potsB = await allPot()
  ok(await talkTo('angelica'), '10. E at Angelica')
  const h0 = await bubble(), ho = await opts()
  ok(h0?.line === L('alchemist.bark.open') && ho[0] === M70SIDE_TEXT.handLabel, `10. the hand-over answer (${ho.join(' / ')})`)
  const rew = await readTalk()
  const want = HAND_SCRIPT.map(L)
  ok([h0?.line, ...rew.lines.slice(1)].join('|') === want.join('|'), `10. reward lines in order (${rew.lines.join(' | ')})`)
  const setAfter = await Promise.all(ALC_SET_ITEMS.map(id => countIn(id)))
  ok(ALC_SET_ITEMS.every((_, k) => setAfter[k] - setBefore[k] === 1), `10. the alchemy set in the bag: ${ALC_SET_ITEMS.map((id, k) => id + ' +' + (setAfter[k] - setBefore[k])).join(', ')}`)
  ok(potsB - (await allPot()) === 1, '10. one bottle handed to Angelica')
  ok((await tut() as any)?.m70side === 'done' && (await tut())?.gifts.includes('m70set'), '10. side quest done, gift recorded')
  ok(await poll(() => journalHas(L('quest.m70side.done')), 12000), `10. journal: "${L('quest.m70side.done')}"`)
  await p.screenshot({ path: `${out}/m70s3-3-done-390.png` })

  // ── 11 · reload: no second set ──
  await p.reload({ waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  ok(await poll(async () => (await A('zone')) === 'wilds', 120000), '11. reload: in the Wilds')
  await poll(async () => (await settlement())?.y != null, 60000)
  await sleep(4000)
  const again = await talkTo('angelica')
  if (again) await readTalk()
  const setAgain = await Promise.all(ALC_SET_ITEMS.map(id => countIn(id)))
  ok(!again && ALC_SET_ITEMS.every((_, k) => setAgain[k] === setAfter[k]), `11. Angelica has nothing more, no second set (${setAgain})`)
  ok(errs.length === 0, `Z. page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
