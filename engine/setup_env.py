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
PYTHON_VERSION = "3.12"  # Recommended version
REQUIRED_PYTHON_MIN = (3, 9)
REQUIRED_PYTHON_MAX = (3, 12)
FFMPEG_URLS = {
    "win": {
        "amd64": "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
        "arm64": "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"  # Same for now
    },
    "linux": {
        "amd64": "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
        "arm64": "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
    },
    "macos": {
        "amd64": "https://evermeet.cx/ffmpeg/getrelease/zip",
        "arm64": "https://evermeet.cx/ffmpeg/getrelease/zip"
    }
}

LIB_DIR = Path("lib")

def get_ffmpeg_dir():
    """Get FFmpeg directory based on system and architecture."""
    system = platform.system().lower()
    if system == "windows":
        system = "win"
    elif system == "darwin":
        system = "macos"
    
    machine = platform.machine().lower()
    if machine in ["x86_64", "amd64"]:
        arch = "amd64"
    elif machine in ["arm64", "aarch64"]:
        arch = "arm64"
    else:
        arch = "amd64"  # Default fallback
    
    return LIB_DIR / "ffmpeg" / "bin" / system / arch


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
        suggest_pyenv_installation()
        sys.exit(1)
    elif current_version > REQUIRED_PYTHON_MAX:
        print_status(f"Python version {current_version[0]}.{current_version[1]} detected, but only versions ≤{REQUIRED_PYTHON_MAX[0]}.{REQUIRED_PYTHON_MAX[1]} are supported", "WARNING")
        print_status(f"Recommended: Python {PYTHON_VERSION}", "INFO")
        suggest_pyenv_installation()
        sys.exit(1)
    elif current_version < (3, 12):
        print_status(f"Python version {current_version[0]}.{current_version[1]} ✓ (Python {PYTHON_VERSION} recommended)", "SUCCESS")
    else:
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


def suggest_pyenv_installation():
    """Suggest pyenv installation for managing Python versions."""
    print_status("", "INFO")
    print_status("💡 Tip: Use pyenv to manage Python versions easily", "INFO")
    print_status("Installation instructions:", "INFO")
    
    system = platform.system().lower()
    if system == "darwin":  # macOS
        print_status("  brew install pyenv", "INFO")
        print_status("  echo 'export PATH=\"$HOME/.pyenv/bin:$PATH\"' >> ~/.zshrc", "INFO")
        print_status("  echo 'eval \"$(pyenv init --path)\"' >> ~/.zshrc", "INFO")
    elif system == "linux":
        print_status("  curl https://pyenv.run | bash", "INFO")
        print_status("  echo 'export PATH=\"$HOME/.pyenv/bin:$PATH\"' >> ~/.bashrc", "INFO")
        print_status("  echo 'eval \"$(pyenv init --path)\"' >> ~/.bashrc", "INFO")
    elif system == "windows":
        print_status("  Install pyenv-win: https://github.com/pyenv-win/pyenv-win", "INFO")
        print_status("  Or use Python.org installer directly", "INFO")
    
    print_status("", "INFO")
    print_status(f"After installing pyenv, run:", "INFO")
    print_status(f"  pyenv install {PYTHON_VERSION}", "INFO")
    print_status(f"  pyenv local {PYTHON_VERSION}", "INFO")


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


def get_system_info():
    """Get standardized system and architecture info."""
    system = platform.system().lower()
    if system == "windows":
        system = "win"
    elif system == "darwin":
        system = "macos"
    
    machine = platform.machine().lower()
    if machine in ["x86_64", "amd64"]:
        arch = "amd64"
    elif machine in ["arm64", "aarch64"]:
        arch = "arm64"
    else:
        arch = "amd64"  # Default fallback
        print_status(f"Unknown architecture {machine}, defaulting to amd64", "WARNING")
    
    return system, arch


def install_ffmpeg():
    """Install FFmpeg based on the operating system and architecture."""
    system, arch = get_system_info()
    
    print_status(f"Installing FFmpeg for {system} {arch}...", "INFO")
    
    # Check if FFmpeg is already in PATH
    if check_command_exists("ffmpeg"):
        print_status("FFmpeg already installed in system PATH ✓", "SUCCESS")
        return True
    
    # Check if FFmpeg is in our lib directory
    ffmpeg_dir = get_ffmpeg_dir()
    ffmpeg_exe = ffmpeg_dir / ("ffmpeg.exe" if system == "win" else "ffmpeg")
    if ffmpeg_exe.exists():
        print_status(f"FFmpeg already installed in {ffmpeg_dir} ✓", "SUCCESS")
        return True
    
    # Try to download and install FFmpeg
    if system == "win":
        return download_ffmpeg_windows(ffmpeg_dir, arch)
    elif system == "macos":
        return install_ffmpeg_macos(ffmpeg_dir, arch)
    elif system == "linux":
        return download_ffmpeg_linux(ffmpeg_dir, arch)
    else:
        print_status(f"Unsupported operating system: {system}", "ERROR")
        return False


