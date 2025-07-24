"""Language code value object for subtitle translation."""

from dataclasses import dataclass
from typing import Dict, Optional
import re


# Supported language codes with human-readable names (full language_country format for translation)
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
    def is_chinese(self) -> bool:
        """Check if this is Chinese language."""
        return self.code.startswith('zh_')
    
    @property
    def gemini_language_code(self) -> str:
        """Get language code format for Gemini API."""
        # Map simple codes to Gemini format (defaulting to common regions)
        gemini_mapping = {
            "en": "en-US",
            "zh": "zh-CN",  # Default to Simplified Chinese
            "ja": "ja-JP",
            "ko": "ko-KR",
            "es": "es-ES",
            "fr": "fr-FR",
            "de": "de-DE",
            "it": "it-IT",
            "pt": "pt-BR",  # Default to Brazilian Portuguese
            "ru": "ru-RU",
            "ar": "ar-SA",
            "hi": "hi-IN",
            "vi": "vi-VN",
            "uk": "uk-UA",
            "pl": "pl-PL",
            "hu": "hu-HU",
            "fi": "fi-FI",
            "fa": "fa-IR",
            "el": "el-GR",
            "tr": "tr-TR",
            "da": "da-DK",
            "he": "he-IL",
            "ur": "ur-PK",
            "te": "te-IN",
            "ca": "ca-ES",
            "ml": "ml-IN",
            "no": "no-NO",
            "nn": "nn-NO",
            "sk": "sk-SK",
            "sl": "sl-SI",
            "hr": "hr-HR",
            "ro": "ro-RO",
            "eu": "eu-ES",
            "gl": "gl-ES",
            "ka": "ka-GE",
            "lv": "lv-LV",
            "tl": "tl-PH",
            "nl": "nl-NL",
            "cs": "cs-CZ"
        }
        return gemini_mapping.get(self.code, f"{self.code.upper()}")
    
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