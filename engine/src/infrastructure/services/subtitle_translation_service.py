"""Subtitle translation service using Google Gemini Flash."""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
import json
import re
import time

try:
    import google.generativeai as genai
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

from ...domain.value_objects import LanguageCode
from ...domain.value_objects.file_path import FilePath
from ..utils.llm_text_cleaning_util import GeminiResponseCleaner
from .prompt_service import prompt_service


@dataclass
class TranslationResult:
    """Result of subtitle translation."""
    translated_srt: str
    translation_count: int
    quality_score: float
    source_language: str
    target_language: str
    processing_notes: Optional[str] = None


class SubtitleTranslationService:
    """Google Gemini Flash integration for subtitle translation."""
    
    def __init__(self, api_key: str):
        """Initialize subtitle translation service with API key."""
        if not _GEMINI_AVAILABLE:
            raise ImportError(
                "google-generativeai package not installed. "
                "Install with: pip install google-generativeai"
            )
        
        # Load configuration from prompt service
        translation_config = prompt_service.get_translation_configuration()
        self.MAX_SRT_LENGTH = translation_config.get('max_srt_length', 50000)
        self.MIN_SPLIT_SIZE = translation_config.get('min_split_size', 8000)
        self.SPLIT_OVERLAP = translation_config.get('split_overlap', 150)

        
        genai.configure(api_key=api_key)
        
        # Configure safety settings (permissive for content translation)
        safety_settings = [
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        
        # Translation model - optimized for language processing
        translation_config = genai.types.GenerationConfig(
            temperature=0.3,   # Balanced creativity for natural translation
            top_p=0.9,         # Broad sampling for language variety
            top_k=50,          # Wide vocabulary for translation accuracy
            max_output_tokens=50000,  # Long outputs for complete SRT files
        )
        
        # Get system instruction from prompt service
        system_instruction = prompt_service.get_translation_system_prompt()
        
        self.translation_model = genai.GenerativeModel(
            model_name='models/gemini-2.5-flash',
            generation_config=translation_config,
            system_instruction=system_instruction,
            safety_settings=safety_settings
        )
        
        self.api_key = api_key
    
    def _get_translation_prompt(self, target_language: LanguageCode, source_language: str = "Chinese") -> str:
        """Get translation prompt for specific target language."""
        return prompt_service.get_translation_prompt(target_language, source_language)
    
    def translate_subtitles(
        self, 
        chinese_srt: str, 
        target_language: LanguageCode,
        source_language: str = "Chinese"
    ) -> TranslationResult:
        """
        Translate Chinese subtitles to target language.
        
        Args:
            chinese_srt: Original SRT content in Chinese
            target_language: Target language code for translation
            source_language: Source language description (default: "Chinese")
            
        Returns:
            TranslationResult with translated SRT content
        """
        try:
            # Check if SRT content is too long and needs splitting
            if len(chinese_srt) > self.MAX_SRT_LENGTH:
                return self._translate_with_splitting(chinese_srt, target_language, source_language)
            
            # Generate translation prompt
            prompt = self._get_translation_prompt(target_language, source_language)
            
            # Prepare content for translation
            content = [
                prompt,
                f"\n\nOriginal Chinese SRT content to translate:\n\n{chinese_srt}"
            ]
            
            # Generate translation using specialized translation model
            response = self.translation_model.generate_content(content)
            
            if response.candidates and response.candidates[0].finish_reason == "MAX_TOKENS":
                raise RuntimeError("SRT content too large for single translation. Using chunked processing.")
            
            if not response.parts:
                raise RuntimeError(f"Gemini translation returned no parts. Full response: {response}")

            # Clean the Gemini response to remove invalid characters like ```
            try:
                translated_srt = GeminiResponseCleaner.clean_and_validate_srt(response.text)
            except ValueError as e:
                print(f"Warning: Gemini translation response cleaning failed: {e}")
                # Fallback to basic cleaning if validation fails
                translated_srt = GeminiResponseCleaner.clean_gemini_response(response.text, preserve_srt_format=True)
            
            # Calculate translation statistics
            original_subtitles = len(re.findall(r'^\d+$', chinese_srt, re.MULTILINE))
            translated_subtitles = len(re.findall(r'^\d+$', translated_srt, re.MULTILINE))
            
            # Calculate quality score based on subtitle count preservation
            quality_score = min(1.0, translated_subtitles / max(original_subtitles, 1))
            
            processing_notes = f"Direct translation to {target_language.language_name}"
            
            return TranslationResult(
                translated_srt=translated_srt,
                translation_count=translated_subtitles,
                quality_score=quality_score,
                source_language=source_language,
                target_language=target_language.language_name,
                processing_notes=processing_notes
            )
            
        except Exception as e:
            raise RuntimeError(f"Subtitle translation failed: {str(e)}")
    
    def _translate_with_splitting(
        self, 
        chinese_srt: str, 
        target_language: LanguageCode,
        source_language: str
    ) -> TranslationResult:
        """
        Handle large SRT content by splitting into manageable chunks.
        
        Args:
            chinese_srt: Large SRT content to split and translate
            target_language: Target language code
            source_language: Source language description
            
        Returns:
            TranslationResult with merged translated content
        """
        try:
            # Split SRT into chunks
            srt_chunks = self._split_srt_content(chinese_srt)
            
            # Process each chunk
            translated_chunks = []
            total_translations = 0
            
            for i, chunk in enumerate(srt_chunks):
                try:
                    # Generate prompt for this chunk
                    prompt = self._get_translation_prompt(target_language, source_language)
                    
                    # Prepare content for this chunk
                    content = [
                        prompt,
                        f"\n\nChinese SRT content to translate:\n\n{chunk}"
                    ]
                    
                    # Process chunk
                    response = self.translation_model.generate_content(content)
                    
                    if not response.parts:
                        # Use original chunk if translation fails
                        translated_chunks.append(chunk)
                        continue
                    
                    # Clean the Gemini response to remove invalid characters like ```
                    try:
                        translated_chunk = GeminiResponseCleaner.clean_and_validate_srt(response.text)
                    except ValueError as e:
                        print(f"Warning: Translation chunk {i+1} response cleaning failed: {e}")
                        # Fallback to basic cleaning if validation fails
                        translated_chunk = GeminiResponseCleaner.clean_gemini_response(response.text, preserve_srt_format=True)
                    translated_chunks.append(translated_chunk)
                    
                    # Count translations in this chunk
                    chunk_translations = len(re.findall(r'^\d+$', translated_chunk, re.MULTILINE))
                    total_translations += chunk_translations
                    
                except Exception as e:
                    # Use original chunk on failure
                    translated_chunks.append(chunk)
            
            # Merge translated chunks
            merged_srt = self._merge_srt_chunks(translated_chunks, chinese_srt)
            
            # Calculate quality score
            original_subtitles = len(re.findall(r'^\d+$', chinese_srt, re.MULTILINE))
            quality_score = min(1.0, total_translations / max(original_subtitles, 1))
            
            return TranslationResult(
                translated_srt=merged_srt,
                translation_count=total_translations,
                quality_score=quality_score,
                source_language=source_language,
                target_language=target_language.language_name,
                processing_notes=f"Large SRT translated in {len(srt_chunks)} chunks"
            )
            
        except Exception as e:
            raise RuntimeError(f"SRT chunked translation failed: {str(e)}")
    
    def _split_srt_content(self, srt_content: str) -> List[str]:
        """
        Split SRT content into manageable chunks based on subtitle boundaries.
        
        Args:
            srt_content: Original SRT content to split
            
        Returns:
            List of SRT chunks with proper formatting
        """
        lines = srt_content.strip().split('\n')
        chunks = []
        current_chunk_lines = []
        current_size = 0
        subtitle_buffer = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Check if this is a subtitle number (start of new subtitle)
            if line.isdigit():
                # If we have a buffered subtitle, add it to current chunk
                if subtitle_buffer:
                    chunk_addition = '\n'.join(subtitle_buffer) + '\n'
                    if current_size + len(chunk_addition) > self.MAX_SRT_LENGTH and current_chunk_lines:
                        # Current chunk is full, finalize it
                        chunks.append('\n'.join(current_chunk_lines).strip())
                        current_chunk_lines = []
                        current_size = 0
                    
                    current_chunk_lines.extend(subtitle_buffer)
                    current_size += len(chunk_addition)
                    subtitle_buffer = []
                
                # Start collecting new subtitle
                subtitle_buffer = [line]  # Subtitle number
                
                # Get timestamp line
                if i + 1 < len(lines) and '-->' in lines[i + 1]:
                    subtitle_buffer.append(lines[i + 1])
                    i += 2
                    
                    # Collect content lines
                    while i < len(lines) and lines[i].strip() and not lines[i].strip().isdigit():
                        subtitle_buffer.append(lines[i])
                        i += 1
                    
                    # Add empty line separator
                    if i < len(lines) and not lines[i].strip():
                        subtitle_buffer.append('')
                        i += 1
                else:
                    i += 1
            else:
                i += 1
        
        # Add any remaining subtitle buffer
        if subtitle_buffer:
            current_chunk_lines.extend(subtitle_buffer)
        
        # Add the last chunk if it has content
        if current_chunk_lines:
            chunks.append('\n'.join(current_chunk_lines).strip())
        
        return chunks
    
    def _merge_srt_chunks(self, translated_chunks: List[str], original_srt: str) -> str:
        """
        Merge translated SRT chunks back into a single SRT file.
        
        Args:
            translated_chunks: List of translated SRT chunks
            original_srt: Original SRT for reference
            
        Returns:
            Merged SRT content with corrected subtitle numbering
        """
        if not translated_chunks:
            return original_srt
        
        merged_lines = []
        subtitle_counter = 1
        
        for chunk in translated_chunks:
            chunk_lines = chunk.strip().split('\n')
            i = 0
            
            while i < len(chunk_lines):
                line = chunk_lines[i].strip()
                
                # Check if this is a subtitle number
                if line.isdigit():
                    # Replace with corrected subtitle number
                    merged_lines.append(str(subtitle_counter))
                    subtitle_counter += 1
                    
                    # Add timestamp line
                    if i + 1 < len(chunk_lines) and '-->' in chunk_lines[i + 1]:
                        merged_lines.append(chunk_lines[i + 1])
                        i += 2
                        
                        # Add content lines
                        while i < len(chunk_lines) and chunk_lines[i].strip() and not chunk_lines[i].strip().isdigit():
                            merged_lines.append(chunk_lines[i])
                            i += 1
                        
                        # Add empty separator
                        merged_lines.append('')
                        
                        # Skip empty lines in source
                        while i < len(chunk_lines) and not chunk_lines[i].strip():
                            i += 1
                    else:
                        i += 1
                else:
                    i += 1
        
        return '\n'.join(merged_lines).strip()
    
    def is_available(self) -> bool:
        """Check if translation service is available and configured."""
        if not _GEMINI_AVAILABLE:
            return False
        
        try:
            # Test with a simple request
            response = self.translation_model.generate_content("Test connectivity")
            return True
        except Exception:
            return False
    
    def estimate_token_usage(self, srt_length: int, target_language: LanguageCode) -> int:
        """
        Estimate token usage for translation.
        
        Args:
            srt_length: Length of SRT content in characters
            target_language: Target language code
            
        Returns:
            Estimated token count
        """
        # Conservative estimation:
        # - SRT content: ~1 token per 4 characters
        # - Translation prompt: ~800 tokens
        # - Output: ~1.2x input for translation expansion
        
        srt_tokens = int(srt_length / 4)
        prompt_tokens = 800
        output_tokens = int(srt_tokens * 1.2)
        
        return srt_tokens + prompt_tokens + output_tokens
    
    @staticmethod
    def is_gemini_available() -> bool:
        """Check if Gemini dependencies are available."""
        return _GEMINI_AVAILABLE