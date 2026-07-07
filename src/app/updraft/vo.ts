// Updraft commentator — cozy George on the flap/ascent game. Thin VoBank instance.
// climbing = a gate-pass milestone. Mute driven by the game (synced from sfx).
import { createVoBank } from '@/lib/arcade/voBank'

export type VoTrigger = 'start' | 'climbing' | 'best' | 'over'

export const vo = createVoBank<VoTrigger>({
  basePath: '/updraft/vo',
  prob: { start: 1, climbing: 0.8, best: 1, over: 1 },
  priority: { over: 5, best: 4, climbing: 3, start: 2 },
  minGapMs: 2800,
})
