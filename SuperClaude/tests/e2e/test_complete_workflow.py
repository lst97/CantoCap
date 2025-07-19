"""End-to-end tests for complete subtitle generation workflow."""

import pytest
import tempfile
import os
import subprocess
from unittest.mock import Mock, patch

from cantosub.application.commands import GenerateSubtitlesCommand
from cantosub.presentation.di.container import Container


@pytest.mark.e2e
class TestCompleteWorkflow:
    """End-to-end tests for complete subtitle generation."""
    
    def setup_method(self):
        """Setup test environment."""
        self.container = Container()
        
        # Check if required tools are available
        ffmpeg_service = self.container.get_ffmpeg_service()
        if not ffmpeg_service.is_available():
            pytest.skip("FFmpeg not available for E2E tests")
    
    def teardown_method(self):
        """Cleanup after tests."""
        self.container.cleanup()
    
    def test_complete_workflow_with_mock_whisper(self):
        """Test complete workflow with mocked Whisper to avoid model download."""
        # Create a test audio file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as audio_file:
            audio_path = audio_file.name
        
        with tempfile.NamedTemporaryFile(suffix=".srt", delete=False) as srt_file:
            srt_path = srt_file.name
        
        try:
            # Generate a short test audio file (0.5 seconds)
            subprocess.run([
                "ffmpeg", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.5",
                "-ar", "16000", "-ac", "1", audio_path, "-y"
            ], check=True, capture_output=True)
            
            # Remove SRT file so it can be created
            os.unlink(srt_path)
            
            # Mock Whisper service to avoid downloading model
            whisper_service = self.container.get_whisper_service()
            
            with patch.object(whisper_service, 'load_model') as mock_load:
                mock_load.return_value = True
                
                with patch.object(whisper_service, 'is_model_loaded') as mock_loaded:
                    mock_loaded.return_value = True
                    
                    with patch.object(whisper_service, 'transcribe_audio_file') as mock_transcribe:
                        # Mock transcription result
                        mock_transcribe.return_value = {
                            "text": "這是測試音頻",  # "This is test audio" in Chinese
                            "language": "zh",
                            "chunks": [
                                {
                                    "text": "這是測試音頻",
                                    "timestamp": [0.0, 0.5]
                                }
                            ],
                            "duration": 0.5
                        }
                        
                        # Create command
                        command = GenerateSubtitlesCommand(
                            input_file_path=audio_path,
                            output_file_path=srt_path,
                            language="zh"
                        )
                        
                        # Execute use case
                        use_case = self.container.get_generate_subtitles_use_case()
                        result = use_case.execute(command)
                        
                        # Verify success
                        assert result.success
                        assert result.subtitle_count > 0
                        assert result.output_file_path == srt_path
                        assert result.processing_time_seconds > 0
                        
                        # Verify SRT file was created
                        assert os.path.exists(srt_path)
                        
                        # Verify SRT file content
                        with open(srt_path, 'r', encoding='utf-8') as f:
                            srt_content = f.read()
                        
                        assert "這是測試音頻" in srt_content
                        assert "00:00:00,000" in srt_content  # Start time
                        assert "00:00:00,500" in srt_content  # End time
        
        except subprocess.CalledProcessError:
            pytest.skip("Cannot generate test audio file")
        finally:
            # Cleanup
            for path in [audio_path, srt_path]:
                if os.path.exists(path):
                    os.unlink(path)
    
    def test_workflow_with_invalid_input_file(self):
        """Test workflow with invalid input file."""
        command = GenerateSubtitlesCommand(
            input_file_path="/nonexistent/file.mp4"
        )
        
        use_case = self.container.get_generate_subtitles_use_case()
        result = use_case.execute(command)
        
        # Should fail gracefully
        assert not result.success
        assert result.error_message is not None
        assert "File not found" in result.error_message or "validation failed" in result.error_message
    
    def test_workflow_with_unsupported_file_format(self):
        """Test workflow with unsupported file format."""
        # Create a text file with unsupported extension
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as temp_file:
            temp_file.write(b"This is not a media file")
            temp_path = temp_file.name
        
        try:
            command = GenerateSubtitlesCommand(
                input_file_path=temp_path
            )
            
            use_case = self.container.get_generate_subtitles_use_case()
            result = use_case.execute(command)
            
            # Should fail gracefully
            assert not result.success
            assert result.error_message is not None
            assert "Unsupported file format" in result.error_message or "validation failed" in result.error_message
        finally:
            os.unlink(temp_path)
    
    def test_default_output_path_generation(self):
        """Test that default output path is generated correctly."""
        # Create a test audio file
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as audio_file:
            audio_file.write(b"fake audio content")
            audio_path = audio_file.name
        
        try:
            # Get the expected default output path
            audio_dir = os.path.dirname(audio_path)
            audio_name = os.path.splitext(os.path.basename(audio_path))[0]
            expected_srt_path = os.path.join(audio_dir, f"{audio_name}.srt")
            
            # Mock all the services to avoid actually processing
            with patch.object(self.container.get_ffmpeg_service(), 'extract_audio') as mock_extract:
                mock_extract.return_value = True
                
                with patch.object(self.container.get_ffmpeg_service(), 'get_audio_duration') as mock_duration:
                    mock_duration.return_value = 1.0
                    
                    with patch.object(self.container.get_whisper_service(), 'load_model') as mock_load:
                        mock_load.return_value = True
                        
                        with patch.object(self.container.get_whisper_service(), 'is_model_loaded') as mock_loaded:
                            mock_loaded.return_value = True
                            
                            with patch.object(self.container.get_whisper_service(), 'transcribe_audio_file') as mock_transcribe:
                                mock_transcribe.return_value = {
                                    "text": "測試",
                                    "language": "zh", 
                                    "chunks": [{"text": "測試", "timestamp": [0.0, 1.0]}],
                                    "duration": 1.0
                                }
                                
                                # Create command without output path
                                command = GenerateSubtitlesCommand(
                                    input_file_path=audio_path
                                )
                                
                                # Verify effective output path
                                effective_path = command.get_effective_output_path()
                                assert effective_path.path == os.path.normpath(expected_srt_path)
        finally:
            os.unlink(audio_path)