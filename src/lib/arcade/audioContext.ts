// ONE AudioContext for the whole arcade. Browsers cap concurrent AudioContexts
// (~6 on desktop Chrome, as few as ~4 on iOS Safari), and a context that's merely
// suspended still counts. Before this, every game minted its own context for sfx
// AND music and never closed them, so a player bouncing through a handful of games
// would silently exhaust the cap and lose sound in whichever game they opened next.
//
// The fix: sfx managers and music beds all share this single lazily-created context,
// each hanging its own GainNode off it (so per-game volume/mute/duck still work).
// There is never more than one context, so the cap is a non-issue no matter how many
// games a session touches. It lives for the app's lifetime — nothing closes it.

"use client";

let sharedCtx: AudioContext | null = null;
let unlocked = false;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedCtx) return sharedCtx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    sharedCtx = new AC();
  } catch {
    // extremely defensive — with a single shared context this shouldn't ever hit
    sharedCtx = null;
  }
  return sharedCtx;
}

// Call from inside a user gesture (a tap/click): resume the context and, once,
// play a 1-sample silent blip. iOS needs both inside the gesture or audio never
// wakes. Safe to call on every gesture — the blip only fires the first time.
export function unlockAudio(): void {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  if (unlocked) return;
  try {
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, 22050);
    blip.connect(ctx.destination);
    blip.start(0);
    unlocked = true;
  } catch {
    /* unlock is best-effort */
  }
}
