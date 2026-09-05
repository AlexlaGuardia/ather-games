/**
 * Dump the SHIPPED Hollow blob field as JSON, for the silhouette front-end of image-to-3D.
 *
 * ★ WHY THIS EXISTS (2026-09-05, sprites lane). Three text-to-3D attempts proved the model has two
 * attractors and nothing between them: name a person and you get anatomy with a FACE, a loincloth
 * and boots (every canon negative ignored); remove every person-word and you get flawless goop with
 * no body. Counts are ignored too — "exactly two columns" returned one. A Hollow is defined by
 * being ALMOST a person, which is exactly the place a prompt cannot reach.
 *
 * So stop asking and start SHOWING: image-to-3D follows a shape you hand it. The shape we hand it
 * is the body canon-derived code already builds — imported from `hollow-pose`, never a copy of its
 * numbers, so the silhouette cannot drift away from the body the game actually poses.
 *
 * Run: npx tsx tools/render/hollow_field_dump.mts <form> <t> > field.json
 */
import { hollowField } from '../../src/app/shimmer/voxel3d/hollow-pose'

const form = (process.argv[2] ?? 'stalker') as 'warden' | 'stalker' | 'caster'
const t = Number(process.argv[3] ?? 0)
process.stdout.write(JSON.stringify({ form, t, blobs: hollowField(t, form) }))
