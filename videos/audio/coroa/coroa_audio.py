# Sound for "Coroa de Ferro — Parte 1" (99 s): narration (voice.wav, untouched) + an original score and every effect,
# synthesized with the skill's DSP kit. Event times mirror src/videos/coroa/story.ts (T.*). Run from audio/coroa:
#   python3 coroa_audio.py   ->  mix.wav (48 kHz, exactly 99 s), voice / music / sfx stems
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from dsp import SR, TAU, ns, tt, rng, lp, hp, bp, colored, fades, place, pan, widen, make_ir, convolve_st, integrated, true_peak, write_wav, dbg
import instruments as I
from sfx_gen import whoosh, oof, rattle

DUR = 99.0
N = ns(DUR)
F = I.m2f
R = rng(11)
T = dict(helmetOn=9.75, lightsOut=10.55, land=12.45, eyesOn=14.3, bossCard=15.45, raise_=22.7, jump=24.0, slam=25.2, hit1=25.42,
         swing2=26.95, hit2=27.72, roll=27.5, swing3=29.35, sweep=29.95, duck=29.8, notice=32.4, tired=33.6, plan=53.9, sheath=55.2,
         beckon=56.1, runOff=57.3, kite=58.0, lap2=59.8, lap3=60.14, drain=60.6, stopKite=62.4, atWall=63.6, charge=65.2,
         side=78.2, impact=81.21, crit=83.89, poof=85.1, lvl=86.9, hole=89.0, eyes=94.45, end=95.6)

# ---------------------------------------------------------------- small instruments
def kick(vel=0.9, dur=0.45):
    t = tt(dur); f = 48 + 90 * np.exp(-t / 0.035)
    y = np.sin(np.cumsum(TAU * f / SR)) * np.exp(-t / 0.16) + 0.4 * lp(R.standard_normal(len(t)), 900) * np.exp(-t / 0.01)
    return fades(y * vel, 0.0005, 0.03)
def hat(vel=0.3, dur=0.06):
    t = tt(dur); return fades(hp(R.standard_normal(len(t)), 7000) * np.exp(-t / 0.015) * vel, 0.0002, 0.01)
def blip(f0, f1, dur=0.09, vel=0.4):
    t = tt(dur); f = f0 * (f1 / f0) ** (t / dur); ph = np.cumsum(TAU * f / SR)
    return fades(lp(np.sign(np.sin(ph)) * 0.5 + np.sin(ph), 6000) * np.exp(-t / (dur * 0.6)) * vel, 0.001, 0.01)
def chime(notes, gap=0.07, vel=0.5):
    out = np.zeros(ns(gap * len(notes) + 1.6))
    for i, m in enumerate(notes):
        g = I.glock(F(m), vel, R, 1.4); out[ns(i * gap): ns(i * gap) + len(g)] += g
    return out
def sweep(f0, f1, dur, vel=0.3):
    t = tt(dur); f = f0 * (f1 / f0) ** (t / dur)
    return fades(np.sin(np.cumsum(TAU * f / SR)) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7 * vel, 0.005, 0.05)
def thud(vel=1.0, f=55, dur=0.7):
    t = tt(dur)
    y = np.sin(np.cumsum(TAU * (f + 60 * np.exp(-t / 0.03)) / SR)) * np.exp(-t / 0.18) + lp(R.standard_normal(len(t)), 500) * np.exp(-t / 0.04) * 0.8
    return fades(y * vel, 0.0005, 0.05)
def clang(vel=0.8, dur=1.4, k=1.0):
    from dsp import modal
    modes = [(612 * k, 1.0, 0.6), (1393 * k, 0.6, 0.35), (2211 * k, 0.45, 0.25), (3170 * k, 0.3, 0.18), (4380 * k, 0.2, 0.1)]
    y = modal(dur, modes, R); t = tt(dur)
    y += hp(R.standard_normal(len(t)), 2000) * np.exp(-t / 0.01) * 0.6
    return fades(y * vel, 0.0003, 0.1)
def armour_step(vel=0.7):  # heavy plate footstep: thump + short metal jingle
    a = thud(vel, 42, 0.35); b = clang(0.12 * vel, 0.25, 1.6 + 0.2 * R.random())
    out = np.zeros(max(len(a), len(b))); out[: len(a)] += a; out[: len(b)] += b
    return out
