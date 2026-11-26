"""blender -b -P headshot.py -- <glb> <out prefix> <tint r,g,b> : look.py's recipe, but only close head shots (front, three-quarter, side) aimed at the eyes"""
import os, sys
a = sys.argv[sys.argv.index('--') + 1:]; tint = a.pop(); sys.argv = sys.argv[:sys.argv.index('--') + 1] + a
src = open('/root/ather-games/docs/looks/vulnyx-2026-11-24/tools/look.py').read()
old = "ad.inputs[2].default_value = (1, .65, .07, 1)"; assert old in src; src = src.replace(old, "ad.inputs[2].default_value = (%s, 1)" % tint)
cut = src.index("R = max(1.,"); assert cut > 0
src = src[:cut] + '''
bpy.context.view_layer.update()
E = [o for o in ms if o.name.startswith('eyes')][0]; EP = np.array([tuple(E.matrix_world @ v.co) for v in E.data.vertices])
BP = np.vstack([[tuple(o.matrix_world @ v.co) for v in o.data.vertices] for o in ms if o.name.startswith('body')])
lo2, hi2 = EP.min(0), EP.max(0); tg = ((lo2 + hi2) / 2); tg[0] = 0
near = BP[BP[:, 1] < tg[1] + .25]; hw = max(abs(near[:, 0]).max(), .2); tg[2] -= .02
for f, az, el in (('hfront', 0, .10), ('htq', -.6, .14), ('hside', -math.pi / 2, .05)): shot(f, az, el, hw * float(os.environ.get("HM", "6.5")), tuple(tg + np.array([0, .1 if f == 'hside' else 0, 0])), 22, 520, 520)
'''
exec(src)
