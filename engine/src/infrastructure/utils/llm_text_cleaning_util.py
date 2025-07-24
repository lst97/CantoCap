"""LLM text cleaning utilities for processing AI model responses."""

import re
from typing import List, Pattern


class GeminiResponseCleaner:
    """Utility class for cleaning Gemini API response text."""
    
    # Patterns for invalid characters and artifacts commonly found in Gemini responses
    INVALID_PATTERNS: List[Pattern] = [
        # Code block markers
        re.compile(r'^```[\w]*\n?', re.MULTILINE),  # Opening code blocks (```python, ```text, etc.)
        re.compile(r'\n?```$', re.MULTILINE),       # Closing code blocks
        re.compile(r'^```$', re.MULTILINE),         # Standalone code block markers
        
        # Markdown artifacts
        re.compile(r'^#+\s+', re.MULTILINE),        # Headers (# ## ###)
        re.compile(r'\*\*(.*?)\*\*', re.MULTILINE), # Bold markdown (**text**)
        re.compile(r'\*(.*?)\*', re.MULTILINE),     # Italic markdown (*text*)
        
        # HTML-like tags that might appear
        re.compile(r'<[^>]+>', re.MULTILINE),       # Any HTML-like tags
        
        # Other common artifacts
        re.compile(r'^\s*[-*+]\s+', re.MULTILINE),  # List markers at start of lines
        re.compile(r'^\s*\d+\.\s+', re.MULTILINE),  # Numbered list markers
    ]
    
    # Special patterns for SRT content preservation
    SRT_TIMESTAMP_PATTERN = re.compile(r'^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}$', re.MULTILINE)
    SRT_NUMBER_PATTERN = re.compile(r'^\d+$', re.MULTILINE)
    SPEAKER_TAG_PATTERN = re.compile(r'\[SPEAKER_\d+\]')
    
    @classmethod
    def clean_gemini_response(cls, response_text: str, preserve_srt_format: bool = True) -> str:
        """
        Clean Gemini response text by removing invalid characters and artifacts.
        
        Args:
            response_text: Raw response text from Gemini API
            preserve_srt_format: Whether to preserve SRT subtitle formatting
            
        Returns:
            Cleaned text with invalid characters removed
        """
        if not response_text:
            return response_text
        
        cleaned_text = response_text.strip()
        
        # Remove invalid patterns
        for pattern in cls.INVALID_PATTERNS:
            if preserve_srt_format:
                # Special handling for SRT content - be more careful with patterns
                cleaned_text = cls._clean_pattern_preserve_srt(cleaned_text, pattern)
            else:
                cleaned_text = pattern.sub(cls._get_replacement_for_pattern(pattern), cleaned_text)
        
        # Additional cleaning for common issues
        cleaned_text = cls._remove_duplicate_whitespace(cleaned_text)
        cleaned_text = cls._fix_line_endings(cleaned_text)
        
        return cleaned_text.strip()
    
    @classmethod
    def _clean_pattern_preserve_srt(cls, text: str, pattern: Pattern) -> str:
        """
        Clean pattern while preserving SRT formatting.
        
        Args:
            text: Text to clean
            pattern: Regex pattern to remove
            
        Returns:
            Cleaned text with SRT format preserved
        """
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # Skip cleaning for SRT structure lines
            if (cls.SRT_TIMESTAMP_PATTERN.match(line.strip()) or 
                cls.SRT_NUMBER_PATTERN.match(line.strip()) or
                line.strip() == ''):
                cleaned_lines.append(line)
            else:
                # Clean non-structural lines
                cleaned_line = pattern.sub(cls._get_replacement_for_pattern(pattern), line)
                cleaned_lines.append(cleaned_line)
        
        return '\n'.join(cleaned_lines)
    
    @classmethod
    def _get_replacement_for_pattern(cls, pattern: Pattern) -> str:
        """
        Get appropriate replacement string for a pattern.
        
        Args:
            pattern: The regex pattern being replaced
            
        Returns:
            Replacement string
        """
        pattern_str = pattern.pattern
        
        # For markdown formatting, preserve the inner content
        if r'\*\*(.*?)\*\*' in pattern_str:
            return r'\1'  # Keep the content without bold formatting
        elif r'\*(.*?)\*' in pattern_str:
            return r'\1'  # Keep the content without italic formatting
        else:
            return ''  # Remove other patterns entirely
    
    @classmethod
    def _remove_duplicate_whitespace(cls, text: str) -> str:
        """Remove excessive whitespace while preserving line structure."""
        # Replace multiple spaces with single space
        text = re.sub(r' {2,}', ' ', text)
        
        # Remove trailing whitespace from lines
        lines = text.split('\n')
        cleaned_lines = [line.rstrip() for line in lines]
        
        return '\n'.join(cleaned_lines)
    
    @classmethod
    def _fix_line_endings(cls, text: str) -> str:
        """Normalize line endings and remove excessive blank lines."""
        # Normalize line endings
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        
        # Remove more than 2 consecutive empty lines (preserve SRT structure)
        text = re.sub(r'\n{4,}', '\n\n\n', text)
        
        return text
    
    @classmethod
    def validate_srt_structure(cls, srt_text: str) -> bool:
        """
        Validate that the cleaned text maintains proper SRT structure.
        
        Args:
            srt_text: SRT text to validate
            
        Returns:
            True if structure is valid, False otherwise
        """
        if not srt_text.strip():
            return False
        
        lines = srt_text.strip().split('\n')
        subtitle_count = 0
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Look for subtitle number
            if line.isdigit():
                subtitle_count += 1
                i += 1
                
                # Next line should be timestamp
                if i < len(lines) and cls.SRT_TIMESTAMP_PATTERN.match(lines[i].strip()):
                    i += 1
                    
                    # Skip content lines until next subtitle or end
                    while i < len(lines) and not lines[i].strip().isdigit():
                        i += 1
                else:
                    return False  # Invalid structure
            else:
                i += 1
        
        return subtitle_count > 0
    
    @classmethod
    def clean_and_validate_srt(cls, response_text: str) -> str:
        """
        Clean Gemini response and validate SRT structure.
        
        Args:
            response_text: Raw Gemini response containing SRT content
            
        Returns:
            Cleaned and validated SRT text
            
        Raises:
            ValueError: If the cleaned text doesn't have valid SRT structure
        """
        cleaned_text = cls.clean_gemini_response(response_text, preserve_srt_format=True)
        
        if not cls.validate_srt_structure(cleaned_text):
            # If validation fails, try less aggressive cleaning
            cleaned_text = cls._fallback_cleaning(response_text)
            
            if not cls.validate_srt_structure(cleaned_text):
                raise ValueError(
                    "Cleaned Gemini response does not contain valid SRT structure. "
                    f"Response preview: {cleaned_text[:200]}..."
                )
        
        return cleaned_text
    
    @classmethod
    def _fallback_cleaning(cls, text: str) -> str:
        """
        Fallback cleaning method with minimal processing.
        
        Args:
            text: Text to clean
            
        Returns:
            Minimally cleaned text
        """
        # Only remove the most obvious artifacts
        cleaned = text.strip()
        
        # Remove code block markers
        cleaned = re.sub(r'^```[\w]*\n?', '', cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r'\n?```$', '', cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r'^```$', '', cleaned, flags=re.MULTILINE)
        
        # Normalize whitespace
        cleaned = cls._remove_duplicate_whitespace(cleaned)
        cleaned = cls._fix_line_endings(cleaned)
        
        return cleaned.strip()