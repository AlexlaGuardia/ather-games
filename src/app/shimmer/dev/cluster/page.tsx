'use client'

// A GARDEN CLUSTER, FROM ABOVE — four folds, and the Green made of the corners they gave.
//
// ★ WHY A PLAN VIEW AND NOT THE WORLD: the questions this shape has to answer are all plan
// questions. Does the middle read as ONE place or as four islands touching? Does an empty quarter
// read as held open or as a hole? Is the Green big enough to be a village green and small enough
// that nobody's fold feels bitten? None of those need a camera, and all of them need the four
// slots and three tiers switched back and forth faster than a world can reload.
//
// ★ IT DRAWS THE SHIPPED MODULE. Every pixel is one `clusterAt` call against `voxel/cluster.ts` —
// the same function an adapter will build columns from. `dev/ring` states the rule this follows: a
// preview that re-derives the shape can be perfectly correct while the game is wrong.
//
// ⚠ THE COLOURS ARE CANON, NOT TASTE. By the 09-22 light law the Green is the BRIGHTEST ground in
// the game (four keepers' tending meeting at one point, the greyfield's exact opposite), so it is
// drawn brightest. And an empty quarter is the Ather — the same starry dark as outside the fold,
// never a drained or greyed version of ground. Canon calls that one "the guard most likely to ship
// wrong": grey would tell the player something died there.
//
// Run: tools/devwin.sh play  ->  http://localhost:3203/shimmer/dev/cluster   (any lane but hub)

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CLUSTER, NO_SLOTS, QUARTERS, clusterAt, clusterReach, cornersGiven, isCluster,
  type ClusterConfig, type QuarterId,
} from '../../voxel/cluster'
import { PLOT_TIERS } from '../../voxel/plot'

const SIZE = 520

/** A seed per slot, so each keeper's coast is their own and they read as four different folds. */
const SEEDS: Record<QuarterId, number> = { ne: 1, nw: 7, sw: 42, se: 555 }

/** Each quarter's turf, nudged apart so the seams between four folds are visible at a glance. */
const TURF: Record<QuarterId, string> = {
  ne: '#4f7f42', nw: '#59873f', sw: '#497a4a', se: '#547f3c',
}
const GREEN = '#8fd06a'   // the brightest ground in the game
const CLOUD = '#cfd7e4'   // pressed cloud, the fold's wall
const ATHER = '#0a0c16'   // the void. An open slot is THIS, never a greyed quarter.

const LABEL: Record<QuarterId, string> = { ne: 'NE', nw: 'NW', sw: 'SW', se: 'SE' }

