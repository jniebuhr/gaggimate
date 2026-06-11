{
  description = "GaggiMate - Smart espresso machine controller development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        # Node.js 22 as required by the project
        nodejs = pkgs.nodejs_22;

        # Python environment for PlatformIO
        python = pkgs.python311;
        pythonEnv = python.withPackages (ps: with ps; [
          pip
          setuptools
          wheel
        ]);

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js environment
            nodejs

            # PlatformIO for ESP32 development
            platformio

            # Build tools
            clang-tools # Includes clang-format
            gzip
            git

            # Python for PlatformIO scripts
            pythonEnv

            # USB/Serial communication
            picocom
            screen

            # Additional utilities
            jq # JSON processing
          ];

          shellHook = ''
            echo "GaggiMate Development Environment"
            echo "=================================="
            echo "Node.js version: $(node --version)"
            echo "npm version: $(npm --version)"
            echo "PlatformIO version: $(platformio --version 2>&1 | head -n1)"
            echo ""
            echo "Common Commands:"
            make
            echo ""
          '';

          # Environment variables:
          # PlatformIO uses default ~/.platformio directory

          # Ensure npm can find node
          NODE_PATH = "${nodejs}/lib/node_modules";
        };
      }
    );
}
