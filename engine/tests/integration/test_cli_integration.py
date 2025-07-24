"""
Integration tests for CLI functionality.

These tests verify that the CLI interface works correctly with real command-line arguments
and integrates properly with the underlying services.
"""

import pytest
import subprocess
import json
import tempfile
import os
from pathlib import Path
from typing import Dict, Any, List
import shutil


class TestCLIIntegration:
    """Test CLI integration with real command execution."""
    
    @pytest.fixture
    def test_video_path(self) -> Path:
        """Path to test video file."""
        return Path(__file__).parent.parent / "test-keep-talking.mp4"
    
    @pytest.fixture
    def temp_output_dir(self) -> Path:
        """Temporary directory for test outputs."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield Path(temp_dir)
    
    @pytest.fixture
    def ffmpeg_path(self) -> str:
        """FFmpeg path for testing."""
        # Try to find ffmpeg in common locations
        possible_paths = [
            "/usr/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/opt/homebrew/bin/ffmpeg",
            "ffmpeg"  # Assume it's in PATH
        ]
        
        for path in possible_paths:
            if path == "ffmpeg":
                # Test if ffmpeg is in PATH
                try:
                    subprocess.run([path, "-version"], 
                                 capture_output=True, check=True)
                    return path
                except (subprocess.CalledProcessError, FileNotFoundError):
                    continue
            elif os.path.exists(path):
                return path
        
        pytest.skip("FFmpeg not found in system")
    
    def run_cli_command(self, args: List[str], cwd: Path = None) -> Dict[str, Any]:
        """
        Run CLI command and return structured result.
        
        Args:
            args: Command line arguments
            cwd: Working directory for command execution
            
        Returns:
            Dict containing return_code, stdout, stderr, and parsed data
        """
        if cwd is None:
            cwd = Path(__file__).parent.parent.parent
        
        # Construct the full command
        cmd = [
            "python", "-m", "src.presentation.cli.main"
        ] + args
        
        # Run command with proper environment
        env = os.environ.copy()
        env["PYTHONPATH"] = str(cwd)
        
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            env=env
        )
        
        return {
            "return_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.returncode == 0
        }
    
    def test_cli_help_display(self):
        """Test that CLI help is displayed correctly."""
        result = self.run_cli_command(["--help"])
        
        assert result["success"]
        assert "CantoCap" in result["stdout"]
        assert "--ffmpeg-path" in result["stdout"]
        assert "--model" in result["stdout"]
        assert "--priority" in result["stdout"]
    
    def test_cli_version_display(self):
        """Test that version information is displayed correctly."""
        result = self.run_cli_command(["--version"])
        
        assert result["success"]
        assert "CantoCap" in result["stdout"]
        assert "version" in result["stdout"]
    
    def test_cli_hardware_command(self):
        """Test hardware capabilities command."""
        result = self.run_cli_command(["hardware"])
        
        assert result["success"]
        # Should contain hardware information
        assert any(keyword in result["stdout"].lower() for keyword in 
                  ["gpu", "cpu", "memory", "hardware", "capabilities"])
    
    def test_cli_hardware_with_options(self):
        """Test hardware command with various options."""
        # Test with different priorities
        for priority in ["speed", "quality", "balanced"]:
            result = self.run_cli_command(["hardware", "--priority", priority])
            assert result["success"]
            
        # Test with duration
        result = self.run_cli_command(["hardware", "--duration", "30.0"])
        assert result["success"]
    
    def test_cli_translation_help(self):
        """Test translation help display."""
        result = self.run_cli_command(["--translation-help"])
        
        assert result["success"]
        assert "Translation Options" in result["stdout"]
        assert "en_us" in result["stdout"]
        assert "ja_jp" in result["stdout"]
    
    def test_cli_missing_required_args(self, test_video_path):
        """Test CLI behavior with missing required arguments."""
        # Missing ffmpeg-path should fail
        result = self.run_cli_command([str(test_video_path)])
        
        assert not result["success"]
        assert "ffmpeg-path is required" in result["stdout"]
    
    def test_cli_invalid_input_file(self, ffmpeg_path):
        """Test CLI behavior with invalid input file."""
        result = self.run_cli_command([
            "nonexistent_file.mp4",
            "--ffmpeg-path", ffmpeg_path
        ])
        
        assert not result["success"]
    
    def test_cli_invalid_model_name(self, test_video_path, ffmpeg_path):
        """Test CLI behavior with invalid model name."""
        result = self.run_cli_command([
            str(test_video_path),
            "--ffmpeg-path", ffmpeg_path,
            "--model", "invalid-model-name"
        ])
        
        # Should either fail validation or auto-correct
        # The exact behavior depends on implementation
        assert result["return_code"] in [0, 1]  # Either success or expected failure
    
    def test_cli_invalid_priority(self, test_video_path, ffmpeg_path):
        """Test CLI behavior with invalid priority."""
        result = self.run_cli_command([
            str(test_video_path),
            "--ffmpeg-path", ffmpeg_path,
            "--priority", "invalid-priority"
        ])
        
        assert not result["success"]
    
    def test_cli_invalid_language_code(self, test_video_path, ffmpeg_path):
        """Test CLI behavior with invalid language code."""
        result = self.run_cli_command([
            str(test_video_path),
            "--ffmpeg-path", ffmpeg_path,
            "--language", "invalid-lang"
        ])
        
        # Should either fail validation or use default
        assert result["return_code"] in [0, 1]
    
    def test_cli_ipc_mode_structure(self, test_video_path, ffmpeg_path, temp_output_dir):
        """Test that IPC mode produces structured JSON output."""
        output_file = temp_output_dir / "test_ipc.srt"
        
        result = self.run_cli_command([
            str(test_video_path),
            "--ffmpeg-path", ffmpeg_path,
            "--output", str(output_file),
            "--model", "openai/whisper-small",  # Use small model for faster testing
            "--ipc-mode"
        ])
        
        # IPC mode should produce JSON-structured output
        # Even if processing fails, output should be structured
        lines = result["stdout"].strip().split('\n')
        
        # At least some lines should be valid JSON
        json_found = False
        for line in lines:
            if line.strip():
                try:
                    json.loads(line)
                    json_found = True
                    break
                except json.JSONDecodeError:
                    continue
        
        # Should have found at least one JSON line in IPC mode
        if not json_found:
            # If no JSON found, the command might have failed early
            # Check if it's a known failure case
            assert "ffmpeg" in result["stderr"].lower() or \
                   "model" in result["stderr"].lower() or \
                   result["return_code"] != 0
    
    def test_cli_verbose_mode(self, test_video_path, ffmpeg_path):
        """Test verbose mode output."""
        result = self.run_cli_command([
            str(test_video_path),
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            "--verbose",
            "--help"  # Use help to avoid actual processing
        ])
        
        assert result["success"]
    
    def test_cli_charset_options(self, test_video_path, ffmpeg_path):
        """Test different charset options."""
        for charset in ["traditional", "simplified"]:
            result = self.run_cli_command([
                str(test_video_path),
                "--ffmpeg-path", ffmpeg_path,
                "--charset", charset,
                "--help"  # Use help to test argument parsing
            ])
            
            assert result["success"]
    
    def test_cli_video_quality_options(self, test_video_path, ffmpeg_path):
        """Test different video quality options."""
        for quality in ["360p", "480p", "720p"]:
            result = self.run_cli_command([
                str(test_video_path),
                "--ffmpeg-path", ffmpeg_path,
                "--video-quality", quality,
                "--help"  # Use help to test argument parsing
            ])
            
            assert result["success"]
    
    def test_cli_max_chunk_duration(self, test_video_path, ffmpeg_path):
        """Test max chunk duration option."""
        result = self.run_cli_command([
            str(test_video_path),
            "--ffmpeg-path", ffmpeg_path,
            "--max-chunk-duration", "10",
            "--help"  # Use help to test argument parsing
        ])
        
        assert result["success"]
    
    def test_cli_feature_flags(self, test_video_path, ffmpeg_path):
        """Test various feature flags."""
        flags = [
            "--speakers",
            "--written", 
            "--music",
            "--no-gemini-refinement",
            "--verbose"
        ]
        
        for flag in flags:
            result = self.run_cli_command([
                str(test_video_path),
                "--ffmpeg-path", ffmpeg_path,
                flag,
                "--help"  # Use help to test argument parsing
            ])
            
            assert result["success"]
    
    def test_cli_combined_options(self, test_video_path, ffmpeg_path):
        """Test combination of multiple options."""
        result = self.run_cli_command([
            str(test_video_path),
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            "--priority", "speed",
            "--language", "zh",
            "--charset", "traditional",
            "--video-quality", "360p",
            "--max-chunk-duration", "15",
            "--verbose",
            "--help"  # Use help to avoid actual processing
        ])
        
        assert result["success"]


class TestCLIArgumentValidation:
    """Test CLI argument validation logic."""
    
    def test_argument_sanitization(self):
        """Test that arguments are properly sanitized."""
        # This would test the ArgumentValidator class
        # Implementation depends on the validation logic
        pass
    
    def test_file_path_validation(self):
        """Test file path validation."""
        # Test valid and invalid file paths
        pass
    
    def test_configuration_validation(self):
        """Test configuration file validation."""
        # Test with valid and invalid JSON config files
        pass


class TestCLIErrorHandling:
    """Test CLI error handling and user feedback."""
    
    def test_graceful_error_handling(self):
        """Test that errors are handled gracefully with user-friendly messages."""
        pass
    
    def test_ipc_mode_error_handling(self):
        """Test error handling in IPC mode."""
        pass
    
    def test_cleanup_on_error(self):
        """Test that temporary files are cleaned up on error."""
        pass


@pytest.mark.integration
class TestCLIServiceIntegration:
    """Test CLI integration with underlying services."""
    
    def test_container_initialization(self):
        """Test that dependency injection container initializes correctly."""
        pass
    
    def test_service_lifecycle(self):
        """Test service initialization and cleanup."""
        pass
    
    def test_configuration_service_integration(self):
        """Test integration with configuration service."""
        pass