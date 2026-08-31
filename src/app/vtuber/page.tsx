'use client'
/**
 * THE STREAM AVATAR. A FACE GOES IN, A HOODED GRIN COMES OUT.
 *
 * OBS: add a Browser Source pointing at `/vtuber?obs=1&src=cam`. `obs=1` drops every control and
 * the opaque backdrop, so the page composites straight over the game capture beneath it.
 *
 * ⚠ THE CAMERA PATH HAS NOT BEEN SEEN TO WORK ON THE BUILD BOX — there is no webcam here. The
 * pure half (expression, rig, renderer, synthetic driver) is guarded and photographed; the
 * MediaPipe half is reasoned, and its axis signs are exposed as controls rather than baked for
 * exactly that reason. First run on a real camera is the measurement that settles it.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { type ExpressionState, NEUTRAL, smooth } from './expression'
import { type AvatarMeta, type VisemeSet, rig, DEFAULT_OPTIONS } from './rig'
import { draw, DEFAULT_DRAW } from './renderer'
import { AudioMouth, stateFromAudio, synthetic } from './sources'
import {
  type TrackerTuning, DEFAULT_TUNING, blendMap, stateFromBlend, Calibrator,
} from './tracker'

type Src = 'demo' | 'mic' | 'cam'

export default function VTuberPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [meta, setMeta] = useState<AvatarMeta | null>(null)
  const [src, setSrc] = useState<Src>('demo')
  const [obs, setObs] = useState(false)
  const [eyes, setEyes] = useState(true)
  const [motion, setMotion] = useState(1)
  const [gain, setGain] = useState(1)
  const [status, setStatus] = useState('loading avatar…')
  const [calibrating, setCalibrating] = useState(false)
  const [fps, setFps] = useState(0)
  // ⚠ Updated on the fps tick, NOT every frame. A readout that re-renders React 60 times a
  // second costs more than the whole compositor it is reporting on.
  const [visLabel, setVisLabel] = useState('')
  // ★ A PINNED CLOCK, so a screenshot of this page is comparable to one taken next week.
  // `?frame=1200` freezes both the synthetic driver and the rig's idle clock at that moment.
  // Without it every shot samples a different instant of a breathing, blinking avatar and no
  // two pictures can be diffed — which is how a render regression hides in plain sight.
  const [frozen, setFrozen] = useState<number | null>(null)

  // Refs, not state: the frame loop reads these every frame and a re-render per frame would
  // cost more than the whole compositor.
  const imgs = useRef<{
    base: HTMLImageElement
    mouth: HTMLImageElement
    visemes?: Record<string, HTMLImageElement>
  } | null>(null)
  const visemeSet = useRef<VisemeSet | null>(null)
  const tuning = useRef<TrackerTuning>({ ...DEFAULT_TUNING })
  const calib = useRef(new Calibrator())
  const audio = useRef(new AudioMouth())
  const landmarker = useRef<{ detectForVideo: (v: HTMLVideoElement, t: number) => unknown } | null>(null)
  const prev = useRef<ExpressionState>(NEUTRAL)
  const srcRef = useRef<Src>('demo')
  const optsRef = useRef({ eyes: true, motion: 1 })
  useEffect(() => { srcRef.current = src }, [src])
  useEffect(() => { optsRef.current = { eyes, motion } }, [eyes, motion])
  useEffect(() => { tuning.current.gain = gain }, [gain])

  // ── url options, read once ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('obs') === '1') setObs(true)
    const s = q.get('src')
    if (s === 'mic' || s === 'cam' || s === 'demo') setSrc(s)
    if (q.get('eyes') === '0') setEyes(false)
    const f = q.get('frame')
    if (f !== null && Number.isFinite(Number(f))) setFrozen(Number(f))
  }, [])

  // ── load the avatar: metadata first, then the pixels it describes ───────────────────────────
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        // ★ WHICH AVATAR. The repo ships only `fixture` — a synthetic, procedurally drawn
        // stand-in that carries no licence and no likeness. Personal art goes in as another
        // name (gitignored) and is selected with `?avatar=<name>`.
        // ⚠ Restricted to a safe charset: this value becomes a URL path, and a param that
        // reaches a fetch path unchecked is a habit worth not forming even where it is harmless.
        const raw = new URLSearchParams(window.location.search).get('avatar') ?? 'fixture'
        const avatar = /^[a-z0-9-]{1,40}$/.test(raw) ? raw : 'fixture'
        const m: AvatarMeta = await fetch(`/vtuber/${avatar}.json`).then(r => {
          if (!r.ok) throw new Error(`avatar.json HTTP ${r.status}`)
          return r.json()
        })
        const load = (u: string) => new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image()
          i.onload = () => res(i)
          // ⚠ An image that 404s fires `onerror` and leaves a 0x0 element that draws NOTHING and
          // throws NOTHING. Silently compositing an empty layer is how a missing asset arrives
          // looking like a rig that does not work.
          i.onerror = () => rej(new Error(`missing layer: ${u}`))
          i.src = u
        })
        const [base, mouth] = await Promise.all([
          load(`/vtuber/${avatar}-base.png`),
          load(`/vtuber/${avatar}-mouth.png`),
        ])
        if (dead) return
        imgs.current = { base, mouth }

        // ── the mouth set, if one has been cut ────────────────────────────────────────────
        // ⚠ OPTIONAL ON PURPOSE, AND IT FAILS QUIET RATHER THAN FATAL. An avatar without a
        // viseme set still renders — it just falls back to the legacy jaw. Making this
        // required would mean a missing art step takes the whole page down, and the page is
        // how anyone finds out the art step is missing.
        try {
          const vs: VisemeSet = await fetch(`/vtuber/visemes/${avatar}-visemes.json`)
            .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
          const names = Object.keys(vs.shapes)
          const loaded = await Promise.all(names.map(n => load(`/vtuber/visemes/${vs.shapes[n].file}`)))
          if (!dead) {
            visemeSet.current = vs
            imgs.current = { base, mouth, visemes: Object.fromEntries(names.map((n, i) => [n, loaded[i]])) }
          }
        } catch {
          visemeSet.current = null
        }

        setMeta(m)
        setStatus('')
      } catch (e) {
        setStatus(`✗ ${(e as Error).message} — run \`python3 scripts/vtuber-fixture.py\``)
      }
    })()
    return () => { dead = true }
  }, [])

  // ── the frame loop ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!meta || !imgs.current) return
    let raf = 0
    let frames = 0
    let last = performance.now()

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx || !imgs.current) return
      const now = frozen ?? performance.now()

      let raw: ExpressionState
      if (srcRef.current === 'cam' && landmarker.current && videoRef.current?.videoWidth) {
        const r = landmarker.current.detectForVideo(videoRef.current, now) as {
          faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[]
          facialTransformationMatrixes?: { data: number[] }[]
        }
        const cats = r.faceBlendshapes?.[0]?.categories
        if (cats) {
          const b = blendMap(cats)
          if (calibrating) calib.current.add(b)
          raw = stateFromBlend(b, r.facialTransformationMatrixes?.[0]?.data ?? null, tuning.current, now)
        } else {
          // Face lost. Hold the pose and let it decay rather than snapping to neutral, which
          // reads as the avatar flinching every time tracking drops a frame.
          raw = { ...prev.current, mouthOpen: 0, source: 'idle', at: now }
        }
      } else if (srcRef.current === 'mic' && audio.current.running) {
        raw = stateFromAudio(audio.current.level(), now)
      } else {
        raw = synthetic(now)
      }

      prev.current = smooth(prev.current, raw)
      const pose = rig(prev.current, meta, { ...DEFAULT_OPTIONS, ...optsRef.current, now },
        visemeSet.current)
      draw(ctx, imgs.current, meta, pose, { ...DEFAULT_DRAW, opaque: !obs })

      frames++
      // ⚠ A SHOT MUST WAIT ON A DRAWN FRAME, NOT ON A CLOCK. PATTERNS has three separate entries
      // about under-settled screenshots read as outages; a flag the page sets only after the
      // compositor has actually run is the difference between waiting for the picture and
      // hoping for it.
      ;(window as unknown as { __avatarDrawn?: number }).__avatarDrawn = frames
      if (now - last > 1000) {
        setFps(Math.round(frames * 1000 / (now - last)))
        const v = pose.viseme
        setVisLabel(v ? `${v.a}${v.t > 0.02 ? `→${v.b}` : ''}${v.round > 0.05 ? '+round' : ''}` : 'legacy jaw')
        frames = 0; last = now
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [meta, obs, calibrating, frozen])

  // ── switching source ────────────────────────────────────────────────────────────────────────
  const useCam = useCallback(async () => {
    setStatus('starting camera…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      })
      const v = videoRef.current!
      v.srcObject = stream
      await v.play()
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks('/vtuber/wasm')
      const lm = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/vtuber/face_landmarker.task', delegate: 'GPU' },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      })
      landmarker.current = lm as unknown as { detectForVideo: (v: HTMLVideoElement, t: number) => unknown }
      setSrc('cam')
      setStatus('')
    } catch (e) {
      setStatus(`✗ camera: ${(e as Error).message}`)
    }
  }, [])

  const useMic = useCallback(async () => {
    setStatus('starting microphone…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      await audio.current.start(stream)
      setSrc('mic')
      setStatus('')
    } catch (e) {
      setStatus(`✗ mic: ${(e as Error).message}`)
    }
  }, [])

  const runCalibration = useCallback(() => {
    calib.current.reset()
    setCalibrating(true)
    setStatus('hold a NEUTRAL face…')
    setTimeout(() => {
      setCalibrating(false)
      const ch = calib.current.finish()
      if (!ch) { setStatus('✗ calibration saw too few frames — is the camera running?'); return }
      tuning.current.channels = ch
      setStatus(`calibrated on ${calib.current.count} frames`)
      setTimeout(() => setStatus(''), 2200)
    }, 1800)
  }, [])

  // ── OBS mode: the canvas and nothing else ───────────────────────────────────────────────────
  if (obs) {
    return (
      <>
        <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={720} height={751}
          style={{ display: 'block', width: '100vw', height: '100vh' }} />
      </>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0a090f', color: '#e8e4f0', padding: 24 }}>
      <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <h1 className="gx-title" style={{ fontSize: 22, marginBottom: 4 }}>STREAM AVATAR</h1>
        <p className="gx-label" style={{ fontSize: 11, opacity: 0.5, marginBottom: 20 }}>
          face → grin
        </p>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="gx-card gx-scan" style={{ padding: 10 }}>
            <canvas ref={canvasRef} width={720} height={751}
              style={{ display: 'block', width: 420, height: 438, borderRadius: 2 }} />
          </div>

          <div className="gx-card" style={{ padding: 18, minWidth: 300, flex: 1 }}>
            <div className="gx-label" style={{ fontSize: 10, marginBottom: 10 }}>DRIVER</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <button className={`gx-btn ${src === 'demo' ? 'gx-active' : ''}`}
                onClick={() => setSrc('demo')}>DEMO</button>
              <button className={`gx-btn ${src === 'mic' ? 'gx-active' : ''}`}
                onClick={useMic}>MIC</button>
              <button className={`gx-btn ${src === 'cam' ? 'gx-active' : ''}`}
                onClick={useCam}>CAMERA</button>
            </div>

            {src === 'cam' && (
              <div style={{ marginBottom: 18 }}>
                <button className="gx-btn" onClick={runCalibration} disabled={calibrating}>
                  {calibrating ? 'HOLD STILL…' : 'CALIBRATE'}
                </button>
                <p style={{ fontSize: 11, opacity: 0.45, marginTop: 6, lineHeight: 1.5 }}>
                  Measures YOUR resting face. Without it the mouth sits slightly open and never
                  fully opens, which reads as broken art rather than an untuned dial.
                </p>
              </div>
            )}

            <Dial label="EYE GLOW" value={eyes ? 'ON' : 'OFF'}
              onClick={() => setEyes(v => !v)} />
            <Slider label="MOTION" value={motion} min={0} max={2} step={0.05}
              onChange={setMotion} />
            <Slider label="GAIN" value={gain} min={0.4} max={2.5} step={0.05}
              onChange={setGain} />

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <div className="gx-label" style={{ fontSize: 10, marginBottom: 6 }}>OBS BROWSER SOURCE</div>
              <code style={{ fontSize: 11, opacity: 0.6, wordBreak: 'break-all' }}>
                https://ather.games/vtuber?obs=1&amp;src=cam
              </code>
              <p style={{ fontSize: 11, opacity: 0.4, marginTop: 8, lineHeight: 1.5 }}>
                720×751, transparent. Tick “Control audio via OBS” off and allow camera access in
                the source’s properties.
              </p>
            </div>

            <div style={{ marginTop: 14, fontSize: 11, opacity: 0.45,
              display: 'flex', justifyContent: 'space-between' }}>
              <span>{fps} fps</span>
              <span className="gx-value">{visLabel} · {src.toUpperCase()}</span>
            </div>
            {status && <p style={{ fontSize: 12, marginTop: 10, color: status.startsWith('✗') ? '#e8877a' : '#9ad8a0' }}>{status}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}

function Dial({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <span className="gx-label" style={{ fontSize: 10 }}>{label}</span>
      <button className="gx-btn" onClick={onClick} style={{ minWidth: 62 }}>{value}</button>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="gx-label" style={{ fontSize: 10 }}>{label}</span>
        <span className="gx-value" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
          {value.toFixed(2)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#a87aff' }} />
    </div>
  )
}
