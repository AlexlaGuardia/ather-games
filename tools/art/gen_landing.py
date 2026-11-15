"""Landing-page key art for ather.games (Jin hub, 2026-11-15). Text-only, no image inputs.
flux-1.1-pro-ultra on Replicate (BFL: commercial use of outputs permitted). Same pipeline Magii used for Kael.
Built against canon, never inventing a look:
  · design-briefs/shimmer-garden-atmosphere.md (LOCKED): honey-gold tended light, luminous gold mana-mist,
    motes drifting DOWN (the Anemonyx seed-wind), saturation = tended-ness.
  · world/ather.md: home plot = a cloud-walled floating island whose edge is a fall; one light (the Core),
    a blaze you cannot look at by day in an OPEN BLUE SKY; no moon, nothing else in the sky.
No characters or spirits: their looks are canon-locked elsewhere and a hero is not where to invent one.
Usage: python3 gen_landing.py hero 3 | plot 2   -> landing/<kind>-<n>.png"""
import os, sys, urllib.request, replicate

with open("/root/guardia-core/.env") as f:
    for line in f:
        if line.startswith("REPLICATE_API_TOKEN"):
            os.environ["REPLICATE_API_TOKEN"] = line.split("=", 1)[1].strip().strip('"')

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "landing")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

STYLE = ("Stylized painterly fantasy key art for a cozy open-world game, soft hand-painted brushwork, "
         "clean simple shapes, gentle low-poly hints in the land, luminous and warm, no text, no logo, no people, no animals.")
SKY = ("An open bright blue sky. High overhead, out of frame, a single blazing golden light pours down warm honey-gold "
       "sunlight. Nothing else in the sky: no moon, no planets, no stars.")

PROMPTS = {
    "hero": ("hero", "16:9",
        STYLE + " " + SKY + " Wide cinematic view: a small floating island garden drifts in the sky on the RIGHT side of "
        "the frame, a rounded grassy island with a tended green garden of neat squares, a few young trees, a tiny stone "
        "gate arch, its rocky underside trailing roots and falling into soft mist. Around it, tall glowing walls of white "
        "and gold cloud. Glowing golden mist hangs in the air and tiny luminous golden motes drift slowly downward like "
        "seeds on the wind. The LEFT and lower-left of the frame is calm open sky and soft cloud, darker toward the bottom, "
        "leaving clear space for a title."),
    "plot": ("plot", "4:3",
        STYLE + " " + SKY + " Close view of a floating island home garden in the sky: soft green grass divided into a "
        "few neat garden squares, some tended and lush with warm golden light, the outer squares still veiled in pale "
        "drifting mist waiting to be claimed. A small stone gate arch at one side. The island edge drops away into "
        "glowing white and gold cloud. Tiny luminous golden motes drift down."),
}

def run(kind, n):
    name, ar, prompt = PROMPTS[kind]
    os.makedirs(HERE, exist_ok=True)
    for i in range(1, n + 1):
        out = replicate.run(MODEL, input={"prompt": prompt, "aspect_ratio": ar, "output_format": "png",
                                          "safety_tolerance": 2, "raw": False})
        url = out if isinstance(out, str) else (out.url if hasattr(out, "url") else str(out))
        path = os.path.join(HERE, f"{name}-{i}.png")
        urllib.request.urlretrieve(url, path)
        print(path)

if __name__ == "__main__":
    run(sys.argv[1], int(sys.argv[2]))
