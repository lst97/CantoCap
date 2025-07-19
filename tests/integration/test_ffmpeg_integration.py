"""Integration tests for FFmpeg functionality."""

import pytest
import tempfile
import os
import shutil
from unittest.mock import Mock, patch

from cantosub.infrastructure.services import FFmpegService
from cantosub.infrastructure.repositories import FFmpegAudioRepository
from cantosub.domain.entities import MediaFile
from cantosub.domain.value_objects import AudioFormat


@pytest.mark.integration
class TestFFmpegIntegration:
    """Integration tests for FFmpeg service and repository."""
    
    def setup_method(self):
        """Setup test fixtures."""
        # Skip if FFmpeg not available
        self.ffmpeg_service = FFmpegService()
        if not self.ffmpeg_service.is_available():
            pytest.skip("FFmpeg not available for integration tests")
        
        self.audio_repository = FFmpegAudioRepository(self.ffmpeg_service)
    
    def test_ffmpeg_service_initialization(self):
        """Test FFmpeg service initialization."""
        assert self.ffmpeg_service.is_available()
        version = self.ffmpeg_service.get_version()
        assert version is not None
        assert isinstance(version, str)
    
    def test_get_media_info_with_real_audio(self):
        """Test getting media info from real audio file."""
        # Create a simple audio file using FFmpeg
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Generate a 1-second sine wave for testing
            import subprocess
            subprocess.run([
                "ffmpeg", "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
                "-ar", "16000", "-ac", "1", temp_path, "-y"
            ], check=True, capture_output=True)
            
            # Test getting media info
            info = self.ffmpeg_service.get_media_info(temp_path)
            assert "format" in info
            assert "streams" in info
            assert len(info["streams"]) > 0
            
            # Test getting duration
            duration = self.ffmpeg_service.get_audio_duration(temp_path)
            assert 0.9 <= duration <= 1.1  # Approximately 1 second
            
        except subprocess.CalledProcessError:
            pytest.skip("Cannot generate test audio file")
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def test_audio_extraction_with_mock_media_file(self):
        """Test audio extraction with mock input."""
        # Create a mock input file
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as input_file:
            input_file.write(b"fake video content")
            input_path = input_file.name
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as output_file:
            output_path = output_file.name
        
        try:
            # Remove output file so FFmpeg can create it
            os.unlink(output_path)
            
            # This will fail with real FFmpeg because input is not valid video
            # But we can test the service interface
            target_format = AudioFormat.WHISPER_FORMAT
            
            with pytest.raises(subprocess.CalledProcessError):
                self.ffmpeg_service.extract_audio(
                    input_path=input_path,
                    output_path=output_path,
                    target_format=target_format
                )
        finally:
            for path in [input_path, output_path]:
                if os.path.exists(path):
                    os.unlink(path)
    
    def test_validate_audio_file_format(self):
        """Test audio file format validation."""
        # Create a valid audio file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Generate test audio
            import subprocess
            subprocess.run([
                "ffmpeg", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.5",
                "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le",
                temp_path, "-y"
            ], check=True, capture_output=True)
            
            # Test validation
            expected_format = AudioFormat.WHISPER_FORMAT
            is_valid = self.ffmpeg_service.validate_audio_file(temp_path, expected_format)
            assert is_valid
            
        except subprocess.CalledProcessError:
            pytest.skip("Cannot generate test audio file")
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    @patch('cantosub.infrastructure.services.ffmpeg_service.ffmpeg')
    def test_audio_repository_extract_audio_mock(self, mock_ffmpeg):
        """Test audio repository with mocked FFmpeg."""
        # Mock FFmpeg operations
        mock_ffmpeg.input.return_value = Mock()
        mock_ffmpeg.output.return_value = Mock()
        mock_ffmpeg.run.return_value = None
        mock_ffmpeg.probe.return_value = {
            "format": {"duration": "10.5"},
            "streams": [{"codec_type": "audio", "sample_rate": "16000", "channels": 1}]
        }
        
        # Create a mock media file
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_file:
            temp_file.write(b"fake video content")
            temp_path = temp_file.name
        
        try:
            media_file = MediaFile.from_path(temp_path)
            target_format = AudioFormat.WHISPER_FORMAT
            
            # Mock the output file creation
            with patch('os.path.exists') as mock_exists:
                mock_exists.return_value = True
                
                with patch.object(self.ffmpeg_service, 'get_audio_duration') as mock_duration:
                    mock_duration.return_value = 10.5
                    
                    # Test extraction
                    audio_stream = self.audio_repository.extract_audio_from_media(
                        media_file=media_file,
                        target_format=target_format
                    )
                    
                    assert audio_stream is not None
                    assert audio_stream.get_duration_seconds() == 10.5
                    assert audio_stream.get_format() == target_format
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)