// Mana'nana's music bed — now a thin instance of the shared arcade MusicBed
// (src/lib/arcade/musicBed.ts). Kept here so call sites (`import { music }`) are
// unchanged; the reusable Web Audio bus + duck + unmount-teardown lives in
// lib/arcade so every game shares one clean audio layer. muteKey preserved so
// existing players keep their mute setting.

import { createMusicBed } from '@/lib/arcade/musicBed'

export const music = createMusicBed({ src: '/manana/music.mp3', muteKey: 'manana.vo.muted' })
