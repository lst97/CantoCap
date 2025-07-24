"""Prompt service for managing translation and transcription prompts."""

import json
import os
from typing import Dict, Any, Optional
from pathlib import Path

from ...domain.value_objects import LanguageCode


class PromptService:
    """Service for loading and managing prompts from configuration files."""
    
    _instance = None
    _prompts_cache = None
    
    def __new__(cls):
        """Singleton pattern to ensure only one instance exists."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the prompt service."""
        if self._prompts_cache is None:
            self._load_prompts()
    
    def _load_prompts(self) -> None:
        """Load prompts from the configuration file."""
        config_path = Path(__file__).parent.parent / "config" / "transcription_prompts.json"
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self._prompts_cache = json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"Prompts configuration file not found at {config_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in prompts configuration file: {e}")
    
    def get_translation_system_prompt(self) -> str:
        """Get the system prompt for translation service."""
        return self._prompts_cache.get("translation_system", "")
    
    def get_language_guidelines(self, language_code: str) -> str:
        """
        Get language-specific translation guidelines.
        
        Args:
            language_code: Target language code (e.g., 'en', 'ja', 'ko')
            
        Returns:
            Language-specific guidelines or default guidelines
        """
        guidelines = self._prompts_cache.get("language_guidelines", {})
        
        if language_code in guidelines:
            return guidelines[language_code]
            
        # Return default guidelines for unknown languages
        return f"""Translation Guidelines for {language_code}:
- Use natural, conversational language appropriate for subtitles
- Maintain speaker's emotional tone and formality level
- Adapt cultural references to target culture context
- Keep subtitle length suitable for dual-language display
- Preserve timing structure exactly as provided"""
    
    def get_translation_prompt(self, target_language: LanguageCode, source_language: str = "Chinese") -> str:
        """
        Build complete translation prompt for specific target language.
        
        Args:
            target_language: Target language code for translation
            source_language: Source language description (default: "Chinese")
            
        Returns:
            Complete translation prompt
        """
        lang_code = target_language.language_part
        guidelines = self.get_language_guidelines(lang_code)
        
        return f'''
## Translation Mission: Chinese to {target_language.language_name}

**Source Language**: {source_language} (Traditional/Simplified Chinese)
**Target Language**: {target_language.language_name} ({target_language.gemini_language_code})
**Output Format**: Complete SRT file with translated subtitles

### Translation Approach

**Step 1: Context Analysis**
Before translating, analyze the complete subtitle file to understand:
- Conversation type and setting (formal meeting, casual chat, family dinner, etc.)
- Speaker relationships and social dynamics
- Cultural context and references
- Emotional tone and formality levels throughout

**Step 2: Cultural Adaptation Strategy**
- **Names & Places**: Keep Chinese names in original form unless widely known translations exist
- **Cultural References**: Adapt Chinese cultural concepts to be understandable in {target_language.language_name}
- **Idioms & Expressions**: Translate meaning rather than literal words, use natural {target_language.language_name} equivalents
- **Formality Levels**: Match speaker relationships and social context in {target_language.language_name}

**Step 3: Subtitle-Specific Optimization**
- **Reading Speed**: Ensure translated text is readable at normal subtitle speed
- **Dual-Language Display**: Keep translations concise as they appear below Chinese text
- **Line Length**: Aim for shorter lines that work well with dual-language format
- **Natural Flow**: Use {target_language.language_name} sentence structure and rhythm

{guidelines}

### Translation Quality Standards

**Accuracy Requirements**:
- Convey complete meaning of original Chinese
- Preserve speaker's intent and emotional tone
- Maintain conversation flow and natural rhythm
- Ensure cultural context is understandable

**Technical Requirements**:
- Preserve EXACT timing from original SRT (do not modify timestamps)
- Maintain subtitle numbering sequence
- Keep any speaker identification tags ([SPEAKER_XX])
- Ensure proper SRT formatting throughout

**Language Quality**:
- Use natural, conversational {target_language.language_name}
- Apply appropriate formality and politeness levels
- Ensure grammatical correctness and natural flow
- Adapt to {target_language.gemini_language_code} regional variant

### Output Requirements

Return the complete translated SRT file with:
1. Identical timing structure from original
2. All subtitles translated to natural {target_language.language_name}
3. Preserved speaker tags and formatting
4. Appropriate cultural adaptations
5. Subtitle-optimized text length

The output will be used to create dual-language subtitles where your translation appears below the original Chinese text.
'''
    
    def get_transcription_system_instruction(self) -> str:
        """Get the system instruction for transcription service."""
        return self._prompts_cache.get("system_instruction", "")
    
    def get_language_style(self, style: str) -> Dict[str, Any]:
        """
        Get language style configuration.
        
        Args:
            style: Style name ('written' or 'colloquial')
            
        Returns:
            Language style configuration
        """
        return self._prompts_cache.get("language_styles", {}).get(style, {})
    
    def get_speaker_instructions(self, has_speaker_tags: bool) -> str:
        """
        Get speaker instructions based on whether speaker tags are present.
        
        Args:
            has_speaker_tags: Whether the content has speaker tags
            
        Returns:
            Appropriate speaker instructions
        """
        instructions = self._prompts_cache.get("speaker_instructions", {})
        if has_speaker_tags:
            return instructions.get("with_speaker_tags", "")
        else:
            return instructions.get("without_speaker_tags", "")
    
    def get_validation_tag_instructions(self) -> str:
        """Get validation tag processing instructions."""
        return self._prompts_cache.get("validation_tag_instructions", "")
    
    def get_configuration(self, section: str = None) -> Dict[str, Any]:
        """
        Get configuration values.
        
        Args:
            section: Specific configuration section (optional)
            
        Returns:
            Configuration values
        """
        config = self._prompts_cache.get("configuration", {})
        if section:
            return config.get(section, {})
        return config
    
    def get_translation_configuration(self) -> Dict[str, Any]:
        """Get translation-specific configuration."""
        return self.get_configuration("translation")
    
    def reload_prompts(self) -> None:
        """Reload prompts from configuration file (useful for development)."""
        self._prompts_cache = None
        self._load_prompts()


# Global instance for easy access
prompt_service = PromptService()