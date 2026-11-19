// ── Prod check for the stance (2026-11-15, world; Alex: "R pulls out the primary, tap again to swap, hold to stow ...
// while stowed the scroll wheel or num pad selects a hot bar item"). Real key presses, read back through __ather.stance().
//   npx tsx scripts/stance-check.mts
import puppeteer from 'puppeteer-core'
const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'https://ather.games'
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1000, height: 640 })
// ★ 11-18 (051b0c3d): weapons are equipment and a fresh keeper owns NONE until Kael's chest at the shipyard. R on an empty
// loadout correctly stays stowed, so seed exactly what loadout.claimKaelsArms() hands over (shipyard-check proves the chest).
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.inv.v1')
  localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['charred-rifle', 'repeater'], primary: 'charred-rifle', secondary: 'repeater', kael: true,
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' })) })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.stance, { timeout: 120000 }); await sleep(2000)
const st = () => p.evaluate(() => JSON.stringify((window as any).__ather.stance()))
const res: Record<string, string> = {}
res.boot = await st()
await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(300); res.tap1 = await st()      // draws
await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(300); res.tap2 = await st()      // two guns now (rifle + Repeater): swaps, stays drawn
await p.keyboard.press('Digit2'); await sleep(300); res.digitWhileDrawn = await st()                                       // ignored while a weapon is out
// HOLD until the stance stows (11-19): the stow is a 350 ms setTimeout and at 1-2 fps it fires late, so a fixed 600 ms hold read as a TAP
const holdUntilStowed = async () => { await p.keyboard.down('KeyR'); for (let t = 0; t < 5000 && JSON.parse(await st()).kind !== 'stowed'; t += 200) await sleep(200) }
await holdUntilStowed(); res.holding = await st(); await p.keyboard.up('KeyR'); await sleep(300); res.held = await st()   // hold stows
await p.keyboard.press('Digit2'); await sleep(300); res.digitStowed = await st()                                          // picks the waymark
await holdUntilStowed(); await p.keyboard.up('KeyR'); await sleep(300); res.stowItem = await st()   // hold stows the item
res.speed = String(await p.evaluate(() => (window as any).__ather.speedMult()))
console.log(JSON.stringify(res))
const J = (k: string) => JSON.parse(res[k])
const pass = J('boot').kind === 'stowed' && J('tap1').kind === 'weapon' && J('tap2').kind === 'weapon' && J('digitWhileDrawn').kind === 'weapon'
  && J('holding').kind === 'stowed' && J('held').kind === 'stowed' && J('digitStowed').kind === 'item' && J('digitStowed').slot === 1 && J('stowItem').kind === 'stowed' && Number(res.speed) > 1
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
