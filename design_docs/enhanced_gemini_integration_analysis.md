# Enhanced Gemini Flash Integration Analysis

## Overview
Analysis of enhanced requirements for Gemini Flash integration including .env support, chunking for large files, and robust error handling.

## 1. Configuration Management Enhancement

### API Key Resolution Priority
```python
# Configuration resolution order:
1. .env file (GEMINI_API_KEY)
2. Environment variable (os.environ.get('GEMINI_API_KEY'))
3. CLI argument (--gemini-key)
4. Warning mode (continue without Gemini features)
```

### Enhanced Configuration Service
```python
# src/infrastructure/services/configuration_service.py
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

class ConfigurationService:
    """Enhanced configuration management with .env support."""
    
    def __init__(self, project_root: Optional[Path] = None):
        """Initialize configuration service."""
        self.project_root = project_root or self._find_project_root()
        self._load_env_files()
    
    def _find_project_root(self) -> Path:
        """Find project root by looking for key files."""
        current = Path(__file__).resolve()
        for parent in current.parents:
            if (parent / "pyproject.toml").exists() or (parent / "setup.py").exists():
                return parent
        return Path.cwd()
    
    def _load_env_files(self):
        """Load .env files in priority order."""
        env_files = [
            self.project_root / ".env.local",
            self.project_root / ".env",
        ]
        
        for env_file in env_files:
            if env_file.exists():
                load_dotenv(env_file, override=False)
                break
    
    def get_gemini_api_key(self, cli_key: Optional[str] = None) -> Optional[str]:
        """
        Get Gemini API key with priority resolution.
        
        Args:
            cli_key: API key from CLI argument
            
        Returns:
            API key or None if not found
        """
        # Priority 1: CLI argument
        if cli_key and cli_key.strip():
            return cli_key.strip()
        
        # Priority 2: Environment variables (.env loaded first)
        key_names = [
            'GEMINI_API_KEY',
            'GOOGLE_GEMINI_API_KEY',
            'GOOGLE_API_KEY'
        ]
        
        for key_name in key_names:
            key = os.environ.get(key_name)
            if key and key.strip():
                return key.strip()
        
        return None
    
    def validate_gemini_configuration(self, api_key: Optional[str]) -> tuple[bool, str]:
        """
        Validate Gemini configuration.
        
        Returns:
            Tuple of (is_valid, message)
        """
        if not api_key:
            return False, (
                "Gemini API key not found. Set GEMINI_API_KEY in .env file, "
                "environment variable, or use --gemini-key argument."
            )
        
        if len(api_key) < 20:  # Basic validation
            return False, "Gemini API key appears to be invalid (too short)."
        
        return True, "Gemini API key configured successfully."
```

## 2. Video/Audio Chunking Service

### Gemini Flash API Limits Analysis
- **File Size**: 2GB max direct upload, 20MB inline
- **Token Limits**: 32K/min (free), 120K/min (paid)
- **Context Window**: 1M tokens theoretical, 32K practical
- **Video Duration**: No explicit limit, but large files need chunking

