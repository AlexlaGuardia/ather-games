// Run: npx tsx src/app/shimmer/open/ather/wilds-sliced.test.ts
// M44 part 3: parseWildsSliced (the tile parse cut into frame-sized slices) must give the SAME tile as parseWilds, on real
// tiles with the full pipeline the game runs (relief + the season-1 path clearing + roads + the cloud-void carve): every
// height, the void mask, every tree and crystal, and heightAt/walkable at sampled spots. It must also really slice: with a
// tiny budget it yields many times.
import { readFileSync } from 'node:fs'
import { parseWilds, parseWildsSliced, walkableIn, type WildsMeta } from './wilds'
import { makeVoids, type IndexLike } from './wilds-voids'
import { withGlade, clearing, roadField, type Network } from './network'
import { makeWorld, zonesOf } from './wilds-world'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const idx = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8'))
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
const w = makeWorld(idx), clear = clearing(net), roads = roadField(net), voids = makeVoids(idx as IndexLike, net)
const names: string[] = ['first-wilds', ...(idx.tiles as { name: string }[]).map(t => t.name).filter(n => n !== 'first-wilds').slice(0, 2)]

async function main() {
for (const name of names) {
  const meta = JSON.parse(readFileSync(`public/open/wilds/${name}.json`, 'utf8')) as WildsMeta
  const dm = new Int16Array(readFileSync(`public/open/wilds/${name}.bin`).buffer.slice(0)), bio = new Uint8Array(readFileSync(`public/open/wilds/${name}.biome`))
  const args = [meta, dm, bio, zonesOf(w, name), clear, true, roads, voids] as const
  const A = parseWilds(...args)
  let ticks = 0; const MC = globalThis.MessageChannel
  // count the yields: wrap MessageChannel so each slice boundary is seen
  ;(globalThis as any).MessageChannel = class extends MC { constructor() { super(); ticks++ } }
  const B = await parseWildsSliced([...args], 0.5)
  ;(globalThis as any).MessageChannel = MC
  ok(ticks > 10, `${name}: sliced parse yielded only ${ticks} times at a 0.5 ms budget`)
  let dh = 0; for (let k = 0; k < A.h.length; k++) if (A.h[k] !== B.h[k]) dh++
  ok(dh === 0 && A.h.length === B.h.length, `${name}: ${dh} heights differ`)
  ok(JSON.stringify(Array.from(A.voided ?? [])) === JSON.stringify(Array.from(B.voided ?? [])), `${name}: void mask differs`)
  ok(JSON.stringify(A.trees) === JSON.stringify(B.trees), `${name}: trees differ (${A.trees.length} vs ${B.trees.length})`)
  ok(JSON.stringify(A.crystals) === JSON.stringify(B.crystals), `${name}: crystals differ`)
  let spots = 0, bad = 0
  for (let s = 0; s < 400; s++) {
    const x = ((s * 7919) % 990) - 495, z = ((s * 104729) % 990) - 495
    spots++; if (A.heightAt(x, z) !== B.heightAt(x, z) || walkableIn(A, x, z) !== walkableIn(B, x, z) || A.biomeAt(x, z) !== B.biomeAt(x, z)) bad++
  }
  ok(bad === 0, `${name}: ${bad}/${spots} spots differ in heightAt/walkable/biome`)
  console.log(`${name}: ${A.trees.length} trees, ${A.crystals.length} crystals, voided ${A.voided ? A.voided.reduce((a, b) => a + b, 0) : 0} cells, ${ticks} slices`)
}

}
main().then(done)
function done() {
console.log(`${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('FAIL', f); process.exit(1) }
}
