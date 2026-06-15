'use client'

// Crucible editor — the integration hub (Shimmer /dev pattern).
// Art is drawn in Aseprite; this is where layouts are built and balanced.
// Two floors per node: the ARENA (teams + sealed portal) and the GAUNTLET
// (the host's guard hall + the vault).

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CrucibleDoc, FloorDoc, TILE } from '../lib/types'
import { demoCrucible, docFloors, emptyCrucible, emptyMidFloor, loadCrucible, maxFloors, saveCrucible } from '../lib/crucible'
import { runMatch } from '../lib/sim'
import { hostLevelFor, loadHost, pieceCaps } from '../lib/host'
import Terrarium from '../components/Terrarium'

const PX = 14

type Tool = 'wall' | 'floor' | 'gate' | 'vault' | 'portal' | 'spike' | 'guard' | 'watcher' | 'erase'

// where a tool may be used in the chain: anywhere, any floor but the last
// (portals lead UP), or the last floor only (the vault)
type ToolWhere = 'any' | 'notLast' | 'lastOnly'

const TOOLS: { id: Tool; label: string; hint: string; where: ToolWhere }[] = [
  { id: 'wall', label: 'Wall', hint: 'stone — blocks all', where: 'any' },
  { id: 'floor', label: 'Floor', hint: 'open ground', where: 'any' },
  { id: 'gate', label: 'Gate', hint: 'first floor: team spawn · above: arrival', where: 'any' },
  { id: 'portal', label: 'Portal', hint: 'the red hex — the way up', where: 'notLast' },
  { id: 'vault', label: 'Vault', hint: 'the prize (last floor)', where: 'lastOnly' },
  { id: 'spike', label: 'Spike', hint: 'trap — fires on entry', where: 'any' },
  { id: 'guard', label: 'Guard', hint: 'construct — pins and fights', where: 'any' },
  { id: 'watcher', label: 'Watcher', hint: 'posted eye — holds a sightline, never walks', where: 'any' },
  { id: 'erase', label: 'Erase', hint: 'remove pieces / wall→floor', where: 'any' },
]

function toolAllowed(where: ToolWhere, idx: number, last: number): boolean {
  if (where === 'lastOnly') return idx === last
  if (where === 'notLast') return idx < last
  return true
}

// write floor idx back into the doc shape (arena / mids / gauntlet)
function withFloorAt(doc: CrucibleDoc, idx: number, nf: FloorDoc): CrucibleDoc {
  const n = 2 + (doc.mids?.length ?? 0)
  if (idx === 0) return { ...doc, arena: nf }
  if (idx === n - 1) return { ...doc, gauntlet: nf }
  const mids = [...(doc.mids ?? [])]
  mids[idx - 1] = nf
  return { ...doc, mids }
}

interface BalanceReport {
  runs: number
  winRate: number
  gauntletRate: number
  avgDepth: number
  avgYield: number
}

