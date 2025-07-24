"""Test the non-Chinese language warning system."""

import unittest
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from src.infrastructure.validation.argument_validator import ArgumentValidator, ValidationSeverity


class TestWarningSystem(unittest.TestCase):
    """Test the non-Chinese language warning system."""

    def test_chinese_languages_no_warning(self):
        """Test that Chinese languages don't trigger warnings."""
        
        chinese_codes = ['zh_cn', 'zh_tw']
        
        for code in chinese_codes:
            with self.subTest(language_code=code):
                result = ArgumentValidator.validate_language_code(code)
                
                # Should be valid
                self.assertTrue(result.is_valid, f"'{code}' should be valid")
                
                # Should have no warnings
                warnings = [issue for issue in result.issues if issue.severity == ValidationSeverity.WARNING]
                self.assertEqual(len(warnings), 0, f"'{code}' should not have warnings: {warnings}")
                
                print(f"✅ {code}: No warning (expected)")

    def test_non_chinese_languages_have_warning(self):
        """Test that non-Chinese languages trigger warnings."""
        
        non_chinese_codes = ['en_us', 'ja_jp', 'ko_kr', 'es_es', 'fr_fr', 'de_de']
        
        for code in non_chinese_codes:
            with self.subTest(language_code=code):
                result = ArgumentValidator.validate_language_code(code)
                
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
        
        result = ArgumentValidator.validate_language_code('en_us')
        
        self.assertTrue(result.is_valid)
        
        warnings = [issue for issue in result.issues if issue.severity == ValidationSeverity.WARNING]
        self.assertEqual(len(warnings), 1)
        
        warning = warnings[0]
        
        # Check all required elements in warning
        expected_elements = [
            "CantoCap is optimized for Chinese language processing",
            "en_us",
            "unexpected behavior",
            "reduced accuracy",
            "non-Chinese content"
        ]
        
        for element in expected_elements:
            self.assertIn(element, warning.message, f"Warning should contain: {element}")
        
        # Check suggestion
        self.assertIsNotNone(warning.suggestion)
        self.assertIn("Chinese language codes", warning.suggestion)
        self.assertIn("zh_cn, zh_tw", warning.suggestion)
        
        print(f"📝 Warning format verification passed")
        print(f"   Full message: {warning.message}")
        print(f"   Suggestion: {warning.suggestion}")

    def test_invalid_language_codes(self):
        """Test that invalid language codes still produce errors, not just warnings."""
        
        invalid_codes = ['invalid', 'zh', 'en', 'not_a_code', '']
        
        for code in invalid_codes:
            with self.subTest(language_code=code):
                result = ArgumentValidator.validate_language_code(code)
                
                # Should be invalid
                self.assertFalse(result.is_valid, f"'{code}' should be invalid")
                
                # Should have errors
                errors = [issue for issue in result.issues if issue.severity == ValidationSeverity.ERROR]
                self.assertGreater(len(errors), 0, f"'{code}' should have errors")
                
                print(f"❌ {code if code else 'empty'}: Error (expected)")

    def test_comprehensive_language_warning_behavior(self):
        """Test comprehensive warning behavior across all supported languages."""
        
        # All CantoCap supported languages
        all_languages = [
            'zh_cn', 'zh_tw',  # Chinese - no warnings
            'en_us', 'en_uk', 'en_au', 'en_ca',  # English - warnings
            'ja_jp', 'ko_kr',  # Asian - warnings
            'hi_in', 'th_th', 'vi_vn', 'id_id', 'ms_my', 'tl_ph',  # Asian - warnings
            'es_es', 'es_mx', 'fr_fr', 'fr_ca', 'de_de', 'it_it',  # European - warnings
            'pt_br', 'pt_pt', 'ru_ru', 'ar_sa'  # Others - warnings
        ]
        
        chinese_count = 0
        non_chinese_count = 0
        
        for code in all_languages:
            result = ArgumentValidator.validate_language_code(code)
            
            # All should be valid
            self.assertTrue(result.is_valid, f"'{code}' should be valid")
            
            # Check warning behavior
            warnings = [issue for issue in result.issues if issue.severity == ValidationSeverity.WARNING]
            
            if code.startswith('zh_'):
                # Chinese languages - no warnings
                self.assertEqual(len(warnings), 0, f"'{code}' should not have warnings")
                chinese_count += 1
            else:
                # Non-Chinese languages - should have warnings
                self.assertGreater(len(warnings), 0, f"'{code}' should have warnings")
                non_chinese_count += 1
        
        print(f"\n📊 Summary:")
        print(f"   Chinese languages (no warning): {chinese_count}")
        print(f"   Non-Chinese languages (with warning): {non_chinese_count}")
        print(f"   Total languages tested: {len(all_languages)}")
        
        # Verify we tested the right mix
        self.assertEqual(chinese_count, 2)  # zh_cn, zh_tw
        self.assertEqual(non_chinese_count, len(all_languages) - 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)