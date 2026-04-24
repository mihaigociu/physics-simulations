"""
OpenPNM Demonstration: Permeability and Porosity Analysis
==========================================================
This script demonstrates OpenPNM's capabilities for porous media analysis,
perfect for materials research in physics and engineering.

Features demonstrated:
- Creating realistic porous network structures
- Computing permeability using Stokes flow
- Analyzing porosity and pore size distributions
- Visualizing network topology and flow fields
- Comparing different materials
"""

import openpnm as op
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec


class PermeabilityDemo:
    """Comprehensive demo of OpenPNM for permeability analysis"""
    
    def __init__(self):
        self.workspace = op.Workspace()
        self.results = {}
        
    def create_network(self, name, shape=(20, 20, 20), spacing=1e-4, 
                      coordination=6):
        """
        Create a cubic pore network
        
        Parameters:
        -----------
        name : str
            Network identifier
        shape : tuple
            Network dimensions (nx, ny, nz)
        spacing : float
            Distance between pores (meters)
        coordination : int
            Average number of connections per pore
        """
        print(f"\n{'='*60}")
        print(f"Creating {name} network...")
        print(f"{'='*60}")
        
        # Create cubic network
        if coordination == 6:
            pn = op.network.Cubic(shape=shape, spacing=spacing)
        else:
            pn = op.network.CubicTemplate(shape=shape, spacing=spacing,
                                         connectivity=coordination)
        
        pn.name = name
        
        # Store shape and spacing for later use
        pn._shape = shape
        pn._spacing = np.array([spacing] * 3) if isinstance(spacing, (int, float)) else np.array(spacing)
        
        print(f"Network created: {pn.Np} pores, {pn.Nt} throats")
        dims = np.array(shape) * spacing * 1e6
        print(f"Network dimensions: {dims[0]:.1f} x {dims[1]:.1f} x {dims[2]:.1f} μm")
        
        return pn
    
    def add_geometry(self, network, pore_size_dist='normal', 
                    mean_pore_diameter=50e-6, std_pore_diameter=10e-6):
        """
        Add geometric properties to the network
        
        Parameters:
        -----------
        network : OpenPNM Network
        pore_size_dist : str
            Distribution type ('normal', 'weibull', 'uniform')
        mean_pore_diameter : float
            Mean pore diameter (meters)
        std_pore_diameter : float
            Standard deviation of pore diameter (meters)
        """
        print(f"\nAdding geometry with {pore_size_dist} pore size distribution...")
        
        # Directly assign pore sizes based on distribution
        # This is more straightforward and avoids seed issues
        np.random.seed(42)  # For reproducibility
        
        if pore_size_dist == 'normal':
            pore_diameters = np.random.normal(mean_pore_diameter, 
                                             std_pore_diameter, 
                                             network.Np)
            # Ensure positive values
            pore_diameters = np.abs(pore_diameters)
            pore_diameters = np.clip(pore_diameters, mean_pore_diameter * 0.1, 
                                     mean_pore_diameter * 3)
        elif pore_size_dist == 'weibull':
            # Weibull distribution
            pore_diameters = (np.random.weibull(2.0, network.Np) * 
                             mean_pore_diameter * 0.8 + mean_pore_diameter * 0.2)
        elif pore_size_dist == 'uniform':
            pore_diameters = np.random.uniform(mean_pore_diameter * 0.5,
                                              mean_pore_diameter * 1.5,
                                              network.Np)
        
        network['pore.diameter'] = pore_diameters
        
        # Throat diameters based on neighboring pores
        conns = network['throat.conns']
        throat_diameters = np.min(pore_diameters[conns], axis=1) * 0.5
        network['throat.diameter'] = throat_diameters
        
        # Add basic geometric properties using models
        network.add_model(propname='pore.volume',
                         model=op.models.geometry.pore_volume.sphere)
        
        network.add_model(propname='throat.length',
                         model=op.models.geometry.throat_length.spheres_and_cylinders)
        
        network.add_model(propname='throat.volume',
                         model=op.models.geometry.throat_volume.cylinder)
        
        network.add_model(propname='throat.cross_sectional_area',
                         model=op.models.geometry.throat_cross_sectional_area.cylinder)
        
        # Add hydraulic size factors needed for flow calculations
        network.add_model(propname='throat.hydraulic_size_factors',
                         model=op.models.geometry.hydraulic_size_factors.spheres_and_cylinders)
        
        network.regenerate_models()
        
        pore_diameters = network['pore.diameter']
        print(f"Pore diameter range: {pore_diameters.min()*1e6:.2f} - "
              f"{pore_diameters.max()*1e6:.2f} μm")
        print(f"Mean pore diameter: {pore_diameters.mean()*1e6:.2f} μm")
        
        return network
    
    def add_phase(self, network, phase_name='water', temperature=298.15):
        """
        Add fluid phase properties
        
        Parameters:
        -----------
        network : OpenPNM Network
        phase_name : str
            Fluid type ('water', 'air', 'sunflower_oil')
        temperature : float
            Temperature in Kelvin
        """
        print(f"\nAdding {phase_name} phase at {temperature} K...")
        
        if phase_name == 'water':
            phase = op.phase.Water(network=network, name='water')
        elif phase_name == 'air':
            phase = op.phase.Air(network=network, name='air')
        elif phase_name == 'sunflower_oil':
            # Sunflower oil properties at ~25°C (298K)
            phase = op.phase.Phase(network=network, name='sunflower_oil')
            phase['pore.viscosity'] = 0.048  # Pa·s (48 mPa·s)
            phase['pore.density'] = 920      # kg/m³
        else:
            # Generic phase
            phase = op.phase.Phase(network=network, name=phase_name)
            phase['pore.viscosity'] = 0.001  # Pa·s
            phase['pore.density'] = 1000     # kg/m³
        
        phase['pore.temperature'] = temperature
        
        print(f"Viscosity: {phase['pore.viscosity'].mean()*1000:.4f} mPa·s")
        
        return phase
    
    def add_physics(self, network, phase):
        """Add physical models for flow calculations"""
        print("\nAdding physics models...")
        
        # In OpenPNM 3.x, add physics models directly to the phase
        # Use Hagen-Poiseuille for hydraulic conductance (simpler, doesn't need size factors)
        phase.add_model(propname='throat.hydraulic_conductance',
                       model=op.models.physics.hydraulic_conductance.hagen_poiseuille)
        
        phase.regenerate_models()
        
        return phase
    
    def calculate_permeability(self, network, phase, flow_direction='x'):
        """
        Calculate absolute permeability using Stokes flow
        
        Parameters:
        -----------
        network : OpenPNM Network
        phase : OpenPNM Phase
        physics : OpenPNM Physics
        flow_direction : str
            Direction of flow ('x', 'y', or 'z')
        
        Returns:
        --------
        permeability : float
            Absolute permeability in m²
        """
        print(f"\n{'='*60}")
        print(f"Calculating permeability in {flow_direction}-direction...")
        print(f"{'='*60}")
        
        # Create Stokes flow algorithm
        sf = op.algorithms.StokesFlow(network=network, phase=phase)
        
        # Define inlet and outlet based on direction
        if flow_direction == 'x':
            inlet = network['pore.left']
            outlet = network['pore.right']
            length = network._spacing[0] * (network._shape[0] - 1)
        elif flow_direction == 'y':
            inlet = network['pore.front']
            outlet = network['pore.back']
            length = network._spacing[1] * (network._shape[1] - 1)
        else:  # z direction
            inlet = network['pore.bottom']
            outlet = network['pore.top']
            length = network._spacing[2] * (network._shape[2] - 1)
        
        # Set boundary conditions (pressure difference)
        pressure_drop = 101325  # 1 atm in Pa
        sf.set_value_BC(pores=inlet, values=pressure_drop)
        sf.set_value_BC(pores=outlet, values=0)
        
        # Run simulation
        sf.run()
        
        # Calculate flow rate
        phase.update(sf.soln)
        flow_rate = sf.rate(pores=inlet)[0]  # m³/s
        
        # Calculate cross-sectional area
        if flow_direction == 'x':
            area = (network._spacing[1] * network._shape[1] * 
                   network._spacing[2] * network._shape[2])
        elif flow_direction == 'y':
            area = (network._spacing[0] * network._shape[0] * 
                   network._spacing[2] * network._shape[2])
        else:
            area = (network._spacing[0] * network._shape[0] * 
                   network._spacing[1] * network._shape[1])
        
        # Darcy's law: Q = (K * A * ΔP) / (μ * L)
        # Solving for K: K = (Q * μ * L) / (A * ΔP)
        viscosity = phase['pore.viscosity'].mean()
        permeability = (flow_rate * viscosity * length) / (area * pressure_drop)
        
        print(f"\nResults:")
        print(f"  Flow rate: {flow_rate*1e9:.6f} mm³/s")
        print(f"  Pressure drop: {pressure_drop/1e3:.1f} kPa")
        print(f"  Cross-sectional area: {area*1e6:.4f} mm²")
        print(f"  Flow length: {length*1e6:.2f} μm")
        print(f"  Permeability: {permeability*1e12:.4f} Darcy")
        print(f"  Permeability: {permeability:.4e} m²")
        
        return {
            'permeability': permeability,
            'flow_rate': flow_rate,
            'pressure_drop': pressure_drop,
            'algorithm': sf
        }
    
    def calculate_porosity(self, network):
        """
        Calculate porosity of the network
        
        Returns:
        --------
        porosity : float
            Volume fraction of pore space
        """
        print(f"\n{'='*60}")
        print("Calculating porosity...")
        print(f"{'='*60}")
        
        # Total bulk volume
        bulk_volume = np.prod(network._shape) * np.prod(network._spacing)
        
        # Pore volume
        pore_volume = np.sum(network['pore.volume'])
        
        # Throat volume
        throat_volume = np.sum(network['throat.volume'])
        
        # Total void volume
        void_volume = pore_volume + throat_volume
        
        # Porosity
        porosity = void_volume / bulk_volume
        
        print(f"\nPorosity Analysis:")
        print(f"  Bulk volume: {bulk_volume*1e12:.4f} mm³")
        print(f"  Pore volume: {pore_volume*1e12:.4f} mm³")
        print(f"  Throat volume: {throat_volume*1e12:.4f} mm³")
        print(f"  Void volume: {void_volume*1e12:.4f} mm³")
        print(f"  Porosity: {porosity:.4f} ({porosity*100:.2f}%)")
        
        return porosity
    
    def analyze_pore_distribution(self, network):
        """Analyze pore size distribution"""
        pore_diameters = network['pore.diameter']
        
        stats = {
            'mean': np.mean(pore_diameters),
            'std': np.std(pore_diameters),
            'min': np.min(pore_diameters),
            'max': np.max(pore_diameters),
            'median': np.median(pore_diameters),
            'q25': np.percentile(pore_diameters, 25),
            'q75': np.percentile(pore_diameters, 75)
        }
        
        print(f"\nPore Size Distribution:")
        print(f"  Mean: {stats['mean']*1e6:.2f} μm")
        print(f"  Std Dev: {stats['std']*1e6:.2f} μm")
        print(f"  Range: [{stats['min']*1e6:.2f}, {stats['max']*1e6:.2f}] μm")
        print(f"  Median: {stats['median']*1e6:.2f} μm")
        print(f"  IQR: [{stats['q25']*1e6:.2f}, {stats['q75']*1e6:.2f}] μm")
        
        return stats
    
    def visualize_results(self, networks_data):
        """
        Create comprehensive visualization of results
        
        Parameters:
        -----------
        networks_data : list of dict
            Each dict contains: network, geometry, flow_results, name
        """
        print(f"\n{'='*60}")
        print("Creating visualizations...")
        print(f"{'='*60}")
        
        n_networks = len(networks_data)
        
        # Create figure with subplots
        fig = plt.figure(figsize=(16, 10))
        gs = GridSpec(3, n_networks, figure=fig, hspace=0.3, wspace=0.3)
        
        # Colors for different networks
        colors = ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D']
        
        for idx, data in enumerate(networks_data):
            network = data['network']
            flow_results = data['flow_results']
            name = data['name']
            color = colors[idx % len(colors)]
            
            # 1. Pore size distribution
            ax1 = fig.add_subplot(gs[0, idx])
            pore_diameters = network['pore.diameter'] * 1e6  # Convert to μm
            ax1.hist(pore_diameters, bins=30, alpha=0.7, color=color, 
                    edgecolor='black')
            ax1.set_xlabel('Pore Diameter (μm)', fontsize=10)
            ax1.set_ylabel('Frequency', fontsize=10)
            ax1.set_title(f'{name}\nPore Size Distribution', fontsize=11, 
                         fontweight='bold')
            ax1.grid(alpha=0.3)
            
            # Add statistics text
            mean_d = np.mean(pore_diameters)
            std_d = np.std(pore_diameters)
            ax1.text(0.95, 0.95, f'μ={mean_d:.1f} μm\nσ={std_d:.1f} μm',
                    transform=ax1.transAxes, fontsize=9,
                    verticalalignment='top', horizontalalignment='right',
                    bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
            
            # 2. Connectivity distribution
            ax2 = fig.add_subplot(gs[1, idx])
            coordination = np.sum(network.create_adjacency_matrix().toarray(), 
                                 axis=1)
            ax2.hist(coordination, bins=np.arange(0, coordination.max()+2)-0.5,
                    alpha=0.7, color=color, edgecolor='black')
            ax2.set_xlabel('Coordination Number', fontsize=10)
            ax2.set_ylabel('Frequency', fontsize=10)
            ax2.set_title('Pore Connectivity', fontsize=11, fontweight='bold')
            ax2.grid(alpha=0.3)
            
            mean_coord = np.mean(coordination)
            ax2.text(0.95, 0.95, f'Mean: {mean_coord:.2f}',
                    transform=ax2.transAxes, fontsize=9,
                    verticalalignment='top', horizontalalignment='right',
                    bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
            
            # 3. Key metrics summary
            ax3 = fig.add_subplot(gs[2, idx])
            ax3.axis('off')
            
            # Calculate porosity
            bulk_volume = np.prod(network._shape) * np.prod(network._spacing)
            pore_volume = np.sum(network['pore.volume'])
            throat_volume = np.sum(network['throat.volume'])
            porosity = (pore_volume + throat_volume) / bulk_volume
            
            permeability = flow_results['permeability']
            
            # Create metrics text
            metrics_text = f"""
            KEY METRICS
            {'─' * 25}
            Permeability: {permeability*1e12:.4f} Darcy
                        ({permeability:.2e} m²)
            
            Porosity: {porosity:.4f} ({porosity*100:.1f}%)
            
            Network Size: {network.Np} pores
                         {network.Nt} throats
            
            Pore Diameter:
              Mean: {mean_d:.2f} μm
              Range: [{pore_diameters.min():.1f}, 
                     {pore_diameters.max():.1f}] μm
            
            Flow Rate: {flow_results['flow_rate']*1e9:.4f} mm³/s
            """
            
            ax3.text(0.1, 0.9, metrics_text, transform=ax3.transAxes,
                    fontsize=10, verticalalignment='top',
                    fontfamily='monospace',
                    bbox=dict(boxstyle='round', facecolor=color, 
                             alpha=0.2, pad=1))
        
        plt.suptitle('OpenPNM Permeability Analysis - Comprehensive Results',
                    fontsize=16, fontweight='bold', y=0.98)
        
        plt.savefig('/Users/2346263/projects/bucket_drip/openpnm_demo_results.png',
                   dpi=150, bbox_inches='tight')
        print("\nVisualization saved as 'openpnm_demo_results.png'")
        
        return fig
    
    def compare_materials(self):
        """Compare different material types"""
        print("\n" + "="*60)
        print("COMPARING DIFFERENT POROUS MATERIALS")
        print("="*60)
        
        materials = [
            {
                'name': 'Sandstone',
                'shape': (15, 15, 15),
                'spacing': 1e-4,
                'pore_dist': 'weibull',
                'mean_diameter': 60e-6,
                'std_diameter': 15e-6
            },
            {
                'name': 'Ceramic Filter',
                'shape': (15, 15, 15),
                'spacing': 1e-4,
                'pore_dist': 'normal',
                'mean_diameter': 40e-6,
                'std_diameter': 8e-6
            }
        ]
        
        networks_data = []
        
        for mat in materials:
            print(f"\n{'*'*60}")
            print(f"Analyzing: {mat['name']}")
            print(f"{'*'*60}")
            
            # Create network
            network = self.create_network(mat['name'], 
                                         shape=mat['shape'],
                                         spacing=mat['spacing'])
            
            # Add geometry
            self.add_geometry(network, 
                             pore_size_dist=mat['pore_dist'],
                             mean_pore_diameter=mat['mean_diameter'],
                             std_pore_diameter=mat['std_diameter'])
            
            # Add phase and physics
            phase = self.add_phase(network, 'water')
            self.add_physics(network, phase)
            
            # Calculate properties
            porosity = self.calculate_porosity(network)
            pore_stats = self.analyze_pore_distribution(network)
            flow_results = self.calculate_permeability(network, phase)
            
            networks_data.append({
                'network': network,
                'flow_results': flow_results,
                'name': mat['name'],
                'porosity': porosity,
                'pore_stats': pore_stats
            })
        
        # Create visualization
        self.visualize_results(networks_data)
        
        # Print comparison summary
        print(f"\n{'='*60}")
        print("COMPARISON SUMMARY")
        print(f"{'='*60}")
        for data in networks_data:
            print(f"\n{data['name']}:")
            print(f"  Permeability: {data['flow_results']['permeability']*1e12:.4f} Darcy")
            print(f"  Porosity: {data['porosity']*100:.2f}%")
            print(f"  Mean pore size: {data['pore_stats']['mean']*1e6:.2f} μm")
        
        return networks_data


def main():
    """Run the demonstration"""
    print("\n" + "="*60)
    print("OPENPNM DEMONSTRATION FOR PHYSICS RESEARCH")
    print("Permeability and Porosity Analysis of Porous Materials")
    print("="*60)
    
    demo = PermeabilityDemo()
    
    # Run comparison of different materials
    results = demo.compare_materials()
    
    print(f"\n{'='*60}")
    print("DEMONSTRATION COMPLETE!")
    print(f"{'='*60}")
    print("\nOpenPNM provides:")
    print("  ✓ Realistic pore network modeling")
    print("  ✓ Accurate permeability calculations via Stokes flow")
    print("  ✓ Detailed porosity and connectivity analysis")
    print("  ✓ Multiple physics models (diffusion, conduction, etc.)")
    print("  ✓ Easy comparison of different materials")
    print("  ✓ Publication-quality visualizations")
    print("\nPerfect for materials research in academia!")
    
    plt.show()


if __name__ == "__main__":
    main()
