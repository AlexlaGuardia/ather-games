// Squall's looping storm-bed — an instance of the shared arcade MusicBed.
// Mute is driven by the game (synced from sfx on mount), so no muteKey here.
import { createMusicBed } from '@/lib/arcade/musicBed'

export const music = createMusicBed({ src: '/squall/music.mp3' })
