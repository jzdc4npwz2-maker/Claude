# Sound for "O navio que não aguentou 20 minutos" (Vasa, 47.53 s): narration (voice.wav, untouched) + an original score
# and every effect, synthesized with the skill's DSP kit. Event times mirror src/videos/vasa/story.ts. Run from audio/vasa:
#   python3 vasa_audio.py   ->  mix.wav (48 kHz, exactly 1426 frames = 47.533 s), music / sfx / voice stems
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from dsp import SR, TAU, ns, tt, rng, lp, hp, bp, colored, fades, place, pan, make_ir, convolve_st, integrated, true_peak, write_wav, dbg
import instruments as I
from sfx_gen import whoosh, oof, whoa, creak, boot, wood_crack, timber_tear, bubbles, splash_big, water_bed, hurrah, applause, breeze, flag_flutter, bird_chirps, babble

DUR = 1426 / 30
N = ns(DUR)
F = I.m2f
R = rng(23)
T = dict(flash=4.70, s2=4.70, guns=10.16, s4=11.53, run=13.47, third=15.35, roll=16.42, stop=17.65, let=18.03, s6=19.47,
         breeze=21.47, heel=22.28, water=23.21, down=25.18, s7=25.73, top=26.62, low=27.79, bike=29.33, fridge=30.07,
         wind=31.41, fall=31.97, s8=32.3, s9=34.87, salt=37.19, s10=38.87, lift=40.8, s11=42.67, museum=45.07)

# ---------------------------------------------------------------- small instruments
def kick(vel=0.9, dur=0.45):
    t = tt(dur); f = 48 + 90 * np.exp(-t / 0.035)
    y = np.sin(np.cumsum(TAU * f / SR)) * np.exp(-t / 0.16) + 0.4 * lp(R.standard_normal(len(t)), 900) * np.exp(-t / 0.01)
    return fades(y * vel, 0.0005, 0.03)
def thud(vel=1.0, f=55, dur=0.7):
    t = tt(dur)
    y = np.sin(np.cumsum(TAU * (f + 60 * np.exp(-t / 0.03)) / SR)) * np.exp(-t / 0.18) + lp(R.standard_normal(len(t)), 500) * np.exp(-t / 0.04) * 0.8
    return fades(y * vel, 0.0005, 0.05)
def knock(vel=0.5, f=180):  # wooden gun-port lid slapping open
    t = tt(0.25)
    y = np.sin(TAU * f * t) * np.exp(-t / 0.05) + bp(R.standard_normal(len(t)), 400, 2500) * np.exp(-t / 0.012) * 0.8
    return fades(y * vel, 0.0003, 0.03)
def roll_out(vel=0.4, dur=0.6):  # a cannon carriage rumbling forward
    t = tt(dur); y = lp(R.standard_normal(len(t)), 220) * (0.6 + 0.4 * np.sin(TAU * 14 * t)) * np.sin(np.pi * t / dur) ** 0.6
    return fades(y * vel * 2.2, 0.01, 0.05)
def clank(vel=0.6, k=1.0):  # the fridge hitting the cobbles
    from dsp import modal
    modes = [(420 * k, 1.0, 0.35), (980 * k, 0.6, 0.22), (1760 * k, 0.4, 0.15), (2630 * k, 0.25, 0.1)]
    y = modal(0.9, modes, R); t = tt(0.9)
    y += hp(R.standard_normal(len(t)), 1800) * np.exp(-t / 0.015) * 0.7
    return fades(y * vel, 0.0003, 0.08)
def sweep(f0, f1, dur, vel=0.3):
    t = tt(dur); f = f0 * (f1 / f0) ** (t / dur)
    return fades(np.sin(np.cumsum(TAU * f / SR)) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7 * vel, 0.005, 0.05)
def bell(vel=0.4):  # bicycle bell: two quick dings
    out = np.zeros(ns(0.9))
    for k in range(2):
        g = I.glock(F(98), vel, R, 0.6) + I.glock(F(103), vel * 0.6, R, 0.6); out[ns(k * 0.14): ns(k * 0.14) + len(g)] += g[: len(out) - ns(k * 0.14)]
    return out
def tweet(vel=0.2):
    return I.glock(F([96, 100, 103][R.integers(3)]), vel, R, 0.5)
