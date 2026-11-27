// BETA M226 (play, 2026-11-27): WHICH SECOND FORMS EVERY KEEPER SEES. Alex OK'd 11-27 ("they all look good for now") the Athowl line
// redo (bc74f465), the Hovari line redo (281c1f45) and Aurlotl's glyph panels (dbac3642): a player's evolved spirit (pot.element) in one
// of these forms draws it. Every other form stays OWNER PREVIEW (M204: redone forms are the owner's until Alex OKs them): a player's
// evolved spirit in one of those keeps her base look. On Alex's next OK a form's name joins PUBLIC_FORMS (M202 11-27: Shellmere + Croakling lines).
// ★ PURE data (no three, no React).
import type { Species } from '../../spirits/spirit'
import { formLook, type SpiritElement, type SpiritLook } from './spirit-models'

export const PUBLIC_FORMS: ReadonlySet<string> = new Set([
  'mystowl', 'voltowl', 'cragowl', 'tideowl',     // the Athowl line (redo bc74f465)
  'voltari', 'lumari', 'obsidari', 'tidari',      // the Hovari line (redo 281c1f45)
  'aurlotl',                                      // Manalotl's Mana form (glyph panels dbac3642)
  'mesamere', 'aurmere', 'voltmere', 'tidemere',  // M202 the Shellmere line (Alex OK 11-27, build fe54f540)
  'croakrill', 'croakara', 'croakore', 'croakarc', // M202 the Croakling line pass 2 (Alex OK 11-27, build b1cf88ca)
])

/** her second form's look for this keeper: every keeper sees a PUBLIC form, only the owner sees the rest; null = draw her base */
export const keeperFormLook = (s: Species | null | undefined, el: SpiritElement | null | undefined, owner: boolean): SpiritLook | null => {
  const f = formLook(s, el)
  return f && (owner || PUBLIC_FORMS.has(f.name)) ? f : null
}
