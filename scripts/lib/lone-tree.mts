// A WILDS TREE A CHECK CAN WALK UP TO FROM THE EAST, from the GAME'S parse (roads, path clearing, cloud voids), not a bare one.
// M133 (11-24): channel-check + forestry-check stood 6 m east of first-wilds:266 on a bare parse; the cloud voids (v2, 31ff95f6)
// had opened a pit 3 m east of it, so the keeper fell and was set down elsewhere, and the aim read null. Here the walk east of
// the tree (out to `east` m) is solid, near level ground, no void, no trunk in the line.
import { readFileSync } from 'fs'
import { parseWilds, walkableIn, type WildsMeta, type Tree } from '../../src/app/shimmer/open/ather/wilds'
import { clearing, roadField, withGlade, type Network } from '../../src/app/shimmer/open/ather/network'
import { makeVoids } from '../../src/app/shimmer/open/ather/wilds-voids'
import type { Zone } from '../../src/app/shimmer/open/ather/forestry'
const D = 'public/open/wilds/'
const idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')), net = withGlade(JSON.parse(readFileSync(D + 'network-s1.json', 'utf8')) as Network), V = makeVoids(idx, net)
const zm = new Map<string, Zone>(idx.tiles.find((t: { name: string }) => t.name === 'first-wilds').nodes.map((n: { i: number; j: number; zone: Zone }) => [`${n.i},${n.j}`, n.zone]))
const b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
export const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => zm.get(`${i},${j}`) ?? 'meadows', clearing(net), true, roadField(net), V)
// no trunk within 3 m of it, none within 15 m east and 3 m either side (so the crosshair from the east meets it first)
const alone = (t: Tree) => !W.trees.some(o => o !== t && (Math.hypot(o.x - t.x, o.z - t.z) < 3 || (o.x > t.x && o.x < t.x + 15 && Math.abs(o.z - t.z) < 3)))
const solid = (t: Tree, east: number) => { for (let d = -2; d <= east; d++) for (const s of [-2, 0, 2]) { if (V.weight(t.x + d, t.z + s) > 0) return false; const h = W.heightAt(t.x + d, t.z + s); if ((Math.abs(d) >= 4 && !walkableIn(W, t.x + d, t.z + s)) || Math.abs(h - W.heightAt(t.x, t.z)) > 0.3 + Math.abs(d) * 0.15) return false } return true }
export const loneTree = (kind: Tree['kind'], east = 24): Tree => W.trees.find(t => t.kind === kind && Math.abs(t.x) < 400 && Math.abs(t.z) < 400 && alone(t) && solid(t, east))!
/** The same for a crystal: level, no void, no trunk within 8 m. */
export const loneRaw = () => W.crystals.find(c => c.kind === 'raw' as typeof c.kind && Math.abs(c.x) < 450 && Math.abs(c.z) < 450 && !W.trees.some(o => Math.hypot(o.x - c.x, o.z - c.z) < 8) && !W.crystals.some(o => o !== c && Math.hypot(o.x - c.x, o.z - c.z) < 8) && [0, 1, 2, 3, 4, 5, 6].every(d => V.weight(c.x + d, c.z) <= 0 && Math.abs(W.heightAt(c.x + d, c.z) - c.y) < 1))!
export { V }
