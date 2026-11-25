// A page clock a check can trust (M164): Date.now, new Date(), Date() and performance.timeOrigin all move TOGETHER. Moving Date.now alone
// splits the page in two times (the session recorder stamps events by one and its sessions by the other, and past 24 h apart it restarts for ever).
// Runs in the page before its scripts:  await p.evaluateOnNewDocument(fakeClock, ms)   later: window.__clock(ms) sets the offset again.
export function fakeClock(ms: number) {
  const Real = Date, origin = performance.timeOrigin; let off = ms
  const now = () => Real.now() + off
  // a Proxy, not a subclass: static members, instanceof and the prototype stay the page's own
  ;(window as any).Date = new Proxy(Real, {
    construct: (t, a, nt) => a.length ? Reflect.construct(t, a, nt === t ? t : nt) : new t(now()),
    apply: () => new Real(now()).toString(),
    get: (t, k) => k === 'now' ? now : Reflect.get(t, k),
  })
  Real.prototype.constructor = (window as any).Date
  Object.defineProperty(performance, 'timeOrigin', { get: () => origin + ms, configurable: true })   // a page's own start: a later jump (sleep) does not move it
  ;(window as any).__clock = (v: number) => { off = v }
}
