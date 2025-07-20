#!/usr/bin/env python3
"""
CantoSub main entry point for PyInstaller.
This wrapper handles the import path issues when building with PyInstaller.
"""

import sys
import os
from pathlib import Path

# Add the src directory to the Python path
if getattr(sys, 'frozen', False):
    # Running as PyInstaller bundle
    bundle_dir = Path(sys._MEIPASS)
    src_dir = bundle_dir
else:
    # Running as normal Python script
    current_dir = Path(__file__).parent
    src_dir = current_dir / "src"

sys.path.insert(0, str(src_dir))

# Now import and run the main application
if __name__ == "__main__":
    try:
        from presentation.cli.main import app
        app()
    except ImportError as e:
        print(f"Import error: {e}")
        print(f"Python path: {sys.path}")
        print(f"Current directory: {os.getcwd()}")
        if hasattr(sys, '_MEIPASS'):
            print(f"PyInstaller temp dir: {sys._MEIPASS}")
        raise