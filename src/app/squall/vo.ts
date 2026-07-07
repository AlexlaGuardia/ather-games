// Squall commentator — cozy George reacting to the storm. Thin instance of the
// shared arcade VoBank. Sparse by design: grazes fire constantly so `close` stays
// rare; the 2.8s cooldown keeps the rest from chattering. Mute is driven by the
// game (synced from sfx), so no muteKey here.
import { createVoBank } from '@/lib/arcade/voBank'

export type VoTrigger = 'start' | 'close' | 'weathering' | 'best' | 'over'

export const vo = createVoBank<VoTrigger>({
  basePath: '/squall/vo',
  prob: { start: 1, close: 0.28, weathering: 0.8, best: 1, over: 1 },
  priority: { over: 5, best: 4, weathering: 3, close: 2, start: 2 },
  minGapMs: 2800,
})
