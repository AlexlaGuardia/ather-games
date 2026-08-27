// The MIST PATCHES, rendered — the lying mist, and the presence standing in it.
//
// ★ ONE geometry and ONE material per layer, all constructed inside this factory (render-audit's
// rule). The per-frame CPU work is aging a Float32Array and occasionally respawning a particle; the
// drift, growth and fade live in the shader, so the tick allocates nothing.
//
// ★ WHERE the mist lies is asked of the generator (`mistAt`), never stored here — the same contract
// that keeps the Springs' steam welded to its pools. Retune the patches and this follows for free.
//
// ★ MIST LIES; STEAM RISES. This started as a copy of steam.ts and almost shipped as one, which
// would have been a gold-tinted hot spring rather than mist. Every number that matters is inverted:
// a puff of steam is born tight, climbs 1.9 blocks and loosens (a plume); mist is born WIDE, barely
// climbs at all, and drifts sideways for eight seconds (a layer). Steam's particles are sparse and
// bright over a small hot surface; mist's are many, large and faint, because a fog layer is made of
// overlap — twenty soft sprites at 0.13 alpha read as depth, four at 0.6 read as four sprites.
//
// ⚠ THE RESIDENT CLAIMS NO SPECIES *VISUALLY*, AND THE REASON CHANGED ON 2026-08-09 — READ THIS
// BEFORE "UNBLOCKING" IT. The roster was RULED that day (`CANON/game/shimmer-geography.md` › *The
// rosters — ruled*) and the build followed the same day: `mist-roster.ts` knows exactly which of the
// ten species stands in this patch, `mist-encounter.ts` resolves it, and the spar prompt NAMES it
// before you commit (`VoxelWorld.tsx` › `A ${spar.name} answers the mist`). So the species is not
// unknown and is not hidden — it is spoken, and only the SILHOUETTE is generic.
//
// ★ WHAT REMAINS IS AN ART DECISION, NOT A CANON ONE — and it is ALEX'S, the same rule `greg.ts`
// states for Gregory's stacked-box placeholder and `piece-mesh.ts` for the building pieces. A
// per-species 3D form for a Shimmer spirit is character art; this file should not invent one. The
// lathe silhouette + element-tinted rim is a deliberate placeholder that reads as "someone is
// standing in there", not a canon hedge. When the forms exist, swapping them touches this file only.
//
// ⚠⚠ THIS COMMENT SAID "[OPEN] in CANON_GAPS — Magii's to rule" UNTIL 2026-08-26, seventeen days
// after it was ruled, and it read as a CANON block on a feature that was actually waiting on art.
// Those are different queues with different owners, and mislabelling one as the other parks work on
// a seat that was never asked. ★ Say WHICH queue a thing waits in, and name the owner.
//
// ★ THE PRESENCE IS VISIBLE FROM OUTSIDE, AND THAT IS THE WHOLE CONSENT DESIGN. A 2D tall-grass
// encounter rolls dice on your footsteps; ported to first person that becomes an ambush you cannot
// see coming, in a game whose mist patch you are meant to CHOOSE to enter. So the resident is drawn
// at a distance, through the mist, before you commit — you approach a spar, you do not trip over
// one.

import * as THREE from 'three'
import { columnHeight } from '../voxel/height'
import { mistAt, mistPatchesNear, DEFAULT_MIST, type MistPatch } from '../voxel/mist'
import { zoneAt } from '../voxel/zones'
import { residentAt, type MistLedger, type Resident, type ResidentForm } from './mist-encounter'
import { createCreatureBody, type CreatureBody } from './creature-billboard'
import { createPortraitBody, hasPortrait } from './spirit-portrait-body'
import { speciesArt } from '../sprites/registry'
import { bodyBox, rayBox } from './aim'
import { ELEMENT_COLORS } from '../spirits/spirit'

