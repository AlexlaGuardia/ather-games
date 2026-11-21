// ground-layers.ts. Run: npx tsx src/app/shimmer/open/shared/ground-layers.test.ts
import { GROUND_LAYER as L, GROUND_OFFSET, groundLayersOn, groundOrder, groundMat } from './ground-layers'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
ok(L.lane < L.road && L.road < L.junction && L.junction < L.kerb && L.kerb < L.island && L.island < L.mark && L.mark < L.shadow, 'Nyx order: lane < road < junction < kerb < island < mark < shadow')
ok(L.path < L.green && L.green < L.mark, 'Ather order: path < green < mark')
ok(Object.values(L).every(v => v > 0), 'every layer draws after the ground (renderOrder 0)')
ok(groundLayersOn('?ground=layers') && !groundLayersOn('?ground=legacy') && !groundLayersOn(''), 'opt-in: ?ground=layers on, legacy/none off (until Alex signs off)')
ok(groundOrder('road', true) === L.road && groundOrder('road', false) === 0, 'renderOrder only with the table on')
const on = groundMat('junction', { factor: -3, units: -3 }, true), off = groundMat('junction', { factor: -3, units: -3 }, false)
ok(on.depthWrite === false && on.polygonOffsetFactor === GROUND_OFFSET.factor && on.polygonOffsetUnits === GROUND_OFFSET.units, 'on: one offset for all, no depth write (overlays never fight each other)')
ok(off.polygonOffsetFactor === -3 && off.polygonOffsetUnits === -3 && !('depthWrite' in off), 'off: the old per-file offset, untouched')
ok(Object.keys(groundMat('green', undefined, false)).length === 0, 'off with no legacy offset: plain material, as before')
console.log(`ground-layers: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
