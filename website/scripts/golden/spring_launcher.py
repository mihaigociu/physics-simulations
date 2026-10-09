"""Reference values for the TypeScript spring-launcher port, from the Python original.

Imports spring_launcher_simulation.py itself (headless) and runs its own
update loop, so the numbers come from the code students have been running.

Run from website/:
    ../.venv/bin/python scripts/golden/spring_launcher.py > src/sims/spring-launcher/golden.json
"""

import json
import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

import spring_launcher_simulation as sl  # noqa: E402

PLANETS = {"earth": 0, "mars": 1, "moon": 2}
launcher = sl.SpringLauncher()

cases = []
for pid, idx in PLANETS.items():
    for k, x, angle in ((500, 0.5, 45), (100, 0.1, 30), (1000, 2.0, 60), (250, 1.2, 75)):
        launcher.reset()
        launcher.selected_planet = idx
        launcher.gravity = sl.PLANETS[idx]["g"]
        launcher.stiffness_slider.value = k
        launcher.compression_slider.value = x
        launcher.angle_slider.value = angle
        launcher.update()  # copies the slider values into the launcher
        vx, vy, v = launcher.calculate_launch_velocity()
        launcher.launch()
        frames = 0
        while not launcher.finished and frames < 100000:
            launcher.update()
            frames += 1
        cases.append({
            "planet": pid, "k": k, "compression": x, "angle": angle, "mass": launcher.ball_mass,
            "springEnergy": 0.5 * k * x ** 2, "v": v, "vx": vx, "vy": vy,
            # The Python flight: fixed 1/60 s Euler steps, landing snapped to the
            # first step below ground - so these are approximate by design
            "pythonFlightTime": launcher.time, "pythonRange": launcher.projectile.x,
        })

json.dump({"source": "spring_launcher_simulation.py", "cases": cases}, sys.stdout, indent=1)
print()
