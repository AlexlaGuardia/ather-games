"""blender -b -P look_form.py -- <glb> <out prefix> [size] <tint r,g,b>: vulnyx look.py with the form's emissive tint in place of her gold"""
import os, sys
a = sys.argv[sys.argv.index('--') + 1:]; tint = a.pop(); sys.argv = sys.argv[:sys.argv.index('--') + 1] + a
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../vulnyx-2026-11-24/tools/look.py')).read()
old = "ad.inputs[2].default_value = (1, .65, .07, 1)"; assert old in src
exec(src.replace(old, "ad.inputs[2].default_value = (%s, 1)" % tint))
