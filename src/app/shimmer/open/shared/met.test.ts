// node test: npx tsx src/app/shimmer/open/shared/met.test.ts — the met set + Morel's 'met only' gate (BETA M33)
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) } }
;(globalThis as any).window = globalThis
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
void (async () => {
const { hasMet, markMet, metList } = await import('./met')
const { morelPing } = await import('./morel-ping')
ok(!hasMet('Gregory') && metList().length === 0, 'a new keeper has met no one')
ok(morelPing('errand', 'x', 'Gregory') === false, 'an UNMET npc cannot ping')
markMet('Gregory'); markMet('gregory ')
ok(hasMet('GREGORY') && metList().length === 1, 'a first talk marks met, once, by name (case/space-insensitive)')
ok(morelPing('errand', 'x', 'Gregory') === true, 'a MET npc can ping')
ok(morelPing('rinquest', 'y', 'Fennel', true) === true && !hasMet('Fennel'), "an introduction call goes through (Fennel's first) and does not itself count as met")
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
})()
