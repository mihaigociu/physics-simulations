# Physics Simulations

A collection of interactive physics simulations written in Python.

## Simulations

### 1. Bucket Drip Simulation (`bucket_drip_simulation.py`)

Simulates a bucket draining through a hole at the bottom, governed by Torricelli's law. The ODE is solved numerically with SciPy. Supports three gravity environments — Earth, Mars, and Moon — switchable at runtime.

**Controls:**
- Click the planet buttons (Terra / Marte / Luna) to switch gravity
- Close the window to exit

### 2. Electric Field Simulation (`pygame_electric_field_simulation.py`)

Simulates a charged test particle moving through the electric field produced by three fixed point charges. Visualizes the field vectors on a grid and draws the particle's trajectory in real time.

**Controls:**
- `Space` — pause / resume
- `R` — reset particle to initial position
- `F` — toggle field vector display
- Close the window to exit

### 3. Spring Launcher Simulation (`spring_launcher_simulation.py`)

Demonstrates energy conversion from elastic potential energy (compressed spring) to kinetic energy and projectile motion. Sliders let you adjust spring constant, compression distance, and launch angle interactively. Supports Earth, Mars, and Moon gravity.

**Controls:**
- Drag the sliders to change spring constant, compression, and angle
- Click the planet buttons to switch gravity
- Close the window to exit

### 4. Permeability Analysis (`permeability.py`)

Uses OpenPNM to build cubic pore-network models of porous materials, compute absolute permeability via Stokes flow, and analyse porosity and pore-size distributions. Produces matplotlib figures comparing different network configurations.

**No interactive window** — outputs plots and prints results to the terminal.

---

## Installation

### Prerequisites

- Python 3.12

### 1. Clone the repository

```bash
git clone https://github.com/mihaigociu/physics-simulations.git
cd physics-simulations
```

### 2. Create and activate a virtual environment

```bash
python3.12 -m venv .venv
source .venv/bin/activate      # macOS / Linux
# .venv\Scripts\activate       # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

## Running the simulations

Make sure the virtual environment is activated before running any script.

```bash
# Bucket draining
python bucket_drip_simulation.py

# Electric field
python pygame_electric_field_simulation.py

# Spring launcher
python spring_launcher_simulation.py

# Permeability analysis (no window — outputs plots)
python permeability.py
```
