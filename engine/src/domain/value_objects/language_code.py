"""Language code value object for subtitle translation."""

from dataclasses import dataclass
from typing import Dict, Optional
import re


# Supported language codes with human-readable names
SUPPORTED_LANGUAGES: Dict[str, str] = {
    "en_us": "English (US)",
    "en_uk": "English (UK)", 
    "en_au": "English (Australia)",
    "en_ca": "English (Canada)",
    "zh_cn": "Chinese (Simplified)",
    "zh_tw": "Chinese (Traditional)",
    "ja_jp": "Japanese",
    "ko_kr": "Korean",
    "es_es": "Spanish (Spain)",
    "es_mx": "Spanish (Mexico)",
    "fr_fr": "French (France)",
    "fr_ca": "French (Canada)",
    "de_de": "German",
    "it_it": "Italian",
    "pt_br": "Portuguese (Brazil)",
    "pt_pt": "Portuguese (Portugal)",
    "ru_ru": "Russian",
    "ar_sa": "Arabic",
    "hi_in": "Hindi",
    "th_th": "Thai",
    "vi_vn": "Vietnamese",
    "id_id": "Indonesian",
    "ms_my": "Malay",
    "tl_ph": "Filipino/Tagalog"
}


@dataclass(frozen=True)
class LanguageCode:
    """Value object representing a language code for subtitle translation."""
    
    code: str
    
    def __post_init__(self):
        """Validate language code format and support."""
        if not self.code:
            raise ValueError("Language code cannot be empty")
        
        # Normalize to lowercase with underscore
        normalized = self.code.lower().replace('-', '_')
        
        # Validate format: language_country
        if not re.match(r'^[a-z]{2}_[a-z]{2}$', normalized):
            raise ValueError(
                f"Invalid language code format '{self.code}'. "
                "Expected format: 'language_country' (e.g., 'en_us', 'zh_cn')"
            )
        
        # Check if supported
        if normalized not in SUPPORTED_LANGUAGES:
            supported_list = ", ".join(SUPPORTED_LANGUAGES.keys())
            raise ValueError(
                f"Unsupported language code '{self.code}'. "
                f"Supported codes: {supported_list}"
            )
        
        # Update the code to normalized version
        object.__setattr__(self, 'code', normalized)
    
    @classmethod
    def from_string(cls, code_str: str) -> 'LanguageCode':
        """Create LanguageCode from string."""
        return cls(code=code_str)
    
    @property
    def language_name(self) -> str:
        """Get human-readable language name."""
        return SUPPORTED_LANGUAGES[self.code]
    
    @property
    def language_part(self) -> str:
        """Get language part (e.g., 'en' from 'en_us')."""
        return self.code.split('_')[0]
    
    @property
    def country_part(self) -> str:
        """Get country part (e.g., 'us' from 'en_us')."""
        return self.code.split('_')[1]
    
    @property
    def gemini_language_code(self) -> str:
        """Get language code format for Gemini API."""
        # Map to standard language codes for Gemini
        gemini_mapping = {
            "en_us": "en-US",
            "en_uk": "en-GB", 
            "en_au": "en-AU",
            "en_ca": "en-CA",
            "zh_cn": "zh-CN",
            "zh_tw": "zh-TW",
            "ja_jp": "ja-JP",
            "ko_kr": "ko-KR",
            "es_es": "es-ES",
            "es_mx": "es-MX",
            "fr_fr": "fr-FR",
            "fr_ca": "fr-CA",
            "de_de": "de-DE",
            "it_it": "it-IT",
            "pt_br": "pt-BR",
            "pt_pt": "pt-PT",
            "ru_ru": "ru-RU",
            "ar_sa": "ar-SA",
            "hi_in": "hi-IN",
            "th_th": "th-TH",
            "vi_vn": "vi-VN",
            "id_id": "id-ID",
            "ms_my": "ms-MY",
            "tl_ph": "tl-PH"
        }
        return gemini_mapping.get(self.code, self.code.replace('_', '-'))
    
    @property
    def display_name(self) -> str:
        """Get display name for CLI/UI."""
        return f"{self.language_name} ({self.code})"
    
    def __str__(self) -> str:
        return self.code
    
    def __repr__(self) -> str:
        return f"LanguageCode('{self.code}')"
    
    @classmethod
    def get_supported_codes(cls) -> Dict[str, str]:
        """Get all supported language codes with names."""
        return SUPPORTED_LANGUAGES.copy()
    
    @classmethod
    def is_supported(cls, code: str) -> bool:
        """Check if language code is supported."""
        try:
            normalized = code.lower().replace('-', '_')
            return normalized in SUPPORTED_LANGUAGES
        except Exception:
            return False