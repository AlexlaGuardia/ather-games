"""blender -b -P dec.py -- <in.npz> <out.npz> <tris>: Blender's collapse decimation (keeps thin sheets closed, where fast_simplification tears them)"""
import bpy, sys, numpy as np
i, o, n = sys.argv[sys.argv.index('--') + 1:]; d = np.load(i); V, F = d['v'], d['f']
bpy.ops.wm.read_factory_settings(use_empty=True); me = bpy.data.meshes.new('m'); me.from_pydata(V.tolist(), [], F.tolist()); ob = bpy.data.objects.new('m', me); bpy.context.scene.collection.objects.link(ob)
m = ob.modifiers.new('d', 'DECIMATE'); m.ratio = int(n) / len(F); m.use_symmetry = False; m.use_collapse_triangulate = True
e = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh(); e.calc_loop_triangles(); np.savez(o, v=[tuple(v.co) for v in e.vertices], f=[tuple(t.vertices) for t in e.loop_triangles])