def step(vel=0.35):
    t = tt(0.1); return fades(lp(R.standard_normal(len(t)), 1400) * np.exp(-t / 0.02) * vel, 0.0003, 0.02)
def rubble(vel=0.7, dur=1.6):
    return rattle(dur, R, density=45.0, heavy=True) * vel
def crack(vel=0.9):  # stone cracking: sharp noise burst + low body
    t = tt(0.5)
    y = hp(R.standard_normal(len(t)), 1500) * np.exp(-t / 0.02) * 1.2 + bp(R.standard_normal(len(t)), 200, 1200) * np.exp(-t / 0.12)
    return fades(y * vel, 0.0002, 0.05)
def breath(vel=0.35, dur=0.5, rise=True):  # heavy panting through the visor
    t = tt(dur); e = np.sin(np.pi * t / dur) ** (0.6 if rise else 1.2)
    y = bp(colored(len(t), R, 0.6), 400, 2600, 2) * e
    return fades(y * vel, 0.01, 0.05)
def hum(dur, f=55, vel=0.3):
    t = tt(dur); y = np.sin(TAU * f * t) + 0.5 * np.sin(TAU * 2.01 * f * t) + 0.25 * np.sin(TAU * 3.0 * f * t)
    return fades(lp(y, 900) * vel, 0.3, 0.6)
def tweet(vel=0.2):
    return I.glock(F([96, 100, 103][R.integers(3)]), vel, R, 0.5)
def bonk(vel=0.6):
    t = tt(0.35); f = 320 * np.exp(-t / 0.12) + 120
    return fades(np.sin(np.cumsum(TAU * f / SR)) * np.exp(-t / 0.1) * vel, 0.001, 0.03)
def growl(vel=0.6, dur=1.6):
    t = tt(dur); f = 55 + 8 * np.sin(TAU * 1.3 * t)
    y = np.sign(np.sin(np.cumsum(TAU * f / SR))) * (0.6 + 0.4 * lp(np.abs(R.standard_normal(len(t))), 30))
    return fades(lp(y, 420) * np.sin(np.pi * t / dur) ** 0.5 * vel, 0.05, 0.3)

# ---------------------------------------------------------------- the score (D minor, medieval-heroic)
music = np.zeros((2, N))
def put_m(x, t, g=1.0, p=0.0):
    place(music, pan(x, p) if np.ndim(x) == 1 else x, t, g)
CH = {"Dm": [50, 53, 57], "Bb": [46, 50, 53], "F": [45, 48, 53], "C": [48, 52, 55], "Gm": [43, 46, 50], "A": [45, 49, 52], "D": [50, 54, 57], "G": [43, 47, 50]}
def chords(t0, prog, dur, vel=0.3, warm=800, bass=True):
    for i, c in enumerate(prog):
        put_m(I.pad([F(m) for m in CH[c]], dur, vel, R, att=0.2, rel=0.6, warm=warm), t0 + i * dur)
        if bass: put_m(I.pluck(F(CH[c][0] - 12), 0.5, R, 1.2, bright=0.3), t0 + i * dur, 0.9, -0.1)
def arp(t0, t1, prog, step=0.25, vel=0.2, octave=12, per=2.0):
    t = t0; k = 0
    while t < t1 - 0.05:
        c = prog[int((t - t0) / per) % len(prog)]; notes = CH[c] + [CH[c][0] + 12]
        put_m(I.pluck(F(notes[[0, 1, 2, 3, 2, 1][k % 6]] + octave), vel, R, 0.6, bright=0.6), t, 1.0, 0.3 * np.sin(k)); t += step; k += 1
def drums(t0, t1, beat=0.43, vel=1.0, kick_b=(0, 2.5), snare_b=(1, 3), hats=True):
    b = 0.0; t = t0
    while t < t1 - 0.01:
        pos = b % 4
        if pos in kick_b: put_m(kick(0.8 * vel), t, 0.9)
        if pos in snare_b: put_m(I.snare(0.45 * vel, R, 0.25, tune=1.2), t, 0.55, 0.1)
        if hats: put_m(hat(0.22 * vel), t, 0.5, -0.3)
        b += 0.5; t += beat / 2
