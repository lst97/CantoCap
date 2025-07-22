"""Domain service for subtitle formatting and optimization."""

from typing import List, Tuple, Optional
import re

from ..entities import Transcription, Subtitle, SubtitleDocument
from ..value_objects import Timestamp


class SubtitleFormattingService:
    """Domain service for formatting and optimizing subtitles."""
    
    def __init__(
        self,
        max_chars_per_line: int = 40,
        max_lines: int = 2,
        min_duration: float = 0.5,
        max_duration: float = 10.0,
        min_gap: float = 0.1
    ):
        """Initialize with formatting constraints."""
        self.max_chars_per_line = max_chars_per_line
        self.max_lines = max_lines
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.min_gap = min_gap
    
    def create_subtitle_document_from_transcription(
        self,
        transcription: Transcription,
        source_file_path: Optional[str] = None
    ) -> SubtitleDocument:
        """Create optimized subtitle document from transcription."""
        # Create initial subtitles from transcription chunks
        raw_subtitles = [
            Subtitle.from_transcription_chunk(i + 1, chunk)
            for i, chunk in enumerate(transcription.chunks)
        ]
        
        # Apply formatting optimizations
        optimized_subtitles = self._optimize_subtitles(raw_subtitles)
        
        # Create document
        from ..value_objects import FilePath
        source_file = FilePath.from_string(source_file_path) if source_file_path else None
        
        return SubtitleDocument.create(
            subtitles=optimized_subtitles,
            source_file=source_file,
            language=transcription.language
        )
    
    def _optimize_subtitles(self, subtitles: List[Subtitle]) -> List[Subtitle]:
        """Apply subtitle optimizations."""
        if not subtitles:
            return subtitles
        
        # Step 1: Fix text formatting
        formatted_subtitles = [self._format_subtitle_text(s) for s in subtitles]
        
        # Step 2: Merge short subtitles
        merged_subtitles = self._merge_short_subtitles(formatted_subtitles)
        
        # Step 3: Split long subtitles
        split_subtitles = self._split_long_subtitles(merged_subtitles)
        
        # Step 4: Fix timing issues
        timing_fixed_subtitles = self._fix_timing_issues(split_subtitles)
        
        # Step 5: Re-index subtitles
        final_subtitles = self._reindex_subtitles(timing_fixed_subtitles)
        
        return final_subtitles
    
    def _format_subtitle_text(self, subtitle: Subtitle) -> Subtitle:
        """Format subtitle text for better readability."""
        text = subtitle.content
        
        # Clean up text
        text = self._clean_text(text)
        
        # Break into lines if too long
        text = self._break_into_lines(text)
        
        # Create new subtitle with formatted text
        return Subtitle(
            index=subtitle.index,
            start_time=subtitle.start_time,
            end_time=subtitle.end_time,
            content=text
        )
    
    def _clean_text(self, text: str) -> str:
        """Clean up transcription text."""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Remove common transcription artifacts
        text = re.sub(r'\[.*?\]', '', text)  # Remove [noise], [music] etc.
        text = re.sub(r'\(.*?\)', '', text)  # Remove (unclear) etc.
        text = re.sub(r'[.,!?]+\s*$', '', text)  # Remove trailing punctuation
        
        # Clean up Chinese punctuation
        text = text.replace('。。', '。')
        text = text.replace('，，', '，')
        text = text.replace('？？', '？')
        text = text.replace('！！', '！')
        
        return text.strip()
    
    def _break_into_lines(self, text: str) -> str:
        """Break text into multiple lines if needed."""
        # For Chinese text, we need to handle character-based breaking
        if len(text) <= self.max_chars_per_line:
            return text
        
        # Try to break at natural points (punctuation)
        break_points = [',', '，', '。', '？', '！', '；', '：']
        
        lines = []
        current_line = ""
        
        for char in text:
            current_line += char
            
            # Check if we should break here
            if (len(current_line) >= self.max_chars_per_line and 
                char in break_points and 
                len(lines) < self.max_lines - 1):
                lines.append(current_line.strip())
                current_line = ""
        
        # Add remaining text
        if current_line.strip():
            lines.append(current_line.strip())
        
        # If we have too many lines, merge them back
        if len(lines) > self.max_lines:
            # Keep first line, merge rest
            if len(lines) >= 2:
                lines = [lines[0], ''.join(lines[1:])]
        
        return '\n'.join(lines)
    
    def _merge_short_subtitles(self, subtitles: List[Subtitle]) -> List[Subtitle]:
        """Merge subtitles that are too short."""
        if len(subtitles) <= 1:
            return subtitles
        
        merged = []
        i = 0
        
        while i < len(subtitles):
            current = subtitles[i]
            
            # Check if current subtitle is too short and can be merged
            if (current.get_duration_seconds() < self.min_duration and 
                i + 1 < len(subtitles)):
                
                next_subtitle = subtitles[i + 1]
                
                # Check if gap between subtitles is small enough to merge
                gap = next_subtitle.start_time.seconds - current.end_time.seconds
                if gap <= self.min_gap * 2:  # Allow slightly larger gap for merging
                    # Merge current and next subtitle
                    merged_text = f"{current.content} {next_subtitle.content}".strip()
                    merged_subtitle = Subtitle(
                        index=current.index,
                        start_time=current.start_time,
                        end_time=next_subtitle.end_time,
                        content=merged_text
                    )
                    merged.append(merged_subtitle)
                    i += 2  # Skip both subtitles
                    continue
            
            merged.append(current)
            i += 1
        
        return merged
    
    def _split_long_subtitles(self, subtitles: List[Subtitle]) -> List[Subtitle]:
        """Split subtitles that are too long."""
        split = []
        
        for subtitle in subtitles:
            if subtitle.get_duration_seconds() <= self.max_duration:
                split.append(subtitle)
                continue
            
            # Split long subtitle
            split_subtitles = self._split_subtitle(subtitle)
            split.extend(split_subtitles)
        
        return split
    
    def _split_subtitle(self, subtitle: Subtitle) -> List[Subtitle]:
        """Split a single long subtitle into multiple parts."""
        duration = subtitle.get_duration_seconds()
        text = subtitle.content
        
        # Calculate number of parts needed
        num_parts = max(2, int(duration / self.max_duration) + 1)
        
        # Split text into parts
        lines = text.split('\n')
        if len(lines) >= num_parts:
            # Split by lines
            text_parts = []
            chars_per_part = len(text) // num_parts
            current_part = ""
            
            for line in lines:
                if len(current_part) + len(line) > chars_per_part and current_part:
                    text_parts.append(current_part.strip())
                    current_part = line
                else:
                    current_part += f"\n{line}" if current_part else line
            
            if current_part.strip():
                text_parts.append(current_part.strip())
        else:
            # Split by character count
            chars_per_part = len(text) // num_parts
            text_parts = []
            
            for i in range(num_parts):
                start_idx = i * chars_per_part
                end_idx = (i + 1) * chars_per_part if i < num_parts - 1 else len(text)
                part = text[start_idx:end_idx].strip()
                if part:
                    text_parts.append(part)
        
        # Create subtitle parts with timing
        subtitle_parts = []
        time_per_part = duration / len(text_parts)
        
        for i, text_part in enumerate(text_parts):
            start_seconds = subtitle.start_time.seconds + (i * time_per_part)
            end_seconds = subtitle.start_time.seconds + ((i + 1) * time_per_part)
            
            part_subtitle = Subtitle(
                index=subtitle.index,  # Will be re-indexed later
                start_time=Timestamp.from_seconds(start_seconds),
                end_time=Timestamp.from_seconds(end_seconds),
                content=text_part
            )
            subtitle_parts.append(part_subtitle)
        
        return subtitle_parts
    
    def _fix_timing_issues(self, subtitles: List[Subtitle]) -> List[Subtitle]:
        """Fix overlapping and gap issues."""
        if len(subtitles) <= 1:
            return subtitles
        
        fixed = []
        
        for i, subtitle in enumerate(subtitles):
            if i == 0:
                fixed.append(subtitle)
                continue
            
            prev_subtitle = fixed[-1]
            current_subtitle = subtitle
            
            # Check for overlap
            if prev_subtitle.end_time > current_subtitle.start_time:
                # Fix overlap by adjusting end time of previous subtitle
                gap_time = self.min_gap
                new_end_time = Timestamp.from_seconds(
                    current_subtitle.start_time.seconds - gap_time
                )
                
                # Make sure previous subtitle still has minimum duration
                if new_end_time.seconds - prev_subtitle.start_time.seconds >= self.min_duration:
                    fixed[-1] = Subtitle(
                        index=prev_subtitle.index,
                        start_time=prev_subtitle.start_time,
                        end_time=new_end_time,
                        content=prev_subtitle.content
                    )
            
            fixed.append(current_subtitle)
        
        return fixed
    
    def _reindex_subtitles(self, subtitles: List[Subtitle]) -> List[Subtitle]:
        """Re-index subtitles to be sequential."""
        return [
            Subtitle(
                index=i + 1,
                start_time=subtitle.start_time,
                end_time=subtitle.end_time,
                content=subtitle.content
            )
            for i, subtitle in enumerate(subtitles)
        ]
    
    def get_formatting_statistics(self, document: SubtitleDocument) -> dict:
        """Get statistics about subtitle formatting quality."""
        subtitles = document.subtitles
        
        return {
            "total_subtitles": len(subtitles),
            "short_subtitles": len([s for s in subtitles if s.is_too_short(self.min_duration)]),
            "long_subtitles": len([s for s in subtitles if s.is_too_long(self.max_duration)]),
            "long_text_subtitles": len([s for s in subtitles if s.is_too_long_text(self.max_chars_per_line)]),
            "has_overlaps": document.has_overlapping_subtitles(),
            "average_duration": document.get_total_duration() / len(subtitles) if subtitles else 0,
            "quality_score": self._calculate_quality_score(document)
        }
    
    def _calculate_quality_score(self, document: SubtitleDocument) -> float:
        """Calculate overall quality score (0-1)."""
        if not document.subtitles:
            return 0.0
        
        total_subtitles = len(document.subtitles)
        issues = 0
        
        # Count various issues
        issues += len([s for s in document.subtitles if s.is_too_short(self.min_duration)])
        issues += len([s for s in document.subtitles if s.is_too_long(self.max_duration)])
        issues += len([s for s in document.subtitles if s.is_too_long_text(self.max_chars_per_line)])
        
        if document.has_overlapping_subtitles():
            issues += 1
        
        # Calculate score
        max_possible_issues = total_subtitles * 3 + 1  # 3 timing/text issues per subtitle + 1 overlap
        quality_score = 1.0 - (issues / max_possible_issues)
        
        return max(0.0, min(1.0, quality_score))