'use client'

// The voxel world you can walk, mine and build in. A test bed, on its own route, on purpose.
//
// ⚠ NOT WIRED INTO Shimmer3D, DELIBERATELY. That file is ~5,900 lines of the live game (mortal
// side, holds, Crucible, and the warp/mount path that produced four bugs on 08-06) while this walks
// a DIFFERENT WORLD MODEL — no zones, no tiles, no warps. Integration is a later decision.
//
// ⚠ GENERATION RUNS ON THE MAIN THREAD RIGHT NOW, ON PURPOSE. The Worker is written
// (`src/workers/voxel-gen.worker.ts`, bundled by `scripts/build-worker.mjs`) and its BUNDLING is
// solved, but it does not deliver — no `ready` ack, no error. Rather than carry two code paths when
// the second cannot be exercised, there is ONE path. Block edits, re-meshing and collision all read
// the same column cache, which is what makes mining tractable at all. Restore the worker by
// forwarding edits to it; the edit path is the piece that has to change.

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { SECTION, DEFAULT_COLUMN, makeColumn, meshColumn, refreshUniform, type Column } from '../voxel/column'
import { createMeshScratch } from '../voxel/greedy'
import { columnHeight } from '../voxel/height'
import { AIR } from '../voxel/section'
import { MAT } from '../voxel/depth'
import { raycast, tickBreak, dropsFor, type BreakState } from '../voxel/mine'
import { blockDef, materialForItem, type BlockSkill } from '../voxel/registry'
import { toGeometry, createVoxelMaterial } from './mesh-bridge'
import { buildAttrs, MATERIAL_COLOR } from './attrs'
import { createInventory, addItems, removeItems, countItem, type Inventory } from '../engine/inventory'

const SEED = 1337
const H = DEFAULT_COLUMN.worldHeight
const RADIUS = 6
const REACH = 6            // how far you can mine or place, in voxels
const key = (cx: number, cz: number) => `${cx},${cz}`

interface Slot { itemId: string; count: number }

