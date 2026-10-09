"""Reference values for the TypeScript free-fall port, from the Python original.

Imports free_fall_simulation.py itself (headless), so the numbers come from
the very code students have been running, not from a re-typed copy.

Run from website/:
    ../.venv/bin/python scripts/golden/free_fall.py > src/sims/free-fall/golden.json
"""

import json
import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

import free_fall_simulation as ff  # noqa: E402

PLANETS = {"earth": ff.PLANETS[0], "mars": ff.PLANETS[1], "moon": ff.PLANETS[2]}
MASSES = [0.1, 1.0, 20.0, 50.0]
HEIGHTS = [1.0, 20.0, 45.0, 100.0]


def simulate(mass, g, height, air, dt=0.0005):
    """Drop one ball with the Python integrator; return its landing time."""
    ball = ff.FallingObject(mass, (0, 0, 0))
    ball.reset(height)
    t = 0.0
    while not ball.landed:
        ball.update(dt, g, air)
        t += dt
    return t


exact = []
for pid, p in PLANETS.items():
    for air_on in (False, True):
        air = p["air"] if air_on else 0.0
        for h in HEIGHTS:
            for m in MASSES:
                t, v = ff.air_fall_exact(m, p["g"], h, air)
                exact.append({"planet": pid, "air": air_on, "height": h, "mass": m, "t": t, "v": v})

integrated = []
for pid in ("earth", "mars"):
    p = PLANETS[pid]
    for h in (20.0, 100.0):
        for m in (0.1, 50.0):
            integrated.append({"planet": pid, "height": h, "mass": m,
                               "t": simulate(m, p["g"], h, p["air"])})

axes = [{"span": s, "max": ff.axis_max(s)[0], "step": ff.axis_max(s)[1]}
        for s in (0.45, 1.0, 2.02, 3.03, 4.97, 7.3, 11.1, 19.81, 20.0, 44.3, 63.0, 100.0)]

json.dump({"source": "free_fall_simulation.py", "exact": exact,
           "integrated": integrated, "axes": axes}, sys.stdout, indent=1)
print()
