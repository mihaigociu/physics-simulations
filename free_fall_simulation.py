"""
Free Fall Simulation
Drops two objects of different mass from the same height at the same moment.
They always land together: the fall time depends only on the height and g,
never on the mass.

Inspired by Lecture 1 of Walter Lewin's 8.01x (MIT Physics I).
"""

import pygame
import math
import sys

# Initialize Pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 1600, 900
FPS = 60

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (200, 40, 40)
BLUE = (30, 100, 200)
GREEN = (0, 160, 60)
YELLOW = (255, 210, 60)
ORANGE = (255, 150, 40)
GRAY = (200, 200, 200)
DARK_GRAY = (100, 100, 100)
LIGHT_GRAY = (235, 235, 235)
TEXT_COLOR = (20, 20, 20)
BTN_TEXT = (255, 255, 255)
BTN_BORDER = (80, 80, 80)
BTN_INACTIVE = (180, 180, 180)

# Planets: name, gravity (m/s²), air density (kg/m³), sky colour, ground
# colour, "color" = button fill (read against the sky/button), "panel" = same
# idea but readable on the light control panel.
#
# The air density is per-world, which is the whole point: the Moon has no
# atmosphere, so switching air resistance on there changes nothing at all.
# Mars has an atmosphere about 60x thinner than Earth's, so it changes very
# little. Only on Earth is the effect large.
PLANETS = [
    {"name": "Terra", "g": 9.81, "air": 1.225, "sky": (205, 228, 255),
     "ground": (90, 150, 80),   "color": (30, 100, 200),
     "panel": (30, 100, 200),
     "air_note": "Earth air at sea level: 1.225 kg/m3."},
    {"name": "Marte", "g": 3.72, "air": 0.020, "sky": (240, 205, 175),
     "ground": (160, 85, 50),   "color": (180, 60, 20),
     "panel": (180, 60, 20),
     "air_note": "Mars air is ~60x thinner: 0.020 kg/m3."},
    {"name": "Luna",  "g": 1.62, "air": 0.0, "sky": (40, 40, 55),
     "ground": (120, 120, 130), "color": (225, 225, 235),
     "panel": (70, 70, 95),
     "air_note": "The Moon has no air, so this changes nothing."},
]

# Object properties
MASS_MIN, MASS_MAX = 0.1, 50.0      # kg
HEIGHT_MIN, HEIGHT_MAX = 1.0, 100.0  # m
OBJ_DENSITY = 800.0                  # kg/m³ (wood-like), used for air drag only

# Drag coefficient of a sphere (air density comes from the selected world)
DRAG_COEFF = 0.47

STROBE_INTERVAL = 0.25  # seconds between "photo flashes" of the falling object

# Chart tokens. The charts sit on their own fixed light surface rather than on
# the sky, so contrast stays the same on all three planets. Series colours are
# the ball colours (BLUE / RED) - identity follows the object, not the chart.
CHART_SURFACE = (252, 252, 251)
CHART_BORDER = (222, 222, 218)
CHART_GRID = (232, 232, 228)
CHART_AXIS = (190, 190, 185)
INK_PRIMARY = (11, 11, 11)
INK_SECONDARY = (82, 81, 78)
INK_MUTED = (130, 129, 125)
SAMPLE_INTERVAL = 1.0 / 60.0  # how often a chart point is recorded


def air_fall_exact(mass, gravity, height, air_density):
    """Fall time and impact speed in closed form, with or without air.

    For quadratic drag on a constant area, v(t) = v_t·tanh(g·t/v_t), which
    inverts to an exact fall time - so the chart axes need no integration.
    In a vacuum (no atmosphere, e.g. the Moon) this reduces to the schoolbook
    free-fall result, which is what the airless branch returns.
    """
    if air_density <= 0.0:
        t = math.sqrt(2.0 * height / gravity)
        return t, gravity * t

    radius = (3.0 * (mass / OBJ_DENSITY) / (4.0 * math.pi)) ** (1.0 / 3.0)
    area = math.pi * radius ** 2
    v_terminal = math.sqrt(2.0 * mass * gravity / (air_density * DRAG_COEFF * area))
    u = gravity * height / v_terminal ** 2
    # acosh(exp(u)) overflows for a large u; it tends to u + ln2 there
    reduced = math.acosh(math.exp(u)) if u < 20.0 else u + math.log(2.0)
    t = v_terminal / gravity * reduced
    return t, v_terminal * math.tanh(gravity * t / v_terminal)


def nice_step(span, target_ticks=5):
    """Round a raw axis span up to a human-friendly tick step (1, 2, 2.5, 5...)."""
    if span <= 0:
        return 1.0
    raw = span / target_ticks
    magnitude = 10.0 ** math.floor(math.log10(raw))
    for candidate in (1.0, 2.0, 2.5, 5.0, 10.0):
        step = candidate * magnitude
        if step >= raw * 0.95:
            return step
    return 10.0 * magnitude