### Media Chunking Service Design
```python
# src/infrastructure/services/media_chunking_service.py
from dataclasses import dataclass
from typing import List, Optional, Tuple
import subprocess
from pathlib import Path
import math

from ...domain.value_objects import FilePath, Timestamp

@dataclass
class ChunkInfo:
    """Information about a media chunk."""
    chunk_index: int
    start_time: Timestamp
    end_time: Timestamp
    file_path: FilePath
    estimated_tokens: int
    file_size_mb: float

@dataclass
class ChunkingStrategy:
    """Strategy for chunking media files."""
    max_chunk_duration_seconds: float = 900  # 15 minutes
    max_chunk_size_mb: float = 1800  # 1.8GB (safety margin)
    overlap_seconds: float = 30  # 30 seconds overlap
    max_tokens_per_chunk: int = 25000  # Conservative token limit

class MediaChunkingService:
    """Service for chunking large media files for Gemini Flash processing."""
    
    def __init__(self, strategy: Optional[ChunkingStrategy] = None):
        """Initialize with chunking strategy."""
        self.strategy = strategy or ChunkingStrategy()
        self.temp_dir = Path.cwd() / "temp" / "chunks"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
    
    def should_chunk_file(self, file_path: FilePath) -> bool:
        """
        Determine if file should be chunked.
        
        Args:
            file_path: Path to media file
            
        Returns:
            True if file should be chunked
        """
        file_size_mb = self._get_file_size_mb(file_path)
        duration_seconds = self._get_media_duration(file_path)
        
        # Chunk if file is too large or too long
        return (
            file_size_mb > self.strategy.max_chunk_size_mb or
            duration_seconds > self.strategy.max_chunk_duration_seconds
        )
    
    def create_chunks(self, file_path: FilePath) -> List[ChunkInfo]:
        """
        Create chunks from media file.
        
        Args:
            file_path: Path to original media file
            
        Returns:
            List of chunk information
        """
        if not self.should_chunk_file(file_path):
            # Return single chunk for the entire file
            duration = self._get_media_duration(file_path)
            file_size_mb = self._get_file_size_mb(file_path)
            
            return [ChunkInfo(
                chunk_index=0,
                start_time=Timestamp.from_seconds(0),
                end_time=Timestamp.from_seconds(duration),
                file_path=file_path,
                estimated_tokens=self._estimate_tokens_for_duration(duration),
                file_size_mb=file_size_mb
            )]
        
        duration = self._get_media_duration(file_path)
        chunk_duration = self.strategy.max_chunk_duration_seconds
        overlap = self.strategy.overlap_seconds
        
        chunks = []
        chunk_index = 0
        current_start = 0
        
        while current_start < duration:
            # Calculate chunk end time
            chunk_end = min(current_start + chunk_duration, duration)
            
            # Create chunk file
            chunk_file = self._create_chunk_file(
                file_path, 
                current_start, 
                chunk_end, 
                chunk_index
            )
            
            chunk_info = ChunkInfo(
                chunk_index=chunk_index,
                start_time=Timestamp.from_seconds(current_start),
                end_time=Timestamp.from_seconds(chunk_end),
                file_path=chunk_file,
                estimated_tokens=self._estimate_tokens_for_duration(chunk_end - current_start),
                file_size_mb=self._get_file_size_mb(chunk_file)
            )
            
            chunks.append(chunk_info)
            
            # Move to next chunk with overlap
            current_start = chunk_end - overlap
            chunk_index += 1
        
        return chunks
    
    def _create_chunk_file(
        self, 
        source_file: FilePath, 
        start_seconds: float, 
        end_seconds: float, 
        chunk_index: int
    ) -> FilePath:
        """Create a chunk file using FFmpeg."""
        source_path = Path(source_file.path)
        chunk_filename = f"{source_path.stem}_chunk_{chunk_index:03d}{source_path.suffix}"
        chunk_path = self.temp_dir / chunk_filename
        
        # FFmpeg command to extract chunk
        cmd = [
            "ffmpeg",
            "-i", str(source_path),
            "-ss", str(start_seconds),
            "-t", str(end_seconds - start_seconds),
            "-c", "copy",  # Copy streams without re-encoding for speed
            "-avoid_negative_ts", "make_zero",
            "-y",  # Overwrite output file
            str(chunk_path)
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            return FilePath.from_string(str(chunk_path))
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to create chunk {chunk_index}: {e.stderr.decode()}")
    
    def _get_file_size_mb(self, file_path: FilePath) -> float:
        """Get file size in MB."""
        return Path(file_path.path).stat().st_size / (1024 * 1024)
    
    def _get_media_duration(self, file_path: FilePath) -> float:
        """Get media duration in seconds using FFprobe."""
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            str(file_path.path)
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return float(result.stdout.strip())
        except (subprocess.CalledProcessError, ValueError):
            # Fallback estimation
            file_size_mb = self._get_file_size_mb(file_path)
            # Rough estimation: 1MB per minute for compressed video
            return file_size_mb * 60
    
    def _estimate_tokens_for_duration(self, duration_seconds: float) -> int:
        """Estimate token usage for video duration."""
        # Conservative estimation: ~50 tokens per minute for video analysis
        return int(duration_seconds / 60 * 50)
    
    def merge_chunk_results(
        self, 
        chunk_results: List[Tuple[ChunkInfo, str]], 
        original_duration: float
    ) -> str:
        """
        Merge results from multiple chunks into single SRT.
        
        Args:
            chunk_results: List of (chunk_info, srt_content) tuples
            original_duration: Original file duration for validation
            
        Returns:
            Merged SRT content
        """
        merged_subtitles = []
        subtitle_index = 1
        
        for chunk_info, srt_content in chunk_results:
            chunk_subtitles = self._parse_srt_content(srt_content)
            
            for subtitle in chunk_subtitles:
                # Adjust timing for chunk offset
                adjusted_start = subtitle['start'] + chunk_info.start_time.seconds
                adjusted_end = subtitle['end'] + chunk_info.start_time.seconds
                
                # Skip subtitles that extend beyond original duration
                if adjusted_start >= original_duration:
                    continue
                
                # Trim subtitles that extend beyond original duration
                if adjusted_end > original_duration:
                    adjusted_end = original_duration
                
                merged_subtitles.append({
                    'index': subtitle_index,
                    'start': adjusted_start,
                    'end': adjusted_end,
                    'text': subtitle['text']
                })
                subtitle_index += 1
        
        # Remove duplicates from overlapping chunks
        merged_subtitles = self._remove_duplicate_subtitles(merged_subtitles)
        
        # Convert back to SRT format
        return self._format_as_srt(merged_subtitles)
    
    def _parse_srt_content(self, srt_content: str) -> List[dict]:
        """Parse SRT content into structured data."""
        subtitles = []
        lines = srt_content.strip().split('\n')
        
        i = 0
        while i < len(lines):
            if lines[i].strip().isdigit():
                index = int(lines[i].strip())
                
                if i + 1 < len(lines) and '-->' in lines[i + 1]:
                    # Parse timestamp
                    start_str, end_str = lines[i + 1].split(' --> ')
                    start_time = self._parse_srt_timestamp(start_str.strip())
                    end_time = self._parse_srt_timestamp(end_str.strip())
                    
                    # Collect text lines
                    text_lines = []
                    j = i + 2
                    while j < len(lines) and lines[j].strip():
                        text_lines.append(lines[j])
                        j += 1
                    
                    subtitles.append({
                        'index': index,
                        'start': start_time,
                        'end': end_time,
                        'text': '\n'.join(text_lines)
                    })
                    
                    i = j + 1
                else:
                    i += 1
            else:
                i += 1
        
        return subtitles
    
    def _parse_srt_timestamp(self, timestamp_str: str) -> float:
        """Parse SRT timestamp to seconds."""
        # Format: HH:MM:SS,mmm
        time_part, ms_part = timestamp_str.split(',')
        hours, minutes, seconds = map(int, time_part.split(':'))
        milliseconds = int(ms_part)
        
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
    
    def _remove_duplicate_subtitles(self, subtitles: List[dict]) -> List[dict]:
        """Remove duplicate subtitles from overlapping chunks."""
        unique_subtitles = []
        seen_content = set()
        
        for subtitle in sorted(subtitles, key=lambda x: x['start']):
            # Create content signature for deduplication
            content_sig = (
                round(subtitle['start'], 1),
                round(subtitle['end'], 1),
                subtitle['text'].strip()
            )
            
            if content_sig not in seen_content:
                unique_subtitles.append(subtitle)
                seen_content.add(content_sig)
        
        # Renumber indices
        for i, subtitle in enumerate(unique_subtitles):
            subtitle['index'] = i + 1
        
        return unique_subtitles
    
    def _format_as_srt(self, subtitles: List[dict]) -> str:
        """Format subtitles as SRT content."""
        srt_lines = []
        
        for subtitle in subtitles:
            srt_lines.append(str(subtitle['index']))
            
            start_time = self._format_srt_timestamp(subtitle['start'])
            end_time = self._format_srt_timestamp(subtitle['end'])
            srt_lines.append(f"{start_time} --> {end_time}")
            
            srt_lines.append(subtitle['text'])
            srt_lines.append("")  # Empty line
        
        return '\n'.join(srt_lines)
    
    def _format_srt_timestamp(self, seconds: float) -> str:
        """Format seconds as SRT timestamp."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        milliseconds = int((seconds % 1) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"
    
    def cleanup_chunks(self):
        """Clean up temporary chunk files."""
        for chunk_file in self.temp_dir.glob("*_chunk_*"):
            chunk_file.unlink(missing_ok=True)
```