/** Many, large and faint — a layer is made of overlap. See the header. */
const COUNT = 220
/** How far out patches are looked for. Comfortably past the fog so a presence fades in, never pops. */
const REACH = 150
/** Blocks a particle climbs over its whole life. Mist does not rise; it barely stirs. */
const RISE = 0.3
/** Seconds a puff lives. Long, because mist moves like weather rather than like heat. */
const LIFE_MIN = 6, LIFE_VAR = 4
/** Pool-sampling attempts per respawn — bounds the worst frame when a patch edge is sparse. */
const TRIES = 8
/** Height above the ground line the layer sits at, plus the jitter that gives it a body. */
const LIE = 0.45, LIE_VAR = 1.5
/** How often the nearby-patch list is rebuilt. A patch is ~52 blocks across, so this is generous. */
const RESCAN_S = 0.8

/** Canon's own words: the mist is GOLDEN — luminous mana, not weather-grey. */
const MIST_RGB = 'vec3(0.98, 0.92, 0.70)'
const PRESENCE_CORE = 0xfff3cf   // the hollow middle — stays near-white whatever the kind
/** The four element tints a presence can wear (`ELEMENT_COLORS`), pulled toward the mist's gold so
 *  a rim reads as lit BY the patch rather than as a coloured object dropped into it. */
const ELEMENTS = ['mana', 'storm', 'earth', 'water'] as const
type ElementId = typeof ELEMENTS[number]

export interface MistPass {
  points: THREE.Points
  /** Residents live in their own group so the caller can add one object to the scene. */
  residents: THREE.Group
  /** The patch the camera is standing in, 0..1 thick — the fog/light lever reads this. */
  thickness(): number
  /** The presence within spar range, or null. The range half of the prompt gate. */
  nearest(): Resident | null
  /**
   * The presence the CROSSHAIR is on, or null — the other half, and what actually drives the HUD
   * prompt and the E key (2026-08-13).
   *
   * ★ Asked of this file rather than computed by the host, because this file is what decides where
   * a presence STANDS: the pair offset (`±1.4` across the patch heart) and the spindle's radius and
   * height live here. A host-side box would be a second copy of that placement, correct until the
   * day a pair steps further apart. `nearest()` stays for the range question; the two are ANDed by
   * the caller so a presence must be both close and looked at.
   *
   * ⚠ Direction must be unit length. `blockDist` is the reticle raycast's own hit distance, so a
   * presence behind a wall is not aimed at — the mist is transparent, the world it lies in is not.
   */
  aimed(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxDist: number, blockDist: number,
  ): Resident | null
  /** Swap the withdrawal ledger in (after a spar) so the sparred presence leaves at once. */
  setLedger(l: MistLedger): void
  tick(px: number, py: number, pz: number, dt: number, elapsed: number): void
  dispose(): void
}

/** How close you must stand for the presence to acknowledge you — a spar is approached, not
 *  stumbled into, so this is deliberately inside the patch rather than at its edge. */
export const SPAR_RANGE = 6

// ── The spindle's dimensions, hoisted so `aimed()` can test the shape that is actually drawn ────
// `PRESENCE_TALL` is the lathe profile's height and `PRESENCE_R` its widest radius (the waist, per
// the profile below). `PAIR_OFF` is how far a pair steps apart across the patch heart. All three
// were inline literals; they are up here because the crosshair test and the mesh must agree, and
// two copies of a number are two numbers.
/**
 * ⚠ EXPORTED 2026-08-27 SO THE HOME PLOT'S RING CAN STAND ITS RESIDENTS AT THE SAME HEIGHT.
 * ★ AND IT IS A KNOWN-WRONG NUMBER SHARED ON PURPOSE. It is the HALO's lathe height, not a
 * creature's, and how big a spirit actually is is `[OPEN]` in `CANON/CANON_GAPS.md` (filed
 * 2026-08-26 as a ratification, with the prose quotes). One wrong number that every resident wears
 * is a one-line fix on the day Magii rules; two wrong numbers is a hunt. Do not "improve" this in
 * one caller.
 */
export const PRESENCE_TALL = 2.1
const PRESENCE_R = 0.49
const PAIR_OFF = 1.4

