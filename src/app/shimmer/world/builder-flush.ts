// ── BETA M85 s3 (carried from s2): THE CLOSE-TIME DRAFT FLUSH NEVER DROPS PIECES ──
// When the editor unmounts (map switch, leaving the builder) it sends its unsaved strokes as the draft. It used `keepalive: true` so the
// request outlives the unmount, but browsers REFUSE a keepalive request whose body is over 64 KiB (fetch rejects, nothing is sent):
// a draft past ~900 pieces (scatter allows 4000) was silently lost. Now: a body that fits goes keepalive (survives even a closing tab);
// a bigger one goes as an ordinary request, which still finishes after an unmount because the page lives on (the tab-close case is
// covered by the beforeunload prompt while anything is unsaved). Same body, same route as the normal Save.
// PURE: builder-flush.test.ts.
export const KEEPALIVE_MAX_BYTES = 60000   // under the browsers' 64 KiB keepalive quota, with room for the headers
export const byteLength = (s: string) => new TextEncoder().encode(s).length
/** the fetch init for the close-time draft flush: keepalive only when the browser will accept it */
export function flushInit(body: string): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, ...(byteLength(body) <= KEEPALIVE_MAX_BYTES ? { keepalive: true } : {}) }
}
