"""Tests for FFmpegService."""

import unittest
from unittest.mock import Mock, patch, MagicMock, call
import subprocess
import os
import tempfile
from pathlib import Path

import ffmpeg

from src.infrastructure.services.ffmpeg_service import FFmpegService
from src.domain.value_objects import AudioFormat
from src.domain.value_objects.audio_format import AudioCodec


class TestFFmpegService(unittest.TestCase):
    """Test cases for FFmpegService."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_ffmpeg_path = "/usr/bin/ffmpeg"
        
    @patch('shutil.which')
    def test_init_with_system_ffmpeg(self, mock_which):
        """Test initialization with system FFmpeg."""
        mock_which.return_value = self.mock_ffmpeg_path
        
        service = FFmpegService()
        
        self.assertEqual(service.ffmpeg_path, self.mock_ffmpeg_path)
        mock_which.assert_called_once_with("ffmpeg")
    
    def test_init_with_custom_path(self):
        """Test initialization with custom FFmpeg path."""
        custom_path = "/custom/path/ffmpeg"
        
        service = FFmpegService(ffmpeg_path=custom_path)
        
        self.assertEqual(service.ffmpeg_path, custom_path)
    
    @patch('shutil.which')
    def test_init_ffmpeg_not_found(self, mock_which):
        """Test initialization when FFmpeg is not found."""
        mock_which.return_value = None
        
        with self.assertRaises(RuntimeError) as context:
            FFmpegService()
        
        self.assertIn("FFmpeg not found", str(context.exception))
    
    @patch('shutil.which')
    def test_find_ffmpeg(self, mock_which):
        """Test FFmpeg discovery."""
        mock_which.return_value = self.mock_ffmpeg_path
        
        service = FFmpegService()
        result = service._find_ffmpeg()
        
        self.assertEqual(result, self.mock_ffmpeg_path)
        mock_which.assert_called_with("ffmpeg")
    
    @patch('os.path.exists')
    @patch('os.makedirs')
    @patch('ffmpeg.input')
    @patch('ffmpeg.output')
    @patch('ffmpeg.run')
    @patch('shutil.which')
    def test_extract_audio_success(self, mock_which, mock_run, mock_output, 
                                 mock_input, mock_makedirs, mock_exists):
        """Test successful audio extraction."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_exists.side_effect = lambda path: path == "input.mp4" or path == "output.wav"
        
        # Create mock stream objects
        mock_input_stream = Mock()
        mock_output_stream = Mock()
        mock_input.return_value = mock_input_stream
        mock_output.return_value = mock_output_stream
        
        service = FFmpegService()
        audio_format = AudioFormat(
            sample_rate=16000,
            channels=1,
            codec=AudioCodec.PCM_16
        )
        
        result = service.extract_audio("input.mp4", "output.wav", audio_format)
        
        self.assertTrue(result)
        mock_input.assert_called_once_with("input.mp4")
        mock_output.assert_called_once()
        mock_run.assert_called_once()
    
    @patch('os.path.exists')
    @patch('shutil.which')
    def test_extract_audio_input_not_found(self, mock_which, mock_exists):
        """Test audio extraction with missing input file."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_exists.return_value = False
        
        service = FFmpegService()
        audio_format = AudioFormat(
            sample_rate=16000,
            channels=1,
            codec=AudioCodec.PCM_16
        )
        
        with self.assertRaises(FileNotFoundError):
            service.extract_audio("missing.mp4", "output.wav", audio_format)
    
    @patch('os.path.exists')
    @patch('os.makedirs')
    @patch('ffmpeg.input')
    @patch('ffmpeg.output')
    @patch('ffmpeg.run')
    @patch('shutil.which')
    def test_extract_audio_ffmpeg_error(self, mock_which, mock_run, mock_output, 
                                      mock_input, mock_makedirs, mock_exists):
        """Test audio extraction with FFmpeg error."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_exists.side_effect = lambda path: path == "input.mp4"
        
        # Mock FFmpeg error
        ffmpeg_error = ffmpeg.Error('ffmpeg', 'stdout', 'stderr')
        ffmpeg_error.returncode = 1
        ffmpeg_error.stderr = b"FFmpeg error message"
        mock_run.side_effect = ffmpeg_error
        
        service = FFmpegService()
        audio_format = AudioFormat(
            sample_rate=16000,
            channels=1,
            codec=AudioCodec.PCM_16
        )
        
        with self.assertRaises(subprocess.CalledProcessError):
            service.extract_audio("input.mp4", "output.wav", audio_format)
    
    @patch('os.path.exists')
    @patch('os.makedirs')
    @patch('ffmpeg.input')
    @patch('ffmpeg.output')
    @patch('ffmpeg.run')
    @patch('shutil.which')
    def test_extract_audio_output_not_created(self, mock_which, mock_run, mock_output, 
                                            mock_input, mock_makedirs, mock_exists):
        """Test audio extraction when output file is not created."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_exists.side_effect = lambda path: path == "input.mp4"  # output doesn't exist
        
        service = FFmpegService()
        audio_format = AudioFormat(
            sample_rate=16000,
            channels=1,
            codec=AudioCodec.PCM_16
        )
        
        with self.assertRaises(RuntimeError) as context:
            service.extract_audio("input.mp4", "output.wav", audio_format)
        
        self.assertIn("FFmpeg did not create output file", str(context.exception))
    
    @patch('ffmpeg.probe')
    @patch('shutil.which')
    def test_get_media_info_success(self, mock_which, mock_probe):
        """Test successful media info retrieval."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_probe.return_value = {
            "format": {"duration": "10.5"},
            "streams": [{"codec_type": "audio"}]
        }
        
        service = FFmpegService()
        result = service.get_media_info("test.mp4")
        
        self.assertEqual(result["format"]["duration"], "10.5")
        mock_probe.assert_called_once_with("test.mp4")
    
    @patch('ffmpeg.probe')
    @patch('shutil.which')
    def test_get_media_info_ffmpeg_error(self, mock_which, mock_probe):
        """Test media info retrieval with FFmpeg error."""
        mock_which.return_value = self.mock_ffmpeg_path
        
        ffmpeg_error = ffmpeg.Error('ffprobe', 'stdout', 'stderr')
        ffmpeg_error.returncode = 1
        ffmpeg_error.stderr = b"FFprobe error message"
        mock_probe.side_effect = ffmpeg_error
        
        service = FFmpegService()
        
        with self.assertRaises(subprocess.CalledProcessError):
            service.get_media_info("test.mp4")
    
    @patch('os.path.exists')
    @patch('ffmpeg.probe')
    @patch('shutil.which')
    def test_get_media_info_custom_ffmpeg_path(self, mock_which, mock_probe, mock_exists):
        """Test media info retrieval with custom FFmpeg path."""
        custom_ffmpeg = "/custom/ffmpeg.exe"
        custom_ffprobe = "/custom/ffprobe.exe"
        mock_which.return_value = "/usr/bin/ffmpeg"  # Different from custom
        mock_exists.return_value = True
        mock_probe.return_value = {"format": {}}
        
        service = FFmpegService(ffmpeg_path=custom_ffmpeg)
        service.get_media_info("test.mp4")
        
        mock_probe.assert_called_once_with("test.mp4", cmd=custom_ffprobe)
    
    @patch('subprocess.run')
    @patch('shutil.which')
    def test_get_media_info_fallback(self, mock_which, mock_run):
        """Test media info fallback method."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_run.return_value = Mock(
            stderr="Duration: 00:01:30.50, start: 0.000000\n"
                  "    Stream #0:0: Video: h264\n"
                  "    Stream #0:1: Audio: aac"
        )
        
        service = FFmpegService()
        result = service._get_media_info_fallback("test.mp4")
        
        self.assertIn("format", result)
        self.assertIn("streams", result)
        self.assertEqual(result["format"]["duration"], "90.5")  # 1:30.50 = 90.5 seconds
        self.assertEqual(len(result["streams"]), 2)  # Video and Audio
    
    @patch('ffmpeg.probe')
    @patch('shutil.which')
    def test_get_audio_duration_from_format(self, mock_which, mock_probe):
        """Test audio duration extraction from format info."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_probe.return_value = {
            "format": {"duration": "123.45"},
            "streams": []
        }
        
        service = FFmpegService()
        duration = service.get_audio_duration("test.mp3")
        
        self.assertEqual(duration, 123.45)
    
    @patch('ffmpeg.probe')
    @patch('shutil.which')
    def test_get_audio_duration_from_stream(self, mock_which, mock_probe):
        """Test audio duration extraction from stream info."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_probe.return_value = {
            "format": {},
            "streams": [
                {"codec_type": "video"},
                {"codec_type": "audio", "duration": "67.89"}
            ]
        }
        
        service = FFmpegService()
        duration = service.get_audio_duration("test.mp3")
        
        self.assertEqual(duration, 67.89)
    
    @patch('ffmpeg.probe')
    @patch('shutil.which')
    def test_get_audio_duration_not_found(self, mock_which, mock_probe):
        """Test audio duration when not available."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_probe.return_value = {
            "format": {},
            "streams": [{"codec_type": "video"}]
        }
        
        service = FFmpegService()
        
        with self.assertRaises(ValueError):
            service.get_audio_duration("test.mp4")
    
    @patch('ffmpeg.probe')
    @patch('shutil.which')
    def test_validate_audio_file_success(self, mock_which, mock_probe):
        """Test successful audio file validation."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_probe.return_value = {
            "streams": [{
                "codec_type": "audio",
                "sample_rate": "16000",
                "channels": "1",
                "codec_name": "pcm_s16le"
            }]
        }
        
        service = FFmpegService()
        audio_format = AudioFormat(
            sample_rate=16000,
            channels=1,
            codec=AudioCodec.PCM_16
        )
        
        result = service.validate_audio_file("test.wav", audio_format)
        
        self.assertTrue(result)
    
    @patch('ffmpeg.probe')
    @patch('shutil.which')
    def test_validate_audio_file_mismatch(self, mock_which, mock_probe):
        """Test audio file validation with format mismatch."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_probe.return_value = {
            "streams": [{
                "codec_type": "audio",
                "sample_rate": "44100",  # Different from expected
                "channels": "2",         # Different from expected
                "codec_name": "mp3"
            }]
        }
        
        service = FFmpegService()
        audio_format = AudioFormat(
            sample_rate=16000,
            channels=1,
            codec=AudioCodec.PCM_16
        )
        
        result = service.validate_audio_file("test.mp3", audio_format)
        
        self.assertFalse(result)
    
    @patch('ffmpeg.probe')
    @patch('shutil.which')
    def test_validate_audio_file_no_audio_stream(self, mock_which, mock_probe):
        """Test audio file validation with no audio stream."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_probe.return_value = {
            "streams": [{"codec_type": "video"}]
        }
        
        service = FFmpegService()
        audio_format = AudioFormat(
            sample_rate=16000,
            channels=1,
            codec=AudioCodec.PCM_16
        )
        
        result = service.validate_audio_file("test.mp4", audio_format)
        
        self.assertFalse(result)
    
    @patch('subprocess.run')
    @patch('shutil.which')
    def test_is_available_true(self, mock_which, mock_run):
        """Test FFmpeg availability check when available."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_run.return_value = Mock(returncode=0)
        
        service = FFmpegService()
        result = service.is_available()
        
        self.assertTrue(result)
        mock_run.assert_called_once_with(
            [self.mock_ffmpeg_path, '-version'],
            capture_output=True,
            timeout=10
        )
    
    @patch('subprocess.run')
    @patch('shutil.which')
    def test_is_available_false(self, mock_which, mock_run):
        """Test FFmpeg availability check when not available."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_run.return_value = Mock(returncode=1)
        
        service = FFmpegService()
        result = service.is_available()
        
        self.assertFalse(result)
    
    @patch('subprocess.run')
    @patch('shutil.which')
    def test_is_available_timeout(self, mock_which, mock_run):
        """Test FFmpeg availability check with timeout."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_run.side_effect = subprocess.TimeoutExpired('ffmpeg', 10)
        
        service = FFmpegService()
        result = service.is_available()
        
        self.assertFalse(result)
    
    @patch('subprocess.run')
    @patch('shutil.which')
    def test_get_version_success(self, mock_which, mock_run):
        """Test successful version retrieval."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_run.return_value = Mock(
            returncode=0,
            stdout="ffmpeg version 4.4.2 Copyright (c) 2000-2021\n"
        )
        
        service = FFmpegService()
        version = service.get_version()
        
        self.assertEqual(version, "4.4.2")
    
    @patch('subprocess.run')
    @patch('shutil.which')
    def test_get_version_failure(self, mock_which, mock_run):
        """Test version retrieval failure."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_run.return_value = Mock(returncode=1)
        
        service = FFmpegService()
        version = service.get_version()
        
        self.assertIsNone(version)
    
    @patch('subprocess.run')
    @patch('shutil.which')
    def test_get_version_timeout(self, mock_which, mock_run):
        """Test version retrieval with timeout."""
        mock_which.return_value = self.mock_ffmpeg_path
        mock_run.side_effect = subprocess.TimeoutExpired('ffmpeg', 10)
        
        service = FFmpegService()
        version = service.get_version()
        
        self.assertIsNone(version)


if __name__ == '__main__':
    unittest.main()