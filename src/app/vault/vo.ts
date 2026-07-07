// Vault commentator — cozy George on the carry/momentum game. Thin VoBank instance.
// stomp = the skill beat (moderately sparse); carrying = a distance milestone. Mute
// driven by the game (synced from sfx).
import { createVoBank } from '@/lib/arcade/voBank'

export type VoTrigger = 'start' | 'stomp' | 'carrying' | 'best' | 'over'

export const vo = createVoBank<VoTrigger>({
  basePath: '/vault/vo',
  prob: { start: 1, stomp: 0.5, carrying: 0.8, best: 1, over: 1 },
  priority: { over: 5, best: 4, carrying: 3, stomp: 2, start: 2 },
  minGapMs: 2800,
})
