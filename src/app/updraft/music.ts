// Updraft's looping bed — an instance of the shared arcade MusicBed.
// Mute is driven by the game (synced from sfx on mount), so no muteKey here.
import { createMusicBed } from '@/lib/arcade/musicBed'

export const music = createMusicBed({ src: '/updraft/music.mp3?v=1' })
