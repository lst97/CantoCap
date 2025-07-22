#!/usr/bin/env python3
"""Environment setup script for CantoCap Engine."""

import os
import sys
import subprocess
import platform
import shutil
import urllib.request
import zipfile
from pathlib import Path


# Configuration
PYTHON_VERSION = "3.12"
REQUIRED_PYTHON_MIN = (3, 9)
FFMPEG_WINDOWS_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
LIB_DIR = Path("lib")
FFMPEG_WINDOWS_DIR = LIB_DIR / "ffmpeg" / "bin" / "win"


def print_status(message, status="INFO"):
    """Print formatted status message."""
    colors = {
        "INFO": "\033[94m",    # Blue
        "SUCCESS": "\033[92m", # Green
        "WARNING": "\033[93m", # Yellow
        "ERROR": "\033[91m",   # Red
        "RESET": "\033[0m"     # Reset
    }
    print(f"{colors.get(status, colors['INFO'])}[{status}] {message}{colors['RESET']}")


def check_python_version():
    """Check if Python version meets requirements."""
    current_version = sys.version_info[:2]
    if current_version < REQUIRED_PYTHON_MIN:
        print_status(f"Python {REQUIRED_PYTHON_MIN[0]}.{REQUIRED_PYTHON_MIN[1]}+ required, got {current_version[0]}.{current_version[1]}", "ERROR")
        sys.exit(1)
    print_status(f"Python version {current_version[0]}.{current_version[1]} ✓", "SUCCESS")


def run_command(command, shell=False, capture_output=True):
    """Run shell command with error handling."""
    try:
        result = subprocess.run(
            command if shell else command.split(),
            shell=shell,
            capture_output=capture_output,
            text=True,
            check=True
        )
        return result.stdout.strip() if capture_output else True
    except subprocess.CalledProcessError as e:
        if capture_output:
            print_status(f"Command failed: {' '.join(command) if isinstance(command, list) else command}", "ERROR")
            if e.stderr:
                print_status(f"Error: {e.stderr}", "ERROR")
        return None
    except FileNotFoundError:
        print_status(f"Command not found: {command[0] if isinstance(command, list) else command.split()[0]}", "ERROR")
        return None


def check_command_exists(command):
    """Check if a command exists in PATH."""
    return shutil.which(command) is not None


def create_virtual_environment():
    """Create Python 3.12 virtual environment."""
    venv_path = Path("venv")
    
    # Check if venv already exists
    if venv_path.exists():
        print_status("Virtual environment already exists", "INFO")
        return venv_path
    
    print_status("Creating Python 3.12 virtual environment...", "INFO")
    
    # Try to find Python 3.12
    python_commands = [f"python{PYTHON_VERSION}", "python3.12", "python3", "python"]
    python_cmd = None
    
    for cmd in python_commands:
        if check_command_exists(cmd):
            # Check version
            version_output = run_command(f"{cmd} --version")
            if version_output and PYTHON_VERSION in version_output:
                python_cmd = cmd
                break
    
    if not python_cmd:
        print_status(f"Python {PYTHON_VERSION} not found. Please install Python {PYTHON_VERSION} first.", "ERROR")
        print_status("Installation guides:", "INFO")
        print_status("- macOS: brew install python@3.12", "INFO")
        print_status("- Ubuntu/Debian: sudo apt install python3.12 python3.12-venv", "INFO")
        print_status("- Windows: Download from python.org", "INFO")
        sys.exit(1)
    
    # Create virtual environment
    if not run_command(f"{python_cmd} -m venv venv"):
        print_status("Failed to create virtual environment", "ERROR")
        sys.exit(1)
    
    print_status("Virtual environment created successfully ✓", "SUCCESS")
    return venv_path


def get_venv_python(venv_path):
    """Get the Python executable path in virtual environment."""
    if platform.system() == "Windows":
        return venv_path / "Scripts" / "python.exe"
    else:
        return venv_path / "bin" / "python"


def get_venv_pip(venv_path):
    """Get the pip executable path in virtual environment."""
    if platform.system() == "Windows":
        return venv_path / "Scripts" / "pip.exe"
    else:
        return venv_path / "bin" / "pip"


def upgrade_pip(venv_path):
    """Upgrade pip in virtual environment."""
    print_status("Upgrading pip...", "INFO")
    pip_cmd = str(get_venv_pip(venv_path))
    
    if not run_command(f"{pip_cmd} install --upgrade pip", capture_output=False):
        print_status("Failed to upgrade pip", "WARNING")
    else:
        print_status("Pip upgraded successfully ✓", "SUCCESS")


