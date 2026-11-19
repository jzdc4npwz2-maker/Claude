# Sound for "André no VRMMO — Ep. 1: Escudeiro" (110 s, captions only, no narration): an original score and all the
# effects, synthesized here with the skill's own DSP kit (dsp.py / instruments.py / sfx_gen.py). Every event time below
# mirrors src/videos/escudeiro/story.ts (T.*, shot starts, HUD panel times). Writes mix.wav (48 kHz, exactly 110 s),
# music.wav and sfx.wav stems.
import numpy as np
from dsp import SR, TAU, ns, tt, rng, lp, hp, bp, peq, colored, fades, place, pan, widen, make_ir, convolve_st, integrated, true_peak, write_wav, dbg
import instruments as I
from sfx_gen import whoosh, oof

DUR = 110.0
N = ns(DUR)
F = I.m2f
R = rng(7)

# ---------------------------------------------------------------- small instruments of our own
def kick(vel=0.9, dur=0.45):
    t = tt(dur)
    f = 48 + 90 * np.exp(-t / 0.035)
    ph = np.cumsum(TAU * f / SR)
    y = np.sin(ph) * np.exp(-t / 0.16) + 0.4 * lp(R.standard_normal(len(t)), 900) * np.exp(-t / 0.01)
    return fades(y * vel, 0.0005, 0.03)

def hat(vel=0.3, dur=0.06):
    t = tt(dur)
    return fades(hp(R.standard_normal(len(t)), 7000) * np.exp(-t / 0.015) * vel, 0.0002, 0.01)

def blip(f0, f1, dur=0.09, vel=0.4):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    y = np.sign(np.sin(np.cumsum(TAU * f / SR))) * 0.5 + np.sin(np.cumsum(TAU * f / SR))
    return fades(lp(y, 6000) * np.exp(-t / (dur * 0.6)) * vel, 0.001, 0.01)

def chime(notes, gap=0.07, vel=0.5):
    out = np.zeros(ns(gap * len(notes) + 1.6))
    for i, m in enumerate(notes):
        g = I.glock(F(m), vel, R, 1.4)
        out[ns(i * gap): ns(i * gap) + len(g)] += g
    return out

def sweep(f0, f1, dur, vel=0.3, kind="sin"):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    y = np.sin(np.cumsum(TAU * f / SR))
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
    return fades(y * env * vel, 0.005, 0.05)

def thud(vel=1.0, f=55, dur=0.7):
    t = tt(dur)
    y = np.sin(np.cumsum(TAU * (f + 60 * np.exp(-t / 0.03)) / SR)) * np.exp(-t / 0.18)
    y += lp(R.standard_normal(len(t)), 500) * np.exp(-t / 0.04) * 0.8
    return fades(y * vel, 0.0005, 0.05)

def clang(vel=0.8, dur=1.4):
    modes = [(612, 1.0, 0.6), (1393, 0.6, 0.35), (2211, 0.45, 0.25), (3170, 0.3, 0.18), (4380, 0.2, 0.1)]
    from dsp import modal
    y = modal(dur, modes, R)
    t = tt(dur)
    y += hp(R.standard_normal(len(t)), 2000) * np.exp(-t / 0.01) * 0.6
    return fades(y * vel, 0.0003, 0.1)

def clap(vel=0.6):
    t = tt(0.16)
    y = np.zeros(len(t))
    for k, d in enumerate([0, 0.008, 0.017]):
        i = ns(d); y[i:] += bp(R.standard_normal(len(t) - i), 900, 3200, 2) * np.exp(-t[: len(t) - i] / (0.008 if k < 2 else 0.05))
    return fades(y * vel, 0.0002, 0.02)

def hoof(vel=0.6):
    t = tt(0.12)
    return fades((np.sin(TAU * 120 * t) * np.exp(-t / 0.03) + 0.6 * bp(R.standard_normal(len(t)), 300, 2500) * np.exp(-t / 0.015)) * vel, 0.0003, 0.02)