def timp_ost(t0, t1, step=0.3, base=38, v0=0.5, v1=0.8):
    t = t0; k = 0
    while t < t1 - 0.05:
        put_m(I.timpani(F(base + (7 if k % 4 == 3 else 0)), v0 + (v1 - v0) * (t - t0) / max(0.1, t1 - t0), R, 0.8), t, 0.8); t += step; k += 1
def science(t0, t1):
    k = 0; t = t0
    while t < t1 - 0.05:
        put_m(I.glock(F([69, 72, 76, 74][k % 4] + (12 if k % 8 > 5 else 0)), 0.28, R, 1.0), t, 0.6, 0.4 * np.sin(k * 1.7))
        if k % 4 == 0: put_m(I.pad([F(m) for m in CH[["Dm", "Bb", "F", "C"][(k // 4) % 4]]], 4 * 0.45, 0.2, R, att=0.4, rel=0.6, warm=500), t)
        if k % 2 == 0: put_m(kick(0.3), t, 0.6)
        t += 0.45; k += 1
def stab(t, notes, vel=0.5, dur=1.4):
    put_m(I.pad([F(m) for m in notes], dur, vel, R, att=0.01, rel=0.9, warm=1600), t)
    put_m(I.timpani(F(notes[0] - 12 if notes[0] > 40 else notes[0]), 0.9, R, 1.8), t, 1.0)

# 0-4 hook: epic hit + drone
stab(0.35, [38, 45, 50, 53], 0.5, 3.4); put_m(I.cymbal(0.6, R, 3.0), 0.35, 0.5)
put_m(I.brass(F(38), 3.2, 0.45, R, kind="tuba"), 0.4, 0.6)
# 4-10.5 bedroom: chill lo-fi
chords(4.05, ["Dm", "Bb", "F", "C"], 1.6, 0.22, 700)
arp(4.05, 10.5, ["Dm", "Bb", "F", "C"], 0.2, 0.15, per=1.6)
drums(4.85, 10.5, 0.4, 0.5)
# 10.5-12.4 the dive
put_m(sweep(150, 2400, 1.8, 0.14), 10.6, 0.9)
# 12.45-21.9 the hall and the knight
put_m(I.pad([F(m) for m in [38, 45, 50]], 9.4, 0.26, R, att=0.8, rel=1.0, warm=400), 12.5)
for tb in [14.3, 15.45, 17.1, 18.05]: put_m(I.timpani(F(38), 0.95, R, 1.8), tb, 1.0)
put_m(I.brass(F(38), 1.6, 0.55, R, kind="tuba"), 14.3, 0.8); put_m(I.brass(F(41), 1.6, 0.5, R, kind="tuba"), 15.45, 0.8)
put_m(I.cymbal(0.5, R, 2.4), 15.45, 0.45)
for i, m in enumerate([62, 61, 62, 64]): put_m(I.pluck(F(m), 0.25, R, 0.7, bright=0.3), 18.8 + i * 0.75, 0.8, 0.3)   # Léo, nervous
# 21.9-31.85 the fight: driving timpani + drums + Dm/Bb/Gm/A
chords(21.9, ["Dm", "Bb", "Gm", "A"] * 2, 1.25, 0.26, 900)
timp_ost(21.9, 31.6, 0.31, 38, 0.45, 0.75)
drums(22.5, 31.7, 0.35, 0.85)
for tb in [T["hit1"], T["hit2"]]: stab(tb, [38, 45, 50], 0.45, 1.0)
# 31.85-35.8: he notices: everything drops to a heartbeat-slow pulse
put_m(I.pad([F(m) for m in [50, 53, 57, 60]], 3.9, 0.2, R, att=0.2, rel=0.8, warm=600), 31.9)
for k in range(5): put_m(I.pluck(F([57, 60][k % 2]), 0.22, R, 0.5, bright=0.4), 32.2 + k * 0.7, 0.8, -0.3)
# 35.8-51.3 science
science(35.9, 51.0)
# 51.3-58: the plan: sneaky pizzicato motif going up
SNEAK = [62, 65, 69, 67, 65, 64, 62, 64, 65, 69, 72, 74]
for i, m in enumerate(SNEAK * 2):
    put_m(I.pluck(F(m), 0.32, R, 0.35, bright=0.5), 51.6 + i * 0.27, 0.9, 0.2 * np.sin(i))
chords(51.4, ["Dm", "Gm", "C", "F"], 1.62, 0.18, 700, bass=True)
# 58-63.1: the chase around the column: fast comic runs
chords(58.0, ["Dm", "C", "Bb", "A"] * 2, 0.62, 0.22, 1000)
RUN = [74, 72, 70, 69, 70, 72, 74, 77]
for i in range(32):
    put_m(I.pluck(F(RUN[i % 8] + (0 if i < 16 else 2)), 0.3, R, 0.25, bright=0.7), 58.05 + i * 0.155, 0.8, 0.3 * ((-1) ** i))
drums(58.0, 62.9, 0.31, 0.7)
# 63.1-67: the charge builds
put_m(I.pad([F(m) for m in [38, 45, 50, 51]], 3.9, 0.3, R, att=0.3, rel=0.4, warm=500), 63.2)
timp_ost(63.3, 65.2, 0.42); timp_ost(65.2, 66.95, 0.17, 38, 0.6, 0.95)
for i in range(20): put_m(I.snare(0.2 + 0.03 * i, R, 0.1, tune=1.4), 65.2 + i * 0.088, 0.5)
# 67-77.5 science 2
science(67.1, 77.3)
# 77.5-81.2: the last steps of the charge
timp_ost(77.5, 81.0, 0.2, 38, 0.6, 1.0)
for i in range(30): put_m(I.snare(0.25 + 0.02 * i, R, 0.1, tune=1.4), 78.6 + i * 0.087, 0.55)
put_m(I.pad([F(m) for m in [38, 45, 50, 52]], 3.6, 0.32, R, att=0.4, rel=0.2, warm=900), 77.6)
# 81.21 impact (music cuts), 83.89 CRÍTICO, 85.1 victory fanfare in D major
stab(T["crit"], [50, 57, 62, 66], 0.55, 1.4); put_m(I.cymbal(0.8, R, 2.6), T["crit"], 0.7)
FAN = [(0, 0.5, 62), (0.5, 0.25, 66), (0.75, 0.25, 69), (1.0, 1.0, 74), (2.2, 0.4, 71), (2.6, 1.2, 74)]
for b, d, m in FAN:
    put_m(I.brass(F(m - 12), d + 0.2, 0.55, R, kind="horn" if False else "tuba"), T["poof"] + 0.1 + b * 0.5, 0.35)
    put_m(I.pluck(F(m), 0.45, R, max(0.5, d), bright=0.7), T["poof"] + 0.1 + b * 0.5, 1.0, 0.15)
    put_m(I.glock(F(m + 12), 0.2, R, 0.9), T["poof"] + 0.1 + b * 0.5, 0.6, -0.2)
chords(85.15, ["D", "G", "D", "A"], 0.95, 0.26, 1400)
drums(85.15, 88.9, 0.38, 0.6)
# 89-99: the passage: low drone, swell, eyes, end sting
put_m(I.pad([F(m) for m in [38, 39, 45]], 6.0, 0.28, R, att=1.5, rel=1.0, warm=400), 89.1)
put_m(I.pad([F(m) for m in [26, 33, 38]], 6.5, 0.34, R, att=0.05, rel=2.0, warm=300), T["eyes"])
put_m(I.timpani(F(33), 1.0, R, 2.6), T["eyes"], 1.0)
stab(T["end"], [38, 45, 50, 53], 0.5, 3.0); put_m(I.cymbal(0.7, R, 3.0), T["end"], 0.6)

# ---------------------------------------------------------------- effects
sfx = np.zeros((2, N))
def put_s(x, t, g=1.0, p=0.0):
    place(sfx, pan(x, p) if np.ndim(x) == 1 else x, t, g)
# hook: the knight is already stuck in the wall: rubble settling, stars
put_s(rubble(0.4, 1.4), 0.3, 0.6); [put_s(tweet(0.16), 0.6 + k * 0.4, 0.5, 0.4) for k in range(8)]
# bedroom
put_s(chime([81, 85, 88, 93], 0.06, 0.35), 4.3, 0.7)
put_s(blip(600, 1200, 0.12, 0.3), T["helmetOn"], 0.8); put_s(sweep(300, 2400, 1.2, 0.16), 9.8, 0.8)
put_s(blip(300, 120, 0.08, 0.5), T["lightsOut"], 0.9)                         # light switch
for k in range(3): put_s(whoosh(0.7, R, 0.35, 600, 4000), 10.85 + k * 0.25, 0.55, (-1) ** k * 0.5)
put_s(whoosh(1.0, R, 0.5, 300, 3000), 11.6, 0.7)                                # falling
put_s(thud(1.1, 48, 0.9), T["land"], 1.0); put_s(oof(R, "oof", base=180, scale=1.0) * 0.5, T["land"] + 0.05, 0.7)
# the knight wakes
put_s(hum(1.6, 70, 0.25), T["eyesOn"], 0.8); put_s(sweep(90, 300, 0.5, 0.3), T["eyesOn"], 0.8)
put_s(thud(0.9, 40, 1.4), T["bossCard"], 0.8)
put_s(blip(900, 1500, 0.1, 0.3), 19.25, 0.6)                                   # Léo tag
put_s(clang(0.15, 0.4, 2.2), 20.05, 0.6, 0.3)                                  # dagger
# fight
put_s(armour_step(0.8), 21.95, 0.8); put_s(armour_step(0.7), 22.35, 0.8)
put_s(whoosh(0.5, R, 0.3, 300, 2500), T["raise_"], 0.7)                         # sword up
put_s(whoosh(0.4, R, 0.2, 500, 4000), T["jump"], 0.6, -0.3)                     # jump back
put_s(step(0.4), T["jump"] + 0.5, 0.8)
for h in [T["hit1"], T["hit2"]]:
    put_s(whoosh(0.3, R, 0.22, 200, 2000), h - 0.25, 0.8)
    put_s(thud(1.2, 45, 1.0), h, 1.0); put_s(clang(0.5, 1.0), h, 0.6); put_s(crack(0.9), h, 0.8); put_s(rubble(0.4, 0.9), h + 0.05, 0.6)
    put_s(blip(1200, 1800, 0.1, 0.25), h + 0.1, 0.5)                           # ERROU!
put_s(whoosh(0.5, R, 0.3, 400, 3000), T["roll"], 0.7, -0.4); put_s(step(0.4), T["roll"] + 0.45, 0.8)
put_s(whoosh(0.4, R, 0.25, 300, 2500), T["swing3"], 0.6)
put_s(whoosh(0.35, R, 0.12, 700, 6000), T["sweep"], 1.0, 0.5)                  # blade over his head
put_s(blip(1200, 1800, 0.1, 0.25), T["sweep"] + 0.15, 0.5)
# panting
for k in range(7): put_s(breath(0.32, 0.45, k % 2 == 0), 33.7 + k * 0.42, 0.8)
for k in range(9): put_s(breath(0.25, 0.4, k % 2 == 0), 51.4 + k * 0.42, 0.55)
# science scene transitions
for tw in [35.6, 51.1, 66.8, 77.3]: put_s(whoosh(0.5, R, 0.25, 500, 4000), tw, 0.6)
put_s(thud(0.7, 50, 0.7), 39.1, 0.6)                                           # 30-50 kg tag
for k in range(8): put_s(blip(1600, 2100, 0.05, 0.1), 44.7 + k * 0.15, 0.5)      # energy bar fill
put_s(blip(700, 1100, 0.1, 0.3), 49.2, 0.6)
# the plan
put_s(clang(0.12, 0.3, 2.4), T["sheath"], 0.6, 0.3)                           # dagger away
# the chase
for k in range(int((63.0 - T["runOff"]) / 0.17)): put_s(step(0.28), T["runOff"] + k * 0.17, 0.7, 0.3 * np.sin(k))
for k in range(int((T["stopKite"] - 57.6) / 0.33)): put_s(armour_step(0.45), 57.6 + k * 0.33 * (1 + 0.25 * max(0, (57.6 + k * 0.33 - 60.6) / 2)), 0.6, -0.2)
for tl in [T["kite"], T["lap2"], T["lap3"]]: put_s(chime([84, 88], 0.06, 0.35), tl, 0.8)
put_s(sweep(900, 200, 1.8, 0.12), T["drain"], 0.6)                              # stamina draining
for k in range(5): put_s(breath(0.3, 0.4, k % 2 == 0), 62.4 + k * 0.4, 0.7)
# the charge
put_s(armour_step(0.9), T["charge"] - 0.3, 0.9)
for k in range(int((66.95 - T["charge"]) / 0.3)): put_s(armour_step(0.7 + 0.03 * k), T["charge"] + k * 0.3, 0.8)
for k in range(int((T["impact"] - 77.5) / 0.28)): put_s(armour_step(0.8 + 0.03 * k), 77.5 + k * 0.28, 0.85)
put_s(whoosh(0.4, R, 0.2, 500, 4000), T["side"], 0.7, 0.4)
put_s(step(0.4), T["side"] + 0.4, 0.8)
# the crash
put_s(thud(1.6, 38, 1.8), T["impact"], 1.0); put_s(clang(1.0, 2.2, 0.8), T["impact"], 0.9); put_s(crack(1.2), T["impact"], 1.0)
put_s(rubble(0.9, 2.4), T["impact"] + 0.05, 0.9)
for k in range(10): put_s(tweet(0.18), T["impact"] + 0.9 + k * 0.4, 0.5, -0.4)
put_s(clang(0.4, 1.2, 1.4), 82.4, 0.5)                                        # helmet wobble
put_s(thud(1.1, 50, 0.8), T["crit"], 0.9); put_s(blip(1800, 2600, 0.15, 0.35), T["crit"], 0.7)
# victory
put_s(chime([86, 90, 93, 98, 102], 0.05, 0.45), T["poof"], 0.9); put_s(sweep(400, 3000, 0.6, 0.15), T["poof"], 0.7)
put_s(chime([79, 83, 86, 91, 95, 98], 0.07, 0.5), T["lvl"], 1.0)
# the passage + eyes
put_s(rubble(0.35, 2.0), 89.5, 0.6); put_s(hum(3.5, 41, 0.25), 89.3, 0.7)
put_s(growl(0.6, 2.4), T["eyes"] + 0.1, 0.9)
put_s(thud(1.2, 40, 1.5), T["end"], 0.9)

# ---------------------------------------------------------------- voice
v, vsr = sf.read(os.path.join(os.path.dirname(os.path.abspath(__file__)), "voice.wav"), always_2d=False)
if vsr != SR: v = resample_poly(v, SR, vsr)
voice = np.zeros(N); voice[: min(N, len(v))] = v[: min(N, len(v))]

# ---------------------------------------------------------------- mix
ir = make_ir(1.8, 3, hf=0.55)                       # stone hall
music_w = music + 0.2 * convolve_st(music, ir)[:, :N]
sfx_w = sfx + 0.14 * convolve_st(sfx, ir)[:, :N]
# duck music under the voice (envelope of the narration, 120 ms attack / 350 ms release)
env = np.abs(voice); win = ns(0.05)
env = np.convolve(env, np.ones(win) / win, mode="same")
on = (env > 0.01).astype(float)
k_a, k_r = 1 - np.exp(-1 / (0.12 * SR)), 1 - np.exp(-1 / (0.35 * SR))
g = np.empty(N); y = 0.0
for i in range(0, N, 64):  # block-wise for speed
    target = on[i]; y += (target - y) * (1 - (1 - (k_a if target > y else k_r)) ** 64); g[i:i + 64] = y
duck = 1 - 0.55 * g
music_w *= duck[None, :]
sfx_w *= (1 - 0.25 * g)[None, :]
fadeout = np.ones(N); fo = ns(1.5); fadeout[-fo:] = np.linspace(1, 0, fo) ** 2
music_w *= fadeout[None, :]; sfx_w *= fadeout[None, :]
voice_st = np.stack([voice, voice])
# balance: voice reference, music about -16 dB below it in loudness when ducked, effects in between
lv = integrated(voice_st)
mg = dbg(lv - 13.0 - integrated(music_w)); sg = dbg(lv - 9.0 - integrated(sfx_w))
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
