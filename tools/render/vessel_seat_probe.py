# Projects each bracelet seat centre (+ its rim) into render pixel space for the panel overlay.
# Run: /opt/blender/blender -b -P tools/render/vessel_seat_probe.py | grep SEATS_JSON
# Same camera as vessel_bracelet.render_one; the table in dev/panel/vessel-card.tsx is pasted from this.
import bpy, math, os, sys, json
sys.path.insert(0, "/root/ather-games/tools/render")
from vessel_common import fresh_scene, setup_light_and_cam, RES_X, RES_Y
from bpy_extras.object_utils import world_to_camera_view
R = 0.82; SEAT_R = 0.086; SCALE_Z = 0.34
SEAT_ANGLES = {1: [-90], 2: [-110, -70], 3: [-124, -90, -56]}
STRAND = {0: 0.022, 1: 0.021, 2: 0.030, 3: 0.029}
scene = fresh_scene()
setup_light_and_cam(scene, ortho_scale=2.35, cam_loc=(0.20, -0.55, 3.4))
bpy.context.view_layer.update()
cam = scene.camera
out = {}
for tier in (0, 1, 2, 3):
    top_z = STRAND[tier] * SCALE_Z
    for seats in ((1,) if tier == 0 else (1, 2, 3)):
        pts = []
        for ang in SEAT_ANGLES[seats]:
            t = math.radians(ang)
            sx, sy, sz = R * math.cos(t), R * math.sin(t), top_z
            from mathutils import Vector
            c = world_to_camera_view(scene, cam, Vector((sx, sy, sz)))
            e = world_to_camera_view(scene, cam, Vector((sx + SEAT_R, sy, sz)))
            px, py = c.x * RES_X, (1 - c.y) * RES_Y
            pr = abs(e.x - c.x) * RES_X
            pts.append({"x": round(px, 1), "y": round(py, 1), "r": round(pr, 1)})
        out[f"t{tier}-s{seats}"] = pts
print("SEATS_JSON " + json.dumps(out))
