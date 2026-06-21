'use client'

// ANIMA — a proof-of-concept: a living character made with ZERO art files.
// No pixels, no sprites, no painted frames. A 2-bone IK skeleton, a procedural
// walk gait, a breathing idle, and a verlet cloak that lags and flows. Every
// pose is computed, not drawn — so it animates from one rig instead of N painted
// frames. Click/tap to send it walking. Toggle the skeleton to see the rig.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useNoScroll } from '@/lib/arcade/useNoScroll'

// virtual canvas (DPR-aware); side-view, character roams along the ground line
const VW = 720
const VH = 460
const GROUND_Y = 360

// palette — Ather house look
const BG = '#05060d'
const ATHER = '#37e6ff'
const HOT = '#e8feff'
const WARM = '#ffba6b'
const BONE = '#ff5db0'
const DIM = '#1a2740'

// ── rig dimensions ─────────────────────────────────────────────────────────
const THIGH = 46
const SHIN = 44
const UPARM = 34
const FOREARM = 32
const SPINE = 58 // pelvis → shoulders
const NECK = 14
const HEAD_R = 17

const WALK_SPEED = 2.2 // px/frame
const RUN_SPEED = 4.6

type V = { x: number; y: number }
const v = (x: number, y: number): V => ({ x, y })

// 2-bone IK: given root + target + two lengths, return the elbow/knee joint.
// `bend` = +1 or -1 picks which way the joint folds.
function ik(root: V, target: V, l1: number, l2: number, bend: number): V {
  let dx = target.x - root.x
  let dy = target.y - root.y
  let d = Math.hypot(dx, dy)
  const maxD = l1 + l2 - 0.001
  const minD = Math.abs(l1 - l2) + 0.001
  d = Math.max(minD, Math.min(maxD, d))
  // re-normalise direction at clamped length
  const ang = Math.atan2(dy, dx)
  // law of cosines: angle at root between root→target and root→joint
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)))
  const ja = ang + bend * a
  return v(root.x + Math.cos(ja) * l1, root.y + Math.sin(ja) * l1)
}

// verlet point for the cloak / hair chains
type P = { x: number; y: number; px: number; py: number }

