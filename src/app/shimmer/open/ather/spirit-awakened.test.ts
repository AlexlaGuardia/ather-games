// BETA M244 sheet 1: the four awakened Vulnara forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-awakened.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { AWAKENED_FORMS, AWAKEN_GROW, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const names = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.vulnara![b].toLowerCase())
ok(names.join() === 'vulnarok,vulnalys,vulnavex,vulnamyr', `the four names in branch order (${names})`)
ok(Object.keys(AWAKENED_FORMS).sort().join() === [...names].sort().join(), 'one look per name, no more')
const vulnara = SECOND_FORMS.fox!.mana!
for (const n of names) {
  const L = AWAKENED_FORMS[n]
  ok(L.name === n && L.url === `/open/spirits/${n}-rigged.glb` && L.form === 'mana', `${n}: her own glb + a form look (rigLook keeps it)`)
  ok(AWAKEN_GROW[n] > formGrow('vulnara') && L.h > vulnara.h * 1.15, `${n}: grown past Vulnara (dial ${AWAKEN_GROW[n]} vs ${formGrow('vulnara')}, h ${L.h.toFixed(3)} vs ${vulnara.h.toFixed(3)})`)
  ok(L.glow?.part === 'aura', `${n}: her aura part drawn as the glow part`)
  const f = `public${L.url}`; ok(existsSync(f), `${f} exists`)
  if (existsSync(f)) {
    const b = readFileSync(f), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'))
    const nodes = (j.nodes as { name?: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
    ok(['body', 'eyes', 'aura', 'b_head', 'b_root'].every(x => nodes.includes(x)), `${n}: glb nodes body / eyes / aura / bones`)
    ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `${n}: clips ${clips}`)
    ok(f !== `public${vulnara.url}` && readFileSync(f).length !== readFileSync(`public${vulnara.url}`).length, `${n}: not Vulnara's file`)
  }
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
}
console.log(`spirit-awakened: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
