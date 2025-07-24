"""Tests for CharsetConversionService."""

import unittest
from unittest.mock import Mock, patch, MagicMock

from src.infrastructure.services.charset_conversion_service import CharsetConversionService
from src.domain.value_objects import Charset, ChineseCharset


class TestCharsetConversionService(unittest.TestCase):
    """Test cases for CharsetConversionService."""

    def setUp(self):
        """Set up test fixtures."""
        self.service = CharsetConversionService()
    
    def test_init(self):
        """Test service initialization."""
        self.assertEqual(self.service.converters, {})
    
    @patch('opencc.OpenCC')
    def test_get_converter_success(self, mock_opencc):
        """Test successful converter creation."""
        mock_converter = Mock()
        mock_opencc.return_value = mock_converter
        
        target_charset = Mock()
        target_charset.get_opencc_config.return_value = "s2t.json"
        
        result = self.service._get_converter(target_charset)
        
        self.assertEqual(result, mock_converter)
        self.assertIn("s2t.json", self.service.converters)
        mock_opencc.assert_called_once_with("s2t.json")
    
    @patch('opencc.OpenCC')
    def test_get_converter_cached(self, mock_opencc):
        """Test that converters are cached."""
        mock_converter = Mock()
        mock_opencc.return_value = mock_converter
        
        target_charset = Mock()
        target_charset.get_opencc_config.return_value = "s2t.json"
        
        # First call
        result1 = self.service._get_converter(target_charset)
        # Second call
        result2 = self.service._get_converter(target_charset)
        
        self.assertEqual(result1, result2)
        # OpenCC should only be called once due to caching
        mock_opencc.assert_called_once_with("s2t.json")
    
    def test_get_converter_import_error(self):
        """Test converter creation when OpenCC is not installed."""
        target_charset = Mock()
        
        with patch('builtins.__import__', side_effect=ImportError()):
            with self.assertRaises(RuntimeError) as context:
                self.service._get_converter(target_charset)
            
            self.assertIn("OpenCC not installed", str(context.exception))
    
    @patch('opencc.OpenCC')
    def test_get_converter_creation_error(self, mock_opencc):
        """Test converter creation error handling."""
        mock_opencc.side_effect = Exception("OpenCC creation failed")
        
        target_charset = Mock()
        target_charset.get_opencc_config.return_value = "invalid.json"
        
        with self.assertRaises(RuntimeError) as context:
            self.service._get_converter(target_charset)
        
        self.assertIn("Failed to create OpenCC converter", str(context.exception))
    
    @patch.object(CharsetConversionService, '_get_converter')
    def test_convert_text_success(self, mock_get_converter):
        """Test successful text conversion."""
        mock_converter = Mock()
        mock_converter.convert.return_value = "轉換後的文字"
        mock_get_converter.return_value = mock_converter
        
        target_charset = Mock()
        
        result = self.service.convert_text("原始文字", target_charset)
        
        self.assertEqual(result, "轉換後的文字")
        mock_converter.convert.assert_called_once_with("原始文字")
    
    def test_convert_text_empty_input(self):
        """Test text conversion with empty input."""
        target_charset = Mock()
        
        result = self.service.convert_text("   ", target_charset)
        
        self.assertEqual(result, "   ")
    
    @patch.object(CharsetConversionService, '_get_converter')
    def test_convert_text_error(self, mock_get_converter):
        """Test text conversion error handling."""
        mock_converter = Mock()
        mock_converter.convert.side_effect = Exception("Conversion failed")
        mock_get_converter.return_value = mock_converter
        
        target_charset = Mock()
        
        with self.assertRaises(RuntimeError) as context:
            self.service.convert_text("文字", target_charset)
        
        self.assertIn("Character set conversion failed", str(context.exception))
    
    @patch('src.domain.value_objects.Charset.traditional')
    @patch('src.domain.value_objects.Charset.simplified')
    def test_detect_charset_simplified(self, mock_simplified, mock_traditional):
        """Test charset detection for simplified text."""
        mock_simplified_charset = Mock()
        mock_simplified.return_value = mock_simplified_charset
        
        # Text with more simplified-specific characters
        text = "简体字书这个来们时间说话现见问题"
        
        result = self.service.detect_charset(text)
        
        self.assertEqual(result, mock_simplified_charset)
        mock_simplified.assert_called_once()
    
    @patch('src.domain.value_objects.Charset.traditional')
    def test_detect_charset_traditional(self, mock_traditional):
        """Test charset detection for traditional text."""
        mock_traditional_charset = Mock()
        mock_traditional.return_value = mock_traditional_charset
        
        # Text with more traditional-specific characters
        text = "繁體字書這個來們時間說話現見問題"
        
        result = self.service.detect_charset(text)
        
        self.assertEqual(result, mock_traditional_charset)
        mock_traditional.assert_called_once()
    
    @patch('src.domain.value_objects.Charset.traditional')
    def test_detect_charset_empty_input(self, mock_traditional):
        """Test charset detection with empty input."""
        mock_traditional_charset = Mock()
        mock_traditional.return_value = mock_traditional_charset
        
        result = self.service.detect_charset("   ")
        
        self.assertEqual(result, mock_traditional_charset)
        mock_traditional.assert_called_once()
    
    @patch('src.domain.value_objects.Charset.traditional')
    def test_detect_charset_neutral_text(self, mock_traditional):
        """Test charset detection with neutral text."""
        mock_traditional_charset = Mock()
        mock_traditional.return_value = mock_traditional_charset
        
        # Text without charset-specific characters
        text = "Hello 123 !@#"
        
        result = self.service.detect_charset(text)
        
        self.assertEqual(result, mock_traditional_charset)
        mock_traditional.assert_called_once()
    
    @patch.object(CharsetConversionService, 'detect_charset')
    def test_needs_conversion_true(self, mock_detect_charset):
        """Test needs_conversion when conversion is required."""
        mock_detected_charset = Mock()
        mock_detected_charset.requires_conversion_from.return_value = True
        mock_detect_charset.return_value = mock_detected_charset
        
        target_charset = Mock()
        
        result = self.service.needs_conversion("文字", target_charset)
        
        self.assertTrue(result)
        mock_detected_charset.requires_conversion_from.assert_called_once_with(target_charset)
    
    @patch.object(CharsetConversionService, 'detect_charset')
    def test_needs_conversion_false(self, mock_detect_charset):
        """Test needs_conversion when conversion is not required."""
        mock_detected_charset = Mock()
        mock_detected_charset.requires_conversion_from.return_value = False
        mock_detect_charset.return_value = mock_detected_charset
        
        target_charset = Mock()
        
        result = self.service.needs_conversion("文字", target_charset)
        
        self.assertFalse(result)
    
    def test_needs_conversion_empty_input(self):
        """Test needs_conversion with empty input."""
        target_charset = Mock()
        
        result = self.service.needs_conversion("   ", target_charset)
        
        self.assertFalse(result)
    
    def test_is_available_true(self):
        """Test availability check when OpenCC is available."""
        with patch('builtins.__import__'):
            result = self.service.is_available()
            
            self.assertTrue(result)
    
    def test_is_available_false(self):
        """Test availability check when OpenCC is not available."""
        with patch('builtins.__import__', side_effect=ImportError()):
            result = self.service.is_available()
            
            self.assertFalse(result)
    
    def test_get_supported_charsets(self):
        """Test getting supported character sets."""
        result = self.service.get_supported_charsets()
        
        self.assertEqual(result, ["traditional", "simplified"])
    
    @patch.object(CharsetConversionService, 'is_available')
    @patch.object(CharsetConversionService, 'get_supported_charsets')
    def test_get_service_info(self, mock_get_supported, mock_is_available):
        """Test getting service information."""
        mock_is_available.return_value = True
        mock_get_supported.return_value = ["traditional", "simplified"]
        
        # Add some cached converters
        self.service.converters = {"s2t.json": Mock(), "t2s.json": Mock()}
        
        result = self.service.get_service_info()
        
        expected = {
            "service_name": "OpenCC Character Conversion",
            "is_available": True,
            "supported_charsets": ["traditional", "simplified"],
            "loaded_converters": ["s2t.json", "t2s.json"]
        }
        
        self.assertEqual(result, expected)
    
    def test_cleanup(self):
        """Test service cleanup."""
        # Add some cached converters
        self.service.converters = {"s2t.json": Mock(), "t2s.json": Mock()}
        
        self.service.cleanup()
        
        self.assertEqual(self.service.converters, {})
    
    def test_print_function_with_rich(self):
        """Test print function when Rich is available."""
        from src.infrastructure.services.charset_conversion_service import _print
        
        with patch('src.infrastructure.services.charset_conversion_service._console') as mock_console:
            _print("test message", "bold")
            
            mock_console.print.assert_called_once_with("test message", style="bold")
    
    def test_print_function_no_style(self):
        """Test print function without style."""
        from src.infrastructure.services.charset_conversion_service import _print
        
        with patch('src.infrastructure.services.charset_conversion_service._console') as mock_console:
            _print("test message")
            
            mock_console.print.assert_called_once_with("test message")
    
    def test_integration_charset_detection(self):
        """Integration test for charset detection with real Chinese text."""
        # Traditional Chinese text
        traditional_text = "這是繁體中文"
        detected = self.service.detect_charset(traditional_text)
        self.assertIsNotNone(detected)
        
        # Simplified Chinese text  
        simplified_text = "这是简体中文"
        detected = self.service.detect_charset(simplified_text)
        self.assertIsNotNone(detected)


if __name__ == '__main__':
    unittest.main()