def install_build_tools(venv_path):
    """Install modern build tools."""
    print_status("Installing build tools...", "INFO")
    pip_cmd = str(get_venv_pip(venv_path))
    
    build_tools = ["build", "installer", "setuptools>=68.0", "wheel"]
    for tool in build_tools:
        if not run_command(f"{pip_cmd} install {tool}", capture_output=False):
            print_status(f"Failed to install {tool}", "WARNING")
        else:
            print_status(f"Installed {tool} ✓", "SUCCESS")


def install_ffmpeg():
    """Install FFmpeg based on the operating system."""
    system = platform.system().lower()
    
    print_status(f"Installing FFmpeg for {system}...", "INFO")
    
    if system == "windows":
        return install_ffmpeg_windows()
    elif system in ["darwin", "linux"]:
        return install_ffmpeg_unix(system)
    else:
        print_status(f"Unsupported operating system: {system}", "ERROR")
        return False


def install_ffmpeg_windows():
    """Install FFmpeg on Windows by downloading and extracting."""
    try:
        # Create directories
        FFMPEG_WINDOWS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Check if FFmpeg already exists
        ffmpeg_exe = FFMPEG_WINDOWS_DIR / "ffmpeg.exe"
        if ffmpeg_exe.exists():
            print_status("FFmpeg already installed on Windows ✓", "SUCCESS")
            return True
        
        print_status("Downloading FFmpeg for Windows...", "INFO")
        
        # Download FFmpeg
        zip_path = LIB_DIR / "ffmpeg-release-essentials.zip"
        urllib.request.urlretrieve(FFMPEG_WINDOWS_URL, zip_path)
        
        print_status("Extracting FFmpeg...", "INFO")
        
        # Extract FFmpeg
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Find the bin directory in the zip
            for file_info in zip_ref.filelist:
                if file_info.filename.endswith('/bin/') or file_info.filename.endswith('\\bin\\'):
                    continue
                if '/bin/' in file_info.filename or '\\bin\\' in file_info.filename:
                    if file_info.filename.endswith('.exe'):
                        # Extract to our bin directory
                        filename = Path(file_info.filename).name
                        with zip_ref.open(file_info) as source, open(FFMPEG_WINDOWS_DIR / filename, "wb") as target:
                            target.write(source.read())
        
        # Clean up zip file
        zip_path.unlink()
        
        # Verify installation
        if ffmpeg_exe.exists():
            print_status("FFmpeg installed successfully on Windows ✓", "SUCCESS")
            return True
        else:
            print_status("FFmpeg installation failed", "ERROR")
            return False
            
    except Exception as e:
        print_status(f"Failed to install FFmpeg on Windows: {e}", "ERROR")
        return False