function EditorInner() {
  const params = useSearchParams()
  const mode = params.get('mode') ?? 'layout' // future: 'fighters', 'sprites', ...
  const [doc, setDoc] = useState<CrucibleDoc | null>(null)
  const [floorIdx, setFloorIdx] = useState(0)
  const [tool, setTool] = useState<Tool>('wall')
  const [report, setReport] = useState<BalanceReport | null>(null)
  const [testing, setTesting] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [hostLv, setHostLv] = useState(0)
  const [capMsg, setCapMsg] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paintingRef = useRef(false)

  useEffect(() => {
    setDoc(loadCrucible() ?? demoCrucible())
    setHostLv(hostLevelFor(loadHost().exp))
  }, [])

  const chain = doc ? docFloors(doc) : []
  const lastIdx = chain.length - 1
  const floor: FloorDoc | null = chain[floorIdx] ?? null

  const applyTool = useCallback(
    (tx: number, ty: number) => {
      // structural allowance — the host must grow to field more
      if ((tool === 'spike' || tool === 'guard' || tool === 'watcher') && floor) {
        const cap = pieceCaps(hostLv)[tool]
        const have = floor.pieces.filter((p) => p.kind === tool).length
        const occupied = floor.pieces.some((p) => p.x === tx && p.y === ty)
        if (!occupied && have >= cap) {
          setCapMsg(`host level ${hostLv} fields ${cap} ${tool}s per floor — the host must grow`)
          return
        }
      }
      setCapMsg(null)
      setDoc((prev) => {
        if (!prev) return prev
        const pchain = docFloors(prev)
        const plast = pchain.length - 1
        const f = pchain[floorIdx]
        if (!f) return prev
        if (tx < 0 || ty < 0 || tx >= f.w || ty >= f.h) return prev
        const onPerimeter = tx === 0 || ty === 0 || tx === f.w - 1 || ty === f.h - 1
        if (onPerimeter && tool !== 'gate' && tool !== 'vault' && tool !== 'portal') return prev

        const nf: FloorDoc = { ...f, tiles: [...f.tiles], pieces: [...f.pieces] }
        const idx = ty * nf.w + tx
        const dropPieces = () => {
          nf.pieces = nf.pieces.filter((p) => !(p.x === tx && p.y === ty))
        }
        switch (tool) {
          case 'wall':
            nf.tiles[idx] = TILE.WALL
            dropPieces()
            break
          case 'floor':
            nf.tiles[idx] = TILE.FLOOR
            break
          case 'gate':
            nf.tiles[idx] = TILE.GATE
            dropPieces()
            break
          case 'vault':
            if (floorIdx !== plast) return prev
            nf.tiles[idx] = TILE.VAULT
            dropPieces()
            break
          case 'portal':
            if (floorIdx === plast) return prev
            nf.tiles[idx] = TILE.PORTAL
            dropPieces()
            break
          case 'spike':
          case 'guard':
          case 'watcher':
            if (nf.tiles[idx] === TILE.WALL) return prev
            dropPieces()
            nf.pieces.push({ kind: tool, x: tx, y: ty })
            break
          case 'erase':
            dropPieces()
            if (!onPerimeter && nf.tiles[idx] !== TILE.FLOOR) nf.tiles[idx] = TILE.FLOOR
            break
        }
        return withFloorAt(prev, floorIdx, nf)
      })
      setReport(null)
    },
    [tool, floorIdx, floor, hostLv],
  )

  // editor canvas painting
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !floor) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = floor.w * PX
    const H = floor.h * PX
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#070a10'
    ctx.fillRect(0, 0, W, H)
    for (let y = 0; y < floor.h; y++) {
      for (let x = 0; x < floor.w; x++) {
        const t = floor.tiles[y * floor.w + x]
        const px = x * PX
        const py = y * PX
        if (t === TILE.WALL) {
          ctx.fillStyle = '#1b2233'
          ctx.fillRect(px, py, PX, PX)
        } else if (t === TILE.GATE) {
          ctx.fillStyle = '#22d3ee'
          ctx.fillRect(px + 2, py + 2, PX - 4, PX - 4)
        } else if (t === TILE.VAULT) {
          ctx.fillStyle = '#facc15'
          ctx.fillRect(px + 2, py + 2, PX - 4, PX - 4)
        } else if (t === TILE.PORTAL) {
          ctx.fillStyle = '#ef4444'
          const cx = px + PX / 2
          const cy = py + PX / 2
          const r = PX / 2 - 1
          ctx.beginPath()
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6
            ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + r * Math.cos(a), cy + r * Math.sin(a))
          }
          ctx.closePath()
          ctx.fill()
        } else if ((x + y) % 2 === 0) {
          ctx.fillStyle = '#0a0e16'
          ctx.fillRect(px, py, PX, PX)
        }
      }
    }
    for (const p of floor.pieces) {
      const cx = p.x * PX + PX / 2
      const cy = p.y * PX + PX / 2
      if (p.kind === 'spike') {
        ctx.fillStyle = '#8b5cf6'
        ctx.beginPath()
        ctx.moveTo(cx, cy - 4)
        ctx.lineTo(cx + 4, cy)
        ctx.lineTo(cx, cy + 4)
        ctx.lineTo(cx - 4, cy)
        ctx.closePath()
        ctx.fill()
      } else if (p.kind === 'watcher') {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(cx, cy - 5)
        ctx.lineTo(cx + 5, cy)
        ctx.lineTo(cx, cy + 5)
        ctx.lineTo(cx - 5, cy)
        ctx.closePath()
        ctx.stroke()
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(cx, cy, 1.8, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = '#ef4444'
        ctx.fillRect(p.x * PX + 3, p.y * PX + 3, PX - 6, PX - 6)
      }
    }
    ctx.strokeStyle = 'rgba(148,163,184,0.05)'
    for (let x = 0; x <= floor.w; x++) {
      ctx.beginPath()
      ctx.moveTo(x * PX, 0)
      ctx.lineTo(x * PX, H)
      ctx.stroke()
    }
    for (let y = 0; y <= floor.h; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * PX)
      ctx.lineTo(W, y * PX)
      ctx.stroke()
    }
  }, [floor])

  const tileFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    return {
      tx: Math.floor((e.clientX - rect.left) / PX),
      ty: Math.floor((e.clientY - rect.top) / PX),
    }
  }

  const runBalance = useCallback(() => {
    if (!doc) return
    setTesting(true)
    setTimeout(() => {
      const RUNS = 200
      let wins = 0
      let gauntlets = 0
      let depth = 0
      let yld = 0
      for (let i = 0; i < RUNS; i++) {
        const r = runMatch(doc, 1000 + i)
        if (r.victory) wins++
        if (r.reachedGauntlet) gauntlets++
        depth += r.deepest
        yld += r.manaYield
      }
      setReport({
        runs: RUNS,
        winRate: wins / RUNS,
        gauntletRate: gauntlets / RUNS,
        avgDepth: depth / RUNS,
        avgYield: yld / RUNS,
      })
      setTesting(false)
    }, 30)
  }, [doc])

  if (!doc || !floor) return <div className="min-h-screen bg-[#070a10]" />

  // balance verdict — the almost-beatable law, in the editor's face
  const verdict = !report
    ? null
    : report.gauntletRate < 0.3
      ? { text: 'ARENA EATS EVERYONE — the gauntlet barely sees visitors. Soften the arena.', tone: 'text-red-400' }
      : report.winRate === 0 && report.avgDepth < 0.6
        ? { text: 'MEAT GRINDER — everything dies at the door. Crumb yield. Open it up.', tone: 'text-red-400' }
        : report.winRate > 0.35
          ? { text: 'OPEN DOOR — the vault falls too often. Tighten the guard hall.', tone: 'text-yellow-400' }
          : { text: 'ALMOST-BEATABLE — drama is high, the harvest is rich. The forge approves.', tone: 'text-emerald-400' }

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-300 font-mono">
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <header className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-cyan-300 text-lg tracking-[0.3em]">
              NOLMIR <span className="text-slate-600">/ crucible editor</span>
            </h1>
            <p className="text-slate-600 text-xs mt-1">mode: {mode} · paint with mouse · art belongs to Aseprite</p>
          </div>
          <a href="/nolmir/crucible" className="text-slate-500 hover:text-cyan-300 text-sm">
            [back to the terrarium]
          </a>
        </header>

        {/* floor tabs — the chain: arena -> mids -> gauntlet */}
        <div className="flex gap-2 mb-3 items-center">
          {chain.map((_, k) => (
            <button
              key={k}
              onClick={() => {
                setFloorIdx(k)
                const t = TOOLS.find((t) => t.id === tool)
                if (t && !toolAllowed(t.where, k, lastIdx)) setTool('wall')
              }}
              className={`px-4 py-1 text-xs rounded-t border-b-2 transition-colors ${
                floorIdx === k
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-600 hover:text-slate-400'
              }`}
            >
              {k === 0 ? 'THE ARENA' : k === lastIdx ? 'THE GAUNTLET' : `FLOOR ${k + 1}`}
            </button>
          ))}
          {hostLv >= 3 && chain.length < maxFloors(hostLv) && (
            <button
              onClick={() => {
                setDoc((prev) => (prev ? { ...prev, mids: [...(prev.mids ?? []), emptyMidFloor()] } : prev))
                setFloorIdx(chain.length - 1) // the new mid slides in before the gauntlet
                setReport(null)
              }}
              className="px-3 py-1 text-xs rounded border border-amber-700 text-amber-300 hover:bg-amber-950/40"
              title="host lv3 structure — a new floor before the gauntlet"
            >
              + ADD FLOOR
            </button>
          )}
          {floorIdx > 0 && floorIdx < lastIdx && (
            <button
              onClick={() => {
                setDoc((prev) => {
                  if (!prev) return prev
                  const mids = [...(prev.mids ?? [])]
                  mids.splice(floorIdx - 1, 1)
                  return { ...prev, mids }
                })
                setFloorIdx(0)
                setReport(null)
              }}
              className="px-3 py-1 text-xs rounded border border-red-900 text-red-400/80 hover:bg-red-950/40"
              title="collapse this floor"
            >
              ✕ COLLAPSE
            </button>
          )}
          {hostLv < 3 && (
            <span className="text-[10px] text-slate-700 self-center">3rd floor unlocks at host lv 3</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {TOOLS.filter((t) => toolAllowed(t.where, floorIdx, lastIdx)).map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.hint}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                tool === t.id
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/40'
                  : 'border-slate-800 text-slate-500 hover:border-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="text-[10px] text-slate-600 self-center ml-2">
            host lv {hostLv} · guards {floor?.pieces.filter((p) => p.kind === 'guard').length ?? 0}/
            {pieceCaps(hostLv).guard} · spikes {floor?.pieces.filter((p) => p.kind === 'spike').length ?? 0}/
            {pieceCaps(hostLv).spike} · watchers {floor?.pieces.filter((p) => p.kind === 'watcher').length ?? 0}/
            {pieceCaps(hostLv).watcher}
          </span>
          <span className="flex-1" />
          <button
            onClick={() => {
              saveCrucible(doc)
              setSavedAt(Date.now())
            }}
            className="px-3 py-1 text-xs rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-950/40"
          >
            Save {savedAt && Date.now() - savedAt < 3000 ? '✓' : ''}
          </button>
          <button
            onClick={runBalance}
            disabled={testing}
            className="px-3 py-1 text-xs rounded border border-violet-700 text-violet-300 hover:bg-violet-950/40 disabled:opacity-40"
          >
            {testing ? 'Running 200 matches…' : 'Balance test'}
          </button>
          <button
            onClick={() => {
              setDoc(demoCrucible())
              setReport(null)
            }}
            className="px-3 py-1 text-xs rounded border border-slate-800 text-slate-500 hover:border-slate-600"
          >
            Demo
          </button>
          <button
            onClick={() => {
              setDoc(emptyCrucible())
              setReport(null)
            }}
            className="px-3 py-1 text-xs rounded border border-slate-800 text-slate-500 hover:border-slate-600"
          >
            Clear
          </button>
        </div>
        {capMsg && <div className="text-[10px] text-amber-400/80 mb-2">{capMsg}</div>}

        <div className="overflow-x-auto flex justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-lg border border-slate-800 cursor-crosshair"
            onMouseDown={(e) => {
              paintingRef.current = true
              const { tx, ty } = tileFromEvent(e)
              applyTool(tx, ty)
            }}
            onMouseMove={(e) => {
              if (!paintingRef.current) return
              const { tx, ty } = tileFromEvent(e)
              applyTool(tx, ty)
            }}
            onMouseUp={() => (paintingRef.current = false)}
            onMouseLeave={() => (paintingRef.current = false)}
          />
        </div>

        {report && (
          <section className="mt-4 text-sm space-y-1">
            <div className="flex flex-wrap gap-6">
              <span>
                vault falls <b className="text-yellow-300">{(report.winRate * 100).toFixed(1)}%</b>
              </span>
              <span>
                reach gauntlet <b className="text-red-300">{(report.gauntletRate * 100).toFixed(0)}%</b>
              </span>
              <span>
                avg depth <b className="text-cyan-300">{(report.avgDepth * 100).toFixed(0)}%</b>
              </span>
              <span>
                avg yield <b className="text-violet-300">{report.avgYield.toFixed(0)} mana</b>
              </span>
              <span className="text-slate-600">({report.runs} seeded matches)</span>
            </div>
            {verdict && <p className={`${verdict.tone} text-xs`}>{verdict.text}</p>}
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-slate-500 text-xs tracking-widest mb-2 text-center">LIVE PREVIEW — full match, both floors</h2>
          <div className="overflow-x-auto flex justify-center opacity-90">
            <div className="scale-75 origin-top">
              <Terrarium doc={doc} tickMs={45} pauseMs={1200} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default function NolmirDevPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070a10]" />}>
      <EditorInner />
    </Suspense>
  )
}
