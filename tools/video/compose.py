"""Edits the recorded clips into the finished video.

    python compose.py <work_dir> <output.mp4>

Adds: eased zoom-ins, gentle speed-up of long clicking/typing stretches (at most 2x), section labels,
crossfades, the narration, original synthesised background music (ducked under the voice) and an .srt file.
Needs: numpy, Pillow, soundfile, imageio-ffmpeg.
"""
import json
import subprocess
import sys
from bisect import bisect_right
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

WORK, OUTPUT = Path(sys.argv[1]), Path(sys.argv[2])
HERE = Path(__file__).parent
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS, RATE = 1920, 1080, 30, 48000
XFADE, MAX_ZOOM, ZOOM_SECONDS = 0.5, 1.7, 0.9
ORDER = ["title", "dashboard", "map", "manual", "maths", "solution", "database", "tech", "outro"]

timeline = json.loads((WORK / "timeline.json").read_text())
durations = json.loads((WORK / "durations.json").read_text())
lines = {n["id"]: n["say"] for n in json.loads((HERE / "narration.json").read_text(encoding="utf-8"))}
DSF, VW, VH = timeline["dsf"], timeline["view"]["width"], timeline["view"]["height"]


# ------------------------------------------------------------------ time remapping
class TimeMap:
    """Piecewise-linear map between recorded (source) time and edited (output) time."""

    def __init__(self, clip):
        marks = [0.0] + [b["t"] for b in clip["beats"]] + [clip["end"]]
        names = [None] + [b["id"] for b in clip["beats"]]
        self.src, self.out = [0.0], [0.0]
        for a, b, name in zip(marks, marks[1:], names):
            cut = sum(max(0, min(b, y) - max(a, x)) for x, y in clip["cuts"])
            length = max(b - a - cut, 0.001)
            hold = 0.0
            if name and length > durations[name] + 2.5:
                target = max(durations[name] + 1.4, length / 2.0)
                hold = min(1.6, 0.3 * target) if not cut else 0.0
                if hold:
                    self.src.append(b - hold)
                    self.out.append(self.out[-1] + target - hold)
                    length = hold
                else:
                    length = target
            self.src.append(b)
            self.out.append(self.out[-1] + length)
        self.length = self.out[-1]

    def to_out(self, t):
        return float(np.interp(t, self.src, self.out))

    def to_src(self, t):
        return float(np.interp(t, self.out, self.src))


# ------------------------------------------------------------------ camera
FULL = (VW / 2, VH / 2, VW)  # centre x, centre y, width (CSS px)


def view_of(rect):
    if rect is None:
        return FULL
    x, y, w, h = rect
    x0, y0, x1, y1 = max(0, x), max(0, y), min(VW, x + w), min(VH, y + h)
    if x1 - x0 < 20 or y1 - y0 < 20:
        return FULL
    width = min(VW, max(x1 - x0, (y1 - y0) * W / H, VW / MAX_ZOOM))
    height = width * H / W
    cx = min(max((x0 + x1) / 2, width / 2), VW - width / 2)
    cy = min(max((y0 + y1) / 2, height / 2), VH - height / 2)
    return cx, cy, width


def ease(k):
    k = min(max(k, 0.0), 1.0)
    return 4 * k ** 3 if k < 0.5 else 1 - (-2 * k + 2) ** 3 / 2


def camera_track(clip, tmap):
    keys = [(tmap.to_out(k["t"]), view_of(k["rect"])) for k in clip["camera"]]

    def at(t):
        current = FULL
        start_view, target, start = FULL, FULL, -10.0
        for kt, view in keys:
            if kt > t:
                break
            k = ease((kt - start) / ZOOM_SECONDS)
            start_view = tuple(a + (b - a) * k for a, b in zip(start_view, target))
            target, start = view, kt
        k = ease((t - start) / ZOOM_SECONDS)
        current = tuple(a + (b - a) * k for a, b in zip(start_view, target))
        return current

    return at


# ------------------------------------------------------------------ section label
def label_image(number, text):
    font = ImageFont.truetype("C:/Windows/Fonts/seguisb.ttf", 34)
    small = ImageFont.truetype("C:/Windows/Fonts/seguisb.ttf", 24)
    width = int(font.getlength(text)) + 130
    img = Image.new("RGBA", (width, 76), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, width - 1, 75], radius=18, fill=(11, 31, 58, 238), outline=(34, 211, 238, 150), width=2)
    d.rounded_rectangle([14, 16, 72, 60], radius=10, fill=(29, 78, 216, 255))
    d.text((43, 38), number, font=small, fill="white", anchor="mm")
    d.text((92, 38), text, font=font, fill="white", anchor="lm")
    return img


