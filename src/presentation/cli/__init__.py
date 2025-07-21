"""CLI module for CantoCap."""

from .main import app
from .commands import generate_command

__all__ = ["app", "generate_command"]