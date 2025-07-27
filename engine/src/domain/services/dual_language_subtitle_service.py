"""Domain service for dual-language subtitle formatting."""

from typing import List, Optional
import re

from ..entities import Subtitle, SubtitleDocument
from ..value_objects import Timestamp


class DualLanguageSubtitleService:
    """Service for creating dual-language subtitle documents."""
    
    def __init__(
        self,
        max_chars_per_line: int = 35,  # Reduced for dual-language display
        max_lines: int = 4,  # Increased to accommodate translation
        line_separator: str = '\n'
    ):
        """Initialize with dual-language formatting constraints."""
        self.max_chars_per_line = max_chars_per_line
        self.max_lines = max_lines
        self.line_separator = line_separator
    
    def create_dual_language_document(
        self,
        chinese_document: SubtitleDocument,
        translated_srt_content: str,
        target_language: str,
        source_file_path: Optional[str] = None
    ) -> SubtitleDocument:
        """
        Create dual-language subtitle document with Chinese and translated text.
        
        Args:
            chinese_document: Original Chinese subtitle document
            translated_srt_content: Translated SRT content
            target_language: Target language name
            source_file_path: Source file path for document
            
        Returns:
            SubtitleDocument with dual-language subtitles
        """
        # Parse translated SRT content
        translated_subtitles = self._parse_srt_content(translated_srt_content)
        
        # Create subtitle mapping by timing
        subtitle_map = self._create_subtitle_timing_map(translated_subtitles)
        
        # Create dual-language subtitles
        dual_subtitles = []
        
        for chinese_subtitle in chinese_document.subtitles:
            # Find matching translated subtitle by timing
            matching_translation = self._find_matching_subtitle(
                chinese_subtitle, subtitle_map
            )
            
            # Create dual-language subtitle
            dual_subtitle = self._create_dual_language_subtitle(
                chinese_subtitle, matching_translation
            )
            
            dual_subtitles.append(dual_subtitle)
        
        # Create new document
        from ..value_objects import FilePath
        source_file = FilePath.from_string(source_file_path) if source_file_path else None
        
        return SubtitleDocument.create(
            subtitles=dual_subtitles,
            source_file=source_file,
            language=f"{chinese_document.language}+{target_language}"
        )
    
    def _parse_srt_content(self, srt_content: str) -> List[Subtitle]:
        """Parse SRT content into Subtitle objects."""
        subtitles = []
        lines = srt_content.strip().split('\n')
        
        i = 0
        while i < len(lines):
            # Skip empty lines
            if not lines[i].strip():
                i += 1
                continue
            
            # Parse subtitle index
            if not lines[i].strip().isdigit():
                i += 1
                continue
            
            subtitle_index = int(lines[i].strip())
            i += 1
            
            # Parse timing line
            if i >= len(lines) or '-->' not in lines[i]:
                continue
            
            timing_line = lines[i].strip()
            start_time_str, end_time_str = timing_line.split(' --> ')
            
            start_time = self._parse_timestamp(start_time_str)
            end_time = self._parse_timestamp(end_time_str)
            i += 1
            
            # Parse content lines
            content_lines = []
            while i < len(lines) and lines[i].strip() and not lines[i].strip().isdigit():
                content_lines.append(lines[i].strip())
                i += 1
            
            content = '\n'.join(content_lines)
            
            # Create subtitle
            subtitle = Subtitle(
                index=subtitle_index,
                start_time=start_time,
                end_time=end_time,
                content=content
            )
            subtitles.append(subtitle)
        
        return subtitles
    
    def _parse_timestamp(self, timestamp_str: str) -> Timestamp:
        """Parse SRT timestamp string to Timestamp object."""
        # Format: HH:MM:SS,mmm
        timestamp_str = timestamp_str.replace(',', '.')
        hours, minutes, seconds = timestamp_str.split(':')
        
        total_seconds = (
            int(hours) * 3600 +
            int(minutes) * 60 +
            float(seconds)
        )
        
        return Timestamp.from_seconds(total_seconds)
    
    def _create_subtitle_timing_map(self, subtitles: List[Subtitle]) -> dict:
        """Create a mapping of timing ranges to subtitles."""
        timing_map = {}
        
        for subtitle in subtitles:
            # Use start time as key (rounded to avoid floating point issues)
            # Handle both Timestamp objects and float values
            if hasattr(subtitle.start_time, 'seconds'):
                start_key = round(subtitle.start_time.seconds, 3)
            else:
                start_key = round(float(subtitle.start_time), 3)
            timing_map[start_key] = subtitle
        
        return timing_map
    
    def _find_matching_subtitle(
        self, 
        chinese_subtitle: Subtitle, 
        subtitle_map: dict
    ) -> Optional[Subtitle]:
        """Find matching translated subtitle by timing."""
        # Handle both Timestamp objects and float values
        if hasattr(chinese_subtitle.start_time, 'seconds'):
            start_key = round(chinese_subtitle.start_time.seconds, 3)
        else:
            start_key = round(float(chinese_subtitle.start_time), 3)
        
        # Try exact match first
        if start_key in subtitle_map:
            return subtitle_map[start_key]
        
        # Try approximate match (within 0.1 seconds)
        tolerance = 0.1
        for map_start_key, subtitle in subtitle_map.items():
            if abs(map_start_key - start_key) <= tolerance:
                return subtitle
        
        return None
    
    def _create_dual_language_subtitle(
        self,
        chinese_subtitle: Subtitle,
        translated_subtitle: Optional[Subtitle]
    ) -> Subtitle:
        """Create a dual-language subtitle combining Chinese and translation."""
        # Start with Chinese text
        chinese_text = chinese_subtitle.content.strip()
        
        # Clean and optimize Chinese text for dual-language display
        chinese_text = self._optimize_text_for_dual_display(chinese_text)
        
        # Build dual-language content
        if translated_subtitle:
            translated_text = translated_subtitle.content.strip()
            translated_text = self._optimize_text_for_dual_display(translated_text)
            
            # Combine Chinese and translation
            dual_content = self._combine_texts(chinese_text, translated_text)
        else:
            # No translation available, use Chinese only
            dual_content = chinese_text
        
        return Subtitle(
            index=chinese_subtitle.index,
            start_time=chinese_subtitle.start_time,
            end_time=chinese_subtitle.end_time,
            content=dual_content
        )
    
    def _optimize_text_for_dual_display(self, text: str) -> str:
        """Optimize text for dual-language subtitle display."""
        # Clean up text
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Remove speaker tags from display text (they're metadata)
        text = re.sub(r'^\[SPEAKER_\d+\]\s*', '', text)
        
        # Break long lines for better readability
        if len(text) > self.max_chars_per_line:
            text = self._break_text_into_lines(text)
        
        return text
    
    def _break_text_into_lines(self, text: str) -> str:
        """Break text into multiple lines for better readability."""
        # For dual-language, we want shorter lines
        words = text.split(' ')
        lines = []
        current_line = ""
        
        for word in words:
            # Check if adding this word would exceed line length
            test_line = f"{current_line} {word}".strip()
            if len(test_line) <= self.max_chars_per_line:
                current_line = test_line
            else:
                # Start new line
                if current_line:
                    lines.append(current_line)
                current_line = word
        
        # Add the last line
        if current_line:
            lines.append(current_line)
        
        # Limit to reasonable number of lines per language
        max_lines_per_language = self.max_lines // 2
        if len(lines) > max_lines_per_language:
            # Merge lines if too many
            lines = lines[:max_lines_per_language-1] + [' '.join(lines[max_lines_per_language-1:])]
        
        return '\n'.join(lines)
    
    def _combine_texts(self, chinese_text: str, translated_text: str) -> str:
        """Combine Chinese and translated text into dual-language format."""
        # Format: Chinese text on top, translation below
        # Use different line separators if needed
        
        # Clean both texts
        chinese_lines = [line.strip() for line in chinese_text.split('\n') if line.strip()]
        translated_lines = [line.strip() for line in translated_text.split('\n') if line.strip()]
        
        # Combine with clear separation
        combined_lines = []
        
        # Add Chinese text
        combined_lines.extend(chinese_lines)
        
        # Add separator (empty line or visual separator)
        combined_lines.append('')  # Empty line for separation
        
        # Add translated text
        combined_lines.extend(translated_lines)
        
        # Join with newlines
        result = '\n'.join(combined_lines)
        
        # Clean up any excessive newlines
        result = re.sub(r'\n{3,}', '\n\n', result)
        
        return result.strip()
    
    def get_dual_language_statistics(self, document: SubtitleDocument) -> dict:
        """Get statistics about dual-language subtitle formatting."""
        subtitles = document.subtitles
        
        # Count subtitles with translations
        dual_language_count = 0
        chinese_only_count = 0
        
        for subtitle in subtitles:
            content_lines = [line.strip() for line in subtitle.content.split('\n') if line.strip()]
            if len(content_lines) > 2:  # Chinese + empty line + translation
                dual_language_count += 1
            else:
                chinese_only_count += 1
        
        # Calculate average line counts
        total_lines = sum(len(subtitle.content.split('\n')) for subtitle in subtitles)
        average_lines = total_lines / len(subtitles) if subtitles else 0
        
        # Calculate text lengths
        max_line_length = 0
        for subtitle in subtitles:
            for line in subtitle.content.split('\n'):
                max_line_length = max(max_line_length, len(line.strip()))
        
        # Enhanced translation coverage calculation
        try:
            from . import EnhancedTranslationCoverage
            
            enhanced_coverage = EnhancedTranslationCoverage()
            coverage_metrics = enhanced_coverage.calculate_coverage(document)
            
            # Return enhanced statistics with backward compatibility
            return {
                "total_subtitles": len(subtitles),
                "dual_language_subtitles": dual_language_count,
                "chinese_only_subtitles": chinese_only_count,
                "translation_coverage": coverage_metrics.overall_coverage,
                "average_lines_per_subtitle": average_lines,
                "max_line_length": max_line_length,
                "exceeds_line_limit": max_line_length > self.max_chars_per_line,
                "language": document.language,
                
                # Enhanced coverage metrics
                "enhanced_coverage": {
                    "subtitle_coverage": coverage_metrics.subtitle_coverage,
                    "temporal_coverage": coverage_metrics.temporal_coverage,
                    "content_coverage": coverage_metrics.content_coverage,
                    "translation_quality": coverage_metrics.translation_quality,
                    "completeness_score": coverage_metrics.completeness_score,
                    "semantic_coherence": coverage_metrics.semantic_coherence,
                    "linguistic_consistency": coverage_metrics.linguistic_consistency
                },
                "coverage_confidence": coverage_metrics.confidence_level,
                "algorithm_version": "enhanced_v1.0"
            }
            
        except ImportError:
            # Fallback to legacy calculation
            return {
                "total_subtitles": len(subtitles),
                "dual_language_subtitles": dual_language_count,
                "chinese_only_subtitles": chinese_only_count,
                "translation_coverage": dual_language_count / len(subtitles) if subtitles else 0,
                "average_lines_per_subtitle": average_lines,
                "max_line_length": max_line_length,
                "exceeds_line_limit": max_line_length > self.max_chars_per_line,
                "language": document.language,
                "algorithm_version": "legacy_v1.0"
            }