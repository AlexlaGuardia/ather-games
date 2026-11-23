// ── VEYRA, UNIT 1 v2: AFTER THE YARD (BETA M73 s3) ────────────────────────────────────────────────────────────────────────
// ★ SIGNED (for now; Alex 11-22, main last line, Lazerin not named): CANON/game/ather-opening-chain-script.md › "Unit 1 (v2,
// 2026-11-22)", word for word (athernyx 8bef777). Scene boxes ride the talk bubble's italic line. The order lives in
// opening-chain.ts (VeyraBeat); the send line sets the ship-repair flag. The '…' continue is a build label, not the script.
// Test: business/signed-lines-m73.test.ts reads the canon file.
import type { VeyraBeat, VeyraPick } from './opening-chain'

export const VEYRA_NAME = 'Veyra'

/** each beat: an optional [SCENE] box above it, then her line */
export const VEYRA_UNIT1: Readonly<Record<VeyraBeat, { scene?: string; line: string }>> = {
  // [trigger: station:veyra-1]
  open: { scene: 'Her desk, manifests stacked higher than a desk should hold. She keeps writing.', line: 'Berths are full. Try next season.' },
  kaels: { scene: 'She looks up, and the pen stops.', line: "You're Kael's." },
  // [trigger: station:veyra-1:asked]
  asked1: { line: 'He asked. I said no.' },
  asked2: { scene: 'She waves a hand at the stacks without looking at them.', line: "That great thing in orbit over us. Somebody's just claimed it and put a dare out to the whole sky. Prizes. Glory. All of it comes through this desk." },
  // [trigger: station:veyra-1:where]
  where1: { line: "He wouldn't tell me." },
  where2: { line: "My hands were full then. They're full now." },
  // [trigger: station:veyra-1:send] sets the ship-repair objective flag
  send: { scene: "The pen goes back to the page. She doesn't look up this time.", line: "You'll need a ship. Get it running — you might track him down." },
  // [trigger: station:veyra-1:bark] talk to Veyra again before the ship flies
  bark: { line: "Ship first. I'm busy." },
}

/** the keeper's choices (the script's `>` lines); 'next' = the build's continue */
export const VEYRA_PICK: Readonly<Record<VeyraPick, string>> = {
  asked: "He wrote that he'd ask you along.",
  where: 'Where is he?',
  next: '…',
}
