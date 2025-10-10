#!/usr/bin/env python3

"""
Build script for generating nanopb protobuf files for GaggiMate
"""

import os
import sys
import subprocess
from pathlib import Path

def generate_nanopb():
    """Generate nanopb .c and .h files from .proto definitions"""
    
    # Get the project root directory
    project_root = Path(__file__).parent.parent
    proto_dir = project_root / "lib" / "NimBLEComm" / "proto"
    src_dir = project_root / "lib" / "NimBLEComm" / "src"
    
    # Check if proto files exist
    proto_file = proto_dir / "gaggimate.proto"
    options_file = proto_dir / "gaggimate.options"
    
    if not proto_file.exists():
        print(f"Error: {proto_file} not found")
        return False
    
    # Try to find nanopb generator
    nanopb_generator = None
    
    # Check if we're in a virtual environment with nanopb
    venv_python = project_root / ".venv" / "bin" / "python"
    if venv_python.exists():
        try:
            # Try to find nanopb generator in the virtual environment
            result = subprocess.run([str(venv_python), '-c', 'import nanopb.generator.nanopb_generator'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                nanopb_generator = [str(venv_python), '-m', 'nanopb.generator.nanopb_generator']
        except FileNotFoundError:
            pass
    
    # Check if nanopb is installed via pip globally
    if not nanopb_generator:
        try:
            result = subprocess.run(['nanopb_generator', '--version'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                nanopb_generator = 'nanopb_generator'
        except FileNotFoundError:
            pass
    
    # Try python -m nanopb_generator
    if not nanopb_generator:
        try:
            result = subprocess.run(['python', '-m', 'nanopb.generator.nanopb_generator', '--version'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                nanopb_generator = ['python', '-m', 'nanopb.generator.nanopb_generator']
        except FileNotFoundError:
            pass
    
    # Try to find in PlatformIO packages
    if not nanopb_generator:
        pio_packages = Path.home() / ".platformio" / "packages"
        if pio_packages.exists():
            for package_dir in pio_packages.glob("*nanopb*"):
                generator_path = package_dir / "generator" / "nanopb_generator.py"
                if generator_path.exists():
                    nanopb_generator = ['python', str(generator_path)]
                    break
    
    if not nanopb_generator:
        print("Error: nanopb_generator not found. Please install nanopb:")
        print("  pip install nanopb")
        return False
    
    # Generate the files directly to src directory where build expects them
    output_dir = src_dir
    
    # Ensure the source directory exists
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # First, compile .proto to .pb using protoc
    pb_file = proto_dir / "gaggimate.pb"
    
    print("Step 1: Compiling .proto to .pb...")
    protoc_cmd = [
        'protoc',
        '--proto_path', str(proto_dir),
        '--descriptor_set_out', str(pb_file),
        'gaggimate.proto'
    ]
    
    try:
        result = subprocess.run(protoc_cmd, cwd=proto_dir, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"✗ protoc failed:")
            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
            return False
        print("✓ protoc compilation successful")
    except FileNotFoundError:
        print("✗ protoc not found. Please install Protocol Buffers compiler:")
        print("  sudo apt-get install protobuf-compiler")
        print("  # or")
        print("  brew install protobuf")
        return False
    
    # Then, generate nanopb files from .pb
    print("Step 2: Generating nanopb files...")
    cmd = nanopb_generator.copy() if isinstance(nanopb_generator, list) else [nanopb_generator]
    cmd.extend([
        '--output-dir', str(output_dir),
        str(pb_file)
    ])
    
    print(f"Generating nanopb files...")
    print(f"Command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, cwd=proto_dir, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✓ nanopb generation successful")
            
            # Check if files were generated
            pb_h = output_dir / "gaggimate.pb.h"
            pb_c = output_dir / "gaggimate.pb.c"
            
            if pb_h.exists() and pb_c.exists():
                print(f"✓ Generated: {pb_h}")
                print(f"✓ Generated: {pb_c}")
                return True
            else:
                print("✗ Generated files not found")
                return False
        else:
            print(f"✗ nanopb generation failed:")
            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"✗ Error running nanopb generator: {e}")
        return False

if __name__ == "__main__":
    success = generate_nanopb()
    sys.exit(0 if success else 1)