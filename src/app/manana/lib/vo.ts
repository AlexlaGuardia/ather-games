// MANA'NANA commentator — a cozy British sportscaster (ElevenLabs "George"),
// now a thin instance of the shared arcade VoBank (src/lib/arcade/voBank.ts).
// Call sites (`import { vo, type VoTrigger }`) are unchanged; the reusable layer
// lives in lib/arcade so every game shares it. The whole feel is the throttle
// below: low prob = sparse/warm, priority lets big beats jump the cooldown.

import { createVoBank } from '@/lib/arcade/voBank'

export type VoTrigger =
  | 'start' | 'nice' | 'impressive' | 'big' | 'low_moves' | 'milestone' | 'shuffle' | 'over'

export const vo = createVoBank<VoTrigger>({
  basePath: '/manana/vo',
  muteKey: 'manana.vo.muted',
  // how often a trigger is *allowed* to speak (before the cooldown even applies).
  // low = the cozy dial: nice combos mostly stay silent so a spoken line feels earned.
  prob: {
    start: 1, nice: 0.4, impressive: 0.85, big: 1, low_moves: 1, milestone: 0.85, shuffle: 0.9, over: 1,
  },
  // a higher-priority beat may interrupt the cooldown (and a playing clip).
  priority: {
    over: 5, big: 4, low_moves: 4, milestone: 3, impressive: 3, shuffle: 2, start: 2, nice: 1,
  },
  minGapMs: 2800,
})
