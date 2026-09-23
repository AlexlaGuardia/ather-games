'use client'

// A GARDEN CLUSTER, FROM ABOVE — four whole folds, the Green, and the ground that joins them.
//
// ★ WHY A PLAN VIEW: the questions this shape has to answer are all plan questions. Does the middle
// read as ONE place? Does an empty quarter read as held open or as a hole? Are the lanes a walk or
// a trudge? None need a camera, and all need the four slots and three tiers switched back and
// forth faster than a world can reload.
//
// ★ IT DRAWS THE SHIPPED MODULE. Every pixel is one `clusterAt` against `voxel/cluster.ts` — the
// same function an adapter will build columns from. `dev/ring` states the rule: a preview that
// re-derives the shape can be perfectly correct while the game is wrong.
//
// ⚠⚠ THE ZOOM IS NOT A CONVENIENCE, IT IS THE FIX FOR A PICTURE THAT LIED. The first cut drew the
// whole cluster at ~4.6 blocks to the pixel and listed the cloud wall in its legend — and the wall
// is `wallWidth` 2, so it was SUB-PIXEL and simply absent from what Alex was being asked to judge.
// A legend that names an element the render cannot show is the same failure magii caught in the
// Hollows brief: the mechanism was there and the outcome was not. The readout prints blocks-per-
// pixel and says out loud when the wall is too thin to be in the image.
//
// ⚠ THE COLOURS ARE CANON, NOT TASTE. By the 09-22 light law the Green is the BRIGHTEST ground in
// the game (four keepers' tending at one point, the greyfield's exact opposite). And an open slot
// is the Ather — the same starry dark as outside the fold, never a drained or greyed ground.
// Canon calls that one "the guard most likely to ship wrong": grey would say something died there.
//
// Run: tools/devwin.sh play  ->  http://localhost:3203/shimmer/dev/cluster   (any lane but hub)

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CLUSTER, QUARTERS, clusterAt, clusterReach, cornersGiven, isCluster,
  type ClusterConfig, type QuarterId,
} from '../../voxel/cluster'
import { PLOT_TIERS } from '../../voxel/plot'

const SIZE = 560

const SEEDS: Record<QuarterId, number> = { ne: 1, nw: 7, sw: 42, se: 555 }

/** Each quarter's turf, nudged apart so four folds read as four people's gardens. */
const TURF: Record<QuarterId, [number, number, number]> = {
  ne: [79, 127, 66], nw: [89, 135, 63], sw: [73, 122, 74], se: [84, 127, 60],
}
const GREEN: [number, number, number] = [143, 208, 106]  // the brightest ground in the game
const JOIN: [number, number, number] = [96, 124, 84]     // the lane: low ground, still tended
const CLOUD: [number, number, number] = [207, 215, 228]  // pressed cloud, the fold's wall
const ATHER: [number, number, number] = [10, 12, 22]     // the void. An open slot is THIS.