export default function VoxelWorld() {
  const [stats, setStats] = useState('generating…')
  const [pos, setPos] = useState('')
  const [hotbar, setHotbar] = useState<Slot[]>([])
  const [sel, setSel] = useState(0)
  const [tier, setTier] = useState(1)
  const [look, setLook] = useState<{ name: string; progress: number; refused: boolean } | null>(null)

  // ★ THE SPIKE IS CANON, NOT INVENTED. `engine/tools.ts` rules blades→forestry,
  // spikes→prospecting, rinsticks→rinning, with a basic Greg-given tool that never breaks. So
  // "what do I mine rock with" already had an answer and nothing here needed naming.
  const toolTier = useRef(1)
  const toolSkill = useRef<BlockSkill>('prospecting')
  const inv = useRef<Inventory>(createInventory())

  const refreshHotbar = useCallback(() => {
    const counts = new Map<string, number>()
    for (const s of inv.current.slots) if (s) counts.set(s.itemId, (counts.get(s.itemId) ?? 0) + s.count)
    setHotbar([...counts].map(([itemId, count]) => ({ itemId, count })).slice(0, 8))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= 8) setSel(n - 1)
      // Tool tier is a debug lever so the tier GATE can be felt in ten seconds: a tier-1 spike
      // REFUSES pure core, and that should be provable without crafting your way up first.
      if (e.code === 'BracketRight') { toolTier.current = Math.min(3, toolTier.current + 1); setTier(toolTier.current) }
      if (e.code === 'BracketLeft') { toolTier.current = Math.max(1, toolTier.current - 1); setTier(toolTier.current) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 bg-[#0b0d14]">
      <Canvas camera={{ fov: 75, near: 0.1, far: 600 }} shadows={false}>
        <color attach="background" args={['#8fb7d9']} />
        <fog attach="fog" args={['#8fb7d9', 80, 200]} />
        <hemisphereLight args={['#cfe6ff', '#3b3a4a', 1.5]} />
        <directionalLight position={[80, 200, 40]} intensity={1.5} />
        <ambientLight intensity={0.4} />
        <World
          inv={inv} toolTier={toolTier} toolSkill={toolSkill}
          selItem={hotbar[sel]?.itemId ?? null}
          onStats={setStats} onPos={p => setPos(`x ${p.x.toFixed(0)}  y ${p.y.toFixed(0)}  z ${p.z.toFixed(0)}`)}
          onLook={setLook} onInvChange={refreshHotbar}
        />
        <PointerLockControls />
      </Canvas>
      <Hud stats={stats} pos={pos} look={look} hotbar={hotbar} sel={sel} tier={tier} />
    </div>
  )
}

function Hud({ stats, pos, look, hotbar, sel, tier }: {
  stats: string; pos: string
  look: { name: string; progress: number; refused: boolean } | null
  hotbar: Slot[]; sel: number; tier: number
}) {
  return (
    <>
      <div className="absolute top-3 left-3 text-[11px] font-mono text-white/80 bg-black/45 rounded px-2.5 py-1.5 leading-relaxed pointer-events-none">
        <div className="text-white/95 font-semibold tracking-wide">SHIMMER · VOXEL TEST BED</div>
        <div>{pos}</div>
        <div className="text-white/55">{stats}</div>
        <div className="mt-1 text-white/45">click to look · WASD · space · shift run · F fly</div>
        <div className="text-white/45">hold LMB mine · RMB place · 1-8 slot · [ ] spike tier</div>
      </div>

      {look && (
        <div className="absolute left-1/2 top-[56%] -translate-x-1/2 text-center pointer-events-none">
          <div className={`text-[11px] font-mono tracking-wide ${look.refused ? 'text-red-300' : 'text-white/85'}`}>
            {look.name}{look.refused && ' — spike too weak'}
          </div>
          {look.progress > 0 && (
            <div className="mt-1 w-28 h-1 bg-black/50 rounded overflow-hidden mx-auto">
              <div className="h-full bg-amber-300" style={{ width: `${Math.min(100, look.progress * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/80 pointer-events-none" />

      {/* Colour swatches stand in for item art — the registry maps materials to tiles.ts later. */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
        {Array.from({ length: 8 }, (_, i) => {
          const s = hotbar[i]
          const mat = s ? materialForItem(s.itemId) : undefined
          const swatch = mat !== undefined ? `#${(MATERIAL_COLOR[mat] ?? 0x888888).toString(16).padStart(6, '0')}` : undefined
          return (
            <div key={i} className={`w-12 h-12 rounded border-2 flex flex-col items-center justify-center text-[9px] font-mono
              ${i === sel ? 'border-amber-300 bg-black/60' : 'border-white/20 bg-black/40'}`}>
              {s ? (
                <>
                  <div className="w-5 h-5 rounded-sm border border-white/25" style={{ background: swatch ?? '#6b7280' }} />
                  <div className="text-white/80 mt-0.5">{s.count}</div>
                </>
              ) : <span className="text-white/25">{i + 1}</span>}
            </div>
          )
        })}
      </div>
      <div className="absolute bottom-[4.6rem] left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/50 pointer-events-none">
        spike tier {tier}
      </div>
    </>
  )
}

const SOLID_EXCEPT = new Set<number>([AIR, MAT.WATER])
const isSolid = (m: number) => !SOLID_EXCEPT.has(m)

function World({ inv, toolTier, toolSkill, selItem, onStats, onPos, onLook, onInvChange }: {
  inv: React.RefObject<Inventory>
  toolTier: React.RefObject<number>
  toolSkill: React.RefObject<BlockSkill>
  selItem: string | null
  onStats: (s: string) => void
  onPos: (p: THREE.Vector3) => void
  onLook: (l: { name: string; progress: number; refused: boolean } | null) => void
  onInvChange: () => void
}) {
  const { camera } = useThree()
  const group = useRef<THREE.Group>(null)
  const highlight = useRef<THREE.LineSegments>(null)
  const material = useMemo(() => createVoxelMaterial(), [])
  const scratch = useMemo(() => createMeshScratch(SECTION), [])
  const cols = useRef(new Map<string, Column>())
  const drawn = useRef(new Map<string, THREE.Mesh>())
  const breaking = useRef<BreakState | null>(null)
  const mouse = useRef({ left: false, right: false })
  const frame = useRef(0)
  const settled = useRef(false)
  const vel = useRef(new THREE.Vector3())
  const keys = useRef<Record<string, boolean>>({})
  const fly = useRef(false)
  const onGround = useRef(false)

  useEffect(() => {
    const kd = (e: KeyboardEvent) => { keys.current[e.code] = true; if (e.code === 'KeyF') fly.current = !fly.current }
    const ku = (e: KeyboardEvent) => { keys.current[e.code] = false }
    const md = (e: MouseEvent) => { if (e.button === 0) mouse.current.left = true; if (e.button === 2) mouse.current.right = true }
    const mu = (e: MouseEvent) => { if (e.button === 0) mouse.current.left = false; if (e.button === 2) mouse.current.right = false }
    const ctx = (e: Event) => e.preventDefault()
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    window.addEventListener('mousedown', md); window.addEventListener('mouseup', mu)
    window.addEventListener('contextmenu', ctx)
    return () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
      window.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu)
      window.removeEventListener('contextmenu', ctx)
    }
  }, [])

  useEffect(() => { camera.position.set(0.5, columnHeight(0, 0, SEED) + 2.6, 0.5) }, [camera])

  const voxel = useCallback((wx: number, wy: number, wz: number): number => {
    if (wy < 0 || wy >= H) return AIR
    const cx = Math.floor(wx / SECTION), cz = Math.floor(wz / SECTION)
    const c = cols.current.get(key(cx, cz))
    if (!c) return AIR
    return c.get(wx - cx * SECTION, wy, wz - cz * SECTION)
  }, [])

  const remesh = useCallback((cx: number, cz: number) => {
    const g = group.current
    const c = cols.current.get(key(cx, cz))
    if (!g || !c) return
    const k = key(cx, cz)
    for (const [mk, m] of drawn.current) {
      if (!mk.startsWith(k + ':')) continue
      g.remove(m); m.geometry.dispose(); drawn.current.delete(mk)
    }
    for (const sm of meshColumn(c, {
      negX: cols.current.get(key(cx - 1, cz)) ?? null,
      posX: cols.current.get(key(cx + 1, cz)) ?? null,
      negZ: cols.current.get(key(cx, cz - 1)) ?? null,
      posZ: cols.current.get(key(cx, cz + 1)) ?? null,
    }, scratch)) {
      const mesh = new THREE.Mesh(toGeometry(buildAttrs(sm.mesh)), material)
      mesh.position.set(sm.wx, sm.wy, sm.wz)
      g.add(mesh)
      drawn.current.set(`${k}:${sm.index}`, mesh)
    }
  }, [material, scratch])

  /**
   * Write one voxel and repair the geometry.
   *
   * ★ THE NEIGHBOUR RE-MESH IS NOT OPTIONAL. Editing a voxel on a column's edge changes which faces
   * the NEIGHBOUR should draw — mine the last block of a column and, without this, the neighbour
   * keeps the wall it drew while that block still existed. It reads as an invisible pane you cannot
   * mine, sitting at exactly the seams a player walks along.
   *
   * `refreshUniform` matters for the same class of reason: the mesher's skip reads that table, and
   * a stale entry means dropped faces.
   */
  const setVoxel = useCallback((wx: number, wy: number, wz: number, mat: number) => {
    const cx = Math.floor(wx / SECTION), cz = Math.floor(wz / SECTION)
    const c = cols.current.get(key(cx, cz))
    if (!c) return
    const lx = wx - cx * SECTION, lz = wz - cz * SECTION
    const s = (wy / SECTION) | 0
    c.sections[s].set(lx, wy - s * SECTION, lz, mat)
    refreshUniform(c)
    remesh(cx, cz)
    if (lx === 0) remesh(cx - 1, cz)
    if (lx === SECTION - 1) remesh(cx + 1, cz)
    if (lz === 0) remesh(cx, cz - 1)
    if (lz === SECTION - 1) remesh(cx, cz + 1)
  }, [remesh])

  const blocked = useCallback((x: number, y: number, z: number) => {
    const y0 = Math.floor(y - 1.62), y1 = Math.floor(y - 1.62 + 1.75)
    for (let vy = y0; vy <= y1; vy++)
      for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3])
        if (isSolid(voxel(Math.floor(x + dx), vy, Math.floor(z + dz)))) return true
    return false
  }, [voxel])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const g = group.current
    if (!g) return
    const p = camera.position
    const cx = Math.floor(p.x / SECTION), cz = Math.floor(p.z / SECTION)

    // ── budgeted generation, nearest first ───────────────────────────────────────────────────
    const t0 = performance.now()
    const want: [number, number, number][] = []
    for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const d = dx * dx + dz * dz
      if (d > RADIUS * RADIUS) continue
      if (!cols.current.has(key(cx + dx, cz + dz))) want.push([d, cx + dx, cz + dz])
    }
    want.sort((a, b) => a[0] - b[0])
    for (const [, gx, gz] of want) {
      if (performance.now() - t0 > 10) break
      cols.current.set(key(gx, gz), makeColumn(gx * SECTION, gz * SECTION, SEED))
      remesh(gx, gz)
      for (const [ddx, ddz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const)
        if (cols.current.has(key(gx + ddx, gz + ddz))) remesh(gx + ddx, gz + ddz)
    }

    // Until the spawn column exists every lookup returns AIR, so gravity would drop the player
    // through a world that has not generated yet. Hold until there is ground beneath.
    if (!settled.current) {
      if (isSolid(voxel(0, Math.floor(p.y) - 3, 0))) settled.current = true
      else { onPos(p); onStats(`${cols.current.size} columns · generating…`); return }
    }

    // ── movement ─────────────────────────────────────────────────────────────────────────────
    const k = keys.current
    const speed = (k.ShiftLeft ? 22 : 9) * (fly.current ? 2.2 : 1)
    const aim = new THREE.Vector3()
    camera.getWorldDirection(aim)
    const fwd = aim.clone(); fwd.y = 0; fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0))
    const wish = new THREE.Vector3()
    if (k.KeyW) wish.add(fwd)
    if (k.KeyS) wish.sub(fwd)
    if (k.KeyD) wish.add(right)
    if (k.KeyA) wish.sub(right)
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed)

    if (fly.current) {
      if (k.Space) wish.y += speed
      if (k.ControlLeft) wish.y -= speed
      p.addScaledVector(wish, dt)
    } else {
      vel.current.x = wish.x; vel.current.z = wish.z
      vel.current.y -= 28 * dt
      if (onGround.current && k.Space) vel.current.y = 9.2
      const nx = p.x + vel.current.x * dt
      if (!blocked(nx, p.y, p.z)) p.x = nx
      const nz = p.z + vel.current.z * dt
      if (!blocked(p.x, p.y, nz)) p.z = nz
      const ny = p.y + vel.current.y * dt
      if (!blocked(p.x, ny, p.z)) { p.y = ny; onGround.current = false }
      else { if (vel.current.y < 0) onGround.current = true; vel.current.y = 0 }
      if (p.y < -20) { p.set(0.5, columnHeight(0, 0, SEED) + 2.6, 0.5); settled.current = false }
    }

    // ── what are we looking at ───────────────────────────────────────────────────────────────
    const hit = raycast(p.x, p.y, p.z, aim.x, aim.y, aim.z, REACH, voxel)
    const hl = highlight.current
    if (hl) {
      hl.visible = !!hit
      if (hit) hl.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
    }

    // ── mine ─────────────────────────────────────────────────────────────────────────────────
    if (hit && mouse.current.left) {
      const r = tickBreak(breaking.current, hit, dt, toolTier.current!, toolSkill.current!)
      breaking.current = r.state
      if (r.broken) {
        for (const d of dropsFor(hit.material)) addItems(inv.current!, d.itemId, d.count)
        setVoxel(hit.x, hit.y, hit.z, AIR)
        onInvChange()
        breaking.current = null
      }
    } else if (!mouse.current.left) {
      breaking.current = null
    }

    // ── place ────────────────────────────────────────────────────────────────────────────────
    if (hit && mouse.current.right && selItem) {
      const mat = materialForItem(selItem)
      // Refuse to place inside your own body — the classic way to entomb yourself.
      const inPlayer = Math.floor(p.x) === hit.px && Math.floor(p.z) === hit.pz
        && (Math.floor(p.y) === hit.py || Math.floor(p.y - 1.62) === hit.py)
      if (mat !== undefined && !inPlayer && countItem(inv.current!, selItem) > 0 && voxel(hit.px, hit.py, hit.pz) === AIR) {
        removeItems(inv.current!, selItem, 1)
        setVoxel(hit.px, hit.py, hit.pz, mat)
        onInvChange()
        mouse.current.right = false   // one block per click, not a firehose
      }
    }

    // ── HUD ──────────────────────────────────────────────────────────────────────────────────
    const def = hit ? blockDef(hit.material) : undefined
    onLook(hit && def
      ? {
          name: def.name,
          progress: breaking.current ? breaking.current.progress / breaking.current.required : 0,
          refused: mouse.current.left && !breaking.current && def.hardness !== Infinity,
        }
      : null)
    onPos(p)
    if (++frame.current % 10 === 0) onStats(`${cols.current.size} columns · ${drawn.current.size} meshes · main thread`)

    // ── evict ────────────────────────────────────────────────────────────────────────────────
    if (frame.current % 120 === 0) {
      const keep = new Set<string>()
      for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) keep.add(key(cx + dx, cz + dz))
      for (const [mk, m] of drawn.current) {
        if (keep.has(mk.slice(0, mk.lastIndexOf(':')))) continue
        g.remove(m); m.geometry.dispose(); drawn.current.delete(mk)
      }
      for (const kk of [...cols.current.keys()]) if (!keep.has(kk)) cols.current.delete(kk)
    }
  })

  return (
    <>
      <group ref={group} />
      <lineSegments ref={highlight} visible={false}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.002, 1.002, 1.002)]} />
        <lineBasicMaterial color="#000000" transparent opacity={0.55} />
      </lineSegments>
    </>
  )
}
