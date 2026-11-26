// M187 the loader's real percent + the fruit rotation. Run: npx tsx src/app/shimmer/open/shared/load-progress.test.ts
import { LoadMeter, meteredFetch, hintFor, TILE_BYTES } from './load-progress'
import { LOAD_FRUIT, DEFAULT_FRUIT, pickFruit, fruitSrc } from './load-fruit'
import { ITEMS } from '../../sprites/items'
import { readFileSync, existsSync } from 'fs'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// 1. bytes, not time: the percent moves only with bytes and is the share of what was reserved
{ const m = new LoadMeter()
  ok(m.percent() === 0, 'empty meter is 0')
  m.reserve('g', 1000)
  ok(m.percent() === 0, 'reserved, nothing in: 0')
  m.begin('a', 400, 'g'); m.add('a', 200)
  ok(m.percent() === 20, `200 of 1000 = 20 (${m.percent()})`)
  m.add('a', 200); m.end('a')
  ok(m.percent() === 40, `the first file alone does not reach 100 (${m.percent()})`)
  m.begin('b', 600, 'g'); m.add('b', 300)
  ok(m.percent() === 70, `700 of 1000 = 70 (${m.percent()})`)
  m.add('b', 300)
  ok(m.percent() === 99, `all bytes in but the file not closed: 99 (${m.percent()})`)
  m.end('b')
  ok(m.percent() === 100, `all ended, budget spent: 100 (${m.percent()})`)
}
// 2. a release of what was not fetched only moves it forward; an over-hint file never pushes past its share
{ const m = new LoadMeter()
  m.reserve('g', 1000); m.begin('a', 100, 'g'); m.add('a', 5000)
  ok(m.percent() === 10, `a file larger than its hint sits at its share (${m.percent()})`)
  m.end('a'); const before = m.percent(); m.release('g')
  ok(before === 10 && m.percent() === 100, `release jumps forward (${before} -> ${m.percent()})`)
}
// 2b. budgetTo trims a reservation mid-load without starting a new one
{ const m = new LoadMeter()
  m.reserve('g', 1000); m.begin('a', 200, 'g'); m.add('a', 200); m.end('a')
  m.budgetTo('g', 200)
  ok(m.percent() === 50, `200 of 200 + 200 left = 50 (${m.percent()})`)
  m.budgetTo('g', 0); ok(m.percent() === 100, 'nothing left: 100')
}
// 3. never back: a job that grows on its headers (hint -> Content-Length) does not move the Dewbear back
{ const m = new LoadMeter()
  m.begin('a', 100); m.add('a', 50)
  ok(m.percent() === 50, `50 of 100 (${m.percent()})`)
  m.resize('a', 1000)
  ok(m.percent() === 50, `bigger real size: held at 50, not 5 (${m.percent()})`)
  m.add('a', 950); m.end('a')
  ok(m.percent() === 100, 'and it finishes')
}
// 4. a new load after an idle one starts from 0 again
{ const m = new LoadMeter()
  m.begin('a', 10); m.end('a'); ok(m.percent() === 100, 'first load done')
  m.reserve('h', 100); ok(m.percent() === 0, `next load starts at 0 (${m.percent()})`)
  m.begin('b', 50, 'h'); m.add('b', 50); m.end('b'); ok(m.percent() === 50, `and counts its own bytes (${m.percent()})`)
}
// 5. meteredFetch counts the streamed body and hands back the same bytes; Content-Length wins over the hint
async function fetchPart() { const m = new LoadMeter(); const body = new Uint8Array(3000).map((_, i) => i % 251)
  const g = globalThis as unknown as { fetch: typeof fetch }; const real = g.fetch
  let seen: number[] = []
  m.subscribe(() => seen.push(m.raw()))
  g.fetch = (async () => new Response(new ReadableStream({ start(c) { c.enqueue(body.slice(0, 1000)); c.enqueue(body.slice(1000)); c.close() } }), { headers: { 'content-length': '3000' } })) as typeof fetch
  m.reserve('w', hintFor('/open/wilds/w0_1.bin'))
  const r = await meteredFetch('/open/wilds/w0_1.bin', 'w', m)
  const back = new Uint8Array(await r.arrayBuffer())
  ok(back.length === 3000 && back.every((v, i) => v === body[i]), 'the same bytes come back')
  ok(seen.some(f => f > 0.2 && f < 0.5), `mid-body fraction seen (${seen.map(f => f.toFixed(2)).join(',')})`)
  ok(m.percent() === 100, `the real length replaced the hint and the rest was released by the draw (${m.percent()})`)
  g.fetch = (async () => new Response('nope', { status: 404 })) as typeof fetch
  const m2 = new LoadMeter(); const r2 = await meteredFetch('/x', undefined, m2)
  ok(r2.status === 404 && m2.idle(), 'a 404 ends its job')
  g.fetch = real
}
// 6. hints: what the pages reserve is what the files weigh
ok(hintFor('https://ather.games/open/continent.json?v=2') === 692973, 'host and query are ignored')
ok(TILE_BYTES === hintFor('/open/wilds/a.json') + hintFor('/open/wilds/a.bin') + hintFor('/open/wilds/a.biome'), 'a tile = its three files')
for (const f of ['continent.json', 'continent.bin.gz', 'wilds/tiles.json']) {
  const p = `public/open/${f}`; if (existsSync(p)) ok(Math.abs(readFileSync(p).length - hintFor('/open/' + f)) / hintFor('/open/' + f) < 0.25, `hint for ${f} within 25% of the file`)
}
// 7. the fruit: exactly the game's fruit items, a picture for each, rotating, Sunfruit when a pick fails
const gameFruit = ITEMS.filter(i => i.type === 'fruit').map(i => i.id).sort()
ok(JSON.stringify([...LOAD_FRUIT].sort()) === JSON.stringify(gameFruit), `loader fruit = the game's fruit items (${gameFruit})`)
ok(DEFAULT_FRUIT === 'sunfruit' && ITEMS.find(i => i.id === 'sunfruit')?.name === 'Sunfruit', 'Sunfruit is the default')
for (const f of LOAD_FRUIT) ok(existsSync(`public${fruitSrc(f)}`), `${f} has a picture`)
ok(existsSync('public/open/load/dewbear-run.webp'), 'the Dewbear flipbook is there')
{ let last: string | null = 'sunfruit'; const seen = new Set<string>()
  for (let i = 0; i < LOAD_FRUIT.length; i++) { const f = pickFruit(last); ok(f !== last, `rotation never repeats (${last} -> ${f})`); seen.add(f); last = f }
  ok(seen.size === LOAD_FRUIT.length, 'one turn shows every fruit')
  ok(pickFruit('banana') === 'sunfruit', 'unknown stored value -> Sunfruit')
  ok(pickFruit(null, () => NaN) === 'sunfruit', 'broken random -> Sunfruit')
  ok(new Set(Array.from({ length: 60 }, () => pickFruit(null))).size === LOAD_FRUIT.length, 'a first load can be any fruit')
}
fetchPart().then(() => {
console.log(`${pass} ok, ${fails.length} fail`); for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
})
