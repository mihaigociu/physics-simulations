import pygame
import numpy as np
from scipy.integrate import solve_ivp
import sys

# Initialize Pygame
pygame.init()

# Screen dimensions
WIDTH, HEIGHT = 1280, 800
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Bucket Draining Simulation")

# Colors
BACKGROUND = (240, 240, 240)
BUCKET_COLOR = (100, 100, 100)
WATER_COLOR = (50, 150, 255)
WATER_SURFACE = (30, 130, 235)
HOLE_COLOR = (40, 40, 40)
TEXT_COLOR = (0, 0, 0)
BTN_ACTIVE   = (60, 60, 60)
BTN_INACTIVE = (180, 180, 180)
BTN_TEXT     = (255, 255, 255)
BTN_BORDER   = (80, 80, 80)

# Planets: name, gravity (m/s²), background sky color, label color
PLANETS = [
    {"name": "Terra",  "g": 9.81, "sky": (200, 225, 255), "color": (30, 100, 200)},
    {"name": "Marte",  "g": 3.72, "sky": (240, 200, 170), "color": (180, 60,  20)},
    {"name": "Luna",   "g": 1.62, "sky": (50,  50,  70),  "color": (220, 220, 220)},
]
selected_planet = 0  # index in PLANETS

# Physics parameters
V0_liters = 10.0
V0 = V0_liters / 1000.0  # m^3

radius_bucket_m = 0.10
A_b = np.pi * radius_bucket_m**2

hole_radius_m = 0.005
A_h = np.pi * hole_radius_m**2

C_d = 1.0

def solve_for_planet(planet_idx):
    """Solve the ODE for the given planet and return (sol, t_drain)."""
    g = PLANETS[planet_idx]["g"]

    def dVdt(t, y):
        V = y[0]
        if V <= 0.0:
            return [0.0]
        h = V / A_b
        return [-C_d * A_h * np.sqrt(2.0 * g * h)]

    def empty_event(t, y):
        return y[0]
    empty_event.terminal = True
    empty_event.direction = -1

    coef = C_d * (A_h / 2.0) * np.sqrt(2.0 * g / A_b)
    T_analytical = np.sqrt(V0) / coef

    sol = solve_ivp(
        dVdt,
        (0.0, T_analytical * 1.5),
        [V0],
        events=empty_event,
        dense_output=True,
        rtol=1e-8,
        atol=1e-10,
        max_step=0.1,
    )
    t_drain = float(sol.t_events[0][0]) if sol.t_events[0].size > 0 else sol.t[-1]
    print(f"{PLANETS[planet_idx]['name']}: drain time = {t_drain:.1f}s  (g={g} m/s²)")
    return sol, t_drain

# Initial solve
sol, t_drain = solve_for_planet(selected_planet)

# Visualization parameters - calculated from physical parameters
# Calculate physical bucket height from volume and cross-section
h_bucket_m = V0 / A_b  # physical height in meters

# Set a scale factor (pixels per meter) to fit nicely on screen
# Target bucket height around 300-350 pixels
SCALE = 300 / h_bucket_m  # pixels per meter

# Calculate visual dimensions based on physical parameters
bucket_width = int(2 * radius_bucket_m * SCALE)  # diameter in pixels
bucket_height = int(h_bucket_m * SCALE)  # height in pixels
bucket_x = WIDTH // 2 - bucket_width // 2
bucket_y = HEIGHT // 2 - bucket_height // 2 + 60
bucket_thickness = max(3, int(0.005 * SCALE))  # proportional thickness, min 3px
hole_width = int(2 * hole_radius_m * SCALE)  # hole diameter in pixels
hole_height = max(5, int(hole_radius_m * SCALE))  # hole height proportional

# Planet selector buttons
BTN_W, BTN_H = 110, 40
BTN_Y = 20
BTN_GAP = 20
total_btn_w = len(PLANETS) * BTN_W + (len(PLANETS) - 1) * BTN_GAP
btn_start_x = WIDTH // 2 - total_btn_w // 2
buttons = []
for i, p in enumerate(PLANETS):
    bx = btn_start_x + i * (BTN_W + BTN_GAP)
    buttons.append(pygame.Rect(bx, BTN_Y, BTN_W, BTN_H))

# Fonts
font       = pygame.font.Font(None, 36)
small_font = pygame.font.Font(None, 24)
btn_font   = pygame.font.Font(None, 28)

# Animation control
clock = pygame.time.Clock()
FPS = 60
simulation_speed = 1.0

# Time tracking
current_time = 0.0
running = True
paused = False


def get_current_volume(t):
    if t >= t_drain:
        return 0.0
    return max(0.0, sol.sol(t)[0])


def get_water_height_pixels(V):
    if V <= 0:
        return 0
    return int(bucket_height * (V / V0))