def hum(dur, f=55, vel=0.3):
    t = tt(dur); y = np.sin(TAU * f * t) + 0.5 * np.sin(TAU * 2.01 * f * t) + 0.25 * np.sin(TAU * 3.0 * f * t)
    return fades(lp(y, 700) * vel, 0.4, 0.8)
def gulls(dur, vel=0.2):  # distant gull cries: falling squeals
    out = np.zeros(ns(dur)); t0 = 0.3
    while t0 < dur - 0.8:
        d = R.uniform(0.25, 0.45); t = tt(d); f = 1500 * np.exp(-t / 0.5) + 900
        y = np.sin(np.cumsum(TAU * f / SR)) * np.sin(np.pi * t / d) ** 1.5
        y = bp(y + 0.3 * np.sign(y), 700, 3500) * vel
        i = ns(t0); out[i: i + len(y)] += y[: len(out) - i]; t0 += R.uniform(0.6, 2.0)
    return out

# ---------------------------------------------------------------- the score
music = np.zeros((2, N))
def put_m(x, t, g=1.0, p=0.0):
    place(music, pan(x, p) if np.ndim(x) == 1 else x, t, g)
CH = {"Dm": [50, 53, 57], "Bb": [46, 50, 53], "F": [45, 48, 53], "C": [48, 52, 55], "Gm": [43, 46, 50], "A": [45, 49, 52],
      "D": [50, 54, 57], "G": [43, 47, 50], "Em": [52, 55, 59], "Bm": [47, 50, 54]}
def chords(t0, prog, dur, vel=0.3, warm=800, bass=True):
    for i, c in enumerate(prog):
        put_m(I.pad([F(m) for m in CH[c]], dur, vel, R, att=0.15, rel=0.6, warm=warm), t0 + i * dur)
        if bass: put_m(I.pluck(F(CH[c][0] - 12), 0.5, R, 1.2, bright=0.3), t0 + i * dur, 0.9, -0.1)
def drums(t0, t1, beat=0.43, vel=1.0):
    b = 0.0; t = t0
    while t < t1 - 0.01:
        pos = b % 4
        if pos in (0, 2.5): put_m(kick(0.8 * vel), t, 0.9)
        if pos in (1, 3): put_m(I.snare(0.45 * vel, R, 0.25, tune=1.2), t, 0.55, 0.1)
        b += 0.5; t += beat / 2
def stab(t, notes, vel=0.5, dur=1.4):
    put_m(I.pad([F(m) for m in notes], dur, vel, R, att=0.01, rel=0.9, warm=1600), t)
    put_m(I.timpani(F(notes[0] - 12 if notes[0] > 40 else notes[0]), 0.9, R, 1.8), t, 1.0)
def fanfare(t0, notes, beat=0.25, vel=0.5):
    for b, d, m in notes:
        put_m(I.brass(F(m - 12), d * beat * 2 + 0.15, vel, R, kind="tuba"), t0 + b * beat, 0.4)
        put_m(I.fife(F(m), d * beat * 2, vel * 0.7, R), t0 + b * beat, 0.5, 0.2)
        put_m(I.glock(F(m + 12), 0.18, R, 0.8), t0 + b * beat, 0.5, -0.2)

# 0-4.7 hook: low drama, the ship going over
stab(0.25, [38, 45, 50, 53], 0.45, 3.6); put_m(I.cymbal(0.5, R, 3.2), 0.25, 0.45)
put_m(I.brass(F(38), 3.8, 0.45, R, kind="tuba"), 0.3, 0.6)
put_m(I.pad([F(m) for m in [26, 33, 38]], 4.2, 0.3, R, att=0.3, rel=0.5, warm=300), 0.4)
# 4.7-11.5: 1628, the royal ship: proud fanfare in D major over marching drums
stab(T["s2"], [50, 57, 62, 66], 0.45, 1.2); put_m(I.cymbal(0.6, R, 2.2), T["s2"], 0.5)
FAN = [(0, 1, 62), (1, 1, 66), (2, 1, 69), (3, 3, 74), (6, 1, 71), (7, 1, 69), (8, 2, 71), (10, 2, 74),
       (12, 1, 74), (13, 1, 76), (14, 1, 78), (15, 3, 81), (18, 1, 78), (19, 1, 76), (20, 4, 74)]