/**
 * ★★ WHERE A PRESENCE'S FEET GO — ONE EXPRESSION, THREE CONSUMERS.
 *
 * `patch.floor` is the MINIMUM column across the whole floor radius (`voxel/mist.ts` step 5), not the
 * ground at the heart. `padSpan` allows a 2-block span inside that radius, so `floor + 1` can sit
 * BELOW the dirt the spirit is standing on — and it did: Alex found a pair buried in the ground on
 * 2026-08-26. ⚠ `VoxelWorld.tsx` already carries the warning for the other body type — *"a patrol
 * placed by `columnHeight` starts buried in it"* — and this pass was doing the very thing that
 * comment warns against, one level worse, because a minimum is lower than a column.
 *
 * ⚠⚠ IT IS ONE FUNCTION BECAUSE THREE THINGS READ IT: the halo mesh, the billboard, and `aimed()`'s
 * hit box. Those must never disagree — a spirit you can see at one height and aim at at another is
 * the worst of both, and it is exactly the two-consumers-one-source drift this repo keeps paying for.
 *
 * `groundAt` is the host's LIVE probe (`groundTopNear`), same seam `collar-foes` uses for `blocked?`
 * and `voxel/footing.ts` uses for `heightAt`. Without it this reads the generator, which is correct
 * for generated ground and blind to anything a keeper has dug or built; with it, a spirit stands on
 * the world as it actually is.
 */
function standYFor(
  patch: MistPatch, seed: number,
  groundAt?: (x: number, z: number, hint: number) => number,
): number {
  const x = Math.round(patch.x), z = Math.round(patch.z)
  const gen = columnHeight(x, z, seed)
  return (groundAt ? groundAt(x, z, gen + 2) : gen) + 1
}

