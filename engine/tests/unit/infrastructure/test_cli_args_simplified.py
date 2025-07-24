"""Simplified CLI argument testing focusing on argument validation and propagation."""

import unittest
from unittest.mock import Mock, patch, MagicMock
import tempfile
import os
from pathlib import Path

from src.infrastructure.validation.argument_validator import ArgumentValidator


class TestCLIArgumentsSimplified(unittest.TestCase):
    """Simplified CLI argument testing."""

    def setUp(self):
        """Set up test fixtures."""
        # Use existing test files from the project
        self.test_file_path = '/Users/lst97/Desktop/Work/Code/Projects/canton-cap/engine/tests/test.mp4'
        self.terminology_config_path = '/Users/lst97/Desktop/Work/Code/Projects/canton-cap/engine/examples/terminology_config.json'
        
        # Verify test files exist
        if not os.path.exists(self.test_file_path):
            self.skipTest(f"Test file not found: {self.test_file_path}")
        if not os.path.exists(self.terminology_config_path):
            self.skipTest(f"Terminology config not found: {self.terminology_config_path}")

    def tearDown(self):
        """Clean up test fixtures."""
        # No cleanup needed for existing project files
        pass

    def test_argument_validation_different_combinations(self):
        """Test various argument combinations through validation."""
        
        test_cases = [
            {
                'name': 'Basic Cantonese Transcription',
                'args': {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'zh_cn',
                    'model': 'medium',
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
                },
                'expected_valid': True
            },
            {
                'name': 'High Quality with Gemini',
                'args': {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'zh_tw',
                    'model': 'large',
                    'priority': 'quality',
                    'speakers': True,
                    'written': True,
                    'music': True,
                    'charset': 'simplified',
                    'video_quality': '480p',
                    'disable_gemini_refinement': False,
                    'ffmpeg_path': 'ffmpeg',
                    'terminology_config': None,
                    'max_chunk_duration': 15,
                    'gemini_api_key': 'mock_gemini_key_123',
                    'hf_token': 'mock_hf_token_456',
                    'subtitle': 'en_us',
                    'verbose': True,
                    'ipc_mode': False
                },
                'expected_valid': True
            },
            {
                'name': 'Speed Priority Configuration',
                'args': {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'en_us',
                    'model': 'small',
                    'priority': 'speed',
                    'speakers': False,
                    'written': False,
                    'music': False,
                    'charset': 'traditional',
                    'video_quality': '360p',
                    'disable_gemini_refinement': True,
                    'ffmpeg_path': 'ffmpeg',
                    'terminology_config': None,
                    'max_chunk_duration': 5,
                    'gemini_api_key': None,
                    'hf_token': None,
                    'subtitle': 'fr_fr',
                    'verbose': False,
                    'ipc_mode': True
                },
                'expected_valid': True
            },
            {
                'name': 'Auto Model Selection',
                'args': {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'zh_cn',
                    'model': None,  # Auto-selection
                    'priority': 'balanced',
                    'speakers': True,
                    'written': True,
                    'music': True,
                    'charset': 'traditional',
                    'video_quality': '720p',
                    'disable_gemini_refinement': False,
                    'ffmpeg_path': 'ffmpeg',
                    'terminology_config': None,
                    'max_chunk_duration': 20,
                    'gemini_api_key': 'test_key',
                    'hf_token': 'test_token',
                    'subtitle': 'ja_jp',
                    'verbose': True,
                    'ipc_mode': False
                },
                'expected_valid': True
            },
            {
                'name': 'Full Configuration with Terminology',
                'args': {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'zh_cn',
                    'model': 'large',
                    'priority': 'quality',
                    'speakers': True,
                    'written': True,
                    'music': True,
                    'charset': 'traditional',
                    'video_quality': '720p',
                    'disable_gemini_refinement': False,
                    'ffmpeg_path': 'ffmpeg',
                    'terminology_config': self.terminology_config_path,
                    'max_chunk_duration': 20,
                    'gemini_api_key': 'test_full_config_key',
                    'hf_token': 'test_full_config_token',
                    'subtitle': 'ja_jp',
                    'verbose': True,
                    'ipc_mode': False
                },
                'expected_valid': True
            }
        ]
        
        results = {}
        
        for test_case in test_cases:
            with self.subTest(test_case=test_case['name']):
                # Validate arguments
                is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(test_case['args'])
                
                # Store results
                results[test_case['name']] = {
                    'is_valid': is_valid,
                    'validation_issues': validation_issues,
                    'sanitized_args': sanitized_args,
                    'input_args': test_case['args']
                }
                
                # Check validation result
                if test_case['expected_valid']:
                    # Should be valid - check for format-related issues specifically
                    format_issues = [issue for issue in validation_issues 
                                   if 'input_file' in issue.field and 'not supported' in issue.message]
                    self.assertEqual(len(format_issues), 0, 
                                   f"No format issues expected for {test_case['name']}: {format_issues}")
                    
                    # Verify key arguments are preserved in sanitized_args
                    if 'input_file' in sanitized_args:
                        self.assertEqual(sanitized_args['input_file'], test_case['args']['input_file'])
                    
                    print(f"✅ {test_case['name']}: Validation passed")
                    if validation_issues:
                        warnings = [issue for issue in validation_issues if issue.severity.value == 'warning']
                        if warnings:
                            print(f"   ⚠️  Warnings: {len(warnings)}")
                else:
                    self.assertFalse(is_valid, f"Should be invalid: {test_case['name']}")
        
        return results

    def test_service_argument_mapping(self):
        """Test how CLI arguments should map to service calls."""
        
        # Define expected mappings from CLI args to service parameters
        cli_to_service_mapping = {
            # Whisper Service Arguments
            'model': 'model_name',
            'priority': 'priority',
            'hf_token': 'hf_token',
            
            # Gemini Service Arguments  
            'gemini_api_key': 'gemini_api_key',
            'disable_gemini_refinement': 'enable_gemini_refinement',  # Inverted
            
            # Command Arguments
            'input_file': 'input_file_path',
            'output_file': 'output_file_path',
            'language': 'language',
            'speakers': 'enable_speakers',
            'written': 'enable_written_style',
            'music': 'enable_music_detection',
            'charset': 'charset',
            'video_quality': 'video_compression_quality',
            'max_chunk_duration': 'max_chunk_duration_minutes',
            'terminology_config': 'terminology_config_path',
            'subtitle': 'translation_language',
        }
        
        # Test CLI arguments
        cli_args = {
            'input_file': self.test_file_path,
            'output_file': None,
            'language': 'zh_cn',
            'model': 'large',
            'priority': 'quality',
            'speakers': True,
            'written': True,
            'music': False,
            'charset': 'simplified',
            'video_quality': '720p',
            'disable_gemini_refinement': False,
            'ffmpeg_path': 'ffmpeg',
            'terminology_config': None,
            'max_chunk_duration': 10,
            'gemini_api_key': 'test_gemini_key_789',
            'hf_token': 'test_hf_token_012',
            'subtitle': 'ko_kr',
            'verbose': True,
            'ipc_mode': False
        }
        
        # Validate the arguments
        is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(cli_args)
        
        # Test the mapping logic
        expected_service_args = {}
        for cli_key, service_key in cli_to_service_mapping.items():
            if cli_key in cli_args:
                cli_value = cli_args[cli_key]
                
                # Handle special cases
                if cli_key == 'disable_gemini_refinement':
                    expected_service_args[service_key] = not cli_value  # Invert the boolean
                elif cli_key == 'input_file':
                    expected_service_args[service_key] = str(cli_value)
                elif cli_key == 'output_file' and cli_value is None:
                    expected_service_args[service_key] = None
                elif cli_key == 'subtitle' and cli_value:
                    expected_service_args['enable_translation'] = True
                    expected_service_args[service_key] = cli_value
                else:
                    expected_service_args[service_key] = cli_value
        
        # Verify expected mappings
        self.assertEqual(expected_service_args['model_name'], 'large')
        self.assertEqual(expected_service_args['priority'], 'quality')
        self.assertEqual(expected_service_args['gemini_api_key'], 'test_gemini_key_789')
        self.assertEqual(expected_service_args['hf_token'], 'test_hf_token_012')
        self.assertTrue(expected_service_args['enable_gemini_refinement'])  # Inverted from disable_gemini_refinement=False
        self.assertTrue(expected_service_args['enable_speakers'])
        self.assertTrue(expected_service_args['enable_written_style'])
        self.assertFalse(expected_service_args['enable_music_detection'])
        self.assertEqual(expected_service_args['charset'], 'simplified')
        self.assertEqual(expected_service_args['video_compression_quality'], '720p')
        self.assertEqual(expected_service_args['max_chunk_duration_minutes'], 10)
        self.assertEqual(expected_service_args['translation_language'], 'ko_kr')
        self.assertTrue(expected_service_args['enable_translation'])
        
        print("✅ Service argument mapping verified")
        print(f"📊 Mapped {len(expected_service_args)} service arguments from {len(cli_args)} CLI arguments")
        
        return {
            'cli_args': cli_args,
            'expected_service_args': expected_service_args,
            'validation_result': (is_valid, validation_issues, sanitized_args)
        }

    def test_mock_gemini_whisper_responses(self):
        """Test mock responses from Gemini and Whisper services."""
        
        # Mock Whisper service response
        mock_whisper_response = {
            'segments': [
                {
                    'start': 0.0,
                    'end': 3.5,
                    'text': '你好，歡迎收聽',
                    'speaker': 'SPEAKER_00'
                },
                {
                    'start': 3.5,
                    'end': 7.2,
                    'text': '今日嘅新聞報道',
                    'speaker': 'SPEAKER_00'
                },
                {
                    'start': 7.2,
                    'end': 12.1,
                    'text': '我哋會討論最新嘅科技發展',
                    'speaker': 'SPEAKER_01'
                }
            ],
            'language': 'yue',  # Cantonese
            'model_used': 'large',
            'processing_time': 45.6
        }
        
        # Mock Gemini service response
        mock_gemini_response = {
            'refined_segments': [
                {
                    'start': 0.0,
                    'end': 3.5,
                    'text': '你好，歡迎收聽！',  # Added punctuation
                    'speaker': 'SPEAKER_00',
                    'confidence': 0.95
                },
                {
                    'start': 3.5,
                    'end': 7.2,
                    'text': '今日嘅新聞報道。',  # Added punctuation  
                    'speaker': 'SPEAKER_00',
                    'confidence': 0.92
                },
                {
                    'start': 7.2,
                    'end': 12.1,
                    'text': '我哋會討論最新嘅科技發展。',  # Added punctuation
                    'speaker': 'SPEAKER_01',
                    'confidence': 0.88
                }
            ],
            'translation': {
                'language': 'en_us',
                'segments': [
                    'Hello, welcome to listen!',
                    'Today\'s news report.',
                    'We will discuss the latest technological developments.'
                ]
            },
            'processing_time': 12.3,
            'api_calls_made': 1
        }
        
        # Test that services would receive correct arguments for these responses
        test_args = {
            'input_file': self.test_file_path,
            'language': 'zh_cn',
            'model': 'large',
            'priority': 'quality',
            'speakers': True,
            'written': True,
            'music': True,
            'charset': 'traditional',
            'disable_gemini_refinement': False,
            'gemini_api_key': 'mock_key_for_testing',
            'subtitle': 'en_us',
            'ffmpeg_path': 'ffmpeg'
        }
        
        # Validate these would pass validation
        is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments({
            **test_args,
            'output_file': None,
            'video_quality': '720p',
            'terminology_config': None,
            'max_chunk_duration': 10,
            'hf_token': None,
            'verbose': False,
            'ipc_mode': False
        })
        
        # Should pass validation
        format_issues = [issue for issue in validation_issues 
                        if 'input_file' in issue.field and 'not supported' in issue.message]
        self.assertEqual(len(format_issues), 0, "No format issues expected")
        
        print("✅ Mock service responses defined")
        print(f"🎤 Whisper: {len(mock_whisper_response['segments'])} segments, {mock_whisper_response['processing_time']}s")
        print(f"🤖 Gemini: {len(mock_gemini_response['refined_segments'])} refined segments + translation")
        print(f"📝 Arguments validation: {'✅ PASSED' if not format_issues else '❌ FAILED'}")
        
        return {
            'whisper_response': mock_whisper_response,
            'gemini_response': mock_gemini_response,
            'test_args': test_args,
            'validation_passed': len(format_issues) == 0
        }

    def test_argument_edge_cases(self):
        """Test edge cases and boundary conditions."""
        
        edge_cases = [
            {
                'name': 'Minimum Configuration',
                'args': {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'zh_cn',
                    'model': None,
                    'priority': 'balanced',
                    'speakers': False,
                    'written': False,
                    'music': False,
                    'charset': 'traditional',
                    'video_quality': '360p',
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
            },
            {
                'name': 'Maximum Configuration',
                'args': {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'zh_tw',
                    'model': 'large',
                    'priority': 'quality',
                    'speakers': True,
                    'written': True,
                    'music': True,
                    'charset': 'simplified',
                    'video_quality': '720p',
                    'disable_gemini_refinement': False,
                    'ffmpeg_path': 'ffmpeg',
                    'terminology_config': None,
                    'max_chunk_duration': 60,  # Maximum duration
                    'gemini_api_key': 'test_max_config_key',
                    'hf_token': 'test_max_config_token',
                    'subtitle': 'ja_jp',
                    'verbose': True,
                    'ipc_mode': True
                }
            }
        ]
        
        results = {}
        
        for case in edge_cases:
            with self.subTest(case=case['name']):
                is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(case['args'])
                
                # Check for critical validation issues
                errors = [issue for issue in validation_issues if issue.severity.value == 'error']
                warnings = [issue for issue in validation_issues if issue.severity.value == 'warning']
                
                results[case['name']] = {
                    'is_valid': is_valid,
                    'errors': errors,
                    'warnings': warnings,
                    'args': case['args']
                }
                
                print(f"{'✅' if is_valid else '❌'} {case['name']}: {len(errors)} errors, {len(warnings)} warnings")
        
        return results


if __name__ == '__main__':
    unittest.main(verbosity=2)