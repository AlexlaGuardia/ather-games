# Look prototypes, 2026-11-23 (Jin sprites)
Scratch prototypes, NOT wired into the game. Rendered headless (esbuild IIFE bundle + puppeteer setContent).
- `keeper-anime.ts` + `entry.ts`: an older / anime keeper head (smaller head, tapered jaw, almond eyes) beside the shipped one -> `keeper-face-anime-ab.png`. Waits on Alex's look call.
- `vulnyx.ts` + `ventry.ts`: Vulnyx (Glim) base form CODE-BUILT (toon body, self-lit, gold additive halo instead of ink, glowing amber eyes, particles, named parts ear-l/r, tail, head) beside the locked ref -> `vulnyx-vs-ref.png`. Proof for "code-built spirits instead of Meshy" (Meshy free plan 402s since 11-23).
Bundle: `node_modules/.bin/esbuild <entry> --bundle --format=iife --alias:three=$PWD/node_modules/three`.