def draw_planet_buttons():
    for i, (rect, p) in enumerate(zip(buttons, PLANETS)):
        active = (i == selected_planet)
        color = p["color"] if active else BTN_INACTIVE
        pygame.draw.rect(screen, color, rect, border_radius=8)
        pygame.draw.rect(screen, BTN_BORDER, rect, 2, border_radius=8)
        label = btn_font.render(p["name"], True, BTN_TEXT if active else TEXT_COLOR)
        screen.blit(label, label.get_rect(center=rect.center))


def draw_bucket():
    # Left wall
    pygame.draw.rect(screen, BUCKET_COLOR,
                     (bucket_x - bucket_thickness, bucket_y,
                      bucket_thickness, bucket_height))
    # Right wall
    pygame.draw.rect(screen, BUCKET_COLOR,
                     (bucket_x + bucket_width, bucket_y,
                      bucket_thickness, bucket_height))
    # Bottom
    pygame.draw.rect(screen, BUCKET_COLOR,
                     (bucket_x - bucket_thickness, bucket_y + bucket_height,
                      bucket_width + 2 * bucket_thickness, bucket_thickness))
    # Hole
    hole_x = bucket_x + bucket_width // 2 - hole_width // 2
    hole_y = bucket_y + bucket_height - hole_height
    pygame.draw.rect(screen, HOLE_COLOR, (hole_x, hole_y, hole_width, hole_height))


def draw_water(V):
    water_height = get_water_height_pixels(V)
    if water_height > 0:
        water_y = bucket_y + bucket_height - water_height
        pygame.draw.rect(screen, WATER_COLOR,
                         (bucket_x, water_y, bucket_width, water_height))
        pygame.draw.line(screen, WATER_SURFACE,
                         (bucket_x, water_y),
                         (bucket_x + bucket_width, water_y), 3)


def draw_info(V, t):
    g_val = PLANETS[selected_planet]["g"]
    p_color = PLANETS[selected_planet]["color"]
    is_luna = PLANETS[selected_planet]["name"] == "Luna"
    info_color = p_color if is_luna else TEXT_COLOR

    # Planet & gravity
    g_text = font.render(
        f"{PLANETS[selected_planet]['name']}  —  g = {g_val:.2f} m/s²",
        True, p_color)
    screen.blit(g_text, (50, 80))

    # Volume
    volume_text = font.render(f"Volum: {V * 1000:.2f} L", True, info_color)
    screen.blit(volume_text, (50, 120))

    # Time
    time_text = small_font.render(
        f"Timp: {t:.1f}s  /  Total: {t_drain:.1f}s", True, info_color)
    screen.blit(time_text, (50, 160))

    # Height
    h = V / A_b if V > 0 else 0
    height_text = small_font.render(f"Înălțime apă: {h * 100:.1f} cm", True, info_color)
    screen.blit(height_text, (50, 185))

    # Speed
    speed_text = small_font.render(f"Viteză: {simulation_speed:.1f}x", True, TEXT_COLOR)
    screen.blit(speed_text, (WIDTH - 160, 80))

    # Controls
    controls = small_font.render(
        "SPACE: Pauză   R: Resetare   +/-: Viteză", True, (80, 80, 80))
    screen.blit(controls, (WIDTH // 2 - controls.get_width() // 2, HEIGHT - 30))

    # PAUSED / EMPTY
    if paused:
        pause_surf = font.render("PAUZĂ", True, (200, 0, 0))
        screen.blit(pause_surf, (WIDTH // 2 - pause_surf.get_width() // 2, 80))
    if t >= t_drain:
        empty_surf = font.render("GOALĂ!", True, (200, 0, 0))
        screen.blit(empty_surf, (WIDTH // 2 - empty_surf.get_width() // 2,
                                 bucket_y - 50))


# Main loop
while running:
    dt = clock.tick(FPS) / 1000.0

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            for i, rect in enumerate(buttons):
                if rect.collidepoint(event.pos) and i != selected_planet:
                    selected_planet = i
                    sol, t_drain = solve_for_planet(selected_planet)
                    current_time = 0.0
                    paused = False

        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_SPACE:
                paused = not paused
            elif event.key == pygame.K_r:
                current_time = 0.0
                paused = False
            elif event.key in (pygame.K_EQUALS, pygame.K_PLUS):
                simulation_speed = min(10.0, simulation_speed + 0.5)
            elif event.key == pygame.K_MINUS:
                simulation_speed = max(0.1, simulation_speed - 0.5)

    # Update time
    if not paused and current_time < t_drain:
        current_time = min(current_time + dt * simulation_speed, t_drain)

    current_volume = get_current_volume(current_time)

    # Draw
    sky = PLANETS[selected_planet]["sky"]
    screen.fill(sky)
    draw_planet_buttons()
    draw_bucket()
    draw_water(current_volume)
    draw_info(current_volume, current_time)

    pygame.display.flip()

pygame.quit()
sys.exit()