## 3. Enhanced Error Handling & Warning System

### Warning System for Missing API Keys
```python
# src/infrastructure/services/warning_service.py
import sys
from enum import Enum
from typing import Optional
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

class WarningLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class AccuracyWarningService:
    """Service for handling accuracy warnings and graceful degradation."""
    
    def __init__(self, console: Optional[Console] = None):
        """Initialize warning service."""
        self.console = console or Console()
        self.warnings_issued = []
    
    def warn_missing_gemini_key(self, impact_features: List[str]):
        """Warn about missing Gemini API key and impact on accuracy."""
        warning_text = Text()
        warning_text.append("⚠️ Gemini API Key Not Found\n\n", style="bold yellow")
        warning_text.append("The following features will be disabled:\n", style="yellow")
        
        for feature in impact_features:
            warning_text.append(f"  • {feature}\n", style="yellow")
        
        warning_text.append("\nThis may result in reduced subtitle accuracy.\n", style="yellow")
        warning_text.append("To enable full functionality:\n", style="white")
        warning_text.append("  1. Set GEMINI_API_KEY in .env file\n", style="cyan")
        warning_text.append("  2. Set GEMINI_API_KEY environment variable\n", style="cyan")
        warning_text.append("  3. Use --gemini-key argument\n", style="cyan")
        
        self.console.print(Panel(
            warning_text,
            title="🤖 Gemini Integration Warning",
            border_style="yellow",
            title_align="left"
        ))
        
        self.warnings_issued.append("missing_gemini_key")
    
    def warn_chunking_required(self, file_size_mb: float, chunk_count: int):
        """Warn about file chunking requirements."""
        warning_text = Text()
        warning_text.append("📊 Large File Detected\n\n", style="bold blue")
        warning_text.append(f"File size: {file_size_mb:.1f} MB\n", style="blue")
        warning_text.append(f"Will be processed in {chunk_count} chunks\n\n", style="blue")
        warning_text.append("This may take longer but ensures complete processing.", style="white")
        
        self.console.print(Panel(
            warning_text,
            title="📁 File Chunking Notice",
            border_style="blue",
            title_align="left"
        ))
    
    def warn_rate_limit_risk(self, estimated_tokens: int, rate_limit: int):
        """Warn about potential rate limiting."""
        if estimated_tokens > rate_limit * 0.8:  # 80% of rate limit
            warning_text = Text()
            warning_text.append("🚦 Rate Limit Warning\n\n", style="bold orange3")
            warning_text.append(f"Estimated tokens: {estimated_tokens:,}\n", style="orange3")
            warning_text.append(f"Rate limit: {rate_limit:,}/minute\n\n", style="orange3")
            warning_text.append("Processing may be throttled. Consider:", style="white")
            warning_text.append("\n  • Smaller video chunks\n", style="cyan")
            warning_text.append("  • Lower resolution compression\n", style="cyan")
            warning_text.append("  • Paid tier for higher limits\n", style="cyan")
            
            self.console.print(Panel(
                warning_text,
                title="⚡ API Rate Limit Warning",
                border_style="orange3",
                title_align="left"
            ))
```

