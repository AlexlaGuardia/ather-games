// continent/door-talk.ts (M13 part 3): the counters talk first, with SIGNED lines only, each answer opens one thing
import { smithTalk, templeTalk, beatTalk, DOOR_ASK } from './door-talk'
import { RUNESMITH_CUT, IDONY_HUSH, IDONY_AFTER, idonyBeat } from '../business/errand-lines'
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
const opened: string[] = []; let byes = 0
const acts = { open: (k: string) => { opened.push(k) }, bye: () => { byes++ } }
const s = smithTalk('smith:star', acts)
ok(s.line === RUNESMITH_CUT, "the runesmith's bubble is lark's signed cut line")
ok(s.options.length === 2 && s.options[0].label === DOOR_ASK.cut && s.options[1].label === DOOR_ASK.bye, 'two answers: cut, goodbye')
s.options[0].pick(); ok(opened.at(-1) === 'smith:star', 'cut opens that seat\'s counter, nothing else')
s.options[1].pick(); ok(byes === 1, 'goodbye leaves')
ok(templeTalk(false, acts).line === IDONY_HUSH && templeTalk(true, acts).line === IDONY_AFTER, 'Idony is hushed while the bracelet is unwritten, her after-line once it is')
const t = templeTalk(false, acts)
t.options[0].pick(); ok(opened.at(-1) === 'idony', 'inscribe opens Idony\'s counter')
t.options[1].pick(); ok(opened.at(-1) === 'smith:enchant', "the Temple's runesmith opens the Enchant seat's counter")
ok(t.options.length === 3, 'her twin has nothing to open yet, so is not an answer')
const steps = idonyBeat('Ember', true)
const labels = steps.map((_, i) => beatTalk(steps, i, () => {}).options[0].label)
ok(labels.filter(l => l === 'Say it: “Ember.”').length === 1 && labels.at(-1) === 'Take the bracelet' && labels[0] === '…', `the beat's answers: pauses, the word once, then take it (${labels.join(' | ')})`)
ok(steps.every((st, i) => beatTalk(steps, i, () => {}).line === (st.idony ?? '') && beatTalk(steps, i, () => {}).scene === st.scene), 'every beat step shows its signed scene + line verbatim')
console.log(`door-talk: ${n - fails} ok, ${fails} fail`)
process.exit(fails ? 1 : 0)
