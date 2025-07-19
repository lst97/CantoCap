"""Character set conversion service using OpenCC."""

from typing import Dict, Any

from ...domain.value_objects import Charset, ChineseCharset


class CharsetConversionService:
    """Service for Chinese character set conversion using OpenCC."""
    
    def __init__(self):
        """Initialize charset conversion service."""
        self.converters = {}
    
    def _get_converter(self, target_charset: Charset):
        """Get OpenCC converter for target charset."""
        try:
            import opencc
            
            config = target_charset.get_opencc_config()
            
            if config not in self.converters:
                self.converters[config] = opencc.OpenCC(config)
            
            return self.converters[config]
            
        except ImportError:
            raise RuntimeError(
                "OpenCC not installed. Install with: pip install opencc-python-reimplemented"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to create OpenCC converter: {e}")
    
    def convert_text(self, text: str, target_charset: Charset) -> str:
        """
        Convert text to target character set.
        
        Args:
            text: Text to convert
            target_charset: Target character set
            
        Returns:
            str: Converted text
            
        Raises:
            RuntimeError: If conversion fails
        """
        if not text.strip():
            return text
        
        try:
            converter = self._get_converter(target_charset)
            converted_text = converter.convert(text)
            return converted_text
            
        except Exception as e:
            raise RuntimeError(f"Character set conversion failed: {e}")
    
    def detect_charset(self, text: str) -> Charset:
        """
        Detect character set of input text (simplified heuristic).
        
        Args:
            text: Text to analyze
            
        Returns:
            Charset: Detected character set
        """
        if not text.strip():
            return Charset.traditional()  # Default
        
        # Simple heuristic: count traditional vs simplified specific characters
        traditional_chars = set("繁體字書這個來們時間說話現見問題開關東過後個門總統長國際經濟")
        simplified_chars = set("简体字书这个来们时间说话现见问题开关东过后个门总统长国际经济")
        
        trad_count = sum(1 for char in text if char in traditional_chars)
        simp_count = sum(1 for char in text if char in simplified_chars)
        
        # If more simplified-specific characters, likely simplified
        if simp_count > trad_count:
            return Charset.simplified()
        else:
            return Charset.traditional()  # Default to traditional
    
    def needs_conversion(self, text: str, target_charset: Charset) -> bool:
        """
        Check if text needs conversion to target charset.
        
        Args:
            text: Text to check
            target_charset: Target character set
            
        Returns:
            bool: True if conversion is needed
        """
        if not text.strip():
            return False
        
        detected_charset = self.detect_charset(text)
        return detected_charset.requires_conversion_from(target_charset)
    
    def is_available(self) -> bool:
        """
        Check if OpenCC is available.
        
        Returns:
            bool: True if OpenCC is available
        """
        try:
            import opencc
            return True
        except ImportError:
            return False
    
    def get_supported_charsets(self) -> list[str]:
        """
        Get list of supported character sets.
        
        Returns:
            list: Supported character set names
        """
        return ["traditional", "simplified"]
    
    def get_service_info(self) -> Dict[str, Any]:
        """
        Get information about the service.
        
        Returns:
            dict: Service information
        """
        return {
            "service_name": "OpenCC Character Conversion",
            "is_available": self.is_available(),
            "supported_charsets": self.get_supported_charsets(),
            "loaded_converters": list(self.converters.keys())
        }
    
    def cleanup(self) -> None:
        """Clean up converter resources."""
        self.converters.clear()