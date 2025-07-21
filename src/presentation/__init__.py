"""Presentation layer for CantoCap - CLI interface and dependency injection."""

from .cli.main import app
from .di.container import Container

__all__ = ["app", "Container"]