# ------------------------------------------------------------------ rendering one clip
def render(name, number):
    clip = timeline["clips"][name]
    tmap = TimeMap(clip)
    camera = camera_track(clip, tmap)
    times = [f["t"] for f in clip["frames"]]
    files = [WORK / "frames" / name / f["file"] for f in clip["frames"]]
    label = label_image(f"{number:02d}", clip["label"]) if clip["label"] else None
    loaded = (None, None)
    cached = (None, None)
    for i in range(int(round(tmap.length * FPS))):
        t = i / FPS
        index = max(0, bisect_right(times, tmap.to_src(t)) - 1)
        cx, cy, width = camera(t)
        alpha = 0.0
        if label is not None:
            alpha = min(ease((t - 0.35) / 0.4), 1 - ease((t - 4.6) / 0.4))
        key = (index, round(cx, 2), round(cy, 2), round(width, 2), round(alpha, 3))
        if key != cached[0]:
            if loaded[0] != index:
                loaded = (index, Image.open(files[index]).convert("RGB"))
            source = loaded[1]
            sx, sy = source.width / VW, source.height / VH
            height = width * H / W
            box = ((cx - width / 2) * sx, (cy - height / 2) * sy, (cx + width / 2) * sx, (cy + height / 2) * sy)
            box = (max(0, box[0]), max(0, box[1]), min(source.width, box[2]), min(source.height, box[3]))
            frame = source.resize((W, H), Image.LANCZOS, box=box)
            if alpha > 0.01:
                chip = label.copy()
                chip.putalpha(chip.getchannel("A").point(lambda v: int(v * alpha)))
                frame.paste(chip, (48, H - 76 - 48 + int((1 - alpha) * 18)), chip)
            cached = (key, np.asarray(frame, dtype=np.uint8))
        yield cached[1]


# ------------------------------------------------------------------ audio
def resample(x, source_rate, target_rate):
    if source_rate == target_rate:
        return x
    n = int(round(len(x) * target_rate / source_rate))
    spectrum = np.fft.rfft(x)
    return np.fft.irfft(spectrum, n) * (n / len(x))


def note(freq, seconds, attack, release, harmonics=(1.0, 0.28, 0.1)):
    t = np.arange(int(seconds * RATE)) / RATE
    wave = sum(a * np.sin(2 * np.pi * freq * (k + 1) * t) for k, a in enumerate(harmonics))
    env = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (seconds - t) / release))
    return wave * env


def music(total):
    """A quiet original ambient pad with sparse soft plucks (no third-party material)."""
    hz = lambda midi: 440 * 2 ** ((midi - 69) / 12)
    chords = [[48, 55, 64, 71, 74], [45, 52, 60, 67, 71], [41, 48, 57, 64, 69], [43, 50, 59, 62, 69]]
    bar, out = 6.4, np.zeros((int((total + 8) * RATE), 2))
    rng = np.random.default_rng(7)

    def add(sound, start, left, right):
        a = int(start * RATE)
        b = min(len(out), a + len(sound))
        out[a:b, 0] += sound[: b - a] * left
        out[a:b, 1] += sound[: b - a] * right

    for i in range(int(total / bar) + 1):
        chord = chords[i % len(chords)]
        for j, midi in enumerate(chord):
            pan = 0.35 + 0.3 * (j / (len(chord) - 1))
            add(note(hz(midi) * 0.999, bar + 1.6, 1.8, 2.2) * 0.055, i * bar, 1 - pan, pan * 0.7)
            add(note(hz(midi) * 1.002, bar + 1.6, 1.8, 2.2) * 0.055, i * bar, pan * 0.7, 1 - pan)
        for step in range(8):  # plucks on chord tones, one octave up
            midi = chord[int(rng.integers(1, len(chord)))] + 12
            t = np.arange(int(1.1 * RATE)) / RATE
            pluck = np.sin(2 * np.pi * hz(midi) * t) * np.exp(-t * 4.5) * np.minimum(1, t / 0.008)
            side = float(rng.uniform(0.3, 0.7))
            add(pluck * 0.05, i * bar + step * bar / 8, 1 - side, side)
    return out[: int(total * RATE)]


