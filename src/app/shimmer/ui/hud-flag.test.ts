/**
 * The HUD-face flag: OFF unless a keeper asks, and never a guessed face.
 * Run: `npx tsx src/app/shimmer/ui/hud-flag.test.ts`
 *
 * ★ THE DIRECTION THAT MATTERS IS "OFF". The kit ships before Alex picks a face, so the failure worth
 * guarding is the shipped HUD changing under a keeper who asked for nothing — a typo'd or stale value
 * must read as null (the live HUD), never as the nearest face.
 */
import { parseHudFace, readHudFace, FACE_KEY, HUD_FACE_NAMES, hudSizeFor, HUD_COMPACT_BELOW, HUD_PHONE_BELOW } from './hud-flag'

let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const store = (v: string | null) => ({ getItem: (k: string) => (k === FACE_KEY ? v : null) })
const throwing = { getItem: () => { throw new Error('SecurityError: private window') } }

ok(HUD_FACE_NAMES.length === 2 && HUD_FACE_NAMES.every(f => parseHudFace(f) === f), 'both faces parse to themselves')
for (const bad of [null, undefined, '', 'Light', 'FULL', 'now', 'dark', ' light']) {
  ok(parseHudFace(bad as string | null | undefined) === null, `"${String(bad)}" is kit OFF, not a guessed face`)
}
ok(readHudFace('', store(null)) === null, 'no URL flag + nothing stored = the shipped HUD')
ok(readHudFace('?hud=full', store(null)) === 'full', 'the URL flag turns the kit on')
ok(readHudFace('', store('light')) === 'light', 'a stored face turns it on')
ok(readHudFace('?hud=full', store('light')) === 'full', 'URL beats storage, so a shared link shows what it names')
ok(readHudFace('?hud=nope', store('light')) === 'light', 'a junk URL value falls through to storage, not to a face')
ok(readHudFace('', throwing) === null, 'storage that THROWS (private window) is kit off, not a crash')
ok(readHudFace('', null) === null, 'no storage at all is kit off')

// ── sizes: the breakpoints are measured, so assert them from BOTH sides ─────────────────────────
ok(hudSizeFor(1440) === 'wide' && hudSizeFor(HUD_COMPACT_BELOW) === 'wide', 'a full desktop and exactly 1000px are wide')
ok(hudSizeFor(HUD_COMPACT_BELOW - 1) === 'compact' && hudSizeFor(842) === 'compact', "999px and Alex's 842px window are compact")
ok(hudSizeFor(HUD_PHONE_BELOW) === 'compact', 'exactly 600px is still compact')
ok(hudSizeFor(HUD_PHONE_BELOW - 1) === 'phone' && hudSizeFor(390) === 'phone', '599px and a 390px phone are phone')
// The wide row's parts (health 225 + bar ~490 + orb corner ~235 + gutters) must not fit below the line.
const WIDE_ROW = 225 + 490 + 235 + 3 * 16
ok(HUD_COMPACT_BELOW >= WIDE_ROW, `wide never collides: the line (${HUD_COMPACT_BELOW}) is at least the row it lays out (${WIDE_ROW})`)
ok(HUD_COMPACT_BELOW - WIDE_ROW < 40, 'and not far above it: compact does not take over screens the wide row fits')

console.log(fails ? `\nhud-flag: ${fails} FAILED` : '\nhud-flag: CLEAN')
process.exit(fails ? 1 : 0)
