/**
 * The owner's Moves (dev) pins: any built move into Z / C, owner-only, never a dead key (2026-09-28).
 * Run: `npx tsx src/app/shimmer/play3d/owner-bench.test.ts`
 */
import { readFileSync } from 'node:fs'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const p3 = readFileSync('src/app/shimmer/play3d/Shimmer3D.tsx', 'utf8')
ok(p3.includes('const pins = isOwnerRef.current ? readDevSlots() : []'), '★ a player never reads the pins, even if the key is set by hand')
ok(p3.includes('castLoadoutRef.current = res.slots.map((id, i) => pins[i] ?? id)'), 'a pin wins its slot; an unpinned slot keeps the real resolve')
ok(p3.includes("typeof id === 'string' && isBuilt(id) ? id : null"), '★ a pin to a move that no longer runs is dropped, not cast into a dead key')
ok(p3.includes('useEffect(() => { if (isOwner) applyLoadoutRef.current() }, [isOwner])'), 'saved pins go live once the owner check lands')
ok(/dev=\{[\s\S]*Moves \(dev\)[\s\S]*Build structures/.test(p3), 'the panel lives in the owner-only dev tab')
console.log(`owner-bench: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
