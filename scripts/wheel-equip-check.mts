// The wheel browses, the wheel CLICK equips (Alex 11-16). On the live Ather page, with real input:
//   roll → still stowed · wheel click → the lit item in hand · R tap → the gun · roll + click → the item (gun gives way) · R hold → stowed
//   npx tsx scripts/wheel-equip-check.mts [origin]
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 1280, height: 760 })
// ★ 11-18 (051b0c3d): weapons are equipment; a fresh keeper owns NO gun until Kael's chest (shipyard-check proves the chest).
// Seed what loadout.claimKaelsArms() hands over.
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['charred-rifle', 'repeater'], primary: 'charred-rifle', secondary: 'repeater', kael: true, vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' })) })
await p.goto(`${origin}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(5000)
const st = () => p.evaluate(() => JSON.stringify((window as any).__ather.stance()))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
await p.mouse.click(640, 380); await sleep(800)
ok(await p.evaluate(() => !!document.pointerLockElement), 'click locks the pointer')
ok((await st()).includes('stowed'), `starts stowed (${await st()})`)
await p.mouse.wheel({ deltaY: 120 }); await sleep(400)
ok((await st()).includes('stowed'), `a roll equips nothing (${await st()})`)
await p.mouse.down({ button: 'middle' }); await p.mouse.up({ button: 'middle' }); await sleep(500)
ok((await st()).includes('"item"'), `wheel click holds the lit item (${await st()})`)
await p.keyboard.press('KeyR'); await sleep(500)
ok((await st()).includes('weapon'), `R tap draws the gun (${await st()})`)
await p.mouse.wheel({ deltaY: 120 }); await sleep(300)
ok((await st()).includes('weapon'), `a roll leaves the gun in hand (${await st()})`)
await p.mouse.down({ button: 'middle' }); await p.mouse.up({ button: 'middle' }); await sleep(500)
const after = await st()
ok(!after.includes('weapon'), `wheel click puts the gun away for the lit slot (${after})`)
await p.keyboard.down('KeyR'); await sleep(600); await p.keyboard.up('KeyR'); await sleep(400)
ok((await st()).includes('stowed'), `R hold stows (${await st()})`)
await b.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
