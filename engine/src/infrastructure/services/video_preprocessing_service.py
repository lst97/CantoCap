"""Service for preprocessing video files for LLM analysis."""

from dataclasses import dataclass
from typing import Optional
import subprocess
from pathlib import Path

from ...domain.value_objects import FilePath


@dataclass
class CompressionSettings:
    """Settings for video compression."""
    target_resolution: str = "360p"
    target_bitrate: str = "500k"
    audio_quality: str = "128k"
    format: str = "mp4"


class VideoPreprocessingService:
    """Service for preprocessing video files for LLM analysis."""
    
    def __init__(self):
        """Initialize video preprocessing service."""
        self.temp_dir = Path.cwd() / "temp" / "compressed"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
    
    def compress_for_llm_analysis(
        self, 
        input_path: FilePath,
        settings: Optional[CompressionSettings] = None
    ) -> FilePath:
        """
        Compress video to reduce token usage for LLM analysis.
        
        Args:
            input_path: Original video file path
            settings: Compression settings
            
        Returns:
            Path to compressed video file
        """
        if settings is None:
            settings = CompressionSettings()
        
        # Generate output filename
        input_file = Path(input_path.path)
        output_file = self.temp_dir / f"{input_file.stem}_compressed.{settings.format}"
        
        # Check if compressed file already exists and is recent
        if output_file.exists():
            input_mtime = input_file.stat().st_mtime
            output_mtime = output_file.stat().st_mtime
            if output_mtime > input_mtime:
                # Compressed file is newer than input, reuse it
                return FilePath.from_string(str(output_file))
        
        # FFmpeg compression command
        cmd = [
            "ffmpeg", "-i", str(input_file),
            "-vf", f"scale=-2:{self._get_height_from_resolution(settings.target_resolution)}",
            "-b:v", settings.target_bitrate,
            "-b:a", settings.audio_quality,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "28",
            "-movflags", "+faststart",  # Optimize for streaming
            "-y",  # Overwrite output file
            str(output_file)
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            return FilePath.from_string(str(output_file))
        except subprocess.CalledProcessError as e:
            stderr_output = e.stderr.decode() if e.stderr else "Unknown error"
            raise RuntimeError(f"Video compression failed: {stderr_output}")
    
    def _get_height_from_resolution(self, resolution: str) -> str:
        """Convert resolution string to height."""
        resolution_map = {
            "360p": "360",
            "480p": "480", 
            "720p": "720",
            "1080p": "1080"
        }
        return resolution_map.get(resolution, "360")
    
    def get_compression_ratio(self, original_path: FilePath, compressed_path: FilePath) -> float:
        """
        Calculate compression ratio.
        
        Args:
            original_path: Path to original file
            compressed_path: Path to compressed file
            
        Returns:
            Compression ratio (original_size / compressed_size)
        """
        try:
            original_size = Path(original_path.path).stat().st_size
            compressed_size = Path(compressed_path.path).stat().st_size
            return original_size / compressed_size if compressed_size > 0 else 1.0
        except (FileNotFoundError, ZeroDivisionError):
            return 1.0
    
    def estimate_compression_size(self, input_path: FilePath, settings: CompressionSettings) -> float:
        """
        Estimate compressed file size in MB.
        
        Args:
            input_path: Original video file path
            settings: Compression settings
            
        Returns:
            Estimated size in MB
        """
        try:
            # Get original file size
            original_size_mb = Path(input_path.path).stat().st_size / (1024 * 1024)
            
            # Estimate compression ratio based on target resolution
            resolution_factors = {
                "360p": 0.15,  # Very aggressive compression
                "480p": 0.25,  # Moderate compression
                "720p": 0.40,  # Light compression
                "1080p": 0.70  # Minimal compression
            }
            
            factor = resolution_factors.get(settings.target_resolution, 0.15)
            return original_size_mb * factor
            
        except FileNotFoundError:
            return 100.0  # Default estimate
    
    def is_already_compressed(self, file_path: FilePath, max_bitrate_kbps: int = 1000) -> bool:
        """
        Check if video is already compressed enough for LLM processing.
        
        Args:
            file_path: Path to video file
            max_bitrate_kbps: Maximum acceptable bitrate in kbps
            
        Returns:
            True if video is already compressed enough
        """
        try:
            # Use ffprobe to get video bitrate
            cmd = [
                "ffprobe",
                "-v", "quiet",
                "-select_streams", "v:0",
                "-show_entries", "stream=bit_rate",
                "-of", "csv=p=0",
                str(file_path.path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            bitrate_bps = int(result.stdout.strip())
            bitrate_kbps = bitrate_bps / 1000
            
            return bitrate_kbps <= max_bitrate_kbps
            
        except (subprocess.CalledProcessError, ValueError):
            # If we can't determine bitrate, assume compression is needed
            return False
    
    def cleanup_temp_files(self):
        """Clean up temporary compressed files."""
        for file in self.temp_dir.glob("*_compressed.*"):
            file.unlink(missing_ok=True)
        
        # Remove empty temp directory
        try:
            self.temp_dir.rmdir()
        except OSError:
            pass  # Directory not empty or doesn't exist