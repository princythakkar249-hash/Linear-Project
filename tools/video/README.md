# Demonstration video

`video/FlowMatrix_Demo.mp4` (not committed; it is large) is built from real screen recordings of the running app.

| File | Role |
|---|---|
| `narration.json` | the spoken script, one entry per beat |
| `voice.py` | narration with Kokoro, an open-source neural voice that runs offline |
| `record.mjs` | drives the real application in Edge and captures the screen, cursor and zoom targets |
| `compose.py` | zooms, section labels, crossfades, speed-up of long typing stretches (max 2x), voice, music, subtitles |

## Rebuild

Needs the backend on :8000 **with a fresh database** (the scenes expect only the three demo networks), `npm run dev`
on :5173, internet access for the map scene, and a Python environment with
`pip install kokoro-onnx soundfile imageio-ffmpeg numpy pillow`. The voice model files
`kokoro-v1.0.fp16.onnx` and `voices-v1.0.bin` come from the `model-files-v1.0` release of
github.com/thewh1teagle/kokoro-onnx.

```bash
python voice.py <models_dir> <work_dir>
node record.mjs <work_dir>
python compose.py <work_dir> ../../video/FlowMatrix_Demo.mp4
```

To use your own voice, record each line as `<work_dir>/audio/<id>.wav` and update `<work_dir>/durations.json` with its
length in seconds before running `record.mjs`.

The background music is synthesised by `compose.py`, so it carries no third-party licence.