fanfare(T["s2"] + 0.2, FAN, 0.27, 0.45)
chords(T["s2"] + 0.2, ["D", "G", "D", "A", "D", "G", "A", "D"], 0.81, 0.22, 1300)
drums(T["s2"] + 0.2, T["s4"] - 0.1, 0.54, 0.55)
for k in range(8): put_m(I.timpani(F(38 if k % 2 == 0 else 45), 0.55, R, 0.8), T["guns"] + 0.05 + k * 0.17, 0.6)  # the ports
# 11.5-18: the stability test: comic pizzicato, getting faster and wobblier, cut on "parar"
SNEAK = [62, 65, 69, 65, 62, 65, 69, 72, 70, 69, 67, 65]
t = T["s4"] + 0.1; i = 0
while t < T["stop"] - 0.05:
    sp = 0.3 if t < T["run"] else 0.22 if t < T["third"] else 0.16
    bend = 0 if t < T["third"] else (1 if i % 2 else -1)
    put_m(I.pluck(F(SNEAK[i % 12] + bend), 0.34, R, 0.3, bright=0.55), t, 0.9, 0.35 * np.sin(i))
    if i % 4 == 0: put_m(I.pluck(F(38 + (5 if (i // 4) % 2 else 0)), 0.45, R, 0.6, bright=0.3), t, 0.8, -0.2)
    t += sp; i += 1
put_m(I.pad([F(m) for m in [50, 53, 56, 59]], 2.0, 0.18, R, att=0.6, rel=0.2, warm=900), T["third"])  # uneasy diminished
stab(T["stop"], [50, 56, 59], 0.4, 0.8)
# 18-19.5: "soltaram mesmo assim": the fanfare again, a bit too proud
fanfare(T["let"] + 0.05, [(0, 1, 62), (1, 1, 66), (2, 1, 69), (3, 2, 74)], 0.22, 0.45)
put_m(I.cymbal(0.4, R, 1.6), T["let"] + 0.7, 0.4)
# 19.5-25.7: out in the harbour, then the breeze: tension pedal, rising strings, the drop
put_m(I.pad([F(m) for m in [50, 57, 62]], 2.1, 0.2, R, att=0.3, rel=0.3, warm=900), T["s6"])
put_m(I.pad([F(m) for m in [38, 45, 50, 51]], 3.4, 0.28, R, att=0.4, rel=0.4, warm=500), T["breeze"] - 0.2)
for k in range(10): put_m(I.timpani(F(38), 0.4 + 0.05 * k, R, 0.6), T["breeze"] + k * 0.18, 0.7)
stab(T["heel"], [38, 44, 50, 53], 0.5, 1.6); put_m(I.cymbal(0.6, R, 2.6), T["heel"], 0.5)
put_m(I.pad([F(m) for m in [26, 32, 38]], 3.0, 0.36, R, att=0.05, rel=1.2, warm=300), T["water"])
put_m(I.brass(F(33), 2.2, 0.55, R, kind="tuba", fall=-12), T["down"], 0.7)
# 25.7-32.3: "sabe por quê?" playful explainer with a wobbly tuba, crash on "derruba"
put_m(I.glock(F(81), 0.3, R, 0.9), T["s7"] + 0.05, 0.6); put_m(I.glock(F(86), 0.3, R, 0.9), T["s7"] + 0.22, 0.6)
chords(T["s7"] + 0.4, ["F", "C", "Dm", "Bb", "F", "C", "Bb", "C"], 0.72, 0.18, 900)
for k in range(16):
    tb = T["s7"] + 0.4 + k * 0.36
    if tb > T["fall"] - 0.1: break
    put_m(I.brass(F([41, 48, 45, 48][k % 4] + (1 if k > 9 and k % 2 else 0)), 0.3, 0.42, R, kind="tuba"), tb, 0.55, -0.1)
    put_m(I.pluck(F([65, 69, 72, 69][k % 4]), 0.22, R, 0.3, bright=0.6), tb + 0.18, 0.6, 0.3)
put_m(I.pad([F(m) for m in [53, 57, 60]], 1.2, 0.2, R, att=0.01, rel=0.8, warm=1500), T["fall"] + 0.3)
# 32.3-34.9: "por azar": sad minor descent
for i, m in enumerate([69, 67, 65, 64, 62]): put_m(I.pluck(F(m), 0.3, R, 0.9, bright=0.35), T["s8"] + 0.1 + i * 0.42, 0.8, 0.2)
put_m(I.pad([F(m) for m in [50, 53, 57]], 2.6, 0.22, R, att=0.4, rel=0.6, warm=600), T["s8"] + 0.05)
# 34.9-38.9: "por sorte": underwater music box, mysterious then a little comic sting for the worm
put_m(I.pad([F(m) for m in [45, 52, 57, 60]], 4.2, 0.2, R, att=0.8, rel=0.6, warm=500), T["s9"])
for k in range(10): put_m(I.musicbox(F([69, 72, 76, 74, 72, 76, 79, 76, 74, 72][k]), 0.3, R, 1.0), T["s9"] + 0.15 + k * 0.37, 0.7, 0.3 * np.sin(k))
put_m(I.brass(F(36), 0.5, 0.5, R, kind="tuba", fall=-8), T["salt"] + 0.1, 0.7)
# 38.9-42.7: 1961: hopeful build, it rises
chords(T["s10"] + 0.05, ["Dm", "Bb", "F", "C"], 0.95, 0.22, 900)
for k in range(12): put_m(I.pluck(F([62, 65, 69, 72][k % 4] + (12 if k > 7 else 0)), 0.3, R, 0.5, bright=0.6), T["s10"] + 0.1 + k * 0.31, 0.8, 0.3 * np.sin(k))
for k in range(6): put_m(I.timpani(F(38), 0.4 + 0.08 * k, R, 0.7), T["lift"] + k * 0.3, 0.6)
# 42.7-47.5: today: the fanfare in full, end hit
stab(T["s11"], [50, 57, 62, 66], 0.5, 1.4); put_m(I.cymbal(0.7, R, 2.4), T["s11"], 0.6)
fanfare(T["s11"] + 0.1, FAN[:11], 0.27, 0.5)
chords(T["s11"] + 0.1, ["D", "G", "D", "A", "D"], 0.81, 0.24, 1400)
drums(T["s11"] + 0.1, 46.4, 0.54, 0.6)
stab(46.6, [50, 57, 62, 66], 0.55, 1.0); put_m(I.cymbal(0.6, R, 1.0), 46.6, 0.5)

# ---------------------------------------------------------------- effects
sfx = np.zeros((2, N))
def put_s(x, t, g=1.0, p=0.0):
    place(sfx, pan(x, p) if np.ndim(x) == 1 else x, t, g)
# hook: timber groaning, water rushing in, a gasp from the quay
put_s(creak(2.2, R, 60, 140, scale=1.2), 0.2, 0.7, -0.2)
put_s(splash_big(R), 0.9, 0.6); put_s(water_bed(4.0, R, 0.7), 0.6, 0.35)
put_s(bubbles(2.5, R, 30), 2.2, 0.35)
for k in range(4): put_s(whoa(R), 0.6 + k * 0.18, 0.35, -0.6 + k * 0.3)
put_s(whoosh(0.5, R, 0.3, 500, 4000), T["flash"] - 0.25, 0.6)
# 1628 on the quay: gulls, flags, the crowd cheering
put_s(gulls(6.5, 0.12), T["s2"] + 0.2, 0.6, 0.4); put_s(flag_flutter(6.5, R), T["s2"], 0.25, -0.3)
for k in range(9): put_s(hurrah(R, R.uniform(110, 230), R.uniform(0.9, 1.2), kid=k == 4), T["s2"] + 0.3 + k * 0.33, 0.35, R.uniform(-0.7, 0.7))
put_s(applause(4.0, R, 30), T["s2"] + 0.4, 0.4)
put_s(water_bed(6.5, R, 0.5), T["s2"], 0.2)
# the ports slapping open, the guns rolling out
for i in range(16): put_s(knock(0.45, 160 + 15 * (i % 3)), T["guns"] - 0.25 + i * 0.025 + 0.12, 0.45, -0.6 + i * 0.07)
for i in range(16): put_s(knock(0.45, 200 + 15 * (i % 3)), T["guns"] + i * 0.025 + 0.12, 0.45, -0.6 + i * 0.07)
put_s(roll_out(0.6, 0.9), T["guns"] + 0.3, 0.6); put_s(roll_out(0.6, 0.9), T["guns"] + 0.55, 0.5)
# the test: boots thundering across the deck, the hull creaking louder each roll, a big groan, the stop
for k in range(int((T["stop"] - T["run"]) / 0.12)):
    tb = T["run"] + k * 0.12; put_s(boot(R, 0.7 + 0.3 * (tb > T["third"])), tb, 0.5, 0.6 * np.sin(tb * 3.3))
for k, tc in enumerate([T["run"] + 0.6, T["run"] + 1.55, T["third"] - 0.1, T["roll"]]):
    put_s(creak(1.0 + 0.3 * k, R, 70 - 8 * k, 160, scale=0.9 + 0.2 * k), tc, 0.4 + 0.15 * k, 0.2)
put_s(timber_tear(R, 1.0), T["roll"] + 0.2, 0.35)
for k in range(5): put_s(oof(R, "oh"), T["stop"] - 0.05 + k * 0.08, 0.3, -0.5 + k * 0.25)
put_s(thud(0.8, 50, 0.7), T["stop"], 0.6)
# she sails anyway: crowd
for k in range(6): put_s(hurrah(R, R.uniform(110, 230), R.uniform(0.9, 1.2)), T["let"] + 0.1 + k * 0.2, 0.3, R.uniform(-0.7, 0.7))
put_s(applause(1.6, R, 24), T["let"], 0.35)
# the breeze, the heel, the water, the bottom
put_s(water_bed(6.4, R, 0.5), T["s6"], 0.25)
put_s(breeze(2.0, R, 1.0, 0.3, 1400), T["breeze"] - 0.2, 0.7); put_s(whoosh(1.2, R, 0.5, 300, 2500), T["breeze"] - 0.1, 0.6)
put_s(creak(1.6, R, 50, 120, scale=1.5), T["heel"] - 0.1, 0.8); put_s(wood_crack(R), T["heel"], 0.45)
put_s(whoa(R), T["heel"] + 0.1, 0.35, 0.5); put_s(whoa(R), T["heel"] + 0.25, 0.3, 0.7)
put_s(splash_big(R), T["water"], 0.7)
for k in range(4): put_s(splash_big(R), T["water"] + 0.35 + k * 0.4, 0.3, -0.4 + k * 0.25)
put_s(bubbles(2.4, R, 45), T["down"], 0.5); put_s(hum(1.6, 40, 0.4), T["down"], 0.6)
# the bike: bell, a wobbly squeak, the wind, the crash
put_s(bell(0.4), T["s7"] + 0.15, 0.4, 0.2)
for k in range(9): put_s(creak(0.25, R, 260, 320, scale=0.4), T["s7"] + 0.6 + k * 0.62, 0.18, 0.3 * (-1) ** k)
put_s(thud(0.6, 70, 0.4), T["top"] + 0.05, 0.6)  # heavy fridge
put_s(sweep(500, 260, 0.35, 0.18), T["low"] + 0.05, 0.6)
put_s(breeze(1.0, R, 1.0, 0.4, 1600), T["wind"] - 0.1, 0.7); put_s(whoosh(0.6, R, 0.4, 600, 4500), T["wind"], 0.6, -0.5)
put_s(whoa(R, 180), T["fall"] - 0.05, 0.4)
put_s(thud(1.2, 60, 0.7), T["fall"] + 0.32, 0.8); put_s(clank(0.8), T["fall"] + 0.34, 0.6); put_s(clank(0.5, 1.3), T["fall"] + 0.55, 0.35)
for k in range(5): put_s(tweet(0.18), T["fall"] + 0.5 + k * 0.32, 0.4, -0.3)
# por azar: water lapping, a shocked murmur
put_s(water_bed(2.6, R, 0.5), T["s8"], 0.35)
for k in range(5): put_s(babble(2.4, R, R.uniform(110, 220), R.uniform(0.9, 1.2)), T["s8"] + 0.1 + k * 0.05, 0.12, R.uniform(-0.6, 0.6))
put_s(gulls(2.5, 0.1), T["s8"], 0.4, -0.4)
# underwater: muffled hum, bubbles; the worm tastes the water: "bleh" and zooms off
put_s(hum(4.0, 48, 0.3), T["s9"], 0.6); put_s(bubbles(4.0, R, 8, 200, 1200), T["s9"], 0.35)
put_s(oof(R, "ugh", base=260, scale=1.4), T["salt"] - 0.05, 0.35, 0.3)
put_s(whoosh(0.5, R, 0.4, 600, 3500), T["salt"] + 0.35, 0.5, 0.5)
# 1961: water pouring off the hull, the crowd
put_s(water_bed(3.9, R, 1.0, 1.4), T["s10"], 0.5); put_s(bubbles(3.0, R, 25), T["s10"] + 0.3, 0.3)
put_s(applause(2.4, R, 30), T["lift"] + 0.2, 0.45)
for k in range(6): put_s(hurrah(R, R.uniform(110, 230), R.uniform(0.9, 1.2)), T["lift"] + 0.3 + k * 0.25, 0.3, R.uniform(-0.7, 0.7))
# today: the museum hall: tourist murmur, camera clicks
for k in range(5): put_s(babble(4.6, R, R.uniform(120, 220), R.uniform(0.9, 1.2)), T["s11"] + k * 0.1, 0.07, R.uniform(-0.6, 0.6))
for k in range(5): put_s(knock(0.25, 1800), T["s11"] + 0.6 + k * 0.55, 0.3, R.uniform(-0.5, 0.5))

# ---------------------------------------------------------------- voice
v, vsr = sf.read(os.path.join(os.path.dirname(os.path.abspath(__file__)), "voice.wav"), always_2d=False)
if v.ndim > 1: v = v.mean(axis=1)
if vsr != SR: v = resample_poly(v, SR, vsr)
voice = np.zeros(N); voice[: min(N, len(v))] = v[: min(N, len(v))]

# ---------------------------------------------------------------- mix
ir = make_ir(1.2, 3, hf=0.6)
music_w = music + 0.18 * convolve_st(music, ir)[:, :N]
sfx_w = sfx + 0.1 * convolve_st(sfx, ir)[:, :N]
env = np.abs(voice); win = ns(0.05)
env = np.convolve(env, np.ones(win) / win, mode="same")
on = (env > 0.01).astype(float)
k_a, k_r = 1 - np.exp(-1 / (0.12 * SR)), 1 - np.exp(-1 / (0.35 * SR))
g = np.empty(N); y = 0.0
for i in range(0, N, 64):
    target = on[i]; y += (target - y) * (1 - (1 - (k_a if target > y else k_r)) ** 64); g[i:i + 64] = y
music_w *= (1 - 0.55 * g)[None, :]
sfx_w *= (1 - 0.25 * g)[None, :]
fadeout = np.ones(N); fo = ns(0.8); fadeout[-fo:] = np.linspace(1, 0, fo) ** 2
music_w *= fadeout[None, :]; sfx_w *= fadeout[None, :]
voice_st = np.stack([voice, voice])
lv = integrated(voice_st)
# skill default: music +3 dB, effects -6 dB relative to the house balance (voice untouched)
mg = dbg(lv - 13.0 + 3.0 - integrated(music_w)); sg = dbg(lv - 9.0 - 6.0 - integrated(sfx_w))
music_w *= mg; sfx_w *= sg
mix = voice_st + music_w + sfx_w
lu = integrated(mix); G = dbg(-14.0 - lu)
mix *= G; music_w *= G; sfx_w *= G; voice_st = voice_st * G
th = dbg(-3.0)
def soft(x):
    a = np.abs(x); return np.where(a > th, np.sign(x) * (th + (1 - th) * np.tanh((a - th) / (1 - th))), x)
mix = soft(mix)
tp = true_peak(mix)
if tp > -1.0:
    lim = dbg(-1.0 - tp); mix *= lim; music_w *= lim; sfx_w *= lim; voice_st *= lim
print(f"integrated {integrated(mix):.1f} LUFS, true peak {true_peak(mix):.1f} dBTP, {mix.shape[1]/SR:.3f} s")
write_wav("mix.wav", mix); write_wav("music.wav", music_w); write_wav("sfx.wav", sfx_w); write_wav("voice_st.wav", voice_st)
