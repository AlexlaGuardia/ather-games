# ── MESHY GLB IMPORT — Blender-side helper for the render-to-sprite pipeline ──
# Runs INSIDE Blender. Imports a Meshy-generated GLB, joins its meshes into one object,
# recenters it to the origin, and (optionally) normalizes its size so the existing
# camera/lighting rigs in the render scripts frame it the same way they frame a
# procedurally-built prop. Returns the mesh object, ready to render.
#
# Usage inside a render script (e.g. a dead-prop render built like coin.py):
#   from meshy_import import import_glb
#   obj = import_glb("/tmp/meshy/lantern.glb", fit_size=2.0)   # then light + render as usual
#
# Generate the GLB first, outside Blender:
#   python3 tools/render/meshy.py --text "a weathered dead-grey stone lantern" --out /tmp/meshy/lantern.glb
import bpy


def import_glb(path, join=True, recenter=True, fit_size=None, name=None):
    """Import a GLB and return the (single) mesh object.

    join      — join all imported meshes into one object.
    recenter  — move the object so its bounding-box center sits at the world origin.
    fit_size  — if set, scale uniformly so the largest bbox dimension equals this (Blender units).
    name      — rename the result.
    """
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"no mesh objects imported from {path}")

    if join and len(meshes) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        obj = meshes[0]
    else:
        obj = meshes[0]

    # apply the glTF import transform (gltf comes in Y-up rotated) so bbox math is real
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    if recenter:
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
        obj.location = (0.0, 0.0, 0.0)

    if fit_size:
        dims = obj.dimensions
        longest = max(dims.x, dims.y, dims.z) or 1.0
        obj.scale = tuple(s * (fit_size / longest) for s in obj.scale)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if recenter:
            bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
            obj.location = (0.0, 0.0, 0.0)

    if name:
        obj.name = name
    return obj
