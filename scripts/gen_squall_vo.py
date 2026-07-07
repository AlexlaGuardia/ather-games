#!/usr/bin/env python3
"""Bake the Squall commentator VO bank — ElevenLabs George (the franchise voice) — + manifest.json.
Cozy British storyteller giving an understated calm-over-the-storm read. Lines are canon-neutral."""
import os, json, urllib.request

OUT = "/root/ather-games/public/squall/vo"
os.makedirs(OUT, exist_ok=True)
VOICE = "JBFqnCBsd6RMkjVDRZzb"  # George — warm British storyteller (same as manana)

KEY = None
for line in open("/root/guardia-core/.env"):
    if line.startswith("ELEVENLABS_API_KEY="):
        KEY = line.strip().split("=", 1)[1].strip().strip('"').strip("'")

BANK = {
    "start":      ["Storm's rolling in. Mind yourself.", "Right. Let's weather it.", "Here it comes. Stay light."],
    "close":      ["Ooh, close.", "Felt that one go past.", "Cutting it fine, aren't we.", "Mm. Brave."],
    "weathering": ["Still standing. Good.", "You've the measure of it now.", "Holding up nicely, that."],
    "best":       ["A new best, earned in that wind.", "Best yet. Look at you."],
    "over":       ["Ah. The storm takes this one.", "Down you go. It happens.", "Weathered a fair bit, that. Again?"],
}

def eleven(text, path):
    body = json.dumps({
        "text": text, "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True},
    }).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
        data=body, method="POST",
        headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    data = urllib.request.urlopen(req, timeout=60).read()
    open(path, "wb").write(data)
    return len(data)

manifest = {}
total = 0
for trig, lines in BANK.items():
    files = []
    for i, text in enumerate(lines, 1):
        fn = f"{trig}_{i}.mp3"
        n = eleven(text, f"{OUT}/{fn}")
        files.append(fn); total += 1
        print(f"{fn:<16} {n:>6}b  “{text}”")
    manifest[trig] = files

json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=2)
print(f"\n{total} clips + manifest.json → {OUT}")
