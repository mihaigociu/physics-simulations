"""Reference values for the TypeScript bucket port, from the Python original.

bucket_drip_simulation.py runs its pygame loop at import time, so this runs
the file's own source up to the "# Main loop" marker (headless). The physics
constants and solve_for_planet() therefore come from the file itself.

Run from website/:
    ../.venv/bin/python scripts/golden/bucket.py > src/sims/bucket/golden.json
"""

import contextlib
import io
import json
import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "bucket_drip_simulation.py")
source = open(path, encoding="utf-8").read()
ns = {"__name__": "bucket_drip_setup"}
with contextlib.redirect_stdout(io.StringIO()):  # it prints the drain time
    exec(compile(source[: source.index("# Main loop")], path, "exec"), ns)

cases = []
for idx, pid in enumerate(("earth", "mars", "moon")):
    with contextlib.redirect_stdout(io.StringIO()):
        sol, t_drain = ns["solve_for_planet"](idx)
    samples = [{"t": f * t_drain, "volume": float(max(0.0, sol.sol(f * t_drain)[0]))}
               for f in (0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99)]
    g = ns["PLANETS"][idx]["g"]
    # The file's own closed-form drain time (T_analytical inside solve_for_planet)
    coef = ns["C_d"] * (ns["A_h"] / 2.0) * (2.0 * g / ns["A_b"]) ** 0.5
    cases.append({"planet": pid, "g": g, "drainTimeAnalytical": ns["V0"] ** 0.5 / coef,
                  "drainTime": t_drain, "samples": samples})

json.dump({
    "source": "bucket_drip_simulation.py",
    "volume0": ns["V0"], "bucketRadius": ns["radius_bucket_m"], "holeRadius": ns["hole_radius_m"], "cd": ns["C_d"],
    "cases": cases,
}, sys.stdout, indent=1)
print()
