"""FFmpeg service for audio extraction and processing."""

import subprocess
import shutil
from typing import Optional, Dict, Any
import ffmpeg
import os

from ...domain.value_objects import FilePath, AudioFormat


class FFmpegService:
    """Service for FFmpeg audio processing operations."""
    
    def __init__(self, ffmpeg_path: Optional[str] = None):
        """
        Initialize FFmpeg service.
        
        Args:
            ffmpeg_path: Custom path to FFmpeg executable
        """
        self.ffmpeg_path = ffmpeg_path or self._find_ffmpeg()
        if not self.ffmpeg_path:
            raise RuntimeError("FFmpeg not found. Please install FFmpeg and ensure it's in PATH.")
    
    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg executable in system PATH."""
        return shutil.which("ffmpeg")
    
    def extract_audio(
        self,
        input_path: str,
        output_path: str,
        target_format: AudioFormat
    ) -> bool:
        """
        Extract audio from media file using FFmpeg.
        
        Args:
            input_path: Path to input media file
            output_path: Path for output audio file
            target_format: Target audio format specification
            
        Returns:
            bool: True if extraction successful
            
        Raises:
            subprocess.CalledProcessError: If FFmpeg fails
            FileNotFoundError: If input file doesn't exist
        """
        try:
            # Validate input file exists
            if not os.path.exists(input_path):
                raise FileNotFoundError(f"Input file not found: {input_path}")
            
            # Create output directory if needed
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir)
            
            # Build FFmpeg command using ffmpeg-python
            stream = ffmpeg.input(input_path)
            
            # Apply audio format parameters
            audio_params = target_format.to_ffmpeg_params()
            
            stream = ffmpeg.output(
                stream,
                output_path,
                **audio_params,
                loglevel='error'  # Reduce verbosity
            )
            
            # Run FFmpeg with custom executable if specified
            if self.ffmpeg_path and self.ffmpeg_path != shutil.which("ffmpeg"):
                # Use custom ffmpeg path
                ffmpeg.run(stream, overwrite_output=True, quiet=True, cmd=self.ffmpeg_path)
            else:
                # Use system ffmpeg
                ffmpeg.run(stream, overwrite_output=True, quiet=True)
            
            # Verify output file was created
            if not os.path.exists(output_path):
                raise RuntimeError(f"FFmpeg did not create output file: {output_path}")
            
            return True
            
        except ffmpeg.Error as e:
            error_msg = f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}"
            raise subprocess.CalledProcessError(e.returncode, "ffmpeg", error_msg)
    
    def get_media_info(self, file_path: str) -> Dict[str, Any]:
        """
        Get media file information using FFprobe.
        
        Args:
            file_path: Path to media file
            
        Returns:
            dict: Media information
            
        Raises:
            subprocess.CalledProcessError: If FFprobe fails
        """
        try:
            # Use custom ffprobe path if custom ffmpeg is specified
            if self.ffmpeg_path and self.ffmpeg_path != shutil.which("ffmpeg"):
                # Assume ffprobe.exe is in the same directory as ffmpeg.exe
                ffprobe_path = self.ffmpeg_path.replace("ffmpeg.exe", "ffprobe.exe")
                if os.path.exists(ffprobe_path):
                    probe = ffmpeg.probe(file_path, cmd=ffprobe_path)
                else:
                    # Try using ffmpeg with -i flag for media info (fallback)
                    return self._get_media_info_fallback(file_path)
            else:
                probe = ffmpeg.probe(file_path)
            return probe
        except ffmpeg.Error as e:
            error_msg = f"FFprobe error: {e.stderr.decode() if e.stderr else str(e)}"
            raise subprocess.CalledProcessError(e.returncode, "ffprobe", error_msg)
    
    def _get_media_info_fallback(self, file_path: str) -> Dict[str, Any]:
        """
        Get basic media info using ffmpeg -i (fallback when ffprobe unavailable).
        
        Args:
            file_path: Path to media file
            
        Returns:
            dict: Basic media information
        """
        try:
            # Use ffmpeg -i to get basic info
            result = subprocess.run(
                [self.ffmpeg_path, "-i", file_path, "-f", "null", "-"],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Parse stderr output for media info
            stderr_output = result.stderr
            
            # Basic info extraction from ffmpeg -i output
            info = {
                "format": {},
                "streams": []
            }
            
            # Look for Duration line
            for line in stderr_output.split('\n'):
                line = line.strip()
                if line.startswith("Duration:"):
                    # Extract duration: "Duration: 00:00:10.00, start: 0.000000, bitrate: 1000 kb/s"
                    parts = line.split(',')
                    duration_str = parts[0].replace("Duration:", "").strip()
                    if duration_str and duration_str != "N/A":
                        # Convert HH:MM:SS.SS to seconds
                        time_parts = duration_str.split(':')
                        if len(time_parts) == 3:
                            hours = float(time_parts[0])
                            minutes = float(time_parts[1])
                            seconds = float(time_parts[2])
                            total_seconds = hours * 3600 + minutes * 60 + seconds
                            info["format"]["duration"] = str(total_seconds)
                
                elif "Video:" in line:
                    # Add basic video stream info
                    info["streams"].append({
                        "codec_type": "video",
                        "codec_name": "unknown"
                    })
                
                elif "Audio:" in line:
                    # Add basic audio stream info
                    info["streams"].append({
                        "codec_type": "audio", 
                        "codec_name": "unknown"
                    })
            
            return info
            
        except Exception as e:
            raise subprocess.CalledProcessError(1, "ffmpeg", f"Fallback media info failed: {e}")
    
    def get_audio_duration(self, file_path: str) -> float:
        """
        Get audio duration in seconds.
        
        Args:
            file_path: Path to audio file
            
        Returns:
            float: Duration in seconds
        """
        info = self.get_media_info(file_path)
        
        # Look for duration in format info first
        if 'format' in info and 'duration' in info['format']:
            return float(info['format']['duration'])
        
        # Look for duration in audio streams
        for stream in info.get('streams', []):
            if stream.get('codec_type') == 'audio' and 'duration' in stream:
                return float(stream['duration'])
        
        raise ValueError(f"Could not determine duration for: {file_path}")
    
    def validate_audio_file(self, file_path: str, expected_format: AudioFormat) -> bool:
        """
        Validate audio file format matches expectations.
        
        Args:
            file_path: Path to audio file
            expected_format: Expected audio format
            
        Returns:
            bool: True if format matches
        """
        try:
            info = self.get_media_info(file_path)
            
            # Find audio stream
            audio_stream = None
            for stream in info.get('streams', []):
                if stream.get('codec_type') == 'audio':
                    audio_stream = stream
                    break
            
            if not audio_stream:
                return False
            
            # Check sample rate
            actual_sample_rate = int(audio_stream.get('sample_rate', 0))
            if actual_sample_rate != expected_format.sample_rate:
                return False
            
            # Check channels
            actual_channels = int(audio_stream.get('channels', 0))
            if actual_channels != expected_format.channels:
                return False
            
            # Check codec (basic validation)
            actual_codec = audio_stream.get('codec_name', '')
            if expected_format.codec.value == 'pcm_s16le' and not actual_codec.startswith('pcm_'):
                return False
            
            return True
            
        except Exception:
            return False
    
    def is_available(self) -> bool:
        """
        Check if FFmpeg is available and working.
        
        Returns:
            bool: True if FFmpeg is available
        """
        try:
            result = subprocess.run(
                [self.ffmpeg_path, '-version'],
                capture_output=True,
                timeout=10
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            return False
    
    def get_version(self) -> Optional[str]:
        """
        Get FFmpeg version information.
        
        Returns:
            str: Version string, None if not available
        """
        try:
            result = subprocess.run(
                [self.ffmpeg_path, '-version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                # Extract version from first line
                first_line = result.stdout.split('\n')[0]
                if 'ffmpeg version' in first_line:
                    return first_line.split(' ')[2]
            return None
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError, IndexError):
            return None