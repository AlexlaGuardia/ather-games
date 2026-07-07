// Reusable cozy-commentator VO layer — extracted from Mana'nana's VoBank. Plays
// pre-baked ElevenLabs clips reactively on game state, using HTMLAudioElement (NOT
// Web Audio), so it never touches the AudioContext cap. The whole feel is the
// THROTTLE: a per-trigger probability (most beats stay silent so a spoken line
// feels earned) + a global cooldown that only a higher-priority beat can jump.
//
// Each game supplies its own trigger set, clip path, and prob/priority dials, then
// bakes clips + a manifest.json under basePath (see scripts/gen_*_vo.py). Keep lines
// canon-NEUTRAL (pure commentary, no world lore) and no Magii gate is needed.

"use client";

export interface VoBankOptions<T extends string> {
  /** where manifest.json + the clips live, e.g. "/squall/vo" */
  basePath: string;
  /** 0..1 chance a trigger is *allowed* to speak (before the cooldown). Low = cozy/sparse. */
  prob: Record<T, number>;
  /** higher-priority beats may interrupt the cooldown AND a playing lower-pri line. */
  priority: Record<T, number>;
  /** no two lines closer than this unless out-prioritised. Default 2800ms. */
  minGapMs?: number;
  /** optional localStorage key to persist/restore mute. */
  muteKey?: string;
  /** playback volume 0..1. Default 0.9 (VO rides above the music bed). */
  volume?: number;
}

type Manifest<T extends string> = Partial<Record<T, string[]>>;

export class VoBank<T extends string> {
  private manifest: Manifest<T> | null = null;
  private loading: Promise<void> | null = null;
  private cache = new Map<string, HTMLAudioElement>();
  private muted = false;
  private volume: number;
  private cooldownUntil = 0;
  private playingPri = 0;
  private current: HTMLAudioElement | null = null;
  private lastIdx: Partial<Record<T, number>> = {};
  private onSpeak: (() => void) | null = null; // fired when a line truly starts (music ducks off this)

  private readonly basePath: string;
  private readonly prob: Record<T, number>;
  private readonly priority: Record<T, number>;
  private readonly minGapMs: number;
  private readonly muteKey?: string;

  constructor(opts: VoBankOptions<T>) {
    this.basePath = opts.basePath.replace(/\/$/, "");
    this.prob = opts.prob;
    this.priority = opts.priority;
    this.minGapMs = opts.minGapMs ?? 2800;
    this.muteKey = opts.muteKey;
    this.volume = opts.volume ?? 0.9;
    if (typeof window !== "undefined" && this.muteKey) {
      this.muted = localStorage.getItem(this.muteKey) === "1";
    }
  }

  // fetch the manifest + warm the audio elements. Safe to call repeatedly.
  ensure(): Promise<void> {
    if (this.manifest) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = fetch(`${this.basePath}/manifest.json`)
      .then((r) => r.json())
      .then((m: Manifest<T>) => {
        this.manifest = m;
        for (const files of Object.values(m) as string[][]) {
          for (const fn of files ?? []) {
            const a = new Audio(`${this.basePath}/${fn}`);
            a.preload = "auto";
            this.cache.set(fn, a);
          }
        }
      })
      .catch(() => { this.manifest = {}; }); // fail silent — VO is garnish, never blocks play
    return this.loading;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (typeof window !== "undefined" && this.muteKey) localStorage.setItem(this.muteKey, m ? "1" : "0");
    if (m && this.current) { this.current.pause(); this.playingPri = 0; }
  }
  isMuted() { return this.muted; }
  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }
  setOnSpeak(fn: () => void) { this.onSpeak = fn; }

  play(trigger: T) {
    if (this.muted || typeof window === "undefined") return;
    const files = this.manifest?.[trigger];
    if (!files || !files.length) { void this.ensure(); return; } // not warm yet — skip, no queue
    if (Math.random() > this.prob[trigger]) return; // sparse by design

    const now = performance.now();
    const pri = this.priority[trigger];
    if (now < this.cooldownUntil && pri <= this.playingPri) return; // throttled

    // pick a clip, avoiding an immediate repeat of the same line
    let i = Math.floor(Math.random() * files.length);
    if (files.length > 1 && i === this.lastIdx[trigger]) i = (i + 1) % files.length;
    this.lastIdx[trigger] = i;
    const el = this.cache.get(files[i]);
    if (!el) return;

    if (this.current && !this.current.paused) this.current.pause(); // interrupt lower-pri line
    el.currentTime = 0;
    el.volume = this.volume;
    this.current = el;
    this.playingPri = pri;
    this.cooldownUntil = now + this.minGapMs;
    el.onended = () => { if (this.current === el) this.playingPri = 0; };
    el.play().then(() => this.onSpeak?.()).catch(() => { this.playingPri = 0; }); // duck music only once the line truly starts
  }

  // call when a spent resource climbs back (milestone / new game) so once-per-crossing beats re-arm
  reset() { this.cooldownUntil = 0; this.playingPri = 0; }
  // cut any in-flight line when the game unmounts (doesn't touch muted state)
  stop() { if (this.current) { try { this.current.pause(); } catch { /* fine */ } } this.playingPri = 0; this.cooldownUntil = 0; }
}

export function createVoBank<T extends string>(opts: VoBankOptions<T>): VoBank<T> {
  return new VoBank<T>(opts);
}
