// M108: the destination map's data (destination-map.ts) against canon's strings and the REAL continent. npx tsx this file.
import { readFileSync } from 'node:fs'
import { DESTINATIONS, landingZones, zoneHref, shipGateOpen, shipGateFlag, SHIP_GATE_OWNER_OVERRIDE } from './destination-map'

let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as { places: { id: string; name?: string | null; kind?: string; x: number; z: number }[] }

// canon § 7⅞, word for word, in order
ok(JSON.stringify(DESTINATIONS.map(d => d.label)) === JSON.stringify(['the Starforge', 'Athernyx', 'Hask (moon of Orrun): unidentified signal']), 'the three labels, word for word, in order')

// Athernyx: the unlocked pitstops (Rune Hold always; a visited city joins)
const fresh = landingZones('athernyx', meta.places, new Set())
ok(fresh.length === 1 && fresh[0].id === 'rune-hold' && fresh[0].name === 'Rune Hold', 'a fresh keeper lands only at Rune Hold')
ok(fresh[0].href === '/shimmer/open/continent?at=rune-hold', 'Rune Hold goes through ?at=')
const two = landingZones('athernyx', meta.places, new Set(['veradyn', 'nowhere']))
ok(two.map(z => z.id).sort().join() === 'rune-hold,veradyn', 'a visited city joins; an unknown id does not')
ok(two.every(z => Math.hypot(z.u - 0.5, z.v - 0.5) < 0.45), 'every zone sits inside the disc')
const all = landingZones('athernyx', meta.places, new Set(meta.places.map(p => p.id)))
ok(all.length === 4, `all pitstops = 4 (got ${all.length})`)
ok(new Set(all.map(z => `${z.u.toFixed(2)},${z.v.toFixed(2)}`)).size === all.length, 'no two zones on one spot')

// unbuilt worlds: one unnamed point that does nothing
for (const d of ['starforge', 'hask'] as const) {
  const z = landingZones(d, meta.places, new Set())
  ok(z.length === 1 && z[0].href === null && z[0].name === null, `${d}: one "not yet" zone, no name, no travel`)
}

// href keeps the page's other flags, replaces an old at
ok(zoneHref('veradyn', '?ship=gate&at=rune-hold') === '/shimmer/open/continent?ship=gate&at=veradyn', 'href keeps ?ship=gate, replaces at')

// the gate: flag AND owner; the owner override bypasses the (not yet built) repair
ok(shipGateFlag('?ship=gate') && !shipGateFlag('?ship=1') && !shipGateFlag(''), 'flag reads only ship=gate')
ok(SHIP_GATE_OWNER_OVERRIDE, 'the owner override is on while the shell is owner-only')
ok(shipGateOpen({ flag: true, owner: true, repaired: false }), 'owner + flag opens before the repair flag (override)')
ok(shipGateOpen({ flag: true, owner: true, repaired: true }), 'owner + flag + repair flag opens')
ok(!shipGateOpen({ flag: true, owner: false, repaired: true }), 'non-owner + flag: no gate, even repaired')
ok(!shipGateOpen({ flag: false, owner: true, repaired: false }), 'owner without flag: no gate')
ok(!shipGateOpen({ flag: false, owner: true, repaired: true }), 'repaired but no flag: still owner-only shell')

console.log(`destination-map: ${n - fails}/${n} pass`)
if (fails) process.exit(1)
