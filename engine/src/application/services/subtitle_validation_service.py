"""Subtitle validation and enhancement service for processing Whisper output."""

import re
from typing import List, Tuple, Dict, Any
from dataclasses import dataclass
from ...domain.entities import Subtitle
from ...domain.value_objects import Timestamp


@dataclass
class ValidationResult:
    """Result of subtitle validation with applied tags."""
    original_text: str
    processed_text: str
    tags_applied: List[str]
    character_count: int
    needs_refinement: bool


class SubtitleValidationService:
    """Service for validating and tagging subtitle content before Gemini refinement."""
    
    # Configuration constants
    MAX_SUBTITLE_LENGTH = 20  # Maximum characters per subtitle line
    REPEAT_THRESHOLD = 3      # Number of consecutive repeats to tag
    REPEAT_PATTERN_MIN = 2    # Minimum pattern length to consider
    
    # Symbol filtering patterns
    VALID_PUNCTUATION = r'[。，！？：；""''「」『』（）【】〔〕《》〈〉…、·—–-]'
    VALID_TAGS = r'\[(?:SPEAKER_\d+|TRIM|REPEAT|MUSIC|[A-Z_]+)\]'
    INVALID_SYMBOLS = r'[^\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\u2ceb0-\u2ebef\u30a0-\u30ff\u3040-\u309f\ua000-\ua48f\uff00-\uffef\u0020-\u007E`]'
    
    def __init__(self):
        """Initialize the validation service."""
        self.validation_stats = {
            "total_processed": 0,
            "trim_tags_applied": 0,
            "repeat_tags_applied": 0,
            "invalid_symbols_removed": 0,
            "refinement_needed": 0
        }
    
    def validate_subtitle_line(self, text: str) -> ValidationResult:
        """
        Validate a single subtitle line and apply tags as needed.
        
        Args:
            text: The subtitle text to validate
            
        Returns:
            ValidationResult with processed text and applied tags
        """
        original_text = text.strip()
        processed_text = original_text
        tags_applied = []
        needs_refinement = False
        
        # Filter invalid symbols first
        symbol_filtered_text = self._filter_invalid_symbols(processed_text)
        if symbol_filtered_text != processed_text:
            processed_text = symbol_filtered_text
            needs_refinement = True
            self.validation_stats["invalid_symbols_removed"] += 1
        
        # Check for excessive length
        if len(processed_text) > self.MAX_SUBTITLE_LENGTH:
            processed_text = self._apply_trim_tag(processed_text)
            tags_applied.append("TRIM")
            needs_refinement = True
            self.validation_stats["trim_tags_applied"] += 1
        
        # Check for repeated patterns
        repeat_result = self._detect_and_tag_repeats(processed_text)
        if repeat_result["has_repeats"]:
            processed_text = repeat_result["processed_text"]
            tags_applied.append("REPEAT")
            needs_refinement = True
            self.validation_stats["repeat_tags_applied"] += 1
        
        if needs_refinement:
            self.validation_stats["refinement_needed"] += 1
            
        self.validation_stats["total_processed"] += 1
        
        return ValidationResult(
            original_text=original_text,
            processed_text=processed_text,
            tags_applied=tags_applied,
            character_count=len(processed_text),
            needs_refinement=needs_refinement
        )
    
    def validate_subtitle_list(self, subtitles: List[Subtitle]) -> List[ValidationResult]:
        """
        Validate a list of subtitles.
        
        Args:
            subtitles: List of Subtitle entities
            
        Returns:
            List of ValidationResult objects
        """
        results = []
        for subtitle in subtitles:
            result = self.validate_subtitle_line(subtitle.text)
            results.append(result)
        
        return results
    
    def validate_srt_content(self, srt_content: str) -> str:
        """
        Validate SRT content and apply validation tags.
        
        Args:
            srt_content: Raw SRT content from Whisper
            
        Returns:
            SRT content with validation tags applied
        """
        lines = srt_content.split('\n')
        processed_lines = []
        
        for line in lines:
            line = line.strip()
            
            # Skip empty lines, numbers, and timestamps
            if not line or line.isdigit() or '-->' in line:
                processed_lines.append(line)
                continue
            
            # Process subtitle text lines
            if line and not self._is_subtitle_metadata(line):
                validation_result = self.validate_subtitle_line(line)
                processed_lines.append(validation_result.processed_text)
            else:
                processed_lines.append(line)
        
        return '\n'.join(processed_lines)
    
    def _apply_trim_tag(self, text: str) -> str:
        """
        Apply TRIM tag to overly long subtitle text.
        
        Args:
            text: Original text
            
        Returns:
            Text with TRIM tag applied
        """
        # Keep the first part and add [TRIM] tag
        trimmed_text = text[:self.MAX_SUBTITLE_LENGTH]
        
        # Try to break at word boundary if possible
        if len(text) > self.MAX_SUBTITLE_LENGTH:
            # Find last space within limit
            last_space = trimmed_text.rfind(' ')
            if last_space > self.MAX_SUBTITLE_LENGTH // 2:  # Only if it's not too short
                trimmed_text = trimmed_text[:last_space]
        
        return f"{trimmed_text} [TRIM]"
    
    def _detect_and_tag_repeats(self, text: str) -> Dict[str, Any]:
        """
        Detect repeated patterns in text and apply REPEAT tags.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary with detection results and processed text
        """
        # Remove existing validation tags for analysis
        clean_text = re.sub(r'\s*\[(?:TRIM|REPEAT)\]\s*', '', text)
        
        # Look for character-level repeats (e.g., "好好好好")
        char_repeats = self._find_character_repeats(clean_text)
        
        # Look for word/phrase repeats (e.g., "係呀係呀係呀")
        word_repeats = self._find_word_repeats(clean_text)
        
        if char_repeats or word_repeats:
            # Replace the longest repeat pattern with [REPEAT]
            if char_repeats and word_repeats:
                # Choose the longer pattern
                if len(char_repeats["pattern"]) >= len(word_repeats["pattern"]):
                    processed_text = self._replace_repeat_pattern(text, char_repeats)
                else:
                    processed_text = self._replace_repeat_pattern(text, word_repeats)
            elif char_repeats:
                processed_text = self._replace_repeat_pattern(text, char_repeats)
            else:
                processed_text = self._replace_repeat_pattern(text, word_repeats)
            
            return {
                "has_repeats": True,
                "processed_text": processed_text,
                "patterns_found": {
                    "character_repeats": char_repeats,
                    "word_repeats": word_repeats
                }
            }
        
        return {
            "has_repeats": False,
            "processed_text": text,
            "patterns_found": {}
        }
    
    def _find_character_repeats(self, text: str) -> Dict[str, Any]:
        """Find repeated characters (e.g., 好好好好)."""
        # Look for patterns like: same character repeated 3+ times
        pattern = r'(.)\1{2,}'
        matches = list(re.finditer(pattern, text))
        
        if matches:
            # Find the longest match
            longest_match = max(matches, key=lambda m: len(m.group()))
            return {
                "pattern": longest_match.group(),
                "char": longest_match.group(1),
                "count": len(longest_match.group()),
                "start": longest_match.start(),
                "end": longest_match.end()
            }
        
        return None
    
    def _find_word_repeats(self, text: str) -> Dict[str, Any]:
        """Find repeated words or short phrases."""
        # Split by common separators but keep them
        words = re.split(r'(\s+|[，。！？、])', text)
        words = [w for w in words if w.strip()]
        
        if len(words) < 4:  # Need at least 4 elements for meaningful pattern
            return None
        
        # Look for patterns of 1-3 words repeated
        for pattern_length in range(1, min(4, len(words) // 2 + 1)):
            for start_idx in range(len(words) - pattern_length * 2):
                pattern = words[start_idx:start_idx + pattern_length]
                pattern_text = ''.join(pattern)
                
                # Count consecutive occurrences
                count = 1
                next_idx = start_idx + pattern_length
                
                while (next_idx + pattern_length <= len(words) and 
                       words[next_idx:next_idx + pattern_length] == pattern):
                    count += 1
                    next_idx += pattern_length
                
                if count >= self.REPEAT_THRESHOLD:
                    full_pattern = ''.join(words[start_idx:start_idx + pattern_length * count])
                    return {
                        "pattern": full_pattern,
                        "unit": pattern_text,
                        "count": count,
                        "start_word": start_idx,
                        "end_word": start_idx + pattern_length * count
                    }
        
        return None
    
    def _replace_repeat_pattern(self, text: str, repeat_info: Dict[str, Any]) -> str:
        """Replace identified repeat pattern with [REPEAT] tag."""
        if not repeat_info:
            return text
        
        pattern = repeat_info["pattern"]
        # Keep one instance of the pattern and add [REPEAT]
        if "unit" in repeat_info:  # Word repeat
            replacement = f"{repeat_info['unit']} [REPEAT]"
        else:  # Character repeat
            replacement = f"{repeat_info['char']} [REPEAT]"
        
        # Replace the pattern with the tagged version
        return text.replace(pattern, replacement, 1)
    
    def _is_subtitle_metadata(self, line: str) -> bool:
        """Check if line is subtitle metadata (speaker tags, etc.)."""
        return bool(re.match(r'^\[SPEAKER_\d+\]', line.strip()))
    
    def _filter_invalid_symbols(self, text: str) -> str:
        """
        Filter invalid symbols while preserving valid punctuation and tags.
        
        Args:
            text: Original text to filter
            
        Returns:
            Filtered text with invalid symbols removed
        """
        if not text.strip():
            return text
        
        # First, preserve valid tags by temporarily replacing them
        tags = []
        temp_text = text
        
        # Extract and preserve valid tags
        tag_matches = re.finditer(self.VALID_TAGS, text)
        for i, match in enumerate(tag_matches):
            placeholder = f"__TAG_{i}__"
            tags.append((placeholder, match.group()))
            temp_text = temp_text.replace(match.group(), placeholder)
        
        # Remove invalid symbols but keep:
        # - Chinese characters (CJK Unified Ideographs)
        # - Valid punctuation
        # - ASCII characters (for English words/numbers)
        # - Tag placeholders
        filtered_chars = []
        for char in temp_text:
            if (char.isspace() or  # Whitespace
                re.match(r'[\u4e00-\u9fff\u3400-\u4dbf]', char) or  # Chinese characters
                re.match(r'[\u30a0-\u30ff\u3040-\u309f]', char) or  # Japanese characters
                re.match(self.VALID_PUNCTUATION, char) or  # Valid punctuation
                re.match(r'[a-zA-Z0-9]', char) or  # ASCII letters/numbers
                char == '_' or char.isdigit()):  # Tag placeholder parts
                filtered_chars.append(char)
        
        filtered_text = ''.join(filtered_chars)
        
        # Restore preserved tags
        for placeholder, original_tag in tags:
            filtered_text = filtered_text.replace(placeholder, original_tag)
        
        # Clean up extra whitespace
        filtered_text = re.sub(r'\s+', ' ', filtered_text).strip()
        
        return filtered_text
    
    def get_validation_stats(self) -> Dict[str, Any]:
        """Get validation statistics."""
        stats = self.validation_stats.copy()
        if stats["total_processed"] > 0:
            stats["trim_percentage"] = (stats["trim_tags_applied"] / stats["total_processed"]) * 100
            stats["repeat_percentage"] = (stats["repeat_tags_applied"] / stats["total_processed"]) * 100
            stats["symbol_filter_percentage"] = (stats["invalid_symbols_removed"] / stats["total_processed"]) * 100
            stats["refinement_percentage"] = (stats["refinement_needed"] / stats["total_processed"]) * 100
        else:
            stats["trim_percentage"] = 0
            stats["repeat_percentage"] = 0
            stats["symbol_filter_percentage"] = 0
            stats["refinement_percentage"] = 0
        
        return stats
    
    def reset_stats(self) -> None:
        """Reset validation statistics."""
        self.validation_stats = {
            "total_processed": 0,
            "trim_tags_applied": 0,
            "repeat_tags_applied": 0,
            "invalid_symbols_removed": 0,
            "refinement_needed": 0
        }