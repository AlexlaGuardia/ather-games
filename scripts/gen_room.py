#!/usr/bin/env python3
"""Generate THE ROOM surface art via Replicate FLUX-schnell.

Layered hub art for /room (see ROOM_DESIGN.md MASKING PHASE). Each surface ->
public/room/<id>.webp. House style matches gen_cards.py. Floor/ceiling are FLAT
top-down (CSS rotateX supplies perspective — do NOT bake it in).

Usage: python3 scripts/gen_room.py floor    (or no arg = all)
"""
import json, os, sys, time, urllib.request

ENV = "/root/guardia-core/.env"
PUBLIC = "/root/ather-games/public"
MODEL_URL = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"

STYLE = ("vector neon glow line-art on a near-black background, Atari and CRT vector "
         "aesthetic, luminous cyan and warm amber light, minimal, atmospheric, "
         "centered composition, no text, no UI, no words, dark and moody")

# (subject, aspect_ratio)
ROOM = {
    "floor": (
        "top-down overhead view of a dark polished obsidian floor with a glowing inlaid "
        "compass rose at the exact center, concentric luminous rings radiating outward, thin "
        "radial spoke lines reaching the edges, a small glowing emblem at the hub, faint warm "
        "amber and cool cyan light seams on near-black stone, perfectly symmetrical and centered, "
        "flat overhead orthographic, no perspective, no horizon",
        "1:1",
    ),
}

def token():
    for line in open(ENV):
        if line.startswith("REPLICATE_API_TOKEN"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("no REPLICATE_API_TOKEN in .env")

def gen(tok, sid, subject, aspect):
    prompt = f"{subject}, {STYLE}"
    body = json.dumps({"input": {
        "prompt": prompt, "aspect_ratio": aspect,
        "output_format": "webp", "output_quality": 90,
        "num_outputs": 1, "go_fast": True,
    }}).encode()
    req = urllib.request.Request(MODEL_URL, data=body, method="POST", headers={
        "Authorization": f"Bearer {tok}", "Content-Type": "application/json", "Prefer": "wait",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        pred = json.load(r)
    for _ in range(40):
        st = pred.get("status")
        if st == "succeeded":
            break
        if st in ("failed", "canceled"):
            return f"FAILED ({pred.get('error')})"
        time.sleep(2)
        g = urllib.request.Request(pred["urls"]["get"], headers={"Authorization": f"Bearer {tok}"})
        with urllib.request.urlopen(g, timeout=30) as r:
            pred = json.load(r)
    out = pred.get("output")
    url = out[0] if isinstance(out, list) else out
    if not url:
        return "NO OUTPUT"
    dest_dir = os.path.join(PUBLIC, "room")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{sid}.webp")
    urllib.request.urlretrieve(url, dest)
    return f"OK -> {dest} ({os.path.getsize(dest)} bytes)"

if __name__ == "__main__":
    tok = token()
    only = sys.argv[1:] or list(ROOM)
    for sid in only:
        if sid not in ROOM:
            print(f"{sid}: skip (no brief)"); continue
        subject, aspect = ROOM[sid]
        try:
            print(f"{sid}: {gen(tok, sid, subject, aspect)}", flush=True)
        except Exception as e:
            print(f"{sid}: ERROR {e}", flush=True)
