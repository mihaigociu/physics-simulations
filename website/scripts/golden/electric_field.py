"""Reference values for the TypeScript electric-field port, from the Python original.

Imports pygame_electric_field_simulation.py itself (headless) and uses its own
field function and update step.

Run from website/:
    ../.venv/bin/python scripts/golden/electric_field.py > src/sims/electric-field/golden.json
"""

import json
import math
import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

import pygame_electric_field_simulation as ef  # noqa: E402

sim = ef.ElectricFieldSimulation(width=200, height=200)

fields = []
for x, y in ((1.5, 0.0), (0.5, 0.5), (-0.3, 1.7), (2.0, -2.0), (0.1, -0.05), (-1.2, -0.8)):
    ex, ey = sim.total_electric_field_at_point((x, y))
    fields.append({"x": x, "y": y, "ex": float(ex), "ey": float(ey)})


def energy(s):
    p = s.particle
    pe = sum(ef.k * p["q"] * q / math.hypot(p["x"] - cx, p["y"] - cy) for cx, cy, q in s.charges)
    return 0.5 * p["m"] * (p["vx"] ** 2 + p["vy"] ** 2) + pe


def run(time_step, seconds):
    """The Python update loop from the initial state; positions once per simulated second."""
    sim.reset()
    sim.time_step = time_step
    steps = round(seconds / time_step)
    every = round(1.0 / time_step)
    out = [{"t": 0.0, "x": sim.particle["x"], "y": sim.particle["y"], "energy": energy(sim)}]
    for i in range(1, steps + 1):
        sim.update_particle()
        if sim.paused:  # left the area
            break
        if i % every == 0:
            p = sim.particle
            out.append({"t": i * time_step, "x": p["x"], "y": p["y"], "vx": p["vx"], "vy": p["vy"], "energy": energy(sim)})
    return out


json.dump({
    "source": "pygame_electric_field_simulation.py",
    "k": ef.k,
    "charges": [{"x": x, "y": y, "q": q} for x, y, q in sim.charges],
    "particle": sim.initial_particle,
    "fields": fields,
    # Python's own step (0.05 s) and a 100x finer one, as an accurate reference
    "pythonDefault": run(0.05, 20),
    "pythonFine": run(0.0005, 20),
}, sys.stdout, indent=1)
print()
