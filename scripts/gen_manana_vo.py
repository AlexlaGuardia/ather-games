#!/usr/bin/env python3
"""Bake the real Mana'nana commentator VO bank — ElevenLabs George — + manifest.json."""
import os, json, urllib.request, sys

OUT = "/root/ather-games/public/manana/vo"
os.makedirs(OUT, exist_ok=True)
VOICE = "JBFqnCBsd6RMkjVDRZzb"  # George — warm British storyteller

KEY = None
for line in open("/root/guardia-core/.env"):
    if line.startswith("ELEVENLABS_API_KEY="):
        KEY = line.strip().split("=", 1)[1].strip().strip('"').strip("'")

BANK = {
    "start":      ["Right then. Let's see what you make of it.", "Ooh, a fresh board. Lovely.", "Off we go. No pressure."],
    "nice":       ["Oh, well done.", "Mm, nicely spotted.", "Good eye, that.", "There we are."],
    "impressive": ["Now that, that was impressive.", "Ooh, tidy.", "Someone's paying attention.", "Didn't see that coming."],
    "big":        ["Marvellous. Simply marvellous.", "Oh, gorgeous.", "Well, I never.", "Now you're just showing off."],
    "low_moves":  ["Careful now. Not many moves left.", "Mm. Getting a bit tight.", "Steady. Make them count."],
    "milestone":  ["Ah. You've earned that one.", "There's the reward. Well kept.", "Onward, then."],
    "shuffle":    ["Hmm. Let's shuffle these along.", "A fresh arrangement, then."],
    "over":       ["Well played. Rest now.", "That'll do nicely. Until next time.", "A fine run. Truly."],
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
