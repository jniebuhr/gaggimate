#!/bin/bash
#
# ESP32 Core Dump Analyzer - Shell Wrapper
# 
# Quick wrapper for the Python core dump analyzer script
#
# Usage:
#   ./scripts/analyze_coredump.sh <coredump_file> [environment]
#
# Examples:
#   ./scripts/analyze_coredump.sh ~/Downloads/coredump.bin
#   ./scripts/analyze_coredump.sh ~/Downloads/coredump.bin display
#   ./scripts/analyze_coredump.sh ~/Downloads/coredump.bin controller
#   ./scripts/analyze_coredump.sh ~/Downloads/coredump.bin display-headless
#

# Check if at least one argument is provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <coredump_file> [environment]"
    echo ""
    echo "Available environments:"
    echo "  display           - Main display controller (default)"
    echo "  controller        - Gaggia controller"
    echo "  display-headless  - Headless display mode"
    echo ""
    echo "Examples:"
    echo "  $0 ~/Downloads/coredump.bin"
    echo "  $0 ~/Downloads/coredump.bin display"
    echo "  $0 ~/Downloads/coredump.bin controller"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root directory
cd "$PROJECT_ROOT" || {
    echo "❌ Failed to change to project root directory: $PROJECT_ROOT"
    exit 1
}

# Run the Python analyzer with all arguments passed through
python3 "$SCRIPT_DIR/analyze_coredump.py" "$@"
