'use client'

// THE GREY — a Hollow, at the hour it actually exists, next to the ground it has to stand out from.
//
// ★★★ WHY THIS PAGE EXISTS, IN ALEX'S WORDS: "its looking terrible .. is there a way to isolate
// this chunk to be able to design this easily able to double check your work". Both halves of that
// are the point. I shipped a self-light value sized from ARITHMETIC against the night rig and never
// saw it; PATTERNS says do not act on a modelled reading, and the model was wrong in the way models
// are — right about the number, wrong about the look.
//
// ★ IT IMPORTS THE SHIPPED LOOK AND THE SHIPPED RIG. `hollow-look.ts` is the same module
// `VoxelWorld` builds from and `VoxelDayNight` is the same lighting the world runs, so what you
// judge here is what ships. `dev/ring` states the rule: a preview that re-derives can be perfectly
// correct while the game is wrong.
//
// ⚠ THE READOUT IS THE "DOUBLE CHECK" HALF AND IT IS NOT DECORATION. It samples the rendered
// FRAMEBUFFER — the body's pixels and the ground's — and prints both lumas and their ratio. A
// screenshot says something is wrong and never why; a number next to it says which of the two is
// moving. Contrast, not brightness, is what decides whether a silhouette reads.
//
// Run: tools/devwin.sh play  ->  http://localhost:3203/shimmer/dev/grey   (any lane but hub)

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  HOLLOW_LOOK, createHollowGeo, createHollowMat, applyHollowLook,
  type HollowLook, type HollowForm,
} from '../../voxel3d/hollow-look'
import { VoxelDayNight } from '../../voxel3d/day-night'
import { setTimePin } from '../../engine/day-cycle'

const FORMS: HollowForm[] = ['warden', 'stalker', 'caster']

/** A patch of ground to stand them on. Mid stone grey — the thing a Hollow must read darker than. */
const GROUND = 0x6b6b66

/** Where each body stands, spaced so all three read at once without overlapping. */
const SPOTS: Record<HollowForm, number> = { warden: -3, stalker: 0, caster: 3 }

