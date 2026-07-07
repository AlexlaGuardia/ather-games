// Reusable looping music bed for any arcade game — extracted from Mana'nana's
// proven Web Audio bus. Web Audio (not a plain <audio> tag) buys two things: a
// gapless MP3 loop (encoder padding would click on a tag loop) and a real
// GainNode, so a game can duck the bed under a spoken line and swell it back.
//
// Each game owns its OWN bed (its own track + context), and MUST call stop() on
// unmount so the music doesn't follow the player to another game or the Room —
// the bleed bug that shipped with manana's first cut. stop() parks the context
// but keeps the decoded buffer, so returning to the game restarts instantly.

"use client";

import { getSharedAudioContext, unlockAudio } from "./audioContext";

export interface MusicBedOptions {
  /** public path to the looping track, e.g. "/squall/music.mp3" */
  src: string;
  /** resting volume of the bed (quiet — sits under sfx/VO). Default 0.32 */
  baseVol?: number;
  /** ducked volume as a fraction of baseVol while something talks over it. Default 0.4 */
  duckTo?: number;
  /** fast step-down time when ducking, seconds. Default 0.08 */
  duckDipS?: number;
  /** gentle swell-back time after a duck, seconds. Default 1.1 */
  duckRecoverS?: number;
  /** optional localStorage key to persist + restore muted state. Omit to let the
   *  game drive mute entirely via setMuted() (e.g. from its shared sfx mute). */
  muteKey?: string;
}

export class MusicBed {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private loading: Promise<void> | null = null;
  private muted = false;
  private started = false;

  private readonly src: string;
  private readonly baseVol: number;
  private readonly duckTo: number;
  private readonly duckDipS: number;
  private readonly duckRecoverS: number;
  private readonly muteKey?: string;

  constructor(opts: MusicBedOptions) {
    this.src = opts.src;
    this.baseVol = opts.baseVol ?? 0.32;
    this.duckTo = opts.duckTo ?? 0.4;
    this.duckDipS = opts.duckDipS ?? 0.08;
    this.duckRecoverS = opts.duckRecoverS ?? 1.1;
    this.muteKey = opts.muteKey;
    if (typeof window !== "undefined" && this.muteKey) {
      this.muted = localStorage.getItem(this.muteKey) === "1";
    }
  }

  // create the context + decode the track. Safe pre-gesture (decode works suspended).
  ensure(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    // the one shared arcade context (see lib/arcade/audioContext) — no per-bed
    // context, so beds never contribute to the browser's context cap.
    const ctx = getSharedAudioContext();
    if (!ctx) return Promise.resolve();
    this.ctx = ctx;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : this.baseVol;
      this.gain.connect(ctx.destination);
    }
    if (this.buffer) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = fetch(this.src)
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => { this.buffer = decoded; })
      .catch(() => { /* music is garnish — never block play (also swallows a missing file) */ });
    return this.loading;
  }

  // begin the loop. Needs a user gesture to resume the context; idempotent.
  start() {
    if (typeof window === "undefined") return;
    unlockAudio(); // resume the shared context inside this gesture
    void this.ensure().then(() => {
      if (!this.ctx || !this.buffer || !this.gain) return;
      if (this.started) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffer;
      src.loop = true; // gapless loop of the decoded PCM
      src.connect(this.gain);
      src.start();
      this.source = src;
      this.started = true;
    });
  }

  // halt the loop when the game unmounts, so the bed doesn't follow you out. The
  // shared context stays alive (other games/sfx use it) — we just stop this bed's
  // source and keep the decoded buffer + gain, so returning restarts instantly.
  stop() {
    if (this.source) {
      try { this.source.stop(); } catch { /* already stopped */ }
      try { this.source.disconnect(); } catch { /* fine */ }
      this.source = null;
    }
    this.started = false;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (typeof window !== "undefined" && this.muteKey) {
      localStorage.setItem(this.muteKey, m ? "1" : "0");
    }
    if (this.gain && this.ctx) {
      const now = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(m ? 0 : this.baseVol, now, 0.05);
    }
    if (!m) this.start(); // unmuting kicks it off if the game's already running
  }

  setVolume(v: number) {
    if (this.gain && this.ctx && !this.muted) {
      this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
    }
  }

  // dip under a spoken line (or any transient), then swell back.
  duck() {
    if (!this.gain || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const g = this.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(this.baseVol * this.duckTo, now + this.duckDipS);
    g.linearRampToValueAtTime(this.baseVol, now + this.duckRecoverS);
  }
}

export function createMusicBed(opts: MusicBedOptions): MusicBed {
  return new MusicBed(opts);
}
