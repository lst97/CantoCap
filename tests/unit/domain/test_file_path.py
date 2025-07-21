"""Tests for FilePath value object."""

import pytest
import tempfile
import os
from pathlib import Path

from cantocap.domain.value_objects import FilePath


class TestFilePath:
    """Test suite for FilePath value object."""
    
    def test_create_from_string(self):
        """Test creating FilePath from string."""
        path = FilePath.from_string("/path/to/file.mp4")
        assert path.path == os.path.normpath("/path/to/file.mp4")
    
    def test_create_from_pathlib(self):
        """Test creating FilePath from pathlib.Path."""
        pathlib_path = Path("/path/to/file.mp4")
        file_path = FilePath.from_pathlib(pathlib_path)
        assert file_path.path == str(pathlib_path)
    
    def test_empty_path_raises_error(self):
        """Test that empty path raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            FilePath.from_string("")
        
        with pytest.raises(ValueError, match="cannot be empty"):
            FilePath.from_string("   ")
    
    def test_to_pathlib(self):
        """Test conversion to pathlib.Path."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        pathlib_path = file_path.to_pathlib()
        assert isinstance(pathlib_path, Path)
        assert str(pathlib_path) == file_path.path
    
    def test_get_extension(self):
        """Test getting file extension."""
        file_path = FilePath.from_string("/path/to/file.MP4")
        assert file_path.get_extension() == ".mp4"  # Should be lowercase
    
    def test_get_name(self):
        """Test getting file name."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        assert file_path.get_name() == "file.mp4"
    
    def test_get_stem(self):
        """Test getting file stem (name without extension)."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        assert file_path.get_stem() == "file"
    
    def test_get_parent(self):
        """Test getting parent directory."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        parent = file_path.get_parent()
        assert isinstance(parent, FilePath)
        assert parent.path == os.path.normpath("/path/to")
    
    def test_is_supported_media_file(self):
        """Test checking supported media formats."""
        # Video formats
        video_path = FilePath.from_string("/path/to/video.mp4")
        assert video_path.is_supported_media_file()
        
        # Audio formats
        audio_path = FilePath.from_string("/path/to/audio.wav")
        assert audio_path.is_supported_media_file()
        
        # Unsupported format
        text_path = FilePath.from_string("/path/to/file.txt")
        assert not text_path.is_supported_media_file()
    
    def test_get_output_srt_path(self):
        """Test generating SRT output path."""
        file_path = FilePath.from_string("/path/to/video.mp4")
        srt_path = file_path.get_output_srt_path()
        assert isinstance(srt_path, FilePath)
        assert srt_path.path == os.path.normpath("/path/to/video.srt")
    
    def test_get_temp_audio_path(self):
        """Test generating temporary audio path."""
        file_path = FilePath.from_string("/path/to/video.mp4")
        temp_path = file_path.get_temp_audio_path()
        assert isinstance(temp_path, FilePath)
        assert temp_path.path == os.path.normpath("/path/to/video_temp.wav")
    
    def test_validate_exists_with_real_file(self):
        """Test validation with real temporary file."""
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            file_path = FilePath.from_string(temp_path)
            file_path.validate_exists()  # Should not raise
        finally:
            os.unlink(temp_path)
    
    def test_validate_exists_with_missing_file(self):
        """Test validation with missing file."""
        file_path = FilePath.from_string("/nonexistent/file.mp4")
        with pytest.raises(FileNotFoundError, match="File not found"):
            file_path.validate_exists()
    
    def test_validate_supported_format(self):
        """Test format validation."""
        # Supported format
        video_path = FilePath.from_string("/path/to/video.mp4")
        video_path.validate_supported_format()  # Should not raise
        
        # Unsupported format
        text_path = FilePath.from_string("/path/to/file.txt")
        with pytest.raises(ValueError, match="Unsupported file format"):
            text_path.validate_supported_format()
    
    def test_get_size_with_real_file(self):
        """Test getting file size with real file."""
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(b"Hello, World!")
            temp_path = temp_file.name
        
        try:
            file_path = FilePath.from_string(temp_path)
            size_bytes = file_path.get_size_bytes()
            size_mb = file_path.get_size_mb()
            
            assert size_bytes == 13  # "Hello, World!" is 13 bytes
            assert size_mb == 13 / (1024 * 1024)
        finally:
            os.unlink(temp_path)
    
    def test_get_size_with_missing_file(self):
        """Test getting size of missing file."""
        file_path = FilePath.from_string("/nonexistent/file.mp4")
        with pytest.raises(FileNotFoundError, match="File not found"):
            file_path.get_size_bytes()
    
    def test_immutability(self):
        """Test that FilePath is immutable."""
        file_path = FilePath.from_string("/path/to/file.mp4")
        with pytest.raises(AttributeError):
            file_path.path = "/different/path"