'use client'

// Mesher spike, on the device that actually matters.
//
// VOXEL-WORLD-MODEL.md § 2 established that section size is a RE-MESH cost decision, not a memory
// one. The server bench (src/app/shimmer/voxel/bench.ts) answers it at 16 — but the ruling target is
// a phone, and a phone is not a slower server: it thermal-throttles, has a smaller cache, and
// Safari's JIT warms differently. This page exists so the decision rests on Alex's actual device.
//
// ★ THIS FILE IS HOST SIDE, ON PURPOSE. It imports React. The mesher it measures does not, and
// purity.test.ts enforces that. The whole portability strategy is that the boundary runs right
// here: the core computes, the host renders.

import { useState, useRef, useCallback } from 'react'
import { Section } from '../../voxel/section'
import { greedyMesh, createMeshScratch } from '../../voxel/greedy'

const SIZES = [8, 16, 32, 64]

const hash = (x: number, y: number, z: number, seed = 1337): number => {
  let h = seed ^ (x * 374761393) ^ (y * 668265263) ^ (z * 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const smooth = (x: number, z: number, freq: number): number => {
  const xf = x * freq, zf = z * freq
  const x0 = Math.floor(xf), z0 = Math.floor(zf)
  const tx = xf - x0, tz = zf - z0
  const l = (a: number, b: number, t: number) => a + (b - a) * (t * t * (3 - 2 * t))
  return l(l(hash(x0, 0, z0), hash(x0 + 1, 0, z0), tx), l(hash(x0, 0, z0 + 1), hash(x0 + 1, 0, z0 + 1), tz), tz)
}

// Same fillers as the headless bench — deliberately NOT random, because random is the worst case for
// merging and our world is mostly flat ground over solid rock, which is greedy's best case.
const FILLS: Record<string, (S: number, oy: number) => Section> = {
  surface: (S, oy) => {
    const s = new Section(S)
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const h = 40 + Math.floor(smooth(x, z, 0.06) * 14)
      for (let y = 0; y < S; y++) {
        const wy = oy + y
        if (wy > h) continue
        s.set(x, y, z, wy === h ? 2 : wy > h - 4 ? 3 : hash(x, wy, z, 99) < 0.008 ? 5 : 1)
      }
    }
    return s
  },
  underground: (S, oy) => {
    const s = new Section(S)
    for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++)
      s.set(x, y, z, hash(x, oy + y, z, 7) < 0.012 ? 5 : 1)
    return s
  },
  caves: (S, oy) => {
    const s = new Section(S)
    for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const wy = oy + y
      const d = smooth(x + wy * 3, z + wy * 5, 0.08)
      s.set(x, y, z, d > 0.42 && d < 0.58 ? 0 : 1)
    }
    return s
  },
  checkerboard: (S) => {
    const s = new Section(S)
    for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++)
      if ((x + y + z) % 2 === 0) s.set(x, y, z, 1)
    return s
  },
}
const CASE_OY: Record<string, number> = { surface: 32, underground: 8, caves: 16, checkerboard: 0 }

interface Row { size: number; per: Record<string, number>; quads: Record<string, number>; worst8: number }

export default function MeshBench() {
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState('')
  const abort = useRef(false)

  const run = useCallback(async () => {
    setRunning(true); setRows([]); abort.current = false
    setNote('warming up — keep the screen on and the tab focused')
    const out: Row[] = []
    for (const S of SIZES) {
      if (abort.current) break
      const per: Record<string, number> = {}
      const quads: Record<string, number> = {}
      const scratch = createMeshScratch(S)
      for (const name of Object.keys(FILLS)) {
        const sec = FILLS[name](S, CASE_OY[name])
        const iters = S >= 64 ? 15 : S >= 32 ? 60 : 200
        for (let i = 0; i < Math.max(3, iters >> 2); i++) greedyMesh(sec, undefined, scratch)  // JIT warm
        const t0 = performance.now()
        for (let i = 0; i < iters; i++) greedyMesh(sec, undefined, scratch)
        per[name] = (performance.now() - t0) / iters
        quads[name] = greedyMesh(sec, undefined, scratch).quads
        setNote(`size ${S} · ${name}`)
        await new Promise(r => setTimeout(r, 0))   // yield so the page stays alive on a phone
      }
      out.push({ size: S, per, quads, worst8: per.surface * 8 })
      setRows([...out])
    }
    setNote(''); setRunning(false)
  }, [])

  const verdict = (r: Row): { text: string; cls: string } => {
    // A frame is 16.7ms. The number that matters is the WORST case — a block broken on a section
    // corner dirties its own section and up to 7 neighbours. If that fits in a frame, breaking a
    // block never drops one.
    if (r.worst8 < 4) return { text: 'comfortable', cls: 'text-emerald-400' }
    if (r.worst8 < 16.7) return { text: 'fits, no headroom', cls: 'text-amber-400' }
    return { text: 'drops frames', cls: 'text-red-400' }
  }

  return (
    <div className="p-4 max-w-[900px] mx-auto text-slate-200">
      <h1 className="text-lg font-semibold tracking-wide uppercase">Mesher spike</h1>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
        Section size is a <strong className="text-slate-200">re-mesh cost</strong> decision, not a memory one — memory
        totals are identical at every width. What changes is how much geometry rebuilds when you break one block.
        The server says <strong className="text-slate-200">16</strong>. This says what your phone thinks.
      </p>

      <div className="flex gap-2 mt-4">
        <button
          onClick={run}
          disabled={running}
          className="px-4 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 text-sm font-medium uppercase tracking-wider"
        >
          {running ? 'Running…' : 'Run benchmark'}
        </button>
        {running && (
          <button onClick={() => { abort.current = true }} className="px-3 py-2 rounded bg-slate-700 text-sm">Stop</button>
        )}
        {note && <span className="self-center text-xs text-slate-400 tabular-nums">{note}</span>}
      </div>

      {rows.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-xs tabular-nums border-collapse">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 pr-3">size</th>
                <th className="text-right px-2">surface</th>
                <th className="text-right px-2">under</th>
                <th className="text-right px-2">caves</th>
                <th className="text-right px-2">checker</th>
                <th className="text-right px-2">worst ×8</th>
                <th className="text-left pl-3">verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const v = verdict(r)
                return (
                  <tr key={r.size} className="border-b border-slate-800">
                    <td className="py-2 pr-3 font-semibold">{r.size}³</td>
                    <td className="text-right px-2">{r.per.surface?.toFixed(3)}</td>
                    <td className="text-right px-2">{r.per.underground?.toFixed(3)}</td>
                    <td className="text-right px-2">{r.per.caves?.toFixed(3)}</td>
                    <td className="text-right px-2 opacity-50">{r.per.checkerboard?.toFixed(3)}</td>
                    <td className="text-right px-2 font-semibold">{r.worst8.toFixed(2)}</td>
                    <td className={`pl-3 ${v.cls}`}>{v.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            All figures ms. <strong>worst ×8</strong> is the number that decides it: a block broken on a section corner
            dirties its own section and up to 7 neighbours. Under 16.7ms means breaking a block never drops a frame —
            and that is before moving the mesher into a Worker, which buys the whole budget back.
            Checkerboard is a bound, not a case: nothing merges, and no real terrain looks like it.
          </p>
        </div>
      )}
    </div>
  )
}
