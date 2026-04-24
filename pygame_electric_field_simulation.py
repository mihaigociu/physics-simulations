import pygame
import numpy as np
import sys

# Coulomb's constant
k = 8.99e9

class ElectricFieldSimulation:
    def __init__(self, width=1000, height=1000):
        pygame.init()
        self.width = width
        self.height = height
        self.screen = pygame.display.set_mode((width, height))
        pygame.display.set_caption("Charged Particle in Electric Field")
        self.clock = pygame.time.Clock()
        
        # Simulation parameters
        self.grid_size = 2  # Physical size of simulation space
        self.time_step = 0.05  # Time step for physics (increased for faster motion)
        self.updates_per_frame = 3  # Multiple updates per frame for speed
        self.running = True
        self.paused = False
        
        # Charges: (x, y, charge in Coulombs)
        self.charges = [
            (0, 0, 1e-9),
            (1, 1, -1e-9),
            (-1, -1, 1e-9)
        ]
        
        # Particle: x, y, charge, mass, vx, vy
        self.particle = {
            'x': 1.5,
            'y': 0.0,
            'q': 1e-9,
            'm': 1e-5,
            'vx': 0.0,
            'vy': 0.0
        }
        
        # Store initial state for reset
        self.initial_particle = self.particle.copy()
        
        # Trajectory history
        self.trajectory = []
        self.max_trajectory_points = 500
        
        # Field visualization
        self.show_field = True
        self.field_grid_resolution = 20
        self.field_vectors = self.calculate_field_grid()
        
    def calculate_field_grid(self):
        """Pre-calculate electric field vectors on a grid for visualization"""
        vectors = []
        step = (2 * self.grid_size) / self.field_grid_resolution
        
        for i in range(self.field_grid_resolution + 1):
            for j in range(self.field_grid_resolution + 1):
                x = -self.grid_size + i * step
                y = -self.grid_size + j * step
                
                Ex, Ey = self.total_electric_field_at_point((x, y))
                
                # Apply log scaling for visualization
                magnitude = np.sqrt(Ex**2 + Ey**2)
                if magnitude > 0:
                    log_mag = np.log1p(magnitude)
                    Ex_scaled = (Ex / magnitude) * log_mag * 0.1
                    Ey_scaled = (Ey / magnitude) * log_mag * 0.1
                else:
                    Ex_scaled, Ey_scaled = 0, 0
                
                vectors.append((x, y, Ex_scaled, Ey_scaled))
        
        return vectors
    
    def world_to_screen(self, x, y):
        """Convert world coordinates to screen coordinates"""
        screen_x = int((x + self.grid_size) / (2 * self.grid_size) * self.width)
        screen_y = int((self.grid_size - y) / (2 * self.grid_size) * self.height)
        return screen_x, screen_y
    
    def screen_to_world(self, screen_x, screen_y):
        """Convert screen coordinates to world coordinates"""
        x = (screen_x / self.width) * (2 * self.grid_size) - self.grid_size
        y = self.grid_size - (screen_y / self.height) * (2 * self.grid_size)
        return x, y
    
    def electric_field_from_charge(self, charge, point):
        """Calculate electric field at a point due to a single charge"""
        x_charge, y_charge, q = charge
        px, py = point
        
        dx = px - x_charge
        dy = py - y_charge
        r = np.sqrt(dx**2 + dy**2)
        
        if r < 1e-10:  # Avoid division by zero
            return 0, 0
        
        E_magnitude = k * q / r**2
        Ex = E_magnitude * dx / r
        Ey = E_magnitude * dy / r
        
        return Ex, Ey
    
    def total_electric_field_at_point(self, point):
        """Calculate total electric field at a point"""
        E_total_x, E_total_y = 0, 0
        for charge in self.charges:
            Ex, Ey = self.electric_field_from_charge(charge, point)
            E_total_x += Ex
            E_total_y += Ey
        return E_total_x, E_total_y
    
    def update_particle(self):
        """Update particle position and velocity"""
        if self.paused:
            return
        
        x = self.particle['x']
        y = self.particle['y']
        
        # Check bounds
        if abs(x) > self.grid_size or abs(y) > self.grid_size:
            self.paused = True
            print("Particle out of bounds!")
            return
        
        # Calculate electric field at particle position
        Ex, Ey = self.total_electric_field_at_point((x, y))
        
        # Calculate force
        Fx = self.particle['q'] * Ex
        Fy = self.particle['q'] * Ey
        
        # Calculate acceleration
        ax = Fx / self.particle['m']
        ay = Fy / self.particle['m']
        
        # Update velocity (Euler method)
        self.particle['vx'] += ax * self.time_step
        self.particle['vy'] += ay * self.time_step
        
        # Update position
        self.particle['x'] += self.particle['vx'] * self.time_step
        self.particle['y'] += self.particle['vy'] * self.time_step
        
        # Add to trajectory
        self.trajectory.append((self.particle['x'], self.particle['y']))
        if len(self.trajectory) > self.max_trajectory_points:
            self.trajectory.pop(0)
    
    def draw_field_vectors(self):
        """Draw electric field vectors"""
        for x, y, Ex, Ey in self.field_vectors:
            screen_x, screen_y = self.world_to_screen(x, y)
            
            # Scale vector for display
            end_x = screen_x + Ex * 50
            end_y = screen_y - Ey * 50  # Negative because screen y is inverted
            
            # Draw arrow
            pygame.draw.line(self.screen, (255, 100, 100), 
                           (screen_x, screen_y), (end_x, end_y), 1)
            
            # Draw arrowhead
            arrow_length = 5
            angle = np.arctan2(-Ey * 50, Ex * 50)
            pygame.draw.line(self.screen, (255, 100, 100),
                           (end_x, end_y),
                           (end_x - arrow_length * np.cos(angle + np.pi/6),
                            end_y - arrow_length * np.sin(angle + np.pi/6)), 1)
            pygame.draw.line(self.screen, (255, 100, 100),
                           (end_x, end_y),
                           (end_x - arrow_length * np.cos(angle - np.pi/6),
                            end_y - arrow_length * np.sin(angle - np.pi/6)), 1)
    
    def draw_charges(self):
        """Draw the static charges"""
        for x, y, q in self.charges:
            screen_x, screen_y = self.world_to_screen(x, y)
            color = (255, 0, 0) if q > 0 else (0, 0, 255)  # Red for positive, blue for negative
            pygame.draw.circle(self.screen, color, (screen_x, screen_y), 10)
            pygame.draw.circle(self.screen, (255, 255, 255), (screen_x, screen_y), 10, 2)
            
            # Draw charge sign
            font = pygame.font.Font(None, 24)
            sign = "+" if q > 0 else "-"
            text = font.render(sign, True, (255, 255, 255))
            text_rect = text.get_rect(center=(screen_x, screen_y))
            self.screen.blit(text, text_rect)
    
    def draw_particle(self):
        """Draw the moving particle"""
        screen_x, screen_y = self.world_to_screen(self.particle['x'], self.particle['y'])
        color = (0, 255, 0)  # Green for the particle
        pygame.draw.circle(self.screen, color, (screen_x, screen_y), 6)
        pygame.draw.circle(self.screen, (255, 255, 255), (screen_x, screen_y), 6, 1)
    
    def draw_trajectory(self):
        """Draw the particle's trajectory"""
        if len(self.trajectory) < 2:
            return
        
        points = [self.world_to_screen(x, y) for x, y in self.trajectory]
        pygame.draw.lines(self.screen, (0, 255, 255), False, points, 2)
    
    def draw_ui(self):
        """Draw user interface elements"""
        font = pygame.font.Font(None, 24)
        
        # Instructions
        instructions = [
            "SPACE: Pause/Resume",
            "R: Reset",
            "F: Toggle Field",
            "Click: Set Particle Position"
        ]
        
        y_offset = 10
        for instruction in instructions:
            text = font.render(instruction, True, (255, 255, 255))
            self.screen.blit(text, (10, y_offset))
            y_offset += 25
        
        # Status
        status = "PAUSED" if self.paused else "RUNNING"
        status_color = (255, 255, 0) if self.paused else (0, 255, 0)
        text = font.render(status, True, status_color)
        self.screen.blit(text, (self.width - 100, 10))
        
        # Particle info
        info = [
            f"Pos: ({self.particle['x']:.3f}, {self.particle['y']:.3f})",
            f"Vel: ({self.particle['vx']:.3f}, {self.particle['vy']:.3f})"
        ]
        y_offset = self.height - 60
        for line in info:
            text = font.render(line, True, (200, 200, 200))
            self.screen.blit(text, (10, y_offset))
            y_offset += 25
    
    def reset(self):
        """Reset the simulation"""
        self.particle = self.initial_particle.copy()
        self.trajectory = []
        self.paused = False
    
    def handle_events(self):
        """Handle user input"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    self.paused = not self.paused
                elif event.key == pygame.K_r:
                    self.reset()
                elif event.key == pygame.K_f:
                    self.show_field = not self.show_field
                elif event.key == pygame.K_ESCAPE:
                    self.running = False
            
            elif event.type == pygame.MOUSEBUTTONDOWN:
                # Click to set particle position
                mouse_x, mouse_y = pygame.mouse.get_pos()
                world_x, world_y = self.screen_to_world(mouse_x, mouse_y)
                self.particle['x'] = world_x
                self.particle['y'] = world_y
                self.particle['vx'] = 0.0
                self.particle['vy'] = 0.0
                self.trajectory = []
    
    def run(self):
        """Main simulation loop"""
        while self.running:
            self.handle_events()
            
            # Update physics multiple times per frame for faster motion
            for _ in range(self.updates_per_frame):
                self.update_particle()
            
            # Draw everything
            self.screen.fill((0, 0, 0))  # Black background
            
            if self.show_field:
                self.draw_field_vectors()
            
            self.draw_trajectory()
            self.draw_charges()
            self.draw_particle()
            self.draw_ui()
            
            pygame.display.flip()
            self.clock.tick(60)  # 60 FPS
        
        pygame.quit()
        sys.exit()


if __name__ == "__main__":
    sim = ElectricFieldSimulation()
    sim.run()
