"""Tests for MediaFile entity."""

import pytest
import tempfile
import os

from cantocap.domain.entities import MediaFile
from cantocap.domain.value_objects import FilePath


class TestMediaFile:
    """Test suite for MediaFile entity."""
    
    def test_create_from_path(self):
        """Test creating MediaFile from path string."""
        media_file = MediaFile.from_path("/path/to/video.mp4")
        assert isinstance(media_file.file_path, FilePath)
        assert media_file.file_path.path == os.path.normpath("/path/to/video.mp4")
    
    def test_invalid_file_path_type_raises_error(self):
        """Test that invalid file path type raises error."""
        with pytest.raises(TypeError, match="must be a FilePath instance"):
            MediaFile(file_path="/path/to/video.mp4")  # Should be FilePath, not string
    
    def test_validate_with_real_file(self):
        """Test validation with real temporary file."""
        # Create a temporary file with supported extension
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_file:
            temp_file.write(b"fake video content")
            temp_path = temp_file.name
        
        try:
            media_file = MediaFile.from_path(temp_path)
            media_file.validate()  # Should not raise
            assert media_file.is_validated()
        finally:
            os.unlink(temp_path)
    
    def test_validate_missing_file_raises_error(self):
        """Test validation with missing file."""
        media_file = MediaFile.from_path("/nonexistent/video.mp4")
        with pytest.raises(FileNotFoundError, match="File not found"):
            media_file.validate()
    
    def test_validate_empty_file_raises_error(self):
        """Test validation with empty file."""
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_file:
            temp_path = temp_file.name  # Empty file
        
        try:
            media_file = MediaFile.from_path(temp_path)
            with pytest.raises(ValueError, match="File is empty"):
                media_file.validate()
        finally:
            os.unlink(temp_path)
    
    def test_validate_unsupported_format_raises_error(self):
        """Test validation with unsupported format."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as temp_file:
            temp_file.write(b"text content")
            temp_path = temp_file.name
        
        try:
            media_file = MediaFile.from_path(temp_path)
            with pytest.raises(ValueError, match="Unsupported file format"):
                media_file.validate()
        finally:
            os.unlink(temp_path)
    
    def test_get_properties(self):
        """Test getting media file properties."""
        media_file = MediaFile.from_path("/path/to/video.mp4")
        
        assert media_file.get_name() == "video.mp4"
        assert media_file.get_extension() == ".mp4"
        assert isinstance(media_file.get_file_path(), FilePath)
    
    def test_is_video(self):
        """Test video format detection."""
        video_file = MediaFile.from_path("/path/to/video.mp4")
        assert video_file.is_video()
        assert not video_file.is_audio()
        
        mkv_file = MediaFile.from_path("/path/to/video.mkv")
        assert mkv_file.is_video()
    
    def test_is_audio(self):
        """Test audio format detection."""
        audio_file = MediaFile.from_path("/path/to/audio.wav")
        assert audio_file.is_audio()
        assert not audio_file.is_video()
        
        mp3_file = MediaFile.from_path("/path/to/audio.mp3")
        assert mp3_file.is_audio()
    
    def test_get_output_paths(self):
        """Test getting output and temporary paths."""
        media_file = MediaFile.from_path("/path/to/video.mp4")
        
        srt_path = media_file.get_output_srt_path()
        assert isinstance(srt_path, FilePath)
        assert srt_path.path == os.path.normpath("/path/to/video.srt")
        
        temp_path = media_file.get_temp_audio_path()
        assert isinstance(temp_path, FilePath)
        assert temp_path.path == os.path.normpath("/path/to/video_temp.wav")
    
    def test_get_size_before_validation(self):
        """Test getting size triggers validation."""
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_file:
            temp_file.write(b"fake video content")
            temp_path = temp_file.name
        
        try:
            media_file = MediaFile.from_path(temp_path)
            assert not media_file.is_validated()
            
            size_bytes = media_file.get_size_bytes()
            assert media_file.is_validated()  # Should be validated now
            assert size_bytes > 0
            
            size_mb = media_file.get_size_mb()
            assert size_mb > 0
        finally:
            os.unlink(temp_path)
    
    def test_string_representations(self):
        """Test string representations."""
        media_file = MediaFile.from_path("/path/to/video.mp4")
        
        str_repr = str(media_file)
        assert "video.mp4" in str_repr
        assert "video" in str_repr
        
        repr_str = repr(media_file)
        assert "MediaFile" in repr_str
        assert "validated=False" in repr_str  # Not validated yet