"""Service for chunking large media files for Gemini Flash processing."""

from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any
import subprocess
from pathlib import Path
import math
import re

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


@dataclass
class AdaptiveChunkingStrategy:
    """Unified chunking strategies optimized for AI services working together."""
    
    # Whisper-optimized settings (based on 30-second receptive field)
    whisper_chunk_duration: float = 30.0  # Optimal for Whisper's native receptive field
    whisper_overlap: float = 5.0  # Minimal overlap for audio continuity
    whisper_max_size_mb: float = 500  # Conservative for local processing
    
    # Gemini Flash-optimized settings (based on 1M token context window)
    gemini_chunk_duration: float = 900.0  # 15 minutes, optimal for video processing
    gemini_overlap: float = 30.0  # Overlap for context continuity
    gemini_max_size_mb: float = 1800  # Under 2GB API limit
    
    
    def get_whisper_strategy(self) -> ChunkingStrategy:
        """Get chunking strategy optimized for OpenAI Whisper transcription."""
        return ChunkingStrategy(
            max_chunk_duration_seconds=self.whisper_chunk_duration,
            max_chunk_size_mb=self.whisper_max_size_mb,
            overlap_seconds=self.whisper_overlap,
            max_tokens_per_chunk=1000  # Lower for local processing
        )
    
    def get_gemini_strategy(self) -> ChunkingStrategy:
        """Get chunking strategy optimized for Google Gemini refinement."""
        return ChunkingStrategy(
            max_chunk_duration_seconds=self.gemini_chunk_duration,
            max_chunk_size_mb=self.gemini_max_size_mb,
            overlap_seconds=self.gemini_overlap,
            max_tokens_per_chunk=25000  # Higher for cloud processing
        )