def install_ffmpeg_unix(system):
    """Install FFmpeg on macOS or Linux using package managers."""
    if system == "darwin":  # macOS
        # Check if brew is available
        if not check_command_exists("brew"):
            print_status("Homebrew not found. Please install Homebrew first:", "ERROR")
            print_status("  /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"", "INFO")
            return False
        
        # Check if ffmpeg is already installed
        if check_command_exists("ffmpeg"):
            print_status("FFmpeg already installed ✓", "SUCCESS")
            return True
        
        print_status("Installing FFmpeg via Homebrew...", "INFO")
        if run_command("brew install ffmpeg", capture_output=False):
            print_status("FFmpeg installed successfully via Homebrew ✓", "SUCCESS")
            return True
        else:
            print_status("Failed to install FFmpeg via Homebrew", "ERROR")
            return False
            
    elif system == "linux":
        # Check if ffmpeg is already installed
        if check_command_exists("ffmpeg"):
            print_status("FFmpeg already installed ✓", "SUCCESS")
            return True
        
        print_status("Installing FFmpeg on Linux...", "INFO")
        
        # Try different package managers
        package_managers = [
            ("apt-get", "sudo apt-get update && sudo apt-get install -y ffmpeg"),
            ("yum", "sudo yum install -y ffmpeg"),
            ("dnf", "sudo dnf install -y ffmpeg"),
            ("pacman", "sudo pacman -S --noconfirm ffmpeg"),
            ("zypper", "sudo zypper install -y ffmpeg")
        ]
        
        for pm, install_cmd in package_managers:
            if check_command_exists(pm):
                print_status(f"Using {pm} to install FFmpeg...", "INFO")
                if run_command(install_cmd, shell=True, capture_output=False):
                    print_status("FFmpeg installed successfully ✓", "SUCCESS")
                    return True
                break
        
        print_status("Failed to install FFmpeg automatically.", "ERROR")
        print_status("Please install FFmpeg manually:", "INFO")
        print_status("  Ubuntu/Debian: sudo apt install ffmpeg", "INFO")
        print_status("  CentOS/RHEL: sudo yum install ffmpeg", "INFO")
        print_status("  Fedora: sudo dnf install ffmpeg", "INFO")
        print_status("  Arch: sudo pacman -S ffmpeg", "INFO")
        return False


def install_package(venv_path, dev_mode=True):
    """Install the package using modern build tools."""
    pip_cmd = str(get_venv_pip(venv_path))
    
    if dev_mode:
        print_status("Installing package in development mode...", "INFO")
        if run_command(f"{pip_cmd} install -e .", capture_output=False):
            print_status("Package installed in development mode ✓", "SUCCESS")
            return True
        else:
            print_status("Failed to install package in development mode", "ERROR")
            return False
    else:
        print_status("Building and installing package...", "INFO")
        python_cmd = str(get_venv_python(venv_path))
        
        # Build the package
        if not run_command(f"{python_cmd} -m build", capture_output=False):
            print_status("Failed to build package", "ERROR")
            return False
        
        # Install the built package
        if run_command(f"{pip_cmd} install dist/*.whl", shell=True, capture_output=False):
            print_status("Package built and installed successfully ✓", "SUCCESS")
            return True
        else:
            print_status("Failed to install built package", "ERROR")
            return False


def install_dev_dependencies(venv_path):
    """Install development dependencies."""
    print_status("Installing development dependencies...", "INFO")
    pip_cmd = str(get_venv_pip(venv_path))
    
    if run_command(f"{pip_cmd} install -e .[dev]", capture_output=False):
        print_status("Development dependencies installed successfully ✓", "SUCCESS")
        return True
    else:
        print_status("Failed to install development dependencies", "ERROR")
        return False


def setup_environment():
    """Set up the complete development environment."""
    print_status("=== CantoCap Engine Environment Setup ===", "INFO")
    
    # Check Python version
    check_python_version()
    
    # Create virtual environment
    venv_path = create_virtual_environment()
    
    # Upgrade pip and install build tools
    upgrade_pip(venv_path)
    install_build_tools(venv_path)
    
    # Install FFmpeg
    if not install_ffmpeg():
        print_status("FFmpeg installation failed. You may need to install it manually.", "WARNING")
    
    # Install package in development mode
    if not install_package(venv_path, dev_mode=True):
        print_status("Package installation failed", "WARNING")
    
    # Install development dependencies
    install_dev_dependencies(venv_path)
    
    # Final instructions
    print_status("=== Setup Complete ===", "SUCCESS")
    print_status("To activate the virtual environment:", "INFO")
    
    if platform.system() == "Windows":
        print_status("  .\\venv\\Scripts\\activate", "INFO")
    else:
        print_status("  source venv/bin/activate", "INFO")
    
    print_status("To test the installation:", "INFO")
    print_status("  python -m src.presentation.cli.main --help", "INFO")
    
    print_status("To build the package:", "INFO")
    print_status("  python -m build", "INFO")
    
    # Update PATH for Windows FFmpeg
    if platform.system().lower() == "windows" and FFMPEG_WINDOWS_DIR.exists():
        print_status("Note: FFmpeg installed to lib/ffmpeg/bin/win/", "INFO")
        print_status("You may need to add this directory to your PATH", "INFO")


def main():
    """Main setup function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="CantoCap Engine Environment Setup")
    parser.add_argument("--dev", action="store_true", help="Install development dependencies")
    parser.add_argument("--build-only", action="store_true", help="Build package instead of installing in dev mode")
    
    args = parser.parse_args()
    
    if args.build_only:
        print_status("Building package only...", "INFO")
        venv_path = Path("venv")
        if not venv_path.exists():
            print_status("Virtual environment not found. Run setup first.", "ERROR")
            sys.exit(1)
        install_package(venv_path, dev_mode=False)
    else:
        setup_environment()


if __name__ == "__main__":
    main()