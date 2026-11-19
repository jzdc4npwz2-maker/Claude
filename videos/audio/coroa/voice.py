# Generates voice.wav (48 kHz mono) and words.json from script.txt using Kokoro (pm_alex), sentence by sentence.
import json, re, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro
k = Kokoro("/home/user/tts_models/kokoro-v1.0.int8.onnx", "/home/user/tts_models/voices-v1.0.bin")
SR = 48000; LEAD = 0.35; SPEED = 1.12
def trim(x, sr):
    e = np.abs(x) > 0.01
    i = np.argmax(e); j = len(x) - np.argmax(e[::-1])
    return x[max(0, i - int(.02 * sr)): min(len(x), j + int(.04 * sr))]
def weight(w):
    v = len(re.findall(r"[aeiouáéíóúâêôãõà]+", w.lower())) or 1
    return v + 0.25 * len(w)
out = [np.zeros(int(LEAD * SR))]; t = LEAD; words = []; sents = []
for line in open("script.txt", encoding="utf8"):
    if not line.strip(): continue
    gap, text = line.rstrip("\n").split("|", 1)
    gap = float(gap)
    if gap: out.append(np.zeros(int(gap * SR))); t += gap
    a, sr = k.create(text, voice="pm_alex", speed=SPEED, lang="pt-br")
    a = trim(np.asarray(a, np.float32), sr)
    a = resample_poly(a, SR, sr).astype(np.float32)
    dur = len(a) / SR
    # word timing: split voiced region proportionally; punctuation adds a pause weight
    toks = text.split()
    ws = [weight(w) + (1.6 if re.search(r"[.,:?!]$", w) else 0) for w in toks]
    tot = sum(ws); c = t
    for w, wt in zip(toks, ws):
        d = dur * wt / tot
        pure = d - (dur * 1.6 / tot if re.search(r"[.,:?!]$", w) else 0)
        words.append({"w": w, "s": round(c, 3), "e": round(c + pure, 3)})
        c += d
    sents.append({"text": text, "s": round(t, 3), "e": round(t + dur, 3)})
    out.append(a); t += dur
out.append(np.zeros(int(0.1 * SR)))
v = np.concatenate(out)
v = v / (np.abs(v).max() + 1e-9) * 0.89
sf.write("voice.wav", v, SR)
json.dump({"words": words, "sentences": sents, "duration": round(len(v) / SR, 3)}, open("words.json", "w"), ensure_ascii=False, indent=1)
for s in sents: print(f'{s["s"]:6.2f}-{s["e"]:6.2f} {s["text"]}')
print("TOTAL", len(v) / SR)