class MediaChunkingService:
    """Service for chunking large media files for AI processing with adaptive strategies."""
    
    def __init__(self, strategy: Optional[ChunkingStrategy] = None, adaptive_strategy: Optional[AdaptiveChunkingStrategy] = None):
        """Initialize with chunking strategy."""
        self.strategy = strategy or ChunkingStrategy()
        self.adaptive_strategy = adaptive_strategy or AdaptiveChunkingStrategy()
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
        try:
            file_size_mb = self._get_file_size_mb(file_path)
            duration_seconds = self._get_media_duration(file_path)
            
            # Chunk if file is too large or too long
            return (
                file_size_mb > self.strategy.max_chunk_size_mb or
                duration_seconds > self.strategy.max_chunk_duration_seconds
            )
        except Exception:
            # If we can't determine size/duration, err on the side of caution
            return True
    
    def create_whisper_chunks(self, file_path: FilePath) -> List[ChunkInfo]:
        """
        Create chunks optimized for OpenAI Whisper transcription.
        
        Args:
            file_path: Path to original media file
            
        Returns:
            List of chunk information optimized for Whisper
        """
        # Use Whisper-optimized strategy
        original_strategy = self.strategy
        self.strategy = self.adaptive_strategy.get_whisper_strategy()
        chunks = self.create_chunks(file_path)
        self.strategy = original_strategy  # Restore original strategy
        return chunks
    
    def create_gemini_chunks(self, file_path: FilePath) -> List[ChunkInfo]:
        """
        Create chunks optimized for Google Gemini refinement.
        
        Args:
            file_path: Path to original media file
            
        Returns:
            List of chunk information optimized for Gemini
        """
        # Use Gemini-optimized strategy
        original_strategy = self.strategy
        self.strategy = self.adaptive_strategy.get_gemini_strategy()
        chunks = self.create_chunks(file_path)
        self.strategy = original_strategy  # Restore original strategy
        return chunks
    
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
        
        # Safety counter to prevent infinite loops
        max_iterations = int(math.ceil(duration / (chunk_duration - overlap))) + 1
        iteration_count = 0
        
        # Validate chunking parameters
        if overlap >= chunk_duration:
            raise ValueError(f"Overlap ({overlap}s) cannot be >= chunk duration ({chunk_duration}s)")
        if chunk_duration <= 0:
            raise ValueError(f"Chunk duration must be positive, got {chunk_duration}s")
        
        while current_start < duration and iteration_count < max_iterations:
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
            
            # Break if we've reached the end of the video
            if chunk_end >= duration:
                break
            
            # Move to next chunk with overlap
            next_start = chunk_end - overlap
            
            # Ensure we make forward progress - prevent infinite loops
            if next_start <= current_start:
                # If overlap is too large, move forward by a minimal amount
                next_start = current_start + (chunk_duration - overlap) / 2
                if next_start >= duration:
                    break
            
            current_start = next_start
            chunk_index += 1
            iteration_count += 1
        
        # Check if we hit the safety limit
        if iteration_count >= max_iterations:
            import warnings
            warnings.warn(
                f"Chunking hit safety limit of {max_iterations} iterations. "
                f"This may indicate a configuration issue. "
                f"Duration: {duration}s, Chunk: {chunk_duration}s, Overlap: {overlap}s",
                UserWarning
            )
        
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
    
    def split_srt_by_chunks(self, srt_content: str, chunks: List[ChunkInfo]) -> List[str]:
        """
        Split SRT content by time chunks with proper timestamp alignment.
        
        Args:
            srt_content: Original SRT content
            chunks: List of chunk information with timestamps
            
        Returns:
            List of SRT content strings aligned with chunks
        """
        # Parse original SRT into structured data
        subtitles = self._parse_srt_content(srt_content)
        chunk_srt_contents = []
        
        for chunk_info in chunks:
            chunk_start = chunk_info.start_time.seconds
            chunk_end = chunk_info.end_time.seconds
            chunk_subtitles = []
            subtitle_index = 1
            
            for subtitle in subtitles:
                sub_start = subtitle['start']
                sub_end = subtitle['end']
                
                # Check if subtitle overlaps with chunk
                if sub_end > chunk_start and sub_start < chunk_end:
                    # Adjust subtitle timing relative to chunk start
                    adjusted_start = max(0, sub_start - chunk_start)
                    adjusted_end = min(chunk_end - chunk_start, sub_end - chunk_start)
                    
                    # Only include if there's meaningful overlap
                    if adjusted_end > adjusted_start and adjusted_end > 0:
                        chunk_subtitles.append({
                            'index': subtitle_index,
                            'start': adjusted_start,
                            'end': adjusted_end,
                            'text': subtitle['text']
                        })
                        subtitle_index += 1
            
            # Convert chunk subtitles back to SRT format
            chunk_srt = self._format_as_srt(chunk_subtitles)
            chunk_srt_contents.append(chunk_srt)
        
        return chunk_srt_contents
    
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
        
        # Remove duplicates from overlapping chunks with improved algorithm
        merged_subtitles = self._remove_duplicate_subtitles_enhanced(merged_subtitles)
        
        # Convert back to SRT format
        return self._format_as_srt(merged_subtitles)
    
    def _parse_srt_content(self, srt_content: str) -> List[Dict[str, Any]]:
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
    
    def _remove_duplicate_subtitles_enhanced(self, subtitles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate subtitles with enhanced overlap handling."""
        if not subtitles:
            return []
        
        # Sort by start time
        sorted_subtitles = sorted(subtitles, key=lambda x: x['start'])
        unique_subtitles = []
        
        for current in sorted_subtitles:
            should_add = True
            
            # Check against existing subtitles for overlaps
            for existing in unique_subtitles:
                # Calculate overlap percentage
                overlap_start = max(current['start'], existing['start'])
                overlap_end = min(current['end'], existing['end'])
                
                if overlap_start < overlap_end:  # There is overlap
                    overlap_duration = overlap_end - overlap_start
                    current_duration = current['end'] - current['start']
                    existing_duration = existing['end'] - existing['start']
                    
                    # Calculate overlap percentage for both subtitles
                    current_overlap_pct = overlap_duration / max(current_duration, 0.1)
                    existing_overlap_pct = overlap_duration / max(existing_duration, 0.1)
                    
                    # If high overlap (>70%) and similar text, consider duplicate
                    if (current_overlap_pct > 0.7 or existing_overlap_pct > 0.7):
                        text_similarity = self._calculate_text_similarity(
                            current['text'], existing['text']
                        )
                        if text_similarity > 0.8:  # 80% text similarity
                            should_add = False
                            break
            
            if should_add:
                unique_subtitles.append(current)
        
        # Renumber indices
        for i, subtitle in enumerate(unique_subtitles):
            subtitle['index'] = i + 1
        
        return unique_subtitles
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity using simple character-based comparison."""
        if not text1 or not text2:
            return 0.0
        
        # Simple character-based similarity
        text1_clean = ''.join(text1.split()).lower()
        text2_clean = ''.join(text2.split()).lower()
        
        if text1_clean == text2_clean:
            return 1.0
        
        # Calculate Jaccard similarity of character sets
        set1 = set(text1_clean)
        set2 = set(text2_clean)
        
        if not set1 and not set2:
            return 1.0
        
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        return intersection / union if union > 0 else 0.0
    
    def _remove_duplicate_subtitles(self, subtitles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
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
    
    def _format_as_srt(self, subtitles: List[Dict[str, Any]]) -> str:
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
        
        # Remove empty temp directory
        try:
            self.temp_dir.rmdir()
        except OSError:
            pass  # Directory not empty or doesn't exist