def axis_max(span, target_ticks=5):
    """Smallest clean multiple of a nice step that still contains the data."""
    step = nice_step(span, target_ticks)
    return math.ceil(span / step - 1e-9) * step, step


class Slider:
    """Interactive slider for parameter control"""
    def __init__(self, x, y, width, min_val, max_val, initial_val, label, unit="",
                 color=BLUE):
        self.rect = pygame.Rect(x, y, width, 10)
        self.min_val = min_val
        self.max_val = max_val
        self.value = initial_val
        self.label = label
        self.unit = unit
        self.color = color
        self.dragging = False
        self.handle_radius = 9

    def handle_x(self):
        ratio = (self.value - self.min_val) / (self.max_val - self.min_val)
        return self.rect.x + ratio * self.rect.width

    def draw(self, screen, font):
        pygame.draw.rect(screen, GRAY, self.rect, border_radius=5)
        pygame.draw.rect(screen, DARK_GRAY, self.rect, 2, border_radius=5)

        hx = self.handle_x()
        pygame.draw.circle(screen, self.color, (int(hx), self.rect.centery),
                           self.handle_radius)
        pygame.draw.circle(screen, DARK_GRAY, (int(hx), self.rect.centery),
                           self.handle_radius, 2)

        label = font.render(f"{self.label}: {self.value:.2f} {self.unit}",
                            True, TEXT_COLOR)
        screen.blit(label, (self.rect.x, self.rect.y - 24))

    def handle_event(self, event):
        """Returns True if the value changed."""
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            # Hit area covers the track plus the handle circle, which sticks
            # out a little on every side. Both axes must be tested: an x-only
            # test grabs this slider from anywhere in the window.
            grab = pygame.Rect(self.rect.x - self.handle_radius - 2,
                               self.rect.y - self.handle_radius - 2,
                               self.rect.width + 2 * (self.handle_radius + 2),
                               self.rect.height + 2 * (self.handle_radius + 2))
            if grab.collidepoint(event.pos):
                self.dragging = True
                return self._set_from_mouse(event.pos[0])

        elif event.type == pygame.MOUSEBUTTONUP:
            self.dragging = False

        elif event.type == pygame.MOUSEMOTION and self.dragging:
            return self._set_from_mouse(event.pos[0])

        return False

    def _set_from_mouse(self, mouse_x):
        mouse_x = max(self.rect.x, min(mouse_x, self.rect.x + self.rect.width))
        ratio = (mouse_x - self.rect.x) / self.rect.width
        new_value = self.min_val + ratio * (self.max_val - self.min_val)
        changed = abs(new_value - self.value) > 1e-9
        self.value = new_value
        return changed


class Button:
    """Interactive button"""
    def __init__(self, x, y, width, height, text, color):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.color = color
        self.hover = False

    def draw(self, screen, font):
        color = tuple(min(c + 30, 255) for c in self.color) if self.hover else self.color
        pygame.draw.rect(screen, color, self.rect, border_radius=6)
        pygame.draw.rect(screen, BLACK, self.rect, 2, border_radius=6)
        label = font.render(self.text, True, BLACK)
        screen.blit(label, label.get_rect(center=self.rect.center))

    def handle_event(self, event):
        if event.type == pygame.MOUSEMOTION:
            self.hover = self.rect.collidepoint(event.pos)
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            return self.rect.collidepoint(event.pos)
        return False


class FallingObject:
    """One falling object: knows its own mass, position, speed and landing time."""
    def __init__(self, mass, color):
        self.mass = mass
        self.color = color
        self.y = 0.0          # height above ground, metres
        self.v = 0.0          # downward speed, m/s
        self.landed = False
        self.land_time = None
        self.strobes = []     # heights at regular time intervals
        self.samples = []     # (time, speed, distance fallen) for the charts

    def reset(self, start_height):
        self.y = start_height
        self.v = 0.0
        self.landed = False
        self.land_time = None
        self.strobes = [start_height]
        self.samples = [(0.0, 0.0, 0.0)]

    @property
    def physical_radius(self):
        """Radius of a sphere of this mass at OBJ_DENSITY (metres)."""
        volume = self.mass / OBJ_DENSITY
        return (3.0 * volume / (4.0 * math.pi)) ** (1.0 / 3.0)

    def draw_radius(self):
        """Screen radius in pixels - exaggerated so the mass difference is visible."""
        ratio = (self.mass - MASS_MIN) / (MASS_MAX - MASS_MIN)
        return int(10 + 26 * ratio ** (1.0 / 3.0))

    def update(self, dt, gravity, air_density):
        if self.landed:
            return

        if air_density > 0.0:
            # m·dv/dt = m·g − ½·ρ·Cd·A·v²
            area = math.pi * self.physical_radius ** 2
            drag = 0.5 * air_density * DRAG_COEFF * area * self.v ** 2
            a = gravity - drag / self.mass
        else:
            a = gravity

        # Midpoint step: accurate and identical for both objects in vacuum
        self.y -= (self.v + 0.5 * a * dt) * dt
        self.v += a * dt

        if self.y <= 0.0:
            self.y = 0.0
            self.landed = True


