// ── THE CHANNEL'S HOST WIRING — a call-site guard ───────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/voxel3d/channel-wiring.test.ts
//
// `sustain.test.ts` and `breach.test.ts` prove the two pure cores. They cannot prove the thing that
// actually decides whether Meltbore works, because the cores are correct in a world where the host
// wires them wrongly — and every failure available here is silent. This file watches the four host
// decisions that no oracle over a pure function can see.
//
// ── ★★ WHY A TEXTUAL READER, WHEN THIS FILE'S OWN HOUSE NOTES CALL THEM A LYING INSTRUMENT ──────
// Because the alternative is worse and the failure mode is fixable. `VoxelWorld.tsx` is a 9,800-line
// React component that pulls in three.js, WebGL and the whole chunk streamer; there is no headless
// way to run its frame loop, so an "honest" runtime oracle would need a host that is not this host —
// which is the prebuilt-worker trap wearing a lab coat. So: read the source, and make the reader
// fail LOUD when it stops being able to see.
//
// ⚠⚠ THE RULE THAT MAKES IT SURVIVABLE: every pattern must match EXACTLY ONCE. A pattern matching
// zero times means the code moved and this file went BLIND — which must never share an exit code
// with "I looked and found no drift". A pattern matching twice means something was duplicated or a
// comment now quotes the marker, which is how a guard eats itself (the house has done exactly that:
// a header quoting its own declaration handed every reader a second match).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let ok = 0, bad = 0, blind = 0
const chk = (name: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ok   ${name}`) }
  else { bad++; console.log(`  FAIL: ${name} ${extra}`) }
}

const HOST = join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx')
const src = readFileSync(HOST, 'utf8')

/**
 * Assert a pattern appears exactly once, and count a miss as BLIND rather than as a pass or a
 * failure of the thing being described. ★ The severity is the whole design: "I could not look" and
 * "I looked and it is fine" must not be the same answer.
 */
const once = (label: string, re: RegExp): boolean => {
  const n = (src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length
  if (n === 1) return true
  blind++
  console.log(`  BLIND: ${label} — matched ${n} times, expected exactly 1 (the code moved, or a comment now quotes it)`)
  return false
}

console.log('\n── 1. the channel reaches the host at all ──')
chk('the host imports the channel core', once('sustain import', /^import \{ beginSustain, sustainStep, sustainCooldownUntil.*from '\.\.\/play3d\/sustain'$/m))
chk('the host imports the bore core', once('breach import', /^import \{ boreStep, freshBore.*from '\.\.\/play3d\/breach'$/m))
chk("this world DECLARES it can run a channel — `supports` is the honesty rule, not a formality",
  /new Set<CastArchetype>\(\[[^\]]*'channel'/.test(src))

console.log('\n── 2. ★★ RULE 1 — the bore is paid in CREDITED seconds, never in dt ──')
// The single most expensive available mistake, and it is one character-range wide. `dt` is wall
// time; `credited` is the time the keeper's mana actually covered. Pass `dt` and a keeper with an
// empty pool bores exactly as fast as a full one — free, and the mana bar looks right the whole way
// down because it is already at zero. No pure oracle can see this: `boreStep` is correct either way.
chk('★★ boreStep is fed `step.credited`', once('boreStep call', /boreStep\(bore\.current, target, hit \? hit\.material : 0, step\.credited\)/))
chk('★★ ...and NOT `dt` — an empty pool must bore nothing', !/boreStep\([^)]*,\s*dt\s*\)/.test(src))

console.log('\n── 3. ★★ RULE 3 — the cooldown starts on RELEASE ──')
// Start it at the press and a ten-second hold recovers as fast as a tap, which makes holding
// strictly better than tapping for free, with nothing on screen to say so.
chk('★★ the host starts the cooldown from the release instant',
  once('release cooldown', /castCd\.current\[cslot\] = sustainCooldownUntil\(performance\.now\(\), spec\.cooldownMs\)/))
{
  // The open branch must not touch the cooldown array at all. Read the branch itself rather than
  // the whole file, so an unrelated cooldown elsewhere cannot make this pass or fail.
  const i = src.indexOf("if (out.spec.archetype === 'channel') {")
  const branch = i >= 0 ? src.slice(i, i + 900) : ''
  if (!branch) { blind++; console.log('  BLIND: could not find the channel-open branch') }
  chk('★★ ...and the PRESS sets no cooldown', !!branch && !/castCd\.current\[/.test(branch))
}

console.log('\n── 4. the bore yields nothing, which is what lets it ignore every tool gate ──')
{
  // A bore that dropped what mining drops would BE mining — a strictly better pick needing no tool,
  // no family and no tier — and the whole progression under `registry.ts` would evaporate.
  const i = src.indexOf("if (bs.state === 'broke' && target) {")
  const branch = i >= 0 ? src.slice(i, i + 900) : ''
  if (!branch) { blind++; console.log('  BLIND: could not find the bore-broke branch') }
  chk('the broken spot spawns no drop', !!branch && !/spawnDrop|dropsFor/.test(branch))
  chk('the broken spot awards no XP', !!branch && !/addSkillXP/.test(branch))
  chk('...and the voxel is actually removed — the spot stops existing',
    !!branch && /setVoxel\(target\.x, target\.y, target\.z, AIR\)/.test(branch))
}

console.log('\n── 5. the hold is read from the KEY, not from the press latch ──')
// `pendingCast` is an edge consumed at the top of the frame loop: asking it here answers "was it
// pressed THIS frame", which is false on every frame of a hold. The channel would close instantly
// and read as a cast that does nothing.
chk('the held state comes from the key map', once('held read', /const stillDown = !!keys\.current\[CAST_CODES\[cslot\]\]/))
chk('...and not from the press latch', !/stillDown\s*=\s*[^\n]*pendingCast/.test(src))

console.log(`\nchannel-wiring oracle: ${ok} passed, ${bad} failed, ${blind} blind`)
// ⚠ BLIND COUNTS AS DRIFT. A reader that cannot see its subject reports "nothing wrong" unless the
// exit code says otherwise — that is the whole reason this file exists in this shape.
process.exit(bad || blind ? 1 : 0)
