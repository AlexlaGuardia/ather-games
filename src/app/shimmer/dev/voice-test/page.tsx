"use client";
import { useRef, useState } from "react";

const VOICES = [
  { id: "laura", name: "Laura", desc: "Quirky Attitude — young, American" },
  { id: "sarah", name: "Sarah", desc: "Mature, Confident — young, American" },
  { id: "lily", name: "Lily", desc: "Velvety Actress — British, mid-age" },
];

const MOODS = [
  { id: "snark", label: "Snark", line: "Nothing's broken. Honestly disappointed. I had a whole rant prepared." },
  { id: "alarm", label: "Alarm", line: "Okay, wake up. Pipeline just choked on a draft and I'm not cleaning this up alone." },
  { id: "genuine", label: "Genuine", line: "Hey. Real talk. Paradise is down this week. Lion's still in range but keep an eye on it." },
  { id: "smug", label: "Smug", line: "Caught that before it hit prod. You're welcome." },
];

export default function VoiceTestPage() {
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function play(voice: string, mood: string) {
    const key = `${voice}_${mood}`;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playing === key) {
      setPlaying(null);
      return;
    }
    const audio = new Audio(`/voice-tests/${key}.mp3`);
    audio.onended = () => setPlaying(null);
    audio.play();
    audioRef.current = audio;
    setPlaying(key);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8 text-white">
      <h1 className="text-2xl font-bold text-violet-400 mb-2">Luna Voice Test</h1>
      <p className="text-sm text-gray-500 mb-8">Pick the voice that IS Luna. 3 voices x 4 moods.</p>

      <div className="space-y-8">
        {MOODS.map((mood) => (
          <div key={mood.id}>
            <h2 className="text-lg font-semibold text-gray-300 mb-1">{mood.label}</h2>
            <p className="text-xs text-gray-600 mb-3 italic">&ldquo;{mood.line}&rdquo;</p>
            <div className="flex gap-3">
              {VOICES.map((voice) => {
                const key = `${voice.id}_${mood.id}`;
                const isPlaying = playing === key;
                return (
                  <button
                    key={key}
                    onClick={() => play(voice.id, mood.id)}
                    className={`flex-1 rounded-lg border px-4 py-3 text-left transition-all ${
                      isPlaying
                        ? "border-violet-500 bg-violet-500/10 text-violet-300"
                        : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div className="font-medium text-sm">{voice.name}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{voice.desc}</div>
                    {isPlaying && <div className="text-xs text-violet-400 mt-1">Playing...</div>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 border-t border-white/5 pt-6">
        <p className="text-xs text-gray-600">
          Settings: stability 0.4, similarity 0.75, style 0.3, model eleven_multilingual_v2
        </p>
      </div>
    </div>
  );
}
