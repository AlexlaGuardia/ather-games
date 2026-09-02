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
import { noComments, blockAt } from '../testing/guard'

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

console.log('\n── 6. ★★★ THE PROGRESS REACHES A CONSUMER (added 2026-09-02) ──')
// `boreStep` has returned `progress` since the move shipped, and until today NOTHING read it. So
// the only held move in the game ran with no readout: holding the key against a rock and holding it
// against nothing were the same picture, and the single line it did print arrived when the block was
// already gone. The value was never missing — it was computed, and dropped, ~760 lines above the
// only code in this file that draws a bar.
//
// ⚠⚠ ELEVEN ASSERTS OVER `breach.ts` AND FIVE MUTATIONS COULD NOT SEE IT, and that is the point of
// this whole file: `boreStep` is correct whether or not a host reads what it returns. A pure core
// with no consumer is a feature that exists everywhere except on screen.
//
// ★ READ THROUGH `noComments`, NOT RAW. The host now explains this wiring in prose, and one of those
// comments quotes the render's "spike too weak" sentence in order to say why a bore must never be
// marked refused. Read raw, that explanation would satisfy — or duplicate — the very asserts below.
// Strings stay INTACT (`noComments`, not `codeOnly`) because two asserts here are about literals.
const nc = noComments(src)

// ── the channel block publishes what it computed ────────────────────────────────────────────
const pub = blockAt(nc, "bs.state === 'boring'", ': null')
if (pub.at < 0) { blind++; console.log('  BLIND: could not find the bore readout publish') }
chk('★★ the bore publishes the progress it computed, not a recomputation',
  pub.at >= 0 && /progress: bs\.progress/.test(pub.raw))
chk("★★ ...and pins `absolute` at 0 — `breach.ts` says a bar filling toward something unreachable is worse than no bar",
  pub.at >= 0 && /'absolute'\s*\?\s*\{\s*progress:\s*0/.test(pub.raw))

// ★★ AND IT MUST LIVE INSIDE THE CHANNEL BLOCK. Drifting into a scope of its own would publish a
// readout for a channel nobody is holding — the original defect wearing the fix's name, which is
// exactly how `/ctxlost` nearly shipped its trigger onto a canvas with no listeners.
const chanAt = nc.indexOf('if (channel.current && channelSpec.current) {')
const mineAt = nc.indexOf('if (hit && mouse.current.left && !weaponDrawn) {')
if (chanAt < 0 || mineAt < 0) { blind++; console.log('  BLIND: could not locate the channel/mine block boundary') }
chk('★★ the publish sits inside the channel block, not in a scope of its own',
  pub.at > 0 && chanAt >= 0 && mineAt > chanAt && pub.at > chanAt && pub.at < mineAt)

// ── the HUD consumes it, and consumes it AFTER it is written ────────────────────────────────
const readAt = nc.indexOf('const bl = boreLook.current')
chk('★★ the HUD reads the bore readout at all — this is the assert the feature did not have',
  readAt >= 0)
// ★★★ ORDER IS THE FEATURE. Both live in one frame callback; move the HUD block above the channel
// block and every bar is one frame stale, which on a fast bore is the difference between a readout
// and a flicker. An index compare is the only thing that can see this — no runtime oracle can.
chk('★★★ ...and reads it AFTER the channel wrote it, in one frame',
  readAt > 0 && pub.at > 0 && readAt > pub.at)

const feed = blockAt(nc, 'onLook(hit && def', '      : null)')
if (feed.at < 0) { blind++; console.log('  BLIND: could not find the HUD onLook construction') }
chk('★★ the bore drives the progress the reticle draws',
  feed.at >= 0 && /progress: bl \? bl\.progress/.test(feed.raw))
chk('★★ ...and names the block it is boring, so the line is not silent',
  feed.at >= 0 && /name: bl/.test(feed.raw))

// ── ★★★ THE ONE THAT SHIPS A LIE IF IT GOES ──────────────────────────────────────────────────
// The render appends "— spike too weak" to any line flagged `refused`. That is a sentence about a
// TOOL, and the bore's defining canon property (`moves.md:82`, "nothing refuses it forever") is that
// it has none — `breach.ts` opens on exactly this distinction. An absolute block LOOKS like a
// refusal, so the tempting reading is `refused: true`, and it would print a false explanation of a
// true refusal in red over the one move whose whole point is that tools cannot tell it no.
chk('★★★ a bore is never flagged `refused` — that word ships a sentence about a tool the bore has not got',
  feed.at >= 0 && /refused: !bl &&/.test(feed.raw))

// ── the render can tell the two mechanics apart, and the readout is cleared ──────────────────
// A swing banks its progress; a channel loses it the moment the reticle moves. Same bar shape so
// the eye reads it instantly, different hue so it is not one claim.
chk('the bar asks which mechanic it belongs to', /look\.channel \? '/.test(nc))
chk('the look payload carries `channel` at all three declarations',
  (nc.match(/refused: boolean; channel: boolean/g) || []).length === 3)
chk('★★ the readout is cleared when the channel closes — or the bar freezes on screen after release',
  /channelSpec\.current = null\s*\n\s*bore\.current = freshBore\(\)\s*\n\s*boreToldAbsolute\.current = null\s*\n\s*boreLook\.current = null/.test(nc))


console.log(`\nchannel-wiring oracle: ${ok} passed, ${bad} failed, ${blind} blind`)
// ⚠ BLIND COUNTS AS DRIFT. A reader that cannot see its subject reports "nothing wrong" unless the
// exit code says otherwise — that is the whole reason this file exists in this shape.
process.exit(bad || blind ? 1 : 0)
