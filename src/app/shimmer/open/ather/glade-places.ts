// ── BETA M153 s1c-2: THE GLADE'S HOUSES AS PIECES ──
// What Place mode moves that is not a person and not a palette piece: Greg's home, the five lots (house and pad together), Yarrow's
// teaching crate. Where each stands NOW (moved, or the code's own spot). ASK AT THE CALL, key a memo on gladePeopleVersion().
import { PLACES, placeId, type Place } from '../../world/builder-props'
import { gladePlace } from './glade-people'
import { PLACE_SIZE, type Ground, type Rect } from './glade-pads'
import { lotAt, lotSpots } from './moonwell-glade'
import { gladeHome, gladeHomeDoor, gladeHomeBoxes, gladeHomeY, HOME_H } from './glade-home'
import { crateBoxes, crateY, lotLevel, lotSolids, plinthOf, standOn, yarrowCrate } from './glade-lots'
import { GLADE } from './relief'
import type { Box } from '../terrain-world'

export interface GladePlace extends Rect { place: Place; id: string; name: string; h: number; moved: boolean }
/** builder labels */
const NAME: Record<Place, string> = { home: "Greg's home", fennel: "Fennel's house", hazel: "Hazel's house", sax: "Sax's house", yarrow: "Yarrow's house", mallow: "Mallow's house", jars: "Yarrow's jars" }
export function gladePlaces(): GladePlace[] {
  return PLACES.flatMap(place => {
    const crate = place === 'jars' ? yarrowCrate()?.crate : null, at = place === 'home' ? gladeHome() : place === 'jars' ? crate : lotAt(place)
    return at ? [{ place, id: placeId(place), name: NAME[place], x: at.x, z: at.z, yaw: at.yaw, ...PLACE_SIZE[place], h: place === 'home' ? HOME_H : place === 'jars' ? 0.95 : 3.4, moved: !!gladePlace(place) }] : []
  })
}
/** the height it stands at */
export function placeY(place: Place, land: Ground): number {
  return place === 'home' ? gladeHomeY(land) : place === 'jars' ? crateY(standOn(land), GLADE.y) : lotLevel(place, land, GLADE.y).top
}
/** its own solids; a lot's plinth only when asked (`pad`): a chair on the pad is not in the house's way */
export function placeSolids(place: Place, land: Ground, pad = false): Box[] {
  if (place === 'home') return gladeHomeBoxes(land, -1e6, -1e6, 1e6, 1e6)
  if (place === 'jars') return crateBoxes(standOn(land), GLADE.y)
  return [...lotSolids(place, lotLevel(place, land, GLADE.y).top), ...(pad ? plinthOf(place, land, GLADE.y) : [])]
}
/** where a keeper stands to be at it: its door (the crate: its front) */
export function placeDoor(place: Place): { x: number; z: number } {
  if (place === 'home') return gladeHomeDoor()
  if (place === 'jars') { const c = yarrowCrate()!.crate; return { x: c.x + Math.sin(c.yaw) * 1.3, z: c.z + Math.cos(c.yaw) * 1.3 } }
  return lotSpots([place])[0]
}