def download_ffmpeg_windows(target_dir: Path, arch: str):
    """Download and install FFmpeg on Windows."""
    import tarfile
    
    try:
        # Create directories
        target_dir.mkdir(parents=True, exist_ok=True)
        
        ffmpeg_exe = target_dir / "ffmpeg.exe"
        url = FFMPEG_URLS["win"][arch]
        
        print_status("Downloading FFmpeg for Windows...", "INFO")
        
        # Download FFmpeg
        zip_path = LIB_DIR / "ffmpeg-release-essentials.zip"
        urllib.request.urlretrieve(url, zip_path)
        
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
                        with zip_ref.open(file_info) as source, open(target_dir / filename, "wb") as target:
                            target.write(source.read())
        
        # Clean up zip file
        zip_path.unlink()
        
        # Verify installation
        if ffmpeg_exe.exists():
            print_status(f"FFmpeg installed successfully to {target_dir} ✓", "SUCCESS")
            return True
        else:
            print_status("FFmpeg installation failed", "ERROR")
            return False
            
    except Exception as e:
        print_status(f"Failed to install FFmpeg on Windows: {e}", "ERROR")
        return False


def download_ffmpeg_linux(target_dir: Path, arch: str):
    """Download and install FFmpeg on Linux."""
    import tarfile
    
    try:
        # Create directories
        target_dir.mkdir(parents=True, exist_ok=True)
        
        ffmpeg_exe = target_dir / "ffmpeg"
        url = FFMPEG_URLS["linux"][arch]
        
        print_status("Downloading FFmpeg for Linux...", "INFO")
        
        # Download FFmpeg
        tar_path = LIB_DIR / f"ffmpeg-{arch}-static.tar.xz"
        urllib.request.urlretrieve(url, tar_path)
        
        print_status("Extracting FFmpeg...", "INFO")
        
        # Extract FFmpeg
        with tarfile.open(tar_path, 'r:xz') as tar_ref:
            for member in tar_ref.getmembers():
                if member.name.endswith('/ffmpeg') or member.name.endswith('\\ffmpeg'):
                    # Extract to our bin directory
                    member.name = 'ffmpeg'  # Rename to just 'ffmpeg'
                    tar_ref.extract(member, target_dir)
                    # Make executable
                    ffmpeg_exe.chmod(0o755)
                    break
        
        # Clean up tar file
        tar_path.unlink()
        
        # Verify installation
        if ffmpeg_exe.exists():
            print_status(f"FFmpeg installed successfully to {target_dir} ✓", "SUCCESS")
            return True
        else:
            print_status("FFmpeg installation failed", "ERROR")
            return False
            
    except Exception as e:
        print_status(f"Failed to install FFmpeg on Linux: {e}", "ERROR")
        # Fallback to package manager
        print_status("Falling back to package manager installation...", "INFO")
        return install_ffmpeg_unix("linux")


def install_ffmpeg_macos(target_dir: Path, arch: str):
    """Install FFmpeg on macOS, preferring Homebrew."""
    # First try Homebrew
    if check_command_exists("brew"):
        print_status("Installing FFmpeg via Homebrew...", "INFO")
        if run_command("brew install ffmpeg", capture_output=False):
            print_status("FFmpeg installed successfully via Homebrew ✓", "SUCCESS")
            return True
    
    # If Homebrew fails, try direct download
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        
        ffmpeg_exe = target_dir / "ffmpeg"
        url = FFMPEG_URLS["macos"][arch]
        
        print_status("Downloading FFmpeg for macOS...", "INFO")
        
        # Download FFmpeg
        zip_path = LIB_DIR / "ffmpeg-macos.zip"
        urllib.request.urlretrieve(url, zip_path)
        
        print_status("Extracting FFmpeg...", "INFO")
        
        # Extract FFmpeg
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extract('ffmpeg', target_dir)
            # Make executable
            ffmpeg_exe.chmod(0o755)
        
        # Clean up zip file
        zip_path.unlink()
        
        # Verify installation
        if ffmpeg_exe.exists():
            print_status(f"FFmpeg installed successfully to {target_dir} ✓", "SUCCESS")
            return True
        else:
            print_status("FFmpeg installation failed", "ERROR")
            return False
            
    except Exception as e:
        print_status(f"Failed to install FFmpeg on macOS: {e}", "ERROR")
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
    
    # Update PATH for local FFmpeg installation
    ffmpeg_dir = get_ffmpeg_dir()
    if ffmpeg_dir.exists():
        system, arch = get_system_info()
        print_status(f"Note: FFmpeg installed to {ffmpeg_dir}", "INFO")
        print_status("You may need to add this directory to your PATH", "INFO")


def main():
    """Main setup function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="CantoCap Engine Environment Setup")
    parser.add_argument("--dev", action="store_true", help="Install development dependencies")
    parser.add_argument("--build-only", action="store_true", help="Build package instead of installing in dev mode")
    parser.add_argument("--ffmpeg-only", action="store_true", help="Install FFmpeg only")
    
    args = parser.parse_args()
    
    if args.ffmpeg_only:
        print_status("Installing FFmpeg only...", "INFO")
        if install_ffmpeg():
            print_status("FFmpeg installation completed successfully ✓", "SUCCESS")
            sys.exit(0)
        else:
            print_status("FFmpeg installation failed", "ERROR")
            sys.exit(1)
    elif args.build_only:
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