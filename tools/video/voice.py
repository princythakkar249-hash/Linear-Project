"""Narration with Kokoro (open-source neural TTS, runs offline).

    python voice.py <models_dir> <work_dir> [voice]

Writes <work>/audio/<id>.wav for every line of narration.json and <work>/durations.json.
"""
import json
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

models, work = Path(sys.argv[1]), Path(sys.argv[2])
voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"
lines = json.loads((Path(__file__).parent / "narration.json").read_text(encoding="utf-8"))
kokoro = Kokoro(str(models / "kokoro-v1.0.fp16.onnx"), str(models / "voices-v1.0.bin"))
(work / "audio").mkdir(parents=True, exist_ok=True)
durations = {}
for line in lines:
    samples, rate = kokoro.create(line["say"], voice=voice, speed=1.0, lang="en-us")
    sf.write(work / "audio" / f"{line['id']}.wav", samples, rate)
    durations[line["id"]] = round(len(samples) / rate, 3)
(work / "durations.json").write_text(json.dumps(durations, indent=1))
print(f"{len(durations)} lines, {sum(durations.values()):.1f} s of narration")