def build_audio(starts, maps, total):
    voice = np.zeros(int(total * RATE))
    spoken, subtitles = [], []
    for name in ORDER:
        for b in timeline["clips"][name]["beats"]:
            start = starts[name] + maps[name].to_out(b["t"]) + 0.15
            data, rate = sf.read(WORK / "audio" / f"{b['id']}.wav")
            data = resample(data, rate, RATE)
            a = int(start * RATE)
            end = min(len(voice), a + len(data))
            voice[a:end] += data[: end - a]
            spoken.append((start, start + len(data) / RATE))
            subtitles.append((start, start + len(data) / RATE, lines[b["id"]]))
    voice *= 0.89 / max(1e-6, np.abs(voice).max())

    bed = music(total)
    bed *= 0.20 / max(1e-6, np.abs(bed).max())
    duck = np.ones(len(bed))
    for a, b in spoken:
        duck[max(0, int((a - 0.25) * RATE)): int((b + 0.35) * RATE)] = 0.42
    window = int(0.35 * RATE)  # smooth the ducking
    padded = np.concatenate([np.full(window, duck[0]), duck, np.full(window, duck[-1])])
    csum = np.cumsum(padded)
    duck = ((csum[window:] - csum[:-window]) / window)[window // 2: window // 2 + len(bed)]
    t = np.arange(len(bed)) / RATE
    fade = np.minimum(1, t / 2.0) * np.minimum(1, np.maximum(0, (total - t) / 3.5))
    mix = bed * (duck * fade)[:, None] + voice[:, None]
    sf.write(WORK / "mix.wav", np.clip(mix, -1, 1), RATE)
    return subtitles


def display_text(s):
    for a, b in (("Flow Matrix", "FlowMatrix"), ("Open Street Map", "OpenStreetMap"), ("A X equals B", "AX = B"),
                 ("x one", "x1"), ("x two", "x2"), ("x three", "x3"), ("x four", "x4"), ("Sim Pie", "SymPy"),
                 ("Num Pie", "NumPy"), ("Sigh Pie", "SciPy"), ("Fast A P I", "FastAPI"), ("C S S", "CSS"),
                 ("Postgres", "PostgreSQL"), ("Gauss Jordan", "Gauss-Jordan"), ("One way", "One-way"),
                 ("one way", "one-way"), ("dead end", "dead-end")):
        s = s.replace(a, b)
    return s


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


# ------------------------------------------------------------------ assembly
def main():
    maps = {n: TimeMap(timeline["clips"][n]) for n in ORDER}
    starts, cursor = {}, 0.0
    for name in ORDER:
        starts[name] = cursor
        cursor += round(maps[name].length * FPS) / FPS - XFADE
    total = cursor + XFADE
    print(f"edited length {total:.1f} s")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    silent = WORK / "picture.mp4"
    encoder = subprocess.Popen(
        [FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
         "-profile:v", "high", str(silent)], stdin=subprocess.PIPE)

    frames_total = int(round(total * FPS))
    overlap = int(round(XFADE * FPS))
    written, tail = 0, []

    def emit(frame):
        nonlocal written
        gain = min(1.0, written / (FPS * 0.6), (frames_total - written) / (FPS * 1.2))
        if gain < 0.999:
            frame = (frame.astype(np.float32) * max(0.0, gain)).astype(np.uint8)
        encoder.stdin.write(frame.tobytes())
        written += 1

    app_number = 1
    for position, name in enumerate(ORDER):
        number = app_number
        if timeline["clips"][name]["label"]:
            app_number += 1
        hold = []
        count = int(round(maps[name].length * FPS))
        for i, frame in enumerate(render(name, number)):
            if tail and i < len(tail):  # crossfade with the end of the previous clip
                k = (i + 1) / (len(tail) + 1)
                frame = (tail[i] * (1 - k) + frame * k).astype(np.uint8)
            if position < len(ORDER) - 1 and i >= count - overlap:
                hold.append(frame)
            else:
                emit(frame)
        tail = hold
        print(f"  rendered {name} ({maps[name].length:.1f}s)", flush=True)
    for frame in tail:
        emit(frame)
    encoder.stdin.close()
    if encoder.wait():
        raise SystemExit("video encoding failed")

    subtitles = build_audio(starts, maps, written / FPS)
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(silent), "-i", str(WORK / "mix.wav"),
                    "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", str(OUTPUT)], check=True)
    srt = "".join(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{display_text(s)}\n\n" for i, (a, b, s) in enumerate(subtitles, 1))
    OUTPUT.with_suffix(".srt").write_text(srt, encoding="utf-8")
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size / 1e6:.1f} MB), {written / FPS:.1f} s")


main()
