// A garden cluster's NAME (BETA M188 s3; canon 62a71de: "a cluster may carry a name its keepers give it").
// Pure, shared by the server record (clusters.ts) and the Chordstone's cluster card. ANY member names it: canon's
// third landlord guard (no title) means there is no host whose word this is; the name is the keepers'.
export const CLUSTER_NAME_MAX = 24

/** The name as it is stored, or null when it is not a name (empty, too long, or holding anything but letters,
 *  digits, spaces and a little punctuation). Whitespace runs collapse to one space. */
export function cleanClusterName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!s || [...s].length > CLUSTER_NAME_MAX) return null
  if (!/^[\p{L}\p{N} '’.\-]+$/u.test(s)) return null
  return s
}
