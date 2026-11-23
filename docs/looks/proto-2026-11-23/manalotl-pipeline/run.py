import time,sys
from gradio_client import Client, handle_file
c=Client("tencent/Hunyuan3D-2")
t=time.time()
r=c.predict(caption="",image=handle_file("/tmp/manalotl-spike/clean.png"),mv_image_front=None,mv_image_back=None,mv_image_left=None,mv_image_right=None,steps=30,guidance_scale=5.0,seed=1234,octree_resolution=256,check_box_rembg=True,num_chunks=8000,randomize_seed=False,api_name="/shape_generation")
print("TIME",time.time()-t); print(r)
