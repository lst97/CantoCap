"""Tests for GenerateSubtitlesCommand."""

import pytest
import tempfile
import os

from cantosub.application.commands import GenerateSubtitlesCommand
from cantosub.domain.value_objects import FilePath


class TestGenerateSubtitlesCommand:
    """Test suite for GenerateSubtitlesCommand."""
    
    def test_create_command_with_required_params(self):
        """Test creating command with required parameters."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        assert command.input_file_path == "/path/to/video.mp4"
        assert command.output_file_path is None
        assert command.language == "zh"
        assert command.model_name == "openai/whisper-large-v3"
    
    def test_create_command_with_all_params(self):
        """Test creating command with all parameters."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/path/to/output.srt",
            language="en",
            model_name="openai/whisper-large-v3"
        )
        
        assert command.input_file_path == "/path/to/video.mp4"
        assert command.output_file_path == "/path/to/output.srt"
        assert command.language == "en"
        assert command.model_name == "openai/whisper-large-v3"
    
    def test_empty_input_file_path_raises_error(self):
        """Test that empty input file path raises error."""
        with pytest.raises(ValueError, match="Input file path cannot be empty"):
            GenerateSubtitlesCommand(input_file_path="")
        
        with pytest.raises(ValueError, match="Input file path cannot be empty"):
            GenerateSubtitlesCommand(input_file_path="   ")
    
    def test_empty_output_file_path_raises_error(self):
        """Test that empty output file path raises error."""
        with pytest.raises(ValueError, match="Output file path cannot be empty string"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                output_file_path=""
            )
    
    def test_empty_language_raises_error(self):
        """Test that empty language raises error."""
        with pytest.raises(ValueError, match="Language cannot be empty"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                language=""
            )
    
    def test_empty_model_name_raises_error(self):
        """Test that empty model name raises error."""
        with pytest.raises(ValueError, match="Model name cannot be empty"):
            GenerateSubtitlesCommand(
                input_file_path="/path/to/video.mp4",
                model_name=""
            )
    
    def test_get_input_file_path(self):
        """Test getting input file path as FilePath."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        input_path = command.get_input_file_path()
        assert isinstance(input_path, FilePath)
        assert input_path.path == os.path.normpath("/path/to/video.mp4")
    
    def test_get_output_file_path_with_custom_output(self):
        """Test getting output file path when custom output specified."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/custom/output.srt"
        )
        
        output_path = command.get_output_file_path()
        assert isinstance(output_path, FilePath)
        assert output_path.path == os.path.normpath("/custom/output.srt")
    
    def test_get_output_file_path_with_none(self):
        """Test getting output file path when None."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        output_path = command.get_output_file_path()
        assert output_path is None
    
    def test_get_default_output_path(self):
        """Test getting default output path."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        default_path = command.get_default_output_path()
        assert isinstance(default_path, FilePath)
        assert default_path.path == os.path.normpath("/path/to/video.srt")
    
    def test_get_effective_output_path_with_custom(self):
        """Test getting effective output path with custom output."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/custom/output.srt"
        )
        
        effective_path = command.get_effective_output_path()
        assert isinstance(effective_path, FilePath)
        assert effective_path.path == os.path.normpath("/custom/output.srt")
    
    def test_get_effective_output_path_with_default(self):
        """Test getting effective output path with default."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        effective_path = command.get_effective_output_path()
        assert isinstance(effective_path, FilePath)
        assert effective_path.path == os.path.normpath("/path/to/video.srt")
    
    def test_validate_paths_with_real_files(self):
        """Test path validation with real files."""
        # Create temporary input file
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_file:
            temp_file.write(b"fake video content")
            temp_path = temp_file.name
        
        try:
            command = GenerateSubtitlesCommand(
                input_file_path=temp_path
            )
            command.validate_paths()  # Should not raise
        finally:
            os.unlink(temp_path)
    
    def test_validate_paths_with_missing_input_file(self):
        """Test path validation with missing input file."""
        command = GenerateSubtitlesCommand(
            input_file_path="/nonexistent/video.mp4"
        )
        
        with pytest.raises(FileNotFoundError, match="File not found"):
            command.validate_paths()
    
    def test_validate_paths_with_unsupported_format(self):
        """Test path validation with unsupported format."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as temp_file:
            temp_file.write(b"text content")
            temp_path = temp_file.name
        
        try:
            command = GenerateSubtitlesCommand(
                input_file_path=temp_path
            )
            
            with pytest.raises(ValueError, match="Unsupported file format"):
                command.validate_paths()
        finally:
            os.unlink(temp_path)
    
    def test_string_representations(self):
        """Test string representations."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4",
            output_file_path="/custom/output.srt",
            language="en"
        )
        
        str_repr = str(command)
        assert "video.mp4" in str_repr
        assert "output.srt" in str_repr
        assert "lang='en'" in str_repr
        
        repr_str = repr(command)
        assert "GenerateSubtitlesCommand" in repr_str
        assert "/path/to/video.mp4" in repr_str
    
    def test_command_immutability(self):
        """Test that command is immutable (frozen dataclass)."""
        command = GenerateSubtitlesCommand(
            input_file_path="/path/to/video.mp4"
        )
        
        with pytest.raises(AttributeError):
            command.input_file_path = "/different/path.mp4"