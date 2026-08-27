'use client'

// Seam preview — the shipped shimmer, standing still so it can be LOOKED at.
//
// ★ IT MOUNTS `createSeamShimmer` ITSELF. `icon-sheet.mts` states the rule this follows: a preview
// that re-derives the maths can be perfectly correct while the game is wrong, which is the exact
// failure a preview exists to catch. So this page imports the pass the world imports, at the real
// anchors, and only supplies a camera and a stand-in for the wall behind it.
//
// ⚠ THE BACKDROP IS A STAND-IN AND THE ONE THING HERE THAT CAN MISLEAD. In the Wilds the seam is
// read against pressed cloud — pale, and that palenesss is why the crease is a dark parting rather
// than a glow. The plane behind is that pale, but it is flat-lit and has no texture, so judge the
// CONTRAST here and judge the final look in the world.
//
// Run: tools/devwin.sh sprites  →  http://localhost:3202/shimmer/dev/seam

import { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createSeamShimmer, wildsSeamAnchor, plotSeamAnchor } from '../../voxel3d/seam'
import { WILDS_BUBBLE } from '../../voxel/column'
import { plotForTier, PLOT_TIERS } from '../../voxel/plot'
import type { Space } from '../../voxel3d/save'

const SEED = 1337

/**
 * ⚠ TIER IS A CONTROL BECAUSE THE DOOR MOVES WITH IT, AND THIS PAGE COULD NOT SEE THAT UNTIL
 * 2026-08-27. The plot seam was anchored once at `DEFAULT_PLOT`'s r300 while the fold grew to 400
 * and 500 underneath it, and a preview pinned to the same default agreed with the bug perfectly —
 * the header's own warning about a preview that re-derives, arriving as a preview that re-derives
 * the SAME frozen number. Flip through the tiers here and the seam must stay on the wall.
 */
function Seam({ space, dist, frozen, tier }: { space: Space; dist: number; frozen: boolean; tier: number }) {
  // ⚠ WILDS_BUBBLE, never DEFAULT_BUBBLE — see seam.ts. A preview of the wrong door is worse
  // than no preview: it would look perfectly fine.
  //
  // ⚠ AND THE PLOT CONFIG IS A REF READ THROUGH A CLOSURE, exactly as the world passes it — the
  // pass is built once and must ask again after a widening. Handing it `plotForTier(tier)` would
  // rebuild the pass on every tier change and prove nothing about the live path.
  const tierRef = useRef(tier)
  tierRef.current = tier
  const pass = useMemo(() => createSeamShimmer(SEED, WILDS_BUBBLE, () => plotForTier(tierRef.current)), [])
  const anchor = useMemo(
    () => (space === 'plot' ? plotSeamAnchor(SEED, plotForTier(tier)) : wildsSeamAnchor(SEED, WILDS_BUBBLE)),
    [space, tier],
  )
  useEffect(() => () => pass.dispose(), [pass])

  useFrame((state, dt) => {
    // Stand the camera off the seam along its own normal, at the requested distance, eye height.
    const b = anchor.bearing
    const px = anchor.x + Math.cos(b) * dist
    const pz = anchor.z + Math.sin(b) * dist
    state.camera.position.set(px, anchor.y + 1.7, pz)
    state.camera.lookAt(anchor.x, anchor.y + anchor.height * 0.35, anchor.z)
    pass.tick(px, anchor.y + 1.7, pz, dt, frozen ? 0 : state.clock.elapsedTime, space)
  })

  return (
    <>
      <primitive object={pass.group} />
      {/* Stand-in for the wall: pressed cloud, pale and flat. See the header. */}
      <mesh
        position={[anchor.x - Math.cos(anchor.bearing) * 1.2, anchor.y + 10, anchor.z - Math.sin(anchor.bearing) * 1.2]}
        rotation={[0, Math.PI / 2 - anchor.bearing, 0]}
      >
        <planeGeometry args={[60, 40]} />
        <meshBasicMaterial color={space === 'plot' ? '#20303a' : '#d8e2e6'} side={THREE.DoubleSide} />
      </mesh>
      {/* The ground the seam must not draw on. */}
      <mesh position={[anchor.x, anchor.y, anchor.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial color="#6f7d63" />
      </mesh>
    </>
  )
}

/**
 * ★ THE STATE SEEDS FROM THE QUERY STRING so a screenshot is reproducible and citable:
 * `?space=plot&dist=4&frozen=1`. A look that can only be reached by dragging a slider cannot be
 * compared against itself next week, and "it looked better yesterday" is not a reviewable claim.
 */
function initial(): { space: Space; dist: number; frozen: boolean; tier: number } {
  const q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const d = parseFloat(q.get('dist') ?? '')
  return {
    space: q.get('space') === 'plot' ? 'plot' : 'wilds',
    dist: Number.isFinite(d) ? d : 18,
    frozen: q.get('frozen') === '1',
    tier: Math.max(0, Math.min(PLOT_TIERS.length - 1, Math.round(parseFloat(q.get('tier') ?? '0') || 0))),
  }
}

export default function SeamPreview() {
  const [space, setSpace] = useState<Space>('wilds')
  const [dist, setDist] = useState(18)
  const [frozen, setFrozen] = useState(false)
  const [tier, setTier] = useState(0)
  // ⚠ AFTER MOUNT, NOT DURING RENDER. Reading window.location during render makes the server's HTML
  // (which has no query string) disagree with the client's, which is a hydration error — it showed
  // up as the dev overlay's "1 Issue" on the very first screenshot run.
  useEffect(() => {
    const q = initial()
    setSpace(q.space); setDist(q.dist); setFrozen(q.frozen); setTier(q.tier)
  }, [])
  const wrap = useRef<HTMLDivElement>(null)

  return (
    <div ref={wrap} style={{ position: 'fixed', inset: 0, background: '#0b0d10' }}>
      <Canvas camera={{ fov: 70, near: 0.1, far: 4000 }}>
        <Seam space={space} dist={dist} frozen={frozen} tier={tier} />
      </Canvas>
      <div style={{
        position: 'absolute', left: 12, top: 12, display: 'flex', gap: 10, alignItems: 'center',
        font: '12px ui-monospace, monospace', color: '#cfe3ea', background: '#0f1418cc',
        padding: '8px 12px', borderRadius: 6, letterSpacing: '0.08em',
      }}>
        <button onClick={() => setSpace(s => (s === 'wilds' ? 'plot' : 'wilds'))}
          style={{ font: 'inherit', color: 'inherit', background: '#1b2830', border: '1px solid #2e424e', borderRadius: 4, padding: '3px 8px' }}>
          {space.toUpperCase()}
        </button>
        <label>DIST {dist.toFixed(1)}m
          <input type="range" min={1} max={30} step={0.5} value={dist}
            onChange={e => setDist(parseFloat(e.target.value))} style={{ marginLeft: 8, verticalAlign: 'middle' }} />
        </label>
        <button onClick={() => setTier(t => (t + 1) % PLOT_TIERS.length)}
          title="the fold's size — the plot seam must ride it out to the new wall"
          style={{ font: 'inherit', color: 'inherit', background: '#1b2830', border: '1px solid #2e424e', borderRadius: 4, padding: '3px 8px' }}>
          T{tier} r{PLOT_TIERS[tier]}
        </button>
        <button onClick={() => setFrozen(f => !f)}
          style={{ font: 'inherit', color: 'inherit', background: '#1b2830', border: '1px solid #2e424e', borderRadius: 4, padding: '3px 8px' }}>
          {frozen ? 'FROZEN' : 'LIVE'}
        </button>
      </div>
    </div>
  )
}