export default function ClusterPreview() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [tiers, setTiers] = useState<Record<QuarterId, number>>({ ne: 2, nw: 1, sw: 0, se: 2 })
  const [on, setOn] = useState<Record<QuarterId, boolean>>({ ne: true, nw: true, sw: true, se: false })
  const [offset, setOffset] = useState(DEFAULT_CLUSTER.offset)
  const [green, setGreen] = useState(DEFAULT_CLUSTER.green)
  const [ms, setMs] = useState(0)

  const cfg: ClusterConfig = useMemo(() => ({
    ...DEFAULT_CLUSTER, offset, green,
    slots: Object.fromEntries(QUARTERS.map(q =>
      [q, on[q] ? { seed: SEEDS[q], tier: tiers[q] } : null])) as ClusterConfig['slots'],
  }), [on, tiers, offset, green])

  // The frame the view is fitted to is the FULL four-quarter footprint at max tier, held fixed, so
  // toggling a slot does not rescale the picture underneath the thing you are comparing.
  const frame = useMemo(() => clusterReach({
    ...cfg, slots: Object.fromEntries(QUARTERS.map(q => [q, { seed: SEEDS[q], tier: 2 }])) as ClusterConfig['slots'],
  }) * 1.04, [offset, green]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const t0 = performance.now()
    const img = ctx.createImageData(SIZE, SIZE)
    const per = (frame * 2) / SIZE // blocks per pixel
    const hit = { green: [143, 208, 106], wall: [207, 215, 228], ather: [10, 12, 22] }
    const turf: Record<QuarterId, number[]> = Object.fromEntries(QUARTERS.map(q => {
      const h = TURF[q]
      return [q, [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))]
    })) as Record<QuarterId, number[]>

    for (let py = 0; py < SIZE; py++) {
      const z = frame - (py + 0.5) * per          // +z is north, so it runs UP the canvas
      for (let px = 0; px < SIZE; px++) {
        const x = -frame + (px + 0.5) * per
        const c = clusterAt(x, z, cfg)
        const rgb = c.part === 'quarter' ? turf[c.quarter]
          : c.part === 'green' ? hit.green
          : c.part === 'wall' ? hit.wall
          : hit.ather
        const o = (py * SIZE + px) * 4
        img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    // The cell borders, faint — they are a fact about ownership, not a thing in the world.
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(SIZE / 2, 0); ctx.lineTo(SIZE / 2, SIZE)
    ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2); ctx.stroke()
    setMs(Math.round(performance.now() - t0))
  }, [cfg, frame])

  const given = cornersGiven(cfg)

  return (
    <main style={{ minHeight: '100vh', background: '#0b0d14', color: '#dfe5ef', padding: 24,
      font: '13px/1.6 ui-monospace, monospace' }}>
      <h1 style={{ font: '600 15px/1.4 ui-monospace, monospace', letterSpacing: '0.12em',
        textTransform: 'uppercase', margin: '0 0 4px' }}>Garden cluster · plan</h1>
      <p style={{ margin: '0 0 18px', color: '#8892a6', maxWidth: 640 }}>
        One fold with four thresholds, not four folds with doors. The Green is made of the corners
        given, so two keepers make half of it. An open slot is the Ather, never grey.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <canvas ref={ref} width={SIZE} height={SIZE}
          style={{ width: SIZE, height: SIZE, borderRadius: 4, imageRendering: 'pixelated' }} />

        <div style={{ display: 'grid', gap: 14, minWidth: 260 }}>
          {QUARTERS.map(q => (
            <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setOn(s => ({ ...s, [q]: !s[q] }))}
                style={{ width: 62, padding: '5px 0', borderRadius: 3, cursor: 'pointer',
                  border: `1px solid ${on[q] ? TURF[q] : '#2a3040'}`,
                  background: on[q] ? TURF[q] : 'transparent',
                  color: on[q] ? '#0b0d14' : '#6b7488', font: '600 12px ui-monospace, monospace' }}>
                {LABEL[q]}
              </button>
              <span style={{ color: on[q] ? '#dfe5ef' : '#4a5264', minWidth: 78 }}>
                {on[q] ? `tier ${tiers[q]} · ${PLOT_TIERS[tiers[q]]}` : 'held open'}
              </span>
              <input type="range" min={0} max={2} step={1} value={tiers[q]} disabled={!on[q]}
                onChange={e => setTiers(s => ({ ...s, [q]: Number(e.target.value) }))}
                style={{ width: 90 }} />
            </div>
          ))}

          <hr style={{ border: 0, borderTop: '1px solid #1d2331', margin: '4px 0' }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ minWidth: 62, color: '#8892a6' }}>offset</span>
            <input type="range" min={120} max={340} step={5} value={offset}
              onChange={e => setOffset(Number(e.target.value))} style={{ width: 120 }} />
            <span>{offset}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ minWidth: 62, color: '#8892a6' }}>green</span>
            <input type="range" min={40} max={240} step={5} value={green}
              onChange={e => setGreen(Number(e.target.value))} style={{ width: 120 }} />
            <span>{green} · {green * 2} across</span>
          </label>

          <div style={{ color: '#8892a6', marginTop: 4 }}>
            <div>{given} corner{given === 1 ? '' : 's'} given · the Green is {given}/4</div>
            <div>{isCluster(cfg) ? 'a cluster' : 'one keeper — a plot, not a cluster'}</div>
            <div>reach {Math.round(clusterReach(cfg))} blocks · drew in {ms}ms</div>
          </div>

          <div style={{ display: 'grid', gap: 4, marginTop: 6, color: '#8892a6' }}>
            {[[GREEN, 'the Green — brightest ground in the game'],
              [TURF.ne, 'a keeper’s own quarter'],
              [CLOUD, 'the fold’s cloud wall'],
              [ATHER, 'the Ather — and an open slot']].map(([c, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, background: c, borderRadius: 2,
                    border: '1px solid #222836' }} />
                  <span>{label}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </main>
  )
}
