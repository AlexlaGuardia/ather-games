#!/usr/bin/env python3
"""Bake the Vault commentator VO bank — ElevenLabs George. Cozy read for the carry/vault momentum game."""
import os, json, urllib.request
OUT = "/root/ather-games/public/vault/vo"; os.makedirs(OUT, exist_ok=True)
VOICE = "JBFqnCBsd6RMkjVDRZzb"
KEY = None
for line in open("/root/guardia-core/.env"):
    if line.startswith("ELEVENLABS_API_KEY="): KEY = line.strip().split("=",1)[1].strip().strip('"').strip("'")
BANK = {
    "start":    ["Right, off you go. Keep it moving.", "Here we are. Find your rhythm.", "Up we get."],
    "stomp":    ["Ooh, tidy.", "Lovely bit of footwork.", "Now that's how.", "Clean, that."],
    "carrying": ["Good pace, this.", "Still carrying it. Well done.", "You've found the flow now."],
    "best":     ["A new best, smooth as anything.", "Best yet. Marvellous."],
    "over":     ["Ah, and down. It happens.", "That's the run. Good going.", "Rest a moment. Again when you're ready."],
}
def eleven(text, path):
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability":0.45,"similarity_boost":0.8,"style":0.35,"use_speaker_boost":True}}).encode()
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
        data=body, method="POST", headers={"xi-api-key":KEY,"Content-Type":"application/json","Accept":"audio/mpeg"})
    data = urllib.request.urlopen(req, timeout=60).read(); open(path,"wb").write(data); return len(data)
manifest={}; total=0
for trig,lines in BANK.items():
    files=[]
    for i,text in enumerate(lines,1):
        fn=f"{trig}_{i}.mp3"; n=eleven(text,f"{OUT}/{fn}"); files.append(fn); total+=1
        print(f"{fn:<16} {n:>6}b  “{text}”")
    manifest[trig]=files
json.dump(manifest, open(f"{OUT}/manifest.json","w"), indent=2)
print(f"\n{total} clips + manifest.json → {OUT}")
