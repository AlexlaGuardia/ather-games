/**
 * Hub Audio — one continuous music bed shared across the Room (/room) and the
 * tavern it opens into (/magii).
 *
 * The Room peeks at the Kindled Mug through a door: you hear the tavern track
 * MUFFLED (lowpass ~320Hz, quiet) from across the room. Cross the threshold and
 * the SAME element keeps playing the SAME track at the SAME playhead — the lowpass
 * just opens up and the music swells. No restart, no gap, no second click.
 *
 * This is a module singleton (like magii's getMagiiAudio), so the AudioContext +
 * <audio> element survive Next's client-side navigation between the two routes.
 * The graph: <audio> → lowpass → gain → destination.
 */

// Same pool the Mug door peeks into — these ARE the magii tavern tracks.
const TRACKS = [
  "/magii/audio/balance.mp3",
  "/magii/audio/nebula-hopping.mp3",
  "/magii/audio/wormhole-ride.mp3",
  "/magii/audio/comet-my-space.mp3",
];

const MUFFLE_HZ = 320; // "through a wall" floor
const OPEN_HZ = 16000; // wide open, in the room
const GLIDE = 0.18; // seconds — the setTargetAtTime smoothing both sides share

class HubAudio {
  private ctx: AudioContext | null = null;
  private el: HTMLAudioElement | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private started = false;
  private _muted = false;
  private _cutoff = MUFFLE_HZ;
  private _targetVol = 0; // last requested volume (applied unless muted)
  private listeners = new Set<() => void>();

  get isStarted() {
    return this.started;
  }
  get muted() {
    return this._muted;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  /** Lazily build the graph + start the loop. Must be called from a user gesture
   *  the first time (autoplay policy). No-ops once running. */
  start(trackIdx?: number) {
    if (this.started || typeof window === "undefined") return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const idx = trackIdx ?? Math.floor(Math.random() * TRACKS.length);
    const el = new Audio(TRACKS[idx % TRACKS.length]);
    el.loop = true;
    el.crossOrigin = "anonymous";
    const src = ctx.createMediaElementSource(el);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this._cutoff;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    this.ctx = ctx;
    this.el = el;
    this.filter = filter;
    this.gain = gain;
    el.play().catch(() => {});
    ctx.resume().catch(() => {});
    this.started = true;
    this.notify();
  }

  /** Set lowpass cutoff + volume with a smooth glide (room drives this from how
   *  much you face/approach the door; magii calls open()). */
  tune(cutoffHz: number, vol: number) {
    this._cutoff = cutoffHz;
    this._targetVol = vol;
    this.apply();
  }

  /** Wide open at a comfortable in-room level — magii rides this. */
  open(vol = 0.28) {
    this.tune(OPEN_HZ, vol);
  }

  private apply() {
    if (!this.ctx || !this.filter || !this.gain) return;
    const t = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(this._cutoff, t, GLIDE);
    this.gain.gain.setTargetAtTime(this._muted ? 0 : this._targetVol, t, GLIDE);
  }

  setMuted(m: boolean) {
    if (this._muted === m) return;
    this._muted = m;
    this.apply();
    this.notify();
  }
  toggleMuted() {
    this.setMuted(!this._muted);
    return this._muted;
  }
}

let instance: HubAudio | null = null;
export function getHubAudio(): HubAudio {
  if (!instance) instance = new HubAudio();
  return instance;
}