const LABEL: Record<QuarterId, string> = { ne: 'NE', nw: 'NW', sw: 'SW', se: 'SE' }
const hex = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`

export default function ClusterPreview() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [tiers, setTiers] = useState<Record<QuarterId, number>>({ ne: 2, nw: 1, sw: 0, se: 2 })
  const [on, setOn] = useState<Record<QuarterId, boolean>>({ ne: true, nw: true, sw: true, se: false })
  const [green, setGreen] = useState(DEFAULT_CLUSTER.green)
  const [lane, setLane] = useState(DEFAULT_CLUSTER.joinHalfWidth)
  const [zoom, setZoom] = useState(1)
  const [ms, setMs] = useState(0)

  const cfg: ClusterConfig = useMemo(() => ({
    ...DEFAULT_CLUSTER, green, joinHalfWidth: lane,
    slots: Object.fromEntries(QUARTERS.map(q =>
      [q, on[q] ? { seed: SEEDS[q], tier: tiers[q] } : null])) as ClusterConfig['slots'],
  }), [on, tiers, green, lane])

  // Fitted to the FULL four-quarter footprint at max tier and held fixed, so toggling a slot does
  // not rescale the picture underneath the thing being compared.
  const frame = useMemo(() => clusterReach({
    ...cfg, slots: Object.fromEntries(QUARTERS.map(q => [q, { seed: SEEDS[q], tier: 2 }])) as ClusterConfig['slots'],
  }) * 1.04, [green, lane]) // eslint-disable-line react-hooks/exhaustive-deps

  const half = frame / zoom
  const per = (half * 2) / SIZE

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const t0 = performance.now()
    const img = ctx.createImageData(SIZE, SIZE)
    for (let py = 0; py < SIZE; py++) {
      const z = half - (py + 0.5) * per         // +z is north, so it runs UP the canvas
      for (let px = 0; px < SIZE; px++) {
        const x = -half + (px + 0.5) * per
        const c = clusterAt(x, z, cfg)
        const rgb = c.part === 'quarter' ? TURF[c.quarter!]
          : c.part === 'green' ? GREEN
          : c.part === 'join' ? JOIN
          : c.part === 'wall' ? CLOUD
          : ATHER
        const o = (py * SIZE + px) * 4
        img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(SIZE / 2, 0); ctx.lineTo(SIZE / 2, SIZE)
    ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2); ctx.stroke()
    setMs(Math.round(performance.now() - t0))
  }, [cfg, half, per])

  const given = cornersGiven(cfg)
  const wallPx = DEFAULT_CLUSTER.base.wallWidth / per

  return (
    <main style={{ minHeight: '100vh', background: '#0b0d14', color: '#dfe5ef', padding: 24,
      font: '13px/1.6 ui-monospace, monospace' }}>
      <h1 style={{ font: '600 15px/1.4 ui-monospace, monospace', letterSpacing: '0.12em',
        textTransform: 'uppercase', margin: '0 0 4px' }}>Garden cluster · plan</h1>
      <p style={{ margin: '0 0 18px', color: '#8892a6', maxWidth: 680 }}>
        One fold with four thresholds, not four folds with doors. Nobody is clipped — every keeper
        keeps their whole island, and the lanes cross the gap so a tier-0 friend is connected from
        the day the cluster forms. The Green is made of the corners given, so two keepers make half.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <canvas ref={ref} width={SIZE} height={SIZE}
          style={{ width: SIZE, height: SIZE, borderRadius: 4, imageRendering: 'pixelated' }} />

        <div style={{ display: 'grid', gap: 13, minWidth: 280 }}>
          {QUARTERS.map(q => (
            <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setOn(s => ({ ...s, [q]: !s[q] }))}
                style={{ width: 62, padding: '5px 0', borderRadius: 3, cursor: 'pointer',
                  border: `1px solid ${on[q] ? hex(TURF[q]) : '#2a3040'}`,
                  background: on[q] ? hex(TURF[q]) : 'transparent',
                  color: on[q] ? '#0b0d14' : '#6b7488', font: '600 12px ui-monospace, monospace' }}>
                {LABEL[q]}
              </button>
              <span style={{ color: on[q] ? '#dfe5ef' : '#4a5264', minWidth: 80 }}>
                {on[q] ? `tier ${tiers[q]} · ${PLOT_TIERS[tiers[q]]}` : 'held open'}
              </span>
              <input type="range" min={0} max={2} step={1} value={tiers[q]} disabled={!on[q]}
                onChange={e => setTiers(s => ({ ...s, [q]: Number(e.target.value) }))}
                style={{ width: 90 }} />
            </div>
          ))}

          <hr style={{ border: 0, borderTop: '1px solid #1d2331', margin: '3px 0' }} />

          {([['zoom', zoom, 1, 12, 0.5, setZoom, `${zoom}×`],
             ['green', green, 80, 400, 10, setGreen, `${green * 2} across`],
             ['lane', lane, 20, 160, 5, setLane, `${lane * 2} wide`]] as const).map(
            ([label, val, lo, hi, step, set, note]) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ minWidth: 52, color: '#8892a6' }}>{label}</span>
                <input type="range" min={lo} max={hi} step={step} value={val}
                  onChange={e => (set as (n: number) => void)(Number(e.target.value))}
                  style={{ width: 118 }} />
                <span style={{ color: '#aab3c4' }}>{note}</span>
              </label>
            ))}

          <div style={{ color: '#8892a6', marginTop: 2 }}>
            <div>{given} corner{given === 1 ? '' : 's'} given · the Green is {given}/4</div>
            <div>{isCluster(cfg) ? 'a cluster' : 'one keeper — a plot, not a cluster'}</div>
            <div>reach {Math.round(clusterReach(cfg))} blocks · {per.toFixed(2)} blocks/px · {ms}ms</div>
            {/* ⚠ The honest half: say so when an element is too thin to be in the image. */}
            <div style={{ color: wallPx < 1 ? '#d8a657' : '#6f8f5f' }}>
              {wallPx < 1
                ? `⚠ the cloud wall is ${wallPx.toFixed(2)}px — thinner than a pixel, so it is NOT in this picture. Zoom in before judging an edge.`
                : `the cloud wall is ${wallPx.toFixed(1)}px and visible`}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 4, marginTop: 4, color: '#8892a6' }}>
            {([[GREEN, 'the Green — brightest ground in the game'],
               [TURF.ne, 'a keeper’s own fold, whole, nothing clipped'],
               [JOIN, 'the lane to the middle and to a neighbour'],
               [CLOUD, 'the fold’s cloud wall'],
               [ATHER, 'the Ather — and an open slot']] as const).map(([c, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, background: hex(c as [number, number, number]),
                    borderRadius: 2, border: '1px solid #222836' }} />
                  <span>{label}</span>
                </div>
              ))}
          </div>
          <p style={{ color: '#5c6577', maxWidth: 300, marginTop: 2 }}>
            ⚠ &ldquo;lane&rdquo; is a placeholder. Alex&rsquo;s word is <i>valley</i>, and the Rebirth
            Valleys are already canon, so the name is with the Magii seat.
          </p>
        </div>
      </div>
    </main>
  )
}