def scrape(vel=0.5, dur=0.35):
    t = tt(dur)
    y = bp(colored(len(t), R, 0.4), 500, 4000, 2) * np.sin(np.pi * t / dur) ** 0.8
    y *= 1 + 0.6 * np.sin(TAU * 38 * t)
    return fades(y * vel, 0.01, 0.03)

def grunt(base=70, vel=0.8):
    return oof(R, "ugh", base=base, scale=0.7) * vel

def squeal(vel=0.6, dur=0.5):
    t = tt(dur)
    f = 900 + 500 * np.sin(np.pi * t / dur) - 300 * t / dur
    ph = np.cumsum(TAU * f / SR)
    y = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph)) * (1 + 0.3 * np.sin(TAU * 31 * t))
    y = bp(y, 400, 4000) + 0.2 * bp(R.standard_normal(len(t)), 1500, 5000) * np.sin(np.pi * t / dur)
    return fades(y * np.sin(np.pi * t / dur) ** 0.5 * vel, 0.01, 0.05)

def buzz(vel=0.3, dur=0.5):
    t = tt(dur)
    y = lp(np.sign(np.sin(TAU * 150 * t)), 600) * (0.5 + 0.5 * np.sign(np.sin(TAU * 7 * t)))
    return fades(y * vel, 0.005, 0.02)

def tick(vel=0.35):
    t = tt(0.03)
    return fades(hp(R.standard_normal(len(t)), 3500) * np.exp(-t / 0.004) * vel + np.sin(TAU * 2400 * t) * np.exp(-t / 0.006) * vel * 0.5, 0.0002, 0.005)

def heartbeat(vel=0.8):
    a = thud(vel, 45, 0.3); b = thud(vel * 0.7, 42, 0.3)
    out = np.zeros(ns(0.6)); out[: len(a)] += a; out[ns(0.18): ns(0.18) + len(b)] += b
    return lp(out, 220)

def footstep(vel=0.35):
    t = tt(0.1)
    return fades(lp(R.standard_normal(len(t)), 1200) * np.exp(-t / 0.02) * vel, 0.0003, 0.02)

def bonk(vel=0.6):
    t = tt(0.35)
    f = 320 * np.exp(-t / 0.12) + 120
    return fades(np.sin(np.cumsum(TAU * f / SR)) * np.exp(-t / 0.1) * vel, 0.001, 0.03)

# ---------------------------------------------------------------- the score
music = np.zeros((2, N))
def put_m(x, t, g=1.0, p=0.0):
    place(music, pan(x, p) if np.ndim(x) == 1 else x, t, g)

CH = {"Dm": [50, 53, 57], "Bb": [46, 50, 53], "F": [45, 48, 53], "C": [48, 52, 55], "Am": [45, 48, 52], "Gm": [43, 46, 50], "A": [45, 49, 52],
      "Fhi": [53, 57, 60], "C/E": [52, 55, 60], "Dm/F": [53, 57, 62], "Bbhi": [50, 53, 58]}
BEAT = 0.6  # 100 bpm

def bar_chords(t0, prog, beats_per=4, vel=0.32, warm=900):
    for i, c in enumerate(prog):
        d = beats_per * BEAT
        put_m(I.pad([F(m) for m in CH[c]], d, vel, R, att=0.25, rel=0.5, warm=warm), t0 + i * d)
        put_m(I.pluck(F(CH[c][0] - 12), 0.55, R, 1.2, bright=0.3), t0 + i * d, 0.9, -0.1)

def arp(t0, t1, prog, step=0.3, vel=0.28, octave=12, beats_per=4):
    t = t0; k = 0
    while t < t1 - 0.05:
        c = prog[int((t - t0) / (beats_per * BEAT)) % len(prog)]
        notes = CH[c] + [CH[c][0] + 12]
        m = notes[[0, 1, 2, 3, 2, 1][k % 6]] + octave
        put_m(I.pluck(F(m), vel, R, 0.7, bright=0.6), t, 1.0, 0.3 * np.sin(k))
        t += step; k += 1

