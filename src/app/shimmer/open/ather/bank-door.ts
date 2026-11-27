// M231 (Alex 11-27): the first Keepstone pops into the bag when punched. While no Keepstone stands on the plot the garden
// bank has no door, but every stack in it stays (garden-bank.ts: nothing is ever trimmed). This one line says so where the
// keeper looks: the bag's footer and the toast when the last Keepstone comes up. Plain functional words, for @lark.
// PURE: no React.
export const BANK_DOOR_HINT = 'Set a Keepstone down to open the bank. Everything in it is kept.'
