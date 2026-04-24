"""
Spring-Powered Launcher Simulation
Demonstrates energy conversion from elastic potential to kinetic energy
and projectile motion with interactive controls.
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
RED = (255, 0, 0)
BLUE = (0, 100, 255)
GREEN = (0, 200, 0)
DARK_GREEN = (0, 150, 0)
YELLOW = (255, 255, 0)
GRAY = (200, 200, 200)
DARK_GRAY = (100, 100, 100)
LIGHT_BLUE = (173, 216, 230)
ORANGE = (255, 165, 0)
PURPLE = (150, 0, 200)

# Physics constants
SCALE = 30  # pixels per meter

# Planets
PLANETS = [
    {"name": "Terra", "g": 9.81, "sky": (220, 235, 255), "color": (30, 100, 200)},
    {"name": "Marte", "g": 3.72, "sky": (240, 210, 185), "color": (180, 60,  20)},
    {"name": "Luna",  "g": 1.62, "sky": (180, 180, 200), "color": (100, 100, 120)},
]
selected_planet = 0
GRAVITY = PLANETS[selected_planet]["g"]

class Slider:
    """Interactive slider for parameter control"""
    def __init__(self, x, y, width, min_val, max_val, initial_val, label):
        self.rect = pygame.Rect(x, y, width, 10)
        self.min_val = min_val
        self.max_val = max_val
        self.value = initial_val
        self.label = label
        self.dragging = False
        self.handle_radius = 8
        
    def draw(self, screen, font):
        # Draw slider track
        pygame.draw.rect(screen, GRAY, self.rect)
        pygame.draw.rect(screen, DARK_GRAY, self.rect, 2)
        
        # Draw handle
        handle_x = self.rect.x + (self.value - self.min_val) / (self.max_val - self.min_val) * self.rect.width
        pygame.draw.circle(screen, BLUE, (int(handle_x), self.rect.centery), self.handle_radius)
        pygame.draw.circle(screen, DARK_GRAY, (int(handle_x), self.rect.centery), self.handle_radius, 2)
        
        # Draw label and value
        label_surface = font.render(f"{self.label}: {self.value:.2f}", True, BLACK)
        screen.blit(label_surface, (self.rect.x, self.rect.y - 25))
        
    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            mouse_pos = pygame.mouse.get_pos()
            handle_x = self.rect.x + (self.value - self.min_val) / (self.max_val - self.min_val) * self.rect.width
            distance = math.sqrt((mouse_pos[0] - handle_x)**2 + (mouse_pos[1] - self.rect.centery)**2)
            if distance <= self.handle_radius:
                self.dragging = True
                
        elif event.type == pygame.MOUSEBUTTONUP:
            self.dragging = False
            
        elif event.type == pygame.MOUSEMOTION and self.dragging:
            mouse_x = event.pos[0]
            # Clamp to slider bounds
            mouse_x = max(self.rect.x, min(mouse_x, self.rect.x + self.rect.width))
            # Calculate value
            ratio = (mouse_x - self.rect.x) / self.rect.width
            self.value = self.min_val + ratio * (self.max_val - self.min_val)

class Button:
    """Interactive button"""
    def __init__(self, x, y, width, height, text, color):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.color = color
        self.hover = False
        
    def draw(self, screen, font):
        color = tuple(min(c + 30, 255) for c in self.color) if self.hover else self.color
        pygame.draw.rect(screen, color, self.rect, border_radius=5)
        pygame.draw.rect(screen, BLACK, self.rect, 2, border_radius=5)
        
        text_surface = font.render(self.text, True, BLACK)
        text_rect = text_surface.get_rect(center=self.rect.center)
        screen.blit(text_surface, text_rect)
        
    def handle_event(self, event):
        if event.type == pygame.MOUSEMOTION:
            self.hover = self.rect.collidepoint(event.pos)
        elif event.type == pygame.MOUSEBUTTONDOWN:
            if self.hover:
                return True
        return False

class Projectile:
    """Ball projectile with physics"""
    def __init__(self, x, y, vx, vy, mass, radius):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.mass = mass
        self.radius = radius
        self.trail = []
        self.max_trail_length = 100
        self.total_distance = 0.0  # Total path distance traveled
        self.prev_x = x
        self.prev_y = y
        
    def update(self, dt, gravity=9.81):
        # Update velocity (gravity pulls downward, so subtract)
        self.vy -= gravity * dt
        
        # Update position
        self.x += self.vx * dt
        self.y += self.vy * dt
        
        # Calculate distance traveled (arc length along path)
        dx = self.x - self.prev_x
        dy = self.y - self.prev_y
        distance_increment = math.sqrt(dx**2 + dy**2)
        self.total_distance += distance_increment
        self.prev_x = self.x
        self.prev_y = self.y
        
        # Store trail
        self.trail.append((self.x, self.y))
        if len(self.trail) > self.max_trail_length:
            self.trail.pop(0)
            
    def draw(self, screen, origin_x, origin_y):
        # Draw trail
        if len(self.trail) > 1:
            for i in range(len(self.trail) - 1):
                alpha = int(255 * (i / len(self.trail)))
                color = (255, alpha, 0)
                start = (int(origin_x + self.trail[i][0] * SCALE), 
                        int(origin_y - self.trail[i][1] * SCALE))
                end = (int(origin_x + self.trail[i+1][0] * SCALE), 
                      int(origin_y - self.trail[i+1][1] * SCALE))
                pygame.draw.line(screen, color, start, end, 2)
        
        # Draw ball
        screen_x = int(origin_x + self.x * SCALE)
        screen_y = int(origin_y - self.y * SCALE)
        pygame.draw.circle(screen, RED, (screen_x, screen_y), int(self.radius * SCALE))
        pygame.draw.circle(screen, BLACK, (screen_x, screen_y), int(self.radius * SCALE), 2)

class SpringLauncher:
    """Main simulation class"""
    def __init__(self):
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Spring-Powered Launcher Simulation")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 24)
        self.title_font = pygame.font.Font(None, 36)
        
        # Origin point (launcher position)
        self.origin_x = 150
        self.origin_y = 650
        
        # Physics parameters
        self.spring_constant = 500.0  # N/m
        self.compression = 0.5  # meters
        self.angle = 45.0  # degrees
        self.ball_mass = 0.5  # kg
        self.ball_radius = 0.3  # meters
        
        # Planet selector
        self.selected_planet = 0
        self.gravity = PLANETS[self.selected_planet]["g"]
        BTN_W, BTN_H, BTN_GAP = 100, 36, 15
        total_w = len(PLANETS) * BTN_W + (len(PLANETS) - 1) * BTN_GAP
        bx0 = WIDTH // 2 - total_w // 2
        self.planet_buttons = [
            pygame.Rect(bx0 + i * (BTN_W + BTN_GAP), 10, BTN_W, BTN_H)
            for i in range(len(PLANETS))
        ]

        # UI elements
        self.compression_slider = Slider(50, 80, 300, 0.1, 2.0, self.compression, "Compression (m)")
        self.angle_slider = Slider(50, 130, 300, 0, 90, self.angle, "Angle (°)")
        self.stiffness_slider = Slider(50, 180, 300, 100, 1000, self.spring_constant, "Spring K (N/m)")
        self.launch_button = Button(50, 230, 120, 40, "LAUNCH", GREEN)
        self.reset_button = Button(180, 230, 120, 40, "RESET", ORANGE)
        self.pause_button = Button(310, 230, 120, 40, "PAUSE", YELLOW)
        
        # Simulation state
        self.projectile = None
        self.launched = False
        self.paused = False
        self.finished = False  # Track when ball has stopped
        self.time = 0
        self.dt = 1/FPS
        
        # Energy tracking
        self.energy_history = []
        self.max_energy_history = 200
        
        # Velocity tracking
        self.velocity_history = []
        self.max_velocity_history = 200
        
    def calculate_launch_velocity(self):
        """Calculate initial velocity from spring energy"""
        # Elastic potential energy: E = 0.5 * k * x^2
        spring_energy = 0.5 * self.spring_constant * self.compression**2

        # Convert to kinetic energy: E = 0.5 * m * v^2
        # Solve for v: v = sqrt(2 * E / m)
        v = math.sqrt(2 * spring_energy / self.ball_mass)

        # Convert angle to radians
        angle_rad = math.radians(self.angle)

        # Decompose velocity
        vx = v * math.cos(angle_rad)
        vy = v * math.sin(angle_rad)

        return vx, vy, v
        
    def launch(self):
        """Launch the projectile"""
        if not self.launched:
            vx, vy, v = self.calculate_launch_velocity()
            self.projectile = Projectile(0, 0, vx, vy, self.ball_mass, self.ball_radius)
            self.launched = True
            self.finished = False
            self.time = 0
            self.energy_history = []
            self.velocity_history = []
            
    def reset(self):
        """Reset the simulation"""
        self.projectile = None
        self.launched = False
        self.paused = False
        self.finished = False
        self.time = 0
        self.energy_history = []
        self.velocity_history = []
    
    def toggle_pause(self):
        """Toggle pause state"""
        if self.launched:
            self.paused = not self.paused
            # Update button text
            self.pause_button.text = "RESUME" if self.paused else "PAUSE"
        
    def draw_spring(self):
        """Draw the compressed spring"""
        angle_rad = math.radians(self.angle)
        
        # Spring rest length
        rest_length = 2.0 * SCALE  # pixels
        compressed_length = (2.0 - self.compression) * SCALE
        
        # Spring end point
        end_x = self.origin_x + compressed_length * math.cos(angle_rad)
        end_y = self.origin_y - compressed_length * math.sin(angle_rad)
        
        # Draw spring base
        base_size = 15
        pygame.draw.rect(screen, DARK_GRAY, 
                        (self.origin_x - base_size//2, self.origin_y - base_size//2, 
                         base_size, base_size))
        
        # Draw spring coils
        num_coils = 12
        coil_amplitude = 8
        
        points = []
        for i in range(num_coils * 4):
            t = i / (num_coils * 4)
            
            # Position along spring
            x = self.origin_x + t * compressed_length * math.cos(angle_rad)
            y = self.origin_y - t * compressed_length * math.sin(angle_rad)
            
            # Perpendicular offset for coil
            perp_offset = math.sin(i * math.pi / 2) * coil_amplitude
            x += perp_offset * math.sin(angle_rad)
            y += perp_offset * math.cos(angle_rad)
            
            points.append((int(x), int(y)))
        
        if len(points) > 1:
            pygame.draw.lines(screen, DARK_GREEN, False, points, 3)
        
        # Draw ball at end of spring if not launched
        if not self.launched:
            ball_x = end_x + self.ball_radius * SCALE * math.cos(angle_rad)
            ball_y = end_y - self.ball_radius * SCALE * math.sin(angle_rad)
            pygame.draw.circle(screen, RED, (int(ball_x), int(ball_y)), 
                             int(self.ball_radius * SCALE))
            pygame.draw.circle(screen, BLACK, (int(ball_x), int(ball_y)), 
                             int(self.ball_radius * SCALE), 2)
    
    def draw_predicted_trajectory(self):
        """Draw the predicted trajectory path"""
        if self.launched:
            return
            
        vx, vy, v = self.calculate_launch_velocity()
        
        points = []
        t = 0
        dt = 0.1
        
        for i in range(100):
            x = vx * t
            y = vy * t - 0.5 * self.gravity * t**2
            
            if y < -20:  # Stop if too far below ground
                break
                
            screen_x = int(self.origin_x + x * SCALE)
            screen_y = int(self.origin_y - y * SCALE)
            
            points.append((screen_x, screen_y))
            t += dt
        
        # Draw dotted line
        if len(points) > 1:
            for i in range(0, len(points) - 1, 3):
                if i + 1 < len(points):
                    pygame.draw.line(screen, LIGHT_BLUE, points[i], points[i+1], 2)
    
    def draw_ground(self):
        """Draw ground line"""
        pygame.draw.line(screen, BLACK, (0, self.origin_y), (WIDTH, self.origin_y), 3)
        
    def draw_energy_info(self):
        """Display energy information"""
        y_offset = 270
        
        # Calculate energies
        if not self.launched:
            spring_energy = 0.5 * self.spring_constant * self.compression**2
            kinetic_energy = 0
            potential_energy = 0
            vx, vy, v = self.calculate_launch_velocity()
        else:
            spring_energy = 0
            kinetic_energy = 0.5 * self.ball_mass * (self.projectile.vx**2 + self.projectile.vy**2)
            potential_energy = self.ball_mass * self.gravity * max(0, self.projectile.y)
            v = math.sqrt(self.projectile.vx**2 + self.projectile.vy**2)
        
        total_energy = spring_energy + kinetic_energy + potential_energy
        
        # Store energy for graphing (only when not paused and not finished)
        if self.launched and not self.paused and not self.finished:
            self.energy_history.append({
                'kinetic': kinetic_energy,
                'potential': potential_energy,
                'total': total_energy
            })
            if len(self.energy_history) > self.max_energy_history:
                self.energy_history.pop(0)
        
        # Calculate distances
        horizontal_distance = self.projectile.x if self.launched and self.projectile else 0
        total_distance = self.projectile.total_distance if self.launched and self.projectile else 0
        max_height = max((p[1] for p in self.projectile.trail), default=0) if self.launched and self.projectile and self.projectile.trail else 0
        
        # Display values
        info_lines = [
            f"Spring Energy: {spring_energy:.2f} J",
            f"Kinetic Energy: {kinetic_energy:.2f} J",
            f"Potential Energy: {potential_energy:.2f} J",
            f"Total Energy: {total_energy:.2f} J",
            f"Launch Velocity: {v:.2f} m/s" if not self.launched else f"Current Velocity: {v:.2f} m/s",
            f"Time: {self.time:.2f} s" if self.launched else "",
            f"Horizontal Distance: {horizontal_distance:.2f} m" if self.launched else "",
            f"Total Path Distance: {total_distance:.2f} m" if self.launched else "",
            f"Max Height: {max_height:.2f} m" if self.launched else ""
        ]
        
        for i, line in enumerate(info_lines):
            if line:
                surface = self.font.render(line, True, BLACK)
                screen.blit(surface, (50, y_offset + i * 30))
    
    def draw_energy_graph(self):
        """Draw energy vs time graph"""
        if not self.energy_history:
            return
            
        graph_x = 900
        graph_y = 50
        graph_width = 450
        graph_height = 250
        
        # Draw graph background
        pygame.draw.rect(screen, WHITE, (graph_x, graph_y, graph_width, graph_height))
        pygame.draw.rect(screen, BLACK, (graph_x, graph_y, graph_width, graph_height), 2)
        
        # Title
        title = self.font.render("Energy vs Time", True, BLACK)
        screen.blit(title, (graph_x + 10, graph_y + 10))
        
        # Find max energy for scaling
        max_energy = max(e['total'] for e in self.energy_history) * 1.1
        if max_energy == 0:
            max_energy = 1
        
        # Draw grid lines
        for i in range(5):
            y = graph_y + 40 + i * (graph_height - 50) / 4
            pygame.draw.line(screen, GRAY, (graph_x + 40, y), (graph_x + graph_width - 10, y), 1)
            label = self.font.render(f"{max_energy * (1 - i/4):.1f}", True, BLACK)
            screen.blit(label, (graph_x + 5, y - 10))
        
        # Draw energy lines
        if len(self.energy_history) > 1:
            # Kinetic energy (green)
            kinetic_points = []
            # Potential energy (blue)
            potential_points = []
            # Total energy (red)
            total_points = []
            
            for i, energy in enumerate(self.energy_history):
                x = graph_x + 40 + i * (graph_width - 50) / max(1, len(self.energy_history) - 1)
                
                ke_y = graph_y + 40 + (graph_height - 50) * (1 - energy['kinetic'] / max_energy)
                pe_y = graph_y + 40 + (graph_height - 50) * (1 - energy['potential'] / max_energy)
                te_y = graph_y + 40 + (graph_height - 50) * (1 - energy['total'] / max_energy)
                
                kinetic_points.append((x, ke_y))
                potential_points.append((x, pe_y))
                total_points.append((x, te_y))
            
            if len(kinetic_points) > 1:
                pygame.draw.lines(screen, GREEN, False, kinetic_points, 2)
            if len(potential_points) > 1:
                pygame.draw.lines(screen, BLUE, False, potential_points, 2)
            if len(total_points) > 1:
                pygame.draw.lines(screen, RED, False, total_points, 2)
        
        # Legend
        legend_x = graph_x + 10
        legend_y = graph_y + graph_height - 30
        
        pygame.draw.line(screen, GREEN, (legend_x, legend_y), (legend_x + 30, legend_y), 3)
        screen.blit(self.font.render("Kinetic", True, BLACK), (legend_x + 35, legend_y - 8))
        
        pygame.draw.line(screen, BLUE, (legend_x + 120, legend_y), (legend_x + 150, legend_y), 3)
        screen.blit(self.font.render("Potential", True, BLACK), (legend_x + 155, legend_y - 8))
        
        pygame.draw.line(screen, RED, (legend_x + 250, legend_y), (legend_x + 280, legend_y), 3)
        screen.blit(self.font.render("Total", True, BLACK), (legend_x + 285, legend_y - 8))
    
    def draw_velocity_graph(self):
        """Draw velocity vs time graph"""
        if not self.velocity_history:
            return
            
        graph_x = 900
        graph_y = 350
        graph_width = 450
        graph_height = 250
        
        # Draw graph background
        pygame.draw.rect(screen, WHITE, (graph_x, graph_y, graph_width, graph_height))
        pygame.draw.rect(screen, BLACK, (graph_x, graph_y, graph_width, graph_height), 2)
        
        # Title
        title = self.font.render("Velocity vs Time", True, BLACK)
        screen.blit(title, (graph_x + 10, graph_y + 10))
        
        # Find max velocity for scaling
        max_vel = 0
        min_vel = 0
        for v in self.velocity_history:
            max_vel = max(max_vel, v['vx'], v['vy'], v['total'])
            min_vel = min(min_vel, v['vx'], v['vy'])
        
        vel_range = max(abs(max_vel), abs(min_vel)) * 1.1
        if vel_range == 0:
            vel_range = 1
        
        # Draw horizontal axis (zero line)
        zero_y = graph_y + 40 + (graph_height - 50) * 0.5
        pygame.draw.line(screen, DARK_GRAY, (graph_x + 40, zero_y), 
                        (graph_x + graph_width - 10, zero_y), 2)
        
        # Draw grid lines
        for i in range(5):
            y = graph_y + 40 + i * (graph_height - 50) / 4
            pygame.draw.line(screen, GRAY, (graph_x + 40, y), (graph_x + graph_width - 10, y), 1)
            # Label
            vel_value = vel_range * (1 - i / 2)  # From +vel_range to -vel_range
            label = self.font.render(f"{vel_value:.1f}", True, BLACK)
            screen.blit(label, (graph_x + 5, y - 10))
        
        # Draw velocity lines
        if len(self.velocity_history) > 1:
            # Horizontal velocity (vx) - constant, shown in cyan
            vx_points = []
            # Vertical velocity (vy) - changes, shown in magenta
            vy_points = []
            # Total velocity (speed) - shown in purple
            total_points = []
            
            for i, vel in enumerate(self.velocity_history):
                x = graph_x + 40 + i * (graph_width - 50) / max(1, len(self.velocity_history) - 1)
                
                vx_y = zero_y - vel['vx'] / vel_range * (graph_height - 50) * 0.5
                vy_y = zero_y - vel['vy'] / vel_range * (graph_height - 50) * 0.5
                total_y = zero_y - vel['total'] / vel_range * (graph_height - 50) * 0.5
                
                vx_points.append((x, vx_y))
                vy_points.append((x, vy_y))
                total_points.append((x, total_y))
            
            if len(vx_points) > 1:
                pygame.draw.lines(screen, (0, 255, 255), False, vx_points, 2)  # Cyan for vx
            if len(vy_points) > 1:
                pygame.draw.lines(screen, (255, 0, 255), False, vy_points, 2)  # Magenta for vy
            if len(total_points) > 1:
                pygame.draw.lines(screen, PURPLE, False, total_points, 3)  # Purple for total
        
        # Legend
        legend_x = graph_x + 10
        legend_y = graph_y + graph_height - 30
        
        pygame.draw.line(screen, (0, 255, 255), (legend_x, legend_y), (legend_x + 30, legend_y), 3)
        screen.blit(self.font.render("vx (horizontal)", True, BLACK), (legend_x + 35, legend_y - 8))
        
        pygame.draw.line(screen, (255, 0, 255), (legend_x + 160, legend_y), (legend_x + 190, legend_y), 3)
        screen.blit(self.font.render("vy (vertical)", True, BLACK), (legend_x + 195, legend_y - 8))
        
        pygame.draw.line(screen, PURPLE, (legend_x + 310, legend_y), (legend_x + 340, legend_y), 3)
        screen.blit(self.font.render("Speed", True, BLACK), (legend_x + 345, legend_y - 8))
    
    def update(self):
        """Update simulation state"""
        # Update sliders
        self.compression = self.compression_slider.value
        self.angle = self.angle_slider.value
        self.spring_constant = self.stiffness_slider.value
        
        # Update projectile (only if not paused and not finished)
        if self.launched and self.projectile and not self.paused and not self.finished:
            self.projectile.update(self.dt, self.gravity)
            self.time += self.dt
            
            # Track velocity
            total_speed = math.sqrt(self.projectile.vx**2 + self.projectile.vy**2)
            self.velocity_history.append({
                'vx': self.projectile.vx,
                'vy': self.projectile.vy,
                'total': total_speed
            })
            if len(self.velocity_history) > self.max_velocity_history:
                self.velocity_history.pop(0)
            
            # Check if projectile hit ground or went off screen
            if self.projectile.y <= 0 or self.projectile.x > 50:
                # Keep it visible but stop updating
                if self.projectile.y <= 0:
                    self.projectile.y = 0
                    self.projectile.vy = 0
                    self.projectile.vx = 0
                    # Mark simulation as finished
                    self.finished = True
    
    def draw_planet_buttons(self):
        """Draw planet selector buttons at the top"""
        btn_font = pygame.font.Font(None, 26)
        for i, (rect, p) in enumerate(zip(self.planet_buttons, PLANETS)):
            active = (i == self.selected_planet)
            color = p["color"] if active else GRAY
            pygame.draw.rect(screen, color, rect, border_radius=7)
            pygame.draw.rect(screen, DARK_GRAY, rect, 2, border_radius=7)
            txt_color = WHITE if active else BLACK
            label = btn_font.render(p["name"], True, txt_color)
            screen.blit(label, label.get_rect(center=rect.center))

    def draw(self):
        """Draw everything"""
        sky = PLANETS[self.selected_planet]["sky"]
        screen.fill(sky)

        # Planet buttons
        self.draw_planet_buttons()

        # Gravity label
        g_color = PLANETS[self.selected_planet]["color"]
        g_text = self.font.render(
            f"{PLANETS[self.selected_planet]['name']}  —  g = {self.gravity:.2f} m/s²",
            True, g_color)
        screen.blit(g_text, (WIDTH // 2 - g_text.get_width() // 2, 52))

        # Draw sliders
        self.compression_slider.draw(screen, self.font)
        self.angle_slider.draw(screen, self.font)
        self.stiffness_slider.draw(screen, self.font)

        # Draw buttons
        self.launch_button.draw(screen, self.font)
        self.reset_button.draw(screen, self.font)
        self.pause_button.draw(screen, self.font)

        # Draw pause indicator
        if self.paused:
            pause_text = self.title_font.render("PAUZA", True, RED)
            screen.blit(pause_text, (WIDTH//2 - pause_text.get_width()//2, 280))

        # Draw finished indicator
        if self.finished:
            finished_text = self.title_font.render("GATA!", True, DARK_GREEN)
            screen.blit(finished_text, (WIDTH//2 - finished_text.get_width()//2, 280))
        
        # Draw energy info
        self.draw_energy_info()
        
        # Draw graphs
        self.draw_energy_graph()
        self.draw_velocity_graph()
        
        # Draw ground
        self.draw_ground()
        
        # Draw predicted trajectory
        self.draw_predicted_trajectory()
        
        # Draw spring and ball
        self.draw_spring()
        
        # Draw projectile
        if self.launched and self.projectile:
            self.projectile.draw(screen, self.origin_x, self.origin_y)
        
        pygame.display.flip()
    
    def run(self):
        """Main game loop"""
        running = True
        
        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                
                # Handle sliders
                self.compression_slider.handle_event(event)
                self.angle_slider.handle_event(event)
                self.stiffness_slider.handle_event(event)
                
                # Handle planet buttons
                if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    for i, rect in enumerate(self.planet_buttons):
                        if rect.collidepoint(event.pos) and i != self.selected_planet:
                            self.selected_planet = i
                            self.gravity = PLANETS[i]["g"]
                            self.reset()

                # Handle action buttons
                if self.launch_button.handle_event(event):
                    self.launch()
                if self.reset_button.handle_event(event):
                    self.reset()
                if self.pause_button.handle_event(event):
                    self.toggle_pause()
            
            self.update()
            self.draw()
            self.clock.tick(FPS)
        
        pygame.quit()
        sys.exit()

# Run simulation
if __name__ == "__main__":
    screen = None  # Will be created by SpringLauncher
    launcher = SpringLauncher()
    screen = launcher.screen
    launcher.run()
