"""Test the non-Chinese language warning system.

Note: This test validates the alignment language system (--language parameter) 
which uses short format codes like 'zh', 'en', 'ja' and includes warning system.

The subtitle translation system (--subtitle parameter) uses long format codes 
like 'zh_cn', 'en_us', 'ja_jp' but does NOT include warnings since subtitles 
are generated based on transcription.
"""

import unittest
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from src.infrastructure.validation.argument_validator import ArgumentValidator, ValidationSeverity


class TestWarningSystem(unittest.TestCase):
    """Test the non-Chinese language warning system for alignment validation."""

    def test_chinese_languages_no_warning(self):
        """Test that Chinese alignment languages don't trigger warnings."""
        
        # Test alignment language codes (short format like zh)
        chinese_alignment_codes = ['zh']
        
        for code in chinese_alignment_codes:
            with self.subTest(language_code=code):
                result = ArgumentValidator.validate_alignment_language_code(code)
                
                # Should be valid
                self.assertTrue(result.is_valid, f"'{code}' should be valid")
                
                # Should have no warnings
                warnings = [issue for issue in result.issues if issue.severity == ValidationSeverity.WARNING]
                self.assertEqual(len(warnings), 0, f"'{code}' should not have warnings: {warnings}")
                
                print(f"✅ {code}: No warning (expected)")

    def test_non_chinese_languages_have_warning(self):
        """Test that non-Chinese alignment languages trigger warnings."""
        
        # Test alignment language codes (short format like en, ja)
        non_chinese_alignment_codes = ['en', 'ja', 'ko', 'es', 'fr', 'de']
        
        for code in non_chinese_alignment_codes:
            with self.subTest(language_code=code):
                result = ArgumentValidator.validate_alignment_language_code(code)
                
                # Should still be valid
                self.assertTrue(result.is_valid, f"'{code}' should be valid")
                
                # Should have warnings
                warnings = [issue for issue in result.issues if issue.severity == ValidationSeverity.WARNING]
                self.assertGreater(len(warnings), 0, f"'{code}' should have warnings")
                
                # Check warning message content
                warning_message = warnings[0].message
                self.assertIn("CantoCap is optimized for Chinese", warning_message)
                self.assertIn("unexpected behavior", warning_message)
                self.assertIn(code, warning_message)
                
                print(f"⚠️  {code}: Warning present (expected)")
                print(f"   Message: {warning_message[:80]}...")

    def test_warning_message_format(self):
        """Test the specific format of warning messages."""
        
        result = ArgumentValidator.validate_alignment_language_code('en')
        
        self.assertTrue(result.is_valid)
        
        warnings = [issue for issue in result.issues if issue.severity == ValidationSeverity.WARNING]
        self.assertEqual(len(warnings), 1)
        
        warning = warnings[0]
        
        # Check all required elements in warning
        expected_elements = [
            "CantoCap is optimized for Chinese language processing",
            "en",
            "unexpected behavior",
            "reduced accuracy",
            "non-Chinese content"
        ]
        
        for element in expected_elements:
            self.assertIn(element, warning.message, f"Warning should contain: {element}")
        
        # Check suggestion
        self.assertIsNotNone(warning.suggestion)
        self.assertIn("Chinese language code", warning.suggestion)
        self.assertIn("zh", warning.suggestion)
        
        print(f"📝 Warning format verification passed")
        print(f"   Full message: {warning.message}")
        print(f"   Suggestion: {warning.suggestion}")

    def test_invalid_language_codes(self):
        """Test that invalid language codes still produce errors, not just warnings."""
        
        # These codes are invalid for alignment language (short format expected)
        invalid_alignment_codes = ['invalid', 'zh_cn', 'en_us', 'not_a_code', '']
        
        for code in invalid_alignment_codes:
            with self.subTest(language_code=code):
                result = ArgumentValidator.validate_alignment_language_code(code)
                
                # Should be invalid
                self.assertFalse(result.is_valid, f"'{code}' should be invalid")
                
                # Should have errors
                errors = [issue for issue in result.issues if issue.severity == ValidationSeverity.ERROR]
                self.assertGreater(len(errors), 0, f"'{code}' should have errors")
                
                print(f"❌ {code if code else 'empty'}: Error (expected)")

    def test_comprehensive_language_warning_behavior(self):
        """Test comprehensive warning behavior across all supported alignment languages."""
        
        # All CantoCap supported alignment languages (short format)
        all_alignment_languages = [
            'zh',  # Chinese - no warnings
            'en', 'fr', 'de', 'es', 'it',  # Core - warnings
            'ja', 'nl', 'uk', 'pt', 'ar', 'cs', 'ru', 'pl',  # Extended - warnings
            'hu', 'fi', 'fa', 'el', 'tr', 'da', 'he', 'vi',  # More - warnings
            'ko', 'ur', 'te', 'hi', 'ca', 'ml', 'no', 'nn',  # Additional - warnings
            'sk', 'sl', 'hr', 'ro', 'eu', 'gl', 'ka', 'lv', 'tl'  # Final - warnings
        ]
        
        chinese_count = 0
        non_chinese_count = 0
        
        for code in all_alignment_languages:
            result = ArgumentValidator.validate_alignment_language_code(code)
            
            # All should be valid
            self.assertTrue(result.is_valid, f"'{code}' should be valid")
            
            # Check warning behavior
            warnings = [issue for issue in result.issues if issue.severity == ValidationSeverity.WARNING]
            
            if code == 'zh':
                # Chinese language - no warnings
                self.assertEqual(len(warnings), 0, f"'{code}' should not have warnings")
                chinese_count += 1
            else:
                # Non-Chinese languages - should have warnings
                self.assertGreater(len(warnings), 0, f"'{code}' should have warnings")
                non_chinese_count += 1
        
        print(f"\n📊 Summary:")
        print(f"   Chinese alignment languages (no warning): {chinese_count}")
        print(f"   Non-Chinese alignment languages (with warning): {non_chinese_count}")
        print(f"   Total alignment languages tested: {len(all_alignment_languages)}")
        
        # Verify we tested the right mix
        self.assertEqual(chinese_count, 1)  # zh
        self.assertEqual(non_chinese_count, len(all_alignment_languages) - 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)