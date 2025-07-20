"""
Integration tests for IPC error handling.
"""

import json
import pytest
import tempfile
from pathlib import Path
from typer.testing import CliRunner
from unittest.mock import patch

from src.presentation.cli.main import app


class TestIPCErrorIntegration:
    """Integration tests for IPC error handling in CLI."""
    
    def setup_method(self):
        """Setup for each test method."""
        self.runner = CliRunner()
    
    def test_ipc_error_for_missing_file(self):
        """Test that missing file error is output as JSON in IPC mode."""
        # Try to process a non-existent file
        result = self.runner.invoke(app, [
            "--ipc-mode",
            "nonexistent_file.mp4"
        ])
        
        # Should exit with error code
        assert result.exit_code != 0
        
        # Should output JSON error
        lines = result.stdout.strip().split('\n')
        json_output = None
        for line in lines:
            if line.strip():
                try:
                    json_data = json.loads(line)
                    if json_data.get("type") == "error":
                        json_output = json_data
                        break
                except json.JSONDecodeError:
                    continue
        
        assert json_output is not None, f"No JSON error found in output: {result.stdout}"
        assert json_output["type"] == "error"
        assert "error" in json_output["data"]
        assert "File does not exist" in json_output["data"]["error"] or "not found" in json_output["data"]["error"].lower()
    
    def test_ipc_error_for_invalid_file_format(self):
        """Test that invalid file format error is output as JSON in IPC mode."""
        # Create a temporary text file (not audio/video)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is not an audio file")
            temp_file = Path(f.name)
        
        try:
            result = self.runner.invoke(app, [
                "--ipc-mode",
                str(temp_file)
            ])
            
            # Should have some output (might be warning or error)
            assert result.stdout.strip()
            
            # Check for JSON output
            lines = result.stdout.strip().split('\n')
            json_outputs = []
            for line in lines:
                if line.strip():
                    try:
                        json_data = json.loads(line)
                        json_outputs.append(json_data)
                    except json.JSONDecodeError:
                        continue
            
            # Should have at least one JSON message
            assert len(json_outputs) > 0, f"No JSON output found: {result.stdout}"
            
            # Should have either error or warning about file format
            has_format_message = False
            for json_data in json_outputs:
                if json_data.get("type") in ["error", "log"]:
                    message = json_data.get("data", {}).get("error", "") or json_data.get("data", {}).get("message", "")
                    if "extension" in message.lower() or "format" in message.lower() or "supported" in message.lower():
                        has_format_message = True
                        break
            
            assert has_format_message, f"No format-related message found in: {json_outputs}"
            
        finally:
            # Clean up
            temp_file.unlink(missing_ok=True)
    
    def test_ipc_mode_preserves_error_structure(self):
        """Test that IPC mode preserves error structure and context."""
        # Test with a file that doesn't exist to trigger validation error
        result = self.runner.invoke(app, [
            "--ipc-mode",
            "/path/that/does/not/exist.mp4"
        ])
        
        assert result.exit_code != 0
        
        # Parse JSON output
        lines = result.stdout.strip().split('\n')
        error_json = None
        for line in lines:
            if line.strip():
                try:
                    json_data = json.loads(line)
                    if json_data.get("type") == "error":
                        error_json = json_data
                        break
                except json.JSONDecodeError:
                    continue
        
        assert error_json is not None
        assert error_json["type"] == "error"
        assert "timestamp" in error_json
        assert "data" in error_json
        
        error_data = error_json["data"]
        assert "error" in error_data
        assert "context" in error_data
        
        # Should have context about input file validation
        assert "validation" in error_data["context"].lower() or "input" in error_data["context"].lower()
    
    @patch('src.infrastructure.error_handling._rich_available', False)
    def test_ipc_error_fallback_without_rich(self):
        """Test that IPC error handling works even when Rich is not available."""
        result = self.runner.invoke(app, [
            "--ipc-mode",
            "nonexistent.mp4"
        ])
        
        assert result.exit_code != 0
        
        # Should still output JSON even without Rich
        lines = result.stdout.strip().split('\n')
        has_json_error = False
        for line in lines:
            if line.strip():
                try:
                    json_data = json.loads(line)
                    if json_data.get("type") == "error":
                        has_json_error = True
                        break
                except json.JSONDecodeError:
                    continue
        
        assert has_json_error, f"No JSON error found in output: {result.stdout}"
    
    def test_normal_mode_still_works(self):
        """Test that normal mode (non-IPC) still works correctly."""
        result = self.runner.invoke(app, [
            "nonexistent.mp4"
            # No --ipc-mode flag
        ])
        
        assert result.exit_code != 0
        
        # Should not output JSON in normal mode
        lines = result.stdout.strip().split('\n')
        for line in lines:
            if line.strip():
                try:
                    json.loads(line)
                    # If we can parse as JSON, that's unexpected in normal mode
                    pytest.fail(f"Unexpected JSON output in normal mode: {line}")
                except json.JSONDecodeError:
                    # This is expected - should not be JSON
                    pass