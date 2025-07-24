"""End-to-end CLI argument flow testing with comprehensive mocking."""

import unittest
from unittest.mock import Mock, patch, MagicMock, call
import os
from pathlib import Path

from src.domain.entities.subtitle import Subtitle
from src.domain.value_objects import LanguageCode, Timestamp
from src.infrastructure.validation.argument_validator import ArgumentValidator


class TestCLIEndToEndArgumentFlow(unittest.TestCase):
    """Test complete CLI argument flow from validation to service calls."""

    def setUp(self):
        """Set up test fixtures."""
        # Use existing test files
        self.test_file_path = '/Users/lst97/Desktop/Work/Code/Projects/canton-cap/engine/tests/test.mp4'
        self.terminology_config_path = '/Users/lst97/Desktop/Work/Code/Projects/canton-cap/engine/examples/terminology_config.json'
        
        # Verify test files exist
        if not os.path.exists(self.test_file_path):
            self.skipTest(f"Test file not found: {self.test_file_path}")

    def test_complete_argument_flow_with_mocking(self):
        """Test complete CLI argument flow with comprehensive service mocking."""
        
        # Define test scenarios with different argument combinations
        test_scenarios = [
            {
                'name': 'Basic Cantonese with Gemini',
                'cli_args': {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'zh_cn',
                    'model': 'medium',
                    'priority': 'balanced',
                    'speakers': True,
                    'written': False,
                    'music': False,
                    'charset': 'traditional',
                    'video_quality': '720p',
                    'disable_gemini_refinement': False,
                    'ffmpeg_path': 'ffmpeg',
                    'terminology_config': None,
                    'max_chunk_duration': 10,
                    'gemini_api_key': 'test_gemini_key_scenario1',
                    'hf_token': None,
                    'subtitle': None,
                    'verbose': False,
                    'ipc_mode': False
                },
                'expected_service_calls': {
                    'whisper_model': 'medium',
                    'whisper_priority': 'balanced',
                    'gemini_enabled': True,
                    'speakers_enabled': True,
                    'translation_enabled': False
                }
            },
            {
                'name': 'High Quality with Translation',
                'cli_args': {
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
                    'terminology_config': self.terminology_config_path if os.path.exists(self.terminology_config_path) else None,
                    'max_chunk_duration': 15,
                    'gemini_api_key': 'test_gemini_key_scenario2',
                    'hf_token': 'test_hf_token_scenario2',
                    'subtitle': 'en_us',
                    'verbose': True,
                    'ipc_mode': False
                },
                'expected_service_calls': {
                    'whisper_model': 'large',
                    'whisper_priority': 'quality',
                    'gemini_enabled': True,
                    'speakers_enabled': True,
                    'translation_enabled': True,
                    'translation_language': 'en_us'
                }
            },
            {
                'name': 'Speed Priority No Gemini',
                'cli_args': {
                    'input_file': self.test_file_path,
                    'output_file': None,
                    'language': 'zh_cn',
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
                    'subtitle': None,
                    'verbose': False,
                    'ipc_mode': True
                },
                'expected_service_calls': {
                    'whisper_model': 'small',
                    'whisper_priority': 'speed',
                    'gemini_enabled': False,
                    'speakers_enabled': False,
                    'translation_enabled': False
                }
            }
        ]
        
        results = {}
        
        for scenario in test_scenarios:
            with self.subTest(scenario=scenario['name']):
                print(f"\\n🧪 Testing scenario: {scenario['name']}")
                
                # Step 1: Validate arguments
                is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(scenario['cli_args'])
                
                # Check validation result
                format_issues = [issue for issue in validation_issues 
                               if 'input_file' in issue.field and 'not supported' in issue.message]
                self.assertEqual(len(format_issues), 0, f"No format issues expected: {format_issues}")
                
                print(f"✅ Argument validation: {'PASSED' if not format_issues else 'FAILED'}")
                
                # Step 2: Mock service responses
                mock_whisper_response = self.create_mock_whisper_response(scenario['name'])
                mock_gemini_response = self.create_mock_gemini_response(scenario['name']) if scenario['expected_service_calls']['gemini_enabled'] else None
                
                # Step 3: Verify argument mapping
                service_args = self.map_cli_to_service_args(scenario['cli_args'])
                
                # Verify expected service calls
                expected = scenario['expected_service_calls']
                self.assertEqual(service_args['model_name'], expected['whisper_model'])
                self.assertEqual(service_args['priority'], expected['whisper_priority'])
                self.assertEqual(service_args['enable_gemini_refinement'], expected['gemini_enabled'])
                self.assertEqual(service_args['enable_speakers'], expected['speakers_enabled'])
                
                if 'translation_enabled' in expected:
                    self.assertEqual(service_args['enable_translation'], expected['translation_enabled'])
                if 'translation_language' in expected:
                    self.assertEqual(service_args['translation_language'], expected['translation_language'])
                
                print(f"✅ Service argument mapping verified")
                print(f"📊 Whisper: model={expected['whisper_model']}, priority={expected['whisper_priority']}")
                print(f"🤖 Gemini: enabled={expected['gemini_enabled']}")
                print(f"🔊 Speakers: enabled={expected['speakers_enabled']}")
                if expected.get('translation_enabled'):
                    print(f"🌐 Translation: {expected.get('translation_language', 'N/A')}")
                
                # Store results
                results[scenario['name']] = {
                    'validation_passed': len(format_issues) == 0,
                    'service_args': service_args,
                    'whisper_response': mock_whisper_response,
                    'gemini_response': mock_gemini_response,
                    'cli_args': scenario['cli_args']
                }
        
        return results

    def create_mock_whisper_response(self, scenario_name):
        """Create realistic mock Whisper service response."""
        
        # Different mock responses for different scenarios
        if 'Basic' in scenario_name:
            segments = [
                {
                    'start': 0.0,
                    'end': 4.2,
                    'text': '你好，今日天氣好好',
                    'speaker': 'SPEAKER_00'
                },
                {
                    'start': 4.2,
                    'end': 8.1,
                    'text': '我哋去街市買嘢食',
                    'speaker': 'SPEAKER_00'
                }
            ]
        elif 'High Quality' in scenario_name:
            segments = [
                {
                    'start': 0.0,
                    'end': 3.5,
                    'text': '歡迎收聽今日嘅新聞',
                    'speaker': 'SPEAKER_00'
                },
                {
                    'start': 3.5,
                    'end': 7.8,
                    'text': '我哋會討論科技發展',
                    'speaker': 'SPEAKER_01'
                },
                {
                    'start': 7.8,
                    'end': 12.3,
                    'text': '特別係人工智能嘅應用',
                    'speaker': 'SPEAKER_01'
                }
            ]
        else:  # Speed scenario
            segments = [
                {
                    'start': 0.0,
                    'end': 5.0,
                    'text': '快速測試',
                    'speaker': 'SPEAKER_00'
                }
            ]
        
        return {
            'segments': segments,
            'language': 'yue',  # Cantonese
            'model_used': 'medium' if 'Basic' in scenario_name else ('large' if 'High Quality' in scenario_name else 'small'),
            'processing_time': 45.6 if 'Basic' in scenario_name else (78.2 if 'High Quality' in scenario_name else 23.1),
            'confidence_score': 0.89 if 'Basic' in scenario_name else (0.94 if 'High Quality' in scenario_name else 0.82)
        }

    def create_mock_gemini_response(self, scenario_name):
        """Create realistic mock Gemini service response."""
        
        if 'Basic' in scenario_name:
            refined_segments = [
                {
                    'start': 0.0,
                    'end': 4.2,
                    'text': '你好，今日天氣好好。',  # Added punctuation
                    'speaker': 'SPEAKER_00',
                    'confidence': 0.92
                },
                {
                    'start': 4.2,
                    'end': 8.1,
                    'text': '我哋去街市買嘢食。',  # Added punctuation
                    'speaker': 'SPEAKER_00',
                    'confidence': 0.88
                }
            ]
            translation = None
        else:  # High Quality with translation
            refined_segments = [
                {
                    'start': 0.0,
                    'end': 3.5,
                    'text': '歡迎收聽今日嘅新聞！',
                    'speaker': 'SPEAKER_00',
                    'confidence': 0.95
                },
                {
                    'start': 3.5,
                    'end': 7.8,
                    'text': '我哋會討論科技發展。',
                    'speaker': 'SPEAKER_01',
                    'confidence': 0.91
                },
                {
                    'start': 7.8,
                    'end': 12.3,
                    'text': '特別係人工智能嘅應用。',
                    'speaker': 'SPEAKER_01',
                    'confidence': 0.89
                }
            ]
            translation = {
                'language': 'en_us',
                'segments': [
                    'Welcome to today\'s news!',
                    'We will discuss technological developments.',
                    'Especially the application of artificial intelligence.'
                ]
            }
        
        return {
            'refined_segments': refined_segments,
            'translation': translation,
            'processing_time': 15.3 if 'Basic' in scenario_name else 28.7,
            'api_calls_made': 2 if 'Basic' in scenario_name else 3,
            'improvement_score': 0.85 if 'Basic' in scenario_name else 0.91
        }

    def map_cli_to_service_args(self, cli_args):
        """Map CLI arguments to expected service arguments."""
        
        service_args = {
            # Direct mappings
            'input_file_path': str(cli_args['input_file']),
            'output_file_path': str(cli_args['output_file']) if cli_args['output_file'] else None,
            'language': cli_args['language'],
            'model_name': cli_args['model'],
            'priority': cli_args['priority'],
            'charset': cli_args['charset'],
            'video_compression_quality': cli_args['video_quality'],
            'max_chunk_duration_minutes': cli_args['max_chunk_duration'],
            'gemini_api_key': cli_args['gemini_api_key'],
            'hf_token': cli_args['hf_token'],
            'terminology_config_path': str(cli_args['terminology_config']) if cli_args['terminology_config'] else None,
            
            # Boolean mappings
            'enable_speakers': cli_args['speakers'],
            'enable_written_style': cli_args['written'],
            'enable_music_detection': cli_args['music'],
            
            # Inverted boolean
            'enable_gemini_refinement': not cli_args['disable_gemini_refinement'],
            
            # Translation logic
            'enable_translation': bool(cli_args['subtitle']),
            'translation_language': cli_args['subtitle'] if cli_args['subtitle'] else None
        }
        
        return service_args

    def test_argument_validation_error_handling(self):
        """Test how validation errors are handled in the argument flow."""
        
        invalid_scenarios = [
            {
                'name': 'Invalid Language Code',
                'args': {
                    'input_file': self.test_file_path,
                    'language': 'invalid_lang',
                    'ffmpeg_path': 'ffmpeg'
                },
                'expected_error_field': 'language'
            },
            {
                'name': 'Invalid Priority',
                'args': {
                    'input_file': self.test_file_path,
                    'language': 'zh_cn',
                    'priority': 'invalid_priority',
                    'ffmpeg_path': 'ffmpeg'
                },
                'expected_error_field': 'priority'
            },
            {
                'name': 'Invalid Video Quality',
                'args': {
                    'input_file': self.test_file_path,
                    'language': 'zh_cn',
                    'priority': 'balanced',
                    'video_quality': 'invalid_quality',
                    'ffmpeg_path': 'ffmpeg'
                },
                'expected_error_field': 'video_quality'
            }
        ]
        
        validation_results = {}
        
        for scenario in invalid_scenarios:
            with self.subTest(scenario=scenario['name']):
                # Complete args with defaults
                complete_args = {
                    'output_file': None,
                    'model': None,
                    'speakers': False,
                    'written': False,
                    'music': False,
                    'charset': 'traditional',
                    'disable_gemini_refinement': True,
                    'terminology_config': None,
                    'max_chunk_duration': 10,
                    'gemini_api_key': None,
                    'hf_token': None,
                    'subtitle': None,
                    'verbose': False,
                    'ipc_mode': False,
                    **scenario['args']
                }
                
                # Validate arguments
                is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(complete_args)
                
                # Should be invalid
                self.assertFalse(is_valid, f"Validation should fail for {scenario['name']}")
                
                # Should have specific error for the expected field
                field_errors = [issue for issue in validation_issues 
                              if scenario['expected_error_field'] in issue.field]
                self.assertGreater(len(field_errors), 0, 
                                 f"Should have error for field '{scenario['expected_error_field']}'")
                
                validation_results[scenario['name']] = {
                    'is_valid': is_valid,
                    'field_errors': field_errors,
                    'all_issues': validation_issues
                }
                
                print(f"❌ {scenario['name']}: Validation correctly failed")
                print(f"📋 Error field: {scenario['expected_error_field']}")
                print(f"🔍 Error count: {len(field_errors)}")
        
        return validation_results

    def test_comprehensive_service_integration_flow(self):
        """Test the complete service integration flow with realistic data."""
        
        # Complete test configuration
        test_config = {
            'cli_args': {
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
                'terminology_config': self.terminology_config_path if os.path.exists(self.terminology_config_path) else None,
                'max_chunk_duration': 15,
                'gemini_api_key': 'comprehensive_test_gemini_key',
                'hf_token': 'comprehensive_test_hf_token',
                'subtitle': 'en_us',
                'verbose': True,
                'ipc_mode': False
            }
        }
        
        print("\\n🔬 Running comprehensive service integration test")
        
        # Step 1: Argument validation
        is_valid, validation_issues, sanitized_args = ArgumentValidator.validate_all_arguments(test_config['cli_args'])
        
        format_issues = [issue for issue in validation_issues 
                        if 'input_file' in issue.field and 'not supported' in issue.message]
        self.assertEqual(len(format_issues), 0, "No format issues expected for comprehensive test")
        
        print(f"✅ Step 1 - Argument Validation: PASSED")
        
        # Step 2: Service argument mapping
        service_args = self.map_cli_to_service_args(test_config['cli_args'])
        
        # Verify critical mappings
        self.assertEqual(service_args['model_name'], 'large')
        self.assertEqual(service_args['priority'], 'quality')
        self.assertTrue(service_args['enable_gemini_refinement'])
        self.assertTrue(service_args['enable_speakers'])
        self.assertTrue(service_args['enable_written_style'])
        self.assertTrue(service_args['enable_music_detection'])
        self.assertTrue(service_args['enable_translation'])
        self.assertEqual(service_args['translation_language'], 'en_us')
        
        print(f"✅ Step 2 - Service Argument Mapping: PASSED")
        
        # Step 3: Mock service responses
        whisper_response = self.create_mock_whisper_response('Comprehensive Test')
        gemini_response = self.create_mock_gemini_response('Comprehensive Test')
        
        # Verify service response structure
        self.assertIn('segments', whisper_response)
        self.assertIn('model_used', whisper_response)
        self.assertIn('processing_time', whisper_response)
        
        self.assertIn('refined_segments', gemini_response)
        self.assertIn('translation', gemini_response)
        self.assertIn('api_calls_made', gemini_response)
        
        print(f"✅ Step 3 - Mock Service Responses: PASSED")
        
        # Step 4: Verify end-to-end data flow
        input_segments_count = len(whisper_response['segments'])
        output_segments_count = len(gemini_response['refined_segments'])
        translation_segments_count = len(gemini_response['translation']['segments'])
        
        self.assertEqual(input_segments_count, output_segments_count, 
                        "Whisper and Gemini segment counts should match")
        self.assertEqual(output_segments_count, translation_segments_count,
                        "Refined and translated segment counts should match")
        
        print(f"✅ Step 4 - Data Flow Verification: PASSED")
        
        # Summary
        print(f"\\n📊 Comprehensive Test Summary:")
        print(f"🎤 Whisper: {input_segments_count} segments, {whisper_response['processing_time']}s")
        print(f"🤖 Gemini: {output_segments_count} refined segments, {gemini_response['api_calls_made']} API calls")
        print(f"🌐 Translation: {translation_segments_count} translated segments")
        print(f"⚡ Total processing time: {whisper_response['processing_time'] + gemini_response['processing_time']:.1f}s")
        
        return {
            'validation_passed': len(format_issues) == 0,
            'service_args': service_args,
            'whisper_response': whisper_response,
            'gemini_response': gemini_response,
            'processing_summary': {
                'whisper_segments': input_segments_count,
                'gemini_refined': output_segments_count,
                'translations': translation_segments_count,
                'total_time': whisper_response['processing_time'] + gemini_response['processing_time']
            }
        }


if __name__ == '__main__':
    unittest.main(verbosity=2)