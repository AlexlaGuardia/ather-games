"use client";

// Real-3D room route. WebGL canvas is client-only + lazy. This file owns the
// navigation state (face/phase), the DOM HUD, and the muffled-tavern audio;
// the scene just renders from face/phase.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { WALLS, N, MUG_INDEX, type Phase } from "./walls";

const RoomScene = dynamic(() => import("./RoomScene"), { ssr: false });

const TAVERN_TRACKS = [
  "/magii/audio/balance.mp3",
  "/magii/audio/nebula-hopping.mp3",
  "/magii/audio/wormhole-ride.mp3",
  "/magii/audio/comet-my-space.mp3",
];
const APPROACH_MS = 620;
const THROUGH_MS = 420;

export default function Room3DPage() {
  const [face, setFace] = useState(0);
  const [phase, setPhase] = useState<Phase>("room");
  const [muted, setMuted] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const touchX = useRef<number | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const startedRef = useRef(false);

  const inRoom = phase === "room";
  const current = ((face % N) + N) % N;
  const faced = WALLS[current];

  const after = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const turn = useCallback((dir: 1 | -1) => { setPhase((p) => { if (p === "room") setFace((f) => f + dir); return p; }); }, []);

  const enter = useCallback(() => {
    const w = WALLS[((face % N) + N) % N];
    const dest = w.href ? `${w.href}?from=room3d` : null;
    setPhase("approach");
    if (!dest) { after(APPROACH_MS, () => setPhase("open")); return; } // desk: arrive + stop
    after(APPROACH_MS, () => { setPhase("through"); after(THROUGH_MS, () => { window.location.href = dest; }); });
  }, [face]);

  const back = useCallback(() => { clearTimers(); setPhase("room"); }, []);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!inRoom) { if (e.key === "Escape") back(); return; }
      if (e.key === "ArrowRight") turn(1);
      else if (e.key === "ArrowLeft") turn(-1);
      else if (e.key === "Enter" || e.key === " ") enter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inRoom, turn, back, enter]);

  // ── muffled tavern audio (ported): lowpass + gain driven by facing/approach to the Mug ──
  const applyAudio = useCallback(() => {
    const ctx = audioCtxRef.current, flt = filterRef.current, g = gainRef.current;
    if (!ctx || !flt || !g) return;
    const f = (Math.cos((face - MUG_INDEX) * (Math.PI / 2)) + 1) / 2;
    const facingMug = ((face % N) + N) % N === MUG_INDEX;
    const p = facingMug ? (phase === "room" ? 0 : phase === "approach" ? 0.55 : 1) : 0;
    const base = 320 + f * 380;
    const cutoff = base + p * (16000 - base);
    const gFacing = 0.05 + f * 0.17;
    const vol = muted ? 0 : gFacing + p * (0.55 - gFacing);
    const t = ctx.currentTime;
    flt.frequency.setTargetAtTime(cutoff, t, 0.18);
    g.gain.setTargetAtTime(vol, t, 0.18);
  }, [face, phase, muted]);

  const startAudio = useCallback(() => {
    if (startedRef.current) return;
    const el = audioElRef.current;
    if (!el) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(el);
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass"; flt.frequency.value = 320; flt.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(flt); flt.connect(g); g.connect(ctx.destination);
    audioCtxRef.current = ctx; filterRef.current = flt; gainRef.current = g;
    el.loop = true; el.play().catch(() => {}); ctx.resume().catch(() => {});
    startedRef.current = true; setAudioOn(true);
  }, []);

  useEffect(() => {
    if (audioElRef.current) audioElRef.current.src = TAVERN_TRACKS[Math.floor(Math.random() * TAVERN_TRACKS.length)];
    const onFirst = () => startAudio();
    window.addEventListener("pointerdown", onFirst, { once: true });
    window.addEventListener("keydown", onFirst, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
      clearTimers();
      audioCtxRef.current?.close();
    };
  }, [startAudio]);

  useEffect(() => { if (startedRef.current) applyAudio(); }, [applyAudio, audioOn]);

  const accent = faced.accent;

  return (
    <div
      className="fixed inset-0 bg-[#06060a] text-[#e2e0ea] select-none"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (!inRoom || touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 45) turn(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <audio ref={audioElRef} preload="auto" loop crossOrigin="anonymous" />
      <RoomScene face={face} phase={phase} />

      {/* wordmark */}
      <header className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 z-10 text-center">
        <p className="text-[#d4a843] text-xs tracking-[0.5em] uppercase">Ather · Games</p>
      </header>

      {/* music toggle */}
      <button
        onClick={() => { startAudio(); setMuted((m) => !m); }}
        aria-label={muted || !audioOn ? "Unmute" : "Mute"}
        className="absolute top-5 right-5 z-20 grid place-items-center w-10 h-10 rounded-md border border-white/10 bg-[#12121e]/70 backdrop-blur text-[#8a879a] transition hover:text-[#d4a843] hover:border-[#d4a843]/40"
      >
        <span className="text-base leading-none">{muted || !audioOn ? "🔇" : "🔊"}</span>
      </button>

      {inRoom ? (
        <>
          {/* faced-wall label + enter */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 text-center">
            <h2 className="text-2xl tracking-[0.3em] uppercase" style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}>{faced.label}</h2>
            <button
              onClick={enter}
              className="mt-3 inline-flex items-center gap-2 rounded-md border px-6 py-2.5 text-sm uppercase tracking-[0.2em] transition"
              style={{ borderColor: `color-mix(in srgb, ${accent} 50%, transparent)`, color: accent }}
            >
              ▶ Enter
            </button>
          </div>

          {/* turn arrows */}
          <button onClick={() => turn(-1)} aria-label="turn left" className="absolute left-4 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-11 h-11 rounded-md border border-white/10 bg-[#12121e]/70 backdrop-blur text-xl text-[#8a879a] transition hover:text-[#d4a843] hover:border-[#d4a843]/40">‹</button>
          <button onClick={() => turn(1)} aria-label="turn right" className="absolute right-4 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-11 h-11 rounded-md border border-white/10 bg-[#12121e]/70 backdrop-blur text-xl text-[#8a879a] transition hover:text-[#d4a843] hover:border-[#d4a843]/40">›</button>

          {/* compass dots */}
          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 flex gap-2.5">
            {WALLS.map((w, i) => (
              <button
                key={w.id}
                onClick={() => setFace(face + ((i - current + N + (N >> 1)) % N) - (N >> 1))}
                aria-label={w.label}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: i === current ? 26 : 8, background: i === current ? accent : "rgba(255,255,255,0.18)", boxShadow: i === current ? `0 0 10px ${accent}` : "none" }}
              />
            ))}
          </div>
        </>
      ) : (
        <button
          onClick={back}
          className="absolute top-5 left-5 z-20 flex items-center gap-2 rounded-md border border-white/10 bg-[#12121e]/70 backdrop-blur px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[#8a879a] transition hover:text-[#d4a843] hover:border-[#d4a843]/40"
        >
          ‹ back to the room
        </button>
      )}
    </div>
  );
}
