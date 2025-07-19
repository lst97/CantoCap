"""Character set value object for Chinese text normalization."""

from dataclasses import dataclass
from enum import Enum


class ChineseCharset(Enum):
    """Supported Chinese character sets."""
    TRADITIONAL = "traditional"
    SIMPLIFIED = "simplified"


@dataclass(frozen=True)
class Charset:
    """Immutable character set specification for text normalization."""
    
    charset: ChineseCharset
    
    def __post_init__(self) -> None:
        """Validate charset constraints."""
        if not isinstance(self.charset, ChineseCharset):
            raise TypeError("charset must be a ChineseCharset enum value")
    
    @classmethod
    def traditional(cls) -> "Charset":
        """Create traditional Chinese charset."""
        return cls(charset=ChineseCharset.TRADITIONAL)
    
    @classmethod
    def simplified(cls) -> "Charset":
        """Create simplified Chinese charset."""
        return cls(charset=ChineseCharset.SIMPLIFIED)
    
    @classmethod
    def from_string(cls, charset_str: str) -> "Charset":
        """Create charset from string representation."""
        charset_str = charset_str.lower().strip()
        
        if charset_str in ("traditional", "trad", "tc", "zh-tw", "zh-hk"):
            return cls.traditional()
        elif charset_str in ("simplified", "simp", "sc", "zh-cn", "zh-sg"):
            return cls.simplified()
        else:
            raise ValueError(
                f"Unsupported charset: {charset_str}. "
                f"Supported: traditional, simplified"
            )
    
    def is_traditional(self) -> bool:
        """Check if charset is traditional Chinese."""
        return self.charset == ChineseCharset.TRADITIONAL
    
    def is_simplified(self) -> bool:
        """Check if charset is simplified Chinese."""
        return self.charset == ChineseCharset.SIMPLIFIED
    
    def get_opencc_config(self) -> str:
        """Get OpenCC configuration string for conversion."""
        if self.is_simplified():
            return "t2s.json"  # Traditional to Simplified
        else:
            return "s2t.json"  # Simplified to Traditional
    
    def get_language_code(self) -> str:
        """Get language code for this charset."""
        if self.is_traditional():
            return "zh-TW"  # Traditional Chinese (Taiwan)
        else:
            return "zh-CN"  # Simplified Chinese (China)
    
    def get_locale_name(self) -> str:
        """Get human-readable locale name."""
        if self.is_traditional():
            return "Traditional Chinese"
        else:
            return "Simplified Chinese"
    
    def requires_conversion_from(self, source_charset: "Charset") -> bool:
        """Check if conversion is needed from source charset."""
        return self.charset != source_charset.charset
    
    def __str__(self) -> str:
        """String representation."""
        return self.charset.value
    
    def __repr__(self) -> str:
        """Developer representation."""
        return f"Charset({self.charset.value})"