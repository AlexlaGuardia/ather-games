# Arcade Toolkit

Shared, game-agnostic building blocks for the Akatskii games catalog. Extracted
from Nolmir's first build (2026-06-11). Import via `@/lib/arcade/*`.

## What's here

- **`sfx.ts`** — Web Audio synth `Engine` + a generic `SfxManager<Id>`. Each game
  brings its own `Patch<Id>` (event id → synth recipe) and gets lazy audio-unlock
  (`ensure()` on a user gesture), a master gain, persisted mute + volume
  (`storageKey`), and per-event throttling for free.
  ```ts
  type Id = 'jump' | 'coin' | 'hit'
  const patch: Patch<Id> = { jump: (E, t) => E.tone(t, 660, { glideTo: 990, dur: 0.1 }), ... }
  export const sfx = new SfxManager<Id>(patch, { throttle: { hit: 40 }, storageKey: 'mygame.sfx' })
  // in a click handler: sfx.ensure(); sfx.play('jump')
  ```
  Nolmir's sound set lives in `app/nolmir/lib/sfx.ts` (the `arcane` patch) — a
  worked example.

- **`rng.ts`** — deterministic `mulberry32` PRNG + `randInt` / `pick`. Same seed →
  same run, so replays/away-settles are free and agree with live.

- **`sprites.ts`** — a lazy `<canvas>` sprite cache. `resolveSprite(cache, src)`
  kicks off the load on first sight and returns null (draw your fallback) until
  ready; `drawSprite(...)` centers it on a tile. Set `ctx.imageSmoothingEnabled
  = false` for crisp pixels.

## Pixel art pipeline

Drop a `.aseprite` via the akatskii dropbox (avatar menu), then decode it:
```
python3 scripts/ase2png.py path/to/sprite.aseprite public/<game>/sprites/out.png
```
`scripts/ase2png.py` is a minimal struct/zlib/PIL decoder (first frame, RGBA cels)
— no Aseprite CLI needed. Point a profile/sprite's path at the PNG and the sprite
cache picks it up.
