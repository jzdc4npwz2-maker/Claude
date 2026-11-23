# raw.mp3 (ElevenLabs) + scribe_words.json -> voice.wav (48 kHz mono, pauses tightened, sped up) + words.json
# 1) every detected pause (> 0.25 s under -38 dB) is cut down to GAP (sentence ends keep a bit more),
# 2) the whole thing is sped up by TEMPO with ffmpeg atempo (pitch kept),
# 3) word times are mapped through both steps. The video starts LEAD s before the first word.
import json, subprocess, re, numpy as np, soundfile as sf
SR = 48000; TEMPO = 1.3; LEAD = 0.25
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "raw.mp3", "-ac", "1", "-ar", str(SR), "raw.wav"], check=True)
x, _ = sf.read("raw.wav")
log = subprocess.run(["ffmpeg", "-i", "raw.wav", "-af", "silencedetect=noise=-38dB:d=0.25", "-f", "null", "-"], capture_output=True, text=True).stderr
st = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]
en = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
W = json.load(open("scribe_words.json"))["words"]
W = [w for w in W if w["type"] == "word"]
def sentence_end_before(t):
    prev = [w for w in W if w["end"] <= t + 0.05]
    return bool(prev) and prev[-1]["text"][-1] in ".?!"
segs = []  # (src0, src1, kept length)
cur = 0.0
for a, b in zip(st, en):
    if a < 0.05: continue
    keep = 0.26 if sentence_end_before(a) else 0.14
    if a < 6.1: keep = 0.4  # breath after the hook
    keep = min(keep, b - a)
    segs.append((cur, a, None))
    segs.append((a, b, keep))
    cur = b
segs.append((cur, len(x) / SR, None))
out, mp = [], []  # mp: (src time, dst time) knots
t_dst = 0.0
for a, b, keep in segs:
    i0, i1 = int(a * SR), int(b * SR)
    if keep is None:
        out.append(x[i0:i1]); mp.append((a, t_dst)); t_dst += b - a; mp.append((b, t_dst))
    else:
        h = int(keep * SR / 2)
        out.append(np.concatenate([x[i0:i0 + h], x[i1 - h:i1]]))
        mp.append((a, t_dst)); t_dst += 2 * h / SR; mp.append((b, t_dst))
y = np.concatenate(out)
sf.write("tight.wav", y, SR)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "tight.wav", "-af", f"atempo={TEMPO},adelay={int(LEAD*1000)},apad=pad_dur=0.6",
                "-ar", str(SR), "-ac", "1", "voice.wav"], check=True)
src, dst = np.array(mp).T
def T(t): return round(float(np.interp(t, src, dst)) / TEMPO + LEAD, 3)
words = [{"w": w["text"], "s": T(w["start"]), "e": T(w["end"])} for w in W]
v, _ = sf.read("voice.wav")
dur = len(v) / SR
json.dump({"words": words, "duration": round(dur, 3)}, open("words.json", "w"), ensure_ascii=False, indent=1)
line = []
for w in words:
    line.append(f'{w["w"]}@{w["s"]:.2f}')
    if w["w"][-1] in ".?!": print(" ".join(line)); line = []
print("TOTAL", dur)
