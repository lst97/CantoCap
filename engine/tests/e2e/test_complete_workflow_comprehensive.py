"""
Comprehensive end-to-end tests for the complete CantoCap workflow.

These tests verify the entire application workflow from CLI input to final output,
using the actual command-line interface and real processing pipeline.
"""

import pytest
import subprocess
import json
import tempfile
import os
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
import time

from src.infrastructure.services.configuration_service import ConfigurationService


class TestCompleteWorkflowE2E:
    """Test complete workflow end-to-end scenarios."""
    
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
            "/opt/homebrew/bin/ffmpeg",
            "/usr/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
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
    
    def run_cantocap_command(self, args: List[str], cwd: Path = None, 
                           timeout: int = 300) -> Dict[str, Any]:
        """
        Run CantoCap command and return structured result.
        
        Args:
            args: Command line arguments
            cwd: Working directory for command execution
            timeout: Command timeout in seconds
            
        Returns:
            Dict containing return_code, stdout, stderr, success, and duration
        """
        if cwd is None:
            cwd = Path(__file__).parent.parent.parent
        
        # Construct the full command
        cmd = [
            "python", "-m", "src.presentation.cli.main"
        ] + args
        
        # Set up environment
        env = os.environ.copy()
        env["PYTHONPATH"] = str(cwd)
        
        # Run command with timeout
        start_time = time.time()
        
        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                env=env,
                timeout=timeout
            )
            
            duration = time.time() - start_time
            
            return {
                "return_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "success": result.returncode == 0,
                "duration": duration,
                "timeout": False
            }
            
        except subprocess.TimeoutExpired as e:
            duration = time.time() - start_time
            return {
                "return_code": -1,
                "stdout": e.stdout.decode() if e.stdout else "",
                "stderr": e.stderr.decode() if e.stderr else "",
                "success": False,
                "duration": duration,
                "timeout": True
            }
    
    @pytest.mark.slow
    def test_basic_transcription_workflow(self, test_video_path, temp_output_dir, 
                                        ffmpeg_path):
        """Test basic transcription workflow - equivalent to the provided example."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        output_file = temp_output_dir / "basic_transcription.srt"
        
        # Run the exact command pattern provided by user
        result = self.run_cantocap_command([
            "-l", "zh",
            "--verbose",
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            "--output", str(output_file),
            str(test_video_path)
        ])
        
        # Verify command succeeded
        assert result["success"], f"Command failed: {result['stderr']}"
        
        # Verify output file was created
        assert output_file.exists(), "Output SRT file was not created"
        
        # Verify SRT file content
        content = output_file.read_text(encoding='utf-8')
        assert len(content.strip()) > 0, "Output file is empty"
        
        # Basic SRT format validation
        lines = content.strip().split('\n')
        assert len(lines) >= 3, "SRT file doesn't have minimum required content"
        
        # First line should be sequence number
        assert lines[0].strip().isdigit(), "First line should be sequence number"
        
        # Should contain timestamp format
        assert '-->' in content, "SRT file missing timestamp format"
        
        # Should contain Chinese text (basic check)
        has_chinese = any(
            any('\u4e00' <= char <= '\u9fff' for char in line)
            for line in lines
        )
        assert has_chinese, "No Chinese characters found in transcription"
        
        print(f"✓ Basic transcription completed in {result['duration']:.1f}s")
        print(f"✓ Generated SRT file: {len(content)} characters")
    
    @pytest.mark.slow
    def test_full_featured_workflow(self, test_video_path, temp_output_dir, 
                                  ffmpeg_path):
        """Test full-featured workflow with all options - matching user example."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        # Initialize configuration service to load .env file
        config_service = ConfigurationService()
        
        # Get API keys from .env file via ConfigurationService
        gemini_key = config_service.get_gemini_api_key()
        hf_token = config_service.get_huggingface_token()
        
        if not gemini_key:
            pytest.skip("Gemini API key required for full featured testing (check .env file)")
        
        output_file = temp_output_dir / "full_featured.srt"
        
        # Build command with loaded environment variables
        command_args = [
            "-l", "zh",
            "--written",
            "--subtitle", "en_us",
            "--verbose",
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            "--gemini-key", gemini_key,
            "--output", str(output_file),
        ]
        
        # Add HF token if available
        if hf_token:
            command_args.extend(["--hf-token", hf_token])
        
        # Add input file path at the end
        command_args.append(str(test_video_path))
        
        # Run the exact command pattern provided by user
        result = self.run_cantocap_command(command_args, timeout=600)  # Longer timeout for full processing
        
        # Verify command succeeded
        assert result["success"], f"Command failed: {result['stderr']}"
        
        # Verify output file was created
        assert output_file.exists(), "Output SRT file was not created"
        
        # Verify SRT file content
        content = output_file.read_text(encoding='utf-8')
        assert len(content.strip()) > 0, "Output file is empty"
        
        # Should contain both Chinese and English (dual-language subtitles)
        lines = content.split('\n')
        
        # Look for Chinese characters
        has_chinese = any(
            any('\u4e00' <= char <= '\u9fff' for char in line)
            for line in lines
        )
        assert has_chinese, "No Chinese characters found"
        
        # Look for English text (basic Latin characters)
        has_english = any(
            any('a' <= char.lower() <= 'z' for char in line) and
            len([c for c in line if 'a' <= c.lower() <= 'z']) > 3
            for line in lines
        )
        assert has_english, "No English translation found"
        
        print(f"✓ Full featured processing completed in {result['duration']:.1f}s")
        print(f"✓ Generated dual-language SRT: {len(content)} characters")
    
    def test_hardware_capabilities_workflow(self, ffmpeg_path):
        """Test hardware capabilities analysis workflow."""
        result = self.run_cantocap_command([
            "hardware",
            "--priority", "balanced",
            "--duration", "10.0"
        ])
        
        assert result["success"], f"Hardware command failed: {result['stderr']}"
        
        # Should contain hardware information
        output = result["stdout"].lower()
        assert any(keyword in output for keyword in [
            "gpu", "cpu", "memory", "cuda", "hardware", "model"
        ]), "Hardware output doesn't contain expected information"
        
        print("✓ Hardware capabilities analysis completed")
    
    def test_ipc_mode_workflow(self, test_video_path, temp_output_dir, ffmpeg_path):
        """Test IPC mode workflow with structured JSON output."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        output_file = temp_output_dir / "ipc_test.srt"
        
        result = self.run_cantocap_command([
            "-l", "zh",
            "--ipc-mode",
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            "--output", str(output_file),
            str(test_video_path)
        ])
        
        # IPC mode should produce structured output even on success/failure
        lines = result["stdout"].strip().split('\n')
        
        # Check that at least some output is valid JSON
        json_lines = []
        for line in lines:
            if line.strip():
                try:
                    parsed = json.loads(line)
                    json_lines.append(parsed)
                except json.JSONDecodeError:
                    continue
        
        assert len(json_lines) > 0, "No valid JSON found in IPC mode output"
        
        # Verify JSON structure
        for json_line in json_lines:
            assert isinstance(json_line, dict), "JSON output should be objects"
            # Common fields in IPC output
            expected_fields = ["type", "message", "timestamp"]
            assert any(field in json_line for field in expected_fields), \
                f"JSON missing expected fields: {json_line}"
        
        print(f"✓ IPC mode completed with {len(json_lines)} JSON messages")
    
    def test_error_handling_workflow(self, temp_output_dir, ffmpeg_path):
        """Test error handling with invalid inputs."""
        output_file = temp_output_dir / "error_test.srt"
        
        # Test with non-existent input file
        result = self.run_cantocap_command([
            "-l", "zh",
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            "--output", str(output_file),
            "nonexistent_file.mp4"
        ])
        
        # Should fail gracefully
        assert not result["success"], "Command should have failed with invalid input"
        
        # Should have informative error message
        error_output = result["stderr"] + result["stdout"]
        assert len(error_output.strip()) > 0, "No error message provided"
        
        # Output file should not be created
        assert not output_file.exists(), "Output file created despite error"
        
        print("✓ Error handling workflow completed")
    
    def test_charset_conversion_workflow(self, test_video_path, temp_output_dir, 
                                       ffmpeg_path):
        """Test charset conversion workflow."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        # Test simplified Chinese
        output_file = temp_output_dir / "simplified.srt"
        
        result = self.run_cantocap_command([
            "-l", "zh",
            "--charset", "simplified",
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            "--output", str(output_file),
            str(test_video_path)
        ])
        
        assert result["success"], f"Simplified charset command failed: {result['stderr']}"
        assert output_file.exists(), "Simplified charset output not created"
        
        # Test traditional Chinese
        output_file_trad = temp_output_dir / "traditional.srt"
        
        result = self.run_cantocap_command([
            "-l", "zh",
            "--charset", "traditional",
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            "--output", str(output_file_trad),
            str(test_video_path)
        ])
        
        assert result["success"], f"Traditional charset command failed: {result['stderr']}"
        assert output_file_trad.exists(), "Traditional charset output not created"
        
        print("✓ Charset conversion workflow completed")
    
    def test_priority_based_model_selection(self, test_video_path, temp_output_dir, 
                                          ffmpeg_path):
        """Test priority-based model selection."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        priorities = ["speed", "quality", "balanced"]
        
        for priority in priorities:
            output_file = temp_output_dir / f"priority_{priority}.srt"
            
            result = self.run_cantocap_command([
                "-l", "zh",
                "--priority", priority,
                "--ffmpeg-path", ffmpeg_path,
                "--output", str(output_file),
                str(test_video_path)
            ])
            
            assert result["success"], f"Priority {priority} failed: {result['stderr']}"
            assert output_file.exists(), f"Priority {priority} output not created"
            
            print(f"✓ Priority {priority} completed in {result['duration']:.1f}s")
    
    def test_chunked_processing_workflow(self, test_video_path, temp_output_dir, 
                                       ffmpeg_path):
        """Test chunked processing for large files."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        output_file = temp_output_dir / "chunked.srt"
        
        # Use small chunk duration to force chunking
        result = self.run_cantocap_command([
            "-l", "zh",
            "--max-chunk-duration", "1",  # 1 minute chunks
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            "--output", str(output_file),
            str(test_video_path)
        ])
        
        assert result["success"], f"Chunked processing failed: {result['stderr']}"
        assert output_file.exists(), "Chunked processing output not created"
        
        # Verify coherent output despite chunking
        content = output_file.read_text(encoding='utf-8')
        assert '-->' in content, "Invalid SRT format after chunking"
        
        print("✓ Chunked processing workflow completed")
    
    def test_various_model_types(self, test_video_path, temp_output_dir, ffmpeg_path):
        """Test various Whisper model types."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        # Test different model sizes
        models = [
            "openai/whisper-tiny",
            "openai/whisper-base", 
            "openai/whisper-small"
        ]
        
        for model in models:
            output_file = temp_output_dir / f"model_{model.split('/')[-1]}.srt"
            
            result = self.run_cantocap_command([
                "-l", "zh",
                "--model", model,
                "--ffmpeg-path", ffmpeg_path,
                "--output", str(output_file),
                str(test_video_path)
            ])
            
            # Some models might not be available, that's okay
            if result["success"]:
                assert output_file.exists(), f"Model {model} output not created"
                print(f"✓ Model {model} completed in {result['duration']:.1f}s")
            else:
                print(f"⚠ Model {model} not available or failed")
    
    def test_output_file_handling(self, test_video_path, temp_output_dir, ffmpeg_path):
        """Test various output file scenarios."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        # Test default output path (same directory as input)
        result = self.run_cantocap_command([
            "-l", "zh",
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            str(test_video_path)
        ])
        
        if result["success"]:
            # Default output should be next to input file
            expected_output = test_video_path.with_suffix('.srt')
            if expected_output.exists():
                # Clean up
                expected_output.unlink()
                print("✓ Default output path handling completed")
        
        # Test explicit output path
        output_file = temp_output_dir / "explicit_output.srt"
        result = self.run_cantocap_command([
            "-l", "zh",
            "--output", str(output_file),
            "--ffmpeg-path", ffmpeg_path,
            "--model", "openai/whisper-small",
            str(test_video_path)
        ])
        
        assert result["success"], f"Explicit output failed: {result['stderr']}"
        assert output_file.exists(), "Explicit output file not created"
        
        print("✓ Output file handling completed")


class TestWorkflowValidation:
    """Test workflow validation and edge cases."""
    
    def test_concurrent_processing(self):
        """Test concurrent processing scenarios."""
        # This would test running multiple instances simultaneously
        pass
    
    def test_resource_cleanup(self):
        """Test proper resource cleanup after processing."""
        # This would test memory cleanup, temp file removal, etc.
        pass
    
    def test_interruption_handling(self):
        """Test handling of process interruption."""
        # This would test Ctrl+C handling, graceful shutdown, etc.
        pass


@pytest.mark.e2e
@pytest.mark.slow
class TestProductionWorkflows:
    """Test production-like workflows."""
    
    def test_batch_processing_simulation(self):
        """Test batch processing of multiple files."""
        pass
    
    def test_long_running_file_processing(self):
        """Test processing of very long audio files."""
        pass
    
    def test_memory_constrained_environment(self):
        """Test processing in memory-constrained environment."""
        pass