export default function Anima() {
  useNoScroll()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showBones, setShowBones] = useState(false)
  const [running, setRunning] = useState(false)
  const showBonesRef = useRef(showBones)
  const runRef = useRef(running)
  showBonesRef.current = showBones
  runRef.current = running

  // character state
  const stRef = useRef({
    x: VW * 0.5,
    target: VW * 0.5,
    face: 1, // +1 right, -1 left
    speed: 0, // current px/frame
    phase: 0, // gait clock
    t: 0, // global time
  })
  // cloak (anchored at upper back) + hair (anchored at head)
  const cloakRef = useRef<P[]>([])
  const hairRef = useRef<P[]>([])

  const setTarget = useCallback((clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * VW
    stRef.current.target = Math.max(40, Math.min(VW - 40, x))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let alive = true

    // init chains
    cloakRef.current = Array.from({ length: 9 }, () => ({ x: 0, y: 0, px: 0, py: 0 }))
    hairRef.current = Array.from({ length: 5 }, () => ({ x: 0, y: 0, px: 0, py: 0 }))

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)

    // ── one verlet step for a chain anchored at `anchor`, segment length `seg` ──
    const stepChain = (chain: P[], anchor: V, seg: number, gravity: number, drift: number) => {
      // anchor head
      chain[0].x = anchor.x
      chain[0].y = anchor.y
      for (let i = 1; i < chain.length; i++) {
        const p = chain[i]
        const vx = (p.x - p.px) * 0.86
        const vy = (p.y - p.py) * 0.86
        p.px = p.x
        p.py = p.y
        p.x += vx + drift
        p.y += vy + gravity
      }
      // constrain to segment length (a few iterations)
      for (let k = 0; k < 6; k++) {
        for (let i = 1; i < chain.length; i++) {
          const a = chain[i - 1]
          const b = chain[i]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d = Math.hypot(dx, dy) || 0.001
          const diff = (d - seg) / d
          if (i - 1 === 0) {
            b.x -= dx * diff
            b.y -= dy * diff
          } else {
            a.x += dx * diff * 0.5
            a.y += dy * diff * 0.5
            b.x -= dx * diff * 0.5
            b.y -= dy * diff * 0.5
          }
        }
      }
    }

    const drawChain = (chain: P[], w0: number, color: string) => {
      ctx.lineCap = 'round'
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      for (let i = 1; i < chain.length; i++) {
        ctx.beginPath()
        ctx.lineWidth = w0 * (1 - (i / chain.length) * 0.7)
        ctx.moveTo(chain[i - 1].x, chain[i - 1].y)
        ctx.lineTo(chain[i].x, chain[i].y)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
    }

    const limb = (a: V, b: V, c: V, w: number, color: string) => {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 8
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineTo(c.x, c.y)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    const dot = (p: V, r: number, color: string) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const loop = () => {
      if (!alive) return
      const s = stRef.current
      s.t += 1 / 60

      // ── locomotion: ease speed toward target, ramp to walk/run ──────────
      const want = s.target
      const dx = want - s.x
      const dir = Math.abs(dx) > 2 ? Math.sign(dx) : 0
      const top = runRef.current ? RUN_SPEED : WALK_SPEED
      if (dir !== 0) {
        s.face = dir
        s.speed += (top - s.speed) * 0.08
      } else {
        s.speed += (0 - s.speed) * 0.18
      }
      s.x += Math.sign(dx) * Math.min(Math.abs(dx), s.speed)
      // gait clock advances with distance travelled
      const gait = Math.min(1, s.speed / WALK_SPEED)
      s.phase += s.speed * 0.09 + 0.0001
      const ph = s.phase
      const face = s.face

      // ── body frame ──────────────────────────────────────────────────────
      const bob = Math.abs(Math.sin(ph)) * 6 * gait // double-bob per stride
      const breathe = Math.sin(s.t * 1.8) * 2 * (1 - gait) // idle chest rise
      const lean = (running ? 0.22 : 0.12) * gait * face // forward lean when moving
      const pelvis = v(s.x, GROUND_Y - (THIGH + SHIN) * 0.86 - bob)
      // shoulders = pelvis + spine, tilted by lean + a little breathing
      const shoulder = v(
        pelvis.x + Math.sin(lean) * SPINE,
        pelvis.y - Math.cos(lean) * (SPINE - breathe)
      )
      const neckTop = v(shoulder.x + Math.sin(lean) * NECK, shoulder.y - Math.cos(lean) * NECK)
      const head = v(neckTop.x + Math.sin(lean) * HEAD_R, neckTop.y - Math.cos(lean) * HEAD_R)

      // hip / shoulder sockets offset to the side
      const hipW = 9
      const shW = 12
      const hipFront = v(pelvis.x + face * hipW * 0.4, pelvis.y)
      const hipBack = v(pelvis.x - face * hipW * 0.4, pelvis.y)

      // ── foot targets via gait curve, then IK the knees ──────────────────
      const stride = (running ? 30 : 22) * gait
      const lift = (running ? 26 : 16) * gait
      const footPath = (p: number, hip: V): V => {
        const fx = -Math.cos(p) * stride
        const fy = Math.max(0, Math.sin(p)) * lift
        return v(hip.x + face * fx, GROUND_Y - fy)
      }
      const footA = footPath(ph, hipFront)
      const footB = footPath(ph + Math.PI, hipBack)
      const kneeA = ik(hipFront, footA, THIGH, SHIN, face > 0 ? 1 : -1)
      const kneeB = ik(hipBack, footB, THIGH, SHIN, face > 0 ? 1 : -1)

      // ── arms: counter-swing the legs, IK to a hand target ───────────────
      const shFront = v(shoulder.x + face * shW * 0.4, shoulder.y)
      const shBack = v(shoulder.x - face * shW * 0.4, shoulder.y)
      const armSwing = (running ? 30 : 18) * gait
      const idleArm = Math.sin(s.t * 1.8) * 4 * (1 - gait)
      const handPath = (p: number, sh: V): V => {
        const hx = -Math.cos(p) * armSwing
        const hy = (UPARM + FOREARM) * 0.82 + Math.max(0, -Math.sin(p)) * 6
        return v(sh.x + face * hx, sh.y + hy + idleArm)
      }
      // arm opposite to same-side leg → +PI offsets
      const handA = handPath(ph + Math.PI, shBack)
      const handB = handPath(ph, shFront)
      const elbowA = ik(shBack, handA, UPARM, FOREARM, face > 0 ? -1 : 1)
      const elbowB = ik(shFront, handB, UPARM, FOREARM, face > 0 ? -1 : 1)

      // ── cloak + hair physics (anchored at back-of-shoulder / head) ──────
      const backAnchor = v(shoulder.x - face * 6, shoulder.y + 4)
      const moveDrift = -s.speed * face * 0.55 // cloak trails behind motion
      stepChain(cloakRef.current, backAnchor, 10, 0.9, moveDrift + Math.sin(s.t * 2) * 0.2)
      stepChain(hairRef.current, head, 7, 0.5, moveDrift * 0.5)

      // ════════════════════════ RENDER ════════════════════════
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, VW, VH)

      // floating ather motes
      ctx.fillStyle = 'rgba(55,230,255,0.25)'
      for (let i = 0; i < 22; i++) {
        const mx = (i * 137.5 + s.t * (8 + (i % 5) * 4)) % VW
        const my = (i * 53.3 + Math.sin(s.t * 0.6 + i) * 18) % (GROUND_Y - 20)
        ctx.fillRect(mx, my, 2, 2)
      }

      // ground line + glow
      ctx.strokeStyle = 'rgba(55,230,255,0.35)'
      ctx.lineWidth = 2
      ctx.shadowColor = ATHER
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y)
      ctx.lineTo(VW, GROUND_Y)
      ctx.stroke()
      ctx.shadowBlur = 0

      // soft contact shadow (squashes with bob)
      const shScale = 1 - bob / 18
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.beginPath()
      ctx.ellipse(s.x, GROUND_Y + 3, 34 * shScale, 7 * shScale, 0, 0, Math.PI * 2)
      ctx.fill()

      if (showBonesRef.current) {
        // ── RIG VIEW: bones + joints, naked ──
        ctx.strokeStyle = 'rgba(255,93,176,0.55)'
        ctx.lineWidth = 2
        const seg = (a: V, b: V) => {
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
        seg(pelvis, shoulder)
        seg(shoulder, head)
        seg(hipFront, kneeA); seg(kneeA, footA)
        seg(hipBack, kneeB); seg(kneeB, footB)
        seg(shBack, elbowA); seg(elbowA, handA)
        seg(shFront, elbowB); seg(elbowB, handB)
        ;[pelvis, shoulder, head, hipFront, kneeA, footA, hipBack, kneeB, footB,
          shBack, elbowA, handA, shFront, elbowB, handB].forEach((p) => dot(p, 3, BONE))
        drawChain(cloakRef.current, 3, 'rgba(255,93,176,0.4)')
      } else {
        // ── SKIN VIEW: glowing tapered limbs + cloak + body ──
        // cloak behind everything
        drawChain(cloakRef.current, 9, 'rgba(120,90,255,0.85)')
        // back limbs (dimmer for depth)
        limb(hipBack, kneeB, footB, 8, '#1f8fb0')
        limb(shBack, elbowA, handA, 6, '#1f8fb0')
        // torso
        ctx.strokeStyle = ATHER
        ctx.lineCap = 'round'
        ctx.shadowColor = ATHER
        ctx.shadowBlur = 12
        ctx.lineWidth = 16
        ctx.beginPath()
        ctx.moveTo(pelvis.x, pelvis.y)
        ctx.lineTo(shoulder.x, shoulder.y)
        ctx.stroke()
        ctx.lineWidth = 7
        ctx.beginPath()
        ctx.moveTo(shoulder.x, shoulder.y)
        ctx.lineTo(neckTop.x, neckTop.y)
        ctx.stroke()
        ctx.shadowBlur = 0
        // front limbs (bright)
        limb(hipFront, kneeA, footA, 9, ATHER)
        limb(shFront, elbowB, handB, 6, HOT)
        // head
        dot(head, HEAD_R, '#0a1626')
        ctx.strokeStyle = ATHER
        ctx.shadowColor = ATHER
        ctx.shadowBlur = 14
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(head.x, head.y, HEAD_R, 0, Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
        // a warm core mark (the spark of Ather inside)
        dot(v(head.x + face * 4, head.y - 1), 3, WARM)
        drawChain(hairRef.current, 5, ATHER)
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
    }
  }, [running])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 py-8 select-none">
      <div className="text-center">
        <h1 className="text-3xl font-[var(--font-display)] text-[#37e6ff] tracking-wide">Anima</h1>
        <p className="text-sm text-[#8aa0c0] mt-1 max-w-md">
          One rig, zero art files. Every pose computed, not painted — it walks, breathes,
          and trails a cloak with no sprite frames behind it.
        </p>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full max-w-[760px] rounded-xl border border-[#1a2740] touch-none"
        style={{ aspectRatio: `${VW} / ${VH}`, background: BG, cursor: 'pointer' }}
        onPointerDown={(e) => setTarget(e.clientX, e.currentTarget.getBoundingClientRect())}
      />

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <button
          onClick={() => setShowBones((b) => !b)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            showBones
              ? 'bg-[#ff5db0]/20 border-[#ff5db0] text-[#ff5db0]'
              : 'bg-[#0c1424] border-[#1a2740] text-[#8aa0c0] hover:border-[#37e6ff]'
          }`}
        >
          {showBones ? '● Skeleton' : '○ Skeleton'}
        </button>
        <button
          onClick={() => setRunning((r) => !r)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            running
              ? 'bg-[#37e6ff]/20 border-[#37e6ff] text-[#37e6ff]'
              : 'bg-[#0c1424] border-[#1a2740] text-[#8aa0c0] hover:border-[#37e6ff]'
          }`}
        >
          {running ? '● Run' : '○ Walk'}
        </button>
        <span className="text-xs text-[#5a6d8a]">tap the scene to send it walking</span>
      </div>

      <Link href="/arcade/all" className="text-xs text-[#5a6d8a] hover:text-[#37e6ff] mt-2">
        ← back to the arcade
      </Link>
    </div>
  )
}
