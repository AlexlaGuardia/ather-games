/**
 * A DEV PAGE THAT CANNOT GET DOWN TO A KEEPER'S EYE IS AN INSTRUMENT THAT CANNOT SEE ITS SUBJECT.
 *
 * ★★★ WHY THIS EXISTS (2026-08-30, sprites lane). `dev/hold`'s camera height was
 * `target.y + 10 + dist * 0.45` — a function of the DISTANCE — so the page had no vantage below
 * about sixteen blocks and its default sat 32 blocks up. Every judgement of that hold was made from
 * up there, and from up there nobody could see that **91 of 91 audience figures were standing 0.975
 * blocks UNDER their bank**. The camera defect hid the placement defect. They were one blind spot,
 * and the only reason it was ever found is that somebody went looking for a human-height view.
 *
 * ⚠⚠ AND FIXING FOUR PAGES BY HAND WOULD NOT HAVE FIXED THE NEXT ONE. PATTERNS 2026-08-22: an
 * exemption is a silent promise that someone is watching that corner, and a hand-kept list is the
 * thing still sitting there a month after its reason expired. So this **enumerates the dev pages
 * off the filesystem**: a new page with a `<Canvas>` joins this guard by EXISTING, not by anyone
 * remembering to add it here.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────────────────────────
 * A dev page that renders a 3D scene must either (a) be able to put its camera at a keeper's eye,
 * with the height DERIVED from `EYE_STAND` (or `BODIES.*.eyeStand`, which `metrics.test.ts` pins to
 * it), or (b) be exempt — and an exemption here must ASSERT THE PREMISE THAT JUSTIFIES IT, so the
 * day the premise dies the guard goes red instead of shrugging.
 *
 * ⚠ A RE-TYPED LITERAL IS NOT A DERIVATION. `dev/ring` had `GY + 1.62` and `dev/seam` had
 * `anchor.y + 1.7` under a comment calling it eye height — 1.7 is not a keeper's eye at all, so the
 * seam had been judged from 8cm above one. Both were true when written and both are claims that
 * only stay true until the walker's eye moves.
 *
 * Run: `npx tsx src/app/shimmer/dev/dev-eye.test.ts` (repo convention — there is no vitest).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

const DEV = join(process.cwd(), 'src/app/shimmer/dev')

/**
 * Pages whose camera is NOT a vantage on a place, with the premise that makes that true. Each
 * premise is asserted below — this is a list of reasons, not a list of names.
 */
const EXEMPT: Record<string, { why: string; premise: (src: string) => boolean }> = {
  // ★★ THE INSTRUMENT IS NAILED TO THE FRAME. `Readout` samples fixed normalized coordinates —
  // (0.5, 0.46) is "the stalker's body", (0.5, 0.88) is "bare ground" — and prints their luma
  // ratio. Those points mean the body and the ground ONLY for the fixed camera this page ships.
  // Move the camera and the body sample lands on sky, and the page reports a confidently wrong
  // contrast number: its own comment says that is "worse than none". So an eye mode here would
  // break the measurement the page exists to take.
  // ⚠ THE DAY THE READOUT LEARNS WHERE THE BODY IS, THIS EXEMPTION EXPIRES AND SHOULD.
  grey: {
    why: 'the luma readout samples fixed frame coordinates, so moving the camera falsifies it',
    premise: s => /read\(0\.5, 0\.46\)/.test(s) && /read\(0\.5, 0\.88\)/.test(s),
  },
  // A bench for particle motion, not a place anybody stands in. The premise is that it has no
  // human-scale reference at all — the moment somebody puts a keeper next to the chips to judge
  // how big a break reads, scale becomes the question and this exemption is wrong.
  break: {
    why: 'a VFX bench: the question is how a chip moves, not how big it is next to a keeper',
    premise: s => !/BODY_H|EYE_STAND|Keeper/.test(s),
  },
}

/** Every dev page that puts a 3D scene on the screen. Discovered, never listed. */
const pages = readdirSync(DEV, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(n => existsSync(join(DEV, n, 'page.tsx')))
  .map(n => ({ name: n, src: readFileSync(join(DEV, n, 'page.tsx'), 'utf8') }))
  .filter(p => p.src.includes('<Canvas'))
  .sort((a, b) => a.name.localeCompare(b.name))

// ⚠ AN EMPTY SET PASSES EVERY LOOP BELOW. PATTERNS 2026-08-22: an empty measurement window can only
// ever return one answer. If the discovery ever stops finding pages, that is a broken guard, not a
// clean tree — so say so loudly rather than exit 0 on nothing.
ok(pages.length >= 6, `discovery found ${pages.length} pages with a Canvas (expected at least 6)`)

for (const { name, src } of pages) {
  const ex = EXEMPT[name]
  if (ex) {
    ok(ex.premise(src), `${name}: EXEMPT because ${ex.why} — and that premise still holds`)
    continue
  }
  // The derivation, in either shape: the constant itself, or a metrics body that is pinned to it.
  ok(/EYE_STAND|eyeStand/.test(src), `${name}: reaches a keeper's eye from the shipped constant`)
  // ⚠ Matched only where a number is being used AS a height, so an unrelated 1.62 in a colour or a
  // ratio does not read as a defect. Both retired literals are named because both really shipped.
  ok(!/[+\-]\s*1\.62\b/.test(src), `${name}: does not re-type EYE_STAND as 1.62`)
  ok(!/\.y \+ 1\.7\b/.test(src), `${name}: does not use 1.7 as an eye height (it is not one)`)
}

// ── THE PREMISE UNDER `eyeStand` ─────────────────────────────────────────────────────────────
// `runehold` derives from `BODIES.voxel.eyeStand` rather than from `EYE_STAND`, which is a real
// derivation ONLY because another suite pins the two together. Assert that pin exists, or this
// file is quietly accepting a second, unmoored copy of the number.
const metrics = readFileSync(join(process.cwd(), 'src/app/shimmer/play3d/metrics.test.ts'), 'utf8')
ok(/LOCO\.EYE_STAND === BODIES\.voxel\.eyeStand/.test(metrics),
  'metrics.test.ts still pins BODIES.voxel.eyeStand to locomotion EYE_STAND')

console.log(`   ${pages.length} dev pages with a scene · ${Object.keys(EXEMPT).length} exempt with a live premise`)
console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