export function createMistPass(
  seed: number,
  ledger0: MistLedger = {},
  groundAt?: (x: number, z: number, hint: number) => number,
): MistPass {
  /** Memo per patch — `aimed()` runs every frame and must not re-probe the world each time. */
  const standY = new Map<string, number>()
  const standAt = (p: MistPatch): number => {
    const k = `${p.x},${p.z}`
    let v = standY.get(k)
    if (v === undefined) { v = standYFor(p, seed, groundAt); standY.set(k, v) }
    return v
  }
  // ── the lying mist ────────────────────────────────────────────────────────────────────────────
  const pos = new Float32Array(COUNT * 3)
  const aT = new Float32Array(COUNT)
  const aSeed = new Float32Array(COUNT)
  const age = new Float32Array(COUNT)
  const life = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3 + 1] = -1000
    life[i] = LIFE_MIN + Math.random() * LIFE_VAR
    age[i] = Math.random() * life[i]
    aSeed[i] = Math.random() * Math.PI * 2
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
attribute float aT;
attribute float aSeed;
uniform float uTime;
varying float vT;
void main() {
  vT = aT;
  vec3 p = position;
  // SIDEWAYS, not upward. A wide slow wander on both horizontal axes at different rates, so the
  // layer creeps and curls instead of orbiting — the tell that separates drifting fog from a
  // particle system running a circle.
  p.x += sin(uTime * 0.16 + aSeed) * 2.6 + sin(uTime * 0.07 + aSeed * 2.3) * 1.4;
  p.z += cos(uTime * 0.13 + aSeed * 1.7) * 2.6 + cos(uTime * 0.05 + aSeed * 3.1) * 1.4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Born WIDE and swelling only a little: mist does not plume, it spreads.
  gl_PointSize = (58.0 + 26.0 * aT) * (160.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
varying float vT;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  // A softer falloff than steam's: cubed, so each sprite has almost no edge of its own and the
  // layer's shape comes from where the sprites ARE rather than from their outlines.
  float soft = (1.0 - d) * (1.0 - d) * (1.0 - d);
  float alpha = soft * sin(3.14159 * vT) * 0.13;
  gl_FragColor = vec4(${MIST_RGB}, alpha);
}`,
  })

  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 1
  points.visible = false

  // ── the presence ──────────────────────────────────────────────────────────────────────────────
  // A spindle: narrow at the ground, full through the middle, tapering to nothing. Read as a
  // standing form without being a body — no head, no limbs, nothing a species could be read off.
  const profile: THREE.Vector2[] = []
  const SEGS = 14, TALL = PRESENCE_TALL
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS
    // sin gives the waist a full belly and pinches both ends; the 0.72 power lifts the widest point
    // above centre so it reads as shoulders rather than as an egg.
    const r = Math.sin(Math.pow(t, 0.72) * Math.PI) * 0.46 + 0.03
    profile.push(new THREE.Vector2(r, t * TALL))
  }
  const residentGeo = new THREE.LatheGeometry(profile, 18)

  // ★ FOUR materials, one per element, built ONCE — not one per resident. A presence's kind is
  // legible at a distance because its rim carries its element's colour, and there are exactly four
  // elements, so a bounded set is the honest shape. (A per-resident material would be the
  // context-loss bug render-audit exists to catch; a single shared material could not tint.)
  const makeResidentMat = (tint: number) => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // NOT additive: additive over a bright gold fog layer blows straight to white and the
    // silhouette disappears exactly when the mist is thickest — i.e. the one moment it must read.
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: new THREE.Color(PRESENCE_CORE) },
      // Pulled 45% toward the mist's gold: the kind reads, without the presence looking like a
      // coloured prop standing in gold fog.
      uRim: { value: new THREE.Color(tint).lerp(new THREE.Color(0xffd27a), 0.45) },
    },
    vertexShader: /* glsl */ `
varying vec3 vN;
varying vec3 vView;
varying float vUp;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  vUp = position.y;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uRim;
varying vec3 vN;
varying vec3 vView;
varying float vUp;
void main() {
  // Fresnel: brightest where the surface turns away, so the form is a glowing OUTLINE with a
  // hollow middle. That is what makes it read as a presence rather than as a solid object, and
  // it is why the thing is legible through fog at distance.
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.6);
  // Dissolves into the mist at the crown — it does not end, it stops being visible.
  float fade = smoothstep(2.1, 0.75, vUp);
  // A slow breath. Unhurried on purpose: something waiting, not something hunting.
  float breath = 0.86 + 0.14 * sin(uTime * 0.9);
  vec3 col = mix(uCore, uRim, f);
  gl_FragColor = vec4(col, f * fade * breath * 0.72);
}`,
  })

  const residentMats: Record<ElementId, THREE.ShaderMaterial> = {
    mana: makeResidentMat(Number(ELEMENT_COLORS.mana.replace('#', '0x'))),
    storm: makeResidentMat(Number(ELEMENT_COLORS.storm.replace('#', '0x'))),
    earth: makeResidentMat(Number(ELEMENT_COLORS.earth.replace('#', '0x'))),
    water: makeResidentMat(Number(ELEMENT_COLORS.water.replace('#', '0x'))),
  }

  const residents = new THREE.Group()
  /**
   * ★ TWO OBJECTS PER PRESENCE NOW: the painted billboard, and the element spindle kept BEHIND it as
   * a manifestation halo. The spindle is not leftover scaffolding — canon asks for a *luminous
   * manifestation*, not a creature standing in a field, and the fresnel rim is what says the spirit
   * is being made of mist rather than walking around in it. `body` is null only when a species has
   * no registered art, and then the halo alone stands, which is exactly today's behaviour.
   */
  const live = new Map<string, { halo: THREE.Mesh; body: CreatureBody | null }>()
  const keyOf = (p: MistPatch) => `${p.x},${p.z}`

  let rescan = 0
  let near: MistPatch[] = []
  let current: MistPatch | null = null
  let thick = 0
  let ledger: MistLedger = ledger0
  /** Every present resident this rescan, and the closest one within SPAR_RANGE. */
  let present: Resident[] = []
  let closest: Resident | null = null

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
  const tAttr = geo.getAttribute('aT') as THREE.BufferAttribute

  return {
    points,
    residents,
    thickness: () => thick,
    nearest: () => closest,

    // Walks the same `present` list the meshes are built from, so a silhouette you can see is a
    // silhouette you can aim at — and one that withdrew after a spar is neither. A pair is two
    // boxes and the NEAREST hit wins, which is what makes "aim at the left one" mean anything.
    aimed(ox, oy, oz, dx, dy, dz, maxDist, blockDist) {
      let best: Resident | null = null
      let bestT = Infinity
      for (const r of present) {
        // Same expression as the mesh placement above: heart, stepped aside only when paired.
        const offs = r.second ? [-PAIR_OFF, PAIR_OFF] : [0]
        for (const off of offs) {
          const y0 = standAt(r.patch)
          const box = bodyBox(r.patch.x + off, r.patch.z, y0, y0 + PRESENCE_TALL, PRESENCE_R)
          const t = rayBox(ox, oy, oz, dx, dy, dz, box, maxDist)
          if (t !== null && t <= blockDist && t < bestT) { bestT = t; best = r }
        }
      }
      return best
    },
    // A spar just happened: take the new ledger and force a rescan on the next tick so the spirit
    // that withdrew is GONE immediately rather than lingering until the 0.8s clock comes round.
    setLedger(l) { ledger = l; rescan = 0 },

    tick(px, py, pz, dt, elapsed) {
      void py
      ;(mat.uniforms.uTime as { value: number }).value = elapsed
      for (const e of ELEMENTS) (residentMats[e].uniforms.uTime as { value: number }).value = elapsed

      // ── which patches are in play ───────────────────────────────────────────────────────────
      rescan -= dt
      if (rescan <= 0) {
        rescan = RESCAN_S
        near = mistPatchesNear(px, pz, seed, REACH)
        // The one we are standing in (or nearest), for the particle spawn and the fog lever.
        current = null
        let best = Infinity
        for (const p of near) {
          const d = Math.hypot(p.x - px, p.z - pz)
          if (d < best) { best = d; current = p }
        }
        // ── who is actually standing in each patch ─────────────────────────────────────────────
        // A patch has a presence only if its zone was RULED (unruled fails closed → nothing) and
        // it is not still quiet from a recent spar. So this list is shorter than `near`, and the
        // difference is exactly the two canon rules.
        const now = Date.now()
        present = []
        for (const p of near) {
          const r = residentAt(p, zoneAt(p.x, p.z, seed).zone?.id, ledger, now)
          if (r) present.push(r)
        }

        // Residents: add what arrived, drop what left or withdrew. Meshes are cheap; the geometry
        // and the four materials they share are not, and are built once above.
        // ★ A PAIR SHOWS AS TWO. The prompt names both before you press E, and a silhouette count
        // that disagreed with it would undo the consent design at the only moment it matters —
        // you would walk up to one shape and find two in the arena. Keyed `<patch>` and `<patch>:2`
        // so the second is added and dropped by exactly the same diff as the first.
        const want = new Map<string, { r: Resident; form: ResidentForm; off: number }>()
        for (const r of present) {
          want.set(keyOf(r.patch), { r, form: r, off: r.second ? -PAIR_OFF : 0 })
          if (r.second) want.set(`${keyOf(r.patch)}:2`, { r, form: r.second, off: PAIR_OFF })
        }
        for (const [k, e] of live) {
          if (want.has(k)) continue
          residents.remove(e.halo)
          if (e.body) { residents.remove(e.body.object); e.body.dispose() }
          live.delete(k)
        }
        for (const [k, w] of want) {
          if (live.has(k)) continue
          const m = new THREE.Mesh(residentGeo, residentMats[w.form.element])
          // Stands ON the spar floor, at the heart — the patch's own reference point. A pair steps
          // apart across it so neither is hidden inside the other.
          m.position.set(w.r.patch.x + w.off, standAt(w.r.patch), w.r.patch.z)
          m.frustumCulled = false
          residents.add(m)

          // ── the painted spirit ────────────────────────────────────────────────────────────────
          // ⚠ NO STAND-IN WHEN THE ART IS MISSING. `speciesArt` returns null rather than inventing,
          // and this respects that: an unregistered species keeps the neutral halo instead of
          // wearing some other animal's frames. A wrong creature is worse than a vague one, because
          // only one of the two looks like a bug.
          // ★ THE CANON PORTRAIT FIRST, THE PIXEL SPRITE AS FALLBACK (2026-08-26, Alex ruled).
          // The 32×32 sprites were never finished — they are concept, and they render wrong on top
          // of it (16×16 art in a 32×32 buffer, read at 32). The ten canon base forms ARE finished
          // and locked, so between an unfinished placeholder that draws as a smear and a locked
          // painting, the painting wins. `spirit-portrait-body.ts` carries the full reasoning.
          // The sprite arm stays: it is what a species with no cutout still gets, and it keeps the
          // "no stand-in when the art is missing" rule above intact for anything neither path has.
          const art = speciesArt(w.form.species)
          const body = hasPortrait(w.form.species)
            ? createPortraitBody(w.form.species, { height: PRESENCE_TALL })
            : art
              ? createCreatureBody(w.form.species, { anims: art.anims, palette: art.palette }, { height: PRESENCE_TALL })
              : null
          if (body) {
            body.object.position.set(m.position.x, standAt(w.r.patch) + PRESENCE_TALL / 2, m.position.z)
            // Draws after the halo so the spirit reads as standing IN the glow, not behind it.
            body.object.renderOrder = 1
            body.object.frustumCulled = false
            residents.add(body.object)
          }
          live.set(k, { halo: m, body })
        }
      }

      // ── the painted spirits, every frame ──────────────────────────────────────────────────────
      // ★ FACING IS DETERMINISTIC AND DOES NOT TRACK YOU. A resident stands where the ground called
      // it, facing whatever way it happens to face, so walking around a patch shows you its flank and
      // its back — which is the only reason the directional art exists. A billboard that always
      // turned to face the camera would look attentive and would render three of every four painted
      // frames unreachable. Derived from the patch seed so it is stable across rescans and reloads.
      // ⚠ It therefore never notices you. Turning to meet an aimed keeper is a deliberate LATER step,
      // not an oversight — it wants Alex's eye on the moment, not a guess in this file.
      for (const [, e] of live) {
        if (!e.body) continue
        const yaw = ((e.halo.position.x * 73856093) ^ (e.halo.position.z * 19349663)) % 628 / 100
        e.body.update(elapsed * 1000, yaw, px, pz, 'idle')
      }

      // Nearest presence within spar range — recomputed every frame off the rescanned list, so the
      // prompt tracks your walk rather than lagging a rescan behind.
      closest = null
      let bestD = SPAR_RANGE
      for (const r of present) {
        const d = Math.hypot(r.patch.x - px, r.patch.z - pz)
        if (d <= bestD) { bestD = d; closest = r }
      }

      // The fog/light lever samples the field directly rather than the patch list: it must be the
      // SAME number the particles and the flora read, or the fog would close in at a different
      // place than the mist actually lies.
      thick = mistAt(px, pz, seed)

      // A gentle turn, so the presence is alive without acting. Rotation only — no position churn,
      // no allocation. ⚠ THE HALO ONLY. The billboard must never be rotated: a THREE.Sprite already
      // faces the camera, and spinning it would roll the painted spirit on its side.
      for (const e of live.values()) e.halo.rotation.y = elapsed * 0.16 + e.halo.position.x * 0.01

      const active = current !== null
      points.visible = active
      if (!active || !current) return

      const cx = current.x, cz = current.z
      const R = DEFAULT_MIST.radius
      for (let i = 0; i < COUNT; i++) {
        age[i] += dt
        if (age[i] < life[i]) {
          const t = age[i] / life[i]
          aT[i] = t
          pos[i * 3 + 1] += RISE * (dt / life[i])
          continue
        }
        age[i] = 0
        life[i] = LIFE_MIN + Math.random() * LIFE_VAR
        let placed = false
        for (let k = 0; k < TRIES; k++) {
          // Sample the PATCH, not the camera: the layer belongs to the place, so it stays put when
          // you walk through it instead of following you like a personal weather system.
          const a = Math.random() * Math.PI * 2
          const rr = Math.sqrt(Math.random()) * R * 1.05      // sqrt = uniform over the disc
          const x = Math.round(cx + Math.cos(a) * rr)
          const z = Math.round(cz + Math.sin(a) * rr)
          // Density falls off with the field, so the edge thins out on its own — no edge test.
          if (mistAt(x, z, seed) < Math.random()) continue
          pos[i * 3] = x + 0.5
          pos[i * 3 + 1] = columnHeight(x, z, seed) + 1 + LIE + Math.random() * LIE_VAR
          pos[i * 3 + 2] = z + 0.5
          placed = true
          break
        }
        if (!placed) pos[i * 3 + 1] = -1000
        aT[i] = 0
      }
      posAttr.needsUpdate = true
      tAttr.needsUpdate = true
    },

    dispose() {
      geo.dispose()
      mat.dispose()
      residentGeo.dispose()
      for (const e of ELEMENTS) residentMats[e].dispose()
      for (const [, e] of live) e.body?.dispose()
      live.clear()
      residents.clear()
      live.clear()
    },
  }
}
