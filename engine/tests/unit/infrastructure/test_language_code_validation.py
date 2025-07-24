"""Test language code validation and alignment model compatibility."""

import unittest
import os
from src.infrastructure.validation.argument_validator import ArgumentValidator
from src.domain.value_objects import LanguageCode


class TestLanguageCodeValidation(unittest.TestCase):
    """Test language code validation and compatibility with different systems."""

    def test_supported_cantocap_language_codes(self):
        """Test that CantoCap supports full language-country codes."""
        
        # CantoCap supported language codes (simple 2-letter codes)
        cantocap_supported = [
            'zh', 'en', 'ja', 'ko', 'hi', 'vi', 'tl', 'es', 'fr',
            'de', 'it', 'pt', 'ru', 'ar', 'nl', 'uk', 'cs', 'pl',
            'hu', 'fi', 'fa', 'el', 'tr', 'da', 'he', 'ur', 'te',
            'ca', 'ml', 'no', 'nn', 'sk', 'sl', 'hr', 'ro', 'eu',
            'gl', 'ka', 'lv'
        ]
        
        print(f"\\n🧪 Testing {len(cantocap_supported)} CantoCap language codes (simple format):")
        
        for lang_code in cantocap_supported:
            with self.subTest(language_code=lang_code):
                result = ArgumentValidator.validate_language_code(lang_code)
                self.assertTrue(result.is_valid, 
                              f"Language code '{lang_code}' should be valid in CantoCap")
                print(f"✅ {lang_code}: Valid")

    def test_alignment_model_language_codes(self):
        """Test the alignment model language codes provided by user."""
        
        # Alignment model supported codes (from user's data)
        alignment_models = {
            "ja": "jonatasgrosman/wav2vec2-large-xlsr-53-japanese",
            "zh": "jonatasgrosman/wav2vec2-large-xlsr-53-chinese-zh-cn",
            "en": "WAV2VEC2_ASR_BASE_960H",  # From torch models
            "fr": "VOXPOPULI_ASR_BASE_10K_FR",
            "de": "VOXPOPULI_ASR_BASE_10K_DE",
            "es": "VOXPOPULI_ASR_BASE_10K_ES",
            "it": "VOXPOPULI_ASR_BASE_10K_IT",
            "nl": "jonatasgrosman/wav2vec2-large-xlsr-53-dutch",
            "pt": "jonatasgrosman/wav2vec2-large-xlsr-53-portuguese",
            "ru": "jonatasgrosman/wav2vec2-large-xlsr-53-russian"
        }
        
        print(f"\\n🎤 Testing {len(alignment_models)} alignment model language codes (now compatible):")
        
        for lang_code in alignment_models.keys():
            with self.subTest(language_code=lang_code):
                # These codes should now be valid in CantoCap CLI (same format)
                result = ArgumentValidator.validate_language_code(lang_code)
                self.assertTrue(result.is_valid,
                               f"Language code '{lang_code}' should now be valid in CantoCap CLI")
                print(f"✅ {lang_code}: Valid (now compatible with alignment models)")

    def test_language_code_mapping_demonstration(self):
        """Demonstrate the difference between CantoCap and alignment model language codes."""
        
        mapping_examples = [
            {
                'cantocap_code': 'zh',
                'alignment_code': 'zh',
                'description': 'Chinese'
            },
            {
                'cantocap_code': 'en', 
                'alignment_code': 'en',
                'description': 'English'
            },
            {
                'cantocap_code': 'ja',
                'alignment_code': 'ja', 
                'description': 'Japanese'
            },
            {
                'cantocap_code': 'fr',
                'alignment_code': 'fr',
                'description': 'French'
            },
            {
                'cantocap_code': 'es',
                'alignment_code': 'es',
                'description': 'Spanish'
            }
        ]
        
        print(f"\\n🔀 Language Code Mapping Examples:")
        
        for example in mapping_examples:
            cantocap_result = ArgumentValidator.validate_language_code(example['cantocap_code'])
            alignment_result = ArgumentValidator.validate_language_code(example['alignment_code'])
            
            print(f"📝 {example['description']}:")
            print(f"   CantoCap CLI: '{example['cantocap_code']}' -> {'✅ Valid' if cantocap_result.is_valid else '❌ Invalid'}")
            print(f"   Alignment:    '{example['alignment_code']}' -> {'✅ Valid' if alignment_result.is_valid else '❌ Invalid'}")
            
            # Both should now be valid since we use the same format
            self.assertTrue(cantocap_result.is_valid, f"CantoCap code should be valid: {example['cantocap_code']}")
            self.assertTrue(alignment_result.is_valid, f"Alignment code should be valid in CantoCap: {example['alignment_code']}")

    def test_language_without_spaces_compatibility(self):
        """Test languages that don't use spaces (from user's LANGUAGES_WITHOUT_SPACES)."""
        
        # User provided: LANGUAGES_WITHOUT_SPACES = ["ja", "zh"]
        languages_without_spaces = ["ja", "zh"]
        
        print(f"\\n📝 Testing LANGUAGES_WITHOUT_SPACES compatibility:")
        
        # These are now valid in CantoCap (same format as alignment models)
        for lang in languages_without_spaces:
            with self.subTest(language=lang):
                result = ArgumentValidator.validate_language_code(lang)
                self.assertTrue(result.is_valid, 
                               f"Language code '{lang}' should now be valid in CantoCap")
                print(f"✅ {lang}: Now valid in CantoCap (matches alignment models)")
        
        # Now CantoCap uses the same format as alignment models
        print("   CantoCap now uses same format as alignment models:")
        for lang in languages_without_spaces:
            result = ArgumentValidator.validate_language_code(lang)
            self.assertTrue(result.is_valid,
                          f"Language code '{lang}' should now be valid")
            print(f"   ✅ {lang}: Now valid in CantoCap")

    def test_cli_argument_validation_with_correct_codes(self):
        """Test complete CLI argument validation with correct language codes."""
        
        test_file_path = '/Users/lst97/Desktop/Work/Code/Projects/canton-cap/engine/tests/test.mp4'
        
        if not os.path.exists(test_file_path):
            self.skipTest(f"Test file not found: {test_file_path}")
        
        # Test with correct CantoCap language codes
        test_scenarios = [
            {
                'name': 'Chinese',
                'language': 'zh',
                'expected_valid': True
            },
            {
                'name': 'English',
                'language': 'en',
                'expected_valid': True
            },
            {
                'name': 'Japanese',
                'language': 'ja', 
                'expected_valid': True
            },
            {
                'name': 'Korean',
                'language': 'ko',
                'expected_valid': True
            },
            {
                'name': 'Invalid Long Code (Old Format)',
                'language': 'zh_cn',
                'expected_valid': False
            },
            {
                'name': 'Invalid Long Code (Old Format)', 
                'language': 'en_us',
                'expected_valid': False
            }
        ]
        
        print(f"\\n🧪 Testing CLI argument validation with simple language codes:")
        
        for scenario in test_scenarios:
            with self.subTest(scenario=scenario['name']):
                args = {
                    'input_file': test_file_path,
                    'output_file': None,
                    'language': scenario['language'],
                    'model': None,
                    'priority': 'balanced',
                    'speakers': False,
                    'written': False,
                    'music': False,
                    'charset': 'traditional',
                    'video_quality': '720p',
                    'disable_gemini_refinement': True,
                    'ffmpeg_path': 'ffmpeg',
                    'terminology_config': None,
                    'max_chunk_duration': 10,
                    'gemini_api_key': None,
                    'hf_token': None,
                    'subtitle': None,
                    'verbose': False,
                    'ipc_mode': False
                }
                
                is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(args)
                
                if scenario['expected_valid']:
                    # Should be valid
                    language_issues = [issue for issue in validation_issues 
                                     if 'language' in issue.field.lower()]
                    self.assertEqual(len(language_issues), 0,
                                   f"No language issues expected for {scenario['language']}: {language_issues}")
                    print(f"✅ {scenario['name']} ({scenario['language']}): Valid")
                else:
                    # Should be invalid
                    language_issues = [issue for issue in validation_issues 
                                     if 'language' in issue.field.lower()]
                    self.assertGreater(len(language_issues), 0,
                                     f"Language issues expected for {scenario['language']}")
                    print(f"❌ {scenario['name']} ({scenario['language']}): Invalid (expected)")


if __name__ == '__main__':
    import os
    unittest.main(verbosity=2)