function Bodies({ look, spin }: { look: HollowLook; spin: boolean }) {
  const geo = useMemo(() => createHollowGeo(), [])
  const mat = useMemo(() => createHollowMat(look), [])   // built once, then mutated — see applyHollowLook
  const group = useRef<THREE.Group>(null)

  // ⚠ Mutating in place rather than rebuilding: a material per drag is a shader program per drag.
  useEffect(() => { applyHollowLook(mat, look) }, [mat, look])
  useEffect(() => () => {
    for (const g of Object.values(geo)) g.dispose()
    for (const m of Object.values(mat)) m.dispose()
  }, [geo, mat])

  useFrame((_s, dt) => { if (spin && group.current) group.current.rotation.y += dt * 0.35 })

  return (
    <group ref={group}>
      {FORMS.map(f => (
        <mesh key={f} geometry={geo[f]} material={mat[f]} position={[SPOTS[f], 1.2, 0]} scale={[1, 1.55, 1]} />
      ))}
      {/* The ground they have to be darker than — the comparison the whole look is defined against. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color={GROUND} />
      </mesh>
    </group>
  )
}

/**
 * Read the actual pixels back.
 *
 * ★★ THE ONLY HONEST INSTRUMENT ON THIS PAGE. Everything else is a picture and a picture cannot
 * tell you whether the body moved or the ground did. This is the post-lighting, post-tone-map
 * value — what an eye actually receives.
 *
 * ⚠⚠⚠ AND IT RETURNED 0.0 FOR EVERY PIXEL IT EVER SAMPLED, UNTIL 2026-09-01. The old body of this
 * function called `gl.readRenderTargetPixels(null, …)`, casting the null through
 * `as unknown as THREE.WebGLRenderTarget` to get it past the compiler. three's very first line is
 * `if (!(renderTarget && renderTarget.isWebGLRenderTarget)) { error(…); return }`
 * (WebGLRenderer.js:2970) — so it logged to the console and **returned without touching the
 * buffer**, leaving the freshly-allocated Uint8Array at zeros. luma(0,0,0) is 0. The panel then
 * printed `body 0.0 · ground 0.0 · body/ground 0.00` with total confidence, on every frame, at
 * every hour, since the page was written on 2026-08-27.
 *
 * ★★★ THE PAGE EXISTS BECAUSE ALEX SAID *"is there a way to isolate this chunk to be able to
 * design this easily able to double check your work"*, and its own header calls this readout the
 * only honest instrument on it. The one thing here that was not a picture was returning a constant.
 * Measured from outside on 2026-09-01, the true values at these exact two points were **19.4 and
 * 30.4** — a real contrast ratio of 0.64 reported as 0.00, which is the page's own stated failure.
 *
 * ⚠ THE CAST IS THE WHOLE STORY. `as unknown as` silenced the one check that would have caught it,
 * and three reports this by console.error rather than by throwing, so nothing on the page or in any
 * test could see it. Never widen a type to make an argument fit an API; the API meant it.
 *
 * ⚠ WE READ THE DEFAULT FRAMEBUFFER DIRECTLY, which is what `null` was reaching for. `useFrame` at
 * the default priority runs BEFORE the renderer draws, so this samples the PREVIOUS frame — fine
 * here and only because `<Canvas gl={{ preserveDrawingBuffer: true }}>` keeps it, and because the
 * scene is sampled four times a second while turning slowly. Take the preserve flag away and this
 * reads a cleared buffer and goes back to lying.
 */
function Readout({ onSample }: { onSample: (s: { body: number; ground: number }) => void }) {
  const { gl, size } = useThree()
  const t = useRef(0)
  useFrame((_s, dt) => {
    t.current += dt
    if (t.current < 0.4) return          // four times a second is plenty and costs nothing visible
    t.current = 0
    const px = new Uint8Array(4)
    const luma = (b: Uint8Array) => (0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2])
    const dpr = gl.getPixelRatio()
    const ctx = gl.getContext()
    const read = (fx: number, fy: number) => {
      // ⚠ WebGL reads from the BOTTOM-LEFT, so y is flipped against CSS coordinates. Getting this
      // wrong samples the sky and reports a confidently wrong number, which is worse than none.
      px[0] = px[1] = px[2] = px[3] = 0
      ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)   // null HERE is correct: it selects the canvas
      ctx.readPixels(
        Math.floor(fx * size.width * dpr), Math.floor((1 - fy) * size.height * dpr), 1, 1,
        ctx.RGBA, ctx.UNSIGNED_BYTE, px)
      return luma(px)
    }
    // Centre of the frame is the stalker's body; a point well below it is bare ground.
    onSample({ body: read(0.5, 0.46), ground: read(0.5, 0.88) })
  })
  return null
}

export default function GreyPage() {
  const [selfLight, setSelfLight] = useState(HOLLOW_LOOK.selfLight)
  const [opacity, setOpacity] = useState(HOLLOW_LOOK.opacity.stalker)
  const [hour, setHour] = useState(0)        // 0 = midnight, which is when a Hollow exists

  /**
   * ★ THE CLOCK IS PINNED THROUGH THE SHIPPED MECHANISM — `setTimePin`, the same one the voxel3d
   * console's `time` command uses — rather than through a prop of this page's own. The rig reads
   * `dayProgress()`, so a page-local hour would light this scene by a rule the world does not have.
   *
   * ⚠ RELEASED ON UNMOUNT. `setTimePin` is MODULE state, so a page that pins midnight and navigates
   * away leaves the whole app in the dark until a reload — a dev tool silently changing the game is
   * exactly the class of thing this repo keeps writing up.
   */
  useEffect(() => {
    setTimePin(hour * 24)
    return () => setTimePin(null)
  }, [hour])
  const [spin, setSpin] = useState(true)
  const [sample, setSample] = useState({ body: 0, ground: 0 })

  const look: HollowLook = useMemo(() => ({
    selfLight,
    colour: HOLLOW_LOOK.colour,
    opacity: { warden: opacity + 0.08, stalker: opacity, caster: opacity - 0.04 },
  }), [selfLight, opacity])

  const ratio = sample.ground > 0.5 ? sample.body / sample.ground : 0

  return (
    <div className="h-screen w-screen bg-black text-white/80 font-mono text-[11px]">
      <div className="absolute z-10 m-3 w-[22rem] rounded border border-white/15 bg-black/70 p-3">
        <div className="gx-label mb-2 text-[9px] text-white/40">The grey — a Hollow at the hour it exists</div>

        <label className="flex items-center gap-2 py-1">
          <span className="w-24 shrink-0">self-light</span>
          <input type="range" min={0} max={0.6} step={0.01} value={selfLight}
                 onChange={e => setSelfLight(Number(e.target.value))} className="flex-1 accent-amber-300" />
          <span className="w-10 text-right tabular-nums">{selfLight.toFixed(2)}</span>
        </label>

        <label className="flex items-center gap-2 py-1">
          <span className="w-24 shrink-0">opacity</span>
          <input type="range" min={0.2} max={1} step={0.02} value={opacity}
                 onChange={e => setOpacity(Number(e.target.value))} className="flex-1 accent-amber-300" />
          <span className="w-10 text-right tabular-nums">{opacity.toFixed(2)}</span>
        </label>

        <label className="flex items-center gap-2 py-1">
          <span className="w-24 shrink-0">hour</span>
          <input type="range" min={0} max={1} step={0.01} value={hour}
                 onChange={e => setHour(Number(e.target.value))} className="flex-1 accent-amber-300" />
          <span className="w-10 text-right tabular-nums">{(hour * 24).toFixed(1)}</span>
        </label>

        <label className="flex items-center gap-2 py-1">
          <input type="checkbox" checked={spin} onChange={e => setSpin(e.target.checked)} className="accent-amber-300" />
          <span>turn them, so a silhouette is judged from every side</span>
        </label>

        {/* ★ THE NUMBERS. A ratio near 1 means the body and the ground are the same value — which is
            invisible however bright the scene is. Well under 1 is a dark shape on lighter ground,
            which is what "holds a silhouette" means. */}
        <div className="mt-2 border-t border-white/10 pt-2">
          <div className="flex justify-between"><span className="text-white/40">body luma</span><span className="tabular-nums">{sample.body.toFixed(1)}</span></div>
          <div className="flex justify-between"><span className="text-white/40">ground luma</span><span className="tabular-nums">{sample.ground.toFixed(1)}</span></div>
          <div className="flex justify-between">
            <span className="text-white/40">body / ground</span>
            <span className={`tabular-nums ${ratio > 0.85 && ratio < 1.15 ? 'text-red-300' : 'text-emerald-300'}`}>
              {ratio.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 text-[10px] leading-snug text-white/35">
            Red is the failure: body and ground at the same value read as one surface, and no amount
            of scene light fixes that. Contrast decides a silhouette, not brightness.
          </div>
        </div>

        <div className="mt-2 text-[10px] leading-snug text-white/35">
          Shipped values are the defaults. Nothing here writes to the game — call a number and hub
          moves <span className="text-white/60">HOLLOW_LOOK</span> in <span className="text-white/60">hollow-look.ts</span>.
        </div>
      </div>

      <Canvas camera={{ position: [0, 2.6, 8], fov: 55 }} gl={{ preserveDrawingBuffer: true }}>
        {/* ★ THE REAL RIG, not a hand-lit approximation, and it takes no time argument — it reads
            `dayProgress()`, which the effect above pins. Hollows only exist at night, so the hour
            slider is the single most important control on this page: a look judged at noon is a
            look judged in conditions the thing can never be seen in. */}
        <VoxelDayNight />
        <Bodies look={look} spin={spin} />
        <Readout onSample={setSample} />
      </Canvas>
    </div>
  )
}
