"""Alignment language code value object for audio alignment models."""

from dataclasses import dataclass
from typing import Dict, Optional
import re


# Supported alignment language codes (simple 2-letter codes)
# Based on DEFAULT_ALIGN_MODELS_TORCH and DEFAULT_ALIGN_MODELS_HF
SUPPORTED_ALIGNMENT_LANGUAGES: Dict[str, str] = {
    # Core languages with torch models
    "en": "English",
    "fr": "French", 
    "de": "German",
    "es": "Spanish",
    "it": "Italian",
    
    # Languages with HuggingFace models
    "zh": "Chinese",
    "ja": "Japanese",
    "nl": "Dutch",
    "uk": "Ukrainian",
    "pt": "Portuguese",
    "ar": "Arabic",
    "cs": "Czech",
    "ru": "Russian",
    "pl": "Polish",
    "hu": "Hungarian",
    "fi": "Finnish",
    "fa": "Persian",
    "el": "Greek",
    "tr": "Turkish",
    "da": "Danish",
    "he": "Hebrew",
    "vi": "Vietnamese",
    "ko": "Korean",
    "ur": "Urdu",
    "te": "Telugu",
    "hi": "Hindi",
    "ca": "Catalan",
    "ml": "Malayalam",
    "no": "Norwegian (Bokmål)",
    "nn": "Norwegian (Nynorsk)",
    "sk": "Slovak",
    "sl": "Slovenian",
    "hr": "Croatian",
    "ro": "Romanian",
    "eu": "Basque",
    "gl": "Galician",
    "ka": "Georgian",
    "lv": "Latvian",
    "tl": "Filipino/Tagalog"
}


@dataclass(frozen=True)
class AlignmentLanguageCode:
    """Value object for alignment model language codes (simple 2-letter format)."""
    
    code: str
    
    def __post_init__(self):
        """Validate alignment language code format and support."""
        if not self.code:
            raise ValueError("Alignment language code cannot be empty")
        
        # Normalize to lowercase
        normalized = self.code.lower().strip()
        
        # Validate format: simple 2-letter language code
        if not re.match(r'^[a-z]{2}$', normalized):
            raise ValueError(
                f"Invalid alignment language code format '{self.code}'. "
                "Expected format: simple 2-letter code (e.g., 'en', 'zh', 'ja')"
            )
        
        # Check if supported
        if normalized not in SUPPORTED_ALIGNMENT_LANGUAGES:
            supported_list = ", ".join(SUPPORTED_ALIGNMENT_LANGUAGES.keys())
            raise ValueError(
                f"Unsupported alignment language code '{self.code}'. "
                f"Supported codes: {supported_list}"
            )
        
        # Update the code to normalized version
        object.__setattr__(self, 'code', normalized)
    
    @classmethod
    def from_string(cls, code_str: str) -> 'AlignmentLanguageCode':
        """Create AlignmentLanguageCode from string."""
        return cls(code=code_str)
    
    @property
    def language_name(self) -> str:
        """Get human-readable language name."""
        return SUPPORTED_ALIGNMENT_LANGUAGES[self.code]
    
    @property
    def is_chinese(self) -> bool:
        """Check if this is Chinese language."""
        return self.code == 'zh'
    
    @property
    def display_name(self) -> str:
        """Get display name for CLI/UI."""
        return f"{self.language_name} ({self.code})"
    
    def __str__(self) -> str:
        return self.code
    
    def __repr__(self) -> str:
        return f"AlignmentLanguageCode('{self.code}')"
    
    @classmethod
    def get_supported_codes(cls) -> Dict[str, str]:
        """Get all supported alignment language codes with names."""
        return SUPPORTED_ALIGNMENT_LANGUAGES.copy()
    
    @classmethod
    def is_supported(cls, code: str) -> bool:
        """Check if alignment language code is supported."""
        try:
            normalized = code.lower().strip()
            return normalized in SUPPORTED_ALIGNMENT_LANGUAGES
        except Exception:
            return False