class Chart:
    """A small line chart drawn with pygame primitives.

    Hairline solid grid, 2px lines, >=8px end markers with a surface ring, a
    legend whenever two series are plotted, and direct labels only at the line
    ends - never a number on every point.
    """

    PAD_LEFT, PAD_RIGHT = 58, 66
    PAD_TOP, PAD_BOTTOM = 64, 64

    def __init__(self, rect, title, x_label):
        self.rect = pygame.Rect(rect)
        self.title = title      # carries the y unit, so it cannot clash
        self.x_label = x_label  # with the legend row above the plot

    @property
    def plot(self):
        return pygame.Rect(
            self.rect.x + self.PAD_LEFT,
            self.rect.y + self.PAD_TOP,
            self.rect.width - self.PAD_LEFT - self.PAD_RIGHT,
            self.rect.height - self.PAD_TOP - self.PAD_BOTTOM,
        )

    def to_px(self, x, y, x_max, y_max):
        plot = self.plot
        px = plot.x + (x / x_max if x_max else 0) * plot.width
        py = plot.bottom - (y / y_max if y_max else 0) * plot.height
        return int(px), int(py)

    def draw(self, screen, fonts, series, x_max, x_step, y_max, y_step, note=None):
        plot = self.plot

        pygame.draw.rect(screen, CHART_SURFACE, self.rect, border_radius=10)
        pygame.draw.rect(screen, CHART_BORDER, self.rect, 1, border_radius=10)

        title = fonts["body"].render(self.title, True, INK_PRIMARY)
        screen.blit(title, (self.rect.x + 18, self.rect.y + 14))

        self._draw_legend(screen, fonts, series)
        self._draw_grid(screen, fonts, x_max, x_step, y_max, y_step)

        # Series, heaviest line first so a thinner one stays visible on top
        for spec in series:
            points = [self.to_px(x, y, x_max, y_max) for x, y in spec["points"]]
            if len(points) > 1:
                pygame.draw.lines(screen, spec["color"], False, points,
                                  spec.get("width", 2))

        self._draw_ends(screen, fonts, series, x_max, y_max)

        if note:
            surf = fonts["tiny"].render(note, True, INK_SECONDARY)
            screen.blit(surf, (self.rect.x + 18, self.rect.bottom - 20))

    def _draw_legend(self, screen, fonts, series):
        """A legend is always present for two or more series."""
        if len(series) < 2:
            return
        x = self.rect.x + 18
        y = self.rect.y + 40
        for spec in series:
            pygame.draw.line(screen, spec["color"], (x, y + 7), (x + 16, y + 7),
                             spec.get("width", 2))
            label = fonts["tiny"].render(spec["label"], True, INK_SECONDARY)
            screen.blit(label, (x + 23, y))
            x += 23 + label.get_width() + 20

    def _draw_grid(self, screen, fonts, x_max, x_step, y_max, y_step):
        plot = self.plot

        # Horizontal gridlines carry the values that are not directly labelled
        value = 0.0
        while value <= y_max + 1e-9:
            _, py = self.to_px(0, value, x_max, y_max)
            if value > 0:
                pygame.draw.line(screen, CHART_GRID,
                                 (plot.x, py), (plot.right, py), 1)
            label = fonts["tiny"].render(f"{value:g}", True, INK_MUTED)
            screen.blit(label, (plot.x - 10 - label.get_width(),
                                py - label.get_height() // 2))
            value += y_step

        pygame.draw.line(screen, CHART_AXIS,
                         (plot.x, plot.y), (plot.x, plot.bottom), 1)
        pygame.draw.line(screen, CHART_AXIS,
                         (plot.x, plot.bottom), (plot.right, plot.bottom), 1)

        value = 0.0
        while value <= x_max + 1e-9:
            px, _ = self.to_px(value, 0, x_max, y_max)
            pygame.draw.line(screen, CHART_AXIS,
                             (px, plot.bottom), (px, plot.bottom + 4), 1)
            label = fonts["tiny"].render(f"{value:g}", True, INK_MUTED)
            screen.blit(label, (px - label.get_width() // 2, plot.bottom + 8))
            value += x_step

        x_unit = fonts["tiny"].render(self.x_label, True, INK_SECONDARY)
        screen.blit(x_unit, (plot.centerx - x_unit.get_width() // 2,
                             plot.bottom + 26))

    def _draw_ends(self, screen, fonts, series, x_max, y_max):
        """End markers plus direct labels, with leader lines if they collide."""
        ends = []
        for spec in series:
            if not spec["points"]:
                continue
            x, y = spec["points"][-1]
            px, py = self.to_px(x, y, x_max, y_max)
            pygame.draw.circle(screen, CHART_SURFACE, (px, py), 7)
            pygame.draw.circle(screen, spec["color"], (px, py), 5)
            if spec.get("end_text"):
                ends.append({"px": px, "py": py, "text": spec["end_text"],
                             "color": spec["color"]})

        if not ends:
            return

        # Two identical values land on the same pixel: one shared label is
        # honest and readable, where two stacked labels would just be noise.
        if len(ends) == 2 and ends[0]["text"] == ends[1]["text"]:
            e = ends[0]
            label = fonts["small"].render(e["text"], True, INK_PRIMARY)
            screen.blit(label, (self._label_x(e["px"], label.get_width()),
                                e["py"] - label.get_height() // 2))
            return

        ends.sort(key=lambda e: e["py"])
        placed = []
        for e in ends:
            label = fonts["small"].render(e["text"], True, INK_PRIMARY)
            ly = e["py"] - label.get_height() // 2
            for prev in placed:
                if abs(ly - prev) < label.get_height() + 2:
                    ly = prev + label.get_height() + 2
            placed.append(ly)
            lx = self._label_x(e["px"], label.get_width())
            anchor_y = ly + label.get_height() // 2
            if abs(anchor_y - e["py"]) > 3:
                # Leader line keeps a nudged label attached to its own line
                side = 6 if lx > e["px"] else -6
                pygame.draw.line(screen, e["color"], (e["px"] + side, e["py"]),
                                 (lx + (0 if side > 0 else label.get_width()),
                                  anchor_y), 1)
            screen.blit(label, (lx, ly))

    def _label_x(self, px, label_width):
        """Keep a direct label inside the card: flip it left if it would spill."""
        if px + 14 + label_width > self.rect.right - 10:
            return px - 14 - label_width
        return px + 14


class FreeFallSimulation:
    """Main simulation class"""
    def __init__(self):
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Free Fall Simulation - does mass matter?")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 24)
        self.small_font = pygame.font.Font(None, 20)
        self.big_font = pygame.font.Font(None, 34)
        self.huge_font = pygame.font.Font(None, 46)
        self.tiny_font = pygame.font.Font(None, 18)
        self.chart_fonts = {"body": self.font, "small": self.small_font,
                            "tiny": self.tiny_font}

        # Drop area geometry
        self.panel_width = 360
        self.drop_right = 1040          # sky/ground stop here; charts follow
        self.ground_y = HEIGHT - 90
        self.top_y = 150
        self.lane_a_x = self.panel_width + 270
        self.lane_b_x = self.panel_width + 520

        # Charts. Two separate plots, each with a single y-axis - a velocity
        # and a distance scale must never share one axis.
        chart_x, chart_w = self.drop_right + 12, WIDTH - self.drop_right - 28
        self.speed_time_chart = Chart(
            (chart_x, 70, chart_w, 378),
            "Speed (m/s) as time passes", "time (s)")
        self.speed_height_chart = Chart(
            (chart_x, 466, chart_w, 378),
            "Speed (m/s) after falling a distance", "distance fallen (m)")
        self.axis = {"t": 1.0, "t_step": 0.5, "v": 1.0, "v_step": 0.5,
                     "h": 1.0, "h_step": 0.5}
        self._axis_key = None

        # Physics parameters
        self.selected_planet = 0
        self.gravity = PLANETS[0]["g"]
        self.drop_height = 20.0
        self.air_resistance = False
        self.sim_speed = 1.0
        self.time = 0.0
        self.dropping = False
        self.paused = False
        self.next_strobe = STROBE_INTERVAL

        # Planet buttons (top centre, as in the other simulations)
        BTN_W, BTN_H, BTN_GAP = 110, 40, 18
        total_w = len(PLANETS) * BTN_W + (len(PLANETS) - 1) * BTN_GAP
        bx0 = (self.panel_width + self.drop_right) // 2 - total_w // 2
        self.planet_buttons = [
            pygame.Rect(bx0 + i * (BTN_W + BTN_GAP), 25, BTN_W, BTN_H)
            for i in range(len(PLANETS))
        ]

        # Sliders
        self.height_slider = Slider(40, 90, 300, HEIGHT_MIN, HEIGHT_MAX,
                                    self.drop_height, "Height", "m", GREEN)
        self.mass_a_slider = Slider(40, 175, 300, MASS_MIN, MASS_MAX, 1.0,
                                    "Mass - light ball", "kg", BLUE)
        self.mass_b_slider = Slider(40, 250, 300, MASS_MIN, MASS_MAX, 20.0,
                                    "Mass - heavy ball", "kg", RED)

        # Buttons
        self.drop_button = Button(40, 300, 130, 42, "DROP", GREEN)
        self.reset_button = Button(180, 300, 90, 42, "RESET", ORANGE)
        self.pause_button = Button(280, 300, 90, 42, "PAUSE", YELLOW)
        self.air_button = Button(40, 355, 230, 38, "AIR RESISTANCE: OFF", GRAY)

        # The two objects
        self.ball_a = FallingObject(self.mass_a_slider.value, BLUE)
        self.ball_b = FallingObject(self.mass_b_slider.value, RED)
        self.reset()

    # ---------- physics helpers ----------

    def air_density(self):
        """Air density actually acting on the balls: zero unless the switch is
        on AND the selected world has an atmosphere."""
        if not self.air_resistance:
            return 0.0
        return PLANETS[self.selected_planet]["air"]

    def has_air(self):
        return self.air_density() > 0.0

    def predicted_time(self):
        """t = sqrt(2h/g) - the vacuum free-fall time."""
        return math.sqrt(2.0 * self.drop_height / self.gravity)

    def predicted_impact_speed(self):
        """v = sqrt(2gh) = g·t"""
        return math.sqrt(2.0 * self.gravity * self.drop_height)

    def _compute_axes(self):
        """Fix the chart axes before the drop, so they never rescale mid-fall.

        Both cases have a closed form, so a slider drag stays cheap.
        """
        key = (self.gravity, round(self.drop_height, 4), self.air_density(),
               round(self.ball_a.mass, 4), round(self.ball_b.mass, 4))
        if key == self._axis_key:
            return
        self._axis_key = key

        if not self.has_air():
            t_end = self.predicted_time()
            v_peak = self.predicted_impact_speed()
        else:
            results = [air_fall_exact(mass, self.gravity, self.drop_height,
                                      self.air_density())
                       for mass in (self.ball_a.mass, self.ball_b.mass)]
            t_end = max(t for t, _ in results)
            v_peak = max(v for _, v in results)

        self.axis["t"], self.axis["t_step"] = axis_max(t_end)
        self.axis["v"], self.axis["v_step"] = axis_max(v_peak)
        self.axis["h"], self.axis["h_step"] = axis_max(self.drop_height)

    def scale(self):
        """Pixels per metre, so the whole drop height fits the screen."""
        return (self.ground_y - self.top_y) / self.drop_height

    def screen_y(self, height_m):
        return self.ground_y - height_m * self.scale()

    def scene_ink(self):
        """Readable ink colour for labels drawn over the sky (dark on Luna)."""
        r, g, b = PLANETS[self.selected_planet]["sky"]
        brightness = 0.299 * r + 0.587 * g + 0.114 * b
        return DARK_GRAY if brightness > 128 else (225, 225, 235)

    # ---------- control ----------

    def reset(self):
        self.time = 0.0
        self.dropping = False
        self.paused = False
        self.pause_button.text = "PAUSE"
        self.next_strobe = STROBE_INTERVAL
        self.next_sample = SAMPLE_INTERVAL
        self.ball_a.mass = self.mass_a_slider.value
        self.ball_b.mass = self.mass_b_slider.value
        self.ball_a.reset(self.drop_height)
        self.ball_b.reset(self.drop_height)
        self._compute_axes()

    def drop(self):
        if not self.dropping:
            self.reset()
            self.dropping = True

    def toggle_pause(self):
        if self.dropping:
            self.paused = not self.paused
            self.pause_button.text = "RESUME" if self.paused else "PAUSE"

    def toggle_air(self):
        self.air_resistance = not self.air_resistance
        self.air_button.text = f"AIR RESISTANCE: {'ON' if self.air_resistance else 'OFF'}"
        self.air_button.color = ORANGE if self.air_resistance else GRAY
        self.reset()

    def select_planet(self, index):
        self.selected_planet = index
        self.gravity = PLANETS[index]["g"]
        self.reset()

    # ---------- update ----------

    def update(self, frame_dt):
        if not self.dropping or self.paused:
            return

        dt = frame_dt * self.sim_speed
        # Sub-step so fast falls stay accurate
        substeps = max(1, int(dt / 0.002) + 1)
        h = dt / substeps
        for _ in range(substeps):
            was_landed_a, was_landed_b = self.ball_a.landed, self.ball_b.landed
            air = self.air_density()
            self.ball_a.update(h, self.gravity, air)
            self.ball_b.update(h, self.gravity, air)
            self.time += h
            if self.ball_a.landed and not was_landed_a:
                self.ball_a.land_time = self.time
                self.ball_a.samples.append((self.time, self.ball_a.v,
                                            self.drop_height))
            if self.ball_b.landed and not was_landed_b:
                self.ball_b.land_time = self.time
                self.ball_b.samples.append((self.time, self.ball_b.v,
                                            self.drop_height))

        if self.time >= self.next_sample:
            for ball in (self.ball_a, self.ball_b):
                if not ball.landed:
                    ball.samples.append((self.time, ball.v,
                                         self.drop_height - ball.y))
            self.next_sample = self.time + SAMPLE_INTERVAL

        while self.time >= self.next_strobe:
            for ball in (self.ball_a, self.ball_b):
                if not ball.landed:
                    ball.strobes.append(ball.y)
            self.next_strobe += STROBE_INTERVAL

        if self.ball_a.landed and self.ball_b.landed:
            self.dropping = False

    # ---------- drawing ----------

    def draw_planet_buttons(self):
        for i, (rect, planet) in enumerate(zip(self.planet_buttons, PLANETS)):
            active = (i == self.selected_planet)
            color = planet["color"] if active else BTN_INACTIVE
            pygame.draw.rect(self.screen, color, rect, border_radius=8)
            pygame.draw.rect(self.screen, BTN_BORDER, rect, 2, border_radius=8)
            label = self.font.render(planet["name"], True,
                                     BTN_TEXT if active else TEXT_COLOR)
            self.screen.blit(label, label.get_rect(center=rect.center))

    def draw_panel(self):
        pygame.draw.rect(self.screen, LIGHT_GRAY, (0, 0, self.panel_width, HEIGHT))
        pygame.draw.line(self.screen, DARK_GRAY,
                         (self.panel_width, 0), (self.panel_width, HEIGHT), 2)

        title = self.big_font.render("Free Fall", True, TEXT_COLOR)
        self.screen.blit(title, (40, 35))

        self.height_slider.draw(self.screen, self.font)
        self.mass_a_slider.draw(self.screen, self.font)
        self.mass_b_slider.draw(self.screen, self.font)
        self.drop_button.draw(self.screen, self.font)
        self.reset_button.draw(self.screen, self.font)
        self.pause_button.draw(self.screen, self.font)
        self.air_button.draw(self.screen, self.font)

        # Ratio of the two masses - makes the point concrete
        heavy = max(self.ball_a.mass, self.ball_b.mass)
        light = min(self.ball_a.mass, self.ball_b.mass)
        if self.air_resistance:
            note = PLANETS[self.selected_planet]["air_note"]
            color = ORANGE if self.has_air() else GREEN
            self.screen.blit(self.tiny_font.render(note, True, color), (40, 398))

        ratio_text = self.tiny_font.render(
            f"The heavy ball is {heavy / light:.1f}x heavier.", True, DARK_GRAY)
        self.screen.blit(ratio_text, (40, 416))

        self.draw_prediction_box()
        self.draw_results_box()

        controls = [
            "SPACE: drop / pause      R: reset",
            "A: air resistance      1/2/3: planet",
            "+ / -: simulation speed",
        ]
        for i, line in enumerate(controls):
            surf = self.small_font.render(line, True, DARK_GRAY)
            self.screen.blit(surf, (40, HEIGHT - 80 + i * 22))

    def draw_prediction_box(self):
        box = pygame.Rect(30, 440, 320, 130)
        pygame.draw.rect(self.screen, WHITE, box, border_radius=8)
        pygame.draw.rect(self.screen, DARK_GRAY, box, 2, border_radius=8)

        planet = PLANETS[self.selected_planet]
        lines = [
            (self.font, "The prediction", TEXT_COLOR),
            (self.small_font, f"g = {self.gravity:.2f} m/s^2   on {planet['name']}",
             planet["panel"]),
            (self.small_font, f"t = sqrt(2h / g) = sqrt(2 x {self.drop_height:.1f} / "
                              f"{self.gravity:.2f})", TEXT_COLOR),
            (self.big_font, f"t = {self.predicted_time():.2f} s", GREEN),
            (self.small_font,
             f"impact speed = {self.predicted_impact_speed():.1f} m/s", TEXT_COLOR),
        ]
        y = box.y + 10
        for font, text, color in lines:
            surf = font.render(text, True, color)
            self.screen.blit(surf, (box.x + 14, y))
            y += surf.get_height() + 4

        if self.has_air():
            warn = self.small_font.render("(air is ON - formula no longer exact)",
                                          True, ORANGE)
            self.screen.blit(warn, (box.x + 14, box.bottom - 22))

    def draw_results_box(self):
        box = pygame.Rect(30, 585, 320, 175)
        pygame.draw.rect(self.screen, WHITE, box, border_radius=8)
        pygame.draw.rect(self.screen, DARK_GRAY, box, 2, border_radius=8)

        title = self.font.render("What actually happened", True, TEXT_COLOR)
        self.screen.blit(title, (box.x + 14, box.y + 10))

        clock_text = self.big_font.render(f"clock: {self.time:.2f} s", True, TEXT_COLOR)
        self.screen.blit(clock_text, (box.x + 14, box.y + 38))

        y = box.y + 78
        for ball, slider in ((self.ball_a, self.mass_a_slider),
                             (self.ball_b, self.mass_b_slider)):
            if ball.land_time is not None:
                text = f"{ball.mass:.1f} kg landed at {ball.land_time:.2f} s"
            elif self.dropping or self.time > 0:
                text = f"{ball.mass:.1f} kg  falling - {ball.v:.1f} m/s"
            else:
                text = f"{ball.mass:.1f} kg  ready"
            surf = self.small_font.render(text, True, ball.color)
            self.screen.blit(surf, (box.x + 14, y))
            y += 24

        if self.ball_a.land_time is not None and self.ball_b.land_time is not None:
            gap = abs(self.ball_a.land_time - self.ball_b.land_time)
            if gap >= 0.02:
                msg, color = f"difference: {gap:.2f} s (that is the air!)", ORANGE
            elif self.has_air():
                msg, color = "same to 1/100 s - the air here is thin", GREEN
            else:
                msg, color = "SAME TIME - mass does not matter!", GREEN
            surf = self.small_font.render(msg, True, color)
            self.screen.blit(surf, (box.x + 14, y + 6))

    def draw_scene(self):
        planet = PLANETS[self.selected_planet]
        # Sky
        scene_w = self.drop_right - self.panel_width
        pygame.draw.rect(self.screen, planet["sky"],
                         (self.panel_width, 0, scene_w, self.ground_y))
        # Ground
        pygame.draw.rect(self.screen, planet["ground"],
                         (self.panel_width, self.ground_y,
                          scene_w, HEIGHT - self.ground_y))
        pygame.draw.line(self.screen, BLACK, (self.panel_width, self.ground_y),
                         (self.drop_right, self.ground_y), 3)

        self.draw_ruler()
        self.draw_ball(self.ball_a, self.lane_a_x)
        self.draw_ball(self.ball_b, self.lane_b_x)
        self.draw_finish_banner()

    def draw_ruler(self):
        """Vertical height scale with labelled ticks."""
        x = self.panel_width + 120
        ink = self.scene_ink()
        pygame.draw.line(self.screen, ink, (x, self.top_y), (x, self.ground_y), 2)

        # Choose a tick spacing that gives a handful of labels
        for step in (1, 2, 5, 10, 20, 25, 50, 100):
            if self.drop_height / step <= 10:
                break

        mark = 0.0
        while mark <= self.drop_height + 1e-9:
            y = self.screen_y(mark)
            pygame.draw.line(self.screen, ink, (x - 8, y), (x + 8, y), 2)
            label = self.small_font.render(f"{mark:g} m", True, ink)
            # Lift the ground label so it does not straddle the ground line
            label_y = y - label.get_height() // 2 - (10 if mark == 0 else 0)
            self.screen.blit(label, (x - 14 - label.get_width(), label_y))
            mark += step

        # Dashed line marking the release height across both lanes
        top = self.screen_y(self.drop_height)
        for dash_x in range(x, self.drop_right - 20, 24):
            pygame.draw.line(self.screen, ink, (dash_x, top), (dash_x + 12, top), 1)
        release = self.small_font.render(f"release height {self.drop_height:.1f} m",
                                        True, ink)
        self.screen.blit(release, (x + 20, top - 22))

    def draw_ball(self, ball, lane_x):
        radius = ball.draw_radius()
        ink = self.scene_ink()

        # The ball's *bottom* sits at its height, so it rests on the ground at y = 0
        def centre_y(height_m):
            return self.screen_y(height_m) - radius

        # Strobe trail: one outline every STROBE_INTERVAL seconds.
        # Growing gaps between outlines = the object is speeding up.
        last_label_y = None
        for i, h in enumerate(ball.strobes):
            y = centre_y(h)
            ghost = tuple(min(255, c + 90) for c in ball.color)
            pygame.draw.circle(self.screen, ghost, (lane_x, int(y)), radius, 1)
            if i == 0:
                continue
            tick = self.small_font.render(f"{i * STROBE_INTERVAL:.2f}s", True, ink)
            label_y = y - tick.get_height() // 2
            # Skip a timestamp that would sit on top of the previous one:
            # on a slow fall the early flashes are only a few pixels apart.
            if last_label_y is not None and \
                    abs(label_y - last_label_y) < tick.get_height() + 2:
                continue
            last_label_y = label_y
            self.screen.blit(tick, (lane_x + radius + 8, label_y))

        y = centre_y(ball.y)
        pygame.draw.circle(self.screen, ball.color, (lane_x, int(y)), radius)
        pygame.draw.circle(self.screen, BLACK, (lane_x, int(y)), radius, 2)

        # Mass label under the lane
        label = self.font.render(f"{ball.mass:.1f} kg", True, ball.color)
        self.screen.blit(label, (lane_x - label.get_width() // 2, HEIGHT - 60))

        # Live speed next to the ball while it is in the air
        if not ball.landed and self.time > 0:
            speed = self.small_font.render(f"{ball.v:.1f} m/s", True, ink)
            self.screen.blit(speed, (lane_x - radius - 10 - speed.get_width(),
                                     y - speed.get_height() // 2))

    def draw_finish_banner(self):
        if self.ball_a.land_time is None or self.ball_b.land_time is None:
            return

        gap = abs(self.ball_a.land_time - self.ball_b.land_time)
        if gap >= 0.02:
            text, color = f"{gap:.2f} s apart", ORANGE
        elif self.has_air():
            text, color = "ALMOST THE SAME!", GREEN
        else:
            text, color = "SAME TIME!", GREEN

        surf = self.huge_font.render(text, True, color)
        cx = (self.lane_a_x + self.lane_b_x) // 2
        box = surf.get_rect(center=(cx, self.top_y - 50))
        pygame.draw.rect(self.screen, WHITE, box.inflate(30, 18), border_radius=8)
        pygame.draw.rect(self.screen, color, box.inflate(30, 18), 3, border_radius=8)
        self.screen.blit(surf, box)

    def _series(self, value_index, x_index):
        """Build the chart series: heavy line first, light line on top of it.

        In a vacuum the two curves are identical and sit on exactly the same
        pixels. Drawing the heavy ball with a fatter line and the light ball
        thinner on top of it keeps both visible - otherwise the second series
        simply hides the first and looks like a missing line.
        """
        heavy, light = self.ball_b, self.ball_a
        if heavy.mass < light.mass:
            heavy, light = light, heavy

        series = []
        if self.has_air():
            # With air on, the no-air prediction becomes real context: it shows
            # how far each ball now falls short of it.
            g, h = self.gravity, self.drop_height
            ideal = []
            steps = 40
            for i in range(steps + 1):
                t = self.predicted_time() * i / steps
                v = g * t
                fallen = 0.5 * g * t * t
                ideal.append((t if x_index == 0 else fallen, v))
            series.append({"points": ideal, "color": INK_MUTED, "width": 1,
                           "label": "no air (prediction)"})

        for ball, width in ((heavy, 5), (light, 2)):
            points = [(sample[x_index], sample[value_index])
                      for sample in ball.samples]
            series.append({
                "points": points,
                "color": ball.color,
                "width": width,
                "label": f"{ball.mass:.1f} kg",
                "end_text": f"{ball.v:.1f} m/s",
            })
        return series

    def _chart_note(self):
        if self.time == 0.0:
            return "Press DROP to draw the graphs."
        if self.air_resistance and not self.has_air():
            return "No atmosphere here, so the air switch changes nothing."
        if self.has_air():
            return "Air on: the lighter ball flattens off at its top speed."
        if self.ball_a.landed and self.ball_b.landed:
            return "Both lines are exactly on top of each other."
        return "Watch one line: the other is hidden underneath it."

    def draw_charts(self):
        note = self._chart_note()
        # Speed vs time: a straight line, because the speed grows by the same
        # amount every second.
        self.speed_time_chart.draw(
            self.screen, self.chart_fonts, self._series(1, 0),
            self.axis["t"], self.axis["t_step"],
            self.axis["v"], self.axis["v_step"], note=note)
        # Speed vs distance fallen: a curve, because v = sqrt(2gh).
        self.speed_height_chart.draw(
            self.screen, self.chart_fonts, self._series(1, 2),
            self.axis["h"], self.axis["h_step"],
            self.axis["v"], self.axis["v_step"], note=note)

    def draw_status(self):
        ink = self.scene_ink()
        speed = self.small_font.render(f"speed: {self.sim_speed:.1f}x", True, ink)
        self.screen.blit(speed, (self.drop_right - 110, 35))
        if self.paused:
            surf = self.big_font.render("PAUSED", True, RED)
            self.screen.blit(surf, (self.drop_right - 145, 58))

    # ---------- events ----------

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False

            height_changed = self.height_slider.handle_event(event)
            mass_a_changed = self.mass_a_slider.handle_event(event)
            mass_b_changed = self.mass_b_slider.handle_event(event)
            mass_changed = mass_a_changed or mass_b_changed

            if height_changed:
                self.drop_height = self.height_slider.value
            if height_changed or mass_changed:
                # Changing the setup restarts the experiment
                self.reset()

            if self.drop_button.handle_event(event):
                self.drop()
            if self.reset_button.handle_event(event):
                self.reset()
            if self.pause_button.handle_event(event):
                self.toggle_pause()
            if self.air_button.handle_event(event):
                self.toggle_air()

            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                for i, rect in enumerate(self.planet_buttons):
                    if rect.collidepoint(event.pos) and i != self.selected_planet:
                        self.select_planet(i)

            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    if self.dropping:
                        self.toggle_pause()
                    else:
                        self.drop()
                elif event.key == pygame.K_r:
                    self.reset()
                elif event.key == pygame.K_a:
                    self.toggle_air()
                elif event.key in (pygame.K_EQUALS, pygame.K_PLUS):
                    self.sim_speed = min(4.0, self.sim_speed + 0.25)
                elif event.key == pygame.K_MINUS:
                    self.sim_speed = max(0.1, self.sim_speed - 0.25)
                elif event.key in (pygame.K_1, pygame.K_2, pygame.K_3):
                    self.select_planet(event.key - pygame.K_1)
                elif event.key == pygame.K_ESCAPE:
                    return False
        return True

    # ---------- main loop ----------

    def run(self, max_frames=None):
        running = True
        frames = 0
        while running:
            frame_dt = self.clock.tick(FPS) / 1000.0
            running = self.handle_events()
            self.update(frame_dt)

            self.screen.fill(WHITE)
            self.draw_scene()
            self.draw_panel()
            self.draw_planet_buttons()
            self.draw_status()
            self.draw_charts()
            pygame.display.flip()

            frames += 1
            if max_frames is not None and frames >= max_frames:
                running = False


if __name__ == "__main__":
    FreeFallSimulation().run()
    pygame.quit()
    sys.exit()
