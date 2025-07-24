#!/usr/bin/env python3
"""
Test runner for CantoCap comprehensive test suite.

This script provides various test running options for the CantoCap project.
"""

import sys
import subprocess
import argparse
from pathlib import Path


def run_command(cmd, description=""):
    """Run a command and return the result."""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(cmd)}")
    print(f"{'='*60}")
    
    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Run CantoCap tests")
    parser.add_argument("--type", choices=["unit", "integration", "e2e", "all"], 
                       default="unit", help="Type of tests to run")
    parser.add_argument("--coverage", action="store_true", 
                       help="Run with coverage reporting")
    parser.add_argument("--verbose", "-v", action="store_true", 
                       help="Verbose output")
    parser.add_argument("--fail-fast", "-x", action="store_true", 
                       help="Stop on first failure")
    parser.add_argument("--pattern", help="Test name pattern to match")
    
    args = parser.parse_args()
    
    # Base pytest command
    cmd = ["python", "-m", "pytest"]
    
    # Test selection
    if args.type == "unit":
        cmd.append("tests/unit/")
    elif args.type == "integration":
        cmd.append("tests/integration/")
    elif args.type == "e2e":
        cmd.append("tests/e2e/")
    else:  # all
        cmd.append("tests/")
    
    # Add options
    if args.verbose:
        cmd.append("-v")
    
    if args.fail_fast:
        cmd.append("-x")
    
    if args.pattern:
        cmd.extend(["-k", args.pattern])
    
    if args.coverage:
        cmd.extend([
            "--cov=src",
            "--cov-report=term-missing",
            "--cov-report=html:htmlcov"
        ])
    
    # Run the tests
    description = f"Running {args.type} tests"
    if args.coverage:
        description += " with coverage"
    
    success = run_command(cmd, description)
    
    if success:
        print(f"\n✅ {args.type.capitalize()} tests passed!")
        if args.coverage:
            print("📊 Coverage report generated in htmlcov/")
    else:
        print(f"\n❌ {args.type.capitalize()} tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()