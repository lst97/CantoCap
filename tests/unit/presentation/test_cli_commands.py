"""Tests for CLI commands and flag parsing."""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from typer.testing import CliRunner
import inspect

from src.presentation.cli.main import app
from src.presentation.cli.commands import generate_command


class TestCLIFlagParsing:
    """Test suite for CLI flag parsing and parameter passing."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.runner = CliRunner()
        
    def test_ipc_mode_flag_in_generate_command_signature(self):
        """Test that generate_command function has ipc_mode parameter in its signature."""
        sig = inspect.signature(generate_command)
        assert 'ipc_mode' in sig.parameters
        param = sig.parameters['ipc_mode']
        # For Typer functions, the default is wrapped in OptionInfo, check the actual default
        assert hasattr(param.default, 'default')
        assert param.default.default is False  # Should default to False
        
    def test_ipc_mode_flag_help_text(self):
        """Test that --ipc-mode flag shows up in help text."""
        result = self.runner.invoke(app, ["generate", "--help"])
        assert "--ipc-mode" in result.stdout
        assert "machine-readable JSON output" in result.stdout
        
    def test_main_callback_has_ipc_mode_parameter(self):
        """Test that main callback function has ipc_mode parameter in its signature."""
        from src.presentation.cli.main import main
        sig = inspect.signature(main)
        assert 'ipc_mode' in sig.parameters
        param = sig.parameters['ipc_mode']
        # For Typer functions, the default is wrapped in OptionInfo, check the actual default
        assert hasattr(param.default, 'default')
        assert param.default.default is False  # Should default to False


class TestCLIParameterPassing:
    """Test suite for CLI parameter passing through the call chain."""
    
    def test_helper_function_signatures_accept_ipc_mode(self):
        """Test that helper functions have ipc_mode parameter in their signatures."""
        from src.presentation.cli.commands import _display_file_info, _display_results, _execute_with_enhanced_progress
        
        # Test _display_file_info signature
        sig = inspect.signature(_display_file_info)
        assert 'ipc_mode' in sig.parameters
        param = sig.parameters['ipc_mode']
        assert param.default is False
        
        # Test _display_results signature
        sig = inspect.signature(_display_results)
        assert 'ipc_mode' in sig.parameters
        param = sig.parameters['ipc_mode']
        assert param.default is False
        
        # Test _execute_with_enhanced_progress signature
        sig = inspect.signature(_execute_with_enhanced_progress)
        assert 'ipc_mode' in sig.parameters
        param = sig.parameters['ipc_mode']
        assert param.default is False


if __name__ == "__main__":
    pytest.main([__file__])