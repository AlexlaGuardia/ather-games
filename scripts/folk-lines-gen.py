#!/usr/bin/env python3
"""Transcribe Beat 0½ of the canon script into src/app/shimmer/voxel3d/folk-lines.ts.

The words are Magii's (athernyx CANON/game/shimmer-quests-mainmap.md); this only copies them.
Usage: python3 scripts/folk-lines-gen.py > src/app/shimmer/voxel3d/folk-lines.ts
folk-lines.test.ts parses the same block the same way and fails when the copy drifts.
"""
import json, re, sys

CANON = '/root/athernyx/CANON/game/archive/pre-revamp-2026-11/shimmer-quests-mainmap.md'   # archived 11-21 (the live file is a stub)

# Every locked block this file copies, as (start marker, end marker). Beat 0½ is the Glade's first
# walk; the return beat is Yarrow's counter (LOCKED 2026-09-22, Alex sign-off).
BLOCKS = [('### Beat 0½', '[trigger: resume-Beat-1'),
          ('### The return beat — Yarrow', '**LOCKED 2026-09-22')]

def parse(src: str) -> dict:
    out = {}
    for a, b in BLOCKS:
        start = src.index(a); end = src.index(b, start)
        out.update(parse_block(src[start:end]))
    return out

def parse_block(block: str) -> dict:
    trig = None; out = {}
    for line in block.splitlines():
        m = re.match(r'\[trigger: ([^\s\]|]+)', line)
        if m: trig = m.group(1); out[trig] = []; continue
        if trig is None: continue
        m = re.match(r'\[SCENE: (.*)\]$', line)
        if m: out[trig].append({'scene': m.group(1)}); continue
        m = re.match(r'([A-Z]+): (.*)$', line)
        if m: out[trig].append({'who': m.group(1), 'text': m.group(2)}); continue
        m = re.match(r'> (.*)$', line)
        if m: out[trig].append({'option': m.group(1)}); continue
    return out

# M234 s1: canon renamed the potions 11-27 (game/alchemy.md > THE RECIPES SIT-DOWN: "Lines below that record older names
# as history keep them"). The archived script is such a record, so the copy carries canon's renames, read from the ruling.
ALCHEMY = '/root/athernyx/CANON/game/alchemy.md'
def canon_renames() -> list:
    lines = open(ALCHEMY).read().split('\n')
    i = next((k for k, l in enumerate(lines) if l.startswith('- **Renamed')), None)
    para = '' if i is None else ' '.join(lines[i:i + 4]).split('Lines below')[0]
    return re.findall(r'([A-Z][a-z]+ [A-Z][a-z]+) → \*\*([^*]+)\*\*', para)

def renamed(src: str) -> str:
    for a, b in canon_renames(): src = src.replace(a, b)
    return src

def q(s): return json.dumps(s, ensure_ascii=False)

def emit(d: dict) -> str:
    L = ['''// The Glade's spoken lines — Beat 0½ and Yarrow's return beat of `CANON/game/shimmer-quests-mainmap.md`,
// TRANSCRIBED VERBATIM. `<RIGHT>` / `<WRONG>` stay as the script writes them; recipe-book.ts fills them.
//
// ★ NOTHING HERE IS WRITTEN HERE. Every string is a copy of a locked line (Lark, Alex sign-off
// 2026-09-11 / 09-15; Magii's wiring sheet athernyx 17e2223). Jin owns WHEN a line fires and what
// the world does around it; the words are the Magii seat's. `folk-lines.test.ts` re-parses the
// canon file and fails on one changed character, so a re-ruled line shows up as a red test, not as
// a stale copy — the same discipline the sizes copy in creature-size.ts learned the hard way.
//
// The shape mirrors the script: a trigger is a list of beats, each a spoken line (`who`+`text`),
// a stage direction (`scene`, rendered dim and italic, never spoken), or a player option (`option`,
// the choice's two answers). Speaker names are the script's own caps.
//
// Regenerate: `python3 scripts/folk-lines-gen.py > src/app/shimmer/voxel3d/folk-lines.ts`.

export type Beat =
  | { who: 'GREG' | 'HAZEL' | 'SAX' | 'YARROW' | 'FENNEL' | 'MALLOW'; text: string }
  | { scene: string }
  | { option: string }

export const SCRIPT = {''']
    for k, v in d.items():
        L.append(f'  {q(k)}: [')
        for b in v:
            if 'scene' in b: L.append(f'    {{ scene: {q(b["scene"])} }},')
            elif 'option' in b: L.append(f'    {{ option: {q(b["option"])} }},')
            else: L.append(f'    {{ who: {q(b["who"])}, text: {q(b["text"])} }},')
        L.append('  ],')
    L += ['} as const satisfies Record<string, readonly Beat[]>', '',
          'export type Trigger = keyof typeof SCRIPT', '',
          '/** The beats of a trigger, in script order. */',
          'export function beatsOf(t: Trigger): readonly Beat[] { return SCRIPT[t] }']
    return '\n'.join(L) + '\n'

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--json':
        print(json.dumps(parse(renamed(open(CANON).read())), ensure_ascii=False)); sys.exit(0)
    sys.stdout.write(emit(parse(renamed(open(CANON).read()))))
