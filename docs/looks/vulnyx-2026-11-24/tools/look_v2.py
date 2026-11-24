"""blender -b -P look_v2.py -- <glb> <out prefix> [size]: look.py's views + a muzzle close-up"""
import os; exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'look.py')).read()); shot('muzzle', -.35, .02, .95, (0, -.20, .385), 24)
