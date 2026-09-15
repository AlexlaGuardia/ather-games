#!/usr/bin/env python3
"""Transcribe Beat 0½ of the canon script into src/app/shimmer/voxel3d/folk-lines.ts.

The words are Magii's (athernyx CANON/game/shimmer-quests-mainmap.md); this only copies them.
Usage: python3 scripts/folk-lines-gen.py > src/app/shimmer/voxel3d/folk-lines.ts
folk-lines.test.ts parses the same block the same way and fails when the copy drifts.
"""
import json, re, sys

CANON = '/root/athernyx/CANON/game/shimmer-quests-mainmap.md'

def parse(src: str) -> dict:
    start = src.index('### Beat 0½'); end = src.index('[trigger: resume-Beat-1')
    trig = None; out = {}
    for line in src[start:end].splitlines():
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

def q(s): return json.dumps(s, ensure_ascii=False)

def emit(d: dict) -> str:
    L = ['''// The Glade's spoken lines — Beat 0½ of `CANON/game/shimmer-quests-mainmap.md`, TRANSCRIBED VERBATIM.
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
        print(json.dumps(parse(open(CANON).read()), ensure_ascii=False)); sys.exit(0)
    sys.stdout.write(emit(parse(open(CANON).read())))