def drums(t0, t1, kick_beats=(0, 2.5), snare_beats=(1, 3), hats=True, vel=1.0):
    b = 0; t = t0
    while t < t1 - 0.01:
        pos = b % 4
        if pos in kick_beats: put_m(kick(0.8 * vel), t, 0.9)
        if pos in snare_beats: put_m(I.snare(0.45 * vel, R, 0.25, tune=1.3), t, 0.55, 0.1)
        if hats: put_m(hat(0.25 * vel), t + BEAT / 2, 0.6, -0.3)
        b += 0.5; t += BEAT / 2
        if pos + 0.5 in kick_beats: put_m(kick(0.6 * vel), t, 0.9)

# 0-9.2  night at home: warm lo-fi
bar_chords(0.0, ["Dm", "Bb", "F", "C"], vel=0.26, warm=700)
arp(0.0, 9.2, ["Dm", "Bb", "F", "C"], step=0.3, vel=0.18)
drums(2.4, 9.2, hats=True, vel=0.55)
# 9.2-13: the message: sad hanging chord
put_m(I.pad([F(m) for m in [45, 50, 53, 57]], 3.8, 0.3, R, att=0.1, rel=1.2, warm=600), 9.2)
# 13-17.2: alone, helmet: rising arp into the dive
bar_chords(13.0, ["Bb", "F"], beats_per=3, vel=0.24)
arp(13.0, 17.2, ["Bb", "F", "C"], step=0.15, vel=0.17, beats_per=2)
put_m(sweep(200, 1600, 2.6, 0.12), 14.6, 1.0)
# 18-32: science 1, mysterious pulse
def science(t0, t1):
    k = 0; t = t0
    while t < t1 - 0.05:
        put_m(I.glock(F([69, 72, 76, 74][k % 4] + (12 if k % 8 > 5 else 0)), 0.3, R, 1.0), t, 0.6, 0.4 * np.sin(k * 1.7))
        if k % 4 == 0: put_m(I.pad([F(m) for m in CH[["Am", "F", "C", "Gm"][(k // 4) % 4]]], 4 * 0.45, 0.22, R, att=0.4, rel=0.6, warm=500), t)
        if k % 2 == 0: put_m(kick(0.35), t, 0.6)
        t += 0.45; k += 1
science(18.3, 31.6)
# 32-51: the plaza: bright fantasy theme (F major), lute-like plucks + pad + drums
THEME = [(0, 1, 65), (1, .5, 67), (1.5, .5, 69), (2, 1, 72), (3, 1, 69), (4, 1.5, 70), (5.5, .5, 69), (6, 1, 67), (7, 1, 65),
         (8, 1, 64), (9, .5, 65), (9.5, .5, 67), (10, 1, 69), (11, 1, 72), (12, 2, 74), (14, 1, 72), (15, 1, 69)]
def theme(t0, vel=0.42, transpose=0):
    for b, d, m in THEME:
        put_m(I.pluck(F(m + transpose), vel, R, max(0.6, d * BEAT * 1.6), bright=0.7), t0 + b * BEAT, 1.0, 0.15)
        put_m(I.glock(F(m + transpose + 12), 0.12, R, 0.9), t0 + b * BEAT, 0.5, -0.2)
bar_chords(32.0, ["F", "C", "Dm", "Bb"] * 2, vel=0.28)
theme(32.6); theme(32.6 + 16 * BEAT, 0.38)
drums(32.0, 46.9, vel=0.75)
# attributes: playful tiptoe staccato for "dano quase zero"
bar_chords(42.0, ["Bb", "F"], vel=0.2)
# 47-51: shield: heavy brass-ish low chord
put_m(I.pad([F(m) for m in [38, 45, 50]], 3.6, 0.38, R, att=0.05, rel=0.8, warm=500), 47.4)
# 51-63: science 2
science(51.3, 62.7)
# 63-69: the boar: tension ostinato on timpani + low strings
def ostinato(t0, t1, step=0.3, base=38):
    t = t0; k = 0
    while t < t1 - 0.05:
        put_m(I.timpani(F(base + (7 if k % 4 == 3 else 0)), 0.55 + 0.25 * (t - t0) / (t1 - t0), R, 0.8), t, 0.8)
        t += step; k += 1
put_m(I.pad([F(m) for m in [38, 45, 50, 51]], 5.8, 0.3, R, att=0.5, rel=0.4, warm=500), 63.2)
ostinato(63.3, 67.9, 0.45)
ostinato(67.9, 69.0, 0.15)
for i in range(12): put_m(I.snare(0.25 + 0.05 * i, R, 0.12, tune=1.4), 67.9 + i * 0.09, 0.5)
# 69-75: frozen time: drone + heartbeat (the clock ticks are SFX)
put_m(I.pad([F(m) for m in [38, 45, 50]], 5.8, 0.2, R, att=0.3, rel=0.4, warm=300), 69.1)
for k in range(8): put_m(heartbeat(0.9), 69.4 + k * 0.75, 0.8)
# 75.3: triumph stab, then the theme again (brighter)
put_m(I.pad([F(m) for m in [53, 57, 60, 65]], 1.6, 0.5, R, att=0.01, rel=1.0, warm=1600), 75.3)
put_m(I.cymbal(0.7, R, 2.6), 75.3, 0.6)
put_m(I.timpani(F(41), 1.0, R, 2.0), 75.3, 1.0)
bar_chords(76.6, ["F", "C"], vel=0.26)
theme(76.6, 0.36)
drums(76.6, 81.0, vel=0.6)
# 81-97: Kael: light walking theme, quieter
bar_chords(81.0, ["Dm", "Bb", "F", "C"] * 2, vel=0.2)
arp(81.0, 96.6, ["Dm", "Bb", "F", "C"], step=0.3, vel=0.14)
drums(84.8, 96.6, kick_beats=(0,), snare_beats=(), hats=True, vel=0.45)
# 97-101: the boss: dark low hits
put_m(I.pad([F(m) for m in [38, 41, 44, 50]], 3.6, 0.38, R, att=0.05, rel=0.6, warm=400), 97.1)
for tb in [97.1, 98.4, 99.0]: put_m(I.timpani(F(38), 0.9, R, 1.6), tb, 1.0)
# 101-104: "...e eu sou nível 1": comic deflate
for i, m in enumerate([72, 71, 70, 69]): put_m(I.pluck(F(m), 0.4, R, 0.5 if i < 3 else 1.4, bright=0.4), 101.4 + i * 0.32, 1.0)
put_m(I.pad([F(m) for m in [50, 53, 57]], 2.4, 0.2, R, att=0.2, rel=0.8, warm=600), 101.4)
# 104-110: the choice: build to the final card
bar_chords(104.0, ["Dm", "Bb", "C"], beats_per=2, vel=0.3)
drums(104.0, 108.1, vel=0.8)
for i in range(14): put_m(I.snare(0.2 + 0.04 * i, R, 0.1, tune=1.4), 107.0 + i * 0.08, 0.5)
put_m(I.pad([F(m) for m in [50, 57, 62, 65, 69]], 1.6, 0.5, R, att=0.01, rel=0.4, warm=1800), 108.2)
put_m(I.cymbal(0.8, R, 1.8), 108.2, 0.7)
put_m(kick(1.0), 108.2, 1.0)

# ---------------------------------------------------------------- effects
sfx = np.zeros((2, N))
def put_s(x, t, g=1.0, p=0.0):
    place(sfx, pan(x, p) if np.ndim(x) == 1 else x, t, g)

# room
put_s(bp(colored(ns(0.6), R, 0.3), 300, 3000) * np.hanning(ns(0.6)) * 0.4, 0.2)      # box flaps
put_s(chime([81, 85, 88, 93], 0.06, 0.35), 0.8, 0.8)                                 # helmet glow
put_s(buzz(0.25, 0.45), 9.2, 0.8, 0.2); put_s(chime([88, 93], 0.1, 0.5), 9.25, 0.9)   # notification
put_s(bonk(0.4), 10.3, 0.6)                                                          # his heart sinks
put_s(blip(600, 1200, 0.12, 0.3), T_help := 14.6, 0.8); put_s(sweep(300, 2400, 1.4, 0.18), 14.7, 0.9)
put_s(footstep(0.4), 15.35, 0.8)                                                     # lies back
for k in range(3): put_s(whoosh(0.7, R, 0.35, 600, 4000), 16.4 + k * 0.28, 0.55, (-1) ** k * 0.5)
put_s(thud(0.5, 45, 0.9), 17.6, 0.7)
# science 1
put_s(blip(1200, 800, 0.1, 0.3), 18.05, 0.7)
for k in range(10): put_s(blip(1800, 2400, 0.05, 0.12), 26.9 + k * 0.28, 0.6, 0.6 * np.sin(k))
put_s(whoosh(0.6, R, 0.3, 500, 3000), 29.0, 0.5)                                     # helmet slides in
# into the game
put_s(whoosh(1.4, R, 0.9, 300, 5000, tail=0.5), 30.8, 0.8)
put_s(chime([77, 81, 84, 89, 93], 0.08, 0.4), 32.0, 0.8)
# crowd murmur in the plaza (soft babble bed)
from sfx_gen import babble
put_s(widen(babble(10.0, R, 140, 1.0, active=0.5) * 0.08, R), 32.2, 0.7)
# class menu
put_s(blip(900, 1500, 0.1, 0.35), 35.0, 0.8)
for k in range(5): put_s(tick(0.3), 35.2 + k * 0.133, 0.8)
put_s(blip(1000, 700, 0.08, 0.25), 38.1, 0.6)                                        # hesitation
put_s(chime([84, 88, 91, 96], 0.05, 0.55), 39.2, 1.0)                                # pick
put_s(chime([79, 84], 0.08, 0.35), 39.6, 0.6); put_s(whoosh(0.5, R, 0.2, 800, 4000), 41.4, 0.5)
# attributes
put_s(blip(900, 1500, 0.1, 0.35), 42.1, 0.8)
for k in range(6): put_s(sweep(500 + 120 * k, 1200 + 150 * k, 0.4, 0.07), 42.4 + k * 0.233, 0.8)
put_s(bonk(0.7), 45.0, 1.0); put_s(blip(300, 180, 0.25, 0.3), 45.05, 0.7)            # DANO 3
# shield
put_s(chime([88, 91, 95, 100], 0.04, 0.35), 47.1, 0.8)
put_s(thud(1.0, 50, 0.9), 47.45, 1.0); put_s(clang(0.25, 0.9), 47.45, 0.6)
put_s(grunt(110, 0.5), 47.7, 0.6)
put_s(blip(900, 1500, 0.1, 0.3), 47.7, 0.7)
# transitions into/out of the science scenes
for tw in [50.8, 62.8, 80.8]: put_s(whoosh(0.5, R, 0.25, 500, 4000), tw, 0.6)
# science 2: the spindle signal blips, then the weight drop
for k in range(12): put_s(blip(1600, 2100, 0.05, 0.12), 55.4 + k * 0.3, 0.5)
for k in range(6): put_s(blip(2200, 1700, 0.05, 0.12), 59.0 + k * 0.33, 0.5)
put_s(thud(0.8, 48, 0.8), 61.0, 0.9)
# the boar
put_s(blip(500, 380, 0.15, 0.3), 64.0, 0.7); put_s(blip(500, 380, 0.15, 0.3), 64.2, 0.7)
for k in range(4): put_s(scrape(0.5), 64.8 + k * 0.45, 0.9, -0.2)
put_s(grunt(65, 0.9), 65.3, 0.9); put_s(grunt(60, 0.9), 66.6, 0.9)
put_s(squeal(0.45), 67.85, 0.8)
for k in range(7): put_s(hoof(0.6 + 0.05 * k), 67.95 + k * 0.155, 0.9, -0.4 + 0.1 * k)
# frozen time
put_s(sweep(1200, 80, 0.8, 0.3), 69.0, 0.9); put_s(thud(0.7, 40, 1.2), 69.0, 0.8)
for k in range(22): put_s(tick(0.3 if k % 4 else 0.45), 70.0 + k * 0.2, 0.7)
put_s(blip(1000, 1000, 0.12, 0.3), 71.0, 0.7)                                        # REAÇÃO marker
put_s(blip(500, 500, 0.15, 0.35), 73.4, 0.7)                                         # IMPACTO marker
# resume, block
put_s(sweep(80, 1200, 0.4, 0.25), 74.75, 0.8)
put_s(whoosh(0.3, R, 0.12, 900, 5000), 75.0, 0.8, 0.3)                               # shield up
put_s(thud(1.2, 52, 0.9), 75.3, 1.0); put_s(clang(0.9, 1.6), 75.3, 1.0); put_s(squeal(0.4, 0.3), 75.32, 0.7)
put_s(chime([84, 88, 91, 96, 100], 0.05, 0.5), 75.45, 1.0)
for k in range(3): put_s(hoof(0.5), 75.5 + k * 0.17, 0.7, -0.4)
for k in range(9): put_s(I.glock(F([96, 100, 103][k % 3]), 0.18, R, 0.5), 76.3 + k * 0.42, 0.5, -0.5)   # dazed tweets
put_s(grunt(70, 0.6), 78.2, 0.6)
# Kael
for k in range(10): put_s(footstep(0.3), 81.8 + k * 0.3, 0.7, -0.3)
for k in range(9): put_s(clap(0.55), 84.8 + k * 0.31, 0.9, -0.2)
put_s(blip(900, 1500, 0.1, 0.25), 84.0, 0.6)                                         # level tag
put_s(thud(0.9, 45, 1.2), 99.0, 0.9)                                                 # boss card
for k in range(3): put_s(blip(440, 440, 0.12, 0.3), 101.2 + k * 0.23, 0.6)           # red NV.1
# the choice
put_s(whoosh(0.7, R, 0.3, 400, 4000), 103.8, 0.8)
put_s(blip(700, 1400, 0.1, 0.4), 104.3, 0.9); put_s(blip(700, 1400, 0.1, 0.4), 105.7, 0.9)
put_s(thud(1.0, 48, 1.0), 108.2, 1.0)

# ---------------------------------------------------------------- mix
ir = make_ir(1.3, 3, hf=0.6)
music_w = music + 0.18 * convolve_st(music, ir)[:, :N]
sfx_w = sfx + 0.08 * convolve_st(sfx, ir)[:, :N]
# fade the music under the busiest effect moments
duck = np.ones(N)
for a, b, g in [(69.0, 75.25, 0.75), (75.25, 75.6, 0.8)]:
    duck[ns(a): ns(b)] *= g
music_w *= duck[None, :]
fadeout = np.ones(N); fo = ns(1.2); fadeout[-fo:] = np.linspace(1, 0, fo) ** 2
fadein = np.ones(N); fadein[: ns(0.4)] = np.linspace(0, 1, ns(0.4))
music_w *= (fadein * fadeout)[None, :]
sfx_w *= fadeout[None, :]
mix = dbg(-2.0) * music_w + dbg(0.0) * sfx_w
lu = integrated(mix)
g = dbg(-14.0 - lu)
mix *= g; music_w *= g; sfx_w *= g
# soft peak control: gentle tanh limiting above -3 dBFS, then trim to -1 dBTP
th = dbg(-3.0)
def soft(x):
    a = np.abs(x); return np.where(a > th, np.sign(x) * (th + (1 - th) * np.tanh((a - th) / (1 - th))), x)
mix = soft(mix)
tp = true_peak(mix)
if tp > -1.0:
    lim = dbg(-1.0 - tp)
    mix *= lim; music_w *= lim; sfx_w *= lim
print(f"integrated {integrated(mix):.1f} LUFS, true peak {true_peak(mix):.1f} dBTP, {mix.shape[1]/SR:.3f} s")
write_wav("mix.wav", mix); write_wav("music.wav", music_w * dbg(-2.0)); write_wav("sfx.wav", sfx_w)
