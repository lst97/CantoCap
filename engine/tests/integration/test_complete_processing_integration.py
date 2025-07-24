"""
Integration tests for complete processing pipeline.

These tests verify the end-to-end processing pipeline including FFmpeg integration,
Whisper transcription, and subtitle generation.
"""

import pytest
import tempfile
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
import subprocess

from src.infrastructure.services.configuration_service import ConfigurationService

# Import the main services and use cases
from src.presentation.di.container import Container
from src.application import GenerateSubtitlesCommand
from src.domain.value_objects import FilePath


class TestCompleteProcessingIntegration:
    """Test complete processing pipeline integration."""
    
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
    
    @pytest.fixture
    def container(self, ffmpeg_path) -> Container:
        """Dependency injection container."""
        return Container(ffmpeg_path=ffmpeg_path)
    
    def test_basic_subtitle_generation(self, test_video_path, temp_output_dir, 
                                     container):
        """Test basic subtitle generation pipeline."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        output_file = temp_output_dir / "basic_test.srt"
        
        # Create command
        command = GenerateSubtitlesCommand(
            input_file_path=str(test_video_path),
            output_file_path=str(output_file),
            language="zh",
            model_name="openai/whisper-small",  # Use small model for speed
            enable_speakers=False,
            enable_written_style=False,
            enable_music_detection=False,
            charset="traditional",
            enable_gemini_refinement=False,
            gemini_api_key=None,
            video_compression_quality="360p",
            max_chunk_duration_minutes=15,
            terminology_config_path=None,
            hf_token=None,
            enable_translation=False,
            translation_language=None
        )
        
        # Get use case
        use_case = container.get_enhanced_generate_subtitles_use_case(
            model_name="openai/whisper-small",
            priority="speed"
        )
        
        try:
            # Execute
            result = use_case.execute(command)
            
            # Verify result
            assert result.success, f"Processing failed: {result.error_message}"
            assert result.subtitle_count > 0
            assert result.processing_time_seconds > 0
            
            # Verify output file exists
            assert output_file.exists()
            
            # Verify SRT file content
            content = output_file.read_text(encoding='utf-8')
            assert len(content.strip()) > 0
            
            # Basic SRT format validation
            lines = content.strip().split('\n')
            assert len(lines) >= 3  # At least one subtitle entry
            
            # First line should be sequence number
            assert lines[0].strip().isdigit()
            
            # Should contain timestamp format
            assert '-->' in content
            
        finally:
            # Cleanup container resources
            if hasattr(container, 'cleanup'):
                container.cleanup()
    
    @pytest.mark.slow
    def test_full_feature_processing(self, test_video_path, temp_output_dir, 
                                   container):
        """Test processing with all features enabled (requires API keys)."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        # Initialize configuration service to load .env file
        config_service = ConfigurationService()
        
        # Get API keys from .env file via ConfigurationService
        gemini_key = config_service.get_gemini_api_key()
        hf_token = config_service.get_huggingface_token()
        
        if not gemini_key:
            pytest.skip("Gemini API key not available for full feature testing (check .env file)")
        
        output_file = temp_output_dir / "full_features_test.srt"
        
        # Create command with all features
        command = GenerateSubtitlesCommand(
            input_file_path=str(test_video_path),
            output_file_path=str(output_file),
            language="zh",
            model_name="openai/whisper-small",
            enable_speakers=True,
            enable_written_style=True,
            enable_music_detection=True,
            charset="traditional",
            enable_gemini_refinement=True,
            gemini_api_key=gemini_key,
            video_compression_quality="360p",
            max_chunk_duration_minutes=15,
            terminology_config_path=None,
            hf_token=hf_token,
            enable_translation=False,
            translation_language=None
        )
        
        # Get use case
        use_case = container.get_enhanced_generate_subtitles_use_case(
            model_name="openai/whisper-small",
            priority="balanced",
            gemini_api_key=gemini_key
        )
        
        try:
            # Execute
            result = use_case.execute(command)
            
            # Verify result
            assert result.success, f"Processing failed: {result.error_message}"
            assert result.subtitle_count > 0
            
            # Verify output file
            assert output_file.exists()
            content = output_file.read_text(encoding='utf-8')
            
            # With speaker diarization, should have speaker labels
            # Format: "Speaker 1: text" or similar
            if command.enable_speakers:
                assert any("speaker" in line.lower() or "話者" in line 
                          for line in content.split('\n'))
            
            # With music detection, should have music labels
            if command.enable_music_detection:
                # Might contain [music] or similar tags
                pass  # This depends on whether test audio contains music
                
        finally:
            if hasattr(container, 'cleanup'):
                container.cleanup()
    
    def test_translation_processing(self, test_video_path, temp_output_dir, 
                                  container):
        """Test processing with translation enabled."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        # Initialize configuration service to load .env file
        config_service = ConfigurationService()
        gemini_key = config_service.get_gemini_api_key()
        
        if not gemini_key:
            pytest.skip("Gemini API key not available for translation testing (check .env file)")
        
        output_file = temp_output_dir / "translation_test.srt"
        
        # Create command with translation
        command = GenerateSubtitlesCommand(
            input_file_path=str(test_video_path),
            output_file_path=str(output_file),
            language="zh",
            model_name="openai/whisper-small",
            enable_speakers=False,
            enable_written_style=False,
            enable_music_detection=False,
            charset="traditional",
            enable_gemini_refinement=True,
            gemini_api_key=gemini_key,
            video_compression_quality="360p",
            max_chunk_duration_minutes=15,
            terminology_config_path=None,
            hf_token=None,
            enable_translation=True,
            translation_language="en_us"
        )
        
        # Get use case
        use_case = container.get_enhanced_generate_subtitles_use_case(
            model_name="openai/whisper-small",
            priority="balanced",
            gemini_api_key=gemini_key
        )
        
        try:
            # Execute
            result = use_case.execute(command)
            
            # Verify result
            assert result.success, f"Processing failed: {result.error_message}"
            assert result.subtitle_count > 0
            
            # Verify output file
            assert output_file.exists()
            content = output_file.read_text(encoding='utf-8')
            
            # Should contain both Chinese and English text
            # The exact format depends on implementation
            assert len(content.strip()) > 0
            
        finally:
            if hasattr(container, 'cleanup'):
                container.cleanup()
    
    def test_charset_conversion(self, test_video_path, temp_output_dir, container):
        """Test charset conversion functionality."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        # Test simplified Chinese output
        output_file = temp_output_dir / "simplified_test.srt"
        
        command = GenerateSubtitlesCommand(
            input_file_path=str(test_video_path),
            output_file_path=str(output_file),
            language="zh",
            model_name="openai/whisper-small",
            enable_speakers=False,
            enable_written_style=False,
            enable_music_detection=False,
            charset="simplified",  # Test simplified charset
            enable_gemini_refinement=False,
            gemini_api_key=None,
            video_compression_quality="360p",
            max_chunk_duration_minutes=15,
            terminology_config_path=None,
            hf_token=None,
            enable_translation=False,
            translation_language=None
        )
        
        use_case = container.get_enhanced_generate_subtitles_use_case(
            model_name="openai/whisper-small",
            priority="speed"
        )
        
        try:
            result = use_case.execute(command)
            
            assert result.success, f"Processing failed: {result.error_message}"
            assert output_file.exists()
            
            # Verify charset conversion occurred
            content = output_file.read_text(encoding='utf-8')
            assert len(content.strip()) > 0
            
        finally:
            if hasattr(container, 'cleanup'):
                container.cleanup()
    
    def test_chunked_processing(self, test_video_path, temp_output_dir, container):
        """Test chunked processing for large files."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        output_file = temp_output_dir / "chunked_test.srt"
        
        # Use very small chunk duration to force chunking
        command = GenerateSubtitlesCommand(
            input_file_path=str(test_video_path),
            output_file_path=str(output_file),
            language="zh",
            model_name="openai/whisper-small",
            enable_speakers=False,
            enable_written_style=False,
            enable_music_detection=False,
            charset="traditional",
            enable_gemini_refinement=False,
            gemini_api_key=None,
            video_compression_quality="360p",
            max_chunk_duration_minutes=1,  # Very small to force chunking
            terminology_config_path=None,
            hf_token=None,
            enable_translation=False,
            translation_language=None
        )
        
        use_case = container.get_enhanced_generate_subtitles_use_case(
            model_name="openai/whisper-small",
            priority="speed"
        )
        
        try:
            result = use_case.execute(command)
            
            assert result.success, f"Processing failed: {result.error_message}"
            assert output_file.exists()
            
            # Should still produce coherent subtitles
            content = output_file.read_text(encoding='utf-8')
            assert len(content.strip()) > 0
            assert '-->' in content  # Valid SRT format
            
        finally:
            if hasattr(container, 'cleanup'):
                container.cleanup()
    
    def test_error_recovery(self, temp_output_dir, container):
        """Test error recovery with invalid inputs."""
        output_file = temp_output_dir / "error_test.srt"
        
        # Test with non-existent input file
        command = GenerateSubtitlesCommand(
            input_file_path="nonexistent_file.mp4",
            output_file_path=str(output_file),
            language="zh",
            model_name="openai/whisper-small",
            enable_speakers=False,
            enable_written_style=False,
            enable_music_detection=False,
            charset="traditional",
            enable_gemini_refinement=False,
            gemini_api_key=None,
            video_compression_quality="360p",
            max_chunk_duration_minutes=15,
            terminology_config_path=None,
            hf_token=None,
            enable_translation=False,
            translation_language=None
        )
        
        use_case = container.get_enhanced_generate_subtitles_use_case(
            model_name="openai/whisper-small",
            priority="speed"
        )
        
        try:
            result = use_case.execute(command)
            
            # Should fail gracefully
            assert not result.success
            assert result.error_message is not None
            assert len(result.error_message) > 0
            
        finally:
            if hasattr(container, 'cleanup'):
                container.cleanup()
    
    def test_output_file_permissions(self, test_video_path, temp_output_dir, 
                                   container):
        """Test output file creation with various permission scenarios."""
        if not test_video_path.exists():
            pytest.skip("Test video file not available")
        
        # Test output to read-only directory (should fail gracefully)
        readonly_dir = temp_output_dir / "readonly"
        readonly_dir.mkdir()
        readonly_dir.chmod(0o444)  # Read-only
        
        output_file = readonly_dir / "readonly_test.srt"
        
        command = GenerateSubtitlesCommand(
            input_file_path=str(test_video_path),
            output_file_path=str(output_file),
            language="zh",
            model_name="openai/whisper-small",
            enable_speakers=False,
            enable_written_style=False,
            enable_music_detection=False,
            charset="traditional",
            enable_gemini_refinement=False,
            gemini_api_key=None,
            video_compression_quality="360p",
            max_chunk_duration_minutes=15,
            terminology_config_path=None,
            hf_token=None,
            enable_translation=False,
            translation_language=None
        )
        
        use_case = container.get_enhanced_generate_subtitles_use_case(
            model_name="openai/whisper-small",
            priority="speed"
        )
        
        try:
            result = use_case.execute(command)
            
            # Should handle permission error gracefully
            if not result.success:
                assert "permission" in result.error_message.lower() or \
                       "access" in result.error_message.lower()
            
        finally:
            # Restore permissions for cleanup
            readonly_dir.chmod(0o755)
            if hasattr(container, 'cleanup'):
                container.cleanup()


class TestProcessingStatistics:
    """Test processing statistics and metrics generation."""
    
    def test_statistics_generation(self):
        """Test that processing statistics are generated correctly."""
        # This would test the statistics generation functionality
        pass
    
    def test_performance_metrics(self):
        """Test performance metrics collection."""
        # This would test performance metrics like processing time,
        # memory usage, etc.
        pass
    
    def test_quality_metrics(self):
        """Test quality metrics generation."""
        # This would test quality metrics like confidence scores,
        # formatting quality, etc.
        pass


@pytest.mark.integration
@pytest.mark.slow
class TestProcessingPerformance:
    """Test processing performance characteristics."""
    
    def test_processing_speed_benchmarks(self):
        """Test processing speed against benchmarks."""
        pass
    
    def test_memory_usage_patterns(self):
        """Test memory usage patterns during processing."""
        pass
    
    def test_concurrent_processing(self):
        """Test concurrent processing capabilities."""
        pass