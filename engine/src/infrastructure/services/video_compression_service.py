"""Video compression service for optimizing videos before Gemini API calls."""

import os
import tempfile
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass

from ...domain.value_objects import FilePath


@dataclass
class CompressionResult:
    """Result of video compression operation."""
    compressed_path: Path
    original_size_mb: float
    compressed_size_mb: float
    compression_ratio: float
    duration_seconds: float
    resolution: str
    success: bool
    error_message: Optional[str] = None


class VideoCompressionService:
    """Service for compressing videos before sending to Gemini API."""
    
    # Compression settings optimized for API transmission
    DEFAULT_SETTINGS = {
        "max_resolution": "720p",  # Maximum resolution for API
        "target_bitrate": "500k",  # Low bitrate for small file size
        "audio_bitrate": "64k",    # Minimal audio quality sufficient for transcription
        "fps": 15,                 # Lower FPS for smaller files
        "preset": "fast",          # Fast encoding preset
        "crf": 28,                 # Higher CRF for more compression
    }
    
    QUALITY_PRESETS = {
        "low": {
            "max_resolution": "480p",
            "target_bitrate": "300k", 
            "audio_bitrate": "48k",
            "fps": 12,
            "crf": 32
        },
        "medium": {
            "max_resolution": "720p",
            "target_bitrate": "500k",
            "audio_bitrate": "64k", 
            "fps": 15,
            "crf": 28
        },
        "high": {
            "max_resolution": "1080p",
            "target_bitrate": "1000k",
            "audio_bitrate": "96k",
            "fps": 20,
            "crf": 25
        }
    }
    
    def __init__(self, ffmpeg_path: Optional[str] = None):
        """
        Initialize video compression service.
        
        Args:
            ffmpeg_path: Path to FFmpeg executable (auto-detected if None)
        """
        self.ffmpeg_path = ffmpeg_path or self._find_ffmpeg()
        if not self.ffmpeg_path:
            raise RuntimeError("FFmpeg not found. Please install FFmpeg or provide path.")
    
    def compress_for_api(
        self, 
        input_video: FilePath, 
        quality: str = "low",
        max_size_mb: Optional[float] = None
    ) -> CompressionResult:
        """
        Compress video optimized for Gemini API transmission.
        
        Args:
            input_video: Path to input video file
            quality: Compression quality preset ('low', 'medium', 'high')
            max_size_mb: Maximum target file size in MB
            
        Returns:
            CompressionResult with compressed video information
        """
        if quality not in self.QUALITY_PRESETS:
            raise ValueError(f"Quality must be one of: {list(self.QUALITY_PRESETS.keys())}")
        
        # Validate input file
        input_video.validate_exists()
        
        # Get original file info
        original_info = self._get_video_info(input_video)
        original_size_mb = os.path.getsize(input_video.path) / (1024 * 1024)
        
        # Create temporary output file
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_file:
            output_path = Path(tmp_file.name)
        
        try:
            # Get compression settings
            settings = self.QUALITY_PRESETS[quality].copy()
            
            # Adjust settings based on max_size_mb if specified
            if max_size_mb and original_size_mb > max_size_mb:
                settings = self._adjust_settings_for_size(
                    settings, original_info, max_size_mb
                )
            
            # Build FFmpeg command
            cmd = self._build_compression_command(
                input_video.path, output_path, settings, original_info
            )
            
            # Execute compression
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode != 0:
                return CompressionResult(
                    compressed_path=output_path,
                    original_size_mb=original_size_mb,
                    compressed_size_mb=0,
                    compression_ratio=0,
                    duration_seconds=original_info.get("duration", 0),
                    resolution="unknown",
                    success=False,
                    error_message=f"FFmpeg error: {result.stderr}"
                )
            
            # Verify output file was created
            if not output_path.exists() or output_path.stat().st_size == 0:
                return CompressionResult(
                    compressed_path=output_path,
                    original_size_mb=original_size_mb,
                    compressed_size_mb=0,
                    compression_ratio=0,
                    duration_seconds=original_info.get("duration", 0),
                    resolution="unknown",
                    success=False,
                    error_message="Output file was not created or is empty"
                )
            
            # Get compressed file info
            compressed_size_mb = os.path.getsize(output_path) / (1024 * 1024)
            compression_ratio = original_size_mb / compressed_size_mb if compressed_size_mb > 0 else 0
            compressed_info = self._get_video_info(FilePath.from_string(str(output_path)))
            
            return CompressionResult(
                compressed_path=output_path,
                original_size_mb=original_size_mb,
                compressed_size_mb=compressed_size_mb,
                compression_ratio=compression_ratio,
                duration_seconds=compressed_info.get("duration", original_info.get("duration", 0)),
                resolution=f"{compressed_info.get('width', 0)}x{compressed_info.get('height', 0)}",
                success=True
            )
            
        except subprocess.TimeoutExpired:
            # Clean up on timeout
            if output_path.exists():
                output_path.unlink()
            return CompressionResult(
                compressed_path=output_path,
                original_size_mb=original_size_mb,
                compressed_size_mb=0,
                compression_ratio=0,
                duration_seconds=original_info.get("duration", 0),
                resolution="unknown",
                success=False,
                error_message="Compression timed out after 5 minutes"
            )
        except Exception as e:
            # Clean up on error
            if output_path.exists():
                output_path.unlink()
            return CompressionResult(
                compressed_path=output_path,
                original_size_mb=original_size_mb,
                compressed_size_mb=0,
                compression_ratio=0,
                duration_seconds=original_info.get("duration", 0),
                resolution="unknown",
                success=False,
                error_message=str(e)
            )
    
    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg executable in system PATH or local installation."""
        # Check system PATH first
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"], 
                capture_output=True, 
                timeout=10
            )
            if result.returncode == 0:
                return "ffmpeg"
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        
        # Check local installation paths
        project_root = Path(__file__).resolve().parent.parent.parent.parent
        
        # Windows local installation
        if os.name == 'nt':
            local_ffmpeg = project_root / "lib" / "ffmpeg" / "bin" / "win" / "ffmpeg.exe"
            if local_ffmpeg.exists():
                return str(local_ffmpeg)
        
        return None
    
    def _get_video_info(self, video_path: FilePath) -> Dict[str, Any]:
        """Get video information using FFprobe."""
        try:
            cmd = [
                self.ffmpeg_path.replace("ffmpeg", "ffprobe") if "ffmpeg" in self.ffmpeg_path else "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                str(video_path.path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                return {"duration": 0, "width": 0, "height": 0}
            
            import json
            data = json.loads(result.stdout)
            
            # Extract video stream info
            video_stream = None
            for stream in data.get("streams", []):
                if stream.get("codec_type") == "video":
                    video_stream = stream
                    break
            
            duration = float(data.get("format", {}).get("duration", 0))
            width = int(video_stream.get("width", 0)) if video_stream else 0
            height = int(video_stream.get("height", 0)) if video_stream else 0
            
            return {
                "duration": duration,
                "width": width,
                "height": height,
                "bitrate": data.get("format", {}).get("bit_rate"),
                "format": data.get("format", {}).get("format_name")
            }
            
        except Exception:
            return {"duration": 0, "width": 0, "height": 0}
    
    def _adjust_settings_for_size(
        self, 
        settings: Dict[str, Any], 
        video_info: Dict[str, Any], 
        target_size_mb: float
    ) -> Dict[str, Any]:
        """Adjust compression settings to achieve target file size."""
        # Estimate current bitrate needed for target size
        duration = video_info.get("duration", 1)
        target_bitrate_kbps = (target_size_mb * 8 * 1024) / duration  # Convert MB to kbps
        
        # Adjust video bitrate (reserve 10% for audio and overhead)
        video_bitrate = int(target_bitrate_kbps * 0.9)
        
        # Update settings
        adjusted_settings = settings.copy()
        adjusted_settings["target_bitrate"] = f"{video_bitrate}k"
        
        # Lower audio bitrate if needed
        if video_bitrate < 200:
            adjusted_settings["audio_bitrate"] = "32k"
        
        # Lower quality settings for very small targets
        if target_size_mb < 5:
            adjusted_settings["max_resolution"] = "480p"
            adjusted_settings["fps"] = 10
            adjusted_settings["crf"] = 35
        
        return adjusted_settings
    
    def _build_compression_command(
        self, 
        input_path: Path, 
        output_path: Path, 
        settings: Dict[str, Any],
        video_info: Dict[str, Any]
    ) -> list:
        """Build FFmpeg command for compression."""
        cmd = [self.ffmpeg_path, "-y", "-i", str(input_path)]
        
        # Video encoding settings
        cmd.extend(["-c:v", "libx264"])
        cmd.extend(["-preset", settings["preset"]])
        cmd.extend(["-crf", str(settings["crf"])])
        
        # Bitrate control
        if settings.get("target_bitrate"):
            cmd.extend(["-b:v", settings["target_bitrate"]])
            cmd.extend(["-maxrate", settings["target_bitrate"]])
            cmd.extend(["-bufsize", f"{int(settings['target_bitrate'].rstrip('k')) * 2}k"])
        
        # Resolution scaling
        max_res = settings["max_resolution"]
        if max_res == "480p":
            cmd.extend(["-vf", "scale=-2:480"])
        elif max_res == "720p":
            cmd.extend(["-vf", "scale=-2:720"])
        elif max_res == "1080p":
            cmd.extend(["-vf", "scale=-2:1080"])
        
        # Frame rate
        cmd.extend(["-r", str(settings["fps"])])
        
        # Audio encoding
        cmd.extend(["-c:a", "aac"])
        cmd.extend(["-b:a", settings["audio_bitrate"]])
        
        # Output format optimization
        cmd.extend(["-movflags", "+faststart"])  # Enable streaming
        cmd.extend(["-pix_fmt", "yuv420p"])      # Compatibility
        
        cmd.append(str(output_path))
        
        return cmd
    
    def cleanup_temp_file(self, file_path: Path) -> None:
        """Clean up temporary compressed file."""
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass  # Silent cleanup failure
    
    def estimate_compressed_size(
        self, 
        input_video: FilePath, 
        quality: str = "low"
    ) -> float:
        """
        Estimate compressed file size without actually compressing.
        
        Args:
            input_video: Path to input video
            quality: Compression quality preset
            
        Returns:
            Estimated compressed size in MB
        """
        video_info = self._get_video_info(input_video)
        duration = video_info.get("duration", 0)
        
        if duration == 0:
            return 0
        
        # Get bitrate estimates for quality presets
        bitrate_estimates = {
            "low": 300,    # kbps
            "medium": 500,
            "high": 1000
        }
        
        target_bitrate = bitrate_estimates.get(quality, 500)
        
        # Add audio bitrate
        audio_bitrate = 64  # kbps
        total_bitrate = target_bitrate + audio_bitrate
        
        # Calculate estimated size (add 10% overhead)
        estimated_size_mb = (duration * total_bitrate * 1.1) / (8 * 1024)
        
        return estimated_size_mb