## 4. Enhanced CLI Integration

### Updated CLI Command with .env Support
```python
# Enhanced CLI command in src/presentation/cli/commands.py
def generate_command(
    input_file: Path = typer.Argument(...),
    output_file: Optional[Path] = typer.Option(None, "--output", "-o"),
    language: str = typer.Option("zh", "--language", "-l"),
    model: Optional[str] = typer.Option(None, "--model", "-m"),
    priority: str = typer.Option("balanced", "--priority", "-p"),
    
    # Enhanced speaker option
    speakers: bool = typer.Option(
        False,
        "--speakers",
        help="Enable automatic speaker identification using Gemini Flash"
    ),
    
    written: bool = typer.Option(False, "--written"),
    music: bool = typer.Option(False, "--music"),
    charset: str = typer.Option("traditional", "--charset"),
    
    # Gemini Flash options with .env support
    gemini_api_key: Optional[str] = typer.Option(
        None,
        "--gemini-key",
        help="Google Gemini API key (overrides .env file and environment variables)"
    ),
    
    disable_gemini_refinement: bool = typer.Option(
        False,
        "--no-gemini-refinement",
        help="Disable Gemini Flash transcription refinement"
    ),
    
    # Enhanced chunking options
    max_chunk_duration: int = typer.Option(
        15,
        "--max-chunk-duration",
        help="Maximum chunk duration in minutes for large files"
    ),
    
    video_quality: str = typer.Option(
        "360p",
        "--video-quality",
        help="Video compression quality for LLM analysis (360p, 480p, 720p)"
    ),
    
    verbose: bool = typer.Option(False, "--verbose"),
    ipc_mode: bool = typer.Option(False, "--ipc-mode")
) -> None:
    """Generate Cantonese subtitles with enhanced Gemini Flash integration."""
    
    try:
        # Initialize services
        config_service = ConfigurationService()
        warning_service = AccuracyWarningService()
        chunking_service = MediaChunkingService(
            ChunkingStrategy(max_chunk_duration_seconds=max_chunk_duration * 60)
        )
        
        # Resolve Gemini API key with priority order
        resolved_gemini_key = config_service.get_gemini_api_key(gemini_api_key)
        is_valid, message = config_service.validate_gemini_configuration(resolved_gemini_key)
        
        # Handle missing API key with graceful degradation
        if not is_valid:
            impact_features = []
            if speakers:
                impact_features.append("Automatic speaker identification")
            if not disable_gemini_refinement:
                impact_features.append("AI-powered transcription refinement")
            
            if impact_features:
                warning_service.warn_missing_gemini_key(impact_features)
                
                # Disable Gemini features gracefully
                speakers = False
                disable_gemini_refinement = True
        
        # Check if chunking is required
        if chunking_service.should_chunk_file(FilePath.from_string(str(input_file))):
            file_size_mb = chunking_service._get_file_size_mb(FilePath.from_string(str(input_file)))
            chunks = chunking_service.create_chunks(FilePath.from_string(str(input_file)))
            warning_service.warn_chunking_required(file_size_mb, len(chunks))
        
        # Create enhanced command
        command = GenerateSubtitlesCommand(
            input_file_path=str(input_file),
            output_file_path=str(output_file) if output_file else None,
            language=language,
            model_name=model,
            enable_speakers=speakers,
            enable_written_style=written,
            enable_music_detection=music,
            charset=charset,
            enable_gemini_refinement=not disable_gemini_refinement,
            gemini_api_key=resolved_gemini_key,
            video_compression_quality=video_quality
        )
        
        # Continue with existing execution logic...
        
    except Exception as e:
        # Enhanced error handling...
        handle_error(e, context="Enhanced generate command", exit_code=1, ipc_mode=ipc_mode)
```

## Implementation Benefits

✅ **Robust Configuration**: .env support with graceful fallback hierarchy
✅ **Large File Support**: Intelligent chunking for files >2GB or >15 minutes  
✅ **User-Friendly Warnings**: Clear guidance when features are unavailable
✅ **Token Optimization**: Conservative chunking to avoid rate limits
✅ **Backward Compatibility**: Existing workflows continue to work
✅ **Production Ready**: Comprehensive error handling and resource cleanup

## Usage Examples

### Basic usage with .env file:
```bash
# .env file
GEMINI_API_KEY=your_api_key_here

# Command
cantocap large_video.mp4 --speakers --written
```

### Large file with chunking:
```bash
cantocap 2hour_movie.mp4 --speakers --max-chunk-duration 10
```

### Graceful degradation without API key:
```bash
cantocap video.mp4 --speakers
# Warning: Gemini features disabled, continuing with Whisper only
```